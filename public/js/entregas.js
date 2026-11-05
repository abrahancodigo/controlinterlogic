const Entregas = {
    records: [],
    loading: false,
    isMobile: false,
    filters: {
        startDate: getLocalDateString(),
        endDate: getLocalDateString(),
        dateField: 'fecha'
    },
    columnFilters: {},
    ventaMin: '',
    ventaMax: '',
    sortField: '',
    sortDir: '',

    async render() {
        const token = this._renderToken = {};
        this.isMobile = window.innerWidth <= 768;
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;
        contentArea.innerHTML = this._shellHTML();
        this._bindEvents(contentArea);
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
                        <button type="button" class="btn btn-secondary" data-entregas-action="exportar-excel">📥 Excel</button>
                        <button type="button" class="btn btn-secondary" data-entregas-action="exportar-pdf">📄 PDF</button>
                    </div>
                </div>
                <div class="card-body" style="${this.isMobile ? 'padding:0;' : ''}">
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
                            </select>
                        </div>
                    </div>
                    <div id="entregas-resumen"></div>
                    <div id="entregas-lista"></div>
                </div>
            </div>
        `;
    },

    _bindEvents(container) {
        container.addEventListener('change', (event) => {
            if (event.target.id === 'entregas-fecha-inicio') this.filters.startDate = event.target.value;
            if (event.target.id === 'entregas-fecha-fin') this.filters.endDate = event.target.value;
            if (event.target.id === 'entregas-estado') {
                this.filters.estado = event.target.value;
                this._renderResults();
                return;
            }
            this.load();
        });
        container.addEventListener('click', (event) => {
            const colBtn = event.target.closest('[data-col-filter]');
            if (colBtn) { this._openColumnFilter(colBtn); return; }
            const action = event.target.closest('[data-entregas-action]');
            if (!action) return;
            if (action.dataset.entregasAction === 'consultar') this.load();
            if (action.dataset.entregasAction === 'exportar-excel') this._exportExcel();
            if (action.dataset.entregasAction === 'exportar-pdf') this._exportPdf();
            if (action.dataset.entregasAction === 'editar') this.showEditModal(action.dataset.id);
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
        if (!this.filters.startDate || !this.filters.endDate) return;
        if (this.filters.startDate > this.filters.endDate) {
            showToast('La fecha inicial no puede ser mayor que la final', 'warning');
            return;
        }
        const currentToken = token || this._renderToken;
        this.loading = true;
        this.columnFilters = {};
        this.ventaMin = '';
        this.ventaMax = '';
        this.sortField = '';
        this.sortDir = '';
        this._renderLoading();
        try {
            const range = this._range();
            const snapshot = await firebase.firestore().collection('interlogic')
                .where(this.filters.dateField, '>=', range.start)
                .where(this.filters.dateField, '<=', range.end)
                .limit(1000)
                .get();
            if (currentToken !== this._renderToken) return;
            this._truncated = snapshot.size === 1000;
            this.records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
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

    _columns() {
        return [
            { key: 'doc', label: 'Doc' },
            { key: 'docNum', label: 'Doc #' },
            { key: 'cliente', label: 'Cliente' },
            { key: 'condicionPago', label: 'Condición' },
            { key: 'venta', label: 'Venta', numeric: true },
            { key: 'entrega', label: 'Entrega' },
            { key: 'cobra', label: 'Cobra' }
        ];
    },

    _distinct(field) {
        const values = new Set();
        this.records.forEach(record => values.add(String(record[field] ?? '')));
        return Array.from(values).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    },

    _filteredRecords() {
        return this.records.filter(record => {
            if (this.filters.estado === 'entregadas' && record.entregado !== true) return false;
            if (this.filters.estado === 'pendientes' && (record.entregado === true || record.doc === 'NC' || record.anulado === true)) return false;
            for (const [field, selected] of Object.entries(this.columnFilters)) {
                if (selected && selected.size > 0 && !selected.has(String(record[field] ?? ''))) return false;
            }
            const venta = Number(record.venta || 0);
            if (this.ventaMin !== '' && venta < Number(this.ventaMin)) return false;
            if (this.ventaMax !== '' && venta > Number(this.ventaMax)) return false;
            return true;
        });
    },

    _summary(records) {
        let contado = 0, credito = 0, total = 0, days = 0, entregados = 0;
        records.forEach(record => {
            if (record.entregado !== true) return;
            entregados++;
            const amount = signedAmount(record, 'venta');
            total += amount;
            if (record.condicionPago === 'Contado') contado += amount;
            if (record.condicionPago === 'Crédito') credito += amount;
            const carga = this._date(record.fecha);
            const entrega = this._date(record.fechaEntrega);
            if (carga && entrega) days += Math.max(0, (entrega - carga) / 86400000);
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
                if (column && column.numeric) return (Number(a.venta || 0) - Number(b.venta || 0)) * dir;
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
            return;
        }
        list.innerHTML += this._tableHTML(filtered);
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
            if (record.condicionPago === 'Contado') contado += amount;
            if (record.condicionPago === 'Crédito') credito += amount;
        });
        return { total, contado, credito };
    },

    _estadoLabel() {
        if (this.filters.estado === 'entregadas') return 'Entregadas';
        if (this.filters.estado === 'pendientes') return 'Pendientes';
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
            const data = rows.map(r => ({
                'Doc': r.doc || '',
                'Doc #': r.docNum || '',
                'Cliente': r.cliente || '',
                'Condición': r.condicionPago || '',
                'Venta': signedAmount(r, 'venta'),
                'Entrega': r.entrega || '',
                'Cobra': r.cobra || ''
            }));
            const totals = this._exportTotals(rows);
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = Object.keys(data[0]).map(k => ({ wch: Math.max(k.length + 2, ...data.map(r => String(r[k] == null ? '' : r[k]).length + 2)) }));
            XLSX.utils.sheet_add_aoa(ws, [['', '', '', 'TOTAL', totals.total, '', '']], { origin: -1 });
            XLSX.utils.sheet_add_aoa(ws, [['', '', '', 'Contado', totals.contado, '', '']], { origin: -1 });
            XLSX.utils.sheet_add_aoa(ws, [['', '', '', 'Crédito', totals.credito, '', '']], { origin: -1 });
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
            const tableHtml = rows.map(r => `
                <tr style="border-bottom:1px solid #e2e8f0;${r.entregado === true ? 'background:#f0fdf4;' : ''}">
                    <td style="padding:4px 6px;">${esc(r.doc)}</td>
                    <td style="padding:4px 6px;">${esc(r.docNum)}</td>
                    <td style="padding:4px 6px;">${esc(r.cliente)}</td>
                    <td style="padding:4px 6px;">${esc(r.condicionPago)}</td>
                    <td style="padding:4px 6px;text-align:right;font-weight:700;${r.doc === 'NC' ? 'color:#991b1b;' : 'color:#0f172a;'}">${formatCurrency(signedAmount(r, 'venta'))}</td>
                    <td style="padding:4px 6px;">${esc(r.entrega)}</td>
                    <td style="padding:4px 6px;">${esc(r.cobra)}</td>
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
                            <th style="padding:5px 6px;border-bottom:2px solid #cbd5e1;">Doc</th>
                            <th style="padding:5px 6px;border-bottom:2px solid #cbd5e1;">Doc #</th>
                            <th style="padding:5px 6px;border-bottom:2px solid #cbd5e1;">Cliente</th>
                            <th style="padding:5px 6px;border-bottom:2px solid #cbd5e1;">Condición</th>
                            <th style="padding:5px 6px;border-bottom:2px solid #cbd5e1;text-align:right;">Venta</th>
                            <th style="padding:5px 6px;border-bottom:2px solid #cbd5e1;">Entrega</th>
                            <th style="padding:5px 6px;border-bottom:2px solid #cbd5e1;">Cobra</th>
                        </tr>
                    </thead>
                    <tbody>${tableHtml}</tbody>
                    <tfoot>
                        <tr style="background:#f1f5f9;font-weight:800;">
                            <td colspan="4" style="padding:5px 6px;border-top:2px solid #cbd5e1;">TOTAL (${formatNumber(rows.length)} registro(s))</td>
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

    _filterButton(column) {
        let active = false;
        if (column.numeric) active = this.ventaMin !== '' || this.ventaMax !== '';
        else active = this.columnFilters[column.key] && this.columnFilters[column.key].size > 0;
        const icon = active ? '#2563eb' : '#6b7280';
        return `<button type="button" data-col-filter="${column.key}" title="Filtrar" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-left:4px;border:1px solid ${active ? '#2563eb' : '#d1d5db'};border-radius:6px;background:${active ? '#eff6ff' : '#fff'};cursor:pointer;vertical-align:middle;padding:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${icon}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg></button>`;
    },

    _tableHTML(filtered) {
        let tableTotal = 0, tableContado = 0, tableCredito = 0;
        filtered.forEach(record => {
            const amount = signedAmount(record, 'venta');
            tableTotal += amount;
            if (record.condicionPago === 'Contado') tableContado += amount;
            if (record.condicionPago === 'Crédito') tableCredito += amount;
        });
        const cols = this._columns();
        const summary = this._summary(filtered);
        return `
            <div style="overflow-x:auto;border:1px solid var(--border-color,#e5e7eb);border-radius:10px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.85rem;min-width:760px;">
                    <thead>
                        <tr style="background:var(--bg-secondary,#f8fafc);text-align:left;">
                            ${cols.map(column => `<th style="padding:0.65rem;white-space:nowrap;">${column.label} ${this._filterButton(column)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(record => `
                            <tr style="border-top:1px solid var(--border-color,#e5e7eb);${record.entregado === true ? 'background:#dcfce7;' : ''}">
                                <td style="padding:0.65rem;">${sanitizeHTML(record.doc || '')}</td>
                                <td style="padding:0.65rem;">${sanitizeHTML(record.docNum || '')}</td>
                                <td style="padding:0.65rem;">${sanitizeHTML(record.cliente || '')}</td>
                                <td style="padding:0.65rem;">${sanitizeHTML(record.condicionPago || '')}</td>
                                <td style="padding:0.65rem;font-weight:700;${record.doc === 'NC' ? 'color:#b91c1c;' : 'color:#0f172a;'}">${formatCurrency(signedAmount(record, 'venta'))}</td>
                                <td style="padding:0.65rem;">${sanitizeHTML(record.entrega || '')}</td>
                                <td style="padding:0.65rem;">${sanitizeHTML(record.cobra || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background:var(--bg-secondary,#f8fafc);border-top:2px solid var(--border-color,#e5e7eb);">
                            <td colspan="4" style="padding:0.65rem;font-weight:700;">TOTAL (${formatNumber(filtered.length)} registro(s))</td>
                            <td style="padding:0.65rem;font-weight:800;color:#2563eb;">${formatCurrency(tableTotal)}</td>
                            <td colspan="2" style="padding:0.65rem;font-size:0.75rem;color:var(--text-secondary);">Contado: ${formatCurrency(tableContado)} · Crédito: ${formatCurrency(tableCredito)}</td>
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
        const existing = document.querySelector('.entregas-filter-panel');
        const wasSame = existing && existing.dataset.field === field;
        if (existing) existing.remove();
        if (wasSame) return;

        const panel = document.createElement('div');
        panel.className = 'entregas-filter-panel';
        panel.dataset.field = field;
        panel.style.cssText = 'position:fixed;z-index:3000;min-width:250px;max-height:min(420px,80vh);overflow:auto;background:var(--bg-primary,#fff);border:1px solid var(--border-color,#e5e7eb);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.18);padding:0.6rem;';

        if (column.numeric) {
            panel.innerHTML = `
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.5rem;">Ordenar</div>
                <div style="display:flex;gap:0.4rem;margin-bottom:0.8rem;">
                    <button type="button" data-ef-sort="asc" class="btn btn-secondary" style="flex:1;padding:0.35rem;font-size:0.78rem;">1 → 9</button>
                    <button type="button" data-ef-sort="desc" class="btn btn-secondary" style="flex:1;padding:0.35rem;font-size:0.78rem;">9 → 1</button>
                </div>
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.4rem;">Filtrar por venta</div>
                <div style="display:flex;gap:0.4rem;margin-bottom:0.6rem;">
                    <input type="number" id="ef-venta-min" placeholder="Mínimo" value="${this.ventaMin}" style="width:100%;">
                    <input type="number" id="ef-venta-max" placeholder="Máximo" value="${this.ventaMax}" style="width:100%;">
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

        panel.addEventListener('click', (event) => {
            const sort = event.target.closest('[data-ef-sort]')?.dataset.efSort;
            if (sort) {
                this.sortField = field;
                this.sortDir = sort;
                panel.remove();
                this._renderResults();
                return;
            }
            const action = event.target.closest('[data-ef-action]')?.dataset.efAction;
            if (!action) return;
            if (action === 'aplicar') {
                if (column.numeric) {
                    this.ventaMin = panel.querySelector('#ef-venta-min').value;
                    this.ventaMax = panel.querySelector('#ef-venta-max').value;
                } else {
                    const checkboxes = [...panel.querySelectorAll('[data-ef-value]')];
                    const checked = checkboxes.filter(item => item.checked).map(item => item.dataset.efValue);
                    if (checked.length === checkboxes.length) delete this.columnFilters[field];
                    else this.columnFilters[field] = new Set(checked);
                }
                panel.remove();
                this._renderResults();
            } else if (action === 'limpiar') {
                if (column.numeric) { this.ventaMin = ''; this.ventaMax = ''; }
                else delete this.columnFilters[field];
                panel.remove();
                this._renderResults();
            }
        });

        setTimeout(() => {
            document.addEventListener('click', function handler(event) {
                if (panel.contains(event.target) || event.target.closest('[data-col-filter]') === button) return;
                panel.remove();
                document.removeEventListener('click', handler);
            });
        }, 0);
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
        }
    });
}
