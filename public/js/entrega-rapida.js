// ===================================
// Entrega Rápida Module (Mobile-First)
// ===================================

const EntregaRapida = {
    records: [],
    filteredRecords: [],
    loading: false,
    userLocation: null,
    pendingPhotosLocal: [],
    pendingPhotosEntrega: [],

    async render() {
        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }
        return this.renderDesktop();
    },

    // ============= MOBILE RENDER =============
    async renderMobile() {
        const contentArea = document.getElementById('content-area');

        contentArea.innerHTML = `
            <div style="padding: 0 0 8px 0;">
                <h1 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 2px; color: var(--m-text);">📦 Entrega Rápida</h1>
                <p style="font-size: 0.78rem; color: var(--m-text-secondary);" id="er-location-status">📍 Obteniendo ubicación...</p>
            </div>

            <div class="m-search-bar">
                <span class="search-icon-m">🔍</span>
                <input type="text" id="er-search" placeholder="Buscar por guía, nombre o documento..." autofocus>
            </div>

            <div class="m-stats-row" id="er-stats">
                <div class="m-stat-chip"><div class="m-stat-chip-label">Pendientes</div><div class="m-stat-chip-value" id="ers-pending">0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Entregados</div><div class="m-stat-chip-value" id="ers-delivered">0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Total</div><div class="m-stat-chip-value" id="ers-total">0</div></div>
            </div>

            <div class="m-data-list" id="er-results">
                <div class="m-empty">
                    <div class="m-empty-icon">📦</div>
                    <div class="m-empty-title">Busca un registro</div>
                    <div class="m-empty-text">Escribe el nombre del cliente o número de documento</div>
                </div>
            </div>
        `;

        this.obtainLocation();

        document.getElementById('er-search').addEventListener('input', (e) => {
            this.searchRecords(e.target.value);
        });

        await this.loadInterlogicRecords();
    },

    obtainLocation() {
        const statusEl = document.getElementById('er-location-status');
        if (!navigator.geolocation) {
            if (statusEl) statusEl.textContent = '📍 GPS no disponible';
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                if (statusEl) statusEl.textContent = '📍 Ubicación activa ✅';
            },
            () => {
                if (statusEl) statusEl.textContent = '📍 No se pudo obtener ubicación';
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    },

    async loadInterlogicRecords() {
        this.loading = true;
        try {
            const snapshot = await firebase.firestore().collection('interlogic')
                .orderBy('createdAt', 'desc')
                .limit(200)
                .get();
            this.records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error('Error loading interlogic records:', e);
            showToast('Error al cargar registros', 'error');
        }
        this.loading = false;
    },

    searchRecords(query) {
        const list = document.getElementById('er-results');
        if (!list) return;

        if (!query || query.trim().length < 2) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📦</div><div class="m-empty-title">Busca un registro</div><div class="m-empty-text">Escribe el nombre del cliente o número de documento</div></div>';
            document.getElementById('ers-pending').textContent = '0';
            document.getElementById('ers-delivered').textContent = '0';
            document.getElementById('ers-total').textContent = '0';
            return;
        }

        const q = query.toLowerCase().trim();
        this.filteredRecords = this.records.filter(r =>
            (r.guia || '').toLowerCase().includes(q) ||
            (r.cliente || '').toLowerCase().includes(q) ||
            (r.docNum || '').toLowerCase().includes(q) ||
            (r.doc || '').toLowerCase().includes(q)
        );

        const pending = this.filteredRecords.length;
        document.getElementById('ers-pending').textContent = pending;
        document.getElementById('ers-delivered').textContent = '0';
        document.getElementById('ers-total').textContent = pending;

        if (this.filteredRecords.length === 0) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">🔍</div><div class="m-empty-title">Sin resultados</div><div class="m-empty-text">No se encontraron registros con ese criterio</div></div>';
            return;
        }

        list.innerHTML = this.filteredRecords.map(r => `
            <div class="m-data-card" style="border-left: 4px solid var(--m-primary);">
                <div class="m-card-header">
                    <span class="m-card-title">#${r.guia || r.id.substring(0, 6).toUpperCase()}</span>
                    <span class="m-card-badge ${r.empresa === 'DALSE' ? 'primary' : 'warning'}">${r.empresa || ''}</span>
                </div>
                <div class="m-card-rows">
                    <div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value">${sanitizeHTML(r.cliente || '-')}</span></div>
                    <div class="m-card-row"><span class="m-card-label">Doc</span><span class="m-card-value">${r.doc || ''} ${r.docNum || ''}</span></div>
                    <div class="m-card-row"><span class="m-card-label">Venta</span><span class="m-card-value money">$${formatNumber(r.venta || 0, 2)}</span></div>
                    <div class="m-card-row"><span class="m-card-label">Bultos</span><span class="m-card-value">${r.bultos || 0}</span></div>
                    <div class="m-card-row"><span class="m-card-label">Zona</span><span class="m-card-value">${sanitizeHTML(r.zona || '-')}</span></div>
                </div>
                <div class="m-card-actions" style="padding: 8px 12px; gap: 8px;">
                    <button class="btn" style="flex:1; background: #dcfce7; color: #166534; font-weight: 700; padding: 12px; border-radius: 12px; font-size: 0.9rem;" onclick="EntregaRapida.showDeliverSheet('${r.id}', 'entregado')">
                        ✅ Entregado
                    </button>
                    <button class="btn" style="flex:1; background: #fee2e2; color: #991b1b; font-weight: 700; padding: 12px; border-radius: 12px; font-size: 0.9rem;" onclick="EntregaRapida.showDeliverSheet('${r.id}', 'no_entregado')">
                        ❌ No Entregado
                    </button>
                </div>
            </div>
        `).join('');
    },

    showDeliverSheet(recordId, estado) {
        const record = this.records.find(r => r.id === recordId);
        if (!record) return;

        this.pendingPhotosLocal = [];
        this.pendingPhotosEntrega = [];
        this._currentRecord = record;
        this._currentEstado = estado;

        const isNoEntrega = estado === 'no_entregado';
        const title = isNoEntrega ? '❌ No se pudo entregar' : '✅ Confirmar Entrega';
        const titleColor = isNoEntrega ? '#991b1b' : '#166534';

        const motiveButtons = isNoEntrega ? `
            <div style="margin-bottom: 12px;">
                <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 8px; color: var(--m-text);">¿Por qué?</div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button class="btn er-motive-btn" data-motive="falta_efectivo" style="text-align: left; padding: 12px; border-radius: 12px; border: 2px solid var(--m-separator); background: white;" onclick="EntregaRapida.selectMotive(this, 'falta_efectivo')">
                        💵 Falta de efectivo
                    </button>
                    <button class="btn er-motive-btn" data-motive="local_cerrado" style="text-align: left; padding: 12px; border-radius: 12px; border: 2px solid var(--m-separator); background: white;" onclick="EntregaRapida.selectMotive(this, 'local_cerrado')">
                        🚪 Local cerrado
                    </button>
                    <button class="btn er-motive-btn" data-motive="otro" style="text-align: left; padding: 12px; border-radius: 12px; border: 2px solid var(--m-separator); background: white;" onclick="EntregaRapida.selectMotive(this, 'otro')">
                        📝 Otra razón
                    </button>
                </div>
            </div>
            <div id="er-motive-text-group" style="display: none; margin-bottom: 12px;">
                <textarea id="er-motive-text" placeholder="Describe el motivo..." rows="2" style="width: 100%; padding: 10px; border: 2px solid var(--m-separator); border-radius: 12px; font-family: var(--font-family); font-size: 0.9rem; resize: none;"></textarea>
            </div>
        ` : '';

        const html = `
            <div class="m-sheet-backdrop show" onclick="EntregaRapida.closeSheet()"></div>
            <div class="m-bottom-sheet show" id="er-sheet">
                <div class="m-sheet-handle"></div>
                <div class="m-sheet-header">
                    <span class="m-sheet-title" style="color: ${titleColor};">${title}</span>
                    <button class="m-sheet-close" onclick="EntregaRapida.closeSheet()">✕</button>
                </div>
                <div class="m-sheet-body">
                    <div style="background: var(--m-bg); padding: 12px; border-radius: 12px; margin-bottom: 16px;">
                        <div style="font-weight: 700; font-size: 0.95rem;">#${record.guia || record.id.substring(0, 6).toUpperCase()}</div>
                        <div style="font-size: 0.85rem; color: var(--m-text-secondary);">${sanitizeHTML(record.cliente || '')} | ${record.empresa || ''}</div>
                        <div style="font-weight: 600; color: var(--m-success);">$${formatNumber(record.venta || 0, 2)}</div>
                    </div>

                    ${motiveButtons}

                    <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 8px;">📷 Fotos del local (máx. 5)</div>
                        <div id="er-photos-local" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
                        <label style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; background: var(--m-primary-light); color: var(--m-primary); border-radius: 12px; font-weight: 600; font-size: 0.85rem; cursor: pointer; margin-top: 8px;">
                            📷 Agregar foto
                            <input type="file" accept="image/*" capture="environment" style="display: none;" onchange="EntregaRapida.addPhoto(this, 'local')">
                        </label>
                    </div>

                    <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 8px;">📷 Fotos de la entrega (máx. 5)</div>
                        <div id="er-photos-entrega" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
                        <label style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; background: var(--m-primary-light); color: var(--m-primary); border-radius: 12px; font-weight: 600; font-size: 0.85rem; cursor: pointer; margin-top: 8px;">
                            📷 Agregar foto
                            <input type="file" accept="image/*" capture="environment" style="display: none;" onchange="EntregaRapida.addPhoto(this, 'entrega')">
                        </label>
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px; padding: 10px; background: ${this.userLocation ? '#dcfce7' : '#fee2e2'}; border-radius: 12px; font-size: 0.85rem; margin-bottom: 16px;">
                        📍 ${this.userLocation ? 'Ubicación capturada ✅' : 'Sin ubicación ⚠️'}
                    </div>
                </div>
                <div class="m-sheet-footer">
                    <button class="btn" onclick="EntregaRapida.closeSheet()" style="flex: 1;">Cancelar</button>
                    <button class="btn btn-primary" id="er-save-btn" style="flex: 2; padding: 14px;" onclick="EntregaRapida.saveDelivery()">
                        ${isNoEntrega ? '💾 Guardar' : '✅ Confirmar Entrega'}
                    </button>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
    },

    selectMotive(btn, motive) {
        document.querySelectorAll('.er-motive-btn').forEach(b => {
            b.style.borderColor = 'var(--m-separator)';
            b.style.background = 'white';
        });
        btn.style.borderColor = 'var(--m-primary)';
        btn.style.background = 'var(--m-primary-light)';
        this._selectedMotive = motive;

        const textGroup = document.getElementById('er-motive-text-group');
        if (textGroup) textGroup.style.display = motive === 'otro' ? 'block' : 'none';
    },

    async addPhoto(input, type) {
        const file = input.files[0];
        if (!file) return;

        const arr = type === 'local' ? this.pendingPhotosLocal : this.pendingPhotosEntrega;
        if (arr.length >= 5) {
            showToast('Máximo 5 fotos por categoría', 'warning');
            return;
        }

        showToast('Comprimiendo imagen...', 'info');
        const compressed = await compressImage(file, 1, 1920);
        arr.push(compressed);

        this.renderPhotoPreview(type);
        input.value = '';
    },

    renderPhotoPreview(type) {
        const container = document.getElementById(`er-photos-${type}`);
        if (!container) return;
        const arr = type === 'local' ? this.pendingPhotosLocal : this.pendingPhotosEntrega;

        container.innerHTML = arr.map((file, i) => {
            const url = URL.createObjectURL(file);
            return `
                <div style="position: relative; width: 70px; height: 70px; border-radius: 10px; overflow: hidden;">
                    <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
                    <button onclick="EntregaRapida.removePhoto('${type}', ${i})" style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer;">✕</button>
                </div>
            `;
        }).join('');
    },

    removePhoto(type, index) {
        if (type === 'local') {
            this.pendingPhotosLocal.splice(index, 1);
        } else {
            this.pendingPhotosEntrega.splice(index, 1);
        }
        this.renderPhotoPreview(type);
    },

    async saveDelivery() {
        const btn = document.getElementById('er-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

        try {
            const record = this._currentRecord;
            const estado = this._currentEstado;
            const db = firebase.firestore();
            const uid = firebase.auth().currentUser.uid;
            const userData = window.currentUserData || {};

            const uploadPhotos = async (files, path) => {
                const urls = [];
                const paths = [];
                for (let i = 0; i < files.length; i++) {
                    const fileName = `${uid}_${Date.now()}_${i}.jpg`;
                    const fullPath = `${path}/${fileName}`;
                    const ref = firebase.storage().ref(fullPath);
                    await ref.put(files[i]);
                    const url = await ref.getDownloadURL();
                    urls.push(url);
                    paths.push(fullPath);
                }
                return { urls, paths };
            };

            const localResult = await uploadPhotos(this.pendingPhotosLocal, 'entregasRapidas');
            const entregaResult = await uploadPhotos(this.pendingPhotosEntrega, 'entregasRapidas');

            let motivoNoEntrega = '';
            let observaciones = '';
            if (estado === 'no_entregado') {
                motivoNoEntrega = this._selectedMotive || '';
                const motiveText = document.getElementById('er-motive-text');
                observaciones = motiveText ? motiveText.value : '';
            }

            await db.collection('entregasRapidas').add({
                interlogicId: record.id,
                guia: record.guia || '',
                docNum: record.docNum || '',
                cliente: record.cliente || '',
                empresa: record.empresa || '',
                zona: record.zona || '',
                venta: record.venta || 0,
                bultos: record.bultos || 0,
                estado,
                motivoNoEntrega,
                observaciones,
                fotosLocal: localResult.urls,
                fotosEntrega: entregaResult.urls,
                fotosLocalPaths: localResult.paths,
                fotosEntregaPaths: entregaResult.paths,
                ubicacion: this.userLocation || null,
                registradoPor: uid,
                nombreRepartidor: userData.nombre || userData.name || 'Sin nombre',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.closeSheet();
            showToast(estado === 'entregado' ? '✅ Entrega registrada' : '❌ No entrega registrada', 'success');

            const searchInput = document.getElementById('er-search');
            if (searchInput && searchInput.value) {
                this.searchRecords(searchInput.value);
            }
        } catch (e) {
            console.error('Error saving delivery:', e);
            showToast('Error al guardar: ' + e.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
        }
    },

    closeSheet() {
        const sheet = document.getElementById('er-sheet');
        const backdrop = sheet ? sheet.previousElementSibling : null;
        if (sheet) sheet.remove();
        if (backdrop && backdrop.classList.contains('m-sheet-backdrop')) backdrop.remove();
    },

    // ============= DESKTOP RENDER =============
    async renderDesktop() {
        const contentArea = document.getElementById('content-area');

        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>📦 Entrega Rápida</h1>
                    <p>Registro rápido de entregas</p>
                </div>
            </div>

            <div class="stats-grid" id="er-desktop-stats">
                <div class="stat-card"><h3>Pendientes</h3><p id="erd-pending">0</p></div>
                <div class="stat-card"><h3>Entregados</h3><p id="erd-delivered">0</p></div>
                <div class="stat-card"><h3>No Entregados</h3><p id="erd-rejected">0</p></div>
                <div class="stat-card"><h3>Total</h3><p id="erd-total">0</p></div>
            </div>

            <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                <input type="text" id="er-desktop-search" placeholder="🔍 Buscar por guía, cliente, documento..." style="flex: 1; min-width: 250px; padding: 0.6rem 1rem; font-size: 0.95rem; border: 2px solid var(--border-color); border-radius: var(--radius-md); font-family: var(--font-family);">
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary er-filter-btn active" data-filter="all" onclick="EntregaRapida.desktopFilter('all', this)">Todos</button>
                    <button class="btn btn-secondary er-filter-btn" data-filter="pendiente" onclick="EntregaRapida.desktopFilter('pendiente', this)">Pendientes</button>
                    <button class="btn btn-secondary er-filter-btn" data-filter="entregado" onclick="EntregaRapida.desktopFilter('entregado', this)">Entregados</button>
                    <button class="btn btn-secondary er-filter-btn" data-filter="no_entregado" onclick="EntregaRapida.desktopFilter('no_entregado', this)">No Entregados</button>
                </div>
            </div>

            <div class="card">
                <div class="table-container">
                    <table class="data-table" id="er-desktop-table">
                        <thead>
                            <tr>
                                <th>Guía</th>
                                <th>Cliente</th>
                                <th>Empresa</th>
                                <th>Doc</th>
                                <th>Zona</th>
                                <th>Venta</th>
                                <th>Bultos</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody id="er-desktop-body">
                            <tr><td colspan="9" style="text-align: center; padding: 2rem;">Cargando registros...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        await this.loadInterlogicRecords();
        this.renderDesktopTable(this.records);

        document.getElementById('er-desktop-search').addEventListener('input', (e) => {
            this.desktopSearch(e.target.value);
        });
    },

    desktopSearch(query) {
        if (!query || query.trim().length < 2) {
            this.renderDesktopTable(this.records);
            return;
        }
        const q = query.toLowerCase().trim();
        const filtered = this.records.filter(r =>
            (r.guia || '').toLowerCase().includes(q) ||
            (r.cliente || '').toLowerCase().includes(q) ||
            (r.docNum || '').toLowerCase().includes(q)
        );
        this.renderDesktopTable(filtered);
    },

    desktopFilter(filter, btn) {
        document.querySelectorAll('.er-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._desktopFilter = filter;

        let data = this.records;
        if (filter !== 'all') {
            const entregas = this._desktopDeliveries || [];
            const entregadosIds = new Set(entregas.filter(e => e.estado === filter).map(e => e.interlogicId));
            if (filter === 'pendiente') {
                data = this.records.filter(r => !entregadosIds.has(r.id));
            } else {
                data = this.records.filter(r => entregadosIds.has(r.id));
            }
        }
        this.renderDesktopTable(data);
    },

    renderDesktopTable(records) {
        const tbody = document.getElementById('er-desktop-body');
        if (!tbody) return;

        const pendientes = records.length;
        document.getElementById('erd-pending').textContent = pendientes;
        document.getElementById('erd-delivered').textContent = '0';
        document.getElementById('erd-rejected').textContent = '0';
        document.getElementById('erd-total').textContent = pendientes;

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">Sin registros</td></tr>';
            return;
        }

        tbody.innerHTML = records.map(r => `
            <tr>
                <td><strong>#${r.guia || '-'}</strong></td>
                <td>${sanitizeHTML(r.cliente || '-')}</td>
                <td>${r.empresa || '-'}</td>
                <td>${r.doc || ''} ${r.docNum || ''}</td>
                <td>${sanitizeHTML(r.zona || '-')}</td>
                <td><strong>$${formatNumber(r.venta || 0, 2)}</strong></td>
                <td>${r.bultos || 0}</td>
                <td><span style="padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; background: #fef3c7; color: #92400e;">Pendiente</span></td>
                <td>
                    <button class="btn btn-sm" style="background: #dcfce7; color: #166534; margin-right: 4px;" onclick="EntregaRapida.desktopDeliver('${r.id}', 'entregado')">✅</button>
                    <button class="btn btn-sm" style="background: #fee2e2; color: #991b1b;" onclick="EntregaRapida.desktopDeliver('${r.id}', 'no_entregado')">❌</button>
                </td>
            </tr>
        `).join('');
    },

    desktopDeliver(recordId, estado) {
        const record = this.records.find(r => r.id === recordId);
        if (!record) return;

        this.pendingPhotosLocal = [];
        this.pendingPhotosEntrega = [];
        this._currentRecord = record;
        this._currentEstado = estado;

        const isNoEntrega = estado === 'no_entregado';

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'er-desktop-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px;">
                <h2 style="margin-bottom: 1rem; color: ${isNoEntrega ? '#991b1b' : '#166534'};">
                    ${isNoEntrega ? '❌ No Entregado' : '✅ Confirmar Entrega'}
                </h2>
                <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
                    <strong>#${record.guia || '-'}</strong> — ${sanitizeHTML(record.cliente || '')}<br>
                    <span style="color: var(--text-secondary);">${record.empresa || ''} | $${formatNumber(record.venta || 0, 2)} | ${record.bultos || 0} bultos</span>
                </div>

                ${isNoEntrega ? `
                <div class="form-group">
                    <label style="font-weight: 600;">¿Por qué no se entregó?</label>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                        <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 2px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer;">
                            <input type="radio" name="er-motive-desktop" value="falta_efectivo"> 💵 Falta de efectivo
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 2px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer;">
                            <input type="radio" name="er-motive-desktop" value="local_cerrado"> 🚪 Local cerrado
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 2px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer;">
                            <input type="radio" name="er-motive-desktop" value="otro"> 📝 Otra razón
                        </label>
                    </div>
                </div>
                <div class="form-group" id="er-desktop-motive-text" style="display: none;">
                    <label>Describe el motivo</label>
                    <textarea id="er-desktop-motive-input" rows="2" placeholder="Motivo..."></textarea>
                </div>
                ` : ''}

                <div class="form-group">
                    <label style="font-weight: 600;">📷 Fotos del local (máx. 5)</label>
                    <div id="er-desktop-photos-local" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;"></div>
                    <input type="file" accept="image/*" id="er-desktop-file-local" style="margin-top: 8px;">
                </div>

                <div class="form-group">
                    <label style="font-weight: 600;">📷 Fotos de la entrega (máx. 5)</label>
                    <div id="er-desktop-photos-entrega" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;"></div>
                    <input type="file" accept="image/*" id="er-desktop-file-entrega" style="margin-top: 8px;">
                </div>

                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button class="btn btn-secondary" onclick="document.getElementById('er-desktop-modal').remove()">Cancelar</button>
                    <button class="btn btn-primary" id="er-desktop-save" onclick="EntregaRapida.saveDesktopDelivery()">
                        ${isNoEntrega ? '💾 Guardar' : '✅ Confirmar'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        if (isNoEntrega) {
            modal.querySelectorAll('input[name="er-motive-desktop"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    const textGroup = document.getElementById('er-desktop-motive-text');
                    if (textGroup) textGroup.style.display = radio.value === 'otro' ? 'block' : 'none';
                });
            });
        }

        document.getElementById('er-desktop-file-local').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || this.pendingPhotosLocal.length >= 5) return;
            const compressed = await compressImage(file, 1, 1920);
            this.pendingPhotosLocal.push(compressed);
            this.renderDesktopPhotoPreview('local');
            e.target.value = '';
        });

        document.getElementById('er-desktop-file-entrega').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || this.pendingPhotosEntrega.length >= 5) return;
            const compressed = await compressImage(file, 1, 1920);
            this.pendingPhotosEntrega.push(compressed);
            this.renderDesktopPhotoPreview('entrega');
            e.target.value = '';
        });
    },

    renderDesktopPhotoPreview(type) {
        const container = document.getElementById(`er-desktop-photos-${type}`);
        if (!container) return;
        const arr = type === 'local' ? this.pendingPhotosLocal : this.pendingPhotosEntrega;

        container.innerHTML = arr.map((file, i) => {
            const url = URL.createObjectURL(file);
            return `
                <div style="position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden;">
                    <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
                    <button onclick="EntregaRapida.removeDesktopPhoto('${type}', ${i})" style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer;">✕</button>
                </div>
            `;
        }).join('');
    },

    removeDesktopPhoto(type, index) {
        if (type === 'local') this.pendingPhotosLocal.splice(index, 1);
        else this.pendingPhotosEntrega.splice(index, 1);
        this.renderDesktopPhotoPreview(type);
    },

    async saveDesktopDelivery() {
        const btn = document.getElementById('er-desktop-save');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

        try {
            const record = this._currentRecord;
            const estado = this._currentEstado;
            const db = firebase.firestore();
            const uid = firebase.auth().currentUser.uid;
            const userData = window.currentUserData || {};

            let motivoNoEntrega = '';
            let observaciones = '';
            if (estado === 'no_entregado') {
                const selected = document.querySelector('input[name="er-motive-desktop"]:checked');
                motivoNoEntrega = selected ? selected.value : '';
                const motiveInput = document.getElementById('er-desktop-motive-input');
                observaciones = motiveInput ? motiveInput.value : '';
            }

            const uploadPhotos = async (files, path) => {
                const urls = [];
                const paths = [];
                for (let i = 0; i < files.length; i++) {
                    const fileName = `${uid}_${Date.now()}_${i}.jpg`;
                    const fullPath = `${path}/${fileName}`;
                    const ref = firebase.storage().ref(fullPath);
                    await ref.put(files[i]);
                    const url = await ref.getDownloadURL();
                    urls.push(url);
                    paths.push(fullPath);
                }
                return { urls, paths };
            };

            const localResult = await uploadPhotos(this.pendingPhotosLocal, 'entregasRapidas');
            const entregaResult = await uploadPhotos(this.pendingPhotosEntrega, 'entregasRapidas');

            await db.collection('entregasRapidas').add({
                interlogicId: record.id,
                guia: record.guia || '',
                docNum: record.docNum || '',
                cliente: record.cliente || '',
                empresa: record.empresa || '',
                zona: record.zona || '',
                venta: record.venta || 0,
                bultos: record.bultos || 0,
                estado,
                motivoNoEntrega,
                observaciones,
                fotosLocal: localResult.urls,
                fotosEntrega: entregaResult.urls,
                fotosLocalPaths: localResult.paths,
                fotosEntregaPaths: entregaResult.paths,
                ubicacion: null,
                registradoPor: uid,
                nombreRepartidor: userData.nombre || userData.name || 'Sin nombre',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            document.getElementById('er-desktop-modal').remove();
            showToast(estado === 'entregado' ? '✅ Entrega registrada' : '❌ No entrega registrada', 'success');

            const searchInput = document.getElementById('er-desktop-search');
            if (searchInput) this.desktopSearch(searchInput.value);
            else this.renderDesktopTable(this.records);
        } catch (e) {
            console.error('Error saving:', e);
            showToast('Error al guardar: ' + e.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
        }
    }
};

window.EntregaRapida = EntregaRapida;
