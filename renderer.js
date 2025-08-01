const { ipcRenderer } = require('electron');
const { getDefaultBrowser } = require('./browser-detector');

let currentProcess = null;
let results = [];
let detectedBrowsers = [];

document.addEventListener('DOMContentLoaded', async () => {
    const urlsInput = document.getElementById('urlsInput');
    const urlCount = document.getElementById('urlCount');
    const clearBtn = document.getElementById('clearBtn');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const resolution = document.getElementById('resolution');
    const customResolution = document.getElementById('customResolution');
    const progressSection = document.getElementById('progressSection');
    const resultsSection = document.getElementById('resultsSection');
    const generatePdfBtn = document.getElementById('generatePdfBtn');

    // Update URL count
    urlsInput.addEventListener('input', () => {
        const urls = getUrls();
        urlCount.textContent = `${urls.length} URLs`;
        startBtn.disabled = urls.length === 0;
    });
    
    // Extract URLs on paste
    urlsInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        const extractedUrls = extractUrlsFromText(pastedText);
        
        if (extractedUrls.length > 0) {
            // Get existing URLs
            const currentText = urlsInput.value.trim();
            const existingUrls = currentText ? currentText.split('\n').filter(url => url.trim()) : [];
            
            // Combine existing and new URLs
            const allUrls = [...existingUrls, ...extractedUrls];
            
            // Update textarea
            urlsInput.value = allUrls.join('\n');
            
            // Trigger input event to update count
            urlsInput.dispatchEvent(new Event('input'));
        } else {
            // If no URLs found, paste as normal
            urlsInput.value += pastedText;
            urlsInput.dispatchEvent(new Event('input'));
        }
    });
    
    // Mode selector change
    document.querySelectorAll('input[name="captureMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const pdfNameSection = document.getElementById('pdfNameSection');
            const startBtnText = document.getElementById('startBtnText');
            const startBtnIcon = document.getElementById('startBtnIcon');
            
            if (e.target.value === 'pdf') {
                pdfNameSection.style.display = 'block';
                startBtnText.textContent = 'Generar PDF';
                startBtnIcon.textContent = '📄';
            } else {
                pdfNameSection.style.display = 'none';
                startBtnText.textContent = 'Iniciar Capturas';
                startBtnIcon.textContent = '📸';
            }
        });
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
        urlsInput.value = '';
        urlCount.textContent = '0 URLs';
        startBtn.disabled = true;
        results = [];
        resultsSection.style.display = 'none';
    });

    // Resolution selector
    resolution.addEventListener('change', () => {
        customResolution.style.display = resolution.value === 'custom' ? 'flex' : 'none';
    });

    // Start button
    startBtn.addEventListener('click', async () => {
        const urls = getUrls();
        if (urls.length === 0) return;

        results = [];
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-flex';
        document.getElementById('consoleSection').style.display = 'block';
        resultsSection.style.display = 'none';

        const settings = getSettings();
        
        if (settings.mode === 'pdf') {
            // For PDF mode, process and generate PDF immediately
            await processUrls(urls);
            // Auto-generate PDF after captures complete
            if (results.filter(r => r.success).length > 0) {
                await generatePDF();
            }
        } else {
            // For images mode, just process
            await processUrls(urls);
        }
    });

    // Stop button
    stopBtn.addEventListener('click', () => {
        if (currentProcess) {
            currentProcess.cancelled = true;
        }
        resetUI();
    });


    // Browser auto-detection happens in background
    detectedBrowsers = await ipcRenderer.invoke('detect-browsers');

    // Config button
    const configBtn = document.getElementById('configBtn');
    configBtn.addEventListener('click', () => {
        window.location.href = 'config.html';
    });
    
    // Open folder button
    document.addEventListener('click', async (e) => {
        if (e.target.id === 'openFolderBtn' || e.target.parentElement?.id === 'openFolderBtn') {
            if (window.currentOutputDir) {
                await ipcRenderer.invoke('open-folder', window.currentOutputDir);
            } else {
                // Open Downloads folder as fallback
                const downloadsPath = await ipcRenderer.invoke('get-app-path');
                await ipcRenderer.invoke('open-folder', downloadsPath);
            }
        }
    });
});

