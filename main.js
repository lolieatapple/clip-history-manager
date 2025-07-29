const { app, BrowserWindow, ipcMain, clipboard, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let mainWindow;
let clipboardHistory = [];
let lastClipboardContent = null;
let clipboardMonitor;

// Security: Enable context isolation and disable node integration for renderer
function createWindow() {
  log.info('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'renderer', 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    log.info('Main window ready to show');
    mainWindow.show();
    startClipboardMonitoring();
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
        const imageData = currentImage.toDataURL();
        if (imageData !== lastClipboardContent) {
          newContent = imageData;
          contentType = 'image';
          lastClipboardContent = imageData;
        }
      }
      
      if (newContent) {
        log.debug(`New clipboard content detected, type: ${contentType}, length: ${newContent.length}`);
        addToHistory(newContent, contentType);
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
  const item = {
    id: Date.now(),
    content: content,
    type: type,
    timestamp: new Date().toISOString(),
    size: new Blob([content]).size
  };
  
  clipboardHistory.unshift(item);
  log.debug(`Added item to history, total items: ${clipboardHistory.length}`);
  
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('clipboard-updated', {
      history: clipboardHistory,
      currentContent: content,
      memoryUsage: getMemoryUsage()
    });
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
  clipboard.clear(); // 清空系统剪贴板
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

// Toggle window visibility function
function toggleWindow() {
  if (!mainWindow) {
    log.info('Creating new window for toggle');
    createWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    log.info('Hiding window via hotkey');
    mainWindow.hide();
  } else {
    log.info('Showing window via hotkey');
    mainWindow.show();
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

// App event handlers
app.whenReady().then(() => {
  log.info('App is ready');
  createWindow();
  registerGlobalHotkey();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
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