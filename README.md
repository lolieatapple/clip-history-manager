# Clipboard History Manager

A beautiful, secure, and privacy-focused clipboard history manager built with Electron.

## Features

- 🔒 **Complete Privacy**: Runs entirely offline, no data sent to servers
- 🎨 **Beautiful UI**: Modern, intuitive interface with gradient backgrounds
- 📋 **Text & Image Support**: Handles both text and image clipboard content
- 🔍 **Smart Search**: Search through clipboard history with instant filtering
- 💾 **Memory Management**: Real-time memory usage display and automatic cleanup
- 🗑️ **Easy Management**: Single-click copy, delete individual items, or clear all
- 📊 **Memory Monitoring**: Shows current memory usage of clipboard history
- ⌨️ **Keyboard Shortcuts**: Ctrl/Cmd+F for search, Ctrl/Cmd+R for refresh

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
- **View Current Clipboard**: Top section shows current clipboard content
- **Browse History**: Scroll through all clipboard items below
- **Copy from History**: Click the copy button on any item to copy it
- **Search**: Use the search box to find specific text content
- **Clear Current**: Use the "Clear" button to empty current clipboard
- **Clear All**: Use "Clear All" to remove entire history
- **Delete Item**: Click the trash icon on individual items

### Keyboard Shortcuts
- `Ctrl/Cmd + F`: Focus search box
- `Ctrl/Cmd + R`: Refresh clipboard history
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
    ├── app.js          # Frontend logic
    └── preload.js      # Secure IPC bridge
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

## Troubleshooting

### Common Issues

1. **App won't start**: Ensure Node.js 16+ is installed
2. **No clipboard detection**: Check if clipboard permissions are granted
3. **High memory usage**: Use "Clear All" to free memory, or restart the app
4. **Search not working**: Ensure you're searching text content, images can't be searched

### Debug Mode
Run with development logging:
```bash
npm run dev
```

## License

MIT License - feel free to use and modify as needed.