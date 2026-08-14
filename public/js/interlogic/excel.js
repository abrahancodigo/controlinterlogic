// ===================================
// Interlogic - Excel Module (Import/Export)
// ===================================

const InterlogicExcel = {
    mobileExportExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('Librería Excel no disponible', 'error');
            return;
        }
        if (this.filteredRecords.length === 0) {
            showToast('No hay datos', 'warning');
            return;
        }
        var self = this;
        var visibleCols = this.columnDefs.filter(function(c) {
            return c.key !== 'acciones' && !self.hiddenColumns.includes(c.key);
        });
        var data = this.filteredRecords.map(function(r) {
            var row = {};
            visibleCols.forEach(function(c) {
                if (c.key === 'fecha') row[c.label] = r.fecha ? formatDate(r.fecha, false) : '';
                else if (c.key === 'venta' || c.key === 'costoEnvio' || c.key === 'bultos') row[c.label] = self.signedAmount(r, c.key);
                else if (c.key === 'costoPorcentaje') row[c.label] = Number(r.costoPorcentaje || 0);
                else row[c.label] = r[c.key] || '';
            });
            return row;
        });
        var ws = XLSX.utils.json_to_sheet(data);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
        XLSX.writeFile(wb, 'Interlogic_' + formatDateForInput(new Date()) + '.xlsx');
        showToast('Excel exportado');
    },

    exportToExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('Error: Librería de Excel no cargada.', 'error');
            return;
        }

        if (this.filteredRecords.length === 0) {
            showToast('No hay datos para exportar.', 'warning');
            return;
        }

        const parseLocalDateStr = (str) => {
            const p = String(str).split('-');
            return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        };
        const dateStrStart = this.filters.startDate ? formatDate(parseLocalDateStr(this.filters.startDate), false) : '(Inicio)';
        const dateStrEnd = this.filters.endDate ? formatDate(parseLocalDateStr(this.filters.endDate), false) : '(Fin)';

        const visibleCols = this.columnDefs.filter(c =>
            c.key !== 'acciones' && !this.hiddenColumns.includes(c.key)
        );

        const headers = visibleCols.map(c => c.label);

        const idxVenta = visibleCols.findIndex(c => c.key === 'venta');
        const idxBultos = visibleCols.findIndex(c => c.key === 'bultos');
        const idxEnvio = visibleCols.findIndex(c => c.key === 'costoEnvio');

        const rows = this.filteredRecords.map(r =>
            visibleCols.map(c => {
                if (c.key === 'fecha') return r.fecha ? formatDate(r.fecha, false) : '';
                if (c.key === 'venta' || c.key === 'costoEnvio' || c.key === 'bultos') return this.signedAmount(r, c.key);
                if (c.key === 'costoPorcentaje') return (Number(r.costoPorcentaje || 0) / 100);
                return r[c.key] || '';
            })
        );

        const totalVenta = idxVenta >= 0 ? rows.reduce((sum, row) => sum + (Number(row[idxVenta]) || 0), 0) : 0;
        const totalBultos = idxBultos >= 0 ? rows.reduce((sum, row) => sum + (Number(row[idxBultos]) || 0), 0) : 0;
        const totalEnvio = idxEnvio >= 0 ? rows.reduce((sum, row) => sum + (Number(row[idxEnvio]) || 0), 0) : 0;

        const totalRow = visibleCols.map((c, i) => {
            if (i === idxVenta) return totalVenta;
            if (i === idxBultos) return totalBultos;
            if (i === idxEnvio) return totalEnvio;
            if (i === idxVenta - 1) return 'TOTALES:';
            return '';
        });

        const finalAOA = [
            ['REPORTE DE CONTROL INTERLOGIC'],
            [`Periodo: ${dateStrStart} al ${dateStrEnd}`],
            [],
            headers,
            ...rows,
            [],
            totalRow
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(finalAOA);

        const colWidths = visibleCols.map(() => ({ wch: 14 }));
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');

        const dateNow = formatDateForInput(new Date());
        const filename = `Reporte_Interlogic_${dateNow}.xlsx`;

        XLSX.writeFile(workbook, filename);
        showToast('Reporte Excel profesional generado.');
    },

    showImportExcel() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <h2 style="margin-bottom: 1.5rem;">📤 Importar desde Excel</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Selecciona un archivo Excel (.xlsx) con las columnas en este orden:</p>
                <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem; font-size: 0.85rem; overflow-x: auto;">
                    <code>Guía | Empresa | Fecha | Doc | Doc # | Cliente | Teléfono | Departamento | Municipio | Vendedor | Condición | Venta | Cajas | Total | Bultos</code>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 1.5rem;">Columnas de la tabla como <strong>Observaciones</strong>, <strong>Entrega</strong>, <strong>Cobra</strong>, <strong>Encargado</strong>, <strong>Envío</strong> y <strong>% Costo</strong> no se importan desde el Excel (se calculan solas o se llenan a mano después de importar).</p>
                <div class="form-group" style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.5rem;">
                        <input type="checkbox" id="import-use-custom-date" checked style="width: 18px; height: 18px; cursor: pointer;">
                        <strong>📅 Usar fecha personalizada para todos los registros</strong>
                    </label>
                    <input type="date" id="import-custom-date" value="${getLocalDateString()}" style="padding: 0.5rem 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); width: 100%; font-size: 0.95rem;">
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.4rem;">Si está activado, todos los registros importados usarán esta fecha en lugar de la fecha del Excel.</p>
                </div>
                <div class="form-group">
                    <input type="file" id="import-file" accept=".xlsx,.xls,.csv" style="padding: 1rem; border: 2px dashed var(--gray-300); border-radius: var(--radius-md); width: 100%; cursor: pointer;">
                </div>
                <div id="import-preview" style="display: none; margin-top: 1rem; max-height: 300px; overflow-y: auto;"></div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="button" class="btn btn-secondary" id="import-cancel">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="import-confirm" disabled>Importar Registros</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const customDateCheckbox = document.getElementById('import-use-custom-date');
        const customDateInput = document.getElementById('import-custom-date');
        customDateCheckbox.addEventListener('change', () => {
            customDateInput.disabled = !customDateCheckbox.checked;
            customDateInput.style.opacity = customDateCheckbox.checked ? '1' : '0.5';
        });

        let parsedData = [];

        document.getElementById('import-file').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    const startRow = (rows[0] && typeof rows[0][0] === 'string' && isNaN(rows[0][0])) ? 1 : 0;

                    parsedData = [];
                    for (let i = startRow; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r || r.length === 0 || (!r[0] && !r[5])) continue;
                        parsedData.push({
                            guia: String(r[0] || ''),
                            empresa: String(r[1] || ''),
                            fecha: r[2] || null,
                            doc: String(r[3] || ''),
                            docNum: String(r[4] || ''),
                            cliente: String(r[5] || ''),
                            telefono: String(r[6] || ''),
                            departamento: String(r[7] || ''),
                            municipio: String(r[8] || ''),
                            vendedor: String(r[9] || ''),
                            condicionPago: String(r[10] || ''),
                            venta: parseExcelNumber(r[11]),
                            cobrador: String(r[12] || ''),
                            total: parseExcelNumber(r[13]),
                            bultos: parseExcelNumber(r[14])
                        });
                    }

                    const preview = document.getElementById('import-preview');
                    if (parsedData.length > 0) {
                        preview.style.display = 'block';
                        preview.innerHTML = `
                            <p style="margin-bottom: 0.5rem;"><strong>${parsedData.length} registros encontrados:</strong></p>
                            <table style="width: 100%; font-size: 0.8rem;">
                                <thead><tr><th>Guía</th><th>Empresa</th><th>Cliente</th><th>Venta</th><th>Bultos</th></tr></thead>
                                <tbody>
                                    ${parsedData.slice(0, 10).map(d => `
                                        <tr>
                                            <td>${sanitizeHTML(d.guia || '')}</td>
                                            <td>${sanitizeHTML(d.empresa || '')}</td>
                                            <td>${sanitizeHTML(d.cliente || '')}</td>
                                            <td>${formatCurrency(d.venta)}</td>
                                            <td>${formatNumber(d.bultos || 0)}</td>
                                        </tr>
                                    `).join('')}
                                    ${parsedData.length > 10 ? '<tr><td colspan="5" style="text-align:center">... y ' + (parsedData.length - 10) + ' más</td></tr>' : ''}
                                </tbody>
                            </table>
                        `;
                        document.getElementById('import-confirm').disabled = false;
                    } else {
                        preview.style.display = 'block';
                        preview.innerHTML = '<p style="color: var(--error);">No se encontraron registros válidos en el archivo.</p>';
                    }
                } catch (err) {
                    console.error('Error parsing Excel:', err);
                    showToast('Error al leer el archivo: ' + err.message, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        };

        document.getElementById('import-confirm').onclick = async () => {
            if (parsedData.length === 0) return;

            const confirmBtn = document.getElementById('import-confirm');
            setButtonLoading(confirmBtn, true);

            try {
                const db = firebase.firestore();
                const uid = firebase.auth().currentUser.uid;

                const useCustomDate = document.getElementById('import-use-custom-date').checked;
                const customDateVal = document.getElementById('import-custom-date').value;
                let customFirebaseDate = null;
                if (useCustomDate && customDateVal) {
                    const [y, m, d] = customDateVal.split('-').map(Number);
                    customFirebaseDate = firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
                }

                const chunkSize = 500;
                for (let i = 0; i < parsedData.length; i += chunkSize) {
                    const chunk = parsedData.slice(i, i + chunkSize);
                    const batch = db.batch();
                    chunk.forEach(record => {
                        const ref = db.collection('interlogic').doc();
                        const costoEnvio = record.bultos * 1.85;
                        const costoPorcentaje = record.venta > 0 ? (costoEnvio / record.venta) * 100 : 0;

                        let firebaseDate = customFirebaseDate;
                        if (!customFirebaseDate && record.fecha) {
                            try {
                                let d = record.fecha;
                                if (typeof d === 'number') {
                                    const excelEpoch = new Date(1899, 11, 30);
                                    d = new Date(excelEpoch.getTime() + d * 86400000);
                                    d.setHours(12, 0, 0, 0);
                                } else if (!(d instanceof Date)) {
                                    d = new Date(d);
                                }
                                if (!isNaN(d.getTime())) {
                                    firebaseDate = firebase.firestore.Timestamp.fromDate(d);
                                }
                            } catch (e) { /* ignore */ }
                        }

                        batch.set(ref, {
                            ...record,
                            fecha: firebaseDate,
                            costoEnvio,
                            costoPorcentaje,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            createdBy: uid,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await batch.commit();
                }

                if (window.Clientes) {
                    const seenClients = new Set();
                    for (const record of parsedData) {
                        if (record.cliente && !seenClients.has(record.cliente.toLowerCase().trim())) {
                            seenClients.add(record.cliente.toLowerCase().trim());
                            Clientes.saveFromRecord({
                                nombre: record.cliente,
                                direccion: record.direccion || '',
                                telefono: record.telefono || '',
                                departamento: record.departamento || record.zona || '',
                                municipio: record.municipio || '',
                                vendedor: record.vendedor || '',
                                empresa: record.empresa || '',
                                condicionPago: record.condicionPago || ''
                            });
                        }
                    }
                    Interlogic._invalidateClientCache();
                }

                showToast(`✓ ${parsedData.length} registros importados`, 'success');
                modal.remove();
                await this.loadRecords();
            } catch (error) {
                console.error('Import error:', error);
                showToast('Error al importar: ' + error.message, 'error');
                setButtonLoading(confirmBtn, false);
            }
        };

        document.getElementById('import-cancel').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    },

    toggleColumn(colKey, visible) {
        if (visible) {
            this.hiddenColumns = this.hiddenColumns.filter(c => c !== colKey);
        } else {
            if (!this.hiddenColumns.includes(colKey)) {
                this.hiddenColumns.push(colKey);
            }
        }
        localStorage.setItem('il_hidden_cols', JSON.stringify(this.hiddenColumns));
        this.applyColumnVisibility();
    },

    showAllColumns() {
        this.hiddenColumns = [];
        localStorage.setItem('il_hidden_cols', '[]');
        const popup = document.getElementById('columns-popup');
        if (popup) {
            popup.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        }
        this.applyColumnVisibility();
    },

    applyColumnVisibility() {
        let styleEl = document.getElementById('il-col-visibility-style');
        if (styleEl) styleEl.remove();

        if (this.hiddenColumns.length === 0) return;

        const rules = [];
        this.hiddenColumns.forEach(colKey => {
            const idx = this.columnDefs.findIndex(c => c.key === colKey);
            if (idx >= 0) {
                const nth = idx + 2;
                rules.push(`#il-data-table th:nth-child(${nth}), #il-data-table td:nth-child(${nth}) { display: none; }`);
            }
        });

        if (rules.length > 0) {
            styleEl = document.createElement('style');
            styleEl.id = 'il-col-visibility-style';
            styleEl.textContent = rules.join('\n');
            document.head.appendChild(styleEl);
        }
    }
};

window.InterlogicExcel = InterlogicExcel;
