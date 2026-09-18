const LIQ_RT_LIMIT = 800;

const Liquidacion = {
    routes: [],
    repartidores: [],
    liquidaciones: [],
    queue: [],
    routeDels: [],
    doneRecords: [],
    _lastActions: {},
    _lastActionsKey: 'liq_last_actions_v1',
    _loadLastActions() {
        try { this._lastActions = JSON.parse(sessionStorage.getItem(this._lastActionsKey) || '{}') || {}; } catch (e) { this._lastActions = {}; }
    },
    _saveLastActions() {
        try { sessionStorage.setItem(this._lastActionsKey, JSON.stringify(this._lastActions)); } catch (e) { }
    },
    selectedRouteId: 'all',
    dayFilter: null,
    dayDels: [],
    filters: { search: '', estado: 'todos' },
    selected: new Set(),
    unsub: { rutas: null, queue: null, dels: null },
    _planRows: 0,

    cleanup() {
        this._renderToken = null;
        Object.keys(this.unsub).forEach(k => {
            if (this.unsub[k]) { this.unsub[k](); this.unsub[k] = null; }
        });
        this.selected.clear();
        this._lastActions = {};
        this.queue = [];
        this.routeDels = [];
        this.doneRecords = [];
        this.dayDels = [];
        this._todayRecords = [];
        this._historyRecords = [];
        this._historyLoading = false;
        this.selectedRouteId = 'all';
        this.dayFilter = null;
        this.filters = { search: '', estado: 'todos' };
    },

    _toDate(v) {
        if (!v) return null;
        if (v instanceof Date) return v;
        if (typeof v.toDate === 'function') return v.toDate();
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    },

    _cobrado(r) {
        return Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0)) || 0;
    },

    _pendiente(r) {
        return Math.max(0, (Number(r.venta) || 0) - this._cobrado(r));
    },

    _status(r) {
        if (r.entregado === true) return this._pendiente(r) > 0 ? 'cobrar' : 'listo';
        return 'entregar';
    },

    _vencimiento(r) {
        return this._toDate(r.fechaVencimiento);
    },

    _isVencido(r) {
        if (this._pendiente(r) <= 0) return false;
        const v = this._vencimiento(r);
        if (!v) return false;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        return v < hoy;
    },

    _isContado(r) {
        return (r.condicionPago || '').toLowerCase() === 'contado';
    },

    _routeOf(r) {
        if (!r.rutaId) return null;
        return this.routes.find(rt => rt.id === r.rutaId) || null;
    },

    _routeLabel(rutaId) {
        const rt = this.routes.find(x => x.id === rutaId);
        if (!rt) return '-';
        return 'Ruta #' + (rt.correlativo || rutaId.substring(0, 6));
    },

    async _commitChunks(ops) {
        const db = firebase.firestore();
        for (let i = 0; i < ops.length; i += 400) {
            const batch = db.batch();
            ops.slice(i, i + 400).forEach(op => {
                if (op.t === 'set') batch.set(op.ref, op.data);
                else if (op.t === 'delete') batch.delete(op.ref);
                else batch.update(op.ref, op.data);
            });
            await batch.commit();
        }
    },

    async render() {
        const area = document.getElementById('content-area');
        if (!area) return;
        const renderToken = this._renderToken = {};
        area.innerHTML = '<div style="text-align:center;padding:3rem;">Cargando liquidación...</div>';
        this._loadLastActions();
        console.log('[Liquidacion] v8 cargado · acciones deshacibles:', Object.keys(this._lastActions).length);
        this.dayFilter = getLocalDateString();
        await this._loadBase(renderToken);
        if (this._renderToken !== renderToken) return;
        this._renderShell();
        this._subscribeAll();
    },

    async _loadBase(renderToken = this._renderToken) {
        const db = firebase.firestore();
        const results = await Promise.allSettled([
            db.collection('repartidores').orderBy('nombre', 'asc').get(),
            db.collection('liquidaciones').orderBy('createdAt', 'desc').limit(500).get()
        ]);
        if (this._renderToken !== renderToken) return;
        this.repartidores = results[0].status === 'fulfilled' ? results[0].value.docs.map(d => ({ id: d.id, ...d.data() })) : [];
        this.liquidaciones = results[1].status === 'fulfilled' ? results[1].value.docs.map(d => ({ id: d.id, ...d.data() })) : [];
    },

    async _reloadRepartidores() {
        try {
            const repSnap = await firebase.firestore().collection('repartidores').orderBy('nombre', 'asc').get();
            this.repartidores = repSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { }
    },

    async _openDrivers() {
        await this._reloadRepartidores();
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        const paint = () => {
            const list = modal.querySelector('#liq-drv-list');
            if (!list) return;
            list.innerHTML = this.repartidores.length === 0 ? '<p style="font-size:0.85rem;color:#8e8e93;text-align:center;padding:1rem;">Sin repartidores registrados</p>' :
                '<div class="table-container"><table class="data-table" style="font-size:0.8rem;"><thead><tr><th>Nombre</th><th>Vehículo</th><th>Zona</th><th style="text-align:right;">Comisión</th><th>Estado</th><th></th></tr></thead><tbody>' +
                this.repartidores.map(x => '<tr><td><strong>' + sanitizeHTML(x.nombre || '') + '</strong><br><span style="font-size:0.72rem;color:#666;">' + sanitizeHTML(x.telefono || '') + '</span></td><td>' + sanitizeHTML(x.vehiculo || '-') + '</td><td>' + sanitizeHTML(x.zona || '-') + '</td><td style="text-align:right;">' + (x.comisionPct ?? 70) + '%</td><td>' + (x.activo !== false ? '<span class="badge badge-primary">Activo</span>' : '<span class="badge">Inactivo</span>') + '</td><td style="white-space:nowrap;"><button class="btn btn-secondary btn-sm" data-drv-edit="' + x.id + '">Editar</button> <button class="btn btn-sm" data-drv-toggle="' + x.id + '">' + (x.activo !== false ? 'Desactivar' : 'Activar') + '</button> <button class="btn btn-danger btn-sm" data-drv-del="' + x.id + '">Eliminar</button></td></tr>').join('') +
                '</tbody></table></div>';
            list.querySelectorAll('[data-drv-edit]').forEach(b => { b.onclick = () => this._driverForm(modal, paint, b.dataset.drvEdit); });
            list.querySelectorAll('[data-drv-toggle]').forEach(b => { b.onclick = async () => {
                const x = this.repartidores.find(r => r.id === b.dataset.drvToggle);
                if (!x) return;
                try {
                    await firebase.firestore().collection('repartidores').doc(x.id).update({ activo: !(x.activo !== false), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                    await this._reloadRepartidores();
                    paint();
                } catch (err) { showToast('Error: ' + err.message, 'error'); }
            }; });
            list.querySelectorAll('[data-drv-del]').forEach(b => { b.onclick = async () => {
                if (!await showConfirm('Eliminar repartidor', 'Esta acción no se puede deshacer.')) return;
                try {
                    await firebase.firestore().collection('repartidores').doc(b.dataset.drvDel).delete();
                    await this._reloadRepartidores();
                    paint();
                    showToast('Repartidor eliminado', 'success');
                } catch (err) { showToast('Error: ' + err.message, 'error'); }
            }; });
        };
        modal.innerHTML = '<div class="modal-content" style="max-width:640px;max-height:90vh;overflow-y:auto;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;"><h2>Repartidores</h2><button class="btn btn-primary btn-sm" id="liq-drv-new">Nuevo</button></div>' +
            '<div id="liq-drv-list"></div>' +
            '<div style="display:flex;justify-content:flex-end;margin-top:1rem;"><button class="btn btn-secondary" id="liq-drv-close">Cerrar</button></div></div>';
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.getElementById('liq-drv-close').onclick = () => modal.remove();
        document.getElementById('liq-drv-new').onclick = () => this._driverForm(modal, paint, null);
        paint();
    },

    _driverForm(parentModal, repaint, recordId) {
        const record = recordId ? this.repartidores.find(r => r.id === recordId) : null;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.style.zIndex = '10001';
        modal.innerHTML = '<div class="modal-content" style="max-width:480px;">' +
            '<h2 style="margin-bottom:1rem;">' + (record ? 'Editar repartidor' : 'Nuevo repartidor') + '</h2>' +
            '<form id="liq-drv-form"><div class="form-group"><label>Nombre *</label><input type="text" id="liq-drv-nombre" style="width:100%;" value="' + sanitizeHTML(record?.nombre || '') + '" required></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem;"><div class="form-group"><label>Teléfono</label><input type="text" id="liq-drv-tel" style="width:100%;" value="' + sanitizeHTML(record?.telefono || '') + '"></div>' +
            '<div class="form-group"><label>Vehículo</label><input type="text" id="liq-drv-veh" style="width:100%;" value="' + sanitizeHTML(record?.vehiculo || '') + '" placeholder="Placa o modelo"></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem;"><div class="form-group"><label>Zona</label><input type="text" id="liq-drv-zona" style="width:100%;" value="' + sanitizeHTML(record?.zona || '') + '"></div>' +
            '<div class="form-group"><label>Comisión (%)</label><input type="number" id="liq-drv-com" min="0" max="100" style="width:100%;" value="' + (record?.comisionPct ?? 70) + '"></div></div>' +
            '<div class="form-group" style="margin-top:0.75rem;"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;"><input type="checkbox" id="liq-drv-act" ' + (record?.activo !== false ? 'checked' : '') + '> Repartidor activo</label></div>' +
            '<div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;"><button type="button" class="btn btn-secondary" id="liq-drv-cancel">Cancelar</button><button type="submit" class="btn btn-primary" id="liq-drv-save">Guardar</button></div></form></div>';
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.getElementById('liq-drv-cancel').onclick = () => modal.remove();
        document.getElementById('liq-drv-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('liq-drv-save');
            setButtonLoading(btn, true);
            try {
                const nombre = document.getElementById('liq-drv-nombre').value.trim();
                if (!nombre) { showToast('Nombre requerido', 'error'); setButtonLoading(btn, false); return; }
                const cv = parseInt(document.getElementById('liq-drv-com').value, 10);
                const data = { nombre, telefono: document.getElementById('liq-drv-tel').value.trim(), vehiculo: document.getElementById('liq-drv-veh').value.trim(), zona: document.getElementById('liq-drv-zona').value.trim(), comisionPct: Number.isFinite(cv) ? cv : 70, activo: document.getElementById('liq-drv-act').checked, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
                if (recordId) {
                    await firebase.firestore().collection('repartidores').doc(recordId).update(data);
                    showToast('Repartidor actualizado', 'success');
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await firebase.firestore().collection('repartidores').add(data);
                    showToast('Repartidor creado', 'success');
                }
                await this._reloadRepartidores();
                modal.remove();
                repaint();
            } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        });
    },

    _subscribeAll() {
        const db = firebase.firestore();
        if (this.unsub.rutas) this.unsub.rutas();
        this.unsub.rutas = db.collection('rutas').orderBy('fecha', 'desc').limit(200).onSnapshot(snap => {
            this.routes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this._renderRouteBar();
            this._renderStats();
        }, () => {});

        // --- Frente operativo de HOY (tiempo real, listener pequeño) ---
        // Solo registros creados hoy: nuevas guías, entregas y cobros del día
        // llegan en vivo. El histórico (hasta 180 días) se carga por get() una
        // sola vez (cacheable, sin fan-out de lecturas).
        if (this.unsub.queue) this.unsub.queue();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayTs = firebase.firestore.Timestamp.fromDate(todayStart);
        this.unsub.queue = db.collection('interlogic')
            .where('createdAt', '>=', todayTs)
            .orderBy('createdAt', 'desc')
            .limit(LIQ_RT_LIMIT)
            .onSnapshot(snap => {
                this._todayRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                this._mergeRecords();
            }, () => {});

        this._fetchHistory();
        this._subscribeRouteDels();
    },

    // Carga ONE-TIME del histórico (get() + cursores). Mismo shape de query que
    // antes (una sola desigualdad sobre createdAt), no requiere índices nuevos.
    async _fetchHistory() {
        if (this._historyLoading) return;
        this._historyLoading = true;
        const db = firebase.firestore();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 180);
        cutoff.setHours(0, 0, 0, 0);
        const startTs = firebase.firestore.Timestamp.fromDate(cutoff);
        const baseQuery = db.collection('interlogic')
            .where('createdAt', '>=', startTs)
            .orderBy('createdAt', 'desc');
        try {
            this._historyRecords = await fetchAllChunked(baseQuery, { chunkSize: 1000, maxRecords: 5000 });
        } catch (e) {
            console.error('[Liquidacion] error cargando histórico:', e);
            this._historyRecords = [];
        }
        this._historyLoading = false;
        this._mergeRecords();
    },

    // Mezcla histórico (get) + hoy (live, gana en conflictos) y reparte en
    // queue/doneRecords. Misma lógica de siempre, sin cambiar los consumers.
    _mergeRecords() {
        const map = new Map();
        (this._historyRecords || []).forEach(r => map.set(r.id, r));
        (this._todayRecords || []).forEach(r => map.set(r.id, r));
        const all = Array.from(map.values());
        const valid = all.filter(r => r.doc !== 'NC' && r.anulado !== true);
        this.queue = valid.filter(r => r.entregado !== true || this._pendiente(r) > 0);
        this.doneRecords = valid.filter(r => r.entregado === true && this._pendiente(r) <= 0);
        this._renderStats();
        this._renderList();
    },

    _subscribeRouteDels() {
        if (this.unsub.dels) { this.unsub.dels(); this.unsub.dels = null; }
        this.routeDels = [];
        if (!this.selectedRouteId || this.selectedRouteId === 'all' || this.selectedRouteId === 'none') return;
        const db = firebase.firestore();
        this.unsub.dels = db.collection('rutaEntregas').where('rutaId', '==', this.selectedRouteId).onSnapshot(snap => {
            this.routeDels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.routeDels.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
            this._renderRouteBar();
        }, () => {});
    },

    _renderShell() {
        const area = document.getElementById('content-area');
        const mobile = window.innerWidth <= 768;
        area.innerHTML =
            '<div class="module-header"><div><h1 style="' + (mobile ? 'font-size:1.35rem;font-weight:800;' : '') + '">Liquidación</h1>' +
            '<p style="' + (mobile ? 'font-size:0.78rem;color:#8e8e93;' : '') + '">Ruta del día, cobro y cierre en un solo lugar <span style="font-size:0.65rem;color:#c0c0c0;">v8</span></p></div>' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
            '<button class="btn btn-secondary" data-act="alerts" id="liq-alerts-btn">Vencidos: 0</button>' +
            '<button class="btn btn-secondary" data-act="drivers">Repartidores</button>' +
            '<button class="btn btn-secondary" data-act="new-route">Nueva ruta</button>' +
            '<button class="btn btn-secondary" data-act="export-excel" title="Descargar lo filtrado a Excel">📥 Excel</button>' +
            '<button class="btn btn-secondary" data-act="export-pdf" title="Descargar lo filtrado a PDF">🖨 PDF</button>' +
            '<button class="btn btn-primary" data-act="liquidate" id="liq-btn-liquidar">Liquidar ruta</button>' +
            '</div></div>' +
            '<div id="liq-stats"></div>' +
            '<div class="card" style="margin-bottom:1rem;"><div class="card-body" id="liq-routebar"></div></div>' +
            '<div id="liq-bulkbar"></div>' +
            '<div class="card"><div class="table-container" id="liq-list"></div></div>';
        area.onclick = (e) => this._handleClick(e);
        this._renderRouteBar();
        this._renderStats();
        this._renderList();
    },

    _handleClick(e) {
        const el = e.target.closest('[data-act]');
        if (!el) return;
        const act = el.dataset.act;
        const id = el.dataset.id;
        if (act === 'chip') { this.filters.estado = el.dataset.f; this._renderRouteBar(); this._renderList(); }
        else if (act === 'alerts') { this.filters.estado = 'vencidos'; this._renderRouteBar(); this._renderList(); }
        else if (act === 'sel') this._toggleSelect(id);
        else if (act === 'selall') this._toggleSelectAll(el);
        else if (act === 'go') this._primaryAction(id);
        else if (act === 'nodel') this._openNoDeliver(id);
        else if (act === 'unassign') this._unassign(id);
        else if (act === 'ficha') this._openFicha(el.dataset.cliente);
        else if (act === 'bulk-go') this._bulkDeliver();
        else if (act === 'bulk-assign') this._openAssign();
        else if (act === 'bulk-clear') { this.selected.clear(); this._renderList(); }
        else if (act === 'new-route') this._openNewRoute();
        else if (act === 'drivers') this._openDrivers();
        else if (act === 'liquidate') this._openLiquidate();
        else if (act === 'day-liq') { this.selectedRouteId = id; this._subscribeRouteDels(); this._renderRouteBar(); this._renderList(); this._openLiquidate(); }
        else if (act === 'day-sel') { this.selectedRouteId = id; this._subscribeRouteDels(); this._renderRouteBar(); this._renderList(); }
        else if (act === 'day-all') { this.dayFilter = ''; this._renderRouteBar(); this._renderStats(); this._renderList(); }
        else if (act === 'undo') this._undo(id);
        else if (act === 'print-liq') this._printLiquidation();
        else if (act === 'export-excel') this._exportExcel();
        else if (act === 'export-pdf') this._exportPdf();
        else if (act === 'del-route') this._deleteRoute();
    },

    _recordDay(r) {
        const d = this._toDate(r.fecha) || this._toDate(r.createdAt);
        return d ? toDateKey(d) : '';
    },

    _filteredDone() {
        const s = (this.filters.search || '').toLowerCase().trim();
        return this.doneRecords.filter(r => {
            if (this.dayFilter && this._recordDay(r) !== this.dayFilter) return false;
            if (this.selectedRouteId === 'none' && r.rutaId) return false;
            if (this.selectedRouteId !== 'all' && this.selectedRouteId !== 'none' && r.rutaId !== this.selectedRouteId) return false;
            if (s && ((r.guia || '') + ' ' + (r.cliente || '')).toLowerCase().indexOf(s) === -1) return false;
            return true;
        });
    },

    _filteredQueue() {
        const s = (this.filters.search || '').toLowerCase().trim();
        return this.queue.filter(r => {
            if (this.dayFilter && this._recordDay(r) !== this.dayFilter) return false;
            if (this.selectedRouteId === 'none' && r.rutaId) return false;
            if (this.selectedRouteId !== 'all' && this.selectedRouteId !== 'none' && r.rutaId !== this.selectedRouteId) return false;
            const st = this._status(r);
            if (this.filters.estado === 'entregar' && st !== 'entregar') return false;
            if (this.filters.estado === 'cobrar' && st !== 'cobrar') return false;
            if (this.filters.estado === 'vencidos' && !this._isVencido(r)) return false;
            if (s && ((r.guia || '') + ' ' + (r.cliente || '')).toLowerCase().indexOf(s) === -1) return false;
            return true;
        });
    },

    _exportRows() {
        const rows = [];
        this._filteredQueue().forEach(r => rows.push({ record: r, estado: this._status(r) === 'entregar' ? 'Por entregar' : 'Por cobrar' }));
        const doneIds = new Set();
        this._filteredDone().forEach(r => { if (!doneIds.has(r.id)) { doneIds.add(r.id); rows.push({ record: r, estado: 'Completado' }); } });
        return rows;
    },

    _exportData() {
        return this._exportRows().map(item => {
            const r = item.record;
            return {
                'Guía': r.guia || '',
                'Cliente': r.cliente || '',
                'Venta': Number(r.venta) || 0,
                'Condición': r.condicionPago || '',
                'Entrega': r.entrega || '',
                'Cobra': r.cobra || '',
                'Ruta': r.rutaId ? this._routeLabel(r.rutaId) : 'Sin ruta',
                'Estado': item.estado,
                'Abonos': this._cobrado(r),
                'CxC': this._pendiente(r),
                'Fecha': this._recordDay(r)
            };
        });
    },

    async _exportExcel() {
        if (typeof ExcelJS === 'undefined') {
            showToast('Librería Excel no disponible', 'error');
            return;
        }
        const data = this._exportData();
        if (data.length === 0) {
            showToast('No hay datos filtrados para exportar', 'warning');
            return;
        }
        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Liquidación', { views: [{ state: 'frozen', ySplit: 3 }] });
            const totalCols = 11;
            const moneyFmt = '#,##0.00';
            const center = { vertical: 'middle', horizontal: 'center', wrapText: true };
            const left = { vertical: 'middle', horizontal: 'left', wrapText: true };
            const right = { vertical: 'middle', horizontal: 'right', wrapText: true };
            const border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
            sheet.mergeCells(1, 1, 1, totalCols);
            const title = sheet.getCell(1, 1);
            title.value = 'Liquidación';
            title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF111111' } };
            title.alignment = { vertical: 'middle', horizontal: 'center' };
            sheet.getRow(1).height = 24;
            sheet.mergeCells(2, 1, 2, totalCols);
            const sub = sheet.getCell(2, 1);
            sub.value = 'Registros filtrados: ' + data.length + ' · Generado: ' + new Date().toLocaleString('es-MX');
            sub.font = { name: 'Arial', size: 10, color: { argb: 'FF6B7280' } };
            sub.alignment = { vertical: 'middle', horizontal: 'center' };
            sheet.getRow(2).height = 16;
            const headers = ['Guía', 'Cliente', 'Venta', 'Condición', 'Entrega', 'Cobra', 'Ruta', 'Estado', 'Abonos', 'CxC', 'Fecha'];
            const widths = [16, 30, 14, 14, 18, 18, 16, 15, 14, 14, 14];
            headers.forEach((h, i) => {
                const cell = sheet.getCell(3, i + 1);
                cell.value = h;
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111111' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
                cell.alignment = center;
                cell.border = border;
                sheet.getColumn(i + 1).width = widths[i];
            });
            sheet.getRow(3).height = 18;
            sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: totalCols } };
            data.forEach((r, idx) => {
                const n = idx + 4;
                const vals = [r['Guía'], r['Cliente'], r['Venta'], r['Condición'], r['Entrega'], r['Cobra'], r['Ruta'], r['Estado'], r['Abonos'], r['CxC'], r['Fecha']];
                vals.forEach((v, i) => {
                    const cell = sheet.getCell(n, i + 1);
                    cell.value = v;
                    cell.font = { name: 'Arial', size: 10, color: { argb: 'FF111111' } };
                    cell.border = border;
                    if (i === 2 || i === 8 || i === 9) { cell.numFmt = moneyFmt; cell.alignment = right; }
                    else if (i === 1) cell.alignment = left;
                    else cell.alignment = center;
                    if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                });
                sheet.getRow(n).height = 16;
            });
            const tot = data.length + 4;
            const sums = { 3: 0, 9: 0, 10: 0 };
            data.forEach(r => { sums[3] += Number(r['Venta']) || 0; sums[9] += Number(r['Abonos']) || 0; sums[10] += Number(r['CxC']) || 0; });
            const label = sheet.getCell(tot, 1);
            label.value = 'TOTALES';
            label.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111111' } };
            label.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
            label.alignment = center;
            label.border = border;
            sheet.mergeCells(tot, 1, tot, 2);
            [3, 9, 10].forEach(c => {
                const cell = sheet.getCell(tot, c);
                cell.value = Math.round(sums[c] * 100) / 100;
                cell.numFmt = moneyFmt;
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111111' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
                cell.alignment = right;
                cell.border = border;
            });
            for (let c = 4; c <= totalCols; c++) {
                if (c === 9 || c === 10) continue;
                const cell = sheet.getCell(tot, c);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
                cell.border = border;
            }
            sheet.getRow(tot).height = 18;
            sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
            sheet.pageMargins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4 };
            sheet.printTitleRow = '1:3';
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Liquidacion_' + getLocalDateString() + '.xlsx';
            a.click();
            URL.revokeObjectURL(url);
            showToast(data.length + ' registros exportados a Excel', 'success');
        } catch (e) {
            showToast('No se pudo generar el Excel', 'error');
        }
    },

    _exportPdf() {
        const data = this._exportData();
        if (data.length === 0) {
            showToast('No hay datos filtrados para exportar', 'warning');
            return;
        }
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showToast('Librería PDF no disponible', 'error');
            return;
        }
        showToast('Generando PDF...', 'info');
        try {
            const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
            const M = 10, PW = 297, PH = 210, W = PW - M * 2;
            const cols = [
                { k: 'Guía', w: 22, a: 'left' }, { k: 'Cliente', w: 48, a: 'left' },
                { k: 'Venta', w: 22, a: 'right' }, { k: 'Condición', w: 20, a: 'left' },
                { k: 'Entrega', w: 24, a: 'left' }, { k: 'Cobra', w: 24, a: 'left' },
                { k: 'Ruta', w: 25, a: 'left' }, { k: 'Estado', w: 24, a: 'left' },
                { k: 'Abonos', w: 23, a: 'right' }, { k: 'CxC', w: 23, a: 'right' },
                { k: 'Fecha', w: 22, a: 'left' }
            ];
            if (cols.reduce((s, c) => s + c.w, 0) !== W) cols[1].w += W - cols.reduce((s, c) => s + c.w, 0);
            const plain = v => String(v == null ? '' : v);
            const money = v => plain(formatCurrency(v));
            const rows = data.map(r => [plain(r['Guía']), plain(r['Cliente']), money(r['Venta']), plain(r['Condición']), plain(r['Entrega']), plain(r['Cobra']), plain(r['Ruta']), plain(r['Estado']), money(r['Abonos']), money(r['CxC']), plain(r['Fecha'])]);
            const LH = 4.2, PAD = 1.4, MINH = 7;
            let y = 0;
            const header = () => {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(15);
                doc.setTextColor(17, 17, 17);
                doc.text('Liquidación', PW / 2, y + 6, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.text('Registros filtrados: ' + data.length + '  -  Generado: ' + new Date().toLocaleString('es-MX'), PW / 2, y + 11, { align: 'center' });
                y += 16;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                let x = M;
                cols.forEach(c => {
                    doc.setFillColor(229, 231, 235);
                    doc.setDrawColor(156, 163, 175);
                    doc.rect(x, y, c.w, MINH, 'FD');
                    doc.setTextColor(17, 17, 17);
                    doc.text(c.k, c.a === 'right' ? x + c.w - PAD : x + PAD, y + 4.6, { align: c.a });
                    x += c.w;
                });
                y += MINH;
            };
            y = M;
            header();
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            rows.forEach(cells => {
                const lines = cells.map((t, i) => doc.splitTextToSize(t, cols[i].w - PAD * 2));
                const h = Math.max(MINH, lines.reduce((m, l) => Math.max(m, l.length), 1) * LH + PAD * 2 - 1);
                if (y + h > PH - M) { doc.addPage(); y = M; header(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); }
                let x = M;
                cells.forEach((t, i) => {
                    doc.setDrawColor(209, 213, 219);
                    doc.rect(x, y, cols[i].w, h);
                    doc.setTextColor(17, 17, 17);
                    doc.text(lines[i], cols[i].a === 'right' ? x + cols[i].w - PAD : x + PAD, y + PAD + 3.2, { align: cols[i].a, lineHeightFactor: 1 });
                    x += cols[i].w;
                });
                y += h;
            });
            const n = doc.getNumberOfPages();
            for (let i = 1; i <= n; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(120, 120, 120);
                doc.text('Página ' + i + ' de ' + n, PW / 2, PH - 5, { align: 'center' });
            }
            doc.save('Liquidacion_' + getLocalDateString() + '.pdf');
            showToast(data.length + ' registros exportados a PDF', 'success');
        } catch (e) {
            showToast('No se pudo generar el PDF', 'error');
        }
    },

    _renderStats() {
        const box = document.getElementById('liq-stats');
        if (!box) return;
        let porEntregar = 0, porCobrar = 0, vencido = 0, proy30 = 0, vencidos = 0;
        const limit = new Date();
        limit.setDate(limit.getDate() + 30);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        this._filteredQueue().forEach(r => {
            const st = this._status(r);
            if (st === 'entregar') porEntregar += Number(r.venta) || 0;
            if (st === 'cobrar') porCobrar += this._pendiente(r);
            if (this._isVencido(r)) { vencido += this._pendiente(r); vencidos++; }
            (r.planPagos || []).forEach(p => {
                const d = this._toDate(p.fecha);
                if (d && d >= hoy && d <= limit) proy30 += Number(p.monto) || 0;
            });
        });
        box.innerHTML = SharedComponents.renderStatsGrid([
            { label: 'Por entregar', id: 'liq-st-entregar' },
            { label: 'Por cobrar', id: 'liq-st-cobrar', style: 'color:#b45309;' },
            { label: 'Vencido', id: 'liq-st-vencido', style: 'color:#dc2626;' },
            { label: 'Proyección 30 días', id: 'liq-st-proy', style: 'color:#6d28d9;' }
        ], { containerId: '', containerStyle: 'margin-bottom:1rem;' });
        const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
        set('liq-st-entregar', formatCurrency(porEntregar));
        set('liq-st-cobrar', formatCurrency(porCobrar));
        set('liq-st-vencido', formatCurrency(vencido));
        set('liq-st-proy', formatCurrency(proy30));
        const ab = document.getElementById('liq-alerts-btn');
        if (ab) ab.textContent = 'Vencidos: ' + vencidos;
    },

    _renderRouteBar() {
        const bar = document.getElementById('liq-routebar');
        if (!bar) return;
        const pend = this.routes.filter(r => r.estado !== 'liquidado');
        const sel = this.routes.find(r => r.id === this.selectedRouteId);
        const isLiq = sel && sel.estado === 'liquidado';
        const liqBtn = document.getElementById('liq-btn-liquidar');
        if (liqBtn) liqBtn.disabled = !(sel && !isLiq);
        const f = this.filters.estado;
        const chip = (k, label) => '<button class="btn ' + (f === k ? 'btn-primary' : 'btn-secondary') + ' btn-sm" data-act="chip" data-f="' + k + '">' + label + '</button>';
        bar.innerHTML =
            '<div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">' +
            '<label style="font-size:0.85rem;white-space:nowrap;">Día: <input type="date" id="liq-day" value="' + (this.dayFilter || '') + '" style="padding:0.6rem;border:2px solid var(--border-color);border-radius:var(--radius-md);"></label>' +
            '<button class="btn btn-secondary btn-sm" data-act="day-all" title="Ver registros de todos los días">Todas</button>' +
            '<select id="liq-route-select" style="flex:1;min-width:200px;padding:0.6rem;">' +
            '<option value="all">Todas (' + this.queue.length + ' pendientes)</option>' +
            '<option value="none"' + (this.selectedRouteId === 'none' ? ' selected' : '') + '>Sin ruta asignada</option>' +
            this.routes.map(r => {
                const fecha = r.fecha && r.fecha.toDate ? r.fecha.toDate().toLocaleDateString('es-ES') : '';
                return '<option value="' + r.id + '"' + (this.selectedRouteId === r.id ? ' selected' : '') + '>Ruta #' + (r.correlativo || r.id.substring(0, 6)) + ' - ' + sanitizeHTML(r.repartidorNombre || 'Sin repartidor') + ' - ' + fecha + (r.estado === 'liquidado' ? ' (LIQUIDADA)' : '') + '</option>';
            }).join('') +
            '</select>' +
            '<input type="text" id="liq-search" placeholder="Buscar guía o cliente..." value="' + sanitizeHTML(this.filters.search || '') + '" style="flex:1;min-width:160px;padding:0.6rem;border:2px solid var(--border-color);border-radius:var(--radius-md);">' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;align-items:center;">' +
            chip('todos', 'Todos') + chip('entregar', 'Por entregar') + chip('cobrar', 'Por cobrar') + chip('vencidos', 'Vencidos') +
            (sel ? '<span style="font-size:0.8rem;color:#666;">' + sanitizeHTML(sel.repartidorNombre || '') + ' · ' + sanitizeHTML(sel.vehiculo || '') + ' · ' + sanitizeHTML(sel.zona || '') + (isLiq ? ' · <strong style="color:#16a34a;">LIQUIDADA</strong> <button class="btn btn-secondary btn-sm" data-act="print-liq">Imprimir</button> <button class="btn btn-danger btn-sm" data-act="del-route">Eliminar</button>' : '') + '</span>' : '') +
            '<span style="font-size:0.8rem;color:#8e8e93;margin-left:auto;">' + pend.length + ' rutas activas</span>' +
            '</div>' +
            '<div id="liq-daypanel" style="margin-top:0.75rem;"></div>';
        const select = document.getElementById('liq-route-select');
        if (select) select.onchange = (e) => {
            this.selectedRouteId = e.target.value;
            this.selected.clear();
            this._subscribeRouteDels();
            this._renderRouteBar();
            this._renderList();
        };
        const search = document.getElementById('liq-search');
        if (search) search.oninput = (e) => { this.filters.search = e.target.value; this._renderList(); };
        const day = document.getElementById('liq-day');
        if (day) day.onchange = (e) => { this.dayFilter = e.target.value; this.selected.clear(); this._renderRouteBar(); this._renderStats(); this._renderList(); };
        this._renderDayPanel();
    },

    _dayRoutes() {
        if (!this.dayFilter) return [];
        return this.routes.filter(r => {
            const d = r.fecha && r.fecha.toDate ? r.fecha.toDate() : null;
            return d && toDateKey(d) === this.dayFilter;
        });
    },

    async _renderDayPanel() {
        const panel = document.getElementById('liq-daypanel');
        if (!panel) return;
        const dayRoutes = this._dayRoutes();
        if (!this.dayFilter) {
            panel.innerHTML = '<p style="font-size:0.8rem;color:#8e8e93;margin:0;">Mostrando todos los días. Elige una fecha para ver su cierre.</p>';
            return;
        }
        if (dayRoutes.length === 0) {
            panel.innerHTML = '<p style="font-size:0.8rem;color:#8e8e93;margin:0;">Sin rutas este día. Crea una con "Nueva ruta" o asígnala desde la cola.</p>';
            return;
        }
        panel.innerHTML = '<p style="font-size:0.8rem;color:#8e8e93;">Cargando cierre del día...</p>';
        const db = firebase.firestore();
        const ids = dayRoutes.map(r => r.id);
        let dels = [];
        try {
            for (let i = 0; i < ids.length; i += 10) {
                const snap = await db.collection('rutaEntregas').where('rutaId', 'in', ids.slice(i, i + 10)).get();
                snap.docs.forEach(d => dels.push({ id: d.id, ...d.data() }));
            }
        } catch (e) { }
        this.dayDels = dels;
        let tFact = 0, tCodEsp = 0, tRec = 0, tFlete = 0, tCom = 0, tDep = 0, liqCount = 0;
        const rowsHtml = dayRoutes.map(rt => {
            const dd = dels.filter(d => d.rutaId === rt.id);
            const hechos = dd.filter(d => d.entregado === true);
            const fact = hechos.reduce((s, d) => s + (Number(d.venta) || 0), 0);
            const codEsp = hechos.filter(d => (d.condicionPago || '').toLowerCase() === 'contado').reduce((s, d) => s + (Number(d.venta) || 0), 0);
            const flete = hechos.reduce((s, d) => s + (Number(d.costoEnvio) || 0), 0);
            const rep = this.repartidores.find(x => x.id === rt.repartidorId);
            const pct = rep ? (rep.comisionPct ?? 70) : 70;
            const com = Math.round(flete * pct) / 100;
            const liq = this.liquidaciones.find(l => l.rutaId === rt.id);
            const isLiq = rt.estado === 'liquidado';
            if (isLiq) liqCount++;
            const rec = liq ? (liq.totalCOD_recibido || 0) : 0;
            tFact += fact; tCodEsp += codEsp; tRec += rec; tFlete += flete;
            if (liq && liq.comisionIncluida !== false) tCom += (liq.comisionMonto || 0);
            else if (!isLiq) tCom += com;
            tDep += rec;
            const dif = liq ? (liq.diferencia || 0) : 0;
            return '<tr style="' + (isLiq ? 'background:#f0fdf4;' : '') + '"><td><strong>Ruta #' + (rt.correlativo || rt.id.substring(0, 6)) + '</strong><br><span style="font-size:0.72rem;color:#666;">' + sanitizeHTML(rt.repartidorNombre || '') + '</span></td>' +
                '<td style="text-align:center;">' + hechos.length + '/' + dd.length + '</td>' +
                '<td style="text-align:right;">' + formatCurrency(fact) + '</td>' +
                '<td style="text-align:right;">' + formatCurrency(codEsp) + '</td>' +
                '<td style="text-align:right;">' + (isLiq ? formatCurrency(rec) : '<span style="color:#ccc;">-</span>') + '</td>' +
                '<td>' + (isLiq ? '<span class="badge badge-primary">Liquidada</span>' + (dif !== 0 ? ' <span class="badge" style="background:#fee2e2;color:#991b1b;">Dif ' + formatCurrency(Math.abs(dif)) + '</span>' : '') : '<span class="badge badge-accent">Pendiente</span>') + '</td>' +
                '<td style="white-space:nowrap;">' + (isLiq ? '<button class="btn btn-secondary btn-sm" data-act="day-sel" data-id="' + rt.id + '">Ver</button>' : '<button class="btn btn-primary btn-sm" data-act="day-liq" data-id="' + rt.id + '">Liquidar</button>') + '</td></tr>';
        }).join('');
        const tDif = Math.round((tCodEsp - tRec) * 100) / 100;
        panel.innerHTML = '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:0.75rem;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap;gap:0.5rem;"><strong style="font-size:0.9rem;">Cierre del día ' + this.dayFilter + '</strong><span class="badge ' + (liqCount === dayRoutes.length ? 'badge-primary' : 'badge-accent') + '">' + liqCount + '/' + dayRoutes.length + ' liquidadas</span></div>' +
            '<div class="table-container"><table class="data-table" style="font-size:0.78rem;"><thead><tr><th>Ruta</th><th>Entregas</th><th style="text-align:right;">Facturado</th><th style="text-align:right;">COD esp.</th><th style="text-align:right;">Recibido</th><th>Estado</th><th></th></tr></thead><tbody>' + rowsHtml +
            '<tr style="font-weight:700;border-top:2px solid #e2e8f0;"><td>Total día</td><td></td><td style="text-align:right;">' + formatCurrency(tFact) + '</td><td style="text-align:right;">' + formatCurrency(tCodEsp) + '</td><td style="text-align:right;">' + formatCurrency(tRec) + '</td><td>' + (tDif !== 0 ? '<span style="color:#dc2626;">Dif ' + formatCurrency(Math.abs(tDif)) + '</span>' : '<span style="color:#16a34a;">Cuadrado</span>') + '</td><td></td></tr>' +
            '</tbody></table></div>' +
            '<p style="font-size:0.78rem;color:#666;margin:0.5rem 0 0;">Fletes: <strong>' + formatCurrency(tFlete) + '</strong> · Comisiones: <strong>' + formatCurrency(tCom) + '</strong> · Efectivo a depositar: <strong style="color:#16a34a;">' + formatCurrency(tDep) + '</strong></p></div>';
    },

    _primaryLabel(r) {
        const st = this._status(r);
        if (st === 'entregar') return 'Entregado';
        if (st === 'cobrar') return 'Cobrar ' + formatCurrency(this._pendiente(r));
        return '';
    },

    _renderList() {
        const box = document.getElementById('liq-list');
        if (!box) return;
        this._renderBulkBar();
        const rows = this._filteredQueue();
        const doneMap = new Map();
        this._filteredDone().forEach(r => doneMap.set(r.id, r));
        Object.keys(this._lastActions).forEach(id => {
            if (!doneMap.has(id)) {
                const rec = this.doneRecords.concat(this.queue).find(x => x.id === id);
                if (rec) doneMap.set(id, rec);
            }
        });
        const done = [...doneMap.values()];
        let html = '';
        if (rows.length === 0) {
            html += '<div style="text-align:center;padding:2rem;color:#8e8e93;">Sin pendientes con estos filtros</div>';
        } else if (window.innerWidth <= 768) {
            html += rows.map(r => this._cardHtml(r)).join('');
        } else {
            html += '<table class="data-table" style="font-size:0.85rem;"><thead><tr>' +
                '<th style="width:34px;"><input type="checkbox" data-act="selall"></th>' +
            '<th>Guía</th><th>Cliente</th><th style="text-align:right;">Venta</th><th>Cond</th><th>Entrega</th><th>Cobra</th><th>Ruta</th><th>Estado</th><th style="text-align:right;">Abonos</th><th style="text-align:right;">CxC</th><th>Acción</th>' +
                '</tr></thead><tbody>' + rows.map(r => this._rowHtml(r)).join('') + '</tbody></table>';
        }
        if (done.length > 0) {
            const totalCobrado = done.reduce((s, r) => s + this._cobrado(r), 0);
            html += '<h3 style="font-size:0.9rem;margin:1.25rem 0 0.5rem;color:#16a34a;">Completados del día (' + done.length + ') · ' + formatCurrency(totalCobrado) + ' cobrado</h3>';
            if (window.innerWidth <= 768) {
                html += done.map(r => this._doneCardHtml(r)).join('');
            } else {
                html += '<table class="data-table" style="font-size:0.85rem;opacity:0.75;"><thead><tr>' +
                    '<th>Guía</th><th>Cliente</th><th style="text-align:right;">Venta</th><th style="text-align:right;">Cobrado</th><th>Estado</th><th></th>' +
                    '</tr></thead><tbody>' + done.map(r => this._doneRowHtml(r)).join('') + '</tbody></table>';
            }
        }
        box.innerHTML = html;
    },

    _doneRowHtml(r) {
        const canUndo = !!this._lastActions[r.id] || this._isContado(r);
        return '<tr style="background:#f0fdf4;">' +
            '<td><strong>' + sanitizeHTML(r.guia || '') + '</strong></td>' +
            '<td>' + sanitizeHTML(r.cliente || '') + '</td>' +
            '<td style="text-align:right;">' + formatCurrency(r.venta || 0) + '</td>' +
            '<td style="text-align:right;font-weight:700;color:#16a34a;">' + formatCurrency(this._cobrado(r)) + '</td>' +
            '<td><span class="badge badge-primary">Completado</span></td>' +
            '<td>' + (canUndo ? '<button class="btn btn-secondary btn-sm" data-act="undo" data-id="' + r.id + '" style="border:1px solid #b91c1c;color:#b91c1c;font-weight:700;box-shadow:0 0 0 1px rgba(185,28,28,0.25);">↩ Deshacer</button>' : '') + '</td></tr>';
    },

    _doneCardHtml(r) {
        const canUndo = !!this._lastActions[r.id] || this._isContado(r);
        return '<div class="m-data-card" style="background:#f0fdf4;opacity:0.8;">' +
            '<div class="m-card-header"><span class="m-card-title">#' + sanitizeHTML(r.guia || 'N/A') + '</span><span class="badge badge-primary">Completado</span></div>' +
            '<div class="m-card-rows">' +
            '<div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value">' + sanitizeHTML(r.cliente || '') + '</span></div>' +
            '<div class="m-card-row"><span class="m-card-label">Cobrado</span><span class="m-card-value" style="font-weight:700;color:#16a34a;">' + formatCurrency(this._cobrado(r)) + '</span></div>' +
            '</div>' +
            (canUndo ? '<div class="m-card-actions"><button class="m-card-action" data-act="undo" data-id="' + r.id + '" style="color:#b91c1c;font-weight:700;">↩ Deshacer</button></div>' : '') + '</div>';
    },

    _estadoBadge(r) {
        const st = this._status(r);
        if (st === 'entregar') return '<span class="badge badge-accent">Por entregar</span>';
        if (this._isVencido(r)) return '<span class="badge" style="background:#fee2e2;color:#991b1b;">Vencido</span>';
        return '<span class="badge badge-primary">Por cobrar</span>';
    },

    _rowHtml(r) {
        const st = this._status(r);
        const canUndo = !!this._lastActions[r.id] || r.entregado === true;
        const checked = this.selected.has(r.id) ? ' checked' : '';
        const route = r.rutaId ? this._routeLabel(r.rutaId) : '<span style="color:#ccc;">-</span>';
        return '<tr style="' + (st === 'entregar' ? 'background:#fffbeb;' : 'background:#f0fdf4;') + '">' +
            '<td><input type="checkbox" data-act="sel" data-id="' + r.id + '"' + checked + '></td>' +
            '<td><strong>' + sanitizeHTML(r.guia || '') + '</strong></td>' +
            '<td><a href="#" data-act="ficha" data-cliente="' + sanitizeHTML(r.cliente || '') + '" onclick="return false;">' + sanitizeHTML(r.cliente || '') + '</a></td>' +
            '<td style="text-align:right;font-weight:700;">' + formatCurrency(r.venta || 0) + '</td>' +
            '<td>' + sanitizeHTML(r.condicionPago || '-') + '</td>' +
            '<td style="font-size:0.75rem;">' + sanitizeHTML(r.entrega || '-') + '</td>' +
            '<td style="font-size:0.75rem;">' + sanitizeHTML(r.cobra || '-') + '</td>' +
            '<td style="font-size:0.75rem;">' + route + (r.rutaId ? ' <a href="#" data-act="unassign" data-id="' + r.id + '" title="Quitar de ruta" style="color:#dc2626;" onclick="return false;">x</a>' : '') + '</td>' +
            '<td>' + this._estadoBadge(r) + '</td>' +
            '<td style="text-align:right;font-weight:700;color:#16a34a;">' + formatCurrency(this._cobrado(r)) + '</td>' +
            '<td style="text-align:right;font-weight:700;color:' + (this._pendiente(r) > 0 ? '#b45309' : '#16a34a') + ';">' + formatCurrency(this._pendiente(r)) + '</td>' +
            '<td style="white-space:nowrap;">' +
            '<button class="btn ' + (st === 'entregar' && this._isContado(r) ? 'btn-primary' : 'btn-secondary') + ' btn-sm" data-act="go" data-id="' + r.id + '">' + this._primaryLabel(r) + '</button> ' +
            (st === 'entregar' ? '<button class="btn btn-sm" data-act="nodel" data-id="' + r.id + '" title="No entregado" style="border:1px solid #e2e8f0;">No entregado</button>' : '') +
            (canUndo ? ' <button class="btn btn-secondary btn-sm" data-act="undo" data-id="' + r.id + '" style="border:1px solid #b91c1c;color:#b91c1c;">↩ Deshacer</button>' : '') +
            '</td></tr>';
    },

    _cardHtml(r) {
        const st = this._status(r);
        const canUndo = !!this._lastActions[r.id] || r.entregado === true;
        const sel = this.selected.has(r.id);
        return '<div class="m-data-card" style="background:' + (st === 'entregar' ? '#fffbeb' : '#f0fdf4') + '">' +
            '<div class="m-card-header"><span class="m-card-title">#' + sanitizeHTML(r.guia || 'N/A') + '</span>' + this._estadoBadge(r) + '</div>' +
            '<div class="m-card-rows">' +
            '<div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value"><a href="#" data-act="ficha" data-cliente="' + sanitizeHTML(r.cliente || '') + '" onclick="return false;">' + sanitizeHTML(r.cliente || '') + '</a></span></div>' +
            '<div class="m-card-row"><span class="m-card-label">Venta</span><span class="m-card-value">' + formatCurrency(r.venta || 0) + '</span></div>' +
            '<div class="m-card-row"><span class="m-card-label">Entrega / Cobra</span><span class="m-card-value">' + sanitizeHTML(r.entrega || '-') + ' / ' + sanitizeHTML(r.cobra || '-') + '</span></div>' +
            '<div class="m-card-row"><span class="m-card-label">Abonos</span><span class="m-card-value" style="font-weight:700;color:#16a34a;">' + formatCurrency(this._cobrado(r)) + '</span></div>' +
            '<div class="m-card-row"><span class="m-card-label">CxC</span><span class="m-card-value" style="font-weight:700;">' + formatCurrency(this._pendiente(r)) + '</span></div>' +
            '<div class="m-card-row"><span class="m-card-label">Ruta</span><span class="m-card-value">' + (r.rutaId ? this._routeLabel(r.rutaId) : 'Sin ruta') + '</span></div>' +
            '</div>' +
            '<div class="m-card-actions" onclick="event.stopPropagation()">' +
            '<button class="m-card-action" data-act="go" data-id="' + r.id + '">' + this._primaryLabel(r) + '</button>' +
            (st === 'entregar' ? '<button class="m-card-action" data-act="nodel" data-id="' + r.id + '">No entregado</button>' : '') +
            (canUndo ? '<button class="m-card-action" data-act="undo" data-id="' + r.id + '" style="color:#b91c1c;font-weight:700;">↩ Deshacer</button>' : '') +
            '<button class="m-card-action" data-act="sel" data-id="' + r.id + '">' + (sel ? 'Quitar selección' : 'Seleccionar') + '</button>' +
            '</div></div>';
    },

    _renderBulkBar() {
        const box = document.getElementById('liq-bulkbar');
        if (!box) return;
        if (this.selected.size === 0) { box.innerHTML = ''; return; }
        const rows = this.queue.filter(r => this.selected.has(r.id) && this._status(r) !== 'listo');
        let contado = 0, credito = 0;
        rows.forEach(r => {
            if (this._status(r) === 'entregar' && this._isContado(r)) contado += this._pendiente(r);
            else credito += this._isContado(r) ? 0 : (this._status(r) === 'entregar' ? (Number(r.venta) || 0) : this._pendiente(r));
        });
        box.innerHTML = '<div class="card" style="margin-bottom:1rem;border:2px solid #2563eb;"><div class="card-body" style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">' +
            '<strong>' + rows.length + ' seleccionados</strong>' +
            '<span style="font-size:0.85rem;">Contado a cobrar: <strong style="color:#16a34a;">' + formatCurrency(contado) + '</strong></span>' +
            '<span style="font-size:0.85rem;">A CxC: <strong>' + formatCurrency(credito) + '</strong></span>' +
            '<span style="flex:1;"></span>' +
            '<button class="btn btn-primary btn-sm" data-act="bulk-go">Entrega masiva</button>' +
            '<button class="btn btn-secondary btn-sm" data-act="bulk-assign">Asignar a ruta</button>' +
            '<button class="btn btn-sm" data-act="bulk-clear">Limpiar</button>' +
            '</div></div>';
        const area = document.getElementById('content-area');
        if (area && !area.onclick) area.onclick = (e) => this._handleClick(e);
    },

    _toggleSelect(id) {
        if (this.selected.has(id)) this.selected.delete(id);
        else this.selected.add(id);
        this._renderList();
    },

    _toggleSelectAll(el) {
        const rows = this._filteredQueue();
        const all = rows.every(r => this.selected.has(r.id));
        rows.forEach(r => { if (all) this.selected.delete(r.id); else this.selected.add(r.id); });
        this._renderList();
    },

    _primaryAction(id) {
        const r = this.queue.find(x => x.id === id);
        if (!r) return;
        const st = this._status(r);
        if (st === 'entregar') this._openDeliveryPayment(id);
        else if (st === 'cobrar') this._openPay(id);
    },

    _openDeliveryPayment(id) {
        const r = this.queue.find(x => x.id === id);
        if (!r) return;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = '<div class="modal-content" style="max-width:520px;max-height:90vh;overflow-y:auto;"><h2 style="margin-bottom:0.25rem;">Marcar como entregado</h2><p style="font-size:0.85rem;color:#666;margin-bottom:1rem;">Guía <strong>' + sanitizeHTML(r.guia || 'N/A') + '</strong> · Venta <strong>' + formatCurrency(r.venta || 0) + '</strong></p><div style="display:flex;gap:0.5rem;margin-bottom:1rem;"><button type="button" class="btn btn-primary" id="liq-del-full">Pago completo</button><button type="button" class="btn btn-secondary" id="liq-del-partial">Pago parcial</button></div><form id="liq-del-form"><div id="liq-del-payments"></div><button type="button" class="btn btn-secondary btn-sm" id="liq-del-add" style="margin-top:0.5rem;">+ Agregar abono</button><p id="liq-del-total" style="font-weight:700;text-align:right;margin:1rem 0 0;"></p><div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1rem;"><button type="button" class="btn btn-secondary" id="liq-del-cancel">Cancelar</button><button type="submit" class="btn btn-primary" id="liq-del-save">Guardar</button></div></form></div>';
        document.body.appendChild(modal);
        const list = modal.querySelector('#liq-del-payments');
        const total = modal.querySelector('#liq-del-total');
        let mode = 'full';
        const recalc = () => { const sum = [...modal.querySelectorAll('.liq-del-amount')].reduce((s, e) => s + (parseFloat(e.value) || 0), 0); total.textContent = 'Total abonado: ' + formatCurrency(sum) + ' · CxC: ' + formatCurrency(Math.max(0, (Number(r.venta) || 0) - sum)); };
        const addRow = (amount) => { const row = document.createElement('div'); row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 32px;gap:6px;margin-top:6px;'; row.innerHTML = '<input type="number" class="liq-del-amount" min="0.01" step="0.01" value="' + (amount || '') + '" placeholder="Monto" required><select class="liq-del-method"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="deposito">Depósito</option><option value="tarjeta">Tarjeta</option></select><button type="button" class="btn btn-sm btn-danger">×</button>'; row.querySelector('button').onclick = () => { row.remove(); recalc(); }; row.querySelector('.liq-del-amount').oninput = recalc; list.appendChild(row); recalc(); };
        const setMode = (next) => { mode = next; modal.querySelector('#liq-del-full').className = 'btn ' + (mode === 'full' ? 'btn-primary' : 'btn-secondary'); modal.querySelector('#liq-del-partial').className = 'btn ' + (mode === 'partial' ? 'btn-primary' : 'btn-secondary'); list.innerHTML = ''; modal.querySelector('#liq-del-add').style.display = mode === 'full' ? 'none' : 'inline-block'; addRow(mode === 'full' ? Number(r.venta || 0).toFixed(2) : ''); };
        modal.querySelector('#liq-del-full').onclick = () => setMode('full');
        modal.querySelector('#liq-del-partial').onclick = () => setMode('partial');
        modal.querySelector('#liq-del-add').onclick = () => addRow('');
        modal.querySelector('#liq-del-cancel').onclick = () => modal.remove();
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.querySelector('#liq-del-form').onsubmit = async e => { e.preventDefault(); const btn = modal.querySelector('#liq-del-save'); const rows = [...modal.querySelectorAll('#liq-del-payments > div')]; const payments = rows.map(row => ({ monto: parseFloat(row.querySelector('.liq-del-amount').value) || 0, metodo: row.querySelector('.liq-del-method').value })).filter(p => p.monto > 0); const venta = Number(r.venta) || 0; const sum = payments.reduce((s, p) => s + p.monto, 0); if (sum <= 0 || sum > venta) { showToast('El total de abonos debe ser mayor que cero y no superar la venta', 'error'); return; } setButtonLoading(btn, true); try { const db = firebase.firestore(); const cobroIds = []; const ops = []; payments.forEach(p => { const paymentRef = db.collection('cobros').doc(); cobroIds.push(paymentRef.id); ops.push({ t: 'set', ref: paymentRef, data: { interlogicId: id, cliente: r.cliente || '', guia: r.guia || '', monto: p.monto, metodo: p.metodo, estado: 'pagado', fecha: firebase.firestore.Timestamp.now(), usuario: (firebase.auth().currentUser && firebase.auth().currentUser.uid) || '', origen: 'entrega', createdAt: firebase.firestore.FieldValue.serverTimestamp() } }); }); const pagado = this._cobrado(r) + sum; const pendiente = Math.max(0, venta - pagado); ops.push({ t: 'update', ref: db.collection('interlogic').doc(id), data: { entregado: true, montoCobrado: pagado, montoPendiente: pendiente, estadoCobro: pendiente > 0 ? 'parcial' : 'pagado', cobrado: pendiente <= 0, fechaCobro: pendiente <= 0 ? firebase.firestore.FieldValue.serverTimestamp() : r.fechaCobro || null, metodoPago: payments.length === 1 ? payments[0].metodo : 'varios', updatedAt: firebase.firestore.FieldValue.serverTimestamp() } }); ops.push(...this._routeDelOps(id, { entregado: true, horaEntrega: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), montoCobrado: pagado })); this._lastActions[id] = { type: 'deliver', prev: this._snapshotPrev(r), cobroIds, touchedPlan: false }; this._saveLastActions(); await this._commitChunks(ops); modal.remove(); showToast('Entrega guardada con ' + formatCurrency(sum) + ' abonado', 'success'); } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); } };
        setMode('full');
    },

    _snapshotPrev(r) {
        return { entregado: r.entregado === true, montoCobrado: Number(r.montoCobrado || 0), montoPendiente: Number(r.montoPendiente || 0), estadoCobro: r.estadoCobro || 'pendiente', cobrado: r.cobrado === true, fechaCobro: r.fechaCobro || null, metodoPago: r.metodoPago || null };
    },

    async _undo(id) {
        const saved = this._lastActions[id];
        if (!saved) { await this._undoRecordedDelivery(id); return; }
        try {
            const db = firebase.firestore();
            const ops = [];
            let fc = saved.prev.fechaCobro;
            if (fc && typeof fc === 'object' && typeof fc.seconds === 'number') fc = new Date(fc.seconds * 1000);
            const data = { entregado: saved.prev.entregado, montoCobrado: saved.prev.montoCobrado, montoPendiente: saved.prev.montoPendiente, estadoCobro: saved.prev.estadoCobro, cobrado: saved.prev.cobrado, fechaCobro: fc || firebase.firestore.FieldValue.delete(), metodoPago: saved.prev.metodoPago || firebase.firestore.FieldValue.delete(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
            if (saved.touchedPlan) data.planPagos = saved.prevPlan === undefined ? firebase.firestore.FieldValue.delete() : saved.prevPlan;
            ops.push({ t: 'update', ref: db.collection('interlogic').doc(id), data });
            (saved.cobroIds || []).forEach(cid => ops.push({ t: 'delete', ref: db.collection('cobros').doc(cid) }));
            if (saved.type === 'deliver') {
                this.routeDels.filter(d => d.interlogicId === id).forEach(d => ops.push({ t: 'update', ref: db.collection('rutaEntregas').doc(d.id), data: { entregado: false, horaEntrega: '' } }));
            }
            await this._commitChunks(ops);
            delete this._lastActions[id];
            this._saveLastActions();
            showToast('Acción deshecha', 'success');
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
    },

    _sameUndoData(a, b) {
        if (Object.is(a, b)) return true;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
        if (a.constructor !== b.constructor) return false;
        if (typeof a.isEqual === 'function') return a.isEqual(b);
        if (a instanceof Date) return a.getTime() === b.getTime();
        const keys = Object.keys(a);
        return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && this._sameUndoData(a[key], b[key]));
    },

    async _undoRecordedDelivery(id) {
        try {
            const db = firebase.firestore();
            const ref = db.collection('interlogic').doc(id);
            const snap = await ref.get();
            const r = snap.data();
            if (!r || r.entregado !== true) throw new Error('La guía ya no está marcada como entregada.');
            const payments = await db.collection('cobros').where('interlogicId', '==', id).get();
            const deliveries = await db.collection('rutaEntregas').where('interlogicId', '==', id).get();
            const routeIds = [...new Set([r.rutaId, ...deliveries.docs.map(d => d.data().rutaId)].filter(Boolean))];
            const routes = await Promise.all(routeIds.map(routeId => db.collection('rutas').doc(routeId).get()));
            if (routes.some(route => route.exists && route.data().estado === 'liquidado')) throw new Error('La ruta ya está liquidada.');
            const contado = this._isContado(r);
            const data = contado ? { entregado: false, montoCobrado: 0, montoPendiente: Number(r.venta), estadoCobro: 'pendiente', cobrado: false, fechaCobro: firebase.firestore.FieldValue.delete(), metodoPago: firebase.firestore.FieldValue.delete(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() } : { entregado: false, estadoCobro: this._cobrado(r) > 0 ? 'parcial' : 'pendiente', updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
            const ops = [{ t: 'update', ref, data }];
            if (contado) payments.docs.filter(d => d.data().estado === 'pagado').forEach(d => ops.push({ t: 'delete', ref: d.ref }));
            deliveries.docs.forEach(d => ops.push({ t: 'update', ref: d.ref, data: { entregado: false, horaEntrega: '', montoCobrado: 0 } }));
            await this._commitChunks(ops);
            showToast('Entrega y cobro deshechos. La guía vuelve a pendientes.', 'success');
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
    },

    _routeDelOps(interlogicId, data) {
        const db = firebase.firestore();
        return this.routeDels.filter(d => d.interlogicId === interlogicId).map(d => ({ t: 'update', ref: db.collection('rutaEntregas').doc(d.id), data }));
    },

    async _deliverAndCollect(id) {
        const r = this.queue.find(x => x.id === id);
        if (!r) return;
        const monto = this._pendiente(r);
        if (monto <= 0) { showToast('Sin saldo por cobrar', 'error'); return; }
        try {
            const db = firebase.firestore();
            const venta = Number(r.venta) || 0;
            const cobroRef = db.collection('cobros').doc();
            const cobroIds = monto > 0 ? [cobroRef.id] : [];
            this._lastActions[id] = { type: 'deliver', prev: this._snapshotPrev(r), cobroIds, touchedPlan: false };
            this._saveLastActions();
            const ops = [
                { t: 'update', ref: db.collection('interlogic').doc(id), data: { entregado: true, montoCobrado: venta, montoPendiente: 0, estadoCobro: 'pagado', cobrado: true, fechaCobro: firebase.firestore.FieldValue.serverTimestamp(), metodoPago: 'efectivo', updatedAt: firebase.firestore.FieldValue.serverTimestamp() } },
                { t: 'set', ref: cobroRef, data: { interlogicId: id, cliente: r.cliente || '', guia: r.guia || '', monto, metodo: 'efectivo', estado: 'pagado', fecha: firebase.firestore.Timestamp.now(), usuario: (firebase.auth().currentUser && firebase.auth().currentUser.uid) || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() } }
            ];
            await this._commitChunks(ops.concat(this._routeDelOps(id, { entregado: true, horaEntrega: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), montoCobrado: venta })));
            showToast('Entregado y cobrado ' + formatCurrency(monto) + ' a ' + (r.cliente || ''), 'success');
        } catch (err) { delete this._lastActions[id]; this._saveLastActions(); showToast('Error: ' + err.message, 'error'); }
    },

    async _deliverOnly(id) {
        const r = this.queue.find(x => x.id === id);
        if (!r) return;
        try {
            const db = firebase.firestore();
            this._lastActions[id] = { type: 'deliver', prev: this._snapshotPrev(r), cobroIds: [], touchedPlan: false };
            this._saveLastActions();
            const ops = [{ t: 'update', ref: db.collection('interlogic').doc(id), data: { entregado: true, estadoCobro: this._pendiente(r) > 0 ? 'pendiente' : 'pagado', updatedAt: firebase.firestore.FieldValue.serverTimestamp() } }];
            await this._commitChunks(ops.concat(this._routeDelOps(id, { entregado: true, horaEntrega: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) })));
            showToast('Entregado a ' + (r.cliente || '') + '. Saldo ' + formatCurrency(this._pendiente(r)) + ' a CxC', 'success');
        } catch (err) { delete this._lastActions[id]; this._saveLastActions(); showToast('Error: ' + err.message, 'error'); }
    },

    async _unassign(id) {
        const r = this.queue.find(x => x.id === id);
        if (!r || !r.rutaId) return;
        if (!await showConfirm('Quitar de ruta', 'La factura ' + (r.guia || '') + ' volverá a estar sin ruta asignada.')) return;
        try {
            const db = firebase.firestore();
            const ops = [{ t: 'update', ref: db.collection('interlogic').doc(id), data: { rutaId: firebase.firestore.FieldValue.delete(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() } }];
            this.routeDels.filter(d => d.interlogicId === id).forEach(d => ops.push({ t: 'delete', ref: db.collection('rutaEntregas').doc(d.id) }));
            await this._commitChunks(ops);
            showToast('Entrega removida de la ruta', 'success');
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
    },

    _openNoDeliver(id) {
        const r = this.queue.find(x => x.id === id);
        if (!r) return;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = '<div class="modal-content" style="max-width:450px;">' +
            '<h2 style="margin-bottom:0.5rem;">No entregado</h2>' +
            '<p style="font-size:0.85rem;color:#666;margin-bottom:1rem;">Guía <strong>' + sanitizeHTML(r.guia || '') + '</strong> · ' + sanitizeHTML(r.cliente || '') + '</p>' +
            '<form id="liq-nodel-form"><div class="form-group"><label>Motivo</label><select id="liq-nodel-motivo" style="width:100%;"><option>Cliente ausente</option><option>Rechazado por el cliente</option><option>Dirección errónea</option><option>Sin dinero (contado)</option><option>Producto dañado</option><option>Otro</option></select></div>' +
            '<div class="form-group" style="margin-top:1rem;"><label>Nota</label><input type="text" id="liq-nodel-nota" style="width:100%;" placeholder="Detalle opcional"></div>' +
            '<div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;"><button type="button" class="btn btn-secondary" id="liq-nodel-cancel">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div></form></div>';
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.getElementById('liq-nodel-cancel').onclick = () => modal.remove();
        document.getElementById('liq-nodel-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const motivo = document.getElementById('liq-nodel-motivo').value;
            const nota = document.getElementById('liq-nodel-nota').value.trim();
            const texto = motivo + (nota ? ' - ' + nota : '');
            try {
                const db = firebase.firestore();
                const ops = [{ t: 'update', ref: db.collection('interlogic').doc(id), data: { entregado: false, observacionEntrega: texto, updatedAt: firebase.firestore.FieldValue.serverTimestamp() } }];
                await this._commitChunks(ops.concat(this._routeDelOps(id, { entregado: false, motivoNoEntrega: texto })));
                modal.remove();
                showToast('Registrado: ' + motivo, 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); }
        });
    },

    _openPay(id) {
        const r = this.queue.find(x => x.id === id);
        if (!r) { showToast('Registro no encontrado', 'error'); return; }
        const pendiente = this._pendiente(r);
        if (pendiente <= 0) { showToast('Esta factura ya está pagada', 'error'); return; }
        const cobrado = this._cobrado(r);
        this._planRows = 0;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = '<div class="modal-content" style="max-width:480px;">' +
            '<h2 style="margin-bottom:1rem;">Cobrar ' + formatCurrency(pendiente) + '</h2>' +
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;margin-bottom:1rem;font-size:0.85rem;display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
            '<div><span style="color:#8e8e93;">Guía:</span> <strong>' + sanitizeHTML(r.guia || 'N/A') + '</strong></div>' +
            '<div><span style="color:#8e8e93;">Cliente:</span> <strong>' + sanitizeHTML(r.cliente || '') + '</strong></div>' +
            '<div><span style="color:#8e8e93;">Venta:</span> <strong>' + formatCurrency(r.venta || 0) + '</strong></div>' +
            '<div><span style="color:#8e8e93;">Cobrado:</span> <strong style="color:#16a34a;">' + formatCurrency(cobrado) + '</strong></div>' +
            '</div>' +
            '<form id="liq-pay-form"><div class="form-group"><label>Monto a cobrar</label><input type="number" id="liq-pay-monto" step="0.01" min="0.01" max="' + pendiente + '" value="' + pendiente.toFixed(2) + '" style="width:100%;font-size:1.1rem;" required></div>' +
            '<div class="form-group" style="margin-top:1rem;"><label>Método</label><select id="liq-pay-metodo" style="width:100%;"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="deposito">Depósito</option><option value="tarjeta">Tarjeta</option></select></div>' +
            '<div class="form-group" style="margin-top:1rem;"><label>Referencia</label><input type="text" id="liq-pay-ref" style="width:100%;" placeholder="Opcional"></div>' +
            '<div style="margin-top:1rem;"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85rem;"><input type="checkbox" id="liq-pay-plan"> Programar el resto en plan de pagos</label><div id="liq-pay-plan-list" style="display:none;margin-top:0.5rem;"></div>' +
            '<button type="button" class="btn btn-sm btn-secondary" id="liq-pay-addplan" style="display:none;margin-top:0.5rem;">Agregar pago programado</button></div>' +
            '<div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;"><button type="button" class="btn btn-secondary" id="liq-pay-cancel">Cancelar</button><button type="submit" class="btn btn-primary" id="liq-pay-save">Registrar pago</button></div></form></div>';
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.getElementById('liq-pay-cancel').onclick = () => modal.remove();
        document.getElementById('liq-pay-plan').onchange = (e) => {
            document.getElementById('liq-pay-plan-list').style.display = e.target.checked ? 'block' : 'none';
            document.getElementById('liq-pay-addplan').style.display = e.target.checked ? 'inline-block' : 'none';
        };
        document.getElementById('liq-pay-addplan').onclick = () => {
            const i = this._planRows++;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:6px;margin-top:6px;';
            const def = new Date();
            def.setDate(def.getDate() + 7 * (i + 1));
            row.innerHTML = '<input type="date" id="liq-pay-plan-fecha-' + i + '" value="' + formatDateForInput(def) + '" style="flex:1;padding:6px;border:1px solid #e2e8f0;border-radius:6px;"><input type="number" id="liq-pay-plan-monto-' + i + '" step="0.01" min="0.01" style="width:110px;padding:6px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="$"><button type="button" class="btn btn-sm btn-danger">x</button>';
            row.querySelector('button').onclick = () => row.remove();
            document.getElementById('liq-pay-plan-list').appendChild(row);
        };
        document.getElementById('liq-pay-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('liq-pay-save');
            setButtonLoading(btn, true);
            try {
                const monto = parseFloat(document.getElementById('liq-pay-monto').value) || 0;
                if (monto <= 0) { showToast('Ingresa un monto válido', 'error'); setButtonLoading(btn, false); return; }
                const metodo = document.getElementById('liq-pay-metodo').value;
                const ref = document.getElementById('liq-pay-ref').value.trim();
                const db = firebase.firestore();
                const uid = (firebase.auth().currentUser && firebase.auth().currentUser.uid) || '';
                const ops = [];
                const cobroIds = [];
                if (monto > 0) {
                    const refHoy = db.collection('cobros').doc();
                    cobroIds.push(refHoy.id);
                    ops.push({ t: 'set', ref: refHoy, data: { interlogicId: id, cliente: r.cliente || '', guia: r.guia || '', monto, metodo, referencia: ref, estado: 'pagado', fecha: firebase.firestore.Timestamp.now(), usuario: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() } });
                }
                const plan = [];
                if (document.getElementById('liq-pay-plan').checked) {
                    for (let i = 0; i < this._planRows; i++) {
                        const f = document.getElementById('liq-pay-plan-fecha-' + i);
                        const m = document.getElementById('liq-pay-plan-monto-' + i);
                        if (!f || !m) continue;
                        const pm = parseFloat(m.value) || 0;
                        if (pm > 0 && f.value) {
                            const parts = f.value.split('-').map(Number);
                            const refPlan = db.collection('cobros').doc();
                            cobroIds.push(refPlan.id);
                            ops.push({ t: 'set', ref: refPlan, data: { interlogicId: id, cliente: r.cliente || '', guia: r.guia || '', monto: pm, metodo: 'programado', estado: 'programado', referencia: 'Plan de pagos', fecha: firebase.firestore.Timestamp.fromDate(new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)), usuario: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() } });
                            plan.push({ fecha: f.value, monto: pm });
                        }
                    }
                }
                const nuevoCobrado = cobrado + monto;
                const venta = Number(r.venta) || 0;
                const progTotal = plan.reduce((s, p) => s + p.monto, 0);
                const estado = (nuevoCobrado + progTotal) >= venta ? 'pagado' : 'parcial';
                ops.push({ t: 'update', ref: db.collection('interlogic').doc(id), data: { montoCobrado: nuevoCobrado, montoPendiente: Math.max(0, venta - nuevoCobrado), estadoCobro: estado, cobrado: estado === 'pagado', fechaCobro: estado === 'pagado' ? firebase.firestore.FieldValue.serverTimestamp() : r.fechaCobro || null, metodoPago: metodo, planPagos: plan.length > 0 ? plan : firebase.firestore.FieldValue.delete(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() } });
                this._lastActions[id] = { type: 'pay', prev: this._snapshotPrev(r), prevPlan: r.planPagos, touchedPlan: true, cobroIds };
                this._saveLastActions();
                await this._commitChunks(ops);
                modal.remove();
                showToast('Pago de ' + formatCurrency(monto) + ' de ' + (r.cliente || '') + ' registrado', 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        });
    },

    async _bulkDeliver() {
        const rows = this.queue.filter(r => this.selected.has(r.id) && this._status(r) !== 'listo');
        if (rows.length === 0) return;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = '<div class="modal-content" style="max-width:760px;max-height:90vh;overflow-y:auto;"><h2 style="margin-bottom:0.25rem;">Entregas seleccionadas (' + rows.length + ')</h2><p style="font-size:0.85rem;color:#666;">Elige pago completo, parcial o sin abono para cada guía.</p><div id="liq-bulk-payments"></div><div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1rem;"><button type="button" class="btn btn-secondary" id="liq-bulk-cancel">Cancelar</button><button type="button" class="btn btn-primary" id="liq-bulk-save">Guardar entregas</button></div></div>';
        document.body.appendChild(modal);
        const list = modal.querySelector('#liq-bulk-payments');
        rows.forEach((r, index) => {
            const amount = this._status(r) === 'cobrar' ? this._pendiente(r) : (this._isContado(r) ? Number(r.venta) || 0 : 0);
            const card = document.createElement('div');
            card.dataset.id = r.id;
            card.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:0.75rem;margin-top:0.75rem;';
            card.innerHTML = '<div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;"><strong>#' + sanitizeHTML(r.guia || 'N/A') + ' · ' + sanitizeHTML(r.cliente || '') + '</strong><span>Venta: ' + formatCurrency(r.venta || 0) + '</span></div><div style="display:grid;grid-template-columns:150px 1fr;gap:0.5rem;margin-top:0.5rem;"><select class="liq-bulk-mode"><option value="full">Pago completo</option><option value="partial">Pago parcial</option><option value="none">Sin abono</option></select><div class="liq-bulk-rows"></div></div><button type="button" class="btn btn-secondary btn-sm liq-bulk-add" style="display:none;margin-top:0.5rem;">+ Agregar abono</button><div class="liq-bulk-summary" style="font-size:0.8rem;text-align:right;margin-top:0.5rem;color:#666;"></div>';
            const rowsBox = card.querySelector('.liq-bulk-rows');
            const summary = card.querySelector('.liq-bulk-summary');
            const add = value => { const row = document.createElement('div'); row.style.cssText = 'display:grid;grid-template-columns:1fr 150px 32px;gap:5px;margin-top:4px;'; row.innerHTML = '<input type="number" class="liq-bulk-amount" min="0.01" step="0.01" value="' + (value || '') + '" placeholder="Monto"><select class="liq-bulk-method"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="deposito">Depósito</option><option value="tarjeta">Tarjeta</option></select><button type="button" class="btn btn-sm btn-danger">×</button>'; row.querySelector('button').onclick = () => { row.remove(); refresh(); }; row.querySelector('.liq-bulk-amount').oninput = refresh; rowsBox.appendChild(row); };
            const refresh = () => { const sum = [...card.querySelectorAll('.liq-bulk-amount')].reduce((s, e) => s + (parseFloat(e.value) || 0), 0); summary.textContent = 'Abonos: ' + formatCurrency(sum) + ' · CxC: ' + formatCurrency(Math.max(0, (Number(r.venta) || 0) - this._cobrado(r) - sum)); };
            const mode = card.querySelector('.liq-bulk-mode');
            mode.onchange = () => { rowsBox.innerHTML = ''; card.querySelector('.liq-bulk-add').style.display = mode.value === 'partial' ? 'inline-block' : 'none'; if (mode.value === 'full') add(Math.max(0, (Number(r.venta) || 0) - this._cobrado(r)).toFixed(2)); refresh(); };
            card.querySelector('.liq-bulk-add').onclick = () => add('');
            list.appendChild(card);
            mode.value = amount > 0 ? 'full' : 'none';
            mode.onchange();
        });
        modal.querySelector('#liq-bulk-cancel').onclick = () => modal.remove();
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.querySelector('#liq-bulk-save').onclick = async () => {
            const btn = modal.querySelector('#liq-bulk-save');
            const db = firebase.firestore();
            const ops = [];
            const nowStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            let delivered = 0, totalPaid = 0;
            for (const r of rows) {
                const card = list.querySelector('[data-id="' + r.id + '"]');
                const mode = card.querySelector('.liq-bulk-mode').value;
                const payments = [...card.querySelectorAll('.liq-bulk-amount')].map((e, i) => ({ monto: parseFloat(e.value) || 0, metodo: card.querySelectorAll('.liq-bulk-method')[i].value })).filter(p => p.monto > 0);
                const sum = payments.reduce((s, p) => s + p.monto, 0);
                const venta = Number(r.venta) || 0;
                if (sum > venta - this._cobrado(r)) { showToast('Los abonos de la guía ' + (r.guia || r.id) + ' superan el saldo', 'error'); return; }
                const cobroIds = [];
                payments.forEach(p => { const ref = db.collection('cobros').doc(); cobroIds.push(ref.id); ops.push({ t: 'set', ref, data: { interlogicId: r.id, cliente: r.cliente || '', guia: r.guia || '', monto: p.monto, metodo: p.metodo, estado: 'pagado', fecha: firebase.firestore.Timestamp.now(), usuario: (firebase.auth().currentUser && firebase.auth().currentUser.uid) || '', origen: 'entrega', createdAt: firebase.firestore.FieldValue.serverTimestamp() } }); });
                const paid = this._cobrado(r) + sum;
                const pending = Math.max(0, venta - paid);
                const data = { entregado: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
                if (mode !== 'none' || this._status(r) === 'cobrar') Object.assign(data, { montoCobrado: paid, montoPendiente: pending, estadoCobro: pending > 0 ? (paid > 0 ? 'parcial' : 'pendiente') : 'pagado', cobrado: pending <= 0, metodoPago: payments.length === 1 ? payments[0].metodo : (payments.length > 1 ? 'varios' : r.metodoPago || null), fechaCobro: pending <= 0 ? firebase.firestore.FieldValue.serverTimestamp() : r.fechaCobro || null });
                ops.push({ t: 'update', ref: db.collection('interlogic').doc(r.id), data });
                ops.push(...this._routeDelOps(r.id, { entregado: true, horaEntrega: nowStr, montoCobrado: paid }));
                this._lastActions[r.id] = { type: 'deliver', prev: this._snapshotPrev(r), cobroIds, touchedPlan: false };
                delivered++; totalPaid += sum;
            }
            setButtonLoading(btn, true);
            try { await this._commitChunks(ops); this._saveLastActions(); this.selected.clear(); modal.remove(); showToast(delivered + ' entregas guardadas · ' + formatCurrency(totalPaid) + ' abonado', 'success'); } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        };
    },

    _openAssign() {
        const rows = this.queue.filter(r => this.selected.has(r.id));
        if (rows.length === 0) return;
        const total = rows.reduce((s, r) => s + (Number(r.venta) || 0), 0);
        const uniq = (arr) => [...new Set(arr.map(v => (v || '').trim()).filter(Boolean))];
        const empresasEntrega = uniq(rows.map(r => r.entrega));
        const empresasCobra = uniq(rows.map(r => r.cobra));
        const pend = this.routes.filter(r => r.estado !== 'liquidado');
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = '<div class="modal-content" style="max-width:500px;">' +
            '<h2 style="margin-bottom:0.5rem;">Asignar a ruta (' + rows.length + ')</h2>' +
            '<p style="font-size:0.85rem;color:#666;margin-bottom:1rem;">Total: <strong>' + formatCurrency(total) + '</strong>' +
            (empresasEntrega.length > 0 ? '<br>Entregan: <strong>' + sanitizeHTML(empresasEntrega.join(', ')) + '</strong>' : '') +
            (empresasCobra.length > 0 ? '<br>Cobran: <strong>' + sanitizeHTML(empresasCobra.join(', ')) + '</strong>' : '') + '</p>' +
            '<form id="liq-assign-form"><div class="form-group"><label>Ruta existente</label><select id="liq-assign-route" style="width:100%;"><option value="">Nueva ruta...</option>' +
            pend.map(r => '<option value="' + r.id + '">Ruta #' + (r.correlativo || r.id.substring(0, 6)) + ' - ' + sanitizeHTML(r.repartidorNombre || '') + '</option>').join('') +
            '</select></div>' +
            '<div id="liq-assign-new" style="margin-top:1rem;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;"><div class="form-group"><label>Fecha</label><input type="date" id="liq-assign-fecha" value="' + getLocalDateString() + '"></div>' +
            '<div class="form-group"><label>Zona</label><input type="text" id="liq-assign-zona" placeholder="Zona"></div></div>' +
            '<div class="form-group" style="margin-top:0.75rem;"><label>Repartidor</label><select id="liq-assign-rep" style="width:100%;"><option value="">Seleccionar...</option>' +
            this.repartidores.filter(x => x.activo !== false).map(x => '<option value="' + x.id + '" data-nombre="' + sanitizeHTML(x.nombre || '') + '">' + sanitizeHTML(x.nombre || '') + '</option>').join('') +
            '</select></div></div>' +
            '<div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;"><button type="button" class="btn btn-secondary" id="liq-assign-cancel">Cancelar</button><button type="submit" class="btn btn-primary" id="liq-assign-save">Asignar</button></div></form></div>';
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.getElementById('liq-assign-cancel').onclick = () => modal.remove();
        document.getElementById('liq-assign-route').onchange = (e) => {
            document.getElementById('liq-assign-new').style.display = e.target.value ? 'none' : 'block';
        };
        document.getElementById('liq-assign-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('liq-assign-save');
            setButtonLoading(btn, true);
            try {
                const db = firebase.firestore();
                let routeId = document.getElementById('liq-assign-route').value;
                const ops = [];
                if (!routeId) {
                    const repSel = document.getElementById('liq-assign-rep');
                    const repOpt = repSel.selectedOptions[0];
                    const fv = document.getElementById('liq-assign-fecha').value;
                    let fbDate = firebase.firestore.Timestamp.now();
                    if (fv) { const p = fv.split('-').map(Number); fbDate = firebase.firestore.Timestamp.fromDate(new Date(p[0], p[1] - 1, p[2], 12, 0, 0)); }
                    const maxCorr = this.routes.reduce((m, x) => { const n = parseInt(x.correlativo, 10); return !isNaN(n) && n > m ? n : m; }, 0);
                    const newRef = db.collection('rutas').doc();
                    ops.push({ t: 'set', ref: newRef, data: { correlativo: String(maxCorr + 1).padStart(4, '0'), fecha: fbDate, repartidorId: repSel.value, repartidorNombre: repOpt ? repOpt.dataset.nombre : '', vehiculo: '', zona: document.getElementById('liq-assign-zona').value.trim(), estado: 'pendiente', createdAt: firebase.firestore.FieldValue.serverTimestamp() } });
                    routeId = newRef.id;
                }
                let seq = this.routeDels.filter(d => d.rutaId === routeId).length;
                rows.forEach(r => {
                    seq++;
                    ops.push({ t: 'set', ref: db.collection('rutaEntregas').doc(), data: { rutaId: routeId, interlogicId: r.id, guia: r.guia || '', cliente: r.cliente || '', direccion: r.direccion || '', venta: Number(r.venta) || 0, condicionPago: r.condicionPago || '', costoEnvio: Number(r.costoEnvio) || 0, montoCobrado: this._cobrado(r), estadoCobro: r.estadoCobro || 'pendiente', entregado: r.entregado === true, horaEntrega: r.horaEntrega || '', telefono: r.telefono || '', sequence: seq, createdAt: firebase.firestore.FieldValue.serverTimestamp() } });
                    ops.push({ t: 'update', ref: db.collection('interlogic').doc(r.id), data: { rutaId: routeId, updatedAt: firebase.firestore.FieldValue.serverTimestamp() } });
                });
                await this._commitChunks(ops);
                this.selectedRouteId = routeId;
                this.selected.clear();
                this._subscribeRouteDels();
                modal.remove();
                showToast(rows.length + ' registros asignados a ' + this._routeLabel(routeId), 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        });
    },

    _openNewRoute() {
        const reps = this.repartidores.filter(x => x.activo !== false);
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = '<div class="modal-content" style="max-width:480px;">' +
            '<h2 style="margin-bottom:1rem;">Nueva ruta</h2>' +
            '<form id="liq-route-form"><div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;"><div class="form-group"><label>Fecha</label><input type="date" id="liq-nr-fecha" value="' + getLocalDateString() + '"></div>' +
            '<div class="form-group"><label>Zona</label><input type="text" id="liq-nr-zona" placeholder="Zona"></div></div>' +
            '<div class="form-group" style="margin-top:0.75rem;"><label>Repartidor</label><select id="liq-nr-rep" style="width:100%;"' + (reps.length === 0 ? ' disabled' : '') + '><option value="">' + (reps.length === 0 ? 'No hay repartidores activos' : 'Seleccionar...') + '</option>' +
            reps.map(x => '<option value="' + x.id + '" data-nombre="' + sanitizeHTML(x.nombre || '') + '" data-vehiculo="' + sanitizeHTML(x.vehiculo || '') + '">' + sanitizeHTML(x.nombre || '') + ' - ' + sanitizeHTML(x.vehiculo || '') + '</option>').join('') +
            '</select></div>' +
            '<div class="form-group" style="margin-top:0.75rem;"><label>Vehículo</label><input type="text" id="liq-nr-veh" readonly style="width:100%;background:#f5f5f5;"></div>' +
            '<div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;"><button type="button" class="btn btn-secondary" id="liq-nr-cancel">Cancelar</button><button type="submit" class="btn btn-primary" id="liq-nr-save">Crear ruta</button></div></form></div>';
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.getElementById('liq-nr-cancel').onclick = () => modal.remove();
        document.getElementById('liq-nr-rep').onchange = (e) => {
            const opt = e.target.selectedOptions[0];
            document.getElementById('liq-nr-veh').value = opt ? (opt.dataset.vehiculo || '') : '';
        };
        document.getElementById('liq-route-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('liq-nr-save');
            setButtonLoading(btn, true);
            try {
                const repSel = document.getElementById('liq-nr-rep');
                const repOpt = repSel.selectedOptions[0];
                const fv = document.getElementById('liq-nr-fecha').value;
                let fbDate = firebase.firestore.Timestamp.now();
                if (fv) { const p = fv.split('-').map(Number); fbDate = firebase.firestore.Timestamp.fromDate(new Date(p[0], p[1] - 1, p[2], 12, 0, 0)); }
                const maxCorr = this.routes.reduce((m, x) => { const n = parseInt(x.correlativo, 10); return !isNaN(n) && n > m ? n : m; }, 0);
                const ref = await firebase.firestore().collection('rutas').add({ correlativo: String(maxCorr + 1).padStart(4, '0'), fecha: fbDate, repartidorId: repSel.value, repartidorNombre: repOpt ? repOpt.dataset.nombre : '', vehiculo: document.getElementById('liq-nr-veh').value, zona: document.getElementById('liq-nr-zona').value.trim(), estado: 'pendiente', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                this.selectedRouteId = ref.id;
                this.selected.clear();
                this._subscribeRouteDels();
                modal.remove();
                showToast('Ruta creada', 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        });
    },

    _openLiquidate() {
        const route = this.routes.find(r => r.id === this.selectedRouteId);
        if (!route) { showToast('Selecciona una ruta para liquidar', 'error'); return; }
        if (route.estado === 'liquidado') { showToast('Esta ruta ya está liquidada', 'error'); return; }
        const dels = this.routeDels.length > 0 ? this.routeDels : this.queue.filter(r => r.rutaId === route.id).map(r => ({ guia: r.guia, cliente: r.cliente, venta: r.venta, condicionPago: r.condicionPago, costoEnvio: r.costoEnvio, entregado: r.entregado === true }));
        const hechos = dels.filter(d => d.entregado === true);
        const facturado = hechos.reduce((s, d) => s + (Number(d.venta) || 0), 0);
        const codEsp = hechos.filter(d => (d.condicionPago || '').toLowerCase() === 'contado').reduce((s, d) => s + (Number(d.venta) || 0), 0);
        const fletes = hechos.reduce((s, d) => s + (Number(d.costoEnvio) || 0), 0);
        const rep = this.repartidores.find(x => x.id === route.repartidorId);
        const comisionPct = rep ? (rep.comisionPct ?? 70) : 70;
        const comisionMonto = Math.round(fletes * comisionPct) / 100;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = '<div class="modal-content" style="max-width:500px;">' +
            '<h2 style="margin-bottom:0.25rem;">Liquidar ' + this._routeLabel(route.id) + '</h2>' +
            '<p style="font-size:0.85rem;color:#666;margin-bottom:1rem;">' + sanitizeHTML(route.repartidorNombre || '') + ' · ' + sanitizeHTML(route.vehiculo || '') + ' · Entregas ' + hechos.length + '/' + dels.length + '</p>' +
            '<table style="width:100%;font-size:0.9rem;"><tr><td style="padding:6px;">Total facturado</td><td style="text-align:right;font-weight:700;">' + formatCurrency(facturado) + '</td></tr>' +
            '<tr><td style="padding:6px;">Fletes</td><td style="text-align:right;">' + formatCurrency(fletes) + '</td></tr>' +
            '<tr><td style="padding:6px;">Comisión piloto (' + comisionPct + '%)</td><td style="text-align:right;">' + formatCurrency(comisionMonto) + '</td></tr>' +
            '<tr><td style="padding:6px;">COD esperado</td><td style="text-align:right;font-weight:700;">' + formatCurrency(codEsp) + '</td></tr></table>' +
            '<form id="liq-do-form"><div class="form-group" style="margin-top:1rem;"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.9rem;"><input type="checkbox" id="liq-do-comision" checked> Incluir comisión de ' + formatCurrency(comisionMonto) + ' al piloto</label></div>' +
            '<div class="form-group" style="margin-top:0.75rem;"><label>COD recibido</label><input type="number" id="liq-do-recibido" step="0.01" min="0" value="' + codEsp.toFixed(2) + '" style="width:100%;font-size:1.1rem;text-align:right;" required></div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem;font-size:1rem;"><strong>Diferencia</strong><strong id="liq-do-dif" style="color:#16a34a;">' + formatCurrency(0) + '</strong></div>' +
            '<div class="form-group" style="margin-top:0.75rem;"><label>Observaciones</label><input type="text" id="liq-do-obs" style="width:100%;" placeholder="Notas de la liquidación"></div>' +
            '<div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;"><button type="button" class="btn btn-secondary" id="liq-do-cancel">Cancelar</button><button type="submit" class="btn btn-primary" id="liq-do-save">Aprobar liquidación</button></div></form></div>';
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.getElementById('liq-do-cancel').onclick = () => modal.remove();
        const recalc = () => {
            const rec = parseFloat(document.getElementById('liq-do-recibido').value) || 0;
            const dif = Math.round((codEsp - rec) * 100) / 100;
            const el = document.getElementById('liq-do-dif');
            el.textContent = formatCurrency(Math.abs(dif));
            el.style.color = dif === 0 ? '#16a34a' : '#dc2626';
        };
        document.getElementById('liq-do-recibido').addEventListener('input', recalc);
        document.getElementById('liq-do-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('liq-do-save');
            setButtonLoading(btn, true);
            try {
                const recibido = parseFloat(document.getElementById('liq-do-recibido').value) || 0;
                const dif = Math.round((codEsp - recibido) * 100) / 100;
                const obs = document.getElementById('liq-do-obs').value.trim();
                const conComision = document.getElementById('liq-do-comision').checked;
                if (dif !== 0 && !await showConfirm('Diferencia de ' + formatCurrency(Math.abs(dif)), '¿Aprobar la liquidación con esta diferencia?')) { setButtonLoading(btn, false); return; }
                const db = firebase.firestore();
                await this._commitChunks([
                    { t: 'set', ref: db.collection('liquidaciones').doc(), data: { rutaId: route.id, repartidorId: route.repartidorId || '', repartidorNombre: route.repartidorNombre || '', vehiculo: route.vehiculo || '', zona: route.zona || '', fecha: firebase.firestore.FieldValue.serverTimestamp(), totalFacturado: facturado, totalCOD_esperado: codEsp, totalCOD_recibido: recibido, diferencia: dif, totalFletes: fletes, comisionPct, comisionMonto: conComision ? comisionMonto : 0, comisionIncluida: conComision, efectivoDepositado: recibido, estado: dif === 0 ? 'aprobado' : 'disputado', observaciones: obs, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: (firebase.auth().currentUser && firebase.auth().currentUser.uid) || '' } },
                    { t: 'update', ref: db.collection('rutas').doc(route.id), data: { estado: 'liquidado', updatedAt: firebase.firestore.FieldValue.serverTimestamp() } }
                ]);
                route.estado = 'liquidado';
                try {
                    const s = await db.collection('liquidaciones').orderBy('createdAt', 'desc').limit(500).get();
                    this.liquidaciones = s.docs.map(d => ({ id: d.id, ...d.data() }));
                } catch (ignored) { }
                modal.remove();
                this._renderRouteBar();
                showToast('Liquidación aprobada. Efectivo a depositar: ' + formatCurrency(recibido), 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        });
    },

    async _deleteRoute() {
        const route = this.routes.find(r => r.id === this.selectedRouteId);
        if (!route) return;
        const label = route.correlativo ? '#' + route.correlativo : route.id.substring(0, 8);
        if (!await showConfirm('Eliminar la ruta ' + label, 'Se quitarán todas las guías asignadas y la ruta se borrará.')) return;
        try {
            const db = firebase.firestore();
            const snap = await db.collection('rutaEntregas').where('rutaId', '==', route.id).get();
            const ops = [];
            snap.docs.forEach(doc => {
                const data = doc.data();
                ops.push({ t: 'delete', ref: doc.ref });
                if (data.interlogicId) ops.push({ t: 'update', ref: db.collection('interlogic').doc(data.interlogicId), data: { rutaId: firebase.firestore.FieldValue.delete(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() } });
            });
            ops.push({ t: 'delete', ref: db.collection('rutas').doc(route.id) });
            await this._commitChunks(ops);
            this.selectedRouteId = 'all';
            this._subscribeRouteDels();
            showToast('Ruta eliminada', 'success');
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
    },

    _printLiquidation() {
        const route = this.routes.find(r => r.id === this.selectedRouteId);
        if (!route) return;
        const box = document.getElementById('print-area');
        if (!box) return;
        const dels = this.routeDels;
        const hechos = dels.filter(d => d.entregado === true);
        const facturado = hechos.reduce((s, d) => s + (Number(d.venta) || 0), 0);
        const codEsp = hechos.filter(d => (d.condicionPago || '').toLowerCase() === 'contado').reduce((s, d) => s + (Number(d.venta) || 0), 0);
        const fletes = hechos.reduce((s, d) => s + (Number(d.costoEnvio) || 0), 0);
        const liq = this.liquidaciones.find(l => l.rutaId === route.id) || {};
        const fecha = route.fecha && route.fecha.toDate ? route.fecha.toDate().toLocaleDateString('es-ES') : '-';
        box.innerHTML = '<div style="font-family:Arial,sans-serif;padding:20px;max-width:900px;margin:0 auto;color:#000;">' +
            '<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px;"><h1 style="margin:0;font-size:1.4rem;">LIQUIDACIÓN DE RUTA</h1>' +
            '<p style="margin:5px 0 0;font-size:0.85rem;">Ruta #' + (route.correlativo || '') + ' · ' + fecha + '</p>' +
            '<p style="margin:2px 0 0;font-size:0.8rem;">Repartidor: ' + sanitizeHTML(route.repartidorNombre || '-') + ' · Vehículo: ' + sanitizeHTML(route.vehiculo || '-') + ' · Zona: ' + sanitizeHTML(route.zona || '-') + '</p></div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:0.75rem;margin-bottom:20px;"><thead><tr style="background:#f0f0f0;"><th style="border:1px solid #ccc;padding:5px;">#</th><th style="border:1px solid #ccc;padding:5px;text-align:left;">Guía</th><th style="border:1px solid #ccc;padding:5px;text-align:left;">Cliente</th><th style="border:1px solid #ccc;padding:5px;text-align:right;">Venta</th><th style="border:1px solid #ccc;padding:5px;">Pago</th><th style="border:1px solid #ccc;padding:5px;">E</th><th style="border:1px solid #ccc;padding:5px;text-align:right;">Flete</th></tr></thead><tbody>' +
            dels.map((d, i) => '<tr><td style="border:1px solid #ccc;padding:5px;text-align:center;">' + (i + 1) + '</td><td style="border:1px solid #ccc;padding:5px;">' + sanitizeHTML(d.guia || '') + '</td><td style="border:1px solid #ccc;padding:5px;">' + sanitizeHTML(d.cliente || '') + '</td><td style="border:1px solid #ccc;padding:5px;text-align:right;">' + formatCurrency(d.venta || 0) + '</td><td style="border:1px solid #ccc;padding:5px;text-align:center;">' + sanitizeHTML(d.condicionPago || '') + '</td><td style="border:1px solid #ccc;padding:5px;text-align:center;">' + (d.entregado ? 'Sí' : 'No') + '</td><td style="border:1px solid #ccc;padding:5px;text-align:right;">' + formatCurrency(d.costoEnvio || 0) + '</td></tr>').join('') +
            '</tbody></table>' +
            '<table style="width:100%;font-size:0.85rem;"><tr><td>Entregas realizadas</td><td style="text-align:right;"><strong>' + hechos.length + ' / ' + dels.length + '</strong></td></tr>' +
            '<tr><td>Total facturado</td><td style="text-align:right;"><strong>' + formatCurrency(facturado) + '</strong></td></tr>' +
            '<tr><td>Total fletes</td><td style="text-align:right;">' + formatCurrency(fletes) + '</td></tr>' +
            '<tr><td>Comisión piloto' + (liq.comisionIncluida === false ? ' (no incluida)' : '') + '</td><td style="text-align:right;">' + formatCurrency(liq.comisionMonto || 0) + '</td></tr>' +
            '<tr><td>COD esperado</td><td style="text-align:right;">' + formatCurrency(codEsp) + '</td></tr>' +
            '<tr><td>COD recibido</td><td style="text-align:right;">' + formatCurrency(liq.totalCOD_recibido || 0) + '</td></tr>' +
            '<tr><td>Diferencia</td><td style="text-align:right;"><strong>' + formatCurrency(liq.diferencia || 0) + '</strong></td></tr>' +
            '<tr><td>Efectivo a depositar</td><td style="text-align:right;"><strong>' + formatCurrency(liq.efectivoDepositado || 0) + '</strong></td></tr></table></div>';
        window.print();
    },

    async _openFicha(cliente) {
        if (!cliente) return;
        const rows = this.queue.filter(r => (r.cliente || '') === cliente);
        const saldo = rows.reduce((s, r) => s + this._pendiente(r), 0);
        const venc = rows.filter(r => this._isVencido(r)).reduce((s, r) => s + this._pendiente(r), 0);
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = '<div class="modal-content" style="max-width:640px;max-height:90vh;overflow-y:auto;">' +
            '<h2 style="margin-bottom:0.25rem;">' + sanitizeHTML(cliente) + '</h2>' +
            '<p style="font-size:0.9rem;color:#666;margin-bottom:1rem;">Saldo total: <strong style="color:#b45309;">' + formatCurrency(saldo) + '</strong>' + (venc > 0 ? ' · <strong style="color:#dc2626;">Vencido: ' + formatCurrency(venc) + '</strong>' : '') + '</p>' +
            '<h3 style="font-size:0.9rem;margin-bottom:0.5rem;">Facturas pendientes (' + rows.length + ')</h3>' +
            '<div class="table-container"><table class="data-table" style="font-size:0.8rem;"><thead><tr><th>Guía</th><th style="text-align:right;">Venta</th><th style="text-align:right;">Cobrado</th><th style="text-align:right;">Saldo</th><th>Vence</th><th></th></tr></thead><tbody>' +
            rows.map(r => {
                const v = this._vencimiento(r);
                return '<tr><td><strong>' + sanitizeHTML(r.guia || '') + '</strong></td><td style="text-align:right;">' + formatCurrency(r.venta || 0) + '</td><td style="text-align:right;color:#16a34a;">' + formatCurrency(this._cobrado(r)) + '</td><td style="text-align:right;font-weight:700;">' + formatCurrency(this._pendiente(r)) + '</td><td style="font-size:0.75rem;color:' + (this._isVencido(r) ? '#dc2626' : '#666') + ';">' + (v ? formatDateShort(v) : '-') + '</td><td><button class="btn btn-primary btn-sm" data-ficha-pay="' + r.id + '">Cobrar</button></td></tr>';
            }).join('') +
            '</tbody></table></div>' +
            '<div style="display:flex;gap:0.5rem;margin:1rem 0;flex-wrap:wrap;"><button class="btn btn-secondary btn-sm" id="liq-f-gest">Nueva gestión</button><button class="btn btn-secondary btn-sm" id="liq-f-nc">Nota de crédito / Ajuste</button><button class="btn btn-secondary btn-sm" id="liq-f-hist">Ver historial</button></div>' +
            '<div id="liq-f-extra"></div>' +
            '<div style="display:flex;justify-content:flex-end;margin-top:1rem;"><button class="btn btn-secondary" id="liq-f-close">Cerrar</button></div></div>';
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.getElementById('liq-f-close').onclick = () => modal.remove();
        modal.querySelectorAll('[data-ficha-pay]').forEach(b => { b.onclick = () => { modal.remove(); this._openPay(b.dataset.fichaPay); }; });
        document.getElementById('liq-f-gest').onclick = () => this._fichaGestion(modal, cliente, rows);
        document.getElementById('liq-f-nc').onclick = () => this._fichaAjuste(modal, cliente, rows);
        document.getElementById('liq-f-hist').onclick = () => this._fichaHistorial(modal, cliente, rows);
    },

    async _fichaHistorial(modal, cliente, rows) {
        const box = modal.querySelector('#liq-f-extra');
        box.innerHTML = '<p style="font-size:0.85rem;color:#666;">Cargando historial...</p>';
        const db = firebase.firestore();
        let cobros = [], gestiones = [], ajustes = [];
        try {
            const s = await db.collection('cobros').where('cliente', '==', cliente).limit(100).get();
            cobros = s.docs.map(d => ({ id: d.id, ...d.data() }));
            cobros.sort((a, b) => ((b.fecha && b.fecha.toDate ? b.fecha.toDate().getTime() : 0) - (a.fecha && a.fecha.toDate ? a.fecha.toDate().getTime() : 0)));
        } catch (e) { }
        try {
            const s = await db.collection('gestiones').where('cliente', '==', cliente).limit(50).get();
            gestiones = s.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { }
        try {
            const s = await db.collection('ajustes').where('cliente', '==', cliente).limit(50).get();
            ajustes = s.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { }
        const ids = new Set(rows.map(r => r.id));
        cobros = cobros.filter(c => !c.interlogicId || ids.has(c.interlogicId));
        let html = '<h3 style="font-size:0.9rem;margin:0.5rem 0;">Pagos (' + cobros.length + ')</h3>';
        html += cobros.length === 0 ? '<p style="font-size:0.8rem;color:#8e8e93;">Sin pagos registrados</p>' :
            '<div class="table-container"><table class="data-table" style="font-size:0.78rem;"><thead><tr><th>Fecha</th><th>Guía</th><th style="text-align:right;">Monto</th><th>Método</th><th>Ref</th></tr></thead><tbody>' +
            cobros.map(c => '<tr><td>' + (c.fecha && c.fecha.toDate ? formatDateShort(c.fecha) : '-') + '</td><td>' + sanitizeHTML(c.guia || '') + '</td><td style="text-align:right;">' + formatCurrency(c.monto || 0) + '</td><td>' + sanitizeHTML(c.metodo || '') + '</td><td style="font-size:0.72rem;">' + sanitizeHTML(c.referencia || '') + '</td></tr>').join('') + '</tbody></table></div>';
        html += '<h3 style="font-size:0.9rem;margin:0.75rem 0 0.5rem;">Gestiones (' + gestiones.length + ')</h3>';
        html += gestiones.length === 0 ? '<p style="font-size:0.8rem;color:#8e8e93;">Sin gestiones</p>' :
            '<div class="table-container"><table class="data-table" style="font-size:0.78rem;"><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Resultado</th></tr></thead><tbody>' +
            gestiones.map(g => '<tr><td>' + (g.fecha && g.fecha.toDate ? formatDateShort(g.fecha) : '-') + '</td><td>' + sanitizeHTML(g.tipo || '') + '</td><td>' + sanitizeHTML(g.descripcion || '') + '</td><td>' + sanitizeHTML(g.resultado || '') + '</td></tr>').join('') + '</tbody></table></div>';
        html += '<h3 style="font-size:0.9rem;margin:0.75rem 0 0.5rem;">Ajustes (' + ajustes.length + ')</h3>';
        html += ajustes.length === 0 ? '<p style="font-size:0.8rem;color:#8e8e93;">Sin ajustes</p>' :
            '<div class="table-container"><table class="data-table" style="font-size:0.78rem;"><thead><tr><th>Fecha</th><th>Tipo</th><th style="text-align:right;">Monto</th><th>Motivo</th></tr></thead><tbody>' +
            ajustes.map(a => '<tr><td>' + (a.fecha && a.fecha.toDate ? formatDateShort(a.fecha) : '-') + '</td><td>' + sanitizeHTML(a.tipo || '') + '</td><td style="text-align:right;">' + formatCurrencySigned(a.monto || 0) + '</td><td>' + sanitizeHTML(a.motivo || '') + '</td></tr>').join('') + '</tbody></table></div>';
        box.innerHTML = html;
    },

    _fichaGestion(modal, cliente) {
        const box = modal.querySelector('#liq-f-extra');
        box.innerHTML = '<h3 style="font-size:0.9rem;margin:0.5rem 0;">Nueva gestión</h3>' +
            '<form id="liq-f-gest-form"><div class="form-group"><label>Tipo</label><select id="liq-fg-tipo" style="width:100%;"><option>llamada</option><option>whatsapp</option><option>visita</option><option>email</option><option>carta</option><option>otro</option></select></div>' +
            '<div class="form-group" style="margin-top:0.75rem;"><label>Descripción</label><textarea id="liq-fg-desc" rows="3" style="width:100%;" required></textarea></div>' +
            '<div class="form-group" style="margin-top:0.75rem;"><label>Resultado / Acuerdo</label><input type="text" id="liq-fg-res" style="width:100%;" placeholder="Ej: Prometió pagar el viernes"></div>' +
            '<div class="form-group" style="margin-top:0.75rem;"><label>Próxima acción</label><input type="date" id="liq-fg-prox" style="width:100%;"></div>' +
            '<div style="display:flex;justify-content:flex-end;margin-top:1rem;"><button type="submit" class="btn btn-primary btn-sm" id="liq-fg-save">Guardar gestión</button></div></form>';
        document.getElementById('liq-f-gest-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('liq-fg-save');
            setButtonLoading(btn, true);
            try {
                const prox = document.getElementById('liq-fg-prox').value;
                let proxTs = null;
                if (prox) { const p = prox.split('-').map(Number); proxTs = firebase.firestore.Timestamp.fromDate(new Date(p[0], p[1] - 1, p[2], 12, 0, 0)); }
                await firebase.firestore().collection('gestiones').add({ cliente, tipo: document.getElementById('liq-fg-tipo').value, descripcion: document.getElementById('liq-fg-desc').value.trim(), resultado: document.getElementById('liq-fg-res').value.trim(), proximaAccion: proxTs, fecha: firebase.firestore.FieldValue.serverTimestamp(), usuario: (firebase.auth().currentUser && firebase.auth().currentUser.uid) || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                box.innerHTML = '<p style="font-size:0.85rem;color:#16a34a;">Gestión guardada</p>';
                showToast('Gestión guardada', 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        });
    },

    _fichaAjuste(modal, cliente, rows) {
        const box = modal.querySelector('#liq-f-extra');
        box.innerHTML = '<h3 style="font-size:0.9rem;margin:0.5rem 0;">Nota de crédito / Ajuste</h3>' +
            '<form id="liq-f-nc-form"><div class="form-group"><label>Factura (guía)</label><select id="liq-fnc-guia" style="width:100%;"><option value="">Sin guía (solo registro)</option>' +
            rows.map(r => '<option value="' + r.id + '">#' + sanitizeHTML(r.guia || '') + ' - ' + formatCurrency(this._pendiente(r)) + ' pendiente</option>').join('') +
            '</select></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem;"><div class="form-group"><label>Tipo</label><select id="liq-fnc-tipo" style="width:100%;"><option value="notaCredito">Nota de crédito</option><option value="descuento">Descuento</option><option value="devolucion">Devolución</option><option value="cargoExtra">Cargo extra</option></select></div>' +
            '<div class="form-group"><label>Monto</label><input type="number" id="liq-fnc-monto" step="0.01" min="0.01" style="width:100%;" required></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem;"><div class="form-group"><label>No. NC (opcional)</label><input type="text" id="liq-fnc-num" style="width:100%;"></div>' +
            '<div class="form-group"><label>Motivo</label><input type="text" id="liq-fnc-motivo" style="width:100%;" required></div></div>' +
            '<div style="display:flex;justify-content:flex-end;margin-top:1rem;"><button type="submit" class="btn btn-primary btn-sm" id="liq-fnc-save">Guardar</button></div></form>';
        document.getElementById('liq-f-nc-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('liq-fnc-save');
            setButtonLoading(btn, true);
            try {
                const recordId = document.getElementById('liq-fnc-guia').value;
                const tipo = document.getElementById('liq-fnc-tipo').value;
                const monto = parseFloat(document.getElementById('liq-fnc-monto').value) || 0;
                const motivo = document.getElementById('liq-fnc-motivo').value.trim();
                const ncNum = document.getElementById('liq-fnc-num').value.trim();
                if (monto <= 0) { showToast('Monto inválido', 'error'); setButtonLoading(btn, false); return; }
                const db = firebase.firestore();
                const uid = (firebase.auth().currentUser && firebase.auth().currentUser.uid) || '';
                const guiaSel = recordId ? (rows.find(r => r.id === recordId) || {}).guia || '' : '';
                const signed = tipo === 'cargoExtra' ? Math.abs(monto) : -Math.abs(monto);
                const ajusteData = { cliente, tipo, guia: guiaSel, monto: signed, motivo, fecha: firebase.firestore.FieldValue.serverTimestamp(), usuario: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
                const ops = [{ t: 'set', ref: db.collection('ajustes').doc(), data: ajusteData }];
                if (tipo === 'notaCredito') ops.push({ t: 'set', ref: db.collection('notasCredito').doc(), data: { ncNum, cliente, monto: Math.abs(monto), motivo, fecha: firebase.firestore.FieldValue.serverTimestamp(), empresa: '', interlogicId: recordId, guia: guiaSel, afectaSaldo: !!recordId, estado: 'activa', createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: uid } });
                if (recordId && tipo !== 'cargoExtra') {
                    const rec = this.queue.find(r => r.id === recordId);
                    if (rec) {
                        const venta = Number(rec.venta) || 0;
                        const nuevoCobrado = Math.max(0, this._cobrado(rec) + Math.abs(monto));
                        const estado = nuevoCobrado >= venta ? 'pagado' : (nuevoCobrado > 0 ? 'parcial' : 'pendiente');
                        ops.push({ t: 'update', ref: db.collection('interlogic').doc(recordId), data: { montoCobrado: nuevoCobrado, montoPendiente: Math.max(0, venta - nuevoCobrado), estadoCobro: estado, cobrado: estado === 'pagado', updatedAt: firebase.firestore.FieldValue.serverTimestamp() } });
                    }
                }
                await this._commitChunks(ops);
                box.innerHTML = '<p style="font-size:0.85rem;color:#16a34a;">Ajuste guardado</p>';
                showToast('Ajuste guardado', 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        });
    }
};

window.Liquidacion = Liquidacion;
