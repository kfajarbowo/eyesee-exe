const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script
 * Exposes secure IPC communication to the renderer process.
 * Uses contextBridge for security isolation.
 */

contextBridge.exposeInMainWorld('electron', {
	// ============================================================
	// License Functions
	// ============================================================
	
	// Activate a license key
	activateLicense: (licenseKey) => ipcRenderer.invoke('activate-license', licenseKey),
	
	// Get license information
	getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),
	
	// Get license reminder (if any)
	getLicenseReminder: () => ipcRenderer.invoke('get-license-reminder'),
	
	// Deactivate (remove) license
	deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
	
	// Notify that license was activated (open main window)
	licenseActivated: () => ipcRenderer.invoke('license-activated'),
	
	// Listen for license reminder from main process
	onLicenseReminder: (callback) => {
		ipcRenderer.on('license-reminder', callback);
		return () => ipcRenderer.removeListener('license-reminder', callback);
	},

	// ============================================================
	// Print Function
	// ============================================================
	
	print: (arg) => ipcRenderer.invoke('print', arg),

	// ============================================================
	// URL Navigation Functions
	// ============================================================
	
	showUrlDialog: () => ipcRenderer.invoke('show-url-dialog'),
	navigateToUrl: (url) => ipcRenderer.invoke('navigate-to-url', url),

	// Batch operations for better performance
	batchOperations: (operations) => ipcRenderer.invoke('batch-operations', operations),

	// Listen for navigation events from menu with cleanup
	onNavigateWebview: (callback) => {
		ipcRenderer.on('navigate-webview', callback);
		return () => ipcRenderer.removeListener('navigate-webview', callback);
	},
	onWebviewGoBack: (callback) => {
		ipcRenderer.on('webview-go-back', callback);
		return () => ipcRenderer.removeListener('webview-go-back', callback);
	},
	onWebviewGoForward: (callback) => {
		ipcRenderer.on('webview-go-forward', callback);
		return () => ipcRenderer.removeListener('webview-go-forward', callback);
	},
	onWebviewReload: (callback) => {
		ipcRenderer.on('webview-reload', callback);
		return () => ipcRenderer.removeListener('webview-reload', callback);
	},
	onWebviewGoHome: (callback) => {
		ipcRenderer.on('webview-go-home', callback);
		return () => ipcRenderer.removeListener('webview-go-home', callback);
	},

	// URL input modal functions with cleanup
	onShowUrlInputModal: (callback) => {
		ipcRenderer.on('show-url-input-modal', callback);
		return () => ipcRenderer.removeListener('show-url-input-modal', callback);
	},
	sendUrlInputResponse: (url) => ipcRenderer.send('url-input-response', url),

	// ============================================================
	// Utility Functions
	// ============================================================
	
	removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

	// ============================================================
	// Performance Monitoring Functions
	// ============================================================
	
	getPerformanceMetrics: () => ipcRenderer.invoke('get-performance-metrics'),
	reportPerformanceMetric: (metric) => ipcRenderer.send('report-performance-metric', metric),
	reportPerformanceMetrics: (metrics) => ipcRenderer.send('report-performance-metrics', metrics),
	reportSlowResource: (resource) => ipcRenderer.send('report-slow-resource', resource),
	reportMemoryUsage: (memory) => ipcRenderer.send('report-memory-usage', memory),
	reportError: (error) => ipcRenderer.send('report-error', error),

	// ============================================================
	// Memory Management Functions
	// ============================================================
	
	getMemoryInfo: () => ipcRenderer.invoke('get-memory-info'),
	forceMemoryCleanup: () => ipcRenderer.invoke('force-memory-cleanup'),

	// ============================================================
	// Resource Management Functions
	// ============================================================
	
	getResourceStats: () => ipcRenderer.invoke('get-resource-stats'),
	forceResourceCleanup: () => ipcRenderer.invoke('force-resource-cleanup'),

	// ============================================================
	// Window State Listeners
	// ============================================================
	
	onWindowStateChanged: (callback) => {
		ipcRenderer.on('window-state-changed', callback);
		return () => ipcRenderer.removeListener('window-state-changed', callback);
	},
	onWindowResized: (callback) => {
		ipcRenderer.on('window-resized', callback);
		return () => ipcRenderer.removeListener('window-resized', callback);
	},
});
