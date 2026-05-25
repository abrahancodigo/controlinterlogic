// ===================================
// Despacho Interlogic Module (Enhanced)
// ===================================

const Despacho = {
    records: [],
    filteredRecords: [],
    routes: [],
    loading: false,
    filters: {
        search: '',
        startDate: getLocalDateString().substring(0, 8) + '01',
        endDate: getLocalDateString(),
        guia: [],
        empresa: [],
        fecha: [],
        doc: [],
        cliente: [],
        vendedor: [],
        condicionPago: [],
        venta: [],
        cobrador: [],
        horaEntrega: [],
        routeId: null,
        status: 'all'
    },
    currentSort: {
        field: 'createdAt',
        direction: 'desc'
    },
    unsubscribe: null,

    // Initialize module and render content
    async render() {
        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }
        return this.renderDesktop();
    },

    async renderDesktop() {
        const contentArea = document.getElementById('content-area');

        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>🚚 Despacho Interlogic</h1>
                    <p>Seguimiento de entregas y liquidación sobre base total</p>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <div class="form-group" style="margin-bottom: 0; display: flex; align-items: center; gap: 0.5rem;">
                        <label for="ds-filter-start-date" style="margin-bottom: 0; white-space: nowrap;">📅 Desde:</label>
                        <input type="date" id="ds-filter-start-date" class="form-control" value="${this.filters.startDate}" style="padding: 0.4rem; font-size: 0.8rem;">
                        <label for="ds-filter-end-date" style="margin-bottom: 0; white-space: nowrap;">Hasta:</label>
                        <input type="date" id="ds-filter-end-date" class="form-control" value="${this.filters.endDate}" style="padding: 0.4rem; font-size: 0.8rem;">
                    </div>
                    <button id="ds-btn-export-excel" class="btn btn-secondary">
                        📥 Exportar Excel
                    </button>
                    <button id="ds-btn-nueva-ruta" class="btn btn-accent">➕ Ruta</button>
                    <select id="ds-filter-ruta" style="padding:0.4rem;font-size:0.8rem;border:1px solid var(--border-color);border-radius:4px;max-width:160px;">
                        <option value="">Todas las rutas</option>
                    </select>
                    <button id="ds-btn-asignar-ruta" class="btn btn-primary" style="display:none;font-size:0.75rem;">📦 Asignar a Ruta</button>
                    <button id="ds-btn-clear-all-filters" class="btn btn-secondary" style="display: none;">
                        🧹 Quitar Filtros
                    </button>
                </div>
            </div>

            <div class="stats-grid" id="despacho-stats">
                <div class="stat-card">
                    <h3>Total Venta</h3>
                    <p id="ds-stat-total-venta">$0.00</p>
                </div>
                <div class="stat-card">
                    <h3>Total Bultos</h3>
                    <p id="ds-stat-total-bultos">0</p>
                </div>
                <div class="stat-card">
                    <h3>Total Importe</h3>
                    <p id="ds-stat-total-importe">$0.00</p>
                </div>
                <div class="stat-card">
                    <h3>Entregados</h3>
                    <p id="ds-stat-total-entregados">0</p>
                </div>
            </div>

            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0 0.5rem;">
                    <div style="flex: 1; max-width: 400px;">
                        <input type="text" id="ds-global-search" class="form-control" placeholder="🔍 Buscar en cualquier columna..." style="width: 100%; padding: 0.5rem 1rem; border-radius: 8px;">
                    </div>
                </div>
                <div class="table-container" style="overflow-x: visible;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>
                                    <div class="filter-header" onclick="Despacho.toggleFilter(event, 'guia')">
                                        Guía <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="ds-filter-popup-guia" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Despacho.searchInFilter('guia', this.value)">
                                            <div class="filter-options-list" id="ds-filter-options-guia"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Despacho.toggleFilter(event, 'empresa')">
                                        Empresa <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="ds-filter-popup-empresa" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Despacho.searchInFilter('empresa', this.value)">
                                            <div class="filter-options-list" id="ds-filter-options-empresa"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Despacho.toggleFilter(event, 'fecha')">
                                        Fecha <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="ds-filter-popup-fecha" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Despacho.searchInFilter('fecha', this.value)">
                                            <div class="filter-options-list" id="ds-filter-options-fecha"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Despacho.toggleFilter(event, 'doc')">
                                        Doc <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="ds-filter-popup-doc" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Despacho.searchInFilter('doc', this.value)">
                                            <div class="filter-options-list" id="ds-filter-options-doc"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Despacho.toggleFilter(event, 'cliente')">
                                        Cliente <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="ds-filter-popup-cliente" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Despacho.searchInFilter('cliente', this.value)">
                                            <div class="filter-options-list" id="ds-filter-options-cliente"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Despacho.toggleFilter(event, 'vendedor')">
                                        Vendedor <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="ds-filter-popup-vendedor" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Despacho.searchInFilter('vendedor', this.value)">
                                            <div class="filter-options-list" id="ds-filter-options-vendedor"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Despacho.toggleFilter(event, 'condicionPago')">
                                        Pago <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="ds-filter-popup-condicionPago" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Despacho.searchInFilter('condicionPago', this.value)">
                                            <div class="filter-options-list" id="ds-filter-options-condicionPago"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Despacho.toggleFilter(event, 'venta')">
                                        Venta <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="ds-filter-popup-venta" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Despacho.searchInFilter('venta', this.value)">
                                            <div class="filter-options-list" id="ds-filter-options-venta"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Despacho.toggleFilter(event, 'cobrador')">
                                        Cobra <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="ds-filter-popup-cobrador" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Despacho.searchInFilter('cobrador', this.value)">
                                            <div class="filter-options-list" id="ds-filter-options-cobrador"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>
                                    <div class="filter-header" onclick="Despacho.toggleFilter(event, 'horaEntrega')">
                                        Hora <span class="filter-trigger">▼</span>
                                        <div class="filter-popup" id="ds-filter-popup-horaEntrega" onclick="event.stopPropagation()">
                                            <input type="text" class="filter-popup-search" placeholder="Buscar..." 
                                                   onclick="event.stopPropagation()"
                                                   onkeyup="Despacho.searchInFilter('horaEntrega', this.value)">
                                            <div class="filter-options-list" id="ds-filter-options-horaEntrega"></div>
                                        </div>
                                    </div>
                                </th>
                                <th>Flete</th>
                                <th style="text-align: center;">Ruta</th>
                                <th style="text-align: center;">¿Entregado?</th>
                            </tr>
                        </thead>
                        <tbody id="despacho-table-body">
                            <tr>
                                <td colspan="12" style="text-align: center; padding: 2rem;">Cargando registros...</td>
                            </tr>
                        </tbody>
                        <tfoot id="despacho-table-footer"></tfoot>
                    </table>
                </div>
            </div>
        `;

        // Load records
        await this.loadRecords();
        await this.loadRoutes();

        // Setup event listeners
        const startEl = document.getElementById('ds-filter-start-date');
        if (startEl) startEl.addEventListener('change', (e) => {
            this.filters.startDate = e.target.value;
            this.applyFilters();
        });
        const endEl = document.getElementById('ds-filter-end-date');
        if (endEl) endEl.addEventListener('change', (e) => {
            this.filters.endDate = e.target.value;
            this.applyFilters();
        });
        const clearBtn = document.getElementById('ds-btn-clear-all-filters');
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearAllFilters());
        const exportBtn = document.getElementById('ds-btn-export-excel');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToExcel());

        const nuevaRutaBtn = document.getElementById('ds-btn-nueva-ruta');
        if (nuevaRutaBtn) nuevaRutaBtn.addEventListener('click', () => {
            if (window.Liquidacion && window.Liquidacion.showCrearRuta) {
                window.Liquidacion.showCrearRuta();
            } else {
                this.showCrearRutaSimple();
            }
        });
        const rutaFilter = document.getElementById('ds-filter-ruta');
        if (rutaFilter) rutaFilter.addEventListener('change', (e) => {
            this.filters.routeId = e.target.value || null;
            this.applyFilters();
        });
        const asignarRutaBtn = document.getElementById('ds-btn-asignar-ruta');
        if (asignarRutaBtn) asignarRutaBtn.addEventListener('click', () => this.asignarARuta());

        // Global search listener
        const searchEl = document.getElementById('ds-global-search');
        if (searchEl) {
            searchEl.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.applyFilters();
            });
        }

        // Close filters when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-header')) {
                document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
            }
        });

        this.applyDespachoStyles();
    },

    // Load records from Firestore
    async loadRecords() {
        if (this.unsubscribe) this.unsubscribe();

        const db = firebase.firestore();
        this.unsubscribe = db.collection('interlogic')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                this.records = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.applyFilters();
            }, error => {
                console.error('Error loading records:', error);
                showToast('Error en sincronización: ' + error.message, 'error');
            });
    },

    async loadRoutes() {
        const db = firebase.firestore();
        db.collection('rutas').orderBy('fecha', 'desc').onSnapshot(snap => {
            this.routes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const select = document.getElementById('ds-filter-ruta');
            if (select) {
                const cur = select.value;
                select.innerHTML = '<option value="">Todas las rutas (' + this.routes.length + ')</option>';
                this.routes.forEach(r => {
                    const f = r.fecha && r.fecha.toDate ? r.fecha.toDate().toLocaleDateString('es-ES') : '';
                    const o = document.createElement('option');
                    o.value = r.id;
                    o.textContent = '#' + r.id.substring(0,6) + ' ' + (r.repartidorNombre||'') + ' ' + f;
                    select.appendChild(o);
                });
                if (cur) select.value = cur;
            }
            this.applyFilters();
        }, err => console.error('Error loading routes:', err));
    },

    async asignarARuta() {
        const routeId = document.getElementById('ds-filter-ruta')?.value;
        if (!routeId) { showToast('Selecciona una ruta primero', 'error'); return; }
        const route = this.routes.find(r => r.id === routeId);
        if (!route) { showToast('Ruta no encontrada', 'error'); return; }

        const recordsToAssign = this.filteredRecords.filter(r => !r.rutaId || r.rutaId !== routeId);
        if (recordsToAssign.length === 0) { showToast('No hay registros para asignar', 'warning'); return; }
        if (!await showConfirm('¿Asignar ' + recordsToAssign.length + ' registros a esta ruta?', 'Ruta: ' + sanitizeHTML(route.repartidorNombre||'') + ' - ' + sanitizeHTML(route.vehiculo||''))) return;

        try {
            const db = firebase.firestore();
            const batch = db.batch();
            recordsToAssign.forEach((r, i) => {
                const ref = db.collection('rutaEntregas').doc();
                batch.set(ref, {
                    rutaId: routeId,
                    interlogicId: r.id,
                    guia: r.guia || '',
                    cliente: r.cliente || '',
                    direccion: r.direccion || '',
                    venta: Number(r.venta) || 0,
                    condicionPago: r.condicionPago || '',
                    costoEnvio: Number(r.costoEnvio) || 0,
                    entregado: r.entregado === true,
                    horaEntrega: r.horaEntrega || '',
                    telefono: r.telefono || '',
                    sequence: i + 1,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                batch.update(db.collection('interlogic').doc(r.id), { rutaId: routeId, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            });
            await batch.commit();
            showToast('✅ ' + recordsToAssign.length + ' registros asignados', 'success');
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
    },

    showCrearRutaSimple() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:450px;">
                <h2 style="margin-bottom:1rem;">➕ Nueva Ruta</h2>
                <form id="ds-ruta-form">
                    <div class="form-group"><label>Fecha</label><input type="date" id="ds-ruta-fecha" value="${getLocalDateString()}"></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Repartidor</label><input type="text" id="ds-ruta-repartidor" placeholder="Nombre del repartidor"></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Vehículo</label><input type="text" id="ds-ruta-vehiculo" placeholder="Placa"></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Zona</label><input type="text" id="ds-ruta-zona" placeholder="Zona"></div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Crear Ruta</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        document.getElementById('ds-ruta-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            setButtonLoading(btn, true);
            try {
                const fv = document.getElementById('ds-ruta-fecha').value;
                let fb = firebase.firestore.Timestamp.now();
                if (fv) { const [y,m,d] = fv.split('-').map(Number); fb = firebase.firestore.Timestamp.fromDate(new Date(y,m-1,d,12,0,0)); }
                await firebase.firestore().collection('rutas').add({
                    fecha: fb, repartidorNombre: document.getElementById('ds-ruta-repartidor').value,
                    vehiculo: document.getElementById('ds-ruta-vehiculo').value,
                    zona: document.getElementById('ds-ruta-zona').value,
                    estado: 'pendiente', createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                modal.remove(); showToast('✅ Ruta creada', 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        });
    },

    toggleFilter(event, field) {
        event.stopPropagation();
        const popup = document.getElementById(`ds-filter-popup-${field}`);
        const isShowing = popup.classList.contains('show');

        // Hide all popups
        document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));

        if (!isShowing) {
            popup.classList.add('show');
            this.populateFilterOptions(field);
        }
    },

    searchInFilter(field, query) {
        const list = document.getElementById(`ds-filter-options-${field}`);
        const items = list.querySelectorAll('.filter-option-item');
        const q = query.toLowerCase();

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(q) ? 'flex' : 'none';
        });
    },

    populateFilterOptions(field) {
        const list = document.getElementById(`ds-filter-options-${field}`);
        if (!list) return;

        // Header with sorting and toggle all
        let headerHtml = '<div class="filter-sort-options">';
        headerHtml += '<button class="sort-btn ' + (this.currentSort.field === field && this.currentSort.direction === 'asc' ? 'active' : '') + '" onclick="Despacho.setSort(\'' + field + '\', \'asc\')">↑ A a Z</button>';
        headerHtml += '<button class="sort-btn ' + (this.currentSort.field === field && this.currentSort.direction === 'desc' ? 'active' : '') + '" onclick="Despacho.setSort(\'' + field + '\', \'desc\')">↓ Z a A</button>';
        headerHtml += '</div>';
        headerHtml += '<div class="filter-toggle-all">';
        headerHtml += '<button class="btn-toggle-filter" onclick="Despacho.toggleAllFilterValues(\'' + field + '\', true)">☑ Seleccionar Todo</button>';
        headerHtml += '<button class="btn-toggle-filter" onclick="Despacho.toggleAllFilterValues(\'' + field + '\', false)">☐ Deseleccionar</button>';
        headerHtml += '</div>';

        // Unique values passing other filters
        const recordsPassingOthers = this.records.filter(record => {
            for (let f in this.filters) {
                if (f === field || f === 'status') continue;
                const activeValues = this.filters[f];
                if (f === 'startDate' || f === 'endDate') {
                    const recordDate = record.fecha ? (record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha)).toISOString().split('T')[0] : '';
                    if (this.filters.startDate && recordDate < this.filters.startDate) return false;
                    if (this.filters.endDate && recordDate > this.filters.endDate) return false;
                    continue;
                }
                if (Array.isArray(activeValues) && activeValues.length > 0) {
                    let recordVal;
                    if (f === 'fecha') {
                        recordVal = record.fecha ? formatDate(record.fecha, false) : ' (Vacío)';
                    } else if (f === 'venta' || f === 'total') {
                        recordVal = formatNumber(record[f] || 0, 2);
                    } else {
                        recordVal = String(record[f] || ' (Vacío)');
                    }
                    if (!activeValues.includes(recordVal)) return false;
                }
            }
            return true;
        });

        const uniqueValues = [...new Set(recordsPassingOthers.map(r => {
            if (field === 'fecha') return r.fecha ? formatDate(r.fecha, false) : ' (Vacío)';
            if (field === 'venta' || field === 'total') return formatNumber(r[field] || 0, 2);
            return String(r[field] || ' (Vacío)');
        }))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        const activeValues = this.filters[field] || [];

        const optionsHtml = uniqueValues.map(val => `
            <div class="filter-option-item" onclick="event.stopPropagation()">
                <input type="checkbox" id="ds-chk-${field}-${val}" ${activeValues.includes(val) ? 'checked' : ''} 
                       onchange="Despacho.updateFilterValue('${field}', '${val}', this.checked)">
                <label for="ds-chk-${field}-${val}">${val}</label>
            </div>
        `).join('');

        list.innerHTML = headerHtml + optionsHtml;
    },

    toggleAllFilterValues(field, checked) {
        if (!checked) {
            this.filters[field] = [];
        } else {
            const list = document.getElementById(`ds-filter-options-${field}`);
            const checkboxes = list.querySelectorAll('input[type="checkbox"]');
            this.filters[field] = Array.from(checkboxes).map(cb => {
                const idParts = cb.id.split('-');
                return idParts.slice(3).join('-'); // format: ds-chk-field-value
            });
        }
        this.applyFilters();
        this.populateFilterOptions(field);
    },

    updateFilterValue(field, value, checked) {
        if (!this.filters[field]) this.filters[field] = [];
        if (checked) {
            if (!this.filters[field].includes(value)) this.filters[field].push(value);
        } else {
            this.filters[field] = this.filters[field].filter(v => v !== value);
        }
        this.applyFilters();
    },

    setSort(field, direction) {
        this.currentSort = { field, direction };
        this.applyFilters();
    },

    applyFilters() {
        this.filteredRecords = this.records.filter(record => {
            for (let field in this.filters) {
                const val = this.filters[field];
                if (field === 'startDate' || field === 'endDate') {
                    const date = record.fecha ? (record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha)).toISOString().split('T')[0] : '';
                    if (this.filters.startDate && date < this.filters.startDate) return false;
                    if (this.filters.endDate && date > this.filters.endDate) return false;
                    continue;
                }
                if (field === 'status') continue;
                if (field === 'routeId' && val) {
                    if (record.rutaId !== val) return false;
                    continue;
                }
                if (Array.isArray(val) && val.length > 0) {
                    let recordVal;
                    if (field === 'fecha') {
                        recordVal = record.fecha ? formatDate(record.fecha, false) : ' (Vacío)';
                    } else if (field === 'venta' || field === 'total') {
                        recordVal = formatNumber(record[field] || 0, 2);
                    } else {
                        recordVal = String(record[field] || ' (Vacío)');
                    }
                    if (!val.includes(recordVal)) return false;
                }
            }
            // Global search filter
            if (this.filters.search && this.filters.search.trim() !== '') {
                const q = this.filters.search.toLowerCase();
                const textFields = ['guia', 'empresa', 'cliente', 'vendedor', 'zona', 'cobrador', 'doc', 'docNum', 'condicionPago'];
                const textMatch = textFields.some(f => {
                    const val = String(record[f] || '').toLowerCase();
                    return val.includes(q);
                });
                // Also search in venta as a number (formatted)
                const ventaVal = Number(record.venta || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
                const ventaMatch = ventaVal.includes(q) || String(record.venta || '').includes(q);
                if (!textMatch && !ventaMatch) return false;
            }
            return true;
        });

        // Apply sort
        const { field, direction } = this.currentSort;
        if (field && direction) {
            this.filteredRecords.sort((a, b) => {
                let vA = a[field] || '';
                let vB = b[field] || '';
                if (vA < vB) return direction === 'asc' ? -1 : 1;
                if (vA > vB) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        const hasFilters = Object.values(this.filters).some(f => Array.isArray(f) ? f.length > 0 : false);
        const clearBtn = document.getElementById('ds-btn-clear-all-filters');
        if (clearBtn) clearBtn.style.display = hasFilters ? 'block' : 'none';

        if (this.isMobile) {
            this.renderMobileCards();
        } else {
            this.renderTable();
            this.updateStats();
        }
    },

    renderTable() {
        const body = document.getElementById('despacho-table-body');
        if (!body) return;

        // Update active header styles
        for (let field in this.filters) {
            const header = document.querySelector('[onclick*="Despacho.toggleFilter(event, \'' + field + '\')"]');
            if (header) {
                const isActive = Array.isArray(this.filters[field]) && this.filters[field].length > 0;
                header.classList.toggle('filter-active', isActive);
            }
        }

        if (this.filteredRecords.length === 0) {
            body.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 2rem;">No hay registros coincidentes.</td></tr>';
            return;
        }

        body.innerHTML = this.filteredRecords.map(record => {
            const isDelivered = record.entregado === true;
            const rutaInfo = this.routes.find(r => r.id === record.rutaId);
            return `
                <tr class="${isDelivered ? 'ds-row-delivered' : 'ds-row-pending'}">
                    <td><strong>${record.guia || ''}</strong></td>
                    <td><span class="badge ${record.empresa === 'DALSE' ? 'badge-primary' : 'badge-accent'}">${record.empresa || ''}</span></td>
                    <td>${record.fecha ? formatDateShort(record.fecha) : ''}</td>
                    <td>${record.doc || ''} ${record.docNum ? '#' + record.docNum : ''}</td>
                    <td>${sanitizeHTML(record.cliente || '')}</td>
                    <td>${sanitizeHTML(record.vendedor || '')}</td>
                    <td>${record.condicionPago || ''}</td>
                    <td style="font-weight: 700;">$${formatNumber(record.venta || 0, 2)}</td>
                    <td>${sanitizeHTML(record.cobrador || '')}</td>
                    <td style="text-align:right;">$${formatNumber(record.costoEnvio || 0, 2)}</td>
                    <td>
                        <input type="text" class="ds-time-input" value="${record.horaEntrega || ''}" placeholder="HH:MM"
                               onchange="Despacho.updateField('${record.id}', 'horaEntrega', this.value)">
                    </td>
                    <td style="text-align:center;font-size:0.7rem;">
                        ${rutaInfo ? `<span class="badge badge-accent" title="Ruta #${rutaInfo.id.substring(0,6)} - ${sanitizeHTML(rutaInfo.repartidorNombre||'')}">#${rutaInfo.id.substring(0,6)}</span>` : '<span style="color:#ccc;">-</span>'}
                    </td>
                    <td style="text-align: center;">
                        <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: center;">
                            <label class="ds-switch">
                                <input type="checkbox" ${isDelivered ? 'checked' : ''} 
                                       onchange="Despacho.updateField('${record.id}', 'entregado', this.checked)">
                                <span class="ds-slider"></span>
                            </label>
                            ${isDelivered && record.telefono ? `
                                <button class="ds-btn-whatsapp" onclick="Despacho.sendWhatsAppNotification('${record.id}')" title="Enviar WhatsApp">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.548-.68.116-.173.231-.144.39-.087.158.058 1.011.477 1.184.564.173.087.289.129.332.202.043.073.043.419-.101.824z"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.updateFooter();
    },

    updateFooter() {
        let tfoot = document.getElementById('despacho-table-footer');
        if (!tfoot) return;

        const totals = this.filteredRecords.reduce((acc, r) => {
            acc.venta += Number(r.venta || 0);
            acc.total += Number(r.total || 0);
            return acc;
        }, { venta: 0, total: 0 });

        tfoot.innerHTML = `
            <tr class="ds-totals-row">
                <td colspan="8" style="text-align: right;">TOTALES:</td>
                <td>$${totals.venta.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td colspan="4"></td>
            </tr>
        `;
    },

    updateStats() {
        const totals = this.filteredRecords.reduce((acc, r) => {
            acc.venta += Number(r.venta || 0);
            acc.bultos += Number(r.bultos || 0);
            acc.total += Number(r.total || 0);
            if (r.entregado) acc.entregados++;
            return acc;
        }, { venta: 0, bultos: 0, total: 0, entregados: 0 });

        const ventaEl = document.getElementById('ds-stat-total-venta');
        if (ventaEl) ventaEl.textContent = `$${totals.venta.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        const bultosEl = document.getElementById('ds-stat-total-bultos');
        if (bultosEl) bultosEl.textContent = totals.bultos;
        const importeEl = document.getElementById('ds-stat-total-importe');
        if (importeEl) importeEl.textContent = `$${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        const entEl = document.getElementById('ds-stat-total-entregados');
        if (entEl) entEl.textContent = totals.entregados;
    },

    async sendWhatsAppNotification(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record || !record.telefono) {
            showToast('No hay número de teléfono registrado', 'error');
            return;
        }

        // Clean number
        let phone = record.telefono.replace(/\D/g, '');
        // If it doesn't have a country code and looks like a local number, we could potentially prepend one, 
        // but it's safer to let the user enter exactly what's needed or assume local if it's 8 digits.
        // For SV, it would be 503.
        if (phone.length === 8) phone = '503' + phone;

        const message = `Hola ${record.cliente}, te informamos que tu pedido con guía #${record.guia} ha sido entregado exitosamente. ¡Gracias por confiar en Dalse! 😊`;
        const encodedMsg = encodeURIComponent(message);

        const url = `https://wa.me/${phone}?text=${encodedMsg}`;
        window.open(url, '_blank');
    },

    async updateField(recordId, field, value) {
        try {
            await firebase.firestore().collection('interlogic').doc(recordId).update({
                [field]: value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating field:', error);
            showToast('Error al actualizar: ' + error.message, 'error');
        }
    },

    exportToExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('Error: XLSX no cargado', 'error');
            return;
        }
        const headers = ['Guía', 'Empresa', 'Fecha', 'Doc', 'Cliente', 'Vendedor', 'Pago', 'Venta', 'Cobra', 'Total', 'Hora', 'Entregado'];
        const rows = this.filteredRecords.map(r => [
            r.guia || '', r.empresa || '', r.fecha ? formatDate(r.fecha, false) : '', r.doc || '',
            r.cliente || '', r.vendedor || '', r.condicionPago || '', Number(r.venta || 0),
            r.cobrador || '', Number(r.total || 0), r.horaEntrega || '', r.entregado ? 'SÍ' : 'NO'
        ]);
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Despacho');
        XLSX.writeFile(workbook, 'Despacho_Liquidacion.xlsx');
    },

    applyDespachoStyles() {
        if (document.getElementById('ds-styles')) return;
        const style = document.createElement('style');
        style.id = 'ds-styles';
        style.textContent = `
            .ds-row-delivered { background-color: rgba(34, 197, 94, 0.08) !important; }
            .ds-row-pending { border-left: 3px solid #f97316; }
            .ds-time-input { 
                width: 70px; padding: 2px 5px; border: 1px solid var(--border-color); 
                border-radius: 4px; font-size: 0.8rem; text-align: center;
            }
            .ds-totals-row { background: var(--gray-50); font-weight: 700; }
            .ds-switch { position: relative; display: inline-block; width: 34px; height: 18px; }
            .ds-switch input { opacity: 0; width: 0; height: 0; }
            .ds-slider { 
                position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
                background-color: #cbd5e1; transition: .3s; border-radius: 18px;
            }
            .ds-slider:before { 
                position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px;
                background-color: white; transition: .3s; border-radius: 50%;
            }
            input:checked + .ds-slider { background-color: #22c55e; }
            input:checked + .ds-slider:before { transform: translateX(16px); }

            .ds-btn-whatsapp {
                background: #25d366;
                color: white;
                border: none;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: transform 0.2s, background 0.2s;
                padding: 0;
            }
            .ds-btn-whatsapp:hover {
                background: #128c7e;
                transform: scale(1.1);
            }
            .ds-btn-whatsapp svg {
                width: 18px;
                height: 18px;
            }
        `;
        document.head.appendChild(style);
    },

    // ============= MOBILE RENDER =============
    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        this.isMobile = true;

        contentArea.innerHTML = `
            <div style="padding:0 0 8px 0;">
                <h1 style="font-size:1.35rem;font-weight:800;margin-bottom:2px;">🚚 Despacho</h1>
                <p style="font-size:0.78rem;color:#8e8e93;">Seguimiento de entregas</p>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
                <input type="date" id="mds-start" value="${this.filters.startDate}" style="flex:1;padding:10px;border:1px solid #e5e5ea;border-radius:12px;font-size:0.85rem;background:white;min-height:42px;">
                <input type="date" id="mds-end" value="${this.filters.endDate}" style="flex:1;padding:10px;border:1px solid #e5e5ea;border-radius:12px;font-size:0.85rem;background:white;min-height:42px;">
            </div>
            <div class="m-search-bar">
                <span class="search-icon-m">🔍</span>
                <input type="text" id="mds-search" placeholder="Buscar guía, cliente, vendedor..." value="${this.filters.search || ''}">
            </div>
            <div class="m-stats-row" id="mds-stats">
                <div class="m-stat-chip"><div class="m-stat-chip-label">Venta</div><div class="m-stat-chip-value" id="mds-venta">$0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Bultos</div><div class="m-stat-chip-value" id="mds-bultos">0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Entregados</div><div class="m-stat-chip-value" id="mds-entregados">0</div></div>
            </div>
            <div class="m-actions-bar">
                <button class="btn" id="mds-btn-filter" style="border-radius:20px;">🔽 Filtrar</button>
                <button class="btn" id="mds-btn-export" style="border-radius:20px;">📥 Excel</button>
            </div>
            <div class="m-data-list" id="mds-data-list">
                <div style="text-align:center;padding:40px;color:#8e8e93;">Cargando...</div>
            </div>
        `;

        await this.loadRecords();

        document.getElementById('mds-start').addEventListener('change', e => { this.filters.startDate = e.target.value; this.applyFilters(); });
        document.getElementById('mds-end').addEventListener('change', e => { this.filters.endDate = e.target.value; this.applyFilters(); });
        document.getElementById('mds-search').addEventListener('input', e => { this.filters.search = e.target.value; this.applyFilters(); });
        document.getElementById('mds-btn-export').addEventListener('click', () => this.mobileExportExcel());
        document.getElementById('mds-btn-filter').addEventListener('click', () => this.showMobileFilters());
    },

    showMobileFilters() {
        var fields = [{key:'empresa',label:'Empresa'},{key:'condicionPago',label:'Cond. Pago'},{key:'vendedor',label:'Vendedor'},{key:'cobrador',label:'Cobrador'}];
        var body = '';
        fields.forEach(function(f) {
            var values = {};
            this.records.forEach(function(r) { var v = r[f.key]; if (v) values[String(v)] = true; });
            var opts = Object.keys(values).sort();
            if (!opts.length) return;
            body += '<div style="margin-bottom:16px;"><div style="font-weight:700;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#8e8e93;margin-bottom:8px;">' + f.label + '</div><div class="m-filter-list">';
            opts.forEach(function(v) {
                var chk = (this.filters[f.key] || []).includes(v) ? 'checked' : '';
                body += '<label class="m-filter-item"><input type="checkbox" value="' + v + '" ' + chk + ' onchange="Despacho.toggleMobileFilter(\'' + f.key + '\',\'' + v.replace(/'/g,"\\'") + '\',this.checked)"><span>' + (v||'(vacío)') + '</span></label>';
            }, this);
            body += '</div></div>';
        }, this);
        var sheet = document.createElement('div');
        sheet.innerHTML = '<div class="m-sheet-backdrop show" onclick="this.nextElementSibling.remove();this.remove();"></div><div class="m-bottom-sheet show"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">Filtros</span><button class="m-sheet-close" onclick="this.closest(\'.m-bottom-sheet\').remove();document.querySelector(\'.m-sheet-backdrop\').remove();">✕</button></div><div class="m-sheet-body">' + body + '</div><div class="m-sheet-footer"><button class="btn" onclick="Despacho.clearAllFilters();document.querySelectorAll(\'.m-bottom-sheet,.m-sheet-backdrop\').forEach(function(e){e.remove();});">Limpiar</button><button class="btn btn-primary" onclick="document.querySelectorAll(\'.m-bottom-sheet,.m-sheet-backdrop\').forEach(function(e){e.remove();});">Aplicar</button></div></div>';
        document.body.appendChild(sheet);
    },

    toggleMobileFilter(field, value, checked) {
        if (!this.filters[field]) this.filters[field] = [];
        if (checked) { if (!this.filters[field].includes(value)) this.filters[field].push(value); }
        else { this.filters[field] = this.filters[field].filter(function(v) { return v !== value; }); }
        this.applyFilters();
    },

    clearAllFilters() {
        for (var f in this.filters) {
            if (f === 'startDate') { this.filters[f] = getLocalDateString().substring(0, 8) + '01'; }
            else if (f === 'endDate') { this.filters[f] = getLocalDateString(); }
            else if (f === 'search') { this.filters[f] = ''; }
            else if (f === 'status') { this.filters[f] = 'all'; }
            else if (f === 'routeId') { this.filters[f] = null; }
            else if (Array.isArray(this.filters[f])) { this.filters[f] = []; }
        }
        var setVal = function(id, val) { var el = document.getElementById(id); if (el) el.value = val; };
        setVal('ds-filter-start-date', this.filters.startDate);
        setVal('ds-filter-end-date', this.filters.endDate);
        setVal('ds-global-search', '');
        setVal('mds-start', this.filters.startDate);
        setVal('mds-end', this.filters.endDate);
        setVal('mds-search', '');
        this.applyFilters();
    },

    renderMobileCards() {
        var list = document.getElementById('mds-data-list');
        if (!list) return;

        if (this.filteredRecords.length === 0) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📭</div><div class="m-empty-title">Sin registros</div><div class="m-empty-text">No hay coincidencias.</div></div>';
        } else {
            list.innerHTML = this.filteredRecords.map(function(r) {
                var del = r.entregado === true;
                var rutaName = '';
                (this.routes || []).forEach(function(rt) { if (rt.id === r.rutaId) rutaName = rt.repartidorNombre || ''; });
                return '<div class="m-data-card" onclick="Despacho.showMobileDetail(\'' + r.id + '\')" style="' + (del ? 'border-left:3px solid #10b981;' : '') + '">' +
                    '<div class="m-card-header"><span class="m-card-title">#' + (r.guia || r.id.substring(0,6).toUpperCase()) + '</span>' +
                    '<span class="m-card-badge ' + (del ? 'success' : 'warning') + '">' + (del ? '✓ Entregado' : 'Pendiente') + '</span></div>' +
                    '<div class="m-card-rows">' +
                    '<div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value">' + sanitizeHTML(r.cliente || '-') + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Venta / Flete</span><span class="m-card-value money">$' + formatNumber(r.venta || 0, 2) + ' / $' + formatNumber(r.costoEnvio || 0, 2) + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">' + (r.fecha ? formatDateShort(r.fecha) : '-') + '</span></div>' +
                    (rutaName ? '<div class="m-card-row"><span class="m-card-label">Ruta</span><span class="m-card-value">' + sanitizeHTML(rutaName) + '</span></div>' : '') +
                    '<div class="m-card-row"><span class="m-card-label">Hora Ent.</span><span class="m-card-value">' + (r.horaEntrega || '--:--') + '</span></div>' +
                    '</div>' +
                    '<div class="m-card-actions" onclick="event.stopPropagation()">' +
                    '<button class="m-card-action" onclick="Despacho.toggleMobileEntregado(\'' + r.id + '\',' + del + ')" title="' + (del ? 'Marcar pendiente' : 'Marcar entregado') + '">' + (del ? '↩️' : '✅') + '</button>' +
                    (r.telefono ? '<button class="m-card-action" onclick="Despacho.sendWhatsAppNotification(\'' + r.id + '\')" title="WhatsApp" style="color:#25d366;background:#dcfce7;">💬</button>' : '') +
                    '</div></div>';
            }, this).join('');
        }

        var totalVenta = this.filteredRecords.reduce(function(s,r){return s+(parseFloat(r.venta)||0);},0);
        var totalBultos = this.filteredRecords.reduce(function(s,r){return s+(parseFloat(r.bultos)||0);},0);
        var totalEntregados = this.filteredRecords.filter(function(r){return r.entregado===true;}).length;
        var set = function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
        set('mds-venta','$'+formatNumber(totalVenta,0));
        set('mds-bultos',formatNumber(totalBultos));
        set('mds-entregados',totalEntregados);
    },

    toggleMobileEntregado(id, currentState) {
        var newState = !currentState;
        this.updateField(id, 'entregado', newState);
    },

    showMobileDetail(id) {
        var r = this.filteredRecords.find(function(x){return x.id===id;}) || this.records.find(function(x){return x.id===id;});
        if (!r) return;
        var del = r.entregado === true;
        var sheet = document.createElement('div');
        sheet.innerHTML = '<div class="m-sheet-backdrop show" onclick="this.nextElementSibling.remove();this.remove();"></div><div class="m-bottom-sheet show"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">#' + (r.guia || 'Detalle') + '</span><button class="m-sheet-close" onclick="this.closest(\'.m-bottom-sheet\').remove();document.querySelector(\'.m-sheet-backdrop\').remove();">✕</button></div><div class="m-sheet-body"><div style="display:flex;flex-direction:column;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Estado</span><div style="font-weight:600;color:' + (del ? '#10b981' : '#f59e0b') + ';">' + (del ? '✓ Entregado' : '⏳ Pendiente') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Cliente</span><div style="font-weight:500;">' + sanitizeHTML(r.cliente||'-') + '</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Venta</span><div style="font-weight:700;color:#10b981;font-size:1.1rem;">$' + formatNumber(r.venta||0,2) + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Bultos</span><div style="font-weight:500;">' + formatNumber(r.bultos||0) + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Fecha</span><div style="font-weight:500;">' + (r.fecha?formatDateShort(r.fecha):'-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Vendedor</span><div style="font-weight:500;">' + sanitizeHTML(r.vendedor||'-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Cobrador</span><div style="font-weight:500;">' + sanitizeHTML(r.cobrador||'-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Hora Ent.</span><div style="font-weight:500;">' + (r.horaEntrega||'--:--') + '</div></div></div></div></div><div class="m-sheet-footer"><button class="btn ' + (del?'':'btn-primary') + '" onclick="Despacho.updateField(\'' + r.id + '\',\'entregado\',' + !del + ');document.querySelector(\'.m-bottom-sheet\').remove();document.querySelector(\'.m-sheet-backdrop\').remove();">' + (del?'↩ Marcar Pendiente':'✅ Marcar Entregado') + '</button>' + (r.telefono?'<button class="btn" style="background:#dcfce7;color:#25d366;" onclick="Despacho.sendWhatsAppNotification(\''+r.id+'\')">💬 WhatsApp</button>':'') + '</div></div>';
        document.body.appendChild(sheet);
    },

    mobileExportExcel() {
        if (typeof XLSX === 'undefined') { showToast('Librería Excel no disponible','error'); return; }
        if (this.filteredRecords.length === 0) { showToast('No hay datos','warning'); return; }
        var data = this.filteredRecords.map(function(r){return {'Guía':r.guia||'','Empresa':r.empresa||'','Fecha':r.fecha||'','Doc':r.doc||'','N° Doc':r.docNum||'','Cliente':r.cliente||'','Vendedor':r.vendedor||'','Cond.Pago':r.condicionPago||'','Venta':r.venta||0,'Bultos':r.bultos||0,'Cobrador':r.cobrador||'','Hora Entrega':r.horaEntrega||'','Entregado':r.entregado?'Sí':'No'};});
        var ws = XLSX.utils.json_to_sheet(data);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Despacho');
        XLSX.writeFile(wb, 'Despacho_'+new Date().toISOString().split('T')[0]+'.xlsx');
        showToast('Excel exportado');
    }
};

window.Despacho = Despacho;
