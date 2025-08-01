const { ipcRenderer } = require('electron');

// Default configuration
const defaultConfig = {
    pdfFontSize: 14,
    pdfMargin: 40,
    pdfQuality: 85,
    screenshotDelay: 1000,
    waitForImages: true,
    blockAds: false,
    showCoverPage: true,
    showCoverDate: true,
    coverTitle: '',
    coverDescription: '',
    logoPath: null,
    showPublishDate: true
};

let currentConfig = { ...defaultConfig };

document.addEventListener('DOMContentLoaded', async () => {
    // Load saved configuration
    const savedConfig = await ipcRenderer.invoke('get-config');
    if (savedConfig) {
        currentConfig = { ...defaultConfig, ...savedConfig };
    }

    // Initialize UI with config values
    initializeUI();

    // Setup event listeners
    setupEventListeners();
});

function initializeUI() {
    // PDF settings
    document.getElementById('pdfFontSize').value = currentConfig.pdfFontSize;
    document.getElementById('pdfFontSizeValue').textContent = currentConfig.pdfFontSize;
    
    document.getElementById('pdfMargin').value = currentConfig.pdfMargin;
    document.getElementById('pdfMarginValue').textContent = currentConfig.pdfMargin;
    
    document.getElementById('pdfQuality').value = currentConfig.pdfQuality;
    document.getElementById('pdfQualityValue').textContent = currentConfig.pdfQuality;
    
    document.getElementById('showPublishDate').checked = currentConfig.showPublishDate !== false;
    document.getElementById('showCoverDate').checked = currentConfig.showCoverDate !== false;
    
    // Cover page settings
    document.getElementById('showCoverPage').checked = currentConfig.showCoverPage;
    document.getElementById('coverTitle').value = currentConfig.coverTitle || '';
    document.getElementById('coverDescription').value = currentConfig.coverDescription || '';
    
    // Display logo preview if exists
    if (currentConfig.logoPath) {
        showLogoPreview(currentConfig.logoPath, false);
    }
    
    // Screenshot settings
    document.getElementById('screenshotDelay').value = currentConfig.screenshotDelay;
    document.getElementById('screenshotDelayValue').textContent = currentConfig.screenshotDelay;
    
    document.getElementById('waitForImages').checked = currentConfig.waitForImages;
    document.getElementById('blockAds').checked = currentConfig.blockAds;
}

function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Sliders
    const sliders = [
        { id: 'pdfFontSize', valueId: 'pdfFontSizeValue' },
        { id: 'pdfMargin', valueId: 'pdfMarginValue' },
        { id: 'pdfQuality', valueId: 'pdfQualityValue' },
        { id: 'screenshotDelay', valueId: 'screenshotDelayValue' }
    ];

    sliders.forEach(slider => {
        const element = document.getElementById(slider.id);
        const valueElement = document.getElementById(slider.valueId);
        
        element.addEventListener('input', (e) => {
            valueElement.textContent = e.target.value;
            currentConfig[slider.id] = parseInt(e.target.value);
        });
    });

    // Checkboxes
    document.getElementById('waitForImages').addEventListener('change', (e) => {
        currentConfig.waitForImages = e.target.checked;
    });

    document.getElementById('blockAds').addEventListener('change', (e) => {
        currentConfig.blockAds = e.target.checked;
    });

    document.getElementById('showCoverPage').addEventListener('change', (e) => {
        currentConfig.showCoverPage = e.target.checked;
    });
    
    
    document.getElementById('showPublishDate').addEventListener('change', (e) => {
        currentConfig.showPublishDate = e.target.checked;
    });
    
    document.getElementById('showCoverDate').addEventListener('change', (e) => {
        currentConfig.showCoverDate = e.target.checked;
    });

    // Cover title and description
    document.getElementById('coverTitle').addEventListener('input', (e) => {
        currentConfig.coverTitle = e.target.value;
    });
    
    document.getElementById('coverDescription').addEventListener('input', (e) => {
        currentConfig.coverDescription = e.target.value;
    });

    // Logo handling
    const selectLogoBtn = document.getElementById('selectLogoBtn');
    const removeLogoBtn = document.getElementById('removeLogoBtn');
    const logoFile = document.getElementById('logoFile');

    selectLogoBtn.addEventListener('click', () => {
        logoFile.click();
    });

    logoFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Read file as base64
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64Data = event.target.result;
                    
                    // Send base64 data to main process
                    const result = await ipcRenderer.invoke('save-logo', {
                        base64: base64Data,
                        filename: file.name
                    });
                    
                    if (result.success) {
                        currentConfig.logoPath = result.path;
                        // Show preview using base64 data directly
                        showLogoPreview(base64Data, true);
                    } else {
                        console.error('Error saving logo:', result.error);
                        alert('Error al guardar el logo: ' + result.error);
                    }
                };
                
                reader.onerror = (error) => {
                    console.error('Error reading file:', error);
                    alert('Error al leer el archivo');
                };
                
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Error processing logo:', error);
                alert('Error al procesar el logo');
            }
        }
    });

    removeLogoBtn.addEventListener('click', () => {
        currentConfig.logoPath = null;
        document.getElementById('logoPreview').innerHTML = '';
        removeLogoBtn.style.display = 'none';
    });

    // Save button
    document.getElementById('saveBtn').addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('save-config', currentConfig);
        if (result.success) {
            // Show success feedback
            const btn = document.getElementById('saveBtn');
            const originalText = btn.textContent;
            btn.textContent = '✅ Guardado';
            btn.style.backgroundColor = '#4caf50';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.backgroundColor = '#4fc3f7';
            }, 2000);
        }
    });
}

function showLogoPreview(logoPath, isBase64 = false) {
    const preview = document.getElementById('logoPreview');
    const removeBtn = document.getElementById('removeLogoBtn');
    
    // Use base64 directly or convert path to file:// protocol
    const imageSrc = isBase64 ? logoPath : (logoPath.startsWith('file://') ? logoPath : `file://${logoPath}`);
    preview.innerHTML = `<img src="${imageSrc}" style="max-width: 150px; max-height: 150px; border: 1px solid #424242; padding: 10px; background: #1e1e1e; border-radius: 4px;">`;
    removeBtn.style.display = 'inline-block';
}