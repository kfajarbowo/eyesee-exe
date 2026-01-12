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

	// Set application icon
	mainWindow.setIcon(path.join(__dirname, 'assets/icons/png/logo-bms.png'));

	// Load the web application
	const webAppURL = 'http://192.168.204.102/'; // URL dari webapp CodeIgniter
	mainWindow.loadURL(webAppURL);

	// Handle webview ready event
	mainWindow.webContents.on('did-finish-load', () => {
		console.log('Web application loaded successfully');
	});

	// Handle window closed
	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	// Handle external links
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		require('electron').shell.openExternal(url);
		return false;
	});

	// Setup IPC handlers
	setupIPCHandlers();
}

/**
 * Setup IPC handlers for app functionality
 */
function setupIPCHandlers() {
	// Navigation handlers
	ipcMain.handle('navigate-back', () => {
		const webview = mainWindow.webContents;
		if (webview.goBack) {
			webview.goBack();
		}
	});

	ipcMain.handle('navigate-forward', () => {
		const webview = mainWindow.webContents;
		if (webview.goForward) {
			webview.goForward();
		}
	});

	ipcMain.handle('navigate-home', () => {
		const webview = mainWindow.webContents;
		if (webview) {
			webview.src = 'http://192.168.204.102/';
		}
	});

	ipcMain.handle('navigate-to-url', async (event, url) => {
		const webview = mainWindow.webContents;
		if (webview && url) {
			webview.src = url;
		}
	});

	ipcMain.handle('get-app-version', () => {
		return app.getVersion();
	});

	ipcMain.handle('minimize-window', () => {
		if (mainWindow) {
			mainWindow.minimize();
		}
	});

	ipcMain.handle('maximize-window', () => {
		if (mainWindow) {
			if (mainWindow.isMaximized()) {
				mainWindow.unmaximize();
			} else {
				mainWindow.maximize();
			}
		}
	});

	ipcMain.handle('close-window', () => {
		if (mainWindow) {
			mainWindow.close();
		}
	});

	ipcMain.handle('open-dev-tools', () => {
		if (mainWindow) {
			mainWindow.webContents.openDevTools();
		}
	});

	ipcMain.handle('reload-app', () => {
		const webview = mainWindow.webContents;
		if (webview) {
			webview.reload();
		}
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

// Handle app certificate errors for localhost
app.on(
	'certificate-error',
	(event, webContents, url, error, certificate, callback) => {
		// Ignore certificate errors for localhost development
		if (url.includes('localhost') || url.includes('127.0.0.1')) {
			event.preventDefault();
			callback(true);
		}
	}
);

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
