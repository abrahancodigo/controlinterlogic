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
            ${SharedComponents.renderStatsGrid([
                { label: 'Total Alertas', id: 'cob-alertas-total' },
                { label: 'Críticas', id: 'cob-alertas-criticas', style: 'color:#ef4444;' },
                { label: 'Por Vencer', id: 'cob-alertas-por-vencer', style: 'color:#3b82f6;' }
            ], { containerStyle: 'margin-bottom:1rem;' })}
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

        // Actualizar stats después de renderizar
        const elTotal = document.getElementById('cob-alertas-total');
        if (elTotal) elTotal.textContent = alertas.length;
        const elCriticas = document.getElementById('cob-alertas-criticas');
        if (elCriticas) elCriticas.textContent = grupos.critico.items.length;
        const elPorVencer = document.getElementById('cob-alertas-por-vencer');
        if (elPorVencer) elPorVencer.textContent = grupos.info.items.length;
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
            ${SharedComponents.renderStatsGrid([
                { label: 'Total Proyectado', id: 'cob-proy-total', style: 'color:#f97316;' },
                { label: 'Próx. 30 días', id: 'cob-proy-30d', style: 'color:#eab308;' },
                { label: 'Registros', id: 'cob-proy-registros' }
            ], { containerStyle: 'margin-bottom:1rem;' })}
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

        // Actualizar stats después de renderizar
        const totalProyectado = records.reduce((s, r) => s + r.pendiente, 0);
        const prox30d = records.filter(r => r.agingDays >= 0 && r.agingDays <= 30).reduce((s, r) => s + r.pendiente, 0);
        const elTotalProy = document.getElementById('cob-proy-total');
        if (elTotalProy) elTotalProy.textContent = formatCurrency(totalProyectado);
        const el30d = document.getElementById('cob-proy-30d');
        if (el30d) el30d.textContent = formatCurrency(prox30d);
        const elRegistros = document.getElementById('cob-proy-registros');
        if (elRegistros) elRegistros.textContent = records.length;
    }
};

window.CobranzaAlerts = CobranzaAlerts;
