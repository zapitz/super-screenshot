// Use electronAPI exposed via preload.js (secure context isolation)
// WordPressIntegration is loaded via script tag in index.html

let currentProcess = null;
let wpIntegration = null;
let results = [];
let detectedBrowsers = [];
let activeProfileId = 'default';

// URL list management
let urlsData = []; // Array of {url, status, statusCode}
let pendingUrls = []; // URLs pending for modal decision

// Capture settings loaded from config
let captureSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const resolution = document.getElementById('resolution');
    const customResolution = document.getElementById('customResolution');
    const resultsSection = document.getElementById('resultsSection');

    // Initialize URL list
    renderUrlsList();

    // Import CSV button
    document.getElementById('importCsvBtn').addEventListener('click', () => {
        document.getElementById('csvInput').click();
    });

    // CSV file input handler
    document.getElementById('csvInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const urls = extractUrlsFromText(text);

        if (urls.length > 0) {
            addConsoleMessage('📄', `Importadas ${urls.length} URLs desde ${file.name}`);
            addUrls(urls);
        } else {
            addConsoleMessage('⚠️', 'No se encontraron URLs válidas en el archivo');
        }

        // Reset input to allow reimporting the same file
        e.target.value = '';
    });

    // Paste button
    document.getElementById('pasteBtn').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            const urls = extractUrlsFromText(text);

            if (urls.length > 0) {
                addConsoleMessage('📋', `Extraídas ${urls.length} URLs del portapapeles`);
                addUrls(urls);
            } else {
                addConsoleMessage('⚠️', 'No se encontraron URLs válidas en el portapapeles');
            }
        } catch (error) {
            addConsoleMessage('❌', 'Error al acceder al portapapeles');
        }
    });

    // Validate button
    document.getElementById('validateBtn').addEventListener('click', validateAllUrls);

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', () => {
        urlsData = [];
        renderUrlsList();
    });

    // URL Modal handlers
    document.getElementById('modalAdd').addEventListener('click', () => {
        const urlObjects = pendingUrls.map(url => ({ url, status: 'pending', statusCode: null }));
        urlsData = [...urlsData, ...urlObjects];
        renderUrlsList();
        closeUrlModal();
    });

    document.getElementById('modalReplace').addEventListener('click', () => {
        const urlObjects = pendingUrls.map(url => ({ url, status: 'pending', statusCode: null }));
        urlsData = urlObjects;
        renderUrlsList();
        closeUrlModal();
    });

    document.getElementById('modalCancel').addEventListener('click', closeUrlModal);

    // Mode selector change
    document.querySelectorAll('input[name="captureMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const pdfNameSection = document.getElementById('pdfNameSection');
            const startBtnText = document.getElementById('startBtnText');
            const startBtnIcon = document.getElementById('startBtnIcon');

            if (e.target.value === 'pdf') {
                pdfNameSection.style.display = 'block';
                startBtnText.textContent = 'Generar PDF';
                startBtnIcon.innerHTML = '<i data-lucide="file-text"></i>';
            } else {
                pdfNameSection.style.display = 'none';
                startBtnText.textContent = 'Iniciar Capturas';
                startBtnIcon.innerHTML = '<i data-lucide="camera"></i>';
            }
            // Re-initialize icons after DOM change
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });
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
        showConsoleCompact();
        resultsSection.style.display = 'none';

        const settings = getSettings();

        try {
            if (settings.mode === 'pdf') {
                // For PDF mode, process and generate PDF immediately
                await processUrls(urls);
                // Auto-generate PDF after captures complete
                const successCount = results.filter(r => r.success).length;
                const cancelled = currentProcess?.cancelled;
                console.log(`PDF mode: ${successCount} successful results, cancelled=${cancelled}`);
                if (successCount > 0 && !cancelled) {
                    await generatePDF();
                } else if (successCount === 0) {
                    addConsoleMessage('❌', 'No hay capturas exitosas para generar el PDF');
                }
            } else {
                // For images mode, just process
                await processUrls(urls);
            }
        } catch (error) {
            console.error('Error in capture/PDF flow:', error);
            addConsoleMessage('❌', `Error: ${error.message}`);
        } finally {
            // Always reset UI when everything is done
            resetUI();
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
    detectedBrowsers = await window.electronAPI.detectBrowsers();

    // Load capture settings from config
    captureSettings = await window.electronAPI.getCaptureSettings() || {};

    // Load profiles
    await loadProfiles();

    // Initialize WordPress integration
    wpIntegration = new window.WordPressIntegration(addUrls, addConsoleMessage, loadProfiles);

    // More options link
    document.getElementById('moreOptionsLink').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'config.html';
    });

    // Short description character counter
    const shortDescInput = document.getElementById('pdfShortDesc');
    const shortDescCount = document.getElementById('shortDescCount');
    if (shortDescInput && shortDescCount) {
        shortDescInput.addEventListener('input', () => {
            shortDescCount.textContent = shortDescInput.value.length;
        });
    }

    // Modal de éxito handlers
    document.getElementById('modalAcceptBtn')?.addEventListener('click', hideSuccessModal);
    document.getElementById('modalOpenFolderBtn')?.addEventListener('click', async () => {
        if (window.currentOutputDir) {
            await window.electronAPI.openFolder(window.currentOutputDir);
        }
        hideSuccessModal();
    });

    // Profile selector change
    const activeProfileSelect = document.getElementById('activeProfile');
    activeProfileSelect.addEventListener('change', async (e) => {
        const value = e.target.value;

        // Handle special actions
        if (value === '__edit_current__') {
            // Reset selection to current profile
            e.target.value = activeProfileId;
            window.location.href = `profile-editor.html?id=${activeProfileId}`;
            return;
        }
        if (value === '__create_new__') {
            // Reset selection to current profile
            e.target.value = activeProfileId;
            window.location.href = 'profile-editor.html?new=true';
            return;
        }

        // Normal profile change
        const result = await window.electronAPI.setActiveProfile(value);
        if (result.success) {
            activeProfileId = value;
            updateProfileIndicator();
            showProfileChangeNotification();
        } else {
            // Revert dropdown if failed
            e.target.value = activeProfileId;
        }
    });

    // Config button
    const configBtn = document.getElementById('configBtn');
    configBtn.addEventListener('click', () => {
        window.location.href = 'config.html';
    });

    // Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Open folder button
    document.addEventListener('click', async (e) => {
        if (e.target.id === 'openFolderBtn' || e.target.parentElement?.id === 'openFolderBtn') {
            if (window.currentOutputDir) {
                await window.electronAPI.openFolder(window.currentOutputDir);
            } else {
                // Open Downloads folder as fallback
                const downloadsPath = await window.electronAPI.getAppPath();
                await window.electronAPI.openFolder(downloadsPath);
            }
        }
    });

    // Console modal event listeners
    document.getElementById('expandConsoleBtn')?.addEventListener('click', () => {
        document.getElementById('consoleModal')?.classList.add('active');
    });

    document.getElementById('closeConsoleModal')?.addEventListener('click', () => {
        document.getElementById('consoleModal')?.classList.remove('active');
    });

    // Close modal when clicking outside
    document.getElementById('consoleModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'consoleModal') {
            document.getElementById('consoleModal')?.classList.remove('active');
        }
    });
});

