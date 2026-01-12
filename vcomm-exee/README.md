# VComm Electron Webview

> Simple Electron application to create a webview for VComm

This is a simple Electron application to create a webview for VComm application, based on the template from [electron-webview](https://github.com/hajidalakhtar/electron-webview).

## Features

* Responsive window
* Remember the window dimensions when reopening
* Menu & keyboard shortcuts for macOS
* No title bar
* Home button
* Print function
* macOS, Windows and Linux executable with an app icon
* DMG installer for Mac

## Installation

To run this repository you'll need Node.js (which comes with npm) installed on your computer. From your command line:

```bash
# Install dependencies
npm install

# Run the app
npm start
```

## Configuration

The webview is configured to load `http://localhost:5000/` by default. You can change the `src` attribute of the `webview` in `index.html` file to display a different URL.

Alternatively, it's also possible to just load an external URL:

```javascript
// In main.js, comment:
// mainWindow.loadURL(`file://${__dirname}/index.html`);

// Uncomment:
mainWindow.loadURL("https://github.com"); // Load directly an URL if you don't need interface customization

// Or uncomment if you prefer to use BrowserView:
const view = require("./src/view");
view.createBrowserView(mainWindow);
```

### Developer tools

You can show by default the developer tools by uncommenting in `main.js` file: `mainWindow.openDevTools();`.

### Title bar

You can hide the title bar of the app by setting `frame: false` or `titleBarStyle: 'hidden'` when creating the window in `main.js` in `mainWindow` variable.

### Window dimensions

If you want to change the window dimensions at the first start, change `width` and `height` in `src/window.js` file in `createWindow` function.

### Menu and keyboard shortcuts

This webview integrates an Electron menu. It will also make standard keyboard shortcuts, like copy and paste, work on macOS.

You can modify this menu in `src/menu.js` file.

### Topbar (home and print buttons)

A topbar to show buttons:

* "Home" button to come back to your app if your website has external links.
* "Print" button to print the current URL displayed by the webview.

You can activate/deactivate this topbar (activate by default).

#### Deactivation

1. In `index.html`: Comment the topbar CSS and HTML, uncomment `no-topbar.css`
2. In `assets/js/renderer.js`: Comment the home and print button handlers
3. In `src/window.js`: Comment the preload script
4. In `main.js`: Comment the print setup

## Building the Application

### Electron app icon

For this we need a 1024x1024 png-icon, a .icns for macs and a .ico for windows.

1. Create your app icon
2. Add your files in `assets/icons`: put the `.icns` file into the `mac` folder, the pngs in the `png` folder and the `.ico` file in the `win` folder
3. Rename the `.icns` and `.ico` files to `icon`

### Build packages

Install electron-packager:

```bash
npm install electron-packager --save-dev
```

Then run:

```bash
# macOS
npm run package-mac

# Windows
npm run package-win

# Linux
npm run package-linux
```

### Mac installer

To create a DMG installer:

```bash
npm install electron-installer-dmg --save-dev
npm run create-installer-mac
```

## Project Structure

```
vcomm-exe/
├── main.js              # Main process
├── preload.js           # Preload script for secure IPC
├── index.html           # Renderer process
├── package.json         # Project configuration
├── src/
│   ├── menu.js         # Menu template customization
│   ├── print.js        # Print function handler
│   ├── view.js         # Browser view usage
│   └── window.js       # Browser window customization
├── assets/
│   ├── css/            # Stylesheets
│   ├── js/             # Renderer scripts
│   └── icons/          # App icons
└── README.md           # This file
```

## License

MIT

## References

* [Electron Documentation](https://www.electronjs.org/docs)
* [Electron Quick Start](https://www.electronjs.org/docs/tutorial/quick-start)

