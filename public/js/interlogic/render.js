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
        this.isMobile = false;
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
            <div class="il-premium">
            ${SharedComponents.renderModuleHeader({
                icon: 'interlogic',
                title: 'Control Interlogic',
                subtitle: 'Gestión automatizada de registros de despacho',
                actions: `
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <label for="filter-start-date" style="margin-bottom: 0; white-space: nowrap; font-size: 0.85rem;">📅 Desde:</label>
                        <input type="date" id="filter-start-date" value="${this.filters.startDate}" style="padding: 0.5rem; font-size: 1rem; border: 2px solid var(--border-color); border-radius: var(--radius-md); min-height: 44px;">
                        <label for="filter-end-date" style="margin-bottom: 0; white-space: nowrap; font-size: 0.85rem;">Hasta:</label>
                        <input type="date" id="filter-end-date" value="${this.filters.endDate}" style="padding: 0.5rem; font-size: 1rem; border: 2px solid var(--border-color); border-radius: var(--radius-md); min-height: 44px;">
                    </div>
                    <button id="btn-export-excel" class="btn btn-secondary">
                        📥 Excel
                    </button>
                    <button id="btn-export-pdf" class="btn btn-secondary">
                        🖨 PDF
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
                `
            })}

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
                            <tr class="il-skeleton-row"><td colspan="21"><span class="il-skeleton-bar" style="width: 98%;"></span></td></tr>
                            <tr class="il-skeleton-row"><td colspan="21"><span class="il-skeleton-bar" style="width: 92%;"></span></td></tr>
                            <tr class="il-skeleton-row"><td colspan="21"><span class="il-skeleton-bar" style="width: 96%;"></span></td></tr>
                            <tr class="il-skeleton-row"><td colspan="21"><span class="il-skeleton-bar" style="width: 88%;"></span></td></tr>
                            <tr class="il-skeleton-row"><td colspan="21"><span class="il-skeleton-bar" style="width: 94%;"></span></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            </div>
        `;

        await this.loadRecords(Boolean(this.filters.startDate && this.filters.endDate));

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
        document.getElementById('btn-export-pdf').addEventListener('click', () => this._exportIlPdf());

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

                const editableCell = e.target.closest('.il-editable-cell');
                if (editableCell) {
                    const id = editableCell.getAttribute('data-record-id');
                    const field = editableCell.getAttribute('data-field');
                    if (id && field) this.editCellField(id, field, editableCell);
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
            <section class="mf-interlogic">
            <div class="mf-module-heading">
                <div><p class="mf-eyebrow">CONTROL DE DESPACHOS</p><h1>Interlogic</h1><p>Cada entrega, en un solo lugar.</p></div>
                <details class="mf-tools"><summary aria-label="Opciones de exportación">${this.mobileIcon('more')}</summary><div><button type="button" class="btn" id="m-btn-export">Exportar Excel</button><button type="button" class="btn" id="m-btn-pdf">Exportar PDF</button></div></details>
            </div>
            <div class="mf-search-controls">
                <div class="m-search-bar">${this.mobileIcon('search')}<input type="search" id="m-global-search" aria-label="Buscar registros" placeholder="Guía, cliente o destino" value="${sanitizeHTML(this.filters.search || '').replace(/"/g, '&quot;')}"></div>
                <button type="button" class="mf-filter-button" id="m-btn-filter" aria-label="Abrir filtros">${this.mobileIcon('filter')}<span id="m-filter-count"></span></button>
            </div>
            <div class="mf-periods" aria-label="Período de registros">
                <button type="button" data-m-period="today">Hoy</button><button type="button" data-m-period="week">Semana</button><button type="button" data-m-period="month">Mes</button><button type="button" data-m-period="custom">Elegir fechas</button>
            </div>
            <p class="mobile-scope" id="m-range-label"></p>
            <div class="mf-status-tabs" aria-label="Estado de entrega">
                <button type="button" data-m-status="all">Todas</button><button type="button" data-m-status="pending">Pendientes</button><button type="button" data-m-status="delivered">Entregadas</button><button type="button" data-m-status="cancelled">Anuladas</button>
            </div>
            <details class="mf-totals"><summary><span>Resumen de registros</span><strong id="ms-venta">$0</strong></summary><div class="m-stats-row" id="m-stats">
                <div class="m-stat-chip"><div class="m-stat-chip-label">Bultos</div><div class="m-stat-chip-value" id="ms-bultos">0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Costo Envío</div><div class="m-stat-chip-value" id="ms-envio">$0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">% Costo</div><div class="m-stat-chip-value" id="ms-pct">0%</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Registros</div><div class="m-stat-chip-value" id="ms-count">0</div></div>
            </div></details>
            <div class="mf-list-heading"><h2 id="m-result-count" aria-live="polite">Tus registros</h2>${window.permissions?.canCreate ? '<button type="button" class="btn btn-primary" id="m-btn-add">+ Nuevo</button>' : ''}</div>
            <div class="m-data-list" id="m-data-list">
                <div class="mf-loading" role="status"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><span>Cargando registros…</span></div>
            </div>
            <div id="m-pagination" class="mf-pagination" style="display:none;"></div>
            </section>
        `;

        let mSearchTimer;
        document.getElementById('m-global-search').addEventListener('input', e => {
            this.filters.search = e.target.value;
            clearTimeout(mSearchTimer);
            mSearchTimer = setTimeout(() => this.applyFilters(), 150);
        });

        if (!this._mobileDelegationSetup) {
            this._mobileDelegationSetup = true;
            contentArea.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if (button?.disabled) return;
                if (button?.id === 'm-btn-add') { this.showMobileForm(); return; }
                if (button?.id === 'm-btn-export') { this.mobileExportExcel(); return; }
                if (button?.id === 'm-btn-pdf') { this._exportIlPdf(); return; }
                if (button?.id === 'm-btn-filter' || button?.hasAttribute('data-m-open-filter')) { this.showMobileFilters(); return; }
                if (button?.dataset.mPeriod) { this.setMobilePeriod(button.dataset.mPeriod); return; }
                if (button?.dataset.mStatus) { this.mobileStatus = button.dataset.mStatus; this.applyFilters(); return; }
                const sheet = e.target.closest('.mf-sheet-root');
                if (sheet) {
                    if (e.target.closest('[data-m-close]')) { this.closeMobileSheet(sheet); return; }
                    if (button?.hasAttribute('data-m-filter-apply')) { this.applyMobileFilterSheet(sheet); return; }
                    if (button?.hasAttribute('data-m-filter-clear')) { this.closeMobileSheet(sheet); this.clearAllFilters(); return; }
                    if (button?.dataset.mDetailEdit) { const id = button.dataset.mDetailEdit; this.closeMobileSheet(sheet); this.showMobileForm(id); return; }
                    if (button?.dataset.mDetailField) { this.editCellField(button.dataset.recordId, button.dataset.mDetailField, button); return; }
                }
                const pageBtn = e.target.closest('.m-page-btn');
                if (pageBtn) { this.currentPage = Number(pageBtn.dataset.page); this.renderMobileCards(); document.querySelector('.mf-list-heading')?.scrollIntoView({ block: 'start' }); return; }
                const mEditBtn = e.target.closest('.m-btn-edit');
                if (mEditBtn) { const id = mEditBtn.getAttribute('data-record-id'); if (id) this.showMobileForm(id); return; }
                const mDupBtn = e.target.closest('.m-btn-duplicate');
                if (mDupBtn) { const id = mDupBtn.getAttribute('data-record-id'); if (id) this.duplicateRecord(id); return; }
                const mDelBtn = e.target.closest('.m-btn-delete');
                if (mDelBtn) { const id = mDelBtn.getAttribute('data-record-id'); if (id) this.deleteRecord(id); return; }
                if (e.target.closest('.mf-card-menu')) return;
                const mEditable = e.target.closest('.m-editable-cell');
                if (mEditable) { e.stopPropagation(); const id = mEditable.getAttribute('data-record-id'); const field = mEditable.getAttribute('data-field'); if (id && field) this.editCellField(id, field, mEditable); return; }
                const mCard = e.target.closest('.m-data-card');
                if (mCard && !e.target.closest('summary, a')) { const id = mCard.getAttribute('data-record-id'); if (id) this.showMobileDetail(id); return; }
            });
            contentArea.addEventListener('keydown', (e) => {
                const card = e.target.closest('.m-data-card[data-record-id]');
                if (card && e.target === card && ['Enter', ' '].includes(e.key)) { e.preventDefault(); this.showMobileDetail(card.dataset.recordId); }
                const sheet = e.target.closest('.mf-sheet-root');
                if (!sheet) return;
                if (e.key === 'Escape') { this.closeMobileSheet(sheet); return; }
                if (e.key !== 'Tab') return;
                const controls = [...sheet.querySelectorAll('button:not(:disabled), input, select, textarea, summary, a[href]')].filter(el => el.getClientRects().length);
                const first = controls[0], last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
            });
        }
        this.updateMobileControls();
        await this.loadRecords(Boolean(this.filters.startDate && this.filters.endDate));
    },

    mobileIcon(name) {
        const paths = { more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>', filter: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>', edit: '<path d="m15 4 5 5M4 20l4-1L20 7l-3-3L5 16z"/>', arrow: '<path d="m9 5 7 7-7 7"/>' };
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.arrow) + '</svg>';
    },

    setMobilePeriod(period) {
        if (period === 'custom') { this.showMobileFilters(); return; }
        const dates = Dashboard.getPeriodDates(period);
        this.filters.startDate = formatDateForInput(dates.inicio);
        this.filters.endDate = formatDateForInput(dates.fin);
        this.updateMobileControls();
        this.reloadListener(true);
    },

    updateMobileControls() {
        document.querySelectorAll('[data-m-status]').forEach(btn => {
            const active = btn.dataset.mStatus === (this.mobileStatus || 'all');
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
        let selectedPeriod = 'custom';
        for (const period of ['month', 'week', 'today']) {
            const range = Dashboard.getPeriodDates(period);
            if (this.filters.startDate === formatDateForInput(range.inicio) && this.filters.endDate === formatDateForInput(range.fin)) selectedPeriod = period;
        }
        document.querySelectorAll('[data-m-period]').forEach(btn => {
            const active = btn.dataset.mPeriod === selectedPeriod;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
        const label = document.getElementById('m-range-label');
        if (label) label.textContent = 'Período: ' + (this.filters.startDate || 'Sin inicio') + ' — ' + (this.filters.endDate || 'Sin fin');
        const count = Object.values(this.filters).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
        const badge = document.getElementById('m-filter-count');
        if (badge) { badge.textContent = count ? String(count) : ''; badge.hidden = !count; }
    },

    closeMobileSheet(sheet) {
        sheet.remove();
        const card = [...document.querySelectorAll('.m-data-card')].find(el => el.dataset.recordId === this._mobileDetailId);
        (card || document.getElementById('m-btn-filter'))?.focus({ preventScroll: true });
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
            list.innerHTML = '<div class="m-empty"><div class="mf-empty-symbol">' + this.mobileIcon('search') + '</div><div class="m-empty-title">No hay registros aquí</div><div class="m-empty-text">Prueba otro período o ajusta los filtros.</div><button type="button" class="btn" data-m-open-filter>Cambiar filtros</button></div>';
        } else {
            list.innerHTML = pageRecords.map(function(r) {
                const id = sanitizeHTML(r.id);
                const status = r.anulado === true ? 'cancelled' : r.doc === 'NC' ? 'credit' : r.entregado === true ? 'delivered' : 'pending';
                const labels = { cancelled: 'Anulada', credit: 'Nota de crédito', delivered: 'Entregada', pending: 'Pendiente' };
                const destination = [r.municipio, r.departamento].filter(Boolean).join(', ') || r.direccion || 'Sin destino registrado';
                const editable = canEdit && r.anulado !== true;
                var html = '<article class="m-data-card mf-record-card" data-record-id="' + id + '" tabindex="0" aria-label="Ver registro ' + sanitizeHTML(r.guia || r.id) + '">';
                html += '<div class="mf-record-top"><span class="mf-guide">Guía #' + sanitizeHTML(r.guia || r.id.substring(0,6).toUpperCase()) + '</span><span class="mf-status mf-status-' + status + '">' + labels[status] + '</span></div>';
                html += '<h3 class="mf-record-client">' + sanitizeHTML(r.cliente || 'Cliente sin nombre') + '</h3><p class="mf-record-destination">' + sanitizeHTML(destination) + '</p>';
                html += '<div class="mf-record-meta"><span>' + (r.fecha ? formatDateShort(r.fecha) : 'Sin fecha') + '</span><span>' + formatNumber(r.bultos || 0) + ' bultos</span><span>' + sanitizeHTML(r.empresa || 'Sin empresa') + '</span></div>';
                html += '<div class="mf-record-bottom"><div><span class="mf-money-label">' + (r.doc === 'NC' ? 'Nota de crédito' : 'Venta') + '</span><strong class="mf-record-money' + (r.doc === 'NC' ? ' mf-credit-money' : '') + '">' + formatCurrencySigned(r.doc === 'NC' ? -Math.abs(r.venta || 0) : r.venta || 0) + '</strong></div><div class="mf-record-buttons">';
                if (editable) html += '<button type="button" class="m-btn-edit mf-edit-button" data-record-id="' + id + '">' + self.mobileIcon('edit') + ' Editar</button>';
                if (editable || canDelete) {
                    html += '<details class="mf-card-options"><summary aria-label="Más acciones para la guía ' + sanitizeHTML(r.guia || r.id) + '">' + self.mobileIcon('more') + '</summary><div class="mf-card-menu">';
                    if (editable) html += '<button type="button" class="m-btn-duplicate" data-record-id="' + id + '">Duplicar registro</button>';
                    if (canDelete) html += '<button type="button" class="m-btn-delete" data-record-id="' + id + '">Eliminar registro</button>';
                    html += '</div></details>';
                }
                html += '</div></div></article>';
                return html;
            }).join('');
        }

        var totalsM = this._totals || this._computeTotals();
        var totalVenta = totalsM.venta;
        var totalBultos = totalsM.bultos;
        var totalEnvio = totalsM.envio;
        var totalPct = totalVenta > 0 ? ((totalEnvio / totalVenta) * 100) : 0;

        var setText = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
        setText('ms-venta', formatCurrencySigned(totalVenta));
        setText('ms-bultos', formatNumber(totalBultos));
        setText('ms-envio', formatCurrencySigned(totalEnvio));
        setText('ms-pct', formatNumber(totalPct, 2) + '%');
        setText('ms-count', this.filteredRecords.length);
        setText('m-result-count', totalRows + (totalRows === 1 ? ' registro' : ' registros'));
        this.updateMobileControls();

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
        var btnCls = 'style="cursor:pointer;min-height:44px;min-width:44px;padding:8px 14px;font-size:0.85rem;font-weight:700;border:1px solid var(--m-separator);border-radius:10px;background:var(--m-surface);color:var(--m-text);"';
        var btnDis = 'style="cursor:not-allowed;opacity:0.4;min-height:44px;min-width:44px;padding:8px 14px;font-size:0.85rem;font-weight:700;border:1px solid var(--m-separator);border-radius:10px;background:var(--m-surface);color:var(--m-text);"';
        var warnHtml = this._truncated
            ? '<div style="width:100%;text-align:center;font-size:0.75rem;color:#f59e0b;padding:6px 10px;background:rgba(245,158,11,0.12);border-radius:8px;">⚠ Solo se muestran los ' + this.records.length.toLocaleString() + ' registros más recientes. <button type="button" onclick="Interlogic.loadFullRange()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;margin-left:4px;">⬇ Cargar todo</button></div>'
            : (this._fullMode ? '<div style="width:100%;text-align:center;font-size:0.75rem;color:#3b82f6;padding:6px 10px;background:rgba(59,130,246,0.12);border-radius:8px;">📊 Rango completo (' + this.records.length.toLocaleString() + ' registros). <button type="button" onclick="Interlogic.reloadListener(true)" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;margin-left:4px;">↻ Tiempo real</button></div>' : '');
        pagEl.innerHTML = warnHtml +
            '<button type="button" class="m-page-btn" data-page="' + prevPage + '" ' + (this.currentPage <= 1 ? 'disabled' : '') + ' ' + (this.currentPage <= 1 ? btnDis : btnCls) + '>‹ Ant</button>' +
            '<span style="font-size:0.82rem;color:var(--m-text-secondary);padding:0 4px;">' + this.currentPage + ' / ' + totalPages + '</span>' +
            '<button type="button" class="m-page-btn" data-page="' + nextPage + '" ' + (this.currentPage >= totalPages ? 'disabled' : '') + ' ' + (this.currentPage >= totalPages ? btnDis : btnCls) + '>Sig ›</button>';
    },

    _badgeTransportista(value) {
        const map = { DALSE: 'badge-dalse', INTERLOGISTIC: 'badge-interlogic', XPRESS: 'badge-xpress', INCEDE: 'badge-incede' };
        return map[String(value || '').toUpperCase()] || 'badge-ghost';
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
        const pageBtnStyle = 'cursor:pointer;padding:0.35rem 0.65rem;font-size:0.8rem;font-weight:600;line-height:1;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#1f2937;';
        const pageBtnDisabled = 'cursor:not-allowed;opacity:0.4;padding:0.35rem 0.65rem;font-size:0.8rem;font-weight:600;line-height:1;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#9ca3af;';
        const allBtnStyle = 'cursor:pointer;padding:0.35rem 0.65rem;font-size:0.8rem;font-weight:600;line-height:1;border:1px solid var(--border-color);border-radius:6px;background:#2563eb;color:#fff;';

        if (this.showAll) {
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
                    <span style="font-size: 0.8rem; color: #6b7280;">Mostrando <strong>${totalRows}</strong> de <strong>${totalRows}</strong> registros (sin paginación)</span>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <button type="button" class="page-btn-all" data-mode="page" style="${allBtnStyle}">↩ Ver paginado</button>
                    </div>
                </div>
            `;
        }

        return `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
                <span style="font-size: 0.8rem; color: #6b7280;">Mostrando <strong>${firstShown}–${lastShown}</strong> de <strong>${totalRows}</strong> registros</span>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <button type="button" class="page-btn" data-page="1" ${this.currentPage <= 1 ? 'disabled' : ''} style="${this.currentPage <= 1 ? pageBtnDisabled : pageBtnStyle}">«</button>
                    <button type="button" class="page-btn" data-page="${prevPage}" ${this.currentPage <= 1 ? 'disabled' : ''} style="${this.currentPage <= 1 ? pageBtnDisabled : pageBtnStyle}">‹</button>
                    <span style="font-size: 0.8rem; color: #6b7280; padding: 0 0.25rem;">Página <strong>${this.currentPage}</strong> / ${totalPages}</span>
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

        const headerMap = {};
        document.querySelectorAll('.filter-header').forEach(h => {
            const m = (h.getAttribute('onclick') || '').match(/toggleFilter\(event, '([\w]+)'\)/);
            if (m) headerMap[m[1]] = h;
        });
        for (let field in this.filters) {
            const header = headerMap[field];
            if (header) {
                const isActive = Array.isArray(this.filters[field]) ? this.filters[field].length > 0 : !!this.filters[field];
                if (isActive) header.classList.add('filter-active');
                else header.classList.remove('filter-active');
            }
        }

        if (this.filteredRecords.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="21" style="padding: 0;">
                        <div class="ux-empty">
                            <span class="ux-empty-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></span>
                            <span class="ux-empty-title">Sin registros</span>
                            <span class="ux-empty-text">No hay registros disponibles que coincidan con los filtros aplicados.</span>
                        </div>
                    </td>
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
            <tr style="${record.anulado === true ? 'background: #fef2f2; border-left: 4px solid #dc2626; color: #dc2626;' : (record.entregado === true ? 'background: #dcfce7; border-left: 4px solid #16a34a;' : '')}">
                <td style="text-align: center;"><input type="checkbox" class="row-checkbox" data-id="${record.id}" ${this.selectedRecords.has(record.id) ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;"></td>
                <td data-label="Guía"><strong>${record.anulado === true ? 'ANULADO · ' : ''}${sanitizeHTML(record.guia || '')}</strong></td>
                <td data-label="Empresa"><span class="badge ${this._badgeTransportista(record.empresa)}">${sanitizeHTML(record.empresa || '')}</span></td>
                <td data-label="Fecha">${record.fecha ? formatDateShort(record.fecha) : ''}</td>
                <td data-label="Doc">${sanitizeHTML(record.doc || '')}</td>
                <td data-label="Doc #">${sanitizeHTML(record.docNum || '')}</td>
                <td data-label="Cliente">${sanitizeHTML(record.cliente || '')}${record.direccion ? '<br><span style="font-size: 0.8rem; color: #6b7280;">📍 ' + sanitizeHTML(record.direccion) + '</span>' : ''}</td>
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
                <td data-label="Entrega" style="cursor: pointer;" class="il-editable-cell" data-record-id="${record.id}" data-field="entrega" title="Clic para cambiar">
                    <span class="badge ${this._badgeTransportista(record.entrega)}">${sanitizeHTML(record.entrega || '—')}</span>
                </td>
                <td data-label="Cobra" style="cursor: pointer;" class="il-editable-cell" data-record-id="${record.id}" data-field="cobra" title="Clic para cambiar">
                    <span class="badge ${this._badgeTransportista(record.cobra)}">${sanitizeHTML(record.cobra || '—')}</span>
                </td>
                <td data-label="Encargado" style="cursor: pointer;" class="il-editable-cell" data-record-id="${record.id}" data-field="encargado" title="Clic para cambiar">${sanitizeHTML(record.encargado || '')}</td>
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

        const totals = this._totals || this._computeTotals();

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
            ? '<tr><td colspan="21" style="padding:0.5rem;background:#fff7ed;color:#b45309;font-size:0.78rem;text-align:center;">⚠ Para optimizar rendimiento y costo, solo se muestran los <strong>' + this.records.length.toLocaleString() + '</strong> registros más recientes del rango. <button type="button" onclick="Interlogic.loadFullRange()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:0.75rem;font-weight:700;cursor:pointer;margin-left:6px;">⬇ Cargar todo el rango</button></td></tr>\n'
            : (this._fullMode ? '<tr><td colspan="21" style="padding:0.4rem;background:#eff6ff;color:#1e40af;font-size:0.78rem;text-align:center;">📊 Mostrando los <strong>' + this.records.length.toLocaleString() + '</strong> registros del rango completo (modo sin tiempo real). <button type="button" onclick="Interlogic.reloadListener(true)" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:0.75rem;font-weight:700;cursor:pointer;margin-left:6px;">↻ Volver a tiempo real</button></td></tr>\n' : '');

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
            ${this._truncated ? '<tr><td colspan="21" style="padding: 0.35rem 0;"><div style="font-size: 0.75rem; color: #b45309; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 6px 10px; text-align: center;">⚠️ El rango tiene más de 2,000 registros (tope de descarga): se muestran solo los más recientes. <button type="button" onclick="Interlogic.loadFullRange()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;margin-left:6px;">⬇ Cargar todo</button></div></td></tr>' : ''}
            <tr>
                <td colspan="21" style="padding: 0.5rem 0;">
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

    _computeTotals() {
        return this.filteredRecords.reduce((acc, r) => {
            acc.venta += this.signedAmount(r, 'venta');
            acc.bultos += this.signedAmount(r, 'bultos');
            acc.cajas += r.anulado === true ? 0 : Number(r.cobrador || 0);
            acc.envio += this.signedAmount(r, 'costoEnvio');
            return acc;
        }, { venta: 0, bultos: 0, cajas: 0, envio: 0 });
    },

    updateStats() {
        const totals = this._totals || this._computeTotals();
        const totalVenta = totals.venta;
        const totalBultos = totals.bultos;
        const totalEnvio = totals.envio;

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
