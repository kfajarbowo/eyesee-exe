const { contextBridge, ipcRenderer } = require('electron');

// Optimized IPC communication with cleanup
contextBridge.exposeInMainWorld('electron', {
	// Print function
	print: arg => ipcRenderer.invoke('print', arg),

	// URL navigation functions
	showUrlDialog: () => ipcRenderer.invoke('show-url-dialog'),
	navigateToUrl: url => ipcRenderer.invoke('navigate-to-url', url),

	// Batch operations for better performance
	batchOperations: operations =>
		ipcRenderer.invoke('batch-operations', operations),

	// Listen for navigation events from menu with cleanup
	onNavigateWebview: callback => {
		ipcRenderer.on('navigate-webview', callback);
		return () => ipcRenderer.removeListener('navigate-webview', callback);
	},
	onWebviewGoBack: callback => {
		ipcRenderer.on('webview-go-back', callback);
		return () => ipcRenderer.removeListener('webview-go-back', callback);
	},
	onWebviewGoForward: callback => {
		ipcRenderer.on('webview-go-forward', callback);
		return () => ipcRenderer.removeListener('webview-go-forward', callback);
	},
	onWebviewReload: callback => {
		ipcRenderer.on('webview-reload', callback);
		return () => ipcRenderer.removeListener('webview-reload', callback);
	},
	onWebviewGoHome: callback => {
		ipcRenderer.on('webview-go-home', callback);
		return () => ipcRenderer.removeListener('webview-go-home', callback);
	},

	// URL input modal functions with cleanup
	onShowUrlInputModal: callback => {
		ipcRenderer.on('show-url-input-modal', callback);
		return () => ipcRenderer.removeListener('show-url-input-modal', callback);
	},
	sendUrlInputResponse: url => ipcRenderer.send('url-input-response', url),

	// Utility functions for cleanup
	removeAllListeners: channel => ipcRenderer.removeAllListeners(channel),

	// Performance monitoring functions
	getPerformanceMetrics: () => ipcRenderer.invoke('get-performance-metrics'),
	reportPerformanceMetric: metric =>
		ipcRenderer.send('report-performance-metric', metric),
	reportPerformanceMetrics: metrics =>
		ipcRenderer.send('report-performance-metrics', metrics),
	reportSlowResource: resource =>
		ipcRenderer.send('report-slow-resource', resource),
	reportMemoryUsage: memory => ipcRenderer.send('report-memory-usage', memory),
	reportError: error => ipcRenderer.send('report-error', error),

	// Memory management functions
	getMemoryInfo: () => ipcRenderer.invoke('get-memory-info'),
	forceMemoryCleanup: () => ipcRenderer.invoke('force-memory-cleanup'),

	// Resource management functions
	getResourceStats: () => ipcRenderer.invoke('get-resource-stats'),
	forceResourceCleanup: () => ipcRenderer.invoke('force-resource-cleanup'),
});
