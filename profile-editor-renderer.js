// Use electronAPI exposed via preload.js (secure context isolation)

// Current state
let currentProfileId = 'default';
let currentProfile = null;
let profilesList = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Check URL parameters for initial state
    const urlParams = new URLSearchParams(window.location.search);
    const requestedProfileId = urlParams.get('id');
    const createNew = urlParams.get('new');

    // Load profiles list
    await loadProfilesList();

    // Handle initial state based on URL params
    if (createNew === 'true') {
        // Show new profile modal
        document.getElementById('newProfileName').value = '';
        document.getElementById('newProfileDescription').value = '';
        document.getElementById('newProfileModal').classList.add('active');
        document.getElementById('newProfileName').focus();
    } else if (requestedProfileId && profilesList.some(p => p.id === requestedProfileId)) {
        // Load specific profile
        currentProfileId = requestedProfileId;
        await loadCurrentProfile();
    } else {
        // Load active profile
        await loadCurrentProfile();
    }

    // Setup all event listeners
    setupTabs();
    setupProfileManagement();
    setupColorPickers();
    setupSliders();
    setupCheckboxes();
    setupRadioButtons();
    setupTextInputs();
    setupAssetUploads();
    setupSaveButton();
    setupBackButton();
});

// =====================================================
// Tabs
// =====================================================

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Update button states
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content visibility
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}

// =====================================================
// Profile Loading Functions
// =====================================================

