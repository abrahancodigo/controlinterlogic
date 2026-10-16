// ===================================
// Tarimas Walmart Module
// ===================================

const Tarimas = {
    records: [],
    filteredRecords: [],
    unsubscribe: null,
    totalActual: 0,
    editingId: null,
    _listenerAdded: false,
    _mobileListenerAdded: false,

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
                icon: 'tarimas',
                title: 'Tarimas Walmart',
                subtitle: 'Control de inventario de ingresos y salidas',
                actions: `
                    <button id="btn-tarima-entrada" class="btn btn-primary btn-lg ${!canCreate ? 'btn-disabled' : ''}" ${!canCreate ? 'disabled' : ''}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Registrar Entrada
                    </button>
                    <button id="btn-tarima-salida" class="btn btn-secondary btn-lg ${!canCreate ? 'btn-disabled' : ''}" ${!canCreate ? 'disabled' : ''}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        Registrar Salida
                    </button>
                `
            })}

            <div class="tarimas-stats" id="tarimas-stats">
                <div class="stat-card stat-card-total">
                    <span class="stat-label">Existencia</span>
                    <span class="stat-value" id="tarima-existencia">0</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Total Entradas</span>
                    <span class="stat-value stat-value-in" id="tarima-entradas">0</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Total Salidas</span>
                    <span class="stat-value stat-value-out" id="tarima-salidas">0</span>
                </div>
            </div>

            <div class="tarimas-table-container" id="tarimas-table-container">
                <div class="tarimas-loading">
                    <div class="spinner-ring"><div class="loading-progress-bar"><div class="loading-progress-fill"></div></div><div class="loading-progress-pct">0%</div></div>
                    <p>Cargando movimientos...</p>
                </div>
            </div>
        `;

        document.getElementById('btn-tarima-entrada').addEventListener('click', () => {
            if (canCreate) this.showForm('ingreso');
        });
        document.getElementById('btn-tarima-salida').addEventListener('click', () => {
            if (canCreate) this.showForm('salida');
        });

        if (window.animateProgressPct) {
            var pctEl = document.querySelector('.tarimas-loading .loading-progress-pct');
            if (pctEl) window.animateProgressPct(pctEl);
        }

        await this.loadMovimientos();

        const tableContainer = document.getElementById('tarimas-table-container');
        if (tableContainer && !this._listenerAdded) {
            tableContainer.addEventListener('click', (e) => {
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
    },

    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        const canCreate = window.permissions?.canCreate;
        this._mobileListenerAdded = false;

        contentArea.innerHTML = `
            <div style="padding:0 0 8px 0;">
                <h1 style="font-size:1.35rem;font-weight:800;margin-bottom:2px;color:var(--m-text);">📦 Tarimas Walmart</h1>
                <p style="font-size:0.78rem;color:var(--m-text-secondary);">Control de inventario</p>
            </div>
            <div class="m-actions-bar">
                <button class="btn btn-primary" id="m-tarima-entrada" ${!canCreate ? 'disabled' : ''} style="border-radius:20px;">📥 Entrada</button>
                <button class="btn btn-secondary" id="m-tarima-salida" ${!canCreate ? 'disabled' : ''} style="border-radius:20px;">📤 Salida</button>
            </div>
            <div class="tarimas-stats" id="tarimas-stats" style="margin:8px 0;">
                <div class="stat-card stat-card-total" style="padding:8px;">
                    <span class="stat-label" style="font-size:0.65rem;">Existencia</span>
                    <span class="stat-value" id="tarima-existencia" style="font-size:1.3rem;">0</span>
                </div>
                <div class="stat-card" style="padding:8px;">
                    <span class="stat-label" style="font-size:0.65rem;">Total Entradas</span>
                    <span class="stat-value stat-value-in" id="tarima-entradas" style="font-size:1.3rem;">0</span>
                </div>
                <div class="stat-card" style="padding:8px;">
                    <span class="stat-label" style="font-size:0.65rem;">Total Salidas</span>
                    <span class="stat-value stat-value-out" id="tarima-salidas" style="font-size:1.3rem;">0</span>
                </div>
            </div>
            <div id="m-tarima-list" class="m-data-list">
                <div style="text-align:center;padding:40px;color:#8e8e93;">
                    <div class="spinner-ring" style="margin:0 auto 12px;width:160px;"><div class="loading-progress-bar"><div class="loading-progress-fill"></div></div><div class="loading-progress-pct">0%</div></div>
                    <p>Cargando...</p>
                </div>
            </div>
        `;

        document.getElementById('m-tarima-entrada').addEventListener('click', () => {
            if (canCreate) this.showForm('ingreso');
        });
        document.getElementById('m-tarima-salida').addEventListener('click', () => {
            if (canCreate) this.showForm('salida');
        });

        if (window.animateProgressPct) {
            var pctEl = document.querySelector('#m-tarima-list .loading-progress-pct');
            if (pctEl) window.animateProgressPct(pctEl);
        }

        await this.loadMovimientos();

        const mList = document.getElementById('m-tarima-list');
        if (mList && !this._mobileListenerAdded) {
            mList.addEventListener('click', (e) => {
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
    },

    async loadMovimientos() {
        if (this.unsubscribe) this.unsubscribe();

        const db = firebase.firestore();
        this.unsubscribe = db.collection('tarimas_walmart')
            .orderBy('fecha', 'desc')
            .limit(500)
            .onSnapshot(snapshot => {
                this.records = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.calcularTotales();
                this.renderStats();
                this.renderTable();
            }, error => {
                console.error('Error loading tarimas:', error);
                showToast('Error al cargar movimientos: ' + error.message, 'error');
            });
    },

    calcularTotales() {
        let totalEntradas = 0;
        let totalSalidas = 0;

        this.records.forEach(r => {
            if (r.tipo === 'ingreso') totalEntradas += (r.cantidad || 0);
            else if (r.tipo === 'salida') totalSalidas += (r.cantidad || 0);
        });

        this._totalEntradas = totalEntradas;
        this._totalSalidas = totalSalidas;
        this.totalActual = totalEntradas - totalSalidas;
    },

    renderStats() {
        const totalEl = document.getElementById('tarima-existencia');
        const entradasEl = document.getElementById('tarima-entradas');
        const salidasEl = document.getElementById('tarima-salidas');
        if (totalEl) totalEl.textContent = formatNumber(this.totalActual);
        if (entradasEl) entradasEl.textContent = formatNumber(this._totalEntradas || 0);
        if (salidasEl) salidasEl.textContent = formatNumber(this._totalSalidas || 0);
    },

    renderTable() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            this.renderMobileCards();
            return;
        }

        const container = document.getElementById('tarimas-table-container');
        if (!container) return;
        const canCreate = window.permissions?.canCreate;
        const canDelete = window.permissions?.canDelete;

        if (this.records.length === 0) {
            container.innerHTML = `
                <div class="tarimas-empty">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    <h3>Sin movimientos registrados</h3>
                    <p>Registra la primera entrada o salida de tarimas para comenzar.</p>
                </div>
            `;
            return;
        }

        const rows = this.records.map(record => {
            const fecha = record.fecha ? formatDate(record.fecha.toDate ? record.fecha.toDate() : record.fecha, true) : '—';
            const isIngreso = record.tipo === 'ingreso';
            const tipoBadge = isIngreso
                ? '<span class="tarima-badge tarima-badge-in">📥 Entrada</span>'
                : '<span class="tarima-badge tarima-badge-out">📤 Salida</span>';
            const cantidadClass = isIngreso ? 'tarima-cantidad-in' : 'tarima-cantidad-out';
            const cantidadSign = isIngreso ? '+' : '-';
            const destino = record.destino ? sanitizeHTML(record.destino) : '—';
            const obs = record.observacion ? sanitizeHTML(record.observacion) : '';
            const usuario = record.createdByName ? sanitizeHTML(record.createdByName) : '—';

            return `
                <tr>
                    <td class="tarima-td-fecha">${fecha}</td>
                    <td>${tipoBadge}</td>
                    <td class="tarima-td-cantidad ${cantidadClass}">${cantidadSign}${formatNumber(record.cantidad || 0)}</td>
                    <td>${destino}</td>
                    <td>${formatNumber(record.totalDespues || 0)}</td>
                    <td class="tarima-td-obs" title="${obs}">${obs.length > 40 ? obs.substring(0, 40) + '...' : obs}</td>
                    <td>${usuario}</td>
                    <td style="white-space:nowrap;">
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
            <table class="tarimas-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Cantidad</th>
                        <th>Destino</th>
                        <th>Total</th>
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
        const container = document.getElementById('m-tarima-list');
        if (!container) return;
        const canCreate = window.permissions?.canCreate;
        const canDelete = window.permissions?.canDelete;

        if (this.records.length === 0) {
            container.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📦</div><div class="m-empty-title">Sin movimientos</div><div class="m-empty-text">Registra la primera entrada o salida.</div></div>';
            return;
        }

        container.innerHTML = this.records.map(function(record) {
            var isIngreso = record.tipo === 'ingreso';
            var fecha = record.fecha ? formatDateShort(record.fecha.toDate ? record.fecha.toDate() : record.fecha) : '—';
            var cantidadSign = isIngreso ? '+' : '-';
            var badgeClass = isIngreso ? 'success' : 'danger';
            var badgeText = isIngreso ? '📥 Entrada' : '📤 Salida';
            var destino = record.destino || '';
            var obs = record.observacion || '';

            return '<div class="m-data-card" style="border-left:3px solid ' + (isIngreso ? '#10b981' : '#ef4444') + ';">' +
                '<div class="m-card-header"><span class="m-card-title">' + badgeText + '</span>' +
                '<span class="m-card-badge ' + badgeClass + '">' + cantidadSign + formatNumber(record.cantidad || 0) + '</span></div>' +
                '<div class="m-card-rows">' +
                '<div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">' + fecha + '</span></div>' +
                (destino ? '<div class="m-card-row"><span class="m-card-label">Destino</span><span class="m-card-value">' + sanitizeHTML(destino) + '</span></div>' : '') +
                '<div class="m-card-row"><span class="m-card-label">Total</span><span class="m-card-value">' + formatNumber(record.totalDespues || 0) + '</span></div>' +
                (obs ? '<div class="m-card-row"><span class="m-card-label">Obs</span><span class="m-card-value">' + sanitizeHTML(obs.length > 60 ? obs.substring(0, 60) + '...' : obs) + '</span></div>' : '') +
                '</div>' +
                '<div class="m-card-actions">' +
                    (canCreate ? '<button class="m-card-action tarima-btn-edit" data-id="' + sanitizeHTML(record.id) + '" title="Editar">✏️</button>' : '') +
                    (canDelete ? '<button class="m-card-action delete tarima-btn-delete" data-id="' + sanitizeHTML(record.id) + '" title="Eliminar">🗑️</button>' : '') +
                '</div>' +
            '</div>';
        }).join('');
    },

    showForm(tipo, existingRecord) {
        if (AccessControl.level('tarimas') !== 'write') {
            showToast('No tienes permiso para modificar Tarimas Walmart.', 'warning');
            return;
        }
        const isEdit = !!existingRecord;
        const isIngreso = isEdit ? existingRecord.tipo === 'ingreso' : tipo === 'ingreso';
        const title = isEdit ? 'Editar Movimiento' : (isIngreso ? 'Registrar Entrada' : 'Registrar Salida');
        const icon = isEdit ? '✏️' : (isIngreso ? '📥' : '📤');
        this.editingId = isEdit ? existingRecord.id : null;

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'tarima-modal';
        modal.innerHTML = `
            <div class="premium-modal">
                <div class="premium-modal-header">
                    <div class="premium-modal-title">
                        <div class="premium-modal-icon">${icon}</div>
                        <div>
                            <h2>${title}</h2>
                            <p>${isEdit ? 'Modifica los datos del movimiento' : (isIngreso ? 'Registra tarimas que entran al inventario' : 'Registra tarimas que salen e indica a dónde')}</p>
                        </div>
                    </div>
                    <button class="premium-close" onclick="Tarimas.hideForm()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div class="premium-modal-body">
                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-step">1</span>
                            <h3>Tipo de movimiento</h3>
                        </div>
                        <div class="tarima-type-selector">
                            <button type="button" class="tarima-type-btn ${isIngreso ? 'active' : ''}" id="tarima-type-ingreso">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                                Entrada
                            </button>
                            <button type="button" class="tarima-type-btn ${!isIngreso ? 'active' : ''}" id="tarima-type-salida">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 1 3 5 7 9"/><path d="M21 11V9a4 4 0 0 0-4-4H3"/><polyline points="17 23 21 19 17 15"/><path d="M3 13v2a4 4 0 0 0 4 4h14"/></svg>
                                Salida
                            </button>
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-step">2</span>
                            <h3>Fecha <span class="required">*</span></h3>
                        </div>
                        <div class="tarima-field">
                            <label class="tarima-field-label" for="tarima-fecha">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                Selecciona la fecha del movimiento
                            </label>
                            <input type="date" id="tarima-fecha" class="premium-input" value="${isEdit && existingRecord.fecha ? formatDateForInput(existingRecord.fecha.toDate ? existingRecord.fecha.toDate() : existingRecord.fecha) : formatDateForInput(new Date())}">
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-step">3</span>
                            <h3>Cantidad <span class="required">*</span></h3>
                        </div>
                        <div class="tarima-field">
                            <label class="tarima-field-label" for="tarima-cantidad">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                Número de tarimas
                            </label>
                            <input type="number" id="tarima-cantidad" class="premium-input" min="1" placeholder="Ej: 50" inputmode="numeric" value="${isEdit ? existingRecord.cantidad || '' : ''}">
                        </div>
                    </div>

                    <div class="form-section" id="tarima-destino-section" style="${isIngreso ? 'display:none;' : ''}">
                        <div class="form-section-header">
                            <span class="form-step">4</span>
                            <h3>Destino <span class="required">*</span></h3>
                        </div>
                        <div class="tarima-field">
                            <label class="tarima-field-label" for="tarima-destino">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                ¿A dónde se envían?
                            </label>
                            <input type="text" id="tarima-destino" class="premium-input" placeholder="Ej: Tienda Metrocentro, Bodega Central..." value="${isEdit && existingRecord.destino ? sanitizeHTML(existingRecord.destino) : ''}">
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-step" id="tarima-step-obs">${isIngreso ? '4' : '5'}</span>
                            <h3>Observación</h3>
                        </div>
                        <textarea id="tarima-observacion" class="premium-textarea" rows="3" placeholder="Detalle opcional...">${isEdit && existingRecord.observacion ? sanitizeHTML(existingRecord.observacion) : ''}</textarea>
                    </div>
                </div>

                <div class="premium-modal-footer">
                    <button type="button" class="btn btn-ghost" id="btn-cancel-tarima">Cancelar</button>
                    <button type="button" class="btn btn-gradient" id="btn-save-tarima">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        ${isEdit ? 'Guardar Cambios' : title}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        var selectedType = isIngreso ? 'ingreso' : 'salida';

        document.getElementById('tarima-type-ingreso').addEventListener('click', () => {
            selectedType = 'ingreso';
            document.getElementById('tarima-type-ingreso').classList.add('active');
            document.getElementById('tarima-type-salida').classList.remove('active');
            document.getElementById('tarima-destino-section').style.display = 'none';
            document.getElementById('tarima-step-obs').textContent = '4';
        });
        document.getElementById('tarima-type-salida').addEventListener('click', () => {
            selectedType = 'salida';
            document.getElementById('tarima-type-salida').classList.add('active');
            document.getElementById('tarima-type-ingreso').classList.remove('active');
            document.getElementById('tarima-destino-section').style.display = '';
            document.getElementById('tarima-step-obs').textContent = '5';
        });

        document.getElementById('btn-cancel-tarima').addEventListener('click', () => this.hideForm());
        document.getElementById('btn-save-tarima').addEventListener('click', () => this.saveMovimiento(selectedType));
        modal.addEventListener('click', (e) => { if (e.target === modal) this.hideForm(); });

        const cantidadInput = document.getElementById('tarima-cantidad');
        if (cantidadInput) cantidadInput.focus();
    },

    showEditForm(id) {
        const record = this.records.find(r => r.id === id);
        if (!record) { showToast('Movimiento no encontrado', 'error'); return; }
        this.showForm(record.tipo, record);
    },

    hideForm() {
        const modal = document.getElementById('tarima-modal');
        if (modal) modal.remove();
        this.editingId = null;
    },

    async saveMovimiento(tipo) {
        if (AccessControl.level('tarimas') !== 'write') {
            showToast('No tienes permiso para modificar Tarimas Walmart.', 'warning');
            return;
        }
        const cantidad = parseInt(document.getElementById('tarima-cantidad').value, 10);
        if (!cantidad || cantidad <= 0) {
            showToast('Ingresa una cantidad válida', 'error');
            return;
        }

        const fechaStr = document.getElementById('tarima-fecha')?.value || '';
        if (!fechaStr) {
            showToast('Selecciona una fecha', 'error');
            return;
        }

        const fechaParts = fechaStr.split('-').map(Number);
        const fechaObj = new Date(fechaParts[0], fechaParts[1] - 1, fechaParts[2], 12, 0, 0);
        const fechaTs = firebase.firestore.Timestamp.fromDate(fechaObj);

        const destino = tipo === 'salida' ? (document.getElementById('tarima-destino')?.value || '').trim() : '';
        if (tipo === 'salida' && !destino) {
            showToast('El destino es obligatorio para salidas', 'error');
            return;
        }

        const observacion = (document.getElementById('tarima-observacion')?.value || '').trim();

        const saveBtn = document.getElementById('btn-save-tarima');
        setButtonLoading(saveBtn, true);

        try {
            const db = firebase.firestore();
            const user = firebase.auth().currentUser;
            const isEdit = !!this.editingId;

            if (isEdit) {
                const previo = this.records.find(r => r.id === this.editingId);
                await db.collection('tarimas_walmart').doc(this.editingId).update({
                    tipo: tipo,
                    cantidad: cantidad,
                    destino: destino,
                    observacion: observacion,
                    fecha: fechaTs,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                const prevMs = previo && previo.fecha ? this._tsMs(previo.fecha) : null;
                const desde = prevMs === null ? null : (prevMs < fechaTs.toMillis() ? previo.fecha : fechaTs);
                await this.recalcularTotales(desde);
                showToast('Movimiento actualizado', 'success');
            } else {
                const nuevoDoc = db.collection('tarimas_walmart').doc();
                await this.recalcularTotales(fechaTs, {
                    ref: nuevoDoc,
                    data: {
                        tipo: tipo,
                        cantidad: cantidad,
                        destino: destino,
                        observacion: observacion,
                        fecha: fechaTs,
                        createdBy: user ? user.uid : '',
                        createdByName: window.currentUserData?.displayName || 'Usuario'
                    }
                });
                showToast(tipo === 'ingreso' ? 'Entrada registrada' : 'Salida registrada', 'success');
            }

            this.hideForm();
        } catch (error) {
            console.error('Error saving movimiento:', error);
            showToast('Error al guardar: ' + error.message, 'error', 6000);
        } finally {
            setButtonLoading(saveBtn, false);
        }
    },

    _tsMs(fecha) {
        return fecha && typeof fecha.toMillis === 'function' ? fecha.toMillis() : new Date(fecha).getTime();
    },

    async recalcularTotales(desdeFecha, nuevo) {
        const db = firebase.firestore();
        const snapshot = await db.collection('tarimas_walmart')
            .orderBy('fecha', 'asc')
            .select('tipo', 'cantidad', 'fecha', 'totalDespues')
            .get();

        const desdeMs = desdeFecha ? this._tsMs(desdeFecha) : null;

        const items = snapshot.docs.map(d => ({ ref: d.ref, data: d.data(), isNew: false }));
        if (nuevo) items.push({ ref: nuevo.ref, data: nuevo.data, isNew: true });
        items.sort((a, b) => this._tsMs(a.data.fecha) - this._tsMs(b.data.fecha));

        let acumulado = 0;
        const updates = [];
        items.forEach(item => {
            const data = item.data;
            if (data.tipo === 'ingreso') acumulado += (data.cantidad || 0);
            else acumulado -= (data.cantidad || 0);
            if (desdeMs !== null && this._tsMs(data.fecha) < desdeMs) return;
            if (!item.isNew && (data.totalDespues || 0) === acumulado) return;
            updates.push(item.isNew
                ? { set: true, ref: item.ref, payload: Object.assign({}, data, { totalDespues: acumulado }) }
                : { set: false, ref: item.ref, payload: { totalDespues: acumulado } });
        });

        for (let i = 0; i < updates.length; i += 400) {
            const batch = db.batch();
            updates.slice(i, i + 400).forEach(u => {
                if (u.set) batch.set(u.ref, u.payload);
                else batch.update(u.ref, u.payload);
            });
            await batch.commit();
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
        if (!confirm(`¿Eliminar esta ${tipo} de ${record.cantidad} tarimas?\nEl total se recalculará automáticamente.`)) return;

        try {
            const db = firebase.firestore();
            await db.collection('tarimas_walmart').doc(id).delete();
            await this.recalcularTotales(record.fecha || null);
            showToast('Movimiento eliminado', 'success');
        } catch (error) {
            console.error('Error deleting movimiento:', error);
            showToast('Error al eliminar', 'error');
        }
    },

    cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
};

window.Tarimas = Tarimas;