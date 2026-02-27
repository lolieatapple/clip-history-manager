const { app, BrowserWindow, ipcMain, clipboard, nativeImage, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Memory limit: 500MB
const MAX_MEMORY_BYTES = 500 * 1024 * 1024;

let mainWindow;
let clipboardHistory = [];
let lastClipboardContent = null;
let clipboardMonitor;

// Window position persistence
function getWindowBoundsPath() {
  return path.join(app.getPath('userData'), 'window-bounds.json');
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(getWindowBoundsPath(), JSON.stringify(bounds));
  } catch (error) {
    log.error('Error saving window bounds:', error);
  }
}

function loadWindowBounds() {
  try {
    const data = fs.readFileSync(getWindowBoundsPath(), 'utf-8');
    const bounds = JSON.parse(data);
    // Validate that the saved position is within a visible display
    const displays = screen.getAllDisplays();
    const isVisible = displays.some(display => {
      const { x, y, width, height } = display.bounds;
      return bounds.x >= x - 100 && bounds.x < x + width &&
             bounds.y >= y - 100 && bounds.y < y + height;
    });
    if (isVisible) return bounds;
    log.info('Saved window position is off-screen, using default');
  } catch (error) {
    // No saved bounds or invalid file
  }
  return null;
}

// Debounce helper for saving window position
let saveTimeout;
function debouncedSaveWindowBounds() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveWindowBounds, 500);
}

// Security: Enable context isolation and disable node integration for renderer
function createWindow() {
  log.info('Creating main window...');

  const savedBounds = loadWindowBounds();
  const windowOptions = {
    width: 1000,
    height: 700,
    minWidth: 200,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'renderer', 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false,
    frame: false
  };

  if (savedBounds) {
    windowOptions.x = savedBounds.x;
    windowOptions.y = savedBounds.y;
    windowOptions.width = savedBounds.width;
    windowOptions.height = savedBounds.height;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile('renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    log.info('Main window ready to show');
    mainWindow.show();
    startClipboardMonitoring();
  });

  // Save window position on move/resize
  mainWindow.on('moved', debouncedSaveWindowBounds);
  mainWindow.on('resized', debouncedSaveWindowBounds);

  // Intercept close button: hide window instead of destroying it
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      log.info('Window close intercepted, hiding instead');
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    log.info('Main window closed');
    mainWindow = null;
    stopClipboardMonitoring();
  });
}

function startClipboardMonitoring() {
  log.info('Starting clipboard monitoring...');

  clipboardMonitor = setInterval(() => {
    try {
      const currentText = clipboard.readText();
      const currentImage = clipboard.readImage();

      let newContent = null;
      let contentType = null;

      if (currentText && currentText !== lastClipboardContent) {
        newContent = currentText;
        contentType = 'text';
        lastClipboardContent = currentText;
      } else if (!currentText && !currentImage.isEmpty()) {
        try {
          const imageData = currentImage.toDataURL();
          if (imageData && imageData !== lastClipboardContent) {
            newContent = imageData;
            contentType = 'image';
            lastClipboardContent = imageData;
          }
        } catch (imageError) {
          log.error('Error converting clipboard image to data URL:', imageError);
        }
      }

      if (newContent) {
        log.debug(`New clipboard content detected, type: ${contentType}, length: ${newContent.length}`);
        addToHistory(newContent, contentType);
      } else if (!currentText && currentImage.isEmpty() && lastClipboardContent !== null) {
        // Clipboard was cleared externally - sync the state
        log.debug('Clipboard cleared externally');
        lastClipboardContent = null;
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('clipboard-updated', {
            history: clipboardHistory,
            currentContent: null,
            contentType: null,
            memoryUsage: getMemoryUsage()
          });
        }
      }
    } catch (error) {
      log.error('Error monitoring clipboard:', error);
    }
  }, 1000);
}

function stopClipboardMonitoring() {
  if (clipboardMonitor) {
    log.info('Stopping clipboard monitoring...');
    clearInterval(clipboardMonitor);
    clipboardMonitor = null;
  }
}

function addToHistory(content, type) {
  // Feature 4: Deduplication - check for existing item with same content
  const existingIndex = clipboardHistory.findIndex(item => item.content === content);
  if (existingIndex !== -1) {
    const existing = clipboardHistory.splice(existingIndex, 1)[0];
    existing.timestamp = new Date().toISOString();
    existing.id = Date.now();
    clipboardHistory.unshift(existing);
    log.debug('Duplicate detected, moved existing item to top');
  } else {
    const item = {
      id: Date.now(),
      content: content,
      type: type,
      timestamp: new Date().toISOString(),
      size: Buffer.byteLength(content, 'utf-8'),
      pinned: false
    };
    clipboardHistory.unshift(item);
    log.debug(`Added item to history, total items: ${clipboardHistory.length}`);
  }

  // Feature 1: Enforce memory limit
  enforceMemoryLimit();

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('clipboard-updated', {
      history: clipboardHistory,
      currentContent: content,
      contentType: type,
      memoryUsage: getMemoryUsage()
    });
  }
}

