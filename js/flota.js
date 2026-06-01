const Flota = {
    vehiculos: [],
    mantenimientos: [],
    ordenesTrabajo: [],
    proveedores: [],
    currentView: 'vehiculos',
    unsubscribeVehiculos: null,
    unsubscribeMantenimientos: null,
    unsubscribeOT: null,
    unsubscribeProveedores: null,
    selectedVehiculoId: null,
    _dataLoaded: false,

    destroy() {
        [this.unsubscribeVehiculos, this.unsubscribeMantenimientos,
         this.unsubscribeOT, this.unsubscribeProveedores].forEach(function(fn) {
            if (typeof fn === 'function') fn();
        });
        this.unsubscribeVehiculos = this.unsubscribeMantenimientos =
            this.unsubscribeOT = this.unsubscribeProveedores = null;
        this._dataLoaded = false;
    },

    async render() {
        if (window.innerWidth <= 768) return this.renderMobile();
        return this.renderDesktop();
    },

    async renderDesktop() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>🚛 Flota y Mantenimiento</h1>
                    <p>Gestión de vehículos, mantenimientos, órdenes de trabajo y talleres</p>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn ${this.currentView==='vehiculos'?'btn-primary':'btn-secondary'}" id="fl-tab-vehiculos">🚛 Vehículos</button>
                    <button class="btn ${this.currentView==='mantenimiento'?'btn-primary':'btn-secondary'}" id="fl-tab-mantenimiento">🔧 Mantenimiento</button>
                    <button class="btn ${this.currentView==='ordenes'?'btn-primary':'btn-secondary'}" id="fl-tab-ordenes">📄 Órdenes de Trabajo</button>
                    <button class="btn ${this.currentView==='talleres'?'btn-primary':'btn-secondary'}" id="fl-tab-talleres">🏪 Talleres</button>
                </div>
            </div>
            <div id="flota-content">
                <div style="text-align:center;padding:2rem;">Cargando datos...</div>
            </div>
        `;

        document.getElementById('fl-tab-vehiculos').addEventListener('click', () => { this.currentView='vehiculos'; this.renderDesktop(); });
        document.getElementById('fl-tab-mantenimiento').addEventListener('click', () => { this.currentView='mantenimiento'; this.renderDesktop(); });
        document.getElementById('fl-tab-ordenes').addEventListener('click', () => { this.currentView='ordenes'; this.renderDesktop(); });
        document.getElementById('fl-tab-talleres').addEventListener('click', () => { this.currentView='talleres'; this.renderDesktop(); });

        if (!this._dataLoaded) {
            await this.loadData();
            this._dataLoaded = true;
        }
        this.renderCurrentView();
    },

    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div style="padding:0.5rem;">
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:1rem;">
                    <button class="btn ${this.currentView==='vehiculos'?'btn-primary':'btn-secondary'}" id="fl-tab-vehiculos-m" style="font-size:0.8rem;padding:0.4rem 0.6rem;">🚛 Vehículos</button>
                    <button class="btn ${this.currentView==='mantenimiento'?'btn-primary':'btn-secondary'}" id="fl-tab-mantenimiento-m" style="font-size:0.8rem;padding:0.4rem 0.6rem;">🔧 Manto</button>
                    <button class="btn ${this.currentView==='ordenes'?'btn-primary':'btn-secondary'}" id="fl-tab-ordenes-m" style="font-size:0.8rem;padding:0.4rem 0.6rem;">📄 OT</button>
                    <button class="btn ${this.currentView==='talleres'?'btn-primary':'btn-secondary'}" id="fl-tab-talleres-m" style="font-size:0.8rem;padding:0.4rem 0.6rem;">🏪 Talleres</button>
                </div>
                <div id="flota-content-mobile">
                    <div style="text-align:center;padding:1rem;">Cargando...</div>
                </div>
            </div>
        `;
        document.getElementById('fl-tab-vehiculos-m').addEventListener('click', () => { this.currentView='vehiculos'; this.renderMobile(); });
        document.getElementById('fl-tab-mantenimiento-m').addEventListener('click', () => { this.currentView='mantenimiento'; this.renderMobile(); });
        document.getElementById('fl-tab-ordenes-m').addEventListener('click', () => { this.currentView='ordenes'; this.renderMobile(); });
        document.getElementById('fl-tab-talleres-m').addEventListener('click', () => { this.currentView='talleres'; this.renderMobile(); });

        if (!this._dataLoaded) {
            await this.loadData();
            this._dataLoaded = true;
        }
        this.renderCurrentViewMobile();
    },

    async loadData() {
        const db = firebase.firestore();
        return new Promise((resolve) => {
            const loaded = new Set();
            const total = 4;
            const checkDone = (name) => {
                loaded.add(name);
                if (loaded.size >= total) resolve();
            };

            if (this.unsubscribeVehiculos) this.unsubscribeVehiculos();
            this.unsubscribeVehiculos = db.collection('vehiculos')
                .orderBy('nombre', 'asc')
                .onSnapshot(snap => {
                    this.vehiculos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    this._vehiculosById = {};
                    for (var i = 0; i < this.vehiculos.length; i++) { this._vehiculosById[this.vehiculos[i].id] = this.vehiculos[i]; }
                    checkDone('vehiculos');
                }, err => { console.error('Error loading vehiculos:', err); checkDone('vehiculos'); });

            if (this.unsubscribeMantenimientos) this.unsubscribeMantenimientos();
            this.unsubscribeMantenimientos = db.collection('mantenimientos')
                .orderBy('fecha', 'desc').limit(200)
                .onSnapshot(snap => {
                    this.mantenimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    checkDone('mantenimientos');
                }, err => { console.error('Error loading mantenimientos:', err); checkDone('mantenimientos'); });

            if (this.unsubscribeOT) this.unsubscribeOT();
            this.unsubscribeOT = db.collection('ordenesTrabajo')
                .orderBy('fecha', 'desc').limit(200)
                .onSnapshot(snap => {
                    this.ordenesTrabajo = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    checkDone('ordenes');
                }, err => { console.error('Error loading OT:', err); checkDone('ordenes'); });

            if (this.unsubscribeProveedores) this.unsubscribeProveedores();
            this.unsubscribeProveedores = db.collection('proveedores')
                .orderBy('nombre', 'asc')
                .onSnapshot(snap => {
                    this.proveedores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    checkDone('proveedores');
                }, err => { console.error('Error loading proveedores:', err); checkDone('proveedores'); });
        });
    },

    renderCurrentView() {
        const container = document.getElementById('flota-content');
        if (!container) return;
        if (this.currentView === 'vehiculos') this.renderVehiculos();
        else if (this.currentView === 'mantenimiento') this.renderMantenimiento();
        else if (this.currentView === 'ordenes') this.renderOrdenesTrabajo();
        else if (this.currentView === 'talleres') this.renderTalleres();
    },

    renderCurrentViewMobile() {
        const container = document.getElementById('flota-content-mobile');
        if (!container) return;
        if (this.currentView === 'vehiculos') this.renderVehiculosMobile();
        else if (this.currentView === 'mantenimiento') this.renderMantenimientoMobile();
        else if (this.currentView === 'ordenes') this.renderOrdenesMobile();
        else if (this.currentView === 'talleres') this.renderTalleresMobile();
    },

    // ========== VEHICULOS ==========
    renderVehiculos() {
        const container = document.getElementById('flota-content');
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;

        const alertas = this.vehiculos.filter(v => {
            if (!v.fechaVencimientoCirculacion) return false;
            const dias = this.diasParaVencimiento(v.fechaVencimientoCirculacion);
            return dias <= 30;
        });

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <div>
                    <h2 style="margin:0;">🚛 Flota de Vehículos</h2>
                    <span style="font-size:0.85rem;color:var(--text-secondary);">${this.vehiculos.length} vehículos registrados</span>
                </div>
                ${canEdit ? `<button class="btn btn-primary" id="btn-nuevo-vehiculo">+ Nuevo Vehículo</button>` : ''}
            </div>
            ${alertas.length > 0 ? `
            <div class="card" style="background:#fef3c7;border:1px solid #f59e0b;margin-bottom:1rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span style="font-size:1.2rem;">⚠️</span>
                    <strong>Alertas de Vencimiento:</strong>
                    ${alertas.map(v => {
                        const dias = this.diasParaVencimiento(v.fechaVencimientoCirculacion);
                        return `<span class="badge ${dias <= 0 ? 'badge-error' : 'badge-warning'}" style="margin-left:0.3rem;">${v.nombre} (${dias <= 0 ? 'VENCIDA' : dias + ' días'})</span>`;
                    }).join('')}
                </div>
            </div>` : ''}

            <div class="table-container">
                <table class="data-table" id="vehiculos-table">
                    <thead>
                        <tr>
                            <th>Vehículo</th>
                            <th>Placa</th>
                            <th>Tipo</th>
                            <th>Capacidad</th>
                            <th>Combustible</th>
                            <th>Kilometraje</th>
                            <th>Venc. Circulación</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="vehiculos-table-body">
                        ${this.vehiculos.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:2rem;">No hay vehículos registrados</td></tr>' :
                        this.vehiculos.map(v => {
                            const dias = this.diasParaVencimiento(v.fechaVencimientoCirculacion);
                            const vencClase = dias <= 0 ? 'badge-error' : (dias <= 30 ? 'badge-warning' : 'badge-success');
                            const vencTexto = dias <= 0 ? 'VENCIDA' : (dias === 9999 ? 'Sin fecha' : `${dias} días`);
                            const estadoBadge = v.estado === 'activo' ? 'badge-success' : (v.estado === 'en_mantenimiento' ? 'badge-warning' : 'badge-error');
                            return `<tr class="vehiculo-row" data-id="${v.id}" style="cursor:pointer;">
                                <td><strong>${this.sanitize(v.nombre || '')}</strong></td>
                                <td>${this.sanitize(v.numeroPlaca || '-')}</td>
                                <td><span class="badge badge-accent">${this.sanitize(v.tipoVehiculo || '-')}</span></td>
                                <td>${this.sanitize(v.capacidad || '-')}</td>
                                <td>${this.sanitize(v.tipoCombustible || '-')}</td>
                                <td>${this.formatNumber(v.kilometrajeActual || 0)} km</td>
                                <td><span class="badge ${vencClase}" title="${v.numeroCirculacion ? 'No. ' + this.sanitize(v.numeroCirculacion) : ''}">${vencTexto}</span></td>
                                <td><span class="badge ${estadoBadge}">${v.estado === 'activo' ? 'Activo' : (v.estado === 'en_mantenimiento' ? 'En Taller' : 'Fuera Servicio')}</span></td>
                                <td class="actions-cell">
                                    <button class="btn-icon btn-secondary btn-edit-vehiculo" data-id="${v.id}" title="Editar">✏️</button>
                                    <button class="btn-icon btn-secondary btn-ver-mantenimiento" data-id="${v.id}" title="Ver mantenimientos">🔧</button>
                                    ${window.permissions?.canDelete ? `<button class="btn-icon btn-danger btn-delete-vehiculo" data-id="${v.id}" title="Eliminar">🗑️</button>` : ''}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (canEdit) document.getElementById('btn-nuevo-vehiculo')?.addEventListener('click', () => this.showModalVehiculo());
        document.querySelectorAll('.vehiculo-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.actions-cell')) return;
                const v = (Flota._vehiculosById ? Flota._vehiculosById[row.dataset.id] : this.vehiculos.find(x => x.id === row.dataset.id));
                if (v) this.showVehiculoDetail(v);
            });
        });
        document.querySelectorAll('.btn-edit-vehiculo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const v = (Flota._vehiculosById ? Flota._vehiculosById[btn.dataset.id] : this.vehiculos.find(x => x.id === btn.dataset.id));
                if (v) this.showModalVehiculo(v);
            });
        });
        document.querySelectorAll('.btn-ver-mantenimiento').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedVehiculoId = btn.dataset.id;
                this.currentView = 'mantenimiento';
                this.renderDesktop();
            });
        });
        document.querySelectorAll('.btn-delete-vehiculo').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await showConfirm('¿Eliminar vehículo?', 'Esta acción no se puede deshacer.')) {
                    await firebase.firestore().collection('vehiculos').doc(btn.dataset.id).delete();
                    showToast('Vehículo eliminado', 'success');
                }
            });
        });
    },

    renderVehiculosMobile() {
        const container = document.getElementById('flota-content-mobile');
        if (!container) return;
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;
        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                <strong>${this.vehiculos.length} vehículos</strong>
                ${canEdit ? `<button class="btn btn-primary btn-sm" id="btn-nuevo-vehiculo-m">+ Nuevo</button>` : ''}
            </div>
            ${this.vehiculos.map(v => {
                const dias = this.diasParaVencimiento(v.fechaVencimientoCirculacion);
                const vencClase = dias <= 0 ? '#ef4444' : (dias <= 30 ? '#f59e0b' : '#22c55e');
                return `<div class="m-data-card m-vehiculo-card" data-id="${v.id}" style="margin-bottom:0.5rem;padding:0.5rem;cursor:pointer;">
                    <div style="display:flex;justify-content:space-between;">
                        <strong>${this.sanitize(v.nombre || '')}</strong>
                        <span class="badge ${v.estado === 'activo' ? 'badge-success' : 'badge-warning'}">${v.estado === 'activo' ? 'Activo' : 'Taller'}</span>
                    </div>
                    <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:0.3rem;">
                        ${this.sanitize(v.numeroPlaca || '-')} · ${this.sanitize(v.tipoVehiculo || '-')} · ${this.formatNumber(v.kilometrajeActual || 0)} km
                    </div>
                    <div style="font-size:0.72rem;margin-top:0.2rem;">
                        Circulación: <span style="color:${vencClase};font-weight:600;">${dias <= 0 ? 'VENCIDA' : (dias === 9999 ? 'Sin fecha' : dias + ' días')}</span>
                    </div>
                    <div style="display:flex;gap:0.3rem;margin-top:0.3rem;">
                        <button class="btn btn-secondary btn-sm btn-edit-vehiculo-m" data-id="${v.id}">✏️ Editar</button>
                        <button class="btn btn-secondary btn-sm btn-ver-manto-m" data-id="${v.id}">🔧 Mantenimiento</button>
                    </div>
                </div>`;
            }).join('')}
        `;
        document.getElementById('btn-nuevo-vehiculo-m')?.addEventListener('click', () => this.showModalVehiculo());
        document.querySelectorAll('.m-vehiculo-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const v = (Flota._vehiculosById ? Flota._vehiculosById[card.dataset.id] : this.vehiculos.find(x => x.id === card.dataset.id));
                if (v) this.showVehiculoDetail(v);
            });
        });
        document.querySelectorAll('.btn-edit-vehiculo-m').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const v = (Flota._vehiculosById ? Flota._vehiculosById[b.dataset.id] : this.vehiculos.find(x => x.id === b.dataset.id));
                if (v) this.showModalVehiculo(v);
            });
        });
        document.querySelectorAll('.btn-ver-manto-m').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedVehiculoId = b.dataset.id;
                this.currentView = 'mantenimiento';
                this.renderMobile();
            });
        });
    },

    showModalVehiculo(vehiculo) {
        const isEdit = !!vehiculo;
        const existingFotosVehiculo = vehiculo?.fotosVehiculo || (vehiculo?.fotoVehiculo ? [vehiculo.fotoVehiculo] : []);
        const existingFotosTarjeta = vehiculo?.fotosTarjeta || (vehiculo?.fotoTarjetaCirculacion ? [vehiculo.fotoTarjetaCirculacion] : []);
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:600px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h2 style="margin:0;">${isEdit ? '✏️ Editar Vehículo' : '🚛 Nuevo Vehículo'}</h2>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()" style="padding:0.2rem 0.6rem;font-size:1.2rem;">&times;</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                    <div class="form-group">
                        <label>Nombre del Vehículo *</label>
                        <input type="text" id="fv-nombre" class="form-control" value="${this.sanitize(vehiculo?.nombre || '')}" placeholder="Ej. Camión Daihatsu 2018">
                    </div>
                    <div class="form-group">
                        <label>Número de Placa *</label>
                        <input type="text" id="fv-placa" class="form-control" value="${this.sanitize(vehiculo?.numeroPlaca || '')}" placeholder="M-1234-4567">
                    </div>
                    <div class="form-group">
                        <label>Tipo de Vehículo</label>
                        <select id="fv-tipo" class="form-control">
                            <option value="camion" ${vehiculo?.tipoVehiculo === 'camion' ? 'selected' : ''}>Camión</option>
                            <option value="microbus" ${vehiculo?.tipoVehiculo === 'microbus' ? 'selected' : ''}>Microbús</option>
                            <option value="pickup" ${vehiculo?.tipoVehiculo === 'pickup' ? 'selected' : ''}>Pickup</option>
                            <option value="moto" ${vehiculo?.tipoVehiculo === 'moto' ? 'selected' : ''}>Motocicleta</option>
                            <option value="otro" ${vehiculo?.tipoVehiculo === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Capacidad</label>
                        <input type="text" id="fv-capacidad" class="form-control" value="${this.sanitize(vehiculo?.capacidad || '')}" placeholder="Ej. 1.5 ton / 30 pasajeros">
                    </div>
                    <div class="form-group">
                        <label>Tipo de Combustible</label>
                        <select id="fv-combustible" class="form-control">
                            <option value="diesel" ${vehiculo?.tipoCombustible === 'diesel' ? 'selected' : ''}>Diesel</option>
                            <option value="gasolina" ${vehiculo?.tipoCombustible === 'gasolina' ? 'selected' : ''}>Gasolina</option>
                            <option value="gas" ${vehiculo?.tipoCombustible === 'gas' ? 'selected' : ''}>Gas</option>
                            <option value="electrico" ${vehiculo?.tipoCombustible === 'electrico' ? 'selected' : ''}>Eléctrico</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Kilometraje Actual</label>
                        <input type="number" id="fv-kilometraje" class="form-control" value="${vehiculo?.kilometrajeActual || 0}">
                    </div>
                    <div class="form-group">
                        <label>Estado</label>
                        <select id="fv-estado" class="form-control">
                            <option value="activo" ${vehiculo?.estado === 'activo' || !vehiculo ? 'selected' : ''}>Activo</option>
                            <option value="en_mantenimiento" ${vehiculo?.estado === 'en_mantenimiento' ? 'selected' : ''}>En Mantenimiento</option>
                            <option value="fuera_servicio" ${vehiculo?.estado === 'fuera_servicio' ? 'selected' : ''}>Fuera de Servicio</option>
                        </select>
                    </div>
                </div>
                <hr style="margin:1rem 0;">
                <h4 style="margin-bottom:0.5rem;">📋 Tarjeta de Circulación</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                    <div class="form-group">
                        <label>Número de Circulación</label>
                        <input type="text" id="fv-numCirculacion" class="form-control" value="${this.sanitize(vehiculo?.numeroCirculacion || '')}">
                    </div>
                    <div class="form-group">
                        <label>Fecha de Vencimiento</label>
                        <input type="date" id="fv-vencimiento" class="form-control" value="${vehiculo?.fechaVencimientoCirculacion ? this.toDateInput(vehiculo.fechaVencimientoCirculacion) : ''}">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-top:0.5rem;">
                    <div class="form-group">
                        <label>Fotos del Vehículo <span style="font-weight:400;color:var(--text-secondary);font-size:0.75rem;">(máx 4)</span></label>
                        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.4rem;" id="fv-fotos-slots">
                            ${this.buildFotoySlotsHTML(existingFotosVehiculo)}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Fotos Tarjeta de Circulación <span style="font-weight:400;color:var(--text-secondary);font-size:0.75rem;">(máx 4)</span></label>
                        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.4rem;" id="fv-tarjeta-slots">
                            ${this.buildFotoySlotsHTML(existingFotosTarjeta)}
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                    <button class="btn btn-primary" id="fv-save">${isEdit ? 'Guardar Cambios' : 'Crear Vehículo'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        const slotContainers = ['fv-fotos-slots', 'fv-tarjeta-slots'];
        slotContainers.forEach(id => {
            document.getElementById(id)?.addEventListener('click', (e) => {
                const btn = e.target.closest('.fv-slot-remove');
                if (!btn) return;
                const slot = btn.closest('.fv-slot-existing');
                if (!slot) return;
                slot.className = 'fv-slot fv-slot-new';
                slot.innerHTML = '<input type="file" accept="image/*" style="width:100%;padding:0.2rem;border:2px dashed var(--gray-300);border-radius:6px;font-size:0.75rem;">';
            });
        });

        modal.querySelector('#fv-save')?.addEventListener('click', async () => {
            const saveBtn = document.getElementById('fv-save');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando...';

            try {
                const data = {
                    nombre: document.getElementById('fv-nombre').value.trim(),
                    numeroPlaca: document.getElementById('fv-placa').value.trim().toUpperCase(),
                    tipoVehiculo: document.getElementById('fv-tipo').value,
                    capacidad: document.getElementById('fv-capacidad').value.trim(),
                    tipoCombustible: document.getElementById('fv-combustible').value,
                    kilometrajeActual: parseInt(document.getElementById('fv-kilometraje').value) || 0,
                    estado: document.getElementById('fv-estado').value,
                    numeroCirculacion: document.getElementById('fv-numCirculacion').value.trim(),
                    fechaVencimientoCirculacion: document.getElementById('fv-vencimiento').value ? new Date(document.getElementById('fv-vencimiento').value).toISOString() : null,
                    updatedAt: new Date().toISOString()
                };

                if (!data.nombre || !data.numeroPlaca) {
                    showToast('Nombre y placa son obligatorios', 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = isEdit ? 'Guardar Cambios' : 'Crear Vehículo';
                    return;
                }

                const fotosVehiculo = [];
                document.querySelectorAll('#fv-fotos-slots .fv-slot-existing').forEach(el => {
                    fotosVehiculo.push(el.dataset.url);
                });
                const fotosTarjeta = [];
                document.querySelectorAll('#fv-tarjeta-slots .fv-slot-existing').forEach(el => {
                    fotosTarjeta.push(el.dataset.url);
                });

                const collectFilesFromSlots = (containerId) => {
                    const files = [];
                    document.querySelectorAll(`#${containerId} .fv-slot-new input[type="file"]`).forEach(input => {
                        if (input.files[0]) files.push(input.files[0]);
                    });
                    return files;
                };

                const fotoFiles = collectFilesFromSlots('fv-fotos-slots');
                const fotoTarjetaFiles = collectFilesFromSlots('fv-tarjeta-slots');

                for (let i = 0; i < fotoFiles.length; i++) {
                    if (fotosVehiculo.length < 4) {
                        const url = await this.uploadImage(fotoFiles[i], `vehiculos/${isEdit ? vehiculo.id : 'nuevo'}/foto_${Date.now()}`);
                        fotosVehiculo.push(url);
                    }
                }

                for (let i = 0; i < fotoTarjetaFiles.length; i++) {
                    if (fotosTarjeta.length < 4) {
                        const url = await this.uploadImage(fotoTarjetaFiles[i], `vehiculos/${isEdit ? vehiculo.id : 'nuevo'}/tarjeta_${Date.now()}`);
                        fotosTarjeta.push(url);
                    }
                }

                data.fotosVehiculo = fotosVehiculo;
                data.fotosTarjeta = fotosTarjeta;

                const db = firebase.firestore();
                if (isEdit) {
                    await db.collection('vehiculos').doc(vehiculo.id).update(data);
                    showToast('Vehículo actualizado', 'success');
                } else {
                    data.createdAt = new Date().toISOString();
                    await db.collection('vehiculos').add(data);
                    showToast('Vehículo creado', 'success');
                }
                modal.remove();
            } catch (err) {
                console.error('Error saving vehiculo:', err);
                showToast('Error al guardar el vehículo: ' + err.message, 'error');
            } finally {
                const saveBtn = document.getElementById('fv-save');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = isEdit ? 'Guardar Cambios' : 'Crear Vehículo';
                }
            }
        });
    },

    async uploadImage(file, path) {
        const storage = firebase.storage();
        const ref = storage.ref(`${path}_${Date.now()}_${file.name}`);
        await ref.put(file);
        return await ref.getDownloadURL();
    },

    buildFotoySlotsHTML(existingUrls) {
        const urls = existingUrls || [];
        let html = '';
        for (let i = 0; i < 4; i++) {
            const url = urls[i];
            if (url) {
                html += `<div class="fv-slot fv-slot-existing" data-url="${url}">
                    <div style="position:relative;">
                        <img src="${url}" style="width:100%;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--gray-200);">
                        <button type="button" class="fv-slot-remove" style="position:absolute;top:2px;right:2px;width:22px;height:22px;background:#ef4444;color:white;border:none;border-radius:50%;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;padding:0;">×</button>
                        <span style="display:block;text-align:center;font-size:0.65rem;color:var(--text-secondary);margin-top:2px;">${i + 1}</span>
                    </div>
                </div>`;
            } else {
                html += `<div class="fv-slot fv-slot-new">
                    <input type="file" accept="image/*" style="width:100%;padding:0.2rem;border:2px dashed var(--gray-300);border-radius:6px;font-size:0.75rem;">
                </div>`;
            }
        }
        return html;
    },

    renderFotoPreviews(fotosArray, legacySingleFoto, inputId) {
        const urls = [];
        if (fotosArray && Array.isArray(fotosArray)) {
            fotosArray.forEach((url, i) => {
                if (url) urls.push(`<div style="position:relative;"><img src="${url}" style="width:100%;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--gray-200);"><span style="display:block;text-align:center;font-size:0.65rem;color:var(--text-secondary);margin-top:2px;">${i + 1}</span></div>`);
            });
        } else if (legacySingleFoto) {
            urls.push(`<div style="position:relative;"><img src="${legacySingleFoto}" style="width:100%;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--gray-200);"><span style="display:block;text-align:center;font-size:0.65rem;color:var(--text-secondary);margin-top:2px;">1</span></div>`);
        }
        if (urls.length === 0) {
            return '<span style="font-size:0.75rem;color:var(--text-secondary);">Sin fotos</span>';
        }
        return urls.join('');
    },

    // ========== MANTENIMIENTO ==========
    renderMantenimiento() {
        const container = document.getElementById('flota-content');
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;
        const filtrados = this.selectedVehiculoId
            ? this.mantenimientos.filter(m => m.vehiculoId === this.selectedVehiculoId)
            : this.mantenimientos;

        const vehiculo = this.selectedVehiculoId ? (Flota._vehiculosById ? Flota._vehiculosById[this.selectedVehiculoId] : this.vehiculos.find(v => v.id === this.selectedVehiculoId)) : null;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
                <div>
                    <h2 style="margin:0;">🔧 Mantenimiento</h2>
                    ${vehiculo ? `<span style="font-size:0.85rem;color:var(--text-secondary);">Filtrando: <strong>${this.sanitize(vehiculo.nombre)}</strong> <a href="#" id="fl-clear-filtro-vehiculo" style="color:var(--primary-500);">(Limpiar filtro)</a></span>` : `<span style="font-size:0.85rem;color:var(--text-secondary);">${filtrados.length} registros</span>`}
                </div>
                <div style="display:flex;gap:0.5rem;">
                    <select id="fl-filtro-vehiculo" class="form-control" style="width:auto;padding:0.4rem 0.6rem;">
                        <option value="">Todos los vehículos</option>
                        ${this.vehiculos.map(v => `<option value="${v.id}" ${this.selectedVehiculoId === v.id ? 'selected' : ''}>${this.sanitize(v.nombre)} - ${this.sanitize(v.numeroPlaca)}</option>`).join('')}
                    </select>
                    ${canEdit ? `<button class="btn btn-primary" id="btn-nuevo-mantenimiento">+ Nuevo Servicio</button>` : ''}
                </div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Vehículo</th>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Descripción</th>
                            <th>Costo</th>
                            <th>Kilometraje</th>
                            <th>Taller</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtrados.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:2rem;">No hay registros de mantenimiento</td></tr>' :
                        filtrados.map(m => {
                            const v = (Flota._vehiculosById ? Flota._vehiculosById[m.vehiculoId] : this.vehiculos.find(x => x.id === m.vehiculoId));
                            return `<tr>
                                <td>${v ? `<strong>${this.sanitize(v.nombre)}</strong><br><span style="font-size:0.7rem;">${this.sanitize(v.numeroPlaca)}</span>` : '<em>Eliminado</em>'}</td>
                                <td>${m.fecha ? this.formatDate(m.fecha) : '-'}</td>
                                <td><span class="badge ${m.tipo === 'preventivo' ? 'badge-primary' : 'badge-warning'}">${m.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'}</span></td>
                                <td>${this.sanitize(m.descripcion || '-')}</td>
                                <td style="font-weight:700;">$${this.formatNumber(m.costo || 0, 2)}</td>
                                <td>${m.kilometraje ? this.formatNumber(m.kilometraje) + ' km' : '-'}</td>
                                <td>${this.sanitize(m.tallerNombre || '-')}</td>
                                <td class="actions-cell">
                                    <button class="btn-icon btn-secondary btn-edit-manto" data-id="${m.id}" title="Editar">✏️</button>
                                    ${window.permissions?.canDelete ? `<button class="btn-icon btn-danger btn-delete-manto" data-id="${m.id}" title="Eliminar">🗑️</button>` : ''}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('fl-filtro-vehiculo')?.addEventListener('change', (e) => {
            this.selectedVehiculoId = e.target.value || null;
            this.renderMantenimiento();
        });
        document.getElementById('fl-clear-filtro-vehiculo')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.selectedVehiculoId = null;
            this.renderMantenimiento();
        });
        if (canEdit) document.getElementById('btn-nuevo-mantenimiento')?.addEventListener('click', () => this.showModalMantenimiento());
        document.querySelectorAll('.btn-delete-manto').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (await showConfirm('¿Eliminar registro de mantenimiento?', 'Esta acción no se puede deshacer.')) {
                    const mantoId = btn.dataset.id;
                    const ot = this.ordenesTrabajo.find(o => o.mantenimientoId === mantoId);
                    const db = firebase.firestore();
                    const batch = db.batch();
                    batch.delete(db.collection('mantenimientos').doc(mantoId));
                    if (ot) batch.delete(db.collection('ordenesTrabajo').doc(ot.id));
                    await batch.commit();
                    showToast('Registro eliminado', 'success');
                }
            });
        });
        document.querySelectorAll('.btn-edit-manto').forEach(btn => {
            btn.addEventListener('click', () => {
                const m = this.mantenimientos.find(x => x.id === btn.dataset.id);
                if (m) this.showModalMantenimiento(m);
            });
        });
    },

    renderMantenimientoMobile() {
        const container = document.getElementById('flota-content-mobile');
        if (!container) return;
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;
        const filtrados = this.selectedVehiculoId
            ? this.mantenimientos.filter(m => m.vehiculoId === this.selectedVehiculoId)
            : this.mantenimientos;

        container.innerHTML = `
            <div style="display:flex;gap:0.3rem;margin-bottom:0.5rem;">
                <select id="fl-filtro-vehiculo-m" class="form-control" style="flex:1;padding:0.3rem;font-size:0.8rem;">
                    <option value="">Todos los vehículos</option>
                    ${this.vehiculos.map(v => `<option value="${v.id}" ${this.selectedVehiculoId === v.id ? 'selected' : ''}>${this.sanitize(v.nombre)}</option>`).join('')}
                </select>
                ${canEdit ? `<button class="btn btn-primary btn-sm" id="btn-nuevo-manto-m">+</button>` : ''}
            </div>
            ${filtrados.map(m => {
                const v = (Flota._vehiculosById ? Flota._vehiculosById[m.vehiculoId] : this.vehiculos.find(x => x.id === m.vehiculoId));
                return `<div class="m-data-card" style="margin-bottom:0.4rem;padding:0.4rem;">
                    <div style="display:flex;justify-content:space-between;">
                        <strong>${v ? this.sanitize(v.nombre) : 'N/A'}</strong>
                        <span class="badge ${m.tipo === 'preventivo' ? 'badge-primary' : 'badge-warning'}">${m.tipo === 'preventivo' ? 'Prev' : 'Corr'}</span>
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);">
                        ${m.fecha ? this.formatDate(m.fecha) : ''} · $${this.formatNumber(m.costo || 0, 2)} · ${m.kilometraje ? this.formatNumber(m.kilometraje) + ' km' : '-'}
                    </div>
                    <div style="font-size:0.72rem;">${this.sanitize(m.descripcion || '-')}</div>
                    ${canEdit ? `<div style="display:flex;gap:0.3rem;margin-top:0.4rem;"><button class="btn btn-secondary btn-sm btn-edit-manto-m" data-id="${m.id}">✏️ Editar</button><button class="btn btn-danger btn-sm btn-delete-manto-m" data-id="${m.id}">🗑️</button></div>` : ''}
                </div>`;
            }).join('')}
        `;
        document.getElementById('fl-filtro-vehiculo-m')?.addEventListener('change', (e) => {
            this.selectedVehiculoId = e.target.value || null;
            this.renderMantenimientoMobile();
        });
        document.getElementById('btn-nuevo-manto-m')?.addEventListener('click', () => this.showModalMantenimiento());
        document.querySelectorAll('.btn-edit-manto-m').forEach(btn => {
            btn.addEventListener('click', () => {
                const m = this.mantenimientos.find(x => x.id === btn.dataset.id);
                if (m) this.showModalMantenimiento(m);
            });
        });
        document.querySelectorAll('.btn-delete-manto-m').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (await showConfirm('¿Eliminar registro de mantenimiento?', 'Esta acción no se puede deshacer.')) {
                    const mantoId = btn.dataset.id;
                    const ot = this.ordenesTrabajo.find(o => o.mantenimientoId === mantoId);
                    const db = firebase.firestore();
                    const batch = db.batch();
                    batch.delete(db.collection('mantenimientos').doc(mantoId));
                    if (ot) batch.delete(db.collection('ordenesTrabajo').doc(ot.id));
                    await batch.commit();
                    showToast('Registro eliminado', 'success');
                }
            });
        });
    },

    showModalMantenimiento(mantenimiento) {
        const isEdit = !!mantenimiento;
        const existingOT = isEdit ? this.ordenesTrabajo.find(o => o.mantenimientoId === mantenimiento.id) : null;

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:550px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h2 style="margin:0;">${isEdit ? '✏️ Editar Servicio' : '🔧 Registrar Servicio'}</h2>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()" style="padding:0.2rem 0.6rem;font-size:1.2rem;">&times;</button>
                </div>
                <div class="form-group">
                    <label>Vehículo *</label>
                    <select id="fm-vehiculo" class="form-control">
                        <option value="">Seleccionar vehículo</option>
                        ${this.vehiculos.filter(v => v.estado !== 'fuera_servicio').map(v =>
                            `<option value="${v.id}" ${(isEdit ? mantenimiento.vehiculoId === v.id : this.selectedVehiculoId === v.id) ? 'selected' : ''}>${this.sanitize(v.nombre)} - ${this.sanitize(v.numeroPlaca)}</option>`
                        ).join('')}
                    </select>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                    <div class="form-group">
                        <label>Tipo de Servicio *</label>
                        <select id="fm-tipo" class="form-control">
                            <option value="preventivo" ${isEdit && mantenimiento.tipo === 'preventivo' ? 'selected' : ''}>Preventivo</option>
                            <option value="correctivo" ${isEdit && mantenimiento.tipo === 'correctivo' ? 'selected' : ''}>Correctivo</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Fecha *</label>
                        <input type="date" id="fm-fecha" class="form-control" value="${isEdit && mantenimiento.fecha ? mantenimiento.fecha.split('T')[0] : new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label>Kilometraje</label>
                        <input type="number" id="fm-kilometraje" class="form-control" min="0" value="${isEdit ? (mantenimiento.kilometraje || '') : ''}">
                    </div>
                </div>
                <div class="form-group" style="margin-top:0.5rem;">
                    <label style="display:flex;justify-content:space-between;align-items:center;">
                        Servicios realizados
                        <span style="font-size:0.75rem;color:var(--text-secondary);font-weight:400;">Usa + para agregar más</span>
                    </label>
                    <div id="fm-servicios-container">
                        <div class="fm-servicio-header" style="display:flex;gap:0.5rem;padding:0.25rem 0;font-weight:600;font-size:0.75rem;color:var(--text-secondary);border-bottom:1px solid var(--gray-200);margin-bottom:0.25rem;">
                            <span style="flex:2;">Descripción</span>
                            <span style="width:110px;text-align:right;">Costo ($)</span>
                            <span style="width:36px;"></span>
                        </div>
                        <div class="fm-servicio-item" style="display:flex;gap:0.5rem;margin-bottom:0.4rem;align-items:center;" data-index="0">
                            <input type="text" class="fm-servicio-desc form-control" style="flex:2;" placeholder="Ej: Cambio de aceite">
                            <input type="number" class="fm-servicio-costo form-control" style="width:110px;" step="0.01" min="0" value="0">
                            <button class="fm-remove-servicio" style="width:36px;height:36px;background:#fee2e2;border:none;border-radius:8px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;color:#dc2626;" disabled title="Mínimo un servicio">&times;</button>
                        </div>
                    </div>
                    <button type="button" id="fm-add-servicio" style="margin-top:0.5rem;background:var(--primary-50);border:2px dashed var(--primary-300);border-radius:8px;padding:0.4rem 1rem;cursor:pointer;color:var(--primary-600);font-weight:600;font-size:0.85rem;width:100%;">+ Agregar servicio</button>
                    <div style="display:flex;justify-content:flex-end;align-items:center;margin-top:0.5rem;padding:0.5rem;background:var(--gray-50);border-radius:8px;">
                        <span style="font-weight:600;color:var(--text-secondary);margin-right:0.5rem;">Total:</span>
                        <span style="font-size:1.1rem;font-weight:700;color:var(--primary-600);">$<span id="fm-total-servicios">0.00</span></span>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                    <div class="form-group">
                        <label>Taller / Mecánico</label>
                        <input type="text" id="fm-taller" class="form-control" placeholder="Nombre del taller" value="${isEdit ? this.sanitize(mantenimiento.tallerNombre || '') : ''}" list="fl-taller-list">
                        <datalist id="fl-taller-list">
                            ${this.proveedores.map(p => `<option value="${this.sanitize(p.nombre)}">`).join('')}
                        </datalist>
                    </div>
                    <div class="form-group">
                        <label>Generar Orden de Trabajo</label>
                        <label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
                            <input type="checkbox" id="fm-generar-ot" ${isEdit && existingOT ? 'checked' : (!isEdit ? 'checked' : '')}>
                            <span style="font-size:0.85rem;">Crear OT para llevar al taller</span>
                        </label>
                    </div>
                </div>
                <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                    <button class="btn btn-primary" id="fm-save">${isEdit ? 'Guardar Cambios' : 'Registrar Servicio'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        const serviciosContainer = document.getElementById('fm-servicios-container');
        const totalSpan = document.getElementById('fm-total-servicios');
        let itemCount = 1;

        const buildServiciosRows = (serviciosArr) => {
            if (!serviciosArr || serviciosArr.length === 0) return '';
            return serviciosArr.map((s, i) => `
                <div class="fm-servicio-item" style="display:flex;gap:0.5rem;margin-bottom:0.4rem;align-items:center;" data-index="${i}">
                    <input type="text" class="fm-servicio-desc form-control" style="flex:2;" placeholder="Ej: Cambio de aceite" value="${this.sanitize(s.descripcion || '')}">
                    <input type="number" class="fm-servicio-costo form-control" style="width:110px;" step="0.01" min="0" value="${s.costo || 0}">
                    <button class="fm-remove-servicio" style="width:36px;height:36px;background:#fee2e2;border:none;border-radius:8px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;color:#dc2626;" ${i === 0 ? 'disabled title="Mínimo un servicio"' : 'title="Eliminar"'}>×</button>
                </div>
            `).join('');
        };

        const preFillServicios = () => {
            if (!isEdit) return;
            let serviciosData = [];
            if (mantenimiento.servicios && Array.isArray(mantenimiento.servicios) && mantenimiento.servicios.length > 0) {
                serviciosData = mantenimiento.servicios;
            } else if (mantenimiento.descripcion) {
                const lines = mantenimiento.descripcion.split('\n').filter(l => l.trim());
                serviciosData = lines.map(l => ({ descripcion: l.trim(), costo: 0 }));
            }
            if (serviciosData.length > 0) {
                const header = serviciosContainer.querySelector('.fm-servicio-header');
                serviciosContainer.innerHTML = '';
                serviciosContainer.appendChild(header);
                itemCount = serviciosData.length;
                serviciosData.forEach((s, i) => {
                    const div = document.createElement('div');
                    div.className = 'fm-servicio-item';
                    div.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.4rem;align-items:center;';
                    div.dataset.index = i;
                    div.innerHTML = `
                        <input type="text" class="fm-servicio-desc form-control" style="flex:2;" placeholder="Ej: Cambio de aceite" value="${this.sanitize(s.descripcion || '')}">
                        <input type="number" class="fm-servicio-costo form-control" style="width:110px;" step="0.01" min="0" value="${s.costo || 0}">
                        <button class="fm-remove-servicio" style="width:36px;height:36px;background:#fee2e2;border:none;border-radius:8px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;color:#dc2626;" ${i === 0 ? 'disabled title="Mínimo un servicio"' : 'title="Eliminar"'}>×</button>
                    `;
                    serviciosContainer.appendChild(div);
                });
                setTimeout(() => recalcularTotal(), 0);
            }
        };

        const recalcularTotal = () => {
            const costos = serviciosContainer.querySelectorAll('.fm-servicio-costo');
            let total = 0;
            costos.forEach(el => { total += parseFloat(el.value) || 0; });
            totalSpan.textContent = total.toFixed(2);
        };

        document.getElementById('fm-add-servicio')?.addEventListener('click', () => {
            const newIndex = itemCount++;
            const itemHtml = `
                <div class="fm-servicio-item" style="display:flex;gap:0.5rem;margin-bottom:0.4rem;align-items:center;" data-index="${newIndex}">
                    <input type="text" class="fm-servicio-desc form-control" style="flex:2;" placeholder="Ej: Cambio de aceite">
                    <input type="number" class="fm-servicio-costo form-control" style="width:110px;" step="0.01" min="0" value="0">
                    <button class="fm-remove-servicio" style="width:36px;height:36px;background:#fee2e2;border:none;border-radius:8px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;color:#dc2626;" title="Eliminar">&times;</button>
                </div>
            `;
            serviciosContainer.insertAdjacentHTML('beforeend', itemHtml);
            recalcularTotal();
        });

        serviciosContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.fm-remove-servicio');
            if (!btn) return;
            const items = serviciosContainer.querySelectorAll('.fm-servicio-item');
            if (items.length <= 1) return;
            btn.closest('.fm-servicio-item').remove();
            recalcularTotal();
        });

        serviciosContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('fm-servicio-costo')) {
                recalcularTotal();
            }
        });

        preFillServicios();

        modal.querySelector('#fm-save')?.addEventListener('click', async () => {
            const vehiculoId = document.getElementById('fm-vehiculo').value;
            const tipo = document.getElementById('fm-tipo').value;
            const fecha = document.getElementById('fm-fecha').value;
            const kilometraje = parseInt(document.getElementById('fm-kilometraje').value) || 0;
            const tallerNombre = document.getElementById('fm-taller').value.trim();
            const generarOT = document.getElementById('fm-generar-ot').checked;

            const descInputs = serviciosContainer.querySelectorAll('.fm-servicio-desc');
            const costoInputs = serviciosContainer.querySelectorAll('.fm-servicio-costo');

            const servicios = [];
            let descripcion = '';
            let costoTotal = 0;

            for (let i = 0; i < descInputs.length; i++) {
                const desc = descInputs[i].value.trim();
                const costo = parseFloat(costoInputs[i].value) || 0;
                if (desc) {
                    servicios.push({ descripcion: desc, costo });
                    descripcion += (descripcion ? '\n' : '') + desc;
                    costoTotal += costo;
                }
            }

            if (!vehiculoId || !fecha || servicios.length === 0) {
                showToast('Vehículo, fecha y al menos un servicio son obligatorios', 'error');
                return;
            }

            try {
                const db = firebase.firestore();
                const batch = db.batch();

                const mantoData = {
                    vehiculoId,
                    tipo,
                    fecha: new Date(fecha).toISOString(),
                    costo: costoTotal,
                    kilometraje,
                    descripcion,
                    servicios,
                    tallerNombre,
                    updatedAt: new Date().toISOString()
                };

                if (isEdit) {
                    batch.update(db.collection('mantenimientos').doc(mantenimiento.id), mantoData);
                } else {
                    mantoData.createdAt = new Date().toISOString();
                    mantoData.createdBy = firebase.auth().currentUser?.uid || 'unknown';
                    const mantoRef = db.collection('mantenimientos').doc();
                    batch.set(mantoRef, mantoData);
                }

                const mantoId = isEdit ? mantenimiento.id : mantoRef.id;

                if (generarOT) {
                    if (existingOT) {
                        batch.update(db.collection('ordenesTrabajo').doc(existingOT.id), {
                            vehiculoId,
                            fecha: new Date(fecha).toISOString(),
                            tipoServicio: tipo === 'preventivo' ? 'mantenimiento_preventivo' : 'reparacion',
                            descripcion,
                            kilometrajeActual: kilometraje || 0,
                            tallerNombre,
                            updatedAt: new Date().toISOString()
                        });
                    } else {
                        const otRef = db.collection('ordenesTrabajo').doc();
                        const count = this.ordenesTrabajo.length + 1;
                        const year = new Date().getFullYear();
                        batch.set(otRef, {
                            numeroOrden: `OT-${year}-${String(count).padStart(5, '0')}`,
                            vehiculoId,
                            fecha: new Date(fecha).toISOString(),
                            tipoServicio: tipo === 'preventivo' ? 'mantenimiento_preventivo' : 'reparacion',
                            descripcion,
                            kilometrajeActual: kilometraje || 0,
                            tallerNombre,
                            estado: 'pendiente',
                            mantenimientoId: mantoId,
                            createdAt: new Date().toISOString(),
                            createdBy: firebase.auth().currentUser?.uid || 'unknown'
                        });
                    }
                } else if (isEdit && existingOT) {
                    batch.delete(db.collection('ordenesTrabajo').doc(existingOT.id));
                }

                await batch.commit();
                showToast(isEdit ? 'Cambios guardados' : 'Servicio registrado exitosamente', 'success');
                modal.remove();
            } catch (err) {
                console.error('Error saving mantenimiento:', err);
                showToast('Error al guardar servicio', 'error');
            }
        });
    },

    // ========== ORDENES DE TRABAJO ==========
    renderOrdenesTrabajo() {
        const container = document.getElementById('flota-content');
        if (!container) return;
        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
                <div>
                    <h2 style="margin:0;">📄 Órdenes de Trabajo</h2>
                    <span style="font-size:0.85rem;color:var(--text-secondary);">${this.ordenesTrabajo.length} órdenes</span>
                </div>
                <button class="btn btn-secondary" id="fl-refresh-ot">🔄 Actualizar</button>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>No. OT</th>
                            <th>Vehículo</th>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Descripción</th>
                            <th>Km</th>
                            <th>Taller</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.ordenesTrabajo.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:2rem;">No hay órdenes de trabajo</td></tr>' :
                        this.ordenesTrabajo.map(ot => {
                            const v = (Flota._vehiculosById ? Flota._vehiculosById[ot.vehiculoId] : this.vehiculos.find(x => x.id === ot.vehiculoId));
                            const estadoBadge = ot.estado === 'pendiente' ? 'badge-warning' : (ot.estado === 'completado' ? 'badge-success' : 'badge-error');
                            return `<tr>
                                <td><strong>${this.sanitize(ot.numeroOrden || '-')}</strong></td>
                                <td>${v ? this.sanitize(v.nombre) : '<em>N/A</em>'}</td>
                                <td>${ot.fecha ? this.formatDate(ot.fecha) : '-'}</td>
                                <td><span class="badge badge-accent">${this.sanitize(ot.tipoServicio || '').replace(/_/g, ' ')}</span></td>
                                <td>${this.sanitize(ot.descripcion || '-')}</td>
                                <td>${ot.kilometrajeActual ? this.formatNumber(ot.kilometrajeActual) + ' km' : '-'}</td>
                                <td>${this.sanitize(ot.tallerNombre || '-')}</td>
                                <td><span class="badge ${estadoBadge}">${ot.estado === 'pendiente' ? 'Pendiente' : (ot.estado === 'completado' ? 'Completado' : 'Cancelado')}</span></td>
                                <td class="actions-cell">
                                    <button class="btn-icon btn-secondary btn-print-ot" data-id="${ot.id}" title="Imprimir OT">🖨️</button>
                                    <button class="btn-icon btn-secondary btn-complete-ot" data-id="${ot.id}" title="Marcar completado" ${ot.estado !== 'pendiente' ? 'disabled style="opacity:0.3;"' : ''}>✅</button>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('fl-refresh-ot')?.addEventListener('click', () => this.renderOrdenesTrabajo());
        document.querySelectorAll('.btn-print-ot').forEach(btn => {
            btn.addEventListener('click', () => {
                const ot = this.ordenesTrabajo.find(x => x.id === btn.dataset.id);
                if (ot) this.printOT(ot);
            });
        });
        document.querySelectorAll('.btn-complete-ot').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (await showConfirm('¿Marcar OT como completada?', '')) {
                    await firebase.firestore().collection('ordenesTrabajo').doc(btn.dataset.id).update({ estado: 'completado' });
                    showToast('OT marcada como completada', 'success');
                }
            });
        });
    },

    renderOrdenesMobile() {
        const container = document.getElementById('flota-content-mobile');
        if (!container) return;
        container.innerHTML = `
            <div style="margin-bottom:0.5rem;"><strong>${this.ordenesTrabajo.length} órdenes</strong></div>
            ${this.ordenesTrabajo.map(ot => {
                const v = (Flota._vehiculosById ? Flota._vehiculosById[ot.vehiculoId] : this.vehiculos.find(x => x.id === ot.vehiculoId));
                return `<div class="m-data-card" style="margin-bottom:0.4rem;padding:0.4rem;">
                    <div style="display:flex;justify-content:space-between;">
                        <strong>${this.sanitize(ot.numeroOrden || '-')}</strong>
                        <span class="badge ${ot.estado === 'pendiente' ? 'badge-warning' : 'badge-success'}">${ot.estado}</span>
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);">
                        ${v ? this.sanitize(v.nombre) : 'N/A'} · ${ot.fecha ? this.formatDate(ot.fecha) : ''}
                    </div>
                    <div style="font-size:0.72rem;">${this.sanitize(ot.descripcion || '-')}</div>
                    <button class="btn btn-secondary btn-sm btn-print-ot-m" data-id="${ot.id}" style="margin-top:0.3rem;">🖨️ Imprimir</button>
                </div>`;
            }).join('')}
        `;
        document.querySelectorAll('.btn-print-ot-m').forEach(btn => {
            btn.addEventListener('click', () => {
                const ot = this.ordenesTrabajo.find(x => x.id === btn.dataset.id);
                if (ot) this.printOT(ot);
            });
        });
    },

    printOT(ot) {
        const v = (Flota._vehiculosById ? Flota._vehiculosById[ot.vehiculoId] : this.vehiculos.find(x => x.id === ot.vehiculoId));
        const printWin = window.open('', '_blank', 'width=800,height=600');
        printWin.document.write(`
            <html><head><title>OT ${ot.numeroOrden}</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .header h1 { margin: 0; font-size: 18px; }
                .header p { margin: 5px 0 0; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                td, th { border: 1px solid #000; padding: 6px 8px; text-align: left; }
                th { background: #eee; font-weight: bold; }
                .label { font-weight: bold; width: 150px; }
                .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px dashed #000; }
                @media print { body { padding: 0; } }
            </style>
            </head><body>
                <div class="header">
                    <h1>ÓRDEN DE TRABAJO</h1>
                    <p><strong>${ot.numeroOrden}</strong></p>
                    <p>Fecha: ${ot.fecha ? this.formatDate(ot.fecha) : ''}</p>
                </div>
                <table>
                    <tr><td class="label">Vehículo:</td><td>${v ? this.sanitize(v.nombre) : ''}</td></tr>
                    <tr><td class="label">Placa:</td><td>${v ? this.sanitize(v.numeroPlaca) : ''}</td></tr>
                    <tr><td class="label">Kilometraje:</td><td>${ot.kilometrajeActual ? this.formatNumber(ot.kilometrajeActual) + ' km' : '-'}</td></tr>
                    <tr><td class="label">Tipo de Servicio:</td><td>${this.sanitize(ot.tipoServicio || '').replace(/_/g, ' ')}</td></tr>
                    <tr><td class="label">Taller Asignado:</td><td>${this.sanitize(ot.tallerNombre || '')}</td></tr>
                </table>
                <h3>Descripción del Servicio</h3>
                <p>${this.sanitize(ot.descripcion || '')}</p>
                <div class="footer">
                    <p>Firma del Mecánico: _________________________  Fecha: _______________</p>
                    <p style="font-size:10px;color:#666;">Documento generado por Control Interlogic</p>
                </div>
                <script>window.print();window.close();</script>
            </body></html>
        `);
        printWin.document.close();
    },

    // ========== TALLERES ==========
    renderTalleres() {
        const container = document.getElementById('flota-content');
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;
        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <div>
                    <h2 style="margin:0;">🏪 Talleres y Proveedores</h2>
                    <span style="font-size:0.85rem;color:var(--text-secondary);">${this.proveedores.length} registrados</span>
                </div>
                ${canEdit ? `<button class="btn btn-primary" id="btn-nuevo-proveedor">+ Nuevo Taller</button>` : ''}
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th>Teléfono</th>
                            <th>Dirección</th>
                            <th>Email</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.proveedores.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:2rem;">No hay talleres registrados</td></tr>' :
                        this.proveedores.map(p => `<tr>
                            <td><strong>${this.sanitize(p.nombre)}</strong></td>
                            <td><span class="badge badge-accent">${this.sanitize(p.tipo || 'taller')}</span></td>
                            <td>${this.sanitize(p.telefono || '-')}</td>
                            <td>${this.sanitize(p.direccion || '-')}</td>
                            <td>${this.sanitize(p.email || '-')}</td>
                            <td class="actions-cell">
                                <button class="btn-icon btn-secondary btn-edit-proveedor" data-id="${p.id}" title="Editar">✏️</button>
                                ${window.permissions?.canDelete ? `<button class="btn-icon btn-danger btn-delete-proveedor" data-id="${p.id}" title="Eliminar">🗑️</button>` : ''}
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (canEdit) document.getElementById('btn-nuevo-proveedor')?.addEventListener('click', () => this.showModalProveedor());
        document.querySelectorAll('.btn-edit-proveedor').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = this.proveedores.find(x => x.id === btn.dataset.id);
                if (p) this.showModalProveedor(p);
            });
        });
        document.querySelectorAll('.btn-delete-proveedor').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (await showConfirm('¿Eliminar proveedor?', 'Esta acción no se puede deshacer.')) {
                    await firebase.firestore().collection('proveedores').doc(btn.dataset.id).delete();
                    showToast('Proveedor eliminado', 'success');
                }
            });
        });
    },

    renderTalleresMobile() {
        const container = document.getElementById('flota-content-mobile');
        if (!container) return;
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;
        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                <strong>${this.proveedores.length} talleres</strong>
                ${canEdit ? `<button class="btn btn-primary btn-sm" id="btn-nuevo-prov-m">+ Nuevo</button>` : ''}
            </div>
            ${this.proveedores.map(p => `<div class="m-data-card" style="margin-bottom:0.4rem;padding:0.4rem;">
                <div style="display:flex;justify-content:space-between;">
                    <strong>${this.sanitize(p.nombre)}</strong>
                    <span class="badge badge-accent">${this.sanitize(p.tipo || 'taller')}</span>
                </div>
                <div style="font-size:0.75rem;color:var(--text-secondary);">${this.sanitize(p.telefono || '-')} ${p.direccion ? '· ' + this.sanitize(p.direccion) : ''}</div>
                <button class="btn btn-secondary btn-sm btn-edit-prov-m" data-id="${p.id}" style="margin-top:0.3rem;">✏️ Editar</button>
            </div>`).join('')}
        `;
        document.getElementById('btn-nuevo-prov-m')?.addEventListener('click', () => this.showModalProveedor());
        document.querySelectorAll('.btn-edit-prov-m').forEach(b => {
            b.addEventListener('click', () => {
                const p = this.proveedores.find(x => x.id === b.dataset.id);
                if (p) this.showModalProveedor(p);
            });
        });
    },

    showModalProveedor(proveedor) {
        const isEdit = !!proveedor;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:450px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h2 style="margin:0;">${isEdit ? '✏️ Editar Taller' : '🏪 Nuevo Taller'}</h2>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()" style="padding:0.2rem 0.6rem;font-size:1.2rem;">&times;</button>
                </div>
                <div class="form-group">
                    <label>Nombre *</label>
                    <input type="text" id="fp-nombre" class="form-control" value="${this.sanitize(proveedor?.nombre || '')}" placeholder="Nombre del taller o mecánico">
                </div>
                <div class="form-group">
                    <label>Tipo</label>
                    <select id="fp-tipo" class="form-control">
                        <option value="taller" ${proveedor?.tipo === 'taller' || !proveedor ? 'selected' : ''}>Taller Mecánico</option>
                        <option value="mecanico" ${proveedor?.tipo === 'mecanico' ? 'selected' : ''}>Mecánico Independiente</option>
                        <option value="lubricentro" ${proveedor?.tipo === 'lubricentro' ? 'selected' : ''}>Lubricentro</option>
                        <option value="refaccionaria" ${proveedor?.tipo === 'refaccionaria' ? 'selected' : ''}>Refaccionaria</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Teléfono</label>
                    <input type="text" id="fp-telefono" class="form-control" value="${this.sanitize(proveedor?.telefono || '')}">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="fp-email" class="form-control" value="${this.sanitize(proveedor?.email || '')}">
                </div>
                <div class="form-group">
                    <label>Dirección</label>
                    <textarea id="fp-direccion" class="form-control" rows="2">${this.sanitize(proveedor?.direccion || '')}</textarea>
                </div>
                <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                    <button class="btn btn-primary" id="fp-save">${isEdit ? 'Guardar' : 'Crear Taller'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        modal.querySelector('#fp-save')?.addEventListener('click', async () => {
            const data = {
                nombre: document.getElementById('fp-nombre').value.trim(),
                tipo: document.getElementById('fp-tipo').value,
                telefono: document.getElementById('fp-telefono').value.trim(),
                email: document.getElementById('fp-email').value.trim(),
                direccion: document.getElementById('fp-direccion').value.trim(),
            };
            if (!data.nombre) { showToast('El nombre es obligatorio', 'error'); return; }
            try {
                const db = firebase.firestore();
                if (isEdit) {
                    await db.collection('proveedores').doc(proveedor.id).update(data);
                    showToast('Taller actualizado', 'success');
                } else {
                    data.createdAt = new Date().toISOString();
                    await db.collection('proveedores').add(data);
                    showToast('Taller creado', 'success');
                }
                modal.remove();
            } catch (err) {
                console.error('Error saving proveedor:', err);
                showToast('Error al guardar', 'error');
            }
        });
    },

    // ========== DETALLE DE VEHÍCULO ==========
    showVehiculoDetail(vehiculo) {
        const fotosVehiculo = vehiculo.fotosVehiculo || (vehiculo.fotoVehiculo ? [vehiculo.fotoVehiculo] : []);
        const fotosTarjeta = vehiculo.fotosTarjeta || (vehiculo.fotoTarjetaCirculacion ? [vehiculo.fotoTarjetaCirculacion] : []);
        const dias = this.diasParaVencimiento(vehiculo.fechaVencimientoCirculacion);

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:650px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h2 style="margin:0;">🚛 ${this.sanitize(vehiculo.nombre || 'Vehículo')}</h2>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()" style="padding:0.2rem 0.6rem;font-size:1.2rem;">&times;</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                    <div class="dv-field"><span class="dv-label">Placa</span><span class="dv-value">${this.sanitize(vehiculo.numeroPlaca || '-')}</span></div>
                    <div class="dv-field"><span class="dv-label">Tipo</span><span class="dv-value">${this.sanitize(vehiculo.tipoVehiculo || '-')}</span></div>
                    <div class="dv-field"><span class="dv-label">Capacidad</span><span class="dv-value">${this.sanitize(vehiculo.capacidad || '-')}</span></div>
                    <div class="dv-field"><span class="dv-label">Combustible</span><span class="dv-value">${this.sanitize(vehiculo.tipoCombustible || '-')}</span></div>
                    <div class="dv-field"><span class="dv-label">Kilometraje</span><span class="dv-value">${this.formatNumber(vehiculo.kilometrajeActual || 0)} km</span></div>
                    <div class="dv-field"><span class="dv-label">Estado</span><span class="dv-value"><span class="badge ${vehiculo.estado === 'activo' ? 'badge-success' : (vehiculo.estado === 'en_mantenimiento' ? 'badge-warning' : 'badge-error')}">${vehiculo.estado === 'activo' ? 'Activo' : (vehiculo.estado === 'en_mantenimiento' ? 'En Taller' : 'Fuera Servicio')}</span></span></div>
                    <div class="dv-field" style="grid-column:1/-1;border-top:1px solid var(--gray-200);padding-top:0.5rem;"><span class="dv-label">No. Circulación</span><span class="dv-value">${this.sanitize(vehiculo.numeroCirculacion || '-')}</span></div>
                    <div class="dv-field"><span class="dv-label">Venc. Circulación</span><span class="dv-value"><span class="badge ${dias <= 0 ? 'badge-error' : (dias <= 30 ? 'badge-warning' : 'badge-success')}">${dias <= 0 ? 'VENCIDA' : (dias === 9999 ? 'Sin fecha' : `${dias} días restantes`)}</span></span></div>
                    <div class="dv-field"><span class="dv-label">F. Vencimiento</span><span class="dv-value">${vehiculo.fechaVencimientoCirculacion ? this.formatDate(vehiculo.fechaVencimientoCirculacion) : '-'}</span></div>
                </div>
                <hr style="margin:1rem 0;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <div>
                        <h4 style="margin:0 0 0.5rem;">Fotos del Vehículo</h4>
                        <div class="dv-fotos-grid" id="dv-fotos-vehiculo">
                            ${fotosVehiculo.length === 0 ? '<span style="font-size:0.8rem;color:var(--text-secondary);">Sin fotos</span>' :
                            fotosVehiculo.map((url, i) => `
                                <div class="dv-foto-thumb" data-url="${url}">
                                    <img src="${url}" alt="Foto vehículo ${i+1}" loading="lazy">
                                    <span>${i+1}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div>
                        <h4 style="margin:0 0 0.5rem;">Fotos Tarjeta de Circulación</h4>
                        <div class="dv-fotos-grid" id="dv-fotos-tarjeta">
                            ${fotosTarjeta.length === 0 ? '<span style="font-size:0.8rem;color:var(--text-secondary);">Sin fotos</span>' :
                            fotosTarjeta.map((url, i) => `
                                <div class="dv-foto-thumb" data-url="${url}">
                                    <img src="${url}" alt="Foto tarjeta ${i+1}" loading="lazy">
                                    <span>${i+1}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cerrar</button>
                    <button class="btn btn-primary" id="dv-edit">✏️ Editar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        modal.querySelectorAll('.dv-foto-thumb').forEach(el => {
            el.addEventListener('click', () => {
                this.showImageModal(el.dataset.url);
            });
        });

        modal.querySelector('#dv-edit')?.addEventListener('click', () => {
            modal.remove();
            this.showModalVehiculo(vehiculo);
        });
    },

    showImageModal(url) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.style.cursor = 'zoom-out';
        modal.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:2rem;">
                <img src="${url}" style="max-width:95%;max-height:95%;object-fit:contain;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = () => modal.remove();
    },

    // ========== UTILITIES ==========
    diasParaVencimiento(fecha) {
        if (!fecha) return 9999;
        const f = new Date(fecha);
        if (isNaN(f.getTime())) return 9999;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        f.setHours(0, 0, 0, 0);
        return Math.ceil((f - hoy) / (1000 * 60 * 60 * 24));
    },

    toDateInput(iso) {
        if (!iso) return '';
        try { return new Date(iso).toISOString().split('T')[0]; } catch { return ''; }
    },

    formatNumber(num, decimals = 0) {
        if (num === undefined || num === null) return '0';
        return Number(num).toLocaleString('es-SV', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },

    formatDate(iso) {
        if (!iso) return '-';
        try {
            return new Date(iso).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return iso; }
    },

    sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
window.Flota = Flota;
