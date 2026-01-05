exports.createTemplate = (name, mainWindow) => {
	let template = [
		{
			label: 'Navigate',
			submenu: [
				{
					label: 'Go to URL...',
					accelerator: 'CmdOrCtrl+L',
					click: async () => {
						// Direct IPC communication instead of executeJavaScript for better performance
						mainWindow.webContents.send('show-url-input-modal');
					},
				},
				{ type: 'separator' },
				{
					label: 'Back',
					accelerator: 'CmdOrCtrl+Left',
					click: () => {
						mainWindow.webContents.send('webview-go-back');
					},
				},
				{
					label: 'Forward',
					accelerator: 'CmdOrCtrl+Right',
					click: () => {
						mainWindow.webContents.send('webview-go-forward');
					},
				},
				{
					label: 'Reload',
					accelerator: 'CmdOrCtrl+R',
					click: () => {
						mainWindow.webContents.send('webview-reload');
					},
				},
				{ type: 'separator' },
				{
					label: 'Home',
					accelerator: 'CmdOrCtrl+H',
					click: () => {
						mainWindow.webContents.send('webview-go-home');
					},
				},
			],
		},
		{
			label: 'Edit',
			submenu: [
				{ role: 'undo' },
				{ role: 'redo' },
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				{ role: 'pasteandmatchstyle' },
				{ role: 'delete' },
				{ role: 'selectall' },
			],
		},
		{
			label: 'View',
			submenu: [
				{ role: 'reload' },
				{ role: 'forcereload' },
				{ role: 'toggledevtools' },
				{ type: 'separator' },
				{ role: 'resetzoom' },
				{ role: 'zoomin' },
				{ role: 'zoomout' },
				{ type: 'separator' },
				{ role: 'togglefullscreen' },
			],
		},
		{
			role: 'window',
			submenu: [{ role: 'minimize' }, { role: 'close' }],
		},
		{
			label: 'Help',
			submenu: [
				{
					label: 'View License',
					accelerator: 'CmdOrCtrl+Shift+L',
					click: () => {
						const { dialog } = require('electron');
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
							
							dialog.showMessageBox(mainWindow, {
								type: info.status === 'valid' ? 'info' : 'warning',
								title: 'Informasi Lisensi',
								message: 'EyeSee License',
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
					label: 'About EyeSee',
					click: () => {
						const { dialog } = require('electron');
						dialog.showMessageBox(mainWindow, {
							type: 'info',
							title: 'About EyeSee',
							message: 'EyeSee',
							detail: 'Version 1.0.0\n\nElectron Webview Application',
							buttons: ['OK']
						});
					},
				},
			],
		},
	];

	if (process.platform === 'darwin') {
		template.unshift({
			label: name,
			submenu: [
				{ role: 'about' },
				{ type: 'separator' },
				{ role: 'services', submenu: [] },
				{ type: 'separator' },
				{ role: 'hide' },
				{ role: 'hideothers' },
				{ role: 'unhide' },
				{ type: 'separator' },
				{ role: 'quit' },
			],
		});

		// Edit menu
		template[2].submenu.push(
			{ type: 'separator' },
			{
				label: 'Speech',
				submenu: [{ role: 'startspeaking' }, { role: 'stopspeaking' }],
			}
		);

		// Window menu
		template[4].submenu = [
			{ role: 'close' },
			{ role: 'minimize' },
			{ role: 'zoom' },
			{ type: 'separator' },
			{ role: 'front' },
		];
	}

	return template;
};
