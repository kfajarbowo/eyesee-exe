const { BrowserView } = require('electron');

function createBrowserView(mainWindow) {
	const view = new BrowserView({
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	mainWindow.setBrowserView(view);
	view.setBounds({ x: 0, y: 0, width: 1200, height: 800 });
	view.webContents.loadURL('https://github.com');

	// Make view responsive
	mainWindow.on('resize', () => {
		const { width, height } = mainWindow.getContentBounds();
		view.setBounds({ x: 0, y: 0, width, height });
	});

	return view;
}

module.exports = {
	createBrowserView,
};