function getUrls() {
    const urlsText = document.getElementById('urlsInput').value;
    return urlsText.split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0)
        .filter(url => {
            // More lenient validation for counting
            if (url.match(/^https?:\/\//i)) return isValidUrl(url);
            if (url.match(/^www\./i)) return isValidUrl('http://' + url);
            if (url.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)) return isValidUrl('http://' + url);
            return false;
        });
}

function isValidUrl(string) {
    try {
        // Clean the URL first
        let url = string.trim();
        
        // Add protocol if missing
        if (!url.match(/^https?:\/\//i) && !url.startsWith('//')) {
            if (url.match(/^www\./i) || url.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)) {
                url = 'http://' + url;
            }
        }
        
        new URL(url);
        return true;
    } catch (_) {
        return false;
    }
}

function extractUrlsFromText(text) {
    // More comprehensive URL regex that catches more patterns
    const urlRegex = /(?:(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s<>"{}|\\^\[\]`]*)?)/gi;
    
    // Find all matches
    const matches = text.match(urlRegex) || [];
    
    // Process and validate URLs
    const urls = matches.map(url => {
        url = url.trim();
        
        // Add http:// to URLs without protocol
        if (!url.match(/^https?:\/\//i)) {
            url = 'http://' + url;
        }
        
        // Clean up common trailing punctuation
        url = url.replace(/[.,;:!?)\]>]+$/, '');
        
        // Remove trailing slashes for consistency
        url = url.replace(/\/+$/, '');
        
        return url;
    });
    
    // Filter valid URLs and remove duplicates
    const validUrls = urls.filter(url => isValidUrl(url));
    const uniqueUrls = [...new Set(validUrls)];
    
    return uniqueUrls;
}

function getResolution() {
    const resolution = document.getElementById('resolution').value;
    if (resolution === 'custom') {
        const width = parseInt(document.getElementById('customWidth').value) || 1920;
        const height = parseInt(document.getElementById('customHeight').value) || 1080;
        return { width, height };
    } else {
        const [width, height] = resolution.split('x').map(Number);
        return { width, height };
    }
}

function getSettings() {
    const browserPath = document.getElementById('browserPath').value;
    const navigationTimeout = parseInt(document.getElementById('navigationTimeout').value) * 1000; // Convert to ms
    const mode = document.querySelector('input[name="captureMode"]:checked').value;
    const captureMode = document.getElementById('captureMode').value;
    
    const settings = {
        resolution: getResolution(),
        lazyLoadScroll: document.getElementById('lazyLoadScroll').checked,
        scrollDistance: parseInt(document.getElementById('scrollDistance').value),
        detectWordPress: document.getElementById('detectWordPress').checked,
        waitTime: parseInt(document.getElementById('waitTime').value),
        browserPath: browserPath,
        navigationTimeout: navigationTimeout,
        mode: mode,
        fullPage: captureMode === 'fullsite'
    };
    
    // If not full page, limit to resolution height
    if (captureMode === 'resolution') {
        settings.viewportHeightLimit = settings.resolution.height;
    }
    
    return settings;
}

async function processUrls(urls) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const consoleOutput = document.getElementById('consoleOutput');
    const spinner = document.getElementById('spinner');
    
    currentProcess = { cancelled: false };
    const settings = getSettings();
    
    try {
        const screenshotModule = require('./screenshot');
        
        consoleOutput.innerHTML = '';
        spinner.style.display = 'block';
        
        addConsoleMessage('🚀', `Iniciando captura de ${urls.length} URLs...`);
        console.log('Starting capture process with settings:', settings);
    
    // Create output folder if in images mode
    let outputDir = null;
    if (settings.mode === 'images') {
        addConsoleMessage('📁', 'Creando carpeta de salida...');
        const folderResult = await ipcRenderer.invoke('create-output-folder');
        if (!folderResult.success) {
            addConsoleMessage('❌', `Error al crear carpeta: ${folderResult.error}`);
            resetUI();
            return;
        }
        outputDir = folderResult.path;
        settings.outputDir = outputDir;
        addConsoleMessage('✅', `Carpeta creada: ${outputDir.split('/').pop()}`);
    }

    for (let i = 0; i < urls.length; i++) {
        if (currentProcess.cancelled) break;

        const url = urls[i];
        const progress = ((i + 1) / urls.length) * 100;
        
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${i + 1} de ${urls.length} completadas`;

        try {
            addConsoleMessage('⏳', `Procesando: ${url.substring(0, 60)}...`);
            const result = await screenshotModule.captureScreenshot(url, settings);
            results.push({
                url,
                success: true,
                ...result
            });
            addConsoleMessage('✅', `Éxito: ${result.title || url.substring(0, 50)}`);
        } catch (error) {
            console.error(`Error capturing ${url}:`, error);
            const errorMessage = error.message || 'Error desconocido';
            results.push({
                url,
                success: false,
                error: errorMessage
            });
            addConsoleMessage('❌', `Error: ${url.substring(0, 50)} - ${errorMessage}`);
        }
    }

    if (!currentProcess.cancelled) {
        resultsSection.style.display = 'block';
        
        // Show summary
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        progressText.textContent = `Completado: ${successCount} exitosas, ${failCount} fallidas`;
        
        // Final console message
        addConsoleMessage('🎉', `Proceso completado: ${successCount} exitosas, ${failCount} fallidas`);
        
        // Hide spinner
        document.getElementById('spinner').style.display = 'none';
        
        // Show appropriate actions based on mode
        const imageActions = document.getElementById('imageActions');
        
        if (settings.mode === 'images') {
            imageActions.style.display = 'block';
            if (outputDir && successCount > 0) {
                // Store output directory for open folder button
                window.currentOutputDir = outputDir;
            }
        }
    }
    } catch (error) {
        console.error('Process error:', error);
        addConsoleMessage('❌', `Error fatal: ${error.message}`);
        document.getElementById('spinner').style.display = 'none';
    }
    resetUI();
}

function addConsoleMessage(icon, text) {
    const consoleOutput = document.getElementById('consoleOutput');
    const message = document.createElement('div');
    message.className = 'console-message';
    
    const time = new Date().toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    
    message.innerHTML = `
        <span class="console-time">[${time}]</span>
        <span class="console-icon">${icon}</span>
        <span class="console-text">${text}</span>
    `;
    
    consoleOutput.appendChild(message);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function resetUI() {
    document.getElementById('startBtn').style.display = 'inline-flex';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('spinner').style.display = 'none';
    currentProcess = null;
}

async function generatePDF() {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) {
        addConsoleMessage('❌', 'No hay capturas exitosas para generar el PDF');
        return;
    }
    
    // Get filename or generate default with timestamp
    let pdfFileName = document.getElementById('pdfFileName').value.trim();
    if (!pdfFileName) {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
        pdfFileName = `super-screenshot-${timestamp}`;
    }
    const fileName = pdfFileName.endsWith('.pdf') ? pdfFileName : `${pdfFileName}.pdf`;
    
    addConsoleMessage('📝', `Generando PDF: ${fileName}...`);

    try {
        // Get current configuration
        const config = await ipcRenderer.invoke('get-config');
        
        const pdfModule = require('./pdf-generator');
        const pdfBuffer = await pdfModule.generatePDF(successfulResults, config);
        
        const result = await ipcRenderer.invoke('save-pdf', pdfBuffer, fileName);
        
        if (result.success) {
            addConsoleMessage('✅', `PDF guardado exitosamente`);
            // Show button to open PDF location
            const resultsSection = document.getElementById('resultsSection');
            const imageActions = document.getElementById('imageActions');
            resultsSection.style.display = 'block';
            imageActions.style.display = 'block';
            // Store PDF directory for open folder button  
            window.currentOutputDir = result.path.substring(0, result.path.lastIndexOf('/'));
        } else if (!result.cancelled) {
            addConsoleMessage('❌', `Error al guardar el PDF: ${result.error}`);
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        addConsoleMessage('❌', `Error al generar el PDF: ${error.message}`);
    }
}