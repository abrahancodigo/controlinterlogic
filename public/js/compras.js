// ===================================
// Ordenes de Compra Module
// ===================================

const Compras = {
    records: [],
    filtered: [],
    proveedores: [],
    loading: false,
    searchQuery: '',
    IVA_RATE: 0.13,
    _previewEl: null,

    async render() {
        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }
        return this.renderDesktop();
    },

    _esc(value) {
        return sanitizeHTML(value === null || value === undefined ? '' : value);
    },

    _num(value) {
        const n = Number(value);
        return isNaN(n) ? 0 : n;
    },

    _round(value) {
        return Math.round(value * 100) / 100;
    },

    _toDate(value) {
        if (!value) return null;
        if (typeof value.toDate === 'function') return value.toDate();
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    },

    _totals(partidas) {
        let subtotal = 0;
        (partidas || []).forEach(p => {
            subtotal += this._round(this._num(p.cantidad) * this._num(p.costo));
        });
        subtotal = this._round(subtotal);
        const iva = this._round(subtotal * this.IVA_RATE);
        const total = this._round(subtotal + iva);
        return { subtotal, iva, total };
    },

    _qty(value) {
        const n = this._num(value);
        return formatNumber(n, Number.isInteger(n) ? 0 : 2);
    },

    _partidasCount(order) {
        return Array.isArray(order.partidas) ? order.partidas.length : 0;
    },

    _estadoBadge(order) {
        const map = {
            pendiente: ['#f59e0b', 'Pendiente'],
            recibida: ['#16a34a', 'Recibida'],
            cancelada: ['#ef4444', 'Cancelada']
        };
        const item = map[order.estado] || map.pendiente;
        return `<span class="badge" style="background:${item[0]}20;color:${item[0]};">${item[1]}</span>`;
    },

    async loadRecords() {
        if (this.loading) return this._loadPromise;
        this.loading = true;
        const db = firebase.firestore();

        this._loadPromise = Promise.all([
            db.collection('ordenesCompra').orderBy('fecha', 'desc').limit(500).get(),
            db.collection('proveedores').orderBy('nombre', 'asc').get().catch(() => null)
        ])
            .then(([ordenesSnap, provSnap]) => {
                this.records = ordenesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.proveedores = provSnap
                    ? provSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    : [];
                this.applyFilters();
            })
            .catch(error => {
                console.error('Error al cargar ordenes de compra:', error);
                const code = error && error.code ? error.code : '';
                let msg = 'Error al cargar órdenes de compra';
                if (code === 'permission-denied') {
                    msg = 'Sin permiso para leer órdenes de compra (permission-denied). Faltan las reglas de Firestore.';
                } else if (code === 'failed-precondition') {
                    msg = 'Firestore pide un índice para esta consulta (failed-precondition).';
                } else if (code === 'unavailable') {
                    msg = 'Sin conexión con Firestore (unavailable). Revisa tu red.';
                } else if (code) {
                    msg = 'Error al cargar órdenes de compra (' + code + ')';
                }
                showToast(msg, 'error', 8000);
                this._renderLoadError(msg);
            })
            .finally(() => {
                this.loading = false;
                this._loadPromise = null;
            });

        return this._loadPromise;
    },

    _renderLoadError(message) {
        const row = '<div style="text-align:center;padding:2rem;color:#b91c1c;font-size:.88rem;">' +
            this._esc(message) +
            '<br><button class="btn btn-secondary" style="margin-top:.75rem;" onclick="Compras.loadRecords()">Reintentar</button></div>';

        const body = document.getElementById('oc-table-body');
        if (body) body.innerHTML = '<tr><td colspan="7" style="padding:0;">' + row + '</td></tr>';

        const list = document.getElementById('oc-m-list');
        if (list) list.innerHTML = row;
    },

    applyFilters() {
        const q = (this.searchQuery || '').toLowerCase().trim();
        let list = this.records.slice();

        if (q) {
            list = list.filter(order => {
                const text = [
                    order.folio,
                    order.proveedor,
                    order.notas,
                    ...(order.partidas || []).flatMap(p => [p.codigo, p.producto])
                ].join(' ').toLowerCase();
                return text.includes(q);
            });
        }

        this.filtered = list;

        if (window.innerWidth <= 768) {
            this.renderMobileCards();
        } else {
            this.renderTable();
            this.updateStats();
        }
    },

    async renderDesktop() {
        const content = document.getElementById('content-area');
        if (!content) return;

        content.innerHTML = `
            ${SharedComponents.renderModuleHeader({
                icon: 'compras',
                title: 'Órdenes de Compra',
                subtitle: 'Salidas de compra a proveedores'
            })}

            ${SharedComponents.renderStatsGrid([
                { label: 'Órdenes', id: 'oc-stat-total' },
                { label: 'Pendientes', id: 'oc-stat-pendientes' },
                { label: 'Monto del mes', id: 'oc-stat-monto' }
            ], { containerStyle: 'grid-template-columns: repeat(3, 1fr);' })}

            <div class="card">
                <div class="module-header">
                    ${SharedComponents.renderSearchBar({
                        id: 'oc-search',
                        placeholder: '🔍 Buscar por folio, proveedor, código o producto...',
                        fullWidth: false
                    })}
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                        ${window.permissions?.canCreate
                ? '<button class="btn btn-primary" id="oc-btn-new">➕ Nueva Orden</button>'
                : ''}
                    </div>
                </div>

                <div class="table-container" style="overflow-x:auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Folio</th>
                                <th>Fecha</th>
                                <th>Proveedor</th>
                                <th style="text-align:center;">Partidas</th>
                                <th style="text-align:right;">Total</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="oc-table-body">
                            <tr><td colspan="7" style="text-align:center;padding:2rem;">Cargando órdenes...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const search = document.getElementById('oc-search');
        if (search) {
            search.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.applyFilters();
            });
        }

        const body = document.getElementById('oc-table-body');
        if (body) {
            body.addEventListener('click', (e) => {
                const edit = e.target.closest('.oc-edit');
                if (edit) {
                    this.showForm(edit.dataset.id);
                    return;
                }
                const pdf = e.target.closest('.oc-pdf');
                if (pdf) {
                    this.showPdfPreview(pdf.dataset.id);
                    return;
                }
                const del = e.target.closest('.oc-del');
                if (del) {
                    this.deleteRecord(del.dataset.id);
                }
            });
        }

        document.getElementById('oc-btn-new')?.addEventListener('click', () => this.showForm());

        await this.loadRecords();
    },

    renderTable() {
        const body = document.getElementById('oc-table-body');
        if (!body) return;

        const canEdit = !!window.permissions?.canEdit;
        const canDelete = !!window.permissions?.canDelete;

        if (!this.filtered.length) {
            body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-secondary);">No hay órdenes de compra registradas</td></tr>';
            return;
        }

        body.innerHTML = this.filtered.map(order => {
            const totals = this._totals(order.partidas);
            const fecha = this._toDate(order.fecha);
            return `<tr>
                <td><strong>${this._esc(order.folio || '-')}</strong></td>
                <td>${fecha ? formatDateShort(fecha) : '-'}</td>
                <td>${this._esc(order.proveedor || '-')}</td>
                <td style="text-align:center;">${this._partidasCount(order)}</td>
                <td style="text-align:right;"><strong>${formatCurrency(totals.total)}</strong></td>
                <td>${this._estadoBadge(order)}</td>
                <td class="actions-cell">
                    <button class="btn-icon btn-secondary oc-pdf" data-id="${order.id}" title="Imprimir / PDF">🖨️</button>
                    ${canEdit ? `<button class="btn-icon btn-secondary oc-edit" data-id="${order.id}" title="Editar">✏️</button>` : ''}
                    ${canDelete ? `<button class="btn-icon btn-danger oc-del" data-id="${order.id}" title="Eliminar">🗑️</button>` : ''}
                </td>
            </tr>`;
        }).join('');
    },

    updateStats() {
        const now = new Date();
        let total = 0;
        let pendientes = 0;
        let monto = 0;

        this.records.forEach(order => {
            total += 1;
            const estado = order.estado || 'pendiente';
            if (estado === 'pendiente') pendientes += 1;
            const fecha = this._toDate(order.fecha);
            if (estado !== 'cancelada' && fecha && fecha.getMonth() === now.getMonth() && fecha.getFullYear() === now.getFullYear()) {
                monto += this._totals(order.partidas).total;
            }
        });

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setText('oc-stat-total', formatNumber(total));
        setText('oc-stat-pendientes', formatNumber(pendientes));
        setText('oc-stat-monto', formatCurrency(this._round(monto)));
    },

    async renderMobile() {
        const content = document.getElementById('content-area');
        if (!content) return;
        this.isMobile = true;

        content.innerHTML = `
            <div style="padding:0 0 8px 0;">
                <h1 style="font-size:1.35rem;font-weight:800;margin-bottom:2px;">🧾 Órdenes de Compra</h1>
                <p style="font-size:.78rem;color:#8e8e93;">Salidas de compra a proveedores</p>
            </div>
            <div class="m-actions-bar">
                ${window.permissions?.canCreate
                ? '<button class="btn btn-primary" id="oc-m-new" style="border-radius:20px;">➕ Nueva Orden</button>'
                : ''}
                <button class="btn" id="oc-m-refresh" style="border-radius:20px;">🔄 Actualizar</button>
            </div>
            <div class="m-search-bar" style="margin-bottom:.6rem;">
                <input type="search" id="oc-m-search" placeholder="Buscar folio, proveedor o producto..." class="form-control">
            </div>
            <div class="m-data-list" id="oc-m-list">
                <div style="text-align:center;padding:40px;color:#8e8e93;">Cargando órdenes...</div>
            </div>
        `;

        document.getElementById('oc-m-new')?.addEventListener('click', () => this.showForm());
        document.getElementById('oc-m-refresh')?.addEventListener('click', () => this.loadRecords());
        document.getElementById('oc-m-search')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.applyFilters();
        });

        const list = document.getElementById('oc-m-list');
        if (list) {
            list.addEventListener('click', (e) => {
                const pdf = e.target.closest('.oc-m-pdf');
                if (pdf) {
                    this.showPdfPreview(pdf.dataset.id);
                    return;
                }
                const del = e.target.closest('.oc-m-del');
                if (del) {
                    this.deleteRecord(del.dataset.id);
                    return;
                }
                const card = e.target.closest('.oc-m-card');
                if (card && window.permissions?.canEdit) {
                    this.showForm(card.dataset.id);
                }
            });
        }

        await this.loadRecords();
    },

    renderMobileCards() {
        const list = document.getElementById('oc-m-list');
        if (!list) return;

        if (!this.filtered.length) {
            list.innerHTML = '<div style="text-align:center;padding:40px;color:#8e8e93;">No hay órdenes de compra registradas</div>';
            return;
        }

        const canDelete = !!window.permissions?.canDelete;

        list.innerHTML = this.filtered.map(order => {
            const totals = this._totals(order.partidas);
            const fecha = this._toDate(order.fecha);
            const estado = (order.estado || 'pendiente');
            const color = estado === 'recibida' ? '#16a34a' : estado === 'cancelada' ? '#ef4444' : '#f59e0b';
            return `<div class="m-data-card oc-m-card" data-id="${order.id}" style="display:block;cursor:pointer;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;">
                    <strong style="font-size:.92rem;">${this._esc(order.folio || '-')}</strong>
                    <span style="color:${color};font-weight:700;font-size:.75rem;text-transform:capitalize;">${this._esc(estado)}</span>
                </div>
                <div style="font-size:.8rem;margin-top:.25rem;color:var(--text-secondary);">${this._esc(order.proveedor || '-')}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.4rem;font-size:.78rem;">
                    <span>${fecha ? formatDateShort(fecha) : '-'} · ${this._partidasCount(order)} partida(s)</span>
                    <strong style="font-size:.92rem;">${formatCurrency(totals.total)}</strong>
                </div>
                <div style="display:flex;gap:.4rem;margin-top:.55rem;">
                    <button class="btn btn-secondary oc-m-pdf" data-id="${order.id}" style="flex:1;border-radius:16px;font-size:.75rem;">🖨️ PDF</button>
                    ${canDelete ? `<button class="btn btn-danger oc-m-del" data-id="${order.id}" style="border-radius:16px;font-size:.75rem;">🗑️</button>` : ''}
                </div>
            </div>`;
        }).join('');
    },

    _partidaRowHtml(partida) {
        const p = partida || {};
        const cantidad = p.cantidad != null ? p.cantidad : 1;
        const costo = p.costo != null ? p.costo : 0;
        return `<div class="oc-row" style="display:flex;gap:.5rem;align-items:flex-start;margin-bottom:.4rem;flex-wrap:wrap;">
            <div class="form-group" style="margin:0;flex:0 0 100px;"><input type="text" class="oc-codigo" value="${this._esc(p.codigo)}" placeholder="Código"></div>
            <div class="form-group" style="margin:0;flex:1 1 160px;min-width:140px;"><input type="text" class="oc-producto" value="${this._esc(p.producto)}" placeholder="Producto"></div>
            <div class="form-group" style="margin:0;flex:0 0 80px;"><input type="number" class="oc-cantidad" value="${this._esc(cantidad)}" min="0" step="0.01" placeholder="Cant."></div>
            <div class="form-group" style="margin:0;flex:0 0 105px;"><input type="number" class="oc-costo" value="${this._esc(costo)}" min="0" step="0.01" placeholder="Costo"></div>
            <span class="oc-importe" style="flex:0 0 100px;text-align:right;font-weight:700;font-size:.82rem;padding-top:.65rem;">${formatCurrency(this._round(this._num(cantidad) * this._num(costo)))}</span>
            <button type="button" class="btn-icon btn-danger oc-del-row" title="Quitar" style="flex:0 0 32px;margin-top:.3rem;">✕</button>
        </div>`;
    },

    _readFormPartidas() {
        const container = document.getElementById('oc-partidas');
        if (!container) return [];
        return Array.from(container.querySelectorAll('.oc-row')).map(row => ({
            codigo: row.querySelector('.oc-codigo').value.trim(),
            producto: row.querySelector('.oc-producto').value.trim(),
            cantidad: this._num(row.querySelector('.oc-cantidad').value),
            costo: this._num(row.querySelector('.oc-costo').value)
        })).filter(p => p.producto || p.codigo);
    },

    _refreshFormTotals() {
        const container = document.getElementById('oc-partidas');
        if (!container) return;

        container.querySelectorAll('.oc-row').forEach(row => {
            const cantidad = this._num(row.querySelector('.oc-cantidad').value);
            const costo = this._num(row.querySelector('.oc-costo').value);
            const importe = row.querySelector('.oc-importe');
            if (importe) importe.textContent = formatCurrency(this._round(cantidad * costo));
        });

        const totals = this._totals(this._readFormPartidas());
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setText('oc-sum-subtotal', formatCurrency(totals.subtotal));
        setText('oc-sum-iva', formatCurrency(totals.iva));
        setText('oc-sum-total', formatCurrency(totals.total));
    },

    showForm(id) {
        const isEdit = !!id;
        if (isEdit && !window.permissions?.canEdit) {
            showToast('No tienes permisos para editar', 'error');
            return;
        }
        if (!isEdit && !window.permissions?.canCreate) {
            showToast('No tienes permisos para crear', 'error');
            return;
        }

        const order = isEdit ? this.records.find(r => r.id === id) : null;
        if (isEdit && !order) return;

        const fecha = this._toDate(order?.fecha);
        const fechaValue = fecha ? formatDateForInput(fecha) : formatDateForInput(new Date());
        const partidas = order && Array.isArray(order.partidas) && order.partidas.length
            ? order.partidas
            : [{}];

        const datalistOptions = this.proveedores
            .map(p => `<option value="${this._esc(p.nombre || '')}"></option>`)
            .join('');

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:960px;width:100%;max-height:92vh;overflow-y:auto;">
                <h2 style="margin-bottom:1rem;">${isEdit ? '✏️ Editar' : '➕ Nueva'} Orden de Compra</h2>
                <form id="oc-form">
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;">
                        <div class="form-group" style="min-width:0;">
                            <label>Fecha</label>
                            <input type="date" id="oc-fecha" value="${fechaValue}" required>
                        </div>
                        <div class="form-group" style="min-width:0;">
                            <label>Folio</label>
                            <input type="text" id="oc-folio" value="${this._esc(order?.folio || '')}" placeholder="Se genera al guardar" readonly>
                        </div>
                        <div class="form-group" style="min-width:0;">
                            <label>Estado</label>
                            <select id="oc-estado">
                                <option value="pendiente"${(order?.estado || 'pendiente') === 'pendiente' ? ' selected' : ''}>Pendiente</option>
                                <option value="recibida"${order?.estado === 'recibida' ? ' selected' : ''}>Recibida</option>
                                <option value="cancelada"${order?.estado === 'cancelada' ? ' selected' : ''}>Cancelada</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top:1rem;">
                        <label>Proveedor</label>
                        <input type="text" id="oc-proveedor" list="oc-proveedores-list" value="${this._esc(order?.proveedor || '')}" placeholder="Escribe o elige un proveedor" required>
                        <datalist id="oc-proveedores-list">${datalistOptions}</datalist>
                    </div>

                    <div style="margin-top:1.25rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;gap:.5rem;flex-wrap:wrap;">
                            <label style="font-weight:600;">Partidas</label>
                            <button type="button" class="btn btn-secondary" id="oc-add-row" style="font-size:.8rem;">➕ Agregar partida</button>
                        </div>
                        <div style="border:1px solid var(--border-color);border-radius:8px;padding:.75rem;">
                            <div id="oc-partidas"></div>
                        </div>
                    </div>

                    <div style="display:flex;justify-content:flex-end;gap:1rem 2rem;margin-top:1rem;padding:.75rem 1rem;border:1px solid var(--border-color);border-radius:8px;flex-wrap:wrap;background:var(--bg-secondary);">
                        <div style="display:flex;gap:.5rem;font-size:.85rem;white-space:nowrap;">
                            <span style="color:var(--text-secondary);">Subtotal</span>
                            <strong id="oc-sum-subtotal">$0.00</strong>
                        </div>
                        <div style="display:flex;gap:.5rem;font-size:.85rem;white-space:nowrap;">
                            <span style="color:var(--text-secondary);">IVA (13%)</span>
                            <strong id="oc-sum-iva">$0.00</strong>
                        </div>
                        <div style="display:flex;gap:.5rem;font-size:.95rem;white-space:nowrap;padding-left:1rem;border-left:1px solid var(--border-color);">
                            <span style="color:var(--text-secondary);">Total</span>
                            <strong id="oc-sum-total" style="color:#2563eb;">$0.00</strong>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top:1rem;">
                        <label>Notas</label>
                        <textarea id="oc-notas" rows="2" placeholder="Observaciones de la orden">${this._esc(order?.notas || '')}</textarea>
                    </div>

                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" id="oc-cancel">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="oc-save">${isEdit ? 'Guardar Cambios' : 'Crear Orden'}</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        const partidasContainer = document.getElementById('oc-partidas');
        partidasContainer.innerHTML = partidas.map(p => this._partidaRowHtml(p)).join('');

        document.getElementById('oc-add-row').addEventListener('click', () => {
            partidasContainer.insertAdjacentHTML('beforeend', this._partidaRowHtml({}));
            this._refreshFormTotals();
        });

        partidasContainer.addEventListener('input', () => this._refreshFormTotals());
        partidasContainer.addEventListener('click', (e) => {
            const remove = e.target.closest('.oc-del-row');
            if (!remove) return;
            if (partidasContainer.querySelectorAll('.oc-row').length <= 1) {
                showToast('Debe quedar al menos una partida', 'warning');
                return;
            }
            remove.closest('.oc-row').remove();
            this._refreshFormTotals();
        });

        document.getElementById('oc-cancel').addEventListener('click', () => modal.remove());
        this._refreshFormTotals();

        document.getElementById('oc-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('oc-save');
            setButtonLoading(saveBtn, true);
            try {
                await this._save(id, modal);
            } finally {
                setButtonLoading(saveBtn, false);
            }
        });
    },

    async _save(id, modal) {
        const db = firebase.firestore();
        const proveedor = document.getElementById('oc-proveedor').value.trim();
        const fechaInput = document.getElementById('oc-fecha').value;
        const partidas = this._readFormPartidas();

        if (!proveedor) {
            showToast('Indica el proveedor', 'error');
            return;
        }
        if (!fechaInput) {
            showToast('Indica la fecha', 'error');
            return;
        }
        if (!partidas.length) {
            showToast('Agrega al menos una partida', 'error');
            return;
        }
        if (partidas.some(p => !p.producto || p.cantidad <= 0)) {
            showToast('Cada partida necesita producto y cantidad mayor a cero', 'error');
            return;
        }

        const [year, month, day] = fechaInput.split('-').map(Number);
        const localDate = new Date(year, month - 1, day, 12, 0, 0);
        const totals = this._totals(partidas);
        const proveedorMatch = this.proveedores.find(p =>
            String(p.nombre || '').trim().toLowerCase() === proveedor.toLowerCase());

        const data = {
            fecha: firebase.firestore.Timestamp.fromDate(localDate),
            proveedor: proveedor,
            proveedorId: proveedorMatch ? proveedorMatch.id : null,
            partidas: partidas,
            subtotal: totals.subtotal,
            iva: totals.iva,
            total: totals.total,
            estado: document.getElementById('oc-estado').value,
            notas: document.getElementById('oc-notas').value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedByName: window.currentUserData?.displayName || 'Usuario'
        };

        try {
            if (id) {
                await db.collection('ordenesCompra').doc(id).update(data);
                showToast('✓ Orden actualizada', 'success');
            } else {
                const folio = await this._nextFolio();
                const existente = await db.collection('ordenesCompra').where('folio', '==', folio).limit(1).get();
                if (!existente.empty) {
                    showToast('El folio ' + folio + ' ya existe. Intenta de nuevo.', 'error');
                    return;
                }
                data.folio = folio;
                data.createdBy = firebase.auth().currentUser?.uid || null;
                data.createdByName = window.currentUserData?.displayName || 'Usuario';
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('ordenesCompra').add(data);
                showToast('✓ Orden creada', 'success');
            }
            if (modal) modal.remove();
            await this.loadRecords();
        } catch (error) {
            console.error('Error al guardar orden de compra:', error);
            showToast('Error al guardar: ' + error.message, 'error');
        }
    },

    async _nextFolio() {
        const db = firebase.firestore();
        const year = new Date().getFullYear();
        const counterRef = db.collection('config').doc('counters');
        const yearKey = 'ordenesCompra_' + year;
        let folio = '';

        await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            const counters = counterDoc.exists ? counterDoc.data() : {};
            const next = (counters[yearKey] || 0) + 1;
            folio = `OC-${year}-${String(next).padStart(4, '0')}`;
            transaction.set(counterRef, { [yearKey]: next }, { merge: true });
        });

        return folio;
    },

    async deleteRecord(id) {
        if (!window.permissions?.canDelete) {
            showToast('No tienes permisos para eliminar', 'error');
            return;
        }
        const order = this.records.find(r => r.id === id);
        const label = order?.folio ? ' ' + order.folio : '';
        if (!await showConfirm('¿Eliminar la orden' + label + '?', 'Esta acción no se puede deshacer.')) return;

        try {
            await firebase.firestore().collection('ordenesCompra').doc(id).delete();
            this.records = this.records.filter(r => r.id !== id);
            this.applyFilters();
            showToast('Orden eliminada', 'success');
        } catch (error) {
            console.error('Error al eliminar orden:', error);
            showToast('Error al eliminar: ' + error.message, 'error');
        }
    },

    _buildDocumentHtml(order, settings) {
        const esc = (v) => this._esc(v);
        const totals = this._totals(order.partidas);
        const logo1 = sanitizeUrl(settings.logo1 || '');
        const logo2 = sanitizeUrl(settings.logo2 || '');
        const companyName = settings.companyName || 'DALSE';
        const fecha = this._toDate(order.fecha);

        const rows = (order.partidas || []).map(p => {
            const importe = this._round(this._num(p.cantidad) * this._num(p.costo));
            return `<tr>
                <td>${esc(p.codigo || '-')}</td>
                <td>${esc(p.producto || '-')}</td>
                <td style="text-align:right;">${this._qty(p.cantidad)}</td>
                <td style="text-align:right;">${formatCurrency(this._num(p.costo))}</td>
                <td style="text-align:right;">${formatCurrency(importe)}</td>
            </tr>`;
        }).join('');

        return `<div style="font-family:Arial,Helvetica,sans-serif;padding:20px;max-width:800px;margin:0 auto;color:#172b4d;background:#fff;line-height:1.4;overflow-wrap:anywhere;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:24px;border-top:5px solid #173b63;border-bottom:1px solid #cbd5e1;padding:22px 8px;margin-bottom:20px;break-inside:avoid;">
                ${logo1
                    ? `<img src="${logo1}" alt="Logo DALSE" style="height:78px;max-width:220px;object-fit:contain;">`
                    : `<span style="font-size:30px;letter-spacing:3px;font-weight:bold;color:#173b63;">DALSE</span>`}
                ${logo2
                    ? `<img src="${logo2}" alt="Logo INCEDE" style="height:78px;max-width:220px;object-fit:contain;">`
                    : (companyName.trim().toUpperCase() !== 'DALSE'
                        ? `<span style="font-size:18px;font-weight:bold;color:#334155;">${esc(companyName)}</span>`
                        : '')}
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;gap:20px;padding:14px 16px;border:1px solid #cbd5e1;border-left:4px solid #173b63;border-radius:6px;margin-bottom:22px;break-inside:avoid;">
                <div>
                    <h2 style="margin:0;font-size:16px;color:#173b63;">ORDEN DE COMPRA</h2>
                    <p style="margin:4px 0 0;font-size:11px;color:#526174;">Compra de materiales y suministros</p>
                </div>
                <div style="text-align:right;">
                    <p style="margin:0;font-weight:bold;font-size:15px;">Folio: ${esc(order.folio || '-')}</p>
                    <p style="margin:5px 0 0;font-size:12px;color:#526174;">Fecha: ${fecha ? formatDateShort(fecha) : '-'}</p>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:2fr 1fr;gap:15px;margin-bottom:20px;break-inside:avoid;">
                <div style="padding:12px;border:1px solid #ddd;border-radius:8px;">
                    <strong style="display:block;margin-bottom:5px;color:#666;font-size:0.85rem;text-transform:uppercase;">Proveedor</strong>
                    <span style="font-size:1rem;font-weight:bold;">${esc(order.proveedor || '-')}</span>
                </div>
                <div style="padding:12px;border:1px solid #ddd;border-radius:8px;">
                    <strong style="display:block;margin-bottom:5px;color:#666;font-size:0.85rem;text-transform:uppercase;">Estado</strong>
                    <span style="font-size:1rem;font-weight:bold;text-transform:capitalize;">${esc(order.estado || 'pendiente')}</span>
                </div>
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px;">
                <thead>
                    <tr style="background:#eef2f7;color:#173b63;">
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;width:16%;">Código</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Producto</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:right;width:12%;">Cantidad</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:right;width:18%;">Costo unit.</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:right;width:18%;">Importe</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="5" style="border:1px solid #cbd5e1;padding:12px;text-align:center;color:#64748b;">Sin partidas</td></tr>'}
                </tbody>
            </table>

            <div style="display:flex;justify-content:flex-end;break-inside:avoid;">
                <table style="border-collapse:collapse;font-size:12px;min-width:260px;">
                    <tr>
                        <td style="padding:6px 12px;color:#526174;">Subtotal</td>
                        <td style="padding:6px 12px;text-align:right;font-weight:bold;">${formatCurrency(totals.subtotal)}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 12px;color:#526174;">IVA (13%)</td>
                        <td style="padding:6px 12px;text-align:right;font-weight:bold;">${formatCurrency(totals.iva)}</td>
                    </tr>
                    <tr style="border-top:2px solid #173b63;">
                        <td style="padding:8px 12px;font-weight:bold;color:#173b63;">TOTAL</td>
                        <td style="padding:8px 12px;text-align:right;font-weight:bold;font-size:14px;color:#173b63;">${formatCurrency(totals.total)}</td>
                    </tr>
                </table>
            </div>

            ${order.notas
                    ? `<div style="margin-top:18px;break-inside:avoid;">
                    <strong style="display:block;margin-bottom:4px;color:#666;font-size:0.8rem;text-transform:uppercase;">Notas</strong>
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;font-size:11px;white-space:pre-wrap;">${esc(order.notas)}</div>
                </div>`
                    : ''}

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:46px;break-inside:avoid;">
                <div style="text-align:center;">
                    <div style="height:64px;"></div>
                    <div style="border-top:1.5px solid #0f172a;padding-top:8px;">
                        <strong style="display:block;font-size:0.85rem;">Entrega</strong>
                        <span style="font-size:10px;color:#64748b;">DALSE</span>
                    </div>
                </div>
                <div style="text-align:center;">
                    <div style="height:64px;"></div>
                    <div style="border-top:1.5px solid #0f172a;padding-top:8px;">
                        <strong style="display:block;font-size:0.85rem;">Recibe</strong>
                        <span style="font-size:10px;color:#64748b;">${esc(order.proveedor || 'Proveedor')}</span>
                    </div>
                </div>
            </div>

            <div style="margin-top:32px;text-align:center;color:#64748b;font-size:10px;border-top:1px solid #cbd5e1;padding-top:12px;">
                <strong style="color:#173b63;letter-spacing:1px;">DALSE</strong> · Orden de compra<br>
                Documento generado el: ${new Date().toLocaleString('es-SV')}
            </div>
        </div>`;
    },

    async showPdfPreview(id) {
        const order = this.records.find(r => r.id === id);
        if (!order) return;

        const printArea = document.getElementById('print-area');
        if (!printArea) {
            showToast('Área de impresión no disponible', 'error');
            return;
        }

        if (window.Settings && window.Settings.loadSettings) {
            await window.Settings.loadSettings();
        }
        const settings = window.Settings?.settings || {};

        const docHtml = this._buildDocumentHtml(order, settings);
        this._closePreview();
        printArea.innerHTML = docHtml;
        await this._waitImages(printArea);

        const preview = document.createElement('div');
        preview.id = 'oc-preview';
        preview.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10002;padding:1rem;';
        preview.innerHTML = `
            <div style="background:#fff;border-radius:1rem;max-width:900px;width:100%;max-height:95vh;display:flex;flex-direction:column;position:relative;">
                <button id="oc-preview-close" style="position:absolute;top:10px;right:10px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:1.1rem;cursor:pointer;z-index:10;">✕</button>
                <div style="padding:.85rem 1.5rem;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;gap:1rem;">
                    <h3 style="margin:0;font-size:1rem;">📄 Vista previa — ${this._esc(order.folio || 'Orden de compra')}</h3>
                    <div style="display:flex;gap:.5rem;margin-right:48px;">
                        <button id="oc-preview-pdf" class="btn btn-accent">📥 Descargar PDF</button>
                        <button id="oc-preview-print" class="btn btn-primary">🖨️ Imprimir</button>
                    </div>
                </div>
                <div style="flex:1;overflow:auto;padding:1.25rem;background:#e5e5e5;">
                    <div style="background:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.15);margin:0 auto;width:8.5in;min-height:11in;padding:.5in;box-sizing:border-box;">
                        ${printArea.innerHTML}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(preview);
        this._previewEl = preview;

        document.getElementById('oc-preview-close').onclick = () => this._closePreview();

        document.getElementById('oc-preview-print').onclick = () => {
            preview.style.display = 'none';
            window.print();
            setTimeout(() => this._closePreview(), 500);
        };

        document.getElementById('oc-preview-pdf').onclick = async () => {
            try {
                await ensureLib('html2pdf');
            } catch (e) {
                showToast('PDF no disponible (sin conexión al CDN)', 'error');
                return;
            }
            const btn = document.getElementById('oc-preview-pdf');
            const original = btn.innerHTML;
            btn.innerHTML = '⏳ Generando...';
            btn.disabled = true;
            let wrapper = null;
            try {
                wrapper = document.createElement('div');
                wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;';
                const source = document.createElement('div');
                source.style.cssText = 'width:7.5in;background:#ffffff;';
                source.innerHTML = docHtml;
                wrapper.appendChild(source);
                document.body.appendChild(wrapper);
                await this._waitImages(source);

                const opt = {
                    margin: [0.5, 0.5, 0.5, 0.5],
                    filename: `OrdenCompra_${order.folio || order.id}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'] }
                };
                await html2pdf().set(opt).from(source).save();
                showToast('PDF descargado exitosamente', 'success');
            } catch (error) {
                console.error('Error generando PDF:', error);
                showToast('Error al generar PDF', 'error');
            } finally {
                if (wrapper) wrapper.remove();
                btn.innerHTML = original;
                btn.disabled = false;
            }
        };

        preview.addEventListener('click', (e) => {
            if (e.target === preview) this._closePreview();
        });
    },

    _waitImages(root) {
        return Promise.all(Array.from(root.querySelectorAll('img')).map(img =>
            new Promise((resolve) => {
                if (img.complete) resolve();
                else {
                    img.onload = resolve;
                    img.onerror = resolve;
                }
            })
        ));
    },

    _closePreview() {
        if (this._previewEl) {
            this._previewEl.remove();
            this._previewEl = null;
        }
        const printArea = document.getElementById('print-area');
        if (printArea) printArea.innerHTML = '';
    },

    cleanup() {
        this._closePreview();
        this.searchQuery = '';
    }
};

window.Compras = Compras;

if (window.ModuleRegistry) {
    ModuleRegistry.register({
        key: 'compras',
        label: 'Órdenes de Compra',
        render: () => Compras.render(),
        cleanup: () => Compras.cleanup()
    });
}
