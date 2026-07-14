const Dashboard = {
    records: [],
    prevRecords: [],
    fechaInicio: null,
    fechaFin: null,
    unsubscribe: null,
    charts: {},
    chartInit: false,
    themeObserver: null,

    init() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        this.fechaInicio = new Date(today);
        this.fechaFin = new Date(today);
        this.fechaFin.setHours(23, 59, 59, 999);
    },

    /* ── Period helpers ── */
    getPeriodDates(period) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let s = new Date(now), e = new Date(now);
        e.setHours(23, 59, 59, 999);
        if (period === 'today') { /* default */ }
        else if (period === 'week') {
            s.setDate(s.getDate() - s.getDay());
        } else if (period === 'month') {
            s.setDate(1);
        } else if (period === 'quarter') {
            s.setMonth(Math.floor(s.getMonth() / 3) * 3, 1);
        }
        return { inicio: s, fin: e };
    },

    getPrevPeriod(inicio, fin) {
        const dur = fin.getTime() - inicio.getTime();
        return {
            inicio: new Date(inicio.getTime() - dur - 86400000),
            fin: new Date(inicio.getTime() - 86400000)
        };
    },

    /* ── Main render ── */
    async render() {
        const area = document.getElementById('content-area');
        if (!area) return;
        this.init();

        const dateInicio = this.fechaInicio.toISOString().split('T')[0];
        const dateFin = this.fechaFin.toISOString().split('T')[0];
        const todayLabel = this.formatDateFull(new Date());

        area.innerHTML = `
<div class="dash">
    <div class="dash-hero">
        <div class="dash-hero-bg"></div>
        <div class="dash-hero-inner">
            <div class="dash-hero-top">
                <div class="dash-hero-text">
                    <div class="dash-hero-greeting">Resumen de Ventas</div>
                    <h1 class="dash-hero-title">${todayLabel}</h1>
                </div>
                <div class="dash-hero-actions">
                    <div class="dash-period-chips" id="dash-period-chips">
                        <button class="dash-chip active" data-period="today">Hoy</button>
                        <button class="dash-chip" data-period="week">Semana</button>
                        <button class="dash-chip" data-period="month">Mes</button>
                        <button class="dash-chip" data-period="quarter">Trimestre</button>
                        <button class="dash-chip" data-period="custom">Personalizado</button>
                    </div>
                    <div class="dash-date-pill">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <input type="date" id="dash-date-inicio" value="${dateInicio}" class="dash-pill-input">
                        <span class="dash-pill-sep">→</span>
                        <input type="date" id="dash-date-fin" value="${dateFin}" class="dash-pill-input">
                        <button class="dash-pill-btn" id="dash-apply-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                    </div>
                    <button class="dash-export-btn" id="dash-export-btn" title="Exportar Dashboard">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                </div>
            </div>

            <div class="dash-kpi-grid">
                <div class="dash-kpi-card">
                    <div class="dash-kpi-icon dash-kpi-icon-total">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="23" y2="6"/><path d="M12 1v6m0 0L1 6m11 16v-5l-4-2 4-2 4 2-4 2v5"/></svg>
                    </div>
                    <div class="dash-kpi-body">
                        <div class="dash-kpi-top">
                            <div>
                                <div class="dash-kpi-label">Total Ventas</div>
                                <div class="dash-kpi-value" id="dash-total-monto">$0</div>
                            </div>
                            <div class="dash-kpi-delta" id="dash-total-delta"></div>
                        </div>
                        <div class="dash-kpi-meta" id="dash-total-count">0 entregas</div>
                        <div class="dash-kpi-sparkline" id="dash-total-spark"></div>
                    </div>
                </div>
                <div class="dash-kpi-card">
                    <div class="dash-kpi-icon dash-kpi-icon-contado">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    </div>
                    <div class="dash-kpi-body">
                        <div class="dash-kpi-top">
                            <div>
                                <div class="dash-kpi-label">Contado</div>
                                <div class="dash-kpi-value" id="dash-contado-monto">$0</div>
                            </div>
                            <div class="dash-kpi-delta" id="dash-contado-delta"></div>
                        </div>
                        <div class="dash-kpi-meta" id="dash-contado-count">0 entregas</div>
                        <div class="dash-kpi-sparkline" id="dash-contado-spark"></div>
                    </div>
                </div>
                <div class="dash-kpi-card">
                    <div class="dash-kpi-icon dash-kpi-icon-credito">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    </div>
                    <div class="dash-kpi-body">
                        <div class="dash-kpi-top">
                            <div>
                                <div class="dash-kpi-label">Credito</div>
                                <div class="dash-kpi-value" id="dash-credito-monto">$0</div>
                            </div>
                            <div class="dash-kpi-delta" id="dash-credito-delta"></div>
                        </div>
                        <div class="dash-kpi-meta" id="dash-credito-count">0 entregas</div>
                        <div class="dash-kpi-sparkline" id="dash-credito-spark"></div>
                    </div>
                </div>
                <div class="dash-kpi-card">
                    <div class="dash-kpi-icon dash-kpi-icon-dalse">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    </div>
                    <div class="dash-kpi-body">
                        <div class="dash-kpi-top">
                            <div>
                                <div class="dash-kpi-label">Dalse</div>
                                <div class="dash-kpi-value" id="dash-dalse-monto">$0</div>
                            </div>
                            <div class="dash-kpi-delta" id="dash-dalse-delta"></div>
                        </div>
                        <div class="dash-kpi-meta" id="dash-dalse-count">0 entregas</div>
                        <div class="dash-kpi-sparkline" id="dash-dalse-spark"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="dash-charts-row">
        <div class="dash-chart-card">
            <div class="dash-chart-header"><h3>Contado vs Crédito</h3></div>
            <div class="dash-chart-body" id="dash-donut-chart"></div>
        </div>
        <div class="dash-chart-card">
            <div class="dash-chart-header"><h3>Ventas por Despachador</h3></div>
            <div class="dash-chart-body" id="dash-bar-chart"></div>
        </div>
    </div>

    <div class="dash-section">
        <div class="dash-section-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            <h2 class="dash-section-title">Desglose por Entregador</h2>
        </div>
        <div class="dash-carrier-grid" id="dash-carrier-stats"></div>
    </div>

    <div class="dash-section" id="dash-daily-section" style="display:none;">
        <div class="dash-section-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <h2 class="dash-section-title">Desglose por Día</h2>
        </div>
        <div class="dash-table-wrap">
            <table class="dash-table">
                <thead><tr>
                    <th>Día</th><th>Contado</th><th>Crédito</th><th>Total</th><th>Entregas</th>
                </tr></thead>
                <tbody id="dash-daily-tbody"></tbody>
            </table>
        </div>
    </div>

    <div class="dash-section">
        <div class="dash-section-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <h2 class="dash-section-title">Detalle por Día</h2>
        </div>
        <div class="dash-day-grid" id="dash-day-cards"></div>
    </div>
</div>`;

        this.setupEvents();
        this.initCharts();
        this.subscribeToData();
    },

    /* ── Events ── */
    setupEvents() {
        document.querySelectorAll('.dash-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.dash-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const period = chip.dataset.period;
                if (period === 'custom') return;
                const d = this.getPeriodDates(period);
                this.fechaInicio = d.inicio;
                this.fechaFin = d.fin;
                document.getElementById('dash-date-inicio').value = d.inicio.toISOString().split('T')[0];
                document.getElementById('dash-date-fin').value = d.fin.toISOString().split('T')[0];
                this.subscribeToData();
            });
        });

        const applyBtn = document.getElementById('dash-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const iv = document.getElementById('dash-date-inicio').value;
                const fv = document.getElementById('dash-date-fin').value;
                if (!iv || !fv) { showToast('Selecciona ambas fechas', 'error'); return; }
                this.fechaInicio = new Date(iv + 'T00:00:00');
                this.fechaFin = new Date(fv + 'T23:59:59.999');
                this.subscribeToData();
            });
        }

        const exportBtn = document.getElementById('dash-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportDashboard());
        }

        /* ── KPI card click → detail modal ── */
        const kpiTypes = ['total', 'contado', 'credito', 'dalse'];
        document.querySelectorAll('.dash-kpi-card').forEach((card, index) => {
            if (index < 4) {
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => {
                    this.showDetailModal(kpiTypes[index]);
                });
            }
        });
    },

    /* ── Firestore subscriptions ── */
    subscribeToData() {
        if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }

        this.unsubscribe = firebase.firestore().collection('interlogic')
            .where('fecha', '>=', this.fechaInicio)
            .where('fecha', '<=', this.fechaFin)
            .orderBy('fecha', 'desc')
            .onSnapshot(snapshot => {
                this.records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                this.computeAndRender();
                this.fetchPrevPeriod();
            }, err => {
                console.error('[Dashboard] Firestore error:', err);
                showToast('Error al cargar datos', 'error');
            });
    },

    fetchPrevPeriod() {
        const prev = this.getPrevPeriod(this.fechaInicio, this.fechaFin);
        firebase.firestore().collection('interlogic')
            .where('fecha', '>=', prev.inicio)
            .where('fecha', '<=', prev.fin)
            .get()
            .then(snapshot => {
                this.prevRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                this.updateDeltas();
            })
            .catch(() => {});
    },

    /* ── Data aggregation ── */
    computeAndRender() {
        const records = this.records;
        let stats = { total: 0, totalCount: 0, contado: 0, contadoCount: 0, credito: 0, creditoCount: 0, dalse: 0, dalseCount: 0 };
        const carrierStats = {};
        const dailyStats = {};

        records.forEach(r => {
            const m = parseFloat(r.venta) || 0;
            const cond = (r.condicionPago || '').toLowerCase().trim();
            const emp = (r.empresa || '').toUpperCase().trim();
            const ent = (r.entrega || 'Sin asignar').toUpperCase().trim();
            const fec = r.fecha ? r.fecha.toDate() : new Date();
            const dk = fec.toISOString().split('T')[0];
            const dl = this.formatDateShort(fec);

            stats.total += m; stats.totalCount++;
            if (cond === 'contado') { stats.contado += m; stats.contadoCount++; }
            else if (cond === 'credito' || cond === 'crédito') { stats.credito += m; stats.creditoCount++; }
            if (ent === 'DALSE') { stats.dalse += m; stats.dalseCount++; }

            if (!carrierStats[ent]) carrierStats[ent] = { monto: 0, count: 0, contado: 0, credito: 0 };
            carrierStats[ent].monto += m;
            carrierStats[ent].count++;
            if (cond === 'contado') carrierStats[ent].contado += m;
            else carrierStats[ent].credito += m;

            if (!dailyStats[dk]) dailyStats[dk] = {
                label: dl, total: 0, totalCount: 0,
                contado: 0, contadoCount: 0, credito: 0, creditoCount: 0, dalse: 0
            };
            dailyStats[dk].total += m;
            dailyStats[dk].totalCount++;
            if (cond === 'contado') { dailyStats[dk].contado += m; dailyStats[dk].contadoCount++; }
            else { dailyStats[dk].credito += m; dailyStats[dk].creditoCount++; }
            if (ent === 'DALSE') dailyStats[dk].dalse += m;
        });

        const sortedDays = Object.entries(dailyStats).sort((a, b) => a[0].localeCompare(b[0]));

        const sparkData = {
            total: sortedDays.map(([, d]) => d.total),
            contado: sortedDays.map(([, d]) => d.contado),
            credito: sortedDays.map(([, d]) => d.credito),
            dalse: sortedDays.map(([, d]) => d.dalse)
        };

        const chartDays = sortedDays.map(([, d]) => d.label);

        const carrierNames = ['DALSE', 'INTERLOGISTIC', 'XPRESS'];
        const carrierBarData = carrierNames.map(name =>
            Math.round((carrierStats[name] && carrierStats[name].monto) || 0)
        );

        this.updateKpiCards(stats, sparkData);
        this.updateCharts({
            donut: { contado: Math.round(stats.contado), credito: Math.round(stats.credito) },
            bar: { categories: carrierNames, data: carrierBarData }
        });
        this.updateCarrierStats(carrierStats, stats.total);
        this.updateDailyTable(dailyStats);
        this.updateDayCards(dailyStats);
    },

    /* ── Update KPI cards ── */
    updateKpiCards(s, spark) {
        const e = id => document.getElementById(id);
        const anim = (el, val) => { if (el) { el.textContent = val; el.classList.add('dash-value-pop'); setTimeout(() => el.classList.remove('dash-value-pop'), 400); } };

        anim(e('dash-total-monto'), this.formatMoney(s.total));
        anim(e('dash-contado-monto'), this.formatMoney(s.contado));
        anim(e('dash-credito-monto'), this.formatMoney(s.credito));
        anim(e('dash-dalse-monto'), this.formatMoney(s.dalse));

        if (e('dash-total-count')) e('dash-total-count').textContent = `${s.totalCount} entrega${s.totalCount !== 1 ? 's' : ''}`;
        if (e('dash-contado-count')) e('dash-contado-count').textContent = `${s.contadoCount} entrega${s.contadoCount !== 1 ? 's' : ''}`;
        if (e('dash-credito-count')) e('dash-credito-count').textContent = `${s.creditoCount} entrega${s.creditoCount !== 1 ? 's' : ''}`;
        if (e('dash-dalse-count')) e('dash-dalse-count').textContent = s.dalseCount === 0 ? 'Sin entregas' : `${s.dalseCount} entrega${s.dalseCount !== 1 ? 's' : ''}`;

        const dalseCard = document.querySelector('.dash-kpi-icon-dalse')?.closest('.dash-kpi-card');
        if (dalseCard) {
            if (s.dalseCount === 0) dalseCard.classList.add('dash-kpi-empty');
            else dalseCard.classList.remove('dash-kpi-empty');
        }

        this.renderSparkline('dash-total-spark', spark.total, '#a78bfa');
        this.renderSparkline('dash-contado-spark', spark.contado, '#34d399');
        this.renderSparkline('dash-credito-spark', spark.credito, '#fbbf24');
        this.renderSparkline('dash-dalse-spark', spark.dalse, '#22d3ee');
    },

    renderSparkline(elId, data, color) {
        const el = document.getElementById(elId);
        if (!el) return;
        if (!this.charts.sparklines) this.charts.sparklines = {};
        if (this.charts.sparklines[elId]) { this.charts.sparklines[elId].destroy(); delete this.charts.sparklines[elId]; }
        if (!data || data.length < 2) {
            el.innerHTML = '';
            el.style.display = 'none';
            return;
        }
        el.style.display = '';
        const opt = {
            chart: { type: 'line', sparkline: { enabled: true }, animations: { enabled: false } },
            series: [{ data: data }],
            stroke: { curve: 'smooth', width: 2 },
            colors: [color],
            tooltip: { enabled: false }
        };
        this.charts.sparklines[elId] = new ApexCharts(el, opt);
        this.charts.sparklines[elId].render();
    },

    /* ── Update deltas ── */
    updateDeltas() {
        const cur = this.computeTotals(this.records);
        const prev = this.computeTotals(this.prevRecords);

        const deltaEls = {
            total: 'dash-total-delta',
            contado: 'dash-contado-delta',
            credito: 'dash-credito-delta',
            dalse: 'dash-dalse-delta'
        };

        Object.entries(deltaEls).forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (!el) return;
            const c = cur[key] || 0;
            const p = prev[key] || 0;
            if (p === 0) {
                el.innerHTML = '<span class="dash-delta-neutral">—</span>';
                return;
            }
            const pct = ((c - p) / p * 100);
            const arrow = pct >= 0 ? '▲' : '▼';
            const cls = pct >= 0 ? 'dash-delta-up' : 'dash-delta-down';
            el.innerHTML = `<span class="${cls}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
        });
    },

    computeTotals(records) {
        let total = 0, contado = 0, credito = 0, dalse = 0;
        records.forEach(r => {
            const m = parseFloat(r.venta) || 0;
            const cond = (r.condicionPago || '').toLowerCase().trim();
            const ent = (r.entrega || '').toUpperCase().trim();
            total += m;
            if (cond === 'contado') contado += m;
            else if (cond === 'credito' || cond === 'crédito') credito += m;
            if (ent === 'DALSE') dalse += m;
        });
        return { total, contado, credito, dalse };
    },

    /* ── ApexCharts init & update ── */
    getChartTheme() {
        const t = document.documentElement.getAttribute('data-theme');
        return t === 'dark' ? 'dark' : 'light';
    },

    initCharts() {
        if (this.chartInit) return;
        const theme = this.getChartTheme();

        const donutOptions = {
            chart: { type: 'donut', fontFamily: 'Inter, sans-serif' },
            series: [0, 0],
            labels: ['Contado', 'Crédito'],
            colors: ['#10b981', '#f59e0b'],
            plotOptions: {
                pie: {
                    donut: { size: '68%', labels: { show: true, total: { show: true, label: 'Total', formatter: () => '$0' } } }
                }
            },
            dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', style: { fontSize: '11px', fontWeight: 600 } },
            legend: { position: 'bottom', fontSize: '12px', fontWeight: 500 },
            tooltip: { y: { formatter: v => '$' + Math.round(v).toLocaleString('es-SV') } },
            theme: { mode: theme },
            responsive: [{ breakpoint: 768, options: { chart: { height: 250 }, legend: { position: 'bottom' } } }]
        };

        const barOptions = {
            chart: { type: 'bar', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, events: { dataPointSelection: (e, c, config) => { const idx = config.dataPointIndex; const names = ['DALSE', 'INTERLOGISTIC', 'XPRESS']; if (names[idx]) this.showCarrierDetailModal(names[idx]); } } },
            series: [{ name: 'Ventas', data: [] }],
            xaxis: { categories: [], labels: { style: { fontSize: '11px', fontWeight: 600 } } },
            yaxis: { labels: { formatter: v => v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + Math.round(v), style: { fontSize: '11px' } } },
            colors: ['#7c3aed', '#3b82f6', '#ec4899'],
            plotOptions: {
                bar: { borderRadius: 4, columnWidth: '55%', distributed: true, dataLabels: { position: 'top' } }
            },
            dataLabels: {
                enabled: true,
                formatter: function(val) {
                    const total = window.Dashboard?.barTotal || 0;
                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                    return '$' + Math.round(val).toLocaleString('es-SV') + '  |  ' + pct + '%';
                },
                style: { fontSize: '13px', fontWeight: 700, fontFamily: 'Inter, sans-serif', colors: ['#0f172a'] },
                offsetY: -18
            },
            tooltip: { y: { formatter: v => '$' + Math.round(v).toLocaleString('es-SV') } },
            grid: { borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', strokeDashArray: 4 },
            theme: { mode: theme },
            responsive: [{ breakpoint: 768, options: { chart: { height: 250 }, dataLabels: { enabled: false } } }]
        };

        const donutEl = document.getElementById('dash-donut-chart');
        const barEl = document.getElementById('dash-bar-chart');

        if (donutEl) this.charts.donut = new ApexCharts(donutEl, donutOptions);
        if (barEl) this.charts.bar = new ApexCharts(barEl, barOptions);

        Object.values(this.charts).forEach(c => { if (c) c.render(); });

        this.chartInit = true;

        this.themeObserver = new MutationObserver(() => {
            const t = this.getChartTheme();
            Object.entries(this.charts).forEach(([k, c]) => {
                if (c) c.updateOptions({ theme: { mode: t }, grid: { borderColor: t === 'dark' ? '#334155' : '#e2e8f0' } });
            });
        });
        this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    },

    updateCharts(data) {
        if (!this.chartInit) return;

        if (this.charts.donut) {
            const total = data.donut.contado + data.donut.credito;
            this.charts.donut.updateOptions({
                series: [data.donut.contado, data.donut.credito],
                plotOptions: {
                    pie: { donut: { labels: { total: { formatter: () => '$' + (total).toLocaleString('es-SV') } } } }
                }
            });
        }

        if (this.charts.bar) {
            const barMax = Math.max(...data.bar.data, 0) * 1.35;
            window.Dashboard.barTotal = data.bar.data.reduce((a, b) => a + b, 0);
            this.charts.bar.updateOptions({
                xaxis: { categories: data.bar.categories },
                yaxis: { min: 0, max: barMax || 10, forceNiceScale: false },
                series: [{ data: data.bar.data }]
            });
        }
    },

    /* ── Carrier stats ── */
    updateCarrierStats(carrierStats, totalMonto) {
        const container = document.getElementById('dash-carrier-stats');
        if (!container) return;

        const carriers = Object.entries(carrierStats).sort((a, b) => b[1].monto - a[1].monto);

        if (carriers.length === 0) {
            container.innerHTML = '<div class="dash-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg><p>No hay datos en el rango seleccionado</p></div>';
            return;
        }

        const cfg = {
            'DALSE': { cls: 'dash-carrier-avatar-dalse' },
            'INTERLOGISTIC': { cls: 'dash-carrier-avatar-interlogistic' },
            'XPRESS': { cls: 'dash-carrier-avatar-xpress' }
        };

        container.innerHTML = carriers.map(([name, d]) => {
            const c = cfg[name] || { cls: 'dash-carrier-avatar-default' };
            const pct = totalMonto > 0 ? ((d.monto / totalMonto) * 100).toFixed(1) : 0;
            const ctPct = d.monto > 0 ? (d.contado / d.monto) * 100 : 0;
            const crPct = d.monto > 0 ? (d.credito / d.monto) * 100 : 0;
            return `<div class="dash-carrier-card">
                <div class="dash-carrier-top">
                    <div class="dash-carrier-avatar ${c.cls}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                    </div>
                    <div class="dash-carrier-body">
                        <div class="dash-carrier-name">${name}</div>
                        <div class="dash-carrier-amount">${this.formatMoney(d.monto)}</div>
                        <div class="dash-carrier-meta">${d.count} entrega${d.count !== 1 ? 's' : ''} · ${pct}%</div>
                    </div>
                </div>
                <div class="dash-carrier-bar-wrap">
                    <div class="dash-carrier-bar">
                        <div class="dash-carrier-bar-contado" style="width:${ctPct}%"></div>
                        <div class="dash-carrier-bar-credito" style="width:${crPct}%"></div>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    /* ── Daily table ── */
    updateDailyTable(dailyStats) {
        const days = Object.entries(dailyStats).sort((a, b) => b[0].localeCompare(a[0]));
        const section = document.getElementById('dash-daily-section');
        const tbody = document.getElementById('dash-daily-tbody');
        if (!section || !tbody) return;

        if (days.length <= 1) { section.style.display = 'none'; return; }
        section.style.display = '';

        tbody.innerHTML = days.map(([, d]) => `<tr>
            <td class="dash-td-day">${d.label}</td>
            <td class="dash-td-contado">$${this.formatNumber(d.contado)}</td>
            <td class="dash-td-credito">$${this.formatNumber(d.credito)}</td>
            <td class="dash-td-total">$${this.formatNumber(d.total)}</td>
            <td class="dash-td-count">${d.totalCount}</td>
        </tr>`).join('');
    },

    /* ── Day cards ── */
    updateDayCards(dailyStats) {
        const container = document.getElementById('dash-day-cards');
        if (!container) return;

        const days = Object.entries(dailyStats).sort((a, b) => b[0].localeCompare(a[0]));

        if (days.length === 0) {
            container.innerHTML = '<div class="dash-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>No hay datos para mostrar</p></div>';
            return;
        }

        container.innerHTML = days.map(([key, d]) => {
            const ctPct = d.total > 0 ? (d.contado / d.total) * 100 : 0;
            const crPct = d.total > 0 ? (d.credito / d.total) * 100 : 0;
            return `<div class="dash-day-card">
                <div class="dash-day-card-top">
                    <div class="dash-day-badge">
                        <span class="dash-day-badge-day">${key.split('-')[2]}</span>
                        <span class="dash-day-badge-month">${this.formatMonthShort(parseInt(key.split('-')[1]) - 1)}</span>
                    </div>
                    <div class="dash-day-info">
                        <div class="dash-day-label">${d.label}</div>
                        <div class="dash-day-total">${this.formatMoney(d.total)} · ${d.totalCount} entregas</div>
                    </div>
                </div>
                <div class="dash-day-bar">
                    <div class="dash-day-bar-contado" style="width:${ctPct}%"></div>
                    <div class="dash-day-bar-credito" style="width:${crPct}%"></div>
                </div>
                <div class="dash-day-legend">
                    <div class="dash-legend-item">
                        <span class="dash-legend-dot dash-legend-dot-contado"></span>
                        <span>Contado</span>
                        <span class="dash-legend-amount">$${this.formatNumber(d.contado)}</span>
                        <span class="dash-legend-count">${d.contadoCount}</span>
                    </div>
                    <div class="dash-legend-item">
                        <span class="dash-legend-dot dash-legend-dot-credito"></span>
                        <span>Credito</span>
                        <span class="dash-legend-amount">$${this.formatNumber(d.credito)}</span>
                        <span class="dash-legend-count">${d.creditoCount}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    /* ── Detail Modal for KPI cards ── */
    showDetailModal(type) {
        let filtered = [];
        let title = '';
        let color = '';

        this.records.forEach(r => {
            const cond = (r.condicionPago || '').toLowerCase().trim();
            const ent = (r.entrega || '').toUpperCase().trim();

            let match = false;
            if (type === 'total') { match = true; title = 'Total Ventas'; color = '#7c3aed'; }
            else if (type === 'contado') { match = (cond === 'contado'); title = 'Contado'; color = '#10b981'; }
            else if (type === 'credito') { match = (cond === 'credito' || cond === 'crédito'); title = 'Crédito'; color = '#f59e0b'; }
            else if (type === 'dalse') { match = (ent === 'DALSE'); title = 'Dalse'; color = '#06b6d4'; }

            if (match) filtered.push(r);
        });

        this._renderDetailModal(filtered, title, color);
    },

    /* ── Detail Modal for carrier bars ── */
    showCarrierDetailModal(carrierName) {
        const filtered = this.records.filter(r => (r.entrega || '').toUpperCase().trim() === carrierName);
        const title = carrierName;
        const colors = { DALSE: '#7c3aed', INTERLOGISTIC: '#3b82f6', XPRESS: '#ec4899' };
        const color = colors[carrierName] || '#6b7280';
        this._renderDetailModal(filtered, title, color);
    },

    /* ── Shared modal renderer (enhanced) ── */
    _renderDetailModal(filtered, title, color) {
        const esc = (s) => {
            if (!s && s !== 0) return '';
            const d = document.createElement('div');
            d.textContent = String(s);
            return d.innerHTML;
        };

        const formatDt = (d) => {
            if (!d) return '—';
            const dt = d.toDate ? d.toDate() : new Date(d);
            return dt.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        const formatDtInput = (d) => {
            if (!d) return '';
            const dt = d.toDate ? d.toDate() : new Date(d);
            return dt.toISOString().split('T')[0];
        };

        filtered.sort((a, b) => {
            const fa = a.fecha ? a.fecha.toDate() : new Date(0);
            const fb = b.fecha ? b.fecha.toDate() : new Date(0);
            return fb - fa;
        });

        const total = filtered.reduce((sum, r) => sum + (parseFloat(r.venta) || 0), 0);
        const avg = filtered.length > 0 ? total / filtered.length : 0;
        const maxVenta = filtered.reduce((mx, r) => Math.max(mx, parseFloat(r.venta) || 0), 0);

        const existingBd = document.querySelector('.dash-detail-backdrop');
        if (existingBd) existingBd.remove();
        const existingM = document.querySelector('.dash-detail-modal');
        if (existingM) existingM.remove();

        const dateRange = `${formatDtInput(this.fechaInicio)} → ${formatDtInput(this.fechaFin)}`;

        const backdrop = document.createElement('div');
        backdrop.className = 'dash-detail-backdrop';

        const iconSvg = title === 'Total Ventas'
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="23" y2="6"/><path d="M12 1v6m0 0L1 6m11 16v-5l-4-2 4-2 4 2-4 2v5"/></svg>'
            : title === 'Contado'
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>'
            : title === 'Crédito'
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>'
            : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';

        const modal = document.createElement('div');
        modal.className = 'dash-detail-modal';
        modal.innerHTML = `
            <div class="dash-detail-modal-header" style="background:linear-gradient(135deg, ${color}, ${color}dd);">
                <div class="dash-detail-modal-title">
                    <div class="dash-detail-modal-title-icon">${iconSvg}</div>
                    <div>
                        <h2>${esc(title)}</h2>
                        <p>${filtered.length} registro${filtered.length !== 1 ? 's' : ''} · ${esc(dateRange)}</p>
                    </div>
                </div>
                <button class="dash-detail-modal-close" aria-label="Cerrar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="dash-detail-summary">
                <div class="dash-detail-chip dash-chip-total">
                    <span class="dash-chip-label">Total</span>
                    <span class="dash-chip-value">${this.formatMoney(total)}</span>
                </div>
                <div class="dash-detail-chip dash-chip-avg">
                    <span class="dash-chip-label">Promedio</span>
                    <span class="dash-chip-value">${this.formatMoney(avg)}</span>
                </div>
                <div class="dash-detail-chip dash-chip-max">
                    <span class="dash-chip-label">Mayor venta</span>
                    <span class="dash-chip-value">${this.formatMoney(maxVenta)}</span>
                </div>
            </div>
            <div class="dash-detail-search">
                <svg class="dash-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" class="dash-search-input" placeholder="Buscar por cliente, guía o empresa..." aria-label="Buscar registros">
            </div>
            <div class="dash-detail-modal-body">
                <div class="dash-detail-table-wrap">
                    <table class="dash-detail-table">
                        <thead>
                            <tr>
                                <th class="sortable" data-key="guia">Guía <span class="sort-arrow"></span></th>
                                <th class="sortable" data-key="empresa">Empresa <span class="sort-arrow"></span></th>
                                <th class="sortable" data-key="fecha">Fecha <span class="sort-arrow"></span></th>
                                <th class="sortable" data-key="cliente">Cliente <span class="sort-arrow"></span></th>
                                <th class="sortable" data-key="venta">Venta <span class="sort-arrow"></span></th>
                                <th class="sortable" data-key="condicionPago">Condición <span class="sort-arrow"></span></th>
                                <th class="sortable" data-key="entrega">Entrega <span class="sort-arrow"></span></th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            <div class="dash-detail-modal-footer">
                <button class="dash-export-excel-btn" title="Exportar a Excel">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Exportar Excel
                </button>
                <div class="dash-detail-footer-totals">
                    <span class="dash-detail-total-label">Total</span>
                    <span class="dash-detail-total-value">${this.formatMoney(total)}</span>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        requestAnimationFrame(() => {
            backdrop.classList.add('show');
            modal.classList.add('show');
            modal.querySelector('.dash-search-input')?.focus();
        });

        let sortKey = 'fecha';
        let sortDir = -1;
        let searchTerm = '';

        const renderRows = () => {
            let data = [...filtered];

            if (searchTerm) {
                const t = searchTerm.toLowerCase();
                data = data.filter(r =>
                    (r.cliente || '').toLowerCase().includes(t) ||
                    (r.guia || '').toLowerCase().includes(t) ||
                    (r.empresa || '').toLowerCase().includes(t) ||
                    (r.departamento || '').toLowerCase().includes(t) ||
                    (r.entrega || '').toLowerCase().includes(t) ||
                    (r.docNum || '').toLowerCase().includes(t)
                );
            }

            data.sort((a, b) => {
                let va, vb;
                if (sortKey === 'fecha') {
                    va = a.fecha ? a.fecha.toDate().getTime() : 0;
                    vb = b.fecha ? b.fecha.toDate().getTime() : 0;
                } else if (sortKey === 'venta') {
                    va = parseFloat(a.venta) || 0;
                    vb = parseFloat(b.venta) || 0;
                } else {
                    va = (a[sortKey] || '').toString().toLowerCase();
                    vb = (b[sortKey] || '').toString().toLowerCase();
                }
                if (va < vb) return -1 * sortDir;
                if (va > vb) return 1 * sortDir;
                return 0;
            });

            const tbody = modal.querySelector('tbody');
            if (!data.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="dash-detail-empty">No se encontraron registros</td></tr>';
                modal.querySelector('.dash-detail-modal-title p').textContent = `0 registros · ${dateRange}`;
                return;
            }

            const shown = data.length;
            const totalCount = filtered.length;
            const countText = shown < totalCount
                ? `${shown} de ${totalCount} registros · ${dateRange}`
                : `${totalCount} registro${totalCount !== 1 ? 's' : ''} · ${dateRange}`;
            modal.querySelector('.dash-detail-modal-title p').textContent = countText;

            tbody.innerHTML = data.map(r => {
                const cond = (r.condicionPago || '').toLowerCase().trim();
                const isContado = cond === 'contado';
                const badgeCls = isContado ? 'dash-badge-contado' : (cond === 'credito' || cond === 'crédito' ? 'dash-badge-credito' : 'dash-badge-default');
                const condLabel = isContado ? 'Contado' : (cond === 'credito' || cond === 'crédito' ? 'Crédito' : (r.condicionPago || '—'));
                return `<tr class="dash-row-expandable" data-id="${esc(r.id)}">
                    <td>${esc(r.guia || '—')}</td>
                    <td><span class="dash-badge-empresa">${esc(r.empresa || '—')}</span></td>
                    <td>${formatDt(r.fecha)}</td>
                    <td>${esc(r.cliente || '—')}</td>
                    <td class="dash-modal-amount">${this.formatMoney(parseFloat(r.venta) || 0)}</td>
                    <td><span class="dash-badge-cond ${badgeCls}">${condLabel}</span></td>
                    <td><span class="dash-badge-ent">${esc(r.entrega || '—')}</span></td>
                </tr>
                <tr class="dash-row-detail" data-parent="${esc(r.id)}" style="display:none;">
                    <td colspan="7">
                        <div class="dash-detail-inner">
                            <div class="dash-detail-grid">
                                ${r.direccion ? `<div class="dash-detail-field"><span class="dash-detail-label">Dirección</span><span class="dash-detail-value">${esc(r.direccion)}</span></div>` : ''}
                                ${r.departamento ? `<div class="dash-detail-field"><span class="dash-detail-label">Departamento</span><span class="dash-detail-value">${esc(r.departamento)}</span></div>` : ''}
                                ${r.municipio ? `<div class="dash-detail-field"><span class="dash-detail-label">Municipio</span><span class="dash-detail-value">${esc(r.municipio)}</span></div>` : ''}
                                ${r.doc ? `<div class="dash-detail-field"><span class="dash-detail-label">Documento</span><span class="dash-detail-value">${esc(r.doc)}${r.docNum ? ' #' + esc(r.docNum) : ''}</span></div>` : ''}
                                ${r.vendedor ? `<div class="dash-detail-field"><span class="dash-detail-label">Vendedor</span><span class="dash-detail-value">${esc(r.vendedor)}</span></div>` : ''}
                                ${r.bultos ? `<div class="dash-detail-field"><span class="dash-detail-label">Bultos</span><span class="dash-detail-value">${esc(r.bultos)}</span></div>` : ''}
                                ${r.cobrador ? `<div class="dash-detail-field"><span class="dash-detail-label">Cobrador</span><span class="dash-detail-value">${esc(r.cobrador)}</span></div>` : ''}
                                ${r.costoEnvio ? `<div class="dash-detail-field"><span class="dash-detail-label">Costo Envío</span><span class="dash-detail-value">${this.formatMoney(parseFloat(r.costoEnvio) || 0)}</span></div>` : ''}
                                ${r.encargado ? `<div class="dash-detail-field"><span class="dash-detail-label">Encargado</span><span class="dash-detail-value">${esc(r.encargado)}</span></div>` : ''}
                                ${r.telefono ? `<div class="dash-detail-field"><span class="dash-detail-label">Teléfono</span><span class="dash-detail-value">${esc(r.telefono)}</span></div>` : ''}
                                ${r.observations ? `<div class="dash-detail-field dash-detail-field-full"><span class="dash-detail-label">Observaciones</span><span class="dash-detail-value">${esc(r.observations)}</span></div>` : ''}
                            </div>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            tbody.querySelectorAll('.dash-row-expandable').forEach(row => {
                row.addEventListener('click', () => {
                    const id = row.dataset.id;
                    const detailRow = tbody.querySelector(`.dash-row-detail[data-parent="${id}"]`);
                    if (!detailRow) return;
                    const isVisible = detailRow.style.display !== 'none';
                    tbody.querySelectorAll('.dash-row-detail').forEach(r => r.style.display = 'none');
                    tbody.querySelectorAll('.dash-row-expandable').forEach(r => r.classList.remove('expanded'));
                    if (!isVisible) {
                        detailRow.style.display = 'table-row';
                        row.classList.add('expanded');
                    }
                });
            });
        };

        renderRows();

        modal.querySelector('.dash-search-input').addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderRows();
        });

        modal.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.key;
                if (sortKey === key) {
                    sortDir *= -1;
                } else {
                    sortKey = key;
                    sortDir = 1;
                }
                modal.querySelectorAll('.sortable').forEach(s => s.classList.remove('sorted-asc', 'sorted-desc'));
                th.classList.add(sortDir === 1 ? 'sorted-asc' : 'sorted-desc');
                renderRows();
            });
        });

        const closeModal = () => {
            backdrop.classList.remove('show');
            modal.classList.remove('show');
            setTimeout(() => { backdrop.remove(); modal.remove(); }, 300);
        };

        modal.querySelector('.dash-detail-modal-close').addEventListener('click', closeModal);
        backdrop.addEventListener('click', closeModal);
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape' && document.body.contains(modal)) {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        });

        modal.querySelector('.dash-export-excel-btn').addEventListener('click', () => {
            this.exportDetailToExcel(filtered, title);
        });
    },

    /* ── Export detail to Excel ── */
    exportDetailToExcel(data, title) {
        showToast('Generando Excel...', 'info');

        const sorted = [...data].sort((a, b) => {
            const fa = a.fecha ? a.fecha.toDate() : new Date(0);
            const fb = b.fecha ? b.fecha.toDate() : new Date(0);
            return fb - fa;
        });

        const formatDt = (d) => {
            if (!d) return '';
            const dt = d.toDate ? d.toDate() : new Date(d);
            return dt.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        const rows = sorted.map(r => ({
            'Guía': r.guia || '',
            'Empresa': r.empresa || '',
            'Fecha': formatDt(r.fecha),
            'Cliente': r.cliente || '',
            'Dirección': r.direccion || '',
            'Departamento': r.departamento || '',
            'Municipio': r.municipio || '',
            'Documento': r.doc || '',
            'Doc #': r.docNum || '',
            'Vendedor': r.vendedor || '',
            'Condición': r.condicionPago || '',
            'Venta': parseFloat(r.venta) || 0,
            'Bultos': parseInt(r.bultos) || 0,
            'Cobrador': r.cobrador || '',
            'Costo Envío': parseFloat(r.costoEnvio) || 0,
            '% Costo': parseFloat(r.costoPorcentaje) || 0,
            'Entrega': r.entrega || '',
            'Cobra': r.cobra || '',
            'Encargado': r.encargado || '',
            'Teléfono': r.telefono || '',
            'Observaciones': r.observations || ''
        }));

        try {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(rows);

            const colWidths = Object.keys(rows[0] || {}).map(k => ({
                wch: Math.max(k.length, ...rows.map(r => String(r[k] || '').length)) + 2
            }));
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, 'Detalle');

            const fechaStr = this.fechaInicio.toISOString().split('T')[0];
            XLSX.writeFile(wb, `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${fechaStr}.xlsx`);

            showToast('Excel exportado exitosamente', 'success');
        } catch (err) {
            console.error('[Dashboard] Export Excel error:', err);
            showToast('Error al exportar Excel', 'error');
        }
    },

    /* ── Export ── */
    exportDashboard() {
        const el = document.querySelector('.dash');
        if (!el) return;
        if (typeof html2pdf === 'undefined') { showToast('Exportando... espere un momento', 'info'); return; }

        showToast('Generando PDF...', 'info');

        /* clonamos el dashboard en un contenedor temporal con tema claro */
        const clone = el.cloneNode(true);
        clone.style.background = '#ffffff';
        clone.style.color = '#0f172a';

        /* forzamos tema claro en el clon */
        clone.querySelectorAll('[class*="dash-"]').forEach(child => {
            child.style.setProperty('--bg-primary', '#ffffff');
            child.style.setProperty('--bg-secondary', '#f8fafc');
            child.style.setProperty('--text-primary', '#0f172a');
            child.style.setProperty('--text-secondary', '#64748b');
            child.style.setProperty('--border-color', '#e2e8f0');
        });

        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.left = '-9999px';
        wrapper.style.top = '0';
        wrapper.style.width = '800px';
        wrapper.style.background = '#ffffff';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        const opt = {
            margin: 0.4,
            filename: `dashboard-ventas-${this.fechaInicio.toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: 800,
                onclone: (doc) => {
                    doc.querySelectorAll('.dash-kpi-sparkline').forEach(el => el.style.display = 'none');
                    doc.querySelectorAll('.dash-chip').forEach(el => el.style.display = 'none');
                    doc.querySelectorAll('.dash-period-chips, .dash-date-pill, .dash-export-btn').forEach(el => el.style.display = 'none');
                }
            },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(clone).save().then(() => {
            wrapper.remove();
        }).catch(() => {
            wrapper.remove();
            showToast('Error al generar PDF', 'error');
        });
    },

    /* ── Helpers ── */
    formatDateFull(date) {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
    },

    formatDateShort(date) {
        const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
    },

    formatMonthShort(m) {
        return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][m] || '';
    },

    formatMoney(amount) {
        return '$' + this.formatNumber(amount);
    },

    formatNumber(num) {
        return Math.round(num).toLocaleString('es-SV');
    },

    /* ── Cleanup ── */
    destroy() {
        if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
        if (this.themeObserver) { this.themeObserver.disconnect(); this.themeObserver = null; }
        Object.values(this.charts).forEach(c => { if (c && typeof c.destroy === 'function') c.destroy(); });
        if (this.charts.sparklines) {
            Object.values(this.charts.sparklines).forEach(c => { if (c) c.destroy(); });
        }
        this.charts = {};
        this.chartInit = false;
        this.records = [];
        this.prevRecords = [];
    }
};

window.Dashboard = Dashboard;
