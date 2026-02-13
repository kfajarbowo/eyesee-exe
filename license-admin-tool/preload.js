const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Get list of products
    getProducts: () => ipcRenderer.invoke('get-products'),
    
    // Generate license key
    generateLicense: (data) => ipcRenderer.invoke('generate-license', data),
    
    // Copy text to clipboard
    copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text)
});
