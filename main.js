// Electron
const { app, Menu, ipcMain, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
// License system
const { licenseManager, LicenseStatus } = require('./src/license');
// Site selector
const { siteSelector } = require('./src/site-selector');
// Persistent storage for site preference
const Store = require('electron-store');
const siteStore = new Store({ name: 'site-preferences' });

// Media codecs / WebRTC
app.commandLine.appendSwitch(
	'enable-features',
	'PlatformHEVCDecoderSupport,WebRtcAllowH265Receive'
);
app.commandLine.appendSwitch(
	'force-fieldtrials',
	'WebRTC-Video-H26xPacketBuffer/Enabled/'
);
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-certificate-errors');
// Allow autoplay for streams
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'AsyncDns');

// Dynamic host-resolver-rules: read hostname from server-config.json
// then resolve its IP using OS DNS (which reads /etc/hosts & Windows hosts file),
// and inject the resolved IP so Chromium's internal WebRTC DNS also knows it.
try {
	const dns = require('dns');
	const configPath = path.join(__dirname, 'server-config.json');
	const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
	const webviewUrl = rawConfig.webviewUrl || '';
	if (webviewUrl) {
		const urlObj = new URL(webviewUrl);
		const hostname = urlObj.hostname; // e.g. "eyesee.id"

		// Skip DNS injection for localhost — Chromium resolves it natively
		if (hostname === 'localhost' || hostname === '127.0.0.1') {
			console.log(
				`[DNS] Skipping host-resolver-rules for ${hostname} (local address)`
			);
		} else {
			// Resolve using OS DNS and inject the rule so Chromium's WebRTC DNS also knows it
			dns.lookup(hostname, (err, address) => {
				if (!err && address) {
					const rule = `MAP ${hostname} ${address}, MAP ${hostname}. ${address}`;
					app.commandLine.appendSwitch('host-resolver-rules', rule);
					console.log(`[DNS] Host resolver rule injected: ${rule}`);
				} else {
					console.warn(
						`[DNS] Could not resolve ${hostname}: ${
							err ? err.message : 'no address'
						}. WebRTC may use system DNS.`
					);
				}
			});
		}
	}
} catch (e) {
	console.warn('[DNS] Skipping host-resolver-rules injection:', e.message);
}

// ============================================================================
// Configuration
// ============================================================================

// License server URL - priority: Env Var -> Config File -> Default
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
	return 'http://127.0.0.1:3001';
}

const LICENSE_SERVER_URL = getServerUrl();

// Webview URL - baca dari server-config.json
function getWebviewUrl() {
	if (process.env.WEBVIEW_URL) return process.env.WEBVIEW_URL;

	const configPath = app.isPackaged
		? path.join(path.dirname(process.execPath), 'server-config.json')
		: path.join(__dirname, 'server-config.json');

	try {
		if (fs.existsSync(configPath)) {
			const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
			if (config.webviewUrl) {
				console.log('[App] Loaded webview URL from config:', config.webviewUrl);
				return config.webviewUrl;
			}
		}
	} catch (e) {
		console.error('[App] Error reading webview URL from config:', e.message);
	}

	return null; // null = tampilkan halaman error
}

const WEBVIEW_URL = getWebviewUrl();
console.log('[App] Webview URL:', WEBVIEW_URL || '(not configured)');

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

	return null; // No site API configured — use single webviewUrl
}

const SITE_API_URL = getSiteApiUrl();
console.log('[App] Site API URL:', SITE_API_URL || '(not configured)');

let mainWindow;
let licenseWindow;
let siteSelectorWindow;

// The URL that will be loaded in the main window webview
// Can come from: site selection, default webviewUrl, or env var
let selectedWebviewUrl = null;

/**
 * Create the license activation window
 */
