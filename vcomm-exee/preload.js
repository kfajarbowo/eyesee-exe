const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
	print: () => ipcRenderer.invoke("print"),
});

// ============================================================
// License API
// ============================================================
contextBridge.exposeInMainWorld("electron", {
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
