const { app, Menu, shell, dialog } = require('electron');

function createMenu(mainWindow) {
	const template = [
		{
			label: 'File',
			submenu: [
				{
					label: 'Quit',
					accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
					click: () => {
						app.quit();
					},
				},
			],
		},
		{
			label: 'Edit',
			submenu: [
				{ role: 'undo', label: 'Undo' },
				{ role: 'redo', label: 'Redo' },
				{ type: 'separator' },
				{ role: 'cut', label: 'Cut' },
				{ role: 'copy', label: 'Copy' },
				{ role: 'paste', label: 'Paste' },
				{ role: 'selectAll', label: 'Select All' },
			],
		},
		{
			label: 'View',
			submenu: [
				{ role: 'reload', label: 'Reload' },
				{ role: 'forceReload', label: 'Force Reload' },
				{ role: 'toggleDevTools', label: 'Toggle Developer Tools' },
				{ type: 'separator' },
				{ role: 'resetZoom', label: 'Actual Size' },
				{ role: 'zoomIn', label: 'Zoom In' },
				{ role: 'zoomOut', label: 'Zoom Out' },
				{ type: 'separator' },
				{ role: 'togglefullscreen', label: 'Toggle Fullscreen' },
			],
		},
		{
			label: 'Navigation',
			submenu: [
				{
					label: 'Back',
					accelerator: 'Alt+Left',
					click: () => {
						// Send back navigation to webview
						const webview = document.querySelector('webview');
						if (webview && webview.goBack) {
							webview.goBack();
						}
					},
				},
				{
					label: 'Forward',
					accelerator: 'Alt+Right',
					click: () => {
						// Send forward navigation to webview
						const webview = document.querySelector('webview');
						if (webview && webview.goForward) {
							webview.goForward();
						}
					},
				},
				{
					label: 'Home',
					accelerator: 'Alt+Home',
					click: () => {
						// Send home navigation to webview
						const webview = document.querySelector('webview');
						if (webview) {
							webview.src = 'http://192.168.204.102/';
						}
					},
				},
			],
		},
		{
			label: 'Window',
			submenu: [
				{ role: 'minimize', label: 'Minimize' },
				{ role: 'close', label: 'Close' },
			],
		},
		{
			label: 'Help',
			submenu: [
				{
					label: 'View License',
					accelerator: 'CmdOrCtrl+Shift+L',
					click: () => {
						const { licenseManager } = require('./license');
						
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
							
							dialog.showMessageBox({
								type: info.status === 'valid' ? 'info' : 'warning',
								title: 'Informasi Lisensi',
								message: 'BLM License',
								detail: details,
								buttons: ['OK']
							});
							
						} catch (error) {
							dialog.showErrorBox('Error', 'Gagal memuat informasi lisensi: ' + error.message);
						}
					},
				},
				{ type: 'separator' },
				{
					label: 'About BLM Webview',
					click: () => {
						dialog.showMessageBox({
							type: 'info',
							title: 'About BLM',
							message: 'BLM Webview Application',
							detail: 'Version 1.0.0\n\nBattle Logistics Management',
							buttons: ['OK']
						});
					},
				},
			],
		},
	];

	// macOS specific menu adjustments
	if (process.platform === 'darwin') {
		template.unshift({
			label: app.getName(),
			submenu: [
				{ role: 'about', label: 'About ' + app.getName() },
				{ type: 'separator' },
				{ role: 'services', label: 'Services' },
				{ type: 'separator' },
				{ role: 'hide', label: 'Hide ' + app.getName() },
				{ role: 'hideOthers', label: 'Hide Others' },
				{ type: 'separator' },
				{ role: 'unhide', label: 'Show All' },
				{ type: 'separator' },
				{ role: 'quit', label: 'Quit ' + app.getName() },
			],
		});

		// Window menu
		template[5].submenu = [
			{ role: 'close', label: 'Close' },
			{ role: 'minimize', label: 'Minimize' },
			{ role: 'zoom', label: 'Zoom' },
			{ type: 'separator' },
			{ role: 'front', label: 'Bring All to Front' },
		];
	}

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

module.exports = {
	createMenu,
};
