// ===================================
// Flota - Orders Module
// ===================================

const FlotaOrders = {
    renderOrdenes() {
        const container = document.getElementById('flota-content');
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;
        const ordenes = this.ordenesTrabajo || [];
        let filteredOrdenes = ordenes;
        if (this.selectedVehiculoId) {
            filteredOrdenes = ordenes.filter(o => o.vehiculoId === this.selectedVehiculoId);
        }
        const v = this.selectedVehiculoId ? this.vehiculos.find(x => x.id === this.selectedVehiculoId) : null;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <div>
                    <h2 style="margin:0;">📋 Órdenes de Trabajo ${v ? '- ' + this.sanitize(v.nombre) : ''}</h2>
                    <span style="font-size:0.85rem;color:var(--text-secondary);">${filteredOrdenes.length} órdenes</span>
                </div>
                <div style="display:flex;gap:0.5rem;">
                    ${this.selectedVehiculoId ? `<button class="btn btn-secondary" id="btn-clear-vehiculo-filter"> Ver Todos</button>` : ''}
                    ${canEdit ? `<button class="btn btn-primary" id="btn-nueva-orden">+ Nueva Orden</button>` : ''}
                </div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr><th>No.</th><th>Fecha</th><th>Vehículo</th><th>Descripción</th><th>Estado</th><th>Prioridad</th><th>Costo Est.</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                        ${filteredOrdenes.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:2rem;">No hay órdenes de trabajo</td></tr>' :
                        filteredOrdenes.map(o => {
                            const vehiculo = this.vehiculos.find(v => v.id === o.vehiculoId);
                            const statusColors = { pendiente: '#f59e0b', enProgreso: '#3b82f6', completada: '#22c55e', cancelada: '#ef4444' };
                            const priorityColors = { baja: '#6b7280', media: '#f59e0b', alta: '#ef4444', urgente: '#dc2626' };
                            return `<tr>
                                <td><strong>${o.numero || '-'}</strong></td>
                                <td>${o.fechaCreacion && o.fechaCreacion.toDate ? o.fechaCreacion.toDate().toLocaleDateString('es-ES') : '-'}</td>
                                <td><strong>${vehiculo ? this.sanitize(vehiculo.nombre) : '-'}</strong></td>
                                <td>${this.sanitize(o.descripcion || '-')}</td>
                                <td><span class="badge" style="background:${statusColors[o.estado] || '#6b7280'}20;color:${statusColors[o.estado] || '#6b7280'};">${o.estado || '-'}</span></td>
                                <td><span class="badge" style="background:${priorityColors[o.prioridad] || '#6b7280'}20;color:${priorityColors[o.prioridad] || '#6b7280'};">${o.prioridad || '-'}</span></td>
                                <td>${formatCurrency(o.costoEstimado || 0)}</td>
                                <td class="actions-cell">
                                    <button class="btn-icon btn-secondary btn-edit-orden" data-id="${o.id}" title="Editar">✏️</button>
                                    <button class="btn-icon btn-secondary btn-view-orden" data-id="${o.id}" title="Ver Detalles">👁️</button>
                                    ${window.permissions?.canDelete ? `<button class="btn-icon btn-danger btn-delete-orden" data-id="${o.id}" title="Eliminar">🗑️</button>` : ''}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (this.selectedVehiculoId) document.getElementById('btn-clear-vehiculo-filter')?.addEventListener('click', () => { this.selectedVehiculoId = null; this.renderOrdenes(); });
        if (canEdit) document.getElementById('btn-nueva-orden')?.addEventListener('click', () => this.showModalOrden());
        document.querySelectorAll('.btn-edit-orden').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const o = (this.ordenesTrabajo || []).find(x => x.id === btn.dataset.id);
                if (o) this.showModalOrden(o);
            });
        });
        document.querySelectorAll('.btn-view-orden').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const o = (this.ordenesTrabajo || []).find(x => x.id === btn.dataset.id);
                if (o) this.showDetalleOrden(o);
            });
        });
        document.querySelectorAll('.btn-delete-orden').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await showConfirm('¿Eliminar orden de trabajo?', 'Esta acción no se puede deshacer.')) {
                    await firebase.firestore().collection('ordenesTrabajo').doc(btn.dataset.id).delete();
                    showToast('Orden eliminada', 'success');
                }
            });
        });
    },

    renderOrdenesMobile() {
        const container = document.getElementById('flota-content-mobile');
        if (!container) return;
        const canEdit = window.permissions?.canEdit || window.permissions?.canCreate;
        const ordenesM = this.ordenesTrabajo || [];
        let filteredOrdenes = ordenesM;
        if (this.selectedVehiculoId) {
            filteredOrdenes = ordenesM.filter(o => o.vehiculoId === this.selectedVehiculoId);
        }
        const v = this.selectedVehiculoId ? this.vehiculos.find(x => x.id === this.selectedVehiculoId) : null;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                <strong>${filteredOrdenes.length} ordenes ${v ? '(' + this.sanitize(v.nombre) + ')' : ''}</strong>
                ${canEdit ? `<button class="btn btn-primary btn-sm" id="btn-nueva-orden-m">+ Nueva</button>` : ''}
            </div>
            ${filteredOrdenes.length === 0 ? '<div style="text-align:center;padding:2rem;color:#8e8e93;">No hay órdenes de trabajo</div>' :
            filteredOrdenes.map(o => {
                const vehiculo = this.vehiculos.find(v => v.id === o.vehiculoId);
                const statusColors = { pendiente: '#f59e0b', enProgreso: '#3b82f6', completada: '#22c55e', cancelada: '#ef4444' };
                return `<div style="background:white;border:1px solid #e5e5ea;border-radius:12px;padding:0.75rem;margin-bottom:0.5rem;">
                    <div style="display:flex;justify-content:space-between;"><strong>#${o.numero || '-'} · ${vehiculo ? this.sanitize(vehiculo.nombre) : '-'}</strong><span style="color:${statusColors[o.estado] || '#6b7280'};font-weight:600;">${o.estado || ''}</span></div>
                    <div style="font-size:0.78rem;color:#8e8e93;margin-top:0.2rem;">${o.fechaCreacion && o.fechaCreacion.toDate ? o.fechaCreacion.toDate().toLocaleDateString('es-ES') : ''} · ${o.prioridad || ''} · ${formatCurrency(o.costoEstimado || 0)}</div>
                    <div style="font-size:0.78rem;margin-top:0.2rem;">${this.sanitize(o.descripcion || '')}</div>
                </div>`;
            }).join('')}
        `;
        document.getElementById('btn-nueva-orden-m')?.addEventListener('click', () => this.showModalOrden());
    },

    showModalOrden(orden) {
        const isEdit = !!orden;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:550px;">
                <h2 style="margin-bottom:1rem;">${isEdit ? '✏️ Editar' : '➕ Nueva'} Orden de Trabajo</h2>
                <form id="orden-form">
                    <div class="form-group"><label>Vehículo</label><select id="o-vehiculo" required>${this.vehiculos.map(v => `<option value="${v.id}" ${orden?.vehiculoId === v.id ? 'selected' : ''}>${this.sanitize(v.nombre)}</option>`).join('')}</select></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group"><label>Descripción</label><input type="text" id="o-descripcion" value="${this.sanitize(orden?.descripcion || '')}" required></div>
                        <div class="form-group"><label>Estado</label><select id="o-estado"><option value="pendiente"${orden?.estado==='pendiente'?' selected':''}>Pendiente</option><option value="enProgreso"${orden?.estado==='enProgreso'?' selected':''}>En Progreso</option><option value="completada"${orden?.estado==='completada'?' selected':''}>Completada</option><option value="cancelada"${orden?.estado==='cancelada'?' selected':''}>Cancelada</option></select></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group"><label>Prioridad</label><select id="o-prioridad"><option value="baja"${orden?.prioridad==='baja'?' selected':''}>Baja</option><option value="media"${orden?.prioridad==='media'?' selected':''}>Media</option><option value="alta"${orden?.prioridad==='alta'?' selected':''}>Alta</option><option value="urgente"${orden?.prioridad==='urgente'?' selected':''}>Urgente</option></select></div>
                        <div class="form-group"><label>Costo Estimado ($)</label><input type="number" id="o-costo" step="0.01" value="${orden?.costoEstimado || 0}"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group"><label>Fecha Inicio</label><input type="date" id="o-fechaInicio" value="${orden?.fechaInicio ? (orden.fechaInicio.toDate ? formatDateForInput(orden.fechaInicio.toDate()) : formatDateForInput(new Date(orden.fechaInicio))) : formatDateForInput(new Date())}"></div>
                        <div class="form-group"><label>Fecha Fin Estimada</label><input type="date" id="o-fechaFin" value="${orden?.fechaFinEstimada ? (orden.fechaFinEstimada.toDate ? formatDateForInput(orden.fechaFinEstimada.toDate()) : formatDateForInput(new Date(orden.fechaFinEstimada))) : ''}"></div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;"><label>Descripción Detallada</label><textarea id="o-detalle" rows="3">${this.sanitize(orden?.detalleTrabajo || '')}</textarea></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Repuestos Utilizados</label><textarea id="o-repuestos" rows="2">${this.sanitize(orden?.repuestos || '')}</textarea></div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar Cambios' : 'Crear Orden'}</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        document.getElementById('orden-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                vehiculoId: document.getElementById('o-vehiculo').value,
                descripcion: document.getElementById('o-descripcion').value.trim(),
                estado: document.getElementById('o-estado').value,
                prioridad: document.getElementById('o-prioridad').value,
                costoEstimado: parseFloat(document.getElementById('o-costo').value) || 0,
                detalleTrabajo: document.getElementById('o-detalle').value.trim(),
                repuestos: document.getElementById('o-repuestos').value.trim(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const fiVal = document.getElementById('o-fechaInicio').value;
            if (fiVal) {
                const [fyi, fmi, fdi] = fiVal.split('-').map(Number);
                data.fechaInicio = firebase.firestore.Timestamp.fromDate(new Date(fyi, fmi - 1, fdi, 12, 0, 0));
            }
            const ffVal = document.getElementById('o-fechaFin').value;
            if (ffVal) {
                const [fyf, fmf, fdf] = ffVal.split('-').map(Number);
                data.fechaFinEstimada = firebase.firestore.Timestamp.fromDate(new Date(fyf, fmf - 1, fdf, 12, 0, 0));
            }
            try {
                if (isEdit) {
                    await firebase.firestore().collection('ordenesTrabajo').doc(orden.id).update(data);
                    showToast('Orden actualizada', 'success');
                } else {
                    data.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
                    data.numero = 'OT-' + Date.now();
                    await firebase.firestore().collection('ordenesTrabajo').add(data);
                    showToast('Orden creada', 'success');
                }
                modal.remove();
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
            }
        });
    },

    showDetalleOrden(orden) {
        const vehiculo = this.vehiculos.find(v => v.id === orden.vehiculoId);
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:10000;';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:600px;background:white;border-radius:12px;padding:1.5rem;max-height:80vh;overflow-y:auto;">
                <h2 style="margin-bottom:1rem;">📋 Orden #${orden.numero || '-'}</h2>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                    <div><label style="font-size:0.8rem;color:#6b7280;">Vehículo</label><p>${vehiculo ? this.sanitize(vehiculo.nombre) : '-'}</p></div>
                    <div><label style="font-size:0.8rem;color:#6b7280;">Estado</label><p>${orden.estado || '-'}</p></div>
                    <div><label style="font-size:0.8rem;color:#6b7280;">Prioridad</label><p>${orden.prioridad || '-'}</p></div>
                    <div><label style="font-size:0.8rem;color:#6b7280;">Costo Estimado</label><p>${formatCurrency(orden.costoEstimado || 0)}</p></div>
                    <div><label style="font-size:0.8rem;color:#6b7280;">Fecha Creación</label><p>${orden.fechaCreacion && orden.fechaCreacion.toDate ? orden.fechaCreacion.toDate().toLocaleDateString('es-ES') : '-'}</p></div>
                    <div><label style="font-size:0.8rem;color:#6b7280;">Fecha Inicio</label><p>${orden.fechaInicio && orden.fechaInicio.toDate ? orden.fechaInicio.toDate().toLocaleDateString('es-ES') : '-'}</p></div>
                    <div><label style="font-size:0.8rem;color:#6b7280;">Fecha Fin Estimada</label><p>${orden.fechaFinEstimada && orden.fechaFinEstimada.toDate ? orden.fechaFinEstimada.toDate().toLocaleDateString('es-ES') : '-'}</p></div>
                </div>
                <div style="margin-bottom:1rem;"><label style="font-size:0.8rem;color:#6b7280;">Descripción</label><p>${this.sanitize(orden.descripcion || '-')}</p></div>
                <div style="margin-bottom:1rem;"><label style="font-size:0.8rem;color:#6b7280;">Detalle del Trabajo</label><p style="white-space:pre-wrap;">${this.sanitize(orden.detalleTrabajo || '-')}</p></div>
                <div style="margin-bottom:1rem;"><label style="font-size:0.8rem;color:#6b7280;">Repuestos</label><p style="white-space:pre-wrap;">${this.sanitize(orden.repuestos || '-')}</p></div>
                <div style="text-align:right;margin-top:1.5rem;"><button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cerrar</button></div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
    },

    printOT(orden) {
        const vehiculo = this.vehiculos.find(v => v.id === orden.vehiculoId);
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>OT ${orden.numero || ''}</title><style>
            body{font-family:Arial,sans-serif;padding:2rem;font-size:12px;}
            h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:0.5rem;}
            h2{font-size:14px;margin-top:1rem;}
            table{width:100%;border-collapse:collapse;margin-top:0.5rem;}
            td,th{border:1px solid #ccc;padding:0.4rem;text-align:left;}
            th{background:#f0f0f0;}
            .section{margin-bottom:1rem;}
        </style></head><body>
        <h1>Orden de Trabajo: ${orden.numero || 'N/A'}</h1>
        <div class="section">
            <table>
                <tr><th>Fecha Creacion</th><td>${orden.fechaCreacion && orden.fechaCreacion.toDate ? orden.fechaCreacion.toDate().toLocaleDateString('es-ES') : '-'}</td><th>Estado</th><td>${orden.estado || '-'}</td></tr>
                <tr><th>Vehiculo</th><td>${vehiculo ? vehiculo.nombre : '-'}</td><th>Prioridad</th><td>${orden.prioridad || '-'}</td></tr>
                <tr><th>Fecha Inicio</th><td>${orden.fechaInicio && orden.fechaInicio.toDate ? orden.fechaInicio.toDate().toLocaleDateString('es-ES') : '-'}</td><th>Fecha Fin Est.</th><td>${orden.fechaFinEstimada && orden.fechaFinEstimada.toDate ? orden.fechaFinEstimada.toDate().toLocaleDateString('es-ES') : '-'}</td></tr>
                <tr><th>Costo Estimado</th><td colspan="3">$${(orden.costoEstimado || 0).toFixed(2)}</td></tr>
            </table>
        </div>
        <div class="section"><h2>Descripcion</h2><p>${this.sanitize(orden.descripcion || '-')}</p></div>
        <div class="section"><h2>Detalle del Trabajo</h2><p>${this.sanitize(orden.detalleTrabajo || '-')}</p></div>
        <div class="section"><h2>Repuestos</h2><p>${this.sanitize(orden.repuestos || '-')}</p></div>
        <script>window.onload=function(){window.print();}<\/script>
        </body></html>`);
        win.document.close();
    }
};

window.FlotaOrders = FlotaOrders;
