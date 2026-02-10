const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');
const http = require('http');
const { detectBrowserPaths } = require('./browser-detector');

let mainWindow;
let aboutWindow = null;
let config = {};

// Default capture settings (optimized for speed)
const DEFAULT_CAPTURE_SETTINGS = {
    lazyLoadScroll: false,
    scrollDistance: 1000,
    scrollWaitTime: 1000,
    detectWordPress: false,
    waitTime: 1000,
    navigationTimeout: 30,
    waitUntil: 'networkidle2',
    scrollInterval: 800,
    waitForImageLoad: 5000
};

// Default profile settings
function getDefaultProfileSettings() {
    return {
        branding: {
            primaryColor: '#2d2d2d',
            secondaryColor: '#555555',
            titleColor: '#000000',
            lineColor: '#333333',
            linkColor: '#1565C0'
        },
        logos: {
            coverLogoPath: null,
            lastPageLogoPath: null
        },
        signer: {
            name: '',
            position: '',
            company: '',
            location: '',
            dateAuto: true,
            dateManual: '',
            showContact: false,
            email: '',
            phone: '',
            idNumber: ''
        },
        signatures: {
            digitalSignaturePath: null,
            allPagesSignaturePath: null
        },
        pdfSettings: {
            fontSize: 14,
            margin: 40,
            showCoverPage: true,
            showCoverDate: true,
            coverDateAuto: true,
            coverDateManual: '',
            coverTitle: '',
            coverDescription: '',
            showPublishDate: true,
            showLastPage: false,
            lastPageUseCoverLogo: true,
            showSignerData: false,
            showSignatureOnAllPages: false,
            legalRepName: '',
            showDigitalSignatureOnAllPages: false,
            allPagesUseLastPageSignature: true
        }
    };
}

// Generate unique profile ID from name
function generateProfileId(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30) || 'profile';
}

