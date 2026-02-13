const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const { generateLicenseKey, PRODUCTS } = require('./src/generator');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 650,
        resizable: false,
        frame: true,
        icon: path.join(__dirname, 'assets/icons/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ============================================================
// IPC Handlers
// ============================================================

// Get products list
ipcMain.handle('get-products', () => {
    return Object.entries(PRODUCTS).map(([id, product]) => ({
        id,
        name: product.name,
        code: product.code,
        color: product.color
    }));
});

// Generate license key
ipcMain.handle('generate-license', (event, { productId, hardwareId, expiryDate }) => {
    return generateLicenseKey(productId, hardwareId, expiryDate);
});

// Copy to clipboard
ipcMain.handle('copy-to-clipboard', (event, text) => {
    clipboard.writeText(text);
    return true;
});