function getUrls() {
    return urlsData.map(item => item.url);
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
    const mode = document.querySelector('input[name="captureMode"]:checked').value;
    const captureModeSelect = document.getElementById('captureMode').value;

    // Use capture settings from config, with defaults
    const settings = {
        resolution: getResolution(),
        // From config (capture settings)
        lazyLoadScroll: captureSettings.lazyLoadScroll || false,
        scrollDistance: captureSettings.scrollDistance || 1000,
        scrollWaitTime: captureSettings.scrollWaitTime || 1000,
        detectWordPress: captureSettings.detectWordPress || false,
        waitTime: captureSettings.waitTime || 1000,
        navigationTimeout: (captureSettings.navigationTimeout || 30) * 1000, // Convert to ms
        waitUntil: captureSettings.waitUntil || 'networkidle2',
        scrollInterval: captureSettings.scrollInterval || 800,
        waitForImageLoad: captureSettings.waitForImageLoad || 5000,
        // From UI
        browserPath: browserPath,
        mode: mode,
        fullPage: captureModeSelect === 'fullsite'
    };

    // If not full page, limit to resolution height
    if (captureModeSelect === 'resolution') {
        settings.viewportHeightLimit = settings.resolution.height;
    }

    return settings;
}

async function processUrls(urls) {
    const consoleOutput = document.getElementById('consoleOutput');
    const screenshotModule = window.nodeModules.screenshot;

    currentProcess = { cancelled: false };
    const settings = getSettings();

    try {
        consoleOutput.innerHTML = '';
        // Initialize progress
        updateProgress(0, urls.length);

        // Clear cache before starting
        addConsoleMessage('🧹', 'Limpiando caché del navegador...');
        await window.electronAPI.clearCache();
        addConsoleMessage('✅', 'Caché limpiado');

        addConsoleMessage('🚀', `Iniciando captura de ${urls.length} URLs...`);
        console.log('Starting capture process with settings:', settings);

        const totalStartTime = Date.now();

    // Create output folder if in images mode
    let outputDir = null;
    if (settings.mode === 'images') {
        addConsoleMessage('📁', 'Creando carpeta de salida...');
        const folderResult = await window.electronAPI.createOutputFolder();
        if (!folderResult.success) {
            addConsoleMessage('❌', `Error al crear carpeta: ${folderResult.error}`);
            resetUI();
            return;
        }
        outputDir = folderResult.path;
        settings.outputDir = outputDir;
        addConsoleMessage('✅', `Carpeta creada: ${outputDir.split('/').pop()}`);
    }

    // Process single URL with retries
    async function processUrl(url) {
        if (currentProcess.cancelled) return null;

        let captureSuccess = false;
        let lastError = null;
        const maxRetries = 2;
        const urlStartTime = Date.now();

        addConsoleMessage('⏳', `Procesando: ${url.substring(0, 60)}...`);

        for (let attempt = 0; attempt <= maxRetries && !captureSuccess; attempt++) {
            try {
                if (attempt > 0) {
                    addConsoleMessage('🔄', `Reintentando (${attempt}/${maxRetries}): ${url.substring(0, 50)}...`);
                }

                const result = await screenshotModule.captureScreenshot(url, settings);
                const urlTime = ((Date.now() - urlStartTime) / 1000).toFixed(1);
                addConsoleMessage('✅', `Éxito (${urlTime}s): ${result.title || url.substring(0, 50)}`);
                return { url, success: true, ...result };
            } catch (error) {
                console.error(`Error capturing ${url} (attempt ${attempt + 1}):`, error);
                lastError = error;

                if (error.message && (error.message.includes('Navigation timeout') || error.message.includes('net::ERR'))) {
                    break;
                }

                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
                }
            }
        }

        const urlTime = ((Date.now() - urlStartTime) / 1000).toFixed(1);
        const errorMessage = lastError?.message || 'Error desconocido';
        addConsoleMessage('❌', `Error (${urlTime}s): ${url.substring(0, 50)} - ${errorMessage}`);
        return { url, success: false, error: errorMessage };
    }

    // Process URLs in parallel batches of 2
    const concurrency = 2;
    let completed = 0;

    for (let i = 0; i < urls.length; i += concurrency) {
        if (currentProcess.cancelled) break;

        const batch = urls.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(url => processUrl(url)));

        batchResults.forEach(result => {
            if (result) {
                results.push(result);
                completed++;
                updateProgress(completed, urls.length);
            }
        });
    }

    if (!currentProcess.cancelled) {
        resultsSection.style.display = 'block';

        // Show summary
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        // Update final progress text
        const progressText = document.getElementById('progressText');
        const progressTextMini = document.getElementById('progressTextMini');
        if (progressText) progressText.textContent = `Completado: ${successCount} exitosas, ${failCount} fallidas`;
        if (progressTextMini) progressTextMini.textContent = `${successCount}/${urls.length}`;

        // Final console message with total time
        const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(1);
        addConsoleMessage('🎉', `Proceso completado: ${successCount} exitosas, ${failCount} fallidas (${totalTime}s total)`);

        // Show appropriate actions based on mode
        const imageActions = document.getElementById('imageActions');

        if (settings.mode === 'images') {
            imageActions.style.display = 'block';
            if (outputDir && successCount > 0) {
                // Store output directory for open folder button
                window.currentOutputDir = outputDir;
                // Show success modal
                showSuccessModal();
            }
        }
    }
    } catch (error) {
        console.error('Process error:', error);
        addConsoleMessage('❌', `Error fatal: ${error.message}`);
    } finally {
        // Close browser when done
        try {
            await screenshotModule.closeBrowser();
        } catch (e) {}
    }
    // Don't reset UI here - let the caller handle it after PDF generation
}

