const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  copyToClipboard: (content, type) => ipcRenderer.invoke('copy-to-clipboard', content, type),
  clearClipboard: () => ipcRenderer.invoke('clear-clipboard'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  deleteHistoryItem: (itemId) => ipcRenderer.invoke('delete-history-item', itemId),
  getMemoryUsage: () => ipcRenderer.invoke('get-memory-usage'),
  onClipboardUpdate: (callback) => ipcRenderer.on('clipboard-updated', callback),
  removeAllListeners: () => ipcRenderer.removeAllListeners('clipboard-updated'),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  moveWindow: (x, y) => ipcRenderer.invoke('move-window', x, y),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  togglePinItem: (itemId) => ipcRenderer.invoke('toggle-pin-item', itemId)
});
