// ===================================
// Control Interlogic Module
// ===================================

function getLocalDateString() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

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
        costoPorcentaje: []
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
        const contentArea = document.getElementById('content-area');

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
                                <td colspan="16" style="text-align: center; padding: 2rem;">Cargando registros...</td>
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
        });

        // Apply saved column visibility
        this.applyColumnVisibility();

        // Close filters when clicking outside (but not when drag-selecting)
        let mouseDownInsideFilter = false;
        document.addEventListener('mousedown', (e) => {
            mouseDownInsideFilter = !!e.target.closest('.filter-header') || !!e.target.closest('.filter-popup');
        });
        document.addEventListener('click', (e) => {
            const clickedInsideFilter = e.target.closest('.filter-header') || e.target.closest('.filter-popup');
            if (!clickedInsideFilter && !mouseDownInsideFilter) {
                document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
            }
        });

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
        const isShowing = popup.classList.contains('show');

        // Hide all popups
        document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));

        if (!isShowing) {
            popup.classList.add('show');
            this.populateFilterOptions(field);
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

                    const recordValue = String(record[field] || ' (Vacío)');
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

        const hasActiveFilters = Object.values(this.filters).some(f => Array.isArray(f) ? f.length > 0 : f);
        const clearBtn = document.getElementById('btn-clear-all-filters');
        if (clearBtn) clearBtn.style.display = hasActiveFilters ? 'block' : 'none';

        this.renderTable();
        this.updateStats();
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

    // Populate dynamic filter options in popup
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

        // SMART FILTERS: Get records that pass all filters EXCEPT this field
        const recordsPassingOtherFilters = this.records.filter(record => {
            for (let f in this.filters) {
                if (f === field) continue;
                const activeValues = this.filters[f];

                if (f === 'startDate' || f === 'endDate') {
                    const recordDate = record.fecha ? (record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha)).toISOString().split('T')[0] : '';
                    if (!recordDate) continue; // Allow records without date to pass through
                    if (this.filters.startDate && recordDate < this.filters.startDate) return false;
                    if (this.filters.endDate && recordDate > this.filters.endDate) return false;
                    continue;
                }

                if (activeValues && (Array.isArray(activeValues) ? activeValues.length > 0 : activeValues)) {
                    if (f === 'search') {
                        const recordValue = String(record.cliente || '').toLowerCase();
                        if (!recordValue.includes(activeValues.toLowerCase())) return false;
                        continue;
                    }

                    // For fields that might be formatted (Dates) in the table but plain in the record
                    let recordValue;
                    if (f === 'fecha') {
                        recordValue = record.fecha ? formatDate(record.fecha, false) : ' (Vacío)';
                    } else if (f === 'venta' || f === 'costoEnvio') {
                        recordValue = formatNumber(record[f] || 0, 2);
                    } else if (f === 'costoPorcentaje') {
                        recordValue = formatNumber(record[f] || 0, 2) + '%';
                    } else {
                        recordValue = String(record[f] || ' (Vacío)');
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

        // Get unique values from the subset of records, formatted as they appear in the table
        const uniqueValues = [...new Set(recordsPassingOtherFilters.map(r => {
            if (field === 'fecha') return r.fecha ? formatDate(r.fecha, false) : ' (Vacío)';
            if (field === 'venta' || field === 'costoEnvio') return formatNumber(record[field] || 0, 2);
            if (field === 'costoPorcentaje') return formatNumber(record[field] || 0, 2) + '%';
            return String(r[field] || ' (Vacío)');
        }))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        const activeValues = this.filters[field] || [];

        const optionsHtml = uniqueValues.map(val => `
            <div class="filter-option-item" onclick="event.stopPropagation()">
                <input type="checkbox" id="chk-${field}-${val}" ${Array.isArray(activeValues) && activeValues.includes(val) ? 'checked' : ''} 
                       onchange="Interlogic.updateFilterValue('${field}', '${val}', this.checked)">
                <label for="chk-${field}-${val}">${val}</label>
            </div>
        `).join('');

        list.innerHTML = headerHtml + optionsHtml;
    },

    toggleAllFilterValues(field, checked) {
        if (!checked) {
            this.filters[field] = [];
        } else {
            // Get all visible options for this field
            const list = document.getElementById(`filter-options-${field}`);
            const checkboxes = list.querySelectorAll('input[type="checkbox"]');
            this.filters[field] = Array.from(checkboxes).map(cb => {
                // Get the value from the ID (format: chk-field-value)
                const idParts = cb.id.split('-');
                return idParts.slice(2).join('-');
            });
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
        const today = getLocalDateString();
        this.filters = {
            search: '',
            startDate: today,
            endDate: today,
            empresa: [],
            zona: [],
            vendedor: [],
            cobrador: [],
            cliente: [],
            condicionPago: []
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

                // If it's the first load, we might want to populate filters
                // subsequent loads should preserve filter state but refresh data
                this.populateFilterOptions();
                this.applyFilters();

                // Remove loading state on first data receive
                if (this.loading) {
                    this.loading = false;
                }
            }, error => {
                console.error('Error in real-time listener:', error);
                showToast('Error en sincronización: ' + error.message, 'error');
            });
    },

    // Render records table
    renderTable() {
        const tableBody = document.getElementById('interlogic-table-body');
        if (!tableBody) return;

        // Update header active states
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
                    <td colspan="16" style="text-align: center; padding: 2rem;">No hay registros disponibles que coincidan con los filtros.</td>
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
                <td><strong>${record.guia || ''}</strong></td>
                <td><span class="badge ${record.empresa === 'DALSE' ? 'badge-primary' : 'badge-accent'}">${record.empresa || ''}</span></td>
                <td>${record.fecha ? formatDate(record.fecha, false) : ''}</td>
                <td>${record.doc || ''} ${record.docNum ? '#' + record.docNum : ''}</td>
                <td>${sanitizeHTML(record.cliente || '')}${record.direccion ? '<br><span style="font-size: 0.7rem; color: #000;">📍 ' + sanitizeHTML(record.direccion) + '</span>' : ''}</td>
                <td>${sanitizeHTML(record.zona || '')}</td>
                <td>${sanitizeHTML(record.vendedor || '')}</td>
                <td>${record.condicionPago || ''}</td>
                <td>$${formatNumber(record.venta || 0, 2)}</td>
                <td>${formatNumber(record.bultos || 0)}</td>
                <td>${sanitizeHTML(record.cobrador || '')}</td>
                <td>$${formatNumber(record.costoEnvio || 0, 2)}</td>
                <td>${formatNumber(record.costoPorcentaje || 0, 2)}%</td>
                <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sanitizeHTML(record.observations || '')}">${sanitizeHTML(record.observations || '')}</td>
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
        const totals = this.filteredRecords.reduce((acc, r) => {
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
                <button class="btn btn-secondary" id="btn-change-date-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    📅 Cambiar Fecha (${this.selectedRecords.size})
                </button>
                <button class="btn btn-danger" id="btn-delete-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    🗑️ Eliminar (${this.selectedRecords.size})
                </button>
            `;
            document.getElementById('btn-delete-selected').onclick = () => this.deleteSelectedRecords();
            document.getElementById('btn-change-date-selected').onclick = () => this.changeDateSelectedRecords();
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
                            <input type="number" id="il-guia" value="${sourceRecord ? '' : (record ? record.guia : '')}">
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
                                </select>
                                <input type="text" id="il-docNum" placeholder="#" value="${sourceRecord ? '' : (record ? record.docNum : '')}" style="flex: 1;">
                            </div>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 1rem; position: relative;">
                        <label>Cliente</label>
                        <input type="text" id="il-cliente" autocomplete="off" value="${sourceRecord ? sanitizeHTML(sourceRecord.cliente || '') : (record ? sanitizeHTML(record.cliente) : '')}">
                        <div id="il-cliente-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--gray-300); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 1300; max-height: 200px; overflow-y: auto;"></div>
                    </div>

                    <div class="form-group" style="margin-top: 1rem;">
                        <label>📍 Dirección</label>
                        <input type="text" id="il-direccion" placeholder="Dirección del cliente" value="${sanitizeHTML(val('direccion'))}">
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
                            <input type="text" id="il-vendedor" value="${sanitizeHTML(val('vendedor'))}">
                        </div>
                        <div class="form-group">
                            <label>Teléfono Cliente (WhatsApp)</label>
                            <input type="text" id="il-telefono" placeholder="Ej: 50370000000" value="${sourceRecord ? (sourceRecord.telefono || '') : (record ? record.telefono || '' : '')}">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group">
                            <label>Zona</label>
                            <input type="text" id="il-zona" value="${sanitizeHTML(val('zona'))}">
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

                    <div style="display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group">
                            <label>Cajas</label>
                            <input type="text" id="il-cobrador" value="${sanitizeHTML(val('cobrador'))}">
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

        // Setup client autocomplete
        const clienteInput = document.getElementById('il-cliente');
        const suggestionsBox = document.getElementById('il-cliente-suggestions');
        let debounceTimer = null;

        // Helper to render suggestions
        const renderSuggestions = (matches) => {
            if (matches.length === 0) {
                suggestionsBox.style.display = 'none';
                return;
            }

            suggestionsBox.innerHTML = matches.map(c => `
                <div style="padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--gray-100); font-size: 0.85rem; transition: background 0.15s;"
                     onmouseover="this.style.background='var(--primary-50)'"
                     onmouseout="this.style.background='white'"
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

            suggestionsBox.style.display = 'block';

            // Add click handlers to suggestions
            suggestionsBox.querySelectorAll('div').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    clienteInput.value = item.dataset.nombre;
                    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
                    setVal('il-direccion', item.dataset.direccion);
                    setVal('il-telefono', item.dataset.telefono);
                    setVal('il-zona', item.dataset.zona);
                    setVal('il-vendedor', item.dataset.vendedor);
                    // NOTA: empresa y condicionPago NO se auto‑llenan para que el usuario los elija manualmente
                    suggestionsBox.style.display = 'none';
                });
            });
        };

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

                const db = firebase.firestore();
                if (recordId) {
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
                }
                // Invalidar caché de búsqueda para que recoja el nuevo cliente
                Interlogic._invalidateClientCache();
                if (this._saveAndAddAnother) {
                    this._saveAndAddAnother = false;
                    modal.remove();
                    await this.loadRecords();
                    this.showForm(); // Re-open form with last values
                    return;
                }

                modal.remove();
                await this.loadRecords();
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
                    const workbook = XLSX.read(data, { type: 'array' });
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
                                            <td>${d.guia}</td>
                                            <td>${d.empresa}</td>
                                            <td>${d.cliente}</td>
                                            <td>$${formatNumber(d.venta, 2)}</td>
                                            <td>${d.bultos}</td>
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
                const batch = db.batch();
                const uid = firebase.auth().currentUser.uid;

                // Check if user wants a custom date for all records
                const useCustomDate = document.getElementById('import-use-custom-date').checked;
                const customDateVal = document.getElementById('import-custom-date').value;
                let customFirebaseDate = null;
                if (useCustomDate && customDateVal) {
                    const [y, m, d] = customDateVal.split('-').map(Number);
                    customFirebaseDate = firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
                }

                parsedData.forEach(record => {
                    const ref = db.collection('interlogic').doc();
                    const costoEnvio = record.bultos * 1.85;
                    const costoPorcentaje = record.venta > 0 ? (costoEnvio / record.venta) * 100 : 0;

                    let firebaseDate = customFirebaseDate; // Use custom date if set
                    if (!customFirebaseDate && record.fecha) {
                        try {
                            const d = new Date(record.fecha);
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
