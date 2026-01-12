const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
	// Navigation functions
	navigateBack: () => ipcRenderer.invoke('navigate-back'),
	navigateForward: () => ipcRenderer.invoke('navigate-forward'),
	navigateHome: () => ipcRenderer.invoke('navigate-home'),
	navigateToUrl: url => ipcRenderer.invoke('navigate-to-url', url),

	// Print functions
	print: () => ipcRenderer.invoke('print'),
	printPreview: () => ipcRenderer.invoke('print-preview'),

	// App information
	getAppVersion: () => ipcRenderer.invoke('get-app-version'),

	// Window controls
	minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
	maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
	closeWindow: () => ipcRenderer.invoke('close-window'),

	// Development functions
	openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
	reloadApp: () => ipcRenderer.invoke('reload-app'),
});

// ============================================================
// License API
// ============================================================
contextBridge.exposeInMainWorld('electron', {
	// Activate license with key
	activateLicense: (licenseKey) => ipcRenderer.invoke('activate-license', licenseKey),
	
	// Get license information
	getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),
	
	// Get license reminder (for expiry warnings)
	getLicenseReminder: () => ipcRenderer.invoke('get-license-reminder'),
	
	// Notify main process that license was activated
	licenseActivated: () => ipcRenderer.send('license-activated'),
	
	// Deactivate license
	deactivateLicense: () => ipcRenderer.invoke('deactivate-license')
});

// Listen for events from main process
window.addEventListener('DOMContentLoaded', () => {
	console.log('BLM Webview preload script loaded');
});
