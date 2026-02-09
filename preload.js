const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // =====================================================
  // PDF Operations
  // =====================================================
  savePdf: (pdfBuffer, fileName) => ipcRenderer.invoke('save-pdf', pdfBuffer, fileName),

  // =====================================================
  // Path Operations
  // =====================================================
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // =====================================================
  // Browser Detection
  // =====================================================
  detectBrowsers: () => ipcRenderer.invoke('detect-browsers'),
  selectBrowserPath: () => ipcRenderer.invoke('select-browser-path'),

  // =====================================================
  // Folder Operations
  // =====================================================
  createOutputFolder: () => ipcRenderer.invoke('create-output-folder'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),

  // =====================================================
  // Configuration (Legacy - for backward compatibility)
  // =====================================================
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // =====================================================
  // General Settings
  // =====================================================
  getGeneralSettings: () => ipcRenderer.invoke('get-general-settings'),
  saveGeneralSettings: (settings) => ipcRenderer.invoke('save-general-settings', settings),

  // =====================================================
  // Capture Settings
  // =====================================================
  getCaptureSettings: () => ipcRenderer.invoke('get-capture-settings'),
  saveCaptureSettings: (settings) => ipcRenderer.invoke('save-capture-settings', settings),
  resetCaptureSettings: () => ipcRenderer.invoke('reset-capture-settings'),

  // =====================================================
  // Profile Management
  // =====================================================
  getProfilesList: () => ipcRenderer.invoke('get-profiles-list'),
  getActiveProfileId: () => ipcRenderer.invoke('get-active-profile-id'),
  getActiveProfile: () => ipcRenderer.invoke('get-active-profile'),
  setActiveProfile: (profileId) => ipcRenderer.invoke('set-active-profile', profileId),
  getProfile: (profileId) => ipcRenderer.invoke('get-profile', profileId),
  createProfile: (profileData) => ipcRenderer.invoke('create-profile', profileData),
  updateProfile: (profileId, updates) => ipcRenderer.invoke('update-profile', profileId, updates),
  duplicateProfile: (sourceProfileId, newName) => ipcRenderer.invoke('duplicate-profile', sourceProfileId, newName),
  deleteProfile: (profileId) => ipcRenderer.invoke('delete-profile', profileId),
  exportProfile: (profileId) => ipcRenderer.invoke('export-profile', profileId),
  importProfile: () => ipcRenderer.invoke('import-profile'),
  resetDefaultProfile: () => ipcRenderer.invoke('reset-default-profile'),

  // =====================================================
  // Profile Assets (Logos & Signatures)
  // =====================================================
  saveProfileAsset: (assetData) => ipcRenderer.invoke('save-profile-asset', assetData),
  removeProfileAsset: (assetData) => ipcRenderer.invoke('remove-profile-asset', assetData),

  // Legacy asset APIs (kept for compatibility)
  saveLogo: (logoData) => ipcRenderer.invoke('save-logo', logoData),
  saveLastPageLogo: (logoData) => ipcRenderer.invoke('save-last-page-logo', logoData),
  saveDigitalSignature: (signatureData) => ipcRenderer.invoke('save-digital-signature', signatureData),
  saveAllPagesSignature: (signatureData) => ipcRenderer.invoke('save-all-pages-signature', signatureData),

  // =====================================================
  // WordPress Sites Management
  // =====================================================
  getWordPressSites: () => ipcRenderer.invoke('get-wordpress-sites'),
  saveWordPressSite: (site) => ipcRenderer.invoke('save-wordpress-site', site),
  deleteWordPressSite: (siteId) => ipcRenderer.invoke('delete-wordpress-site', siteId),

  // =====================================================
  // URL Validation
  // =====================================================
  validateUrl: (url) => ipcRenderer.invoke('validate-url', url),

  // =====================================================
  // Cache Management
  // =====================================================
  clearCache: () => ipcRenderer.invoke('clear-cache'),
});

// Expose Node.js modules needed for the app functionality
// These are safe to expose as they don't give direct filesystem access
contextBridge.exposeInMainWorld('nodeModules', {
  // Screenshot module
  screenshot: {
    captureScreenshot: async (url, settings) => {
      const { captureScreenshot } = require('./screenshot');
      return await captureScreenshot(url, settings);
    },
    closeBrowser: async () => {
      const { closeBrowser } = require('./screenshot');
      return await closeBrowser();
    }
  },

  // PDF generator module
  pdfGenerator: {
    generatePDF: async (results, config) => {
      const { generatePDF } = require('./pdf-generator');
      return await generatePDF(results, config);
    }
  },

  // Browser detector module
  browserDetector: {
    getDefaultBrowser: () => {
      const { getDefaultBrowser } = require('./browser-detector');
      return getDefaultBrowser();
    }
  }
  // Note: WordPress integration is loaded via script tag in HTML
  // because it needs window.electronAPI to be available
});
