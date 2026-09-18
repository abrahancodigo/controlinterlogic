// Tope del listener en tiempo real (solo día actual). Cada doc = 1 lectura
// Firestore + 1 lectura extra por usuario conectado por cada escritura.
// Períodos históricos NO usan listener: se cargan con get() (cacheable, sin fan-out).
const DASHBOARD_MAX_RECORDS = 800;

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
        const dur = fin.getTime() - inicio.getTime() + 1;
        return {
            inicio: new Date(inicio.getTime() - dur),
            fin: new Date(inicio.getTime() - 1)
        };
    },

    /* ── Main render ── */
    async render() {
        const area = document.getElementById('content-area');
        if (!area) return;
        const renderToken = this._renderToken = {};
        this.init();

        const dateInicio = formatDateForInput(this.fechaInicio);
        const dateFin = formatDateForInput(this.fechaFin);
        const todayLabel = this.formatDateFull(new Date());
        // Saludo dinámico según hora — toque humano tipo app nativa
        area.innerHTML = `
<div class="dash">
    <div class="dash-topbar">
        <div class="dash-topbar-title">
            <h1>Resumen de ventas</h1>
            <p id="dash-range-label">${todayLabel}</p>
        </div>
        <div class="dash-topbar-controls">
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

            <div id="dash-insights" class="dash-insights" aria-live="polite"></div>

    <div class="dash-kpi-grid" id="dash-kpi-grid"></div>

    <div id="dash-truncated-warn" style="display:none;margin:0 0 16px;padding:10px 14px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#b45309;font-size:0.85rem;font-weight:600;">
        ⚠️ El rango seleccionado tiene más de 2,000 registros: los totales mostrados corresponden solo a los 2,000 más recientes. Usa un rango más corto para ver datos completos.
    </div>

    <div class="dash-tabs" role="tablist" aria-label="Dimensiones del dashboard">
        <button class="dash-tab active" role="tab" aria-selected="true" data-tab="resumen">Resumen</button>
        <button class="dash-tab" role="tab" aria-selected="false" data-tab="vendedor">Vendedor</button>
        <button class="dash-tab" role="tab" data-tab="zona">Departamento</button>
        <button class="dash-tab" role="tab" data-tab="entregador">Entregador</button>
        <button class="dash-tab" role="tab" data-tab="matriz">Matriz</button>
        <button class="dash-tab" role="tab" data-tab="dia">Por día</button>
    </div>

    <div class="dash-tabpanels">
    <div class="dash-tabpanel" data-panel="resumen">
    <div class="dash-charts-row" style="margin-top:16px;">
        <div class="dash-chart-card">
            <div class="dash-chart-header"><h3>Contado vs Crédito</h3><span class="dash-chart-total" id="dash-donut-chart-total"></span></div>
            <div class="dash-chart-body" id="dash-donut-chart"></div>
        </div>
        <div class="dash-chart-card">
            <div class="dash-chart-header"><h3>Dalse vs Incede</h3><span class="dash-chart-total" id="dash-incede-chart-total"></span></div>
            <div class="dash-chart-body" id="dash-incede-chart"></div>
        </div>
    </div>
    </div>
    <div class="dash-tabpanel" data-panel="vendedor" hidden>
    <div class="dash-charts-row" style="margin-top:16px;">
        <div class="dash-chart-card">
            <div class="dash-chart-header"><h3>Ventas por Vendedor</h3><span class="dash-chart-total" id="dash-vendedor-chart-total"></span></div>
            <div class="dash-chart-body" id="dash-vendedor-chart"></div>
        </div>
        <div class="dash-chart-card">
            <div class="dash-chart-header"><h3>Participación por Vendedor</h3><span class="dash-chart-total" id="dash-acum-chart-total"></span></div>
            <div class="dash-chart-body" style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
                <div class="dash-acum-list-wrap" style="flex:1;min-width:260px;">
                    <div class="dash-acum-toolbar">
                        <button class="dash-acum-btn" id="dash-acum-select-all">Seleccionar Todos</button>
                        <button class="dash-acum-btn" id="dash-acum-deselect-all">Deseleccionar Todos</button>
                        <div class="dash-acum-total-wrap">
                            <span class="dash-acum-total-label">Total Acumulado</span>
                            <span class="dash-acum-total" id="dash-acum-total-value">$0</span>
                        </div>
                    </div>
                    <div class="dash-acum-list" id="dash-acum-list"></div>
                </div>
                <div style="flex:1;min-width:280px;max-width:420px;" id="dash-acum-chart"></div>
            </div>
        </div>
    </div>

    <div class="dash-section" style="margin-top:16px;">
        <div class="dash-section-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <h2 class="dash-section-title">Ranking de Vendedores</h2>
            <span class="dash-section-badge" id="dash-vendedor-resumen"></span>
            <span style="flex:1;"></span>
            <button class="dash-acum-btn" id="dash-vendedor-toggle">Ver todos</button>
        </div>
        <div id="dash-vendedor-content">
            <div class="dash-vendedor-grid" id="dash-vendedor-grid"></div>
        </div>
    </div>
    </div>
    <div class="dash-tabpanel" data-panel="zona" hidden>
    <div class="dash-charts-row" style="margin-top:16px;">
        <div class="dash-chart-card dash-chart-full">
            <div class="dash-chart-header"><h3>Ventas por Departamento</h3><span class="dash-chart-total" id="dash-zona-chart-total"></span></div>
            <div class="dash-chart-body" id="dash-zona-chart"></div>
        </div>
    </div>

    <div class="dash-section" style="margin-top:16px;">
        <div class="dash-section-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <h2 class="dash-section-title">Ranking de Departamentos</h2>
            <span class="dash-section-badge" id="dash-zona-resumen"></span>
            <span style="flex:1;"></span>
            <button class="dash-acum-btn" id="dash-zona-toggle">Ver todos</button>
        </div>
        <div id="dash-zona-content">
            <div class="dash-zona-grid" id="dash-zona-grid"></div>
        </div>
    </div>
    </div>
    <div class="dash-tabpanel" data-panel="entregador" hidden>
    <div class="dash-charts-row" style="margin-top:16px;">
        <div class="dash-chart-card dash-chart-full" id="dash-bar-chart-card">
            <div class="dash-chart-header"><h3>Ventas por Entregador</h3><span class="dash-chart-total" id="dash-bar-chart-total"></span></div>
            <div class="dash-chart-body" id="dash-bar-chart"></div>
        </div>
    </div>

    <div class="dash-section" style="margin-top:16px;">
        <div class="dash-section-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            <h2 class="dash-section-title">Ranking de Entregadores</h2>
            <span style="flex:1;"></span>
            <button class="dash-acum-btn" id="dash-carrier-toggle">Ver todos</button>
        </div>
        <div class="dash-carrier-grid" id="dash-carrier-stats"></div>
    </div>
    </div>
    <div class="dash-tabpanel" data-panel="matriz" hidden>
    <div class="dash-section" style="margin-top:16px;">
        <div class="dash-section-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            <h2 class="dash-section-title">Matriz Vendedor × Departamento</h2>
            <span class="dash-section-badge" id="dash-matriz-resumen"></span>
        </div>
        <div id="dash-matriz-content">
            <div class="dash-matrix-wrap">
                <table class="dash-table dash-matrix-table" id="dash-matrix-table">
                    <thead id="dash-matrix-thead"></thead>
                    <tbody id="dash-matrix-tbody"></tbody>
                </table>
            </div>
            <p class="dash-matrix-legend">
                <span class="dash-legend-dot dash-legend-dot-contado"></span>Contado
                <span class="dash-legend-dot dash-legend-dot-credito" style="margin-left:1rem;"></span>Crédito
                <span style="margin-left:1rem;color:var(--text-secondary);font-size:0.75rem;">Click en celda para filtrar x vendedor/zona</span>
            </p>
        </div>
    </div>
    </div>
    <div class="dash-tabpanel" data-panel="dia" hidden>
    <div class="dash-section" style="margin-top:16px;">
        <div class="dash-section-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <h2 class="dash-section-title">Detalle por Día</h2>
            <span class="dash-section-badge" id="dash-dia-resumen"></span>
        </div>
        <div class="dash-day-grid" id="dash-day-cards"></div>
    </div>
    </div>
    </div>

    <!-- Pill flotante: total siempre a la vista, tap = volver arriba -->
    <button class="dash-float-pill" id="dash-float-pill" aria-label="Volver arriba">
        <span class="dash-float-pill-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </span>
        <span class="dash-float-pill-total" id="dash-float-pill-total">$0.00</span>
        <span class="dash-float-pill-count" id="dash-float-pill-count">0 ent.</span>
    </button>
</div>`;

        document.querySelectorAll('.dash-tabpanel').forEach(panel => { panel.hidden = false; });
        await this.initCharts();
        if (this._renderToken !== renderToken) return;
        this.setupEvents();
        document.querySelector('.dash')?.classList.add('dash-ready');
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
                document.getElementById('dash-date-inicio').value = formatDateForInput(d.inicio);
                document.getElementById('dash-date-fin').value = formatDateForInput(d.fin);
                this.subscribeToData();
            });
        });

        const applyBtn = document.getElementById('dash-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const iv = document.getElementById('dash-date-inicio').value;
                const fv = document.getElementById('dash-date-fin').value;
                if (!iv || !fv) { showToast('Selecciona ambas fechas', 'error'); return; }
                if (iv > fv) { showToast('La fecha inicial no puede ser posterior a la final', 'error'); return; }
                this.fechaInicio = new Date(iv + 'T00:00:00');
                this.fechaFin = new Date(fv + 'T23:59:59.999');
                document.querySelectorAll('.dash-chip').forEach(c => c.classList.toggle('active', c.dataset.period === 'custom'));
                this.subscribeToData();
            });
        }

        const exportBtn = document.getElementById('dash-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportDashboard());
        }

        /* ── KPI cards dinámicas ── */
        const kpiGrid = document.getElementById('dash-kpi-grid');
        if (kpiGrid) this._renderKpiGrid();

        /* ── Tabs + ranking toggles ── */
        this._setupTabs();
        this._setupRankToggles();
        this._updateRangeLabel();

        /* ── Pill flotante: aparece al pasar los KPIs, tap = scroll to top ── */
        const floatPill = document.getElementById('dash-float-pill');
        if (floatPill) {
            floatPill.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
            if ('IntersectionObserver' in window) {
                const kpiGrid = document.querySelector('.dash-kpi-grid');
                if (kpiGrid) {
                    if (this._pillIO) this._pillIO.disconnect();
                    this._pillIO = new IntersectionObserver(entries => {
                        entries.forEach(en => floatPill.classList.toggle('show', !en.isIntersecting));
                    }, { rootMargin: '-80px 0px 0px 0px', threshold: 0 });
                    this._pillIO.observe(kpiGrid);
                }
            }
        }
    },

    /* ── Firestore subscriptions ── */
    // Tiempo real estricto solo para el día actual (vista por defecto).
    // Semana/mes/trimestre/personalizado → get() una sola vez: sin fan-out y
    // cacheable gracias a la persistencia offline.
    _isTodayPeriod() {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const i = new Date(this.fechaInicio); i.setHours(0, 0, 0, 0);
        const f = new Date(this.fechaFin); f.setHours(0, 0, 0, 0);
        return i.getTime() === today.getTime() && f.getTime() === today.getTime();
    },

    subscribeToData() {
        if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
        const requestKey = this._prevRequestKey = {};
        this.prevRecords = [];

        const query = firebase.firestore().collection('interlogic')
            .where('fecha', '>=', this.fechaInicio)
            .where('fecha', '<=', this.fechaFin)
            .orderBy('fecha', 'desc')
            .limit(DASHBOARD_MAX_RECORDS);

        const handleSnap = (snapshot) => {
            if (this._prevRequestKey !== requestKey) return;
            this.records = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.anulado !== true);
            this._truncated = snapshot.size >= DASHBOARD_MAX_RECORDS;
            const warnEl = document.getElementById('dash-truncated-warn');
            if (warnEl) warnEl.style.display = this._truncated ? 'block' : 'none';
            this.computeAndRender();
            this.updateDeltas();
        };

        const onError = (err) => {
            console.error('[Dashboard] Firestore error:', err);
            showToast('Error al cargar datos', 'error');
        };

        if (this._isTodayPeriod()) {
            this.unsubscribe = query.onSnapshot(handleSnap, onError);
        } else {
            query.get().then(handleSnap).catch(onError);
        }
        this.fetchPrevPeriod();
    },

    fetchPrevPeriod() {
        const requestKey = this._prevRequestKey;
        const prev = this.getPrevPeriod(this.fechaInicio, this.fechaFin);
        firebase.firestore().collection('interlogic')
            .where('fecha', '>=', prev.inicio)
            .where('fecha', '<=', prev.fin)
            .orderBy('fecha', 'desc')
            .limit(DASHBOARD_MAX_RECORDS)
            .get()
            .then(snapshot => {
                if (this._prevRequestKey !== requestKey) return;
                this.prevRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.anulado !== true);
                this.computeAndRender();
                this.updateDeltas();
            })
            .catch(() => {});
    },

    /* ── KPI + Insights templates ── */
    _kpiIcon(name) {
        const c = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
        if (name === 'total') return `<svg ${c}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
        if (name === 'contado') return `<svg ${c}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
        if (name === 'credito') return `<svg ${c}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
        if (name === 'dalse') return `<svg ${c}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
        return `<svg ${c}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>`;
    },

    _kpiDefs() {
        return [
            { key: 'total', label: 'Total Ventas' },
            { key: 'contado', label: 'Contado' },
            { key: 'credito', label: 'Crédito' },
            { key: 'dalse', label: 'Dalse' },
            { key: 'incede', label: 'Incede' }
        ];
    },

    _renderKpiGrid() {
        const grid = document.getElementById('dash-kpi-grid');
        if (!grid || grid.dataset.built) return;
        grid.dataset.built = '1';
        grid.innerHTML = this._kpiDefs().map(d => `
            <div class="dash-kpi-card dash-kpi-loading" data-kpi="${d.key}" style="cursor:pointer;">
                <div class="dash-kpi-head">
                    <div class="dash-kpi-icon dash-kpi-icon-${d.key}">${this._kpiIcon(d.key)}</div>
                    <div class="dash-kpi-delta" id="dash-${d.key}-delta"></div>
                </div>
                <div class="dash-kpi-body">
                    <div class="dash-kpi-label">${d.label}</div>
                    <div class="dash-kpi-value" id="dash-${d.key}-monto">$0</div>
                    <div class="dash-kpi-meta" id="dash-${d.key}-count">0 entregas</div>
                    <div class="dash-kpi-sub" id="dash-${d.key}-sub"></div>
                </div>
            </div>`).join('');
        if (!grid.dataset.bound) {
            grid.dataset.bound = '1';
            grid.addEventListener('click', e => {
                const card = e.target.closest('[data-kpi]');
                if (!card) return;
                const k = card.dataset.kpi;
                if (k === 'incede') this.showIncedeDetailModal();
                else this.showDetailModal(k);
            });
        }
    },

    _periodLabel() {
        try { return this.formatDateShort(this.fechaInicio) + ' – ' + this.formatDateShort(this.fechaFin); } catch (e) { return ''; }
    },

    _updateRangeLabel() {
        const el = document.getElementById('dash-range-label');
        if (el && this.fechaInicio && this.fechaFin) el.textContent = this._periodLabel();
    },

    _insightIcon(name) {
        const c = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
        if (name === 'flame') return `<svg ${c}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
        if (name === 'trend-up') return `<svg ${c}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
        if (name === 'trend-down') return `<svg ${c}><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`;
        if (name === 'trophy') return `<svg ${c}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;
        if (name === 'alert') return `<svg ${c}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
        return `<svg ${c}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;
    },

    renderInsights(ctx) {
        const box = document.getElementById('dash-insights');
        if (!box) return;
        const items = [];
        const best = Object.entries(ctx.dailyStats).sort((a, b) => b[1].total - a[1].total)[0];
        if (best) items.push({ icon: this._insightIcon('flame'), cls: 'up', title: 'Mejor día', text: best[1].label + ' · ' + this.formatMoney(best[1].total) });
        if (ctx.deltas && ctx.deltas.total != null) {
            const up = ctx.deltas.total >= 0;
            items.push({ icon: this._insightIcon(up ? 'trend-up' : 'trend-down'), cls: up ? 'up' : 'down', title: 'Vs anterior', text: (up ? '+' : '') + ctx.deltas.total.toFixed(1) + '%' });
        }
        const topV = Object.entries(ctx.vendedorStats).filter(([n]) => n && n !== 'Sin vendedor').sort((a, b) => b[1].monto - a[1].monto)[0];
        if (topV) items.push({ icon: this._insightIcon('trophy'), cls: 'info', title: 'Top vendedor', text: topV[0] + ' · ' + this.formatMoney(topV[1].monto) });
        const credShare = ctx.stats.total > 0 ? (ctx.stats.credito / ctx.stats.total) * 100 : 0;
        const ticket = ctx.stats.totalCount > 0 ? ctx.stats.total / ctx.stats.totalCount : 0;
        items.push({ icon: this._insightIcon(credShare >= 60 ? 'alert' : 'card'), cls: credShare >= 60 ? 'warn' : 'info', title: 'Crédito del total', text: credShare.toFixed(0) + '% · ticket ' + this.formatMoney(ticket) });
        box.innerHTML = items.map(i => '<div class="dash-insight dash-insight-' + i.cls + '"><span class="dash-insight-icon">' + i.icon + '</span><div><div class="dash-insight-title">' + i.title + '</div><div class="dash-insight-text">' + this._escapeHtml(i.text) + '</div></div></div>').join('');
    },

    _setupTabs() {
        const tabs = document.querySelectorAll('.dash-tab');
        const panels = document.querySelectorAll('.dash-tabpanel');
        if (!tabs.length) return;
        const active = document.querySelector('.dash-tab.active')?.dataset.tab || 'resumen';
        tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === active)));
        panels.forEach(p => { p.hidden = p.dataset.panel !== active; });
        tabs.forEach(t => {
            t.addEventListener('click', () => {
                tabs.forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
                t.classList.add('active');
                t.setAttribute('aria-selected', 'true');
                const name = t.dataset.tab;
                panels.forEach(p => { p.hidden = p.dataset.panel !== name; });
                requestAnimationFrame(() => this._resizeCharts());
            });
            t.addEventListener('keydown', e => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                const list = [...tabs];
                const next = (list.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
                list[next].focus();
                list[next].click();
            });
        });
    },

    _resizeCharts() {
        Object.values(this.charts).forEach(c => {
            if (!c) return;
            try { c.updateOptions({}, false, false); if (typeof c.resize === 'function') c.resize(); } catch (e) {}
        });
    },

    _rankState: { vendedor: false, zona: false, carrier: false },

    _setupRankToggles() {
        const map = [['dash-vendedor-toggle', 'vendedor'], ['dash-zona-toggle', 'zona'], ['dash-carrier-toggle', 'carrier']];
        map.forEach(([id, key]) => {
            const btn = document.getElementById(id);
            if (!btn || btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', () => {
                this._rankState[key] = !this._rankState[key];
                btn.textContent = this._rankState[key] ? 'Ver menos' : 'Ver todos';
                this.computeAndRender();
            });
        });
    },

    _rankDeltaHtml(name, kind) {
        const d = (this._dimDeltas && this._dimDeltas[kind] && this._dimDeltas[kind][name]);
        if (d == null) return '';
        const up = d >= 0;
        return `<span class="dash-rank-delta ${up ? 'up' : 'down'}" title="Vs periodo anterior">${up ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%</span>`;
    },

    computeAndRender() {
        const records = this.records;
        let stats = { total: 0, totalCount: 0, contado: 0, contadoCount: 0, credito: 0, creditoCount: 0, dalse: 0, dalseCount: 0, incede: 0, incedeCount: 0 };
        const carrierStats = {};
        const dailyStats = {};
        const vendedorStats = {};
        const zonaStats = {};
        const matriz = {};

        records.forEach(r => {
            const m = signedAmount(r, 'venta');
            const cond = (r.condicionPago || '').toLowerCase().trim();
            const isContado = cond === 'contado';
            const isCredito = cond === 'credito' || cond === 'crédito';
            const emp = (r.empresa || '').toUpperCase().trim();
            const ent = (r.entrega || 'Sin asignar').toUpperCase().trim();
            const vendedor = (r.vendedor || 'Sin vendedor').trim() || 'Sin vendedor';
            const zona = (r.departamento || r.zona || 'Sin departamento').trim() || 'Sin departamento';
            const fec = r.fecha ? r.fecha.toDate() : new Date();
            const dk = toDateKey(fec);
            const dl = this.formatDateShort(fec);

            stats.total += m; stats.totalCount++;
            if (isContado) { stats.contado += m; stats.contadoCount++; }
            else if (isCredito) { stats.credito += m; stats.creditoCount++; }
            if (emp === 'DALSE') { stats.dalse += m; stats.dalseCount++; }
            if (emp === 'INCEDE') { stats.incede += m; stats.incedeCount++; }

            if (!carrierStats[ent]) carrierStats[ent] = { monto: 0, count: 0, contado: 0, credito: 0 };
            carrierStats[ent].monto += m;
            carrierStats[ent].count++;
            if (isContado) carrierStats[ent].contado += m;
            else carrierStats[ent].credito += m;

            /* Vendedor aggregation */
            if (!vendedorStats[vendedor]) vendedorStats[vendedor] = { monto: 0, count: 0, contado: 0, credito: 0 };
            vendedorStats[vendedor].monto += m;
            vendedorStats[vendedor].count++;
            if (isContado) vendedorStats[vendedor].contado += m;
            else if (isCredito) vendedorStats[vendedor].credito += m;

            /* Zona aggregation */
            if (!zonaStats[zona]) zonaStats[zona] = { monto: 0, count: 0, contado: 0, credito: 0 };
            zonaStats[zona].monto += m;
            zonaStats[zona].count++;
            if (isContado) zonaStats[zona].contado += m;
            else if (isCredito) zonaStats[zona].credito += m;

            /* Matriz vendedor×zona */
            if (!matriz[vendedor]) matriz[vendedor] = {};
            if (!matriz[vendedor][zona]) matriz[vendedor][zona] = { monto: 0, count: 0, contado: 0, credito: 0 };
            matriz[vendedor][zona].monto += m;
            matriz[vendedor][zona].count++;
            if (isContado) matriz[vendedor][zona].contado += m;
            else if (isCredito) matriz[vendedor][zona].credito += m;

            if (!dailyStats[dk]) dailyStats[dk] = {
                label: dl, total: 0, totalCount: 0,
                contado: 0, contadoCount: 0, credito: 0, creditoCount: 0, dalse: 0, incede: 0
            };
            dailyStats[dk].total += m;
            dailyStats[dk].totalCount++;
            if (isContado) { dailyStats[dk].contado += m; dailyStats[dk].contadoCount++; }
            else { dailyStats[dk].credito += m; dailyStats[dk].creditoCount++; }
            if (emp === 'DALSE') dailyStats[dk].dalse += m;
            if (emp === 'INCEDE') dailyStats[dk].incede += m;
        });

        const carrierNames = Object.entries(carrierStats)
            .sort((a, b) => b[1].monto - a[1].monto)
            .map(([name]) => name);
        const carrierBarData = carrierNames.map(name =>
            Math.round((carrierStats[name] && carrierStats[name].monto) || 0)
        );

        this.updateKpiCards(stats);
        const vendedorNames = Object.entries(vendedorStats).sort((a, b) => b[1].monto - a[1].monto).map(([n]) => n);
        const zonaNames = Object.entries(zonaStats).sort((a, b) => b[1].monto - a[1].monto).map(([n]) => n);
        this.updateCharts({
            donut: { contado: Math.round(stats.contado), credito: Math.round(stats.credito), contadoCount: stats.contadoCount, creditoCount: stats.creditoCount },
            incede: { dalse: Math.round(stats.dalse), incede: Math.round(stats.incede), dalseCount: stats.dalseCount, incedeCount: stats.incedeCount, total: stats.totalCount },
            bar: { categories: carrierNames, data: carrierBarData, count: carrierNames.reduce((a, n) => a + ((carrierStats[n] && carrierStats[n].count) || 0), 0) },
            vendedor: { categories: vendedorNames, data: vendedorNames.map(n => Math.round(vendedorStats[n].monto)), count: vendedorNames.reduce((a, n) => a + ((vendedorStats[n] && vendedorStats[n].count) || 0), 0) },
            zona: { categories: zonaNames, data: zonaNames.map(n => Math.round(zonaStats[n].monto)), count: zonaNames.reduce((a, n) => a + ((zonaStats[n] && zonaStats[n].count) || 0), 0) }
        });
        this.updateCarrierStats(carrierStats, stats.total);
        this.updateVendedorStats(vendedorStats, stats.total);
        this.updateZonaStats(zonaStats, stats.total);
        this.updateAcumuladoVendedor(vendedorStats);
        this.updateMatriz(matriz, vendedorStats, zonaStats);
        this.updateDayCards(dailyStats);
        const badge = document.getElementById('dash-dia-resumen');
        if (badge) badge.textContent = Object.keys(dailyStats).length + ' días';
        const cur = this.computeTotals(this.records);
        const prev = this.computeTotals(this.prevRecords || []);
        const pct = (c, p) => p !== 0 ? ((c - p) / Math.abs(p) * 100) : null;
        this.renderInsights({ stats, dailyStats, vendedorStats, zonaStats, carrierStats, deltas: { total: pct(cur.total, prev.total) } });
        this._updateRangeLabel();
        // Pill flotante: total siempre visible al scrollear
        const pillTotal = document.getElementById('dash-float-pill-total');
        const pillCount = document.getElementById('dash-float-pill-count');
        if (pillTotal) pillTotal.textContent = this.formatMoney(stats.total);
        if (pillCount) pillCount.textContent = `${stats.totalCount} ent.`;
        // Mobile polish: ajusta tipografía larga y marca scrollables
        this._fitKpiValues();
    },

    /* ── Update KPI cards ── */
    _prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    /* Count-up animado: de valor previo a nuevo, easeOutCubic, solo móvil */
    _animateMoney(el, target) {
        if (!el) return;
        const from = parseFloat(el.dataset.raw || '0');
        el.dataset.raw = String(target);
        const pop = () => { el.classList.add('dash-value-pop'); setTimeout(() => el.classList.remove('dash-value-pop'), 400); };
        const isMobile = window.innerWidth <= 768;
        if (isMobile && !this._prefersReducedMotion() && Math.abs(target - from) > 0.5) {
            const dur = 550;
            const t0 = performance.now();
            const ease = t => 1 - Math.pow(1 - t, 3);
            const step = now => {
                const p = Math.min(1, (now - t0) / dur);
                el.textContent = this.formatMoney(from + (target - from) * ease(p));
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
            pop();
        } else {
            el.textContent = this.formatMoney(target);
            pop();
        }
    },

    _dimName(r, kind) {
        if (kind === 'vendedor') return (r.vendedor || 'Sin vendedor').trim() || 'Sin vendedor';
        if (kind === 'zona') return (r.departamento || r.zona || 'Sin departamento').trim() || 'Sin departamento';
        return (r.entrega || 'Sin asignar').toUpperCase().trim();
    },

    _aggregateDim(records, kind) {
        const out = {};
        (records || []).forEach(r => {
            const n = this._dimName(r, kind);
            out[n] = (out[n] || 0) + signedAmount(r, 'venta');
        });
        return out;
    },

    _dimPct(cur, prev) {
        const d = {};
        Object.keys(cur).forEach(n => {
            const p = prev[n] || 0;
            d[n] = p !== 0 ? ((cur[n] - p) / Math.abs(p) * 100) : null;
        });
        return d;
    },

    _dimDeltas: { vendedor: {}, zona: {}, carrier: {} },

    updateKpiCards(s) {
        const e = id => document.getElementById(id);
        const sub = (id, v) => { const n = e(id); if (n) n.textContent = v; };
        document.querySelectorAll('.dash-kpi-loading').forEach(card => card.classList.remove('dash-kpi-loading'));

        this._animateMoney(e('dash-total-monto'), s.total);
        this._animateMoney(e('dash-contado-monto'), s.contado);
        this._animateMoney(e('dash-credito-monto'), s.credito);
        this._animateMoney(e('dash-dalse-monto'), s.dalse);
        this._animateMoney(e('dash-incede-monto'), s.incede);
        // Ajuste mobile: si el monto es muy largo, la CSS lo reduce vía [data-long]
        if (window.innerWidth <= 768) requestAnimationFrame(() => this._fitKpiValues());

        if (e('dash-total-count')) e('dash-total-count').textContent = `${s.totalCount} entrega${s.totalCount !== 1 ? 's' : ''}`;
        if (e('dash-contado-count')) e('dash-contado-count').textContent = `${s.contadoCount} entrega${s.contadoCount !== 1 ? 's' : ''}`;
        if (e('dash-credito-count')) e('dash-credito-count').textContent = `${s.creditoCount} entrega${s.creditoCount !== 1 ? 's' : ''}`;
        if (e('dash-dalse-count')) e('dash-dalse-count').textContent = s.dalseCount === 0 ? 'Sin entregas' : `${s.dalseCount} entrega${s.dalseCount !== 1 ? 's' : ''}`;
        if (e('dash-incede-count')) e('dash-incede-count').textContent = s.incedeCount === 0 ? 'Sin entregas' : `${s.incedeCount} entrega${s.incedeCount !== 1 ? 's' : ''}`;

        sub('dash-total-sub', s.totalCount > 0 ? 'Ticket prom. ' + this.formatMoney(s.total / s.totalCount) : '');
        sub('dash-contado-sub', s.total > 0 ? ((s.contado / s.total) * 100).toFixed(0) + '% del total' : '');
        sub('dash-credito-sub', s.total > 0 ? ((s.credito / s.total) * 100).toFixed(0) + '% del total' : '');
        sub('dash-dalse-sub', s.total > 0 ? ((s.dalse / s.total) * 100).toFixed(0) + '% del total' : '');
        sub('dash-incede-sub', s.total > 0 ? ((s.incede / s.total) * 100).toFixed(0) + '% del total' : '');

        try {
            const curV = this._aggregateDim(this.records, 'vendedor');
            const prevV = this._aggregateDim(this.prevRecords || [], 'vendedor');
            const curC = this._aggregateDim(this.records, 'carrier');
            const prevC = this._aggregateDim(this.prevRecords || [], 'carrier');
            const curZ = this._aggregateDim(this.records, 'zona');
            const prevZ = this._aggregateDim(this.prevRecords || [], 'zona');
            this._dimDeltas = { vendedor: this._dimPct(curV, prevV), zona: this._dimPct(curZ, prevZ), carrier: this._dimPct(curC, prevC) };
        } catch (e) { this._dimDeltas = { vendedor: {}, zona: {}, carrier: {} }; }
        const dalseCard = document.querySelector('.dash-kpi-icon-dalse')?.closest('.dash-kpi-card');
        if (dalseCard) {
            if (s.dalseCount === 0) dalseCard.classList.add('dash-kpi-empty');
            else dalseCard.classList.remove('dash-kpi-empty');
        }
        const incedeCard = document.querySelector('.dash-kpi-icon-incede')?.closest('.dash-kpi-card');
        if (incedeCard) {
            if (s.incedeCount === 0) incedeCard.classList.add('dash-kpi-empty');
            else incedeCard.classList.remove('dash-kpi-empty');
        }

    },

    /* ── Update deltas ── */
    updateDeltas() {
        const cur = this.computeTotals(this.records);
        const prev = this.computeTotals(this.prevRecords);

        const deltaEls = {
            total: 'dash-total-delta',
            contado: 'dash-contado-delta',
            credito: 'dash-credito-delta',
            dalse: 'dash-dalse-delta',
            incede: 'dash-incede-delta'
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
        let total = 0, contado = 0, credito = 0, dalse = 0, incede = 0;
        records.forEach(r => {
            const m = signedAmount(r, 'venta');
            const cond = (r.condicionPago || '').toLowerCase().trim();
            const ent = (r.entrega || '').toUpperCase().trim();
            total += m;
            if (cond === 'contado') contado += m;
            else if (cond === 'credito' || cond === 'crédito') credito += m;
            if ((r.empresa || '').toUpperCase().trim() === 'DALSE') dalse += m;
            if ((r.empresa || '').toUpperCase().trim() === 'INCEDE') incede += m;
        });
        return { total, contado, credito, dalse, incede };
    },

    /* ── ApexCharts init & update ── */
    getChartTheme() {
        const t = document.documentElement.getAttribute('data-theme');
        return t === 'dark' ? 'dark' : 'light';
    },

    getChartColors() {
        const theme = this.getChartTheme();
        return {
            theme,
            labelColor: theme === 'dark' ? '#e2e8f0' : '#0f172a',
            mutedColor: theme === 'dark' ? '#94a3b8' : '#64748b',
            gridColor: theme === 'dark' ? '#334155' : '#e2e8f0',
            strokeColor: theme === 'dark' ? '#0f172a' : '#ffffff'
        };
    },

    /* Re-aplica los colores de tema a todos los charts vivos.
       Los colores de etiquetas/ejes/leyendas se calculan una sola
       vez en initCharts; sin esto, al cambiar el tema quedaban
       etiquetas oscuras sobre tarjetas oscuras (o viceversa)
       hasta recargar la página. */
    applyChartTheme() {
        const { theme, labelColor, mutedColor, gridColor, strokeColor } = this.getChartColors();
        Object.entries(this.charts).forEach(([k, c]) => {
            if (!c) return;
            const opts = { theme: { mode: theme }, grid: { borderColor: gridColor } };
            if (k === 'donut' || k === 'incede') {
                opts.plotOptions = { pie: { donut: { labels: {
                    name: { color: mutedColor },
                    value: { color: labelColor },
                    total: { color: mutedColor }
                } } } };
                opts.legend = { labels: { colors: labelColor } };
                opts.stroke = { colors: [strokeColor] };
            } else if (k === 'acum') {
                opts.legend = { labels: { colors: labelColor } };
            } else if (k === 'bar') {
                opts.xaxis = { labels: { style: { colors: labelColor } } };
                opts.yaxis = { labels: { style: { colors: mutedColor } } };
                opts.dataLabels = { style: { colors: [labelColor] } };
            } else if (k === 'vendedor' || k === 'zona') {
                opts.yaxis = { labels: { style: { colors: labelColor } } };
                opts.dataLabels = { style: { colors: [labelColor] } };
            }
            c.updateOptions(opts);
        });
    },

    async initCharts() {
        if (this.chartInit) return;
        const renderToken = this._renderToken;
        if (typeof ApexCharts === 'undefined') { showToast('Gráficos no disponibles (sin conexión al CDN)', 'warning'); return; }
        const theme = this.getChartTheme();
        const labelColor = theme === 'dark' ? '#e2e8f0' : '#0f172a';
        const mutedColor = theme === 'dark' ? '#94a3b8' : '#64748b';

        const donutOptions = {
            chart: { type: 'donut', fontFamily: 'Inter, sans-serif', height: 380, sparkline: { enabled: false }, events: { dataPointSelection: (e, c, config) => { const idx = config.dataPointIndex; if (idx === 0) this.showDetailModal('contado'); else if (idx === 1) this.showDetailModal('credito'); } } },
            series: [0, 0],
            labels: ['Contado', 'Crédito'],
            colors: ['#10b981', '#f59e0b'],
            plotOptions: {
                pie: {
                    donut: {
                        size: '72%',
                        labels: {
                            show: true,
                            name: { show: true, fontSize: '14px', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: mutedColor },
                            value: { show: true, fontSize: '22px', fontWeight: 800, fontFamily: 'Inter, sans-serif', color: labelColor, formatter: v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                            total: { show: true, label: 'Total', fontSize: '13px', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: mutedColor, formatter: () => '$0' }
                        }
                    }
                }
            },
            stroke: { width: 4, colors: [theme === 'dark' ? '#0f172a' : '#ffffff'] },
            states: {
                hover: {
                    filter: {
                        type: 'lighten',
                        value: 0.08
                    }
                }
            },
            dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', style: { fontSize: '14px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }, dropShadow: { enabled: false } },
            legend: { position: 'bottom', fontSize: '14px', fontWeight: 600, fontFamily: 'Inter, sans-serif', labels: { colors: labelColor }, markers: { size: 8, strokeWidth: 0 } },
            tooltip: { y: { formatter: v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }, style: { fontSize: '13px', fontFamily: 'Inter, sans-serif' } },
            theme: { mode: theme },
            responsive: [{ breakpoint: 768, options: { chart: { height: 320 }, legend: { position: 'bottom', fontSize: '13px' }, dataLabels: { style: { fontSize: '12px' } } } }]
        };

        const barOptions = {
            chart: { type: 'bar', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, height: 448, animations: { enabled: true, easing: 'easeout', speed: 750, animateGradually: { enabled: true, delay: 70 } }, events: { dataPointSelection: (e, c, config) => { const idx = config.dataPointIndex; const names = window.Dashboard?._barChartNames || []; if (names[idx]) this.showCarrierDetailModal(names[idx]); } } },
            series: [{ name: 'Ventas', data: [] }],
            xaxis: { categories: [], axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { fontSize: '14px', fontWeight: 700, fontFamily: 'Inter, sans-serif', colors: labelColor } }, crosshairs: { show: false } },
            yaxis: { labels: { formatter: v => v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + Math.round(v), style: { fontSize: '13px', fontFamily: 'Inter, sans-serif', colors: mutedColor } } },
            colors: ['#7c3aed', '#2563eb', '#db2777'],
            plotOptions: {
                bar: {
                    borderRadius: 14,
                    borderRadiusApplication: 'end',
                    columnWidth: '55%',
                    distributed: true,
                    dataLabels: { position: 'top', maxItems: 8 },
                    colors: {
                        backgroundBarColors: [theme === 'dark' ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.10)'],
                        backgroundBarOpacity: 1,
                        backgroundBarRadius: 14
                    }
                }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'light',
                    type: 'vertical',
                    gradientToColors: ['#c4b5fd', '#93c5fd', '#f9a8d4'],
                    opacityFrom: 0.98,
                    opacityTo: 0.78,
                    stops: [0, 100]
                }
            },
            dataLabels: {
                enabled: true,
                formatter: function(val) {
                    const total = window.Dashboard?.barTotal || 0;
                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                    return '$' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\n' + pct + '%';
                },
                style: { fontSize: '13px', fontWeight: 800, fontFamily: 'Inter, sans-serif', colors: [labelColor] },
                offsetY: -22,
                dropShadow: { enabled: false }
            },
            tooltip: {
                custom: ({ series, seriesIndex, dataPointIndex, w }) => {
                    const val = series[seriesIndex][dataPointIndex];
                    const name = (w.globals.categories || [])[dataPointIndex] || '';
                    const total = window.Dashboard?.barTotal || 0;
                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                    const color = (w.globals.colors || [])[dataPointIndex] || '#7c3aed';
                    return '<div class="dash-bar-tip">' +
                        '<div class="dash-bar-tip-head"><span class="dash-bar-tip-dot" style="background:' + color + '"></span><div class="dash-bar-tip-name">' + name + '</div></div>' +
                        '<div class="dash-bar-tip-val">$' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</div>' +
                        '<div class="dash-bar-tip-track"><span style="width:' + pct + '%;background:' + color + '"></span></div>' +
                        '<div class="dash-bar-tip-pct">' + pct + '% del total</div>' +
                        '</div>';
                }
            },
            grid: { borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', strokeDashArray: 5, padding: { top: 40, left: 8, right: 8, bottom: 0 } },
            dropShadow: { enabled: true, top: 4, left: 0, blur: 8, color: '#000000', opacity: 0.12 },
            states: {
                hover: { filter: { type: 'lighten', value: 0.06 } },
                active: { filter: { type: 'lighten', value: 0.04 } }
            },
            theme: { mode: theme },
            responsive: [{ breakpoint: 768, options: { dataLabels: { enabled: false, style: { fontSize: '12px' } } } }]
        };

        const donutEl = document.getElementById('dash-donut-chart');
        const incedeEl = document.getElementById('dash-incede-chart');
        const barEl = document.getElementById('dash-bar-chart');

        if (donutEl) this.charts.donut = new ApexCharts(donutEl, donutOptions);

        /* ── Dalse vs Incede chart (donut) ── */
        if (incedeEl) {
            const incedeOptions = {
                chart: { type: 'donut', fontFamily: 'Inter, sans-serif', height: 380, sparkline: { enabled: false }, events: { dataPointSelection: (e, c, config) => { const idx = config.dataPointIndex; if (idx === 0) this.showDetailModal('dalse'); else if (idx === 1) this.showIncedeDetailModal(); } } },
                series: [0, 0],
                labels: ['Dalse', 'Incede'],
                colors: ['#06b6d4', '#f43f5e'],
                plotOptions: {
                    pie: {
                        donut: {
                            size: '72%',
                            labels: {
                                show: true,
                                name: { show: true, fontSize: '14px', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: mutedColor },
                                value: { show: true, fontSize: '22px', fontWeight: 800, fontFamily: 'Inter, sans-serif', color: labelColor, formatter: v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                                total: { show: true, label: 'Total', fontSize: '13px', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: mutedColor, formatter: () => '$0' }
                            }
                        }
                    }
                },
            stroke: { width: 4, colors: [theme === 'dark' ? '#0f172a' : '#ffffff'] },
            states: {
                hover: {
                    filter: {
                        type: 'lighten',
                        value: 0.08
                    }
                }
            },
                dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', style: { fontSize: '14px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }, dropShadow: { enabled: false } },
                legend: { position: 'bottom', fontSize: '14px', fontWeight: 600, fontFamily: 'Inter, sans-serif', labels: { colors: labelColor }, markers: { size: 8, strokeWidth: 0 } },
                tooltip: { y: { formatter: v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }, style: { fontSize: '13px', fontFamily: 'Inter, sans-serif' } },
                theme: { mode: theme },
                responsive: [{ breakpoint: 768, options: { chart: { height: 320 }, legend: { position: 'bottom', fontSize: '13px' }, dataLabels: { style: { fontSize: '12px' } } } }]
            };
            this.charts.incede = new ApexCharts(incedeEl, incedeOptions);
        }

        if (barEl) this.charts.bar = new ApexCharts(barEl, barOptions);

        /* ── Vendedor chart (horizontal bar, top 10) ── */
        const vendedorEl = document.getElementById('dash-vendedor-chart');
        if (vendedorEl) {
            const vendedorOptions = {
                chart: { type: 'bar', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, events: { dataPointSelection: (e, c, config) => { const idx = config.dataPointIndex; const names = window.Dashboard?._vendedorChartNames || []; if (names[idx]) this.showVendedorDetailModal(names[idx]); } } },
                series: [{ name: 'Ventas', data: [] }],
                plotOptions: {
                    bar: {
                        borderRadius: 10,
                        borderRadiusApplication: 'end',
                        horizontal: true,
                        barHeight: '58%',
                        distributed: true,
                        dataLabels: { position: 'top', maxItems: 10 }
                    }
                },
                xaxis: { categories: [], axisBorder: { show: false }, axisTicks: { show: false }, labels: { formatter: v => v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + Math.round(v), style: { fontSize: '13px', fontFamily: 'Inter, sans-serif' } } },
                yaxis: { labels: { style: { fontSize: '13px', fontWeight: 700, fontFamily: 'Inter, sans-serif', colors: labelColor } } },
                colors: ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#38bdf8'],
                fill: {
                    type: 'gradient',
                    gradient: {
                        type: 'horizontal',
                        gradientToColors: ['#60a5fa'],
                        opacityFrom: 0.96,
                        opacityTo: 0.82,
                        stops: [0, 100]
                    }
                },
                dataLabels: {
                    enabled: true,
                    formatter: v => v > 0 ? '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
                    style: { fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif', colors: [labelColor] },
                    offsetX: 6,
                    dropShadow: { enabled: false }
                },
                tooltip: { y: { formatter: v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } },
                grid: { borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', strokeDashArray: 4, padding: { right: 80, left: 10 } },
                theme: { mode: theme },
                responsive: [{ breakpoint: 768, options: { chart: { height: 380 }, dataLabels: { style: { fontSize: '11px' } } } }]
            };
            this.charts.vendedor = new ApexCharts(vendedorEl, vendedorOptions);
        }

        /* ── Zona chart (horizontal bar, top 10) ── */
        const zonaEl = document.getElementById('dash-zona-chart');
        if (zonaEl) {
            const zonaOptions = {
                chart: { type: 'bar', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, events: { dataPointSelection: (e, c, config) => { const idx = config.dataPointIndex; const names = window.Dashboard?._zonaChartNames || []; if (names[idx]) this.showZonaDetailModal(names[idx]); } } },
                series: [{ name: 'Ventas', data: [] }],
                plotOptions: {
                    bar: {
                        borderRadius: 10,
                        borderRadiusApplication: 'end',
                        horizontal: true,
                        barHeight: '58%',
                        distributed: true,
                        dataLabels: { position: 'top', maxItems: 10 }
                    }
                },
                xaxis: { categories: [], axisBorder: { show: false }, axisTicks: { show: false }, labels: { formatter: v => v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + Math.round(v), style: { fontSize: '13px', fontFamily: 'Inter, sans-serif' } } },
                yaxis: { labels: { style: { fontSize: '13px', fontWeight: 700, fontFamily: 'Inter, sans-serif', colors: labelColor } } },
                colors: ['#0f766e', '#14b8a6', '#06b6d4', '#0891b2', '#0284c7'],
                fill: {
                    type: 'gradient',
                    gradient: {
                        type: 'horizontal',
                        gradientToColors: ['#67e8f9'],
                        opacityFrom: 0.96,
                        opacityTo: 0.82,
                        stops: [0, 100]
                    }
                },
                dataLabels: {
                    enabled: true,
                    formatter: v => v > 0 ? '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
                    style: { fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif', colors: [labelColor] },
                    offsetX: 6,
                    dropShadow: { enabled: false }
                },
                tooltip: { y: { formatter: v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } },
                grid: { borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', strokeDashArray: 4, padding: { right: 80, left: 10 } },
                theme: { mode: theme },
                responsive: [{ breakpoint: 768, options: { chart: { height: 380 }, dataLabels: { style: { fontSize: '11px' } } } }]
            };
            this.charts.zona = new ApexCharts(zonaEl, zonaOptions);
        }

        /* ── Acumulado por Vendedor chart (pie) ── */
        const acumEl = document.getElementById('dash-acum-chart');
        if (acumEl) {
            const acumOptions = {
                chart: { type: 'pie', fontFamily: 'Inter, sans-serif', toolbar: { show: false }, events: { dataPointSelection: (e, c, config) => { const idx = config.dataPointIndex; const names = window.Dashboard._acumChartNames || []; if (names[idx]) this.showVendedorDetailModal(names[idx]); } } },
                series: [],
                labels: [],
                colors: ['#7c3aed','#8b5cf6','#6366f1','#9333ea','#3b82f6','#06b6d4','#10b981','#f59e0b','#ec4899','#84cc16','#f97316','#ef4444','#14b8a6','#d946ef','#fb923c'],
                plotOptions: {
                    pie: {
                        expandOnClick: true,
                        dataLabels: { offset: -10, minAngleToShowLabel: 8 }
                    }
                },
                dataLabels: {
                    enabled: true,
                    formatter: (v, opts) => {
                        const series = opts.w.config.series;
                        const total = series.reduce((a, b) => a + b, 0);
                        return total > 0 ? ((series[opts.seriesIndex] / total) * 100).toFixed(1) + '%' : '0%';
                    },
                    style: { fontSize: '13px', fontWeight: 700, fontFamily: 'Inter, sans-serif' },
                    dropShadow: { enabled: false }
                },
                legend: {
                    position: 'bottom',
                    fontSize: '13px',
                    fontWeight: 700,
                    fontFamily: 'Inter, sans-serif',
                    labels: { colors: labelColor },
                    itemMargin: { horizontal: 10, vertical: 7 },
                    formatter: (name, opts) => name + ' · ' + this.formatMoney(opts.w.config.series[opts.seriesIndex] || 0)
                },
                tooltip: { y: { formatter: v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } },
                theme: { mode: theme },
                responsive: [{ breakpoint: 768, options: { chart: { height: 300 }, legend: { fontSize: '11px' } } }]
            };
            this.charts.acum = new ApexCharts(acumEl, acumOptions);
        }

        const renderJobs = Object.values(this.charts)
            .filter(c => c && typeof c.render === 'function')
            .map(c => c.render());
        await Promise.all(renderJobs);
        if (this._renderToken !== renderToken) return;

        this.chartInit = true;

        // — Mobile resize handling: ResizeObserver + orientationchange
        const _debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
        const _handleChartResize = _debounce(() => {
            Object.values(this.charts).forEach(c => {
                if (!c) return;
                try {
                    // Force ApexCharts to recalc width; height handled by CSS (260 mobile / 380 desktop)
                    c.updateOptions({}, false, false);
                    if (typeof c.resize === 'function') c.resize();
                } catch(e) {}
            });
        }, 120);
        if (window.ResizeObserver) {
            const roTarget = document.querySelector('.dash') || document.getElementById('content-area');
            if (roTarget) {
                this._dashRO = new ResizeObserver(_handleChartResize);
                this._dashRO.observe(roTarget);
            }
        }
        window.addEventListener('orientationchange', _handleChartResize, { passive: true });
        window.addEventListener('resize', _handleChartResize, { passive: true });
        this._handleChartResize = _handleChartResize;

        this.themeObserver = new MutationObserver(() => {
            this.applyChartTheme();
        });
        this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    },

    updateCharts(data) {
        if (!this.chartInit) return;

        if (data.donut) {
            const total = data.donut.contado + data.donut.credito;
            const count = (data.donut.contadoCount || 0) + (data.donut.creditoCount || 0);
            this._setChartTotal('dash-donut-chart-total', total, count);
            if (this.charts.donut) this.charts.donut.updateOptions({
                series: [data.donut.contado, data.donut.credito],
                plotOptions: {
                    pie: { donut: { labels: { total: { formatter: () => this._moneyFull(total) } } } }
                }
            });
        }

        if (data.incede) {
            const incedeTotal = data.incede.dalse + data.incede.incede;
            this._setChartTotal('dash-incede-chart-total', incedeTotal, (data.incede.dalseCount || 0) + (data.incede.incedeCount || 0));
            if (this.charts.incede) this.charts.incede.updateOptions({
                series: [data.incede.dalse, data.incede.incede],
                plotOptions: {
                    pie: { donut: { labels: { total: { formatter: () => this._moneyFull(incedeTotal) } } } }
                }
            });
        }

        if (data.bar && data.bar.data) {
            const total = data.bar.data.reduce((a, b) => a + b, 0);
            this._setChartTotal('dash-bar-chart-total', total, data.bar.count);
            if (this.charts.bar) {
            const rawMax = Math.max(...data.bar.data, 0);
            const target = rawMax * 1.15;
            const pow = Math.pow(10, Math.floor(Math.log10(target > 0 ? target : 1)));
            const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(c => c >= target) || pow * 10;
            const barMax = step;
            window.Dashboard.barTotal = total;
            window.Dashboard._barChartNames = data.bar.categories;
            const carrierGradients = {
                DALSE: ['#7c3aed', '#c4b5fd'],
                INTERLOGISTIC: ['#2563eb', '#93c5fd'],
                XPRESS: ['#db2777', '#f9a8d4'],
                INCEDE: ['#e11d48', '#fda4af']
            };
            const palette = [['#7c3aed', '#c4b5fd'], ['#2563eb', '#93c5fd'], ['#db2777', '#f9a8d4'], ['#e11d48', '#fda4af'], ['#0891b2', '#67e8f9'], ['#059669', '#6ee7b7'], ['#d97706', '#fcd34d']];
            const barPairs = data.bar.categories.map((n, i) => carrierGradients[n] || palette[i % palette.length]);
            const barColors = barPairs.map(p => p[0]);
            const barGradientTo = barPairs.map(p => p[1]);
            const barHeight = Math.max(448, data.bar.categories.length * 145);
            this.charts.bar.updateOptions({
                chart: { height: barHeight },
                colors: barColors,
                fill: { type: 'gradient', gradient: { gradientToColors: barGradientTo } },
                xaxis: { categories: data.bar.categories },
                yaxis: { min: 0, max: barMax || 10, tickAmount: 5, forceNiceScale: false },
                series: [{ data: data.bar.data }]
            });
            }
        }

        if (data.vendedor) {
            const vdata = data.vendedor.categories.map((name, i) => Math.round(data.vendedor.data[i]));
            const totalVendedor = vdata.reduce((a, b) => a + b, 0);
            this._setChartTotal('dash-vendedor-chart-total', totalVendedor, data.vendedor.count);
            window.Dashboard._vendedorChartNames = data.vendedor.categories;
            if (this.charts.vendedor) this.charts.vendedor.updateOptions({
                xaxis: { categories: data.vendedor.categories },
                series: [{ data: vdata }]
            });
        }

        if (data.zona) {
            const zdata = data.zona.categories.map((name, i) => Math.round(data.zona.data[i]));
            const totalZona = zdata.reduce((a, b) => a + b, 0);
            this._setChartTotal('dash-zona-chart-total', totalZona, data.zona.count);
            window.Dashboard._zonaChartNames = data.zona.categories;
            if (this.charts.zona) this.charts.zona.updateOptions({
                xaxis: { categories: data.zona.categories },
                series: [{ data: zdata }]
            });
        }
    },

/* ── Vendedor stats ── */
    updateVendedorStats(vendedorStats, totalMonto) {
        const grid = document.getElementById('dash-vendedor-grid');
        const badge = document.getElementById('dash-vendedor-resumen');
        if (!grid) return;

        const vendedores = Object.entries(vendedorStats)
            .filter(([name]) => name && name !== 'Sin vendedor')
            .sort((a, b) => b[1].monto - a[1].monto);

        if (badge) badge.textContent = vendedores.length + ' vendedores';

        if (vendedores.length === 0) {
            grid.innerHTML = '<div class="dash-empty" style="grid-column:1/-1;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><p>No hay datos de vendedores en este rango</p></div>';
            return;
        }

        grid.innerHTML = vendedores.map(([name, d], index) => {
            const pct = totalMonto > 0 ? ((d.monto / totalMonto) * 100).toFixed(1) : '0';
            const avg = d.count > 0 ? d.monto / d.count : 0;
            const ctPct = d.monto > 0 ? (d.contado / d.monto) * 100 : 0;
            const crPct = d.monto > 0 ? (d.credito / d.monto) * 100 : 0;
            const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `<span class="dash-rank-num">${index + 1}</span>`;
            const avatarColors = ['#7c3aed', '#8b5cf6', '#a78bfa', '#6366f1', '#9333ea', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
            const avatarColor = avatarColors[index % avatarColors.length];
            const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || name.substring(0, 2).toUpperCase();
            return `<div class="dash-vendedor-card" data-vendedor="${this._escapeAttr(name)}" style="${index >= 5 && !this._rankState.vendedor ? 'display:none;' : ''}">
                <div class="dash-vendedor-rank">${medal}</div>
                <div class="dash-vendedor-card-inner">
                    <div class="dash-vendedor-card-top">
                        <div class="dash-vendedor-avatar" style="background:${avatarColor}"><span class="dash-vendedor-avatar-text">${initials}</span></div>
                        <div class="dash-vendedor-body">
                            <div class="dash-vendedor-name">${this._escapeHtml(name.length > 24 ? name.substring(0, 23) + '\u2026' : name)}</div>
                            <div class="dash-vendedor-amount">${this.formatMoney(d.monto)}</div>
                            <div class="dash-vendedor-meta"><span>${d.count} ent.</span><span class="dash-vendedor-sep">·</span><span>avg ${this.formatMoney(avg)}</span><span class="dash-vendedor-sep">·</span><span>${pct}% del total</span> ${this._rankDeltaHtml(name, 'vendedor')}</div>
                        </div>
                    </div>
                    <div class="dash-vendedor-bar-wrap">
                        <div class="dash-vendedor-bar">
                            <div class="dash-vendedor-bar-contado" style="width:${ctPct}%" title="Contado: ${this.formatMoney(d.contado)}"></div>
                            <div class="dash-vendedor-bar-credito" style="width:${crPct}%" title="Crédito: ${this.formatMoney(d.credito)}"></div>
                        </div>
                        <div class="dash-vendedor-bar-labels">
                            <span class="dash-vendedor-bar-label-contado">${ctPct.toFixed(0)}% contado</span>
                            <span class="dash-vendedor-bar-label-credito">${crPct.toFixed(0)}% crédito</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        grid.querySelectorAll('[data-vendedor]').forEach(card => {
            card.addEventListener('click', () => this.showVendedorDetailModal(card.dataset.vendedor));
        });

        const topVendedores = vendedores.slice(0, 10);
        if (this.charts.vendedor) {
            const chartData = topVendedores.map(([, d]) => d.monto);
            const chartNames = topVendedores.map(([name]) => name.length > 14 ? name.substring(0, 13) + '\u2026' : name);
            window.Dashboard._vendedorChartNames = topVendedores.map(([name]) => name);
            this.charts.vendedor.updateOptions({
                xaxis: { categories: chartNames },
                series: [{ data: chartData }]
            });
        }
    },

    /* ── Zona stats ── */
    updateZonaStats(zonaStats, totalMonto) {
        const grid = document.getElementById('dash-zona-grid');
        const badge = document.getElementById('dash-zona-resumen');
        if (!grid) return;

        const zonas = Object.entries(zonaStats)
            .filter(([name]) => name && name !== 'Sin departamento')
            .sort((a, b) => b[1].monto - a[1].monto);

        if (badge) badge.textContent = zonas.length + ' deptos.';

        if (zonas.length === 0) {
            grid.innerHTML = '<div class="dash-empty" style="grid-column:1/-1;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><p>No hay datos de departamentos en este rango</p></div>';
            return;
        }

        grid.innerHTML = zonas.map(([name, d], index) => {
            const pct = totalMonto > 0 ? ((d.monto / totalMonto) * 100).toFixed(1) : '0';
            const avg = d.count > 0 ? d.monto / d.count : 0;
            const ctPct = d.monto > 0 ? (d.contado / d.monto) * 100 : 0;
            const crPct = d.monto > 0 ? (d.credito / d.monto) * 100 : 0;
            const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `<span class="dash-rank-num">${index + 1}</span>`;
            const zonaColors = ['#0891b2', '#0ea5e9', '#06b6d4', '#0284c7', '#2563eb', '#6366f1', '#7c3aed', '#0d9488', '#059669', '#d946ef'];
            const zonaColor = zonaColors[index % zonaColors.length];
            return `<div class="dash-zona-card" data-zona="${this._escapeAttr(name)}" style="${index >= 5 && !this._rankState.zona ? 'display:none;' : ''}">
                <div class="dash-zona-card-inner">
                    <div class="dash-zona-card-top">
                        <div class="dash-zona-icon-wrap"><span class="dash-rank-medal">${medal}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:${zonaColor};"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
                        <div class="dash-zona-body">
                            <div class="dash-zona-name">${this._escapeHtml(name.length > 24 ? name.substring(0, 23) + '\u2026' : name)}</div>
                            <div class="dash-zona-amount">${this.formatMoney(d.monto)}</div>
                            <div class="dash-zona-meta"><span>${d.count} ent.</span><span class="dash-zona-sep">·</span><span>avg ${this.formatMoney(avg)}</span><span class="dash-zona-sep">·</span><span>${pct}% del total</span> ${this._rankDeltaHtml(name, 'zona')}</div>
                        </div>
                    </div>
                    <div class="dash-zona-bar-wrap">
                        <div class="dash-zona-bar">
                            <div class="dash-zona-bar-contado" style="width:${ctPct}%" title="Contado: ${this.formatMoney(d.contado)}"></div>
                            <div class="dash-zona-bar-credito" style="width:${crPct}%" title="Crédito: ${this.formatMoney(d.credito)}"></div>
                        </div>
                        <div class="dash-zona-bar-labels">
                            <span class="dash-zona-bar-label-contado">${this.formatMoney(d.contado)} contado</span>
                            <span class="dash-zona-bar-label-credito">${this.formatMoney(d.credito)} crédito</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        grid.querySelectorAll('[data-zona]').forEach(card => {
            card.addEventListener('click', () => this.showZonaDetailModal(card.dataset.zona));
        });

        const topZonas = zonas.slice(0, 10);
        if (this.charts.zona) {
            const chartData = topZonas.map(([, d]) => d.monto);
            const chartNames = topZonas.map(([name]) => name.length > 14 ? name.substring(0, 13) + '\u2026' : name);
            window.Dashboard._zonaChartNames = topZonas.map(([name]) => name);
            this.charts.zona.updateOptions({
                xaxis: { categories: chartNames },
                series: [{ data: chartData }]
            });
        }
    },

    /* ── Acumulado por Vendedor (pie chart interactivo) ── */
    _acumInit: false,
    _acumHslToHex(h, s, l) {
        s /= 100; l /= 100;
        const k = function(n) { return (n + h / 30) % 12; };
        const a = s * Math.min(l, 1 - l);
        const f = function(n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
        const r = Math.round(f(0) * 255), g = Math.round(f(8) * 255), b = Math.round(f(4) * 255);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    _getAcumColor(i) {
        const hue = (i * 137.508) % 360;
        const sat = 72 + (i % 3) * 7;
        const light = 52 + (i % 4) * 3;
        return this._acumHslToHex(hue, sat, light);
    },

    updateAcumuladoVendedor(vendedorStats) {
        const list = document.getElementById('dash-acum-list');
        const totalEl = document.getElementById('dash-acum-total-value');
        if (!list) return;

        const vendedores = Object.entries(vendedorStats)
            .filter(([name]) => name && name !== 'Sin vendedor')
            .sort((a, b) => b[1].monto - a[1].monto);

        if (!this._acumInit) {
            this.acumSelectedVendors = new Set();
            this._acumInit = true;
        }

        const renderChips = () => {
            list.innerHTML = vendedores.map(([name, d], i) => {
                const color = this._getAcumColor(i);
                const active = this.acumSelectedVendors.has(name);
                return `<div class="dash-acum-chip${active ? ' active' : ''}" data-name="${this._escapeAttr(name)}" style="--chip-color:${color};">
                    <span class="dash-acum-chip-check"></span>
                    <span class="dash-acum-chip-name">${this._escapeHtml(name.length > 20 ? name.substring(0, 19) + '\u2026' : name)}</span>
                    <span class="dash-acum-chip-amount">${this.formatMoney(d.monto)}</span>
                </div>`;
            }).join('');

            list.querySelectorAll('.dash-acum-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const name = chip.dataset.name;
                    if (this.acumSelectedVendors.has(name)) {
                        this.acumSelectedVendors.delete(name);
                    } else {
                        this.acumSelectedVendors.add(name);
                    }
                    this._refreshAcumChart(vendedorStats);
                });
            });

            this._refreshAcumChart(vendedorStats);
        };

        const setupButtons = () => {
            const selectAll = document.getElementById('dash-acum-select-all');
            const deselectAll = document.getElementById('dash-acum-deselect-all');
            if (selectAll) {
                selectAll.onclick = () => {
                    vendedores.forEach(([name]) => this.acumSelectedVendors.add(name));
                    this._refreshAcumChart(vendedorStats);
                };
            }
            if (deselectAll) {
                deselectAll.onclick = () => {
                    this.acumSelectedVendors.clear();
                    this._refreshAcumChart(vendedorStats);
                };
            }
        };

        setupButtons();
        renderChips();
    },

    _refreshAcumChart(vendedorStats) {
        const vendedores = Object.entries(vendedorStats)
            .filter(([name]) => name && name !== 'Sin vendedor')
            .sort((a, b) => b[1].monto - a[1].monto);

        const selected = vendedores.filter(([name]) => this.acumSelectedVendors.has(name));

        const totalEl = document.getElementById('dash-acum-total-value');
        const chartTotalEl = document.getElementById('dash-acum-chart-total');

        const totalAcum = selected.reduce((sum, [, d]) => sum + d.monto, 0);
        const countAcum = selected.reduce((sum, [, d]) => sum + d.count, 0);

        if (totalEl) totalEl.textContent = this.formatMoney(totalAcum);
        if (chartTotalEl) {
            chartTotalEl.innerHTML = '<span class="dash-chart-total-money">' + this._moneyFull(totalAcum) + '</span><span class="dash-chart-total-count">' + countAcum + ' entrega' + (countAcum !== 1 ? 's' : '') + '</span>';
        }

        if (this.charts.acum) {
            const series = selected.map(([, d]) => Math.round(d.monto));
            const labels = selected.map(([name]) => name);
            window.Dashboard._acumChartNames = selected.map(([name]) => name);
            const colorMap = {};
            vendedores.forEach(function(entry, idx) { colorMap[entry[0]] = this._getAcumColor(idx); }, this);
            const colors = selected.map(function(entry) { return colorMap[entry[0]]; });

            if (series.length === 0) {
                this.charts.acum.updateSeries([1]);
                this.charts.acum.updateOptions({
                    labels: ['Sin selección'],
                    colors: ['#cbd5e1'],
                    dataLabels: { enabled: false },
                    plotOptions: { pie: { expandOnClick: false } }
                });
            } else {
                this.charts.acum.updateSeries(series);
                this.charts.acum.updateOptions({
                    labels: labels,
                    colors: colors,
                    dataLabels: {
                        enabled: true,
                        formatter: (v, opts) => {
                            const total = opts.w.config.series.reduce((a, b) => a + b, 0);
                            return total > 0 ? ((opts.w.config.series[opts.seriesIndex] / total) * 100).toFixed(1) + '%' : '0%';
                        },
                        style: { fontSize: '13px', fontWeight: 700, fontFamily: 'Inter, sans-serif' },
                        dropShadow: { enabled: false }
                    },
                    legend: {
                        formatter: (name, opts) => name + ' · ' + this.formatMoney(opts.w.config.series[opts.seriesIndex] || 0)
                    },
                    plotOptions: { pie: { expandOnClick: true } }
                });
            }
        }

        const list = document.getElementById('dash-acum-list');
        if (list) {
            list.querySelectorAll('.dash-acum-chip').forEach(chip => {
                const name = chip.dataset.name;
                if (this.acumSelectedVendors.has(name)) {
                    chip.classList.add('active');
                } else {
                    chip.classList.remove('active');
                }
            });
        }
    },

/* ── Matriz vendedor×zona ── */
    updateMatriz(matriz, vendedorStats, zonaStats) {
        const thead = document.getElementById('dash-matrix-thead');
        const tbody = document.getElementById('dash-matrix-tbody');
        const badge = document.getElementById('dash-matriz-resumen');
        if (!thead || !tbody) return;

        const topVendedores = Object.entries(vendedorStats)
            .filter(([name]) => name && name !== 'Sin vendedor')
            .sort((a, b) => b[1].monto - a[1].monto)
            .slice(0, 10)
            .map(([name]) => name);
        const topZonas = Object.entries(zonaStats)
            .filter(([name]) => name && name !== 'Sin departamento')
            .sort((a, b) => b[1].monto - a[1].monto)
            .slice(0, 8)
            .map(([name]) => name);

        if (badge) badge.textContent = topVendedores.length + ' × ' + topZonas.length;

        if (topVendedores.length === 0 || topZonas.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = '<tr><td colspan="2" class="dash-empty" style="padding:2rem;text-align:center;">No hay datos suficientes para la matriz</td></tr>';
            return;
        }

        const allValues = [];
        topVendedores.forEach(v => topZonas.forEach(z => { const m = matriz[v]?.[z]?.monto || 0; if (m > 0) allValues.push(m); }));
        allValues.sort((a, b) => a - b);
        const n = allValues.length;
        const tercil1 = n > 2 ? allValues[Math.floor(n / 3)] : (allValues[0] || 0);
        const tercil2 = n > 2 ? allValues[Math.floor(2 * n / 3)] : (allValues[n - 1] || 0);

        thead.innerHTML = '<tr><th class="dash-matrix-corner">Vendedor / Dept.</th>' +
            topZonas.map(z => `<th class="dash-matrix-colheader" title="${this._escapeAttr(z)}">${this._escapeHtml(z.length > 15 ? z.substring(0, 14) + '\u2026' : z)}</th>`).join('') +
            '<th class="dash-matrix-total">Total</th></tr>';

        let totalGlobal = 0;
        tbody.innerHTML = topVendedores.map(v => {
            let rowTotal = 0;
            const cells = topZonas.map(z => {
                const cell = matriz[v]?.[z] || { monto: 0, contado: 0, credito: 0, count: 0 };
                rowTotal += cell.monto;
                const hasData = cell.monto > 0;
                let heatClass = '';
                if (hasData) {
                    if (cell.monto >= tercil2) heatClass = 'heat-high';
                    else if (cell.monto >= tercil1) heatClass = 'heat-mid';
                    else heatClass = 'heat-low';
                }
                const cellContent = hasData
                    ? `<div class="dash-matrix-amount">$${this.formatNumber(cell.monto)}</div><div class="dash-matrix-split"><span class="dash-split-contado">$${this.formatNumber(cell.contado)}</span><span class="dash-split-credito">$${this.formatNumber(cell.credito)}</span></div><div class="dash-matrix-count">${cell.count} ent.</div>`
                    : '<div class="dash-matrix-empty">—</div>';
                return `<td class="dash-matrix-cell ${hasData ? 'dash-matrix-cell-active ' + heatClass : ''}" data-vendedor="${this._escapeAttr(v)}" data-zona="${this._escapeAttr(z)}">${cellContent}</td>`;
            }).join('');
            totalGlobal += rowTotal;
            return `<tr><td class="dash-matrix-rowheader">${this._escapeHtml(v.length > 18 ? v.substring(0, 17) + '\u2026' : v)}</td>${cells}<td class="dash-matrix-row-total">$${this.formatNumber(rowTotal)}</td></tr>`;
        }).join('') + (() => {
            const totals = topZonas.map(z => { let t = 0; topVendedores.forEach(v => { t += (matriz[v]?.[z]?.monto || 0); }); return t; });
            return `<tr class="dash-matrix-total-row"><td class="dash-matrix-corner">Total</td>${totals.map(t => `<td class="dash-matrix-col-total">$${this.formatNumber(t)}</td>`).join('')}<td class="dash-matrix-grand-total">$${this.formatNumber(totalGlobal)}</td></tr>`;
        })();

        tbody.querySelectorAll('.dash-matrix-cell-active').forEach(cell => {
            cell.addEventListener('click', () => this.showVendedorZonaDetailModal(cell.dataset.vendedor, cell.dataset.zona));
        });

        // — Mobile fallback: genera cards para <480px (la tabla se oculta via CSS y se muestra .dash-matrix-cards)
        const wrap = document.querySelector('.dash-matrix-wrap');
        let cardsWrap = document.querySelector('.dash-matrix-cards');
        if (!cardsWrap && wrap) {
            cardsWrap = document.createElement('div');
            cardsWrap.className = 'dash-matrix-cards';
            wrap.parentNode.insertBefore(cardsWrap, wrap.nextSibling);
        }
        if (cardsWrap) {
            // Solo los top 6 combos con monto para no saturar móvil
            const combos = [];
            topVendedores.forEach(v => topZonas.forEach(z => {
                const cell = matriz[v]?.[z];
                if (cell && cell.monto > 0) combos.push({ v, z, d: cell });
            }));
            combos.sort((a,b) => b.d.monto - a.d.monto);
            const topCombos = combos.slice(0, 8);
            if (topCombos.length === 0) {
                cardsWrap.innerHTML = '<div class="dash-empty" style="padding:1.2rem;text-align:center;opacity:0.6;">Sin combinaciones en este rango</div>';
            } else {
                cardsWrap.innerHTML = topCombos.map(({v,z,d}) => `
                    <div class="dash-matrix-card" data-vendedor="${this._escapeAttr(v)}" data-zona="${this._escapeAttr(z)}">
                        <div class="dash-matrix-card-head">
                            <span class="dash-matrix-card-vendedor">${this._escapeHtml(v.length>18?v.substring(0,17)+'…':v)}</span>
                            <span class="dash-matrix-card-total">${this.formatMoney(d.monto)}</span>
                        </div>
                        <div class="dash-matrix-card-depto">${this._escapeHtml(z)}</div>
                        <div class="dash-matrix-card-chips">
                            <div class="dash-matrix-chip dash-chip-contado">
                                <span class="dash-matrix-chip-dot"></span>
                                <span class="dash-matrix-chip-label">Contado</span>
                                <span class="dash-matrix-chip-value">${this.formatMoney(d.contado)}</span>
                            </div>
                            <div class="dash-matrix-chip dash-chip-credito">
                                <span class="dash-matrix-chip-dot"></span>
                                <span class="dash-matrix-chip-label">Crédito</span>
                                <span class="dash-matrix-chip-value">${this.formatMoney(d.credito)}</span>
                            </div>
                        </div>
                        <div class="dash-matrix-card-count">${d.count} entrega${d.count !== 1 ? 's' : ''}</div>
                    </div>
                `).join('');
                cardsWrap.querySelectorAll('.dash-matrix-card').forEach(c => {
                    c.addEventListener('click', () => this.showVendedorZonaDetailModal(c.dataset.vendedor, c.dataset.zona));
                    c.style.cursor = 'pointer';
                });
            }
        }
        // Marca contenedores scrollables para hint visual
        requestAnimationFrame(() => this._fitKpiValues());
    },

    /* ── Escape helpers ── */
    _escapeHtml(s) {
        if (s == null) return '';
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    },
    _escapeAttr(s) {
        return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    /* ── Detail modal: Vendedor ── */
    showVendedorDetailModal(vendedorName) {
        const filtered = this.records.filter(r => {
            const v = (r.vendedor || '').trim();
            return v && (v === vendedorName || (v === 'Sin vendedor' && vendedorName === 'Sin vendedor'));
        });
        this._renderDetailModal(filtered, 'Vendedor: ' + vendedorName, '#6d28d9');
    },

    /* ── Detail modal: Zona ── */
    showZonaDetailModal(zonaName) {
        const filtered = this.records.filter(r => {
            const z = (r.departamento || r.zona || '').trim();
            return z && (z === zonaName || (z === 'Sin departamento' && zonaName === 'Sin departamento'));
        });
        this._renderDetailModal(filtered, 'Departamento: ' + zonaName, '#0369a1');
    },

    /* ── Detail modal: Vendedor×Zona ── */
    showVendedorZonaDetailModal(vendedorName, zonaName) {
        const filtered = this.records.filter(r => {
            const v = (r.vendedor || '').trim();
            const z = (r.departamento || r.zona || '').trim();
            const matchV = v === vendedorName || (v === '' && vendedorName === 'Sin vendedor');
            const matchZ = z === zonaName || (z === '' && zonaName === 'Sin departamento');
            return matchV && matchZ;
        });
        this._renderDetailModal(filtered, vendedorName + ' · ' + zonaName, '#7c3aed');
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
            'XPRESS': { cls: 'dash-carrier-avatar-xpress' },
            'INCEDE': { cls: 'dash-carrier-avatar-incede' }
        };

        container.innerHTML = carriers.map(([name, d], index) => {
            const c = cfg[name] || { cls: 'dash-carrier-avatar-default' };
            const pct = totalMonto > 0 ? ((d.monto / totalMonto) * 100).toFixed(1) : 0;
            const ctPct = d.monto > 0 ? (d.contado / d.monto) * 100 : 0;
            const crPct = d.monto > 0 ? (d.credito / d.monto) * 100 : 0;
            const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `<span class="dash-rank-num">${index + 1}</span>`;
            return `<div class="dash-carrier-card" data-carrier="${this._escapeAttr(name)}" style="${index >= 5 && !this._rankState.carrier ? 'display:none;' : ''}">
                <div class="dash-carrier-top">
                    <div class="dash-carrier-rank">${medal}</div>
                    <div class="dash-carrier-avatar ${c.cls}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                    </div>
                    <div class="dash-carrier-body">
                        <div class="dash-carrier-name">${this._escapeHtml(name)}</div>
                        <div class="dash-carrier-amount">${this.formatMoney(d.monto)}</div>
                        <div class="dash-carrier-meta">${d.count} entrega${d.count !== 1 ? 's' : ''} · ${pct}% ${this._rankDeltaHtml(name, 'carrier')}</div>
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
        if (!container.dataset.bound) {
            container.dataset.bound = '1';
            container.addEventListener('click', e => {
                const card = e.target.closest('[data-carrier]');
                if (card) this.showCarrierDetailModal(card.dataset.carrier);
            });
        }
    },

    /* ── Daily table (legacy, fusionada en day-cards) ── */
    updateDailyTable(dailyStats) {
        return;
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

        const bestKey = [...days].sort((a, b) => b[1].total - a[1].total)[0]?.[0];
        container.innerHTML = days.map(([key, d]) => {
            const ctPct = d.total > 0 ? (d.contado / d.total) * 100 : 0;
            const crPct = d.total > 0 ? (d.credito / d.total) * 100 : 0;
            const isBest = key === bestKey && days.length > 1;
            const best = isBest ? '<span class="dash-day-best">Mejor día</span>' : '';
            return `<div class="dash-day-card${isBest ? ' dash-day-best-card' : ''}">
                <div class="dash-day-card-top">
                    <div class="dash-day-badge">
                        <span class="dash-day-badge-day">${key.split('-')[2]}</span>
                        <span class="dash-day-badge-month">${this.formatMonthShort(parseInt(key.split('-')[1]) - 1)}</span>
                    </div>
                    <div class="dash-day-info">
                        <div class="dash-day-label">${d.label} ${best}</div>
                        <div class="dash-day-total">${d.totalCount} entregas</div>
                    </div>
                    <div class="dash-day-total-main">${this.formatMoney(d.total)}</div>
                </div>
                <div class="dash-day-bar">
                    <div class="dash-day-bar-contado" style="width:${ctPct}%"></div>
                    <div class="dash-day-bar-credito" style="width:${crPct}%"></div>
                </div>
                <div class="dash-day-stats">
                    <div class="dash-day-stat dash-stat-contado">
                        <span class="dash-day-stat-label"><span class="dash-legend-dot dash-legend-dot-contado"></span>Contado</span>
                        <span class="dash-day-stat-amount">${this.formatMoney(d.contado)}</span>
                        <span class="dash-day-stat-count">${d.contadoCount} entregas · ${Math.round(ctPct)}%</span>
                    </div>
                    <div class="dash-day-stat dash-stat-credito">
                        <span class="dash-day-stat-label"><span class="dash-legend-dot dash-legend-dot-credito"></span>Crédito</span>
                        <span class="dash-day-stat-amount">${this.formatMoney(d.credito)}</span>
                        <span class="dash-day-stat-count">${d.creditoCount} entregas · ${Math.round(crPct)}%</span>
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
            else if (type === 'contado') { match = (cond === 'contado'); title = 'Contado'; color = '#047857'; }
            else if (type === 'credito') { match = (cond === 'credito' || cond === 'crédito'); title = 'Crédito'; color = '#b45309'; }
            else if (type === 'dalse') { match = ((r.empresa || '').toUpperCase().trim() === 'DALSE'); title = 'Dalse'; color = '#0e7490'; }

            if (match) filtered.push(r);
        });

        this._renderDetailModal(filtered, title, color);
    },

    /* ── Detail Modal: Incede ── */
    showIncedeDetailModal() {
        const filtered = this.records.filter(r => (r.empresa || '').toUpperCase().trim() === 'INCEDE');
        this._renderDetailModal(filtered, 'Incede', '#be123c');
    },

    /* ── Detail Modal for carrier bars ── */
    showCarrierDetailModal(carrierName) {
        const filtered = this.records.filter(r => (r.entrega || '').toUpperCase().trim() === carrierName);
        const title = carrierName;
        const colors = { DALSE: '#7c3aed', INTERLOGISTIC: '#1d4ed8', XPRESS: '#be185d', INCEDE: '#be123c' };
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

        const formatDtInput = (d) => formatDateForInput(d);

        filtered.sort((a, b) => {
            const fa = a.fecha ? a.fecha.toDate() : new Date(0);
            const fb = b.fecha ? b.fecha.toDate() : new Date(0);
            return fb - fa;
        });

        const total = filtered.reduce((sum, r) => sum + signedAmount(r, 'venta'), 0);
        const avg = filtered.length > 0 ? total / filtered.length : 0;
        const maxVenta = filtered.reduce((mx, r) => Math.max(mx, Math.abs(signedAmount(r, 'venta')) || 0), 0);

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
                    <td class="dash-modal-amount">${this.formatMoney(signedAmount(r, 'venta'))}</td>
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
            'Venta': signedAmount(r, 'venta'),
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

        if (typeof XLSX === 'undefined') { showToast('Excel no disponible (sin conexión al CDN)', 'error'); return; }
        try {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(rows);

            const colWidths = Object.keys(rows[0] || {}).map(k => ({
                wch: Math.max(k.length, ...rows.map(r => String(r[k] || '').length)) + 2
            }));
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, 'Detalle');

            const fechaStr = formatDateForInput(this.fechaInicio);
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
        clone.querySelectorAll('.dash-tabpanel').forEach(panel => {
            panel.hidden = false;
            panel.style.display = 'block';
        });
        clone.querySelectorAll('.dash-tabs, .dash-float-pill, .dash-acum-toolbar').forEach(node => node.remove());
        clone.querySelectorAll('[style*="display:none"], [style*="display: none"]').forEach(node => {
            if (node.classList.contains('dash-vendedor-card') || node.classList.contains('dash-zona-card') || node.classList.contains('dash-carrier-card')) node.style.display = '';
        });

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
            filename: `dashboard-ventas-${formatDateForInput(this.fechaInicio)}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: 800,
                onclone: (doc) => {
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

    /* Helper: actualiza el badge de total de un chart */
    _setChartTotal(elementId, total, count) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const money = this._moneyFull(total);
        if (count && count > 0) {
            el.innerHTML = '<span class="dash-chart-total-money">' + money + '</span><span class="dash-chart-total-count">' + count + ' entrega' + (count !== 1 ? 's' : '') + '</span>';
        } else {
            el.innerHTML = '<span class="dash-chart-total-money">' + money + '</span>';
        }
    },

    _moneyFull(v) {
        const n = Number(v) || 0;
        if (n < 0) return '-$' + Math.abs(n).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return '$' + n.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },
    formatMoney(amount) {
        return this._moneyFull(amount);
    },

    formatNumber(num) {
        return (Number(num) || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    /* ── Helpers: ajustar tipografía de KPI si el monto es largo ── */
    _fitKpiValues() {
        if (window.innerWidth > 768) return;
        document.querySelectorAll('.dash-kpi-value').forEach(el => {
            const len = (el.textContent || '').length;
            el.setAttribute('data-long', len > 11 ? 'true' : 'false');
        });
        // Scroll hint: marca contenedores que realmente pueden hacer scroll
        requestAnimationFrame(() => {
            document.querySelectorAll('.dash-matrix-wrap, .dash-table-wrap, .dash-table-card-wrap').forEach(w => {
                const canScroll = w.scrollWidth > w.clientWidth + 4;
                w.classList.toggle('is-scrollable', canScroll);
            });
        });
    },

    /* ── Cleanup ── */
    destroy() {
        this._renderToken = null;
        this._prevRequestKey = null;
        if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
        if (this.themeObserver) { this.themeObserver.disconnect(); this.themeObserver = null; }
        if (this._dashRO) { try{ this._dashRO.disconnect(); }catch(e){} this._dashRO = null; }
        if (this._pillIO) { try{ this._pillIO.disconnect(); }catch(e){} this._pillIO = null; }
        if (this._handleChartResize) {
            window.removeEventListener('orientationchange', this._handleChartResize);
            window.removeEventListener('resize', this._handleChartResize);
            this._handleChartResize = null;
        }
        Object.values(this.charts).forEach(c => { if (c && typeof c.destroy === 'function') c.destroy(); });
        this.charts = {};
        this.chartInit = false;
        this._acumInit = false;
        this.acumSelectedVendors = new Set();
        this.records = [];
        this.prevRecords = [];
        window.Dashboard._vendedorChartNames = null;
        window.Dashboard._zonaChartNames = null;
        window.Dashboard.barTotal = 0;
    }
};

window.Dashboard = Dashboard;
