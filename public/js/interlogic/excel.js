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
        if (key === 'venta' || key === 'costoEnvio' || key === 'bultos') {
            if (r.anulado === true) {
                const value = Number(r[key]) || 0;
                return r.doc === 'NC' ? -Math.abs(value) : value;
            }
            return this.signedAmount(r, key);
        }
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

    _ilColLetter(n) {
        var s = '';
        while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
        return s;
    },

    _ilCellDate(r) {
        if (!r.fecha) return '';
        try {
            var d = r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha);
            return isNaN(d.getTime()) ? '' : d;
        } catch (e) { return ''; }
    },

    async _exportIlExcel() {
        if (this.filteredRecords.length === 0) {
            showToast('No hay datos filtrados para exportar', 'warning');
            return;
        }
        try { await ensureLib('exceljs'); } catch (e) {
            showToast('Librería Excel no disponible', 'error');
            return;
        }
        try {
            var self = this;
            var cols = this._ilVisibleCols();
            var totalCols = cols.length;
            var lastCol = this._ilColLetter(totalCols);
            var workbook = new ExcelJS.Workbook();
            workbook.creator = 'Control Interlogic';
            workbook.created = new Date();
            var sheet = workbook.addWorksheet('Control Interlogic', { views: [{ state: 'frozen', ySplit: 4 }] });
            sheet.properties.tabColor = { argb: 'FF1D4ED8' };
            var line = { style: 'thin', color: { argb: 'FFE2E8F0' } };
            sheet.mergeCells('A1:' + lastCol + '1');
            var title = sheet.getCell('A1');
            title.value = 'Control Interlogic';
            title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
            title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            title.alignment = { vertical: 'middle', horizontal: 'center' };
            sheet.getRow(1).height = 38;
            sheet.mergeCells('A2:' + lastCol + '2');
            var now = new Date();
            var pad = function(x) { return String(x).padStart(2, '0'); };
            var sub = sheet.getCell('A2');
            sub.value = 'Registros: ' + this.filteredRecords.length + '  ·  ' + this._ilFilterLabel() + '  ·  Exportado: ' + pad(now.getDate()) + '/' + pad(now.getMonth() + 1) + '/' + now.getFullYear() + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
            sub.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
            sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            sub.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            sheet.getRow(2).height = 30;
            sheet.getRow(3).height = 8;
            var widths = { guia: 13, empresa: 14, fecha: 13, doc: 9, docNum: 13, cliente: 32, departamento: 16, municipio: 16, vendedor: 16, condicionPago: 14, venta: 15, bultos: 10, cobrador: 10, costoEnvio: 13, costoPorcentaje: 11, observations: 42, entrega: 16, cobra: 16, encargado: 16, formaPago: 14 };
            var tableCols = cols.map(function(c, i) {
                var col = { name: c.label, filterButton: true };
                if (i === 0) col.totalsRowLabel = 'TOTALES (' + self.filteredRecords.length + ' registros)';
                if (c.key === 'venta' || c.key === 'bultos' || c.key === 'costoEnvio') col.totalsRowFunction = 'sum';
                return col;
            });
            var rows = this.filteredRecords.map(function(r) {
                return cols.map(function(c) {
                    if (c.key === 'fecha') return self._ilCellDate(r);
                    return self._ilCellValue(r, c.key);
                });
            });
            sheet.addTable({
                name: 'ControlInterlogic',
                ref: 'A4',
                headerRow: true,
                totalsRow: true,
                style: { theme: 'TableStyleLight1', showRowStripes: false },
                columns: tableCols,
                rows: rows
            });
            var firstData = 5;
            var lastData = 4 + rows.length;
            var totalsRow = lastData + 1;
            var headerRow = 4;
            cols.forEach(function(c, i) {
                var head = sheet.getCell(headerRow, i + 1);
                head.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
                head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                head.border = { top: line, bottom: { style: 'medium', color: { argb: 'FF0F172A' } }, left: line, right: line };
                sheet.getColumn(i + 1).width = widths[c.key] || 15;
            });
            sheet.getRow(headerRow).height = 30;
            var badge = function(value) {
                var v = String(value || '').toUpperCase();
                if (v === 'DALSE') return 'FF1E40AF';
                if (v === 'INTERLOGISTIC') return 'FF7C3AED';
                if (v === 'XPRESS') return 'FFD97706';
                if (v === 'INCEDE') return 'FF059669';
                return 'FFEC4899';
            };
            var condFill = { 'CONTADO': ['FF22C55E', 'FF0F172A'], 'CRÉDITO': ['FFF59E0B', 'FF0F172A'], 'CREDITO': ['FFF59E0B', 'FF0F172A'] };
            cols.forEach(function(c, i) {
                var numeric = c.key === 'venta' || c.key === 'costoEnvio' || c.key === 'bultos' || c.key === 'costoPorcentaje';
                var isBadge = c.key === 'entrega' || c.key === 'cobra';
                for (var n = firstData; n <= lastData; n++) {
                    var cell = sheet.getCell(n, i + 1);
                    var baseFill = (n - firstData) % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
                    cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseFill } };
                    cell.border = { top: line, bottom: line, left: line, right: line };
                    cell.alignment = { vertical: 'middle', wrapText: true, horizontal: numeric ? 'right' : (c.key === 'cliente' || c.key === 'observations' ? 'left' : 'center') };
                    if (c.key === 'fecha' && cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy';
                    else if (c.key === 'venta' || c.key === 'costoEnvio') cell.numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
                    else if (c.key === 'bultos') cell.numFmt = '#,##0';
                    else if (c.key === 'costoPorcentaje') cell.numFmt = '0.00%';
                    if (isBadge && String(cell.value || '').trim() !== '') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge(cell.value) } };
                        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                    }
                    if (c.key === 'condicionPago' && condFill[String(cell.value || '').toUpperCase()]) {
                        var cp = condFill[String(cell.value || '').toUpperCase()];
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cp[0] } };
                        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: cp[1] } };
                    }
                }
            });
            cols.forEach(function(c, i) {
                var cell = sheet.getCell(totalsRow, i + 1);
                cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
                cell.border = { top: { style: 'medium', color: { argb: 'FF1D4ED8' } }, bottom: line, left: line, right: line };
                if (c.key === 'venta' || c.key === 'costoEnvio') cell.numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
                else if (c.key === 'bultos') cell.numFmt = '#,##0';
                cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : (c.key === 'venta' || c.key === 'bultos' || c.key === 'costoEnvio' ? 'right' : 'center') };
            });
            sheet.getRow(totalsRow).height = 24;
            this.filteredRecords.forEach(function(r, idx) {
                if (r.anulado !== true) return;
                var n = firstData + idx;
                cols.forEach(function(c, i) {
                    var cell = sheet.getCell(n, i + 1);
                    cell.font = { name: 'Calibri', size: 11, strike: true, color: { argb: 'FF94A3B8' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                });
            });
            sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
            sheet.pageMargins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4 };
            sheet.printTitleRow = '4:4';
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

    async _exportIlPdf() {
        if (this.filteredRecords.length === 0) {
            showToast('No hay datos filtrados para exportar', 'warning');
            return;
        }
        try { await ensureLib('jspdf'); } catch (e) {
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
            var money = function(r, k) {
                var value = r.anulado === true ? (r.doc === 'NC' ? -Math.abs(Number(r[k]) || 0) : Number(r[k]) || 0) : self.signedAmount(r, k);
                return plain(formatCurrency(value));
            };
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
            reader.onload = async (evt) => {
                try {
                    await ensureLib('xlsx');
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
                const uid = firebase.auth().currentUser?.uid || null;

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
