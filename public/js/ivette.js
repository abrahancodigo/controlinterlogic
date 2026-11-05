// ===================================
// Inventario Ivette Module
// ===================================

const Ivette = {
    records: [],
    unsubscribe: null,
    editingId: null,
    _truncated: false,
    _formTipo: 'ingreso',
    _listenerAdded: false,
    _mobileListenerAdded: false,
    _movSearch: '',
    _movTipo: 'todos',
    _invSearch: '',
    _invFilter: 'todos',
    _invVisible: false,
    _invSelected: '',
    _invProdQuery: '',

    async render() {
        if (window.innerWidth <= 768) return this.renderMobile();
        return this.renderDesktop();
    },

    async renderDesktop() {
        const contentArea = document.getElementById('content-area');
        const canCreate = window.permissions?.canCreate;
        this._listenerAdded = false;

        contentArea.innerHTML = `
            ${SharedComponents.renderModuleHeader({
                icon: 'ivette',
                title: 'Inventario Ivette',
                subtitle: 'Productos impresos · entradas y salidas',
                actions: `
                    <button id="btn-ivette-nuevo" class="btn btn-primary btn-lg ${!canCreate ? 'btn-disabled' : ''}" ${!canCreate ? 'disabled' : ''}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Registrar movimiento
                    </button>
                    <button id="btn-ivette-export" class="btn btn-secondary btn-lg">📥 Excel</button>
                `
            })}

            <div class="ivette-stats" id="ivette-stats">
                <div class="stat-card iv-stat iv-stat--hero">
                    <div class="iv-stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
                    <div class="iv-stat-body">
                        <span class="stat-label">En inventario</span>
                        <span class="stat-value" id="ivette-existencia">0</span>
                        <span class="iv-stat-hint">Suma de existencias</span>
                    </div>
                </div>
                <div class="stat-card iv-stat">
                    <div class="iv-stat-icon iv-stat-icon--soft"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div>
                    <div class="iv-stat-body">
                        <span class="stat-label">Productos</span>
                        <span class="stat-value" id="ivette-productos">0</span>
                        <span class="iv-stat-hint">Distintos en historial</span>
                    </div>
                </div>
                <div class="stat-card iv-stat iv-stat--warn">
                    <div class="iv-stat-icon iv-stat-icon--warn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                    <div class="iv-stat-body">
                        <span class="stat-label">Por reponer</span>
                        <span class="stat-value stat-value-out" id="ivette-faltantes">0</span>
                        <span class="iv-stat-hint">Existencia negativa</span>
                    </div>
                </div>
            </div>

            <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
                <button id="btn-ivette-toggle-inv" class="btn btn-secondary" style="border-radius:10px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
                    Inventario por producto
                    <span id="iv-toggle-chevron" style="margin-left:4px;">▾</span>
                </button>
                <span class="ivette-panel-count" id="ivette-inv-quick-count" style="display:none;"></span>
            </div>

            <div id="ivette-inv-wrapper" style="display:${this._invVisible ? 'block' : 'none'};">
                <div class="ivette-panel" id="ivette-inventario-panel">
                    <div class="ivette-panel-head">
                        <div>
                            <h2>Inventario por producto — Cardex</h2>
                            <p>Cardex por fecha · entradas / salidas / saldo. Filtra por producto arriba.</p>
                        </div>
                        <span class="ivette-panel-count" id="ivette-inv-count"></span>
                    </div>
                    <div class="ivette-toolbar" style="flex-direction:column;align-items:stretch;gap:10px;">
                        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                            <div class="iv-combo" id="ivette-prod-combo">
                                <button type="button" class="iv-combo-trigger" id="ivette-prod-trigger">
                                    <span id="ivette-prod-label">Todos los productos</span>
                                    <span class="iv-combo-chevron">▾</span>
                                </button>
                                <div class="iv-combo-panel" id="ivette-prod-panel" style="display:none;">
                                    <div class="iv-combo-search">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                        <input type="text" id="ivette-prod-search" placeholder="Buscar producto..." autocomplete="off">
                                    </div>
                                    <div class="iv-combo-list" id="ivette-prod-list"></div>
                                </div>
                            </div>
                            <div class="ivette-search" style="flex:1 1 220px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="ivette-inv-search" placeholder="Filtrar por nombre..." autocomplete="off">
                            </div>
                            <button class="btn btn-ghost btn-sm" id="ivette-inv-clear" style="display:none;">✕ Limpiar</button>
                        </div>
                        <div class="ivette-pills" id="ivette-inv-pills">
                            <button class="iv-pill active" data-filter="todos">Todos</button>
                            <button class="iv-pill" data-filter="disponible">Disponibles</button>
                            <button class="iv-pill iv-pill--warn" data-filter="faltante">Por reponer</button>
                        </div>
                    </div>
                    <div id="ivette-inventario-container"></div>
                </div>
            </div>

            <div class="ivette-panel" id="ivette-mov-panel">
                <div class="ivette-panel-head">
                    <div>
                        <h2>Movimientos</h2>
                        <p>Historial de entradas y salidas</p>
                    </div>
                    <span class="ivette-panel-count" id="ivette-mov-count"></span>
                </div>
                <div class="ivette-toolbar">
                    <div class="ivette-search">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="ivette-mov-search" placeholder="Buscar por correlativo, producto, observación o usuario..." autocomplete="off">
                    </div>
                    <div class="ivette-pills" id="ivette-mov-pills">
                        <button class="iv-pill active" data-tipo="todos">Todos</button>
                        <button class="iv-pill" data-tipo="ingreso">Entradas</button>
                        <button class="iv-pill" data-tipo="salida">Salidas</button>
                    </div>
                </div>
                <div class="tarimas-table-container" id="ivette-table-container" style="border:none;border-radius:0;box-shadow:none;">
                    <div class="tarimas-loading">
                        <div class="spinner-ring"><div class="loading-progress-bar"><div class="loading-progress-fill"></div></div><div class="loading-progress-pct">0%</div></div>
                        <p>Cargando movimientos...</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-ivette-nuevo').addEventListener('click', () => {
            if (canCreate) this.showForm('ingreso');
        });
        document.getElementById('btn-ivette-export').addEventListener('click', () => this.exportExcel());
        document.getElementById('btn-ivette-toggle-inv').addEventListener('click', () => this.toggleInventario());

        const invSearch = document.getElementById('ivette-inv-search');
        if (invSearch) {
            invSearch.value = this._invSearch;
            invSearch.addEventListener('input', () => {
                this._invSearch = invSearch.value.trim().toLowerCase();
                this.renderInventario();
            });
        }
        document.getElementById('ivette-inv-pills')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.iv-pill');
            if (!btn) return;
            this._invFilter = btn.dataset.filter || 'todos';
            document.querySelectorAll('#ivette-inv-pills .iv-pill').forEach(b => b.classList.toggle('active', b === btn));
            this.renderInventario();
        });
        document.getElementById('ivette-inv-clear')?.addEventListener('click', () => {
            this._invSelected = '';
            this._invProdQuery = '';
            this._invSearch = '';
            const s1 = document.getElementById('ivette-inv-search');
            const s2 = document.getElementById('ivette-prod-search');
            if (s1) s1.value = '';
            if (s2) s2.value = '';
            this._renderProdComboList();
            this._syncProdLabel();
            this.renderInventario();
        });

        this._bindProdCombo();

        const movSearch = document.getElementById('ivette-mov-search');
        if (movSearch) {
            movSearch.value = this._movSearch;
            movSearch.addEventListener('input', () => {
                this._movSearch = movSearch.value.trim().toLowerCase();
                this.renderTable();
            });
        }
        document.getElementById('ivette-mov-pills')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.iv-pill');
            if (!btn) return;
            this._movTipo = btn.dataset.tipo || 'todos';
            document.querySelectorAll('#ivette-mov-pills .iv-pill').forEach(b => b.classList.toggle('active', b === btn));
            this.renderTable();
        });

        if (window.animateProgressPct) {
            const pctEl = document.querySelector('#ivette-table-container .loading-progress-pct');
            if (pctEl) window.animateProgressPct(pctEl);
        }

        await this.loadMovimientos();

        const container = document.getElementById('ivette-table-container');
        if (container && !this._listenerAdded) {
            container.addEventListener('click', (e) => {
                const printBtn = e.target.closest('.iv-btn-print');
                if (printBtn) {
                    const id = printBtn.getAttribute('data-id');
                    if (id) this.showPrintPreview(id);
                    return;
                }
                const editBtn = e.target.closest('.tarima-btn-edit');
                if (editBtn && !editBtn.disabled) {
                    const id = editBtn.getAttribute('data-id');
                    if (id) this.showEditForm(id);
                    return;
                }
                const deleteBtn = e.target.closest('.tarima-btn-delete');
                if (deleteBtn && !deleteBtn.disabled) {
                    const id = deleteBtn.getAttribute('data-id');
                    if (id) this.deleteMovimiento(id);
                    return;
                }
            });
            this._listenerAdded = true;
        }
        this._bindObsPreview(container);
        this._renderProdComboList();
        this._syncProdLabel();
    },

    toggleInventario() {
        this._invVisible = !this._invVisible;
        const wrap = document.getElementById('ivette-inv-wrapper');
        const chev = document.getElementById('iv-toggle-chevron');
        if (wrap) wrap.style.display = this._invVisible ? 'block' : 'none';
        if (chev) chev.textContent = this._invVisible ? '▴' : '▾';
        if (this._invVisible) { this._renderProdComboList(); this.renderInventario(); }
    },

    _bindProdCombo() {
        const trigger = document.getElementById('ivette-prod-trigger');
        const panel = document.getElementById('ivette-prod-panel');
        const search = document.getElementById('ivette-prod-search');
        const combo = document.getElementById('ivette-prod-combo');
        if (!trigger || !panel || !combo) return;
        if (combo.dataset.bound) return;
        combo.dataset.bound = '1';
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = panel.style.display !== 'none';
            panel.style.display = open ? 'none' : 'block';
            if (!open && search) { search.focus(); search.select(); }
        });
        if (search) {
            search.addEventListener('input', () => {
                this._invProdQuery = search.value.trim().toLowerCase();
                this._renderProdComboList();
            });
            search.addEventListener('click', (e) => e.stopPropagation());
        }
        document.getElementById('ivette-prod-list')?.addEventListener('click', (e) => {
            const item = e.target.closest('[data-prod-value]');
            if (!item) return;
            const val = item.getAttribute('data-prod-value') || '';
            this._setInvSelected(val);
            panel.style.display = 'none';
        });
        document.addEventListener('click', (e) => {
            if (!combo.contains(e.target)) panel.style.display = 'none';
        });
    },

    _syncProdLabel() {
        const label = document.getElementById('ivette-prod-label');
        const clearBtn = document.getElementById('ivette-inv-clear');
        if (label) label.textContent = this._invSelected ? this._invSelected : 'Todos los productos';
        if (clearBtn) clearBtn.style.display = this._invSelected || this._invSearch ? '' : 'none';
    },

    _renderProdComboList() {
        const list = document.getElementById('ivette-prod-list');
        if (!list) return;
        const all = this._getAllProductos();
        const q = (this._invProdQuery || '').trim().toLowerCase();
        const filtered = q ? all.filter(p => p.toLowerCase().includes(q)) : all;
        const statsMap = {};
        this._productStats(false).forEach(s => { statsMap[s.producto] = s; });
        const html = [];
        html.push(`<button type="button" class="iv-combo-item ${!this._invSelected ? 'active' : ''}" data-prod-value="">Todos los productos <span style="color:#64748b;font-weight:600;margin-left:auto;">${all.length}</span></button>`);
        filtered.forEach(p => {
            const s = statsMap[p];
            const badge = s ? (s.existencia < 0 ? `<span class="iv-badge iv-badge--warn" style="margin-left:auto;">${formatNumber(s.existencia)}</span>` : `<span class="iv-badge iv-badge--ok" style="margin-left:auto;">${formatNumber(s.existencia)}</span>`) : '';
            html.push(`<button type="button" class="iv-combo-item ${this._invSelected === p ? 'active' : ''}" data-prod-value="${sanitizeHTML(p)}"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:left;">${sanitizeHTML(p)}</span>${badge}</button>`);
        });
        if (!filtered.length) html.push('<div style="padding:12px;text-align:center;color:#94a3b8;font-size:0.8rem;">Sin resultados</div>');
        list.innerHTML = html.join('');
    },

    _setInvSelected(val) {
        this._invSelected = val || '';
        this._syncProdLabel();
        this._renderProdComboList();
        this.renderInventario();
    },

    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        const canCreate = window.permissions?.canCreate;
        this._mobileListenerAdded = false;

        contentArea.innerHTML = `
            <div style="padding:0 0 8px 0;">
                <h1 style="font-size:1.35rem;font-weight:800;margin-bottom:2px;color:var(--m-text);">📦 Inventario Ivette</h1>
                <p style="font-size:0.78rem;color:var(--m-text-secondary);">Productos impresos · entradas y salidas</p>
            </div>
            <div class="m-actions-bar">
                <button class="btn btn-primary" id="m-ivette-nuevo" ${!canCreate ? 'disabled' : ''} style="border-radius:20px;flex:1;">＋ Movimiento</button>
            </div>
            <div class="ivette-stats ivette-stats--mobile" id="ivette-stats" style="margin:8px 0;">
                <div class="stat-card iv-stat iv-stat--hero" style="padding:12px;">
                    <div class="iv-stat-body">
                        <span class="stat-label" style="font-size:0.65rem;">En inventario</span>
                        <span class="stat-value" id="ivette-existencia" style="font-size:1.3rem;">0</span>
                    </div>
                </div>
                <div class="stat-card iv-stat" style="padding:12px;">
                    <div class="iv-stat-body">
                        <span class="stat-label" style="font-size:0.65rem;">Productos</span>
                        <span class="stat-value" id="ivette-productos" style="font-size:1.3rem;">0</span>
                    </div>
                </div>
                <div class="stat-card iv-stat iv-stat--warn" style="padding:12px;">
                    <div class="iv-stat-body">
                        <span class="stat-label" style="font-size:0.65rem;">Por reponer</span>
                        <span class="stat-value stat-value-out" id="ivette-faltantes" style="font-size:1.3rem;">0</span>
                    </div>
                </div>
            </div>

            <button id="m-ivette-toggle-inv" class="btn btn-secondary" style="width:100%;border-radius:10px;margin-bottom:8px;">
                📦 Inventario por producto <span id="m-iv-toggle-chevron">▾</span>
            </button>
            <div id="m-ivette-inv-wrapper" style="display:${this._invVisible ? 'block' : 'none'};">
                <div class="ivette-panel" style="margin-bottom:12px;">
                    <div class="ivette-panel-head" style="padding:12px;">
                        <div><h2 style="font-size:0.95rem;">Inventario — Cardex</h2><p style="font-size:0.72rem;">Filtra por producto arriba</p></div>
                        <span class="ivette-panel-count" id="m-ivette-inv-count"></span>
                    </div>
                    <div class="ivette-toolbar" style="padding:10px 12px;flex-direction:column;align-items:stretch;gap:8px;">
                        <div class="iv-combo" id="m-ivette-prod-combo">
                            <button type="button" class="iv-combo-trigger" id="m-ivette-prod-trigger">
                                <span id="m-ivette-prod-label">Todos los productos</span>
                                <span class="iv-combo-chevron">▾</span>
                            </button>
                            <div class="iv-combo-panel" id="m-ivette-prod-panel" style="display:none;">
                                <div class="iv-combo-search">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                    <input type="text" id="m-ivette-prod-search" placeholder="Buscar producto...">
                                </div>
                                <div class="iv-combo-list" id="m-ivette-prod-list"></div>
                            </div>
                        </div>
                        <div class="ivette-search" style="flex:1;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="m-ivette-inv-search" placeholder="Filtrar por nombre...">
                        </div>
                        <div class="ivette-pills" id="m-ivette-inv-pills" style="padding:0 0 2px;">
                            <button class="iv-pill active" data-filter="todos">Todos</button>
                            <button class="iv-pill" data-filter="disponible">Disponibles</button>
                            <button class="iv-pill iv-pill--warn" data-filter="faltante">Por reponer</button>
                        </div>
                    </div>
                    <div id="m-ivette-inventario" style="padding:0 12px 12px;"></div>
                </div>
            </div>

            <div class="ivette-panel">
                <div class="ivette-panel-head" style="padding:12px;">
                    <div><h2 style="font-size:0.95rem;">Movimientos</h2><p style="font-size:0.72rem;">Historial reciente</p></div>
                    <span class="ivette-panel-count" id="m-ivette-mov-count"></span>
                </div>
                <div class="ivette-toolbar" style="padding:10px 12px;">
                    <div class="ivette-search" style="flex:1;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="m-ivette-mov-search" placeholder="Buscar...">
                    </div>
                </div>
                <div class="ivette-pills" id="m-ivette-mov-pills" style="padding:0 12px 10px;">
                    <button class="iv-pill active" data-tipo="todos">Todos</button>
                    <button class="iv-pill" data-tipo="ingreso">Entradas</button>
                    <button class="iv-pill" data-tipo="salida">Salidas</button>
                </div>
                <div id="m-ivette-list" class="m-data-list" style="padding:0 12px 12px;">
                    <div style="text-align:center;padding:24px;color:#8e8e93;">
                        <div class="spinner-ring" style="margin:0 auto 12px;width:160px;"><div class="loading-progress-bar"><div class="loading-progress-fill"></div></div><div class="loading-progress-pct">0%</div></div>
                        <p>Cargando...</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('m-ivette-nuevo').addEventListener('click', () => {
            if (canCreate) this.showForm('ingreso');
        });
        document.getElementById('m-ivette-toggle-inv').addEventListener('click', () => {
            this._invVisible = !this._invVisible;
            const wrap = document.getElementById('m-ivette-inv-wrapper');
            const chev = document.getElementById('m-iv-toggle-chevron');
            if (wrap) wrap.style.display = this._invVisible ? 'block' : 'none';
            if (chev) chev.textContent = this._invVisible ? '▴' : '▾';
            const deskChev = document.getElementById('iv-toggle-chevron');
            if (deskChev) deskChev.textContent = this._invVisible ? '▴' : '▾';
            if (this._invVisible) { this._bindProdComboMobile(); this._renderProdComboListMobile(); this.renderInventario(); }
        });

        const mInvSearch = document.getElementById('m-ivette-inv-search');
        if (mInvSearch) {
            mInvSearch.value = this._invSearch;
            mInvSearch.addEventListener('input', () => {
                this._invSearch = mInvSearch.value.trim().toLowerCase();
                const d = document.getElementById('ivette-inv-search');
                if (d) d.value = mInvSearch.value;
                this.renderInventario();
                this._syncProdLabel(); this._syncProdLabelMobile();
            });
        }
        document.getElementById('m-ivette-inv-pills')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.iv-pill');
            if (!btn) return;
            this._invFilter = btn.dataset.filter || 'todos';
            document.querySelectorAll('#m-ivette-inv-pills .iv-pill').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('#ivette-inv-pills .iv-pill').forEach(b => b.classList.toggle('active', b.dataset.filter === this._invFilter));
            this.renderInventario();
        });
        this._bindProdComboMobile();

        const mMovSearch = document.getElementById('m-ivette-mov-search');
        if (mMovSearch) {
            mMovSearch.value = this._movSearch;
            mMovSearch.addEventListener('input', () => {
                this._movSearch = mMovSearch.value.trim().toLowerCase();
                const d = document.getElementById('ivette-mov-search');
                if (d) d.value = mMovSearch.value;
                this.renderTable();
            });
        }
        document.getElementById('m-ivette-mov-pills')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.iv-pill');
            if (!btn) return;
            this._movTipo = btn.dataset.tipo || 'todos';
            document.querySelectorAll('#m-ivette-mov-pills .iv-pill').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('#ivette-mov-pills .iv-pill').forEach(b => b.classList.toggle('active', b.dataset.tipo === this._movTipo));
            this.renderTable();
        });

        if (window.animateProgressPct) {
            const pctEl = document.querySelector('#m-ivette-list .loading-progress-pct');
            if (pctEl) window.animateProgressPct(pctEl);
        }

        await this.loadMovimientos();

        const mList = document.getElementById('m-ivette-list');
        if (mList && !this._mobileListenerAdded) {
            mList.addEventListener('click', (e) => {
                const printBtn = e.target.closest('.iv-btn-print');
                if (printBtn) {
                    const id = printBtn.getAttribute('data-id');
                    if (id) this.showPrintPreview(id);
                    return;
                }
                const editBtn = e.target.closest('.tarima-btn-edit');
                if (editBtn) {
                    const id = editBtn.getAttribute('data-id');
                    if (id) this.showEditForm(id);
                    return;
                }
                const deleteBtn = e.target.closest('.tarima-btn-delete');
                if (deleteBtn) {
                    const id = deleteBtn.getAttribute('data-id');
                    if (id) this.deleteMovimiento(id);
                    return;
                }
            });
            this._mobileListenerAdded = true;
        }
        this._renderProdComboListMobile();
        this._syncProdLabelMobile();
    },

    _bindProdComboMobile() {
        const trigger = document.getElementById('m-ivette-prod-trigger');
        const panel = document.getElementById('m-ivette-prod-panel');
        const search = document.getElementById('m-ivette-prod-search');
        const combo = document.getElementById('m-ivette-prod-combo');
        if (!trigger || !panel || !combo) return;
        if (combo.dataset.bound) return;
        combo.dataset.bound = '1';
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = panel.style.display !== 'none';
            panel.style.display = open ? 'none' : 'block';
            if (!open && search) { search.focus(); search.select(); }
        });
        if (search) {
            search.addEventListener('input', () => {
                this._invProdQuery = search.value.trim().toLowerCase();
                const d = document.getElementById('ivette-prod-search');
                if (d) d.value = search.value;
                this._renderProdComboList(); this._renderProdComboListMobile();
            });
            search.addEventListener('click', (e) => e.stopPropagation());
        }
        document.getElementById('m-ivette-prod-list')?.addEventListener('click', (e) => {
            const item = e.target.closest('[data-prod-value]');
            if (!item) return;
            const val = item.getAttribute('data-prod-value') || '';
            this._setInvSelected(val);
            this._syncProdLabelMobile();
            panel.style.display = 'none';
            const dPanel = document.getElementById('ivette-prod-panel');
            if (dPanel) dPanel.style.display = 'none';
        });
        document.addEventListener('click', (e) => {
            if (!combo.contains(e.target)) panel.style.display = 'none';
        });
    },

    _renderProdComboListMobile() {
        const list = document.getElementById('m-ivette-prod-list');
        if (!list) return;
        const all = this._getAllProductos();
        const q = (this._invProdQuery || '').trim().toLowerCase();
        const filtered = q ? all.filter(p => p.toLowerCase().includes(q)) : all;
        const statsMap = {};
        this._productStats(false).forEach(s => { statsMap[s.producto] = s; });
        const html = [];
        html.push(`<button type="button" class="iv-combo-item ${!this._invSelected ? 'active' : ''}" data-prod-value="">Todos los productos <span style="color:#64748b;font-weight:600;margin-left:auto;">${all.length}</span></button>`);
        filtered.forEach(p => {
            const s = statsMap[p];
            const badge = s ? (s.existencia < 0 ? `<span class="iv-badge iv-badge--warn" style="margin-left:auto;">${formatNumber(s.existencia)}</span>` : `<span class="iv-badge iv-badge--ok" style="margin-left:auto;">${formatNumber(s.existencia)}</span>`) : '';
            html.push(`<button type="button" class="iv-combo-item ${this._invSelected === p ? 'active' : ''}" data-prod-value="${sanitizeHTML(p)}"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:left;">${sanitizeHTML(p)}</span>${badge}</button>`);
        });
        if (!filtered.length) html.push('<div style="padding:12px;text-align:center;color:#94a3b8;font-size:0.8rem;">Sin resultados</div>');
        list.innerHTML = html.join('');
    },

    _syncProdLabelMobile() {
        const label = document.getElementById('m-ivette-prod-label');
        if (label) label.textContent = this._invSelected ? this._invSelected : 'Todos los productos';
        this._syncProdLabel();
    },

    async loadMovimientos() {
        if (this.unsubscribe) this.unsubscribe();

        const db = firebase.firestore();
        this.unsubscribe = db.collection('ivette_movimientos')
            .orderBy('fecha', 'desc')
            .limit(500)
            .onSnapshot(snapshot => {
                this.records = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this._truncated = snapshot.size >= 500;
                this.renderStats();
                if (this._invVisible) this.renderInventario();
                else this._updateInvQuickCount();
                this.renderTable();
                this._renderProdComboList();
                this._renderProdComboListMobile();
                this._syncProdLabel(); this._syncProdLabelMobile();
                if (this._truncated) this._completarStatsHistoricas();
            }, error => {
                console.error('Error loading ivette:', error);
                showToast('Error al cargar movimientos: ' + error.message, 'error');
            });
    },

    async _completarStatsHistoricas() {
        try {
            const snapshot = await firebase.firestore().collection('ivette_movimientos').get();
            this._fullRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderStats(true);
            if (this._invVisible) this.renderInventario(true);
            else this._updateInvQuickCount(true);
            this._renderProdComboList(); this._renderProdComboListMobile();
        } catch (e) {
            console.error('Error al calcular estadisticas historicas:', e);
        }
    },

    _recordsForStats(useFull) {
        return useFull && this._fullRecords ? this._fullRecords : this.records;
    },

    _getItems(record) {
        if (Array.isArray(record.items) && record.items.length) return record.items;
        if (record.producto) return [{ producto: record.producto, cantidad: record.cantidad }];
        return [];
    },

    _productStats(useFull) {
        const map = {};
        this._recordsForStats(useFull).forEach(r => {
            const items = this._getItems(r);
            items.forEach(it => {
                const name = String(it.producto || '').trim() || '(Sin producto)';
                if (!map[name]) map[name] = { producto: name, entradas: 0, salidas: 0 };
                const qty = Number(it.cantidad) || 0;
                if (r.tipo === 'ingreso') map[name].entradas += qty;
                else map[name].salidas += qty;
            });
        });
        return Object.values(map)
            .map(p => Object.assign({}, p, { existencia: p.entradas - p.salidas }))
            .sort((a, b) => a.producto.localeCompare(b.producto, 'es'));
    },

    _getNextCorrelativo(tipo) {
        const recs = this._recordsForStats(this._truncated);
        let max = 0;
        recs.forEach(r => {
            if (r.tipo !== tipo) return;
            const c = Number(r.correlativo);
            if (!isNaN(c) && c > max) max = c;
        });
        return max + 1;
    },

    _getAllProductos() {
        const set = new Set();
        this.records.forEach(r => {
            this._getItems(r).forEach(it => {
                const n = String(it.producto || '').trim();
                if (n) set.add(n);
            });
        });
        if (this._fullRecords) {
            this._fullRecords.forEach(r => {
                this._getItems(r).forEach(it => {
                    const n = String(it.producto || '').trim();
                    if (n) set.add(n);
                });
            });
        }
        return [...set].sort((a, b) => a.localeCompare(b, 'es'));
    },

    _filteredMovimientos() {
        let list = this.records.slice();
        const q = (this._movSearch || '').trim().toLowerCase();
        if (q) {
            list = list.filter(r => {
                const items = this._getItems(r);
                const productos = items.map(it => String(it.producto || '')).join(' ');
                const hay = [
                    String(r.correlativo || ''),
                    productos,
                    String(r.observacion || ''),
                    String(r.createdByName || '')
                ].join(' ').toLowerCase();
                return hay.includes(q);
            });
        }
        if (this._movTipo === 'ingreso' || this._movTipo === 'salida') {
            list = list.filter(r => r.tipo === this._movTipo);
        }
        return list;
    },

    renderStats(useFull) {
        const stats = this._productStats(useFull);
        const total = stats.reduce((s, p) => s + p.existencia, 0);
        const faltantes = stats.filter(p => p.existencia < 0).length;
        const totalEl = document.getElementById('ivette-existencia');
        const productosEl = document.getElementById('ivette-productos');
        const faltantesEl = document.getElementById('ivette-faltantes');
        if (totalEl) totalEl.textContent = formatNumber(total);
        if (productosEl) productosEl.textContent = formatNumber(stats.length);
        if (faltantesEl) faltantesEl.textContent = formatNumber(faltantes);
        this._updateInvQuickCount(useFull);
    },

    _updateInvQuickCount(useFull) {
        const el = document.getElementById('ivette-inv-quick-count');
        if (!el) return;
        if (!this._invVisible) {
            const stats = this._productStats(useFull);
            const falt = stats.filter(p => p.existencia < 0).length;
            el.textContent = `${stats.length} productos · ${falt} por reponer`;
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    },

    _getCardexLedger(useFull, selected) {
        const recs = this._recordsForStats(useFull);
        const flat = [];
        recs.forEach(r => {
            const items = this._getItems(r);
            const fechaMs = r.fecha ? (r.fecha.toDate ? r.fecha.toDate().getTime() : new Date(r.fecha).getTime()) : 0;
            items.forEach(it => {
                const producto = String(it.producto || '').trim();
                if (!producto) return;
                if (selected && producto.toUpperCase() !== selected.toUpperCase()) return;
                flat.push({
                    producto,
                    fecha: r.fecha,
                    fechaMs,
                    correlativo: r.correlativo,
                    tipo: r.tipo,
                    cantidad: Number(it.cantidad) || 0
                });
            });
        });
        flat.sort((a, b) => {
            if (a.fechaMs !== b.fechaMs) return a.fechaMs - b.fechaMs;
            return (Number(a.correlativo) || 0) - (Number(b.correlativo) || 0);
        });
        const saldoMap = {};
        flat.forEach(row => {
            const key = row.producto.toUpperCase();
            if (saldoMap[key] == null) saldoMap[key] = 0;
            if (row.tipo === 'ingreso') saldoMap[key] += row.cantidad;
            else saldoMap[key] -= row.cantidad;
            row.entrada = row.tipo === 'ingreso' ? row.cantidad : 0;
            row.salida = row.tipo === 'salida' ? row.cantidad : 0;
            row.saldo = saldoMap[key];
        });
        return flat;
    },

    renderInventario(useFull) {
        const allStats = this._productStats(useFull);
        const ledgerAll = this._getCardexLedger(useFull, this._invSelected || '');
        const container = document.getElementById('ivette-inventario-container') || document.getElementById('m-ivette-inventario');
        const countEl = document.getElementById('ivette-inv-count') || document.getElementById('m-ivette-inv-count');
        this._updateInvQuickCount(useFull);
        this._syncProdLabel(); this._syncProdLabelMobile();
        if (countEl) {
            if (this._invSelected) countEl.textContent = `${ledgerAll.length} mov. · ${sanitizeHTML(this._invSelected)}`;
            else countEl.textContent = allStats.length ? `${allStats.length} productos · ${ledgerAll.length} mov.` : '—';
        }
        if (!container) return;
        if (!allStats.length) {
            container.innerHTML = '<div class="ivette-empty"><div class="ivette-empty-icon">📦</div><h3>Sin productos aún</h3><p>Registra un movimiento para crear el inventario.</p></div>';
            return;
        }

        let ledger = ledgerAll;
        const q = (this._invSearch || '').trim().toLowerCase();
        if (q) ledger = ledger.filter(r => r.producto.toLowerCase().includes(q));
        if (this._invFilter === 'faltante' || this._invFilter === 'disponible') {
            const allowed = new Set(
                allStats.filter(p => this._invFilter === 'faltante' ? p.existencia < 0 : p.existencia >= 0).map(p => p.producto.toUpperCase())
            );
            ledger = ledger.filter(r => allowed.has(r.producto.toUpperCase()));
        }

        if (!ledger.length) {
            container.innerHTML = '<div class="ivette-empty"><div class="ivette-empty-icon">🔍</div><h3>Sin resultados</h3><p>Ningún movimiento coincide con el filtro.</p></div>';
            return;
        }

        const rowsHtml = ledger.map(r => {
            const fecha = r.fecha ? formatDateShort(r.fecha.toDate ? r.fecha.toDate() : r.fecha) : '—';
            const corr = r.correlativo != null && r.correlativo !== '' ? `#${sanitizeHTML(String(r.correlativo))}` : '—';
            const ent = r.entrada ? formatNumber(r.entrada) : '—';
            const sal = r.salida ? formatNumber(r.salida) : '—';
            const saldoClass = r.saldo < 0 ? 'iv-cardex-neg' : r.saldo === 0 ? 'iv-cardex-zero' : 'iv-cardex-pos';
            const tipoDot = r.tipo === 'ingreso' ? '<span class="iv-cardex-dot in"></span>' : '<span class="iv-cardex-dot out"></span>';
            return `<tr>
                <td class="iv-cardex-td-date">${fecha}<span class="iv-cardex-corr">${corr}</span></td>
                <td class="iv-cardex-td-prod">${tipoDot}${sanitizeHTML(r.producto)}</td>
                <td class="iv-cardex-td-in">${ent}</td>
                <td class="iv-cardex-td-out">${sal}</td>
                <td class="iv-cardex-td-saldo ${saldoClass}">${formatNumber(r.saldo)}</td>
            </tr>`;
        }).join('');

        let totalsEntradas = 0, totalsSalidas = 0;
        ledger.forEach(r => { totalsEntradas += r.entrada; totalsSalidas += r.salida; });
        let saldoFinal = 0;
        if (this._invSelected) {
            const stat = allStats.find(p => p.producto.toUpperCase() === this._invSelected.toUpperCase());
            saldoFinal = stat ? stat.existencia : (ledger.length ? ledger[ledger.length - 1].saldo : 0);
        } else {
            saldoFinal = allStats.reduce((s, p) => s + p.existencia, 0);
        }
        const saldoClass = saldoFinal < 0 ? 'iv-cardex-neg' : saldoFinal === 0 ? 'iv-cardex-zero' : 'iv-cardex-pos';

        container.innerHTML = `
            <div class="iv-cardex-wrap">
                <table class="iv-cardex-table">
                    <thead><tr><th>Fecha</th><th>Producto</th><th style="text-align:right;">Entrada</th><th style="text-align:right;">Salida</th><th style="text-align:right;">Saldo</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot><tr>
                        <td colspan="2" style="text-align:right;font-weight:800;">Totales${this._invSelected ? ` · ${sanitizeHTML(this._invSelected)}` : ''}</td>
                        <td class="iv-cardex-td-in" style="font-weight:800;color:#047857;">${formatNumber(totalsEntradas)}</td>
                        <td class="iv-cardex-td-out" style="font-weight:800;color:#92400e;">${formatNumber(totalsSalidas)}</td>
                        <td class="iv-cardex-td-saldo ${saldoClass}" style="font-weight:900;">${formatNumber(saldoFinal)}</td>
                    </tr></tfoot>
                </table>
            </div>
        `;
    },

    renderTable() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            this.renderMobileCards();
            return;
        }

        const container = document.getElementById('ivette-table-container');
        if (!container) return;
        const canCreate = window.permissions?.canCreate;
        const canDelete = window.permissions?.canDelete;

        const filtered = this._filteredMovimientos();
        const countEl = document.getElementById('ivette-mov-count');
        if (countEl) countEl.textContent = `${filtered.length} de ${this.records.length}`;

        if (this.records.length === 0) {
            container.innerHTML = `
                <div class="tarimas-empty">
                    <h3>Sin movimientos registrados</h3>
                    <p>Registra el primer movimiento para comenzar.</p>
                </div>
            `;
            return;
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="ivette-empty"><div class="ivette-empty-icon">🔍</div><h3>Sin coincidencias</h3><p>Ningún movimiento coincide con el filtro.</p></div>';
            return;
        }

        const truncNote = this._truncated
            ? '<div class="ivette-trunc">⚠ Se muestran los 500 movimientos más recientes. El inventario se calcula con el historial completo.</div>'
            : '';

        const rows = filtered.map(record => {
            const fecha = record.fecha ? formatDate(record.fecha.toDate ? record.fecha.toDate() : record.fecha, true) : '—';
            const isIngreso = record.tipo === 'ingreso';
            const tipoBadge = isIngreso
                ? '<span class="iv-mov-badge iv-mov-badge--in">📥 Entrada</span>'
                : '<span class="iv-mov-badge iv-mov-badge--out">📤 Salida</span>';
            const correlativo = record.correlativo != null && record.correlativo !== '' ? `#${sanitizeHTML(String(record.correlativo))}` : '—';
            const items = this._getItems(record);
            const productosHtml = items.length
                ? items.map(it => `<span class="iv-prod-chip">${sanitizeHTML(it.producto || '')} <strong>${formatNumber(it.cantidad || 0)}</strong></span>`).join(' ')
                : '—';
            const obs = record.observacion ? sanitizeHTML(record.observacion) : '';
            const usuario = record.createdByName ? sanitizeHTML(record.createdByName) : '—';

            return `
                <tr>
                    <td style="font-weight:800;color:#7c2d12;white-space:nowrap;">${correlativo}</td>
                    <td class="tarima-td-fecha">${fecha}</td>
                    <td>${tipoBadge}</td>
                    <td style="max-width:380px;"><div class="iv-prods-cell">${productosHtml}</div></td>
                    <td class="tarima-td-obs${obs ? ' has-obs-preview' : ''}"${obs ? ` tabindex="0" data-full="${obs}"` : ''}>${obs.length > 36 ? obs.substring(0, 36) + '…' : obs}</td>
                    <td style="color:#475569;">${usuario}</td>
                    <td style="white-space:nowrap;">
                        <button class="tarima-btn iv-btn-print" data-id="${sanitizeHTML(record.id)}" title="Imprimir / PDF">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </button>
                        ${canCreate ? `<button class="tarima-btn tarima-btn-edit" data-id="${sanitizeHTML(record.id)}" title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>` : ''}
                        ${canDelete ? `<button class="tarima-btn tarima-btn-delete" data-id="${sanitizeHTML(record.id)}" title="Eliminar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            ${truncNote}
            <table class="tarimas-table ivette-table">
                <thead>
                    <tr>
                        <th>Correlativo</th>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Productos</th>
                        <th>Observación</th>
                        <th>Registró</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    renderMobileCards() {
        const container = document.getElementById('m-ivette-list');
        if (!container) return;
        const canCreate = window.permissions?.canCreate;
        const canDelete = window.permissions?.canDelete;
        const countEl = document.getElementById('m-ivette-mov-count');
        const filtered = this._filteredMovimientos();
        if (countEl) countEl.textContent = `${filtered.length} de ${this.records.length}`;

        if (this.records.length === 0) {
            container.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📦</div><div class="m-empty-title">Sin movimientos</div><div class="m-empty-text">Registra el primer movimiento.</div></div>';
            return;
        }
        if (filtered.length === 0) {
            container.innerHTML = '<div class="m-empty"><div class="m-empty-icon">🔍</div><div class="m-empty-title">Sin coincidencias</div><div class="m-empty-text">Ningún movimiento coincide.</div></div>';
            return;
        }

        const self = this;
        container.innerHTML = filtered.map(function(record) {
            var isIngreso = record.tipo === 'ingreso';
            var fecha = record.fecha ? formatDateShort(record.fecha.toDate ? record.fecha.toDate() : record.fecha) : '—';
            var badgeText = isIngreso ? '📥 Entrada' : '📤 Salida';
            var obs = record.observacion || '';
            var correlativo = record.correlativo != null && record.correlativo !== '' ? '#' + sanitizeHTML(String(record.correlativo)) : '';
            var items = self._getItems(record);
            var productos = items.map(function(it){ return sanitizeHTML(it.producto || '') + ' (' + formatNumber(it.cantidad||0) + ')'; }).join(', ');
            if (productos.length > 80) productos = productos.substring(0,80) + '…';

            return '<div class="m-data-card iv-m-card" style="border-left:3px solid ' + (isIngreso ? '#10b981' : '#f59e0b') + ';">' +
                '<div class="m-card-header"><span class="m-card-title">' + (correlativo ? correlativo + ' · ' : '') + badgeText + '</span>' +
                '<span class="m-card-badge" style="font-size:0.68rem;">' + fecha + '</span></div>' +
                '<div class="m-card-rows">' +
                '<div class="m-card-row"><span class="m-card-label">Productos</span><span class="m-card-value" style="white-space:normal;">' + productos + '</span></div>' +
                (obs ? '<div class="m-card-row"><span class="m-card-label">Obs</span><span class="m-card-value">' + sanitizeHTML(obs.length > 60 ? obs.substring(0, 60) + '…' : obs) + '</span></div>' : '') +
                '</div>' +
                '<div class="m-card-actions">' +
                    '<button class="m-card-action iv-btn-print" data-id="' + sanitizeHTML(record.id) + '" title="Imprimir">🖨️</button>' +
                    (canCreate ? '<button class="m-card-action tarima-btn-edit" data-id="' + sanitizeHTML(record.id) + '" title="Editar">✏️</button>' : '') +
                    (canDelete ? '<button class="m-card-action delete tarima-btn-delete" data-id="' + sanitizeHTML(record.id) + '" title="Eliminar">🗑️</button>' : '') +
                '</div>' +
            '</div>';
        }).join('');
    },

    _getExistencia(producto) {
        const name = String(producto || '').trim().toUpperCase();
        if (!name) return 0;
        const map = {};
        this._recordsForStats(false).forEach(r => {
            this._getItems(r).forEach(it => {
                const n = String(it.producto || '').trim().toUpperCase();
                if (!map[n]) map[n] = 0;
                const qty = Number(it.cantidad) || 0;
                map[n] += r.tipo === 'ingreso' ? qty : -qty;
            });
        });
        return map[name] || 0;
    },

    _updateStockPreview() {
        const preview = document.getElementById('ivette-stock-preview');
        if (!preview) return;
        const tipo = this._formTipo;
        const rows = document.querySelectorAll('#ivette-items-list .iv-item-row');
        if (!rows.length) { preview.style.display = 'none'; return; }
        let html = '';
        let hasData = false;
        rows.forEach(row => {
            const producto = (row.querySelector('.iv-item-producto')?.value || '').trim();
            const cantidad = parseInt(row.querySelector('.iv-item-cantidad')?.value, 10);
            if (!producto && isNaN(cantidad)) return;
            hasData = true;
            const actual = this._getExistencia(producto);
            const delta = isNaN(cantidad) ? 0 : cantidad;
            const nuevo = tipo === 'ingreso' ? actual + delta : actual - delta;
            const sign = tipo === 'ingreso' ? '+' : '−';
            const nuevoClass = nuevo < 0 ? 'is-warn' : nuevo === 0 ? 'is-zero' : 'is-ok';
            const prodLabel = producto ? sanitizeHTML(producto.toUpperCase()) : '<span style="color:#94a3b8;">— producto —</span>';
            html += `
                <div class="iv-preview-item ${nuevoClass}">
                    <span class="iv-preview-prod">${prodLabel}</span>
                    <span class="iv-preview-nums"><span class="iv-preview-actual">${formatNumber(actual)}</span> <span class="iv-preview-arrow">→</span> <span class="iv-preview-delta ${tipo === 'ingreso' ? 'iv-preview-in' : 'iv-preview-out'}">${sign}${isNaN(cantidad) ? '—' : formatNumber(delta)}</span> <span class="iv-preview-eq">=</span> <strong class="iv-preview-nuevo">${isNaN(cantidad) ? '—' : formatNumber(nuevo)}</strong></span>
                </div>
            `;
        });
        if (!hasData) { preview.style.display = 'none'; return; }
        preview.innerHTML = html;
        preview.style.display = '';
    },

    _addItemRow(producto, cantidad) {
        const list = document.getElementById('ivette-items-list');
        if (!list) return;
        const datalistId = 'ivette-productos-list';
        const row = document.createElement('div');
        row.className = 'iv-item-row';
        row.innerHTML = `
            <input type="text" class="premium-input iv-item-producto" list="${datalistId}" placeholder="Ej: HOJAS PARA JUEGOS..." value="${producto ? sanitizeHTML(producto) : ''}" autocomplete="off">
            <input type="number" class="premium-input iv-item-cantidad" min="0" placeholder="Cant." inputmode="numeric" value="${cantidad != null && cantidad !== '' ? cantidad : ''}">
            <button type="button" class="iv-item-remove" title="Quitar producto">×</button>
        `;
        list.appendChild(row);
        row.querySelector('.iv-item-producto').addEventListener('input', () => this._updateStockPreview());
        row.querySelector('.iv-item-cantidad').addEventListener('input', () => this._updateStockPreview());
        row.querySelector('.iv-item-remove').addEventListener('click', () => {
            row.remove();
            this._updateHeaderCount();
            this._updateStockPreview();
            if (!list.querySelector('.iv-item-row')) this._addItemRow('', '');
        });
        this._updateHeaderCount();
        this._updateStockPreview();
    },

    _updateHeaderCount() {
        const countEl = document.getElementById('iv-prod-count');
        const list = document.getElementById('ivette-items-list');
        if (!countEl || !list) return;
        const n = list.querySelectorAll('.iv-item-row').length;
        countEl.textContent = n + (n === 1 ? ' producto' : ' productos');
    },

    showForm(tipo, existingRecord) {
        if (AccessControl.level('ivette') !== 'write') {
            showToast('No tienes permiso para modificar el inventario.', 'warning');
            return;
        }
        const isEdit = !!existingRecord;
        const isIngreso = isEdit ? existingRecord.tipo === 'ingreso' : tipo === 'ingreso';
        const title = isEdit ? 'Editar Movimiento' : (isIngreso ? 'Registrar Entrada' : 'Registrar Salida');
        const icon = isEdit ? '✏️' : (isIngreso ? '📥' : '📤');
        this.editingId = isEdit ? existingRecord.id : null;
        this._formTipo = isIngreso ? 'ingreso' : 'salida';

        const productos = this._getAllProductos();
        const datalistOptions = productos.map(p => `<option value="${sanitizeHTML(p)}">`).join('');
        const correlativoVal = isEdit && existingRecord.correlativo != null ? existingRecord.correlativo : this._getNextCorrelativo(this._formTipo);

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'ivette-modal';
        modal.innerHTML = `
            <div class="premium-modal iv-modal iv-modal--wide">
                <div class="premium-modal-header">
                    <div class="premium-modal-title">
                        <div class="premium-modal-icon">${icon}</div>
                        <div>
                            <h2>${title}</h2>
                            <p>${isEdit ? 'Modifica los datos del movimiento' : 'Correlativo editable · agrega varios productos'}</p>
                        </div>
                    </div>
                    <button class="premium-close" id="ivette-close-x" aria-label="Cerrar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div class="premium-modal-body">
                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-step">1</span>
                            <h3>Movimiento</h3>
                        </div>
                        <div class="tarima-type-selector" style="margin-bottom:12px;">
                            <button type="button" class="tarima-type-btn ${isIngreso ? 'active' : ''}" id="ivette-type-ingreso">📥 Entrada</button>
                            <button type="button" class="tarima-type-btn ${!isIngreso ? 'active' : ''}" id="ivette-type-salida">📤 Salida</button>
                        </div>
                        <div style="display:grid;grid-template-columns: 1fr 1fr;gap:10px;">
                            <div class="tarima-field">
                                <label class="tarima-field-label" for="ivette-correlativo">Correlativo <span class="required">*</span></label>
                                <input type="number" id="ivette-correlativo" class="premium-input" min="1" placeholder="Ej: 1" inputmode="numeric" value="${correlativoVal}">
                            </div>
                            <div class="tarima-field">
                                <label class="tarima-field-label" for="ivette-fecha">Fecha <span class="required">*</span></label>
                                <input type="date" id="ivette-fecha" class="premium-input" value="${isEdit && existingRecord.fecha ? formatDateForInput(existingRecord.fecha.toDate ? existingRecord.fecha.toDate() : existingRecord.fecha) : formatDateForInput(new Date())}">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-step">2</span>
                            <h3>Productos <span class="required">*</span></h3>
                            <span class="iv-prod-count" id="iv-prod-count"></span>
                        </div>
                        <datalist id="ivette-productos-list">${datalistOptions}</datalist>
                        <div id="ivette-items-list" class="iv-items-list"></div>
                        <button type="button" class="btn btn-secondary btn-sm" id="ivette-add-item" style="margin-top:10px;">＋ Agregar producto</button>
                        <div class="iv-hint">Un mismo movimiento puede contener varios productos con su cantidad cada uno.</div>
                        <div class="iv-stock-preview" id="ivette-stock-preview" style="display:none;margin-top:10px;"></div>
                    </div>

                    <div class="form-section">
                        <div class="form-section-header" style="cursor:pointer;" id="ivette-obs-toggle">
                            <span class="form-step" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;">3</span>
                            <h3>Observación <span style="font-weight:500;color:#94a3b8;font-size:0.78rem;">opcional</span></h3>
                            <span style="margin-left:auto;font-size:0.75rem;color:#94a3b8;" id="ivette-obs-chevron">▾</span>
                        </div>
                        <textarea id="ivette-observacion" class="premium-textarea" rows="2" placeholder="Ej: NO HAY, MANDAR A HACER" style="display:none;">${isEdit && existingRecord.observacion ? sanitizeHTML(existingRecord.observacion) : ''}</textarea>
                    </div>
                </div>

                <div class="premium-modal-footer">
                    <button type="button" class="btn btn-ghost" id="btn-cancel-ivette">Cancelar</button>
                    <button type="button" class="btn btn-gradient" id="btn-save-ivette">
                        ${isEdit ? 'Guardar Cambios' : title}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const syncTipo = () => {
            document.getElementById('ivette-type-ingreso').classList.toggle('active', this._formTipo === 'ingreso');
            document.getElementById('ivette-type-salida').classList.toggle('active', this._formTipo === 'salida');
            if (!isEdit) {
                const corrInput = document.getElementById('ivette-correlativo');
                if (corrInput && !corrInput.dataset.userEdited) {
                    corrInput.value = this._getNextCorrelativo(this._formTipo);
                }
            }
            this._updateStockPreview();
        };

        document.getElementById('ivette-type-ingreso').addEventListener('click', () => {
            this._formTipo = 'ingreso';
            syncTipo();
        });
        document.getElementById('ivette-type-salida').addEventListener('click', () => {
            this._formTipo = 'salida';
            syncTipo();
        });
        document.getElementById('ivette-correlativo').addEventListener('input', (e) => {
            e.target.dataset.userEdited = '1';
        });

        document.getElementById('ivette-add-item').addEventListener('click', () => {
            this._addItemRow('', '');
            const rows = document.querySelectorAll('#ivette-items-list .iv-item-row');
            const last = rows[rows.length - 1];
            if (last) last.querySelector('.iv-item-producto')?.focus();
        });

        const items = isEdit ? this._getItems(existingRecord) : [];
        if (items.length) {
            items.forEach(it => this._addItemRow(it.producto, it.cantidad));
        } else {
            this._addItemRow('', '');
        }

        const obsToggle = document.getElementById('ivette-obs-toggle');
        const obsArea = document.getElementById('ivette-observacion');
        const obsChevron = document.getElementById('ivette-obs-chevron');
        let obsOpen = !!(isEdit && existingRecord.observacion);
        if (obsOpen) { obsArea.style.display = ''; if (obsChevron) obsChevron.textContent = '▴'; }
        obsToggle.addEventListener('click', () => {
            obsOpen = !obsOpen;
            obsArea.style.display = obsOpen ? '' : 'none';
            if (obsChevron) obsChevron.textContent = obsOpen ? '▴' : '▾';
            if (obsOpen) obsArea.focus();
        });

        document.getElementById('btn-cancel-ivette').addEventListener('click', () => this.hideForm());
        document.getElementById('ivette-close-x').addEventListener('click', () => this.hideForm());
        document.getElementById('btn-save-ivette').addEventListener('click', () => this.saveMovimiento());
        modal.addEventListener('click', (e) => { if (e.target === modal) this.hideForm(); });

        this._updateStockPreview();
    },

    showEditForm(id) {
        const record = this.records.find(r => r.id === id);
        if (!record) { showToast('Movimiento no encontrado', 'error'); return; }
        this.showForm(record.tipo, record);
    },

    hideForm() {
        const modal = document.getElementById('ivette-modal');
        if (modal) modal.remove();
        this.editingId = null;
    },

    async saveMovimiento() {
        if (AccessControl.level('ivette') !== 'write') {
            showToast('No tienes permiso para modificar el inventario.', 'warning');
            return;
        }

        const correlativoRaw = (document.getElementById('ivette-correlativo')?.value || '').trim();
        const correlativo = parseInt(correlativoRaw, 10);
        if (!correlativoRaw || isNaN(correlativo) || correlativo < 1) {
            showToast('Ingresa un correlativo válido (≥ 1)', 'error');
            return;
        }
        const dup = this.records.find(r => r.id !== this.editingId && r.tipo === this._formTipo && Number(r.correlativo) === correlativo);
        if (dup) {
            showToast(`Ya existe una ${this._formTipo === 'ingreso' ? 'entrada' : 'salida'} con correlativo #${correlativo}`, 'error', 5000);
            return;
        }

        const fechaStr = document.getElementById('ivette-fecha')?.value || '';
        if (!fechaStr) {
            showToast('Selecciona una fecha', 'error');
            return;
        }

        const fechaParts = fechaStr.split('-').map(Number);
        const fechaTs = firebase.firestore.Timestamp.fromDate(new Date(fechaParts[0], fechaParts[1] - 1, fechaParts[2], 12, 0, 0));
        const tipo = this._formTipo;
        const observacion = (document.getElementById('ivette-observacion')?.value || '').trim();

        const rows = [...document.querySelectorAll('#ivette-items-list .iv-item-row')];
        const items = [];
        for (const row of rows) {
            const producto = (row.querySelector('.iv-item-producto')?.value || '').trim();
            const cantidadRaw = (row.querySelector('.iv-item-cantidad')?.value || '').trim();
            if (!producto && !cantidadRaw) continue;
            if (!producto) { showToast('Completa el nombre del producto en todas las filas', 'error'); return; }
            const cantidad = parseInt(cantidadRaw, 10);
            if (cantidadRaw === '' || isNaN(cantidad) || cantidad < 0) { showToast(`Cantidad inválida para "${producto}"`, 'error'); return; }
            items.push({ producto: producto.toUpperCase(), cantidad: cantidad });
        }
        if (items.length === 0) {
            showToast('Agrega al menos un producto', 'error');
            return;
        }
        const dupProd = new Set();
        for (const it of items) {
            const k = it.producto.toUpperCase();
            if (dupProd.has(k)) { showToast(`Producto duplicado: ${it.producto}`, 'error'); return; }
            dupProd.add(k);
        }

        const saveBtn = document.getElementById('btn-save-ivette');
        setButtonLoading(saveBtn, true);

        try {
            const db = firebase.firestore();
            const user = firebase.auth().currentUser;

            const base = {
                correlativo: correlativo,
                tipo: tipo,
                fecha: fechaTs,
                observacion: observacion,
                items: items,
                producto: items[0].producto,
                cantidad: items[0].cantidad,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (this.editingId) {
                await db.collection('ivette_movimientos').doc(this.editingId).update(base);
                showToast('Movimiento actualizado', 'success');
            } else {
                await db.collection('ivette_movimientos').add(Object.assign({}, base, {
                    createdBy: user ? user.uid : '',
                    createdByName: window.currentUserData?.displayName || 'Usuario',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }));
                showToast(tipo === 'ingreso' ? 'Entrada registrada' : 'Salida registrada', 'success');
            }

            this.hideForm();
        } catch (error) {
            console.error('Error saving ivette movimiento:', error);
            showToast('Error al guardar: ' + error.message, 'error', 6000);
        } finally {
            setButtonLoading(saveBtn, false);
        }
    },

    async deleteMovimiento(id) {
        if (!window.permissions?.canDelete) {
            showToast('Solo el administrador puede eliminar movimientos.', 'warning');
            return;
        }
        const record = this.records.find(r => r.id === id);
        if (!record) return;

        const tipo = record.tipo === 'ingreso' ? 'entrada' : 'salida';
        const corr = record.correlativo != null ? ` #${record.correlativo}` : '';
        const prods = this._getItems(record).map(it => it.producto).join(', ');
        if (!confirm(`¿Eliminar esta ${tipo}${corr} (${prods})?\nEl inventario se recalculará automáticamente.`)) return;

        try {
            await firebase.firestore().collection('ivette_movimientos').doc(id).delete();
            this._fullRecords = null;
            showToast('Movimiento eliminado', 'success');
        } catch (error) {
            console.error('Error deleting ivette movimiento:', error);
            showToast('Error al eliminar', 'error');
        }
    },

    async exportExcel() {
        const stats = this._productStats(false);
        if (!this.records.length) { showToast('No hay datos para exportar', 'info'); return; }
        try { await ensureLib('xlsx'); } catch (e) { showToast('Excel no disponible (sin conexión al CDN)', 'error'); return; }
        try {
            const wb = XLSX.utils.book_new();

            const invRows = stats.map(p => ({
                'Producto': p.producto,
                'Entradas': p.entradas,
                'Salidas': p.salidas,
                'Existencia': p.existencia,
                'Nota': p.existencia < 0 ? 'NO HAY, MANDAR A HACER' : ''
            }));
            const wsInv = XLSX.utils.json_to_sheet(invRows);
            wsInv['!cols'] = [{ wch: 32 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 26 }];
            XLSX.utils.book_append_sheet(wb, wsInv, 'Inventario');

            const movRows = [];
            this.records.forEach(r => {
                const items = this._getItems(r);
                if (!items.length) {
                    movRows.push({
                        'Correlativo': r.correlativo != null ? r.correlativo : '',
                        'Fecha': r.fecha ? formatDate(r.fecha.toDate ? r.fecha.toDate() : r.fecha, false) : '',
                        'Tipo': r.tipo === 'ingreso' ? 'Entrada' : 'Salida',
                        'Producto': r.producto || '',
                        'Cantidad': Number(r.cantidad) || 0,
                        'Observación': r.observacion || '',
                        'Registró': r.createdByName || ''
                    });
                } else {
                    items.forEach(it => {
                        movRows.push({
                            'Correlativo': r.correlativo != null ? r.correlativo : '',
                            'Fecha': r.fecha ? formatDate(r.fecha.toDate ? r.fecha.toDate() : r.fecha, false) : '',
                            'Tipo': r.tipo === 'ingreso' ? 'Entrada' : 'Salida',
                            'Producto': it.producto || '',
                            'Cantidad': Number(it.cantidad) || 0,
                            'Observación': r.observacion || '',
                            'Registró': r.createdByName || ''
                        });
                    });
                }
            });
            const wsMov = XLSX.utils.json_to_sheet(movRows);
            wsMov['!cols'] = [{ wch: 11 }, { wch: 12 }, { wch: 32 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 16 }];
            XLSX.utils.book_append_sheet(wb, wsMov, 'Movimientos');

            XLSX.writeFile(wb, `Inventario_Ivette_${formatDateForInput(new Date())}.xlsx`);
            showToast('Excel exportado exitosamente', 'success');
        } catch (err) {
            console.error('[Ivette] Export Excel error:', err);
            showToast('Error al exportar Excel', 'error');
        }
    },

    async showPrintPreview(id) {
        const record = this.records.find(r => r.id === id);
        if (!record) { showToast('Movimiento no encontrado', 'error'); return; }

        if (window.Settings && window.Settings.loadSettings) {
            try { await window.Settings.loadSettings(); } catch {}
        }
        const settings = window.Settings?.settings || {};
        const companyName = settings.companyName || 'Dalse';
        const mainLogo = settings.logo1 ? sanitizeUrl(settings.logo1) : '';
        const secondaryLogo = settings.logo2 ? sanitizeUrl(settings.logo2) : '';

        const isIngreso = record.tipo === 'ingreso';
        const tipoLabel = isIngreso ? 'ENTRADA' : 'SALIDA';
        const tipoColor = isIngreso ? '#047857' : '#92400e';
        const tipoBg = isIngreso ? '#ecfdf5' : '#fff7ed';
        const correlativo = record.correlativo != null && record.correlativo !== '' ? String(record.correlativo) : '—';
        const fecha = record.fecha ? formatDate(record.fecha.toDate ? record.fecha.toDate() : record.fecha, true) : '—';
        const items = this._getItems(record);
        const obs = record.observacion ? sanitizeHTML(record.observacion) : '—';
        const usuario = record.createdByName ? sanitizeHTML(record.createdByName) : '—';
        const totalUnidades = items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);

        const itemsRows = items.map((it, idx) => `
            <tr>
                <td style="padding:10px 12px;text-align:center;color:#64748b;">${idx + 1}</td>
                <td style="padding:10px 12px;font-weight:700;color:#0f172a;">${sanitizeHTML(it.producto || '')}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;">${formatNumber(it.cantidad || 0)}</td>
            </tr>
        `).join('');

        const printArea = document.getElementById('print-area');
        if (!printArea) { showToast('Área de impresión no encontrada', 'error'); return; }

        printArea.innerHTML = `
            <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;background:#fff;line-height:1.45;max-width:800px;margin:0 auto;padding:28px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:24px;border-top:5px solid ${tipoColor};border-bottom:1px solid #e2e8f0;padding:18px 8px;margin-bottom:18px;">
                    <div style="display:flex;align-items:center;gap:14px;">
                        ${mainLogo ? `<img src="${mainLogo}" alt="Logo" style="height:64px;max-width:180px;object-fit:contain;">` : `<span style="font-size:26px;letter-spacing:2px;font-weight:900;color:#0f172a;">${sanitizeHTML(companyName)}</span>`}
                        ${secondaryLogo ? `<img src="${secondaryLogo}" alt="Logo 2" style="height:48px;max-width:160px;object-fit:contain;opacity:0.9;">` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div style="display:inline-flex;align-items:center;gap:8px;background:${tipoBg};border:1px solid ${tipoColor}22;color:${tipoColor};font-weight:800;font-size:0.75rem;letter-spacing:0.06em;padding:6px 10px;border-radius:999px;">● ${tipoLabel}</div>
                        <div style="margin-top:6px;font-size:11px;color:#64748b;">Inventario Ivette · Productos impresos</div>
                    </div>
                </div>

                <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;border:1px solid #e2e8f0;border-left:4px solid ${tipoColor};border-radius:10px;padding:14px 16px;margin-bottom:16px;">
                    <div>
                        <div style="font-size:11px;letter-spacing:0.08em;color:#64748b;font-weight:700;">COMPROBANTE DE ${tipoLabel}</div>
                        <div style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.02em;">#${sanitizeHTML(correlativo)} <span style="font-size:12px;font-weight:600;color:#64748b;">· ${sanitizeHTML(tipoLabel)}</span></div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:12px;color:#0f172a;"><strong>Fecha:</strong> ${sanitizeHTML(fecha)}</div>
                        <div style="font-size:11px;color:#64748b;">Generado: ${sanitizeHTML(new Date().toLocaleString('es-SV'))}</div>
                    </div>
                </div>

                <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:14px;">
                    <div style="background:#f8fafc;padding:10px 14px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:12px;font-weight:800;letter-spacing:0.06em;color:#334155;">PRODUCTOS</span>
                        <span style="font-size:11px;color:#64748b;">${items.length} ${items.length === 1 ? 'producto' : 'productos'} · ${formatNumber(totalUnidades)} unidades</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:#f8fafc;color:#475569;font-size:11px;letter-spacing:0.05em;">
                                <th style="padding:9px 12px;text-align:center;width:56px;">#</th>
                                <th style="padding:9px 12px;text-align:left;">Producto</th>
                                <th style="padding:9px 12px;text-align:right;width:120px;">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsRows}
                            <tr style="background:#f8fafc;font-weight:800;">
                                <td colspan="2" style="padding:10px 12px;text-align:right;color:#334155;">Total unidades</td>
                                <td style="padding:10px 12px;text-align:right;color:#0f172a;">${formatNumber(totalUnidades)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:16px;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;color:#334155;margin-bottom:6px;">OBSERVACIÓN</div>
                    <div style="font-size:13px;color:#334155;white-space:pre-wrap;min-height:22px;">${obs}</div>
                    <div style="margin-top:10px;font-size:11px;color:#64748b;"><strong>Registró:</strong> ${usuario}</div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:22px;">
                    <div style="text-align:center;">
                        <div style="height:64px;"></div>
                        <div style="border-top:1.5px solid #0f172a;padding-top:8px;">
                            <strong style="display:block;font-size:11px;">Entregó / Registró</strong>
                            <span style="font-size:10px;color:#64748b;">Nombre y firma</span>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <div style="height:64px;"></div>
                        <div style="border-top:1.5px solid #0f172a;padding-top:8px;">
                            <strong style="display:block;font-size:11px;">Recibió</strong>
                            <span style="font-size:10px;color:#64748b;">Nombre y firma</span>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <div style="height:64px;"></div>
                        <div style="border-top:1.5px solid #0f172a;padding-top:8px;">
                            <strong style="display:block;font-size:11px;">Fecha</strong>
                            <span style="font-size:10px;color:#64748b;">${sanitizeHTML(fecha)}</span>
                        </div>
                    </div>
                </div>

                <div style="margin-top:22px;text-align:center;color:#64748b;font-size:10px;border-top:1px solid #e2e8f0;padding-top:10px;">
                    <strong style="color:#0f172a;letter-spacing:0.06em;">${sanitizeHTML(companyName.toUpperCase())}</strong> · Inventario Ivette<br>
                    Documento generado el ${sanitizeHTML(new Date().toLocaleString('es-SV'))} · Correlativo #${sanitizeHTML(correlativo)}
                </div>
            </div>
        `;

        await Promise.all([...printArea.querySelectorAll('img')].map(img => new Promise(res => {
            if (img.complete) res();
            else { img.onload = res; img.onerror = res; }
        })));

        const overlay = document.createElement('div');
        overlay.id = 'ivette-print-preview';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10002;padding:1rem;';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:16px;max-width:920px;width:100%;max-height:95vh;display:flex;flex-direction:column;position:relative;overflow:hidden;">
                <button id="iv-print-close" style="position:absolute;top:10px;right:10px;background:#ef4444;color:#fff;border:0;border-radius:50%;width:36px;height:36px;font-size:1.1rem;cursor:pointer;display:grid;place-items:center;z-index:2;">✕</button>
                <div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:12px;padding-right:56px;">
                    <h3 style="margin:0;font-size:0.95rem;font-weight:800;">🖨️ Comprobante #${sanitizeHTML(correlativo)} · ${sanitizeHTML(tipoLabel)}</h3>
                    <div style="display:flex;gap:8px;">
                        <button id="iv-print-download" class="btn btn-secondary">📥 Descargar PDF</button>
                        <button id="iv-print-do" class="btn btn-primary">🖨️ Imprimir</button>
                    </div>
                </div>
                <div style="flex:1;overflow:auto;padding:16px;background:#e2e8f0;">
                    <div style="background:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.15);margin:0 auto;max-width:8.5in;padding:0.35in;box-sizing:border-box;">
                        ${printArea.innerHTML}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => {
            overlay.remove();
            printArea.innerHTML = '';
        };
        document.getElementById('iv-print-close').onclick = close;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        document.getElementById('iv-print-do').onclick = () => {
            overlay.style.display = 'none';
            window.print();
            setTimeout(close, 600);
        };

        document.getElementById('iv-print-download').onclick = async () => {
            try { await ensureLib('html2pdf'); } catch { showToast('PDF no disponible (sin conexión al CDN)', 'error'); return; }
            const btn = document.getElementById('iv-print-download');
            const prev = btn.innerHTML;
            btn.innerHTML = '⏳ Generando...';
            btn.disabled = true;
            let wrapper = null;
            try {
                wrapper = document.createElement('div');
                wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;';
                const src = document.createElement('div');
                src.style.cssText = 'width:7.5in;background:#fff;';
                src.innerHTML = printArea.innerHTML;
                wrapper.appendChild(src);
                document.body.appendChild(wrapper);
                await Promise.all([...src.querySelectorAll('img')].map(img => new Promise(res => {
                    if (img.complete) res();
                    else { img.onload = res; img.onerror = res; }
                })));
                const opt = {
                    margin: [0.4, 0.4, 0.4, 0.4],
                    filename: `Ivette_${tipoLabel}_${correlativo}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'] }
                };
                await html2pdf().set(opt).from(src).save();
                showToast('PDF descargado', 'success');
            } catch (err) {
                console.error('PDF error', err);
                showToast('Error al generar PDF', 'error');
            } finally {
                if (wrapper) wrapper.remove();
                btn.innerHTML = prev;
                btn.disabled = false;
            }
        };
    },

    cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this._hideObsPreview();
        const overlay = document.getElementById('ivette-print-preview');
        if (overlay) overlay.remove();
        const printArea = document.getElementById('print-area');
        if (printArea) printArea.innerHTML = '';
    },

    _bindObsPreview(container) {
        if (!container || container.dataset.obsPreviewBound) return;
        container.dataset.obsPreviewBound = '1';
        container.addEventListener('mouseover', (e) => {
            const cell = e.target.closest('.tarima-td-obs.has-obs-preview');
            if (cell) this._showObsPreview(cell);
        });
        container.addEventListener('mouseout', (e) => {
            const cell = e.target.closest('.tarima-td-obs.has-obs-preview');
            if (cell && !cell.contains(e.relatedTarget)) this._hideObsPreview();
        });
        container.addEventListener('focusin', (e) => {
            const cell = e.target.closest('.tarima-td-obs.has-obs-preview');
            if (cell) this._showObsPreview(cell);
        });
        container.addEventListener('focusout', () => this._hideObsPreview());
        if (!this._obsWindowBound) {
            this._obsWindowBound = true;
            window.addEventListener('scroll', () => this._hideObsPreview(), { passive: true });
            window.addEventListener('resize', () => this._hideObsPreview(), { passive: true });
        }
    },

    _showObsPreview(cell) {
        const texto = cell.dataset.full || '';
        if (!texto) return;
        let tip = document.getElementById('tarima-obs-tip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'tarima-obs-tip';
            tip.className = 'tarima-obs-tip';
            tip.setAttribute('role', 'tooltip');
            document.body.appendChild(tip);
        }
        tip.textContent = texto;
        tip.classList.add('show');
        const rect = cell.getBoundingClientRect();
        const margen = 12;
        const tipRect = tip.getBoundingClientRect();
        let top = rect.top - tipRect.height - margen;
        if (top < margen) top = rect.bottom + margen;
        let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
        const maxLeft = window.innerWidth - tipRect.width - margen;
        left = Math.max(margen, Math.min(left, maxLeft));
        tip.style.top = Math.round(top) + 'px';
        tip.style.left = Math.round(left) + 'px';
    },

    _hideObsPreview() {
        const tip = document.getElementById('tarima-obs-tip');
        if (tip) tip.classList.remove('show');
    }
};

window.Ivette = Ivette;

if (window.ModuleRegistry) {
    ModuleRegistry.register({
        key: 'ivette',
        label: 'Inventario Ivette',
        render: () => Ivette.render(),
        cleanup: () => { if (Ivette.cleanup) Ivette.cleanup(); }
    });
}
