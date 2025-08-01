const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { detectBrowserPaths } = require('./browser-detector');

let mainWindow;
let config = {};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(async () => {
  // Load config on startup
  await loadConfig();
  
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
    // Use Downloads folder as default
    const downloadsPath = app.getPath('downloads');
    const defaultFileName = fileName || `super-screenshot_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.pdf`;
    
    // Save directly without dialog
    const filePath = path.join(downloadsPath, defaultFileName);
    
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
    const downloadsPath = app.getPath('downloads');
    const date = new Date();
    
    // Format: YYYYMMDD-HHMM
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    const folderName = `${year}${month}${day}-${hours}${minutes}`;
    const outputPath = path.join(downloadsPath, folderName);
    
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
  } catch (error) {
    // Use default config if file doesn't exist
    config = {};
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

ipcMain.handle('get-config', () => {
  return config;
});

ipcMain.handle('save-config', async (event, newConfig) => {
  return await saveConfig(newConfig);
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

ipcMain.handle('open-folder', async (event, folderPath) => {
  const { shell } = require('electron');
  await shell.openPath(folderPath);
  return { success: true };
});