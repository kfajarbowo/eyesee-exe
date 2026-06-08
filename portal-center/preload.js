const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portal', {
	// ── Read ──
	getRegions: () => ipcRenderer.invoke('get-regions'),
	getRegionSites: (code) => ipcRenderer.invoke('get-region-sites', code),
	getSites: (query) => ipcRenderer.invoke('get-sites', query),
	getApps: () => ipcRenderer.invoke('get-apps'),
	getAppSites: (appKey) => ipcRenderer.invoke('get-app-sites', appKey),
	getSummary: () => ipcRenderer.invoke('get-summary'),
	saveSiteOrigins: (origins) => ipcRenderer.invoke('save-site-origins', origins),

	// ── Create / Update / Delete ──
	createRegion: (data) => ipcRenderer.invoke('create-region', data),
	updateRegion: (code, data) => ipcRenderer.invoke('update-region', code, data),
	deleteRegion: (code) => ipcRenderer.invoke('delete-region', code),
	createSite: (data) => ipcRenderer.invoke('create-site', data),
	updateSite: (code, data) => ipcRenderer.invoke('update-site', code, data),
	deleteSite: (code) => ipcRenderer.invoke('delete-site', code),

	// ── Status ──
	checkSiteStatus: (ip, port) => ipcRenderer.invoke('check-site-status', ip, port),

	// ── App launcher ──
	openSiteApp: (ip, port, siteName, appName) =>
		ipcRenderer.invoke('open-site-app', ip, port, siteName, appName),

	// ── Window controls ──
	minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
	maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
	closeWindow: () => ipcRenderer.invoke('window-close'),
});
