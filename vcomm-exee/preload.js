const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
	print: () => ipcRenderer.invoke('print'),
});

// ============================================================
// License API
// ============================================================
contextBridge.exposeInMainWorld('electron', {
	// Activate license with key
	activateLicense: licenseKey =>
		ipcRenderer.invoke('activate-license', licenseKey),

	// Get license information (includes hardware ID)
	getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),

	// Get license warning (for offline warnings)
	getLicenseWarning: () => ipcRenderer.invoke('get-license-warning'),

	// Notify main process that license was activated
	licenseActivated: () => ipcRenderer.send('license-activated'),

	// Deactivate license
	deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),

	// Webview URL dari server-config.json atau site selection
	getWebviewUrl: () => ipcRenderer.invoke('get-webview-url'),

	// Site Selector API
	getSites: () => ipcRenderer.invoke('get-sites'),
	selectSite: (siteCode, remember) =>
		ipcRenderer.invoke('select-site', siteCode, remember),
	useDefaultUrl: () => ipcRenderer.invoke('use-default-url'),
});
