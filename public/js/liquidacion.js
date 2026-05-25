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
            const isCobrado = record.cobrado === true;
            const fechaCobro = record.fechaCobro
                ? (record.fechaCobro.toDate ? formatDate(record.fechaCobro, false) : record.fechaCobro)
                : '';

            return `
                <tr class="${isCobrado ? 'liq-row-cobrado' : 'liq-row-pendiente'}">
                    <td><strong>${record.guia || ''}</strong></td>
                    <td><span class="badge ${record.empresa === 'DALSE' ? 'badge-primary' : 'badge-accent'}">${record.empresa || ''}</span></td>
                    <td>${record.fecha ? formatDate(record.fecha, false) : ''}</td>
                    <td>${sanitizeHTML(record.cliente || '')}</td>
                    <td style="font-weight: 700;">$${Number(record.venta || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    ${isContado ? '' : `
                        <td style="text-align: center;">
                            <label class="ds-switch">
                                <input type="checkbox" ${isCobrado ? 'checked' : ''} 
                                       onchange="Liquidacion.toggleCobrado('${record.id}', this.checked)">
                                <span class="ds-slider"></span>
                            </label>
                        </td>
                        <td>
                            ${isCobrado ? `<span class="badge badge-success">${fechaCobro}</span>` : '<span class="badge badge-warning">Pendiente</span>'}
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
            const totalCobrado = this.filteredRecords
                .filter(r => r.cobrado === true)
                .reduce((acc, r) => acc + Number(r.venta || 0), 0);
            const pendiente = totalEntregado - totalCobrado;

            const cobradoEl = document.getElementById('liq-stat-total-cobrado');
            if (cobradoEl) cobradoEl.textContent = `$${totalCobrado.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

            const pendienteEl = document.getElementById('liq-stat-pendiente');
            if (pendienteEl) pendienteEl.textContent = `$${pendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        }
    },

    async toggleCobrado(recordId, checked) {
        try {
            const updateData = {
                cobrado: checked,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (checked) {
                updateData.fechaCobro = firebase.firestore.FieldValue.serverTimestamp();
            } else {
                updateData.fechaCobro = null;
            }

            await firebase.firestore().collection('interlogic').doc(recordId).update(updateData);
            showToast(checked ? '✅ Marcado como cobrado' : '↩️ Desmarcado', 'success');
        } catch (error) {
            console.error('Error updating cobrado:', error);
            showToast('Error al actualizar: ' + error.message, 'error');
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
                            ${isContado ? '' : '<th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Cobrado</th><th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Fecha Cobro</th>'}
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filteredRecords.map(r => {
                            const cobrado = r.cobrado === true;
                            const fechaCobro = r.fechaCobro ? (r.fechaCobro.toDate ? formatDateShort(r.fechaCobro) : r.fechaCobro) : '';
                            return `
                                <tr${cobrado ? ' style="background: #f0fdf4;"' : ''}>
                                    <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">${r.guia || ''}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">${sanitizeHTML(r.empresa || '')}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">${r.fecha ? formatDateShort(r.fecha) : ''}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">${sanitizeHTML(r.cliente || '')}</td>
                                    <td style="border: 1px solid #ccc; padding: 8px; text-align: right; font-weight: bold;">$${Number(r.venta || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    ${isContado ? '' : `
                                        <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${cobrado ? '✓ Sí' : '✗ No'}</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">${fechaCobro}</td>
                                    `}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #e5e5e5; font-weight: bold;">
                            <td colspan="${isContado ? 4 : 6}" style="border: 1px solid #ccc; padding: 8px; text-align: right;">TOTAL:</td>
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
            : ['Guía', 'Empresa', 'Fecha', 'Cliente', 'Total', 'Cobrado', 'Fecha Cobro'];

        const rows = this.filteredRecords.map(r => {
            const base = [
                r.guia || '',
                r.empresa || '',
                r.fecha ? formatDate(r.fecha, false) : '',
                r.cliente || '',
                Number(r.venta || 0)
            ];
            if (!isContado) {
                base.push(r.cobrado ? 'SÍ' : 'NO');
                base.push(r.fechaCobro ? formatDate(r.fechaCobro, false) : '');
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
                var cobrado = r.cobrado === true;
                return '<div class="m-data-card">' +
                    '<div class="m-card-header"><span class="m-card-title">#' + (r.guia || 'N/A') + '</span>' +
                    '<span class="m-card-badge ' + (r.empresa === 'DALSE' ? 'primary' : 'warning') + '">' + (r.empresa || '') + '</span></div>' +
                    '<div class="m-card-rows">' +
                    '<div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value">' + sanitizeHTML(r.cliente || '-') + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Venta</span><span class="m-card-value money">$' + formatNumber(r.venta || 0, 2) + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">' + (r.fecha ? formatDateShort(r.fecha) : '-') + '</span></div>' +
                    (isContado ? '' : '<div class="m-card-row"><span class="m-card-label">Cobrado</span><span class="m-card-value" style="color:' + (cobrado ? '#10b981' : '#f97316') + ';font-weight:700;">' + (cobrado ? '✓ Sí' : '⏳ No') + '</span></div>') +
                    '</div>' +
                    (isContado ? '' : '<div class="m-card-actions" onclick="event.stopPropagation()">' +
                        '<button class="m-card-action" onclick="Liquidacion.toggleCobradoMobile(\'' + r.id + '\',' + cobrado + ')" title="' + (cobrado ? 'Desmarcar cobro' : 'Marcar cobrado') + '" style="color:' + (cobrado ? '#f97316' : '#10b981') + ';">' + (cobrado ? '↩️' : '✅') + '</button>' +
                    '</div>') +
                '</div>';
            }, this).join('');
        }

        var totalEntregado = this.filteredRecords.reduce(function(s, r) { return s + (parseFloat(r.venta) || 0); }, 0);
        var totalCobrado = this.filteredRecords.filter(function(r) { return r.cobrado === true; }).reduce(function(s, r) { return s + (parseFloat(r.venta) || 0); }, 0);
        var pendiente = totalEntregado - totalCobrado;

        var set = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
        set('mliq-entregado', '$' + formatNumber(totalEntregado, 0));
        set('mliq-count', this.filteredRecords.length);
        if (!isContado) {
            set('mliq-cobrado', '$' + formatNumber(totalCobrado, 0));
            set('mliq-pendiente', '$' + formatNumber(pendiente, 0));
        }
    },

    toggleCobradoMobile(id, currentState) {
        this.toggleCobrado(id, !currentState);
    },

    mobileExportExcel() {
        if (typeof XLSX === 'undefined') { showToast('Librería Excel no disponible', 'error'); return; }
        if (this.filteredRecords.length === 0) { showToast('No hay datos', 'warning'); return; }
        var isContado = this.currentView === 'contado';
        var data = this.filteredRecords.map(function(r) {
            var row = {'Guía': r.guia||'', 'Empresa': r.empresa||'', 'Fecha': r.fecha?formatDateShort(r.fecha):'', 'Cliente': r.cliente||'', 'Venta': r.venta||0};
            if (!isContado) { row['Cobrado'] = r.cobrado ? 'Sí' : 'No'; }
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