async function loadProfilesList() {
    try {
        profilesList = await window.electronAPI.getProfilesList();
        const activeId = await window.electronAPI.getActiveProfileId();

        // Use current profile ID if set, otherwise use active
        if (!currentProfileId || !profilesList.some(p => p.id === currentProfileId)) {
            currentProfileId = activeId;
        }

        const select = document.getElementById('profileSelect');
        select.innerHTML = '';

        profilesList.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name;
            option.dataset.color = profile.primaryColor;
            if (profile.id === currentProfileId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        updateProfileColorIndicator();
    } catch (error) {
        console.error('Error loading profiles list:', error);
        showToast('Error al cargar perfiles', true);
    }
}

async function loadCurrentProfile() {
    try {
        currentProfile = await window.electronAPI.getProfile(currentProfileId);
        if (currentProfile) {
            populateFormWithProfile(currentProfile);
            updateProfileColorIndicator();
            updateResetButtonVisibility();
        } else {
            showToast('Perfil no encontrado', true);
        }
    } catch (error) {
        console.error('Error loading current profile:', error);
        showToast('Error al cargar el perfil', true);
    }
}

// Mostrar/ocultar botón restablecer según perfil
function updateResetButtonVisibility() {
    const resetBtn = document.getElementById('resetDefaultBtn');
    if (resetBtn) {
        resetBtn.style.display = currentProfileId === 'default' ? 'inline-flex' : 'none';
    }
}

function populateFormWithProfile(profile) {
    // Profile info
    document.getElementById('profileName').value = profile.name || '';
    document.getElementById('profileDescription').value = profile.description || '';

    // Branding colors
    const branding = profile.branding || {};
    setColorValue('primaryColor', branding.primaryColor || '#2d2d2d');
    setColorValue('secondaryColor', branding.secondaryColor || '#555555');
    setColorValue('titleColor', branding.titleColor || '#000000');
    setColorValue('lineColor', branding.lineColor || '#333333');
    setColorValue('linkColor', branding.linkColor || '#1565C0');

    // PDF settings
    const pdfSettings = profile.pdfSettings || {};
    document.getElementById('pdfFontSize').value = pdfSettings.fontSize || 14;
    document.getElementById('pdfFontSizeValue').textContent = pdfSettings.fontSize || 14;
    document.getElementById('pdfMargin').value = pdfSettings.margin || 40;
    document.getElementById('pdfMarginValue').textContent = pdfSettings.margin || 40;
    document.getElementById('showPublishDate').checked = pdfSettings.showPublishDate !== false;

    // Cover page
    document.getElementById('showCoverPage').checked = pdfSettings.showCoverPage !== false;
    document.getElementById('showCoverDate').checked = pdfSettings.showCoverDate !== false;
    document.getElementById('coverDateOptions').style.display = pdfSettings.showCoverDate !== false ? 'block' : 'none';

    if (pdfSettings.coverDateAuto !== false) {
        document.getElementById('coverDateAuto').checked = true;
        document.getElementById('coverDateManualInput').style.display = 'none';
    } else {
        document.getElementById('coverDateManualRadio').checked = true;
        document.getElementById('coverDateManualInput').style.display = 'block';
    }
    document.getElementById('coverDateManual').value = pdfSettings.coverDateManual || '';
    document.getElementById('coverTitle').value = pdfSettings.coverTitle || '';
    document.getElementById('coverDescription').value = pdfSettings.coverDescription || '';

    // Cover logo
    const logos = profile.logos || {};
    if (logos.coverLogoPath) {
        showImagePreview('logoPreview', logos.coverLogoPath, false);
        document.getElementById('removeLogoBtn').style.display = 'inline-block';
    } else {
        document.getElementById('logoPreview').innerHTML = '';
        document.getElementById('removeLogoBtn').style.display = 'none';
    }

    // Last page logo
    if (logos.lastPageLogoPath) {
        showImagePreview('lastPageLogoPreview', logos.lastPageLogoPath, false);
        document.getElementById('removeLastPageLogoBtn').style.display = 'inline-block';
    } else {
        document.getElementById('lastPageLogoPreview').innerHTML = '';
        document.getElementById('removeLastPageLogoBtn').style.display = 'none';
    }

    // Last page settings
    document.getElementById('showLastPage').checked = pdfSettings.showLastPage || false;
    document.getElementById('lastPageOptions').style.display = pdfSettings.showLastPage ? 'block' : 'none';

    if (pdfSettings.lastPageUseCoverLogo !== false) {
        document.getElementById('lastPageUseCoverLogo').checked = true;
    } else {
        document.getElementById('lastPageUseDifferentLogo').checked = true;
    }

    // Signer data
    const signer = profile.signer || {};
    document.getElementById('showSignerData').checked = pdfSettings.showSignerData || false;
    document.getElementById('signerDataOptions').style.display = pdfSettings.showSignerData ? 'block' : 'none';

    document.getElementById('signerName').value = signer.name || '';
    document.getElementById('signerPosition').value = signer.position || '';
    document.getElementById('signerCompany').value = signer.company || '';
    document.getElementById('signerLocation').value = signer.location || '';

    if (signer.dateAuto !== false) {
        document.getElementById('signerDateAuto').checked = true;
        document.getElementById('signerDateManualInput').style.display = 'none';
    } else {
        document.getElementById('signerDateManualRadio').checked = true;
        document.getElementById('signerDateManualInput').style.display = 'block';
    }
    document.getElementById('signerDateManual').value = signer.dateManual || '';

    document.getElementById('showSignerContact').checked = signer.showContact || false;
    document.getElementById('signerContactOptions').style.display = signer.showContact ? 'block' : 'none';

    document.getElementById('signerEmail').value = signer.email || '';
    document.getElementById('signerPhone').value = signer.phone || '';
    document.getElementById('signerIdNumber').value = signer.idNumber || '';

    // Digital signature
    const signatures = profile.signatures || {};
    if (signatures.digitalSignaturePath) {
        showImagePreview('digitalSignaturePreview', signatures.digitalSignaturePath, false);
        document.getElementById('removeDigitalSignatureBtn').style.display = 'inline-block';
    } else {
        document.getElementById('digitalSignaturePreview').innerHTML = '';
        document.getElementById('removeDigitalSignatureBtn').style.display = 'none';
    }

    // Signature on all pages
    document.getElementById('showSignatureOnAllPages').checked = pdfSettings.showSignatureOnAllPages || false;
    document.getElementById('signatureOnAllPagesOptions').style.display = pdfSettings.showSignatureOnAllPages ? 'block' : 'none';
    document.getElementById('legalRepName').value = pdfSettings.legalRepName || '';

    document.getElementById('showDigitalSignatureOnAllPages').checked = pdfSettings.showDigitalSignatureOnAllPages || false;
    document.getElementById('allPagesSignatureOptions').style.display = pdfSettings.showDigitalSignatureOnAllPages ? 'block' : 'none';

    if (pdfSettings.allPagesUseLastPageSignature !== false) {
        document.getElementById('allPagesUseLastPageSignature').checked = true;
        document.getElementById('allPagesSignatureUpload').style.display = 'none';
    } else {
        document.getElementById('allPagesUseDifferentSignature').checked = true;
        document.getElementById('allPagesSignatureUpload').style.display = 'block';
    }

    if (signatures.allPagesSignaturePath) {
        showImagePreview('allPagesSignaturePreview', signatures.allPagesSignaturePath, false);
        document.getElementById('removeAllPagesSignatureBtn').style.display = 'inline-block';
    } else {
        document.getElementById('allPagesSignaturePreview').innerHTML = '';
        document.getElementById('removeAllPagesSignatureBtn').style.display = 'none';
    }

    // Update date warning
    updateDateWarning();
}

function collectFormData() {
    return {
        name: document.getElementById('profileName').value,
        description: document.getElementById('profileDescription').value,
        branding: {
            primaryColor: document.getElementById('primaryColorText').value,
            secondaryColor: document.getElementById('secondaryColorText').value,
            titleColor: document.getElementById('titleColorText').value,
            lineColor: document.getElementById('lineColorText').value,
            linkColor: document.getElementById('linkColorText').value
        },
        signer: {
            name: document.getElementById('signerName').value,
            position: document.getElementById('signerPosition').value,
            company: document.getElementById('signerCompany').value,
            location: document.getElementById('signerLocation').value,
            dateAuto: document.getElementById('signerDateAuto').checked,
            dateManual: document.getElementById('signerDateManual').value,
            showContact: document.getElementById('showSignerContact').checked,
            email: document.getElementById('signerEmail').value,
            phone: document.getElementById('signerPhone').value,
            idNumber: document.getElementById('signerIdNumber').value
        },
        pdfSettings: {
            fontSize: parseInt(document.getElementById('pdfFontSize').value),
            margin: parseInt(document.getElementById('pdfMargin').value),
            showCoverPage: document.getElementById('showCoverPage').checked,
            showCoverDate: document.getElementById('showCoverDate').checked,
            coverDateAuto: document.getElementById('coverDateAuto').checked,
            coverDateManual: document.getElementById('coverDateManual').value,
            coverTitle: document.getElementById('coverTitle').value,
            coverDescription: document.getElementById('coverDescription').value,
            showPublishDate: document.getElementById('showPublishDate').checked,
            showLastPage: document.getElementById('showLastPage').checked,
            lastPageUseCoverLogo: document.getElementById('lastPageUseCoverLogo').checked,
            showSignerData: document.getElementById('showSignerData').checked,
            showSignatureOnAllPages: document.getElementById('showSignatureOnAllPages').checked,
            legalRepName: document.getElementById('legalRepName').value,
            showDigitalSignatureOnAllPages: document.getElementById('showDigitalSignatureOnAllPages').checked,
            allPagesUseLastPageSignature: document.getElementById('allPagesUseLastPageSignature').checked
        }
    };
}

// =====================================================
// Profile Management Event Handlers
// =====================================================

function setupProfileManagement() {
    // Profile selector change - with bug fix for validation
    document.getElementById('profileSelect').addEventListener('change', async (e) => {
        const newProfileId = e.target.value;
        const previousProfileId = currentProfileId;

        // Save current profile first
        await saveCurrentProfile();

        // Try to switch profile
        const result = await window.electronAPI.setActiveProfile(newProfileId);

        if (result && result.success) {
            currentProfileId = newProfileId;
            await loadCurrentProfile();
            updateProfileColorIndicator();
            updateResetButtonVisibility();
        } else {
            // Revert dropdown on failure
            e.target.value = previousProfileId;
            showToast('Error al cambiar perfil', true);
        }
    });

    // New profile button
    document.getElementById('newProfileBtn').addEventListener('click', () => {
        document.getElementById('newProfileName').value = '';
        document.getElementById('newProfileDescription').value = '';
        document.getElementById('newProfileModal').classList.add('active');
        document.getElementById('newProfileName').focus();
    });

    // Cancel new profile
    document.getElementById('cancelNewProfileBtn').addEventListener('click', () => {
        document.getElementById('newProfileModal').classList.remove('active');
    });

    // Confirm new profile
    document.getElementById('confirmNewProfileBtn').addEventListener('click', async () => {
        const name = document.getElementById('newProfileName').value.trim();
        const description = document.getElementById('newProfileDescription').value.trim();

        if (!name) {
            showToast('El nombre del perfil es requerido', true);
            return;
        }

        const result = await window.electronAPI.createProfile({ name, description });

        if (result.success) {
            document.getElementById('newProfileModal').classList.remove('active');
            currentProfileId = result.profile.id;
            await window.electronAPI.setActiveProfile(currentProfileId);
            await loadProfilesList();
            await loadCurrentProfile();
            showToast('Perfil creado exitosamente');
        } else {
            showToast('Error al crear perfil: ' + result.error, true);
        }
    });

    // Duplicate profile button
    document.getElementById('duplicateProfileBtn').addEventListener('click', () => {
        const currentName = document.getElementById('profileName').value;
        document.getElementById('duplicateProfileName').value = `Copia de ${currentName}`;
        document.getElementById('duplicateProfileModal').classList.add('active');
        document.getElementById('duplicateProfileName').focus();
    });

    // Cancel duplicate profile
    document.getElementById('cancelDuplicateProfileBtn').addEventListener('click', () => {
        document.getElementById('duplicateProfileModal').classList.remove('active');
    });

    // Confirm duplicate profile
    document.getElementById('confirmDuplicateProfileBtn').addEventListener('click', async () => {
        const newName = document.getElementById('duplicateProfileName').value.trim();

        if (!newName) {
            showToast('El nombre del perfil es requerido', true);
            return;
        }

        const result = await window.electronAPI.duplicateProfile(currentProfileId, newName);

        if (result.success) {
            document.getElementById('duplicateProfileModal').classList.remove('active');
            currentProfileId = result.profile.id;
            await window.electronAPI.setActiveProfile(currentProfileId);
            await loadProfilesList();
            await loadCurrentProfile();
            showToast('Perfil duplicado exitosamente');
        } else {
            showToast('Error al duplicar perfil: ' + result.error, true);
        }
    });

    // Reset default profile button
    document.getElementById('resetDefaultBtn')?.addEventListener('click', async () => {
        if (currentProfileId !== 'default') return;

        const confirmed = confirm('¿Restablecer el perfil Default a sus valores de fábrica? Se eliminarán logos y firmas.');
        if (!confirmed) return;

        const result = await window.electronAPI.resetDefaultProfile();

        if (result.success) {
            await loadCurrentProfile();
            showToast('Perfil restablecido');
        } else {
            showToast('Error: ' + result.error, true);
        }
    });

    // Delete profile button
    document.getElementById('deleteProfileBtn').addEventListener('click', async () => {
        if (currentProfileId === 'default') {
            showToast('No se puede eliminar el perfil por defecto', true);
            return;
        }

        const confirmed = confirm(`¿Está seguro de eliminar el perfil "${currentProfile.name}"?`);
        if (!confirmed) return;

        const result = await window.electronAPI.deleteProfile(currentProfileId);

        if (result.success) {
            currentProfileId = 'default';
            await loadProfilesList();
            await loadCurrentProfile();
            showToast('Perfil eliminado');
        } else {
            showToast('Error al eliminar perfil: ' + result.error, true);
        }
    });

    // Export profile button
    document.getElementById('exportProfileBtn').addEventListener('click', async () => {
        const result = await window.electronAPI.exportProfile(currentProfileId);

        if (result.success) {
            showToast('Perfil exportado exitosamente');
        } else if (!result.cancelled) {
            showToast('Error al exportar perfil: ' + result.error, true);
        }
    });

    // Import profile button
    document.getElementById('importProfileBtn').addEventListener('click', async () => {
        const result = await window.electronAPI.importProfile();

        if (result.success) {
            currentProfileId = result.profile.id;
            await window.electronAPI.setActiveProfile(currentProfileId);
            await loadProfilesList();
            await loadCurrentProfile();
            showToast('Perfil importado exitosamente');
        } else if (!result.cancelled) {
            showToast('Error al importar perfil: ' + result.error, true);
        }
    });

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('newProfileModal').classList.remove('active');
            document.getElementById('duplicateProfileModal').classList.remove('active');
        }
    });

    // Close modals on background click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
}

