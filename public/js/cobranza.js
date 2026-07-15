// ===================================
// Cobranza Module - Cuentas por Cobrar
// Sistema completo: Dashboard, Estado de Cuenta, Antigüedad, 
// Proyección, Alertas, Gestiones, Ajustes
// ===================================

const Cobranza = {
    records: [],
    clientes: [],
    cobros: [],
    gestiones: [],
    ajustes: [],
    notasCredito: [],
    routes: [],
    currentView: 'dashboard',
    unsubscribeRecords: null,
    unsubscribeCobros: null,
    unsubscribeGestiones: null,
    unsubscribeAjustes: null,
    unsubscribeNC: null,

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
                    <p>Dashboard avanzado, proyección, alertas, gestiones y ajustes</p>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn ${this.currentView==='dashboard'?'btn-primary':'btn-secondary'}" id="cob-tab-dashboard">📊 KPIs</button>
                    <button class="btn ${this.currentView==='estado-cuenta'?'btn-primary':'btn-secondary'}" id="cob-tab-estado">📋 Edo. Cuenta</button>
                    <button class="btn ${this.currentView==='aging'?'btn-primary':'btn-secondary'}" id="cob-tab-aging">📅 Antigüedad</button>
                    <button class="btn ${this.currentView==='proyeccion'?'btn-primary':'btn-secondary'}" id="cob-tab-proyeccion">📆 Proyección</button>
                    <button class="btn ${this.currentView==='alertas'?'btn-primary':'btn-secondary'}" id="cob-tab-alertas">🔔 Alertas</button>
                    <button class="btn ${this.currentView==='gestiones'?'btn-primary':'btn-secondary'}" id="cob-tab-gestiones">📝 Gestiones</button>
                    <button class="btn ${this.currentView==='ajustes'?'btn-primary':'btn-secondary'}" id="cob-tab-ajustes">💡 Ajustes</button>
                </div>
            </div>
            <div id="cobranza-content">
                <div style="text-align:center;padding:3rem;">Cargando datos...</div>
            </div>
        `;

        document.getElementById('cob-tab-dashboard').addEventListener('click', () => { this.currentView='dashboard'; this.renderDesktop(); });
        document.getElementById('cob-tab-estado').addEventListener('click', () => { this.currentView='estado-cuenta'; this.renderDesktop(); });
        document.getElementById('cob-tab-aging').addEventListener('click', () => { this.currentView='aging'; this.renderDesktop(); });
        document.getElementById('cob-tab-proyeccion').addEventListener('click', () => { this.currentView='proyeccion'; this.renderDesktop(); });
        document.getElementById('cob-tab-alertas').addEventListener('click', () => { this.currentView='alertas'; this.renderDesktop(); });
        document.getElementById('cob-tab-gestiones').addEventListener('click', () => { this.currentView='gestiones'; this.renderDesktop(); });
        document.getElementById('cob-tab-ajustes').addEventListener('click', () => { this.currentView='ajustes'; this.renderDesktop(); });

        await this.loadData();
        this.renderCurrentView();
    },

    async loadData() {
        const db = firebase.firestore();
        return new Promise((resolve) => {
            const loadedCollections = new Set();
            const totalNeeded = 6;
            const checkDone = (name) => {
                if (!loadedCollections.has(name)) {
                    loadedCollections.add(name);
                    if (loadedCollections.size >= totalNeeded) resolve();
                }
            };

            // Reuse Interlogic.records to avoid duplicate listener (cost optimization)
            if (window.Interlogic && window.Interlogic.records && window.Interlogic.records.length > 0) {
                this.records = window.Interlogic.records;
                checkDone('records');
            } else {
                // Cargar últimos 180 días con tope 3000 en vez de 5000
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
                sixMonthsAgo.setHours(0,0,0,0);
                const startTs = firebase.firestore.Timestamp.fromDate(sixMonthsAgo);
                db.collection('interlogic')
                    .where('fecha', '>=', startTs)
                    .orderBy('fecha', 'desc')
                    .limit(3000).get().then(snap => {
                    this.records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    checkDone('records');
                }).catch(err => { console.error('Error loading interlogic:', err); checkDone('records'); });
            }

            if (this.unsubscribeCobros) this.unsubscribeCobros();
            this.unsubscribeCobros = db.collection('cobros')
                .orderBy('createdAt', 'desc')
                .onSnapshot(snap => {
                    this.cobros = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (loadedCollections.size >= totalNeeded) this.renderCurrentView();
                    checkDone('cobros');
                }, err => { console.error('Error loading cobros:', err); showToast('Error cargando cobros', 'error'); checkDone('cobros'); });

            // One-time fetch: gestiones only changes on explicit user action
            db.collection('gestiones').orderBy('createdAt', 'desc').limit(500).get().then(snap => {
                this.gestiones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('gestiones');
            }).catch(err => { console.error('Error loading gestiones:', err); checkDone('gestiones'); });

            // One-time fetch: ajustes only changes on explicit user action
            db.collection('ajustes').orderBy('createdAt', 'desc').limit(500).get().then(snap => {
                this.ajustes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('ajustes');
            }).catch(err => { console.error('Error loading ajustes:', err); checkDone('ajustes'); });

            // One-time fetch: notasCredito only changes on explicit user action
            db.collection('notasCredito').orderBy('createdAt', 'desc').limit(1000).get().then(snap => {
                this.notasCredito = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('nc');
            }).catch(err => { console.error('Error loading notasCredito:', err); checkDone('nc'); });

            db.collection('rutas').orderBy('fecha', 'desc').limit(100).get().then(snap => {
                this.routes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                checkDone('rutas');
            }).catch(err => { console.error('Error loading rutas:', err); showToast('Error cargando rutas', 'error'); checkDone('rutas'); });

            if (window.Clientes && window.Clientes.loadRecords) {
                window.Clientes.loadRecords()
                    .then(() => { this.clientes = window.Clientes.getAll(); checkDone('clientes'); })
                    .catch(err => { console.error('Error loading clientes:', err); checkDone('clientes'); });
            } else {
                checkDone('clientes');
            }
        });
    },

    renderCurrentView() {
        const views = {
            'dashboard': () => this.renderDashboard(),
            'estado-cuenta': () => this.renderEstadoCuenta(),
            'aging': () => this.renderAging(),
            'proyeccion': () => this.renderProyeccion(),
            'alertas': () => this.renderAlertas(),
            'gestiones': () => this.renderGestiones(),
            'ajustes': () => this.renderAjustes()
        };
        if (views[this.currentView]) views[this.currentView]();
    },

    getCreditRecords() {
        return this.records.map(r => {
            const estadoCobro = r.estadoCobro || (r.cobrado === true ? 'pagado' : 'pendiente');
            const montoCobrado = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
            const planPagos = r.planPagos || [];
            const montoProgramado = planPagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
            const pendiente = Math.max(0, Number(r.venta || 0) - montoCobrado - montoProgramado);
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
            return { ...r, estadoCobro, montoCobrado, montoProgramado, planPagos, pendiente, fechaVenc, agingDays, agingBucket };
        });
    },

    // ==================== DASHBOARD CON KPIS AVANZADOS ====================
    calcDSO(records) {
        const pendientes = records.filter(r => r.estadoCobro !== 'pagado');
        const totalCxC = pendientes.reduce((s, r) => s + r.pendiente, 0);
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const ventasCreditoMes = records.filter(r => {
            const f = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
            return f && f >= inicioMes;
        }).reduce((s, r) => s + Number(r.venta || 0), 0);
        const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
        if (ventasCreditoMes <= 0) return 0;
        return Math.round((totalCxC / ventasCreditoMes) * diasMes);
    },

    calcCEI(records) {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const cobradoMes = this.cobros.filter(c => c.fecha && c.fecha.toDate && c.fecha.toDate() >= inicioMes)
            .reduce((s, c) => s + (Number(c.monto) || 0), 0);
        const ventasMes = records.filter(r => {
            const f = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
            return f && f >= inicioMes;
        }).reduce((s, r) => s + Number(r.venta || 0), 0);
        const saldoInicial = records.filter(r => {
            const f = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
            return f && f < inicioMes && r.estadoCobro !== 'pagado';
        }).reduce((s, r) => s + r.pendiente, 0);
        const denominator = saldoInicial + ventasMes;
        return denominator > 0 ? Math.round((cobradoMes / denominator) * 100) : 0;
    },

    getMonthlyComparison(records) {
        const months = [];
        const hoy = new Date();
        for (let i = 2; i >= 0; i--) {
            const y = hoy.getFullYear();
            const m = hoy.getMonth() - i;
            const date = new Date(y, m, 1);
            const label = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
            const inicio = new Date(date.getFullYear(), date.getMonth(), 1);
            const fin = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const ventas = records.filter(r => {
                const f = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
                return f && f >= inicio && f <= fin;
            }).reduce((s, r) => s + Number(r.venta || 0), 0);
            const cobrosMes = this.cobros.filter(c => {
                const f = c.fecha && c.fecha.toDate ? c.fecha.toDate() : null;
                return f && f >= inicio && f <= fin;
            }).reduce((s, c) => s + (Number(c.monto) || 0), 0);
            months.push({ label, ventas, cobros: cobrosMes });
        }
        return months;
    },

    renderDashboard() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords();
        const pendientes = records.filter(r => r.estadoCobro !== 'pagado');
        const totalCxC = pendientes.reduce((s, r) => s + r.pendiente, 0);
        const vencido = pendientes.filter(r => r.agingDays > 0);
        const vencidoTotal = vencido.reduce((s, r) => s + r.pendiente, 0);
        const carteraVencida = totalCxC > 0 ? (vencidoTotal / totalCxC * 100) : 0;
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const cobradoMes = this.cobros.filter(c => c.fecha && c.fecha.toDate && c.fecha.toDate() >= inicioMes)
            .reduce((s, c) => s + (Number(c.monto) || 0), 0);
        const dso = this.calcDSO(records);
        const cei = this.calcCEI(records);
        const months = this.getMonthlyComparison(records);
        const maxMonthVal = Math.max(...months.map(m => Math.max(m.ventas, m.cobros)), 1);
        const agingGroups = { 'corriente': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
        pendientes.forEach(r => { agingGroups[r.agingBucket] += r.pendiente; });
        const maxBar = Math.max(Object.values(agingGroups).reduce((a, b) => a + b, 0), 1);
        const byClient = {};
        pendientes.forEach(r => {
            const n = (r.cliente || 'Sin nombre').trim();
            if (!byClient[n]) byClient[n] = 0;
            byClient[n] += r.pendiente;
        });
        const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const alertas = this.getAlertas();

        container.innerHTML = `
            <div class="stats-grid" style="margin-bottom:1rem;">
                <div class="stat-card"><h3>Total CxC</h3><p style="color:#f97316;">${formatCurrency(totalCxC)}</p></div>
                <div class="stat-card"><h3>Cartera Vencida</h3><p style="color:#ef4444;">${carteraVencida.toFixed(1)}%</p></div>
                <div class="stat-card"><h3>Cobrado este Mes</h3><p style="color:#22c55e;">${formatCurrency(cobradoMes)}</p></div>
                <div class="stat-card"><h3>DSO (días cobro)</h3><p style="color:${dso>30?'#ef4444':'#22c55e'};">${dso} días</p></div>
                <div class="stat-card"><h3>CEI (efectividad)</h3><p style="color:${cei>=80?'#22c55e':cei>=50?'#f97316':'#ef4444'};">${cei}%</p></div>
                <div class="stat-card"><h3>Pendientes</h3><p>${pendientes.length} registros</p></div>
            </div>

            ${alertas.filter(a => a.tipo === 'critico').length > 0 ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 15px;margin-bottom:1rem;display:flex;align-items:center;gap:8px;">
                <span style="font-size:1.2rem;">🚨</span>
                <span>${alertas.filter(a=>a.tipo==='critico').length} facturas con 60+ días de atraso requieren atención urgente</span>
            </div>` : ''}

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                <div class="card">
                    <div class="card-header"><h2>📈 Comparativo Mensual</h2></div>
                    <div class="card-body">
                        ${months.map(m => {
                            const vpct = maxMonthVal > 0 ? (m.ventas / maxMonthVal * 100) : 0;
                            const cpct = maxMonthVal > 0 ? (m.cobros / maxMonthVal * 100) : 0;
                            return `<div style="margin-bottom:12px;">
                                <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:3px;color:#666;">${m.label}</div>
                                <div style="display:flex;align-items:center;gap:6px;font-size:0.7rem;">
                                    <span style="width:40px;">Ventas</span>
                                    <div style="flex:1;height:14px;background:#e5e5ea;border-radius:7px;overflow:hidden;"><div style="height:100%;width:${vpct}%;background:var(--primary-600);border-radius:7px;"></div></div>
                                    <span style="width:50px;text-align:right;">${formatCurrency(m.ventas)}</span>
                                </div>
                                <div style="display:flex;align-items:center;gap:6px;font-size:0.7rem;margin-top:2px;">
                                    <span style="width:40px;">Cobros</span>
                                    <div style="flex:1;height:14px;background:#e5e5ea;border-radius:7px;overflow:hidden;"><div style="height:100%;width:${cpct}%;background:#22c55e;border-radius:7px;"></div></div>
                                    <span style="width:50px;text-align:right;">${formatCurrency(m.cobros)}</span>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h2>📅 Antigüedad de Saldos</h2></div>
                    <div class="card-body">
                        ${['corriente','1-30','31-60','61-90','90+'].map(b => {
                            const v = agingGroups[b];
                            const pct = maxBar > 0 ? (v / maxBar * 100) : 0;
                            const color = b==='corriente'?'#22c55e':b==='1-30'?'#eab308':b==='31-60'?'#f97316':b==='61-90'?'#ef4444':'#dc2626';
                            return `<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:0.75rem;"><span>${b==='corriente'?'Corriente':b==='1-30'?'1-30 d':b==='31-60'?'31-60 d':'${b}'}</span><span>$${formatNumber(v,0)}</span></div><div style="height:8px;background:#e5e5ea;border-radius:4px;"><div style="height:100%;width:${pct}%;background:${color};border-radius:4px;"></div></div></div>`;
                        }).join('')}
                        <div style="margin-top:8px;font-size:0.75rem;color:#666;">Total: ${formatCurrency(maxBar)}</div>
                    </div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1.5rem;">
                <div class="card">
                    <div class="card-header"><h2>🔝 Top Clientes Morosos</h2></div>
                    <div class="card-body">
                        ${topClients.length===0?'<p style="color:#8e8e93;">Sin deudas</p>':
                            `<table style="width:100%;font-size:0.8rem;"><thead><tr style="background:#f0f0f0;"><th style="padding:6px;text-align:left;">Cliente</th><th style="padding:6px;text-align:right;">Deuda</th></tr></thead><tbody>${topClients.map(([n,a])=>`<tr><td style="padding:6px;">${sanitizeHTML(n)}</td><td style="padding:6px;text-align:right;color:#f97316;font-weight:700;">${formatCurrency(a)}</td></tr>`).join('')}</tbody></table>`
                        }
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h2>🔔 Alertas de Cobranza</h2></div>
                    <div class="card-body">
                        ${alertas.length===0?'<p style="color:#22c55e;text-align:center;padding:1rem;">✅ Todo al día</p>':
                            `<table style="width:100%;font-size:0.8rem;"><tbody>${alertas.slice(0,8).map(a=>`<tr><td style="padding:4px;width:24px;">${a.icono}</td><td style="padding:4px;color:${a.tipo==='critico'?'#ef4444':a.tipo==='warning'?'#f97316':'#eab308'};">${sanitizeHTML(a.mensaje)}</td></tr>`).join('')}</tbody></table>`
                        }
                    </div>
                </div>
            </div>
        `;
    },

    // ==================== PROYECCIÓN ====================
    renderProyeccion() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords().filter(r => r.estadoCobro !== 'pagado' && r.fechaVenc);
        records.sort((a, b) => a.fechaVenc - b.fechaVenc);

        const byMonth = {};
        records.forEach(r => {
            const m = r.fechaVenc.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            if (!byMonth[m]) byMonth[m] = { total: 0, items: [] };
            byMonth[m].total += r.pendiente;
            byMonth[m].items.push(r);
        });

        container.innerHTML = `
            <div class="stats-grid" style="margin-bottom:1rem;">
                <div class="stat-card"><h3>Total Proyectado</h3><p style="color:#f97316;">${formatCurrency(records.reduce((s,r)=>s+r.pendiente,0))}</p></div>
                <div class="stat-card"><h3>Próx. 30 días</h3><p style="color:#eab308;">${formatCurrency(records.filter(r=>r.agingDays>=0&&r.agingDays<=30).reduce((s,r)=>s+r.pendiente,0))}</p></div>
                <div class="stat-card"><h3>Registros</h3><p>${records.length}</p></div>
            </div>
            ${Object.entries(byMonth).map(([month, data]) => `
                <div class="card" style="margin-bottom:1rem;">
                    <div class="card-header"><h2>📆 ${month.charAt(0).toUpperCase()+month.slice(1)} — ${formatCurrency(data.total)}</h2></div>
                    <div class="card-body">
                        <table style="width:100%;font-size:0.8rem;border-collapse:collapse;">
                            <thead><tr style="background:#f0f0f0;">
                                <th style="padding:6px;text-align:left;">Guía</th><th style="padding:6px;text-align:left;">Cliente</th>
                                <th style="padding:6px;text-align:right;">Venta</th><th style="padding:6px;text-align:right;">Pendiente</th>
                                <th style="padding:6px;text-align:left;">Vencimiento</th><th style="padding:6px;text-align:center;">Estado</th>
                            </tr></thead>
                            <tbody>${data.items.map(r => `<tr>
                                <td style="padding:6px;font-weight:bold;">${r.guia||''}</td>
                                <td style="padding:6px;">${sanitizeHTML(r.cliente||'')}</td>
                                <td style="padding:6px;text-align:right;">${formatCurrency(r.venta||0)}</td>
                                <td style="padding:6px;text-align:right;color:${r.agingDays>0?'#ef4444':'#22c55e'};">${formatCurrency(r.pendiente)}</td>
                                <td style="padding:6px;">${r.fechaVenc.toLocaleDateString('es-ES')}${r.agingDays>0?` <span style="color:#ef4444;">(+${r.agingDays}d)</span>`:''}</td>
                                <td style="padding:6px;text-align:center;color:${r.estadoCobro==='parcial'?'#f97316':r.estadoCobro==='pagado'?'#22c55e':'#ef4444'};font-weight:bold;">${r.estadoCobro.charAt(0).toUpperCase()+r.estadoCobro.slice(1)}</td>
                            </tr>`).join('')}</tbody>
                        </table>
                    </div>
                </div>
            `).join('')}
        `;
    },

    // ==================== ALERTAS ====================
    getAlertas() {
        const records = this.getCreditRecords().filter(r => r.estadoCobro !== 'pagado');
        const alertas = [];

        records.forEach(r => {
            if (r.agingDays >= 60) alertas.push({ tipo: 'critico', icono: '🔴', mensaje: `${r.cliente||'Sin nombre'}: ${formatCurrency(r.pendiente)} vencido hace ${r.agingDays} días (Guía #${r.guia||'N/A'})` });
        });

        records.forEach(r => {
            if (r.agingDays >= 30 && r.agingDays < 60) alertas.push({ tipo: 'warning', icono: '🟠', mensaje: `${r.cliente||'Sin nombre'}: ${formatCurrency(r.pendiente)} con ${r.agingDays} días de atraso (Guía #${r.guia||'N/A'})` });
        });

        records.forEach(r => {
            if (r.agingDays > 0 && r.agingDays < 30) alertas.push({ tipo: 'aviso', icono: '🟡', mensaje: `${r.cliente||'Sin nombre'}: ${formatCurrency(r.pendiente)} vencido por ${r.agingDays} días (Guía #${r.guia||'N/A'})` });
        });

        const now = new Date();
        records.filter(r => r.agingDays <= 0).forEach(r => {
            if (r.fechaVenc) {
                const diasHasta = Math.abs(r.agingDays);
                if (diasHasta <= 7) alertas.push({ tipo: 'info', icono: '🔵', mensaje: `${r.cliente||'Sin nombre'}: ${formatCurrency(r.pendiente)} vence en ${diasHasta} días (Guía #${r.guia||'N/A'})` });
            }
        });

        return alertas;
    },

    renderAlertas() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const alertas = this.getAlertas();

        const grupos = { critico: { titulo: '🔴 Crítico (60+ días)', items: [] }, warning: { titulo: '🟠 Atención (30-60 días)', items: [] }, aviso: { titulo: '🟡 Aviso (1-30 días)', items: [] }, info: { titulo: '🔵 Próximas a Vencer (≤7 días)', items: [] } };
        alertas.forEach(a => { if (grupos[a.tipo]) grupos[a.tipo].items.push(a); });

        container.innerHTML = `
            <div class="stats-grid" style="margin-bottom:1rem;">
                <div class="stat-card"><h3>Total Alertas</h3><p>${alertas.length}</p></div>
                <div class="stat-card"><h3>Críticas</h3><p style="color:#ef4444;">${grupos.critico.items.length}</p></div>
                <div class="stat-card"><h3>Por Vencer</h3><p style="color:#3b82f6;">${grupos.info.items.length}</p></div>
            </div>
            ${Object.values(grupos).filter(g => g.items.length > 0).map(g => `
                <div class="card" style="margin-bottom:1rem;">
                    <div class="card-header"><h2>${g.titulo} (${g.items.length})</h2></div>
                    <div class="card-body">
                        <table style="width:100%;font-size:0.85rem;">
                            <tbody>${g.items.map(a => `<tr><td style="padding:8px;vertical-align:top;">${a.icono}</td><td style="padding:8px;">${sanitizeHTML(a.mensaje)}</td></tr>`).join('')}</tbody>
                        </table>
                    </div>
                </div>
            `).join('')}
            ${alertas.length===0 ? '<div style="text-align:center;padding:3rem;color:#22c55e;"><span style="font-size:2rem;">✅</span><h2>Todas las cuentas al día</h2><p>No hay alertas de cobranza en este momento.</p></div>' : ''}
        `;
    },

    // ==================== GESTIONES (Workflow de cobranza) ====================
    renderGestiones() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords();

        container.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem;">
                <button class="btn btn-primary" id="cob-btn-nueva-gestion">➕ Nueva Gestión</button>
            </div>
            <div id="cob-gestiones-list">
                ${this.gestiones.length===0 ? '<div class="card"><div class="card-body" style="text-align:center;padding:2rem;color:#8e8e93;">No hay gestiones registradas. Usa el botón para registrar una llamada, email, o visita de cobranza.</div></div>' :
                `<div class="card"><div class="card-body"><table style="width:100%;font-size:0.85rem;"><thead><tr style="background:#f0f0f0;"><th style="padding:8px;">Fecha</th><th style="padding:8px;">Cliente</th><th style="padding:8px;">Tipo</th><th style="padding:8px;">Descripción</th><th style="padding:8px;">Resultado</th><th style="padding:8px;">Próx. Acción</th></tr></thead><tbody>${this.gestiones.map(g => `<tr><td style="padding:8px;">${g.fecha&&g.fecha.toDate?formatDateShort(g.fecha):''}</td><td style="padding:8px;">${sanitizeHTML(g.cliente||'')}</td><td style="padding:8px;">${g.tipo||''}</td><td style="padding:8px;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${sanitizeHTML(g.descripcion||'')}</td><td style="padding:8px;">${sanitizeHTML(g.resultado||'')}</td><td style="padding:8px;">${g.proximaAccion&&g.proximaAccion.toDate?formatDateShort(g.proximaAccion):'-'}</td></tr>`).join('')}</tbody></table></div></div>`
                }
            </div>
        `;

        document.getElementById('cob-btn-nueva-gestion').addEventListener('click', () => this.showGestionModal(records));
    },

    showGestionModal(records) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h2 style="margin-bottom:1rem;">📝 Nueva Gestión de Cobranza</h2>
                <form id="gestion-form">
                    <div class="form-group">
                        <label>Cliente</label>
                        <div class="search-container">
                            <div class="search-box" style="position:relative;">
                                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="ges-cliente-search" class="search-input" placeholder="Escribe para buscar cliente..." autocomplete="off">
                                <input type="hidden" id="ges-cliente" value="">
                            </div>
                            <div id="ges-cliente-dropdown" class="premium-dropdown" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;"><label>Tipo de Gestión</label><select id="ges-tipo" style="width:100%;"><option>llamada</option><option>email</option><option>whatsapp</option><option>visita</option><option>carta</option><option>otro</option></select></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Descripción</label><textarea id="ges-descripcion" rows="3" style="width:100%;" placeholder="Detalle de la gestión..."></textarea></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Resultado / Acuerdo</label><input type="text" id="ges-resultado" style="width:100%;" placeholder="Ej: Prometió pagar el viernes"></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Próxima Acción (fecha)</label><input type="date" id="ges-proxima" style="width:100%;"></div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-ges-save">💾 Guardar Gestión</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target===modal) modal.remove(); };

        const searchInput = document.getElementById('ges-cliente-search');
        const dropdown = document.getElementById('ges-cliente-dropdown');
        const hiddenClient = document.getElementById('ges-cliente');

        const filterClients = (query) => {
            const q = query.toLowerCase().trim();
            if (!q || q.length < 1) { dropdown.style.display = 'none'; return; }
            const matches = records.filter(r => {
                const cliente = String(r.cliente || '').toLowerCase();
                const guia = String(r.guia || '').toLowerCase();
                const empresa = String(r.empresa || '').toLowerCase();
                return cliente.includes(q) || guia.includes(q) || empresa.includes(q);
            });
            const unique = [];
            const seen = new Set();
            for (const r of matches) {
                const name = (r.cliente || '').trim();
                if (!name || seen.has(name)) continue;
                seen.add(name);
                unique.push(r);
                if (unique.length >= 20) break;
            }
            if (unique.length === 0) {
                dropdown.innerHTML = '<div class="dropdown-empty"><p style="padding:1rem;color:#8e8e93;">Sin coincidencias</p></div>';
            } else {
                dropdown.innerHTML = unique.map(r => `
                    <div class="dropdown-item" onclick="document.getElementById('ges-cliente-search').value='${sanitizeHTML(r.cliente||'').replace(/'/g,"\\'")}';document.getElementById('ges-cliente').value='${sanitizeHTML(r.cliente||'').replace(/'/g,"\\'")}';document.getElementById('ges-cliente-dropdown').style.display='none';">
                        <div class="dropdown-item-left">
                            <div class="dropdown-item-doc">${sanitizeHTML(r.cliente||'')}</div>
                            <div class="dropdown-item-cliente">Guía: ${sanitizeHTML(r.guia||'N/A')} · ${sanitizeHTML(r.empresa||'')}</div>
                        </div>
                        <div class="dropdown-item-right">
                            <div class="dropdown-item-monto">${formatCurrency(r.venta||0)}</div>
                        </div>
                    </div>
                `).join('');
            }
            dropdown.style.display = 'block';
        };

        searchInput.addEventListener('input', (e) => filterClients(e.target.value));
        searchInput.addEventListener('focus', () => { if (searchInput.value) filterClients(searchInput.value); });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#ges-cliente-search') && !e.target.closest('#ges-cliente-dropdown')) {
                dropdown.style.display = 'none';
            }
        });

        document.getElementById('gestion-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-ges-save');
            const clienteVal = hiddenClient.value || searchInput.value.trim();
            if (!clienteVal) { showToast('Selecciona o escribe un cliente', 'error'); return; }
            setButtonLoading(btn, true);
            try {
                const proxVal = document.getElementById('ges-proxima').value;
                let proxDate = null;
                if (proxVal) { const [y,m,d] = proxVal.split('-').map(Number); proxDate = firebase.firestore.Timestamp.fromDate(new Date(y,m-1,d,12,0,0)); }
                await firebase.firestore().collection('gestiones').add({
                    cliente: clienteVal,
                    tipo: document.getElementById('ges-tipo').value,
                    descripcion: document.getElementById('ges-descripcion').value,
                    resultado: document.getElementById('ges-resultado').value,
                    proximaAccion: proxDate,
                    usuario: firebase.auth().currentUser?.uid || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                modal.remove();
                showToast('✅ Gestión registrada', 'success');
            } catch(err) { showToast('Error: '+err.message,'error'); setButtonLoading(btn,false); }
        });
    },

    // ==================== AJUSTES (Notas de crédito) ====================
    renderAjustes() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords();

        // Merge ajustes and notasCredito for display
        const allAjustes = [
            ...this.ajustes.map(a => ({ ...a, _source: 'ajuste' })),
            ...this.notasCredito.map(nc => ({
                ...nc,
                _source: 'nc',
                tipo: 'notaCredito',
                monto: -(nc.monto || 0),
                guia: nc.guia || ''
            }))
        ].sort((a, b) => {
            const da = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
            const db = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
            return db - da;
        });

        container.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem;">
                <button class="btn btn-primary" id="cob-btn-nuevo-ajuste">💡 Nuevo Ajuste</button>
                <button class="btn btn-accent" id="cob-btn-nueva-nc">📄 Nueva Nota de Crédito</button>
            </div>
            <div id="cob-ajustes-list">
                ${allAjustes.length===0 ? '<div class="card"><div class="card-body" style="text-align:center;padding:2rem;color:#8e8e93;">No hay ajustes registrados. Usa esta sección para notas de crédito, descuentos, devoluciones o castigos.</div></div>' :
                `<div class="card"><div class="card-body"><table style="width:100%;font-size:0.85rem;"><thead><tr style="background:#f0f0f0;"><th style="padding:8px;">Fecha</th><th style="padding:8px;">Cliente</th><th style="padding:8px;">Tipo</th><th style="padding:8px;">N° NC</th><th style="padding:8px;">Guía</th><th style="padding:8px;text-align:right;">Monto</th><th style="padding:8px;">Motivo</th></tr></thead><tbody>${allAjustes.map(a => {
                    const isNC = a._source === 'nc';
                    const tipoLabel = isNC ? 'Nota de Crédito' : (a.tipo||'');
                    const badgeClass = isNC ? 'badge-nc' : (a.tipo==='cargoExtra'?'badge-error':'badge-warning');
                    return `<tr><td style="padding:8px;">${a.fecha&&a.fecha.toDate?formatDateShort(a.fecha):''}</td><td style="padding:8px;">${sanitizeHTML(a.cliente||'')}</td><td style="padding:8px;"><span class="badge ${badgeClass}">${tipoLabel}</span></td><td style="padding:8px;">${sanitizeHTML(a.ncNum||'-')}</td><td style="padding:8px;">${sanitizeHTML(a.guia||'')}</td><td style="padding:8px;text-align:right;color:${(a.monto||0)<0?'#22c55e':'#ef4444'};font-weight:700;">${(a.monto||0)<0?'−':''}${formatCurrency(Math.abs(a.monto||0))}</td><td style="padding:8px;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${sanitizeHTML(a.motivo||'')}</td></tr>`;
                }).join('')}</tbody></table></div></div>`
                }
            </div>
        `;

        document.getElementById('cob-btn-nuevo-ajuste').addEventListener('click', () => this.showAjusteModal(records));
        document.getElementById('cob-btn-nueva-nc').addEventListener('click', () => this.showAjusteModal(records));
    },

    showAjusteModal(records) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <h2 style="margin-bottom:1rem;">💡 Nuevo Ajuste / Nota de Crédito</h2>
                <form id="ajuste-form">
                    <div class="form-group">
                        <label>Cliente</label>
                        <div class="search-container">
                            <div class="search-box" style="position:relative;">
                                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="aj-cliente-search" class="search-input" placeholder="Escribe para buscar cliente..." autocomplete="off">
                                <input type="hidden" id="aj-cliente" value="">
                            </div>
                            <div id="aj-cliente-dropdown" class="premium-dropdown" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;"><label>Tipo de Ajuste</label><select id="aj-tipo" style="width:100%;"><option value="notaCredito">Nota de Crédito (reduce deuda)</option><option value="descuento">Descuento</option><option value="devolucion">Devolución</option><option value="cargoExtra">Cargo Extra (aumenta deuda)</option><option value="castigo">Castigo por Incobrable</option></select></div>
                    <div id="aj-nc-num-group" class="form-group" style="margin-top:1rem;"><label>N° Nota de Crédito</label><input type="text" id="aj-nc-num" style="width:100%;" placeholder="Ej: NC-001"></div>
                    <div class="form-group" style="margin-top:1rem;">
                        <label>Guía Relacionada</label>
                        <div class="search-container">
                            <div class="search-box" style="position:relative;">
                                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="aj-guia-search" class="search-input" placeholder="Buscar guía o dejar vacío para general..." autocomplete="off">
                                <input type="hidden" id="aj-guia" value="">
                            </div>
                            <div id="aj-guia-dropdown" class="premium-dropdown" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:1rem;"><label>Monto ($) — Negativo para reducir deuda</label><input type="number" id="aj-monto" step="0.01" style="width:100%;" placeholder="Ej: -50 para nota de crédito"></div>
                    <div class="form-group" style="margin-top:1rem;"><label>Motivo</label><input type="text" id="aj-motivo" style="width:100%;" placeholder="Razón del ajuste..."></div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-aj-save">💾 Guardar Ajuste</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target===modal) modal.remove(); };

        // Toggle NC number field visibility
        const tipoSelect = document.getElementById('aj-tipo');
        const ncNumGroup = document.getElementById('aj-nc-num-group');
        const toggleNcNum = () => { ncNumGroup.style.display = tipoSelect.value === 'notaCredito' ? 'block' : 'none'; };
        tipoSelect.addEventListener('change', toggleNcNum);
        toggleNcNum();

        // Cliente search
        const clienteSearch = document.getElementById('aj-cliente-search');
        const clienteDropdown = document.getElementById('aj-cliente-dropdown');
        const hiddenCliente = document.getElementById('aj-cliente');

        const filterClientes = (query) => {
            const q = query.toLowerCase().trim();
            if (!q || q.length < 1) { clienteDropdown.style.display = 'none'; return; }
            const matches = records.filter(r => {
                const cliente = String(r.cliente || '').toLowerCase();
                const guia = String(r.guia || '').toLowerCase();
                const empresa = String(r.empresa || '').toLowerCase();
                return cliente.includes(q) || guia.includes(q) || empresa.includes(q);
            });
            const unique = [];
            const seen = new Set();
            for (const r of matches) {
                const name = (r.cliente || '').trim();
                if (!name || seen.has(name)) continue;
                seen.add(name);
                unique.push(r);
                if (unique.length >= 20) break;
            }
            if (unique.length === 0) {
                clienteDropdown.innerHTML = '<div class="dropdown-empty"><p style="padding:1rem;color:#8e8e93;">Sin coincidencias</p></div>';
            } else {
                clienteDropdown.innerHTML = unique.map(r => `
                    <div class="dropdown-item" onclick="document.getElementById('aj-cliente-search').value='${sanitizeHTML(r.cliente||'').replace(/'/g,"\\'")}';document.getElementById('aj-cliente').value='${sanitizeHTML(r.cliente||'').replace(/'/g,"\\'")}';document.getElementById('aj-cliente-dropdown').style.display='none';">
                        <div class="dropdown-item-left">
                            <div class="dropdown-item-doc">${sanitizeHTML(r.cliente||'')}</div>
                            <div class="dropdown-item-cliente">Guía: ${sanitizeHTML(r.guia||'N/A')} · ${sanitizeHTML(r.empresa||'')}</div>
                        </div>
                        <div class="dropdown-item-right">
                            <div class="dropdown-item-monto">${formatCurrency(r.venta||0)}</div>
                        </div>
                    </div>
                `).join('');
            }
            clienteDropdown.style.display = 'block';
        };

        clienteSearch.addEventListener('input', (e) => filterClientes(e.target.value));
        clienteSearch.addEventListener('focus', () => { if (clienteSearch.value) filterClientes(clienteSearch.value); });

        // Guía search
        const guiaSearch = document.getElementById('aj-guia-search');
        const guiaDropdown = document.getElementById('aj-guia-dropdown');
        const hiddenGuia = document.getElementById('aj-guia');

        const filterGuias = (query) => {
            const q = query.toLowerCase().trim();
            if (!q || q.length < 1) { guiaDropdown.style.display = 'none'; return; }
            const matches = records.filter(r => {
                const guia = String(r.guia || '').toLowerCase();
                const cliente = String(r.cliente || '').toLowerCase();
                const doc = String(r.doc || '').toLowerCase();
                return guia.includes(q) || cliente.includes(q) || doc.includes(q);
            }).slice(0, 20);
            if (matches.length === 0) {
                guiaDropdown.innerHTML = '<div class="dropdown-empty"><p style="padding:1rem;color:#8e8e93;">Sin coincidencias</p></div>';
            } else {
                guiaDropdown.innerHTML = matches.map(r => `
                    <div class="dropdown-item" onclick="document.getElementById('aj-guia-search').value='${sanitizeHTML((r.guia||'N/A')+' - '+ (r.cliente||'')).replace(/'/g,"\\'")}';document.getElementById('aj-guia').value='${sanitizeHTML(r.guia||'').replace(/'/g,"\\'")}';document.getElementById('aj-guia-dropdown').style.display='none';">
                        <div class="dropdown-item-left">
                            <div class="dropdown-item-doc">${sanitizeHTML(r.guia||'N/A')} <span class="dropdown-item-num">${sanitizeHTML(r.doc||'')}</span></div>
                            <div class="dropdown-item-cliente">${sanitizeHTML(r.cliente||'')}</div>
                        </div>
                        <div class="dropdown-item-right">
                            <div class="dropdown-item-monto">${formatCurrency(r.venta||0)}</div>
                        </div>
                    </div>
                `).join('');
            }
            guiaDropdown.style.display = 'block';
        };

        guiaSearch.addEventListener('input', (e) => filterGuias(e.target.value));
        guiaSearch.addEventListener('focus', () => { if (guiaSearch.value) filterGuias(guiaSearch.value); });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#aj-cliente-search') && !e.target.closest('#aj-cliente-dropdown')) {
                clienteDropdown.style.display = 'none';
            }
            if (!e.target.closest('#aj-guia-search') && !e.target.closest('#aj-guia-dropdown')) {
                guiaDropdown.style.display = 'none';
            }
        });

        document.getElementById('ajuste-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-aj-save');
            setButtonLoading(btn, true);
            try {
                const monto = parseFloat(document.getElementById('aj-monto').value) || 0;
                const guiaSel = hiddenGuia.value;
                const clienteVal = hiddenCliente.value || clienteSearch.value.trim();
                const tipo = document.getElementById('aj-tipo').value;
                const motivo = document.getElementById('aj-motivo').value;
                if (monto === 0) { showToast('El monto no puede ser 0','error'); setButtonLoading(btn,false); return; }

                const ajusteData = {
                    cliente: clienteVal,
                    tipo: tipo,
                    guia: guiaSel,
                    monto: monto,
                    motivo: motivo,
                    fecha: firebase.firestore.FieldValue.serverTimestamp(),
                    usuario: firebase.auth().currentUser?.uid || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (guiaSel && tipo !== 'cargoExtra') {
                    const record = records.find(r => r.guia === guiaSel);
                    if (record) {
                        const venta = Number(record.venta || 0);
                        const cobrado = Number(record.montoCobrado || (record.cobrado===true?venta:0));
                        const nuevoCobrado = monto < 0 ? cobrado + Math.abs(monto) : cobrado - monto;
                        const nuevoEstado = nuevoCobrado >= venta ? 'pagado' : nuevoCobrado > 0 ? 'parcial' : 'pendiente';
                        const update = {
                            montoCobrado: Math.max(0, nuevoCobrado),
                            montoPendiente: Math.max(0, venta - nuevoCobrado),
                            estadoCobro: nuevoEstado,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        const batch = firebase.firestore().batch();
                        batch.set(firebase.firestore().collection('ajustes').doc(), ajusteData);

                        // Also save to notasCredito if tipo is notaCredito
                        if (tipo === 'notaCredito') {
                            var ncNum = document.getElementById('aj-nc-num').value.trim();
                            var ncData = {
                                ncNum: ncNum || '',
                                cliente: clienteVal,
                                monto: Math.abs(monto),
                                motivo: motivo,
                                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                                empresa: record.empresa || '',
                                interlogicId: record.id || '',
                                guia: guiaSel,
                                docRef: (record.doc || '') + ' #' + (record.docNum || guiaSel),
                                afectaSaldo: true,
                                estado: 'activa',
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                createdBy: firebase.auth().currentUser?.uid || ''
                            };
                            batch.set(firebase.firestore().collection('notasCredito').doc(), ncData);
                        }

                        batch.update(firebase.firestore().collection('interlogic').doc(record.id), update);
                        await batch.commit();
                    } else {
                        await firebase.firestore().collection('ajustes').add(ajusteData);
                        // Also save to notasCredito if tipo is notaCredito
                        if (tipo === 'notaCredito') {
                            var ncNum2 = document.getElementById('aj-nc-num').value.trim();
                            await firebase.firestore().collection('notasCredito').add({
                                ncNum: ncNum2 || '',
                                cliente: clienteVal,
                                monto: Math.abs(monto),
                                motivo: motivo,
                                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                                empresa: '',
                                interlogicId: '',
                                guia: guiaSel,
                                docRef: '',
                                afectaSaldo: false,
                                estado: 'activa',
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                createdBy: firebase.auth().currentUser?.uid || ''
                            });
                        }
                    }
                } else {
                    await firebase.firestore().collection('ajustes').add(ajusteData);
                    // Also save to notasCredito if tipo is notaCredito
                    if (tipo === 'notaCredito') {
                        var ncNum3 = document.getElementById('aj-nc-num').value.trim();
                        await firebase.firestore().collection('notasCredito').add({
                            ncNum: ncNum3 || '',
                            cliente: clienteVal,
                            monto: Math.abs(monto),
                            motivo: motivo,
                            fecha: firebase.firestore.FieldValue.serverTimestamp(),
                            empresa: '',
                            interlogicId: '',
                            guia: '',
                            docRef: '',
                            afectaSaldo: false,
                            estado: 'activa',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            createdBy: firebase.auth().currentUser?.uid || ''
                        });
                    }
                }

                modal.remove();
                showToast('✅ Ajuste guardado', 'success');
            } catch(err) { showToast('Error: '+err.message,'error'); setButtonLoading(btn,false); }
        });
    },

    // ==================== REGISTRAR PAGO ====================
    showPaymentModal(recordId) {
        const records = this.getCreditRecords();
        const r = records.find(rec => rec.id === recordId);
        if (!r) { showToast('Registro no encontrado', 'error'); return; }

        const cobrado = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
        const pendiente = Math.max(0, Number(r.venta || 0) - cobrado);
        if (pendiente <= 0) { showToast('Esta factura ya está pagada', 'error'); return; }

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:450px;">
                <h2 style="margin-bottom:1rem;">💰 Registrar Pago</h2>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;margin-bottom:1rem;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;">
                        <div><span style="color:#8e8e93;">Guía:</span> <strong>${sanitizeHTML(r.guia||'N/A')}</strong></div>
                        <div><span style="color:#8e8e93;">Cliente:</span> <strong>${sanitizeHTML(r.cliente||'')}</strong></div>
                        <div><span style="color:#8e8e93;">Venta:</span> <strong>${formatCurrency(r.venta||0)}</strong></div>
                        <div><span style="color:#8e8e93;">Cobrado:</span> <strong style="color:#22c55e;">${formatCurrency(cobrado)}</strong></div>
                        <div style="grid-column:span 2;"><span style="color:#8e8e93;">Pendiente:</span> <strong style="color:#ef4444;font-size:1.1rem;">${formatCurrency(pendiente)}</strong></div>
                    </div>
                    ${(r.planPagos||[]).length > 0 ? `
                    <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px dashed #e2e8f0;">
                        <div style="font-size:0.75rem;color:#7c3aed;font-weight:600;margin-bottom:4px;">📅 Pagos programados:</div>
                        ${r.planPagos.map((pp,i) => `<div style="font-size:0.75rem;color:#555;">${i+1}. ${pp.fecha} — ${formatCurrency(pp.monto)}</div>`).join('')}
                    </div>
                    ` : ''}
                </div>
                <form id="payment-form">
                    <div class="form-group">
                        <label>Monto a cobrar</label>
                        <input type="number" id="pay-monto" step="0.01" min="0.01" max="${pendiente}" value="${pendiente}" style="width:100%;" required>
                    </div>
                    <div class="form-group" style="margin-top:1rem;">
                        <label>Método de pago</label>
                        <select id="pay-metodo" style="width:100%;">
                            <option value="efectivo">💵 Efectivo</option>
                            <option value="transferencia">🏦 Transferencia</option>
                            <option value="deposito">🏧 Depósito</option>
                            <option value="tarjeta">💳 Tarjeta</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-top:1rem;">
                        <label>Referencia / No. Operación</label>
                        <input type="text" id="pay-referencia" style="width:100%;" placeholder="Opcional">
                    </div>
                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-pay-save">💰 Registrar Pago</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        document.getElementById('payment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-pay-save');
            const monto = parseFloat(document.getElementById('pay-monto').value) || 0;
            if (monto <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
            if (monto > pendiente) { showToast('El monto excede el saldo pendiente', 'error'); return; }
            setButtonLoading(btn, true);
            try {
                const metodo = document.getElementById('pay-metodo').value;
                const ref = document.getElementById('pay-referencia').value.trim();
                const db = firebase.firestore();
                const batch = db.batch();

                batch.set(db.collection('cobros').doc(), {
                    interlogicId: recordId,
                    cliente: r.cliente || '',
                    monto: monto,
                    metodo: metodo,
                    estado: 'pagado',
                    referencia: ref || '',
                    cobrador: firebase.auth().currentUser?.uid || '',
                    fecha: firebase.firestore.Timestamp.now(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                const nuevoCobrado = cobrado + monto;
                const ventaTotal = Number(r.venta || 0);
                const nuevoEstado = nuevoCobrado >= ventaTotal ? 'pagado' : 'parcial';
                const update = {
                    montoCobrado: nuevoCobrado,
                    montoPendiente: Math.max(0, ventaTotal - nuevoCobrado),
                    estadoCobro: nuevoEstado,
                    cobrado: nuevoEstado === 'pagado',
                    fechaCobro: nuevoEstado === 'pagado' ? firebase.firestore.FieldValue.serverTimestamp() : null,
                    metodoPago: metodo,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                // If fully paid, remove planPagos
                if (nuevoEstado === 'pagado') {
                    update.planPagos = firebase.firestore.FieldValue.delete();
                }

                batch.update(db.collection('interlogic').doc(recordId), update);
                await batch.commit();

                modal.remove();
                this.renderCurrentView();
                showToast(`✅ Pago de ${formatCurrency(monto)} registrado`, 'success');
            } catch(err) { showToast('Error: '+err.message, 'error'); setButtonLoading(btn, false); }
        });
    },

    // ==================== ESTADO DE CUENTA ====================
    renderEstadoCuenta() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords();
        const today = getLocalDateString();

        container.innerHTML = `
            <div class="card" style="margin-bottom:1rem;">
                <div class="card-body">
                    <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="cob-start-date" style="margin-bottom:0;white-space:nowrap;font-size:0.85rem;">📅 Desde:</label>
                            <input type="date" id="cob-start-date" value="${today}" style="padding:0.5rem;font-size:1rem;border:2px solid var(--border-color);border-radius:var(--radius-md);min-height:44px;">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="cob-end-date" style="margin-bottom:0;white-space:nowrap;font-size:0.85rem;">Hasta:</label>
                            <input type="date" id="cob-end-date" value="${today}" style="padding:0.5rem;font-size:1rem;border:2px solid var(--border-color);border-radius:var(--radius-md);min-height:44px;">
                        </div>
                    </div>
                    <div class="search-container" style="margin-bottom:1rem;">
                        <div class="search-box" style="position:relative;">
                            <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="cob-cliente-search" class="search-input" placeholder="Buscar por cliente, guía, empresa, doc..." autocomplete="off">
                        </div>
                        <p class="search-hint">Filtra por fecha y/o escribe cualquier palabra para buscar</p>
                    </div>
                    <div id="cob-estado-cuenta-result" style="margin-top:1rem;">
                        <p style="color:#8e8e93;">Selecciona un rango de fechas o escribe arriba para buscar</p>
                    </div>
                </div>
            </div>
        `;

        const startDateInput = document.getElementById('cob-start-date');
        const endDateInput = document.getElementById('cob-end-date');
        const searchInput = document.getElementById('cob-cliente-search');

        const updateResults = () => {
            this.showEstadoCuentaDetail(searchInput.value, records, startDateInput.value, endDateInput.value);
        };

        startDateInput.addEventListener('change', updateResults);
        endDateInput.addEventListener('change', updateResults);
        searchInput.addEventListener('input', updateResults);

        // Default: show today's records
        this.showEstadoCuentaDetail('', records, today, today);
    },

    showEstadoCuentaDetail(query, records, startDate, endDate) {
        const resultDiv = document.getElementById('cob-estado-cuenta-result');
        if (!resultDiv) return;

        const q = query.toLowerCase().trim();
        let filtered = records;

        // 1. Filter by date range first
        if (startDate || endDate) {
            filtered = filtered.filter(r => {
                const recordDate = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
                if (!recordDate) return true; // Allow records without date to pass through
                const dateStr = recordDate.toISOString().split('T')[0]; // YYYY-MM-DD
                if (startDate && dateStr < startDate) return false;
                if (endDate && dateStr > endDate) return false;
                return true;
            });
        }

        // 2. Then filter by text search
        if (q) {
            filtered = filtered.filter(r => {
                const guia = String(r.guia || '').toLowerCase();
                const cliente = String(r.cliente || '').toLowerCase();
                const empresa = String(r.empresa || '').toLowerCase();
                const doc = String(r.doc || '').toLowerCase();
                const vendedor = String(r.vendedor || '').toLowerCase();
                const cobrador = String(r.cobrador || '').toLowerCase();
                const fecha = r.fecha ? formatDateShort(r.fecha).toLowerCase() : '';
                return guia.includes(q) || cliente.includes(q) || empresa.includes(q) || doc.includes(q) || vendedor.includes(q) || cobrador.includes(q) || fecha.includes(q);
            });
        }

        if (filtered.length === 0) {
            let msg = 'Sin resultados';
            if (startDate && endDate && startDate === endDate) msg += ` para el ${startDate}`;
            else if (startDate || endDate) msg += ` para el rango ${startDate||'...'} a ${endDate||'...'}`;
            if (q) msg += ` con búsqueda "<strong>${sanitizeHTML(query)}</strong>"`;
            resultDiv.innerHTML = `<p style="color:#8e8e93;text-align:center;padding:2rem;">${msg}</p>`;
            return;
        }

        const totalVenta = filtered.reduce((s, r) => s + Number(r.venta || 0), 0);
        const totalCobrado = filtered.reduce((s, r) => s + Number(r.montoCobrado || (r.cobrado===true?r.venta:0)), 0);
        const totalPendiente = totalVenta - totalCobrado;

        const ajustesRel = this.ajustes.filter(a => {
            const match = filtered.some(r => r.guia === a.guia);
            if (match) return true;
            return q && a.cliente && a.cliente.toLowerCase().includes(q);
        });
        const ajusteNeto = ajustesRel.reduce((s, a) => s + (Number(a.monto) || 0), 0);

        resultDiv.innerHTML = `
            <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1rem;">
                <div class="stat-card"><h3>Total Venta</h3><p>${formatCurrency(totalVenta)}</p></div>
                <div class="stat-card"><h3>Total Cobrado</h3><p style="color:#22c55e;">${formatCurrency(totalCobrado)}</p></div>
                <div class="stat-card"><h3>Saldo Pendiente</h3><p style="color:${totalPendiente>0?'#f97316':'#22c55e'};">${formatCurrency(totalPendiente)}</p></div>
                <div class="stat-card"><h3>Ajustes Netos</h3><p style="color:${ajusteNeto<0?'#22c55e':'#ef4444'};">${ajusteNeto<0?'−':''}${formatCurrency(Math.abs(ajusteNeto))}</p></div>
            </div>
            <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
                <thead><tr style="background:#f0f0f0;">
                    <th style="padding:8px;">Guía</th><th style="padding:8px;">Cliente</th><th style="padding:8px;">Fecha</th>
                    <th style="text-align:right;padding:8px;">Venta</th><th style="text-align:right;padding:8px;">Cobrado</th>
                    <th style="text-align:right;padding:8px;">Programado</th><th style="text-align:right;padding:8px;">Pendiente</th>
                    <th style="text-align:center;padding:8px;">Estado</th><th style="padding:8px;">Ruta</th>
                    <th style="text-align:center;padding:8px;">Acción</th>
                </tr></thead>
                <tbody>${filtered.map(r => {
                    const c = Number(r.montoCobrado||(r.cobrado===true?r.venta:0));
                    const prog = r.montoProgramado || 0;
                    const p = Math.max(0,Number(r.venta||0)-c-prog);
                    const e = r.estadoCobro||(r.cobrado===true?'pagado':'pendiente');
                    const ec = e==='pagado'?'#22c55e':e==='parcial'?'#f97316':'#ef4444';
                    const ruta = this.routes.find(rt => rt.id === r.rutaId);
                    const rutaLabel = ruta ? '#' + (ruta.correlativo || ruta.id.substring(0,6)) + ' ' + (ruta.repartidorNombre||'') : '-';
                    const showPayBtn = p > 0 || e !== 'pagado';
                    return `<tr>
                        <td style="padding:8px;font-weight:bold;">${r.guia||''}</td>
                        <td style="padding:8px;">${sanitizeHTML(r.cliente||'')}</td><td style="padding:8px;">${r.fecha?formatDateShort(r.fecha):''}</td>
                        <td style="text-align:right;padding:8px;">${formatCurrency(r.venta||0)}</td>
                        <td style="text-align:right;padding:8px;color:#22c55e;">${formatCurrency(c)}</td>
                        <td style="text-align:right;padding:8px;color:#7c3aed;">${prog>0?formatCurrency(prog):'-'}${(r.planPagos||[]).length>0?'<br><small style="color:#7c3aed;">'+r.planPagos.length+' pagos</small>':''}</td>
                        <td style="text-align:right;padding:8px;color:${p>0?'#ef4444':'#22c55e'};">${formatCurrency(p)}</td>
                        <td style="text-align:center;padding:8px;color:${ec};font-weight:bold;">${e.charAt(0).toUpperCase()+e.slice(1)}</td>
                        <td style="padding:8px;font-size:0.75rem;">${sanitizeHTML(rutaLabel)}</td>
                        <td style="text-align:center;padding:8px;">${showPayBtn ? `<button class="btn btn-primary btn-sm" onclick="Cobranza.showPaymentModal('${r.id}')" title="Registrar pago" style="font-size:0.75rem;padding:4px 10px;">💰 Cobrar</button>` : '✅'}</td>
                    </tr>`;
                }).join('')}</tbody>
                <tfoot><tr style="background:#e5e5e5;font-weight:bold;">
                    <td colspan="3" style="padding:8px;text-align:right;">TOTALES (${filtered.length})</td>
                    <td style="text-align:right;padding:8px;">${formatCurrency(totalVenta)}</td>
                    <td style="text-align:right;padding:8px;">${formatCurrency(totalCobrado)}</td>
                    <td style="text-align:right;padding:8px;">-</td>
                    <td style="text-align:right;padding:8px;">${formatCurrency(totalPendiente)}</td><td></td><td></td>
                </tr></tfoot>
            </table>
            ${ajustesRel.length>0 ? `<div style="margin-top:1rem;"><h4 style="font-size:0.85rem;color:#666;margin-bottom:4px;">Ajustes Relacionados (${ajustesRel.length})</h4><table style="width:100%;font-size:0.8rem;"><thead><tr style="background:#fefce8;"><th style="padding:4px;">Tipo</th><th style="padding:4px;text-align:right;">Monto</th><th style="padding:4px;">Motivo</th><th style="padding:4px;">Fecha</th></tr></thead><tbody>${ajustesRel.map(a=>`<tr style="background:#fffbeb;"><td style="padding:4px;">${a.tipo||''}</td><td style="text-align:right;padding:4px;color:${(a.monto||0)<0?'#22c55e':'#ef4444'};">${(a.monto||0)<0?'−':''}${formatCurrency(Math.abs(a.monto||0))}</td><td style="padding:4px;">${sanitizeHTML(a.motivo||'')}</td><td style="padding:4px;">${a.fecha&&a.fecha.toDate?formatDateShort(a.fecha):''}</td></tr>`).join('')}</tbody></table></div>`:''}
            <button class="btn btn-secondary" onclick="Cobranza.printEstadoCuenta('${q||''}','${startDate||''}','${endDate||''}')" style="margin-top:1rem;">🖨️ Imprimir Estado de Cuenta</button>
        `;
    },

    // ==================== AGING ====================
    renderAging() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords().filter(r => r.estadoCobro !== 'pagado');
        const byClient = {};
        records.forEach(r => {
            const n = (r.cliente || 'Sin nombre').trim();
            if (!byClient[n]) byClient[n] = { corriente:0,'1-30':0,'31-60':0,'61-90':0,'90+':0,total:0 };
            byClient[n][r.agingBucket] += r.pendiente;
            byClient[n].total += r.pendiente;
        });
        const cl = Object.entries(byClient).sort((a,b)=>b[1].total-a[1].total);
        container.innerHTML = `
            <div class="card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                    <h2>📅 Reporte de Antigüedad de Saldos</h2>
                    <button class="btn btn-secondary" onclick="Cobranza.exportAgingExcel()">📥 Exportar Excel</button>
                </div>
                <div class="card-body">
                    ${cl.length===0?'<p style="text-align:center;padding:2rem;color:#8e8e93;">No hay saldos pendientes</p>':
                    `<div class="table-container"><table class="data-table" style="font-size:0.85rem;"><thead><tr><th>Cliente</th><th style="text-align:right;">Total</th><th style="text-align:right;color:#22c55e;">Corriente</th><th style="text-align:right;color:#eab308;">1-30 d</th><th style="text-align:right;color:#f97316;">31-60 d</th><th style="text-align:right;color:#ef4444;">61-90 d</th><th style="text-align:right;color:#dc2626;">90+ d</th></tr></thead><tbody>${cl.map(([n,b])=>`<tr><td><strong>${sanitizeHTML(n)}</strong></td><td style="text-align:right;font-weight:700;">${formatCurrency(b.total)}</td><td style="text-align:right;">${formatCurrency(b.corriente)}</td><td style="text-align:right;">${formatCurrency(b['1-30'])}</td><td style="text-align:right;">${formatCurrency(b['31-60'])}</td><td style="text-align:right;">${formatCurrency(b['61-90'])}</td><td style="text-align:right;">${formatCurrency(b['90+'])}</td></tr>`).join('')}</tbody><tfoot><tr style="background:#e5e5e5;font-weight:700;"><td>TOTALES</td><td style="text-align:right;">${formatCurrency(cl.reduce((s,[,b])=>s+b.total,0))}</td><td style="text-align:right;">${formatCurrency(cl.reduce((s,[,b])=>s+b.corriente,0))}</td><td style="text-align:right;">${formatCurrency(cl.reduce((s,[,b])=>s+b['1-30'],0))}</td><td style="text-align:right;">${formatCurrency(cl.reduce((s,[,b])=>s+b['31-60'],0))}</td><td style="text-align:right;">${formatCurrency(cl.reduce((s,[,b])=>s+b['61-90'],0))}</td><td style="text-align:right;">${formatCurrency(cl.reduce((s,[,b])=>s+b['90+'],0))}</td></tr></tfoot></table></div>`}
                </div>
            </div>
        `;
    },

    // ==================== EXPORTS / PRINT ====================
    exportAgingExcel() {
        if (typeof XLSX === 'undefined') { showToast('Excel no disponible','error'); return; }
        const records = this.getCreditRecords().filter(r=>r.estadoCobro!=='pagado');
        const byClient = {};
        records.forEach(r=>{const n=(r.cliente||'Sin nombre').trim();if(!byClient[n])byClient[n]={corriente:0,'1-30':0,'31-60':0,'61-90':0,'90+':0,total:0};byClient[n][r.agingBucket]+=r.pendiente;byClient[n].total+=r.pendiente;});
        const data = Object.entries(byClient).map(([n,b])=>({Cliente:n,Total:b.total,Corriente:b.corriente,'1-30 días':b['1-30'],'31-60 días':b['31-60'],'61-90 días':b['61-90'],'90+ días':b['90+']}));
        const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb,ws,'Antigüedad de Saldos');
        XLSX.writeFile(wb,'Antiguedad_Saldos_'+new Date().toISOString().split('T')[0]+'.xlsx');
        showToast('Reporte exportado','success');
    },

    printEstadoCuenta(query, startDate, endDate) {
        const records = this.getCreditRecords();
        let filtered = records;

        // Filter by date range first
        if (startDate || endDate) {
            filtered = filtered.filter(r => {
                const recordDate = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
                if (!recordDate) return true;
                const dateStr = recordDate.toISOString().split('T')[0];
                if (startDate && dateStr < startDate) return false;
                if (endDate && dateStr > endDate) return false;
                return true;
            });
        }

        // Then filter by text search
        if (query) {
            const q = query.toLowerCase().trim();
            filtered = filtered.filter(r => {
                const guia = String(r.guia || '').toLowerCase();
                const cliente = String(r.cliente || '').toLowerCase();
                const empresa = String(r.empresa || '').toLowerCase();
                const doc = String(r.doc || '').toLowerCase();
                return guia.includes(q) || cliente.includes(q) || empresa.includes(q) || doc.includes(q);
            });
        }
        const printArea = document.getElementById('print-area'); if (!printArea) return;
        const tv=filtered.reduce((s,r)=>s+Number(r.venta||0),0), tc=filtered.reduce((s,r)=>s+Number(r.montoCobrado||(r.cobrado===true?r.venta:0)),0), tp=tv-tc;
        const today=new Date().toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'});
        let periodLabel = '';
        if (startDate && endDate && startDate === endDate) periodLabel = ` · Fecha: ${startDate}`;
        else if (startDate || endDate) periodLabel = ` · Período: ${startDate||'...'} a ${endDate||'...'}`;
        printArea.innerHTML=`<div style="font-family:Arial,sans-serif;padding:20px;max-width:1000px;margin:0 auto;color:#000;"><h1 style="font-size:1.5rem;margin-bottom:5px;">Estado de Cuenta</h1><p style="color:#666;">${query?'Búsqueda: '+sanitizeHTML(query):'Todos los clientes'}${periodLabel} · ${today}</p><table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-top:15px;"><thead><tr style="background:#f0f0f0;"><th style="border:1px solid #ccc;padding:6px;">Guía</th><th style="border:1px solid #ccc;padding:6px;">Cliente</th><th style="border:1px solid #ccc;padding:6px;">Fecha</th><th style="border:1px solid #ccc;padding:6px;">Venta</th><th style="border:1px solid #ccc;padding:6px;">Cobrado</th><th style="border:1px solid #ccc;padding:6px;">Pendiente</th></tr></thead><tbody>${filtered.map(r=>{const c=Number(r.montoCobrado||(r.cobrado===true?r.venta:0));return`<tr><td style="border:1px solid #ccc;padding:6px;">${r.guia||''}</td><td style="border:1px solid #ccc;padding:6px;">${sanitizeHTML(r.cliente||'')}</td><td style="border:1px solid #ccc;padding:6px;">${r.fecha?formatDateShort(r.fecha):''}</td><td style="border:1px solid #ccc;padding:6px;text-align:right;">${formatCurrency(r.venta||0)}</td><td style="border:1px solid #ccc;padding:6px;text-align:right;">${formatCurrency(c)}</td><td style="border:1px solid #ccc;padding:6px;text-align:right;">${formatCurrency(Math.max(0,Number(r.venta||0)-c))}</td></tr>`;}).join('')}</tbody><tfoot><tr style="background:#e5e5e5;font-weight:bold;"><td colspan="3" style="border:1px solid #ccc;padding:6px;text-align:right;">TOTALES</td><td style="border:1px solid #ccc;padding:6px;text-align:right;">${formatCurrency(tv)}</td><td style="border:1px solid #ccc;padding:6px;text-align:right;">${formatCurrency(tc)}</td><td style="border:1px solid #ccc;padding:6px;text-align:right;">${formatCurrency(tp)}</td></tr></tfoot></table><div style="margin-top:20px;text-align:center;color:#888;font-size:0.7rem;">${filtered.length} registro(s) · Generado ${today}</div></div>`;
        setTimeout(()=>window.print(),100);
    },

    // ==================== MOBILE ====================
    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div style="padding:0 0 8px 0;"><h1 style="font-size:1.35rem;font-weight:800;">📊 Cobranza</h1><p style="font-size:0.78rem;color:#8e8e93;">Gestión de cuentas por cobrar</p></div>
            <div class="m-actions-bar" style="flex-wrap:wrap;">
                <button class="btn btn-primary" id="mcob-dash" style="border-radius:20px;">📊 KPIs</button>
                <button class="btn" id="mcob-edo" style="border-radius:20px;">📋 Estado</button>
                <button class="btn" id="mcob-age" style="border-radius:20px;">📅 Antigüedad</button>
                <button class="btn" id="mcob-proy" style="border-radius:20px;">📆 Proy</button>
                <button class="btn" id="mcob-aler" style="border-radius:20px;">🔔</button>
                <button class="btn" id="mcob-ges" style="border-radius:20px;">📝 Gest</button>
                <button class="btn" id="mcob-aju" style="border-radius:20px;">💡 Ajus</button>
            </div>
            <div id="mcob-content" style="margin-top:10px;"><div style="text-align:center;padding:40px;color:#8e8e93;">Cargando...</div></div>
        `;
        document.getElementById('mcob-dash').addEventListener('click',()=>{this.currentView='dashboard';this.renderMobileView();});
        document.getElementById('mcob-edo').addEventListener('click',()=>{this.currentView='estado-cuenta';this.renderMobileView();});
        document.getElementById('mcob-age').addEventListener('click',()=>{this.currentView='aging';this.renderMobileView();});
        document.getElementById('mcob-proy').addEventListener('click',()=>{this.currentView='proyeccion';this.renderMobileView();});
        document.getElementById('mcob-aler').addEventListener('click',()=>{this.currentView='alertas';this.renderMobileView();});
        document.getElementById('mcob-ges').addEventListener('click',()=>{this.currentView='gestiones';this.renderMobileView();});
        document.getElementById('mcob-aju').addEventListener('click',()=>{this.currentView='ajustes';this.renderMobileView();});
        await this.loadData();
        this.renderMobileView();
    },

    renderMobileView() {
        const container = document.getElementById('mcob-content'); if (!container) return;
        const records = this.getCreditRecords();
        const pendientes = records.filter(r=>r.estadoCobro!=='pagado');
        const totalCxC = pendientes.reduce((s,r)=>s+r.pendiente,0);
        const dso = this.calcDSO(records);

        if (this.currentView === 'dashboard') {
            const months = this.getMonthlyComparison(records).slice(-3);
            container.innerHTML = `
                <div class="m-stats-row"><div class="m-stat-chip"><div class="m-stat-chip-label">CxC</div><div class="m-stat-chip-value" style="color:#f97316;">${formatCurrency(totalCxC)}</div></div><div class="m-stat-chip"><div class="m-stat-chip-label">Pend</div><div class="m-stat-chip-value">${pendientes.length}</div></div><div class="m-stat-chip"><div class="m-stat-chip-label">DSO</div><div class="m-stat-chip-value">${dso}d</div></div></div>
                <div style="font-size:0.7rem;color:#8e8e93;margin:8px 0 4px;">Comparativo Mensual</div>
                ${months.map(m=>`<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:0.7rem;"><span>${m.label}</span><span>${formatCurrency(m.cobros)} / ${formatCurrency(m.ventas)}</span></div><div style="height:6px;background:#e5e5ea;border-radius:3px;"><div style="height:100%;width:${m.ventas>0?Math.round(m.cobros/m.ventas*100):0}%;background:#22c55e;border-radius:3px;"></div></div></div>`).join('')}
            `;
        } else if (this.currentView === 'proyeccion') {
            const proy = records.filter(r=>r.estadoCobro!=='pagado'&&r.fechaVenc).sort((a,b)=>a.fechaVenc-b.fechaVenc);
            container.innerHTML = `
                <div class="m-stats-row"><div class="m-stat-chip"><div class="m-stat-chip-label">Proyectado</div><div class="m-stat-chip-value">${formatCurrency(proy.reduce((s,r)=>s+r.pendiente,0))}</div></div></div>
                ${proy.slice(0,15).map(r=>`<div class="m-data-card"><div class="m-card-header"><span class="m-card-title">${sanitizeHTML(r.cliente||'')}</span><span class="m-card-badge ${r.agingDays>0?'error':'success'}">${r.agingDays>0?'+'+r.agingDays+'d':r.agingDays===0?'Hoy':Math.abs(r.agingDays)+'d'}</span></div><div class="m-card-rows"><div class="m-card-row"><span class="m-card-label">Guía #${r.guia||'N/A'}</span><span class="m-card-value money" style="color:#f97316;">${formatCurrency(r.pendiente)}</span></div></div></div>`).join('')}
            `;
        } else if (this.currentView === 'alertas') {
            const alertas = this.getAlertas();
            container.innerHTML = `
                <div class="m-stats-row"><div class="m-stat-chip"><div class="m-stat-chip-label">Alertas</div><div class="m-stat-chip-value">${alertas.length}</div></div></div>
                ${alertas.length===0?'<div class="m-empty"><div class="m-empty-icon">✅</div><div class="m-empty-title">Todo al día</div></div>':alertas.slice(0,20).map(a=>`<div class="m-data-card"><div class="m-card-header"><span>${a.icono}</span><span class="m-card-title" style="color:${a.tipo==='critico'?'#ef4444':a.tipo==='warning'?'#f97316':'#eab308'};">${sanitizeHTML(a.mensaje)}</span></div></div>`).join('')}
            `;
        } else if (this.currentView === 'gestiones') {
            container.innerHTML = `
                <button class="btn btn-primary" onclick="Cobranza.showGestionModal(Cobranza.getCreditRecords())" style="width:100%;margin-bottom:10px;border-radius:20px;">➕ Nueva Gestión</button>
                ${this.gestiones.length===0?'<div class="m-empty"><div class="m-empty-icon">📝</div><div class="m-empty-title">Sin gestiones</div></div>':this.gestiones.slice(0,20).map(g=>`<div class="m-data-card"><div class="m-card-header"><span class="m-card-title">${sanitizeHTML(g.cliente||'')}</span><span class="m-card-badge">${g.tipo||''}</span></div><div class="m-card-rows"><div class="m-card-row"><span class="m-card-label">${g.fecha&&g.fecha.toDate?formatDateShort(g.fecha):''}</span><span class="m-card-value">${sanitizeHTML(g.resultado||g.descripcion||'')}</span></div></div></div>`).join('')}
            `;
        } else if (this.currentView === 'ajustes') {
            // Merge ajustes and notasCredito for mobile display
            const allItems = [
                ...this.ajustes.map(a => ({ ...a, _source: 'ajuste' })),
                ...this.notasCredito.map(nc => ({ ...nc, _source: 'nc', tipo: 'notaCredito', monto: -(nc.monto || 0), guia: nc.guia || '' }))
            ].sort((a, b) => {
                const da = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
                const db2 = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
                return db2 - da;
            });
            container.innerHTML = `
                <button class="btn btn-primary" onclick="Cobranza.showAjusteModal(Cobranza.getCreditRecords())" style="width:100%;margin-bottom:10px;border-radius:20px;">💡 Nuevo Ajuste</button>
                ${allItems.length===0?'<div class="m-empty"><div class="m-empty-icon">💡</div><div class="m-empty-title">Sin ajustes</div></div>':allItems.slice(0,20).map(a=>{
                    const isNC = a._source === 'nc';
                    const tipoLabel = isNC ? 'Nota de Crédito' : (a.tipo||'');
                    return `<div class="m-data-card"><div class="m-card-header"><span class="m-card-title">${sanitizeHTML(a.cliente||'')}</span><span class="m-card-badge ${isNC?'badge-nc':''}">${tipoLabel}</span></div><div class="m-card-rows"><div class="m-card-row"><span class="m-card-label">${a.fecha&&a.fecha.toDate?formatDateShort(a.fecha):''}</span><span class="m-card-value money" style="color:${(a.monto||0)<0?'#22c55e':'#ef4444'};">${(a.monto||0)<0?'−':''}${formatCurrency(Math.abs(a.monto||0))}</span></div>${isNC&&a.ncNum?`<div class="m-card-row"><span class="m-card-label">N° NC</span><span class="m-card-value">${sanitizeHTML(a.ncNum)}</span></div>`:''}</div></div>`;
                }).join('')}
            `;
        } else {
            const aging = {corriente:0,'1-30':0,'31-60':0,'61-90':0,'90+':0};
            pendientes.forEach(r=>{aging[r.agingBucket]+=r.pendiente;});
            const tot = Object.values(aging).reduce((a,b)=>a+b,0);
            container.innerHTML = `
                <div class="m-stats-row"><div class="m-stat-chip"><div class="m-stat-chip-label">Pendiente</div><div class="m-stat-chip-value" style="color:#f97316;">${formatCurrency(tot)}</div></div></div>
                ${Object.entries(aging).map(([k,v])=>{const p=tot>0?v/tot*100:0;const c=k==='corriente'?'#10b981':k==='1-30'?'#eab308':k==='31-60'?'#f97316':k==='61-90'?'#ef4444':'#dc2626';return`<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:0.7rem;"><span>${k}</span><span>${formatCurrency(v)} (${p.toFixed(0)}%)</span></div><div style="height:6px;background:#e5e5ea;border-radius:3px;"><div style="height:100%;width:${p}%;background:${c};border-radius:3px;"></div></div></div>`;}).join('')}
            `;
        }
    }
};

window.Cobranza = Cobranza;
