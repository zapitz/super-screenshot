// Use electronAPI exposed via preload.js (secure context isolation)

// Default capture settings (optimized values)
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

// Current general settings state
let generalSettings = {
    pdfMetadata: {
        useSignerAsAuthor: true,
        useCoverDateAsCreation: true
    },
    outputFolder: null
};

// Current capture settings state
let captureSettings = { ...DEFAULT_CAPTURE_SETTINGS };

document.addEventListener('DOMContentLoaded', async () => {
    // Load current settings
    await loadGeneralSettings();
    await loadCaptureSettings();

    // Setup event listeners
    setupBackButton();
    setupFolderSelector();
    setupSaveButton();
    setupProfileEditorLink();
    setupCaptureSettingsListeners();
    setupResetButton();
});

// =====================================================
// Load Settings
// =====================================================

async function loadGeneralSettings() {
    try {
        const settings = await window.electronAPI.getGeneralSettings();
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
        const result = await window.electronAPI.selectOutputFolder();
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

    // Collect capture settings
    captureSettings = collectCaptureSettings();

    // Save both settings
    const [generalResult, captureResult] = await Promise.all([
        window.electronAPI.saveGeneralSettings(generalSettings),
        window.electronAPI.saveCaptureSettings(captureSettings)
    ]);

    if (generalResult.success && captureResult.success) {
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
        const error = generalResult.error || captureResult.error;
        showToast('Error al guardar: ' + error, true);
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

// =====================================================
// Capture Settings Functions
// =====================================================

async function loadCaptureSettings() {
    try {
        const settings = await window.electronAPI.getCaptureSettings();
        captureSettings = { ...DEFAULT_CAPTURE_SETTINGS, ...settings };
        populateCaptureSettingsForm();
    } catch (error) {
        console.error('Error loading capture settings:', error);
        captureSettings = { ...DEFAULT_CAPTURE_SETTINGS };
        populateCaptureSettingsForm();
    }
}

function populateCaptureSettingsForm() {
    // Basic capture options
    document.getElementById('lazyLoadScroll').checked = captureSettings.lazyLoadScroll;
    document.getElementById('scrollDistance').value = captureSettings.scrollDistance;
    document.getElementById('scrollWaitTime').value = captureSettings.scrollWaitTime;
    document.getElementById('detectWordPress').checked = captureSettings.detectWordPress;
    document.getElementById('waitTime').value = captureSettings.waitTime;

    // Advanced settings
    document.getElementById('navigationTimeout').value = captureSettings.navigationTimeout;
    document.getElementById('waitUntil').value = captureSettings.waitUntil;
    document.getElementById('scrollInterval').value = captureSettings.scrollInterval;
    document.getElementById('waitForImageLoad').value = captureSettings.waitForImageLoad;

    // Toggle sub-settings visibility
    toggleLazyLoadSubSettings(captureSettings.lazyLoadScroll);
}

function toggleLazyLoadSubSettings(show) {
    document.getElementById('scrollDistanceGroup').style.display = show ? 'block' : 'none';
    document.getElementById('scrollWaitTimeGroup').style.display = show ? 'block' : 'none';
}

function setupCaptureSettingsListeners() {
    // Toggle lazy load sub-settings
    document.getElementById('lazyLoadScroll').addEventListener('change', (e) => {
        toggleLazyLoadSubSettings(e.target.checked);
    });
}

function setupResetButton() {
    // Reset capture options (basic settings)
    document.getElementById('resetCaptureOptionsBtn').addEventListener('click', async () => {
        // Reset only basic capture options
        captureSettings.lazyLoadScroll = DEFAULT_CAPTURE_SETTINGS.lazyLoadScroll;
        captureSettings.scrollDistance = DEFAULT_CAPTURE_SETTINGS.scrollDistance;
        captureSettings.scrollWaitTime = DEFAULT_CAPTURE_SETTINGS.scrollWaitTime;
        captureSettings.detectWordPress = DEFAULT_CAPTURE_SETTINGS.detectWordPress;
        captureSettings.waitTime = DEFAULT_CAPTURE_SETTINGS.waitTime;

        populateCaptureSettingsForm();

        // Save to backend
        const result = await window.electronAPI.saveCaptureSettings(captureSettings);

        if (result.success) {
            showToast('Opciones de captura restablecidas');
        } else {
            showToast('Error al restablecer: ' + result.error, true);
        }
    });

    // Reset advanced settings
    document.getElementById('resetAdvancedSettingsBtn').addEventListener('click', async () => {
        // Reset only advanced settings
        captureSettings.navigationTimeout = DEFAULT_CAPTURE_SETTINGS.navigationTimeout;
        captureSettings.waitUntil = DEFAULT_CAPTURE_SETTINGS.waitUntil;
        captureSettings.scrollInterval = DEFAULT_CAPTURE_SETTINGS.scrollInterval;
        captureSettings.waitForImageLoad = DEFAULT_CAPTURE_SETTINGS.waitForImageLoad;

        populateCaptureSettingsForm();

        // Save to backend
        const result = await window.electronAPI.saveCaptureSettings(captureSettings);

        if (result.success) {
            showToast('Configuración avanzada restablecida');
        } else {
            showToast('Error al restablecer: ' + result.error, true);
        }
    });
}

function collectCaptureSettings() {
    return {
        lazyLoadScroll: document.getElementById('lazyLoadScroll').checked,
        scrollDistance: parseInt(document.getElementById('scrollDistance').value) || DEFAULT_CAPTURE_SETTINGS.scrollDistance,
        scrollWaitTime: parseInt(document.getElementById('scrollWaitTime').value) || DEFAULT_CAPTURE_SETTINGS.scrollWaitTime,
        detectWordPress: document.getElementById('detectWordPress').checked,
        waitTime: parseInt(document.getElementById('waitTime').value) || DEFAULT_CAPTURE_SETTINGS.waitTime,
        navigationTimeout: parseInt(document.getElementById('navigationTimeout').value) || DEFAULT_CAPTURE_SETTINGS.navigationTimeout,
        waitUntil: document.getElementById('waitUntil').value || DEFAULT_CAPTURE_SETTINGS.waitUntil,
        scrollInterval: parseInt(document.getElementById('scrollInterval').value) || DEFAULT_CAPTURE_SETTINGS.scrollInterval,
        waitForImageLoad: parseInt(document.getElementById('waitForImageLoad').value) || DEFAULT_CAPTURE_SETTINGS.waitForImageLoad
    };
}