// =====================================================
// Color Picker Functions
// =====================================================

function setupColorPickers() {
    const colorFields = ['primaryColor', 'secondaryColor', 'titleColor', 'lineColor', 'linkColor'];

    colorFields.forEach(fieldId => {
        const colorInput = document.getElementById(fieldId);
        const textInput = document.getElementById(fieldId + 'Text');

        // Sync color picker to text
        colorInput.addEventListener('input', () => {
            textInput.value = colorInput.value.toUpperCase();
            if (fieldId === 'primaryColor') {
                updateProfileColorIndicator();
            }
        });

        // Sync text to color picker
        textInput.addEventListener('input', () => {
            let value = textInput.value;
            if (!value.startsWith('#')) {
                value = '#' + value;
            }
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                colorInput.value = value;
                if (fieldId === 'primaryColor') {
                    updateProfileColorIndicator();
                }
            }
        });

        textInput.addEventListener('blur', () => {
            // Normalize on blur
            textInput.value = colorInput.value.toUpperCase();
        });
    });
}

function setColorValue(fieldId, value) {
    document.getElementById(fieldId).value = value;
    document.getElementById(fieldId + 'Text').value = value.toUpperCase();
}

function updateProfileColorIndicator() {
    const indicator = document.getElementById('profileColorIndicator');
    const color = document.getElementById('primaryColorText').value || '#2d2d2d';
    indicator.style.backgroundColor = color;
}

