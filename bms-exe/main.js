const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const window = require('./src/window');
const menu = require('./src/menu');
const print = require('./src/print');

// License system
const { licenseManager } = require('./src/license');

let mainWindow;
let licenseWindow;

/**
 * Create license activation window
 */
function createLicenseWindow() {
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

	licenseWindow.on('closed', () => {
		licenseWindow = null;
		// If license window closed without activation, quit app
		if (!licenseManager.isLicensed()) {
			app.quit();
		}
	});
}

/**
 * Create main application window
 */
function createMainWindow() {
	mainWindow = window.createWindow();

	// Add icon after window created
	mainWindow.setIcon(path.join(__dirname, 'assets/icons/png/logo-bms.png'));

	// Load the index.html file
	mainWindow.loadURL(`file://${__dirname}/index.html`);

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

/**
 * Initialize application with license check
 */
function initializeApp() {
	try {
		// Initialize license manager
		licenseManager.initialize();

		// Check license
		const licenseStatus = licenseManager.validateLicense();

		if (licenseManager.isLicensed()) {
			// License valid - create main window
			menu.createMenu(mainWindow);
			print.setupPrint();
			createMainWindow();
		} else {
			// No valid license - show license dialog
			createLicenseWindow();
		}
	} catch (error) {
		console.error('Failed to initialize app:', error);
		dialog.showErrorBox('Error', 'Gagal memulai aplikasi: ' + error.message);
		app.quit();
	}
}

// Handle app ready
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

// ============================================================
// License IPC Handlers
// ============================================================

// Activate license
ipcMain.handle('activate-license', async (event, licenseKey) => {
	const result = licenseManager.activateLicense(licenseKey);
	return result;
});

// Get license info
ipcMain.handle('get-license-info', async () => {
	return licenseManager.getLicenseInfo();
});

// Get license reminder
ipcMain.handle('get-license-reminder', async () => {
	return licenseManager.getReminder();
});

// License activated - close license window, open main window
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
