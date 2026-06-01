// ===================================
// Control Interlogic Module
// ===================================

function getLocalDateString() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const toCents = v => Math.round((parseFloat(v) || 0) * 100);
const fromCents = c => (c / 100).toFixed(2);

const Interlogic = {
    records: [],
    filteredRecords: [],
    loading: false,
    selectedRecords: new Set(),
    filters: {
        search: '',
        startDate: getLocalDateString(),
        endDate: getLocalDateString(),
        guia: [],
        empresa: [],
        fecha: [],
        doc: [],
        cliente: [],
        zona: [],
        vendedor: [],
        condicionPago: [],
        venta: [],
        cobrador: [],
        bultos: [],
        costoEnvio: [],
        costoPorcentaje: [],
        observations: []
    },
    currentSort: {
        field: '',
        direction: '' // 'asc' or 'desc'
    },
    unsubscribe: null,
    columnDefs: [
        { key: 'guia', label: 'Guía' },
        { key: 'empresa', label: 'Empresa' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'doc', label: 'Doc' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'zona', label: 'Zona' },
        { key: 'vendedor', label: 'Vendedor' },
        { key: 'condicionPago', label: 'Condición' },
        { key: 'venta', label: 'Venta' },
        { key: 'bultos', label: 'Bultos' },
        { key: 'cobrador', label: 'Cajas' },
        { key: 'costoEnvio', label: 'Envío' },
        { key: 'costoPorcentaje', label: '% Costo' },
        { key: 'observations', label: 'Observaciones' },
        { key: 'acciones', label: 'Acciones' }
    ],
    hiddenColumns: (() => {
        try { return JSON.parse(localStorage.getItem('il_hidden_cols') || '[]'); } catch (e) { return []; }
    })(),

    // Initialize module and render content
    async render() {
        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }
        return this.renderDesktop();
    },

    // ============= DESKTOP RENDER =============
    async renderDesktop() {
        const contentArea = document.getElementById('content-area');

        // Cleanup previous global listeners to avoid memory leaks
        if (this._desktopAbortController) {
            this._desktopAbortController.abort();
        }
        this._desktopAbortController = new AbortController();
        const { signal } = this._desktopAbortController;

        // Check permissions
        const canCreate = window.permissions?.canCreate;
        const canEdit = window.permissions?.canEdit;
        const canDelete = window.permissions?.canDelete;

        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>📊 Control Interlogic</h1>
                    <p>Gestión automatizada de registros de despacho</p>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <label for="filter-start-date" style="margin-bottom: 0; white-space: nowrap; font-size: 0.85rem;">📅 Desde:</label>
                        <input type="date" id="filter-start-date" value="${this.filters.startDate}" style="padding: 0.5rem; font-size: 1rem; border: 2px solid var(--border-color); border-radius: var(--radius-md); min-height: 44px;">
                        <label for="filter-end-date" style="margin-bottom: 0; white-space: nowrap; font-size: 0.85rem;">Hasta:</label>
                        <input type="date" id="filter-end-date" value="${this.filters.endDate}" style="padding: 0.5rem; font-size: 1rem; border: 2px solid var(--border-color); border-radius: var(--radius-md); min-height: 44px;">
                    </div>
                    <button id="btn-export-excel" class="btn btn-secondary">
                        📥 Exportar Excel
                    </button>
                    <button id="btn-import-excel" class="btn btn-secondary ${!canCreate ? 'btn-disabled' : ''}" ${!canCreate ? 'disabled' : ''}>
                        📤 Importar Excel
                    </button>
                    <button id="btn-clear-all-filters" class="btn btn-secondary" style="display: none;">
                        🧹 Quitar Filtros
                    </button>
                    <div style="position: relative;">
                        <button id="btn-toggle-columns" class="btn btn-secondary">
                            👁️ Columnas
                        </button>
                        <div id="columns-popup" class="filter-popup" style="min-width: 200px; right: 0; top: 100%;" onclick="event.stopPropagation()">
                            <div style="font-weight: 600; font-size: 0.8rem; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--gray-100);">Mostrar/Ocultar Columnas</div>
                            <div class="filter-options-list" style="max-height: 300px;">
                                ${this.columnDefs.filter(c => c.key !== 'acciones').map(col => `
                                    <label class="filter-option-item" style="cursor: pointer;">
                                        <input type="checkbox" ${!this.hiddenColumns.includes(col.key) ? 'checked' : ''}
                                               onchange="Interlogic.toggleColumn('${col.key}', this.checked)">
                                        <span>${col.label}</span>
                                    </label>
                                `).join('')}
                            </div>
                            <div class="filter-popup-footer">
                                <button class="btn btn-secondary" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;" onclick="Interlogic.showAllColumns()">Mostrar Todas</button>
                            </div>
                        </div>
                    </div>
                    <button id="btn-add-record" class="btn btn-primary ${!canCreate ? 'btn-disabled' : ''}" ${!canCreate ? 'disabled' : ''}>
                        ➕ Nuevo Registro
                    </button>
                </div>
            </div>

            <div class="stats-grid" id="interlogic-stats">
                <div class="stat-card">
                    <h3>Total Venta</h3>
                    <p id="stat-total-venta">$0.00</p>
                </div>
                <div class="stat-card">
                    <h3>Total Bultos</h3>
                    <p id="stat-total-bultos">0</p>
                </div>
                <div class="stat-card">
                    <h3>Costo Envío</h3>
                    <p id="stat-total-envio">$0.00</p>
                </div>
                <div class="stat-card">
                    <h3>% Costo</h3>
                    <p id="stat-total-porcentaje">0.00%</p>
                </div>
            </div>

            <div style="margin-bottom: 0.5rem;">
                <input type="text" id="global-search" placeholder="🔍 Buscar en todas las columnas..." 
                       value="${this.filters.search || ''}"
                       style="width: 100%; padding: 0.6rem 1rem; font-size: 0.95rem; border: 2px solid var(--border-color); border-radius: var(--radius-md); font-family: var(--font-family); transition: all 0.25s; background: white;">
            </div>

            <div class="card">
                <div class="table-container">
                    <table class="data-table" id="il-data-table">
                        <thead>
                            <tr>
                                <th style="width: 30px; text-align: center;">
                                    <input type="checkbox" id="select-all-checkbox" title="Seleccionar todos" style="cursor: pointer; width: 16px; height: 16px;">
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'guia')">
                                        Guía <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-guia" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('guia', this.value)">
                                            <div class="filter-options-list" id="filter-options-guia"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'empresa')">
                                        Empresa <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-empresa" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('empresa', this.value)">
                                            <div class="filter-options-list" id="filter-options-empresa"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'fecha')">
                                        Fecha <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-fecha" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('fecha', this.value)">
                                            <div class="filter-options-list" id="filter-options-fecha"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'doc')">
                                        Doc <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-doc" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('doc', this.value)">
                                            <div class="filter-options-list" id="filter-options-doc"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'cliente')">
                                        Cliente <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-cliente" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('cliente', this.value)">
                                            <div class="filter-options-list" id="filter-options-cliente"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'zona')">
                                        Zona <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-zona" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('zona', this.value)">
                                            <div class="filter-options-list" id="filter-options-zona"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'vendedor')">
                                        Vendedor <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-vendedor" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('vendedor', this.value)">
                                            <div class="filter-options-list" id="filter-options-vendedor"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'condicionPago')">
                                        Condición <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-condicionPago" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('condicionPago', this.value)">
                                            <div class="filter-options-list" id="filter-options-condicionPago"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'venta')">
                                        Venta <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-venta" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('venta', this.value)">
                                            <div class="filter-options-list" id="filter-options-venta"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'bultos')">
                                        Bultos <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-bultos" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('bultos', this.value)">
                                            <div class="filter-options-list" id="filter-options-bultos"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'cobrador')">
                                        Cajas <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-cobrador" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('cobrador', this.value)">
                                            <div class="filter-options-list" id="filter-options-cobrador"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'costoEnvio')">
                                        Envío <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-costoEnvio" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('costoEnvio', this.value)">
                                            <div class="filter-options-list" id="filter-options-costoEnvio"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'costoPorcentaje')">
                                        % Costo <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-costoPorcentaje" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..."
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('costoPorcentaje', this.value)">
                                            <div class="filter-options-list" id="filter-options-costoPorcentaje"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'observations')">
                                        Observaciones <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-observations" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..."
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('observations', this.value)">
                                            <div class="filter-options-list" id="filter-options-observations"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="interlogic-table-body">
                            <tr>
                                <td colspan="16" style="text-align: center; padding: 1rem;">Cargando registros...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Load records
        await this.loadRecords();

        // Setup event listeners
        document.getElementById('filter-start-date').addEventListener('change', (e) => {
            this.filters.startDate = e.target.value;
            this.applyFilters();
        });
        document.getElementById('filter-end-date').addEventListener('change', (e) => {
            this.filters.endDate = e.target.value;
            this.applyFilters();
        });
        document.getElementById('btn-add-record').addEventListener('click', () => {
            if (canCreate) this.showForm();
        });
        document.getElementById('btn-import-excel').addEventListener('click', () => {
            if (canCreate) this.showImportExcel();
        });
        document.getElementById('btn-clear-all-filters').addEventListener('click', () => this.clearAllFilters());
        document.getElementById('btn-export-excel').addEventListener('click', () => this.exportToExcel());

        // Global search bar
        document.getElementById('global-search').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.applyFilters();
        });

        // Select-all checkbox
        document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                if (e.target.checked) {
                    this.selectedRecords.add(cb.dataset.id);
                } else {
                    this.selectedRecords.delete(cb.dataset.id);
                }
            });
            this.updateBulkDeleteButton();
        });

        // Row checkboxes (event delegation)
        document.getElementById('interlogic-table-body').addEventListener('change', (e) => {
            if (e.target.classList.contains('row-checkbox')) {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    this.selectedRecords.add(id);
                } else {
                    this.selectedRecords.delete(id);
                }
                // Update select-all state
                const checkboxes = document.querySelectorAll('.row-checkbox');
                const selectAll = document.getElementById('select-all-checkbox');
                selectAll.checked = this.selectedRecords.size >= checkboxes.length && checkboxes.length > 0;
                selectAll.indeterminate = this.selectedRecords.size > 0 && this.selectedRecords.size < checkboxes.length;
                this.updateBulkDeleteButton();
            }
        });

        // Column toggle button
        const colBtn = document.getElementById('btn-toggle-columns');
        const colPopup = document.getElementById('columns-popup');
        colBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            colPopup.classList.toggle('show');
        });
        document.addEventListener('click', (e) => {
            if (colPopup.classList.contains('show') && !colPopup.contains(e.target) && e.target !== colBtn) {
                colPopup.classList.remove('show');
            }
        }, { signal });

        // Apply saved column visibility
        this.applyColumnVisibility();

        // Close filters when clicking outside (but not when drag-selecting)
        let mouseDownInsideFilter = false;
        document.addEventListener('mousedown', (e) => {
            mouseDownInsideFilter = !!e.target.closest('.filter-header') || !!e.target.closest('.filter-popup');
        }, { signal });
        document.addEventListener('click', (e) => {
            const clickedInsideFilter = e.target.closest('.filter-header') || e.target.closest('.filter-popup');
            if (!clickedInsideFilter && !mouseDownInsideFilter) {
                document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
            }
        }, { signal });

        // Event delegation for edit and delete buttons (one-time setup if not already done)
        if (!this.eventDelegationSetup) {
            contentArea.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.btn-edit-record');
                if (editBtn && !editBtn.disabled) {
                    const id = editBtn.getAttribute('data-id');
                    if (id) this.showForm(id);
                    return;
                }

                const deleteBtn = e.target.closest('.btn-delete-record');
                if (deleteBtn && !deleteBtn.disabled) {
                    const id = deleteBtn.getAttribute('data-id');
                    if (id) this.deleteRecord(id);
                    return;
                }

                const dupBtn = e.target.closest('.btn-duplicate-record');
                if (dupBtn && !dupBtn.disabled) {
                    const id = dupBtn.getAttribute('data-id');
                    if (id) this.duplicateRecord(id);
                    return;
                }
            });
            this.eventDelegationSetup = true;
        }
    },

    // ============= MOBILE RENDER =============
    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        this.isMobile = true;

        contentArea.innerHTML = `
            <div style="padding: 0 0 8px 0;">
                <h1 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 2px; color: var(--m-text);">📊 Interlogic</h1>
                <p style="font-size: 0.78rem; color: var(--m-text-secondary);">Gestión de registros</p>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                <input type="date" id="m-filter-start" value="${this.filters.startDate}" style="flex:1; padding: 10px; border: 1px solid #e5e5ea; border-radius: 12px; font-size: 0.85rem; font-family: var(--font-family); background: white; min-height: 42px;">
                <input type="date" id="m-filter-end" value="${this.filters.endDate}" style="flex:1; padding: 10px; border: 1px solid #e5e5ea; border-radius: 12px; font-size: 0.85rem; font-family: var(--font-family); background: white; min-height: 42px;">
            </div>

            <div class="m-search-bar">
                <span class="search-icon-m">🔍</span>
                <input type="text" id="m-global-search" placeholder="Buscar por guía, cliente, zona..." value="${this.filters.search || ''}">
            </div>

            <div class="m-stats-row" id="m-stats">
                <div class="m-stat-chip"><div class="m-stat-chip-label">Venta</div><div class="m-stat-chip-value" id="ms-venta">$0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Bultos</div><div class="m-stat-chip-value" id="ms-bultos">0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Costo Envío</div><div class="m-stat-chip-value" id="ms-envio">$0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">% Costo</div><div class="m-stat-chip-value" id="ms-pct">0%</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Registros</div><div class="m-stat-chip-value" id="ms-count">0</div></div>
            </div>

            <div class="m-actions-bar">
                <button class="btn" id="m-btn-filter" style="border-radius:20px;">🔽 Filtrar</button>
                <button class="btn btn-primary" id="m-btn-add" style="border-radius:20px;">➕ Nuevo</button>
                <button class="btn" id="m-btn-export" style="border-radius:20px;">📥 Excel</button>
            </div>

            <div class="m-data-list" id="m-data-list">
                <div style="text-align:center;padding:40px;color:#8e8e93;">Cargando registros...</div>
            </div>
        `;

        await this.loadRecords();

        document.getElementById('m-filter-start').addEventListener('change', e => { this.filters.startDate = e.target.value; this.applyFilters(); });
        document.getElementById('m-filter-end').addEventListener('change', e => { this.filters.endDate = e.target.value; this.applyFilters(); });
        document.getElementById('m-global-search').addEventListener('input', e => { this.filters.search = e.target.value; this.applyFilters(); });
        document.getElementById('m-btn-add').addEventListener('click', () => this.showMobileForm());
        document.getElementById('m-btn-export').addEventListener('click', () => this.mobileExportExcel());
        document.getElementById('m-btn-filter').addEventListener('click', () => this.showMobileFilters());
    },

    showMobileFilters() {
        const fields = [
            { key: 'empresa', label: 'Empresa', options: this.getDistinctValues('empresa') },
            { key: 'condicionPago', label: 'Condición', options: this.getDistinctValues('condicionPago') },
            { key: 'zona', label: 'Zona', options: this.getDistinctValues('zona') },
            { key: 'vendedor', label: 'Vendedor', options: this.getDistinctValues('vendedor') },
            { key: 'cobrador', label: 'Cobrador', options: this.getDistinctValues('cobrador') },
        ];

        let body = '';
        fields.forEach(f => {
            if (!f.options.length) return;
            body += '<div style="margin-bottom:16px;"><div style="font-weight:700;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#8e8e93;margin-bottom:8px;">' + f.label + '</div><div class="m-filter-list">';
            f.options.forEach(v => {
                const isActive = this.filters[f.key]?.includes(String(v));
                body += '<label class="m-filter-item"><input type="checkbox" value="' + v + '" ' + (isActive ? 'checked' : '') + ' onchange="Interlogic.toggleMobileFilter(\'' + f.key + '\',\'' + String(v).replace(/'/g,"\\'") + '\', this.checked)"><span>' + (v || '(vacío)') + '</span></label>';
            });
            body += '</div></div>';
        });

        const sheet = document.createElement('div');
        sheet.innerHTML = '<div class="m-sheet-backdrop show" onclick="this.nextElementSibling.remove();this.remove();"></div><div class="m-bottom-sheet show"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">Filtros</span><button class="m-sheet-close" onclick="this.closest(\'.m-bottom-sheet\').remove();document.querySelector(\'.m-sheet-backdrop\').remove();">✕</button></div><div class="m-sheet-body">' + body + '</div><div class="m-sheet-footer"><button class="btn" onclick="Interlogic.clearAllFilters();document.querySelectorAll(\'.m-bottom-sheet,.m-sheet-backdrop\').forEach(function(e){e.remove();});">Limpiar filtros</button><button class="btn btn-primary" onclick="document.querySelectorAll(\'.m-bottom-sheet,.m-sheet-backdrop\').forEach(function(e){e.remove();});">Aplicar</button></div></div>';
        document.body.appendChild(sheet);
    },

    toggleMobileFilter(field, value, checked) {
        if (!this.filters[field]) this.filters[field] = [];
        if (checked) {
            if (!this.filters[field].includes(value)) this.filters[field].push(value);
        } else {
            this.filters[field] = this.filters[field].filter(function(v) { return v !== value; });
        }
        this.applyFilters();
    },

    getDistinctValues(field) {
        var valuesSet = {};
        this.records.forEach(function(r) {
            var v = r[field];
            if (v !== undefined && v !== null && v !== '') valuesSet[String(v)] = true;
        });
        return Object.keys(valuesSet).sort();
    },

    renderMobileCards() {
        var list = document.getElementById('m-data-list');
        if (!list) return;

        var self = this;
        var canEdit = window.permissions?.canEdit;
        var canDelete = window.permissions?.canDelete;

        if (this.filteredRecords.length === 0) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📭</div><div class="m-empty-title">Sin registros</div><div class="m-empty-text">No se encontraron resultados.</div></div>';
        } else {
            list.innerHTML = this.filteredRecords.map(function(r) {
                var empresaBadge = r.doc === 'NC' ? 'nc' : (r.empresa === 'DALSE' ? 'primary' : (r.empresa ? 'warning' : ''));
                var idJs = r.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                var html = '<div class="m-data-card" onclick="Interlogic.showMobileDetail(\'' + idJs + '\')">';
                html += '<div class="m-card-header"><span class="m-card-title">#' + sanitizeHTML(r.guia || r.id.substring(0,6).toUpperCase()) + '</span>';
                if (r.doc === 'NC') html += '<span class="m-card-badge badge-nc">NC</span>';
                else if (empresaBadge) html += '<span class="m-card-badge ' + empresaBadge + '">' + sanitizeHTML(r.empresa || '') + '</span>';
                html += '</div><div class="m-card-rows">';
                html += '<div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value">' + sanitizeHTML(r.cliente || '-') + '</span></div>';
                html += '<div class="m-card-row"><span class="m-card-label">Venta</span><span class="m-card-value money">$' + formatNumber(r.venta || 0, 2) + '</span></div>';
                html += '<div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">' + (r.fecha ? formatDateShort(r.fecha) : '-') + '</span></div>';
                html += '<div class="m-card-row"><span class="m-card-label">Bultos</span><span class="m-card-value">' + formatNumber(r.bultos || 0) + '</span></div>';
                html += '</div>';
                if (canEdit || canDelete) {
                    html += '<div class="m-card-actions" onclick="event.stopPropagation()">';
                    if (canEdit) html += '<button class="m-card-action" onclick="Interlogic.showMobileForm(\'' + idJs + '\')" title="Editar">✏️</button><button class="m-card-action" onclick="Interlogic.duplicateRecord(\'' + idJs + '\')" title="Duplicar">📋</button>';
                    if (canDelete) html += '<button class="m-card-action delete" onclick="Interlogic.deleteRecord(\'' + idJs + '\')" title="Eliminar">🗑️</button>';
                    html += '</div>';
                }
                html += '</div>';
                return html;
            }).join('');
        }

        var totals = this.filteredRecords.reduce(function(acc, r) {
            if (r.doc !== 'NC') {
                acc.venta += parseFloat(r.venta) || 0;
                acc.bultos += parseFloat(r.bultos) || 0;
                acc.envio += parseFloat(r.costoEnvio) || 0;
            }
            return acc;
        }, { venta: 0, bultos: 0, envio: 0 });
        var totalVenta = totals.venta;
        var totalBultos = totals.bultos;
        var totalEnvio = totals.envio;
        var totalPct = totalVenta > 0 ? ((totalEnvio / totalVenta) * 100) : 0;

        var setText = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
        setText('ms-venta', '$' + formatNumber(totalVenta, 0));
        setText('ms-bultos', formatNumber(totalBultos));
        setText('ms-envio', '$' + formatNumber(totalEnvio, 0));
        setText('ms-pct', formatNumber(totalPct, 2) + '%');
        setText('ms-count', this.filteredRecords.length);
    },

    showMobileDetail(id) {
        var r = this.filteredRecords.find(function(x) { return x.id === id; }) || this.records.find(function(x) { return x.id === id; });
        if (!r) return;

        var sheet = document.createElement('div');
        sheet.innerHTML = '<div class="m-sheet-backdrop show" onclick="this.nextElementSibling.remove();this.remove();"></div><div class="m-bottom-sheet show"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">#' + sanitizeHTML(r.guia || 'Detalle') + '</span><button class="m-sheet-close" onclick="this.closest(\'.m-bottom-sheet\').remove();document.querySelector(\'.m-sheet-backdrop\').remove();">✕</button></div><div class="m-sheet-body"><div style="display:flex;flex-direction:column;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Empresa</span><div style="font-weight:500;">' + sanitizeHTML(r.empresa || '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Cliente</span><div style="font-weight:500;">' + sanitizeHTML(r.cliente || '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Dirección</span><div style="font-weight:500;">' + sanitizeHTML(r.direccion || '-') + '</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Fecha</span><div style="font-weight:500;">' + (r.fecha ? formatDateShort(r.fecha) : '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Doc</span><div style="font-weight:500;">' + sanitizeHTML(r.doc || '') + (r.docNum ? ' #' + sanitizeHTML(r.docNum) : '') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Venta</span><div style="font-weight:700;color:#10b981;font-size:1.1rem;">$' + formatNumber(r.venta || 0, 2) + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Bultos</span><div style="font-weight:500;">' + formatNumber(r.bultos || 0) + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Zona</span><div style="font-weight:500;">' + sanitizeHTML(r.zona || '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Vendedor</span><div style="font-weight:500;">' + sanitizeHTML(r.vendedor || '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Cond. Pago</span><div style="font-weight:500;">' + (r.condicionPago || '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Cobrador</span><div style="font-weight:500;">' + sanitizeHTML(r.cobrador || '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Costo Envío</span><div style="font-weight:500;">$' + formatNumber(r.costoEnvio || 0, 2) + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">% Costo</span><div style="font-weight:500;">' + formatNumber(r.costoPorcentaje || 0, 2) + '%</div></div></div>' + (r.observations ? '<div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Observaciones</span><div style="font-weight:500;background:#f2f2f7;padding:10px;border-radius:10px;margin-top:4px;">' + sanitizeHTML(r.observations) + '</div></div>' : '') + '</div></div><div class="m-sheet-footer"><button class="m-card-action" onclick="var s=document.querySelector(\'.m-bottom-sheet\');var b=document.querySelector(\'.m-sheet-backdrop\');s.remove();b.remove();Interlogic.showMobileForm(\'' + r.id + '\')">✏️ Editar</button><button class="m-card-action delete" onclick="var s=document.querySelector(\'.m-bottom-sheet\');var b=document.querySelector(\'.m-sheet-backdrop\');s.remove();b.remove();Interlogic.deleteRecord(\'' + r.id + '\')">🗑️ Eliminar</button></div></div>';
        document.body.appendChild(sheet);
    },

    showMobileForm(id) {
        var record = id ? (this.filteredRecords.find(function(x) { return x.id === id; }) || this.records.find(function(x) { return x.id === id; })) : null;
        var isEdit = !!record;
        var self = this;

        var sheet = document.createElement('div');
        sheet.innerHTML = '<div class="m-sheet-backdrop show" id="m-form-backdrop"></div><div class="m-bottom-sheet show" id="m-form-sheet"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">' + (isEdit ? 'Editar Registro' : 'Nuevo Registro') + '</span><button class="m-sheet-close" onclick="document.getElementById(\'m-form-sheet\').remove();document.getElementById(\'m-form-backdrop\').remove();">✕</button></div><div class="m-sheet-body"><div class="m-form-group"><label>Guía</label><input type="text" id="mf-guia" value="' + sanitizeHTML(record?.guia || '').replace(/"/g, '&quot;') + '"></div><div class="m-form-row"><div class="m-form-group"><label>Empresa</label><select id="mf-empresa"><option value="DALSE"' + (record?.empresa === 'DALSE' ? ' selected' : '') + '>DALSE</option><option value="Interlogic"' + (record?.empresa === 'Interlogic' ? ' selected' : '') + '>Interlogic</option><option value="Cargo Express"' + (record?.empresa === 'Cargo Express' ? ' selected' : '') + '>Cargo Express</option></select></div><div class="m-form-group"><label>Fecha</label><input type="date" id="mf-fecha" value="' + (record?.fecha ? (typeof record.fecha === 'string' ? record.fecha.split('T')[0] : formatDateForInput(record.fecha)) : new Date().toISOString().split('T')[0]) + '"></div></div><div class="m-form-row"><div class="m-form-group"><label>Doc</label><select id="mf-doc"><option value="CCF"' + (record?.doc === 'CCF' ? ' selected' : '') + '>CCF</option><option value="Factura"' + (record?.doc === 'Factura' ? ' selected' : '') + '>Factura</option><option value="Ticket"' + (record?.doc === 'Ticket' ? ' selected' : '') + '>Ticket</option><option value="NC"' + (record?.doc === 'NC' ? ' selected' : '') + '>NC</option></select></div><div class="m-form-group"><label>N° Doc</label><input type="text" id="mf-docNum" value="' + sanitizeHTML(record?.docNum || '').replace(/"/g, '&quot;') + '"></div></div><div class="m-form-group"><label>Cliente</label><input type="text" id="mf-cliente" value="' + sanitizeHTML(record?.cliente || '').replace(/"/g, '&quot;') + '"></div><div class="m-form-group"><label>Dirección</label><input type="text" id="mf-direccion" value="' + (record?.direccion || '') + '"></div><div id="mf-nc-fields" style="display:none;padding:10px;background:#fffbeb;border-radius:12px;margin-bottom:12px;border:1px solid #f59e0b;"><div style="font-weight:700;font-size:0.8rem;margin-bottom:8px;color:#92400e;">Opciones de Nota de Credito</div><div class="m-form-group"><label>Afecta saldo de CCF/FT</label><select id="mf-nc-afectaSaldo"><option value="no">No - NC general</option><option value="si">Si - Descontar de un CCF/FT</option></select></div><div id="mf-nc-ccf-group" style="display:none;margin-top:8px;"><div class="m-form-group"><label>Seleccionar CCF/FT</label><select id="mf-nc-interlogicId"><option value="">-- Seleccionar --</option></select></div></div></div><div class="m-form-row"><div class="m-form-group"><label>Zona</label><input type="text" id="mf-zona" value="' + (record?.zona || '') + '"></div><div class="m-form-group"><label>Vendedor</label><input type="text" id="mf-vendedor" value="' + (record?.vendedor || '') + '"></div></div><div class="m-form-row"><div class="m-form-group"><label>Cond. Pago</label><select id="mf-condicionPago"><option value="Contado"' + (record?.condicionPago === 'Contado' ? ' selected' : '') + '>Contado</option><option value="Crédito"' + (record?.condicionPago === 'Crédito' ? ' selected' : '') + '>Crédito</option></select></div><div class="m-form-group"><label>Cajas</label><input type="number" id="mf-cobrador" value="' + (record?.cobrador || '') + '"></div></div><div class="m-form-row"><div class="m-form-group"><label>Venta ($)</label><input type="number" step="0.01" id="mf-venta" value="' + (record?.venta || '') + '"></div><div class="m-form-group"><label>Bultos</label><input type="number" id="mf-bultos" value="' + (record?.bultos || '') + '"></div></div><div class="m-form-row"><div class="m-form-group"><label>Costo Envío ($)</label><input type="number" step="0.01" id="mf-costoEnvio" value="' + (record?.costoEnvio || '') + '"></div><div class="m-form-group"><label>% Costo</label><input type="number" step="0.01" id="mf-costoPorcentaje" value="' + (record?.costoPorcentaje || '') + '"></div></div><div class="m-form-group"><label>Observaciones</label><textarea id="mf-observations" rows="3">' + (record?.observations || '') + '</textarea></div></div><div class="m-sheet-footer"><button class="btn" onclick="document.getElementById(\'m-form-sheet\').remove();document.getElementById(\'m-form-backdrop\').remove();">Cancelar</button><button class="btn btn-primary" id="mf-submit">' + (isEdit ? 'Guardar Cambios' : 'Crear Registro') + '</button></div></div>';
        document.body.appendChild(sheet);

        // NC toggle for mobile
        var mfDoc = document.getElementById('mf-doc');
        var mfNcFields = document.getElementById('mf-nc-fields');
        var mfNcAfecta = document.getElementById('mf-nc-afectaSaldo');
        var mfNcCcfGroup = document.getElementById('mf-nc-ccf-group');
        var mfNcInterlogicId = document.getElementById('mf-nc-interlogicId');
        var mfToggleNC = function() {
            var isNC = mfDoc.value === 'NC';
            if (mfNcFields) mfNcFields.style.display = isNC ? 'block' : 'none';
        };
        mfDoc.addEventListener('change', mfToggleNC);
        mfToggleNC();

        if (mfNcAfecta) {
            mfNcAfecta.addEventListener('change', function() {
                var afecta = mfNcAfecta.value === 'si';
                if (mfNcCcfGroup) mfNcCcfGroup.style.display = afecta ? 'block' : 'none';
                if (afecta) mfPopulateCCFList();
            });
        }

        // Mobile CCF list population
        var mfPopulateCCFList = function() {
            if (!mfNcInterlogicId) return;
            mfNcInterlogicId.innerHTML = '<option value="">-- Seleccionar CCF/FT --</option>';
            var clienteActual = document.getElementById('mf-cliente').value.trim();
            if (!clienteActual) {
                mfNcInterlogicId.innerHTML = '<option value="">-- Primero ingresa el cliente --</option>';
                return;
            }
            var clienteLower = clienteActual.toLowerCase();
            var ccfRecords = self.records.filter(function(r) {
                return (r.doc === 'CCF' || r.doc === 'FT') && (r.cliente || '').toLowerCase().includes(clienteLower);
            });
            if (ccfRecords.length === 0) {
                mfNcInterlogicId.innerHTML = '<option value="">-- No hay CCF/FT para este cliente --</option>';
                return;
            }
            ccfRecords.forEach(function(r) {
                var estado = r.estadoCobro === 'pagado' ? 'Pagado' : (r.estadoCobro === 'parcial' ? 'Parcial' : 'Pendiente');
                var opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = (r.doc || '') + ' #' + (r.docNum || r.guia || '') + ' - $' + formatNumber(r.venta || 0, 2) + ' (' + estado + ')';
                mfNcInterlogicId.appendChild(opt);
            });
        };

        // Repopulate when client changes
        var mfClienteInput = document.getElementById('mf-cliente');
        if (mfClienteInput) {
            mfClienteInput.addEventListener('change', function() {
                if (mfDoc.value === 'NC' && mfNcAfecta && mfNcAfecta.value === 'si') {
                    mfPopulateCCFList();
                }
            });
        }

        document.getElementById('mf-submit').addEventListener('click', async function() {
            var btn = document.getElementById('mf-submit');
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            var data = {
                guia: document.getElementById('mf-guia').value,
                empresa: document.getElementById('mf-empresa').value,
                fecha: document.getElementById('mf-fecha').value,
                doc: document.getElementById('mf-doc').value,
                docNum: document.getElementById('mf-docNum').value,
                cliente: document.getElementById('mf-cliente').value,
                direccion: document.getElementById('mf-direccion').value,
                zona: document.getElementById('mf-zona').value,
                vendedor: document.getElementById('mf-vendedor').value,
                condicionPago: document.getElementById('mf-condicionPago').value,
                cobrador: document.getElementById('mf-cobrador').value,
                venta: parseFloat(document.getElementById('mf-venta').value) || 0,
                bultos: parseInt(document.getElementById('mf-bultos').value) || 0,
                costoEnvio: parseFloat(document.getElementById('mf-costoEnvio').value) || 0,
                costoPorcentaje: parseFloat(document.getElementById('mf-costoPorcentaje').value) || 0,
                observations: document.getElementById('mf-observations').value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                var isNC = data.doc === 'NC';

                if (isNC) {
                    var ncAfectaVal = document.getElementById('mf-nc-afectaSaldo') ? document.getElementById('mf-nc-afectaSaldo').value : 'no';
                    var ncInterlogicIdVal = document.getElementById('mf-nc-interlogicId') ? document.getElementById('mf-nc-interlogicId').value : '';

                    var ncData = {
                        ncNum: data.docNum,
                        cliente: data.cliente,
                        monto: data.venta,
                        motivo: data.observations,
                        fecha: data.fecha,
                        empresa: data.empresa,
                        interlogicId: ncInterlogicIdVal || '',
                        guia: data.guia || '',
                        docRef: ncInterlogicIdVal ? (data.doc + ' #' + data.docNum) : '',
                        afectaSaldo: ncAfectaVal === 'si',
                        estado: 'activa',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdBy: firebase.auth().currentUser.uid
                    };

                    // Also save to interlogic so it appears in the table
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    data.createdBy = firebase.auth().currentUser.uid;

                    if (ncAfectaVal === 'si' && ncInterlogicIdVal) {
                        var db = firebase.firestore();
                        var batch = db.batch();
                        batch.set(db.collection('notasCredito').doc(), ncData);
                        batch.set(db.collection('interlogic').doc(), data);
                        var ccfData = this.records.find(function(r) { return r.id === ncInterlogicIdVal; });
                        if (ccfData) {
                            var cobradoActualCents = toCents(ccfData.montoCobrado || (ccfData.cobrado === true ? ccfData.venta : 0));
                            var ventaCCFCents = toCents(ccfData.venta || 0);
                            var dataVentaCents = toCents(data.venta);
                            var nuevoCobradoCents = cobradoActualCents + dataVentaCents;
                            var nuevoPendienteCents = Math.max(0, ventaCCFCents - nuevoCobradoCents);
                            var nuevoCobrado = nuevoCobradoCents / 100;
                            var nuevoPendiente = nuevoPendienteCents / 100;
                            var nuevoEstado = nuevoCobradoCents >= ventaCCFCents ? 'pagado' : (nuevoCobradoCents > 0 ? 'parcial' : 'pendiente');
                            batch.update(db.collection('interlogic').doc(ncInterlogicIdVal), {
                                montoCobrado: nuevoCobrado,
                                montoPendiente: nuevoPendiente,
                                estadoCobro: nuevoEstado,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        }
                        await batch.commit();
                        showToast('Nota de Credito creada y saldo actualizado', 'success');
                    } else {
                        var db2 = firebase.firestore();
                        var batch2 = db2.batch();
                        batch2.set(db2.collection('notasCredito').doc(), ncData);
                        batch2.set(db2.collection('interlogic').doc(), data);
                        await batch2.commit();
                        showToast('Nota de Credito creada', 'success');
                    }
                } else if (isEdit) {
                    await firebase.firestore().collection('interlogic').doc(id).update(data);
                    showToast('Registro actualizado', 'success');
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await firebase.firestore().collection('interlogic').add(data);
                    showToast('Registro creado', 'success');
                }
                document.getElementById('m-form-sheet').remove();
                document.getElementById('m-form-backdrop').remove();
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
                btn.disabled = false;
                btn.textContent = isEdit ? 'Guardar Cambios' : 'Crear Registro';
            }
        });
    },

    mobileExportExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('Librería Excel no disponible', 'error');
            return;
        }
        if (this.filteredRecords.length === 0) {
            showToast('No hay datos', 'warning');
            return;
        }
        var data = this.filteredRecords.map(function(r) { return {'Guía': r.guia||'','Empresa': r.empresa||'','Fecha': r.fecha||'','Doc': r.doc||'','N° Doc': r.docNum||'','Cliente': r.cliente||'','Dirección': r.direccion||'','Zona': r.zona||'','Vendedor': r.vendedor||'','Cond. Pago': r.condicionPago||'','Cobrador': r.cobrador||'','Venta': r.venta||0,'Bultos': r.bultos||0,'Costo Envío': r.costoEnvio||0,'% Costo': r.costoPorcentaje||0,'Observaciones': r.observations||''}; });
        var ws = XLSX.utils.json_to_sheet(data);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
        XLSX.writeFile(wb, 'Interlogic_' + new Date().toISOString().split('T')[0] + '.xlsx');
        showToast('Excel exportado');
    },

    // Export filtered data to Excel
    exportToExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('Error: Librería de Excel no cargada.', 'error');
            return;
        }

        if (this.filteredRecords.length === 0) {
            showToast('No hay datos para exportar.', 'warning');
            return;
        }

        // 1. Prepare Title and Metadata
        const dateStrStart = this.filters.startDate ? formatDate(this.filters.startDate, false) : '(Inicio)';
        const dateStrEnd = this.filters.endDate ? formatDate(this.filters.endDate, false) : '(Fin)';

        // Define headers
        const headers = [
            'Guía', 'Empresa', 'Fecha', 'Doc', 'Doc Num',
            'Cliente', 'Dirección', 'Zona', 'Vendedor', 'Condición',
            'Venta ($)', 'Bultos', 'Cajas',
            'Costo Envío ($)', '% Costo', 'Observaciones'
        ];

        // 2. Map data rows
        const rows = this.filteredRecords.map(r => [
            r.guia || '',
            r.empresa || '',
            r.fecha ? formatDate(r.fecha, false) : '',
            r.doc || '',
            r.docNum || '',
            r.cliente || '',
            r.direccion || '',
            r.zona || '',
            r.vendedor || '',
            r.condicionPago || '',
            Number(r.venta || 0),
            Number(r.bultos || 0),
            r.cobrador || '',
            Number(r.costoEnvio || 0),
            (Number(r.costoPorcentaje || 0) / 100),
            r.observations || ''
        ]);

        // 3. Calculate Totals
        const totalVenta = rows.reduce((sum, row) => sum + row[10], 0);
        const totalBultos = rows.reduce((sum, row) => sum + row[11], 0);
        const totalEnvio = rows.reduce((sum, row) => sum + row[13], 0);

        const totalRow = [
            '', '', '', '', '',
            '', '', '', '', 'TOTALES:',
            totalVenta, totalBultos, '',
            totalEnvio, '', ''
        ];

        // 4. Construct Final Array of Arrays (AOA)
        const finalAOA = [
            ['REPORTE DE CONTROL INTERLOGIC'],
            [`Periodo: ${dateStrStart} al ${dateStrEnd}`],
            [], // Empty row
            headers,
            ...rows,
            [], // Empty row before totals
            totalRow
        ];

        // 5. Create Worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(finalAOA);

        // 6. Set Column Widths (Approximate)
        const colWidths = [
            { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 },
            { wch: 30 }, { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
            { wch: 12 }, { wch: 10 }, { wch: 20 },
            { wch: 15 }, { wch: 10 }, { wch: 30 }
        ];
        worksheet['!cols'] = colWidths;

        // Note: SheetJS Community (free) doesn't allow styling (bold/font size) via code.
        // But the structure provides a clean, professional result.

        // 7. Create Workbook and Save
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');

        const dateNow = new Date().toISOString().split('T')[0];
        const filename = `Reporte_Interlogic_${dateNow}.xlsx`;

        XLSX.writeFile(workbook, filename);
        showToast('Reporte Excel profesional generado.');
    },

    toggleFilter(event, field) {
        event.stopPropagation();
        const popup = document.getElementById(`filter-popup-${field}`);
        if (!popup) return;
        const isShowing = popup.classList.contains('show');
        const headerEl = event.currentTarget;

        document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
        this._detachPopupScroll();

        if (!isShowing) {
            popup.classList.add('show');
            this.populateFilterOptions(field);
            this._positionPopup(headerEl, popup);
        }
    },

    _positionPopup(headerEl, popup) {
        var self = this;
        var tableContainer = headerEl.closest('.table-container');

        var reposition = function() {
            if (!popup.classList.contains('show')) {
                self._detachPopupScroll();
                return;
            }
            var rect = headerEl.getBoundingClientRect();
            var spaceBelow = window.innerHeight - rect.bottom;
            var maxH = Math.min(window.innerHeight * 0.7, 400);
            var left = Math.max(8, Math.min(rect.left, window.innerWidth - 260));

            popup.style.minWidth = Math.max(250, rect.width) + 'px';
            popup.style.maxWidth = Math.min(400, window.innerWidth - 16) + 'px';
            popup.style.left = left + 'px';

            if (spaceBelow > 200) {
                popup.style.top = rect.bottom + 2 + 'px';
                popup.style.bottom = 'auto';
                popup.style.maxHeight = Math.min(maxH, window.innerHeight - rect.bottom - 16) + 'px';
            } else {
                popup.style.top = 'auto';
                popup.style.bottom = (window.innerHeight - rect.top + 2) + 'px';
                popup.style.maxHeight = Math.min(maxH, rect.top - 16) + 'px';
            }
        };

        reposition();

        this._popupScrollHandler = reposition;
        if (tableContainer) tableContainer.addEventListener('scroll', reposition, { passive: true });
        window.addEventListener('resize', reposition, { passive: true });
        window.addEventListener('scroll', reposition, { passive: true });
    },

    _detachPopupScroll() {
        if (this._popupScrollHandler) {
            document.querySelectorAll('.table-container').forEach(function(tc) {
                tc.removeEventListener('scroll', this._popupScrollHandler);
            }.bind(this));
            window.removeEventListener('resize', this._popupScrollHandler);
            window.removeEventListener('scroll', this._popupScrollHandler);
            this._popupScrollHandler = null;
        }
    },

    searchInFilter(field, query) {
        const list = document.getElementById(`filter-options-${field}`);
        const items = list.querySelectorAll('.filter-option-item');
        const q = query.toLowerCase();

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(q) ? 'flex' : 'none';
        });
    },

    // Apply filters and sorting to records
    applyFilters() {
        this.filteredRecords = this.records.filter(record => {
            for (let field in this.filters) {
                const activeValues = this.filters[field];

                // Special handling for date range
                if (field === 'startDate' || field === 'endDate') {
                    const recordDate = record.fecha ? (record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha)).toISOString().split('T')[0] : '';
                    if (!recordDate) continue; // Allow records without date to pass through
                    if (this.filters.startDate && recordDate < this.filters.startDate) return false;
                    if (this.filters.endDate && recordDate > this.filters.endDate) return false;
                    continue;
                }

                if (activeValues && (Array.isArray(activeValues) ? activeValues.length > 0 : activeValues)) {
                    if (field === 'search') {
                        const q = activeValues.toLowerCase();
                        const searchFields = ['guia', 'empresa', 'cliente', 'zona', 'vendedor', 'doc', 'docNum', 'cobrador', 'condicionPago', 'direccion', 'observations'];
                        const match = searchFields.some(f => String(record[f] || '').toLowerCase().includes(q));
                        if (!match) return false;
                        continue;
                    }

                    let recordValue;
                    if (field === 'fecha') {
                        recordValue = record.fecha ? formatDate(record.fecha, false) : ' (Vacío)';
                    } else if (field === 'venta' || field === 'costoEnvio') {
                        recordValue = formatNumber(record[field] || 0, 2);
                    } else if (field === 'costoPorcentaje') {
                        recordValue = formatNumber(record[field] || 0, 2) + '%';
                    } else {
                        recordValue = String(record[field] || ' (Vacío)');
                    }
                    if (Array.isArray(activeValues)) {
                        if (!activeValues.includes(recordValue)) return false;
                    } else if (typeof activeValues === 'string' && activeValues) {
                        if (!recordValue.toLowerCase().includes(activeValues.toLowerCase())) return false;
                    }
                }
            }
            return true;
        });

        // Apply Sorting
        this.applySorting();

        const hasActiveFilters = this.currentSort.field || Object.entries(this.filters).some(([k, v]) => {
            if (k === 'startDate' && v !== getLocalDateString()) return true;
            if (k === 'endDate' && v !== getLocalDateString()) return true;
            if (k === 'search' && v) return true;
            return Array.isArray(v) && v.length > 0;
        });
        const clearBtn = document.getElementById('btn-clear-all-filters');
        if (clearBtn) clearBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';

        // Update table
        if (this.isMobile) {
            this.renderMobileCards();
        } else {
            this.renderTable();
            this.updateStats();
        }
    },

    applySorting() {
        const { field, direction } = this.currentSort;
        if (!field || !direction) return;

        this.filteredRecords.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            // Normalize values for sorting
            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    },

    setSort(field, direction) {
        this.currentSort = { field, direction };
        this.applyFilters();
    },

    // Populate dynamic filter options in popup (Excel-style: show values from current data context)
    populateFilterOptions(field) {
        const list = document.getElementById(`filter-options-${field}`);
        if (!list) return;

        // Add sorting options and toggle all buttons at the top
        const headerHtml = `
            <div class="filter-sort-options">
                <button class="sort-btn ${this.currentSort.field === field && this.currentSort.direction === 'asc' ? 'active' : ''}" 
                        onclick="Interlogic.setSort('${field}', 'asc')">
                    ↑ A a Z
                </button>
                <button class="sort-btn ${this.currentSort.field === field && this.currentSort.direction === 'desc' ? 'active' : ''}" 
                        onclick="Interlogic.setSort('${field}', 'desc')">
                    ↓ Z a A
                </button>
            </div>
            <div class="filter-toggle-all">
                <button class="btn-toggle-filter" onclick="Interlogic.toggleAllFilterValues('${field}', true)">
                    ☑ Seleccionar Todo
                </button>
                <button class="btn-toggle-filter" onclick="Interlogic.toggleAllFilterValues('${field}', false)">
                    ☐ Deseleccionar
                </button>
            </div>
        `;

        // Use already-filtered records (avoids re-computing all filters)
        const sourceRecords = this.filteredRecords.length > 0 ? this.filteredRecords : this.records;
        const uniqueValues = [...new Set(sourceRecords.map(r => {
            if (field === 'fecha') return r.fecha ? formatDate(r.fecha, false) : ' (Vacío)';
            if (field === 'venta' || field === 'costoEnvio') return formatNumber(r[field] || 0, 2);
            if (field === 'costoPorcentaje') return formatNumber(r[field] || 0, 2) + '%';
            return String(r[field] || ' (Vacío)');
        }))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        const activeValues = this.filters[field] || [];

        const optionsHtml = uniqueValues.map((val, idx) => {
            const valHtml = sanitizeHTML(val);
            const valJs = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const valAttr = String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            const safeId = `chk-${field}-${idx}`;
            return `
            <div class="filter-option-item" onclick="event.stopPropagation()">
                <input type="checkbox" id="${safeId}" data-value="${valAttr}" ${Array.isArray(activeValues) && activeValues.includes(val) ? 'checked' : ''} 
                       onchange="Interlogic.updateFilterValue('${field}', '${valJs}', this.checked)">
                <label for="${safeId}">${valHtml}</label>
            </div>
        `}).join('');

        list.innerHTML = headerHtml + optionsHtml;
    },

    toggleAllFilterValues(field, checked) {
        if (!checked) {
            this.filters[field] = [];
        } else {
            const list = document.getElementById(`filter-options-${field}`);
            const checkboxes = list.querySelectorAll('input[type="checkbox"]');
            this.filters[field] = Array.from(checkboxes).map(cb => cb.dataset.value);
        }
        this.applyFilters();
        this.populateFilterOptions(field);
    },

    updateFilterValue(field, value, checked) {
        if (!this.filters[field] || !Array.isArray(this.filters[field])) this.filters[field] = [];

        if (checked) {
            if (!this.filters[field].includes(value)) this.filters[field].push(value);
        } else {
            this.filters[field] = this.filters[field].filter(v => v !== value);
        }

        this.applyFilters();
    },

    clearAllFilters() {
        document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
        this._detachPopupScroll();

        const today = getLocalDateString();
        this.filters = {
            search: '',
            startDate: today,
            endDate: today,
            guia: [],
            empresa: [],
            fecha: [],
            doc: [],
            cliente: [],
            zona: [],
            vendedor: [],
            condicionPago: [],
            venta: [],
            cobrador: [],
            bultos: [],
            costoEnvio: [],
            costoPorcentaje: [],
            observations: []
        };
        this.currentSort = { field: '', direction: '' };

        const startInput = document.getElementById('filter-start-date');
        const endInput = document.getElementById('filter-end-date');
        if (startInput) startInput.value = today;
        if (endInput) endInput.value = today;
        const searchInput = document.getElementById('global-search');
        if (searchInput) searchInput.value = '';

        this.applyFilters();
    },

    // Load records from Firestore with real-time sync
    async loadRecords() {
        if (this._loadingRecords) return;
        this._loadingRecords = true;
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        const db = firebase.firestore();
        this.unsubscribe = db.collection('interlogic')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                this.records = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                this.applyFilters();

                // Remove loading state on first data receive
                if (this.loading) {
                    this.loading = false;
                }
            }, error => {
                console.error('Error in real-time listener:', error);
                showToast('Error en sincronización: ' + error.message, 'error');
            });
        this._loadingRecords = false;
    },

    // Render records table
    renderTable() {
        const tableBody = document.getElementById('interlogic-table-body');
        if (!tableBody) return;

        // Update header active states
        document.querySelectorAll('th[onclick]').forEach(function(header) {
            var onclick = header.getAttribute('onclick');
            var match = onclick && onclick.match(/toggleFilter\s*\(\s*event\s*,\s*'([^']+)'\s*\)/);
            if (match && Interlogic.filters && Interlogic.filters.hasOwnProperty(match[1])) {
                var isActive = Array.isArray(Interlogic.filters[match[1]]) ? Interlogic.filters[match[1]].length > 0 : !!Interlogic.filters[match[1]];
                header.classList.toggle('filter-active', isActive);
            }
        });

        if (this.filteredRecords.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="16" style="text-align: center; padding: 1rem;">No hay registros disponibles que coincidan con los filtros.</td>
                </tr>
            `;
            // Clear footer if exists
            const tfoot = document.getElementById('interlogic-table-footer');
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        // Check permissions
        const canEdit = window.permissions?.canEdit;
        const canCreate = window.permissions?.canCreate;
        const canDelete = window.permissions?.canDelete;

        // Render Table Body
        tableBody.innerHTML = this.filteredRecords.map(record => `
            <tr>
                <td style="text-align: center;"><input type="checkbox" class="row-checkbox" data-id="${record.id}" ${this.selectedRecords.has(record.id) ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;"></td>
                <td data-label="Guía"><strong>${sanitizeHTML(record.guia || '')}</strong></td>
                <td data-label="Empresa"><span class="badge ${record.empresa === 'DALSE' ? 'badge-primary' : 'badge-accent'}">${sanitizeHTML(record.empresa || '')}</span></td>
                <td data-label="Fecha">${record.fecha ? formatDateShort(record.fecha) : ''}</td>
                <td data-label="Doc">${sanitizeHTML(record.doc || '')}${record.docNum ? ' #' + sanitizeHTML(record.docNum) : ''}</td>
                <td data-label="Cliente">${sanitizeHTML(record.cliente || '')}${record.direccion ? '<br><span style="font-size: 0.8rem; color: #444;">📍 ' + sanitizeHTML(record.direccion) + '</span>' : ''}</td>
                <td data-label="Zona">${sanitizeHTML(record.zona || '')}</td>
                <td data-label="Vendedor">${sanitizeHTML(record.vendedor || '')}</td>
                <td data-label="Cond. Pago">${sanitizeHTML(record.condicionPago || '')}</td>
                <td data-label="Venta">$${formatNumber(record.venta || 0, 2)}</td>
                <td data-label="Bultos">${formatNumber(record.bultos || 0)}</td>
                <td data-label="Cobrador">${sanitizeHTML(record.cobrador || '')}</td>
                <td data-label="Costo Envío">$${formatNumber(record.costoEnvio || 0, 2)}</td>
                <td data-label="% Costo">${formatNumber(record.costoPorcentaje || 0, 2)}%</td>
                <td data-label="Observaciones" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sanitizeHTML(record.observations || '')}">${sanitizeHTML(record.observations || '')}</td>
                <td class="actions-cell">
                    <button class="btn-icon btn-secondary btn-edit-record ${!canEdit ? 'btn-disabled' : ''}" 
                            data-id="${record.id}"
                            ${!canEdit ? 'disabled' : ''} title="Editar">✏️</button>
                    <button class="btn-icon btn-secondary btn-duplicate-record ${!canCreate ? 'btn-disabled' : ''}" 
                            data-id="${record.id}"
                            ${!canCreate ? 'disabled' : ''} title="Duplicar">📋</button>
                    <button class="btn-icon btn-danger btn-delete-record ${!canDelete ? 'btn-disabled' : ''}" 
                            data-id="${record.id}"
                            ${!canDelete ? 'disabled' : ''} title="Eliminar">🗑️</button>
                </td>
            </tr>
        `).join('');

        // Calculate Totals
        const totals = this.filteredRecords.filter(r => r.doc !== 'NC').reduce((acc, r) => {
            acc.venta += Number(r.venta || 0);
            acc.bultos += Number(r.bultos || 0);
            acc.cajas += Number(r.cobrador || 0);
            acc.envio += Number(r.costoEnvio || 0);
            return acc;
        }, { venta: 0, bultos: 0, cajas: 0, envio: 0 });

        const totalPorcentaje = totals.venta > 0 ? (totals.envio / totals.venta) * 100 : 0;

        // Add Footer with Totals
        let tfoot = document.getElementById('interlogic-table-footer');
        if (!tfoot) {
            tfoot = document.createElement('tfoot');
            tfoot.id = 'interlogic-table-footer';
            document.getElementById('il-data-table').appendChild(tfoot);
        }

        tfoot.innerHTML = `
            <tr style="font-weight: 700; background: var(--gray-50);">
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td style="text-align: right;">TOTALES</td>
                <td>$${formatNumber(totals.venta, 2)}</td>
                <td>${formatNumber(totals.bultos)}</td>
                <td>${totals.cajas}</td>
                <td>$${formatNumber(totals.envio, 2)}</td>
                <td>${formatNumber(totalPorcentaje, 2)}%</td>
                <td></td>
                <td></td>
            </tr>
        `;

        // Update select-all checkbox state
        const selectAll = document.getElementById('select-all-checkbox');
        if (selectAll) {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            selectAll.checked = checkboxes.length > 0 && this.selectedRecords.size >= checkboxes.length;
            selectAll.indeterminate = this.selectedRecords.size > 0 && this.selectedRecords.size < checkboxes.length;
        }

        // Update delete-selected button visibility
        this.updateBulkDeleteButton();
    },

    updateBulkDeleteButton() {
        // Container for bulk action buttons
        let container = document.getElementById('bulk-actions-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'bulk-actions-container';
            container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 1000; display: none; gap: 0.5rem; align-items: center; flex-direction: row;';
            document.body.appendChild(container);
        }

        if (this.selectedRecords.size > 0) {
            container.style.display = 'inline-flex';
            container.innerHTML = `
                <button class="btn btn-accent" id="btn-create-route-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    ➕ Crear Ruta (${this.selectedRecords.size})
                </button>
                <button class="btn btn-secondary" id="btn-change-date-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    📅 Cambiar Fecha (${this.selectedRecords.size})
                </button>
                <button class="btn btn-danger" id="btn-delete-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    🗑️ Eliminar (${this.selectedRecords.size})
                </button>
            `;
            document.getElementById('btn-delete-selected').onclick = () => this.deleteSelectedRecords();
            document.getElementById('btn-change-date-selected').onclick = () => this.changeDateSelectedRecords();
            document.getElementById('btn-create-route-selected').onclick = () => this.createRouteFromSelection();
        } else {
            container.style.display = 'none';
        }
    },

    async changeDateSelectedRecords() {
        if (!window.permissions?.canEdit) {
            showToast('No tienes permisos para editar registros', 'error');
            return;
        }
        const count = this.selectedRecords.size;
        if (count === 0) return;

        // Show modal with date picker
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h2 style="margin-bottom: 1rem;">📅 Cambiar Fecha</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Se cambiará la fecha de <strong>${count} registro(s)</strong> seleccionado(s).</p>
                <div class="form-group">
                    <label>Nueva Fecha</label>
                    <input type="date" id="bulk-new-date" value="${getLocalDateString()}" style="padding: 0.5rem 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); width: 100%; font-size: 1rem;">
                </div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="button" class="btn btn-secondary" id="bulk-date-cancel">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="bulk-date-confirm">✓ Aplicar Fecha</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('bulk-date-cancel').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        document.getElementById('bulk-date-confirm').onclick = async () => {
            const newDateVal = document.getElementById('bulk-new-date').value;
            if (!newDateVal) {
                showToast('Selecciona una fecha', 'error');
                return;
            }

            const confirmBtn = document.getElementById('bulk-date-confirm');
            setButtonLoading(confirmBtn, true);

            try {
                const [y, m, d] = newDateVal.split('-').map(Number);
                const newDate = firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));

                const batch = firebase.firestore().batch();
                for (const id of this.selectedRecords) {
                    batch.update(firebase.firestore().collection('interlogic').doc(id), {
                        fecha: newDate,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                await batch.commit();

                // Update local records
                this.records.forEach(r => {
                    if (this.selectedRecords.has(r.id)) {
                        r.fecha = newDate;
                    }
                });

                this.selectedRecords.clear();
                this.applyFilters();
                modal.remove();

                showToast(`✓ Fecha actualizada en ${count} registro(s)`, 'success');
            } catch (error) {
                console.error('❌ Error changing dates:', error);
                showToast('Error al cambiar fecha: ' + error.message, 'error');
                setButtonLoading(confirmBtn, false);
            }
        };
    },

    async createRouteFromSelection() {
        const count = this.selectedRecords.size;
        if (count === 0) return;

        const selectedRecords = this.records.filter(r => this.selectedRecords.has(r.id));
        const clientesUnicos = [...new Set(selectedRecords.map(r => (r.cliente || '').trim()).filter(Boolean))];
        const zonasUnicas = [...new Set(selectedRecords.map(r => (r.zona || '').trim()).filter(Boolean))];
        const totalVenta = selectedRecords.reduce((s, r) => s + (Number(r.venta) || 0), 0);

        let repartidoresOpts = '<option value="">Cargando repartidores...</option>';
        try {
            const repSnap = await firebase.firestore().collection('repartidores').orderBy('nombre', 'asc').get();
            const reps = repSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.activo !== false);
            repartidoresOpts = '<option value="">Seleccionar repartidor...</option>' +
                reps.map(r => '<option value="' + r.id + '" data-nombre="' + r.nombre + '" data-vehiculo="' + (r.vehiculo || '') + '" data-zona="' + (r.zona || '') + '">' + r.nombre + ' - ' + (r.vehiculo || '') + ' - ' + (r.zona || '') + '</option>').join('');
        } catch(e) { repartidoresOpts = '<option value="">Error al cargar</option>'; }

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:550px;">
                <h2 style="margin-bottom:0.5rem;">➕ Crear Ruta con ${count} registros</h2>
                <div style="margin-bottom:1rem;font-size:0.85rem;color:#666;">
                    <div>📦 ${count} facturas · ${clientesUnicos.length} cliente(s) · Total: <strong>$${totalVenta.toLocaleString('en-US',{minimumFractionDigits:2})}</strong></div>
                    ${zonasUnicas.length > 0 ? '<div>📍 Zona(s): ' + zonasUnicas.join(', ') + '</div>' : ''}
                </div>
                <form id="cr-ruta-form">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div class="form-group">
                            <label>Fecha de Ruta</label>
                            <input type="date" id="cr-fecha" value="${getLocalDateString()}">
                        </div>
                        <div class="form-group">
                            <label>Repartidor</label>
                            <select id="cr-repartidor">${repartidoresOpts}</select>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group">
                            <label>Vehículo (Placa)</label>
                            <input type="text" id="cr-vehiculo" placeholder="Ej: P-4567">
                        </div>
                        <div class="form-group">
                            <label>Zona</label>
                            <input type="text" id="cr-zona" value="${sanitizeHTML(zonasUnicas[0] || '')}" placeholder="Zona de la ruta">
                        </div>
                    </div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="cr-save-btn">💾 Crear Ruta y Asignar</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        const repSelect = document.getElementById('cr-repartidor');
        const vehiculoInput = document.getElementById('cr-vehiculo');
        const zonaInput = document.getElementById('cr-zona');
        if (repSelect) repSelect.addEventListener('change', () => {
            const opt = repSelect.selectedOptions[0];
            if (opt && opt.dataset.vehiculo) vehiculoInput.value = opt.dataset.vehiculo;
            if (opt && opt.dataset.zona && !zonaInput.value) zonaInput.value = opt.dataset.zona;
        });

        document.getElementById('cr-ruta-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('cr-save-btn');
            setButtonLoading(btn, true);
            try {
                const fechaVal = document.getElementById('cr-fecha').value;
                const repId = document.getElementById('cr-repartidor').value;
                const repOpt = document.getElementById('cr-repartidor').selectedOptions[0];
                const vehiculo = document.getElementById('cr-vehiculo').value.trim();
                const zona = document.getElementById('cr-zona').value.trim();
                let fbDate = firebase.firestore.Timestamp.now();
                if (fechaVal) { const [y,m,d] = fechaVal.split('-').map(Number); fbDate = firebase.firestore.Timestamp.fromDate(new Date(y,m-1,d,12,0,0)); }

                const db = firebase.firestore();
                const routeRef = db.collection('rutas').doc();

                const routeData = {
                    fecha: fbDate,
                    repartidorId: repId,
                    repartidorNombre: repOpt ? repOpt.dataset.nombre : '',
                    vehiculo: vehiculo,
                    zona: zona,
                    estado: 'pendiente',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                const batch = db.batch();
                batch.set(routeRef, routeData);

                let seq = 0;
                selectedRecords.forEach(r => {
                    seq++;
                    const entregaRef = db.collection('rutaEntregas').doc();
                    batch.set(entregaRef, {
                        rutaId: routeRef.id,
                        interlogicId: r.id,
                        guia: r.guia || '',
                        cliente: r.cliente || '',
                        direccion: r.direccion || '',
                        venta: Number(r.venta) || 0,
                        condicionPago: r.condicionPago || '',
                        costoEnvio: Number(r.costoEnvio) || 0,
                        montoCobrado: Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0)) || 0,
                        estadoCobro: r.estadoCobro || (r.cobrado === true ? 'pagado' : 'pendiente'),
                        entregado: r.entregado === true,
                        horaEntrega: r.horaEntrega || '',
                        telefono: r.telefono || '',
                        sequence: seq,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    batch.update(db.collection('interlogic').doc(r.id), {
                        rutaId: routeRef.id,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });

                await batch.commit();

                this.selectedRecords.clear();
                this.applyFilters();
                modal.remove();
                showToast('✅ Ruta creada con ' + count + ' registros asignados', 'success');
            } catch (err) {
                console.error('Error creating route:', err);
                showToast('Error: ' + err.message, 'error');
                setButtonLoading(btn, false);
            }
        });
    },

    async deleteSelectedRecords() {
        if (!window.permissions?.canDelete) {
            showToast('No tienes permisos para eliminar registros', 'error');
            return;
        }
        const count = this.selectedRecords.size;
        if (count === 0) return;
        if (!await showConfirm(`¿Eliminar ${count} registro(s)?`, 'Esta acción no se puede deshacer.')) return;

        try {
            const batch = firebase.firestore().batch();
            for (const id of this.selectedRecords) {
                batch.delete(firebase.firestore().collection('interlogic').doc(id));
            }
            await batch.commit();

            this.records = this.records.filter(r => !this.selectedRecords.has(r.id));
            this.selectedRecords.clear();
            this.applyFilters();

            showToast(`✓ ${count} registro(s) eliminado(s) exitosamente`, 'success');
        } catch (error) {
            console.error('❌ Error bulk deleting:', error);
            showToast('Error al eliminar: ' + error.message, 'error');
        }
    },

    // Update statistics
    updateStats() {
        const targetRecords = this.filteredRecords;
        const totalVenta = targetRecords.reduce((sum, r) => sum + (Number(r.venta) || 0), 0);
        const totalBultos = targetRecords.reduce((sum, r) => sum + (Number(r.bultos) || 0), 0);
        const totalEnvio = targetRecords.reduce((sum, r) => sum + (Number(r.costoEnvio) || 0), 0);

        const porcentaje = totalVenta > 0 ? (totalEnvio / totalVenta) * 100 : 0;

        document.getElementById('stat-total-venta').textContent = `$${formatNumber(totalVenta, 2)} `;
        document.getElementById('stat-total-bultos').textContent = formatNumber(totalBultos);
        document.getElementById('stat-total-envio').textContent = `$${formatNumber(totalEnvio, 2)} `;
        document.getElementById('stat-total-porcentaje').textContent = `${formatNumber(porcentaje, 2)}% `;
    },

    // Show form modal
    // Cache for client autocomplete (persists while the form is open)
    _clientSearchCache: null,

    // Reset client cache when data may have changed
    _invalidateClientCache() {
        this._clientSearchCache = null;
    },

    showForm(recordId = null, sourceRecord = null) {
        // Double check permissions
        if (recordId && !window.permissions?.canEdit) {
            showToast('No tienes permisos para editar registros', 'error');
            return;
        }
        if (!recordId && !window.permissions?.canCreate) {
            showToast('No tienes permisos para crear registros', 'error');
            return;
        }

        const record = recordId ? this.records.find(r => r.id === recordId) : null;
        // For duplication or last-values pre-fill
        const prefill = sourceRecord || ((!recordId && !sourceRecord) ? (() => {
            try { return JSON.parse(localStorage.getItem('il_last_values') || '{}'); } catch (e) { return {}; }
        })() : null);

        let dateValue = '';
        if (record && record.fecha) {
            const date = record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha);
            dateValue = formatDateForInput(date);
        } else if (sourceRecord && sourceRecord.fecha) {
            const date = sourceRecord.fecha.toDate ? sourceRecord.fecha.toDate() : new Date(sourceRecord.fecha);
            dateValue = formatDateForInput(date);
        } else if (!recordId) {
            dateValue = formatDateForInput(new Date());
        }

        // Helper to get value with priority: record > sourceRecord > prefill > ''
        const val = (field) => {
            if (record) return record[field] || '';
            if (sourceRecord) return sourceRecord[field] || '';
            if (prefill && prefill[field]) return prefill[field];
            return '';
        };

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 650px;">
                <h2 style="margin-bottom: 1.5rem;">${record ? '✏️ Editar Registro' : (sourceRecord ? '📋 Duplicar Registro' : '➕ Nuevo Registro de Guía')}</h2>
                
                <form id="interlogic-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label>Guía</label>
                            <input type="number" id="il-guia" value="${sourceRecord ? '' : (record ? sanitizeHTML(record.guia || '') : '')}">
                        </div>
                        <div class="form-group">
                            <label>Empresa</label>
                            <select id="il-empresa">
                                <option value="" ${!val('empresa') ? 'selected' : ''}>Seleccionar...</option>
                                <option value="DALSE" ${val('empresa') === 'DALSE' ? 'selected' : ''}>DALSE</option>
                                <option value="INCEDE" ${val('empresa') === 'INCEDE' ? 'selected' : ''}>INCEDE</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group">
                            <label>Fecha</label>
                            <input type="date" id="il-fecha" value="${dateValue}">
                        </div>
                        <div class="form-group">
                            <label>Documento</label>
                            <div style="display: flex; gap: 0.5rem;">
                                <select id="il-doc" style="flex: 1;">
                                    <option value="" ${!val('doc') ? 'selected' : ''}>Tipo...</option>
                                    <option value="CCF" ${val('doc') === 'CCF' ? 'selected' : ''}>CCF</option>
                                    <option value="FT" ${val('doc') === 'FT' ? 'selected' : ''}>FT</option>
                                    <option value="NC" ${val('doc') === 'NC' ? 'selected' : ''}>NC</option>
                                </select>
                                <input type="text" id="il-docNum" placeholder="#" value="${sourceRecord ? '' : (record ? sanitizeHTML(record.docNum || '') : '')}" style="flex: 1;">
                            </div>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 1rem; position: relative;">
                        <label>Cliente</label>
                            <input type="text" id="il-cliente" autocomplete="off" value="${sourceRecord ? sanitizeHTML(sourceRecord.cliente || '').replace(/"/g, '&quot;') : (record ? sanitizeHTML(record.cliente || '').replace(/"/g, '&quot;') : '')}">
                        <div id="il-cliente-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--gray-300); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 1300; max-height: 200px; overflow-y: auto;"></div>
                    </div>

                    <div class="form-group" style="margin-top: 1rem;">
                        <label>Dirección</label>
                            <input type="text" id="il-direccion" placeholder="Dirección del cliente" value="${sanitizeHTML(val('direccion')).replace(/"/g, '&quot;')}">
                    </div>

                    <div id="il-nc-fields" style="display: none; margin-top: 1rem; padding: 1rem; background: #fffbeb; border-radius: var(--radius-md); border: 1px solid #f59e0b;">
                        <div style="font-weight:700; font-size:0.85rem; margin-bottom:0.75rem; color:#92400e;">📋 Opciones de Nota de Crédito</div>
                        <div class="form-group">
                            <label>Afecta saldo de algún CCF/FT</label>
                            <select id="il-nc-afectaSaldo">
                                <option value="no">No - NC general (no afecta ningún documento)</option>
                                <option value="si">Sí - Descontar del saldo de un CCF/FT específico</option>
                            </select>
                        </div>
                        <div id="il-nc-ccf-group" style="display: none; margin-top: 0.75rem;">
                            <div class="form-group">
                                <label>Seleccionar CCF/FT del cliente</label>
                                <select id="il-nc-interlogicId" style="width: 100%;">
                                    <option value="">-- Seleccionar CCF/FT --</option>
                                </select>
                                <div id="il-nc-ccf-info" style="display:none; margin-top:0.5rem; padding:0.5rem; background:white; border-radius:var(--radius-sm); font-size:0.8rem; border:1px solid var(--gray-200);"></div>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group">
                            <label>Venta ($)</label>
                            <input type="number" id="il-venta" step="0.01" value="${sourceRecord ? (sourceRecord.venta || '') : (record ? record.venta : '')}">
                        </div>
                        <div class="form-group">
                            <label>Bultos</label>
                            <input type="number" id="il-bultos" value="${sourceRecord ? (sourceRecord.bultos || '') : (record ? record.bultos : '')}">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group">
                            <label>Vendedor</label>
                            <input type="text" id="il-vendedor" value="${sanitizeHTML(val('vendedor')).replace(/"/g, '&quot;')}">
                        </div>
                        <div class="form-group">
                            <label>Teléfono Cliente (WhatsApp)</label>
                            <input type="text" id="il-telefono" placeholder="Ej: 50370000000" value="${sourceRecord ? sanitizeHTML(sourceRecord.telefono || '').replace(/"/g, '&quot;') : (record ? sanitizeHTML(record.telefono || '').replace(/"/g, '&quot;') : '')}">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group">
                            <label>Zona</label>
                            <input type="text" id="il-zona" value="${sanitizeHTML(val('zona')).replace(/"/g, '&quot;')}">
                        </div>
                        <div class="form-group">
                            <label>Condición Pago</label>
                            <select id="il-condicionPago">
                                <option value="" ${!val('condicionPago') ? 'selected' : ''}>Seleccionar...</option>
                                <option value="Contado" ${val('condicionPago') === 'Contado' ? 'selected' : ''}>Contado</option>
                                <option value="Crédito" ${val('condicionPago') === 'Crédito' ? 'selected' : ''}>Crédito</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group" id="il-cobrador-group">
                            <label>Cajas</label>
                            <input type="number" id="il-cobrador" value="${sourceRecord ? (sourceRecord.cobrador || '') : (record ? record.cobrador || '' : '')}">
                        </div>
                        <div class="form-group" id="il-plazo-group">
                            <label>Plazo Pago (días)</label>
                            <input type="number" id="il-plazo" value="30" min="1" max="365">
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 1rem;">
                        <label>📝 Observaciones</label>
                        <textarea id="il-observations" rows="2" placeholder="Notas u observaciones sobre este registro..." style="width: 100%; padding: 0.5rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-family: var(--font-family); resize: vertical;">${sourceRecord ? sanitizeHTML(sourceRecord.observations || '') : (record ? sanitizeHTML(record.observations || '') : '')}</textarea>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem; flex-wrap: wrap;">
                        ${!recordId ? '<button type="button" class="btn btn-secondary" id="btn-il-save-another" title="Guardar y abrir otro formulario">💾+ Guardar y Agregar Otro</button>' : ''}
                        <button type="submit" class="btn btn-primary" id="btn-il-save">💾 Guardar Registro</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                    </div>
                </form>
            </div >
    `;

        document.body.appendChild(modal);

        var self = this;

        var plazoGroup = document.getElementById('il-plazo-group');
        var plazoInput = document.getElementById('il-plazo');
        var condicionSelect = document.getElementById('il-condicionPago');
        var togglePlazo = function() {
            var isCredito = condicionSelect.value === 'Crédito';
            if (plazoGroup) plazoGroup.style.display = isCredito ? 'block' : 'none';
            if (plazoInput) plazoInput.disabled = !isCredito;
        };
        condicionSelect.addEventListener('change', togglePlazo);
        togglePlazo();

        // NC fields toggle
        var docSelect = document.getElementById('il-doc');
        var ncFields = document.getElementById('il-nc-fields');
        var ncAfectaSaldo = document.getElementById('il-nc-afectaSaldo');
        var ncCcfGroup = document.getElementById('il-nc-ccf-group');
        var ncInterlogicId = document.getElementById('il-nc-interlogicId');
        var ncCcfInfo = document.getElementById('il-nc-ccf-info');
        var ventaLabel = document.querySelector('label[for="il-venta"]') || document.getElementById('il-venta')?.closest('.form-group')?.querySelector('label');
        var bultosGroup = document.getElementById('il-bultos')?.closest('.form-group');
        var cobradorGroup = document.getElementById('il-cobrador-group');
        var plazoGroupEl = document.getElementById('il-plazo-group');

        var toggleNCFields = function() {
            var isNC = docSelect.value === 'NC';
            if (ncFields) ncFields.style.display = isNC ? 'block' : 'none';
            if (ventaLabel) ventaLabel.textContent = isNC ? 'Monto NC ($)' : 'Venta ($)';
            if (bultosGroup) bultosGroup.style.display = isNC ? 'none' : 'block';
            if (cobradorGroup) cobradorGroup.style.display = isNC ? 'none' : 'block';
            if (plazoGroupEl) plazoGroupEl.style.display = isNC ? 'none' : (condicionSelect.value === 'Crédito' ? 'block' : 'none');
        };
        docSelect.addEventListener('change', toggleNCFields);
        toggleNCFields();

        // Toggle CCF selector when "afecta saldo" changes
        var toggleNCCcfGroup = function() {
            var afecta = ncAfectaSaldo.value === 'si';
            if (ncCcfGroup) ncCcfGroup.style.display = afecta ? 'block' : 'none';
            if (afecta) populateCCFList();
        };
        ncAfectaSaldo.addEventListener('change', toggleNCCcfGroup);

        // Populate CCF list based on client
        var populateCCFList = function() {
            var clienteActual = document.getElementById('il-cliente').value.trim();
            ncInterlogicId.innerHTML = '<option value="">-- Seleccionar CCF/FT --</option>';

            if (!clienteActual) {
                ncInterlogicId.innerHTML = '<option value="">-- Primero ingresa el cliente arriba --</option>';
                return;
            }

            // Filter records from already loaded data
            var clienteLower = clienteActual.toLowerCase();
            var ccfRecords = self.records.filter(function(r) {
                return (r.doc === 'CCF' || r.doc === 'FT') &&
                       (r.cliente || '').toLowerCase().includes(clienteLower);
            });

            if (ccfRecords.length === 0) {
                ncInterlogicId.innerHTML = '<option value="">-- No hay CCF/FT para este cliente --</option>';
                return;
            }

            ccfRecords.forEach(function(r) {
                var estado = r.estadoCobro === 'pagado' ? '✓ Pagado' : (r.estadoCobro === 'parcial' ? '⚠ Parcial' : '● Pendiente');
                var opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = (r.doc || '') + ' #' + (r.docNum || r.guia || '') + ' - $' + formatNumber(r.venta || 0, 2) + ' (' + estado + ')';
                ncInterlogicId.appendChild(opt);
            });
        };

        // Show CCF info when selected
        ncInterlogicId.addEventListener('change', function() {
            var selectedId = ncInterlogicId.value;
            if (selectedId && ncCcfInfo) {
                var record = self.records.find(function(r) { return r.id === selectedId; });
                if (record) {
                    var cobrado = Number(record.montoCobrado || (record.cobrado === true ? record.venta : 0));
                    var pendiente = Math.max(0, Number(record.venta || 0) - cobrado);
                    ncCcfInfo.style.display = 'block';
                    ncCcfInfo.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><strong>Venta:</strong> $' + formatNumber(record.venta || 0, 2) + '</div><div><strong>Cobrado:</strong> $' + formatNumber(cobrado, 2) + '</div><div><strong>Pendiente:</strong> $' + formatNumber(pendiente, 2) + '</div><div><strong>Estado:</strong> ' + (record.estadoCobro || 'pendiente') + '</div></div>';
                }
            } else if (ncCcfInfo) {
                ncCcfInfo.style.display = 'none';
            }
        });

        // Also repopulate when client changes
        var clienteInputNc = document.getElementById('il-cliente');
        clienteInputNc.addEventListener('change', function() {
            if (docSelect.value === 'NC' && ncAfectaSaldo.value === 'si') {
                populateCCFList();
            }
        });

        // Setup client autocomplete
        const clienteInput = document.getElementById('il-cliente');
        const suggestionsBox = document.getElementById('il-cliente-suggestions');
        let debounceTimer = null;

        // Helper: apply selected suggestion to the form
        const selectSuggestionItem = (item) => {
            clienteInput.value = item.dataset.nombre;
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('il-direccion', item.dataset.direccion);
            setVal('il-telefono', item.dataset.telefono);
            setVal('il-zona', item.dataset.zona);
            setVal('il-vendedor', item.dataset.vendedor);
            // NOTA: empresa y condicionPago NO se auto‑llenan para que el usuario los elija manualmente
            suggestionsBox.style.display = 'none';
            suggestionsBox._highlightedIndex = -1;
        };

        // Helper to highlight a suggestion by index
        const highlightSuggestion = (index) => {
            const items = suggestionsBox.querySelectorAll('[data-index]');
            items.forEach((el, i) => {
                if (i === index) {
                    el.style.background = 'var(--primary-200)';
                } else {
                    el.style.background = '';
                }
            });
        };

        // Helper to render suggestions
        const renderSuggestions = (matches) => {
            if (matches.length === 0) {
                suggestionsBox.style.display = 'none';
                return;
            }

            suggestionsBox.innerHTML = matches.map((c, i) => `
                <div style="padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--gray-100); font-size: 0.85rem; transition: background 0.15s;"
                     data-index="${i}"
                     data-nombre="${sanitizeHTML(c.nombre || '')}"
                     data-direccion="${sanitizeHTML(c.direccion || '')}"
                     data-telefono="${c.telefono || ''}"
                     data-zona="${sanitizeHTML(c.zona || '')}"
                     data-vendedor="${sanitizeHTML(c.vendedor || '')}"
                     data-empresa="${c.empresa || ''}"
                     data-condicionpago="${c.condicionPago || ''}">
                    <strong>${sanitizeHTML(c.nombre || '')}</strong>
                    ${c.direccion ? `<br><span style="color: var(--text-secondary); font-size: 0.8rem;">📍 ${sanitizeHTML(c.direccion)}</span>` : ''}
                    ${c.telefono ? `<span style="color: var(--text-secondary); font-size: 0.8rem;"> | 📱 ${c.telefono}</span>` : ''}
                </div>
            `).join('');

            suggestionsBox._highlightedIndex = -1;
            suggestionsBox.style.display = 'block';

            // Add click handlers to suggestions
            suggestionsBox.querySelectorAll('[data-index]').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectSuggestionItem(item);
                });
                item.addEventListener('mouseenter', () => {
                    const idx = parseInt(item.dataset.index);
                    highlightSuggestion(idx);
                    suggestionsBox._highlightedIndex = idx;
                });
            });
        };

        // Keyboard navigation for suggestions
        clienteInput.addEventListener('keydown', (e) => {
            const items = suggestionsBox.querySelectorAll('[data-index]');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                let idx = suggestionsBox._highlightedIndex;
                idx = (idx + 1) % items.length;
                highlightSuggestion(idx);
                suggestionsBox._highlightedIndex = idx;
                items[idx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                let idx = suggestionsBox._highlightedIndex;
                idx = (idx <= 0) ? items.length - 1 : idx - 1;
                highlightSuggestion(idx);
                suggestionsBox._highlightedIndex = idx;
                items[idx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                const idx = suggestionsBox._highlightedIndex;
                if (idx >= 0 && idx < items.length) {
                    e.preventDefault();
                    selectSuggestionItem(items[idx]);
                    clienteInput.focus();
                }
            } else if (e.key === 'Escape') {
                suggestionsBox.style.display = 'none';
                suggestionsBox._highlightedIndex = -1;
            }
        });

        // Helper: elimina tildes/diacríticos para búsqueda insensible a acentos
        const normalizeText = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        // Helper to search clients — con caché y matching sin acentos
        const searchClients = async (query) => {
            if (query.length < 1) {
                suggestionsBox.style.display = 'none';
                return;
            }

            suggestionsBox.innerHTML = '<div style="padding: 0.75rem; color: var(--text-secondary);">Buscando clientes...</div>';
            suggestionsBox.style.display = 'block';

            try {
                let allClients = [];

                // Asegurar que Clientes haya cargado sus datos (activa el listener + espera primera data)
                if (window.Clientes && window.Clientes.loadRecords) {
                    await window.Clientes.loadRecords();
                }

                // Obtener datos de la caché del módulo Clientes (se actualiza en tiempo real)
                allClients = window.Clientes ? window.Clientes.getAll() : [];

                // Si Clientes no tiene datos (nunca se visitó), usar Firestore como fallback
                if (!allClients || allClients.length === 0) {
                    if (!Interlogic._clientSearchCache) {
                        const db = firebase.firestore();
                        const snapshot = await db.collection('clientes')
                            .orderBy('nombre')
                            .limit(500)
                            .get();
                        Interlogic._clientSearchCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    }
                    allClients = Interlogic._clientSearchCache;
                }

                // Buscar palabras normalizadas (sin acentos)
                const queryWords = query.split(/\s+/).filter(w => w.length > 0).map(normalizeText);
                const matches = allClients.filter(c => {
                    const clientName = normalizeText(c.nombre || '');
                    return queryWords.every(word => clientName.includes(word));
                }).slice(0, 10);

                renderSuggestions(matches);
            } catch (error) {
                console.error('Error searching clients:', error);
                suggestionsBox.innerHTML = '<div style="padding: 0.75rem; color: var(--error);">Error al buscar clientes</div>';
            }
        };

        clienteInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = clienteInput.value.toLowerCase().trim();
                searchClients(query);
            }, 200);
        });

        // Also search when input receives focus if there's already text
        clienteInput.addEventListener('focus', () => {
            const query = clienteInput.value.toLowerCase().trim();
            if (query.length >= 1) {
                searchClients(query);
            }
        });

        clienteInput.addEventListener('blur', () => {
            setTimeout(() => { suggestionsBox.style.display = 'none'; }, 200);
        });

        // Setup 'Save & Add Another' button
        const saveAnotherBtn = document.getElementById('btn-il-save-another');
        if (saveAnotherBtn) {
            saveAnotherBtn.addEventListener('click', () => {
                this._saveAndAddAnother = true;
                document.getElementById('interlogic-form').dispatchEvent(new Event('submit', { cancelable: true }));
            });
        }

        // Handle form submission
        document.getElementById('interlogic-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('btn-il-save');
            setButtonLoading(saveBtn, true);

            try {
                const dateVal = document.getElementById('il-fecha').value;
                let firebaseDate = null;
                if (dateVal) {
                    const [y, m, d] = dateVal.split('-').map(Number);
                    const localDate = new Date(y, m - 1, d, 12, 0, 0);
                    firebaseDate = firebase.firestore.Timestamp.fromDate(localDate);
                }

                const venta = Number(document.getElementById('il-venta').value) || 0;
                const bultos = Number(document.getElementById('il-bultos').value) || 0;


                // Automatic calculations
                const costoEnvio = bultos * 1.85;
                const costoPorcentaje = venta > 0 ? (costoEnvio / venta) * 100 : 0;

                const data = {
                    guia: document.getElementById('il-guia').value || '',
                    empresa: document.getElementById('il-empresa').value || '',
                    fecha: firebaseDate,
                    doc: document.getElementById('il-doc').value || '',
                    docNum: document.getElementById('il-docNum').value.trim() || '',
                    cliente: document.getElementById('il-cliente').value.trim() || '',
                    direccion: document.getElementById('il-direccion').value.trim() || '',
                    telefono: document.getElementById('il-telefono').value.trim() || '',
                    zona: document.getElementById('il-zona').value.trim() || '',
                    vendedor: document.getElementById('il-vendedor').value.trim() || '',
                    condicionPago: document.getElementById('il-condicionPago').value || '',
                    venta: venta,

                    cobrador: document.getElementById('il-cobrador').value.trim() || '',
                    bultos: bultos,
                    costoEnvio: costoEnvio,
                    costoPorcentaje: costoPorcentaje,
                    observations: document.getElementById('il-observations').value.trim() || '',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (data.condicionPago === 'Crédito') {
                    const plazo = parseInt(document.getElementById('il-plazo').value) || 30;
                    const fechaBase = firebaseDate ? firebaseDate.toDate() : new Date();
                    fechaBase.setHours(12, 0, 0, 0);
                    const fechaVenc = new Date(fechaBase);
                    fechaVenc.setDate(fechaVenc.getDate() + plazo);
                    data.fechaVencimiento = firebase.firestore.Timestamp.fromDate(fechaVenc);
                    if (!recordId) {
                        data.estadoCobro = 'pendiente';
                        data.montoCobrado = 0;
                        data.montoPendiente = venta;
                    }
                }

                const db = firebase.firestore();
                const isNC = data.doc === 'NC';

                if (isNC) {
                    // Guardar como Nota de Crédito en colección separada Y en interlogic
                    var ncAfectaVal = document.getElementById('il-nc-afectaSaldo').value;
                    var ncInterlogicIdVal = document.getElementById('il-nc-interlogicId').value;

                    var ncData = {
                        ncNum: data.docNum,
                        cliente: data.cliente,
                        monto: venta,
                        motivo: data.observations,
                        fecha: data.fecha,
                        empresa: data.empresa,
                        interlogicId: ncInterlogicIdVal || '',
                        guia: data.guia || '',
                        docRef: ncInterlogicIdVal ? (data.doc + ' #' + data.docNum) : '',
                        afectaSaldo: ncAfectaVal === 'si',
                        estado: 'activa',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdBy: firebase.auth().currentUser.uid
                    };

                    // Also save to interlogic so it appears in the table
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    data.createdBy = firebase.auth().currentUser.uid;

                    if (ncAfectaVal === 'si' && ncInterlogicIdVal) {
                        // Batch: crear NC en notasCredito + en interlogic + actualizar saldo del CCF
                        var batch = db.batch();
                        batch.set(db.collection('notasCredito').doc(), ncData);
                        batch.set(db.collection('interlogic').doc(), data);

                        // Buscar el registro CCF para actualizar saldo
                        var ccfDoc = await db.collection('interlogic').doc(ncInterlogicIdVal).get();
                        if (ccfDoc.exists) {
                            var ccfData = ccfDoc.data();
                            var cobradoActualCents = toCents(ccfData.montoCobrado || (ccfData.cobrado === true ? ccfData.venta : 0));
                            var ventaCCFCents = toCents(ccfData.venta || 0);
                            var ventaCents = toCents(venta);
                            var nuevoCobradoCents = cobradoActualCents + ventaCents;
                            var nuevoPendienteCents = Math.max(0, ventaCCFCents - nuevoCobradoCents);
                            var nuevoCobrado = nuevoCobradoCents / 100;
                            var nuevoPendiente = nuevoPendienteCents / 100;
                            var nuevoEstado = nuevoCobradoCents >= ventaCCFCents ? 'pagado' : (nuevoCobradoCents > 0 ? 'parcial' : 'pendiente');

                            batch.update(db.collection('interlogic').doc(ncInterlogicIdVal), {
                                montoCobrado: nuevoCobrado,
                                montoPendiente: nuevoPendiente,
                                estadoCobro: nuevoEstado,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        }

                        await batch.commit();
                        showToast('✓ Nota de Crédito creada y saldo actualizado', 'success');
                    } else {
                        // Solo crear NC sin afectar saldo (en ambas colecciones)
                        var batch2 = db.batch();
                        batch2.set(db.collection('notasCredito').doc(), ncData);
                        batch2.set(db.collection('interlogic').doc(), data);
                        await batch2.commit();
                        showToast('✓ Nota de Crédito creada', 'success');
                    }
                } else if (recordId) {
                    await db.collection('interlogic').doc(recordId).update(data);
                    showToast('✓ Registro actualizado', 'success');
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    data.createdBy = firebase.auth().currentUser.uid;
                    await db.collection('interlogic').add(data);
                    showToast('✓ Registro creado', 'success');

                    // Save last values to localStorage for quick entry
                    localStorage.setItem('il_last_values', JSON.stringify({
                        empresa: data.empresa,
                        vendedor: data.vendedor,
                        zona: data.zona,
                        condicionPago: data.condicionPago,
                        cobrador: data.cobrador
                    }));
                }

                // Auto-save client to clientes collection
                if (data.cliente && window.Clientes) {
                    Clientes.saveFromRecord({
                        nombre: data.cliente,
                        direccion: data.direccion,
                        telefono: data.telefono,
                        zona: data.zona,
                        vendedor: data.vendedor,
                        empresa: data.empresa,
                        condicionPago: data.condicionPago
                    });

                    if (data.condicionPago === 'Crédito' && !isNC) {
                        setTimeout(async () => {
                            try {
                                const eqNombre = data.cliente.toLowerCase().trim();
                                const cliSnap = await firebase.firestore().collection('clientes')
                                    .where('nombreNorm', '==', eqNombre).limit(1).get();
                                if (!cliSnap.empty) {
                                    const cliData = cliSnap.docs[0].data();
                                    const limite = parseFloat(cliData.limiteCredito) || 0;
                                    if (limite > 0) {
                                        const deudaTotal = Interlogic.records.reduce(function(s, r) {
                                            if (r.cliente === data.cliente && r.condicionPago === 'Crédito') {
                                                var cob = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
                                                return s + Math.max(0, Number(r.venta || 0) - cob);
                                            }
                                            return s;
                                        }, 0);
                                        if (deudaTotal > limite) {
                                            showToast('⚠️ ATENCIÓN: La deuda total de ' + data.cliente + ' ($' + formatNumber(deudaTotal, 2) + ') excede su límite de crédito ($' + formatNumber(limite, 2) + ')', 'warning');
                                        }
                                    }
                                }
                            } catch(e) { console.warn('Credit limit check error:', e.message); }
                        }, 1000);
                    }
                }
                // Invalidar caché de búsqueda para que recoja el nuevo cliente
                Interlogic._invalidateClientCache();
                if (this._saveAndAddAnother) {
                    this._saveAndAddAnother = false;
                    modal.remove();
                    this.showForm(); // Re-open form with last values
                    return;
                }

                modal.remove();
            } catch (error) {
                console.error('Error saving record:', error);
                showToast('Error al guardar: ' + error.message, 'error');
            } finally {
                setButtonLoading(saveBtn, false);
            }
        });
    },

    // Delete a record
    async deleteRecord(recordId) {
        if (!window.permissions?.canDelete) {
            showToast('No tienes permisos para eliminar registros', 'error');
            return;
        }
        if (!await showConfirm('¿Estás seguro de eliminar este registro?', 'Esta acción no se puede deshacer.')) return;

        try {
            console.log('🗑️ Intentando eliminar registro:', recordId);
            await firebase.firestore().collection('interlogic').doc(recordId).delete();
            console.log('✅ Registro eliminado de Firestore');

            // Local update for immediate feedback
            this.records = this.records.filter(r => r.id !== recordId);
            this.applyFilters();

            showToast('✓ Registro eliminado exitosamente', 'success');
        } catch (error) {
            console.error('❌ Error deleting record:', error);
            showToast('Error al eliminar: ' + error.message, 'error');
        }
    },
    // Duplicate a record
    duplicateRecord(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record) return;
        // Open form with data from this record (no recordId = create new)
        this.showForm(null, record);
    },

    // Show Import Excel modal
    showImportExcel() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <h2 style="margin-bottom: 1.5rem;">📤 Importar desde Excel</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Selecciona un archivo Excel (.xlsx) con las columnas en este orden:</p>
                <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 0.85rem; overflow-x: auto;">
                    <code>Guía | Empresa | Fecha | Doc | # Doc | Cliente | Teléfono | Zona | Vendedor | Condición Pago | Venta | Cobrador | Total | Bultos</code>
                </div>
                <div class="form-group" style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.5rem;">
                        <input type="checkbox" id="import-use-custom-date" checked style="width: 18px; height: 18px; cursor: pointer;">
                        <strong>📅 Usar fecha personalizada para todos los registros</strong>
                    </label>
                    <input type="date" id="import-custom-date" value="${getLocalDateString()}" style="padding: 0.5rem 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); width: 100%; font-size: 0.95rem;">
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.4rem;">Si está activado, todos los registros importados usarán esta fecha en lugar de la fecha del Excel.</p>
                </div>
                <div class="form-group">
                    <input type="file" id="import-file" accept=".xlsx,.xls,.csv" style="padding: 1rem; border: 2px dashed var(--gray-300); border-radius: var(--radius-md); width: 100%; cursor: pointer;">
                </div>
                <div id="import-preview" style="display: none; margin-top: 1rem; max-height: 300px; overflow-y: auto;"></div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="button" class="btn btn-secondary" id="import-cancel">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="import-confirm" disabled>Importar Registros</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Toggle date input based on checkbox
        const customDateCheckbox = document.getElementById('import-use-custom-date');
        const customDateInput = document.getElementById('import-custom-date');
        customDateCheckbox.addEventListener('change', () => {
            customDateInput.disabled = !customDateCheckbox.checked;
            customDateInput.style.opacity = customDateCheckbox.checked ? '1' : '0.5';
        });

        let parsedData = [];

        document.getElementById('import-file').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    // Skip header row if first row looks like headers
                    const startRow = (rows[0] && typeof rows[0][0] === 'string' && isNaN(rows[0][0])) ? 1 : 0;

                    parsedData = [];
                    for (let i = startRow; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r || r.length === 0 || (!r[0] && !r[5])) continue; // Skip empty rows
                        parsedData.push({
                            guia: String(r[0] || ''),
                            empresa: String(r[1] || ''),
                            fecha: r[2] || null,
                            doc: String(r[3] || ''),
                            docNum: String(r[4] || ''),
                            cliente: String(r[5] || ''),
                            telefono: String(r[6] || ''),
                            zona: String(r[7] || ''),
                            vendedor: String(r[8] || ''),
                            condicionPago: String(r[9] || ''),
                            venta: Number(r[10]) || 0,
                            cobrador: String(r[11] || ''),
                            total: Number(r[12]) || 0,
                            bultos: Number(r[13]) || 0
                        });
                    }

                    // Show preview
                    const preview = document.getElementById('import-preview');
                    if (parsedData.length > 0) {
                        preview.style.display = 'block';
                        preview.innerHTML = `
                            <p style="margin-bottom: 0.5rem;"><strong>${parsedData.length} registros encontrados:</strong></p>
                            <table style="width: 100%; font-size: 0.8rem;">
                                <thead><tr><th>Guía</th><th>Empresa</th><th>Cliente</th><th>Venta</th><th>Bultos</th></tr></thead>
                                <tbody>
                                    ${parsedData.slice(0, 10).map(d => `
                                        <tr>
                                            <td>${sanitizeHTML(d.guia || '')}</td>
                                            <td>${sanitizeHTML(d.empresa || '')}</td>
                                            <td>${sanitizeHTML(d.cliente || '')}</td>
                                            <td>$${formatNumber(d.venta, 2)}</td>
                                            <td>${formatNumber(d.bultos || 0)}</td>
                                        </tr>
                                    `).join('')}
                                    ${parsedData.length > 10 ? '<tr><td colspan="5" style="text-align:center">... y ' + (parsedData.length - 10) + ' más</td></tr>' : ''}
                                </tbody>
                            </table>
                        `;
                        document.getElementById('import-confirm').disabled = false;
                    } else {
                        preview.style.display = 'block';
                        preview.innerHTML = '<p style="color: var(--error);">No se encontraron registros válidos en el archivo.</p>';
                    }
                } catch (err) {
                    console.error('Error parsing Excel:', err);
                    showToast('Error al leer el archivo: ' + err.message, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        };

        document.getElementById('import-confirm').onclick = async () => {
            if (parsedData.length === 0) return;

            const confirmBtn = document.getElementById('import-confirm');
            setButtonLoading(confirmBtn, true);

            try {
                const db = firebase.firestore();
                const uid = firebase.auth().currentUser.uid;

                // Check if user wants a custom date for all records
                const useCustomDate = document.getElementById('import-use-custom-date').checked;
                const customDateVal = document.getElementById('import-custom-date').value;
                let customFirebaseDate = null;
                if (useCustomDate && customDateVal) {
                    const [y, m, d] = customDateVal.split('-').map(Number);
                    customFirebaseDate = firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
                }

                const chunkSize = 500;
                for (let i = 0; i < parsedData.length; i += chunkSize) {
                    const chunk = parsedData.slice(i, i + chunkSize);
                    const batch = db.batch();
                    chunk.forEach(record => {
                        const ref = db.collection('interlogic').doc();
                        const costoEnvio = record.bultos * 1.85;
                        const costoPorcentaje = record.venta > 0 ? (costoEnvio / record.venta) * 100 : 0;

                        let firebaseDate = customFirebaseDate; // Use custom date if set
                        if (!customFirebaseDate && record.fecha) {
                            try {
                                let d = record.fecha;
                                if (typeof d === 'number') {
                                    d = new Date((d - 25569) * 86400 * 1000);
                                } else if (!(d instanceof Date)) {
                                    d = new Date(d);
                                }
                                if (!isNaN(d.getTime())) {
                                    firebaseDate = firebase.firestore.Timestamp.fromDate(d);
                                }
                            } catch (e) { /* ignore */ }
                        }

                        batch.set(ref, {
                            ...record,
                            fecha: firebaseDate,
                            costoEnvio,
                            costoPorcentaje,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            createdBy: uid,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await batch.commit();
                }

                // Auto-save unique clients from imported data
                if (window.Clientes) {
                    const seenClients = new Set();
                    for (const record of parsedData) {
                        if (record.cliente && !seenClients.has(record.cliente.toLowerCase().trim())) {
                            seenClients.add(record.cliente.toLowerCase().trim());
                            Clientes.saveFromRecord({
                                nombre: record.cliente,
                                direccion: record.direccion || '',
                                telefono: record.telefono || '',
                                zona: record.zona || '',
                                vendedor: record.vendedor || '',
                                empresa: record.empresa || '',
                                condicionPago: record.condicionPago || ''
                            });
                        }
                    }
                    Interlogic._invalidateClientCache();
                }

                showToast(`✓ ${parsedData.length} registros importados`, 'success');
                modal.remove();
                await this.loadRecords();
            } catch (error) {
                console.error('Import error:', error);
                showToast('Error al importar: ' + error.message, 'error');
                setButtonLoading(confirmBtn, false);
            }
        };

        document.getElementById('import-cancel').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    },

    // Column visibility methods
    toggleColumn(colKey, visible) {
        if (visible) {
            this.hiddenColumns = this.hiddenColumns.filter(c => c !== colKey);
        } else {
            if (!this.hiddenColumns.includes(colKey)) {
                this.hiddenColumns.push(colKey);
            }
        }
        localStorage.setItem('il_hidden_cols', JSON.stringify(this.hiddenColumns));
        this.applyColumnVisibility();
    },

    showAllColumns() {
        this.hiddenColumns = [];
        localStorage.setItem('il_hidden_cols', '[]');
        // Update checkboxes
        const popup = document.getElementById('columns-popup');
        if (popup) {
            popup.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        }
        this.applyColumnVisibility();
    },

    applyColumnVisibility() {
        // Remove old style
        let styleEl = document.getElementById('il-col-visibility-style');
        if (styleEl) styleEl.remove();

        if (this.hiddenColumns.length === 0) return;

        // Build CSS rules using nth-child to hide columns by index
        const rules = [];
        this.hiddenColumns.forEach(colKey => {
            const idx = this.columnDefs.findIndex(c => c.key === colKey);
            if (idx >= 0) {
                const nth = idx + 2; // nth-child is 1-based, +2 because checkbox column is first
                rules.push(`#il-data-table th:nth-child(${nth}), #il-data-table td:nth-child(${nth}) { display: none; }`);
            }
        });

        if (rules.length > 0) {
            styleEl = document.createElement('style');
            styleEl.id = 'il-col-visibility-style';
            styleEl.textContent = rules.join('\n');
            document.head.appendChild(styleEl);
        }
    }
};

// Make available globally
window.Interlogic = Interlogic;
