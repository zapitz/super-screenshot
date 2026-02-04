const { ipcRenderer } = require('electron');

// Current general settings state
let generalSettings = {
    pdfMetadata: {
        useSignerAsAuthor: true,
        useCoverDateAsCreation: true
    },
    outputFolder: null
};

document.addEventListener('DOMContentLoaded', async () => {
    // Load current settings
    await loadGeneralSettings();

    // Setup event listeners
    setupBackButton();
    setupFolderSelector();
    setupSaveButton();
    setupProfileEditorLink();
});

// =====================================================
// Load Settings
// =====================================================

async function loadGeneralSettings() {
    try {
        const settings = await ipcRenderer.invoke('get-general-settings');
        generalSettings = settings || generalSettings;

        // Populate form
        document.getElementById('useSignerAsAuthor').checked =
            generalSettings.pdfMetadata?.useSignerAsAuthor !== false;
        document.getElementById('useCoverDateAsCreation').checked =
            generalSettings.pdfMetadata?.useCoverDateAsCreation !== false;

        // Update folder display
        updateFolderDisplay();
    } catch (error) {
        console.error('Error loading general settings:', error);
        showToast('Error al cargar configuracion', true);
    }
}

function updateFolderDisplay() {
    const folderInput = document.getElementById('outputFolder');
    if (generalSettings.outputFolder) {
        folderInput.value = generalSettings.outputFolder;
    } else {
        folderInput.value = '';
        folderInput.placeholder = 'Carpeta de Descargas (por defecto)';
    }
}

// =====================================================
// Folder Selector
// =====================================================

function setupFolderSelector() {
    document.getElementById('selectFolderBtn').addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('select-output-folder');
        if (result.success) {
            generalSettings.outputFolder = result.path;
            updateFolderDisplay();
        }
    });

    document.getElementById('resetFolderBtn').addEventListener('click', () => {
        generalSettings.outputFolder = null;
        updateFolderDisplay();
    });
}

// =====================================================
// Save Settings
// =====================================================

function setupSaveButton() {
    document.getElementById('saveBtn').addEventListener('click', async () => {
        await saveSettings();
    });
}

async function saveSettings() {
    // Collect form data
    generalSettings.pdfMetadata = {
        useSignerAsAuthor: document.getElementById('useSignerAsAuthor').checked,
        useCoverDateAsCreation: document.getElementById('useCoverDateAsCreation').checked
    };

    const result = await ipcRenderer.invoke('save-general-settings', generalSettings);

    if (result.success) {
        // Update button feedback
        const btn = document.getElementById('saveBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Guardado!';
        btn.style.backgroundColor = '#4caf50';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '#4fc3f7';
        }, 2000);
    } else {
        showToast('Error al guardar: ' + result.error, true);
    }
}

// =====================================================
// Navigation
// =====================================================

function setupBackButton() {
    document.getElementById('backBtn').addEventListener('click', async () => {
        // Auto-save before leaving
        await saveSettings();
        window.location.href = 'index.html';
    });
}

function setupProfileEditorLink() {
    document.getElementById('goToProfileEditorBtn').addEventListener('click', () => {
        window.location.href = 'profile-editor.html';
    });
}

// =====================================================
// Utility Functions
// =====================================================

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
