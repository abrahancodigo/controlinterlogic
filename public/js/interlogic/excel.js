// ===================================
// Interlogic - Excel Module (Import/Export)
// ===================================

const InterlogicExcel = {
    mobileExportExcel() {
        this._exportIlExcel();
    },

    exportToExcel() {
        this._exportIlExcel();
    },

    _ilVisibleCols() {
        var cols = this.columnDefs.filter(c => c.key !== 'acciones' && !this.hiddenColumns.includes(c.key));
        return cols.length > 0 ? cols : this.columnDefs.filter(c => c.key !== 'acciones');
    },

    _ilCellValue(r, key) {
        if (key === 'fecha') return r.fecha ? formatDate(r.fecha, false) : '';
        if (key === 'venta' || key === 'costoEnvio' || key === 'bultos') return this.signedAmount(r, key);
        if (key === 'costoPorcentaje') return (Number(r.costoPorcentaje || 0) / 100);
        var v = r[key];
        return v == null ? '' : v;
    },

    _ilFilterLabel() {
        var parts = [];
        if (this.filters.startDate || this.filters.endDate) {
            var fmt = d => { try { return formatDate(new Date(d + 'T12:00:00'), false); } catch (e) { return d; } };
            parts.push('Periodo: ' + (this.filters.startDate ? fmt(this.filters.startDate) : '...') + ' al ' + (this.filters.endDate ? fmt(this.filters.endDate) : '...'));
        }
        if (this.filters.search) parts.push('Búsqueda: ' + this.filters.search);
        Object.keys(this.filters).forEach(k => {
            if (['search', 'startDate', 'endDate'].indexOf(k) !== -1) return;
            var v = this.filters[k];
            if (Array.isArray(v) && v.length > 0) parts.push(k + ': ' + v.join(', '));
        });
        return parts.length > 0 ? parts.join('  |  ') : 'Sin filtros (todos los registros)';
    },

    async _exportIlExcel() {
        if (this.filteredRecords.length === 0) {
            showToast('No hay datos filtrados para exportar', 'warning');
            return;
        }
        if (typeof ExcelJS === 'undefined') {
            showToast('Librería Excel no disponible', 'error');
            return;
        }
        try {
            var cols = this._ilVisibleCols();
            var totalCols = cols.length;
            var workbook = new ExcelJS.Workbook();
            var sheet = workbook.addWorksheet('Control Interlogic', { views: [{ state: 'frozen', ySplit: 3 }] });
            var moneyFmt = '#,##0.00';
            var center = { vertical: 'middle', horizontal: 'center', wrapText: true };
            var left = { vertical: 'middle', horizontal: 'left', wrapText: true };
            var right = { vertical: 'middle', horizontal: 'right', wrapText: true };
            var thin = { style: 'thin', color: { argb: 'FFD1D5DB' } };
            var border = { top: thin, bottom: thin, left: thin, right: thin };
            sheet.mergeCells(1, 1, 1, totalCols);
            var title = sheet.getCell(1, 1);
            title.value = 'Control Interlogic';
            title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF111111' } };
            title.alignment = { vertical: 'middle', horizontal: 'center' };
            sheet.getRow(1).height = 24;
            sheet.mergeCells(2, 1, 2, totalCols);
            var sub = sheet.getCell(2, 1);
            sub.value = 'Registros: ' + this.filteredRecords.length + ' · ' + this._ilFilterLabel();
            sub.font = { name: 'Arial', size: 10, color: { argb: 'FF6B7280' } };
            sub.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            sheet.getRow(2).height = 28;
            var self = this;
            cols.forEach(function(c, i) {
                var cell = sheet.getCell(3, i + 1);
                cell.value = c.label;
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111111' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
                cell.alignment = center;
                cell.border = border;
                var w = 16;
                if (c.key === 'cliente' || c.key === 'observations') w = 30;
                else if (c.key === 'guia' || c.key === 'docNum' || c.key === 'formaPago') w = 14;
                sheet.getColumn(i + 1).width = w;
            });
            sheet.getRow(3).height = 18;
            sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: totalCols } };
            this.filteredRecords.forEach(function(r, idx) {
                var n = idx + 4;
                cols.forEach(function(c, i) {
                    var cell = sheet.getCell(n, i + 1);
                    cell.value = self._ilCellValue(r, c.key);
                    cell.font = { name: 'Arial', size: 10, color: { argb: 'FF111111' } };
                    cell.border = border;
                    if (c.key === 'venta' || c.key === 'costoEnvio') { cell.numFmt = moneyFmt; cell.alignment = right; }
                    else if (c.key === 'costoPorcentaje') { cell.numFmt = '0.00%'; cell.alignment = right; }
                    else if (c.key === 'bultos') { cell.numFmt = '#,##0'; cell.alignment = right; }
                    else if (c.key === 'cliente' || c.key === 'observations') cell.alignment = left;
                    else cell.alignment = center;
                    if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                });
                sheet.getRow(n).height = 16;
            });
            var tot = this.filteredRecords.length + 4;
            var sums = { venta: 0, bultos: 0, costoEnvio: 0 };
            this.filteredRecords.forEach(function(r) {
                sums.venta += Number(self.signedAmount(r, 'venta')) || 0;
                sums.bultos += Number(self.signedAmount(r, 'bultos')) || 0;
                sums.costoEnvio += Number(self.signedAmount(r, 'costoEnvio')) || 0;
            });
            var totLabel = sheet.getCell(tot, 1);
            totLabel.value = 'TOTALES (' + this.filteredRecords.length + ' registros)';
            totLabel.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111111' } };
            totLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
            totLabel.alignment = center;
            totLabel.border = border;
            if (totalCols > 1) sheet.mergeCells(tot, 1, tot, Math.min(2, totalCols));
            cols.forEach(function(c, i) {
                var cell = sheet.getCell(tot, i + 1);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
                cell.border = border;
                if (c.key === 'venta' || c.key === 'bultos' || c.key === 'costoEnvio') {
                    cell.value = Math.round(sums[c.key] * 100) / 100;
                    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111111' } };
                    cell.alignment = right;
                    cell.numFmt = c.key === 'bultos' ? '#,##0' : moneyFmt;
                }
            });
            sheet.getRow(tot).height = 18;
            sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
            sheet.pageMargins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4 };
            sheet.printTitleRow = '1:3';
            var buffer = await workbook.xlsx.writeBuffer();
            var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'Interlogic_' + formatDateForInput(new Date()) + '.xlsx';
            a.click();
            setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
            showToast(this.filteredRecords.length + ' registros exportados a Excel', 'success');
        } catch (e) {
            showToast('No se pudo generar el Excel', 'error');
        }
    },

    _exportIlPdf() {
        if (this.filteredRecords.length === 0) {
            showToast('No hay datos filtrados para exportar', 'warning');
            return;
        }
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showToast('Librería PDF no disponible', 'error');
            return;
        }
        showToast('Generando PDF...', 'info');
        try {
            var self = this;
            var all = this._ilVisibleCols();
            var weights = { guia: 1.1, empresa: 1.1, fecha: 1 };
            weights.doc = 0.7; weights.docNum = 1; weights.cliente = 2;
            weights.departamento = 1.3; weights.municipio = 1.3; weights.vendedor = 1.2;
            weights.condicionPago = 1.1; weights.venta = 1.1; weights.bultos = 0.8;
            weights.cobrador = 0.9; weights.costoEnvio = 1; weights.costoPorcentaje = 0.9;
            weights.observations = 1.8; weights.entrega = 1.1; weights.cobra = 1.1;
            weights.encargado = 1.2; weights.formaPago = 1.1;
            var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
            var M = 10, PW = 297, PH = 210, W = PW - M * 2;
            var totalW = all.reduce(function(s, c) { return s + (weights[c.key] || 1); }, 0);
            var cols = all.map(function(c) {
                var num = c.key === 'venta' || c.key === 'bultos' || c.key === 'costoEnvio';
                return { k: c.key, label: c.label, w: W * ((weights[c.key] || 1) / totalW), num: num };
            });
            var plain = function(v) { return String(v == null ? '' : v); };
            var money = function(r, k) { return plain(formatCurrency(self.signedAmount(r, k))); };
            var rows = this.filteredRecords.map(function(r) {
                return all.map(function(c) {
                    if (c.key === 'fecha') return r.fecha ? formatDate(r.fecha, false) : '';
                    if (c.key === 'venta' || c.key === 'costoEnvio' || c.key === 'bultos') return money(r, c.key);
                    if (c.key === 'costoPorcentaje') return (Number(r.costoPorcentaje || 0)).toFixed(2) + '%';
                    return plain(r[c.key]);
                });
            });
            var LH = 4.2, PAD = 1.4, MINH = 7;
            var y = M;
            var header = function() {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(15);
                doc.setTextColor(17, 17, 17);
                doc.text('Control Interlogic', PW / 2, y + 6, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text('Registros: ' + self.filteredRecords.length + '  -  ' + self._ilFilterLabel(), PW / 2, y + 11, { align: 'center', maxWidth: W });
                y += 16;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                var x = M;
                cols.forEach(function(c) {
                    doc.setFillColor(229, 231, 235);
                    doc.setDrawColor(156, 163, 175);
                    doc.rect(x, y, c.w, MINH, 'FD');
                    doc.setTextColor(17, 17, 17);
                    var tx = c.num ? x + c.w - PAD : x + PAD;
                    doc.text(c.label, tx, y + 4.6, { align: c.num ? 'right' : 'left' });
                    x += c.w;
                });
                y += MINH;
            };
            header();
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            rows.forEach(function(cells) {
                var lines = cells.map(function(t, i) { return doc.splitTextToSize(t, cols[i].w - PAD * 2); });
                var h = MINH;
                lines.forEach(function(l) { h = Math.max(h, l.length * LH + PAD * 2 - 1); });
                if (y + h > PH - M) {
                    doc.addPage();
                    y = M;
                    header();
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7.5);
                }
                var x = M;
                cells.forEach(function(t, i) {
                    doc.setDrawColor(209, 213, 219);
                    doc.rect(x, y, cols[i].w, h);
                    doc.setTextColor(17, 17, 17);
                    var tx = cols[i].num ? x + cols[i].w - PAD : x + PAD;
                    doc.text(lines[i], tx, y + PAD + 3.2, { align: cols[i].num ? 'right' : 'left', lineHeightFactor: 1 });
                    x += cols[i].w;
                });
                y += h;
            });
            var n = doc.getNumberOfPages();
            for (var i = 1; i <= n; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(120, 120, 120);
                doc.text('Página ' + i + ' de ' + n, PW / 2, PH - 5, { align: 'center' });
            }
            doc.save('Interlogic_' + formatDateForInput(new Date()) + '.pdf');
            showToast(this.filteredRecords.length + ' registros exportados a PDF', 'success');
        } catch (e) {
            showToast('No se pudo generar el PDF', 'error');
        }
    },

    showImportExcel() {
        const importColumns = [
            { key: 'guia', label: 'Guía', aliases: ['guia'] },
            { key: 'empresa', label: 'Empresa', aliases: ['empresa'] },
            { key: 'fecha', label: 'Fecha', aliases: ['fecha'] },
            { key: 'doc', label: 'Doc', aliases: ['doc', 'documento'] },
            { key: 'docNum', label: 'Doc #', aliases: ['doc #', 'doc#', 'numero documento', 'numero doc'] },
            { key: 'cliente', label: 'Cliente', aliases: ['cliente'] },
            { key: 'telefono', label: 'Teléfono', aliases: ['telefono'] },
            { key: 'departamento', label: 'Departamento', aliases: ['departamento'] },
            { key: 'municipio', label: 'Municipio', aliases: ['municipio'] },
            { key: 'vendedor', label: 'Vendedor', aliases: ['vendedor'] },
            { key: 'condicionPago', label: 'Condición', aliases: ['condicion', 'condicion pago'] },
            { key: 'venta', label: 'Venta', aliases: ['venta', 'total venta'] },
            { key: 'cobrador', label: 'Cajas', aliases: ['cajas'] },
            { key: 'total', label: 'Total', aliases: ['total'] },
            { key: 'bultos', label: 'Bultos', aliases: ['bultos'] }
        ];
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <h2 style="margin-bottom: 1.5rem;">📤 Importar desde Excel</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">El archivo puede tener estas columnas en cualquier orden si incluye encabezados. Sin encabezados, usa este orden:</p>
                <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem; font-size: 0.85rem; overflow-x: auto;">
                    <code>${importColumns.map(column => column.label).join(' | ')}</code>
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

                    const normalizeHeader = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9#]/g, ' ').replace(/\s+/g, ' ').trim();
                    let headerMap = null;
                    let startRow = 0;

                    for (let i = 0; i < Math.min(rows.length, 10); i++) {
                        const row = rows[i] || [];
                        const matches = importColumns.reduce((map, column) => {
                            const index = row.findIndex(cell => column.aliases.includes(normalizeHeader(cell)));
                            if (index >= 0) map[column.key] = index;
                            return map;
                        }, {});
                        if (Object.keys(matches).length >= 3) {
                            headerMap = matches;
                            startRow = i + 1;
                            break;
                        }
                    }

                    parsedData = [];
                    for (let i = startRow; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r || r.length === 0) continue;
                        const cell = (key, fallbackIndex) => headerMap ? r[headerMap[key]] : r[fallbackIndex];
                        if (!cell('guia', 0) && !cell('cliente', 5)) continue;
                        parsedData.push({
                            guia: String(cell('guia', 0) || ''),
                            empresa: String(cell('empresa', 1) || ''),
                            fecha: cell('fecha', 2) || null,
                            doc: String(cell('doc', 3) || ''),
                            docNum: String(cell('docNum', 4) || ''),
                            cliente: String(cell('cliente', 5) || ''),
                            telefono: String(cell('telefono', 6) || ''),
                            departamento: String(cell('departamento', 7) || ''),
                            municipio: String(cell('municipio', 8) || ''),
                            vendedor: String(cell('vendedor', 9) || ''),
                            condicionPago: String(cell('condicionPago', 10) || ''),
                            venta: parseExcelNumber(cell('venta', 11)),
                            cobrador: String(cell('cobrador', 12) || ''),
                            total: parseExcelNumber(cell('total', 13)),
                            bultos: parseExcelNumber(cell('bultos', 14))
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
