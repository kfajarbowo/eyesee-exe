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
// Dynamic DNS Resolution
// ============================================================================
const fs = require('fs');

let dnsMap = null;
let injectedSiteIp = null;
let fallbackApiUrls = [];

try {
	const configPath = path.join(__dirname, 'server-config.json');
	const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
	dnsMap = rawConfig.dnsMap || null;
	if (rawConfig.fallbackApiUrls) {
		fallbackApiUrls = rawConfig.fallbackApiUrls;
	}

	if (dnsMap) {
		const rememberedIp = siteStore.get('lastSiteIp');
		if (rememberedIp) {
			const parts = rememberedIp.split('.').map(Number);
			const rules = [];
			for (const [hostname, offset] of Object.entries(dnsMap)) {
				const ip = [...parts];
				ip[3] = ip[3] + offset;
				const resolvedIp = ip.join('.');
				rules.push(`MAP ${hostname} ${resolvedIp}`);
				rules.push(`MAP ${hostname}. ${resolvedIp}`);
			}
			const ruleString = rules.join(', ');
			app.commandLine.appendSwitch('host-resolver-rules', ruleString);
			injectedSiteIp = rememberedIp;
			console.log(`[DNS] Injected rules for site IP ${rememberedIp}:`, ruleString);
		} else {
			console.log('[DNS] No remembered site — DNS rules will be injected after first site selection');
		}
	}
} catch (e) {
	console.warn('[DNS] Failed to setup DNS resolver:', e.message);
}

function resolveDnsMapUrl(url, baseIp) {
	if (!dnsMap || !baseIp) return url;
	try {
		const urlObj = new URL(url);
		if (urlObj.hostname in dnsMap) {
			const parts = baseIp.split('.').map(Number);
			parts[3] = parts[3] + dnsMap[urlObj.hostname];
			urlObj.hostname = parts.join('.');
			console.log(`[DNS] Resolved ${new URL(url).hostname} → ${urlObj.hostname} for Node.js request`);
			return urlObj.toString();
		}
	} catch (e) {
		console.warn('[DNS] Failed to resolve URL:', e.message);
	}
	return url;
}

// ============================================================================
// Configuration
// ============================================================================

// License server URL - priority: Env Var -> Config File -> Default

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
		// ⚡ LICENSE BYPASS — skip license validation, go directly to app
		console.log('[App] License bypass enabled — skipping validation');
		const validation = {
			status: LicenseStatus.VALID,
			message: 'License bypassed',
		};
		await proceedAfterLicense(validation);
	} catch (error) {
		console.error('[App] Initialization failed:', error);
		dialog.showErrorBox('Error', 'Gagal memulai aplikasi: ' + error.message);
		app.quit();
	}
}

async function proceedAfterLicense(validation) {
	if (SITE_API_URL) {
		// Check if we just restarted for DNS injection — skip site selector
		if (siteStore.get('pendingDnsRestart')) {
			siteStore.delete('pendingDnsRestart');
			const savedIp = siteStore.get('lastSiteIp');
			const savedPort = siteStore.get('lastSitePort');
			const savedCode = siteStore.get('lastSiteCode');
			if (savedIp && savedPort) {
				const url = `http://${savedIp}:${savedPort}`;
				console.log(`[App] Resuming after DNS restart → ${savedCode} (${url})`);
				createMainWindowWithUrl(url, validation);
				return;
			}
		}
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

// Get license info — bypassed, returns valid status
ipcMain.handle('get-license-info', async () => {
	return {
		status: 'valid',
		message: 'License bypassed',
		hardwareId: 'BYPASSED',
		license: { licenseKey: 'BYPASS', productCode: 'BLM' },
	};
});

// Get license warning — bypassed, no warning
ipcMain.handle('get-license-warning', async () => {
	return null;
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
		if (!SITE_API_URL) return { sites: [], appName: '', total: 0 };
		
		const rememberedIp = siteStore.get('lastSiteIp');
		if (rememberedIp) {
			const resolvedApiUrl = resolveDnsMapUrl(SITE_API_URL, rememberedIp);
			return await siteSelector.fetchSites(resolvedApiUrl);
		}

		if (fallbackApiUrls.length > 0) {
			console.log(`[DNS] Mencoba ${fallbackApiUrls.length} fallback API URL secara bersamaan...`);
			const promises = fallbackApiUrls.map(url => {
				return new Promise(async (resolve, reject) => {
					try {
						const result = await siteSelector.fetchSites(url);
						if (result && result.sites && result.sites.length > 0) resolve(result);
						else reject(new Error('Kosong'));
					} catch (e) { reject(e); }
				});
			});

			try {
				const firstSuccess = await Promise.any(promises);
				console.log(`[DNS] Sukses terhubung ke salah satu fallback API!`);
				return firstSuccess;
			} catch (e) {
				throw new Error('Semua fallback API offline');
			}
		}

		return await siteSelector.fetchSites(SITE_API_URL);
	} catch (error) {
		console.error('[App] Failed to get sites:', error.message);
		throw error;
	}
});

// Check online/offline status of all sites
ipcMain.handle('check-sites-status', async () => {
	try {
		const statuses = await siteSelector.checkAllSitesStatus(2000);
		return statuses;
	} catch (error) {
		console.error('[App] Failed to check sites status:', error.message);
		return [];
	}
});

ipcMain.handle('select-site', async (event, siteCode, remember) => {
	const site = siteSelector.findSite(siteCode);
	if (!site) {
		return { success: false, error: 'Site not found' };
	}

	selectedWebviewUrl = siteSelector.buildSiteUrl(site);
	console.log('[App] Site selected:', site.siteName, '→', selectedWebviewUrl);

	const needsDnsRestart = dnsMap && site.ip !== injectedSiteIp;

	if (remember) {
		siteStore.set('rememberSiteChoice', true);
		siteStore.set('lastSiteCode', siteCode);
	} else {
		siteStore.delete('rememberSiteChoice');
		siteStore.delete('lastSiteCode');
	}

	siteStore.set('lastSiteIp', site.ip);
	siteStore.set('lastSitePort', String(site.port));
	siteStore.set('lastSiteCode', siteCode);

	if (needsDnsRestart) {
		console.log(`[DNS] Site IP changed: ${injectedSiteIp || 'none'} → ${site.ip}. Restarting...`);
		siteStore.set('pendingDnsRestart', true);
		if (siteSelectorWindow) { siteSelectorWindow.close(); }
		app.relaunch();
		app.exit(0);
		return { success: true, url: selectedWebviewUrl, restarting: true };
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
