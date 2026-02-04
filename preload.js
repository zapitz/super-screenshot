const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // PDF operations
  savePdf: (pdfBuffer, fileName) => ipcRenderer.invoke('save-pdf', pdfBuffer, fileName),

  // Path operations
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Browser detection
  detectBrowsers: () => ipcRenderer.invoke('detect-browsers'),
  selectBrowserPath: () => ipcRenderer.invoke('select-browser-path'),

  // Folder operations
  createOutputFolder: () => ipcRenderer.invoke('create-output-folder'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  saveLogo: (logoData) => ipcRenderer.invoke('save-logo', logoData),
});

// Expose Node.js modules needed for the app functionality
// These are safe to expose as they don't give direct filesystem access
contextBridge.exposeInMainWorld('nodeModules', {
  // Browser detector module
  browserDetector: {
    getDefaultBrowser: () => {
      const { getDefaultBrowser } = require('./browser-detector');
      return getDefaultBrowser;
    }
  },

  // Screenshot module
  screenshot: {
    captureScreenshot: async (url, settings) => {
      const { captureScreenshot } = require('./screenshot');
      return await captureScreenshot(url, settings);
    }
  },

  // PDF generator module
  pdfGenerator: {
    generatePDF: async (results, config) => {
      const { generatePDF } = require('./pdf-generator');
      return await generatePDF(results, config);
    }
  }
});
