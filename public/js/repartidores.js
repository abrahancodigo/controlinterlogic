// ===================================
// Repartidores Module - Gestión de repartidores
// Configuración de vehículo, zona, comisión
// ===================================

const Repartidores = {
    records: [],
    filteredRecords: [],
    currentSort: { field: 'nombre', direction: 'asc' },
    unsubscribe: null,

    async render() {
        if (window.innerWidth <= 768) return this.renderMobile();
        return this.renderDesktop();
    },

    async renderDesktop() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>🚛 Repartidores</h1>
                    <p>Gestión de repartidores, vehículos y comisiones</p>
                </div>
                <button class="btn btn-primary" id="rep-btn-add">➕ Nuevo Repartidor</button>
            </div>
            <div class="card">
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="cursor:pointer;" onclick="Repartidores.setSort('nombre')">Nombre <span class="sort-indicator" data-field="nombre"></span></th>
                                <th>Teléfono</th>
                                <th>Vehículo</th>
                                <th>Zona</th>
                                <th>Comisión %</th>
                                <th>Activo</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="rep-table-body">
                            <tr><td colspan="7" style="text-align:center;padding:2rem;">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('rep-btn-add').addEventListener('click', () => this.showForm());

        await this.loadRecords();
    },

    async loadRecords() {
        if (this.unsubscribe) this.unsubscribe();
        return new Promise((resolve) => {
            this.unsubscribe = firebase.firestore().collection('repartidores')
                .orderBy('nombre', 'asc')
                .onSnapshot(snap => {
                    this.records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    this.applySort();
                    resolve();
                }, err => {
                    console.error('Error loading repartidores:', err);
                    showToast('Error al cargar repartidores', 'error');
                    resolve();
                });
        });
    },

    applySort() {
        this.filteredRecords = [...this.records].sort((a, b) => {
            const va = String(a[this.currentSort.field] || '').toLowerCase();
            const vb = String(b[this.currentSort.field] || '').toLowerCase();
            const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
            return this.currentSort.direction === 'desc' ? -cmp : cmp;
        });
        if (this.isMobile) this.renderMobileCards();
        else this.renderTable();
    },

    setSort(field) {
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort = { field, direction: 'asc' };
        }
        document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
        const indicator = document.querySelector(`.sort-indicator[data-field="${field}"]`);
        if (indicator) indicator.textContent = this.currentSort.direction === 'asc' ? ' ▲' : ' ▼';
        this.applySort();
    },

    renderTable() {
        const body = document.getElementById('rep-table-body');
        if (!body) return;

        if (this.filteredRecords.length === 0) {
            body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">No hay repartidores. Crea uno.</td></tr>';
            return;
        }

        body.innerHTML = this.filteredRecords.map(r => `
            <tr>
                <td><strong>${sanitizeHTML(r.nombre || '')}</strong></td>
                <td>${r.telefono ? `<a href="tel:${r.telefono}" style="color:var(--primary-600)">${r.telefono}</a>` : '-'}</td>
                <td>${sanitizeHTML(r.vehiculo || '-')}</td>
                <td>${sanitizeHTML(r.zona || '-')}</td>
                <td><span class="badge badge-accent">${r.comisionPct ?? 70}%</span></td>
                <td>${r.activo !== false ? '<span style="color:#22c55e;">✓ Activo</span>' : '<span style="color:#ef4444;">✗ Inactivo</span>'}</td>
                <td class="actions-cell">
                    <button class="btn-icon btn-secondary" onclick="Repartidores.showForm('${r.id}')" title="Editar">✏️</button>
                    ${window.permissions?.canDelete ? `<button class="btn-icon btn-danger" onclick="Repartidores.deleteRecord('${r.id}')" title="Eliminar">🗑️</button>` : ''}
                </td>
            </tr>
        `).join('');
    },

    showForm(recordId = null) {
        const record = recordId ? this.records.find(r => r.id === recordId) : null;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h2 style="margin-bottom:1.5rem;">${record ? '✏️ Editar' : '➕ Nuevo'} Repartidor</h2>
                <form id="rep-form">
                    <div class="form-group">
                        <label>Nombre *</label>
                        <input type="text" id="rep-nombre" value="${sanitizeHTML(record?.nombre || '')}" required>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group">
                            <label>Teléfono</label>
                            <input type="text" id="rep-telefono" value="${record?.telefono || ''}">
                        </div>
                        <div class="form-group">
                            <label>Vehículo</label>
                            <input type="text" id="rep-vehiculo" value="${sanitizeHTML(record?.vehiculo || '')}" placeholder="Placa o modelo">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group">
                            <label>Zona Principal</label>
                            <input type="text" id="rep-zona" value="${sanitizeHTML(record?.zona || '')}">
                        </div>
                        <div class="form-group">
                            <label>Comisión (%)</label>
                            <input type="number" id="rep-comision" min="0" max="100" value="${record?.comisionPct ?? 70}">
                            <small>% del flete que recibe el repartidor</small>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;">
                        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                            <input type="checkbox" id="rep-activo" ${record?.activo !== false ? 'checked' : ''}>
                            Repartidor activo
                        </label>
                    </div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:2rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="rep-save-btn">💾 Guardar</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        document.getElementById('rep-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('rep-save-btn');
            setButtonLoading(btn, true);
            try {
                const nombre = document.getElementById('rep-nombre').value.trim();
                if (!nombre) { showToast('Nombre requerido', 'error'); setButtonLoading(btn, false); return; }

                const data = {
                    nombre,
                    telefono: document.getElementById('rep-telefono').value.trim(),
                    vehiculo: document.getElementById('rep-vehiculo').value.trim(),
                    zona: document.getElementById('rep-zona').value.trim(),
                    comisionPct: parseInt(document.getElementById('rep-comision').value) || 70,
                    activo: document.getElementById('rep-activo').checked,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                const db = firebase.firestore();
                if (recordId) {
                    await db.collection('repartidores').doc(recordId).update(data);
                    showToast('Repartidor actualizado', 'success');
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('repartidores').add(data);
                    showToast('Repartidor creado', 'success');
                }
                modal.remove();
            } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        });
    },

    async deleteRecord(id) {
        if (!await showConfirm('¿Eliminar este repartidor?', 'Esta acción no se puede deshacer.')) return;
        try {
            await firebase.firestore().collection('repartidores').doc(id).delete();
            this.records = this.records.filter(r => r.id !== id);
            this.applySort();
            showToast('Repartidor eliminado', 'success');
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
    },

    getAll() { return this.records || []; },

    // ==================== MOBILE ====================
    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        this.isMobile = true;
        contentArea.innerHTML = `
            <div style="padding:0 0 8px 0;"><h1 style="font-size:1.35rem;font-weight:800;">🚛 Repartidores</h1><p style="font-size:0.78rem;color:#8e8e93;">Gestión de repartidores</p></div>
            <div class="m-actions-bar"><button class="btn btn-primary" id="mrep-btn-add" style="border-radius:20px;">➕ Nuevo</button></div>
            <div class="m-data-list" id="mrep-list"><div style="text-align:center;padding:40px;color:#8e8e93;">Cargando...</div></div>
        `;
        document.getElementById('mrep-btn-add').addEventListener('click', () => this.showMobileForm());
        await this.loadRecords();
    },

    renderMobileCards() {
        const list = document.getElementById('mrep-list');
        if (!list) return;
        if (this.filteredRecords.length === 0) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">🚛</div><div class="m-empty-title">Sin repartidores</div></div>';
            return;
        }
        list.innerHTML = this.filteredRecords.map(r => `
            <div class="m-data-card" onclick="Repartidores.showMobileDetail('${r.id}')">
                <div class="m-card-header"><span class="m-card-title">${sanitizeHTML(r.nombre||'')}</span><span class="m-card-badge primary">${r.comisionPct??70}%</span></div>
                <div class="m-card-rows">
                    <div class="m-card-row"><span class="m-card-label">Vehículo</span><span class="m-card-value">${sanitizeHTML(r.vehiculo||'-')}</span></div>
                    <div class="m-card-row"><span class="m-card-label">Zona</span><span class="m-card-value">${sanitizeHTML(r.zona||'-')}</span></div>
                </div>
                ${window.permissions?.canEdit ? `<div class="m-card-actions" onclick="event.stopPropagation()"><button class="m-card-action" onclick="Repartidores.showMobileForm('${r.id}')">✏️</button>${window.permissions?.canDelete?`<button class="m-card-action delete" onclick="Repartidores.deleteRecord('${r.id}')">🗑️</button>`:''}</div>` : ''}
            </div>
        `).join('');
    },

    showMobileDetail(id) {
        const r = this.records.find(x => x.id === id); if (!r) return;
        const sheet = document.createElement('div');
        sheet.innerHTML = `<div class="m-sheet-backdrop show" onclick="this.nextElementSibling.remove();this.remove();"></div><div class="m-bottom-sheet show"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">${sanitizeHTML(r.nombre||'Repartidor')}</span><button class="m-sheet-close" onclick="this.closest('.m-bottom-sheet').remove();document.querySelector('.m-sheet-backdrop').remove();">✕</button></div><div class="m-sheet-body"><div style="display:flex;flex-direction:column;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;">Nombre</span><div style="font-weight:500;">${sanitizeHTML(r.nombre||'-')}</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;">Teléfono</span><div style="font-weight:500;">${r.telefono?`<a href="tel:${r.telefono}" style="color:#7c3aed;">${r.telefono}</a>`:'-'}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;">Vehículo</span><div style="font-weight:500;">${sanitizeHTML(r.vehiculo||'-')}</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;">Zona</span><div style="font-weight:500;">${sanitizeHTML(r.zona||'-')}</div></div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;">Comisión</span><div style="font-weight:700;color:#7c3aed;">${r.comisionPct??70}% del flete</div></div></div></div></div>`;
        document.body.appendChild(sheet);
    },

    showMobileForm(id) {
        const r = id ? this.records.find(x => x.id === id) : null;
        const sheet = document.createElement('div');
        sheet.innerHTML = `<div class="m-sheet-backdrop show" id="mrepf-backdrop"></div><div class="m-bottom-sheet show" id="mrepf-sheet"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">${r?'Editar':'Nuevo'} Repartidor</span><button class="m-sheet-close" onclick="document.getElementById('mrepf-sheet').remove();document.getElementById('mrepf-backdrop').remove();">✕</button></div><div class="m-sheet-body"><div class="m-form-group"><label>Nombre</label><input type="text" id="mrepf-nombre" value="${sanitizeHTML(r?.nombre||'')}"></div><div class="m-form-row"><div class="m-form-group"><label>Teléfono</label><input type="text" id="mrepf-telefono" value="${r?.telefono||''}"></div><div class="m-form-group"><label>Vehículo</label><input type="text" id="mrepf-vehiculo" value="${sanitizeHTML(r?.vehiculo||'')}"></div></div><div class="m-form-row"><div class="m-form-group"><label>Zona</label><input type="text" id="mrepf-zona" value="${sanitizeHTML(r?.zona||'')}"></div><div class="m-form-group"><label>Comisión %</label><input type="number" id="mrepf-comision" min="0" max="100" value="${r?.comisionPct??70}"></div></div><div class="m-form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;"><input type="checkbox" id="mrepf-activo" ${r?.activo!==false?'checked':''}> Activo</label></div></div><div class="m-sheet-footer"><button class="btn" onclick="document.getElementById('mrepf-sheet').remove();document.getElementById('mrepf-backdrop').remove();">Cancelar</button><button class="btn btn-primary" id="mrepf-submit">${r?'Guardar':'Crear'}</button></div></div>`;
        document.body.appendChild(sheet);

        document.getElementById('mrepf-submit').addEventListener('click', async function(){
            const btn = document.getElementById('mrepf-submit'); btn.disabled = true; btn.textContent = 'Guardando...';
            try {
                const data = { nombre: document.getElementById('mrepf-nombre').value, telefono: document.getElementById('mrepf-telefono').value, vehiculo: document.getElementById('mrepf-vehiculo').value, zona: document.getElementById('mrepf-zona').value, comisionPct: parseInt(document.getElementById('mrepf-comision').value)||70, activo: document.getElementById('mrepf-activo').checked };
                const db = firebase.firestore();
                if (r) await db.collection('repartidores').doc(id).update(data);
                else await db.collection('repartidores').add(data);
                showToast(r?'Actualizado':'Creado','success');
                document.getElementById('mrepf-sheet').remove(); document.getElementById('mrepf-backdrop').remove();
            } catch(err) { showToast('Error: '+err.message,'error'); btn.disabled=false; btn.textContent=r?'Guardar':'Crear'; }
        });
    }
};

window.Repartidores = Repartidores;
