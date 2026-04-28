/**
 * BLM Webview Application - Main Process
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

// Site selector
const { siteSelector } = require('./src/site-selector');

// Persistent storage for site preference
const Store = require('electron-store');
const siteStore = new Store({ name: 'site-preferences' });

// ============================================================================
// Configuration
// ============================================================================

// License server URL - priority: Env Var -> Config File -> Default
const fs = require('fs');

function getServerUrl() {
	if (process.env.LICENSE_SERVER_URL) {
		return process.env.LICENSE_SERVER_URL;
	}

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

	return 'http://127.0.0.1:3001';
}

const LICENSE_SERVER_URL = getServerUrl();

// Webview URL dari server-config.json
function getWebviewUrl() {
	if (process.env.WEBVIEW_URL) return process.env.WEBVIEW_URL;
	const configPath = app.isPackaged
		? path.join(path.dirname(process.execPath), 'server-config.json')
		: path.join(__dirname, 'server-config.json');
	try {
		if (fs.existsSync(configPath)) {
			const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
			if (config.webviewUrl) return config.webviewUrl;
		}
	} catch (e) {
		console.error('[App] webview URL error:', e.message);
	}
	return null;
}
const WEBVIEW_URL = getWebviewUrl();
console.log('[BLM] Webview URL:', WEBVIEW_URL || '(not set)');

// Site API URL - for fetching available sites list
function getSiteApiUrl() {
	if (process.env.SITE_API_URL) return process.env.SITE_API_URL;
	const configPath = app.isPackaged
		? path.join(path.dirname(process.execPath), 'server-config.json')
		: path.join(__dirname, 'server-config.json');
	try {
		if (fs.existsSync(configPath)) {
			const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
			if (config.siteApiUrl) {
				console.log(
					'[App] Loaded site API URL from config:',
					config.siteApiUrl
				);
				return config.siteApiUrl;
			}
		}
	} catch (e) {
		console.error('[App] Error reading site API URL from config:', e.message);
	}
	return null;
}
const SITE_API_URL = getSiteApiUrl();
console.log('[BLM] Site API URL:', SITE_API_URL || '(not configured)');

// ============================================================================
// Window Management
// ============================================================================

let mainWindow;
let licenseWindow;
let siteSelectorWindow;
let selectedWebviewUrl = null;

function createLicenseWindow(message = null) {
	licenseWindow = new BrowserWindow({
		width: 480,
		height: 620,
		resizable: false,
		frame: true,
		icon: path.join(__dirname, 'assets/icons/png/logo-blm.png'),
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	licenseWindow.setMenuBarVisibility(false);
	licenseWindow.loadFile('license-dialog.html');

	if (message) {
		licenseWindow.webContents.on('did-finish-load', () => {
			licenseWindow.webContents.send('license-message', message);
		});
	}

	licenseWindow.on('closed', async () => {
		licenseWindow = null;

		const isLicensed = await licenseManager.isLicensed();
		if (!isLicensed) {
			app.quit();
		}
	});
}

function createSiteSelectorWindow() {
	siteSelectorWindow = new BrowserWindow({
		width: 560,
		height: 640,
		resizable: true,
		minimizable: true,
		maximizable: false,
		fullscreenable: false,
		icon: path.join(__dirname, 'assets/icons/png/logo-blm.png'),
		show: false,
		backgroundColor: '#1a2332',
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	siteSelectorWindow.loadFile('site-selector.html');
	siteSelectorWindow.once('ready-to-show', () => {
		siteSelectorWindow.show();
	});
	siteSelectorWindow.setMenu(null);

	siteSelectorWindow.on('closed', () => {
		siteSelectorWindow = null;
		if (!mainWindow) {
			app.quit();
		}
	});
}

function createMainWindow() {
	mainWindow = window.createWindow();
	mainWindow.setIcon(path.join(__dirname, 'assets/icons/png/logo-blm.png'));
	mainWindow.loadURL(
		selectedWebviewUrl || WEBVIEW_URL || `file://${__dirname}/index.html`
	);

	menu.createMenu(mainWindow);
	print.setupPrint();

	mainWindow.webContents.on('did-finish-load', () => {
		console.log('Web application loaded successfully');
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		require('electron').shell.openExternal(url);
		return false;
	});

	setupIPCHandlers();
}

function createMainWindowWithUrl(url, validation) {
	selectedWebviewUrl = url;
	createMainWindow();

	if (validation && validation.status === LicenseStatus.OFFLINE_VALID) {
		showOfflineWarning(validation.message);
	}
}

function setupIPCHandlers() {
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
			webview.src = WEBVIEW_URL;
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
		if (mainWindow) mainWindow.minimize();
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
		if (mainWindow) mainWindow.close();
	});

	ipcMain.handle('open-dev-tools', () => {
		if (mainWindow) mainWindow.webContents.openDevTools();
	});

	ipcMain.handle('reload-app', () => {
		const webview = mainWindow.webContents;
		if (webview) {
			webview.reload();
		}
	});
}

// ============================================================================
// Application Initialization
// ============================================================================

async function initializeApp() {
	try {
		licenseManager.initialize(LICENSE_SERVER_URL);

		const validation = await licenseManager.validateLicense();
		console.log('[App] License status:', validation.status);

		switch (validation.status) {
			case LicenseStatus.VALID:
			case LicenseStatus.OFFLINE_VALID:
				await proceedAfterLicense(validation);
				break;

			case LicenseStatus.REVOKED:
				dialog.showErrorBox(
					'Lisensi Dinonaktifkan',
					validation.message || 'Lisensi aplikasi ini telah dinonaktifkan.'
				);
				app.quit();
				break;

			case LicenseStatus.OFFLINE_EXPIRED:
				dialog.showErrorBox(
					'Verifikasi Diperlukan',
					validation.message ||
						'Hubungkan ke server untuk memverifikasi lisensi.'
				);
				app.quit();
				break;

			case LicenseStatus.NOT_ACTIVATED:
			case LicenseStatus.INVALID_KEY:
			case LicenseStatus.HARDWARE_MISMATCH:
			default:
				createLicenseWindow(validation.message);
				break;
		}
	} catch (error) {
		console.error('[App] Initialization failed:', error);
		dialog.showErrorBox('Error', 'Gagal memulai aplikasi: ' + error.message);
		app.quit();
	}
}

async function proceedAfterLicense(validation) {
	if (SITE_API_URL) {
		// Always show site selector — user must choose every time
		// Even if API fetch fails, the selector will show an error/retry state
		createSiteSelectorWindow();
		return;
	}

	selectedWebviewUrl = WEBVIEW_URL;
	createMainWindowWithUrl(selectedWebviewUrl, validation);
}

function showOfflineWarning(message) {
	setTimeout(() => {
		if (mainWindow) {
			dialog.showMessageBox(mainWindow, {
				type: 'warning',
				title: 'Mode Offline',
				message: 'Aplikasi berjalan dalam mode offline',
				detail: message,
				buttons: ['OK'],
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

app.on(
	'certificate-error',
	(event, webContents, url, error, certificate, callback) => {
		if (url.includes('localhost') || url.includes('127.0.0.1')) {
			event.preventDefault();
			callback(true);
		}
	}
);

// ============================================================================
// License IPC Handlers
// ============================================================================

ipcMain.handle('activate-license', async (event, licenseKey) => {
	const result = await licenseManager.activateLicense(licenseKey);
	return result;
});

ipcMain.handle('get-license-info', async () => {
	return await licenseManager.getLicenseInfo();
});

ipcMain.handle('get-license-warning', async () => {
	return await licenseManager.getWarning();
});

ipcMain.on('license-activated', async () => {
	if (licenseWindow) {
		licenseWindow.close();
	}
	await proceedAfterLicense({ status: LicenseStatus.VALID, message: '' });
});

ipcMain.handle('deactivate-license', async () => {
	return licenseManager.deactivateLicense();
});

// Webview URL — returns selected site URL or default
ipcMain.handle(
	'get-webview-url',
	async () => selectedWebviewUrl || WEBVIEW_URL
);

// ============================================================================
// Site Selector IPC Handlers
// ============================================================================

ipcMain.handle('get-sites', async () => {
	try {
		if (!SITE_API_URL) {
			return { sites: [], appName: '', total: 0 };
		}
		const result = await siteSelector.fetchSites(SITE_API_URL);
		return result;
	} catch (error) {
		console.error('[App] Failed to get sites:', error.message);
		throw error;
	}
});

ipcMain.handle('select-site', async (event, siteCode, remember) => {
	const site = siteSelector.findSite(siteCode);
	if (!site) {
		return { success: false, error: 'Site not found' };
	}

	selectedWebviewUrl = siteSelector.buildSiteUrl(site);
	console.log('[App] Site selected:', site.siteName, '→', selectedWebviewUrl);

	if (remember) {
		siteStore.set('rememberSiteChoice', true);
		siteStore.set('lastSiteCode', siteCode);
	} else {
		siteStore.delete('rememberSiteChoice');
		siteStore.delete('lastSiteCode');
	}

	if (siteSelectorWindow) {
		siteSelectorWindow.close();
	}
	createMainWindowWithUrl(selectedWebviewUrl, null);

	return { success: true, url: selectedWebviewUrl };
});

ipcMain.handle('use-default-url', async () => {
	selectedWebviewUrl = WEBVIEW_URL;
	console.log('[App] Using default URL:', selectedWebviewUrl);

	siteStore.delete('rememberSiteChoice');
	siteStore.delete('lastSiteCode');

	if (siteSelectorWindow) {
		siteSelectorWindow.close();
	}
	createMainWindowWithUrl(selectedWebviewUrl, null);

	return { success: true };
});
