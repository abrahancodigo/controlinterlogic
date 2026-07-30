// ===================================
// Cobranza - Main Index Module
// ===================================

const Cobranza = {
    ...CobranzaCore,
    ...CobranzaDashboard,
    ...CobranzaAlerts,
    ...CobranzaGestiones,
    ...CobranzaAdjustments,

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

    renderEstadoCuenta() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords().filter(r => r.estadoCobro !== 'pagado');
        records.sort((a, b) => b.pendiente - a.pendiente);

        container.innerHTML = `
            <div class="stats-grid" style="margin-bottom:1rem;">
                <div class="stat-card"><h3>Total Pendiente</h3><p style="color:#f97316;">${formatCurrency(records.reduce((s,r)=>s+r.pendiente,0))}</p></div>
                <div class="stat-card"><h3>Registros</h3><p>${records.length}</p></div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table style="width:100%;font-size:0.85rem;">
                        <thead><tr style="background:#f0f0f0;">
                            <th style="padding:8px;">Guía</th><th style="padding:8px;">Cliente</th>
                            <th style="padding:8px;text-align:right;">Venta</th><th style="padding:8px;text-align:right;">Cobrado</th>
                            <th style="padding:8px;text-align:right;">Pendiente</th><th style="padding:8px;">Estado</th>
                            <th style="padding:8px;">Acciones</th>
                        </tr></thead>
                        <tbody>${records.map(r => `<tr>
                            <td style="padding:8px;font-weight:bold;">${r.guia||''}</td>
                            <td style="padding:8px;">${sanitizeHTML(r.cliente||'')}</td>
                            <td style="padding:8px;text-align:right;">${formatCurrency(r.venta||0)}</td>
                            <td style="padding:8px;text-align:right;color:#22c55e;">${formatCurrency(r.montoCobrado)}</td>
                            <td style="padding:8px;text-align:right;color:#ef4444;font-weight:700;">${formatCurrency(r.pendiente)}</td>
                            <td style="padding:8px;"><span class="badge ${r.estadoCobro==='parcial'?'badge-warning':'badge-error'}">${r.estadoCobro}</span></td>
                            <td style="padding:8px;"><button class="btn btn-primary btn-sm" onclick="Cobranza.showPaymentModal('${r.id}')">💰 Pagar</button></td>
                        </tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderAging() {
        const container = document.getElementById('cobranza-content');
        if (!container) return;
        const records = this.getCreditRecords().filter(r => r.estadoCobro !== 'pagado');
        const buckets = { 'corriente': [], '1-30': [], '31-60': [], '61-90': [], '90+': [] };
        records.forEach(r => { if (buckets[r.agingBucket]) buckets[r.agingBucket].push(r); });

        container.innerHTML = `
            <div class="stats-grid" style="margin-bottom:1rem;">
                ${Object.entries(buckets).map(([k, v]) => `
                    <div class="stat-card"><h3>${k==='corriente'?'Corriente':k}</h3><p>${v.length} · ${formatCurrency(v.reduce((s,r)=>s+r.pendiente,0))}</p></div>
                `).join('')}
            </div>
            ${Object.entries(buckets).map(([k, v]) => v.length > 0 ? `
                <div class="card" style="margin-bottom:1rem;">
                    <div class="card-header"><h2>${k==='corriente'?'✅ Corriente':k==='1-30'?'🟡 1-30 días':k==='31-60'?'🟠 31-60 días':k==='61-90'?'🔴 61-90 días':'⛔ 90+ días'} (${v.length})</h2></div>
                    <div class="card-body">
                        <table style="width:100%;font-size:0.85rem;">
                            <thead><tr><th>Guía</th><th>Cliente</th><th style="text-align:right;">Pendiente</th><th>Días vencido</th></tr></thead>
                            <tbody>${v.map(r => `<tr><td>${r.guia||''}</td><td>${sanitizeHTML(r.cliente||'')}</td><td style="text-align:right;color:#ef4444;">${formatCurrency(r.pendiente)}</td><td>${r.agingDays}d</td></tr>`).join('')}</tbody>
                        </table>
                    </div>
                </div>
            ` : '').join('')}
        `;
    },

    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div style="padding: 0 0 8px 0;">
                <h1 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 2px;">📊 Cobranza</h1>
                <p style="font-size: 0.78rem; color: var(--m-text-secondary);">Cuentas por cobrar</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                <button class="btn ${this.currentView==='dashboard'?'btn-primary':'btn-secondary'}" onclick="Cobranza.currentView='dashboard';Cobranza.renderMobile();" style="flex:1;min-width:60px;font-size:0.75rem;">📊 KPIs</button>
                <button class="btn ${this.currentView==='alertas'?'btn-primary':'btn-secondary'}" onclick="Cobranza.currentView='alertas';Cobranza.renderMobile();" style="flex:1;min-width:60px;font-size:0.75rem;">🔔 Alertas</button>
                <button class="btn ${this.currentView==='gestiones'?'btn-primary':'btn-secondary'}" onclick="Cobranza.currentView='gestiones';Cobranza.renderMobile();" style="flex:1;min-width:60px;font-size:0.75rem;">📝 Gest.</button>
                <button class="btn ${this.currentView==='ajustes'?'btn-primary':'btn-secondary'}" onclick="Cobranza.currentView='ajustes';Cobranza.renderMobile();" style="flex:1;min-width:60px;font-size:0.75rem;">💡 Ajust.</button>
            </div>
            <div id="cobranza-content">
                <div style="text-align:center;padding:3rem;">Cargando...</div>
            </div>
        `;
        await this.loadData();
        this.renderCurrentView();
    }
};

window.Cobranza = Cobranza;
