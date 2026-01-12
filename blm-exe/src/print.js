const { ipcMain } = require('electron');

function setupPrint() {
	ipcMain.handle('print', async event => {
		// Execute print in renderer process
		const result = await event.sender.executeJavaScript(`
      (function() {
        const webview = document.querySelector('webview');
        if (webview) {
          webview.print();
          return true;
        }
        return false;
      })();
    `);
		return result;
	});

	// Handle print preview
	ipcMain.handle('print-preview', async event => {
		const result = await event.sender.executeJavaScript(`
      (function() {
        const webview = document.querySelector('webview');
        if (webview) {
          // Check if print preview is available
          if (webview.print) {
            return 'print-available';
          }
        }
        return 'print-unavailable';
      })();
    `);
		return result;
	});
}

module.exports = {
	setupPrint,
};