// Migrate old config format to new profile-based format
async function migrateConfig(oldConfig) {
    const userDataPath = app.getPath('userData');
    const profilesDir = path.join(userDataPath, 'profiles');
    const defaultProfileDir = path.join(profilesDir, 'default');
    const defaultLogosDir = path.join(defaultProfileDir, 'logos');
    const defaultSignaturesDir = path.join(defaultProfileDir, 'signatures');

    // Create directories
    await fs.mkdir(defaultLogosDir, { recursive: true });
    await fs.mkdir(defaultSignaturesDir, { recursive: true });

    // Build default profile from old config
    const defaultProfile = getDefaultProfileSettings();
    defaultProfile.id = 'default';
    defaultProfile.name = 'Default';
    defaultProfile.description = 'Perfil por defecto';

    // Migrate PDF settings
    if (oldConfig.pdfFontSize) defaultProfile.pdfSettings.fontSize = oldConfig.pdfFontSize;
    if (oldConfig.pdfMargin) defaultProfile.pdfSettings.margin = oldConfig.pdfMargin;
    if (oldConfig.showCoverPage !== undefined) defaultProfile.pdfSettings.showCoverPage = oldConfig.showCoverPage;
    if (oldConfig.showCoverDate !== undefined) defaultProfile.pdfSettings.showCoverDate = oldConfig.showCoverDate;
    if (oldConfig.coverDateAuto !== undefined) defaultProfile.pdfSettings.coverDateAuto = oldConfig.coverDateAuto;
    if (oldConfig.coverDateManual) defaultProfile.pdfSettings.coverDateManual = oldConfig.coverDateManual;
    if (oldConfig.coverTitle) defaultProfile.pdfSettings.coverTitle = oldConfig.coverTitle;
    if (oldConfig.coverDescription) defaultProfile.pdfSettings.coverDescription = oldConfig.coverDescription;
    if (oldConfig.showPublishDate !== undefined) defaultProfile.pdfSettings.showPublishDate = oldConfig.showPublishDate;
    if (oldConfig.showLastPage !== undefined) defaultProfile.pdfSettings.showLastPage = oldConfig.showLastPage;
    if (oldConfig.lastPageUseCoverLogo !== undefined) defaultProfile.pdfSettings.lastPageUseCoverLogo = oldConfig.lastPageUseCoverLogo;
    if (oldConfig.showSignerData !== undefined) defaultProfile.pdfSettings.showSignerData = oldConfig.showSignerData;
    if (oldConfig.showSignatureOnAllPages !== undefined) defaultProfile.pdfSettings.showSignatureOnAllPages = oldConfig.showSignatureOnAllPages;
    if (oldConfig.legalRepName) defaultProfile.pdfSettings.legalRepName = oldConfig.legalRepName;
    if (oldConfig.showDigitalSignatureOnAllPages !== undefined) defaultProfile.pdfSettings.showDigitalSignatureOnAllPages = oldConfig.showDigitalSignatureOnAllPages;
    if (oldConfig.allPagesUseLastPageSignature !== undefined) defaultProfile.pdfSettings.allPagesUseLastPageSignature = oldConfig.allPagesUseLastPageSignature;

    // Migrate signer data
    if (oldConfig.signerName) defaultProfile.signer.name = oldConfig.signerName;
    if (oldConfig.signerPosition) defaultProfile.signer.position = oldConfig.signerPosition;
    if (oldConfig.signerCompany) defaultProfile.signer.company = oldConfig.signerCompany;
    if (oldConfig.signerLocation) defaultProfile.signer.location = oldConfig.signerLocation;
    if (oldConfig.signerDateAuto !== undefined) defaultProfile.signer.dateAuto = oldConfig.signerDateAuto;
    if (oldConfig.signerDateManual) defaultProfile.signer.dateManual = oldConfig.signerDateManual;
    if (oldConfig.showSignerContact !== undefined) defaultProfile.signer.showContact = oldConfig.showSignerContact;
    if (oldConfig.signerEmail) defaultProfile.signer.email = oldConfig.signerEmail;
    if (oldConfig.signerPhone) defaultProfile.signer.phone = oldConfig.signerPhone;
    if (oldConfig.signerIdNumber) defaultProfile.signer.idNumber = oldConfig.signerIdNumber;

    // Move logo files to profile directory
    const oldLogosDir = path.join(userDataPath, 'logos');
    const oldSignaturesDir = path.join(userDataPath, 'signatures');

    // Move cover logo
    if (oldConfig.logoPath) {
        try {
            const exists = await fs.access(oldConfig.logoPath).then(() => true).catch(() => false);
            if (exists) {
                const ext = path.extname(oldConfig.logoPath);
                const newPath = path.join(defaultLogosDir, `cover-logo${ext}`);
                await fs.copyFile(oldConfig.logoPath, newPath);
                defaultProfile.logos.coverLogoPath = newPath;
            }
        } catch (err) {
            console.error('Error migrating cover logo:', err);
        }
    }

    // Move last page logo
    if (oldConfig.lastPageLogoPath) {
        try {
            const exists = await fs.access(oldConfig.lastPageLogoPath).then(() => true).catch(() => false);
            if (exists) {
                const ext = path.extname(oldConfig.lastPageLogoPath);
                const newPath = path.join(defaultLogosDir, `last-page-logo${ext}`);
                await fs.copyFile(oldConfig.lastPageLogoPath, newPath);
                defaultProfile.logos.lastPageLogoPath = newPath;
            }
        } catch (err) {
            console.error('Error migrating last page logo:', err);
        }
    }

    // Move digital signature
    if (oldConfig.digitalSignaturePath) {
        try {
            const exists = await fs.access(oldConfig.digitalSignaturePath).then(() => true).catch(() => false);
            if (exists) {
                const newPath = path.join(defaultSignaturesDir, 'digital-signature.png');
                await fs.copyFile(oldConfig.digitalSignaturePath, newPath);
                defaultProfile.signatures.digitalSignaturePath = newPath;
            }
        } catch (err) {
            console.error('Error migrating digital signature:', err);
        }
    }

    // Move all pages signature
    if (oldConfig.allPagesSignaturePath) {
        try {
            const exists = await fs.access(oldConfig.allPagesSignaturePath).then(() => true).catch(() => false);
            if (exists) {
                const newPath = path.join(defaultSignaturesDir, 'all-pages-signature.png');
                await fs.copyFile(oldConfig.allPagesSignaturePath, newPath);
                defaultProfile.signatures.allPagesSignaturePath = newPath;
            }
        } catch (err) {
            console.error('Error migrating all pages signature:', err);
        }
    }

    // Create new config structure
    const newConfig = {
        version: 2,
        activeProfileId: 'default',
        generalSettings: {
            pdfMetadata: {
                useSignerAsAuthor: true,
                useCoverDateAsCreation: true
            },
            outputFolder: null
        },
        profiles: {
            default: defaultProfile
        }
    };

    return newConfig;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,  // Needed for puppeteer/screenshot module
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('index.html');
}

