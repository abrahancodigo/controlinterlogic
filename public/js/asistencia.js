/**
 * Módulo de Asistencia - Experiencia Excel Pro v13 (Gestión de Imágenes: Subida y Borrado)
 */
const Asistencia = {
    db: null,
    storage: null,
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    currentFortnight: new Date().getDate() <= 15 ? 1 : 2,
    
    dayWidth: 32, 
    filterText: '',
    
    data: {},
    observations: {},
    colors: {}, 
    images: {}, 
    employees: [],
    
    isSelecting: false,
    hasDragged: false,
    selectionStart: null,
    selectionEnd: null,
    selectedColor: '#fde047',
    
    async render() {
        this.db = firebase.firestore();
        this.storage = firebase.storage();
        const contentArea = document.getElementById('content-area');
        const isMobile = window.innerWidth <= 768;
        this.isMobile = isMobile;

        contentArea.innerHTML = `
            <div class="module-header" style="${isMobile ? 'flex-direction:column;align-items:stretch;gap:0.5rem;' : ''}">
                <div>
                    <h1 style="${isMobile ? 'font-size:1.35rem;font-weight:800;' : ''}">📅 Control de Asistencia Pro</h1>
                    <p style="${isMobile ? 'font-size:0.78rem;' : ''}">Gestiona horas, colores y adjuntos.</p>
                </div>
                ${isMobile ? '' : ''}
            </div>

            <div class="filters-card" style="${isMobile ? 'padding:0.75rem;border-radius:var(--m-radius);background:white;margin-bottom:0.75rem;' : ''}">
                <div class="filters-grid" style="${isMobile ? 'display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;' : ''}">
                    <div class="filter-group" style="${isMobile ? 'grid-column:1/-1;' : ''}">
                        <label style="${isMobile ? 'font-size:0.7rem;' : ''}">Buscar Empleado</label>
                        <input type="text" id="asis-search" placeholder="Filtrar por nombre..." style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 5px;${isMobile ? 'min-height:40px;font-size:0.9rem;' : ''}">
                    </div>
                    <div class="filter-group">
                        <label style="${isMobile ? 'font-size:0.7rem;' : ''}">Ancho (<span id="width-val">${this.dayWidth}</span>px)</label>
                        <input type="range" id="asis-width-slider" min="20" max="80" value="${this.dayWidth}" style="width: 100%;">
                    </div>
                    <div class="filter-group">
                        <label style="${isMobile ? 'font-size:0.7rem;' : ''}">Periodo</label>
                        <div style="display: flex; gap: 5px;">
                            <select id="asis-month" style="${isMobile ? 'min-height:40px;font-size:0.85rem;flex:1;' : ''}">${this.getMonthsOptions()}</select>
                            <select id="asis-fortnight" style="${isMobile ? 'min-height:40px;font-size:0.85rem;flex:1;' : ''}">
                                <option value="1" ${this.currentFortnight === 1 ? 'selected' : ''}>Q1</option>
                                <option value="2" ${this.currentFortnight === 2 ? 'selected' : ''}>Q2</option>
                            </select>
                        </div>
                    </div>
                    <div class="filter-group">
                        <label style="${isMobile ? 'font-size:0.7rem;' : ''}">Color</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="color" id="asis-color-picker" value="${this.selectedColor}" style="width: 40px; height: 35px; border: none; padding: 0;">
                            <button id="apply-color-btn" class="btn btn-primary" style="display:none; padding: 8px 12px; ${isMobile ? 'min-height:36px;font-size:0.75rem;' : ''}">Pintar</button>
                            <button id="clear-color-btn" class="btn btn-outline" style="display:none; padding: 8px 12px; ${isMobile ? 'min-height:36px;font-size:0.75rem;' : ''}">Borrar</button>
                        </div>
                    </div>
                </div>
                <div class="filter-actions" style="margin-top: 15px; display: flex; gap: 10px; ${isMobile ? 'flex-wrap:wrap;' : ''}">
                    <button id="add-employee-btn" class="btn btn-secondary" style="${isMobile ? 'flex:1;min-height:40px;font-size:0.8rem;border-radius:10px;' : ''}">+ Nuevo Empleado</button>
                    <button id="export-excel-btn" class="btn btn-outline" style="${isMobile ? 'flex:1;min-height:40px;font-size:0.8rem;border-radius:10px;' : ''}">📊 Excel</button>
                </div>
            </div>

            <div class="card table-container-asis" style="overflow: auto; margin-top: 15px; padding: 0; max-height: ${isMobile ? '60vh' : '70vh'}; border: 1px solid #cbd5e1; ${isMobile ? 'border-radius:var(--m-radius);box-shadow:none;' : ''}">
                <table class="excel-table" id="attendance-table" style="${isMobile ? 'font-size:0.7rem;' : ''}">
                    <thead><tr id="table-header-days"></tr></thead>
                    <tbody id="table-body-employees"></tbody>
                </table>
            </div>

            <!-- Visor de Imagen Full -->
            <div id="asis-img-modal" class="modal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); align-items: center; justify-content: center; cursor: zoom-out;" onclick="this.style.display='none'">
                <img id="asis-img-full" style="max-width: 90%; max-height: 90%; border-radius: 8px;">
            </div>

            <style>
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
                .excel-table { border-collapse: collapse; font-family: 'Inter', sans-serif; font-size: 0.8rem; background: white; user-select: none; table-layout: auto; width: max-content; min-width: 100%; }
                .excel-table th, .excel-table td { border: 1px solid #94a3b8; padding: 0; text-align: center; height: 35px; position: relative; }
                .excel-table th { background: #f1f5f9; font-weight: 700; color: #1e293b; position: sticky; top: 0; z-index: 10; }
                .day-col { width: var(--col-width, 32px); min-width: var(--col-width, 32px); max-width: var(--col-width, 32px); }
                .emp-name-col { width: auto; min-width: 150px; text-align: left; padding: 0 15px !important; position: sticky; left: 0; background: white; z-index: 11; box-shadow: 2px 0 4px rgba(0,0,0,0.1); white-space: nowrap; cursor: cell; }
                .excel-table th.emp-name-col { background: #cbd5e1; z-index: 12; height: 110px; }
                .day-name-vert { writing-mode: vertical-rl; transform: rotate(180deg); display: inline-block; font-size: 0.7rem; color: #475569; margin-bottom: 3px; }
                .day-number { display: block; font-size: 0.95rem; font-weight: 700; }
                .asis-input, .obs-input { width: 100%; height: 100%; border: none; text-align: center; outline: none; background: transparent; font-size: 0.8rem; pointer-events: none; }
                .obs-input { text-align: left; padding: 0 8px; min-width: 200px; }
                .asis-input:focus, .obs-input:focus { pointer-events: auto !important; background: white !important; box-shadow: inset 0 0 0 2px #2563eb; }
                .cell-selected { background-color: rgba(59, 130, 246, 0.3) !important; box-shadow: inset 0 0 0 2px #2563eb; }
                .row-total { font-weight: bold; background: #f8fafc; min-width: 50px; padding: 0 5px; cursor: cell; }
                .day-weekend { background: #fee2e2 !important; }
                ${this.isMobile ? `
                .excel-table { font-size: 0.65rem !important; }
                .excel-table th, .excel-table td { height: 30px !important; }
                .day-col { width: var(--col-width, 28px) !important; min-width: var(--col-width, 28px) !important; max-width: var(--col-width, 28px) !important; }
                .emp-name-col { min-width: 110px !important; padding: 0 8px !important; font-size: 0.7rem !important; }
                .excel-table th.emp-name-col { height: 80px !important; }
                .day-name-vert { font-size: 0.55rem !important; }
                .day-number { font-size: 0.75rem !important; }
                .row-total { min-width: 35px !important; font-size: 0.65rem !important; }
                .asis-input, .obs-input { font-size: 0.7rem !important; }
                .obs-input { min-width: 120px !important; font-size: 0.65rem !important; }
                ` : ''}
                @media (hover: none) {
                    .excel-table { -webkit-overflow-scrolling: touch; }
                    .asis-input:focus, .obs-input:focus { pointer-events: auto !important; }
                }
                .col-obs { width: auto; min-width: 200px; padding: 0 !important; cursor: cell; }
                
                /* IMÁGENES Y BORRADO */
                .col-images { min-width: 100px; padding: 2px 5px !important; }
                .img-list { display: flex; gap: 4px; overflow-x: auto; max-width: 120px; align-items: center; height: 30px; }
                .img-item { position: relative; width: 28px; height: 28px; flex-shrink: 0; }
                .img-thumb { width: 100%; height: 100%; border-radius: 4px; object-fit: cover; cursor: pointer; border: 1px solid #cbd5e1; }
                .btn-del-img { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border-radius: 50%; width: 14px; height: 14px; font-size: 10px; display: none; align-items: center; justify-content: center; cursor: pointer; border: 1px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
                .img-item:hover .btn-del-img { display: flex; }
                .add-img-btn { font-size: 1.2rem; cursor: pointer; color: #64748b; margin-left: 5px; }
                .delete-emp { color: #ef4444; cursor: pointer; border: none; background: none; font-size: 1.1rem; padding: 0 10px; pointer-events: auto; }
            </style>
        `;

        this.setupEventListeners();
        await this.loadData();
    },

    setupEventListeners() {
        document.getElementById('asis-search').oninput = (e) => { this.filterText = e.target.value.toLowerCase(); this.renderTableBody(); };
        const slider = document.getElementById('asis-width-slider');
        slider.oninput = (e) => {
            this.dayWidth = e.target.value;
            document.getElementById('width-val').textContent = this.dayWidth;
            document.getElementById('attendance-table').style.setProperty('--col-width', this.dayWidth + 'px');
        };
        document.getElementById('asis-month').onchange = (e) => { this.currentMonth = parseInt(e.target.value); this.loadData(); };
        document.getElementById('asis-fortnight').onchange = (e) => { this.currentFortnight = parseInt(e.target.value); this.loadData(); };
        document.getElementById('asis-color-picker').onchange = (e) => this.selectedColor = e.target.value;
        document.getElementById('apply-color-btn').onclick = () => this.applyColorToSelection(this.selectedColor);
        document.getElementById('clear-color-btn').onclick = () => this.applyColorToSelection('');
        document.getElementById('add-employee-btn').onclick = () => this.addNewEmployee();
        document.getElementById('export-excel-btn').onclick = () => this.exportToExcel();
        document.addEventListener('mouseup', () => { if (this.isSelecting) { this.isSelecting = false; this.showColorButtons(true); } });
    },

    showColorButtons(show) {
        const hasSel = document.querySelector('.cell-selected');
        const display = (show && hasSel) ? 'inline-block' : 'none';
        document.getElementById('apply-color-btn').style.display = display;
        document.getElementById('clear-color-btn').style.display = display;
    },

    async loadData() {
        const loading = document.getElementById('loading-screen');
        if (loading) loading.style.display = 'flex';
        try {
            const periodId = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-Q${this.currentFortnight}`;
            const empSnap = await this.db.collection('empleados').orderBy('nombre').get();
            this.employees = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const asisDoc = await this.db.collection('asistencia').doc(periodId).get();
            const docData = asisDoc.exists ? asisDoc.data() : {};
            this.data = docData.records || {};
            this.observations = docData.observations || {};
            this.colors = docData.colors || {};
            this.images = docData.images || {};
            this.renderTable();
        } catch (e) { console.error(e); }
        finally { if (loading) loading.style.display = 'none'; }
    },

    renderTable() {
        const headerRow = document.getElementById('table-header-days');
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const startDay = this.currentFortnight === 1 ? 1 : 16;
        const endDay = this.currentFortnight === 1 ? 15 : daysInMonth;
        const numDays = (endDay - startDay + 1);
        let headerHtml = `<th class="emp-name-col">Empleado</th>`;
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        for (let d = startDay; d <= endDay; d++) {
            const date = new Date(this.currentYear, this.currentMonth, d);
            headerHtml += `<th class="th-day day-col ${date.getDay() % 6 === 0 ? 'day-weekend' : ''}" onclick="Asistencia.selectColumn(${d - startDay + 1})">
                <span class="day-name-vert">${dayNames[date.getDay()]}</span><br><span class="day-number">${d}</span></th>`;
        }
        headerHtml += `<th onclick="Asistencia.selectColumn(${numDays + 1})">Total</th><th class="col-obs" onclick="Asistencia.selectColumn(${numDays + 2})">Obs.</th><th class="col-images">Fotos</th><th></th>`;
        headerRow.innerHTML = headerHtml;
        document.getElementById('attendance-table').style.setProperty('--col-width', this.dayWidth + 'px');
        this.renderTableBody();
    },

    renderTableBody() {
        const body = document.getElementById('table-body-employees');
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const startDay = this.currentFortnight === 1 ? 1 : 16;
        const endDay = this.currentFortnight === 1 ? 15 : daysInMonth;
        const numDays = (endDay - startDay + 1);
        const filtered = this.employees.filter(e => e.nombre.toLowerCase().includes(this.filterText));
        
        body.innerHTML = '';
        filtered.forEach((emp, r) => {
            const empCols = this.colors[emp.id] || {};
            const empImages = this.images[emp.id] || [];
            let rowHtml = `<tr data-emp-id="${emp.id}">
                <td class="emp-name-col" id="cell-${r}-0" style="background-color: ${empCols.name || ''}"
                    onmousedown="Asistencia.startSelection(${r}, 0, event)" onmouseenter="Asistencia.updateSelection(${r}, 0)">${emp.nombre}</td>`;
            
            let rowTotal = 0;
            for (let i = 0; i < numDays; i++) {
                const d = startDay + i; const c = i + 1;
                const val = this.data[emp.id]?.[d] || ''; rowTotal += parseFloat(val) || 0;
                rowHtml += `<td class="day-col ${new Date(this.currentYear, this.currentMonth, d).getDay() % 6 === 0 ? 'day-weekend' : ''}" id="cell-${r}-${c}" 
                                style="background-color: ${empCols[d] || ''}" onmousedown="Asistencia.startSelection(${r}, ${c}, event)" 
                                onmouseenter="Asistencia.updateSelection(${r}, ${c})" onclick="Asistencia.activateInput(this)">
                                <input type="number" class="asis-input" value="${val}" onchange="Asistencia.saveValue('${emp.id}', ${d}, this.value)" onblur="Asistencia.deactivateInput(this)"></td>`;
            }
            
            rowHtml += `<td class="row-total" id="cell-${r}-${numDays + 1}" style="background-color: ${empCols.total || ''}"
                            onmousedown="Asistencia.startSelection(${r}, ${numDays + 1}, event)" onmouseenter="Asistencia.updateSelection(${r}, ${numDays + 1})">
                            <span class="total-val" data-emp-id="${emp.id}">${Math.round(rowTotal * 100) / 100}</span></td>
                <td class="col-obs" id="cell-${r}-${numDays + 2}" style="background-color: ${empCols.obs || ''}"
                    onmousedown="Asistencia.startSelection(${r}, ${numDays + 2}, event)" onmouseenter="Asistencia.updateSelection(${r}, ${numDays + 2})"
                    onclick="Asistencia.activateInput(this)">
                    <input type="text" class="obs-input" value="${sanitizeHTML(this.observations[emp.id] || '')}" onchange="Asistencia.saveObservation('${emp.id}', this.value)" onblur="Asistencia.deactivateInput(this)"></td>
                <td class="col-images">
                    <div class="img-list">
                        ${empImages.map((url, idx) => `
                            <div class="img-item">
                                <img src="${url}" class="img-thumb" onclick="Asistencia.showFullImage('${url}')">
                                <span class="btn-del-img" onclick="Asistencia.deleteImage('${emp.id}', ${idx}, '${url}')">×</span>
                            </div>
                        `).join('')}
                        <span class="add-img-btn" onclick="Asistencia.uploadImage('${emp.id}')">📸</span>
                    </div>
                </td>
                <td><button class="delete-emp" onclick="Asistencia.removeEmployee('${emp.id}', '${emp.nombre}')">×</button></td></tr>`;
            body.innerHTML += rowHtml;
        });
    },

    async uploadImage(empId) {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0]; if (!file) return;
            showToast("Subiendo imagen...");
            try {
                const periodId = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-Q${this.currentFortnight}`;
                const ref = this.storage.ref(`asistencia/${periodId}/${empId}_${Date.now()}`);
                await ref.put(file);
                const url = await ref.getDownloadURL();
                if (!this.images[empId]) this.images[empId] = [];
                this.images[empId].push(url);
                await this.db.collection('asistencia').doc(periodId).set({ images: this.images }, { merge: true });
                showToast("¡Subida!"); this.renderTableBody();
            } catch (err) { showToast("Error", "error"); }
        };
        input.click();
    },

    async deleteImage(empId, index, url) {
        if (!confirm("¿Deseas eliminar esta foto?")) return;
        showToast("Eliminando...");
        try {
            const periodId = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-Q${this.currentFortnight}`;
            // 1. Borrar de Storage
            try { await this.storage.refFromURL(url).delete(); } catch(e) { console.warn("Storage error o ya borrado"); }
            // 2. Borrar de Firestore
            this.images[empId].splice(index, 1);
            await this.db.collection('asistencia').doc(periodId).set({ images: this.images }, { merge: true });
            showToast("Eliminada"); this.renderTableBody();
        } catch (err) { showToast("Error al borrar", "error"); }
    },

    showFullImage(url) {
        const modal = document.getElementById('asis-img-modal');
        const img = document.getElementById('asis-img-full');
        img.src = url; modal.style.display = 'flex';
    },

    activateInput(td) { if (!this.hasDragged) { const input = td.querySelector('input'); if (input) { input.style.pointerEvents = 'auto'; input.focus(); input.select(); } } },
    deactivateInput(input) { input.style.pointerEvents = 'none'; },
    selectColumn(c) {
        this.clearSelectionVisuals(); this.selectionStart = { r: 0, c: c };
        const trs = document.querySelectorAll('#table-body-employees tr');
        this.selectionEnd = { r: trs.length - 1, c: c }; this.updateVisuals(); this.showColorButtons(true);
    },
    startSelection(r, c, event) { this.isSelecting = true; this.hasDragged = false; this.selectionStart = { r, c }; this.selectionEnd = { r, c }; this.updateVisuals(); this.showColorButtons(false); },
    updateSelection(r, c) { if (this.isSelecting) { this.hasDragged = true; this.selectionEnd = { r, c }; this.updateVisuals(); } },
    updateVisuals() {
        this.clearSelectionVisuals(); if (!this.selectionStart || !this.selectionEnd) return;
        const r1 = Math.min(this.selectionStart.r, this.selectionEnd.r), r2 = Math.max(this.selectionStart.r, this.selectionEnd.r);
        const c1 = Math.min(this.selectionStart.c, this.selectionEnd.c), c2 = Math.max(this.selectionStart.c, this.selectionEnd.c);
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) document.getElementById(`cell-${r}-${c}`)?.classList.add('cell-selected');
    },
    clearSelectionVisuals() { document.querySelectorAll('.cell-selected').forEach(el => el.classList.remove('cell-selected')); },

    async applyColorToSelection(color) {
        if (!this.selectionStart || !this.selectionEnd) return;
        const r1 = Math.min(this.selectionStart.r, this.selectionEnd.r), r2 = Math.max(this.selectionStart.r, this.selectionEnd.r);
        const c1 = Math.min(this.selectionStart.c, this.selectionEnd.c), c2 = Math.max(this.selectionStart.c, this.selectionEnd.c);
        const startDay = this.currentFortnight === 1 ? 1 : 16;
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const numDays = (this.currentFortnight === 1 ? 15 : daysInMonth - 15);
        const pId = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-Q${this.currentFortnight}`;
        const updates = {};
        for (let r = r1; r <= r2; r++) {
            const tr = document.querySelectorAll('#table-body-employees tr')[r]; if (!tr) continue;
            const empId = tr.dataset.empId; if (!this.colors[empId]) this.colors[empId] = {};
            for (let c = c1; c <= c2; c++) {
                let key;
                if (c === 0) key = 'name'; else if (c >= 1 && c <= numDays) key = startDay + c - 1;
                else if (c === numDays + 1) key = 'total'; else if (c === numDays + 2) key = 'obs'; else continue;
                const path = `colors.${empId}.${key}`;
                if (color === '') { delete this.colors[empId][key]; updates[path] = firebase.firestore.FieldValue.delete(); }
                else { this.colors[empId][key] = color; updates[path] = color; }
                const cell = document.getElementById(`cell-${r}-${c}`); if (cell) cell.style.backgroundColor = color;
            }
        }
        try {
            await this.db.collection('asistencia').doc(pId).update(updates).catch(async (e) => {
                if (e.code === 'not-found') await this.db.collection('asistencia').doc(pId).set({ colors: this.colors }, { merge: true });
            });
            this.clearSelectionVisuals(); this.showColorButtons(false);
        } catch (e) { console.error(e); }
    },

    async saveValue(id, d, v) {
        if (!this.data[id]) this.data[id] = {}; v === "" ? delete this.data[id][d] : this.data[id][d] = v;
        const pId = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-Q${this.currentFortnight}`;
        await this.db.collection('asistencia').doc(pId).set({ records: this.data }, { merge: true });
        this.updateRowTotal(id);
    },

    async saveObservation(id, v) {
        this.observations[id] = v;
        const pId = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-Q${this.currentFortnight}`;
        await this.db.collection('asistencia').doc(pId).set({ observations: this.observations }, { merge: true });
    },

    updateRowTotal(id) {
        let t = 0; if (this.data[id]) Object.values(this.data[id]).forEach(v => t += parseFloat(v) || 0);
        const el = document.querySelector(`.total-val[data-emp-id="${id}"]`);
        if (el) el.textContent = Math.round(t * 100) / 100;
    },

    getMonthsOptions() { return ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => `<option value="${i}" ${this.currentMonth === i ? 'selected' : ''}>${m}</option>`).join(''); },
    getYearsOptions() { let o = ''; for (let y = 2024; y <= new Date().getFullYear() + 1; y++) o += `<option value="${y}" ${this.currentYear === y ? 'selected' : ''}>${y}</option>`; return o; },
    async addNewEmployee() {
        const n = prompt("Nombre:"); if (n) { await this.db.collection('empleados').add({ nombre: n.trim(), createdAt: firebase.firestore.FieldValue.serverTimestamp() }); this.loadData(); }
    },
    async removeEmployee(id, n) { if (confirm(`¿Eliminar a ${n}?`)) { await this.db.collection('empleados').doc(id).delete(); this.loadData(); } },

    async exportToExcel() {
        const loading = document.getElementById('loading-screen'); if (loading) loading.style.display = 'flex';
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Asistencia');
            const monthName = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][this.currentMonth];
            worksheet.getCell('A1').value = `AÑO: ${this.currentYear}`; worksheet.getCell('A2').value = `MES: ${monthName}`;
            worksheet.getCell('A3').value = `QUINCENA: ${this.currentFortnight === 1 ? '1ra' : '2da'}`;
            [1, 2, 3].forEach(r => { worksheet.getCell(`A${r}`).font = { bold: true }; });
            const startDay = this.currentFortnight === 1 ? 1 : 16;
            const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
            const endDay = this.currentFortnight === 1 ? 15 : daysInMonth;
            const numDays = (endDay - startDay + 1);
            const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
            const row5 = worksheet.getRow(5); const row6 = worksheet.getRow(6);
            row5.getCell(1).value = 'Empleado'; worksheet.mergeCells('A5:A6');
            for (let i = 0; i < numDays; i++) {
                const day = startDay + i; const date = new Date(this.currentYear, this.currentMonth, day);
                const colIdx = i + 2;
                row5.getCell(colIdx).value = dayNamesShort[date.getDay()]; row6.getCell(colIdx).value = day;
                row5.getCell(colIdx).alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center' };
                if (date.getDay() === 0 || date.getDay() === 6) {
                    const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE2E2' } };
                    row5.getCell(colIdx).fill = fill; row6.getCell(colIdx).fill = fill;
                }
            }
            const totalCol = numDays + 2; const obsCol = numDays + 3;
            row5.getCell(totalCol).value = 'Total'; worksheet.mergeCells(5, totalCol, 6, totalCol);
            row5.getCell(obsCol).value = 'Observaciones'; worksheet.mergeCells(5, obsCol, 6, obsCol);
            this.employees.forEach((emp, rIdx) => {
                const row = worksheet.getRow(rIdx + 7); const empCols = this.colors[emp.id] || {};
                row.getCell(1).value = emp.nombre; if (empCols.name) this.applyExcelColor(row.getCell(1), empCols.name);
                let t = 0;
                for (let i = 0; i < numDays; i++) {
                    const d = startDay + i; const v = parseFloat(this.data[emp.id]?.[d]) || 0;
                    row.getCell(i + 2).value = v || ''; t += v;
                    if (empCols[d]) this.applyExcelColor(row.getCell(i + 2), empCols[d]);
                }
                row.getCell(totalCol).value = Math.round(t * 100) / 100; if (empCols.total) this.applyExcelColor(row.getCell(totalCol), empCols.total);
                row.getCell(obsCol).value = this.observations[emp.id] || ''; if (empCols.obs) this.applyExcelColor(row.getCell(obsCol), empCols.obs);
                row.eachCell(c => { c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }; });
            });
            worksheet.getColumn(1).width = 30; worksheet.getColumn(obsCol).width = 40;
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `Asistencia_${monthName}_${this.currentYear}.xlsx`; a.click();
        } catch (e) { console.error(e); } finally { if (loading) loading.style.display = 'none'; }
    },

    applyExcelColor(cell, hex) {
        if (!hex || hex === '') return;
        const argb = 'FF' + hex.replace('#', '').toUpperCase();
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } };
    }
};

window.Asistencia = Asistencia;
