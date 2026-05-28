const Asistencia = {
    MONTH_NAMES: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
    STATUS_CLASSES: ['status-cruce','status-iss','status-descuento'],
    EXCEL_COLORS: { cruce:'FF92D050', iss:'FFFFFF00', descuento:'FFFF0000', altRow:'FFEFEFEF', white:'FFFFFFFF', black:'FF000000' },

    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    periodHalf: 2,
    employees: [],
    dateColumns: [],
    byEmployee: {},
    selectedCell: null,
    applyScope: 'cell',
    dirty: false,
    saveTimer: null,

    periodKey(y, m, h) {
        return `${y}-${String(m).padStart(2,'0')}-${h}`;
    },

    currentPeriodKey() {
        return this.periodKey(this.year, this.month, this.periodHalf);
    },

    getHalfDayRange(y, m, h) {
        const lastDay = new Date(y, m, 0).getDate();
        return h === 1 ? { startDay:1, endDay:Math.min(15,lastDay) } : { startDay:16, endDay:lastDay };
    },

    getDateColumns(y, m, h) {
        const fmt = new Intl.DateTimeFormat('es-MX',{ weekday:'long', day:'numeric', month:'long', year:'numeric' });
        const { startDay, endDay } = this.getHalfDayRange(y, m, h);
        const cols = [];
        for (let d = startDay; d <= endDay; d++) {
            const date = new Date(y, m-1, d);
            cols.push({ day:d, date, label:fmt.format(date), key:`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` });
        }
        return cols;
    },

    periodRangeLabel(h) {
        return h === 1 ? 'del 1 al 15' : 'del 16 al fin de mes';
    },

    createEmployeeId() {
        return `e${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    },

    emptyEmployeeData(dateKeys) {
        const cells = {};
        dateKeys.forEach(k => { cells[k] = { hours:'', status:null }; });
        return { observations:'', cells };
    },

    ensureEmployeeData(empId) {
        if (!this.byEmployee[empId]) {
            this.byEmployee[empId] = this.emptyEmployeeData(this.dateColumns.map(c => c.key));
        }
        this.dateColumns.forEach(col => {
            if (!this.byEmployee[empId].cells[col.key]) {
                this.byEmployee[empId].cells[col.key] = { hours:'', status:null };
            }
        });
    },

    autoResizeNameInput(input) {
        if (!input) return;
        input.style.width = 'auto';
        const textWidth = input.scrollWidth + 10;
        input.style.width = Math.max(120, textWidth) + 'px';
    },

    autoResizeObsInput(input) {
        if (!input) return;
        input.style.width = 'auto';
        const textWidth = input.scrollWidth + 10;
        input.style.width = Math.max(120, textWidth) + 'px';
    },

    async loadFromFirestore() {
        const db = firebase.firestore();
        const pk = this.currentPeriodKey();
        try {
            const configDoc = await db.collection('asistencia').doc('_config').get();
            if (configDoc.exists && configDoc.data().employees?.length) {
                this.employees = configDoc.data().employees;
            } else {
                this.employees = [];
            }
        } catch(e) {
            console.warn('Error loading config:', e);
            this.employees = [];
        }
        try {
            const periodDoc = await db.collection('asistencia').doc(pk).get();
            if (periodDoc.exists) {
                const data = periodDoc.data();
                if (data.employees?.length) this.employees = data.employees;
                this.byEmployee = data.byEmployee || {};
            } else {
                this.byEmployee = {};
            }
        } catch(e) {
            console.warn('Error loading period:', e);
            this.byEmployee = {};
        }
        this.dateColumns = this.getDateColumns(this.year, this.month, this.periodHalf);
        this.employees.forEach(emp => this.ensureEmployeeData(emp.id));
    },

    async saveToFirestore() {
        const db = firebase.firestore();
        const pk = this.currentPeriodKey();
        const empList = this.employees.map(e => ({ id:e.id, name:e.name }));
        try {
            await db.collection('asistencia').doc('_config').set({ employees: empList }, { merge:true });
            await db.collection('asistencia').doc(pk).set({
                employees: empList,
                byEmployee: this.byEmployee
            }, { merge:true });
        } catch(e) {
            console.error('Error saving:', e);
            if (typeof showToast === 'function') showToast('Error al guardar','error');
        }
        this.dirty = false;
    },

    markDirty() {
        this.dirty = true;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveToFirestore();
            this.updateStatus('Guardado automáticamente');
        }, 800);
    },

    updateStatus(msg) {
        const el = document.getElementById('asis-status');
        if (el) el.textContent = msg;
    },

    async render() {
        if (window.innerWidth <= 768) return this.renderMobile();
        return this.renderDesktop();
    },

    renderDesktop() {
        const contentArea = document.getElementById('content-area');
        const canEdit = window.permissions?.canCreate || window.permissions?.canEdit;
        contentArea.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;min-height:calc(100vh - 100px);">
            <div class="module-header" style="flex-shrink:0;">
                <div>
                    <h1>📅 Asistencia</h1>
                    <p>Control de horas y permisos — BOD Despacho</p>
                </div>
                <span id="asis-status" class="asis-save-status"></span>
            </div>
            <div class="asis-toolbar" style="flex-shrink:0;">
                <div class="asis-period-panel">
                    <label class="asis-field">
                        <span>Mes</span>
                        <select id="asis-month"></select>
                    </label>
                    <label class="asis-field">
                        <span>Año</span>
                        <select id="asis-year"></select>
                    </label>
                    <label class="asis-field">
                        <span>Rango</span>
                        <select id="asis-half">
                            <option value="1">Del 1 al 15</option>
                            <option value="2">Del 16 al fin de mes</option>
                        </select>
                    </label>
                    <button class="btn btn-sm btn-primary" id="asis-btn-apply">Aplicar</button>
                </div>
                <div class="asis-action-btns">
                    <button class="btn btn-sm btn-secondary" id="asis-btn-save">💾 Guardar</button>
                    <button class="btn btn-sm btn-secondary" id="asis-btn-export">📥 Exportar</button>
                    <label class="btn btn-sm btn-secondary asis-btn-file">
                        📤 Importar
                        <input type="file" id="asis-input-import" accept=".xlsx" hidden>
                    </label>
                    ${canEdit ? '<button class="btn btn-sm btn-secondary" id="asis-btn-add">+ Empleado</button>' : ''}
                    ${canEdit ? '<button class="btn btn-sm btn-danger" id="asis-btn-delete">Eliminar</button>' : ''}
                </div>
            </div>
            <div class="asis-status-bar" style="flex-shrink:0;">
                <span class="asis-sb-label">Estado:</span>
                <div class="asis-chip-row">
                    <button class="asis-status-btn asis-cruce" data-status="cruce">CRUCE</button>
                    <button class="asis-status-btn asis-iss" data-status="iss">ISS 75%</button>
                    <button class="asis-status-btn asis-descuento" data-status="descuento">DESC.</button>
                </div>
                <span class="asis-sb-label">Aplicar:</span>
                <div class="asis-chip-row">
                    <button class="asis-scope-btn asis-scope-active" data-scope="cell">Celda</button>
                    <button class="asis-scope-btn" data-scope="from-cell">Desde</button>
                    <button class="asis-scope-btn" data-scope="row">Fila</button>
                    <button class="asis-scope-btn asis-scope-muted" id="asis-btn-clear">Quitar</button>
                </div>
            </div>
            <div class="asis-sheet-card" style="flex:1;min-height:200px;">
                <div class="asis-table-wrapper">
                    <table class="asis-table" id="asis-table">
                        <thead>
                            <tr><th colspan="100" class="asis-sheet-title">HORAS / PERMISOS — BOD DESPACHO</th></tr>
                            <tr id="asis-header-row">
                                <th class="asis-col-num asis-sticky">#</th>
                                <th class="asis-col-name asis-sticky asis-sticky-name">Empleado</th>
                                <th class="asis-col-obs">OBS</th>
                            </tr>
                        </thead>
                        <tbody id="asis-tbody"></tbody>
                    </table>
                </div>
            </div>
            </div>
        `;
        this.initControls();
        this.loadFromFirestore().then(() => {
            this.populateSelects();
            this.renderTable();
            this.updateStatus(`${this.month}/${this.year}, ${this.periodRangeLabel(this.periodHalf)}`);
        });
    },

    renderMobile() {
        const contentArea = document.getElementById('content-area');
        const canEdit = window.permissions?.canCreate || window.permissions?.canEdit;
        contentArea.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;min-height:calc(100vh - 150px);padding:0.5rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                    <h2 style="font-size:1rem;margin:0;">📅 Asistencia</h2>
                    <span id="asis-status" class="asis-save-status" style="font-size:0.7rem;"></span>
                </div>
                <div style="display:flex;gap:0.25rem;flex-wrap:wrap;margin:0.35rem 0;flex-shrink:0;">
                    <select id="asis-month" style="font-size:0.7rem;padding:0.2rem;"></select>
                    <select id="asis-year" style="font-size:0.7rem;padding:0.2rem;"></select>
                    <select id="asis-half" style="font-size:0.7rem;padding:0.2rem;">
                        <option value="1">1-15</option>
                        <option value="2">16-fin</option>
                    </select>
                    <button class="btn btn-sm btn-primary" id="asis-btn-apply" style="padding:0.2rem 0.4rem;">OK</button>
                    <button class="btn btn-sm btn-secondary" id="asis-btn-save" style="padding:0.2rem 0.4rem;">💾</button>
                    <button class="btn btn-sm btn-secondary" id="asis-btn-export" style="padding:0.2rem 0.4rem;">📥</button>
                    <label class="btn btn-sm btn-secondary asis-btn-file" style="padding:0.2rem 0.4rem;">
                        📤<input type="file" id="asis-input-import" accept=".xlsx" hidden>
                    </label>
                    ${canEdit ? '<button class="btn btn-sm btn-secondary" id="asis-btn-add" style="padding:0.2rem 0.4rem;">+Emp</button>' : ''}
                    ${canEdit ? '<button class="btn btn-sm btn-danger" id="asis-btn-delete" style="padding:0.2rem 0.4rem;">🗑</button>' : ''}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:0.25rem;padding:0.25rem;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;flex-shrink:0;">
                    <button class="asis-status-btn asis-cruce" data-status="cruce" style="font-size:0.55rem;padding:0.15rem 0.35rem;">CRUCE</button>
                    <button class="asis-status-btn asis-iss" data-status="iss" style="font-size:0.55rem;padding:0.15rem 0.35rem;">ISS</button>
                    <button class="asis-status-btn asis-descuento" data-status="descuento" style="font-size:0.55rem;padding:0.15rem 0.35rem;">DESC</button>
                    <button class="asis-scope-btn asis-scope-active" data-scope="cell" style="font-size:0.55rem;padding:0.12rem 0.35rem;">Celda</button>
                    <button class="asis-scope-btn" data-scope="from-cell" style="font-size:0.55rem;padding:0.12rem 0.35rem;">Desde</button>
                    <button class="asis-scope-btn" data-scope="row" style="font-size:0.55rem;padding:0.12rem 0.35rem;">Fila</button>
                    <button class="asis-scope-btn asis-scope-muted" id="asis-btn-clear" style="font-size:0.55rem;padding:0.12rem 0.35rem;">Quitar</button>
                </div>
                <div class="asis-table-wrapper" style="flex:1;min-height:200px;margin-top:0.25rem;">
                    <table class="asis-table asis-table-mobile" id="asis-table">
                        <thead>
                            <tr><th colspan="100" class="asis-sheet-title" style="font-size:0.65rem;padding:0.2rem;">HORAS / PERMISOS</th></tr>
                            <tr id="asis-header-row">
                                <th class="asis-col-num asis-sticky">#</th>
                                <th class="asis-col-name asis-sticky asis-sticky-name">Empleado</th>
                                <th class="asis-col-obs">OBS</th>
                            </tr>
                        </thead>
                        <tbody id="asis-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;
        this.initControls();
        this.loadFromFirestore().then(() => {
            this.populateSelects();
            this.renderTable();
            this.updateStatus(`${this.month}/${this.year}`);
        });
    },

    populateSelects() {
        const mSel = document.getElementById('asis-month');
        const ySel = document.getElementById('asis-year');
        const hSel = document.getElementById('asis-half');
        if (!mSel || !ySel) return;
        mSel.innerHTML = '';
        this.MONTH_NAMES.forEach((name, i) => {
            const opt = document.createElement('option');
            opt.value = String(i+1);
            opt.textContent = name.charAt(0).toUpperCase() + name.slice(1);
            if (i+1 === this.month) opt.selected = true;
            mSel.appendChild(opt);
        });
        const curYear = new Date().getFullYear();
        ySel.innerHTML = '';
        for (let y = curYear-2; y <= curYear+3; y++) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            if (y === this.year) opt.selected = true;
            ySel.appendChild(opt);
        }
        if (hSel) hSel.value = String(this.periodHalf);
    },

    renderTable() {
        this.renderHeaders();
        this.renderBody();
    },

    renderHeaders() {
        const headerRow = document.getElementById('asis-header-row');
        if (!headerRow) return;
        headerRow.querySelectorAll('.asis-col-date').forEach(el => el.remove());
        const obsTh = headerRow.querySelector('.asis-col-obs');
        this.dateColumns.forEach(col => {
            const th = document.createElement('th');
            th.className = 'asis-col-date';
            th.dataset.dateKey = col.key;
            const span = document.createElement('span');
            span.className = 'asis-date-header';
            span.textContent = col.label;
            th.appendChild(span);
            headerRow.insertBefore(th, obsTh);
        });
        this.syncColspan();
    },

    syncColspan() {
        const total = 2 + this.dateColumns.length + 1;
        const title = document.querySelector('.asis-sheet-title');
        if (title) title.colSpan = total;
    },

    renderBody() {
        const tbody = document.getElementById('asis-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.employees.forEach((emp, idx) => {
            this.ensureEmployeeData(emp.id);
            const rowData = this.byEmployee[emp.id];
            const tr = document.createElement('tr');
            tr.dataset.employeeId = emp.id;
            if (idx % 2 === 0) tr.classList.add('asis-row-alt');

            const tdNum = document.createElement('td');
            tdNum.className = 'asis-col-num asis-sticky asis-row-num';
            tdNum.textContent = String(idx+1);
            tr.appendChild(tdNum);

            const tdName = document.createElement('td');
            tdName.className = 'asis-col-name asis-sticky asis-sticky-name asis-cell-name';
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = emp.name;
            nameInput.addEventListener('input', () => {
                emp.name = nameInput.value;
                this.markDirty();
                this.autoResizeNameInput(nameInput);
            });
            tdName.appendChild(nameInput);
            tr.appendChild(tdName);
            requestAnimationFrame(() => this.autoResizeNameInput(nameInput));

            this.dateColumns.forEach(col => {
                const cell = rowData.cells[col.key] || { hours:'', status:null };
                const td = document.createElement('td');
                td.className = 'asis-cell-date';
                td.dataset.employeeId = emp.id;
                td.dataset.dateKey = col.key;
                const input = document.createElement('input');
                input.type = 'text';
                input.inputMode = 'decimal';
                input.value = cell.hours || '';
                input.addEventListener('input', () => { cell.hours = input.value; this.markDirty(); });
                input.addEventListener('focus', () => this.selectCell(td, emp.id, col.key));
                td.addEventListener('click', () => this.selectCell(td, emp.id, col.key));
                this.applyStatusClass(td, cell.status);
                td.appendChild(input);
                tr.appendChild(td);
            });

            const tdObs = document.createElement('td');
            tdObs.className = 'asis-cell-obs asis-col-obs';
            const obsInput = document.createElement('input');
            obsInput.type = 'text';
            obsInput.value = rowData.observations || '';
            obsInput.addEventListener('input', () => {
                rowData.observations = obsInput.value;
                this.markDirty();
                this.autoResizeObsInput(obsInput);
            });
            tdObs.appendChild(obsInput);
            tr.appendChild(tdObs);
            requestAnimationFrame(() => this.autoResizeObsInput(obsInput));

            tbody.appendChild(tr);
        });
    },

    selectCell(td, employeeId, dateKey) {
        if (this.selectedCell?.td) this.selectedCell.td.classList.remove('asis-selected');
        td.classList.add('asis-selected');
        this.selectedCell = { td, employeeId, dateKey };
    },

    applyStatusClass(td, status) {
        this.STATUS_CLASSES.forEach(c => td.classList.remove(c));
        if (status === 'cruce') td.classList.add('status-cruce');
        else if (status === 'iss') td.classList.add('status-iss');
        else if (status === 'descuento') td.classList.add('status-descuento');
    },

    applyStatusToScope(status) {
        if (!this.selectedCell) { this.updateStatus('Seleccione una celda de fecha primero'); return; }
        const { employeeId, dateKey } = this.selectedCell;
        this.ensureEmployeeData(employeeId);
        const cells = this.byEmployee[employeeId].cells;
        const dateKeys = this.dateColumns.map(c => c.key);
        const startIdx = dateKeys.indexOf(dateKey);
        const setOn = (key) => {
            if (!cells[key]) cells[key] = { hours:'', status:null };
            cells[key].status = status;
        };
        if (this.applyScope === 'cell') {
            setOn(dateKey);
        } else if (this.applyScope === 'from-cell') {
            if (startIdx < 0) return;
            for (let i = startIdx; i < dateKeys.length; i++) setOn(dateKeys[i]);
        } else if (this.applyScope === 'row') {
            dateKeys.forEach(setOn);
        }
        this.markDirty();
        this.renderBody();
        const td = document.querySelector(`#asis-tbody td[data-employee-id="${employeeId}"][data-date-key="${dateKey}"]`);
        if (td) this.selectCell(td, employeeId, dateKey);
    },

    clearStatusOnScope() {
        if (!this.selectedCell) { this.updateStatus('Seleccione una celda de fecha primero'); return; }
        const { employeeId, dateKey } = this.selectedCell;
        this.ensureEmployeeData(employeeId);
        const cells = this.byEmployee[employeeId].cells;
        const dateKeys = this.dateColumns.map(c => c.key);
        const startIdx = dateKeys.indexOf(dateKey);
        const clearKey = (key) => { if (cells[key]) cells[key].status = null; };
        if (this.applyScope === 'cell') {
            clearKey(dateKey);
        } else if (this.applyScope === 'from-cell') {
            for (let i = startIdx; i < dateKeys.length; i++) clearKey(dateKeys[i]);
        } else {
            dateKeys.forEach(clearKey);
        }
        this.markDirty();
        this.renderBody();
    },

    async changePeriod(y, m, h) {
        if (this.dirty) {
            const ok = confirm('Hay cambios sin guardar. ¿Guardar antes de cambiar?');
            if (ok) await this.saveToFirestore();
            else if (!confirm('¿Continuar sin guardar?')) return;
        }
        this.year = y; this.month = m; this.periodHalf = h;
        this.selectedCell = null;
        await this.loadFromFirestore();
        this.populateSelects();
        this.renderTable();
        this.updateStatus(`Periodo: ${m}/${y}, ${this.periodRangeLabel(h)}`);
    },

    initControls() {
        document.getElementById('asis-btn-apply')?.addEventListener('click', () => {
            const y = Number(document.getElementById('asis-year').value);
            const m = Number(document.getElementById('asis-month').value);
            const h = Number(document.getElementById('asis-half').value);
            this.changePeriod(y, m, h);
        });

        document.getElementById('asis-btn-save')?.addEventListener('click', async () => {
            await this.saveToFirestore();
            this.updateStatus('Guardado correctamente');
            if (typeof showToast === 'function') showToast('Guardado','success');
        });

        document.getElementById('asis-btn-add')?.addEventListener('click', () => {
            const id = this.createEmployeeId();
            this.employees.push({ id, name:'Nuevo empleado' });
            this.byEmployee[id] = this.emptyEmployeeData(this.dateColumns.map(c => c.key));
            this.markDirty();
            this.renderBody();
            this.updateStatus('Empleado agregado');
        });

        document.getElementById('asis-btn-delete')?.addEventListener('click', () => {
            if (!this.selectedCell) { this.updateStatus('Seleccione una fila'); return; }
            const { employeeId } = this.selectedCell;
            const emp = this.employees.find(e => e.id === employeeId);
            if (!emp || !confirm(`¿Eliminar a "${emp.name}"?`)) return;
            this.employees = this.employees.filter(e => e.id !== employeeId);
            delete this.byEmployee[employeeId];
            this.selectedCell = null;
            this.markDirty();
            this.renderBody();
            this.updateStatus('Fila eliminada');
        });

        document.getElementById('asis-btn-export')?.addEventListener('click', async () => {
            this.updateStatus('Generando Excel...');
            try {
                await this.exportToExcel();
                this.updateStatus('Excel exportado');
            } catch(e) {
                this.updateStatus(`Error al exportar: ${e.message}`);
            }
        });

        document.getElementById('asis-input-import')?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            this.updateStatus('Leyendo Excel...');
            try {
                const buffer = await file.arrayBuffer();
                const imported = await this.importFromExcel(buffer);
                if (!imported) { this.updateStatus('No se pudo importar'); e.target.value=''; return; }
                if (!confirm(`Se importarán ${imported.employees.length} filas. ¿Reemplazar datos?`)) { e.target.value=''; return; }
                this.employees = imported.employees;
                this.byEmployee = imported.byEmployee;
                this.markDirty();
                this.renderBody();
                await this.saveToFirestore();
                this.updateStatus('Excel importado correctamente');
            } catch(err) {
                this.updateStatus(`Error al importar: ${err.message}`);
            }
            e.target.value = '';
        });

        document.querySelectorAll('.asis-status-btn[data-status]').forEach(btn => {
            btn.addEventListener('click', () => this.applyStatusToScope(btn.dataset.status));
        });

        document.querySelectorAll('.asis-scope-btn[data-scope]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.asis-scope-btn[data-scope]').forEach(b => b.classList.remove('asis-scope-active'));
                btn.classList.add('asis-scope-active');
                this.applyScope = btn.dataset.scope;
            });
        });

        document.getElementById('asis-btn-clear')?.addEventListener('click', () => this.clearStatusOnScope());
    },

    thinBorder() {
        const s = { style:'thin', color:{ argb:this.EXCEL_COLORS.black } };
        return { top:s, left:s, bottom:s, right:s };
    },

    statusFill(status) {
        if (status === 'cruce') return this.EXCEL_COLORS.cruce;
        if (status === 'iss') return this.EXCEL_COLORS.iss;
        if (status === 'descuento') return this.EXCEL_COLORS.descuento;
        return null;
    },

    normalizeArgb(color) {
        if (!color) return null;
        let argb = String(color.argb || color.rgb || '').toUpperCase().replace('#','');
        if (argb.length === 6) argb = `FF${argb}`;
        return argb || null;
    },

    statusFromFill(fill) {
        if (!fill || fill.type !== 'pattern') return null;
        const argb = this.normalizeArgb(fill.fgColor);
        if (!argb) return null;
        if (argb === this.EXCEL_COLORS.cruce || argb.endsWith('92D050')) return 'cruce';
        if (argb === this.EXCEL_COLORS.iss || argb.endsWith('FFFF00')) return 'iss';
        if (argb === this.EXCEL_COLORS.descuento || argb.endsWith('FF0000')) return 'descuento';
        return null;
    },

    cellText(value) {
        if (value == null || value === '') return '';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'object') {
            if (Array.isArray(value.richText)) return value.richText.map(t => t.text).join('').trim();
            if (value.result != null) return String(value.result).trim();
            if (value.text != null) return String(value.text).trim();
        }
        return String(value).trim();
    },

    applyExcelCellStyle(cell, { fillArgb, bold, rotation, align, fontColor }) {
        cell.border = this.thinBorder();
        cell.alignment = { vertical:'middle', horizontal:align||'center', wrapText:Boolean(rotation), textRotation:rotation||0 };
        cell.font = { name:'Arial', size:rotation?9:11, bold:Boolean(bold), color:fontColor?{argb:fontColor}:{argb:this.EXCEL_COLORS.black} };
        if (fillArgb) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:fillArgb } };
    },

    async exportToExcel() {
        if (typeof ExcelJS === 'undefined') throw new Error('ExcelJS no disponible');
        const { employees, dateColumns, byEmployee } = this;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Asistencia', { views:[{ state:'frozen', xSplit:2, ySplit:2 }] });
        const totalCols = 2 + dateColumns.length + 1;
        const titleRow = 1, headerRow = 2;

        sheet.mergeCells(titleRow, 1, titleRow, totalCols);
        const titleCell = sheet.getCell(titleRow, 1);
        titleCell.value = 'DETALLE DE HORAS O DIAS DE PERMISOS BOD DESPACHO';
        this.applyExcelCellStyle(titleCell, { fillArgb:this.EXCEL_COLORS.white, bold:true, align:'center' });
        sheet.getRow(titleRow).height = 22;

        const headers = ['#','Nombre de Empleados', ...dateColumns.map(c => c.label), 'OBSERVACIONES'];
        headers.forEach((text, idx) => {
            const col = idx + 1;
            const cell = sheet.getCell(headerRow, col);
            cell.value = text;
            const isDate = col >= 3 && col < totalCols;
            this.applyExcelCellStyle(cell, { fillArgb:this.EXCEL_COLORS.white, bold:true, rotation:isDate?90:0, align:col===2?'left':'center' });
        });
        sheet.getRow(headerRow).height = 118;
        sheet.getColumn(1).width = 5;
        sheet.getColumn(2).width = 32;
        for (let c = 3; c < totalCols; c++) sheet.getColumn(c).width = 5.5;
        sheet.getColumn(totalCols).width = 26;

        let rowNum = 3;
        employees.forEach((emp, index) => {
            const rowData = byEmployee[emp.id] || { observations:'', cells:{} };
            const isAlt = index % 2 === 0;
            const rowFill = isAlt ? this.EXCEL_COLORS.altRow : this.EXCEL_COLORS.white;

            const numCell = sheet.getCell(rowNum, 1);
            numCell.value = index + 1;
            this.applyExcelCellStyle(numCell, { fillArgb:rowFill, align:'center' });

            const nameCell = sheet.getCell(rowNum, 2);
            nameCell.value = emp.name;
            this.applyExcelCellStyle(nameCell, { fillArgb:rowFill, align:'left' });

            dateColumns.forEach((col, dateIdx) => {
                const cellData = rowData.cells?.[col.key] || { hours:'', status:null };
                const excelCol = 3 + dateIdx;
                const cell = sheet.getCell(rowNum, excelCol);
                cell.value = cellData.hours || '';
                const sc = this.statusFill(cellData.status);
                this.applyExcelCellStyle(cell, { fillArgb:sc||rowFill, align:'center', fontColor:cellData.status==='descuento'?this.EXCEL_COLORS.white:this.EXCEL_COLORS.black });
            });

            const obsCell = sheet.getCell(rowNum, totalCols);
            obsCell.value = rowData.observations || '';
            this.applyExcelCellStyle(obsCell, { fillArgb:rowFill, align:'left' });
            sheet.getRow(rowNum).height = 18;
            rowNum++;
        });

        const legendStart = rowNum + 1;
        [{ text:'CRUCE DE HORAS', status:'cruce' },{ text:'ISS 75%', status:'iss' },{ text:'DESCUENTO DE HORAS', status:'descuento' }].forEach((item, i) => {
            const r = legendStart + i;
            sheet.mergeCells(r, 1, r, 2);
            const cell = sheet.getCell(r, 1);
            cell.value = item.text;
            this.applyExcelCellStyle(cell, { fillArgb:this.statusFill(item.status), bold:true, align:'left', fontColor:item.status==='descuento'?this.EXCEL_COLORS.white:this.EXCEL_COLORS.black });
            sheet.getRow(r).height = 18;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `asistencia-${this.currentPeriodKey()}.xlsx`; a.click();
        URL.revokeObjectURL(url);
    },

    async importFromExcel(arrayBuffer) {
        if (typeof ExcelJS === 'undefined') throw new Error('ExcelJS no disponible');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const sheet = workbook.worksheets[0];
        if (!sheet) return null;

        let headerRow = 2;
        for (let r = 1; r <= Math.min(10, sheet.rowCount||10); r++) {
            const a = this.cellText(sheet.getCell(r,1).value).toLowerCase();
            const b = this.cellText(sheet.getCell(r,2).value).toLowerCase();
            if (a === '#' || b.includes('nombre')) { headerRow = r; break; }
        }

        const dataStart = headerRow + 1;
        const totalCols = 2 + this.dateColumns.length + 1;
        const employees = [];
        const byEmployee = {};

        const isLegendOrEmpty = (row) => {
            const a = this.cellText(sheet.getCell(row,1).value);
            const b = this.cellText(sheet.getCell(row,2).value);
            if (['CRUCE DE HORAS','ISS 75%','DESCUENTO DE HORAS'].some(h => a.includes(h)||b.includes(h))) return true;
            if (!a && !b) {
                return !Array.from({length:totalCols-2},(_,i) => sheet.getCell(row,3+i).value).some(v => v!=null && this.cellText(v)!=='');
            }
            return !b;
        };

        const maxRow = Math.max(sheet.rowCount||0, dataStart+100);
        for (let r = dataStart; r <= maxRow; r++) {
            if (isLegendOrEmpty(r)) { if (employees.length > 0) break; continue; }
            const name = this.cellText(sheet.getCell(r,2).value);
            if (!name) { if (employees.length > 0) break; continue; }
            const id = `import-${r}-${Date.now()}`;
            employees.push({ id, name });
            const cells = {};
            this.dateColumns.forEach((col, idx) => {
                const excelCell = sheet.getCell(r, 3+idx);
                cells[col.key] = { hours:this.cellText(excelCell.value), status:this.statusFromFill(excelCell.fill) };
            });
            byEmployee[id] = { observations:this.cellText(sheet.getCell(r,totalCols).value), cells };
        }

        if (employees.length === 0) return null;
        return { employees, byEmployee };
    }
};

window.Asistencia = Asistencia;
