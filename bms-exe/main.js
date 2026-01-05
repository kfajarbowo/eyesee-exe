const { app, BrowserWindow } = require('electron');
const path = require('path');
const window = require('./src/window');
const menu = require('./src/menu');
const print = require('./src/print');

let mainWindow;

function createWindow() {
	mainWindow = window.createWindow();

	// Tambahkan icon setelah window dibuat
	mainWindow.setIcon(path.join(__dirname, 'assets/icons/png/logo-bms.png'));

	// Load the index.html file
	mainWindow.loadURL(`file://${__dirname}/index.html`);

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

app.whenReady().then(() => {
	menu.createMenu();

	print.setupPrint();

	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
