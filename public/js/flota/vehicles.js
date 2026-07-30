// ===================================
// Flota - Vehicles Module
// ===================================

const FlotaVehicles = {
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
                const v = this.vehiculos.find(x => x.id === row.dataset.id);
                if (v) this.showVehiculoDetail(v);
            });
        });
        document.querySelectorAll('.btn-edit-vehiculo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const v = this.vehiculos.find(x => x.id === btn.dataset.id);
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
                const v = this.vehiculos.find(x => x.id === card.dataset.id);
                if (v) this.showVehiculoDetail(v);
            });
        });
        document.querySelectorAll('.btn-edit-vehiculo-m').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const v = this.vehiculos.find(x => x.id === b.dataset.id);
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

    showVehiculoDetail(vehiculo) {
        const fotosVehiculo = vehiculo.fotosVehiculo || (vehiculo.fotoVehiculo ? [vehiculo.fotoVehiculo] : []);
        const fotosTarjeta = vehiculo.fotosTarjeta || (vehiculo.fotoTarjetaCirculacion ? [vehiculo.fotoTarjetaCirculacion] : []);
        const dias = this.diasParaVencimiento(vehiculo.fechaVencimientoCirculacion);

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:650px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h2 style="margin:0;">${this.sanitize(vehiculo.nombre || 'Vehiculo')}</h2>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()" style="padding:0.2rem 0.6rem;font-size:1.2rem;">&times;</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                    <div><span style="color:#8e8e93;font-size:0.8rem;">Placa</span><br><strong>${this.sanitize(vehiculo.numeroPlaca || '-')}</strong></div>
                    <div><span style="color:#8e8e93;font-size:0.8rem;">Tipo</span><br><strong>${this.sanitize(vehiculo.tipoVehiculo || '-')}</strong></div>
                    <div><span style="color:#8e8e93;font-size:0.8rem;">Capacidad</span><br><strong>${this.sanitize(vehiculo.capacidad || '-')}</strong></div>
                    <div><span style="color:#8e8e93;font-size:0.8rem;">Combustible</span><br><strong>${this.sanitize(vehiculo.tipoCombustible || '-')}</strong></div>
                    <div><span style="color:#8e8e93;font-size:0.8rem;">Kilometraje</span><br><strong>${this.formatNumber(vehiculo.kilometrajeActual || 0)} km</strong></div>
                    <div><span style="color:#8e8e93;font-size:0.8rem;">Estado</span><br><span class="badge ${vehiculo.estado === 'activo' ? 'badge-success' : (vehiculo.estado === 'en_mantenimiento' ? 'badge-warning' : 'badge-error')}">${vehiculo.estado === 'activo' ? 'Activo' : (vehiculo.estado === 'en_mantenimiento' ? 'En Taller' : 'Fuera Servicio')}</span></div>
                    <div style="grid-column:1/-1;border-top:1px solid #e5e5ea;padding-top:0.5rem;"><span style="color:#8e8e93;font-size:0.8rem;">No. Circulacion</span><br><strong>${this.sanitize(vehiculo.numeroCirculacion || '-')}</strong></div>
                    <div><span style="color:#8e8e93;font-size:0.8rem;">Venc. Circulacion</span><br><span class="badge ${dias <= 0 ? 'badge-error' : (dias <= 30 ? 'badge-warning' : 'badge-success')}">${dias <= 0 ? 'VENCIDA' : (dias === 9999 ? 'Sin fecha' : dias + ' dias restantes')}</span></div>
                    <div><span style="color:#8e8e93;font-size:0.8rem;">F. Vencimiento</span><br><strong>${this.formatDate(vehiculo.fechaVencimientoCirculacion)}</strong></div>
                </div>
                <hr style="margin:1rem 0;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <div>
                        <h4 style="margin:0 0 0.5rem;">Fotos del Vehiculo</h4>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                            ${fotosVehiculo.length === 0 ? '<span style="font-size:0.8rem;color:#8e8e93;">Sin fotos</span>' :
                            fotosVehiculo.map((url, i) => `
                                <div class="dv-foto-thumb" data-url="${url}" style="cursor:pointer;">
                                    <img src="${url}" alt="Foto vehiculo ${i+1}" loading="lazy" style="width:100%;height:70px;object-fit:cover;border-radius:6px;border:1px solid #e5e5ea;">
                                    <span style="display:block;text-align:center;font-size:0.65rem;color:#8e8e93;">${i+1}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div>
                        <h4 style="margin:0 0 0.5rem;">Fotos Tarjeta de Circulacion</h4>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                            ${fotosTarjeta.length === 0 ? '<span style="font-size:0.8rem;color:#8e8e93;">Sin fotos</span>' :
                            fotosTarjeta.map((url, i) => `
                                <div class="dv-foto-thumb" data-url="${url}" style="cursor:pointer;">
                                    <img src="${url}" alt="Foto tarjeta ${i+1}" loading="lazy" style="width:100%;height:70px;object-fit:cover;border-radius:6px;border:1px solid #e5e5ea;">
                                    <span style="display:block;text-align:center;font-size:0.65rem;color:#8e8e93;">${i+1}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cerrar</button>
                    <button class="btn btn-primary" id="dv-edit">Editar</button>
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

    showModalVehiculo(vehiculo) {
        const isEdit = !!vehiculo;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:550px;">
                <h2 style="margin-bottom:1rem;">${isEdit ? '✏️ Editar' : '➕ Nuevo'} Vehículo</h2>
                <form id="vehiculo-form">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div class="form-group"><label>Nombre</label><input type="text" id="v-nombre" value="${this.sanitize(vehiculo?.nombre || '')}" required></div>
                        <div class="form-group"><label>N° Placa</label><input type="text" id="v-placa" value="${this.sanitize(vehiculo?.numeroPlaca || '')}"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group"><label>Tipo Vehículo</label><select id="v-tipo"><option value="camion"${vehiculo?.tipoVehiculo==='camion'?' selected':''}>Camión</option><option value="camioneta"${vehiculo?.tipoVehiculo==='camioneta'?' selected':''}>Camioneta</option><option value="furgon"${vehiculo?.tipoVehiculo==='furgon'?' selected':''}>Furgón</option><option value="moto"${vehiculo?.tipoVehiculo==='moto'?' selected':''}>Moto</option><option value="otro"${vehiculo?.tipoVehiculo==='otro'?' selected':''}>Otro</option></select></div>
                        <div class="form-group"><label>Capacidad</label><input type="text" id="v-capacidad" value="${this.sanitize(vehiculo?.capacidad || '')}" placeholder="Ej: 2 toneladas"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group"><label>Combustible</label><select id="v-combustible"><option value="diesel"${vehiculo?.tipoCombustible==='diesel'?' selected':''}>Diésel</option><option value="gasolina"${vehiculo?.tipoCombustible==='gasolina'?' selected':''}>Gasolina</option><option value="electricidad"${vehiculo?.tipoCombustible==='electricidad'?' selected':''}>Electricidad</option></select></div>
                        <div class="form-group"><label>Kilometraje Actual</label><input type="number" id="v-km" value="${vehiculo?.kilometrajeActual || 0}"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group"><label>N° Circulación</label><input type="text" id="v-circulacion" value="${this.sanitize(vehiculo?.numeroCirculacion || '')}"></div>
                        <div class="form-group"><label>Venc. Circulación</label><input type="date" id="v-venc-circulacion" value="${vehiculo?.fechaVencimientoCirculacion ? (vehiculo.fechaVencimientoCirculacion.toDate ? formatDateForInput(vehiculo.fechaVencimientoCirculacion.toDate()) : formatDateForInput(new Date(vehiculo.fechaVencimientoCirculacion))) : ''}"></div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;"><label>Estado</label><select id="v-estado"><option value="activo"${vehiculo?.estado==='activo'?' selected':''}>Activo</option><option value="en_mantenimiento"${vehiculo?.estado==='en_mantenimiento'?' selected':''}>En Mantenimiento</option><option value="fuera_servicio"${vehiculo?.estado==='fuera_servicio'?' selected':''}>Fuera de Servicio</option></select></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Notas</label><textarea id="v-notas" rows="2">${this.sanitize(vehiculo?.notas || '')}</textarea></div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar Cambios' : 'Crear Vehículo'}</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        document.getElementById('vehiculo-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                nombre: document.getElementById('v-nombre').value.trim(),
                numeroPlaca: document.getElementById('v-placa').value.trim(),
                tipoVehiculo: document.getElementById('v-tipo').value,
                capacidad: document.getElementById('v-capacidad').value.trim(),
                tipoCombustible: document.getElementById('v-combustible').value,
                kilometrajeActual: parseInt(document.getElementById('v-km').value) || 0,
                numeroCirculacion: document.getElementById('v-circulacion').value.trim(),
                estado: document.getElementById('v-estado').value,
                notas: document.getElementById('v-notas').value.trim(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const vencVal = document.getElementById('v-venc-circulacion').value;
            if (vencVal) {
                const [y, m, d] = vencVal.split('-').map(Number);
                data.fechaVencimientoCirculacion = firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
            }

            try {
                if (isEdit) {
                    await firebase.firestore().collection('vehiculos').doc(vehiculo.id).update(data);
                    showToast('Vehículo actualizado', 'success');
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await firebase.firestore().collection('vehiculos').add(data);
                    showToast('Vehículo creado', 'success');
                }
                modal.remove();
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
            }
        });
    },

    renderTalleres() {
        const container = document.getElementById('flota-content');
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;
        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <div>
                    <h2 style="margin:0;">Talleres y Proveedores</h2>
                    <span style="font-size:0.85rem;color:#8e8e93;">${this.proveedores.length} registrados</span>
                </div>
                ${canEdit ? `<button class="btn btn-primary" id="btn-nuevo-proveedor">+ Nuevo Taller</button>` : ''}
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr><th>Nombre</th><th>Tipo</th><th>Telefono</th><th>Direccion</th><th>Email</th><th>Acciones</th></tr>
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
                if (await showConfirm('Eliminar proveedor?', 'Esta accion no se puede deshacer.')) {
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
            ${this.proveedores.map(p => `<div style="background:white;border:1px solid #e5e5ea;border-radius:12px;padding:0.5rem;margin-bottom:0.4rem;">
                <div style="display:flex;justify-content:space-between;">
                    <strong>${this.sanitize(p.nombre)}</strong>
                    <span class="badge badge-accent">${this.sanitize(p.tipo || 'taller')}</span>
                </div>
                <div style="font-size:0.75rem;color:#8e8e93;">${this.sanitize(p.telefono || '-')} ${p.direccion ? '. ' + this.sanitize(p.direccion) : ''}</div>
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
                    <h2 style="margin:0;">${isEdit ? 'Editar Taller' : 'Nuevo Taller'}</h2>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()" style="padding:0.2rem 0.6rem;font-size:1.2rem;">&times;</button>
                </div>
                <div class="form-group"><label>Nombre *</label><input type="text" id="fp-nombre" class="form-control" value="${this.sanitize(proveedor?.nombre || '')}" placeholder="Nombre del taller o mecanico"></div>
                <div class="form-group"><label>Tipo</label><select id="fp-tipo" class="form-control">
                    <option value="taller" ${proveedor?.tipo === 'taller' || !proveedor ? 'selected' : ''}>Taller Mecanico</option>
                    <option value="mecanico" ${proveedor?.tipo === 'mecanico' ? 'selected' : ''}>Mecanico Independiente</option>
                    <option value="lubricentro" ${proveedor?.tipo === 'lubricentro' ? 'selected' : ''}>Lubricentro</option>
                    <option value="refaccionaria" ${proveedor?.tipo === 'refaccionaria' ? 'selected' : ''}>Refaccionaria</option>
                </select></div>
                <div class="form-group"><label>Telefono</label><input type="text" id="fp-telefono" class="form-control" value="${this.sanitize(proveedor?.telefono || '')}"></div>
                <div class="form-group"><label>Email</label><input type="email" id="fp-email" class="form-control" value="${this.sanitize(proveedor?.email || '')}"></div>
                <div class="form-group"><label>Direccion</label><textarea id="fp-direccion" class="form-control" rows="2">${this.sanitize(proveedor?.direccion || '')}</textarea></div>
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
                showToast('Error al guardar', 'error');
            }
        });
    }
};

window.FlotaVehicles = FlotaVehicles;
