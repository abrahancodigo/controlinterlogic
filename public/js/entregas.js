const Entregas = {
    records: [],
    selected: new Set(),
    loading: false,
    isMobile: false,
    filters: {
        startDate: getLocalDateString(),
        endDate: getLocalDateString(),
        dateField: 'fecha',
        estado: ''
    },
    columnFilters: {},
    searchQuery: '',
    visibleColumns: (() => {
        try {
            const saved = localStorage.getItem('entregas_cols');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length) return parsed;
            }
        } catch (error) { console.warn('localStorage:', error); }
        return ['doc', 'docNum', 'cliente', 'condicionPago', 'venta', 'entrega', 'cobra'];
    })(),
    numericRanges: {},
    sortField: '',
    sortDir: '',

    async render() {
        const token = this._renderToken = {};
        this.isMobile = window.innerWidth <= 768;
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;
        contentArea.innerHTML = this._shellHTML();
        const root = document.getElementById('entregas-content');
        if (root) this._bindEvents(root);
        await this.load(token);
    },

    _shellHTML() {
        const card = this.isMobile ? 'border-radius:var(--m-radius);padding:var(--m-spacing);' : '';
        return `
            <div class="card" id="entregas-content" style="${card}">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;flex-wrap:wrap;${this.isMobile ? 'padding:0 0 0.75rem 0;' : ''}">
                    <div>
                        <h2 style="${this.isMobile ? 'font-size:1rem;' : ''}">Entregas</h2>
                        <p style="font-size:0.82rem;color:var(--text-secondary);margin:0.2rem 0 0;">Los resultados se actualizan al cambiar la fecha o los filtros de columna.</p>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <button type="button" class="btn btn-secondary" data-entregas-action="columnas">🗂 Columnas</button>
                        <button type="button" class="btn btn-secondary" data-entregas-action="exportar-excel">📥 Excel</button>
                        <button type="button" class="btn btn-secondary" data-entregas-action="exportar-pdf">📄 PDF</button>
                    </div>
                </div>
                <div class="card-body" style="${this.isMobile ? 'padding:0;' : ''}">
                    <div class="form-group" style="margin:0 0 0.65rem;">
                        <label for="entregas-buscar">Buscar</label>
                        <input type="search" id="entregas-buscar" value="${sanitizeHTML(this.searchQuery)}" placeholder="Cliente, doc #, monto, entrega, cobra…">
                    </div>
                    <div style="display:grid;grid-template-columns:${this.isMobile ? '1fr 1fr' : 'repeat(3, minmax(150px, 220px))'};gap:0.65rem;align-items:end;margin-bottom:1rem;">
                        <div class="form-group" style="margin:0;">
                            <label for="entregas-fecha-inicio">Desde</label>
                            <input type="date" id="entregas-fecha-inicio" value="${this.filters.startDate}">
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label for="entregas-fecha-fin">Hasta</label>
                            <input type="date" id="entregas-fecha-fin" value="${this.filters.endDate}">
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label for="entregas-estado">Estado</label>
                            <select id="entregas-estado">
                                <option value="">Todas</option>
                                <option value="entregadas" ${this.filters.estado === 'entregadas' ? 'selected' : ''}>Entregadas</option>
                                <option value="pendientes" ${this.filters.estado === 'pendientes' ? 'selected' : ''}>Pendientes</option>
                                <option value="no_entregadas" ${this.filters.estado === 'no_entregadas' ? 'selected' : ''}>No entregadas</option>
                                <option value="devoluciones" ${this.filters.estado === 'devoluciones' ? 'selected' : ''}>Devoluciones</option>
                            </select>
                        </div>
                    </div>
                    <div id="entregas-resumen"></div>
                    <div id="entregas-acciones"></div>
                    <div id="entregas-lista"></div>
                </div>
            </div>
        `;
    },

    _bindEvents(container) {
        container.addEventListener('change', (event) => {
            if (event.target.matches('[data-entregas-select]')) {
                if (event.target.checked) this.selected.add(event.target.dataset.entregasSelect);
                else this.selected.delete(event.target.dataset.entregasSelect);
                this._syncSelectAll();
                this._renderActions();
                return;
            }
            if (event.target.matches('[data-entregas-selectall]')) {
                const ids = this._sortedFiltered().map(record => record.id);
                if (event.target.checked) ids.forEach(id => this.selected.add(id));
                else ids.forEach(id => this.selected.delete(id));
                this._renderResults();
                return;
            }
            if (event.target.id === 'entregas-fecha-inicio') this.filters.startDate = event.target.value;
            if (event.target.id === 'entregas-fecha-fin') this.filters.endDate = event.target.value;
            if (event.target.id === 'entregas-estado') {
                this.filters.estado = event.target.value;
                this._renderResults();
                return;
            }
            this.load();
        });
        container.addEventListener('input', (event) => {
            if (event.target.id !== 'entregas-buscar') return;
            this.searchQuery = event.target.value;
            clearTimeout(this._searchTimer);
            this._searchTimer = setTimeout(() => this._renderResults(), 200);
        });
        container.addEventListener('dragstart', (event) => {
            const handle = event.target.closest('[data-col-drag]');
            if (!handle) return;
            this._dragColumn = handle.dataset.colDrag;
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                try { event.dataTransfer.setData('text/plain', this._dragColumn); } catch (error) { }
            }
            handle.style.cursor = 'grabbing';
        });
        container.addEventListener('dragend', () => {
            this._dragColumn = null;
            this._clearDragMarks();
            document.querySelectorAll('#entregas-lista [data-col-drag]').forEach(item => { item.style.cursor = 'grab'; });
        });
        container.addEventListener('dragover', (event) => {
            const th = event.target.closest('th[data-col-key]');
            if (!th || !this._dragColumn || th.dataset.colKey === this._dragColumn) return;
            event.preventDefault();
            th.style.outline = '2px solid #2563eb';
        });
        container.addEventListener('dragleave', (event) => {
            const th = event.target.closest('th[data-col-key]');
            if (th) th.style.outline = '';
        });
        container.addEventListener('drop', (event) => {
            const th = event.target.closest('th[data-col-key]');
            if (!th || !this._dragColumn) return;
            event.preventDefault();
            const from = this._dragColumn;
            this._dragColumn = null;
            this._moveColumn(from, th.dataset.colKey);
        });
        container.addEventListener('click', (event) => {
            const setBtn = event.target.closest('[data-entregas-set]');
            if (setBtn) { this._applyEstado(setBtn.dataset.entregasSet); return; }
            if (event.target.closest('[data-entregas-clear]')) {
                this.selected.clear();
                this._renderResults();
                return;
            }
            const colBtn = event.target.closest('[data-col-filter]');
            if (colBtn) { this._openColumnFilter(colBtn); return; }
            const action = event.target.closest('[data-entregas-action]');
            if (!action) return;
            if (action.dataset.entregasAction === 'exportar-excel') this._exportExcel();
            if (action.dataset.entregasAction === 'exportar-pdf') this._exportPdf();
            if (action.dataset.entregasAction === 'editar') this.showEditModal(action.dataset.id);
            if (action.dataset.entregasAction === 'columnas') this._openColumnPicker(action);
        });
    },

    _date(value) {
        if (!value) return null;
        return value instanceof Date ? value : value.toDate ? value.toDate() : new Date(value);
    },

    _range() {
        const [y1, m1, d1] = this.filters.startDate.split('-').map(Number);
        const [y2, m2, d2] = this.filters.endDate.split('-').map(Number);
        return {
            start: firebase.firestore.Timestamp.fromDate(new Date(y1, m1 - 1, d1, 0, 0, 0)),
            end: firebase.firestore.Timestamp.fromDate(new Date(y2, m2 - 1, d2, 23, 59, 59, 999))
        };
    },

    async load(token) {
        if (!this.filters.startDate || !this.filters.endDate) {
            showToast('Selecciona la fecha inicial y final', 'warning');
            return;
        }
        if (this.filters.startDate > this.filters.endDate) {
            showToast('La fecha inicial no puede ser mayor que la final', 'warning');
            return;
        }
        const currentToken = token || this._renderToken;
        this.loading = true;
        this.columnFilters = {};
        this.numericRanges = {};
        this.sortField = '';
        this.sortDir = '';
        this.selected.clear();
        this._renderLoading();
        try {
            const range = this._range();
            const scope = window.permissions && window.permissions.entregaScope;
            let query = firebase.firestore().collection('interlogic')
                .where(this.filters.dateField, '>=', range.start)
                .where(this.filters.dateField, '<=', range.end)
                .orderBy(this.filters.dateField, 'desc');
            if (Array.isArray(scope) && scope.length) query = query.where('entrega', 'in', scope);
            const all = await fetchAllChunked(query, { chunkSize: 2000 });
            if (currentToken !== this._renderToken) return;
            this._truncated = false;
            this.records = all
                .filter(record => this._date(record[this.filters.dateField]))
                .sort((a, b) => this._date(b[this.filters.dateField]) - this._date(a[this.filters.dateField]));
            this._renderResults();
        } catch (error) {
            if (currentToken !== this._renderToken) return;
            this._renderError(error);
        } finally {
            if (currentToken === this._renderToken) this.loading = false;
        }
    },

    _defaultColumns() {
        return ['doc', 'docNum', 'cliente', 'condicionPago', 'venta', 'entrega', 'cobra'];
    },

    _allColumns() {
        return [
            { key: 'doc', label: 'Doc' },
            { key: 'docNum', label: 'Doc #' },
            { key: 'cliente', label: 'Cliente' },
            { key: 'condicionPago', label: 'Condición' },
            { key: 'venta', label: 'Venta', numeric: true, money: true },
            { key: 'entrega', label: 'Entrega' },
            { key: 'cobra', label: 'Cobra' },
            { key: 'empresa', label: 'Empresa' },
            { key: 'impresa', label: 'Impresa' },
            { key: 'guia', label: 'Guía' },
            { key: 'fecha', label: 'Fecha', date: true },
            { key: 'departamento', label: 'Departamento' },
            { key: 'municipio', label: 'Municipio' },
            { key: 'direccion', label: 'Dirección' },
            { key: 'telefono', label: 'Teléfono' },
            { key: 'vendedor', label: 'Vendedor' },
            { key: 'encargado', label: 'Encargado' },
            { key: 'bultos', label: 'Bultos', numeric: true },
            { key: 'cobrador', label: 'Cajas', numeric: true },
            { key: 'costoEnvio', label: 'Envío', numeric: true, money: true },
            { key: 'costoPorcentaje', label: '% Costo', numeric: true },
            { key: 'formaPago', label: 'Forma Pago' },
            { key: 'estadoEntrega', label: 'Estado', status: true },
            { key: 'anulado', label: 'Anulado', status: true },
            { key: 'fechaEntrega', label: 'Fecha entrega', date: true },
            { key: 'observations', label: 'Observaciones' },
            { key: 'notaEntrega', label: 'Nota entrega' }
        ];
    },

    _columns() {
        const catalog = this._allColumns();
        return this.visibleColumns.map(key => catalog.find(column => column.key === key)).filter(Boolean);
    },

    _estadoTexto(record, key) {
        if (key === 'anulado') return record.anulado === true ? 'Anulado' : 'No';
        if (record.anulado === true) return 'Anulado';
        if (record.estadoEntrega === 'devolucion') return 'Devolución';
        if (record.estadoEntrega === 'no_entregado') return 'No entregado';
        if (record.entregado === true) return 'Entregado';
        return 'Pendiente';
    },

    _cellValue(record, column) {
        if (column.money) {
            const amount = column.key === 'venta' ? signedAmount(record, 'venta') : Number(record[column.key] || 0);
            const color = column.key === 'venta' && record.doc === 'NC' ? '#b91c1c' : 'inherit';
            return `<span style="font-weight:700;color:${color};">${formatCurrency(amount)}</span>`;
        }
        if (column.numeric) return formatNumber(Number(record[column.key] || 0));
        if (column.date) {
            const value = this._date(record[column.key]);
            return value ? sanitizeHTML(value.toLocaleDateString('es-MX')) : '';
        }
        if (column.status) return sanitizeHTML(this._estadoTexto(record, column.key));
        return sanitizeHTML(record[column.key] == null ? '' : record[column.key]);
    },

    _exportValue(record, column) {
        if (column.key === 'venta') return signedAmount(record, 'venta');
        if (column.money || column.numeric) return Number(record[column.key] || 0);
        if (column.date) {
            const value = this._date(record[column.key]);
            return value ? value.toLocaleDateString('es-MX') : '';
        }
        if (column.status) return this._estadoTexto(record, column.key);
        return record[column.key] == null ? '' : String(record[column.key]);
    },

    _displayValue(record, column) {
        if (column.money) return formatCurrency(column.key === 'venta' ? signedAmount(record, 'venta') : Number(record[column.key] || 0));
        return this._exportValue(record, column);
    },

    _saveColumns() {
        try { localStorage.setItem('entregas_cols', JSON.stringify(this.visibleColumns)); } catch (error) { console.warn('localStorage:', error); }
    },

    _clearHiddenFilters() {
        Object.keys(this.columnFilters).forEach(field => {
            if (!this.visibleColumns.includes(field)) delete this.columnFilters[field];
        });
        Object.keys(this.numericRanges).forEach(field => {
            if (!this.visibleColumns.includes(field)) delete this.numericRanges[field];
        });
    },

    _distinct(field) {
        const values = new Set();
        this.records.forEach(record => values.add(String(record[field] ?? '')));
        return Array.from(values).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    },

    _normalize(value) {
        return String(value === null || value === undefined ? '' : value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    },

    _searchHaystack(record) {
        const monto = Number(record.venta || 0);
        return this._normalize([
            record.doc, record.docNum, record.cliente, record.condicionPago,
            record.entrega, record.cobra, record.direccion, record.formaPago,
            record.notaEntrega, monto, monto.toFixed(2), formatCurrency(monto),
            record.entregado === true ? 'entregado entregado' : 'pendiente',
            record.estadoEntrega || '', record.anulado === true ? 'anulado' : ''
        ].join(' ')).replace(/[^a-z0-9.]/g, '');
    },

    _filteredRecords() {
        const query = this._normalize(this.searchQuery).replace(/[^a-z0-9.]/g, '');
        return this.records.filter(record => {
            if (this.filters.estado === 'entregadas' && record.entregado !== true) return false;
            if (this.filters.estado === 'pendientes' && (record.entregado === true || record.doc === 'NC' || record.anulado === true)) return false;
            if (this.filters.estado === 'no_entregadas' && record.estadoEntrega !== 'no_entregado') return false;
            if (this.filters.estado === 'devoluciones' && record.estadoEntrega !== 'devolucion') return false;
            if (query && !this._searchHaystack(record).includes(query)) return false;
            for (const [field, selected] of Object.entries(this.columnFilters)) {
                if (selected && selected.size > 0 && !selected.has(String(record[field] ?? ''))) return false;
            }
            for (const [field, range] of Object.entries(this.numericRanges)) {
                if (!range || (range.min === '' && range.max === '')) continue;
                const value = Number(record[field] || 0);
                if (range.min !== '' && value < Number(range.min)) return false;
                if (range.max !== '' && value > Number(range.max)) return false;
            }
            return true;
        });
    },

    _isContado(record) {
        return String(record.condicionPago || '').toLowerCase().trim() === 'contado';
    },

    _isCredito(record) {
        const cond = String(record.condicionPago || '').toLowerCase().trim();
        return cond === 'credito' || cond === 'crédito';
    },

    _summary(records) {
        let contado = 0, credito = 0, total = 0, days = 0, entregados = 0;
        records.forEach(record => {
            const amount = signedAmount(record, 'venta');
            total += amount;
            if (this._isContado(record)) contado += amount;
            if (this._isCredito(record)) credito += amount;
            if (record.entregado !== true) return;
            entregados++;
            const carga = this._date(record.fecha);
            const entrega = this._date(record.fechaEntrega);
            if (carga && entrega) {
                const a = new Date(carga.getFullYear(), carga.getMonth(), carga.getDate());
                const b = new Date(entrega.getFullYear(), entrega.getMonth(), entrega.getDate());
                days += Math.max(0, Math.round((b - a) / 86400000));
            }
        });
        return {
            contado, credito, total,
            count: entregados,
            pending: records.filter(r => r.entregado !== true && r.doc !== 'NC' && r.anulado !== true).length,
            avgDays: entregados ? days / entregados : 0
        };
    },

    _renderLoading() {
        const list = document.getElementById('entregas-lista');
        if (list) list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-secondary);">Cargando entregas...</div>';
        const summary = document.getElementById('entregas-resumen');
        if (summary) summary.innerHTML = '';
        const actions = document.getElementById('entregas-acciones');
        if (actions) actions.innerHTML = '';
    },

    _renderError(error) {
        console.error('Error cargando entregas:', error);
        const list = document.getElementById('entregas-lista');
        if (list) list.innerHTML = '<div style="padding:1rem;text-align:center;color:#dc2626;">Error al cargar: ' + sanitizeHTML(error.message || '') + '</div>';
    },

    _sortedFiltered() {
        let filtered = this._filteredRecords();
        if (this.sortField && this.sortDir) {
            const cols = this._columns();
            const column = cols.find(item => item.key === this.sortField);
            const dir = this.sortDir === 'asc' ? 1 : -1;
            filtered = [...filtered].sort((a, b) => {
                if (column && column.numeric) {
                    const key = column.key;
                    return (Number(a[key] || 0) - Number(b[key] || 0)) * dir;
                }
                return String(a[this.sortField] ?? '').localeCompare(String(b[this.sortField] ?? ''), 'es', { numeric: true }) * dir;
            });
        }
        return filtered;
    },

    _renderResults() {
        const filtered = this._sortedFiltered();
        const summary = this._summary(filtered);
        const summaryEl = document.getElementById('entregas-resumen');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div style="display:grid;grid-template-columns:${this.isMobile ? '1fr 1fr' : 'repeat(6, 1fr)'};gap:0.65rem;margin-bottom:1rem;">
                    ${this._summaryCard('Contado', formatCurrency(summary.contado), '#047857')}
                    ${this._summaryCard('Crédito', formatCurrency(summary.credito), '#6d28d9')}
                    ${this._summaryCard('Total', formatCurrency(summary.total), '#1e40af')}
                    ${this._summaryCard('Días promedio', summary.avgDays.toFixed(1), '#92400e')}
                    ${this._summaryCard('Entregados', formatNumber(summary.count), '#0f766e')}
                    ${this._summaryCard('Pendientes', formatNumber(summary.pending), '#dc2626')}
                </div>
            `;
        }
        const list = document.getElementById('entregas-lista');
        if (!list) return;
        if (this._truncated) {
            list.innerHTML = '<div style="margin-bottom:0.75rem;padding:0.5rem;background:#fff7ed;color:#92400e;border-radius:8px;font-size:0.8rem;text-align:center;">Se muestran las primeras 1,000 entregas. Ajusta el rango para ver más.</div>';
        } else {
            list.innerHTML = '';
        }
        if (!this.records.length) {
            list.innerHTML += '<div style="padding:2rem;text-align:center;color:var(--text-secondary);">No hay entregas en este rango.</div>';
            this._renderActions();
            return;
        }
        if (!filtered.length) {
            list.innerHTML += '<div style="padding:2rem;text-align:center;color:var(--text-secondary);">Ningún registro coincide con la búsqueda o los filtros.</div>';
            this._renderActions();
            return;
        }
        list.innerHTML += this._tableHTML(filtered);
        this._renderActions();
        this._syncSelectAll();
    },

    _summaryCard(label, value, color) {
        return `
            <div style="background:var(--bg-secondary,#f8fafc);border:1px solid var(--border-color,#e5e7eb);border-radius:10px;padding:0.75rem;">
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-secondary);">${label}</div>
                <div style="font-size:${this.isMobile ? '1rem' : '1.15rem'};font-weight:800;color:${color};margin-top:0.2rem;">${value}</div>
            </div>
        `;
    },

    _exportTotals(rows) {
        let total = 0, contado = 0, credito = 0;
        rows.forEach(record => {
            const amount = signedAmount(record, 'venta');
            total += amount;
            if (this._isContado(record)) contado += amount;
            if (this._isCredito(record)) credito += amount;
        });
        return { total, contado, credito };
    },

    _estadoLabel() {
        if (this.filters.estado === 'entregadas') return 'Entregadas';
        if (this.filters.estado === 'pendientes') return 'Pendientes';
        if (this.filters.estado === 'no_entregadas') return 'No entregadas';
        if (this.filters.estado === 'devoluciones') return 'Devoluciones';
        return 'Todas';
    },

    _formatRange() {
        const fmt = (v) => {
            const [y, m, d] = String(v || '').split('-');
            return (d && m && y) ? `${d}/${m}/${y}` : String(v || '');
        };
        return `${fmt(this.filters.startDate)} → ${fmt(this.filters.endDate)}`;
    },

    async _exportExcel() {
        const rows = this._sortedFiltered();
        if (!rows.length) { showToast('No hay datos para exportar', 'info'); return; }
        try { await ensureLib('xlsx'); } catch (e) { showToast('Excel no disponible (sin conexión al CDN)', 'error'); return; }
        try {
            const cols = this._columns();
            const data = rows.map(record => {
                const row = {};
                cols.forEach(column => { row[column.label] = this._exportValue(record, column); });
                return row;
            });
            const totals = this._exportTotals(rows);
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = Object.keys(data[0]).map(k => ({ wch: Math.max(k.length + 2, ...data.map(r => String(r[k] == null ? '' : r[k]).length + 2)) }));
            const ventaIndex = cols.findIndex(column => column.key === 'venta');
            [['TOTAL', totals.total], ['Contado', totals.contado], ['Crédito', totals.credito]].forEach(([label, value]) => {
                const aoa = cols.map(() => '');
                if (ventaIndex > 0) { aoa[0] = label; aoa[ventaIndex] = value; }
                else { aoa[0] = label; aoa[cols.length - 1] = value; }
                XLSX.utils.sheet_add_aoa(ws, [aoa], { origin: -1 });
            });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Entregas');
            XLSX.writeFile(wb, `Entregas_${this.filters.startDate}_${this.filters.endDate}.xlsx`);
            showToast('Excel exportado exitosamente', 'success');
        } catch (err) {
            console.error('[Entregas] Export Excel error:', err);
            showToast('Error al exportar Excel', 'error');
        }
    },

    async _exportPdf() {
        const rows = this._sortedFiltered();
        if (!rows.length) { showToast('No hay datos para exportar', 'info'); return; }
        try { await ensureLib('html2pdf'); } catch (e) { showToast('PDF no disponible (sin conexión al CDN)', 'error'); return; }
        showToast('Generando PDF...', 'info');
        let wrapper = null;
        try {
            const totals = this._exportTotals(rows);
            const esc = (s) => sanitizeHTML(String(s == null ? '' : s));
            const estadoLabel = this._estadoLabel();
            const cols = this._columns();
            const tableHtml = rows.map(r => `
                <tr style="border-bottom:1px solid #e2e8f0;${r.entregado === true ? 'background:#f0fdf4;' : ''}">
                    ${cols.map(column => `<td style="padding:4px 6px;${column.money || column.numeric ? 'text-align:right;' : ''}${column.key === 'venta' ? 'font-weight:700;' : ''}${column.key === 'venta' && r.doc === 'NC' ? 'color:#991b1b;' : ''}">${esc(this._displayValue(r, column))}</td>`).join('')}
                </tr>
            `).join('');
            const pdfSource = document.createElement('div');
            pdfSource.style.cssText = 'width:9.6in;background:#ffffff;color:#0f172a;font-family:Arial,Helvetica,sans-serif;';
            pdfSource.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:10px;border-bottom:3px solid #2563eb;">
                    <div>
                        <div style="font-size:20px;font-weight:800;">Reporte de Entregas</div>
                        <div style="font-size:11px;color:#64748b;margin-top:2px;">${this._formatRange()} · Estado: ${estadoLabel} · ${formatNumber(rows.length)} registro(s)</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:14px;font-weight:800;color:#2563eb;">Total: ${formatCurrency(totals.total)}</div>
                        <div style="font-size:10px;color:#64748b;">Contado: ${formatCurrency(totals.contado)} · Crédito: ${formatCurrency(totals.credito)}</div>
                    </div>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:10px;">
                    <thead>
                        <tr style="background:#f1f5f9;text-align:left;">
                            ${cols.map(column => `<th style="padding:5px 6px;border-bottom:2px solid #cbd5e1;${column.money || column.numeric ? 'text-align:right;' : ''}">${esc(column.label)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>${tableHtml}</tbody>
                    <tfoot>
                        <tr style="background:#f1f5f9;font-weight:800;">
                            <td colspan="${Math.max(1, cols.length - 3)}" style="padding:5px 6px;border-top:2px solid #cbd5e1;">TOTAL (${formatNumber(rows.length)} registro(s))</td>
                            <td style="padding:5px 6px;border-top:2px solid #cbd5e1;text-align:right;">${formatCurrency(totals.total)}</td>
                            <td colspan="2" style="padding:5px 6px;border-top:2px solid #cbd5e1;font-size:9px;font-weight:600;color:#64748b;">Contado: ${formatCurrency(totals.contado)} · Crédito: ${formatCurrency(totals.credito)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
            wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;';
            wrapper.appendChild(pdfSource);
            document.body.appendChild(wrapper);
            const opt = {
                margin: [0.4, 0.4, 0.4, 0.4],
                filename: `Entregas_${this.filters.startDate}_${this.filters.endDate}.pdf`,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
                pagebreak: { mode: ['css', 'legacy'] }
            };
            await html2pdf().set(opt).from(pdfSource).save();
            showToast('PDF exportado exitosamente', 'success');
        } catch (err) {
            console.error('[Entregas] Export PDF error:', err);
            showToast('Error al generar PDF', 'error');
        } finally {
            if (wrapper) wrapper.remove();
        }
    },

    _rowStyle(record) {
        if (record.anulado === true) return 'background:color-mix(in srgb, #b91c1c 16%, var(--bg-primary,#fff));box-shadow:inset 4px 0 0 0 #b91c1c;';
        if (record.estadoEntrega === 'devolucion') return 'background:color-mix(in srgb, #7c3aed 16%, var(--bg-primary,#fff));box-shadow:inset 4px 0 0 0 #7c3aed;';
        if (record.estadoEntrega === 'no_entregado') return 'background:color-mix(in srgb, #b45309 16%, var(--bg-primary,#fff));box-shadow:inset 4px 0 0 0 #b45309;';
        if (record.entregado === true) return 'background:color-mix(in srgb, #0d9488 16%, var(--bg-primary,#fff));box-shadow:inset 4px 0 0 0 #0d9488;';
        return '';
    },

    _filterButton(column) {
        if (column.date || column.status) return '';
        let active = false;
        if (column.numeric) {
            const range = this.numericRanges[column.key];
            active = !!range && (range.min !== '' || range.max !== '');
        } else active = this.columnFilters[column.key] && this.columnFilters[column.key].size > 0;
        const icon = active ? '#2563eb' : '#6b7280';
        return `<button type="button" data-col-filter="${column.key}" title="Filtrar" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-left:4px;border:1px solid ${active ? '#2563eb' : '#d1d5db'};border-radius:6px;background:${active ? '#eff6ff' : '#fff'};cursor:pointer;vertical-align:middle;padding:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${icon}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg></button>`;
    },

    _tableHTML(filtered) {
        let tableTotal = 0, tableContado = 0, tableCredito = 0;
        filtered.forEach(record => {
            const amount = signedAmount(record, 'venta');
            tableTotal += amount;
            if (this._isContado(record)) tableContado += amount;
            if (this._isCredito(record)) tableCredito += amount;
        });
        const cols = this._columns();
        const summary = this._summary(filtered);
        const visibleIds = filtered.map(record => record.id);
        const allSelected = visibleIds.length > 0 && visibleIds.every(id => this.selected.has(id));
        const canEdit = !!window.permissions?.canEdit;
        const ventaIndex = cols.findIndex(column => column.key === 'venta');
        const leadColspan = (ventaIndex >= 0 ? ventaIndex : cols.length) + (canEdit ? 1 : 0);
        const tailColspan = ventaIndex >= 0 ? cols.length - ventaIndex - 1 : 0;
        const resumen = `Contado: ${formatCurrency(tableContado)} / Crédito: ${formatCurrency(tableCredito)}`;
        return `
            <div style="overflow-x:auto;border:1px solid var(--border-color,#e5e7eb);border-radius:10px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.85rem;min-width:760px;">
                    <thead>
                        <tr style="background:var(--bg-secondary,#f8fafc);text-align:left;">
                            ${canEdit ? `<th style="padding:0.65rem 0.25rem;width:34px;"><input type="checkbox" data-entregas-selectall ${allSelected ? 'checked' : ''} title="Seleccionar todos"></th>` : ''}
                            ${cols.map(column => `<th data-col-key="${sanitizeHTML(column.key)}" style="padding:0.65rem;white-space:nowrap;${column.money || column.numeric ? 'text-align:right;' : ''}"><span data-col-drag="${sanitizeHTML(column.key)}" draggable="true" title="Arrastra para mover la columna" style="cursor:grab;user-select:none;margin-right:5px;color:var(--text-secondary);">≡</span>${column.label} ${this._filterButton(column)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(record => `
                            <tr class="${record.entregado === true ? 'il-row-entregada' : ''}" style="border-top:1px solid var(--border-color,#e5e7eb);${this._rowStyle(record)}">
                                ${canEdit ? `<td style="padding:0.65rem 0.25rem;"><input type="checkbox" data-entregas-select="${sanitizeHTML(record.id)}" ${this.selected.has(record.id) ? 'checked' : ''}></td>` : ''}
                                ${cols.map(column => `<td style="padding:0.65rem;${column.money || column.numeric ? 'text-align:right;white-space:nowrap;' : ''}">${this._cellValue(record, column)}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background:var(--bg-secondary,#f8fafc);border-top:2px solid var(--border-color,#e5e7eb);">
                            ${ventaIndex >= 0 ? `
                            <td colspan="${leadColspan}" style="padding:0.65rem;font-weight:700;">TOTAL (${formatNumber(filtered.length)} registro(s))${tailColspan > 0 ? '' : ' <span style="font-size:0.75rem;font-weight:400;color:var(--text-secondary);">' + resumen + '</span>'}</td>
                            <td style="padding:0.65rem;text-align:right;font-weight:800;color:#2563eb;white-space:nowrap;">${formatCurrency(tableTotal)}</td>
                            ${tailColspan > 0 ? `<td colspan="${tailColspan}" style="padding:0.65rem;font-size:0.75rem;color:var(--text-secondary);">${resumen}</td>` : ''}
                            ` : `
                            <td colspan="${leadColspan}" style="padding:0.65rem;font-weight:700;">TOTAL (${formatNumber(filtered.length)} registro(s)) <strong style="color:#2563eb;">${formatCurrency(tableTotal)}</strong> <span style="font-size:0.75rem;font-weight:400;color:var(--text-secondary);">${resumen}</span></td>
                            `}
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    _openColumnFilter(button) {
        const field = button.dataset.colFilter;
        const column = this._columns().find(item => item.key === field);
        if (!column) return;
        if (this._filterDocHandler) {
            document.removeEventListener('click', this._filterDocHandler);
            this._filterDocHandler = null;
        }
        const existing = document.querySelector('.entregas-filter-panel');
        const wasSame = existing && existing.dataset.field === field;
        if (existing) existing.remove();
        if (wasSame) return;

        const panel = document.createElement('div');
        panel.className = 'entregas-filter-panel';
        panel.dataset.field = field;
        panel.style.cssText = 'position:fixed;z-index:3000;min-width:250px;max-height:min(420px,80vh);overflow:auto;background:var(--bg-primary,#fff);border:1px solid var(--border-color,#e5e7eb);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.18);padding:0.6rem;';

        if (column.numeric) {
            const range = this.numericRanges[field] || { min: '', max: '' };
            panel.innerHTML = `
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.5rem;">Ordenar</div>
                <div style="display:flex;gap:0.4rem;margin-bottom:0.8rem;">
                    <button type="button" data-ef-sort="asc" class="btn btn-secondary" style="flex:1;padding:0.35rem;font-size:0.78rem;">1 → 9</button>
                    <button type="button" data-ef-sort="desc" class="btn btn-secondary" style="flex:1;padding:0.35rem;font-size:0.78rem;">9 → 1</button>
                </div>
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.4rem;">Filtrar por ${sanitizeHTML(column.label)}</div>
                <div style="display:flex;gap:0.4rem;margin-bottom:0.6rem;">
                    <input type="number" id="ef-num-min" placeholder="Mínimo" value="${sanitizeHTML(String(range.min))}" style="width:100%;">
                    <input type="number" id="ef-num-max" placeholder="Máximo" value="${sanitizeHTML(String(range.max))}" style="width:100%;">
                </div>
                <div style="display:flex;gap:0.4rem;">
                    <button type="button" data-ef-action="aplicar" class="btn btn-primary" style="flex:1;padding:0.35rem;">Aplicar</button>
                    <button type="button" data-ef-action="limpiar" class="btn btn-ghost" style="flex:1;padding:0.35rem;">Limpiar</button>
                </div>
            `;
        } else {
            const selected = this.columnFilters[field];
            const counts = new Map();
            this.records.forEach(record => {
                const value = String(record[field] ?? '');
                counts.set(value, (counts.get(value) || 0) + 1);
            });
            const values = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
            const options = values.map(value => {
                const checked = !selected || selected.size === 0 || selected.has(value);
                const label = value === '' ? '(vacío)' : value;
                return `<label style="display:flex;align-items:center;gap:0.45rem;padding:0.18rem 0;font-size:0.82rem;cursor:pointer;"><input type="checkbox" data-ef-value="${sanitizeHTML(value)}" ${checked ? 'checked' : ''}> <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${sanitizeHTML(label)}">${sanitizeHTML(label)}</span> <span style="color:var(--text-secondary);font-size:0.72rem;">${counts.get(value)}</span></label>`;
            }).join('');
            panel.innerHTML = `
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.5rem;">Ordenar</div>
                <div style="display:flex;gap:0.4rem;margin-bottom:0.8rem;">
                    <button type="button" data-ef-sort="asc" class="btn btn-secondary" style="flex:1;padding:0.35rem;font-size:0.78rem;">A → Z</button>
                    <button type="button" data-ef-sort="desc" class="btn btn-secondary" style="flex:1;padding:0.35rem;font-size:0.78rem;">Z → A</button>
                </div>
                <input type="search" id="ef-search" placeholder="Buscar..." style="width:100%;margin-bottom:0.5rem;">
                <label style="display:flex;align-items:center;gap:0.45rem;padding:0.2rem 0;font-size:0.82rem;font-weight:600;border-bottom:1px solid var(--border-color,#e5e7eb);margin-bottom:0.35rem;cursor:pointer;">
                    <input type="checkbox" id="ef-select-all" checked> Seleccionar todo
                </label>
                <div data-ef-options style="max-height:180px;overflow:auto;">${options || '<div style="font-size:0.8rem;color:var(--text-secondary);">Sin valores</div>'}</div>
                <div style="display:flex;gap:0.4rem;margin-top:0.6rem;">
                    <button type="button" data-ef-action="aplicar" class="btn btn-primary" style="flex:1;padding:0.35rem;">Aplicar</button>
                    <button type="button" data-ef-action="limpiar" class="btn btn-ghost" style="flex:1;padding:0.35rem;">Limpiar</button>
                </div>
            `;
        }

        document.body.appendChild(panel);
        const rect = button.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        let left = Math.min(rect.left, window.innerWidth - panelRect.width - 10);
        let top = rect.bottom + 6;
        if (top + panelRect.height > window.innerHeight - 10) top = Math.max(10, rect.top - panelRect.height - 6);
        panel.style.left = Math.max(10, left) + 'px';
        panel.style.top = top + 'px';

        const search = panel.querySelector('#ef-search');
        if (search) {
            search.addEventListener('input', () => {
                const term = search.value.toLowerCase();
                panel.querySelectorAll('[data-ef-value]').forEach(checkbox => {
                    const label = checkbox.parentElement;
                    label.style.display = label.textContent.toLowerCase().includes(term) ? '' : 'none';
                });
            });
        }

        const selectAll = panel.querySelector('#ef-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                panel.querySelectorAll('[data-ef-value]').forEach(checkbox => { checkbox.checked = selectAll.checked; });
            });
        }

        const closePanel = () => {
            panel.remove();
            if (this._filterDocHandler) {
                document.removeEventListener('click', this._filterDocHandler);
                this._filterDocHandler = null;
            }
        };

        panel.addEventListener('click', (event) => {
            const sort = event.target.closest('[data-ef-sort]')?.dataset.efSort;
            if (sort) {
                this.sortField = field;
                this.sortDir = sort;
                closePanel();
                this._renderResults();
                return;
            }
            const action = event.target.closest('[data-ef-action]')?.dataset.efAction;
            if (!action) return;
            if (action === 'aplicar') {
                if (column.numeric) {
                    const min = panel.querySelector('#ef-num-min').value;
                    const max = panel.querySelector('#ef-num-max').value;
                    if (min === '' && max === '') delete this.numericRanges[field];
                    else this.numericRanges[field] = { min, max };
                } else {
                    const checkboxes = [...panel.querySelectorAll('[data-ef-value]')];
                    const checked = checkboxes.filter(item => item.checked).map(item => item.dataset.efValue);
                    if (checked.length === checkboxes.length) delete this.columnFilters[field];
                    else this.columnFilters[field] = new Set(checked);
                }
                closePanel();
                this._renderResults();
            } else if (action === 'limpiar') {
                if (column.numeric) delete this.numericRanges[field];
                else delete this.columnFilters[field];
                closePanel();
                this._renderResults();
            }
        });

        setTimeout(() => {
            this._filterDocHandler = (event) => {
                if (panel.contains(event.target) || event.target.closest('[data-col-filter]') === button) return;
                closePanel();
            };
            document.addEventListener('click', this._filterDocHandler);
        }, 0);
    },

    _colPickerListHTML() {
        const catalog = this._allColumns();
        const visible = this.visibleColumns.map(key => catalog.find(column => column.key === key)).filter(Boolean);
        const hidden = catalog.filter(column => !this.visibleColumns.includes(column.key));
        const visibleRows = visible.map((column, index) => `
            <div data-ec-row="${sanitizeHTML(column.key)}" draggable="true" title="Arrastra para cambiar el orden" style="display:flex;align-items:center;gap:0.35rem;padding:0.2rem 0;font-size:0.82rem;cursor:grab;">
                <span style="color:var(--text-secondary);user-select:none;">≡</span>
                <input type="checkbox" data-ec-col="${sanitizeHTML(column.key)}" checked>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sanitizeHTML(column.label)}</span>
                <button type="button" data-ec-move="up" data-ec-key="${sanitizeHTML(column.key)}" ${index === 0 ? 'disabled' : ''} style="padding:0 0.3rem;border:1px solid var(--border-color,#e5e7eb);border-radius:5px;background:transparent;color:var(--text-secondary);cursor:pointer;">↑</button>
                <button type="button" data-ec-move="down" data-ec-key="${sanitizeHTML(column.key)}" ${index === visible.length - 1 ? 'disabled' : ''} style="padding:0 0.3rem;border:1px solid var(--border-color,#e5e7eb);border-radius:5px;background:transparent;color:var(--text-secondary);cursor:pointer;">↓</button>
            </div>`).join('');
        const hiddenRows = hidden.map(column => `<label style="display:flex;align-items:center;gap:0.45rem;padding:0.2rem 0;font-size:0.82rem;cursor:pointer;"><input type="checkbox" data-ec-col="${sanitizeHTML(column.key)}"> <span>${sanitizeHTML(column.label)}</span></label>`).join('');
        return `
            <div style="font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-secondary);margin:0.1rem 0 0.3rem;">Visibles (arrastra para ordenar)</div>
            <div>${visibleRows || '<div style="font-size:0.78rem;color:var(--text-secondary);">Ninguna</div>'}</div>
            <div style="font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-secondary);margin:0.7rem 0 0.3rem;">Ocultas</div>
            <div>${hiddenRows || '<div style="font-size:0.78rem;color:var(--text-secondary);">Todas visibles</div>'}</div>
        `;
    },

    _moveColumn(fromKey, toKey) {
        const list = this.visibleColumns.slice();
        const from = list.indexOf(fromKey);
        const to = list.indexOf(toKey);
        if (from < 0 || to < 0 || from === to) return false;
        list.splice(from, 1);
        list.splice(to, 0, fromKey);
        this.visibleColumns = list;
        this._saveColumns();
        this._renderResults();
        return true;
    },

    _moveBy(key, delta) {
        const list = this.visibleColumns.slice();
        const index = list.indexOf(key);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= list.length) return false;
        list.splice(index, 1);
        list.splice(target, 0, key);
        this.visibleColumns = list;
        this._saveColumns();
        this._renderResults();
        return true;
    },

    _clearDragMarks() {
        document.querySelectorAll('#entregas-lista th[data-col-key]').forEach(th => { th.style.outline = ''; });
    },

    _openColumnPicker(button) {
        if (this._colsDocHandler) {
            document.removeEventListener('click', this._colsDocHandler);
            this._colsDocHandler = null;
        }
        const existing = document.querySelector('.entregas-cols-panel');
        if (existing) existing.remove();
        const panel = document.createElement('div');
        panel.className = 'entregas-cols-panel';
        panel.style.cssText = 'position:fixed;z-index:3000;min-width:250px;max-height:min(460px,80vh);overflow:auto;background:var(--bg-primary,#fff);border:1px solid var(--border-color,#e5e7eb);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.18);padding:0.6rem;';
        panel.innerHTML = `
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.5rem;">Columnas</div>
            <div data-ec-list>${this._colPickerListHTML()}</div>
            <div style="display:flex;gap:0.4rem;margin-top:0.6rem;">
                <button type="button" data-ec-action="reset" class="btn btn-ghost" style="flex:1;padding:0.35rem;">Restablecer</button>
                <button type="button" data-ec-action="close" class="btn btn-primary" style="flex:1;padding:0.35rem;">Listo</button>
            </div>
        `;
        document.body.appendChild(panel);
        const rect = button.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const left = Math.min(rect.left, window.innerWidth - panelRect.width - 10);
        let top = rect.bottom + 6;
        if (top + panelRect.height > window.innerHeight - 10) top = Math.max(10, rect.top - panelRect.height - 6);
        panel.style.left = Math.max(10, left) + 'px';
        panel.style.top = top + 'px';

        const closePanel = () => {
            panel.remove();
            if (this._colsDocHandler) {
                document.removeEventListener('click', this._colsDocHandler);
                this._colsDocHandler = null;
            }
        };

        const refreshList = () => {
            const host = panel.querySelector('[data-ec-list]');
            if (host) host.innerHTML = this._colPickerListHTML();
        };

        panel.addEventListener('change', (event) => {
            const input = event.target.closest('[data-ec-col]');
            if (!input) return;
            const checked = new Set(Array.from(panel.querySelectorAll('[data-ec-col]')).filter(item => item.checked).map(item => item.dataset.ecCol));
            if (!checked.size) {
                input.checked = true;
                showToast('Deja al menos una columna visible', 'warning');
                return;
            }
            const next = this.visibleColumns.filter(key => checked.has(key));
            this._allColumns().forEach(column => { if (checked.has(column.key) && !next.includes(column.key)) next.push(column.key); });
            this.visibleColumns = next;
            this._clearHiddenFilters();
            this._saveColumns();
            this._renderResults();
            refreshList();
        });

        panel.addEventListener('dragstart', (event) => {
            const row = event.target.closest('[data-ec-row]');
            if (!row) return;
            this._ecDragKey = row.dataset.ecRow;
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                try { event.dataTransfer.setData('text/plain', this._ecDragKey); } catch (error) { }
            }
            row.style.opacity = '0.4';
        });

        panel.addEventListener('dragend', (event) => {
            const row = event.target.closest('[data-ec-row]');
            if (row) row.style.opacity = '1';
            panel.querySelectorAll('[data-ec-row]').forEach(item => { item.style.boxShadow = ''; });
            this._ecDragKey = null;
        });

        panel.addEventListener('dragover', (event) => {
            const row = event.target.closest('[data-ec-row]');
            if (!row || !this._ecDragKey || row.dataset.ecRow === this._ecDragKey) return;
            event.preventDefault();
            row.style.boxShadow = 'inset 0 2px 0 0 #2563eb';
        });

        panel.addEventListener('dragleave', (event) => {
            const row = event.target.closest('[data-ec-row]');
            if (row) row.style.boxShadow = '';
        });

        panel.addEventListener('drop', (event) => {
            const row = event.target.closest('[data-ec-row]');
            if (!row || !this._ecDragKey) return;
            event.preventDefault();
            const from = this._ecDragKey;
            this._ecDragKey = null;
            if (this._moveColumn(from, row.dataset.ecRow)) refreshList();
        });

        panel.addEventListener('click', (event) => {
            const move = event.target.closest('[data-ec-move]');
            if (move) {
                if (this._moveBy(move.dataset.ecKey, move.dataset.ecMove === 'up' ? -1 : 1)) refreshList();
                return;
            }
            const action = event.target.closest('[data-ec-action]')?.dataset.ecAction;
            if (!action) return;
            if (action === 'reset') {
                this.visibleColumns = this._defaultColumns().slice();
                this._clearHiddenFilters();
                this._saveColumns();
                this._renderResults();
                refreshList();
                return;
            }
            closePanel();
        });

        setTimeout(() => {
            this._colsDocHandler = (event) => {
                if (panel.contains(event.target) || button.contains(event.target)) return;
                closePanel();
            };
            document.addEventListener('click', this._colsDocHandler);
        }, 0);
    },

    _visibleSelectedIds() {
        const visible = new Set(this._sortedFiltered().map(record => record.id));
        return Array.from(this.selected).filter(id => visible.has(id));
    },

    _syncSelectAll() {
        const master = document.querySelector('#entregas-lista [data-entregas-selectall]');
        if (!master) return;
        const ids = this._sortedFiltered().map(record => record.id);
        const count = ids.filter(id => this.selected.has(id)).length;
        master.checked = ids.length > 0 && count === ids.length;
        master.indeterminate = count > 0 && count < ids.length;
    },

    _renderActions() {
        const host = document.getElementById('entregas-acciones');
        if (!host) return;
        if (!window.permissions?.canEdit) { host.innerHTML = ''; return; }
        const visibleRecords = this._sortedFiltered().filter(record => this.selected.has(record.id));
        const count = visibleRecords.length;
        const on = count > 0;
        const button = (action, label, color, enabled) => {
            const active = enabled === undefined ? on : enabled;
            return `<button type="button" data-entregas-set="${action}" ${active ? '' : 'disabled'} style="padding:0.55rem 0.8rem;border:0;border-radius:9px;font-weight:800;font-size:0.78rem;letter-spacing:0.02em;color:#fff;background:${color};cursor:${active ? 'pointer' : 'not-allowed'};opacity:${active ? '1' : '0.45'};">${label}</button>`;
        };
        host.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem;padding:0.6rem 0.7rem;border:1px solid var(--border-color,#e5e7eb);border-radius:10px;background:var(--bg-secondary,#f8fafc);">
                <span style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);white-space:nowrap;">${on ? formatNumber(count) + ' seleccionado(s)' : 'Selecciona uno o varios pedidos'}</span>
                ${button('entregado', 'ENTREGADO', '#0d9488')}
                ${button('no_entregado', 'NO ENTREGADO', '#b45309')}
                ${button('devolucion', 'DEVOLUCIÓN', '#7c3aed')}
                ${button('anulado', 'ANULACIÓN', '#b91c1c')}
                ${button('pendiente', 'PENDIENTE', '#475569')}
                ${on ? '<button type="button" data-entregas-clear title="Quitar la selección y dejarla como estaba" style="padding:0.55rem 0.6rem;border:1px solid var(--border-color,#e5e7eb);border-radius:9px;background:transparent;color:var(--text-secondary);font-weight:800;cursor:pointer;">✕</button>' : ''}
            </div>
        `;
    },

    async _commitInChunks(ids, addOperation) {
        const db = firebase.firestore();
        for (let index = 0; index < ids.length; index += 400) {
            const batch = db.batch();
            ids.slice(index, index + 400).forEach(id => addOperation(batch, db.collection('interlogic').doc(id)));
            await batch.commit();
        }
    },

    _isEstadoActive(record, action) {
        if (action === 'entregado') return record.entregado === true;
        return record.estadoEntrega === action;
    },

    _estadoUpdate(record, action, now, uid) {
        if (action === 'anulado') {
            return record.anulado === true
                ? { anulado: false, reactivadoAt: now, reactivadoPor: uid, updatedAt: now }
                : { anulado: true, anuladoAt: now, anuladoPor: uid, updatedAt: now };
        }
        if (action === 'pendiente' || this._isEstadoActive(record, action)) {
            return {
                entregado: false,
                fechaEntrega: firebase.firestore.FieldValue.delete(),
                estadoEntrega: firebase.firestore.FieldValue.delete(),
                entregaEstadoAt: firebase.firestore.FieldValue.delete(),
                entregaEstadoPor: firebase.firestore.FieldValue.delete(),
                updatedAt: now
            };
        }
        const update = { entregado: action === 'entregado', estadoEntrega: action, entregaEstadoAt: now, entregaEstadoPor: uid, updatedAt: now };
        if (action === 'entregado') update.fechaEntrega = now;
        return update;
    },

    _estadoLocal(record, action, stamp, uid) {
        if (action === 'anulado') {
            if (record.anulado === true) {
                record.anulado = false;
                record.reactivadoAt = stamp;
                record.reactivadoPor = uid;
            } else {
                record.anulado = true;
                record.anuladoAt = stamp;
                record.anuladoPor = uid;
            }
            return;
        }
        if (action === 'pendiente' || this._isEstadoActive(record, action)) {
            record.entregado = false;
            delete record.fechaEntrega;
            delete record.estadoEntrega;
            delete record.entregaEstadoAt;
            delete record.entregaEstadoPor;
            return;
        }
        record.entregado = action === 'entregado';
        record.estadoEntrega = action;
        record.entregaEstadoAt = stamp;
        record.entregaEstadoPor = uid;
        if (action === 'entregado') record.fechaEntrega = stamp;
    },

    async _applyEstado(action) {
        if (!window.permissions?.canEdit) {
            showToast('No tienes permisos para editar registros', 'error');
            return;
        }
        const ids = this._visibleSelectedIds();
        if (!ids.length) return;
        const labels = { entregado: 'entregado', no_entregado: 'no entregado', devolucion: 'devolución', anulado: 'anulado', pendiente: 'pendiente' };
        const records = this.records.filter(record => ids.includes(record.id));
        const ignored = records.filter(record => record.doc === 'NC' || (action !== 'anulado' && record.anulado === true));
        const targets = records.filter(record => record.doc !== 'NC' && (action === 'anulado' || record.anulado !== true));
        if (ignored.length) showToast(ignored.length + ' registro(s) omitido(s): nota de crédito o anulado', 'info');
        if (!targets.length) { showToast('Los registros seleccionados no admiten ese estado', 'warning'); return; }
        if (action === 'anulado') {
            const aAnular = targets.filter(record => record.anulado !== true).length;
            const aReactivar = targets.length - aAnular;
            const detalle = [aAnular ? aAnular + ' dejarán de sumar en los totales' : '', aReactivar ? aReactivar + ' volverán a sumar en los totales' : ''].filter(Boolean).join(' · ');
            if (!await showConfirm('¿Cambiar el estado de ' + targets.length + ' registro(s)?', detalle + '. Igual que en Control Interlogic.')) return;
        }
        const applied = targets.filter(record => action === 'anulado' ? record.anulado !== true : !this._isEstadoActive(record, action)).length;
        const reverted = targets.length - applied;
        const targetIds = targets.map(record => record.id);
        const user = firebase.auth().currentUser;
        const uid = user ? user.uid : null;
        try {
            await this._commitInChunks(targetIds, (batch, ref) => {
                const now = firebase.firestore.FieldValue.serverTimestamp();
                const source = targets.find(record => record.id === ref.id);
                if (!source) return;
                batch.update(ref, this._estadoUpdate(source, action, now, uid));
            });
            const stamp = new Date();
            targets.forEach(record => this._estadoLocal(record, action, stamp, uid));
            this.selected.clear();
            this._renderResults();
            const parts = [];
            if (applied) parts.push(applied + ' ' + labels[action]);
            if (reverted) parts.push(reverted + (action === 'pendiente' ? ' a pendiente' : reverted === 1 ? ' revertido' : ' revertidos'));
            showToast('✓ ' + (parts.join(' · ') || 'Sin cambios'), 'success');
        } catch (error) {
            console.error('[Entregas] Error al registrar estado:', error);
            showToast('Error al registrar: ' + error.message, 'error');
        }
    },

    showEditModal(id) {
        if (!window.permissions?.canEdit) return;
        const record = this.records.find(item => item.id === id);
        if (!record) return;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h2 style="margin-bottom:0.5rem;">Editar entrega</h2>
                <p style="color:var(--text-secondary);margin-bottom:1rem;">${sanitizeHTML(record.cliente || '')} · ${sanitizeHTML((record.doc || '') + ' ' + (record.docNum || ''))}</p>
                <div class="form-group">
                    <label for="entregas-forma-pago">Forma de pago</label>
                    <select id="entregas-forma-pago">
                        <option value="" ${!record.formaPago ? 'selected' : ''}>Sin pago (Crédito)</option>
                        <option value="Efectivo" ${record.formaPago === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                        <option value="Cheque" ${record.formaPago === 'Cheque' ? 'selected' : ''}>Cheque</option>
                        <option value="Transferencia" ${record.formaPago === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
                        <option value="Abono" ${record.formaPago === 'Abono' ? 'selected' : ''}>Abono</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="entregas-nota">Nota / observación</label>
                    <textarea id="entregas-nota" rows="3" placeholder="Ej. Era contado, se dejó al crédito. Pago por cheque.">${sanitizeHTML(record.notaEntrega || '')}</textarea>
                </div>
                <div style="display:flex;gap:0.6rem;justify-content:flex-end;">
                    <button type="button" class="btn btn-ghost" data-modal-action="cancel">Cancelar</button>
                    <button type="button" class="btn btn-primary" data-modal-action="save">Guardar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-modal-action]')?.dataset.modalAction;
            if (!action) {
                if (event.target === modal) modal.remove();
                return;
            }
            if (action === 'cancel') { modal.remove(); return; }
            const saveBtn = modal.querySelector('[data-modal-action="save"]');
            const formaPago = modal.querySelector('#entregas-forma-pago').value;
            const notaEntrega = modal.querySelector('#entregas-nota').value.trim();
            saveBtn.disabled = true;
            try {
                const update = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
                if (formaPago) update.formaPago = formaPago;
                else update.formaPago = firebase.firestore.FieldValue.delete();
                if (notaEntrega) update.notaEntrega = notaEntrega;
                else update.notaEntrega = firebase.firestore.FieldValue.delete();
                await firebase.firestore().collection('interlogic').doc(record.id).update(update);
                if (formaPago) record.formaPago = formaPago;
                else delete record.formaPago;
                if (notaEntrega) record.notaEntrega = notaEntrega;
                else delete record.notaEntrega;
                modal.remove();
                this._renderResults();
                showToast('Entrega actualizada', 'success');
            } catch (error) {
                saveBtn.disabled = false;
                showToast('Error al guardar: ' + error.message, 'error');
            }
        });
    }
};

window.Entregas = Entregas;

if (window.ModuleRegistry) {
    ModuleRegistry.register({
        key: 'entregas',
        label: 'Entregas',
        render: () => Entregas.render(),
        cleanup: () => {
            document.querySelectorAll('.entregas-filter-panel').forEach(el => el.remove());
            document.querySelectorAll('.entregas-cols-panel').forEach(el => el.remove());
            if (Entregas._filterDocHandler) {
                document.removeEventListener('click', Entregas._filterDocHandler);
                Entregas._filterDocHandler = null;
            }
            if (Entregas._colsDocHandler) {
                document.removeEventListener('click', Entregas._colsDocHandler);
                Entregas._colsDocHandler = null;
            }
        }
    });
}
