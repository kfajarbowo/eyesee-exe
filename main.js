// Electron
const { app, Menu, ipcMain, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// License system
const { licenseManager, LicenseStatus } = require('./src/license');

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
    return 'http://127.0.0.1:3000';
}

const LICENSE_SERVER_URL = getServerUrl();

let mainWindow;
let licenseWindow;

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
		icon: path.join(__dirname, 'assets/icons/png/logo-eyesee.png'),
		show: false,
		backgroundColor: '#667eea',
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, 'preload.js')
		}
	});

	licenseWindow.loadFile('license-dialog.html');
	
	licenseWindow.once('ready-to-show', () => {
		licenseWindow.show();
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
 * Create the main application window
 */
function createMainWindow() {
	const window = require('./src/window');
	mainWindow = window.createBrowserWindow();

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

	// Menu (for standard keyboard shortcuts)
	const menu = require('./src/menu');
	const template = menu.createTemplate(app.name, mainWindow);
	const builtMenu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(builtMenu);

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

/**
 * Initialize the application with license check
 */
async function initializeApp() {
	try {
		// Initialize license manager with server URL
		licenseManager.initialize(LICENSE_SERVER_URL);

		// Validate license (await async call)
		const validation = await licenseManager.validateLicense();
		console.log('[App] License status:', validation.status);

		// Handle based on status
		switch (validation.status) {
			case LicenseStatus.VALID:
			case LicenseStatus.OFFLINE_VALID:
				// License valid - start app
				createMainWindow();
				
				// Show offline warning if applicable
				if (validation.status === LicenseStatus.OFFLINE_VALID) {
					setTimeout(() => {
						if (mainWindow) {
							dialog.showMessageBox(mainWindow, {
								type: 'warning',
								title: 'Mode Offline',
								message: 'Aplikasi berjalan dalam mode offline',
								detail: validation.message,
								buttons: ['OK']
							});
						}
					}, 1000);
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
			default:
				// Need activation
				createLicenseWindow();
				break;
		}
	} catch (error) {
		console.error('Failed to initialize app:', error);
		dialog.showErrorBox('Error', 'Gagal menginisialisasi aplikasi. Silakan coba lagi.');
		app.quit();
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

// Show license info dialog (from Help menu)
ipcMain.on('show-license-info', async () => {
	if (!mainWindow) return;
	
	try {
		const info = licenseManager.getLicenseInfo();
		
		let statusText = '';
		switch (info.status) {
			case 'valid':
				statusText = '✅ AKTIF';
				break;
			case 'grace_period':
				statusText = '⚠️ MASA TENGGANG';
				break;
			case 'expired':
				statusText = '❌ EXPIRED';
				break;
			case 'not_activated':
				statusText = '🔒 BELUM AKTIVASI';
				break;
			default:
				statusText = info.status.toUpperCase();
		}
		
		let details = `Status: ${statusText}\n`;
		
		if (info.expiryDate) {
			details += `\nTanggal Expired: ${info.expiryDate.toLocaleDateString('id-ID', {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			})}`;
		}
		
		if (info.daysUntilExpiry !== null) {
			if (info.daysUntilExpiry > 0) {
				details += `\nSisa Waktu: ${info.daysUntilExpiry} hari`;
			} else if (info.daysUntilExpiry < 0) {
				details += `\nExpired: ${Math.abs(info.daysUntilExpiry)} hari lalu`;
			}
		}
		
		if (info.gracePeriodRemaining !== null) {
			details += `\nSisa Grace Period: ${info.gracePeriodRemaining} hari`;
		}
		
		details += `\n\nHardware ID: ${info.hardwareId}`;
		
		dialog.showMessageBox(mainWindow, {
			type: info.status === 'valid' ? 'info' : 'warning',
			title: 'Informasi Lisensi',
			message: 'EyeSee License',
			detail: details,
			buttons: ['OK']
		});
		
	} catch (error) {
		dialog.showErrorBox('Error', 'Gagal memuat informasi lisensi.');
	}
});

// Deactivate license
ipcMain.handle('deactivate-license', async () => {
	return licenseManager.deactivateLicense();
});

// License activated - close license window and open main window
ipcMain.handle('license-activated', async () => {
	if (licenseWindow) {
		licenseWindow.close();
	}
	createMainWindow();
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
