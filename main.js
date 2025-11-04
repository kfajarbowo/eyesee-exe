// Electron
const { app, Menu, ipcMain, dialog } = require("electron");

let mainWindow;

app.whenReady().then(() => {
  // Main window
  const window = require("./src/window");
  mainWindow = window.createBrowserWindow(app);

  // Option 1: Uses Webtag and load a custom html file with external content
  mainWindow.loadFile("index.html");
  //mainWindow.loadURL(`file://${__dirname}/index.html`);

  // Option 2: Load directly an URL if you don't need interface customization
  //mainWindow.loadURL("https://github.com");

  // Option 3: Uses BrowserView to load an URL
  //const view = require("./src/view");
  //view.createBrowserView(mainWindow);

  // Display Dev Tools
  //mainWindow.openDevTools();

  // Menu (for standard keyboard shortcuts)
  const menu = require("./src/menu");
  const template = menu.createTemplate(app.name, mainWindow);
  const builtMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(builtMenu);

  // Print function (if enabled)
  require("./src/print");
});

// IPC handlers for URL navigation
ipcMain.handle('navigate-to-url', async (event, url) => {
  if (mainWindow) {
    mainWindow.webContents.send('navigate-webview', url);
  }
});

ipcMain.handle('show-url-dialog', async () => {
  // Send message to renderer to show the modal
  mainWindow.webContents.send('show-url-input-modal');
  
  // Return a promise that resolves when the user submits the URL
  return new Promise((resolve) => {
    ipcMain.once('url-input-response', (event, url) => {
      resolve(url);
    });
  });
});

// Handle URL input response from renderer
ipcMain.on('url-input-response', (event, url) => {
  // This will be handled by the promise above
});

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  //if (process.platform !== "darwin") {
  app.quit();
  //}
});