function addConsoleMessage(icon, text) {
    const consoleOutput = document.getElementById('consoleOutput');
    const compactMessage = document.getElementById('compactMessage');

    const time = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Update compact message (latest message)
    if (compactMessage) {
        compactMessage.textContent = `[${time}] ${icon} ${text}`;
    }

    // Add to full history
    const message = document.createElement('div');
    message.className = 'console-message';
    message.innerHTML = `
        <span class="console-time">[${time}]</span>
        <span class="console-icon">${icon}</span>
        <span class="console-text">${text}</span>
    `;

    consoleOutput.appendChild(message);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function updateProgress(completed, total) {
    const progress = (completed / total) * 100;

    // Full view (modal)
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressText) progressText.textContent = `${completed} de ${total} completadas`;

    // Compact view
    const progressFillMini = document.getElementById('progressFillMini');
    const progressTextMini = document.getElementById('progressTextMini');
    if (progressFillMini) progressFillMini.style.width = `${progress}%`;
    if (progressTextMini) progressTextMini.textContent = `${completed}/${total}`;
}

function showConsoleCompact() {
    const consoleCompact = document.getElementById('consoleCompact');
    const consoleOutput = document.getElementById('consoleOutput');
    if (consoleCompact) {
        consoleCompact.style.display = 'flex';
        // Clear previous messages
        if (consoleOutput) consoleOutput.innerHTML = '';
        // Reset progress
        updateProgress(0, 0);
        // Show spinner
        showCompactSpinner();
    }
}

