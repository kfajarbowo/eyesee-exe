// Electron
const { app, Menu, ipcMain, dialog } = require('electron');

let mainWindow;

// Handle app ready with error handling
app.whenReady().then(() => {
	// Main window
	// mainWindow.setIcon(path.join(__dirname, 'assets/icons/png/logo-eyesee.png'));
	const window = require('./src/window');
	mainWindow = window.createBrowserWindow();

	// Option 1: Uses Webtag and load a custom html file with external content
	mainWindow.loadFile('index.html');
	//mainWindow.loadURL(`file://${__dirname}/index.html`);

	// Option 2: Load directly an URL if you don't need interface customization
	//mainWindow.loadURL("https://github.com");

	// Option 3: Uses BrowserView to load an URL
	//const view = require("./src/view");
	//view.createBrowserView(mainWindow);

	// Display Dev Tools
	//mainWindow.openDevTools();

	// Menu (for standard keyboard shortcuts)
	const menu = require('./src/menu');
	const template = menu.createTemplate(app.name, mainWindow);
	const builtMenu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(builtMenu);

	// Print function (if enabled)
	require('./src/print');

	// Optimize app performance
	// Prevent app from hanging when all windows are closed
	app.on('window-all-closed', () => {
		// On macOS, keep app running even when all windows are closed
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	app.on('activate', () => {
		// On macOS, re-create window when dock icon is clicked
		if (BrowserWindow.getAllWindows().length === 0) {
			mainWindow = window.createBrowserWindow();
			mainWindow.loadFile('index.html');
		}
	});
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
	return new Promise(resolve => {
		ipcMain.once('url-input-response', (event, url) => {
			resolve(url);
		});
	});
});

// Handle URL input response from renderer
ipcMain.on('url-input-response', (event, url) => {
	// This will be handled by the promise above
});

// Handle batch operations for better performance
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

// Handle performance metrics request
ipcMain.handle('get-performance-metrics', async () => {
	if (!mainWindow) return null;

	const metrics = {
		memoryUsage: process.memoryUsage(),
		webContentsMetrics: mainWindow.webContents.getPerformanceMetrics(),
		cpuUsage: process.cpuUsage(),
	};

	return metrics;
});

// Handle performance metric reporting
ipcMain.on('report-performance-metric', (event, metric) => {
	console.log('Performance metric:', metric);
	// Store metrics for analytics
	// Could send to external analytics service here
});

ipcMain.on('report-performance-metrics', (event, metrics) => {
	console.log('Performance metrics batch:', metrics);
	// Store metrics for analytics
});

ipcMain.on('report-slow-resource', (event, resource) => {
	console.warn('Slow resource detected:', resource);
	// Could track slow resources for optimization
});

ipcMain.on('report-memory-usage', (event, memory) => {
	console.log('Memory usage:', memory);
	// Could track memory usage patterns
});

ipcMain.on('report-error', (event, error) => {
	console.error('Error reported:', error);
	// Could send to error tracking service
});

// Handle memory management
ipcMain.handle('get-memory-info', async () => {
	if (!mainWindow) return null;

	try {
		const webContents = mainWindow.webContents;

		return {
			process: process.memoryUsage(),
			webview: await webContents.getPerformanceMetrics(),
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

		// Force garbage collection
		await webContents.executeJavaScript(`
			if (window.gc) {
				window.gc();
				window.gc();
			}
		`);

		// Clear caches
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

// Handle resource management
ipcMain.handle('get-resource-stats', async () => {
	if (!mainWindow) return null;

	try {
		const webContents = mainWindow.webContents;

		// Get resource statistics
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

		// Cleanup resources
		await webContents.executeJavaScript(`
			// Clear caches
			if (window.caches) {
				caches.keys().then(cacheNames => {
					return Promise.all(
						cacheNames.map(cacheName => caches.delete(cacheName))
					);
				});
			}
			
			// Clear storage
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
			
			// Clear session storage
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

// Optimize memory usage
app.on('before-quit', () => {
	// Clean up resources before quitting
	if (mainWindow) {
		mainWindow.removeAllListeners();
	}
});

// Handle certificate errors for development (remove in production)
app.on(
	'certificate-error',
	(event, webContents, url, error, certificate, callback) => {
		// In development, ignore certificate errors
		if (process.env.NODE_ENV === 'development') {
			event.preventDefault();
			callback(true);
		} else {
			callback(false);
		}
	}
);
