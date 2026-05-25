// ===================================
// Cobranza Module - Cuentas por Cobrar
// ===================================

const Cobranza = {
    records: [],
    clientes: [],
    cobros: [],
    currentView: 'dashboard',
    unsubscribeRecords: null,
    unsubscribeCobros: null,

    async render() {
        if (window.innerWidth <= 768) return this.renderMobile();
        return this.renderDesktop();
    },

    async renderDesktop() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>📊 Cobranza y Cuentas por Cobrar</h1>
                    <p>Gestión de cobros, estado de cuenta y antigüedad de saldos</p>
                </div>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn ${this.currentView==='dashboard'?'btn-primary':'btn-secondary'}" id="cob-tab-dashboard">📊 Dashboard</button>
                    <button class="btn ${this.currentView==='estado-cuenta'?'btn-primary':'btn-secondary'}" id="cob-tab-estado">📋 Estado de Cuenta</button>
                    <button class="btn ${this.currentView==='aging'?'btn-primary':'btn-secondary'}" id="cob-tab-aging">📅 Antigüedad</button>
                </div>
            </div>
            <div id="cobranza-content">
                <div style="text-align:center;padding:3rem;">Cargando datos...</div>
            </div>
        `;

        document.getElementById('cob-tab-dashboard').addEventListener('click', () => { this.currentView = 'dashboard'; this.renderDesktop(); });
        document.getElementById('cob-tab-estado').addEventListener('click', () => { this.currentView = 'estado-cuenta'; this.renderDesktop(); });
        document.getElementById('cob-tab-aging').addEventListener('click', () => { this.currentView = 'aging'; this.renderDesktop(); });

        await this.loadData();
        this.renderCurrentView();
    },

    async loadData() {
        const db = firebase.firestore();
        return new Promise((resolve) => {
            let loaded = 0;
            const checkDone = () => { loaded++; if (loaded >= 2) resolve(); };

            if (this.unsubscribeRecords) this.unsubscribeRecords();
            this.unsubscribeRecords = db.collection('interlogic')
                .where('condicionPago', '==', 'Crédito')
                .orderBy('createdAt', 'desc')
                .onSnapshot(snap => {
                    this.records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (loaded < 2) checkDone();
                    else this.renderCurrentView();
                }, err => {
                    console.error('Error loading interlogic:', err);
                    checkDone();
                });

            if (this.unsubscribeCobros) this.unsubscribeCobros();
            this.unsubscribeCobros = db.collection('cobros')
                .orderBy('createdAt', 'desc')
                .onSnapshot(snap => {
                    this.cobros = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (loaded < 2) checkDone();
                    else this.renderCurrentView();
                }, err => {
                    console.error('Error loading cobros:', err);
                    checkDone();
                });

            if (window.Clientes && window.Clientes.loadRecords) {
                window.Clientes.loadRecords().then(() => {
                    this.clientes = window.Clientes.getAll();
                });
            }
        });
    },

    renderCurrentView() {
        if (this.currentView === 'dashboard') this.renderDashboard();
        else if (this.currentView === 'estado-cuenta') this.renderEstadoCuenta();
        else if (this.currentView === 'aging') this.renderAging();
    },

    getCreditRecords() {
        return this.records.map(r => {
            const estadoCobro = r.estadoCobro || (r.cobrado === true ? 'pagado' : 'pendiente');
            const montoCobrado = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
            const pendiente = Math.max(0, Number(r.venta || 0) - montoCobrado);
            const fechaVenc = r.fechaVencimiento ? (r.fechaVencimiento.toDate ? r.fechaVencimiento.toDate() : new Date(r.fechaVencimiento)) : null;
            let agingDays = 0;
            if (fechaVenc && estadoCobro !== 'pagado') {
                agingDays = Math.floor((new Date() - fechaVenc) / (1000 * 60 * 60 * 24));
            }
            let agingBucket = 'corriente';
            if (agingDays <= 0) agingBucket = 'corriente';
            else if (agingDays <= 30) agingBucket = '1-30';
            else if (agingDays <= 60) agingBucket = '31-60';
            else if (agingDays <= 90) agingBucket = '61-90';
            else agingBucket = '90+';
            return { ...r, estadoCobro, montoCobrado, pendiente, fechaVenc, agingDays, agingBucket };
        });
    },

    // ==================== DASHBOARD ====================
    renderDashboard() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords();
        const pendientes = records.filter(r => r.estadoCobro !== 'pagado');

        const totalCxC = pendientes.reduce((s, r) => s + r.pendiente, 0);
        const vencido = pendientes.filter(r => r.agingDays > 0);
        const carteraVencida = totalCxC > 0 ? (vencido.reduce((s, r) => s + r.pendiente, 0) / totalCxC * 100) : 0;

        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const cobradoMes = this.cobros.filter(c => c.fecha && c.fecha.toDate && c.fecha.toDate() >= inicioMes)
            .reduce((s, c) => s + (Number(c.monto) || 0), 0);

        const agingGroups = { 'corriente': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
        pendientes.forEach(r => { agingGroups[r.agingBucket] += r.pendiente; });
        const maxBar = Math.max(Object.values(agingGroups).reduce((a, b) => a + b, 0), 1);

        const byClient = {};
        pendientes.forEach(r => {
            const name = (r.cliente || 'Sin nombre').trim();
            if (!byClient[name]) byClient[name] = 0;
            byClient[name] += r.pendiente;
        });
        const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5);

        container.innerHTML = `
            <div class="stats-grid" style="margin-bottom:1.5rem;">
                <div class="stat-card"><h3>Total CxC</h3><p style="color:#f97316;">$${totalCxC.toLocaleString('en-US',{minimumFractionDigits:2})}</p></div>
                <div class="stat-card"><h3>Cartera Vencida</h3><p style="color:#ef4444;">${carteraVencida.toFixed(1)}%</p></div>
                <div class="stat-card"><h3>Cobrado este Mes</h3><p style="color:#22c55e;">$${cobradoMes.toLocaleString('en-US',{minimumFractionDigits:2})}</p></div>
                <div class="stat-card"><h3>Registros Pendientes</h3><p>${pendientes.length}</p></div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                <div class="card">
                    <div class="card-header"><h2>📅 Antigüedad de Saldos</h2></div>
                    <div class="card-body">
                        ${['corriente','1-30','31-60','61-90','90+'].map(b => {
                            const val = agingGroups[b];
                            const pct = maxBar > 0 ? (val / maxBar * 100) : 0;
                            const color = b === 'corriente' ? '#22c55e' : b === '1-30' ? '#eab308' : b === '31-60' ? '#f97316' : b === '61-90' ? '#ef4444' : '#dc2626';
                            return `<div style="margin-bottom:8px;">
                                <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:2px;"><span>${b === 'corriente' ? 'Corriente' : b === '1-30' ? '1-30 días' : b === '31-60' ? '31-60 días' : b === '61-90' ? '61-90 días' : '90+ días'}</span><span>$${formatNumber(val,0)}</span></div>
                                <div style="height:10px;background:#e5e5ea;border-radius:5px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${color};border-radius:5px;"></div></div>
                            </div>`;
                        }).join('')}
                        <div style="margin-top:12px;font-size:0.8rem;color:#666;">Total: $${formatNumber(maxBar, 0)}</div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h2>🔝 Clientes con Mayor Deuda</h2></div>
                    <div class="card-body">
                        ${topClients.length === 0 ? '<p style="color:#8e8e93;">Sin deudas pendientes</p>' :
                            `<table style="width:100%;font-size:0.85rem;">
                                <thead><tr style="background:#f0f0f0;"><th style="text-align:left;padding:8px;">Cliente</th><th style="text-align:right;padding:8px;">Deuda</th></tr></thead>
                                <tbody>${topClients.map(([name, amount]) => `
                                    <tr><td style="padding:8px;">${sanitizeHTML(name)}</td><td style="text-align:right;padding:8px;color:#f97316;font-weight:700;">$${formatNumber(amount,2)}</td></tr>
                                `).join('')}</tbody>
                            </table>`
                        }
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:1.5rem;">
                <div class="card-header"><h2>📋 Últimos Abonos Registrados</h2></div>
                <div class="card-body">
                    ${this.cobros.length === 0 ? '<p style="color:#8e8e93;">No hay abonos registrados</p>' :
                        `<table style="width:100%;font-size:0.85rem;">
                            <thead><tr style="background:#f0f0f0;"><th style="text-align:left;padding:8px;">Cliente</th><th style="text-align:right;padding:8px;">Monto</th><th style="text-align:left;padding:8px;">Método</th><th style="text-align:left;padding:8px;">Fecha</th></tr></thead>
                            <tbody>${this.cobros.slice(0, 10).map(c => `
                                <tr><td style="padding:8px;">${sanitizeHTML(c.cliente || '-')}</td><td style="text-align:right;padding:8px;color:#22c55e;font-weight:700;">$${formatNumber(c.monto,2)}</td><td style="padding:8px;">${c.metodo || ''}</td><td style="padding:8px;">${c.fecha && c.fecha.toDate ? formatDateShort(c.fecha) : ''}</td></tr>
                            `).join('')}</tbody>
                        </table>`
                    }
                </div>
            </div>
        `;
    },

    // ==================== ESTADO DE CUENTA ====================
    renderEstadoCuenta() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords();
        const clientNames = [...new Set(records.map(r => (r.cliente || '').trim()).filter(Boolean))].sort();

        container.innerHTML = `
            <div class="card" style="margin-bottom:1rem;">
                <div class="card-body">
                    <div class="form-group">
                        <label>Seleccionar Cliente</label>
                        <select id="cob-cliente-select" style="width:100%;padding:0.6rem;">
                            <option value="">-- Todos los clientes --</option>
                            ${clientNames.map(n => `<option value="${sanitizeHTML(n)}">${sanitizeHTML(n)}</option>`).join('')}
                        </select>
                    </div>
                    <div id="cob-estado-cuenta-result" style="margin-top:1rem;">
                        <p style="color:#8e8e93;">Selecciona un cliente para ver su estado de cuenta</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('cob-cliente-select').addEventListener('change', (e) => {
            this.showEstadoCuentaDetail(e.target.value, records);
        });
    },

    showEstadoCuentaDetail(clienteFiltro, records) {
        const resultDiv = document.getElementById('cob-estado-cuenta-result');
        if (!resultDiv) return;

        let filtered = records;
        if (clienteFiltro) {
            filtered = records.filter(r => (r.cliente || '').trim() === clienteFiltro);
        }

        if (filtered.length === 0) {
            resultDiv.innerHTML = '<p style="color:#8e8e93;">No se encontraron registros para este cliente</p>';
            return;
        }

        const totalVenta = filtered.reduce((s, r) => s + Number(r.venta || 0), 0);
        const totalCobrado = filtered.reduce((s, r) => s + Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0)), 0);
        const totalPendiente = totalVenta - totalCobrado;

        resultDiv.innerHTML = `
            <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1rem;">
                <div class="stat-card"><h3>Total Venta</h3><p>$${totalVenta.toLocaleString('en-US',{minimumFractionDigits:2})}</p></div>
                <div class="stat-card"><h3>Total Cobrado</h3><p style="color:#22c55e;">$${totalCobrado.toLocaleString('en-US',{minimumFractionDigits:2})}</p></div>
                <div class="stat-card"><h3>Saldo Pendiente</h3><p style="color:${totalPendiente>0?'#f97316':'#22c55e'};">$${totalPendiente.toLocaleString('en-US',{minimumFractionDigits:2})}</p></div>
            </div>

            <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
                <thead><tr style="background:#f0f0f0;">
                    <th style="text-align:left;padding:8px;border:1px solid #ddd;">Guía</th>
                    <th style="text-align:left;padding:8px;border:1px solid #ddd;">Cliente</th>
                    <th style="text-align:left;padding:8px;border:1px solid #ddd;">Fecha</th>
                    <th style="text-align:right;padding:8px;border:1px solid #ddd;">Venta</th>
                    <th style="text-align:right;padding:8px;border:1px solid #ddd;">Cobrado</th>
                    <th style="text-align:right;padding:8px;border:1px solid #ddd;">Pendiente</th>
                    <th style="text-align:center;padding:8px;border:1px solid #ddd;">Estado</th>
                </tr></thead>
                <tbody>${filtered.map(r => {
                    const montoCobrado = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
                    const pendiente = Math.max(0, Number(r.venta || 0) - montoCobrado);
                    const estado = r.estadoCobro || (r.cobrado === true ? 'pagado' : 'pendiente');
                    const estadoColor = estado === 'pagado' ? '#22c55e' : estado === 'parcial' ? '#f97316' : '#ef4444';
                    return `<tr>
                        <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">${r.guia || ''}</td>
                        <td style="padding:8px;border:1px solid #ddd;">${sanitizeHTML(r.cliente || '')}</td>
                        <td style="padding:8px;border:1px solid #ddd;">${r.fecha ? formatDateShort(r.fecha) : ''}</td>
                        <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${Number(r.venta||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                        <td style="padding:8px;border:1px solid #ddd;text-align:right;color:#22c55e;">$${montoCobrado.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                        <td style="padding:8px;border:1px solid #ddd;text-align:right;color:${pendiente>0?'#ef4444':'#22c55e'};">$${pendiente.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                        <td style="padding:8px;border:1px solid #ddd;text-align:center;color:${estadoColor};font-weight:bold;">${estado.charAt(0).toUpperCase()+estado.slice(1)}</td>
                    </tr>`;
                }).join('')}</tbody>
                <tfoot><tr style="background:#e5e5e5;font-weight:bold;">
                    <td colspan="3" style="padding:8px;border:1px solid #ddd;text-align:right;">TOTALES (${filtered.length} registros)</td>
                    <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${totalVenta.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${totalCobrado.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${totalPendiente.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px;border:1px solid #ddd;"></td>
                </tr></tfoot>
            </table>

            <button class="btn btn-secondary" onclick="Cobranza.printEstadoCuenta('${clienteFiltro || ''}')" style="margin-top:1rem;">🖨️ Imprimir Estado de Cuenta</button>
        `;
    },

    // ==================== AGING REPORT ====================
    renderAging() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords().filter(r => r.estadoCobro !== 'pagado');

        const byClient = {};
        records.forEach(r => {
            const name = (r.cliente || 'Sin nombre').trim();
            if (!byClient[name]) { byClient[name] = { corriente: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 }; }
            byClient[name][r.agingBucket] += r.pendiente;
            byClient[name].total += r.pendiente;
        });

        const clientList = Object.entries(byClient).sort((a, b) => b[1].total - a[1].total);

        container.innerHTML = `
            <div class="card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                    <h2>📅 Reporte de Antigüedad de Saldos</h2>
                    <button class="btn btn-secondary" onclick="Cobranza.exportAgingExcel()">📥 Exportar Excel</button>
                </div>
                <div class="card-body">
                    ${clientList.length === 0 ? '<p style="color:#8e8e93;text-align:center;padding:2rem;">No hay saldos pendientes</p>' : `
                        <div class="table-container">
                            <table class="data-table" style="font-size:0.85rem;">
                                <thead><tr>
                                    <th>Cliente</th>
                                    <th style="text-align:right;">Total</th>
                                    <th style="text-align:right;color:#22c55e;">Corriente</th>
                                    <th style="text-align:right;color:#eab308;">1-30 d</th>
                                    <th style="text-align:right;color:#f97316;">31-60 d</th>
                                    <th style="text-align:right;color:#ef4444;">61-90 d</th>
                                    <th style="text-align:right;color:#dc2626;">90+ d</th>
                                </tr></thead>
                                <tbody>${clientList.map(([name, b]) => `
                                    <tr>
                                        <td><strong>${sanitizeHTML(name)}</strong></td>
                                        <td style="text-align:right;font-weight:700;">$${formatNumber(b.total,2)}</td>
                                        <td style="text-align:right;">$${formatNumber(b.corriente,2)}</td>
                                        <td style="text-align:right;">$${formatNumber(b['1-30'],2)}</td>
                                        <td style="text-align:right;">$${formatNumber(b['31-60'],2)}</td>
                                        <td style="text-align:right;">$${formatNumber(b['61-90'],2)}</td>
                                        <td style="text-align:right;">$${formatNumber(b['90+'],2)}</td>
                                    </tr>
                                `).join('')}</tbody>
                                <tfoot><tr style="background:#e5e5e5;font-weight:700;">
                                    <td>TOTALES</td>
                                    <td style="text-align:right;">$${formatNumber(clientList.reduce((s,[,b]) => s + b.total, 0), 2)}</td>
                                    <td style="text-align:right;">$${formatNumber(clientList.reduce((s,[,b]) => s + b.corriente, 0), 2)}</td>
                                    <td style="text-align:right;">$${formatNumber(clientList.reduce((s,[,b]) => s + b['1-30'], 0), 2)}</td>
                                    <td style="text-align:right;">$${formatNumber(clientList.reduce((s,[,b]) => s + b['31-60'], 0), 2)}</td>
                                    <td style="text-align:right;">$${formatNumber(clientList.reduce((s,[,b]) => s + b['61-90'], 0), 2)}</td>
                                    <td style="text-align:right;">$${formatNumber(clientList.reduce((s,[,b]) => s + b['90+'], 0), 2)}</td>
                                </tr></tfoot>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    // ==================== EXPORTS ====================
    exportAgingExcel() {
        if (typeof XLSX === 'undefined') { showToast('Excel no disponible', 'error'); return; }
        const records = this.getCreditRecords().filter(r => r.estadoCobro !== 'pagado');
        const byClient = {};
        records.forEach(r => {
            const name = (r.cliente || 'Sin nombre').trim();
            if (!byClient[name]) { byClient[name] = { corriente: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 }; }
            byClient[name][r.agingBucket] += r.pendiente;
            byClient[name].total += r.pendiente;
        });
        const data = Object.entries(byClient).map(([name, b]) => ({
            Cliente: name, Total: b.total, Corriente: b.corriente,
            '1-30 días': b['1-30'], '31-60 días': b['31-60'],
            '61-90 días': b['61-90'], '90+ días': b['90+']
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Antigüedad de Saldos');
        XLSX.writeFile(wb, 'Antiguedad_Saldos_' + new Date().toISOString().split('T')[0] + '.xlsx');
        showToast('Reporte exportado', 'success');
    },

    printEstadoCuenta(clienteFiltro) {
        const records = this.getCreditRecords();
        let filtered = records;
        if (clienteFiltro) filtered = records.filter(r => (r.cliente || '').trim() === clienteFiltro);

        const printArea = document.getElementById('print-area');
        if (!printArea) return;

        const totalVenta = filtered.reduce((s, r) => s + Number(r.venta || 0), 0);
        const totalCobrado = filtered.reduce((s, r) => s + Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0)), 0);
        const totalPendiente = totalVenta - totalCobrado;
        const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

        printArea.innerHTML = `
            <div style="font-family:Arial,sans-serif;padding:20px;max-width:1000px;margin:0 auto;color:#000;">
                <h1 style="font-size:1.5rem;margin-bottom:5px;">Estado de Cuenta</h1>
                <p style="color:#666;">${clienteFiltro ? 'Cliente: ' + sanitizeHTML(clienteFiltro) : 'Todos los clientes'} · ${today}</p>
                <table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-top:15px;">
                    <thead><tr style="background:#f0f0f0;">
                        <th style="border:1px solid #ccc;padding:6px;">Guía</th><th style="border:1px solid #ccc;padding:6px;">Cliente</th>
                        <th style="border:1px solid #ccc;padding:6px;">Fecha</th><th style="border:1px solid #ccc;padding:6px;">Venta</th>
                        <th style="border:1px solid #ccc;padding:6px;">Cobrado</th><th style="border:1px solid #ccc;padding:6px;">Pendiente</th>
                    </tr></thead>
                    <tbody>${filtered.map(r => {
                        const cobrado = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
                        return `<tr><td style="border:1px solid #ccc;padding:6px;">${r.guia||''}</td>
                            <td style="border:1px solid #ccc;padding:6px;">${sanitizeHTML(r.cliente||'')}</td>
                            <td style="border:1px solid #ccc;padding:6px;">${r.fecha?formatDateShort(r.fecha):''}</td>
                            <td style="border:1px solid #ccc;padding:6px;text-align:right;">$${Number(r.venta||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                            <td style="border:1px solid #ccc;padding:6px;text-align:right;">$${cobrado.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                            <td style="border:1px solid #ccc;padding:6px;text-align:right;">$${Math.max(0,Number(r.venta||0)-cobrado).toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>`;
                    }).join('')}</tbody>
                    <tfoot><tr style="background:#e5e5e5;font-weight:bold;">
                        <td colspan="3" style="border:1px solid #ccc;padding:6px;text-align:right;">TOTALES</td>
                        <td style="border:1px solid #ccc;padding:6px;text-align:right;">$${totalVenta.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                        <td style="border:1px solid #ccc;padding:6px;text-align:right;">$${totalCobrado.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                        <td style="border:1px solid #ccc;padding:6px;text-align:right;">$${totalPendiente.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    </tr></tfoot>
                </table>
                <div style="margin-top:20px;text-align:center;color:#888;font-size:0.7rem;">${filtered.length} registro(s) · Generado ${today}</div>
            </div>
        `;

        setTimeout(() => window.print(), 100);
    },

    // ==================== MOBILE ====================
    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div style="padding:0 0 8px 0;">
                <h1 style="font-size:1.35rem;font-weight:800;margin-bottom:2px;">📊 Cobranza</h1>
                <p style="font-size:0.78rem;color:#8e8e93;">Gestión de cuentas por cobrar</p>
            </div>
            <div class="m-actions-bar">
                <button class="btn" id="mcob-tab-dash" style="border-radius:20px;">📊 Dashboard</button>
                <button class="btn" id="mcob-tab-edo" style="border-radius:20px;">📋 Estado</button>
                <button class="btn" id="mcob-tab-age" style="border-radius:20px;">📅 Antigüedad</button>
            </div>
            <div id="mcob-content" style="margin-top:10px;">
                <div style="text-align:center;padding:40px;color:#8e8e93;">Cargando...</div>
            </div>
        `;

        document.getElementById('mcob-tab-dash').addEventListener('click', () => { this.currentView='dashboard'; this.renderMobileView(); });
        document.getElementById('mcob-tab-edo').addEventListener('click', () => { this.currentView='estado-cuenta'; this.renderMobileView(); });
        document.getElementById('mcob-tab-age').addEventListener('click', () => { this.currentView='aging'; this.renderMobileView(); });

        await this.loadData();
        this.renderMobileView();
    },

    renderMobileView() {
        const container = document.getElementById('mcob-content');
        if (!container) return;
        const records = this.getCreditRecords();
        const pendientes = records.filter(r => r.estadoCobro !== 'pagado');
        const totalCxC = pendientes.reduce((s, r) => s + r.pendiente, 0);
        const byClient = {};
        pendientes.forEach(r => {
            const name = (r.cliente || 'Sin nombre').trim();
            if (!byClient[name]) byClient[name] = 0;
            byClient[name] += r.pendiente;
        });
        const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 10);

        if (this.currentView === 'dashboard') {
            container.innerHTML = `
                <div class="m-stats-row" style="margin-bottom:10px;">
                    <div class="m-stat-chip"><div class="m-stat-chip-label">Total CxC</div><div class="m-stat-chip-value" style="color:#f97316;">$${formatNumber(totalCxC,0)}</div></div>
                    <div class="m-stat-chip"><div class="m-stat-chip-label">Pendientes</div><div class="m-stat-chip-value">${pendientes.length}</div></div>
                </div>
                <div style="font-weight:700;font-size:0.8rem;text-transform:uppercase;color:#8e8e93;margin-bottom:8px;">Clientes con Deuda</div>
                ${topClients.length === 0 ? '<div class="m-empty"><div class="m-empty-icon">✅</div><div class="m-empty-title">Sin deudas</div></div>' :
                    topClients.map(([name, amount]) => `
                        <div class="m-data-card">
                            <div class="m-card-header"><span class="m-card-title">${sanitizeHTML(name)}</span></div>
                            <div class="m-card-rows">
                                <div class="m-card-row"><span class="m-card-label">Deuda</span><span class="m-card-value money" style="color:#f97316;">$${formatNumber(amount,2)}</span></div>
                            </div>
                        </div>
                    `).join('')
                }
            `;
        } else if (this.currentView === 'estado-cuenta') {
            const names = [...new Set(records.map(r => (r.cliente||'').trim()).filter(Boolean))].sort();
            container.innerHTML = `
                <div class="m-form-group"><select id="mcob-cli-select" style="width:100%;padding:12px;border-radius:10px;border:1px solid #e5e5ea;font-size:0.9rem;"><option value="">Todos los clientes</option>${names.map(n=>`<option>${sanitizeHTML(n)}</option>`).join('')}</select></div>
                <div id="mcob-edo-result" style="margin-top:10px;"></div>
            `;
            document.getElementById('mcob-cli-select').addEventListener('change', (e) => {
                const filtro = e.target.value;
                const filtered = filtro ? records.filter(r => (r.cliente||'').trim()===filtro) : records;
                const tv = filtered.reduce((s,r)=>s+Number(r.venta||0),0);
                const tc = filtered.reduce((s,r)=>s+Number(r.montoCobrado||(r.cobrado===true?r.venta:0)),0);
                document.getElementById('mcob-edo-result').innerHTML = `
                    <div class="m-stats-row" style="margin-bottom:8px;">
                        <div class="m-stat-chip"><div class="m-stat-chip-label">Venta</div><div class="m-stat-chip-value">$${formatNumber(tv,0)}</div></div>
                        <div class="m-stat-chip"><div class="m-stat-chip-label">Cobrado</div><div class="m-stat-chip-value" style="color:#10b981;">$${formatNumber(tc,0)}</div></div>
                        <div class="m-stat-chip"><div class="m-stat-chip-label">Pendiente</div><div class="m-stat-chip-value" style="color:#f97316;">$${formatNumber(tv-tc,0)}</div></div>
                    </div>
                    ${filtered.map(r => {
                        const c = Number(r.montoCobrado||(r.cobrado===true?r.venta:0));
                        const p = Math.max(0,Number(r.venta||0)-c);
                        const pct = r.venta>0?Math.round((c/Number(r.venta))*100):0;
                        return `<div class="m-data-card"><div class="m-card-header"><span class="m-card-title">#${r.guia||'N/A'} - ${sanitizeHTML(r.cliente||'')}</span></div><div class="m-card-rows"><div class="m-card-row"><span class="m-card-label">Total</span><span class="m-card-value">$${formatNumber(r.venta||0,2)}</span></div><div class="m-card-row"><span class="m-card-label">Cobrado (${pct}%)</span><span class="m-card-value money" style="color:#10b981;">$${formatNumber(c,2)}</span></div><div class="m-card-row"><span class="m-card-label">Pendiente</span><span class="m-card-value money" style="color:#f97316;">$${formatNumber(p,2)}</span></div></div></div>`;
                    }).join('')}
                `;
            });
        } else if (this.currentView === 'aging') {
            const pend = records.filter(r => r.estadoCobro !== 'pagado');
            const aging = { corriente:0,'1-30':0,'31-60':0,'61-90':0,'90+':0 };
            pend.forEach(r => { aging[r.agingBucket] += r.pendiente; });
            const tot = Object.values(aging).reduce((a,b)=>a+b,0);
            container.innerHTML = `
                <div class="m-stats-row" style="margin-bottom:10px;"><div class="m-stat-chip"><div class="m-stat-chip-label">Total Pendiente</div><div class="m-stat-chip-value" style="color:#f97316;">$${formatNumber(tot,0)}</div></div></div>
                ${Object.entries(aging).map(([k,v])=>{
                    const pct = tot>0?(v/tot*100):0;
                    const color = k==='corriente'?'#10b981':k==='1-30'?'#eab308':k==='31-60'?'#f97316':k==='61-90'?'#ef4444':'#dc2626';
                    return `<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:2px;"><span>${k}</span><span>$${formatNumber(v,0)} (${pct.toFixed(0)}%)</span></div><div style="height:8px;background:#e5e5ea;border-radius:4px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${color};border-radius:4px;"></div></div></div>`;
                }).join('')}
            `;
        }
    }
};

window.Cobranza = Cobranza;
