// ===================================
// Flota - Maintenance Module
// ===================================

const FlotaMaintenance = {
    renderMantenimiento() {
        const container = document.getElementById('flota-content');
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;
        let filteredMantenimientos = this.mantenimientos;
        if (this.selectedVehiculoId) {
            filteredMantenimientos = this.mantenimientos.filter(m => m.vehiculoId === this.selectedVehiculoId);
        }
        const v = this.selectedVehiculoId ? this.vehiculos.find(x => x.id === this.selectedVehiculoId) : null;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <div>
                    <h2 style="margin:0;">🔧 Mantenimiento ${v ? '- ' + this.sanitize(v.nombre) : ''}</h2>
                    <span style="font-size:0.85rem;color:var(--text-secondary);">${filteredMantenimientos.length} registros</span>
                </div>
                <div style="display:flex;gap:0.5rem;">
                    ${this.selectedVehiculoId ? `<button class="btn btn-secondary" id="btn-clear-vehiculo-filter"> Ver Todos</button>` : ''}
                    ${canEdit ? `<button class="btn btn-primary" id="btn-nuevo-mantenimiento">+ Nuevo</button>` : ''}
                </div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr><th>Fecha</th><th>Vehículo</th><th>Tipo</th><th>Descripción</th><th>Costo</th><th>Taller</th><th>Próx. Mantenimiento</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                        ${filteredMantenimientos.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:2rem;">No hay mantenimientos registrados</td></tr>' :
                        filteredMantenimientos.map(m => {
                            const vehiculo = this.vehiculos.find(v => v.id === m.vehiculoId);
                            return `<tr>
                                <td>${m.fecha && m.fecha.toDate ? m.fecha.toDate().toLocaleDateString('es-ES') : '-'}</td>
                                <td><strong>${vehiculo ? this.sanitize(vehiculo.nombre) : '-'}</strong></td>
                                <td><span class="badge badge-accent">${m.tipo || '-'}</span></td>
                                <td>${this.sanitize(m.descripcion || '-')}</td>
                                <td>${formatCurrency(m.costo || 0)}</td>
                                <td>${this.sanitize(m.taller || '-')}</td>
                                <td>${m.fechaProximoMantenimiento && m.fechaProximoMantenimiento.toDate ? m.fechaProximoMantenimiento.toDate().toLocaleDateString('es-ES') : '-'}</td>
                                <td class="actions-cell">
                                    <button class="btn-icon btn-secondary btn-edit-mantenimiento" data-id="${m.id}" title="Editar">✏️</button>
                                    ${window.permissions?.canDelete ? `<button class="btn-icon btn-danger btn-delete-mantenimiento" data-id="${m.id}" title="Eliminar">🗑️</button>` : ''}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (this.selectedVehiculoId) document.getElementById('btn-clear-vehiculo-filter')?.addEventListener('click', () => { this.selectedVehiculoId = null; this.renderMantenimiento(); });
        if (canEdit) document.getElementById('btn-nuevo-mantenimiento')?.addEventListener('click', () => this.showModalMantenimiento());
        document.querySelectorAll('.btn-edit-mantenimiento').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const m = this.mantenimientos.find(x => x.id === btn.dataset.id);
                if (m) this.showModalMantenimiento(m);
            });
        });
        document.querySelectorAll('.btn-delete-mantenimiento').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await showConfirm('¿Eliminar mantenimiento?', 'Esta acción no se puede deshacer.')) {
                    await firebase.firestore().collection('mantenimientos').doc(btn.dataset.id).delete();
                    showToast('Mantenimiento eliminado', 'success');
                }
            });
        });
    },

    renderMantenimientoMobile() {
        const container = document.getElementById('flota-content-mobile');
        if (!container) return;
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;
        let filteredMantenimientos = this.mantenimientos;
        if (this.selectedVehiculoId) {
            filteredMantenimientos = this.mantenimientos.filter(m => m.vehiculoId === this.selectedVehiculoId);
        }
        const v = this.selectedVehiculoId ? this.vehiculos.find(x => x.id === this.selectedVehiculoId) : null;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                <strong>${filteredMantenimientos.length} mant. ${v ? '(' + this.sanitize(v.nombre) + ')' : ''}</strong>
                ${canEdit ? `<button class="btn btn-primary btn-sm" id="btn-nuevo-manto-m">+ Nuevo</button>` : ''}
            </div>
            ${filteredMantenimientos.length === 0 ? '<div style="text-align:center;padding:2rem;color:#8e8e93;">No hay mantenimientos</div>' :
            filteredMantenimientos.map(m => {
                const vehiculo = this.vehiculos.find(v => v.id === m.vehiculoId);
                return `<div style="background:white;border:1px solid #e5e5ea;border-radius:12px;padding:0.75rem;margin-bottom:0.5rem;">
                    <div style="display:flex;justify-content:space-between;"><strong>${vehiculo ? this.sanitize(vehiculo.nombre) : '-'}</strong><span style="color:#22c55e;font-weight:700;">${formatCurrency(m.costo || 0)}</span></div>
                    <div style="font-size:0.78rem;color:#8e8e93;margin-top:0.2rem;">${m.fecha && m.fecha.toDate ? m.fecha.toDate().toLocaleDateString('es-ES') : ''} · ${m.tipo || ''} · ${this.sanitize(m.taller || '')}</div>
                    <div style="font-size:0.78rem;margin-top:0.2rem;">${this.sanitize(m.descripcion || '')}</div>
                </div>`;
            }).join('')}
        `;
        document.getElementById('btn-nuevo-manto-m')?.addEventListener('click', () => this.showModalMantenimiento());
    },

    showModalMantenimiento(mant) {
        const isEdit = !!mant;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h2 style="margin-bottom:1rem;">${isEdit ? '✏️ Editar' : '➕ Nuevo'} Mantenimiento</h2>
                <form id="mant-form">
                    <div class="form-group"><label>Vehículo</label><select id="m-vehiculo" required>${this.vehiculos.map(v => `<option value="${v.id}" ${mant?.vehiculoId === v.id ? 'selected' : ''}>${this.sanitize(v.nombre)}</option>`).join('')}</select></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group"><label>Fecha</label><input type="date" id="m-fecha" value="${mant?.fecha ? (mant.fecha.toDate ? formatDateForInput(mant.fecha.toDate()) : formatDateForInput(new Date(mant.fecha))) : formatDateForInput(new Date())}" required></div>
                        <div class="form-group"><label>Tipo</label><select id="m-tipo"><option value="preventivo"${mant?.tipo==='preventivo'?' selected':''}>Preventivo</option><option value="correctivo"${mant?.tipo==='correctivo'?' selected':''}>Correctivo</option><option value="emergencia"${mant?.tipo==='emergencia'?' selected':''}>Emergencia</option></select></div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;"><label>Descripción</label><textarea id="m-descripcion" rows="3" required>${this.sanitize(mant?.descripcion || '')}</textarea></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group"><label>Costo ($)</label><input type="number" id="m-costo" step="0.01" value="${mant?.costo || 0}"></div>
                        <div class="form-group"><label>Taller</label><input type="text" id="m-taller" value="${this.sanitize(mant?.taller || '')}"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group"><label>Proveedor</label><select id="m-proveedor"><option value="">Ninguno</option>${this.proveedores.map(p => `<option value="${p.id}" ${mant?.proveedorId === p.id ? 'selected' : ''}>${this.sanitize(p.nombre)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Próx. Mantenimiento</label><input type="date" id="m-proximo" value="${mant?.fechaProximoMantenimiento ? (mant.fechaProximoMantenimiento.toDate ? formatDateForInput(mant.fechaProximoMantenimiento.toDate()) : formatDateForInput(new Date(mant.fechaProximoMantenimiento))) : ''}"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group"><label>Kilometraje Actual</label><input type="number" id="m-km" value="${mant?.kilometraje || this.vehiculos.find(v => v.id === mant?.vehiculoId)?.kilometrajeActual || 0}"></div>
                        <div class="form-group"><label>No. Factura</label><input type="text" id="m-factura" value="${this.sanitize(mant?.numeroFactura || '')}"></div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;"><label>Notas</label><textarea id="m-notas" rows="2">${this.sanitize(mant?.notas || '')}</textarea></div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar Cambios' : 'Crear Mantenimiento'}</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        document.getElementById('mant-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fechaVal = document.getElementById('m-fecha').value;
            const [y, m, d] = fechaVal.split('-').map(Number);
            const data = {
                vehiculoId: document.getElementById('m-vehiculo').value,
                fecha: firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0)),
                tipo: document.getElementById('m-tipo').value,
                descripcion: document.getElementById('m-descripcion').value.trim(),
                costo: parseFloat(document.getElementById('m-costo').value) || 0,
                taller: document.getElementById('m-taller').value.trim(),
                proveedorId: document.getElementById('m-proveedor').value || null,
                kilometraje: parseInt(document.getElementById('m-km').value) || 0,
                numeroFactura: document.getElementById('m-factura').value.trim(),
                notas: document.getElementById('m-notas').value.trim(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const proxVal = document.getElementById('m-proximo').value;
            if (proxVal) {
                const [py, pm, pd] = proxVal.split('-').map(Number);
                data.fechaProximoMantenimiento = firebase.firestore.Timestamp.fromDate(new Date(py, pm - 1, pd, 12, 0, 0));
            }
            try {
                if (isEdit) {
                    await firebase.firestore().collection('mantenimientos').doc(mant.id).update(data);
                    showToast('Mantenimiento actualizado', 'success');
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await firebase.firestore().collection('mantenimientos').add(data);
                    showToast('Mantenimiento creado', 'success');
                }
                modal.remove();
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
            }
        });
    }
};

window.FlotaMaintenance = FlotaMaintenance;
