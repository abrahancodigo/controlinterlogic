// ===================================
// Liquidación de Ruta Module
// Reconciliación COD, fletes, comisión repartidor
// ===================================

const Liquidacion = {
    routes: [],
    routeDeliveries: [],
    repartidores: [],
    liquidaciones: [],
    currentRouteId: null,
    unsubscribeRoutes: null,
    unsubscribeDeliveries: null,

    async render() {
        if (window.innerWidth <= 768) return this.renderMobile();
        return this.renderDesktop();
    },

    async renderDesktop() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>🧾 Liquidación de Ruta</h1>
                    <p>Reconciliación de entregas, COD, fletes y comisiones</p>
                </div>
            </div>

            <div class="stats-grid" style="margin-bottom:1rem;" id="liq-stats">
                <div class="stat-card"><h3>Rutas Hoy</h3><p id="liq-stat-rutas">0</p></div>
                <div class="stat-card"><h3>Pendientes Liquidar</h3><p id="liq-stat-pendientes" style="color:#f97316;">0</p></div>
                <div class="stat-card"><h3>Total Liquidado Hoy</h3><p id="liq-stat-liquidado" style="color:#22c55e;">$0.00</p></div>
            </div>

            <div class="card" style="margin-bottom:1rem;">
                <div class="card-body">
                    <div style="display:flex;gap:1rem;align-items:center;">
                        <div class="form-group" style="flex:1;margin-bottom:0;">
                            <label>Seleccionar Ruta a Liquidar</label>
                            <select id="liq-route-select" style="width:100%;padding:0.6rem;">
                                <option value="">-- Seleccionar ruta --</option>
                            </select>
                        </div>
                        <button class="btn btn-secondary" id="liq-btn-nueva-ruta" style="margin-top:1.5rem;">➕ Nueva Ruta</button>
                    </div>
                </div>
            </div>

            <div id="liq-route-detail">
                <div style="text-align:center;padding:2rem;color:#8e8e93;">Selecciona una ruta para ver su detalle y liquidar</div>
            </div>
        `;

        document.getElementById('liq-btn-nueva-ruta').addEventListener('click', () => this.showCrearRuta());

        await this.loadData();
    },

    async loadData() {
        const db = firebase.firestore();

        const loadRoutes = new Promise((resolve) => {
            if (this.unsubscribeRoutes) this.unsubscribeRoutes();
            this.unsubscribeRoutes = db.collection('rutas').orderBy('fecha', 'desc').onSnapshot(snap => {
                this.routes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.populateRouteSelect();
                this.updateStats();
                resolve();
            }, err => {
                console.error('Error loading rutas:', err);
                showToast('Error al cargar rutas: ' + err.message, 'error');
                resolve();
            });
        });

        db.collection('repartidores').orderBy('nombre', 'asc').onSnapshot(snap => {
            this.repartidores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, err => console.error('Error loading repartidores:', err));

        db.collection('liquidaciones').orderBy('createdAt', 'desc').onSnapshot(snap => {
            this.liquidaciones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.updateStats();
        }, err => console.error('Error loading liquidaciones:', err));

        await loadRoutes;

        const select = document.getElementById('liq-route-select');
        if (select) select.addEventListener('change', (e) => this.loadRouteDetail(e.target.value));
    },

    populateRouteSelect() {
        const select = document.getElementById('liq-route-select');
        if (!select) return;
        const currentVal = select.value;
        const rutasPendientes = this.routes.filter(r => r.estado !== 'liquidado');
        select.innerHTML = '<option value="">-- Seleccionar ruta (' + rutasPendientes.length + ' pendientes) --</option>';
        this.routes.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            const fecha = r.fecha && r.fecha.toDate ? r.fecha.toDate().toLocaleDateString('es-ES') : '';
            opt.textContent = `Ruta #${r.id.substring(0,6)} - ${r.repartidorNombre||'Sin repartidor'} - ${fecha} - ${r.estado||'pendiente'}`;
            if (r.estado === 'liquidado') opt.style.color = '#22c55e';
            select.appendChild(opt);
        });
        if (currentVal) select.value = currentVal;
    },

    updateStats() {
        const hoy = getLocalDateString();
        const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        set('liq-stat-rutas', this.routes.length);
        set('liq-stat-pendientes', this.routes.filter(r => r.estado !== 'liquidado').length);
        const hoyLiquidado = this.liquidaciones.filter(l => {
            const d = l.fecha && l.fecha.toDate ? l.fecha.toDate().toISOString().split('T')[0] : '';
            return d === hoy;
        }).reduce((s, l) => s + (Number(l.efectivoDepositado) || 0), 0);
        set('liq-stat-liquidado', '$' + formatNumber(hoyLiquidado, 2));
    },

    async loadRouteDetail(routeId) {
        this.currentRouteId = routeId;
        const container = document.getElementById('liq-route-detail');
        if (!container) return;
        if (!routeId) { container.innerHTML = '<div style="text-align:center;padding:2rem;color:#8e8e93;">Selecciona una ruta para ver su detalle y liquidar</div>'; return; }

        if (this.unsubscribeDeliveries) this.unsubscribeDeliveries();

        return new Promise((resolve) => {
            this.unsubscribeDeliveries = firebase.firestore().collection('rutaEntregas')
                .where('rutaId', '==', routeId)
                .onSnapshot(snap => {
                    this.routeDeliveries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    this.routeDeliveries.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
                    this.renderRouteDetail();
                    resolve();
                }, err => { console.error('Error loading deliveries:', err); resolve(); });
        });
    },

    renderRouteDetail() {
        const container = document.getElementById('liq-route-detail');
        if (!container || !this.currentRouteId) return;

        const route = this.routes.find(r => r.id === this.currentRouteId);
        if (!route) return;

        const repartidor = this.repartidores.find(r => r.id === route.repartidorId);
        const comisionPct = repartidor ? (repartidor.comisionPct ?? 70) : 70;

        const delivers = this.routeDeliveries;
        const entregados = delivers.filter(d => d.entregado === true);
        const totalFacturado = entregados.reduce((s, d) => s + (Number(d.venta) || 0), 0);
        const codEsperado = entregados.filter(d => d.condicionPago === 'Contado').reduce((s, d) => s + (Number(d.venta) || 0), 0);
        const totalFletes = entregados.reduce((s, d) => s + (Number(d.costoEnvio) || 0), 0);
        const comisionRep = Math.round(totalFletes * comisionPct) / 100;
        const routeDate = route.fecha && route.fecha.toDate ? route.fecha.toDate().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : '-';
        const isLiquidado = route.estado === 'liquidado';
        const existingLiq = !isLiquidado ? null : this.liquidaciones.find(l => l.rutaId === this.currentRouteId);

        let codRecibidoVal = existingLiq ? (existingLiq.totalCOD_recibido || 0) : 0;
        if (!isLiquidado) codRecibidoVal = '';

        container.innerHTML = `
            <div class="card" style="margin-bottom:1rem;">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h2>📍 Ruta #${route.id.substring(0,8).toUpperCase()}${isLiquidado ? ' <span style="color:#22c55e;">(LIQUIDADO)</span>' : ''}</h2>
                        <p style="font-size:0.85rem;color:#666;">${routeDate} · Repartidor: <strong>${sanitizeHTML(route.repartidorNombre||'-')}</strong> · Vehículo: ${sanitizeHTML(route.vehiculo||'-')} · Zona: ${sanitizeHTML(route.zona||'-')}</p>
                    </div>
                    ${isLiquidado ? `<button class="btn btn-secondary" onclick="Liquidacion.printRouteSettlement('${route.id}')">🖨️ Imprimir Liquidación</button>` : ''}
                </div>
                <div class="card-body">
                    ${delivers.length === 0 ? '<p style="text-align:center;padding:1rem;color:#8e8e93;">Esta ruta no tiene entregas asignadas. Ve a Despacho para asignar guías.</p>' : `
                    <div class="table-container">
                        <table class="data-table" style="font-size:0.85rem;">
                            <thead>
                                <tr>
                                    <th>#</th><th>Guía</th><th>Cliente</th><th>Venta</th><th>Pago</th>
                                    <th>Entregado</th><th>Hora</th><th>Flete</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${delivers.map((d, i) => `
                                    <tr style="${d.entregado ? 'background:#f0fdf4;' : 'background:#fef2f2;'}">
                                        <td>${i+1}</td>
                                        <td><strong>${d.guia || ''}</strong></td>
                                        <td>${sanitizeHTML(d.cliente || '')}</td>
                                        <td style="text-align:right;font-weight:700;">$${Number(d.venta||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                                        <td><span class="badge ${d.condicionPago==='Contado'?'badge-primary':'badge-accent'}">${d.condicionPago||''}</span></td>
                                        <td style="text-align:center;">${d.entregado ? '✅' : '❌'}</td>
                                        <td>${d.horaEntrega || '--:--'}</td>
                                        <td style="text-align:right;">$${Number(d.costoEnvio||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`}
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h2>💰 Resumen de Liquidación</h2></div>
                <div class="card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                        <div>
                            <table style="width:100%;font-size:0.85rem;">
                                <tr><td style="padding:6px;border-bottom:1px solid #eee;">Entregas realizadas</td><td style="text-align:right;padding:6px;border-bottom:1px solid #eee;font-weight:bold;">${entregados.length} / ${delivers.length}</td></tr>
                                <tr><td style="padding:6px;border-bottom:1px solid #eee;">Total Facturado</td><td style="text-align:right;padding:6px;border-bottom:1px solid #eee;font-weight:bold;">$${totalFacturado.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
                                <tr><td style="padding:6px;border-bottom:1px solid #eee;">Total Fletes (costo envío)</td><td style="text-align:right;padding:6px;border-bottom:1px solid #eee;">$${totalFletes.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
                                <tr><td style="padding:6px;border-bottom:1px solid #eee;">Comisión Repartidor (${comisionPct}%)</td><td style="text-align:right;padding:6px;border-bottom:1px solid #eee;color:#7c3aed;font-weight:bold;">$${comisionRep.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
                            </table>
                        </div>
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;">
                            <h4 style="margin-bottom:0.5rem;font-size:0.9rem;">Reconciliación COD</h4>
                            <table style="width:100%;font-size:0.85rem;">
                                <tr><td style="padding:6px;">COD Esperado</td><td style="text-align:right;padding:6px;font-weight:bold;">$${codEsperado.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
                                <tr><td style="padding:6px;">COD Recibido</td><td style="text-align:right;padding:6px;">
                                    ${isLiquidado ? `<span>$${formatNumber(codRecibidoVal,2)}</span>` : `<input type="number" id="liq-cod-recibido" step="0.01" min="0" style="width:120px;text-align:right;padding:4px;border:2px solid #e2e8f0;border-radius:4px;" placeholder="0.00">`}
                                </td></tr>
                                <tr style="font-size:1rem;"><td style="padding:6px;font-weight:bold;">Diferencia</td><td id="liq-diferencia" style="text-align:right;padding:6px;font-weight:bold;color:${isLiquidado && (existingLiq?.diferencia||0)!==0?'#ef4444':'#22c55e'};">${isLiquidado ? '$'+formatNumber(existingLiq?.diferencia||0,2) : '$0.00'}</td></tr>
                                <tr style="font-size:0.9rem;font-weight:bold;border-top:2px solid #e2e8f0;"><td style="padding:8px 6px;">Efectivo a Depositar</td><td id="liq-efectivo-depositar" style="text-align:right;padding:8px 6px;color:#22c55e;font-size:1.1rem;">${isLiquidado ? '$'+formatNumber(existingLiq?.efectivoDepositado||0,2) : '$0.00'}</td></tr>
                            </table>
                            ${isLiquidado ? (existingLiq?.observaciones ? `<div style="margin-top:0.5rem;font-size:0.75rem;color:#666;">Obs: ${sanitizeHTML(existingLiq.observaciones)}</div>` : '') : ''}
                        </div>
                    </div>

                    ${!isLiquidado && delivers.length > 0 ? `
                    <div class="form-group" style="margin-top:1rem;">
                        <label>Observaciones</label>
                        <input type="text" id="liq-observaciones" style="width:100%;" placeholder="Notas sobre esta liquidación...">
                    </div>
                    <div style="display:flex;gap:1rem;margin-top:1.5rem;justify-content:flex-end;">
                        <button class="btn btn-primary" id="liq-btn-aprobar" style="font-size:1rem;">✅ Aprobar Liquidación</button>
                        <button class="btn btn-secondary" onclick="Liquidacion.printRouteSettlement('${route.id}')">🖨️ Imprimir</button>
                    </div>` : (isLiquidado ? '' : '<p style="text-align:center;color:#8e8e93;margin-top:1rem;">Esta ruta no tiene entregas para liquidar</p>')}
                </div>
            </div>
        `;

        if (!isLiquidado && delivers.length > 0) {
            const codInput = document.getElementById('liq-cod-recibido');
            if (codInput) {
                const updateCalc = () => {
                    const recibido = parseFloat(codInput.value) || 0;
                    const diff = codEsperado - recibido;
                    const efectivoDepositar = Math.max(0, recibido - comisionRep);
                    const diffEl = document.getElementById('liq-diferencia');
                    if (diffEl) { diffEl.textContent = '$' + formatNumber(Math.abs(diff), 2); diffEl.style.color = diff === 0 ? '#22c55e' : '#ef4444'; }
                    const efectivoEl = document.getElementById('liq-efectivo-depositar');
                    if (efectivoEl) { efectivoEl.textContent = '$' + formatNumber(efectivoDepositar, 2); efectivoEl.style.color = efectivoDepositar >= 0 ? '#22c55e' : '#ef4444'; }
                };
                codInput.addEventListener('input', updateCalc);
                codInput.value = codEsperado;
                updateCalc();
            }

            document.getElementById('liq-btn-aprobar').addEventListener('click', () => this.aprobarLiquidacion(route, codEsperado, totalFletes, totalFacturado, comisionPct, comisionRep));
        }
    },

    async aprobarLiquidacion(route, codEsperado, totalFletes, totalFacturado, comisionPct, comisionRep) {
        const codRecibido = parseFloat(document.getElementById('liq-cod-recibido').value) || 0;
        const diferencia = codEsperado - codRecibido;
        const efectivoDepositar = Math.max(0, codRecibido - comisionRep);
        const observaciones = document.getElementById('liq-observaciones') ? document.getElementById('liq-observaciones').value.trim() : '';

        if (diferencia !== 0) {
            const confirm = await showConfirm('⚠️ Diferencia detectada ($' + formatNumber(Math.abs(diferencia), 2) + ')', '¿Deseas aprobar la liquidación con esta diferencia?');
            if (!confirm) return;
        }

        try {
            const db = firebase.firestore();
            const batch = db.batch();

            const liqData = {
                rutaId: route.id,
                repartidorId: route.repartidorId || '',
                repartidorNombre: route.repartidorNombre || '',
                vehiculo: route.vehiculo || '',
                zona: route.zona || '',
                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                totalFacturado,
                totalCOD_esperado: codEsperado,
                totalCOD_recibido: codRecibido,
                diferencia,
                totalFletes,
                comisionPct,
                comisionRepartidor: comisionRep,
                efectivoDepositado: efectivoDepositar,
                estado: diferencia === 0 ? 'aprobado' : 'disputado',
                observaciones,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: firebase.auth().currentUser?.uid || ''
            };

            batch.set(db.collection('liquidaciones').doc(), liqData);
            batch.update(db.collection('rutas').doc(route.id), {
                estado: 'liquidado',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();
            route.estado = 'liquidado';
            this.populateRouteSelect();
            this.renderRouteDetail();
            showToast('✅ Liquidación aprobada. Efectivo a depositar: $' + formatNumber(efectivoDepositar, 2), 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    },

    showCrearRuta() {
        const repartidores = this.repartidores.filter(r => r.activo !== false);
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h2 style="margin-bottom:1rem;">➕ Nueva Ruta</h2>
                <form id="ruta-form">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div class="form-group">
                            <label>Fecha</label>
                            <input type="date" id="ruta-fecha" value="${getLocalDateString()}">
                        </div>
                        <div class="form-group">
                            <label>Zona</label>
                            <input type="text" id="ruta-zona" placeholder="Ej: San Salvador">
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;">
                        <label>Repartidor</label>
                        <select id="ruta-repartidor" ${repartidores.length===0?'disabled':''}>
                            <option value="">${repartidores.length===0?'No hay repartidores activos':'Seleccionar...'}</option>
                            ${repartidores.map(r => `<option value="${r.id}" data-nombre="${sanitizeHTML(r.nombre||'')}" data-vehiculo="${sanitizeHTML(r.vehiculo||'')}">${sanitizeHTML(r.nombre||'')} - ${sanitizeHTML(r.vehiculo||'')} - ${sanitizeHTML(r.zona||'')}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-top:1rem;">
                        <label>Vehículo</label>
                        <input type="text" id="ruta-vehiculo" placeholder="Placa o modelo" readonly style="background:#f5f5f5;">
                    </div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="ruta-save-btn">Crear Ruta</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        const repSelect = document.getElementById('ruta-repartidor');
        const vehiculoInput = document.getElementById('ruta-vehiculo');
        if (repSelect) repSelect.addEventListener('change', () => {
            const opt = repSelect.selectedOptions[0];
            if (opt) vehiculoInput.value = opt.dataset.vehiculo || '';
            if (!opt) vehiculoInput.value = '';
        });

        document.getElementById('ruta-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('ruta-save-btn');
            setButtonLoading(btn, true);
            try {
                const repId = repSelect.value;
                const repOpt = repSelect.selectedOptions[0];
                const fechaVal = document.getElementById('ruta-fecha').value;
                let fbDate = firebase.firestore.Timestamp.now();
                if (fechaVal) { const [y,m,d] = fechaVal.split('-').map(Number); fbDate = firebase.firestore.Timestamp.fromDate(new Date(y,m-1,d,12,0,0)); }

                const data = {
                    fecha: fbDate,
                    repartidorId: repId,
                    repartidorNombre: repOpt ? repOpt.dataset.nombre : '',
                    vehiculo: document.getElementById('ruta-vehiculo').value,
                    zona: document.getElementById('ruta-zona').value,
                    estado: 'pendiente',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await firebase.firestore().collection('rutas').add(data);
                modal.remove();
                showToast('✅ Ruta creada. Ve a Despacho para asignar guías.', 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); setButtonLoading(btn, false); }
        });
    },

    // ==================== PRINT ====================
    printRouteSettlement(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;

        this.renderRouteDetail();
        setTimeout(() => {
            const printArea = document.getElementById('print-area');
            if (!printArea) return;
            const container = document.getElementById('liq-route-detail');
            if (!container) return;

            printArea.innerHTML = `
                <div style="font-family:Arial,sans-serif;padding:20px;max-width:900px;margin:0 auto;color:#000;">
                    <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px;">
                        <h1 style="margin:0;font-size:1.4rem;">LIQUIDACIÓN DE RUTA</h1>
                        <p style="margin:5px 0 0;font-size:0.85rem;color:#555;">Ruta #${route.id.substring(0,8).toUpperCase()} · ${new Date().toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'})}</p>
                    </div>
                    ${container.querySelector('.card') ? container.querySelector('.card').innerHTML : ''}
                    <div style="margin-top:30px;text-align:center;color:#888;font-size:0.7rem;">Documento generado electrónicamente</div>
                </div>
            `;

            setTimeout(() => window.print(), 100);
        }, 300);
    },

    // ==================== MOBILE ====================
    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div style="padding:0 0 8px 0;"><h1 style="font-size:1.35rem;font-weight:800;">🧾 Liquidación de Ruta</h1><p style="font-size:0.78rem;color:#8e8e93;">Reconciliación de entregas</p></div>
            <div class="m-actions-bar"><button class="btn btn-primary" id="mliq-nueva-ruta" style="border-radius:20px;">➕ Nueva Ruta</button></div>
            <div id="mliq-routes-list" style="margin-top:10px;"><div style="text-align:center;padding:40px;color:#8e8e93;">Cargando...</div></div>
        `;
        document.getElementById('mliq-nueva-ruta').addEventListener('click', () => this.showCrearRuta());
        await this.loadData();
        this.renderMobileRouteList();
    },

    renderMobileRouteList() {
        const list = document.getElementById('mliq-routes-list');
        if (!list) return;
        const pendientes = this.routes.filter(r => r.estado !== 'liquidado');
        const liquidados = this.routes.filter(r => r.estado === 'liquidado');

        list.innerHTML = `
            <div class="m-stats-row" style="margin-bottom:10px;"><div class="m-stat-chip"><div class="m-stat-chip-label">Rutas</div><div class="m-stat-chip-value">${this.routes.length}</div></div><div class="m-stat-chip"><div class="m-stat-chip-label">Pendientes</div><div class="m-stat-chip-value" style="color:#f97316;">${pendientes.length}</div></div></div>
            ${pendientes.length > 0 ? '<div style="font-weight:700;font-size:0.75rem;color:#f97316;margin-bottom:8px;">PENDIENTES DE LIQUIDAR</div>' : ''}
            ${pendientes.map(r => {
                const fecha = r.fecha && r.fecha.toDate ? r.fecha.toDate().toLocaleDateString('es-ES') : '';
                return `<div class="m-data-card" onclick="Liquidacion.loadMobileLiquidacion('${r.id}')"><div class="m-card-header"><span class="m-card-title">Ruta #${r.id.substring(0,6)}</span><span class="m-card-badge warning">Pendiente</span></div><div class="m-card-rows"><div class="m-card-row"><span class="m-card-label">Repartidor</span><span class="m-card-value">${sanitizeHTML(r.repartidorNombre||'-')}</span></div><div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">${fecha}</span></div></div></div>`;
            }).join('')}
            ${liquidados.length > 0 ? '<div style="font-weight:700;font-size:0.75rem;color:#22c55e;margin:12px 0 8px;">LIQUIDADAS</div>' : ''}
            ${liquidados.slice(0,10).map(r => {
                const fecha = r.fecha && r.fecha.toDate ? r.fecha.toDate().toLocaleDateString('es-ES') : '';
                return `<div class="m-data-card" onclick="Liquidacion.loadMobileLiquidacion('${r.id}')"><div class="m-card-header"><span class="m-card-title">Ruta #${r.id.substring(0,6)}</span><span class="m-card-badge success">✓</span></div><div class="m-card-rows"><div class="m-card-row"><span class="m-card-label">Repartidor</span><span class="m-card-value">${sanitizeHTML(r.repartidorNombre||'-')}</span></div><div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">${fecha}</span></div></div></div>`;
            }).join('')}
        `;
    },

    async loadMobileLiquidacion(routeId) {
        this.currentRouteId = routeId;
        await this.loadRouteDetail(routeId);
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;
        const isLiquidado = route.estado === 'liquidado';
        const repartidor = this.repartidores.find(r => r.id === route.repartidorId);
        const comisionPct = repartidor ? (repartidor.comisionPct ?? 70) : 70;
        const delivers = this.routeDeliveries;
        const entregados = delivers.filter(d => d.entregado === true);
        const totalFacturado = entregados.reduce((s,d)=>s+(Number(d.venta)||0),0);
        const codEsperado = entregados.filter(d=>d.condicionPago==='Contado').reduce((s,d)=>s+(Number(d.venta)||0),0);
        const totalFletes = entregados.reduce((s,d)=>s+(Number(d.costoEnvio)||0),0);
        const comisionRep = Math.round(totalFletes * comisionPct) / 100;
        const existingLiq = this.liquidaciones.find(l=>l.rutaId===routeId);

        const sheet = document.createElement('div');
        sheet.innerHTML = `<div class="m-sheet-backdrop show" id="mliq-backdrop" onclick="this.nextElementSibling.remove();this.remove();"></div><div class="m-bottom-sheet show" id="mliq-sheet"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">Ruta #${route.id.substring(0,6)}</span><button class="m-sheet-close" onclick="document.getElementById('mliq-sheet').remove();document.getElementById('mliq-backdrop').remove();">✕</button></div><div class="m-sheet-body"><div style="display:flex;flex-direction:column;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;">Repartidor</span><div>${sanitizeHTML(route.repartidorNombre||'-')} · ${sanitizeHTML(route.vehiculo||'')}</div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;"><div class="m-stat-chip"><div class="m-stat-chip-label">Entregas</div><div class="m-stat-chip-value">${entregados.length}/${delivers.length}</div></div><div class="m-stat-chip"><div class="m-stat-chip-label">Facturado</div><div class="m-stat-chip-value">$${formatNumber(totalFacturado,0)}</div></div><div class="m-stat-chip"><div class="m-stat-chip-label">COD</div><div class="m-stat-chip-value">$${formatNumber(codEsperado,0)}</div></div></div>${delivers.map(d=>`<div class="m-data-card" style="background:${d.entregado?'#f0fdf4':'#fef2f2'}"><div class="m-card-header"><span>#${d.guia||'N/A'} ${sanitizeHTML(d.cliente||'')}</span><span>${d.entregado?'✅':'❌'}</span></div><div class="m-card-rows"><div class="m-card-row"><span class="m-card-label">Venta</span><span class="m-card-value">$${formatNumber(d.venta||0,2)}</span></div><div class="m-card-row"><span class="m-card-label">Flete</span><span class="m-card-value">$${formatNumber(d.costoEnvio||0,2)}</span></div></div></div>`).join('')}</div></div>${isLiquidado?`<div class="m-sheet-footer"><button class="btn btn-secondary" onclick="Liquidacion.printRouteSettlement('${routeId}');">🖨️ Imprimir</button></div>`:`<div class="m-sheet-footer"><button class="btn btn-primary" onclick="Liquidacion.aprobarLiquidacionMobile('${routeId}',${codEsperado},${totalFletes},${totalFacturado},${comisionPct},${comisionRep})">✅ Aprobar</button><button class="btn" onclick="Liquidacion.printRouteSettlement('${routeId}')">🖨️</button></div>`}</div></div>`;
        document.body.appendChild(sheet);
    },

    async aprobarLiquidacionMobile(routeId, codEsperado, totalFletes, totalFacturado, comisionPct, comisionRep) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;
        await this.aprobarLiquidacion(route, codEsperado, totalFletes, totalFacturado, comisionPct, comisionRep);
        const sheet = document.getElementById('mliq-sheet');
        const backdrop = document.getElementById('mliq-backdrop');
        if (sheet) sheet.remove();
        if (backdrop) backdrop.remove();
        this.renderMobileRouteList();
    }
};

window.Liquidacion = Liquidacion;
