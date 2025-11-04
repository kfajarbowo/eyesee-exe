const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  // Print function
  print: (arg) => ipcRenderer.invoke("print", arg),
  
  // URL navigation functions
  showUrlDialog: () => ipcRenderer.invoke("show-url-dialog"),
  navigateToUrl: (url) => ipcRenderer.invoke("navigate-to-url", url),
  
  // Listen for navigation events from menu
  onNavigateWebview: (callback) => ipcRenderer.on('navigate-webview', callback),
  onWebviewGoBack: (callback) => ipcRenderer.on('webview-go-back', callback),
  onWebviewGoForward: (callback) => ipcRenderer.on('webview-go-forward', callback),
  onWebviewReload: (callback) => ipcRenderer.on('webview-reload', callback),
  onWebviewGoHome: (callback) => ipcRenderer.on('webview-go-home', callback),
  
  // URL input modal functions
  onShowUrlInputModal: (callback) => ipcRenderer.on('show-url-input-modal', callback),
  sendUrlInputResponse: (url) => ipcRenderer.send('url-input-response', url),
});
