# Clipboard History Manager

[中文说明](README_CN.md)

A beautiful, secure, and privacy-focused clipboard history manager built with Electron.

## Screenshot

![Clipboard History Manager](clipboardHistory.png)

## Download

Download the latest release from the [Releases page](../../releases):

- **Apple Silicon (M1/M2/M3/M4)**: `Clipboard-History-Manager-*-arm64.dmg`
- **Intel Mac**: `Clipboard-History-Manager-*-x64.dmg`

## Features

- **Complete Privacy**: Runs entirely offline, no data sent to servers
- **Text & Image Support**: Handles both text and image clipboard content
- **Smart Search**: Search through clipboard history with instant filtering
- **Global Hotkey**: `Cmd+Shift+V` to quickly toggle the clipboard history window
- **Auto Paste**: Selecting an item automatically pastes it into the active input field
- **Always on Top**: Toggle always-on-top mode via hotkey when the window is visible
- **Window Dragging**: Drag the window to any position, with position persistence across sessions
- **Numbered History**: Items displayed with numbered index badges for quick reference
- **Memory Management**: Real-time memory usage display and automatic cleanup (500MB limit)
- **Keyboard Shortcuts**: `Cmd+F` for search, `Cmd+R` for refresh, `Escape` to close

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the application**:
   ```bash
   npm start
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

## Usage

### Basic Operations
- **Global Hotkey**: Press `Cmd+Shift+V` to toggle the clipboard history window
- **Select & Paste**: Click any history item to copy it and automatically paste into the active input
- **Browse History**: Scroll through all clipboard items with numbered badges
- **Search**: Use the search box to filter by text content
- **Delete Item**: Click the trash icon on individual items
- **Clear All**: Use "Clear All" to remove entire history

### Keyboard Shortcuts
- `Cmd + Shift + V`: Toggle clipboard history window
- `Cmd + F`: Focus search box
- `Cmd + R`: Refresh clipboard history
- `Escape`: Clear search or close modals

### Privacy Features
- **No Persistent Storage**: All data stays in memory only
- **No Network Access**: Completely offline operation
- **No Content Logging**: Sensitive content never logged
- **Memory-Only Storage**: History cleared when app closes

## Architecture

- **Frontend**: Pure HTML/CSS/JavaScript with modern design
- **Backend**: Electron main process with secure IPC communication
- **Security**: Context isolation enabled, no Node.js access in renderer
- **Monitoring**: 1-second clipboard polling with smart duplicate detection

## Development

### File Structure
```
├── main.js              # Electron main process
├── package.json         # Project configuration
└── renderer/
    ├── index.html       # Main UI
    ├── styles.css       # Styling
    ├── app.js           # Frontend logic
    └── preload.js       # Secure IPC bridge
```

### Logging
Logs are written to:
- **macOS**: `~/Library/Logs/clipboard-history-manager/main.log`
- **Windows**: `%USERPROFILE%\AppData\Roaming\clipboard-history-manager\logs\main.log`
- **Linux**: `~/.config/clipboard-history-manager/logs/main.log`

## Building

### Create distributable packages:
```bash
npm run build    # Creates installers for current platform
npm run pack     # Creates unpacked directory
```

## Security Notes

- All clipboard content remains in memory only
- No data is persisted to disk
- No network connections are made
- Content is never included in logs (only metadata like size and type)
- Secure IPC communication between main and renderer processes

## License

MIT License - feel free to use and modify as needed.