// =====================================================
// Slider Functions
// =====================================================

function setupSliders() {
    const sliders = [
        { id: 'pdfFontSize', valueId: 'pdfFontSizeValue' },
        { id: 'pdfMargin', valueId: 'pdfMarginValue' }
    ];

    sliders.forEach(slider => {
        const element = document.getElementById(slider.id);
        const valueElement = document.getElementById(slider.valueId);

        element.addEventListener('input', (e) => {
            valueElement.textContent = e.target.value;
        });
    });
}

// =====================================================
// Checkbox Functions
// =====================================================

function setupCheckboxes() {
    document.getElementById('showCoverDate').addEventListener('change', (e) => {
        document.getElementById('coverDateOptions').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('showLastPage').addEventListener('change', (e) => {
        document.getElementById('lastPageOptions').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('showSignerData').addEventListener('change', (e) => {
        document.getElementById('signerDataOptions').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('showSignerContact').addEventListener('change', (e) => {
        document.getElementById('signerContactOptions').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('showSignatureOnAllPages').addEventListener('change', (e) => {
        document.getElementById('signatureOnAllPagesOptions').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('showDigitalSignatureOnAllPages').addEventListener('change', (e) => {
        document.getElementById('allPagesSignatureOptions').style.display = e.target.checked ? 'block' : 'none';
    });
}

// =====================================================
// Radio Button Functions
// =====================================================

function setupRadioButtons() {
    // Cover date radios
    document.getElementById('coverDateAuto').addEventListener('change', (e) => {
        if (e.target.checked) {
            document.getElementById('coverDateManualInput').style.display = 'none';
            updateDateWarning();
        }
    });

    document.getElementById('coverDateManualRadio').addEventListener('change', (e) => {
        if (e.target.checked) {
            document.getElementById('coverDateManualInput').style.display = 'block';
            updateDateWarning();
        }
    });

    document.getElementById('coverDateManual').addEventListener('change', () => {
        updateDateWarning();
    });

    // Signer date radios
    document.getElementById('signerDateAuto').addEventListener('change', (e) => {
        if (e.target.checked) {
            document.getElementById('signerDateManualInput').style.display = 'none';
            updateDateWarning();
        }
    });

    document.getElementById('signerDateManualRadio').addEventListener('change', (e) => {
        if (e.target.checked) {
            document.getElementById('signerDateManualInput').style.display = 'block';
            updateDateWarning();
        }
    });

    document.getElementById('signerDateManual').addEventListener('change', () => {
        updateDateWarning();
    });

    // Last page logo radios
    document.getElementById('lastPageUseCoverLogo').addEventListener('change', (e) => {
        if (e.target.checked) {
            // Nothing to show/hide since logo upload is in Brand tab
        }
    });

    document.getElementById('lastPageUseDifferentLogo').addEventListener('change', (e) => {
        if (e.target.checked) {
            // Nothing to show/hide since logo upload is in Brand tab
        }
    });

    // All pages signature radios
    document.getElementById('allPagesUseLastPageSignature').addEventListener('change', (e) => {
        if (e.target.checked) {
            document.getElementById('allPagesSignatureUpload').style.display = 'none';
        }
    });

    document.getElementById('allPagesUseDifferentSignature').addEventListener('change', (e) => {
        if (e.target.checked) {
            document.getElementById('allPagesSignatureUpload').style.display = 'block';
        }
    });
}

// =====================================================
// Text Input Functions
// =====================================================

function setupTextInputs() {
    // Profile name change should update selector display
    document.getElementById('profileName').addEventListener('input', () => {
        const select = document.getElementById('profileSelect');
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
            selectedOption.textContent = document.getElementById('profileName').value || 'Sin nombre';
        }
    });
}

// =====================================================
// Asset Upload Functions
// =====================================================

function setupAssetUploads() {
    // Cover logo
    setupAssetUpload(
        'selectLogoBtn',
        'logoFile',
        'removeLogoBtn',
        'logoPreview',
        'coverLogo'
    );

    // Last page logo
    setupAssetUpload(
        'selectLastPageLogoBtn',
        'lastPageLogoFile',
        'removeLastPageLogoBtn',
        'lastPageLogoPreview',
        'lastPageLogo'
    );

    // Digital signature
    setupAssetUpload(
        'selectDigitalSignatureBtn',
        'digitalSignatureFile',
        'removeDigitalSignatureBtn',
        'digitalSignaturePreview',
        'digitalSignature'
    );

    // All pages signature
    setupAssetUpload(
        'selectAllPagesSignatureBtn',
        'allPagesSignatureFile',
        'removeAllPagesSignatureBtn',
        'allPagesSignaturePreview',
        'allPagesSignature'
    );
}

function setupAssetUpload(selectBtnId, fileInputId, removeBtnId, previewId, assetType) {
    const selectBtn = document.getElementById(selectBtnId);
    const fileInput = document.getElementById(fileInputId);
    const removeBtn = document.getElementById(removeBtnId);

    selectBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64Data = event.target.result;

                    const result = await window.electronAPI.saveProfileAsset({
                        profileId: currentProfileId,
                        assetType: assetType,
                        base64: base64Data,
                        filename: file.name
                    });

                    if (result.success) {
                        showImagePreview(previewId, base64Data, true);
                        removeBtn.style.display = 'inline-block';

                        // Update current profile data
                        if (assetType === 'coverLogo' || assetType === 'lastPageLogo') {
                            if (!currentProfile.logos) currentProfile.logos = {};
                            currentProfile.logos[assetType === 'coverLogo' ? 'coverLogoPath' : 'lastPageLogoPath'] = result.path;
                        } else {
                            if (!currentProfile.signatures) currentProfile.signatures = {};
                            currentProfile.signatures[assetType === 'digitalSignature' ? 'digitalSignaturePath' : 'allPagesSignaturePath'] = result.path;
                        }
                    } else {
                        showToast('Error al guardar: ' + result.error, true);
                    }
                };
                reader.onerror = () => {
                    showToast('Error al leer el archivo', true);
                };
                reader.readAsDataURL(file);
            } catch (error) {
                showToast('Error al procesar el archivo', true);
            }
        }
    });

    removeBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.removeProfileAsset({
            profileId: currentProfileId,
            assetType: assetType
        });

        if (result.success) {
            document.getElementById(previewId).innerHTML = '';
            removeBtn.style.display = 'none';

            // Update current profile data
            if (assetType === 'coverLogo' || assetType === 'lastPageLogo') {
                if (currentProfile.logos) {
                    currentProfile.logos[assetType === 'coverLogo' ? 'coverLogoPath' : 'lastPageLogoPath'] = null;
                }
            } else {
                if (currentProfile.signatures) {
                    currentProfile.signatures[assetType === 'digitalSignature' ? 'digitalSignaturePath' : 'allPagesSignaturePath'] = null;
                }
            }
        } else {
            showToast('Error al eliminar: ' + result.error, true);
        }
    });
}

// =====================================================
// Save Functions
// =====================================================

function setupSaveButton() {
    document.getElementById('saveBtn').addEventListener('click', async () => {
        await saveCurrentProfile();
    });
}

async function saveCurrentProfile() {
    const formData = collectFormData();

    const result = await window.electronAPI.updateProfile(currentProfileId, formData);

    if (result.success) {
        currentProfile = result.profile;

        // Update UI feedback
        const btn = document.getElementById('saveBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Guardado!';
        btn.style.backgroundColor = '#4caf50';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '#4fc3f7';
        }, 2000);

        // Update profile list (in case name changed)
        await loadProfilesList();
    } else {
        showToast('Error al guardar: ' + result.error, true);
    }
}

// =====================================================
// Navigation Functions
// =====================================================

function setupBackButton() {
    document.getElementById('backBtn').addEventListener('click', async () => {
        // Auto-save before leaving
        await saveCurrentProfile();
        window.location.href = 'index.html';
    });
}

// =====================================================
// Utility Functions
// =====================================================

function showImagePreview(previewId, imagePath, isBase64 = false) {
    const preview = document.getElementById(previewId);
    const imageSrc = isBase64 ? imagePath : (imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`);

    const isSignature = previewId.toLowerCase().includes('signature');
    const style = isSignature
        ? 'max-width: 200px; max-height: 100px; border: 1px solid #424242; padding: 10px; background: #ffffff; border-radius: 4px;'
        : 'max-width: 150px; max-height: 150px; border: 1px solid #424242; padding: 10px; background: #1e1e1e; border-radius: 4px;';

    preview.innerHTML = `<img src="${imageSrc}" style="${style}">`;
}

function updateDateWarning() {
    const warningEl = document.getElementById('dateWarning');
    if (!warningEl) return;

    const showCoverDate = document.getElementById('showCoverDate').checked;
    const coverDateAuto = document.getElementById('coverDateAuto').checked;
    const coverDateManual = document.getElementById('coverDateManual').value;

    const signerDateAuto = document.getElementById('signerDateAuto').checked;
    const signerDateManual = document.getElementById('signerDateManual').value;

    // Get cover date
    let coverDate = null;
    if (showCoverDate) {
        if (coverDateAuto) {
            coverDate = new Date().toISOString().split('T')[0];
        } else {
            coverDate = coverDateManual;
        }
    }

    // Get signer date
    let signerDate = null;
    if (signerDateAuto) {
        signerDate = new Date().toISOString().split('T')[0];
    } else {
        signerDate = signerDateManual;
    }

    // Show warning if dates are different
    const showWarning = coverDate && signerDate && coverDate !== signerDate;
    warningEl.style.display = showWarning ? 'block' : 'none';
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