function hideConsoleCompact() {
    const consoleCompact = document.getElementById('consoleCompact');
    if (consoleCompact) consoleCompact.style.display = 'none';
}

function showCompactSpinner() {
    const spinner = document.getElementById('compactSpinner');
    if (spinner) spinner.style.display = 'inline-block';
}

function hideCompactSpinner() {
    const spinner = document.getElementById('compactSpinner');
    if (spinner) spinner.style.display = 'none';
}

function resetUI() {
    document.getElementById('startBtn').style.display = 'inline-flex';
    document.getElementById('stopBtn').style.display = 'none';
    hideCompactSpinner();
    currentProcess = null;
}

async function generatePDF() {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) {
        addConsoleMessage('❌', 'No hay capturas exitosas para generar el PDF');
        return;
    }

    // Get filename or generate default
    let pdfFileName = document.getElementById('pdfFileName').value.trim();
    if (!pdfFileName) {
        // Use profile name if non-default profile
        if (activeProfileId !== 'default') {
            try {
                const profile = await window.electronAPI.getActiveProfile();
                if (profile && profile.name) {
                    pdfFileName = profile.name;
                }
            } catch (err) {
                console.error('Error getting profile name:', err);
            }
        }
        // Fallback to timestamp
        if (!pdfFileName) {
            const now = new Date();
            const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
            pdfFileName = `super-screenshot-${timestamp}`;
        }
    }
    const fileName = pdfFileName.endsWith('.pdf') ? pdfFileName : `${pdfFileName}.pdf`;

    addConsoleMessage('📝', `Generando PDF: ${fileName}...`);

    // Update compact message to show PDF generation
    const compactMessage = document.getElementById('compactMessage');
    if (compactMessage) {
        compactMessage.textContent = `Generando PDF: ${fileName}...`;
    }

    try {
        // Get current configuration (flattened from active profile)
        const config = await window.electronAPI.getConfig();

        // Use short description if provided
        const shortDesc = document.getElementById('pdfShortDesc')?.value?.trim();
        if (shortDesc) {
            config.coverDescription = shortDesc;
        }

        const pdfModule = window.nodeModules.pdfGenerator;

        // Add timeout to prevent hanging forever
        const pdfPromise = pdfModule.generatePDF(successfulResults, config);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout: la generación del PDF tardó más de 2 minutos')), 120000)
        );
        const pdfBuffer = await Promise.race([pdfPromise, timeoutPromise]);

        const result = await window.electronAPI.savePdf(pdfBuffer, fileName);

        if (result.success) {
            addConsoleMessage('✅', `PDF guardado exitosamente`);
            // Show button to open PDF location
            const resultsSection = document.getElementById('resultsSection');
            const imageActions = document.getElementById('imageActions');
            resultsSection.style.display = 'block';
            imageActions.style.display = 'block';
            // Store PDF directory for open folder button
            window.currentOutputDir = result.path.substring(0, result.path.lastIndexOf('/'));
            // Show success modal
            showSuccessModal();
        } else if (!result.cancelled) {
            addConsoleMessage('❌', `Error al guardar el PDF: ${result.error}`);
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        addConsoleMessage('❌', `Error al generar el PDF: ${error.message}`);
    }
}