function createAboutWindow() {
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }

  aboutWindow = new BrowserWindow({
    width: 360,
    height: 420,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Acerca de Super Screenshot',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    parent: mainWindow,
    modal: false,
    show: false
  });

  aboutWindow.loadFile('about.html');
  aboutWindow.setMenuBarVisibility(false);

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: 'Acerca de Super Screenshot', click: createAboutWindow },
        { type: 'separator' },
        { label: 'Configuracion...', accelerator: 'Cmd+,', click: () => mainWindow.webContents.send('open-config') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Archivo',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Ventana',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Sitio Web',
          click: async () => {
            await shell.openExternal('https://rivieramedia.mx');
          }
        },
        {
          label: 'Reportar un problema',
          click: async () => {
            await shell.openExternal('mailto:soporte@rivieramedia.mx');
          }
        },
        ...(!isMac ? [
          { type: 'separator' },
          { label: 'Acerca de Super Screenshot', click: createAboutWindow }
        ] : [])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  // Load config on startup
  await loadConfig();

  // Create menu
  createMenu();

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

ipcMain.handle('save-pdf', async (event, pdfBuffer, fileName) => {
  try {
    // Use custom output folder or Downloads as default
    const outputFolder = config.generalSettings?.outputFolder || app.getPath('downloads');
    const defaultFileName = fileName || `super-screenshot_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.pdf`;

    // Save directly without dialog
    const filePath = path.join(outputFolder, defaultFileName);
    
    // Check if file exists and add number if needed
    let finalPath = filePath;
    let counter = 1;
    while (await fs.access(finalPath).then(() => true).catch(() => false)) {
      const nameParts = path.parse(filePath);
      finalPath = path.join(nameParts.dir, `${nameParts.name} (${counter})${nameParts.ext}`);
      counter++;
    }
    
    await fs.writeFile(finalPath, pdfBuffer);
    return { success: true, path: finalPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('detect-browsers', () => {
  return detectBrowserPaths();
});

ipcMain.handle('select-browser-path', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Seleccionar navegador Chrome/Edge/Chromium',
      properties: ['openFile'],
      filters: process.platform === 'win32' 
        ? [{ name: 'Ejecutables', extensions: ['exe'] }]
        : [{ name: 'Aplicaciones', extensions: ['app', ''] }]
    });

    if (!canceled && filePaths.length > 0) {
      return { success: true, path: filePaths[0] };
    }
    return { success: false, cancelled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-output-folder', async () => {
  try {
    // Use custom output folder or Downloads as default
    const basePath = config.generalSettings?.outputFolder || app.getPath('downloads');
    const date = new Date();
    
    // Format: YYYYMMDD-HHMM
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    const folderName = `${year}${month}${day}-${hours}${minutes}`;
    const outputPath = path.join(basePath, folderName);
    
    // Create directory (recursive to create parent if needed)
    await fs.mkdir(outputPath, { recursive: true });
    
    return { success: true, path: outputPath };
  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, error: error.message };
  }
});

// Config management
async function loadConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    const data = await fs.readFile(configPath, 'utf8');
    config = JSON.parse(data);

    // Check if migration is needed (no version or version < 2)
    if (!config.version || config.version < 2) {
      console.log('Migrating config to profile-based format...');
      config = await migrateConfig(config);
      await saveConfig(config);
      console.log('Config migration completed.');
    }
  } catch (error) {
    // Create default config with profile structure
    const defaultProfile = getDefaultProfileSettings();
    defaultProfile.id = 'default';
    defaultProfile.name = 'Default';
    defaultProfile.description = 'Perfil por defecto';

    config = {
      version: 2,
      activeProfileId: 'default',
      generalSettings: {
        pdfMetadata: {
          useSignerAsAuthor: true,
          useCoverDateAsCreation: true
        },
        outputFolder: null
      },
      profiles: {
        default: defaultProfile
      }
    };
  }
}

