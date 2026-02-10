// Use electronAPI exposed via preload.js (secure context isolation)
// Note: This module can be used both from preload (Node context) and from renderer (browser context)

// =====================================================
// Searchable Select Component
// =====================================================

class SearchableSelect {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            placeholder: 'Buscar...',
            emptyOption: { value: '', label: 'Todos' },
            maxResults: 50,
            minChars: 0,
            remoteSearch: null, // Function for remote search: async (query) => [{value, label, count}]
            remoteMinChars: 2,  // Minimum chars before remote search
            ...options
        };
        this.items = [];
        this.filteredItems = [];
        this.selectedValue = '';
        this.isOpen = false;
        this.highlightedIndex = -1;
        this.debounceTimer = null;
        this.isLoading = false;

        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="searchable-select">
                <div class="ss-selected" tabindex="0">
                    <span class="ss-selected-text">${this.options.emptyOption.label}</span>
                    <span class="ss-arrow">▼</span>
                </div>
                <div class="ss-dropdown hidden">
                    <input type="text" class="ss-search" placeholder="${this.options.placeholder}">
                    <div class="ss-results"></div>
                </div>
            </div>
        `;

        this.selectedEl = this.container.querySelector('.ss-selected');
        this.selectedTextEl = this.container.querySelector('.ss-selected-text');
        this.dropdownEl = this.container.querySelector('.ss-dropdown');
        this.searchEl = this.container.querySelector('.ss-search');
        this.resultsEl = this.container.querySelector('.ss-results');
    }

    setItems(items) {
        // items = [{ value: '1', label: 'Categoria 1', count: 42 }, ...]
        this.items = items;
        this.filteredItems = items;
        this.renderResults();
    }

    async filter(query) {
        // If remote search is configured and query is long enough
        if (this.options.remoteSearch && query && query.length >= this.options.remoteMinChars) {
            this.isLoading = true;
            this.renderLoading();

            try {
                const results = await this.options.remoteSearch(query);
                this.filteredItems = results;
                this.isLoading = false;
                this.highlightedIndex = -1;
                this.renderResults();
            } catch (e) {
                console.error('Remote search error:', e);
                this.isLoading = false;
                this.filteredItems = [];
                this.renderResults();
            }
            return;
        }

        // Local filtering
        if (!query || query.length < this.options.minChars) {
            this.filteredItems = this.items;
        } else {
            const q = query.toLowerCase();
            this.filteredItems = this.items.filter(item =>
                item.label.toLowerCase().includes(q)
            );
        }
        this.highlightedIndex = -1;
        this.renderResults();
    }

    renderLoading() {
        this.resultsEl.innerHTML = `<div class="ss-no-results">Buscando...</div>`;
    }

    renderResults() {
        const limited = this.filteredItems.slice(0, this.options.maxResults);
        const hasMore = this.filteredItems.length > this.options.maxResults;

        let html = `<div class="ss-option ${this.selectedValue === '' ? 'selected' : ''}"
                        data-value="">${this.options.emptyOption.label}</div>`;

        html += limited.map((item, i) => `
            <div class="ss-option ${this.selectedValue === item.value ? 'selected' : ''}
                        ${this.highlightedIndex === i ? 'highlighted' : ''}"
                 data-value="${item.value}">
                ${this.escapeHtml(item.label)}
                ${item.count !== undefined ? `<span class="ss-count">(${item.count})</span>` : ''}
            </div>
        `).join('');

        if (hasMore) {
            html += `<div class="ss-more">+${this.filteredItems.length - this.options.maxResults} mas...</div>`;
        }

        if (this.filteredItems.length === 0) {
            if (this.options.remoteSearch && (!this.searchEl.value || this.searchEl.value.length < this.options.remoteMinChars)) {
                html = `<div class="ss-no-results">Escribe ${this.options.remoteMinChars}+ caracteres para buscar</div>`;
            } else if (this.searchEl.value) {
                html = `<div class="ss-no-results">Sin resultados</div>`;
            }
        }

        this.resultsEl.innerHTML = html;
    }

    setupEventListeners() {
        // Toggle dropdown
        this.selectedEl.addEventListener('click', () => this.toggle());

        // Search input with debounce
        this.searchEl.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.filter(this.searchEl.value);
            }, 150);
        });

        // Option selection
        this.resultsEl.addEventListener('click', (e) => {
            const option = e.target.closest('.ss-option');
            if (option) {
                this.select(option.dataset.value);
            }
        });

        // Keyboard navigation
        this.searchEl.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.selectedEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
    }

    handleKeydown(e) {
        const visibleOptions = this.filteredItems.slice(0, this.options.maxResults);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.highlightedIndex = Math.min(this.highlightedIndex + 1, visibleOptions.length - 1);
                this.renderResults();
                this.scrollToHighlighted();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
                this.renderResults();
                this.scrollToHighlighted();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.highlightedIndex >= 0) {
                    this.select(visibleOptions[this.highlightedIndex].value);
                } else if (this.highlightedIndex === -1) {
                    this.select('');
                }
                break;
            case 'Escape':
                this.close();
                break;
        }
    }

    scrollToHighlighted() {
        const highlighted = this.resultsEl.querySelector('.ss-option.highlighted');
        if (highlighted) {
            highlighted.scrollIntoView({ block: 'nearest' });
        }
    }

    select(value) {
        this.selectedValue = value;
        const item = this.items.find(i => i.value === value);
        this.selectedTextEl.textContent = item ? item.label : this.options.emptyOption.label;
        this.close();

        // Dispatch change event
        this.container.dispatchEvent(new CustomEvent('change', {
            detail: { value, item }
        }));
    }

    getValue() {
        return this.selectedValue;
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        this.dropdownEl.classList.remove('hidden');
        this.searchEl.value = '';
        this.filter('');
        this.searchEl.focus();
    }

    close() {
        this.isOpen = false;
        this.dropdownEl.classList.add('hidden');
        this.highlightedIndex = -1;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// =====================================================
// ReportifyWP API Service
// =====================================================

class ReportifyWPService {
    constructor(site) {
        this.site = site;
        this.baseUrl = `${site.url.replace(/\/$/, '')}/wp-json/reportifywp/v1`;
    }

    get headers() {
        return {
            'X-ReportifyWP-Key': this.site.apiKey,
            'Content-Type': 'application/json'
        };
    }

    async request(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, value);
            }
        });

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: this.headers
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return await response.json();
    }

    async testConnection() {
        try {
            const status = await this.request('/status');
            return {
                success: true,
                version: status.version,
                totalPosts: status.statistics?.total_posts || 0
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getPostsUrls(options = {}) {
        return await this.request('/posts/urls', {
            post_status: options.postStatus || 'publish',
            per_page: options.perPage || 100,
            page: options.page || 1,
            start_date: options.startDate,
            end_date: options.endDate,
            category: options.category,
            tag: options.tag,
            author: options.author,
            keyword_search: options.keyword
        });
    }

    async getAllPostsUrls(options = {}, onProgress = null) {
        const allUrls = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
            const response = await this.getPostsUrls({
                ...options,
                page: currentPage,
                perPage: 100
            });

            allUrls.push(...response.urls);
            totalPages = response.pagination.total_pages;

            if (onProgress) {
                onProgress({
                    current: currentPage,
                    total: totalPages,
                    urlsLoaded: allUrls.length,
                    totalUrls: response.pagination.total
                });
            }

            currentPage++;
        } while (currentPage <= totalPages);

        return { urls: allUrls, total: allUrls.length };
    }

    async getCategories() {
        return await this.request('/categories');
    }

    async getAuthors() {
        return await this.request('/authors');
    }

    async getTags(limit = 100) {
        // Try to get tags with limit, fallback to search if too many
        try {
            return await this.request('/tags', { per_page: limit });
        } catch (e) {
            // If /tags fails (too many tags), return empty and use search
            console.log('Tags endpoint failed, will use search instead');
            return [];
        }
    }

    async searchTags(query) {
        return await this.request('/tags/search', { q: query });
    }

    async getPostsCount(options = {}) {
        return await this.request('/posts/count', {
            post_status: options.postStatus || 'publish',
            start_date: options.startDate,
            end_date: options.endDate,
            category: options.category,
            author: options.author,
            tag: options.tag,
            keyword_search: options.keyword
        });
    }
}

// =====================================================
// WordPress Integration UI Manager
// =====================================================

class WordPressIntegration {
    constructor(addUrlsCallback, addConsoleMessageCallback, reloadProfilesCallback = null) {
        this.sites = [];
        this.currentSite = null;
        this.editingSiteId = null;
        this.addUrls = addUrlsCallback;
        this.addConsoleMessage = addConsoleMessageCallback;
        this.reloadProfiles = reloadProfilesCallback;
        this.init();
    }

    async init() {
        await this.loadSites();
        this.setupEventListeners();
    }

    async loadSites() {
        this.sites = await window.electronAPI.getWordPressSites() || [];
    }

    setupEventListeners() {
        // Open sites modal
        document.getElementById('importWordPressBtn')?.addEventListener('click', () => {
            this.openSitesModal();
        });

        // Close sites modal
        document.getElementById('closeWpSitesModal')?.addEventListener('click', () => {
            this.closeSitesModal();
        });

        // Add new site
        document.getElementById('addWpSiteBtn')?.addEventListener('click', () => {
            this.openSiteForm();
        });

        // Close site form
        document.getElementById('closeWpSiteForm')?.addEventListener('click', () => {
            this.closeSiteForm();
        });

        // Test connection
        document.getElementById('testWpConnection')?.addEventListener('click', () => {
            this.testConnection();
        });

        // Save site
        document.getElementById('saveWpSite')?.addEventListener('click', () => {
            this.saveSite();
        });

        // Close import modal
        document.getElementById('closeWpImportModal')?.addEventListener('click', () => {
            this.closeImportModal();
        });

        // Cancel import
        document.getElementById('cancelWpImport')?.addEventListener('click', () => {
            this.closeImportModal();
        });

        // Preview count
        document.getElementById('wpPreviewCount')?.addEventListener('click', () => {
            this.previewCount();
        });

        // Start import
        document.getElementById('startWpImport')?.addEventListener('click', () => {
            this.startImport();
        });

        // Close modals on overlay click
        ['wpSitesModal', 'wpSiteFormModal', 'wpImportModal'].forEach(modalId => {
            document.getElementById(modalId)?.addEventListener('click', (e) => {
                if (e.target.id === modalId) {
                    document.getElementById(modalId).classList.remove('active');
                }
            });
        });
    }

    // =====================================================
    // Sites Modal
    // =====================================================

    async openSitesModal() {
        await this.loadSites();
        this.renderSitesList();
        document.getElementById('wpSitesModal').classList.add('active');
    }

    closeSitesModal() {
        document.getElementById('wpSitesModal').classList.remove('active');
    }

    renderSitesList() {
        const container = document.getElementById('wpSitesList');

        if (this.sites.length === 0) {
            container.innerHTML = `
                <div class="wp-empty-state">
                    <span class="wp-empty-icon"><i data-lucide="globe"></i></span>
                    <p>No hay sitios WordPress configurados</p>
                    <p class="wp-empty-hint">Agrega un sitio con ReportifyWP para importar URLs</p>
                </div>
            `;
            // Re-initialize Lucide icons
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        container.innerHTML = this.sites.map(site => `
            <div class="wp-site-card ${site.isConnected ? '' : 'disconnected'}" data-site-id="${site.id}">
                <div class="wp-site-info">
                    <div class="wp-site-name">${this.escapeHtml(site.name)}</div>
                    <div class="wp-site-url">${this.escapeHtml(site.url)}</div>
                    ${site.profileName ? `<div class="wp-site-profile">Perfil: ${this.escapeHtml(site.profileName)}</div>` : ''}
                </div>
                <div class="wp-site-actions">
                    <button class="wp-btn wp-btn-import" data-action="import" data-site-id="${site.id}">
                        <i data-lucide="download"></i> Importar
                    </button>
                    <button class="wp-btn wp-btn-edit" data-action="edit" data-site-id="${site.id}">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="wp-btn wp-btn-delete" data-action="delete" data-site-id="${site.id}">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Re-initialize Lucide icons for dynamic content
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Add event listeners for actions
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const siteId = e.currentTarget.dataset.siteId;
                const site = this.sites.find(s => s.id === siteId);

                if (action === 'import' && site) {
                    this.openImportModal(site);
                } else if (action === 'edit' && site) {
                    this.openSiteForm(site);
                } else if (action === 'delete' && site) {
                    this.deleteSite(siteId);
                }
            });
        });
    }

    // =====================================================
    // Site Form Modal
    // =====================================================

    async openSiteForm(site = null) {
        this.editingSiteId = site?.id || null;

        // Update title
        document.getElementById('wpSiteFormTitle').textContent = site ? 'Editar Sitio WordPress' : 'Agregar Sitio WordPress';

        // Fill form
        document.getElementById('wpSiteId').value = site?.id || '';
        document.getElementById('wpSiteName').value = site?.name || '';
        document.getElementById('wpSiteUrl').value = site?.url || '';
        document.getElementById('wpSiteApiKey').value = site?.apiKey || '';

        // Load profiles
        await this.loadProfilesSelect(site?.profileId);

        // Reset connection status
        document.getElementById('wpConnectionStatus').innerHTML = '';
        document.getElementById('saveWpSite').disabled = !site;

        // Close sites modal and open form
        this.closeSitesModal();
        document.getElementById('wpSiteFormModal').classList.add('active');
    }

    closeSiteForm() {
        document.getElementById('wpSiteFormModal').classList.remove('active');
        this.editingSiteId = null;
    }

    async loadProfilesSelect(selectedProfileId = null) {
        const profiles = await window.electronAPI.getProfilesList();
        const select = document.getElementById('wpSiteProfile');

        select.innerHTML = profiles.map(p =>
            `<option value="${p.id}" ${p.id === selectedProfileId ? 'selected' : ''}>${this.escapeHtml(p.name || 'Sin nombre')}</option>`
        ).join('');
    }

    async testConnection() {
        const url = document.getElementById('wpSiteUrl').value.trim();
        const apiKey = document.getElementById('wpSiteApiKey').value.trim();
        const statusEl = document.getElementById('wpConnectionStatus');
        const saveBtn = document.getElementById('saveWpSite');

        if (!url || !apiKey) {
            statusEl.innerHTML = '<div class="wp-connection-error">Ingresa URL y API Key</div>';
            return;
        }

        statusEl.innerHTML = '<div class="wp-connection-testing">🔄 Probando conexion...</div>';

        const service = new ReportifyWPService({ url, apiKey });
        const result = await service.testConnection();

        if (result.success) {
            statusEl.innerHTML = `
                <div class="wp-connection-success">
                    ✅ Conexion exitosa<br>
                    <small>ReportifyWP v${result.version} - ${result.totalPosts} posts</small>
                </div>
            `;
            saveBtn.disabled = false;
        } else {
            statusEl.innerHTML = `
                <div class="wp-connection-error">
                    ❌ Error: ${result.error}<br>
                    <small>Verifica la URL y la API Key</small>
                </div>
            `;
            saveBtn.disabled = true;
        }
    }

    async saveSite() {
        const id = document.getElementById('wpSiteId').value || crypto.randomUUID();
        const name = document.getElementById('wpSiteName').value.trim();
        const url = document.getElementById('wpSiteUrl').value.trim();
        const apiKey = document.getElementById('wpSiteApiKey').value.trim();
        const profileId = document.getElementById('wpSiteProfile').value;

        if (!name || !url || !apiKey) {
            return;
        }

        // Get profile name for display
        const profiles = await window.electronAPI.getProfilesList();
        const profile = profiles.find(p => p.id === profileId);

        const site = {
            id,
            name,
            url,
            apiKey,
            profileId,
            profileName: profile?.name || '',
            isConnected: true,
            lastSync: new Date().toISOString()
        };

        await window.electronAPI.saveWordPressSite(site);

        this.closeSiteForm();
        await this.loadSites();
        this.openSitesModal();
    }

    async deleteSite(siteId) {
        if (!confirm('¿Eliminar este sitio WordPress?')) {
            return;
        }

        await window.electronAPI.deleteWordPressSite(siteId);
        await this.loadSites();
        this.renderSitesList();
    }

    // =====================================================
    // Import Modal
    // =====================================================

    async openImportModal(site) {
        this.currentSite = site;

        // Check if profile needs to change
        const activeProfileId = await window.electronAPI.getActiveProfileId();
        if (site.profileId && site.profileId !== activeProfileId) {
            await window.electronAPI.setActiveProfile(site.profileId);

            // Get profile name for notification
            const profiles = await window.electronAPI.getProfilesList();
            const profile = profiles.find(p => p.id === site.profileId);

            if (this.addConsoleMessage) {
                this.addConsoleMessage('🎨', `Perfil cambiado a: ${profile?.name || site.profileId}`);
            }

            // Reload profiles to update the UI
            if (this.reloadProfiles) {
                await this.reloadProfiles();
            }
        }

        // Set site name in import modal
        document.getElementById('wpImportSiteName').textContent = `📡 ${site.name}`;

        // Load filters
        await this.loadFilters(site);

        // Reset state
        document.getElementById('wpPostsCount').textContent = '';
        document.getElementById('wpImportProgress').classList.add('hidden');

        // Close sites modal and open import modal
        this.closeSitesModal();
        document.getElementById('wpImportModal').classList.add('active');
    }

    closeImportModal() {
        document.getElementById('wpImportModal').classList.remove('active');
        this.currentSite = null;
    }

    async loadFilters(site) {
        const service = new ReportifyWPService(site);

        // Initialize searchable selects
        this.categorySelect = new SearchableSelect('wpFilterCategoryContainer', {
            placeholder: 'Buscar categoria...',
            emptyOption: { value: '', label: 'Todas las categorias' }
        });

        this.authorSelect = new SearchableSelect('wpFilterAuthorContainer', {
            placeholder: 'Buscar autor...',
            emptyOption: { value: '', label: 'Todos los autores' }
        });

        // Tags use remote search due to high volume (100k+ tags)
        this.tagSelect = new SearchableSelect('wpFilterTagContainer', {
            placeholder: 'Escribe para buscar...',
            emptyOption: { value: '', label: 'Todas las etiquetas' },
            remoteSearch: async (query) => {
                const result = await service.searchTags(query);
                return result.results.map(t => ({
                    value: String(t.id),
                    label: t.name,
                    count: t.count
                }));
            },
            remoteMinChars: 2
        });

        // Load categories
        try {
            const categories = await service.getCategories();
            this.categorySelect.setItems(
                categories.map(c => ({ value: String(c.id), label: c.name, count: c.count }))
            );
        } catch (e) {
            console.error('Error loading categories:', e);
        }

        // Load authors
        try {
            const authors = await service.getAuthors();
            this.authorSelect.setItems(
                authors.map(a => ({ value: String(a.id), label: a.name, count: a.count }))
            );
        } catch (e) {
            console.error('Error loading authors:', e);
        }

        // Tags use remote search - no need to preload
        // The SearchableSelect is already configured with remoteSearch
        console.log('Tags configured for remote search');

        // Reset date filters
        document.getElementById('wpFilterStartDate').value = '';
        document.getElementById('wpFilterEndDate').value = '';
        document.getElementById('wpFilterKeyword').value = '';
        document.getElementById('wpFilterStatus').value = 'publish';
    }

    getFilterOptions() {
        return {
            postStatus: document.getElementById('wpFilterStatus').value,
            category: this.categorySelect?.getValue() || '',
            author: this.authorSelect?.getValue() || '',
            tag: this.tagSelect?.getValue() || '',
            startDate: document.getElementById('wpFilterStartDate').value,
            endDate: document.getElementById('wpFilterEndDate').value,
            keyword: document.getElementById('wpFilterKeyword').value
        };
    }

    async previewCount() {
        if (!this.currentSite) return;

        const countEl = document.getElementById('wpPostsCount');
        countEl.textContent = '🔄 Contando...';

        const service = new ReportifyWPService(this.currentSite);
        const options = this.getFilterOptions();

        try {
            const result = await service.getPostsCount(options);
            countEl.textContent = `📊 ${result.count} posts encontrados`;
        } catch (error) {
            countEl.textContent = `❌ Error: ${error.message}`;
        }
    }

    async startImport() {
        if (!this.currentSite) return;

        const progressContainer = document.getElementById('wpImportProgress');
        const progressFill = progressContainer.querySelector('.progress-fill');
        const progressText = document.getElementById('wpProgressText');

        progressContainer.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = 'Iniciando...';

        const service = new ReportifyWPService(this.currentSite);
        const options = this.getFilterOptions();

        try {
            const result = await service.getAllPostsUrls(options, (progress) => {
                const percent = (progress.current / progress.total) * 100;
                progressFill.style.width = `${percent}%`;
                progressText.textContent = `Cargando pagina ${progress.current}/${progress.total} (${progress.urlsLoaded} URLs)`;
            });

            progressFill.style.width = '100%';
            progressText.textContent = `✅ ${result.total} URLs cargadas`;

            // Add URLs to main textarea
            if (result.urls.length > 0 && this.addUrls) {
                this.addUrls(result.urls);
                if (this.addConsoleMessage) {
                    this.addConsoleMessage('📚', `Importadas ${result.urls.length} URLs desde ${this.currentSite.name}`);
                }
            }

            // Close modal after short delay
            setTimeout(() => {
                this.closeImportModal();
            }, 1000);

        } catch (error) {
            progressText.textContent = `❌ Error: ${error.message}`;
        }
    }

    // =====================================================
    // Utilities
    // =====================================================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in renderer.js
// Support both CommonJS (Node/preload) and browser (window) contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WordPressIntegration, ReportifyWPService };
} else {
    window.WordPressIntegration = WordPressIntegration;
    window.ReportifyWPService = ReportifyWPService;
}
