// ===================================
// Cobranza - Dashboard Module
// ===================================

const CobranzaDashboard = {
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
            ${SharedComponents.renderStatsGrid([
                { label: 'Total CxC', id: 'cob-dash-total-cxc', style: 'color:#f97316;' },
                { label: 'Cartera Vencida', id: 'cob-dash-cartera-vencida', style: 'color:#ef4444;' },
                { label: 'Cobrado este Mes', id: 'cob-dash-cobrado-mes', style: 'color:#22c55e;' },
                { label: 'DSO (días cobro)', id: 'cob-dash-dso', style: `color:${dso > 30 ? '#ef4444' : '#22c55e'};` },
                { label: 'CEI (efectividad)', id: 'cob-dash-cei', style: `color:${cei >= 80 ? '#22c55e' : cei >= 50 ? '#f97316' : '#ef4444'};` },
                { label: 'Pendientes', id: 'cob-dash-pendientes' }
            ], { containerStyle: 'margin-bottom:1rem;' })}

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

        // Actualizar stats después de renderizar
        const elTotalCxC = document.getElementById('cob-dash-total-cxc');
        if (elTotalCxC) elTotalCxC.textContent = formatCurrency(totalCxC);
        const elCarteraVencida = document.getElementById('cob-dash-cartera-vencida');
        if (elCarteraVencida) elCarteraVencida.textContent = carteraVencida.toFixed(1) + '%';
        const elCobradoMes = document.getElementById('cob-dash-cobrado-mes');
        if (elCobradoMes) elCobradoMes.textContent = formatCurrency(cobradoMes);
        const elDSO = document.getElementById('cob-dash-dso');
        if (elDSO) elDSO.textContent = dso + ' días';
        const elCEI = document.getElementById('cob-dash-cei');
        if (elCEI) elCEI.textContent = cei + '%';
        const elPendientes = document.getElementById('cob-dash-pendientes');
        if (elPendientes) elPendientes.textContent = pendientes.length + ' registros';
    }
};

window.CobranzaDashboard = CobranzaDashboard;
