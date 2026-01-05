const path = require('path');
const { BrowserWindow } = require('electron'); // https://www.electronjs.org/docs/api/browser-window

exports.createBrowserWindow = () => {
	// https://www.electronjs.org/docs/api/browser-window#class-browserwindow
	const win = new BrowserWindow({
		width: 1024,
		height: 768,
		minWidth: 800,
		minHeight: 600,
		icon: path.join(__dirname, '../assets/icons/png/logo-eyesee.png'),
		show: false, // Don't show window until ready
		backgroundColor: '#fff', // Prevent white flash
		webPreferences: {
			nativeWindowOpen: true,
			devTools: true, // false if you want to remove dev tools access for the user
			contextIsolation: true,
			enableRemoteModule: false, // Security and performance improvement
			nodeIntegration: false, // Security improvement
			webviewTag: true, // https://www.electronjs.org/docs/api/webview-tag,
			preload: path.join(__dirname, '../preload.js'), // required for print function
			// Performance optimizations
			backgroundThrottling: false,
			offscreen: false,
		},
	});

	// Show window when ready to prevent visual glitches
	win.once('ready-to-show', () => {
		win.show();
	});

	return win;
};