// =====================================================
// Profile Management Functions
// =====================================================

async function loadProfiles() {
    try {
        const profiles = await window.electronAPI.getProfilesList();
        activeProfileId = await window.electronAPI.getActiveProfileId();

        const select = document.getElementById('activeProfile');
        select.innerHTML = '';

        // Add profile options
        profiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            // Fix: Si es default y no tiene nombre, mostrar "Default"
            option.textContent = profile.name || (profile.id === 'default' ? 'Default' : 'Sin nombre');
            option.dataset.color = profile.primaryColor;
            if (profile.id === activeProfileId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // Add separator
        const sep = document.createElement('option');
        sep.disabled = true;
        sep.textContent = '──────────────';
        select.appendChild(sep);

        // Add edit current profile option
        const editOption = document.createElement('option');
        editOption.value = '__edit_current__';
        editOption.textContent = '✏️ Editar perfil actual';
        select.appendChild(editOption);

        // Add create new profile option
        const createOption = document.createElement('option');
        createOption.value = '__create_new__';
        createOption.textContent = '➕ Crear nuevo perfil';
        select.appendChild(createOption);

        updateProfileIndicator();
    } catch (error) {
        console.error('Error loading profiles:', error);
    }
}

async function updateProfileIndicator() {
    const select = document.getElementById('activeProfile');
    const indicator = document.getElementById('profileIndicator');
    const selectedOption = select.options[select.selectedIndex];

    if (!selectedOption || !indicator) return;

    const profileId = selectedOption.value;
    if (profileId.startsWith('__')) return; // Skip special options

    try {
        const profile = await window.electronAPI.getProfile(profileId);

        if (profile?.logos?.coverLogoPath) {
            // Show logo with rounded corners
            indicator.innerHTML = `<img src="file://${profile.logos.coverLogoPath}" alt="">`;
            indicator.classList.add('has-logo');
            indicator.style.backgroundColor = '';
        } else {
            // Show color if no logo
            indicator.innerHTML = '';
            indicator.classList.remove('has-logo');
            indicator.style.backgroundColor = selectedOption.dataset.color || '#4fc3f7';
        }
    } catch (e) {
        indicator.innerHTML = '';
        indicator.classList.remove('has-logo');
        indicator.style.backgroundColor = selectedOption.dataset.color || '#4fc3f7';
    }
}

function showProfileChangeNotification() {
    const indicator = document.getElementById('profileIndicator');
    if (indicator) {
        indicator.classList.add('profile-changed');
        setTimeout(() => {
            indicator.classList.remove('profile-changed');
        }, 600);
    }
}

function showSuccessModal() {
    document.getElementById('successModal')?.classList.add('active');
}

function hideSuccessModal() {
    document.getElementById('successModal')?.classList.remove('active');
}

// =====================================================
// URL List Management Functions
// =====================================================

function renderUrlsList() {
    const container = document.getElementById('urlsList');

    if (urlsData.length === 0) {
        container.innerHTML = '<div class="urls-empty">Pega URLs o importa un archivo CSV</div>';
    } else {
        container.innerHTML = urlsData.map((item, index) => `
            <div class="url-item" data-index="${index}" data-status="${item.status}">
                <span class="url-status">${getStatusIcon(item.status)}</span>
                <span class="url-text" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</span>
                <button class="url-remove" onclick="removeUrl(${index})" title="Eliminar"><i data-lucide="x"></i></button>
            </div>
        `).join('');
    }

    updateUrlCount();

    // Re-initialize Lucide icons for dynamic content
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusIcon(status) {
    const icons = {
        'pending': '⚪',
        'validating': '🔄',
        'valid': '🟢',
        'error': '🔴'
    };
    return icons[status] || '⚪';
}

function updateUrlCount() {
    const total = urlsData.length;
    const valid = urlsData.filter(u => u.status === 'valid').length;
    const errors = urlsData.filter(u => u.status === 'error').length;

    document.getElementById('urlCount').textContent = `${total} URLs`;

    const statusEl = document.getElementById('validationStatus');
    if (valid > 0 || errors > 0) {
        const parts = [];
        if (valid > 0) parts.push(`${valid} válidas`);
        if (errors > 0) parts.push(`${errors} errores`);
        statusEl.textContent = `(${parts.join(', ')})`;
    } else {
        statusEl.textContent = '';
    }

    document.getElementById('startBtn').disabled = total === 0;
}

function addUrls(newUrls, forceReplace = false) {
    // Remove duplicates from new URLs
    const uniqueNewUrls = [...new Set(newUrls)];

    // Filter out URLs that already exist
    const existingUrlSet = new Set(urlsData.map(u => u.url));
    const trulyNewUrls = uniqueNewUrls.filter(url => !existingUrlSet.has(url));

    if (trulyNewUrls.length === 0) {
        addConsoleMessage('ℹ️', 'Todas las URLs ya están en la lista');
        return;
    }

    if (urlsData.length > 0 && trulyNewUrls.length > 0 && !forceReplace) {
        // Show modal
        pendingUrls = trulyNewUrls;
        document.getElementById('existingCount').textContent = urlsData.length;
        document.getElementById('newCount').textContent = trulyNewUrls.length;
        document.getElementById('urlModal').classList.add('active');
    } else {
        // Add directly
        const urlObjects = trulyNewUrls.map(url => ({ url, status: 'pending', statusCode: null }));
        urlsData = forceReplace ? urlObjects : [...urlsData, ...urlObjects];
        renderUrlsList();
    }
}

function closeUrlModal() {
    document.getElementById('urlModal').classList.remove('active');
    pendingUrls = [];
}

function removeUrl(index) {
    urlsData.splice(index, 1);
    renderUrlsList();
}

async function validateAllUrls() {
    const pendingItems = urlsData.filter(u => u.status === 'pending' || u.status === 'error');

    if (pendingItems.length === 0) {
        addConsoleMessage('ℹ️', 'No hay URLs pendientes de validar');
        return;
    }

    // Show console compact if hidden
    showConsoleCompact();
    addConsoleMessage('🔍', `Validando ${pendingItems.length} URLs...`);

    // Validate in batches of 5 to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < pendingItems.length; i += batchSize) {
        const batch = pendingItems.slice(i, i + batchSize);

        // Mark as validating
        batch.forEach(item => {
            const idx = urlsData.findIndex(u => u.url === item.url);
            if (idx >= 0) urlsData[idx].status = 'validating';
        });
        renderUrlsList();

        // Validate in parallel
        await Promise.all(batch.map(item => validateUrl(item.url)));

        renderUrlsList();
    }

    const valid = urlsData.filter(u => u.status === 'valid').length;
    const errors = urlsData.filter(u => u.status === 'error').length;
    addConsoleMessage('✅', `Validación completada: ${valid} válidas, ${errors} errores`);

    // Hide spinner when done
    hideCompactSpinner();
}

async function validateUrl(url) {
    const idx = urlsData.findIndex(u => u.url === url);
    if (idx < 0) return;

    try {
        // Use IPC to validate from main process (avoids CORS)
        const result = await window.electronAPI.validateUrl(url);

        urlsData[idx].statusCode = result.statusCode;

        if (result.statusCode >= 200 && result.statusCode < 400) {
            // 2xx y 3xx (redirects) se consideran válidos
            urlsData[idx].status = 'valid';
        } else {
            urlsData[idx].status = 'error';
        }
    } catch (error) {
        urlsData[idx].status = 'error';
        urlsData[idx].statusCode = 0;
    }
}

// Make removeUrl available globally for onclick handlers
window.removeUrl = removeUrl;