function createLicenseWindow() {
	const window = require('./src/window');

	licenseWindow = new BrowserWindow({
		width: 480,
		height: 600,
		resizable: false,
		minimizable: false,
		maximizable: false,
		fullscreenable: false,
		icon: path.join(__dirname, 'assets/icons/png/eyesee.png'),
		show: false,
		backgroundColor: '#667eea',
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	licenseWindow.loadFile('license-dialog.html');

	licenseWindow.once('ready-to-show', () => {
		licenseWindow.show();
		// DEBUG: Open DevTools to see errors
		// licenseWindow.webContents.openDevTools({ mode: 'detach' });
	});

	// Remove menu for license window
	licenseWindow.setMenu(null);

	licenseWindow.on('closed', () => {
		licenseWindow = null;
		// If license window is closed without activation, quit the app
		if (!mainWindow) {
			app.quit();
		}
	});
}

/**
 * Create the site selector window
 * Shown after license validation when siteApiUrl is configured
 */
function createSiteSelectorWindow() {
	siteSelectorWindow = new BrowserWindow({
		width: 560,
		height: 640,
		resizable: true,
		minimizable: true,
		maximizable: false,
		fullscreenable: false,
		icon: path.join(__dirname, 'assets/icons/png/eyesee.png'),
		show: false,
		backgroundColor: '#667eea',
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

	// Remove menu for site selector window
	siteSelectorWindow.setMenu(null);

	siteSelectorWindow.on('closed', () => {
		siteSelectorWindow = null;
		// If site selector is closed without selection, quit the app
		if (!mainWindow) {
			app.quit();
		}
	});
}

/**
 * Create the main application window
 */
function createMainWindow() {
	const window = require('./src/window');
	mainWindow = window.createBrowserWindow();

	// Build menu AFTER mainWindow is assigned so the reference is valid
	const menu = require('./src/menu');
	const template = menu.createTemplate(app.name, mainWindow);
	const builtMenu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(builtMenu);

	// Add event listeners for window state changes
	mainWindow.on('maximize', () => {
		mainWindow.webContents.send('window-state-changed', 'maximized');
	});

	mainWindow.on('unmaximize', () => {
		mainWindow.webContents.send('window-state-changed', 'unmaximized');
	});

	mainWindow.on('restore', () => {
		mainWindow.webContents.send('window-state-changed', 'restored');
	});

	mainWindow.on('resize', () => {
		mainWindow.webContents.send('window-resized');
	});

	// Load the main content
	mainWindow.loadFile('index.html');

	// Print function (if enabled)
	require('./src/print');

	// Check for license warnings after window loads
	mainWindow.webContents.on('did-finish-load', async () => {
		const warning = await licenseManager.getWarning();
		if (warning) {
			mainWindow.webContents.send('license-warning', warning);
		}
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

async function initializeApp() {
	try {
		licenseManager.initialize(LICENSE_SERVER_URL);

		// Validate license (await async call)
		const validation = await licenseManager.validateLicense();
		console.log('[App] License status:', validation.status);

		// Handle based on status
		switch (validation.status) {
			case LicenseStatus.VALID:
			case LicenseStatus.OFFLINE_VALID:
				// License valid — proceed to site selection or main window
				await proceedAfterLicense(validation);
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
					validation.message ||
						'Hubungkan ke server untuk memverifikasi lisensi.'
				);
				app.quit();
				break;

			case LicenseStatus.NOT_ACTIVATED:
			case LicenseStatus.INVALID_KEY:
			default:
				// Need activation
				createLicenseWindow();
				break;
		}
	} catch (error) {
		console.error('Failed to initialize app:', error);
		dialog.showErrorBox(
			'Error',
			'Gagal menginisialisasi aplikasi. Silakan coba lagi.'
		);
		app.quit();
	}
}

/**
 * After license is valid, decide whether to show site selector or go directly to main window
 */
async function proceedAfterLicense(validation) {
	// If site API is configured, always show site selector
	if (SITE_API_URL) {
		// Always show site selector — user must choose every time
		// Even if API fetch fails, the selector will show an error/retry state
		createSiteSelectorWindow();
		return;
	}

	// No site API — use default webviewUrl
	selectedWebviewUrl = WEBVIEW_URL;
	createMainWindowWithUrl(selectedWebviewUrl, validation);
}

/**
 * Create main window with a specific webview URL
 */
function createMainWindowWithUrl(url, validation) {
	// Store the URL so IPC handler can return it
	selectedWebviewUrl = url;
	createMainWindow();

	// Show offline warning if applicable
	if (validation && validation.status === LicenseStatus.OFFLINE_VALID) {
		setTimeout(() => {
			if (mainWindow) {
				dialog.showMessageBox(mainWindow, {
					type: 'warning',
					title: 'Mode Offline',
					message: 'Aplikasi berjalan dalam mode offline',
					detail: validation.message,
					buttons: ['OK'],
				});
			}
		}, 1000);
	}
}

// Handle app ready
app.whenReady().then(() => {
	initializeApp();

	// Prevent app from hanging when all windows are closed
	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			initializeApp();
		}
	});
});

// ============================================================
// License IPC Handlers
// ============================================================

// Expose server URL for debugging
ipcMain.handle('get-server-url', async () => {
	const client = require('./src/license/license-server-client');
	return client.getConfig().serverUrl;
});

// Expose webview URL ke renderer — returns selected site URL or default
ipcMain.handle('get-webview-url', async () => {
	return selectedWebviewUrl || WEBVIEW_URL;
});

// Activate license
ipcMain.handle('activate-license', async (event, licenseKey) => {
	console.log(
		'[DEBUG] activate-license called, server URL:',
		require('./src/license/license-server-client').getConfig().serverUrl
	);
	const result = await licenseManager.activateLicense(licenseKey);
	console.log('[DEBUG] activate-license result:', result);
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

// Show license info dialog (from Help menu) — async-safe
ipcMain.on('show-license-info', async () => {
	if (!mainWindow) return;

	try {
		// getLicenseInfo is async
		const info = await licenseManager.getLicenseInfo();
		const status = info && info.status ? info.status : 'not_activated';

		let statusIcon = '';
		let statusText = '';
		switch (status) {
			case 'valid':
				statusIcon = '✅';
				statusText = 'AKTIF';
				break;
			case 'offline_valid':
				statusIcon = '🟡';
				statusText = 'AKTIF (Offline)';
				break;
			case 'grace_period':
				statusIcon = '⚠️';
				statusText = 'MASA TENGGANG';
				break;
			case 'expired':
				statusIcon = '❌';
				statusText = 'EXPIRED';
				break;
			case 'revoked':
				statusIcon = '🚫';
				statusText = 'DICABUT';
				break;
			case 'not_activated':
				statusIcon = '🔒';
				statusText = 'BELUM AKTIVASI';
				break;
			default:
				statusIcon = 'ℹ️';
				statusText = String(status).toUpperCase();
		}

		const licenseKey = info?.license?.licenseKey || info?.licenseKey || '-';
		const productCode = info?.license?.productCode || info?.productCode || '-';
		const hardwareId = info?.hardwareId || '-';

		let details = `Status  : ${statusIcon} ${statusText}\n`;
		details += `Produk  : ${productCode}\n`;
		details += `\nLicense Key:\n${licenseKey}\n`;
		details += `\nHardware ID:\n${hardwareId}`;
		if (info?.message && status !== 'valid')
			details += `\n\nInfo: ${info.message}`;

		dialog.showMessageBox(mainWindow, {
			type:
				status === 'valid' || status === 'offline_valid' ? 'info' : 'warning',
			title: 'Informasi Lisensi — EyeSee',
			message: 'EyeSee License',
			detail: details,
			buttons: ['OK'],
		});
	} catch (error) {
		dialog.showErrorBox(
			'Error',
			'Gagal memuat informasi lisensi: ' + error.message
		);
	}
});

// Deactivate license
ipcMain.handle('deactivate-license', async () => {
	return licenseManager.deactivateLicense();
});

// License activated - close license window and proceed to site selection
ipcMain.handle('license-activated', async () => {
	if (licenseWindow) {
		licenseWindow.close();
	}
	// Proceed through site selector flow (same as after valid license)
	await proceedAfterLicense({ status: LicenseStatus.VALID, message: '' });
	return { success: true };
});

// ============================================================
// Site Selector IPC Handlers
// ============================================================

// Get available sites from API
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

// Select a site and open main window
ipcMain.handle('select-site', async (event, siteCode, remember) => {
	const site = siteSelector.findSite(siteCode);
	if (!site) {
		return { success: false, error: 'Site not found' };
	}

	selectedWebviewUrl = siteSelector.buildSiteUrl(site);
	console.log('[App] Site selected:', site.siteName, '→', selectedWebviewUrl);

	// Save preference if remember is checked
	if (remember) {
		siteStore.set('rememberSiteChoice', true);
		siteStore.set('lastSiteCode', siteCode);
		console.log('[App] Remembered site choice:', siteCode);
	} else {
		siteStore.delete('rememberSiteChoice');
		siteStore.delete('lastSiteCode');
	}

	// Close site selector and open main window
	if (siteSelectorWindow) {
		siteSelectorWindow.close();
	}
	createMainWindowWithUrl(selectedWebviewUrl, null);

	return { success: true, url: selectedWebviewUrl };
});

// Use default URL instead of site selection
ipcMain.handle('use-default-url', async () => {
	selectedWebviewUrl = WEBVIEW_URL;
	console.log('[App] Using default URL:', selectedWebviewUrl);

	// Clear remembered choice
	siteStore.delete('rememberSiteChoice');
	siteStore.delete('lastSiteCode');

	if (siteSelectorWindow) {
		siteSelectorWindow.close();
	}
	createMainWindowWithUrl(selectedWebviewUrl, null);

	return { success: true };
});

// ============================================================
// URL Navigation IPC Handlers
// ============================================================

ipcMain.handle('navigate-to-url', async (event, url) => {
	if (mainWindow) {
		mainWindow.webContents.send('navigate-webview', url);
	}
});

ipcMain.handle('show-url-dialog', async () => {
	if (mainWindow) {
		mainWindow.webContents.send('show-url-input-modal');
	}

	return new Promise(resolve => {
		ipcMain.once('url-input-response', (event, url) => {
			resolve(url);
		});
	});
});

ipcMain.on('url-input-response', (event, url) => {
	// Handled by the promise above
});

// ============================================================
// Batch Operations IPC Handler
// ============================================================

ipcMain.handle('batch-operations', async (event, operations) => {
	const results = [];
	for (const operation of operations) {
		try {
			switch (operation.type) {
				case 'navigate':
					if (mainWindow && operation.url) {
						mainWindow.webContents.send('navigate-webview', operation.url);
						results.push({ success: true, type: operation.type });
					} else {
						results.push({
							success: false,
							type: operation.type,
							error: 'No main window or URL provided',
						});
					}
					break;
				case 'reload':
					if (mainWindow) {
						mainWindow.webContents.send('webview-reload');
						results.push({ success: true, type: operation.type });
					} else {
						results.push({
							success: false,
							type: operation.type,
							error: 'No main window',
						});
					}
					break;
				default:
					results.push({
						success: false,
						type: operation.type,
						error: 'Unknown operation type',
					});
			}
		} catch (error) {
			results.push({
				success: false,
				type: operation.type,
				error: error.message,
			});
		}
	}
	return results;
});

// ============================================================
// Performance Monitoring IPC Handlers
// ============================================================

ipcMain.handle('get-performance-metrics', async () => {
	if (!mainWindow) return null;

	return {
		memoryUsage: process.memoryUsage(),
		cpuUsage: process.cpuUsage(),
	};
});

ipcMain.on('report-performance-metric', (event, metric) => {
	console.log('Performance metric:', metric);
});

ipcMain.on('report-performance-metrics', (event, metrics) => {
	console.log('Performance metrics batch:', metrics);
});

ipcMain.on('report-slow-resource', (event, resource) => {
	console.warn('Slow resource detected:', resource);
});

ipcMain.on('report-memory-usage', (event, memory) => {
	console.log('Memory usage:', memory);
});

ipcMain.on('report-error', (event, error) => {
	console.error('Error reported:', error);
});

// ============================================================
// Memory Management IPC Handlers
// ============================================================

ipcMain.handle('get-memory-info', async () => {
	if (!mainWindow) return null;

	try {
		return {
			process: process.memoryUsage(),
		};
	} catch (error) {
		console.error('Error getting memory info:', error);
		return null;
	}
});

ipcMain.handle('force-memory-cleanup', async () => {
	if (!mainWindow) return { success: false };

	try {
		const webContents = mainWindow.webContents;

		await webContents.executeJavaScript(`
			if (window.gc) {
				window.gc();
				window.gc();
			}
		`);

		await webContents.executeJavaScript(`
			if (window.caches) {
				caches.keys().then(cacheNames => {
					return Promise.all(
						cacheNames.map(cacheName => caches.delete(cacheName))
					);
				});
			}
		`);

		return { success: true };
	} catch (error) {
		console.error('Error forcing memory cleanup:', error);
		return { success: false, error: error.message };
	}
});

// ============================================================
// Resource Management IPC Handlers
// ============================================================

ipcMain.handle('get-resource-stats', async () => {
	if (!mainWindow) return null;

	try {
		const webContents = mainWindow.webContents;

		const stats = await webContents.executeJavaScript(`
			const resources = performance.getEntriesByType('resource');
			const stats = {
				totalResources: resources.length,
				totalSize: 0,
				resourceTypes: {},
				slowResources: []
			};
			
			resources.forEach(resource => {
				const type = resource.initiatorType || 'other';
				stats.resourceTypes[type] = (stats.resourceTypes[type] || 0) + 1;
				
				if (resource.transferSize) {
					stats.totalSize += resource.transferSize;
				}
				
				if (resource.duration > 2000) {
					stats.slowResources.push({
						name: resource.name,
						duration: resource.duration,
						type: type
					});
				}
			});
			
			return stats;
		`);

		return stats;
	} catch (error) {
		console.error('Error getting resource stats:', error);
		return null;
	}
});

ipcMain.handle('force-resource-cleanup', async () => {
	if (!mainWindow) return { success: false };

	try {
		const webContents = mainWindow.webContents;

		await webContents.executeJavaScript(`
			if (window.caches) {
				caches.keys().then(cacheNames => {
					return Promise.all(
						cacheNames.map(cacheName => caches.delete(cacheName))
					);
				});
			}
			
			if (window.localStorage) {
				const keysToRemove = [];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key.includes('temp') || key.includes('cache')) {
						keysToRemove.push(key);
					}
				}
				keysToRemove.forEach(key => localStorage.removeItem(key));
			}
			
			if (window.sessionStorage) {
				sessionStorage.clear();
			}
		`);

		return { success: true };
	} catch (error) {
		console.error('Error forcing resource cleanup:', error);
		return { success: false, error: error.message };
	}
});

// ============================================================
// App Lifecycle
// ============================================================

app.on('before-quit', () => {
	if (mainWindow) {
		mainWindow.removeAllListeners();
	}
});

// Handle certificate errors for development (remove in production)
app.on(
	'certificate-error',
	(event, webContents, url, error, certificate, callback) => {
		if (process.env.NODE_ENV === 'development') {
			event.preventDefault();
			callback(true);
		} else {
			callback(false);
		}
	}
);
