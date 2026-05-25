// ===================================
// Liquidación Module
// ===================================

const Liquidacion = {
    records: [],
    filteredRecords: [],
    currentView: 'contado', // 'contado' or 'credito'
    filters: {
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    },
    unsubscribe: null,

    // Render Contado view
    async renderContado() {
        this.currentView = 'contado';
        await this.render();
    },

    // Render Crédito view
    async renderCredito() {
        this.currentView = 'credito';
        await this.render();
    },

    // Main render
    async render() {
        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }
        const contentArea = document.getElementById('content-area');
        const isContado = this.currentView === 'contado';
        const title = isContado ? '💵 Liquidación Contado' : '💳 Liquidación Crédito';
        const subtitle = isContado
            ? 'Entregas pagadas al contado'
            : 'Entregas a crédito - Control de cobros';

        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>${title}</h1>
                    <p>${subtitle}</p>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <div class="form-group" style="margin-bottom: 0; display: flex; align-items: center; gap: 0.5rem;">
                        <label for="liq-filter-start-date" style="margin-bottom: 0; white-space: nowrap;">📅 Desde:</label>
                        <input type="date" id="liq-filter-start-date" class="form-control" value="${this.filters.startDate}" style="padding: 0.4rem; font-size: 0.8rem;">
                        <label for="liq-filter-end-date" style="margin-bottom: 0; white-space: nowrap;">Hasta:</label>
                        <input type="date" id="liq-filter-end-date" class="form-control" value="${this.filters.endDate}" style="padding: 0.4rem; font-size: 0.8rem;">
                    </div>
                    <button id="liq-btn-print" class="btn btn-primary">
                        🖨️ Imprimir
                    </button>
                    <button id="liq-btn-export-excel" class="btn btn-secondary">
                        📥 Exportar Excel
                    </button>
                </div>
            </div>

            <div class="stats-grid" id="liquidacion-stats">
                <div class="stat-card">
                    <h3>Total Entregado</h3>
                    <p id="liq-stat-total-entregado">$0.00</p>
                </div>
                ${isContado ? '' : `
                    <div class="stat-card">
                        <h3>Total Cobrado</h3>
                        <p id="liq-stat-total-cobrado" style="color: #22c55e;">$0.00</p>
                    </div>
                    <div class="stat-card">
                        <h3>Pendiente de Cobro</h3>
                        <p id="liq-stat-pendiente" style="color: #f97316;">$0.00</p>
                    </div>
                `}
                <div class="stat-card">
                    <h3>Cantidad</h3>
                    <p id="liq-stat-cantidad">0</p>
                </div>
            </div>

            <div class="card">
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Guía</th>
                                <th>Empresa</th>
                                <th>Fecha Entrega</th>
                                <th>Cliente</th>
                                <th>Venta</th>
                                ${isContado ? '' : '<th>¿Cobrado?</th><th>Fecha Cobro</th>'}
                            </tr>
                        </thead>
                        <tbody id="liquidacion-table-body">
                            <tr>
                                <td colspan="${isContado ? 5 : 7}" style="text-align: center; padding: 2rem;">Cargando registros...</td>
                            </tr>
                        </tbody>
                        <tfoot id="liquidacion-table-footer"></tfoot>
                    </table>
                </div>
            </div>
        `;

        // Load records
        await this.loadRecords();

        // Setup event listeners
        const startEl = document.getElementById('liq-filter-start-date');
        if (startEl) startEl.addEventListener('change', (e) => {
            this.filters.startDate = e.target.value;
            this.applyFilters();
        });
        const endEl = document.getElementById('liq-filter-end-date');
        if (endEl) endEl.addEventListener('change', (e) => {
            this.filters.endDate = e.target.value;
            this.applyFilters();
        });
        const printBtn = document.getElementById('liq-btn-print');
        if (printBtn) printBtn.addEventListener('click', () => this.printReport());
        const exportBtn = document.getElementById('liq-btn-export-excel');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToExcel());

        this.applyStyles();
    },

    // Load records from Firestore
    async loadRecords() {
        if (this.unsubscribe) this.unsubscribe();

        const db = firebase.firestore();
        // Note: We only filter by 'entregado' to avoid needing a composite index
        // Sorting is done in JavaScript after fetching
        this.unsubscribe = db.collection('interlogic')
            .where('entregado', '==', true)
            .onSnapshot(snapshot => {
                this.records = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Sort by createdAt descending in JavaScript
                this.records.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                    return dateB - dateA;
                });
                this.applyFilters();
            }, error => {
                console.error('Error loading records:', error);
                showToast('Error en sincronización: ' + error.message, 'error');
            });
    },

    applyFilters() {
        const condicion = this.currentView === 'contado' ? 'Contado' : 'Crédito';

        this.filteredRecords = this.records.filter(record => {
            // Filter by condition
            if (record.condicionPago !== condicion) return false;

            // Filter by date range
            const recordDate = record.fecha
                ? (record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha)).toISOString().split('T')[0]
                : '';
            if (this.filters.startDate && recordDate < this.filters.startDate) return false;
            if (this.filters.endDate && recordDate > this.filters.endDate) return false;

            return true;
        });

        if (this.isMobile) {
            this.renderMobileCards();
        } else {
            this.renderTable();
            this.updateStats();
        }
    },

    renderTable() {
        const body = document.getElementById('liquidacion-table-body');
        if (!body) return;

        const isContado = this.currentView === 'contado';
        const colspan = isContado ? 5 : 7;

        if (this.filteredRecords.length === 0) {
            body.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; padding: 2rem;">No hay registros coincidentes.</td></tr>`;
            return;
        }

        body.innerHTML = this.filteredRecords.map(record => {
            const estadoCobro = record.estadoCobro || (record.cobrado === true ? 'pagado' : 'pendiente');
            const montoCobrado = Number(record.montoCobrado || (record.cobrado === true ? record.venta : 0));
            const pctCobrado = record.venta > 0 ? Math.round((montoCobrado / Number(record.venta)) * 100) : 0;
            const fechaCobro = record.fechaCobro
                ? (record.fechaCobro.toDate ? formatDate(record.fechaCobro, false) : record.fechaCobro)
                : '';

            const badgeColor = estadoCobro === 'pagado' ? 'badge-success' : estadoCobro === 'parcial' ? 'badge-warning' : 'badge-error';
            const badgeText = estadoCobro === 'pagado' ? 'Pagado' : estadoCobro === 'parcial' ? 'Parcial' : 'Pendiente';
            const barColor = estadoCobro === 'pagado' ? '#22c55e' : '#f97316';

            return `
                <tr class="${estadoCobro === 'pagado' ? 'liq-row-cobrado' : 'liq-row-pendiente'}">
                    <td><strong>${record.guia || ''}</strong></td>
                    <td><span class="badge ${record.empresa === 'DALSE' ? 'badge-primary' : 'badge-accent'}">${record.empresa || ''}</span></td>
                    <td>${record.fecha ? formatDate(record.fecha, false) : ''}</td>
                    <td>${sanitizeHTML(record.cliente || '')}</td>
                    <td style="font-weight: 700;">$${Number(record.venta || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    ${isContado ? '' : `
                        <td style="text-align: center;">
                            <span class="badge ${badgeColor}">${badgeText}</span>
                            ${montoCobrado > 0 ? `<div style="margin-top:4px;font-size:0.7rem;color:#666;">$${formatNumber(montoCobrado,0)}</div>` : ''}
                        </td>
                        <td>
                            <div style="display:flex;align-items:center;gap:4px;min-width:120px;">
                                <div style="flex:1;height:6px;background:#e5e5ea;border-radius:3px;overflow:hidden;">
                                    <div style="height:100%;width:${pctCobrado}%;background:${barColor};border-radius:3px;transition:width 0.3s;"></div>
                                </div>
                                <span style="font-size:0.7rem;color:#666;white-space:nowrap;">${pctCobrado}% ${estadoCobro === 'pagado' ? fechaCobro : ''}</span>
                            </div>
                            ${estadoCobro !== 'pagado' ? `<button class="btn btn-sm btn-primary" onclick="Liquidacion.showAbonoModal('${record.id}')" style="margin-top:4px;font-size:0.7rem;padding:2px 8px;">💰 Abono</button>` : ''}
                        </td>
                    `}
                </tr>
            `;
        }).join('');

        this.updateFooter();
    },

    updateFooter() {
        const tfoot = document.getElementById('liquidacion-table-footer');
        if (!tfoot) return;

        const isContado = this.currentView === 'contado';
        const total = this.filteredRecords.reduce((acc, r) => acc + Number(r.venta || 0), 0);
        const colspan = isContado ? 4 : 4;

        tfoot.innerHTML = `
            <tr class="ds-totals-row">
                <td colspan="${colspan}" style="text-align: right;">TOTAL:</td>
                <td>$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                ${isContado ? '' : '<td colspan="2"></td>'}
            </tr>
        `;
    },

    updateStats() {
        const isContado = this.currentView === 'contado';
        const totalEntregado = this.filteredRecords.reduce((acc, r) => acc + Number(r.venta || 0), 0);
        const cantidad = this.filteredRecords.length;

        const entregadoEl = document.getElementById('liq-stat-total-entregado');
        if (entregadoEl) entregadoEl.textContent = `$${totalEntregado.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

        const cantidadEl = document.getElementById('liq-stat-cantidad');
        if (cantidadEl) cantidadEl.textContent = cantidad;

        if (!isContado) {
            const totalCobrado = this.filteredRecords.reduce((acc, r) => {
                const montoCobrado = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
                return acc + montoCobrado;
            }, 0);
            const pendiente = totalEntregado - totalCobrado;

            const cobradoEl = document.getElementById('liq-stat-total-cobrado');
            if (cobradoEl) cobradoEl.textContent = `$${totalCobrado.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

            const pendienteEl = document.getElementById('liq-stat-pendiente');
            if (pendienteEl) pendienteEl.textContent = `$${pendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        }
    },

    showAbonoModal(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record) return;

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        const montoPendiente = Number(record.venta || 0) - Number(record.montoCobrado || (record.cobrado === true ? record.venta : 0));

        const settings = window.Settings?.settings || {};
        const descPP = parseFloat(settings.descuentoProntoPago) || 0;
        const diasPP = parseInt(settings.diasProntoPago) || 10;
        let prontoPagoInfo = '';
        let descuentoPosible = 0;
        if (descPP > 0 && record.fecha) {
            const fechaRecord = record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha);
            const diasDesde = Math.floor((new Date() - fechaRecord) / (86400000));
            if (diasDesde <= diasPP && montoPendiente > 0) {
                descuentoPosible = Math.round(montoPendiente * descPP) / 100;
                prontoPagoInfo = `
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;margin-top:1rem;">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85rem;color:#166534;">
                            <input type="checkbox" id="ab-pronto-pago" onchange="document.getElementById('ab-monto').value=this.checked?'${(montoPendiente - descuentoPosible).toFixed(2)}':'${montoPendiente.toFixed(2)}';document.getElementById('ab-descuento-label').style.display=this.checked?'block':'none';">
                            ⚡ Aplicar descuento por pronto pago (${descPP}% = $${descuentoPosible.toFixed(2)})
                        </label>
                        <div id="ab-descuento-label" style="display:none;margin-top:4px;font-size:0.75rem;color:#166534;">
                            Total a pagar con descuento: $${(montoPendiente - descuentoPosible).toFixed(2)}
                        </div>
                    </div>`;
            }
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <h2 style="margin-bottom: 1rem;">💰 Registrar Abono</h2>
                <div style="margin-bottom: 1rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
                        <span>Guía: <strong>#${record.guia || 'N/A'}</strong></span>
                        <span>Cliente: <strong>${sanitizeHTML(record.cliente || '-')}</strong></span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:4px;">
                        <span>Total Venta: <strong>$${Number(record.venta||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
                        <span>Pendiente: <strong style="color:#f97316;">$${(montoPendiente).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
                    </div>
                </div>

                <form id="abono-form">
                    <div class="form-group">
                        <label>Monto del Abono *</label>
                        <input type="number" id="ab-monto" step="0.01" min="0.01" max="${montoPendiente}" value="${montoPendiente}" required style="width:100%;">
                    </div>

                    ${prontoPagoInfo}

                    <div class="form-group" style="margin-top:1rem;">
                        <label>Método de Pago</label>
                        <select id="ab-metodo" style="width:100%;">
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="deposito">Depósito</option>
                            <option value="tarjeta">Tarjeta</option>
                        </select>
                    </div>

                    <div class="form-group" style="margin-top:1rem;">
                        <label>Fecha del Abono</label>
                        <input type="date" id="ab-fecha" value="${getLocalDateString()}" style="width:100%;">
                    </div>

                    <div class="form-group" style="margin-top:1rem;">
                        <label>Referencia (opcional)</label>
                        <input type="text" id="ab-referencia" placeholder="N° de operación, nota..." style="width:100%;">
                    </div>

                    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="ab-save-btn">💾 Guardar Abono</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        document.getElementById('abono-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAbono(recordId, modal);
        });
    },

    async saveAbono(recordId, modal) {
        const montoInput = document.getElementById('ab-monto');
        const metodo = document.getElementById('ab-metodo').value;
        const fechaVal = document.getElementById('ab-fecha').value;
        const referencia = document.getElementById('ab-referencia').value.trim();
        const monto = parseFloat(montoInput.value) || 0;

        const record = this.records.find(r => r.id === recordId);
        if (!record) return;

        const ventaTotal = Number(record.venta || 0);
        const montoPrev = Number(record.montoCobrado || (record.cobrado === true ? ventaTotal : 0));
        const pendiente = ventaTotal - montoPrev;

        if (monto <= 0) { showToast('El monto debe ser mayor a 0', 'error'); return; }
        if (monto > pendiente) { showToast('El abono excede el saldo pendiente', 'error'); return; }

        const saveBtn = document.getElementById('ab-save-btn');
        setButtonLoading(saveBtn, true);

        try {
            const db = firebase.firestore();
            const nuevoMontoCobrado = montoPrev + monto;
            const estado = nuevoMontoCobrado >= ventaTotal ? 'pagado' : 'parcial';

            let firebaseDate = firebase.firestore.Timestamp.now();
            if (fechaVal) {
                const [y, m, d] = fechaVal.split('-').map(Number);
                firebaseDate = firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
            }

            const cobroData = {
                interlogicId: recordId,
                cliente: record.cliente || '',
                monto: monto,
                metodo: metodo,
                fecha: firebaseDate,
                referencia: referencia,
                cobrador: firebase.auth().currentUser?.uid || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const updateData = {
                montoCobrado: nuevoMontoCobrado,
                montoPendiente: ventaTotal - nuevoMontoCobrado,
                estadoCobro: estado,
                cobrado: estado === 'pagado',
                fechaCobro: estado === 'pagado' ? firebase.firestore.FieldValue.serverTimestamp() : null,
                metodoPago: metodo,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const batch = db.batch();
            batch.set(db.collection('cobros').doc(), cobroData);
            batch.update(db.collection('interlogic').doc(recordId), updateData);
            await batch.commit();

            record.montoCobrado = nuevoMontoCobrado;
            record.montoPendiente = ventaTotal - nuevoMontoCobrado;
            record.estadoCobro = estado;
            record.cobrado = estado === 'pagado';
            record.metodoPago = metodo;

            modal.remove();
            this.applyFilters();
            showToast('✅ Abono registrado: $' + formatNumber(monto, 2), 'success');
        } catch (error) {
            console.error('Error saving abono:', error);
            showToast('Error al guardar: ' + error.message, 'error');
            setButtonLoading(saveBtn, false);
        }
    },

    async printReport() {
        const printArea = document.getElementById('print-area');
        if (!printArea) return;
        const isContado = this.currentView === 'contado';
        const title = isContado ? 'Liquidación Contado' : 'Liquidación Crédito';

        if (window.Settings && window.Settings.loadSettings) {
            await window.Settings.loadSettings();
        }
        const settings = window.Settings?.settings || {};
        const companyName = settings.companyName || 'DALSE';
        const printLogo = settings.logo2 || settings.logo1 || '';

        const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        const startStr = this.filters.startDate ? new Date(this.filters.startDate + 'T12:00:00').toLocaleDateString('es-ES') : '';
        const endStr = this.filters.endDate ? new Date(this.filters.endDate + 'T12:00:00').toLocaleDateString('es-ES') : '';

        let logoHTML = '';
        if (printLogo) {
            logoHTML = `<img src="${printLogo}" alt="Logo" style="max-height: 60px; max-width: 150px; object-fit: contain;">`;
        }

        const total = this.filteredRecords.reduce((acc, r) => acc + Number(r.venta || 0), 0);

        printArea.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 1000px; margin: 0 auto; color: #000;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        ${logoHTML}
                        <div>
                            <h1 style="font-size: 1.8rem; margin: 0; color: #000;">${sanitizeHTML(companyName)}</h1>
                            <p style="margin: 5px 0 0 0; color: #555; font-size: 1rem;">${title}</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-weight: bold;">${startStr} — ${endStr}</p>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 0.85rem;">Generado: ${today}</p>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead>
                        <tr style="background: #f0f0f0;">
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Guía</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Empresa</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Fecha</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Cliente</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Venta</th>
                            ${isContado ? '' : '<th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Estado</th><th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Cobrado</th><th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Pendiente</th>'}
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filteredRecords.map(r => {
                            const estado = r.estadoCobro || (r.cobrado === true ? 'pagado' : 'pendiente');
                            const cobrado = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
                            const pendiente = Math.max(0, Number(r.venta || 0) - cobrado);
                            const bg = estado === 'pagado' ? 'background: #f0fdf4;' : estado === 'parcial' ? 'background: #fffbeb;' : '';
                            return `
                                <tr style="${bg}">
                                    <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">${r.guia || ''}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">${sanitizeHTML(r.empresa || '')}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">${r.fecha ? formatDateShort(r.fecha) : ''}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">${sanitizeHTML(r.cliente || '')}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px; text-align: right; font-weight: bold;">$${Number(r.venta || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    ${isContado ? '' : `
                                        <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${estado.charAt(0).toUpperCase() + estado.slice(1)}</td>
                                        <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">$${cobrado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        <td style="border: 1px solid #ccc; padding: 8px; text-align: right; color: ${pendiente > 0 ? '#ef4444' : '#22c55e'};">$${pendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    `}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #e5e5e5; font-weight: bold;">
                            <td colspan="${isContado ? 6 : 8}" style="border: 1px solid #ccc; padding: 8px; text-align: right;">TOTAL (${this.filteredRecords.length} registros):</td>
                            <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            ${isContado ? '' : '<td colspan="2" style="border: 1px solid #ccc; padding: 8px;"></td>'}
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 30px; text-align: center; color: #888; font-size: 0.75rem; border-top: 1px dashed #eee; padding-top: 15px;">
                    ${this.filteredRecords.length} registro(s) · Generado el ${today}
                </div>
            </div>
        `;

        const previewModal = document.createElement('div');
        previewModal.id = 'print-preview-modal';
        previewModal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10002; padding: 1rem;
        `;

        previewModal.innerHTML = `
            <div style="background: white; border-radius: 1rem; max-width: 1100px; width: 100%; max-height: 95vh; display: flex; flex-direction: column; position: relative;">
                <button id="close-print-preview" style="
                    position: absolute; top: 10px; right: 10px;
                    background: #ef4444; color: white; border: none;
                    border-radius: 50%; width: 36px; height: 36px;
                    font-size: 1.2rem; cursor: pointer; display: flex;
                    align-items: center; justify-content: center; z-index: 10;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                ">✕</button>
                <div style="padding: 1rem 2rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0;">📄 Vista Previa — ${title}</h3>
                    <div style="display: flex; gap: 0.5rem; margin-right: 50px;">
                        <button id="btn-do-print" class="btn btn-primary">🖨️ Imprimir</button>
                    </div>
                </div>
                <div style="flex: 1; overflow-y: auto; overflow-x: auto; padding: 1.5rem; background: #e5e5e5;">
                    <div style="background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.15); margin: 0 auto; width: 100%; max-width: 1000px; padding: 0.5in; box-sizing: border-box;">
                        ${printArea.innerHTML}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(previewModal);

        document.getElementById('close-print-preview').onclick = () => {
            previewModal.remove();
            printArea.innerHTML = '';
        };

        document.getElementById('btn-do-print').onclick = () => {
            previewModal.style.display = 'none';
            setTimeout(() => window.print(), 100);
            setTimeout(() => {
                previewModal.remove();
                printArea.innerHTML = '';
            }, 1000);
        };
    },

    exportToExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('Error: XLSX no cargado', 'error');
            return;
        }
        const isContado = this.currentView === 'contado';
        const headers = isContado
            ? ['Guía', 'Empresa', 'Fecha', 'Cliente', 'Total']
            : ['Guía', 'Empresa', 'Fecha', 'Cliente', 'Total', 'Estado', 'Cobrado', 'Pendiente'];

        const rows = this.filteredRecords.map(r => {
            const estado = r.estadoCobro || (r.cobrado === true ? 'pagado' : 'pendiente');
            const base = [
                r.guia || '',
                r.empresa || '',
                r.fecha ? formatDate(r.fecha, false) : '',
                r.cliente || '',
                Number(r.venta || 0)
            ];
            if (!isContado) {
                base.push(estado.charAt(0).toUpperCase() + estado.slice(1));
                base.push(Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0)));
                base.push(Math.max(0, Number(r.venta || 0) - Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0))));
            }
            return base;
        });

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        const sheetName = isContado ? 'Liquidacion_Contado' : 'Liquidacion_Credito';
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, `${sheetName}.xlsx`);
    },

    applyStyles() {
        if (document.getElementById('liq-styles')) return;
        const style = document.createElement('style');
        style.id = 'liq-styles';
        style.textContent = `
            .liq-row-cobrado { background-color: rgba(34, 197, 94, 0.08) !important; }
            .liq-row-pendiente { border-left: 3px solid #f97316; }
            .badge-success { background: #22c55e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
            .badge-warning { background: #f97316; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
        `;
        document.head.appendChild(style);
    },

    // ============= MOBILE RENDER =============
    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        this.isMobile = true;
        const isContado = this.currentView === 'contado';

        contentArea.innerHTML = `
            <div style="padding:0 0 8px 0;">
                <h1 style="font-size:1.35rem;font-weight:800;margin-bottom:2px;color:var(--m-text);">${isContado ? '💵 Contado' : '💳 Crédito'}</h1>
                <p style="font-size:0.78rem;color:var(--m-text-secondary);">${isContado ? 'Entregas al contado' : 'Control de cobros'}</p>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
                <input type="date" id="mliq-start" value="${this.filters.startDate}" style="flex:1;padding:10px;border:1px solid #e5e5ea;border-radius:12px;font-size:0.85rem;background:white;min-height:42px;font-family:var(--font-family);">
                <input type="date" id="mliq-end" value="${this.filters.endDate}" style="flex:1;padding:10px;border:1px solid #e5e5ea;border-radius:12px;font-size:0.85rem;background:white;min-height:42px;font-family:var(--font-family);">
            </div>
            <div class="m-stats-row" id="mliq-stats">
                <div class="m-stat-chip"><div class="m-stat-chip-label">Entregado</div><div class="m-stat-chip-value" id="mliq-entregado">$0</div></div>
                ${isContado ? '' : '<div class="m-stat-chip"><div class="m-stat-chip-label">Cobrado</div><div class="m-stat-chip-value" id="mliq-cobrado" style="color:#10b981;">$0</div></div>'}
                ${isContado ? '' : '<div class="m-stat-chip"><div class="m-stat-chip-label">Pendiente</div><div class="m-stat-chip-value" id="mliq-pendiente" style="color:#f97316;">$0</div></div>'}
                <div class="m-stat-chip"><div class="m-stat-chip-label">Registros</div><div class="m-stat-chip-value" id="mliq-count">0</div></div>
            </div>
            <div class="m-actions-bar">
                <button class="btn btn-primary" id="mliq-btn-print" style="border-radius:20px;">🖨️ Imprimir</button>
                <button class="btn" id="mliq-btn-export" style="border-radius:20px;">📥 Excel</button>
            </div>
            <div class="m-data-list" id="mliq-data-list">
                <div style="text-align:center;padding:40px;color:#8e8e93;">Cargando...</div>
            </div>
        `;

        await this.loadRecords();

        document.getElementById('mliq-start').addEventListener('change', e => { this.filters.startDate = e.target.value; this.applyFilters(); });
        document.getElementById('mliq-end').addEventListener('change', e => { this.filters.endDate = e.target.value; this.applyFilters(); });
        document.getElementById('mliq-btn-print').addEventListener('click', () => this.printReport());
        document.getElementById('mliq-btn-export').addEventListener('click', () => this.mobileExportExcel());
    },

    renderMobileCards() {
        var list = document.getElementById('mliq-data-list');
        if (!list) return;
        var isContado = this.currentView === 'contado';

        if (this.filteredRecords.length === 0) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📭</div><div class="m-empty-title">Sin registros</div><div class="m-empty-text">No hay resultados para este período.</div></div>';
        } else {
            list.innerHTML = this.filteredRecords.map(function(r) {
                var estadoCobro = r.estadoCobro || (r.cobrado === true ? 'pagado' : 'pendiente');
                var montoCobrado = Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0));
                var pct = r.venta > 0 ? Math.round((montoCobrado / Number(r.venta)) * 100) : 0;
                var badgeLabel = estadoCobro === 'pagado' ? '✓ Pagado' : estadoCobro === 'parcial' ? '⏳ Parcial' : '⚠ Pendiente';
                var badgeStyle = estadoCobro === 'pagado' ? 'color:#10b981;' : estadoCobro === 'parcial' ? 'color:#f97316;' : 'color:#ef4444;';
                return '<div class="m-data-card">' +
                    '<div class="m-card-header"><span class="m-card-title">#' + (r.guia || 'N/A') + '</span>' +
                    '<span class="m-card-badge ' + (r.empresa === 'DALSE' ? 'primary' : 'warning') + '">' + (r.empresa || '') + '</span></div>' +
                    '<div class="m-card-rows">' +
                    '<div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value">' + sanitizeHTML(r.cliente || '-') + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Venta</span><span class="m-card-value money">$' + formatNumber(r.venta || 0, 2) + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">' + (r.fecha ? formatDateShort(r.fecha) : '-') + '</span></div>' +
                    (isContado ? '' : '<div class="m-card-row"><span class="m-card-label">Estado</span><span class="m-card-value" style="' + badgeStyle + ';font-weight:700;">' + badgeLabel + ' ' + pct + '%</span></div>') +
                    '</div>' +
                    (isContado ? '' : '<div class="m-card-actions" onclick="event.stopPropagation()">' +
                        '<div style="flex:1;height:4px;background:#e5e5ea;border-radius:2px;overflow:hidden;margin-right:8px;"><div style="height:100%;width:' + pct + '%;background:' + (estadoCobro === 'pagado' ? '#10b981' : '#f97316') + ';border-radius:2px;"></div></div>' +
                        (estadoCobro !== 'pagado' ? '<button class="m-card-action" onclick="Liquidacion.showAbonoModal(\'' + r.id + '\')" title="Registrar abono" style="color:#7c3aed;font-weight:700;">💰</button>' : '') +
                    '</div>') +
                '</div>';
            }, this).join('');
        }

        var totalEntregado = this.filteredRecords.reduce(function(s, r) { return s + (parseFloat(r.venta) || 0); }, 0);
        var totalCobrado = this.filteredRecords.reduce(function(s, r) {
            return s + (Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0)));
        }, 0);
        var pendiente = totalEntregado - totalCobrado;

        var set = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
        set('mliq-entregado', '$' + formatNumber(totalEntregado, 0));
        set('mliq-count', this.filteredRecords.length);
        if (!isContado) {
            set('mliq-cobrado', '$' + formatNumber(totalCobrado, 0));
            set('mliq-pendiente', '$' + formatNumber(pendiente, 0));
        }
    },

    mobileExportExcel() {
        if (typeof XLSX === 'undefined') { showToast('Librería Excel no disponible', 'error'); return; }
        if (this.filteredRecords.length === 0) { showToast('No hay datos', 'warning'); return; }
        var isContado = this.currentView === 'contado';
        var data = this.filteredRecords.map(function(r) {
            var estado = r.estadoCobro || (r.cobrado === true ? 'pagado' : 'pendiente');
            var row = {'Guía': r.guia||'', 'Empresa': r.empresa||'', 'Fecha': r.fecha?formatDateShort(r.fecha):'', 'Cliente': r.cliente||'', 'Venta': r.venta||0};
            if (!isContado) { row['Estado'] = estado.charAt(0).toUpperCase() + estado.slice(1); row['Cobrado'] = '$' + formatNumber(r.montoCobrado || (r.cobrado === true ? r.venta : 0), 2); row['Pendiente'] = '$' + formatNumber((r.venta||0) - Number(r.montoCobrado || (r.cobrado === true ? r.venta : 0)), 2); }
            return row;
        });
        var ws = XLSX.utils.json_to_sheet(data);
        var wb = XLSX.utils.book_new();
        var name = isContado ? 'Liquidacion_Contado' : 'Liquidacion_Credito';
        XLSX.utils.book_append_sheet(wb, ws, name);
        XLSX.writeFile(wb, name + '_' + new Date().toISOString().split('T')[0] + '.xlsx');
        showToast('Excel exportado');
    }
};

window.Liquidacion = Liquidacion;
