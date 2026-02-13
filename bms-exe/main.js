/**
 * BMS Application - Main Process
 * 
 * Entry point for the Electron application.
 * Handles license validation, window management, and IPC communication.
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const window = require('./src/window');
const menu = require('./src/menu');
const print = require('./src/print');

// License system
const { licenseManager, LicenseStatus } = require('./src/license');

// ============================================================================
// Configuration
// ============================================================================

// License server URL - change this for production
// License server URL - priority: Env Var -> Config File -> Default
const fs = require('fs');

function getServerUrl() {
    // 1. Environment Variable
    if (process.env.LICENSE_SERVER_URL) {
        return process.env.LICENSE_SERVER_URL;
    }

    // 2. Config File (server-config.json)
    // In production, look next to the executable. In dev, look in project root.
    const configPath = app.isPackaged 
        ? path.join(path.dirname(process.execPath), 'server-config.json')
        : path.join(__dirname, 'server-config.json');

    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            if (config.serverUrl) {
                console.log('[App] Loaded server URL from config:', config.serverUrl);
                return config.serverUrl;
            }
        }
    } catch (error) {
        console.error('[App] Error reading server-config.json:', error);
    }

    // 3. Default (Localhost)
    return 'http://127.0.0.1:3000';
}

const LICENSE_SERVER_URL = getServerUrl();

// ============================================================================
// Window Management
// ============================================================================

let mainWindow;
let licenseWindow;

/**
 * Create the license activation window
 */
function createLicenseWindow(message = null) {
    licenseWindow = new BrowserWindow({
        width: 480,
        height: 620,
        resizable: false,
        frame: true,
        icon: path.join(__dirname, 'assets/icons/png/logo-bms.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    licenseWindow.setMenuBarVisibility(false);
    licenseWindow.loadFile('license-dialog.html');

    // Pass custom message if provided
    if (message) {
        licenseWindow.webContents.on('did-finish-load', () => {
            licenseWindow.webContents.send('license-message', message);
        });
    }

    licenseWindow.on('closed', async () => {
        licenseWindow = null;
        
        // Check if license was activated
        const isLicensed = await licenseManager.isLicensed();
        if (!isLicensed) {
            app.quit();
        }
    });
}

/**
 * Create the main application window
 */
function createMainWindow() {
    mainWindow = window.createWindow();
    mainWindow.setIcon(path.join(__dirname, 'assets/icons/png/logo-bms.png'));
    mainWindow.loadURL(`file://${__dirname}/index.html`);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ============================================================================
// Application Initialization
// ============================================================================

/**
 * Initialize application with license validation
 */
async function initializeApp() {
    try {
        // Initialize license manager with server URL
        licenseManager.initialize(LICENSE_SERVER_URL);

        // Validate license (async - connects to server)
        const validation = await licenseManager.validateLicense();
        
        console.log('[App] License status:', validation.status);

        // Handle based on status
        switch (validation.status) {
            case LicenseStatus.VALID:
            case LicenseStatus.OFFLINE_VALID:
                // License valid - start app
                menu.createMenu(mainWindow);
                print.setupPrint();
                createMainWindow();
                
                // Show offline warning if applicable
                if (validation.status === LicenseStatus.OFFLINE_VALID) {
                    showOfflineWarning(validation.message);
                }
                break;

            case LicenseStatus.REVOKED:
                // License revoked - show message and exit
                dialog.showErrorBox(
                    'Lisensi Dinonaktifkan',
                    validation.message || 'Lisensi aplikasi ini telah dinonaktifkan.'
                );
                app.quit();
                break;

            case LicenseStatus.OFFLINE_EXPIRED:
                // Offline too long - require server connection
                dialog.showErrorBox(
                    'Verifikasi Diperlukan',
                    validation.message || 'Hubungkan ke server untuk memverifikasi lisensi.'
                );
                app.quit();
                break;

            case LicenseStatus.NOT_ACTIVATED:
            case LicenseStatus.INVALID_KEY:
            case LicenseStatus.HARDWARE_MISMATCH:
            default:
                // Need activation
                createLicenseWindow(validation.message);
                break;
        }

    } catch (error) {
        console.error('[App] Initialization failed:', error);
        dialog.showErrorBox('Error', 'Gagal memulai aplikasi: ' + error.message);
        app.quit();
    }
}

/**
 * Show non-blocking offline warning
 */
function showOfflineWarning(message) {
    // Show warning after main window is ready
    setTimeout(() => {
        if (mainWindow) {
            dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Mode Offline',
                message: 'Aplikasi berjalan dalam mode offline',
                detail: message,
                buttons: ['OK']
            });
        }
    }, 1000);
}

// ============================================================================
// Application Lifecycle
// ============================================================================

app.whenReady().then(() => {
    initializeApp();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            initializeApp();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ============================================================================
// IPC Handlers
// ============================================================================

// Activate license
ipcMain.handle('activate-license', async (event, licenseKey) => {
    const result = await licenseManager.activateLicense(licenseKey);
    return result;
});

// Get license info
ipcMain.handle('get-license-info', async () => {
    return await licenseManager.getLicenseInfo();
});

// Get license warning (replaces reminder)
ipcMain.handle('get-license-warning', async () => {
    return await licenseManager.getWarning();
});

// License successfully activated - transition to main window
ipcMain.on('license-activated', () => {
    if (licenseWindow) {
        licenseWindow.close();
    }
    menu.createMenu(mainWindow);
    print.setupPrint();
    createMainWindow();
});

// Deactivate license
ipcMain.handle('deactivate-license', async () => {
    return licenseManager.deactivateLicense();
});
