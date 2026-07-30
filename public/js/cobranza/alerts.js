// ===================================
// Cobranza - Alerts Module
// ===================================

const CobranzaAlerts = {
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
    }
};

window.CobranzaAlerts = CobranzaAlerts;
