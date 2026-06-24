// ===================================
// Historial de Entregas Module
// ===================================

const HistorialEntregas = {
    records: [],
    filteredRecords: [],
    loading: false,
    currentFilter: 'all',

    async render() {
        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }
        return this.renderDesktop();
    },

    async loadRecords() {
        this.loading = true;
        try {
            const snapshot = await firebase.firestore().collection('entregasRapidas')
                .orderBy('createdAt', 'desc')
                .limit(200)
                .get();
            this.records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.filteredRecords = [...this.records];
        } catch (e) {
            console.error('Error loading entregas:', e);
            showToast('Error al cargar historial', 'error');
        }
        this.loading = false;
    },

    applyFilter(filter) {
        this.currentFilter = filter;
        if (filter === 'all') {
            this.filteredRecords = [...this.records];
        } else {
            this.filteredRecords = this.records.filter(r => r.estado === filter);
        }
    },

    searchRecords(query) {
        if (!query || query.trim().length < 2) {
            this.applyFilter(this.currentFilter);
            this.renderList();
            return;
        }
        const q = query.toLowerCase().trim();
        this.applyFilter(this.currentFilter);
        this.filteredRecords = this.filteredRecords.filter(r =>
            (r.guia || '').toLowerCase().includes(q) ||
            (r.cliente || '').toLowerCase().includes(q) ||
            (r.docNum || '').toLowerCase().includes(q) ||
            (r.nombreRepartidor || '').toLowerCase().includes(q)
        );
        this.renderList();
    },

    formatDate(ts) {
        if (!ts) return '-';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    },

    // ============= MOBILE RENDER =============
    async renderMobile() {
        const contentArea = document.getElementById('content-area');

        contentArea.innerHTML = `
            <div style="padding: 0 0 8px 0;">
                <h1 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 2px; color: var(--m-text);">📋 Historial Entregas</h1>
                <p style="font-size: 0.78rem; color: var(--m-text-secondary);">Consulta de entregas registradas</p>
            </div>

            <div class="m-search-bar">
                <span class="search-icon-m">🔍</span>
                <input type="text" id="he-search" placeholder="Buscar cliente, guía, documento...">
            </div>

            <div style="display: flex; gap: 6px; padding: 0 16px 10px; overflow-x: auto;">
                <button class="btn he-filter-btn active" data-filter="all" onclick="HistorialEntregas.mobileFilter('all', this)" style="border-radius: 20px; font-size: 0.8rem; padding: 8px 14px; white-space: nowrap;">📋 Todos</button>
                <button class="btn he-filter-btn" data-filter="entregado" onclick="HistorialEntregas.mobileFilter('entregado', this)" style="border-radius: 20px; font-size: 0.8rem; padding: 8px 14px; white-space: nowrap;">✅ Entregados</button>
                <button class="btn he-filter-btn" data-filter="no_entregado" onclick="HistorialEntregas.mobileFilter('no_entregado', this)" style="border-radius: 20px; font-size: 0.8rem; padding: 8px 14px; white-space: nowrap;">❌ No Entregados</button>
            </div>

            <div class="m-stats-row" id="he-stats">
                <div class="m-stat-chip"><div class="m-stat-chip-label">Entregados</div><div class="m-stat-chip-value" id="hes-delivered">0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">No Entregados</div><div class="m-stat-chip-value" id="hes-rejected">0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Total</div><div class="m-stat-chip-value" id="hes-total">0</div></div>
            </div>

            <div class="m-data-list" id="he-list">
                <div style="text-align:center;padding:40px;color:#8e8e93;">Cargando...</div>
            </div>
        `;

        await this.loadRecords();
        this.renderList();

        document.getElementById('he-search').addEventListener('input', (e) => {
            this.searchRecords(e.target.value);
        });
    },

    mobileFilter(filter, btn) {
        document.querySelectorAll('.he-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyFilter(filter);
        const searchQuery = document.getElementById('he-search')?.value || '';
        if (searchQuery) this.searchRecords(searchQuery);
        else this.renderList();
    },

    renderList() {
        const list = document.getElementById('he-list');
        if (!list) return;

        const delivered = this.filteredRecords.filter(r => r.estado === 'entregado').length;
        const rejected = this.filteredRecords.filter(r => r.estado === 'no_entregado').length;
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setText('hes-delivered', delivered);
        setText('hes-rejected', rejected);
        setText('hes-total', this.filteredRecords.length);

        if (this.filteredRecords.length === 0) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📭</div><div class="m-empty-title">Sin registros</div><div class="m-empty-text">No se encontraron entregas</div></div>';
            return;
        }

        list.innerHTML = this.filteredRecords.map(r => {
            const isDelivered = r.estado === 'entregado';
            const statusColor = isDelivered ? '#dcfce7' : '#fee2e2';
            const statusText = isDelivered ? '✅ Entregado' : '❌ No entregado';
            const statusTextColor = isDelivered ? '#166534' : '#991b1b';
            const photoCount = (r.fotosLocal?.length || 0) + (r.fotosEntrega?.length || 0);

            return `
                <div class="m-data-card" onclick="HistorialEntregas.showDetail('${r.id}')" style="cursor: pointer;">
                    <div class="m-card-header">
                        <span class="m-card-title">#${r.guia || r.id.substring(0, 6).toUpperCase()}</span>
                        <span style="padding: 3px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; background: ${statusColor}; color: ${statusTextColor};">${statusText}</span>
                    </div>
                    <div class="m-card-rows">
                        <div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value">${sanitizeHTML(r.cliente || '-')}</span></div>
                        <div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">${this.formatDate(r.createdAt)}</span></div>
                        <div class="m-card-row"><span class="m-card-label">Venta</span><span class="m-card-value money">$${formatNumber(r.venta || 0, 2)}</span></div>
                        ${r.motivoNoEntrega ? `<div class="m-card-row"><span class="m-card-label">Motivo</span><span class="m-card-value">${this.formatMotivo(r.motivoNoEntrega)}</span></div>` : ''}
                        <div class="m-card-row"><span class="m-card-label">Repartidor</span><span class="m-card-value">${sanitizeHTML(r.nombreRepartidor || '-')}</span></div>
                        ${photoCount > 0 ? `<div class="m-card-row"><span class="m-card-label">Fotos</span><span class="m-card-value">📷 ${photoCount}</span></div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    formatMotivo(motivo) {
        const map = {
            'falta_efectivo': '💵 Falta de efectivo',
            'local_cerrado': '🚪 Local cerrado',
            'otro': '📝 Otro motivo'
        };
        return map[motivo] || motivo;
    },

    showDetail(id) {
        const r = this.records.find(x => x.id === id);
        if (!r) return;

        const isDelivered = r.estado === 'entregado';
        const allPhotos = [
            ...(r.fotosLocal || []).map(url => ({ url, label: 'Local' })),
            ...(r.fotosEntrega || []).map(url => ({ url, label: 'Entrega' }))
        ];

        const photosHtml = allPhotos.length > 0 ? `
            <div style="margin-top: 12px;">
                <div style="font-weight: 600; font-size: 0.8rem; color: var(--m-text-secondary); margin-bottom: 8px;">📷 FOTOS (${allPhotos.length})</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${allPhotos.map(p => `
                        <div style="position: relative;" onclick="HistorialEntregas.viewPhoto('${p.url}'); event.stopPropagation();">
                            <img src="${p.url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 10px; cursor: pointer;">
                            <span style="position: absolute; bottom: 2px; left: 2px; background: rgba(0,0,0,0.6); color: white; font-size: 0.55rem; padding: 1px 5px; border-radius: 4px;">${p.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        const mapHtml = r.ubicacion ? `
            <div style="margin-top: 12px;">
                <div style="font-weight: 600; font-size: 0.8rem; color: var(--m-text-secondary); margin-bottom: 6px;">📍 UBICACIÓN</div>
                <a href="https://www.google.com/maps?q=${r.ubicacion.lat},${r.ubicacion.lng}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--m-primary-light); color: var(--m-primary); border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 0.85rem;">
                    📍 Ver en Google Maps
                </a>
            </div>
        ` : '';

        const html = `
            <div class="m-sheet-backdrop show" onclick="this.nextElementSibling.remove();this.remove();"></div>
            <div class="m-bottom-sheet show">
                <div class="m-sheet-handle"></div>
                <div class="m-sheet-header">
                    <span class="m-sheet-title">#${r.guia || 'Detalle'}</span>
                    <button class="m-sheet-close" onclick="this.closest('.m-bottom-sheet').remove();document.querySelector('.m-sheet-backdrop').remove();">✕</button>
                </div>
                <div class="m-sheet-body">
                    <div style="padding: 10px; background: ${isDelivered ? '#dcfce7' : '#fee2e2'}; border-radius: 12px; margin-bottom: 12px; text-align: center;">
                        <span style="font-weight: 700; color: ${isDelivered ? '#166534' : '#991b1b'}; font-size: 0.95rem;">${isDelivered ? '✅ ENTREGADO' : '❌ NO ENTREGADO'}</span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <div><span style="font-size: 0.65rem; text-transform: uppercase; color: var(--m-text-secondary); font-weight: 600;">Cliente</span><div style="font-weight: 500;">${sanitizeHTML(r.cliente || '-')}</div></div>
                        <div><span style="font-size: 0.65rem; text-transform: uppercase; color: var(--m-text-secondary); font-weight: 600;">Empresa</span><div style="font-weight: 500;">${r.empresa || '-'}</div></div>
                        <div><span style="font-size: 0.65rem; text-transform: uppercase; color: var(--m-text-secondary); font-weight: 600;">Documento</span><div style="font-weight: 500;">${r.docNum || '-'}</div></div>
                        <div><span style="font-size: 0.65rem; text-transform: uppercase; color: var(--m-text-secondary); font-weight: 600;">Zona</span><div style="font-weight: 500;">${sanitizeHTML(r.zona || '-')}</div></div>
                        <div><span style="font-size: 0.65rem; text-transform: uppercase; color: var(--m-text-secondary); font-weight: 600;">Venta</span><div style="font-weight: 700; color: var(--m-success); font-size: 1.05rem;">$${formatNumber(r.venta || 0, 2)}</div></div>
                        <div><span style="font-size: 0.65rem; text-transform: uppercase; color: var(--m-text-secondary); font-weight: 600;">Bultos</span><div style="font-weight: 500;">${r.bultos || 0}</div></div>
                    </div>

                    ${r.motivoNoEntrega ? `
                    <div style="margin-bottom: 12px;">
                        <span style="font-size: 0.65rem; text-transform: uppercase; color: var(--m-text-secondary); font-weight: 600;">Motivo</span>
                        <div style="font-weight: 500; padding: 8px; background: #fef2f2; border-radius: 8px; margin-top: 4px;">${this.formatMotivo(r.motivoNoEntrega)}</div>
                    </div>
                    ` : ''}

                    ${r.observaciones ? `
                    <div style="margin-bottom: 12px;">
                        <span style="font-size: 0.65rem; text-transform: uppercase; color: var(--m-text-secondary); font-weight: 600;">Observaciones</span>
                        <div style="font-weight: 500; padding: 8px; background: var(--m-bg); border-radius: 8px; margin-top: 4px;">${sanitizeHTML(r.observaciones)}</div>
                    </div>
                    ` : ''}

                    <div style="margin-bottom: 12px;">
                        <span style="font-size: 0.65rem; text-transform: uppercase; color: var(--m-text-secondary); font-weight: 600;">Repartidor</span>
                        <div style="font-weight: 500;">${sanitizeHTML(r.nombreRepartidor || '-')}</div>
                    </div>

                    <div style="margin-bottom: 12px;">
                        <span style="font-size: 0.65rem; text-transform: uppercase; color: var(--m-text-secondary); font-weight: 600;">Fecha/Hora</span>
                        <div style="font-weight: 500;">${this.formatDate(r.createdAt)}</div>
                    </div>

                    ${photosHtml}
                    ${mapHtml}
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
    },

    viewPhoto(url) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
        overlay.innerHTML = `<img src="${url}" style="max-width:95%;max-height:95%;object-fit:contain;border-radius:8px;">`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    },

    // ============= DESKTOP RENDER =============
    async renderDesktop() {
        const contentArea = document.getElementById('content-area');

        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>📋 Historial de Entregas</h1>
                    <p>Consulta de entregas registradas</p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button id="btn-he-export" class="btn btn-secondary" onclick="HistorialEntregas.exportExcel()">📥 Exportar Excel</button>
                </div>
            </div>

            <div class="stats-grid" id="he-desktop-stats">
                <div class="stat-card"><h3>Entregados</h3><p id="hed-delivered">0</p></div>
                <div class="stat-card"><h3>No Entregados</h3><p id="hed-rejected">0</p></div>
                <div class="stat-card"><h3>Total</h3><p id="hed-total">0</p></div>
                <div class="stat-card"><h3>Fotos</h3><p id="hed-photos">0</p></div>
            </div>

            <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                <input type="text" id="he-desktop-search" placeholder="🔍 Buscar cliente, guía, documento, repartidor..." style="flex: 1; min-width: 250px; padding: 0.6rem 1rem; font-size: 0.95rem; border: 2px solid var(--border-color); border-radius: var(--radius-md); font-family: var(--font-family);">
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary he-desktop-filter active" data-filter="all" onclick="HistorialEntregas.desktopFilter('all', this)">Todos</button>
                    <button class="btn btn-secondary he-desktop-filter" data-filter="entregado" onclick="HistorialEntregas.desktopFilter('entregado', this)">✅ Entregados</button>
                    <button class="btn btn-secondary he-desktop-filter" data-filter="no_entregado" onclick="HistorialEntregas.desktopFilter('no_entregado', this)">❌ No Entregados</button>
                </div>
            </div>

            <div class="card">
                <div class="table-container">
                    <table class="data-table" id="he-desktop-table">
                        <thead>
                            <tr>
                                <th>Guía</th>
                                <th>Cliente</th>
                                <th>Empresa</th>
                                <th>Documento</th>
                                <th>Zona</th>
                                <th>Venta</th>
                                <th>Fecha</th>
                                <th>Estado</th>
                                <th>Repartidor</th>
                                <th>Fotos</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody id="he-desktop-body">
                            <tr><td colspan="11" style="text-align: center; padding: 2rem;">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        await this.loadRecords();
        this.renderDesktopTable();

        document.getElementById('he-desktop-search').addEventListener('input', (e) => {
            this.desktopSearch(e.target.value);
        });
    },

    desktopSearch(query) {
        if (!query || query.trim().length < 2) {
            this.applyFilter(this.currentFilter);
            this.renderDesktopTable();
            return;
        }
        const q = query.toLowerCase().trim();
        this.applyFilter(this.currentFilter);
        this.filteredRecords = this.filteredRecords.filter(r =>
            (r.guia || '').toLowerCase().includes(q) ||
            (r.cliente || '').toLowerCase().includes(q) ||
            (r.docNum || '').toLowerCase().includes(q) ||
            (r.nombreRepartidor || '').toLowerCase().includes(q)
        );
        this.renderDesktopTable();
    },

    desktopFilter(filter, btn) {
        document.querySelectorAll('.he-desktop-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = filter;
        const searchQuery = document.getElementById('he-desktop-search')?.value || '';
        if (searchQuery) this.desktopSearch(searchQuery);
        else {
            this.applyFilter(filter);
            this.renderDesktopTable();
        }
    },

    renderDesktopTable() {
        const tbody = document.getElementById('he-desktop-body');
        if (!tbody) return;

        const delivered = this.filteredRecords.filter(r => r.estado === 'entregado').length;
        const rejected = this.filteredRecords.filter(r => r.estado === 'no_entregado').length;
        const totalPhotos = this.filteredRecords.reduce((s, r) => s + (r.fotosLocal?.length || 0) + (r.fotosEntrega?.length || 0), 0);

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setText('hed-delivered', delivered);
        setText('hed-rejected', rejected);
        setText('hed-total', this.filteredRecords.length);
        setText('hed-photos', totalPhotos);

        if (this.filteredRecords.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 2rem;">Sin registros</td></tr>';
            return;
        }

        tbody.innerHTML = this.filteredRecords.map(r => {
            const isDelivered = r.estado === 'entregado';
            const statusBg = isDelivered ? '#dcfce7' : '#fee2e2';
            const statusColor = isDelivered ? '#166534' : '#991b1b';
            const photoCount = (r.fotosLocal?.length || 0) + (r.fotosEntrega?.length || 0);

            return `
                <tr style="cursor: pointer;" onclick="HistorialEntregas.desktopDetail('${r.id}')">
                    <td><strong>#${r.guia || '-'}</strong></td>
                    <td>${sanitizeHTML(r.cliente || '-')}</td>
                    <td>${r.empresa || '-'}</td>
                    <td>${r.docNum || '-'}</td>
                    <td>${sanitizeHTML(r.zona || '-')}</td>
                    <td><strong>$${formatNumber(r.venta || 0, 2)}</strong></td>
                    <td style="font-size: 0.8rem;">${this.formatDate(r.createdAt)}</td>
                    <td><span style="padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; background: ${statusBg}; color: ${statusColor};">${isDelivered ? '✅ Entregado' : '❌ No entregado'}</span></td>
                    <td style="font-size: 0.85rem;">${sanitizeHTML(r.nombreRepartidor || '-')}</td>
                    <td>${photoCount > 0 ? '📷 ' + photoCount : '-'}</td>
                    <td><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); HistorialEntregas.desktopDetail('${r.id}')">Ver</button></td>
                </tr>
            `;
        }).join('');
    },

    desktopDetail(id) {
        const r = this.records.find(x => x.id === id);
        if (!r) return;

        const isDelivered = r.estado === 'entregado';
        const allPhotos = [
            ...(r.fotosLocal || []).map(url => ({ url, label: 'Local' })),
            ...(r.fotosEntrega || []).map(url => ({ url, label: 'Entrega' }))
        ];

        const photosHtml = allPhotos.length > 0 ? `
            <div style="margin-top: 1rem;">
                <h4 style="margin-bottom: 0.5rem;">📷 Fotos</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    ${allPhotos.map(p => `
                        <div style="position: relative; cursor: pointer;" onclick="HistorialEntregas.viewPhoto('${p.url}')">
                            <img src="${p.url}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px;">
                            <span style="position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.6); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px;">${p.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        const mapHtml = r.ubicacion ? `
            <div style="margin-top: 1rem;">
                <h4 style="margin-bottom: 0.5rem;">📍 Ubicación</h4>
                <a href="https://www.google.com/maps?q=${r.ubicacion.lat},${r.ubicacion.lng}" target="_blank" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 6px;">
                    📍 Ver en Google Maps
                </a>
            </div>
        ` : '';

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 650px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <h2>Detalle de Entrega #${r.guia || r.id.substring(0, 6).toUpperCase()}</h2>
                    <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">✕</button>
                </div>

                <div style="padding: 12px; background: ${isDelivered ? '#dcfce7' : '#fee2e2'}; border-radius: var(--radius-md); margin-bottom: 1rem; text-align: center;">
                    <strong style="color: ${isDelivered ? '#166534' : '#991b1b'};">${isDelivered ? '✅ ENTREGADO' : '❌ NO ENTREGADO'}</strong>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div><span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Cliente</span><div style="font-weight: 500;">${sanitizeHTML(r.cliente || '-')}</div></div>
                    <div><span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Empresa</span><div style="font-weight: 500;">${r.empresa || '-'}</div></div>
                    <div><span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Documento</span><div style="font-weight: 500;">${r.docNum || '-'}</div></div>
                    <div><span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Zona</span><div style="font-weight: 500;">${sanitizeHTML(r.zona || '-')}</div></div>
                    <div><span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Venta</span><div style="font-weight: 700; color: var(--success); font-size: 1.1rem;">$${formatNumber(r.venta || 0, 2)}</div></div>
                    <div><span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Bultos</span><div style="font-weight: 500;">${r.bultos || 0}</div></div>
                    <div><span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Repartidor</span><div style="font-weight: 500;">${sanitizeHTML(r.nombreRepartidor || '-')}</div></div>
                    <div><span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Fecha/Hora</span><div style="font-weight: 500;">${this.formatDate(r.createdAt)}</div></div>
                </div>

                ${r.motivoNoEntrega ? `
                <div style="margin-bottom: 1rem;">
                    <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Motivo de no entrega</span>
                    <div style="padding: 8px; background: #fef2f2; border-radius: var(--radius-md); margin-top: 4px; font-weight: 500;">${this.formatMotivo(r.motivoNoEntrega)}</div>
                </div>
                ` : ''}

                ${r.observaciones ? `
                <div style="margin-bottom: 1rem;">
                    <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Observaciones</span>
                    <div style="padding: 8px; background: var(--bg-secondary); border-radius: var(--radius-md); margin-top: 4px;">${sanitizeHTML(r.observaciones)}</div>
                </div>
                ` : ''}

                ${photosHtml}
                ${mapHtml}
            </div>
        `;

        document.body.appendChild(modal);
    },

    exportExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('Librería Excel no disponible', 'error');
            return;
        }
        if (this.filteredRecords.length === 0) {
            showToast('No hay datos para exportar', 'warning');
            return;
        }

        const data = this.filteredRecords.map(r => ({
            'Guía': r.guia || '',
            'Cliente': r.cliente || '',
            'Empresa': r.empresa || '',
            'Documento': r.docNum || '',
            'Zona': r.zona || '',
            'Venta': r.venta || 0,
            'Bultos': r.bultos || 0,
            'Estado': r.estado === 'entregado' ? 'Entregado' : 'No Entregado',
            'Motivo': this.formatMotivo(r.motivoNoEntrega || ''),
            'Observaciones': r.observaciones || '',
            'Repartidor': r.nombreRepartidor || '',
            'Fecha': this.formatDate(r.createdAt),
            'Fotos Local': (r.fotosLocal || []).length,
            'Fotos Entrega': (r.fotosEntrega || []).length
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Historial');
        XLSX.writeFile(wb, 'Historial_Entregas_' + new Date().toISOString().split('T')[0] + '.xlsx');
        showToast('Excel exportado');
    }
};

window.HistorialEntregas = HistorialEntregas;
