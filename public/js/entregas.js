// ===================================
// Estado de Entregas Module
// Vista de entregas y formas de pago
// ===================================

const Entregas = {
    records: [],
    filteredRecords: [],
    loading: false,
    unsubscribe: null,
    filters: {
        search: '',
        startDate: (function(){ var d = new Date(); d.setDate(1); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); })(),
        endDate: (function(){ var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); })(),
        estado: "todos",
        formaPago: "todos"
    },

    async render() {
        if (window.innerWidth <= 768) return this.renderMobile();
        return this.renderDesktop();
    },
    async renderDesktop() {
        var area = document.getElementById("content-area");
        if (!area) return;
        var s = this.filters, self = this;
        area.innerHTML = '<div class="module-header"><div><h1>✅ Estado de Entregas</h1><p>Vista general de entregas y formas de pago</p></div>' +
            '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">' +
            '<label style="font-size:0.85rem;white-space:nowrap;">📅 Desde:</label><input type="date" id="ent-filter-start" value="' + s.startDate + '" style="padding:0.5rem;border:2px solid var(--border-color);border-radius:var(--radius-md);min-height:44px;">' +
            '<label style="font-size:0.85rem;white-space:nowrap;">Hasta:</label><input type="date" id="ent-filter-end" value="' + s.endDate + '" style="padding:0.5rem;border:2px solid var(--border-color);border-radius:var(--radius-md);min-height:44px;">' +
            '<select id="ent-filter-estado" style="padding:0.5rem;border:2px solid var(--border-color);border-radius:var(--radius-md);min-height:44px;">' +
            '<option value="todos"' + (s.estado==="todos"?" selected":"") + '>📋 Todos</option>' +
            '<option value="entregados"' + (s.estado==="entregados"?" selected":"") + '>✅ Entregados</option>' +
            '<option value="pendientes"' + (s.estado==="pendientes"?" selected":"") + '>⏳ Pendientes</option>' +
            '<option value="entregados-pago"' + (s.estado==="entregados-pago"?" selected":"") + '>✅ Entregados con Pago</option>' +
            '<option value="entregados-sin-pago"' + (s.estado==="entregados-sin-pago"?" selected":"") + '>✅ Entregados sin Pago (Crédito)</option></select>' +
            '<select id="ent-filter-pago" style="padding:0.5rem;border:2px solid var(--border-color);border-radius:var(--radius-md);min-height:44px;">' +
            '<option value="todos"' + (s.formaPago==="todos"?" selected":"") + '>💳 Todos los Pagos</option>' +
            '<option value="Efectivo"' + (s.formaPago==="Efectivo"?" selected":"") + '>💵 Efectivo</option>' +
            '<option value="Cheque"' + (s.formaPago==="Cheque"?" selected":"") + '>🏦 Cheque</option>' +
            '<option value="Transferencia"' + (s.formaPago==="Transferencia"?" selected":"") + '>📱 Transferencia</option>' +
            '<option value="Abono"' + (s.formaPago==="Abono"?" selected":"") + '>📝 Abono</option>' +
            '<option value="sin-pago"' + (s.formaPago==="sin-pago"?" selected":"") + '>— Sin Pago</option></select>' +
            '<button class="btn btn-secondary" id="ent-btn-export">📥 Exportar Excel</button></div></div>' +
            '<div style="margin-bottom: 0.75rem;">' +
            '<div style="position: relative; max-width: 400px;">' +
            '<svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--gray-400);pointer-events:none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
            '<input type="text" id="ent-search-input" placeholder="Buscar en tabla…" value="' + sanitizeHTML(s.search || '') + '" style="width:100%;padding:0.6rem 0.6rem 0.6rem 2.4rem;font-size:0.95rem;border:2px solid var(--border-color);border-radius:var(--radius-md);font-family:var(--font-family);transition:all 0.25s;background:var(--card-bg);color:var(--text-primary);">' +
            '</div></div>' +
            '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:1.5rem;" id="ent-stats">' +
            '<div class="stat-card"><h3>TOTAL</h3><p id="ent-stat-total">0</p></div>' +
            '<div class="stat-card"><h3>✅ ENTREGADOS</h3><p id="ent-stat-entregados" style="color:#22c55e;">0</p></div>' +
            '<div class="stat-card"><h3>⏳ PENDIENTES</h3><p id="ent-stat-pendientes" style="color:#f97316;">0</p></div>' +
            '<div class="stat-card"><h3>💵 EFECTIVO</h3><p id="ent-stat-efectivo" style="color:#166534;">0</p></div>' +
            '<div class="stat-card"><h3>🏦 CHEQUE</h3><p id="ent-stat-cheque" style="color:#1e40af;">0</p></div>' +
            '<div class="stat-card"><h3>📱 TRANSFER.</h3><p id="ent-stat-transferencia" style="color:#6b21a8;">0</p></div>' +
            '<div class="stat-card"><h3>📝 ABONO</h3><p id="ent-stat-abono" style="color:#9a3412;">0</p></div></div>' +
            '<div id="ent-truncated-warn" style="display:none;margin-bottom:0.75rem;padding:8px 12px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#b45309;font-size:0.8rem;font-weight:600;">⚠️ El rango tiene más de 2,000 registros (tope de descarga): las estadísticas corresponden solo a los 2,000 más recientes. Usa un rango más corto para ver todo.</div>' +
            '<div class="card"><div class="table-container"><table class="data-table"><thead><tr>' +
            '<th>Estado</th><th>Guía</th><th>Empresa</th><th>Fecha</th><th>Doc</th><th>Cliente</th><th>Depto.</th><th>Vendedor</th><th>Cond. Pago</th><th>Venta</th><th>Bultos</th><th>Forma Pago</th><th>Fecha Entrega</th>' +
            '</tr></thead><tbody id="ent-table-body"><tr><td colspan="13" style="text-align:center;padding:2rem;">Cargando...</td></tr></tbody><tfoot id="ent-table-footer"></tfoot></table></div></div>';
        this.bindEvents();
        await this.loadData();
    },
    async renderMobile() {
        var area = document.getElementById("content-area");
        if (!area) return;
        var s = this.filters;
        area.innerHTML = '<div style="padding:0 0 8px;"><h1 style="font-size:1.35rem;font-weight:800;">✅ Estado de Entregas</h1><p style="font-size:0.78rem;color:#8e8e93;">Entregas y formas de pago</p></div>' +
            '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.75rem;">' +
            '<input type="date" id="ent-filter-start" value="' + s.startDate + '" style="flex:1;min-width:0;padding:0.5rem;border:1px solid var(--gray-300);border-radius:8px;font-size:0.85rem;">' +
            '<input type="date" id="ent-filter-end" value="' + s.endDate + '" style="flex:1;min-width:0;padding:0.5rem;border:1px solid var(--gray-300);border-radius:8px;font-size:0.85rem;"></div>' +
            '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.75rem;">' +
            '<select id="ent-filter-estado" style="flex:1;padding:0.5rem;border:1px solid var(--gray-300);border-radius:8px;font-size:0.85rem;">' +
            '<option value="todos"' + (s.estado==="todos"?" selected":"") + '>📋 Todos</option><option value="entregados"' + (s.estado==="entregados"?" selected":"") + '>✅ Entregados</option><option value="pendientes"' + (s.estado==="pendientes"?" selected":"") + '>⏳ Pendientes</option>' +
            '<option value="entregados-pago"' + (s.estado==="entregados-pago"?" selected":"") + '>✅ Con Pago</option><option value="entregados-sin-pago"' + (s.estado==="entregados-sin-pago"?" selected":"") + '>✅ Sin Pago</option></select>' +
            '<select id="ent-filter-pago" style="flex:1;padding:0.5rem;border:1px solid var(--gray-300);border-radius:8px;font-size:0.85rem;">' +
            '<option value="todos"' + (s.formaPago==="todos"?" selected":"") + '>💳 Todos</option><option value="Efectivo"' + (s.formaPago==="Efectivo"?" selected":"") + '>💵 Efectivo</option><option value="Cheque"' + (s.formaPago==="Cheque"?" selected":"") + '>🏦 Cheque</option>' +
            '<option value="Transferencia"' + (s.formaPago==="Transferencia"?" selected":"") + '>📱 Transfer.</option><option value="Abono"' + (s.formaPago==="Abono"?" selected":"") + '>📝 Abono</option><option value="sin-pago"' + (s.formaPago==="sin-pago"?" selected":"") + '>— Sin Pago</option></select></div>' +
            '<div style="position:relative;margin-bottom:0.75rem;">' +
            '<svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--gray-400);pointer-events:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
            '<input type="search" id="ent-search-input" placeholder="Buscar…" value="' + sanitizeHTML(s.search || '') + '" style="width:100%;padding:0.5rem 0.5rem 0.5rem 2.2rem;font-size:0.9rem;border:1px solid var(--gray-300);border-radius:8px;font-family:var(--font-family);background:var(--card-bg);color:var(--text-primary);">' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:0.75rem;" id="ent-stats">' +
            '<div style="background:var(--gray-50);border-radius:8px;padding:8px;text-align:center;"><div style="font-size:0.65rem;color:#8e8e93;font-weight:600;">TOTAL</div><div id="ent-stat-total" style="font-size:1.1rem;font-weight:800;">0</div></div>' +
            '<div style="background:#f0fdf4;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:0.65rem;color:#166534;font-weight:600;">✅ ENTREG.</div><div id="ent-stat-entregados" style="font-size:1.1rem;font-weight:800;color:#22c55e;">0</div></div>' +
            '<div style="background:#fff7ed;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:0.65rem;color:#9a3412;font-weight:600;">⏳ PEND.</div><div id="ent-stat-pendientes" style="font-size:1.1rem;font-weight:800;color:#f97316;">0</div></div></div>' +
            '<div style="display:flex;gap:4px;margin-bottom:0.75rem;"><button class="btn btn-secondary" id="ent-btn-export" style="font-size:0.8rem;padding:0.4rem 0.8rem;">📥 Excel</button></div>' +
            '<div id="ent-truncated-warn" style="display:none;margin-bottom:0.75rem;padding:8px 10px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;color:#b45309;font-size:0.72rem;font-weight:600;">⚠️ El rango tiene más de 2,000 registros: se muestran solo los 2,000 más recientes.</div>' +
            '<div id="ent-data-list" class="m-data-list"><div style="text-align:center;padding:40px;color:#8e8e93;">Cargando...</div></div>';
        this.bindEvents();
        await this.loadData();
    },
    bindEvents() {
        var self = this;
        var startEl = document.getElementById("ent-filter-start");
        var endEl = document.getElementById("ent-filter-end");
        var estadoEl = document.getElementById("ent-filter-estado");
        var pagoEl = document.getElementById("ent-filter-pago");
        var exportBtn = document.getElementById("ent-btn-export");
        var searchEl = document.getElementById("ent-search-input");
        if (startEl) startEl.addEventListener("change", function(){ self.filters.startDate = this.value; self.applyFilters(); });
        if (endEl) endEl.addEventListener("change", function(){ self.filters.endDate = this.value; self.applyFilters(); });
        if (estadoEl) estadoEl.addEventListener("change", function(){ self.filters.estado = this.value; self.applyFilters(); });
        if (pagoEl) pagoEl.addEventListener("change", function(){ self.filters.formaPago = this.value; self.applyFilters(); });
        if (exportBtn) exportBtn.addEventListener("click", function(){ self.exportToExcel(); });
        if (searchEl) searchEl.addEventListener("input", function(){ self.filters.search = this.value; self.applyFilters(); });
    },

    async loadData() {
        if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
        this.loading = true;
        var db = firebase.firestore();
        var sp = this.filters.startDate.split("-").map(Number);
        var ep = this.filters.endDate.split("-").map(Number);
        var startTs = firebase.firestore.Timestamp.fromDate(new Date(sp[0], sp[1]-1, sp[2], 0, 0, 0));
        var endTs = firebase.firestore.Timestamp.fromDate(new Date(ep[0], ep[1]-1, ep[2], 23, 59, 59));
        var self = this;
        try {
            // Tope de descarga: reduce costo/red (cada doc = 1 lectura Firestore)
            this.unsubscribe = db.collection("interlogic").where("fecha", ">=", startTs).where("fecha", "<=", endTs).orderBy("fecha", "desc").limit(2000)
                .onSnapshot(function(snap){
                    self.records = snap.docs.map(function(doc){ return { id: doc.id, ...doc.data() }; });
                    self._truncated = snap.size >= 2000; // rango largo recortado por el limit de la consulta
                    self.loading = false;
                    self.applyFilters();
                }, function(err){ console.error("Entregas error:", err); showToast("Error: " + err.message, "error"); self.loading = false; });
        } catch(e) { console.error("Entregas load error:", e); this.loading = false; }
    },

    applyFilters() {
        var estado = this.filters.estado, pago = this.filters.formaPago, search = (this.filters.search || '').toLowerCase().trim();
        this.filteredRecords = this.records.filter(function(r){
            var ent = r.entregado === true;
            if (estado === "entregados" && !ent) return false;
            if (estado === "pendientes" && ent) return false;
            if (estado === "entregados-pago" && (!ent || !r.formaPago)) return false;
            if (estado === "entregados-sin-pago" && (!ent || r.formaPago)) return false;
            if (pago !== "todos") { if (pago === "sin-pago") { if (r.formaPago) return false; } else { if (r.formaPago !== pago) return false; } }
            // Búsqueda por texto en todos los encabezados visibles de la tabla
            if (search) {
                var searchable = [
                    r.guia, r.empresa, r.fecha ? formatDateShort(r.fecha) : '',
                    r.doc, r.docNum, r.cliente, r.departamento || r.zona || '',
                    r.vendedor, r.condicionPago, '' + (r.venta || 0),
                    '' + (r.bultos || 0), r.formaPago,
                    r.fechaEntrega ? (function(d){ return d && d.toDate ? formatDateShort(d.toDate()) : ''; })(r.fechaEntrega) : '',
                    r.entregado === true ? 'entregado' : 'pendiente'
                ];
                var found = searchable.some(function(v){ return String(v).toLowerCase().indexOf(search) !== -1; });
                if (!found) return false;
            }
            return true;
        });
        this.updateStats();
        this.renderTable();
    },

    updateStats() {
        var total = this.records.length, ent = 0, ef = 0, ch = 0, tr = 0, ab = 0;
        this.records.forEach(function(r){
            if (r.entregado === true) ent++;
            if (r.formaPago === "Efectivo") ef++;
            else if (r.formaPago === "Cheque") ch++;
            else if (r.formaPago === "Transferencia") tr++;
            else if (r.formaPago === "Abono") ab++;
        });
        var s = function(id, v){ var e = document.getElementById(id); if(e) e.textContent = v; };
        s("ent-stat-total", total); s("ent-stat-entregados", ent); s("ent-stat-pendientes", total - ent);
        s("ent-stat-efectivo", ef); s("ent-stat-cheque", ch); s("ent-stat-transferencia", tr); s("ent-stat-abono", ab);
        var warn = document.getElementById("ent-truncated-warn");
        if (warn) warn.style.display = this._truncated ? "block" : "none";
    },
    renderTable() {
        if (window.innerWidth <= 768) return this.renderMobileCards();
        var tbody = document.getElementById("ent-table-body");
        if (!tbody) return;
        var records = this.filteredRecords;
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:2rem;color:#8e8e93;">No hay registros con estos filtros</td></tr>';
            var tfoot = document.getElementById("ent-table-footer"); if (tfoot) tfoot.innerHTML = "";
            return;
        }
        tbody.innerHTML = records.map(function(r){
            var ent = r.entregado === true;
            var estH = ent ? '<span class="badge badge-success">✅ Entregado</span>' : '<span class="badge badge-ghost">⏳ Pendiente</span>';
            var fpH = "—";
            if (r.formaPago) {
                var fpC = r.formaPago === "Efectivo" ? "badge-success" : r.formaPago === "Cheque" ? "badge-primary" : r.formaPago === "Transferencia" ? "badge-purple" : "badge-warning";
                var fpI = r.formaPago === "Efectivo" ? "💵" : r.formaPago === "Cheque" ? "🏦" : r.formaPago === "Transferencia" ? "📱" : "📝";
                fpH = '<span class="badge ' + fpC + '">' + fpI + " " + sanitizeHTML(r.formaPago) + "</span>";
            }
            var fe = "";
            if (r.fechaEntrega) { var d = r.fechaEntrega.toDate ? r.fechaEntrega.toDate() : new Date(r.fechaEntrega); fe = formatDateShort(d); }
            return "<tr>" + "<td>" + estH + "</td><td>" + sanitizeHTML(r.guia||"") + "</td><td>" + sanitizeHTML(r.empresa||"") + "</td><td>" + (r.fecha ? formatDateShort(r.fecha) : "") + "</td><td>" + sanitizeHTML((r.doc||"") + (r.docNum ? " #"+r.docNum : "")) + "</td><td>" + sanitizeHTML(r.cliente||"") + "</td><td>" + sanitizeHTML(r.departamento||r.zona||"") + "</td><td>" + sanitizeHTML(r.vendedor||"") + "</td><td>" + sanitizeHTML(r.condicionPago||"") + '</td><td style="text-align:right;font-weight:600;">' + formatCurrency(r.venta||0) + '</td><td style="text-align:center;">' + formatNumber(r.bultos||0) + "</td><td>" + fpH + '</td><td style="font-size:0.8rem;">' + fe + "</td></tr>";
        }).join("");
        var tv = records.reduce(function(s,r){ return s + signedAmount(r, 'venta'); }, 0);
        var tb = records.reduce(function(s,r){ return s + signedAmount(r, 'bultos'); }, 0);
        var tfoot = document.getElementById("ent-table-footer");
        if (!tfoot) { tfoot = document.createElement("tfoot"); tfoot.id = "ent-table-footer"; var t = document.getElementById("ent-table-body"); if (t && t.parentElement) t.parentElement.appendChild(tfoot); }
        tfoot.innerHTML = '<tr style="font-weight:700;background:var(--gray-50);"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>TOTALES</td><td style="text-align:right;">' + formatCurrencySigned(tv) + '</td><td style="text-align:center;">' + formatNumber(tb) + "</td><td></td><td></td></tr>";
    },

    renderMobileCards() {
        var list = document.getElementById("ent-data-list");
        if (!list) return;
        var records = this.filteredRecords;
        if (records.length === 0) { list.innerHTML = '<div style="text-align:center;padding:40px;color:#8e8e93;">No hay registros con estos filtros</div>'; return; }
        list.innerHTML = records.map(function(r){
            var ent = r.entregado === true;
            var fpC = { Efectivo:{bg:"#f0fdf4",fg:"#166534",icon:"💵"}, Cheque:{bg:"#eff6ff",fg:"#1e40af",icon:"🏦"}, Transferencia:{bg:"#faf5ff",fg:"#6b21a8",icon:"📱"}, Abono:{bg:"#fff7ed",fg:"#9a3412",icon:"📝"} };
            var fp = r.formaPago ? fpC[r.formaPago] : null;
            var h = '<div class="m-data-card"><div class="m-card-header"><span class="m-card-title">' + sanitizeHTML(r.guia||r.id.substring(0,6)) + '</span><span class="m-card-badge ' + (ent?"badge-success":"badge-ghost") + '">' + (ent?"✅":"⏳") + "</span></div><div class=\"m-card-rows\">";
            h += '<div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value">' + sanitizeHTML(r.cliente||"-") + "</span></div>";
            h += '<div class="m-card-row"><span class="m-card-label">Venta</span><span class="m-card-value money">' + formatCurrency(r.venta||0) + "</span></div>";
            h += '<div class="m-card-row"><span class="m-card-label">Condición</span><span class="m-card-value">' + sanitizeHTML(r.condicionPago||"-") + "</span></div>";
            if (fp) h += '<div class="m-card-row"><span class="m-card-label">💳 Pago</span><span class="m-card-value" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;background:' + fp.bg + ";color:" + fp.fg + ';font-weight:600;font-size:0.78rem;">' + fp.icon + " " + sanitizeHTML(r.formaPago) + "</span></div>";
            h += "</div></div>";
            return h;
        }).join("");
    },

    exportToExcel() {
        if (typeof XLSX === "undefined") { showToast("Librería Excel no disponible", "error"); return; }
        if (this.filteredRecords.length === 0) { showToast("No hay datos para exportar", "warning"); return; }
        var headers = ["Estado","Guía","Empresa","Fecha","Doc","Doc #","Cliente","Depto.","Municipio","Vendedor","Condición Pago","Venta","Bultos","Forma Pago","Fecha Entrega"];
        var rows = this.filteredRecords.map(function(r){
            var ent = r.entregado === true ? "Entregado" : "Pendiente";
            var f = r.fecha ? formatDateShort(r.fecha) : "";
            var fe = ""; if (r.fechaEntrega) { var d = r.fechaEntrega.toDate ? r.fechaEntrega.toDate() : new Date(r.fechaEntrega); fe = formatDateShort(d); }
            return [ent, r.guia||"", r.empresa||"", f, r.doc||"", r.docNum||"", r.cliente||"", r.departamento||r.zona||"", r.municipio||"", r.vendedor||"", r.condicionPago||"", signedAmount(r, 'venta'), signedAmount(r, 'bultos'), r.formaPago||"", fe];
        });
        var ws = XLSX.utils.aoa_to_sheet([headers].concat(rows));
        var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Estado Entregas");
        XLSX.writeFile(wb, "Estado_Entregas_" + formatDateForInput(new Date()) + ".xlsx");
        showToast("📥 Excel exportado", "success");
    }
};

window.Entregas = Entregas;