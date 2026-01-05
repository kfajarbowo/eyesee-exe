const { BrowserWindow } = require("electron");
const path = require("path");

// Store window dimensions
const store = {
  width: 1200,
  height: 800,
};

// Try to load saved dimensions from localStorage equivalent
let savedDimensions = null;
try {
  // In a real app, you might use electron-store or similar
  // For now, we'll use default dimensions
} catch (e) {
  // Ignore errors
}

function createWindow() {
  const width = savedDimensions?.width || store.width;
  const height = savedDimensions?.height || store.height;

  const mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"), // required for print function
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Enable webview tag
    },
    // Use the native title bar so Windows shows minimize/maximize/close buttons
    frame: true,
  });

  // Remember window dimensions
  mainWindow.on("resize", () => {
    const [width, height] = mainWindow.getSize();
    store.width = width;
    store.height = height;
  });

  // Remember window position
  mainWindow.on("moved", () => {
    const [x, y] = mainWindow.getPosition();
    store.x = x;
    store.y = y;
  });

  // Restore window position if available
  if (savedDimensions?.x && savedDimensions?.y) {
    mainWindow.setPosition(savedDimensions.x, savedDimensions.y);
  }

  return mainWindow;
}

module.exports = {
  createWindow,
};

