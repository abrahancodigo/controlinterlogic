// ===================================
// Interlogic - Routes Module
// ===================================

const InterlogicRoutes = {
    async createRouteFromSelection() {
        const count = this.selectedRecords.size;
        if (count === 0) return;

        const selectedRecords = this.records.filter(r => this.selectedRecords.has(r.id));
        const clientesUnicos = [...new Set(selectedRecords.map(r => (r.cliente || '').trim()).filter(Boolean))];
        const zonasUnicas = [...new Set(selectedRecords.map(r => (r.departamento || r.zona || '').trim()).filter(Boolean))];
        const totalVenta = selectedRecords.reduce((s, r) => s + (Number(r.venta) || 0), 0);

        let repartidoresOpts = '<option value="">Cargando repartidores...</option>';
        try {
            const repSnap = await firebase.firestore().collection('repartidores').orderBy('nombre', 'asc').get();
            const reps = repSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.activo !== false);
            repartidoresOpts = '<option value="">Seleccionar repartidor...</option>' +
                reps.map(r => '<option value="' + r.id + '" data-nombre="' + r.nombre + '" data-vehiculo="' + (r.vehiculo || '') + '" data-zona="' + (r.zona || '') + '">' + r.nombre + ' - ' + (r.vehiculo || '') + ' - ' + (r.zona || '') + '</option>').join('');
        } catch(e) { repartidoresOpts = '<option value="">Error al cargar</option>'; }

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:550px;">
                <h2 style="margin-bottom:0.5rem;">➕ Crear Ruta con ${count} registros</h2>
                <div style="margin-bottom:1rem;font-size:0.85rem;color:#666;">
                    <div>📦 ${count} facturas · ${clientesUnicos.length} cliente(s) · Total: <strong>${formatCurrency(totalVenta)}</strong></div>
                    ${zonasUnicas.length > 0 ? '<div>📍 Zona(s): ' + zonasUnicas.join(', ') + '</div>' : ''}
                </div>
                <form id="cr-ruta-form">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div class="form-group">
                            <label>Fecha de Ruta</label>
                            <input type="date" id="cr-fecha" value="${getLocalDateString()}">
                        </div>
                        <div class="form-group">
                            <label>Repartidor</label>
                            <select id="cr-repartidor">${repartidoresOpts}</select>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                        <div class="form-group">
                            <label>Vehículo (Placa)</label>
                            <input type="text" id="cr-vehiculo" placeholder="Ej: P-4567">
                        </div>
                        <div class="form-group">
                            <label>Zona</label>
                            <input type="text" id="cr-zona" value="${sanitizeHTML(zonasUnicas[0] || '')}" placeholder="Zona de la ruta">
                        </div>
                    </div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="cr-save-btn">💾 Crear Ruta y Asignar</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        const repSelect = document.getElementById('cr-repartidor');
        const vehiculoInput = document.getElementById('cr-vehiculo');
        const zonaInput = document.getElementById('cr-zona');
        if (repSelect) repSelect.addEventListener('change', () => {
            const opt = repSelect.selectedOptions[0];
            if (opt && opt.dataset.vehiculo) vehiculoInput.value = opt.dataset.vehiculo;
            if (opt && opt.dataset.zona && !zonaInput.value) zonaInput.value = opt.dataset.zona;
        });

        document.getElementById('cr-ruta-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('cr-save-btn');
            setButtonLoading(btn, true);
            try {
                const fechaVal = document.getElementById('cr-fecha').value;
                const repId = document.getElementById('cr-repartidor').value;
                const repOpt = document.getElementById('cr-repartidor').selectedOptions[0];
                const vehiculo = document.getElementById('cr-vehiculo').value.trim();
                const zona = document.getElementById('cr-zona').value.trim();
                let fbDate = firebase.firestore.Timestamp.now();
                if (fechaVal) { const [y,m,d] = fechaVal.split('-').map(Number); fbDate = firebase.firestore.Timestamp.fromDate(new Date(y,m-1,d,12,0,0)); }

                const db = firebase.firestore();
                const routeRef = db.collection('rutas').doc();

                const routeData = {
                    fecha: fbDate,
                    repartidorId: repId,
                    repartidorNombre: repOpt ? repOpt.dataset.nombre : '',
                    vehiculo: vehiculo,
                    zona: zona,
                    estado: 'pendiente',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                const batch = db.batch();
                batch.set(routeRef, routeData);

                let seq = 0;
                selectedRecords.forEach(r => {
                    seq++;
                    const entregaRef = db.collection('rutaEntregas').doc();
                    batch.set(entregaRef, {
                        rutaId: routeRef.id,
                        interlogicId: r.id,
                        guia: r.guia || '',
                        cliente: r.cliente || '',
                        direccion: r.direccion || '',
                        venta: Number(r.venta) || 0,
                        condicionPago: r.condicionPago || '',
                        costoEnvio: Number(r.costoEnvio) || 0,
                        montoCobrado: Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0)) || 0,
                        estadoCobro: r.estadoCobro || (r.cobrado === true ? 'pagado' : 'pendiente'),
                        entregado: r.entregado === true,
                        horaEntrega: r.horaEntrega || '',
                        telefono: r.telefono || '',
                        sequence: seq,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    batch.update(db.collection('interlogic').doc(r.id), {
                        rutaId: routeRef.id,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });

                await batch.commit();

                this.selectedRecords.clear();
                this.applyFilters();
                modal.remove();
                showToast('✅ Ruta creada con ' + count + ' registros asignados', 'success');
            } catch (err) {
                console.error('Error creating route:', err);
                showToast('Error: ' + err.message, 'error');
                setButtonLoading(btn, false);
            }
        });
    }
};

window.InterlogicRoutes = InterlogicRoutes;
