const { ipcMain } = require("electron");

function setupPrint() {
  ipcMain.handle("print", async (event) => {
    // Execute print in the renderer process
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
}

module.exports = {
  setupPrint,
};

