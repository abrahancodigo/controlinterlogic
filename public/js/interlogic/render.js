// ===================================
// Interlogic - Render Module (Desktop & Mobile)
// ===================================

const InterlogicRender = {
    async render() {
        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }
        return this.renderDesktop();
    },

    async renderDesktop() {
        const contentArea = document.getElementById('content-area');

        if (this._desktopAbortController) {
            this._desktopAbortController.abort();
        }
        this._desktopAbortController = new AbortController();
        const { signal } = this._desktopAbortController;

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
                        <div id="columns-popup" class="filter-popup" style="min-width: 200px; position: absolute; right: 0; top: 100%;" onclick="event.stopPropagation()">
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

            ${SharedComponents.renderStatsGrid([
                { label: 'Total Venta', id: 'stat-total-venta' },
                { label: 'Total Bultos', id: 'stat-total-bultos' },
                { label: 'Costo Envío', id: 'stat-total-envio' },
                { label: '% Costo', id: 'stat-total-porcentaje' }
            ], { containerId: 'interlogic-stats' })}

            ${SharedComponents.renderSearchBar({
                id: 'global-search',
                placeholder: '🔍 Buscar en todas las columnas...',
                value: this.filters.search || '',
                containerStyle: 'margin-bottom: 0.5rem;'
            })}

            <div class="card">
                <div id="il-pagination-top" style="margin-bottom: 0.6rem;"></div>
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
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'docNum')">
                                        Doc # <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-docNum" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('docNum', this.value)">
                                            <div class="filter-options-list" id="filter-options-docNum"></div>
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
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'departamento')">
                                        Departamento <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-departamento" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('departamento', this.value)">
                                            <div class="filter-options-list" id="filter-options-departamento"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'municipio')">
                                        Municipio <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-municipio" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('municipio', this.value)">
                                            <div class="filter-options-list" id="filter-options-municipio"></div>
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
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'entrega')">
                                        Entrega <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-entrega" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..."
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('entrega', this.value)">
                                            <div class="filter-options-list" id="filter-options-entrega"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'cobra')">
                                        Cobra <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-cobra" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..."
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('cobra', this.value)">
                                            <div class="filter-options-list" id="filter-options-cobra"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Interlogic.toggleFilter(event, 'encargado')">
                                        Encargado <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="filter-popup-encargado" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..."
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Interlogic.searchInFilter('encargado', this.value)">
                                            <div class="filter-options-list" id="filter-options-encargado"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="interlogic-table-body">
                            <tr>
                                <td colspan="20" style="text-align: center; padding: 1rem;">Cargando registros...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        await this.loadRecords();

        document.getElementById('filter-start-date').addEventListener('change', (e) => {
            this.filters.startDate = e.target.value;
            this.reloadListener(true);
        });
        document.getElementById('filter-end-date').addEventListener('change', (e) => {
            this.filters.endDate = e.target.value;
            this.reloadListener(true);
        });
        document.getElementById('btn-add-record').addEventListener('click', () => {
            if (canCreate) this.showForm();
        });
        document.getElementById('btn-import-excel').addEventListener('click', () => {
            if (canCreate) this.showImportExcel();
        });
        document.getElementById('btn-clear-all-filters').addEventListener('click', () => this.clearAllFilters());
        document.getElementById('btn-export-excel').addEventListener('click', () => this.exportToExcel());

        let searchTimer;
        document.getElementById('global-search').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this.applyFilters(), 150);
        });

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

        document.getElementById('interlogic-table-body').addEventListener('change', (e) => {
            if (e.target.classList.contains('row-checkbox')) {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    this.selectedRecords.add(id);
                } else {
                    this.selectedRecords.delete(id);
                }
                const checkboxes = document.querySelectorAll('.row-checkbox');
                const selectAll = document.getElementById('select-all-checkbox');
                selectAll.checked = this.selectedRecords.size >= checkboxes.length && checkboxes.length > 0;
                selectAll.indeterminate = this.selectedRecords.size > 0 && this.selectedRecords.size < checkboxes.length;
                this.updateBulkDeleteButton();
            }
        });

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

        this.applyColumnVisibility();

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

        if (!this.eventDelegationSetup) {
            contentArea.addEventListener('click', (e) => {
                const pageBtnAll = e.target.closest('.page-btn-all');
                if (pageBtnAll) {
                    this.showAll = pageBtnAll.dataset.mode === 'all';
                    if (this.showAll) this.currentPage = 1;
                    this._renderTableNow();
                    return;
                }

                const pageBtn = e.target.closest('.page-btn');
                if (pageBtn) {
                    const p = parseInt(pageBtn.dataset.page, 10);
                    if (!isNaN(p) && p >= 1) {
                        this.currentPage = p;
                        this._renderTableNow();
                    }
                    return;
                }

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
                <input type="text" id="m-global-search" placeholder="Buscar por guía, cliente, departamento..." value="${this.filters.search || ''}">
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
            <div id="m-pagination" style="display:none;justify-content:center;align-items:center;gap:8px;padding:12px 0;flex-wrap:wrap;"></div>
        `;

        await this.loadRecords();

        document.getElementById('m-filter-start').addEventListener('change', e => { this.filters.startDate = e.target.value; this.reloadListener(true); });
        document.getElementById('m-filter-end').addEventListener('change', e => { this.filters.endDate = e.target.value; this.reloadListener(true); });
        let mSearchTimer;
        document.getElementById('m-global-search').addEventListener('input', e => {
            this.filters.search = e.target.value;
            clearTimeout(mSearchTimer);
            mSearchTimer = setTimeout(() => this.applyFilters(), 150);
        });
        document.getElementById('m-btn-add').addEventListener('click', () => this.showMobileForm());
        document.getElementById('m-btn-export').addEventListener('click', () => this.mobileExportExcel());
        document.getElementById('m-btn-filter').addEventListener('click', () => this.showMobileFilters());
    },

    renderMobileCards() {
        var list = document.getElementById('m-data-list');
        if (!list) return;

        var self = this;
        var canEdit = window.permissions?.canEdit;
        var canDelete = window.permissions?.canDelete;

        var totalRows = this.filteredRecords.length;
        var pageSize = this.pageSize || 100;
        var totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;
        var startIdx = (this.currentPage - 1) * pageSize;
        var pageRecords = this.filteredRecords.slice(startIdx, startIdx + pageSize);

        if (this.filteredRecords.length === 0) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📭</div><div class="m-empty-title">Sin registros</div><div class="m-empty-text">No se encontraron resultados.</div></div>';
        } else {
            list.innerHTML = pageRecords.map(function(r) {
                var empresaBadge = r.doc === 'NC' ? 'nc' : (r.empresa === 'DALSE' ? 'primary' : (r.empresa ? 'warning' : ''));
                var idJs = r.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                var html = '<div class="m-data-card' + (r.entregado === true ? ' m-card-entregada' : '') + '" onclick="Interlogic.showMobileDetail(\'' + idJs + '\')">';
                html += '<div class="m-card-header"><span class="m-card-title">#' + sanitizeHTML(r.guia || r.id.substring(0,6).toUpperCase()) + '</span>';
                if (r.doc === 'NC') html += '<span class="m-card-badge badge-nc">NC</span>';
                else if (empresaBadge) html += '<span class="m-card-badge ' + empresaBadge + '">' + sanitizeHTML(r.empresa || '') + '</span>';
                html += '</div><div class="m-card-rows">';
                html += '<div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value">' + sanitizeHTML(r.cliente || '-') + '</span></div>';
                html += '<div class="m-card-row"><span class="m-card-label">Venta</span><span class="m-card-value money" style="' + (r.doc === 'NC' ? 'color:#ef4444;font-weight:700;' : '') + '">' + formatCurrency(r.venta || 0) + '</span></div>';
                html += '<div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">' + (r.fecha ? formatDateShort(r.fecha) : '-') + '</span></div>';
                html += '<div class="m-card-row"><span class="m-card-label">Bultos</span><span class="m-card-value">' + formatNumber(r.bultos || 0) + '</span></div>';
                html += '<div class="m-card-row" onclick="event.stopPropagation(); Interlogic.toggleCellField(\'' + idJs + '\', \'entrega\')" style="cursor: pointer;">';
                html += '<span class="m-card-label">🚚 Entrega</span><span class="m-card-value">' + sanitizeHTML(r.entrega || '—') + '</span></div>';
                html += '<div class="m-card-row" onclick="event.stopPropagation(); Interlogic.toggleCellField(\'' + idJs + '\', \'cobra\')" style="cursor: pointer;">';
                html += '<span class="m-card-label">💰 Cobra</span><span class="m-card-value">' + sanitizeHTML(r.cobra || '—') + '</span></div>';
                html += '<div class="m-card-row"><span class="m-card-label">👤 Encargado</span><span class="m-card-value">' + sanitizeHTML(r.encargado || '—') + '</span></div>';
                if (r.formaPago) {
                    var fpColors = { Efectivo: { bg: '#f0fdf4', fg: '#166534', icon: '💵' }, Cheque: { bg: '#eff6ff', fg: '#1e40af', icon: '🏦' }, Transferencia: { bg: '#faf5ff', fg: '#6b21a8', icon: '📱' }, Abono: { bg: '#fff7ed', fg: '#9a3412', icon: '📝' } };
                    var fp = fpColors[r.formaPago] || { bg: '#f3f4f6', fg: '#374151', icon: '💳' };
                    html += '<div class="m-card-row"><span class="m-card-label">💳 Pago</span><span class="m-card-value" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;background:' + fp.bg + ';color:' + fp.fg + ';font-weight:600;font-size:0.78rem;">' + fp.icon + ' ' + sanitizeHTML(r.formaPago) + '</span></div>';
                }
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

        var totalVenta = this.filteredRecords.reduce(function(s, r) { return s + self.signedAmount(r, 'venta'); }, 0);
        var totalBultos = this.filteredRecords.reduce(function(s, r) { return s + self.signedAmount(r, 'bultos'); }, 0);
        var totalEnvio = this.filteredRecords.reduce(function(s, r) { return s + self.signedAmount(r, 'costoEnvio'); }, 0);
        var totalPct = totalVenta > 0 ? ((totalEnvio / totalVenta) * 100) : 0;

        var setText = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
        setText('ms-venta', formatCurrencySigned(totalVenta));
        setText('ms-bultos', formatNumber(totalBultos));
        setText('ms-envio', formatCurrencySigned(totalEnvio));
        setText('ms-pct', formatNumber(totalPct, 2) + '%');
        setText('ms-count', this.filteredRecords.length);

        this._renderMobilePagination(totalRows, totalPages);
    },

    _renderMobilePagination(totalRows, totalPages) {
        var pagEl = document.getElementById('m-pagination');
        if (!pagEl) return;
        if (totalRows === 0) {
            pagEl.style.display = 'none';
            pagEl.innerHTML = '';
            return;
        }
        pagEl.style.display = 'flex';
        var prevPage = Math.max(1, this.currentPage - 1);
        var nextPage = Math.min(totalPages, this.currentPage + 1);
        var btnCls = 'style="cursor:pointer;padding:8px 14px;font-size:0.85rem;font-weight:700;border:1px solid #e5e5ea;border-radius:10px;background:#fff;"';
        var btnDis = 'style="cursor:not-allowed;opacity:0.4;padding:8px 14px;font-size:0.85rem;font-weight:700;border:1px solid #e5e5ea;border-radius:10px;background:#fff;"';
        var warnHtml = this._truncated
            ? '<div style="width:100%;text-align:center;font-size:0.75rem;color:#b45309;padding:6px 10px;background:#fff7ed;border-radius:8px;">⚠ Solo se muestran los ' + this.records.length.toLocaleString() + ' registros más recientes. <button type="button" onclick="Interlogic.loadFullRange()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;margin-left:4px;">⬇ Cargar todo</button></div>'
            : (this._fullMode ? '<div style="width:100%;text-align:center;font-size:0.75rem;color:#1e40af;padding:6px 10px;background:#eff6ff;border-radius:8px;">📊 Rango completo (' + this.records.length.toLocaleString() + ' registros). <button type="button" onclick="Interlogic.reloadListener(true)" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;margin-left:4px;">↻ Tiempo real</button></div>' : '');
        pagEl.innerHTML = warnHtml +
            '<button type="button" class="m-page-btn" data-page="' + prevPage + '" ' + (this.currentPage <= 1 ? 'disabled' : '') + ' ' + (this.currentPage <= 1 ? btnDis : btnCls) + '>‹ Ant</button>' +
            '<span style="font-size:0.82rem;color:#555;padding:0 4px;">' + this.currentPage + ' / ' + totalPages + '</span>' +
            '<button type="button" class="m-page-btn" data-page="' + nextPage + '" ' + (this.currentPage >= totalPages ? 'disabled' : '') + ' ' + (this.currentPage >= totalPages ? btnDis : btnCls) + '>Sig ›</button>';
        if (!this._mobilePaginationBound) {
            this._mobilePaginationBound = true;
            pagEl.addEventListener('click', (function(e) {
                var btn = e.target.closest('.m-page-btn');
                if (!btn) return;
                var p = parseInt(btn.dataset.page, 10);
                if (!isNaN(p) && p >= 1) { this.currentPage = p; this.renderMobileCards(); }
            }).bind(this));
        }
    },

    renderTable() {
        if (this._renderScheduled) return;
        this._renderScheduled = true;
        requestAnimationFrame(() => {
            this._renderScheduled = false;
            this._renderTableNow();
        });
    },

    /**
     * Barra de paginación reutilizable (botones « ‹ › » + "Mostrando X–Y de Z").
     * Se renderiza tanto arriba como abajo de la tabla para no tener que bajar
     * hasta el final para cambiar de página.
     */
    _paginationBarHTML() {
        const totalRows = this.filteredRecords.length;
        const pageSize = this.pageSize || 100;
        const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
        const startIdx = (this.currentPage - 1) * pageSize;
        const firstShown = totalRows === 0 ? 0 : (startIdx + 1);
        const lastShown = totalRows === 0 ? 0 : Math.min(startIdx + pageSize, totalRows);
        const prevPage = Math.max(1, this.currentPage - 1);
        const nextPage = Math.min(totalPages, this.currentPage + 1);
        const pageBtnStyle = 'cursor:pointer;padding:0.35rem 0.65rem;font-size:0.8rem;font-weight:600;line-height:1;border:1px solid var(--border-color);border-radius:6px;background:#fff;color:var(--text-primary);';
        const pageBtnDisabled = 'cursor:not-allowed;opacity:0.4;padding:0.35rem 0.65rem;font-size:0.8rem;font-weight:600;line-height:1;border:1px solid var(--border-color);border-radius:6px;background:#fff;color:var(--text-primary);';
        const allBtnStyle = 'cursor:pointer;padding:0.35rem 0.65rem;font-size:0.8rem;font-weight:600;line-height:1;border:1px solid var(--border-color);border-radius:6px;background:#2563eb;color:#fff;';

        if (this.showAll) {
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">Mostrando <strong>${totalRows}</strong> de <strong>${totalRows}</strong> registros (sin paginación)</span>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <button type="button" class="page-btn-all" data-mode="page" style="${allBtnStyle}">↩ Ver paginado</button>
                    </div>
                </div>
            `;
        }

        return `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
                <span style="font-size: 0.8rem; color: var(--text-secondary);">Mostrando <strong>${firstShown}–${lastShown}</strong> de <strong>${totalRows}</strong> registros</span>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <button type="button" class="page-btn" data-page="1" ${this.currentPage <= 1 ? 'disabled' : ''} style="${this.currentPage <= 1 ? pageBtnDisabled : pageBtnStyle}">«</button>
                    <button type="button" class="page-btn" data-page="${prevPage}" ${this.currentPage <= 1 ? 'disabled' : ''} style="${this.currentPage <= 1 ? pageBtnDisabled : pageBtnStyle}">‹</button>
                    <span style="font-size: 0.8rem; color: var(--text-secondary); padding: 0 0.25rem;">Página <strong>${this.currentPage}</strong> / ${totalPages}</span>
                    <button type="button" class="page-btn" data-page="${nextPage}" ${this.currentPage >= totalPages ? 'disabled' : ''} style="${this.currentPage >= totalPages ? pageBtnDisabled : pageBtnStyle}">›</button>
                    <button type="button" class="page-btn" data-page="${totalPages}" ${this.currentPage >= totalPages ? 'disabled' : ''} style="${this.currentPage >= totalPages ? pageBtnDisabled : pageBtnStyle}">»</button>
                    <button type="button" class="page-btn-all" data-mode="all" style="${allBtnStyle}">📄 Ver todo</button>
                </div>
            </div>
        `;
    },

    _renderTableNow() {
        const tableBody = document.getElementById('interlogic-table-body');
        if (!tableBody) return;

        for (let field in this.filters) {
            const header = document.querySelector(`[onclick*="toggleFilter(event, '${field}')"]`);
            if (header) {
                const isActive = Array.isArray(this.filters[field]) ? this.filters[field].length > 0 : !!this.filters[field];
                if (isActive) header.classList.add('filter-active');
                else header.classList.remove('filter-active');
            }
        }

        if (this.filteredRecords.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="20" style="text-align: center; padding: 1rem;">No hay registros disponibles que coincidan con los filtros.</td>
                </tr>
            `;
            const tfoot = document.getElementById('interlogic-table-footer');
            if (tfoot) tfoot.innerHTML = '';
            const topPag = document.getElementById('il-pagination-top');
            if (topPag) topPag.innerHTML = '';
            return;
        }

        const canEdit = window.permissions?.canEdit;
        const canCreate = window.permissions?.canCreate;
        const canDelete = window.permissions?.canDelete;

        const totalRows = this.filteredRecords.length;
        const pageSize = this.pageSize || 100;
        const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;
        const startIdx = (this.currentPage - 1) * pageSize;
        const pageRecords = this.showAll ? this.filteredRecords : this.filteredRecords.slice(startIdx, startIdx + pageSize);

        tableBody.innerHTML = pageRecords.map(record => `
            <tr style="${record.entregado === true ? 'background: #dcfce7; border-left: 4px solid #16a34a;' : ''}">
                <td style="text-align: center;"><input type="checkbox" class="row-checkbox" data-id="${record.id}" ${this.selectedRecords.has(record.id) ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;"></td>
                <td data-label="Guía"><strong>${sanitizeHTML(record.guia || '')}</strong></td>
                <td data-label="Empresa"><span class="badge ${record.empresa === 'DALSE' ? 'badge-primary' : 'badge-accent'}">${sanitizeHTML(record.empresa || '')}</span></td>
                <td data-label="Fecha">${record.fecha ? formatDateShort(record.fecha) : ''}</td>
                <td data-label="Doc">${sanitizeHTML(record.doc || '')}</td>
                <td data-label="Doc #">${sanitizeHTML(record.docNum || '')}</td>
                <td data-label="Cliente">${sanitizeHTML(record.cliente || '')}${record.direccion ? '<br><span style="font-size: 0.8rem; color: var(--text-primary);">📍 ' + sanitizeHTML(record.direccion) + '</span>' : ''}</td>
                <td data-label="Departamento">${sanitizeHTML(record.departamento || '')}</td>
                <td data-label="Municipio">${sanitizeHTML(record.municipio || '')}</td>
                <td data-label="Vendedor">${sanitizeHTML(record.vendedor || '')}</td>
                <td data-label="Cond. Pago">${sanitizeHTML(record.condicionPago || '')}</td>
                <td data-label="Venta" style="${record.doc === 'NC' ? 'color: #ef4444; font-weight: 700;' : ''}">${formatCurrency(record.venta || 0)}</td>
                <td data-label="Bultos">${formatNumber(record.bultos || 0)}</td>
                <td data-label="Cobrador">${sanitizeHTML(record.cobrador || '')}</td>
                <td data-label="Costo Envío">${formatCurrency(record.costoEnvio || 0)}</td>
                <td data-label="% Costo">${formatNumber(record.costoPorcentaje || 0, 2)}%</td>
                <td data-label="Observaciones" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sanitizeHTML(record.observations || '')}">${sanitizeHTML(record.observations || '')}</td>
                <td data-label="Entrega" style="cursor: pointer;" onclick="Interlogic.toggleCellField('${record.id}', 'entrega')" title="Clic para cambiar">
                    <span class="badge ${record.entrega === 'DALSE' ? 'badge-primary' : (record.entrega === 'INTERLOGISTIC' ? 'badge-accent' : (record.entrega === 'XPRESS' ? 'badge-warning' : 'badge-ghost'))}">${sanitizeHTML(record.entrega || '—')}</span>
                </td>
                <td data-label="Cobra" style="cursor: pointer;" onclick="Interlogic.toggleCellField('${record.id}', 'cobra')" title="Clic para cambiar">
                    <span class="badge ${record.cobra === 'DALSE' ? 'badge-primary' : (record.cobra === 'INTERLOGISTIC' ? 'badge-accent' : (record.cobra === 'XPRESS' ? 'badge-warning' : 'badge-ghost'))}">${sanitizeHTML(record.cobra || '—')}</span>
                </td>
                <td data-label="Encargado">${sanitizeHTML(record.encargado || '')}</td>
                <td data-label="Forma Pago">
                    ${record.formaPago ? '<span class="badge ' + (record.formaPago === 'Efectivo' ? 'badge-success' : record.formaPago === 'Cheque' ? 'badge-primary' : record.formaPago === 'Transferencia' ? 'badge-purple' : 'badge-warning') + '">' + (record.formaPago === 'Efectivo' ? '💵 ' : record.formaPago === 'Cheque' ? '🏦 ' : record.formaPago === 'Transferencia' ? '📱 ' : '📝 ') + sanitizeHTML(record.formaPago) + '</span>' : '<span class="badge badge-ghost">—</span>'}
                </td>
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

        const totals = this.filteredRecords.reduce((acc, r) => {
            acc.venta += this.signedAmount(r, 'venta');
            acc.bultos += this.signedAmount(r, 'bultos');
            acc.cajas += Number(r.cobrador || 0);
            acc.envio += this.signedAmount(r, 'costoEnvio');
            return acc;
        }, { venta: 0, bultos: 0, cajas: 0, envio: 0 });

        const totalPorcentaje = totals.venta > 0 ? (totals.envio / totals.venta) * 100 : 0;

        let tfoot = document.getElementById('interlogic-table-footer');
        if (!tfoot) {
            tfoot = document.createElement('tfoot');
            tfoot.id = 'interlogic-table-footer';
            document.getElementById('il-data-table').appendChild(tfoot);
        }

        const topPagEl = document.getElementById('il-pagination-top');
        if (topPagEl) topPagEl.innerHTML = this._paginationBarHTML();

        const truncNotice = this._truncated
            ? '<tr><td colspan="20" style="padding:0.5rem;background:#fff7ed;color:#b45309;font-size:0.78rem;text-align:center;">⚠ Para optimizar rendimiento y costo, solo se muestran los <strong>' + this.records.length.toLocaleString() + '</strong> registros más recientes del rango. <button type="button" onclick="Interlogic.loadFullRange()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:0.75rem;font-weight:700;cursor:pointer;margin-left:6px;">⬇ Cargar todo el rango</button></td></tr>\n'
            : (this._fullMode ? '<tr><td colspan="20" style="padding:0.4rem;background:#eff6ff;color:#1e40af;font-size:0.78rem;text-align:center;">📊 Mostrando los <strong>' + this.records.length.toLocaleString() + '</strong> registros del rango completo (modo sin tiempo real). <button type="button" onclick="Interlogic.reloadListener(true)" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:0.75rem;font-weight:700;cursor:pointer;margin-left:6px;">↻ Volver a tiempo real</button></td></tr>\n' : '');

        tfoot.innerHTML = `
            ${truncNotice}
            <tr style="font-weight: 700; background: var(--gray-50);">
                <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                <td style="text-align: right;">TOTALES</td>
                <td>${formatCurrencySigned(totals.venta)}</td>
                <td>${formatNumber(totals.bultos)}</td>
                <td>${totals.cajas}</td>
                <td>${formatCurrencySigned(totals.envio)}</td>
                <td>${formatNumber(totalPorcentaje, 2)}%</td>
                <td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
            ${this._truncated ? '<tr><td colspan="20" style="padding: 0.35rem 0;"><div style="font-size: 0.75rem; color: #b45309; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 6px 10px; text-align: center;">⚠️ El rango tiene más de 2,000 registros (tope de descarga): se muestran solo los más recientes. <button type="button" onclick="Interlogic.loadFullRange()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;margin-left:6px;">⬇ Cargar todo</button></div></td></tr>' : ''}
            <tr>
                <td colspan="20" style="padding: 0.5rem 0;">
                    ${this._paginationBarHTML()}
                </td>
            </tr>
        `;

        const selectAll = document.getElementById('select-all-checkbox');
        if (selectAll) {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            selectAll.checked = checkboxes.length > 0 && this.selectedRecords.size >= checkboxes.length;
            selectAll.indeterminate = this.selectedRecords.size > 0 && this.selectedRecords.size < checkboxes.length;
        }

        this.updateBulkDeleteButton();
        this.updateStats();
    },

    updateStats() {
        const targetRecords = this.filteredRecords;
        const { totalVenta, totalBultos, totalEnvio } = targetRecords.reduce((acc, r) => {
            acc.totalVenta += this.signedAmount(r, 'venta');
            acc.totalBultos += this.signedAmount(r, 'bultos');
            acc.totalEnvio += this.signedAmount(r, 'costoEnvio');
            return acc;
        }, { totalVenta: 0, totalBultos: 0, totalEnvio: 0 });

        const porcentaje = totalVenta > 0 ? (totalEnvio / totalVenta) * 100 : 0;

        const elVenta = document.getElementById('stat-total-venta');
        const elBultos = document.getElementById('stat-total-bultos');
        const elEnvio = document.getElementById('stat-total-envio');
        const elPct = document.getElementById('stat-total-porcentaje');
        
        if (elVenta) elVenta.textContent = formatCurrencySigned(totalVenta);
        if (elBultos) elBultos.textContent = formatNumber(totalBultos);
        if (elEnvio) elEnvio.textContent = formatCurrencySigned(totalEnvio);
        if (elPct) elPct.textContent = `${formatNumber(porcentaje, 2)}% `;
    }
};

window.InterlogicRender = InterlogicRender;