async function saveConfig(newConfig) {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
    config = newConfig;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Helper to flatten profile to old config format for backward compatibility
function flattenProfileToConfig(profile) {
  if (!profile) return {};

  return {
    // Branding
    branding: profile.branding || {},

    // PDF Settings
    pdfFontSize: profile.pdfSettings?.fontSize || 14,
    pdfMargin: profile.pdfSettings?.margin || 40,
    showCoverPage: profile.pdfSettings?.showCoverPage !== false,
    showCoverDate: profile.pdfSettings?.showCoverDate !== false,
    coverDateAuto: profile.pdfSettings?.coverDateAuto !== false,
    coverDateManual: profile.pdfSettings?.coverDateManual || '',
    coverTitle: profile.pdfSettings?.coverTitle || '',
    coverDescription: profile.pdfSettings?.coverDescription || '',
    showPublishDate: profile.pdfSettings?.showPublishDate !== false,
    showLastPage: profile.pdfSettings?.showLastPage || false,
    lastPageUseCoverLogo: profile.pdfSettings?.lastPageUseCoverLogo !== false,
    showSignerData: profile.pdfSettings?.showSignerData || false,
    showSignatureOnAllPages: profile.pdfSettings?.showSignatureOnAllPages || false,
    legalRepName: profile.pdfSettings?.legalRepName || '',
    showDigitalSignatureOnAllPages: profile.pdfSettings?.showDigitalSignatureOnAllPages || false,
    allPagesUseLastPageSignature: profile.pdfSettings?.allPagesUseLastPageSignature !== false,

    // Logos
    logoPath: profile.logos?.coverLogoPath || null,
    lastPageLogoPath: profile.logos?.lastPageLogoPath || null,

    // Signer
    signerName: profile.signer?.name || '',
    signerPosition: profile.signer?.position || '',
    signerCompany: profile.signer?.company || '',
    signerLocation: profile.signer?.location || '',
    signerDateAuto: profile.signer?.dateAuto !== false,
    signerDateManual: profile.signer?.dateManual || '',
    showSignerContact: profile.signer?.showContact || false,
    signerEmail: profile.signer?.email || '',
    signerPhone: profile.signer?.phone || '',
    signerIdNumber: profile.signer?.idNumber || '',

    // Signatures
    digitalSignaturePath: profile.signatures?.digitalSignaturePath || null,
    allPagesSignaturePath: profile.signatures?.allPagesSignaturePath || null
  };
}

ipcMain.handle('get-config', () => {
  // Return flattened active profile for backward compatibility
  const activeProfile = config.profiles?.[config.activeProfileId];
  const flattened = flattenProfileToConfig(activeProfile);
  // Include generalSettings for PDF metadata
  flattened.generalSettings = config.generalSettings || {
    pdfMetadata: {
      useSignerAsAuthor: true,
      useCoverDateAsCreation: true
    },
    outputFolder: null
  };
  return flattened;
});

ipcMain.handle('save-config', async (event, newConfig) => {
  return await saveConfig(newConfig);
});

// =====================================================
// General Settings IPC Handlers
// =====================================================

ipcMain.handle('get-general-settings', () => {
  // Ensure generalSettings exists
  if (!config.generalSettings) {
    config.generalSettings = {
      pdfMetadata: {
        useSignerAsAuthor: true,
        useCoverDateAsCreation: true
      },
      outputFolder: null
    };
  }
  return config.generalSettings;
});

ipcMain.handle('save-general-settings', async (event, settings) => {
  try {
    config.generalSettings = settings;
    await saveConfig(config);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-output-folder', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Seleccionar carpeta de salida',
      properties: ['openDirectory', 'createDirectory']
    });

    if (!canceled && filePaths.length > 0) {
      return { success: true, path: filePaths[0] };
    }
    return { success: false, cancelled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// =====================================================
// Capture Settings IPC Handlers
// =====================================================

ipcMain.handle('get-capture-settings', () => {
  // Ensure captureSettings exists in config
  if (!config.captureSettings) {
    config.captureSettings = { ...DEFAULT_CAPTURE_SETTINGS };
  }
  return config.captureSettings;
});

ipcMain.handle('save-capture-settings', async (event, settings) => {
  try {
    config.captureSettings = { ...DEFAULT_CAPTURE_SETTINGS, ...settings };
    await saveConfig(config);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('reset-capture-settings', async () => {
  try {
    config.captureSettings = { ...DEFAULT_CAPTURE_SETTINGS };
    await saveConfig(config);
    return { success: true, settings: config.captureSettings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// =====================================================
// Profile Management IPC Handlers
// =====================================================

// Get list of all profiles (id, name, description)
ipcMain.handle('get-profiles-list', () => {
  const profiles = config.profiles || {};
  return Object.values(profiles).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    primaryColor: p.branding?.primaryColor || '#4fc3f7'
  }));
});

// Get active profile ID
ipcMain.handle('get-active-profile-id', () => {
  return config.activeProfileId || 'default';
});

// Get full active profile data
ipcMain.handle('get-active-profile', () => {
  const activeProfile = config.profiles?.[config.activeProfileId];
  return activeProfile || null;
});

// Set active profile
ipcMain.handle('set-active-profile', async (event, profileId) => {
  if (!config.profiles?.[profileId]) {
    return { success: false, error: 'Profile not found' };
  }
  config.activeProfileId = profileId;
  return await saveConfig(config);
});

// Get a specific profile by ID
ipcMain.handle('get-profile', (event, profileId) => {
  return config.profiles?.[profileId] || null;
});

// Create new profile
ipcMain.handle('create-profile', async (event, profileData) => {
  try {
    const { name, description } = profileData;
    let id = generateProfileId(name);

    // Ensure unique ID
    let counter = 1;
    let originalId = id;
    while (config.profiles?.[id]) {
      id = `${originalId}-${counter}`;
      counter++;
    }

    // Create profile directory
    const userDataPath = app.getPath('userData');
    const profileDir = path.join(userDataPath, 'profiles', id);
    await fs.mkdir(path.join(profileDir, 'logos'), { recursive: true });
    await fs.mkdir(path.join(profileDir, 'signatures'), { recursive: true });

    // Create profile with defaults
    const newProfile = getDefaultProfileSettings();
    newProfile.id = id;
    newProfile.name = name;
    newProfile.description = description || '';

    // Add to config
    if (!config.profiles) config.profiles = {};
    config.profiles[id] = newProfile;

    await saveConfig(config);
    return { success: true, profile: newProfile };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Update existing profile
ipcMain.handle('update-profile', async (event, profileId, updates) => {
  try {
    if (!config.profiles?.[profileId]) {
      return { success: false, error: 'Profile not found' };
    }

    // Deep merge updates into existing profile
    const profile = config.profiles[profileId];

    if (updates.name !== undefined) profile.name = updates.name;
    if (updates.description !== undefined) profile.description = updates.description;

    if (updates.branding) {
      profile.branding = { ...profile.branding, ...updates.branding };
    }
    if (updates.logos) {
      profile.logos = { ...profile.logos, ...updates.logos };
    }
    if (updates.signer) {
      profile.signer = { ...profile.signer, ...updates.signer };
    }
    if (updates.signatures) {
      profile.signatures = { ...profile.signatures, ...updates.signatures };
    }
    if (updates.pdfSettings) {
      profile.pdfSettings = { ...profile.pdfSettings, ...updates.pdfSettings };
    }

    await saveConfig(config);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Duplicate profile
ipcMain.handle('duplicate-profile', async (event, sourceProfileId, newName) => {
  try {
    const sourceProfile = config.profiles?.[sourceProfileId];
    if (!sourceProfile) {
      return { success: false, error: 'Source profile not found' };
    }

    // Generate new ID
    let newId = generateProfileId(newName);
    let counter = 1;
    let originalId = newId;
    while (config.profiles?.[newId]) {
      newId = `${originalId}-${counter}`;
      counter++;
    }

    // Create new profile directory
    const userDataPath = app.getPath('userData');
    const newProfileDir = path.join(userDataPath, 'profiles', newId);
    const newLogosDir = path.join(newProfileDir, 'logos');
    const newSignaturesDir = path.join(newProfileDir, 'signatures');
    await fs.mkdir(newLogosDir, { recursive: true });
    await fs.mkdir(newSignaturesDir, { recursive: true });

    // Deep clone source profile
    const newProfile = JSON.parse(JSON.stringify(sourceProfile));
    newProfile.id = newId;
    newProfile.name = newName;
    newProfile.description = `Copia de ${sourceProfile.name}`;

    // Copy asset files
    if (sourceProfile.logos?.coverLogoPath) {
      try {
        const exists = await fs.access(sourceProfile.logos.coverLogoPath).then(() => true).catch(() => false);
        if (exists) {
          const ext = path.extname(sourceProfile.logos.coverLogoPath);
          const newPath = path.join(newLogosDir, `cover-logo${ext}`);
          await fs.copyFile(sourceProfile.logos.coverLogoPath, newPath);
          newProfile.logos.coverLogoPath = newPath;
        }
      } catch (err) {
        console.error('Error copying cover logo:', err);
      }
    }

    if (sourceProfile.logos?.lastPageLogoPath) {
      try {
        const exists = await fs.access(sourceProfile.logos.lastPageLogoPath).then(() => true).catch(() => false);
        if (exists) {
          const ext = path.extname(sourceProfile.logos.lastPageLogoPath);
          const newPath = path.join(newLogosDir, `last-page-logo${ext}`);
          await fs.copyFile(sourceProfile.logos.lastPageLogoPath, newPath);
          newProfile.logos.lastPageLogoPath = newPath;
        }
      } catch (err) {
        console.error('Error copying last page logo:', err);
      }
    }

    if (sourceProfile.signatures?.digitalSignaturePath) {
      try {
        const exists = await fs.access(sourceProfile.signatures.digitalSignaturePath).then(() => true).catch(() => false);
        if (exists) {
          const newPath = path.join(newSignaturesDir, 'digital-signature.png');
          await fs.copyFile(sourceProfile.signatures.digitalSignaturePath, newPath);
          newProfile.signatures.digitalSignaturePath = newPath;
        }
      } catch (err) {
        console.error('Error copying digital signature:', err);
      }
    }

    if (sourceProfile.signatures?.allPagesSignaturePath) {
      try {
        const exists = await fs.access(sourceProfile.signatures.allPagesSignaturePath).then(() => true).catch(() => false);
        if (exists) {
          const newPath = path.join(newSignaturesDir, 'all-pages-signature.png');
          await fs.copyFile(sourceProfile.signatures.allPagesSignaturePath, newPath);
          newProfile.signatures.allPagesSignaturePath = newPath;
        }
      } catch (err) {
        console.error('Error copying all pages signature:', err);
      }
    }

    // Add to config
    config.profiles[newId] = newProfile;
    await saveConfig(config);

    return { success: true, profile: newProfile };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete profile
ipcMain.handle('delete-profile', async (event, profileId) => {
  try {
    if (profileId === 'default') {
      return { success: false, error: 'Cannot delete default profile' };
    }

    if (!config.profiles?.[profileId]) {
      return { success: false, error: 'Profile not found' };
    }

    // Delete profile directory
    const userDataPath = app.getPath('userData');
    const profileDir = path.join(userDataPath, 'profiles', profileId);
    try {
      await fs.rm(profileDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Error deleting profile directory:', err);
    }

    // Remove from config
    delete config.profiles[profileId];

    // If deleted profile was active, switch to default
    if (config.activeProfileId === profileId) {
      config.activeProfileId = 'default';
    }

    await saveConfig(config);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export profile
ipcMain.handle('export-profile', async (event, profileId) => {
  try {
    const profile = config.profiles?.[profileId];
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Create export object with base64 encoded assets
    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      profile: JSON.parse(JSON.stringify(profile)),
      assets: {}
    };

    // Encode logos
    if (profile.logos?.coverLogoPath) {
      try {
        const data = await fs.readFile(profile.logos.coverLogoPath);
        const ext = path.extname(profile.logos.coverLogoPath).substring(1);
        exportData.assets.coverLogo = {
          data: data.toString('base64'),
          ext: ext
        };
      } catch (err) {
        console.error('Error reading cover logo:', err);
      }
    }

    if (profile.logos?.lastPageLogoPath) {
      try {
        const data = await fs.readFile(profile.logos.lastPageLogoPath);
        const ext = path.extname(profile.logos.lastPageLogoPath).substring(1);
        exportData.assets.lastPageLogo = {
          data: data.toString('base64'),
          ext: ext
        };
      } catch (err) {
        console.error('Error reading last page logo:', err);
      }
    }

    // Encode signatures
    if (profile.signatures?.digitalSignaturePath) {
      try {
        const data = await fs.readFile(profile.signatures.digitalSignaturePath);
        exportData.assets.digitalSignature = {
          data: data.toString('base64'),
          ext: 'png'
        };
      } catch (err) {
        console.error('Error reading digital signature:', err);
      }
    }

    if (profile.signatures?.allPagesSignaturePath) {
      try {
        const data = await fs.readFile(profile.signatures.allPagesSignaturePath);
        exportData.assets.allPagesSignature = {
          data: data.toString('base64'),
          ext: 'png'
        };
      } catch (err) {
        console.error('Error reading all pages signature:', err);
      }
    }

    // Show save dialog
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Exportar Perfil',
      defaultPath: `${profile.name}-profile.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (canceled || !filePath) {
      return { success: false, cancelled: true };
    }

    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Import profile
ipcMain.handle('import-profile', async () => {
  try {
    // Show open dialog
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Importar Perfil',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, cancelled: true };
    }

    // Read and parse file
    const data = await fs.readFile(filePaths[0], 'utf8');
    const importData = JSON.parse(data);

    if (!importData.profile || !importData.profile.name) {
      return { success: false, error: 'Invalid profile file' };
    }

    // Generate new ID
    let newId = generateProfileId(importData.profile.name);
    let counter = 1;
    let originalId = newId;
    while (config.profiles?.[newId]) {
      newId = `${originalId}-${counter}`;
      counter++;
    }

    // Create profile directory
    const userDataPath = app.getPath('userData');
    const profileDir = path.join(userDataPath, 'profiles', newId);
    const logosDir = path.join(profileDir, 'logos');
    const signaturesDir = path.join(profileDir, 'signatures');
    await fs.mkdir(logosDir, { recursive: true });
    await fs.mkdir(signaturesDir, { recursive: true });

    // Create new profile
    const newProfile = importData.profile;
    newProfile.id = newId;

    // Restore assets
    if (importData.assets?.coverLogo) {
      const ext = importData.assets.coverLogo.ext || 'png';
      const filePath = path.join(logosDir, `cover-logo.${ext}`);
      await fs.writeFile(filePath, Buffer.from(importData.assets.coverLogo.data, 'base64'));
      newProfile.logos.coverLogoPath = filePath;
    } else {
      newProfile.logos.coverLogoPath = null;
    }

    if (importData.assets?.lastPageLogo) {
      const ext = importData.assets.lastPageLogo.ext || 'png';
      const filePath = path.join(logosDir, `last-page-logo.${ext}`);
      await fs.writeFile(filePath, Buffer.from(importData.assets.lastPageLogo.data, 'base64'));
      newProfile.logos.lastPageLogoPath = filePath;
    } else {
      newProfile.logos.lastPageLogoPath = null;
    }

    if (importData.assets?.digitalSignature) {
      const filePath = path.join(signaturesDir, 'digital-signature.png');
      await fs.writeFile(filePath, Buffer.from(importData.assets.digitalSignature.data, 'base64'));
      newProfile.signatures.digitalSignaturePath = filePath;
    } else {
      newProfile.signatures.digitalSignaturePath = null;
    }

    if (importData.assets?.allPagesSignature) {
      const filePath = path.join(signaturesDir, 'all-pages-signature.png');
      await fs.writeFile(filePath, Buffer.from(importData.assets.allPagesSignature.data, 'base64'));
      newProfile.signatures.allPagesSignaturePath = filePath;
    } else {
      newProfile.signatures.allPagesSignaturePath = null;
    }

    // Add to config
    if (!config.profiles) config.profiles = {};
    config.profiles[newId] = newProfile;
    await saveConfig(config);

    return { success: true, profile: newProfile };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Save profile asset (logo or signature)
ipcMain.handle('save-profile-asset', async (event, { profileId, assetType, base64, filename }) => {
  try {
    const profile = config.profiles?.[profileId];
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    const userDataPath = app.getPath('userData');
    const profileDir = path.join(userDataPath, 'profiles', profileId);

    let targetDir, targetFilename, configKey, configSection;
    const ext = path.extname(filename);

    switch (assetType) {
      case 'coverLogo':
        targetDir = path.join(profileDir, 'logos');
        targetFilename = `cover-logo${ext}`;
        configSection = 'logos';
        configKey = 'coverLogoPath';
        break;
      case 'lastPageLogo':
        targetDir = path.join(profileDir, 'logos');
        targetFilename = `last-page-logo${ext}`;
        configSection = 'logos';
        configKey = 'lastPageLogoPath';
        break;
      case 'digitalSignature':
        targetDir = path.join(profileDir, 'signatures');
        targetFilename = 'digital-signature.png';
        configSection = 'signatures';
        configKey = 'digitalSignaturePath';
        break;
      case 'allPagesSignature':
        targetDir = path.join(profileDir, 'signatures');
        targetFilename = 'all-pages-signature.png';
        configSection = 'signatures';
        configKey = 'allPagesSignaturePath';
        break;
      default:
        return { success: false, error: 'Invalid asset type' };
    }

    // Ensure directory exists
    await fs.mkdir(targetDir, { recursive: true });

    // Save file
    const filePath = path.join(targetDir, targetFilename);
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, buffer);

    // Update config
    if (!profile[configSection]) profile[configSection] = {};
    profile[configSection][configKey] = filePath;
    await saveConfig(config);

    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Remove profile asset
ipcMain.handle('remove-profile-asset', async (event, { profileId, assetType }) => {
  try {
    const profile = config.profiles?.[profileId];
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    let configSection, configKey;

    switch (assetType) {
      case 'coverLogo':
        configSection = 'logos';
        configKey = 'coverLogoPath';
        break;
      case 'lastPageLogo':
        configSection = 'logos';
        configKey = 'lastPageLogoPath';
        break;
      case 'digitalSignature':
        configSection = 'signatures';
        configKey = 'digitalSignaturePath';
        break;
      case 'allPagesSignature':
        configSection = 'signatures';
        configKey = 'allPagesSignaturePath';
        break;
      default:
        return { success: false, error: 'Invalid asset type' };
    }

    // Delete file if exists
    const filePath = profile[configSection]?.[configKey];
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error('Error deleting asset file:', err);
      }
    }

    // Update config
    if (profile[configSection]) {
      profile[configSection][configKey] = null;
    }
    await saveConfig(config);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-logo', async (event, logoData) => {
  try {
    const { base64, filename } = logoData;

    // Extract extension from filename
    const ext = path.extname(filename);

    // Create logos directory
    const logoDir = path.join(app.getPath('userData'), 'logos');
    await fs.mkdir(logoDir, { recursive: true });

    // Generate path for the logo
    const newPath = path.join(logoDir, `logo${ext}`);

    // Convert base64 to buffer and save
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await fs.writeFile(newPath, buffer);

    return { success: true, path: newPath };
  } catch (error) {
    console.error('Error saving logo:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-last-page-logo', async (event, logoData) => {
  try {
    const { base64, filename } = logoData;

    // Extract extension from filename
    const ext = path.extname(filename);

    // Create logos directory
    const logoDir = path.join(app.getPath('userData'), 'logos');
    await fs.mkdir(logoDir, { recursive: true });

    // Generate path for the last page logo
    const newPath = path.join(logoDir, `last-page-logo${ext}`);

    // Convert base64 to buffer and save
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await fs.writeFile(newPath, buffer);

    return { success: true, path: newPath };
  } catch (error) {
    console.error('Error saving last page logo:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-digital-signature', async (event, signatureData) => {
  try {
    const { base64, filename } = signatureData;

    // Create signatures directory
    const sigDir = path.join(app.getPath('userData'), 'signatures');
    await fs.mkdir(sigDir, { recursive: true });

    // Generate path for the digital signature (always PNG)
    const newPath = path.join(sigDir, 'digital-signature.png');

    // Convert base64 to buffer and save
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await fs.writeFile(newPath, buffer);

    return { success: true, path: newPath };
  } catch (error) {
    console.error('Error saving digital signature:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-all-pages-signature', async (event, signatureData) => {
  try {
    const { base64, filename } = signatureData;

    // Create signatures directory
    const sigDir = path.join(app.getPath('userData'), 'signatures');
    await fs.mkdir(sigDir, { recursive: true });

    // Generate path for the all-pages signature (always PNG)
    const newPath = path.join(sigDir, 'all-pages-signature.png');

    // Convert base64 to buffer and save
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await fs.writeFile(newPath, buffer);

    return { success: true, path: newPath };
  } catch (error) {
    console.error('Error saving all-pages signature:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-folder', async (event, folderPath) => {
  const { shell } = require('electron');
  await shell.openPath(folderPath);
  return { success: true };
});

ipcMain.handle('clear-cache', async () => {
  try {
    const { session } = require('electron');
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
      storages: ['cachestorage', 'shadercache', 'serviceworkers']
    });
    return { success: true };
  } catch (error) {
    console.error('Error clearing cache:', error);
    return { success: false, error: error.message };
  }
});

// URL validation handler
ipcMain.handle('validate-url', async (event, url) => {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const req = protocol.request(url, {
        method: 'HEAD',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        resolve({ statusCode: res.statusCode });
      });

      req.on('error', () => resolve({ statusCode: 0 }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ statusCode: 0 });
      });

      req.end();
    } catch (error) {
      resolve({ statusCode: 0 });
    }
  });
});

// =====================================================
// WordPress Sites Management IPC Handlers
// =====================================================

ipcMain.handle('get-wordpress-sites', () => {
    return config.wordPressSites || [];
});

ipcMain.handle('save-wordpress-site', async (event, site) => {
    if (!config.wordPressSites) {
        config.wordPressSites = [];
    }

    const index = config.wordPressSites.findIndex(s => s.id === site.id);
    if (index >= 0) {
        config.wordPressSites[index] = site;
    } else {
        site.id = site.id || require('crypto').randomUUID();
        config.wordPressSites.push(site);
    }

    await saveConfig(config);
    return site;
});

ipcMain.handle('delete-wordpress-site', async (event, siteId) => {
    if (config.wordPressSites) {
        config.wordPressSites = config.wordPressSites.filter(s => s.id !== siteId);
        await saveConfig(config);
    }
    return true;
});

// Reset default profile to factory settings
ipcMain.handle('reset-default-profile', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const defaultProfileDir = path.join(userDataPath, 'profiles', 'default');

    // Eliminar archivos de assets
    await fs.rm(path.join(defaultProfileDir, 'logos'), { recursive: true, force: true });
    await fs.rm(path.join(defaultProfileDir, 'signatures'), { recursive: true, force: true });

    // Recrear directorios
    await fs.mkdir(path.join(defaultProfileDir, 'logos'), { recursive: true });
    await fs.mkdir(path.join(defaultProfileDir, 'signatures'), { recursive: true });

    // Restablecer a valores de fábrica
    const defaultProfile = getDefaultProfileSettings();
    defaultProfile.id = 'default';
    defaultProfile.name = 'Default';
    defaultProfile.description = 'Perfil por defecto';

    config.profiles.default = defaultProfile;
    await saveConfig(config);

    return { success: true, profile: defaultProfile };
  } catch (error) {
    console.error('Error resetting default profile:', error);
    return { success: false, error: error.message };
  }
});

// Open external URL
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});