function enforceMemoryLimit() {
  while (getMemoryUsage() > MAX_MEMORY_BYTES) {
    // Find the oldest non-pinned item (from the end)
    let removeIndex = -1;
    for (let i = clipboardHistory.length - 1; i >= 0; i--) {
      if (!clipboardHistory[i].pinned) {
        removeIndex = i;
        break;
      }
    }
    if (removeIndex === -1) break; // All items are pinned
    clipboardHistory.splice(removeIndex, 1);
    log.debug('Removed oldest non-pinned item to enforce memory limit');
  }
}

function getMemoryUsage() {
  return clipboardHistory.reduce((total, item) => total + item.size, 0);
}

// IPC handlers
ipcMain.handle('get-clipboard-history', () => {
  log.debug('IPC: get-clipboard-history called');
  return {
    history: clipboardHistory,
    currentContent: lastClipboardContent,
    memoryUsage: getMemoryUsage()
  };
});

ipcMain.handle('copy-to-clipboard', (event, content, type) => {
  log.debug(`IPC: copy-to-clipboard called, type: ${type}`);
  try {
    if (type === 'text') {
      clipboard.writeText(content);
    } else if (type === 'image') {
      const image = nativeImage.createFromDataURL(content);
      clipboard.writeImage(image);
    }
    lastClipboardContent = content;
    return { success: true };
  } catch (error) {
    log.error('Error copying to clipboard:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-clipboard', () => {
  log.debug('IPC: clear-clipboard called');
  try {
    clipboard.clear();
    lastClipboardContent = null;
    return { success: true };
  } catch (error) {
    log.error('Error clearing clipboard:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-history', () => {
  log.debug('IPC: clear-history called');
  clipboardHistory = [];
  lastClipboardContent = null;
  clipboard.clear();
  return { success: true, memoryUsage: 0 };
});

ipcMain.handle('delete-history-item', (event, itemId) => {
  log.debug(`IPC: delete-history-item called, id: ${itemId}`);
  const initialLength = clipboardHistory.length;
  clipboardHistory = clipboardHistory.filter(item => item.id !== itemId);
  const deleted = initialLength !== clipboardHistory.length;
  return {
    success: deleted,
    history: clipboardHistory,
    memoryUsage: getMemoryUsage()
  };
});

ipcMain.handle('get-memory-usage', () => {
  return getMemoryUsage();
});

ipcMain.handle('get-window-position', () => {
  if (!mainWindow) return { x: 0, y: 0 };
  const pos = mainWindow.getPosition();
  return { x: pos[0], y: pos[1] };
});

ipcMain.handle('move-window', (event, x, y) => {
  if (!mainWindow) return;
  mainWindow.setPosition(Math.round(x), Math.round(y));
});

// Feature 2: Hide window IPC
ipcMain.handle('hide-window', () => {
  if (mainWindow && mainWindow.isVisible()) {
    mainWindow.hide();
  }
  return { success: true };
});

// Feature 3: Toggle pin item IPC
ipcMain.handle('toggle-pin-item', (event, itemId) => {
  log.debug(`IPC: toggle-pin-item called, id: ${itemId}`);
  const item = clipboardHistory.find(i => i.id === itemId);
  if (item) {
    item.pinned = !item.pinned;
    return {
      success: true,
      history: clipboardHistory,
      memoryUsage: getMemoryUsage()
    };
  }
  return { success: false };
});

// Toggle window visibility function
function toggleWindow() {
  if (!mainWindow) {
    log.info('Creating new window for toggle');
    createWindow();
    return;
  }

  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    log.info('Window is already focused, hiding window via hotkey');
    mainWindow.hide();
  } else if (mainWindow.isVisible()) {
    log.info('Window is visible but not focused, setting window always on top via hotkey');
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
  } else {
    log.info('Showing window via hotkey');
    mainWindow.show();
    mainWindow.setAlwaysOnTop(false);
    mainWindow.focus();
  }
}

// Register global hotkey
function registerGlobalHotkey() {
  const hotkey = 'Command+Shift+V';
  const success = globalShortcut.register(hotkey, () => {
    log.info(`Global hotkey ${hotkey} pressed`);
    toggleWindow();
  });

  if (success) {
    log.info(`Global hotkey ${hotkey} registered successfully`);
  } else {
    log.error(`Failed to register global hotkey ${hotkey}`);
  }
}

// Show window function
function showWindow() {
  if (!mainWindow) {
    log.info('Creating new window for show');
    createWindow();
    return;
  }

  if (!mainWindow.isVisible()) {
    log.info('Showing window via dock/app icon');
    mainWindow.show();
    mainWindow.focus();
  } else if (!mainWindow.isFocused()) {
    log.info('Focusing existing window');
    mainWindow.focus();
  }
}

// App event handlers
app.whenReady().then(() => {
  log.info('App is ready');
  createWindow();
  registerGlobalHotkey();

  app.on('activate', () => {
    log.info('App activated (dock icon clicked)');
    showWindow();
  });
});

app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('App is quitting...');
  app.isQuitting = true;
  saveWindowBounds();
  stopClipboardMonitoring();
  globalShortcut.unregisterAll();
  log.info('Global shortcuts unregistered');
});

// Handle security
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    log.warn('Blocked new window request:', navigationUrl);
  });
});
