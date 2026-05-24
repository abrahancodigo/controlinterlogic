// ===================================
// Problemas Module - Premium UI
// ===================================

const Problemas = {
    records: [],
    filteredRecords: [],
    unsubscribe: null,
    interlogicRecords: [],
    selectedFactura: null,
    editingId: null,
    selectedImages: [],
    existingImages: [],

    async render() {
        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }
        const contentArea = document.getElementById('content-area');
        const canCreate = window.permissions?.canCreate;

        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>🚨 Registro de Problemas</h1>
                    <p>Control de incidencias y novedades en entregas</p>
                </div>
                <button id="btn-add-problema" class="btn btn-primary btn-lg ${!canCreate ? 'btn-disabled' : ''}" ${!canCreate ? 'disabled' : ''}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo Problema
                </button>
            </div>

            <div id="problemas-timeline" class="problemas-timeline">
                <div class="problemas-loading">
                    <div class="spinner-ring"></div>
                    <p>Cargando problemas...</p>
                </div>
            </div>
        `;

        document.getElementById('btn-add-problema').addEventListener('click', () => {
            if (canCreate) this.showForm();
        });

        await this.loadProblemas();
    },

    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        const canCreate = window.permissions?.canCreate;
        this.isMobile = true;

        contentArea.innerHTML = `
            <div style="padding:0 0 8px 0;">
                <h1 style="font-size:1.35rem;font-weight:800;margin-bottom:2px;color:var(--m-text);">🚨 Problemas</h1>
                <p style="font-size:0.78rem;color:var(--m-text-secondary);">Control de incidencias</p>
            </div>
            <div class="m-actions-bar">
                <button class="btn btn-primary" id="mprob-btn-add" style="border-radius:20px;">➕ Nuevo Problema</button>
            </div>
            <div id="mprob-list" class="m-data-list">
                <div style="text-align:center;padding:40px;color:#8e8e93;">
                    <div class="spinner-ring" style="margin:0 auto 12px;"></div>
                    <p>Cargando problemas...</p>
                </div>
            </div>
        `;

        document.getElementById('mprob-btn-add').addEventListener('click', () => {
            if (canCreate) this.showForm();
        });

        await this.loadProblemas();
    },

    async loadProblemas() {
        if (this.unsubscribe) this.unsubscribe();

        const db = firebase.firestore();
        this.unsubscribe = db.collection('problemas')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                this.records = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.filteredRecords = [...this.records];
                if (this.isMobile) {
                    this.renderMobileCards();
                } else {
                    this.renderCards();
                }
            }, error => {
                console.error('Error loading problemas:', error);
                showToast('Error al cargar problemas: ' + error.message, 'error');
            });
    },

    renderCards() {
        const container = document.getElementById('problemas-timeline');
        if (!container) return;

        const canCreate = window.permissions?.canCreate;
        const canDelete = window.permissions?.canDelete;

        if (this.filteredRecords.length === 0) {
            container.innerHTML = `
                <div class="problemas-empty">
                    <div class="problemas-empty-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                    </div>
                    <h3>¡Todo en orden!</h3>
                    <p>No hay problemas registrados. Cuando ocurra alguna incidencia, regístrala aquí.</p>
                    ${canCreate ? '<button class="btn btn-primary btn-lg" style="margin-top: 1.5rem;" onclick="Problemas.showForm()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Registrar Primer Problema</button>' : ''}
                </div>
            `;
            return;
        }

        const cardsHtml = this.filteredRecords.map((record, index) => {
            const imgCount = record.imagenes && Array.isArray(record.imagenes) ? record.imagenes.length : 0;
            const hasImages = imgCount > 0;
            const observacion = record.observacion || '';
            const isLongText = observacion.length > 200;
            const shortText = isLongText ? observacion.substring(0, 200) + '...' : observacion;
            const fechaFactura = record.fecha ? formatDate(record.fecha, false) : '';
            const fechaReporte = record.createdAt ? formatDate(record.createdAt.toDate ? record.createdAt.toDate() : record.createdAt, true) : '';
            const timeAgo = record.createdAt ? this.getTimeAgo(record.createdAt.toDate ? record.createdAt.toDate() : record.createdAt) : '';

            const statusColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];
            const accentColor = statusColors[index % statusColors.length];

            return `
            <div class="prob-card" data-id="${record.id}" style="--accent: ${accentColor};">
                <div class="prob-card-accent-bar"></div>
                
                <div class="prob-card-top">
                    <div class="prob-card-doc-info">
                        <span class="prob-doc-badge">${sanitizeHTML(record.doc || 'DOC')}</span>
                        ${record.docNum ? `<span class="prob-doc-num">#${sanitizeHTML(record.docNum)}</span>` : ''}
                        <span class="prob-doc-date">📅 ${fechaFactura}</span>
                    </div>
                    <div class="prob-card-time">${timeAgo}</div>
                </div>

                <div class="prob-card-content">
                    <div class="prob-cliente-row">
                        <div class="prob-info-chip">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span>${sanitizeHTML(record.cliente || '—')}</span>
                        </div>
                        <div class="prob-monto-chip">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            <span>$${formatNumber(record.monto || 0, 2)}</span>
                        </div>
                    </div>

                    <div class="prob-observacion">
                        <div class="prob-obs-header">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            <span>Descripción del problema</span>
                        </div>
                        <p class="prob-obs-text" id="obs-${record.id}">${sanitizeHTML(shortText)}</p>
                        ${isLongText ? `<button class="prob-obs-toggle" onclick="Problemas.toggleObs('${record.id}', this)">Leer más</button>` : ''}
                    </div>

                    ${hasImages ? `
                    <div class="prob-images-strip">
                        <span class="prob-images-label">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            ${imgCount} imagen${imgCount > 1 ? 'es' : ''}
                        </span>
                        <div class="prob-images-mini">
                            ${record.imagenes.slice(0, 4).map((url, idx) => `
                                <div class="prob-img-mini" onclick="Problemas.viewImages('${record.id}', ${idx})">
                                    <img src="${url}" alt="Imagen" loading="lazy">
                                    ${idx === 3 && imgCount > 4 ? `<div class="prob-img-more">+${imgCount - 4}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                        <button class="prob-btn-images" onclick="Problemas.viewImages('${record.id}', 0)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            Ver galería
                        </button>
                    </div>
                    ` : ''}
                </div>

                <div class="prob-card-bottom">
                    <div class="prob-reporter">
                        <div class="prob-avatar">${(record.createdByName || 'U').charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="prob-reporter-name">${sanitizeHTML(record.createdByName || 'Usuario')}</div>
                            <div class="prob-reporter-date">${fechaReporte}</div>
                        </div>
                    </div>
                    <div class="prob-actions">
                        <button class="prob-btn prob-btn-edit ${!canCreate ? 'btn-disabled' : ''}" data-id="${record.id}" ${!canCreate ? 'disabled' : ''} title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar
                        </button>
                        <button class="prob-btn prob-btn-delete ${!canDelete ? 'btn-disabled' : ''}" data-id="${record.id}" ${!canDelete ? 'disabled' : ''} title="Eliminar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        // Timeline connector
        container.innerHTML = `<div class="prob-timeline-line"></div>${cardsHtml}`;

        // Event delegation
        container.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.prob-btn-edit');
            if (editBtn && !editBtn.disabled) {
                const id = editBtn.getAttribute('data-id');
                if (id) this.showEditForm(id);
                return;
            }

            const deleteBtn = e.target.closest('.prob-btn-delete');
            if (deleteBtn && !deleteBtn.disabled) {
                const id = deleteBtn.getAttribute('data-id');
                if (id) this.deleteProblema(id);
                return;
            }
        });
    },

    renderMobileCards() {
        const container = document.getElementById('mprob-list');
        if (!container) return;
        const canDelete = window.permissions?.canDelete;

        if (this.filteredRecords.length === 0) {
            container.innerHTML = '<div class="m-empty"><div class="m-empty-icon">✅</div><div class="m-empty-title">Todo en orden</div><div class="m-empty-text">No hay problemas registrados.</div></div>';
            return;
        }

        container.innerHTML = this.filteredRecords.map(function(record) {
            var observacion = record.observacion || '';
            var imgCount = record.imagenes && Array.isArray(record.imagenes) ? record.imagenes.length : 0;
            var fechaFactura = record.fecha ? formatDateShort(record.fecha) : '';
            return '<div class="m-data-card" style="border-left:3px solid #ef4444;">' +
                '<div class="m-card-header"><span class="m-card-title">' + sanitizeHTML(record.cliente || '—') + '</span>' +
                '<span class="m-card-badge danger">$' + formatNumber(record.monto || 0, 0) + '</span></div>' +
                '<div class="m-card-rows">' +
                '<div class="m-card-row"><span class="m-card-label">Doc</span><span class="m-card-value">' + (record.doc || '') + (record.docNum ? ' #' + record.docNum : '') + '</span></div>' +
                '<div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">' + fechaFactura + '</span></div>' +
                '</div>' +
                (observacion ? '<div style="font-size:0.8rem;color:#555;margin-bottom:8px;padding:8px 10px;background:#fef2f2;border-radius:10px;">' + sanitizeHTML(observacion.length > 120 ? observacion.substring(0, 120) + '...' : observacion) + '</div>' : '') +
                (imgCount > 0 ? '<div style="display:flex;gap:6px;margin-bottom:8px;overflow-x:auto;">' + record.imagenes.slice(0, 3).map(function(url) {
                    return '<div style="width:60px;height:60px;border-radius:10px;overflow:hidden;flex-shrink:0;"><img src="' + url + '" style="width:100%;height:100%;object-fit:cover;" loading="lazy"></div>';
                }).join('') + (imgCount > 3 ? '<div style="width:60px;height:60px;border-radius:10px;background:#f2f2f7;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#8e8e93;flex-shrink:0;">+' + (imgCount - 3) + '</div>' : '') + '</div>' : '') +
                (canDelete ? '<div class="m-card-actions" onclick="event.stopPropagation()">' +
                    '<button class="m-card-action delete" onclick="Problemas.deleteProblema(\'' + record.id + '\')" title="Eliminar">🗑️</button>' +
                '</div>' : '') +
            '</div>';
        }, this).join('');
    },

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Ahora mismo';
        if (minutes < 60) return `Hace ${minutes} min`;
        if (hours < 24) return `Hace ${hours}h`;
        if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;
        return formatDate(date, false);
    },

    toggleObs(id, btn) {
        const textEl = document.getElementById(`obs-${id}`);
        if (btn.textContent.includes('Leer más')) {
            const fullObservacion = this.records.find(r => r.id === id)?.observacion || '';
            textEl.textContent = fullObservacion;
            btn.textContent = 'Leer menos';
        } else {
            const shortObservacion = (this.records.find(r => r.id === id)?.observacion || '').substring(0, 200) + '...';
            textEl.textContent = shortObservacion;
            btn.textContent = 'Leer más';
        }
    },

    async showForm(existingRecord = null) {
        this.editingId = existingRecord ? existingRecord.id : null;
        this.selectedImages = [];
        this.existingImages = existingRecord && existingRecord.imagenes ? [...existingRecord.imagenes] : [];
        this.selectedFactura = null;

        if (!existingRecord) await this.loadInterlogicRecords();

        const isEdit = !!existingRecord;
        const facturaInfo = isEdit ? {
            fecha: existingRecord.fecha ? formatDate(existingRecord.fecha, false) : '',
            doc: existingRecord.doc || '',
            docNum: existingRecord.docNum || '',
            cliente: existingRecord.cliente || '',
            monto: existingRecord.monto || 0
        } : null;

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'problema-modal';
        modal.innerHTML = `
            <div class="premium-modal">
                <div class="premium-modal-header">
                    <div class="premium-modal-title">
                        <div class="premium-modal-icon">${isEdit ? '✏️' : '🚨'}</div>
                        <div>
                            <h2>${isEdit ? 'Editar Problema' : 'Nuevo Problema'}</h2>
                            <p>${isEdit ? 'Modifica los detalles del problema' : 'Registra una incidencia con una factura'}</p>
                        </div>
                    </div>
                    <button class="premium-close" onclick="Problemas.hideForm()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div class="premium-modal-body">
                    ${!isEdit ? `
                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-step">1</span>
                            <h3>Buscar Factura</h3>
                        </div>
                        <div class="search-container">
                            <div class="search-box" style="position: relative;">
                                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="problema-factura-search" class="search-input" placeholder="Escribe número, cliente, monto o fecha..." autocomplete="off">
                            </div>
                            <div id="problema-factura-dropdown" class="premium-dropdown" style="display: none;"></div>
                            <p class="search-hint">💡 Busca entre las facturas recientes de Control Interlogic</p>
                        </div>
                    </div>
                    ` : ''}

                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-step">${isEdit ? '' : '2'}</span>
                            <h3>${isEdit ? 'Datos de la Factura' : 'Datos de la Factura Seleccionada'}</h3>
                        </div>
                        <div class="factura-preview ${facturaInfo ? 'factura-filled' : ''}">
                            <div class="factura-preview-grid">
                                <div class="factura-field">
                                    <span class="factura-field-label">Documento</span>
                                    <span class="factura-field-value" id="problema-doc-display">${facturaInfo ? `${facturaInfo.doc}${facturaInfo.docNum ? ' #' + facturaInfo.docNum : ''}` : '—'}</span>
                                </div>
                                <div class="factura-field">
                                    <span class="factura-field-label">Fecha</span>
                                    <span class="factura-field-value" id="problema-fecha-display">${facturaInfo ? facturaInfo.fecha : '—'}</span>
                                </div>
                                <div class="factura-field">
                                    <span class="factura-field-label">Cliente</span>
                                    <span class="factura-field-value" id="problema-cliente-display">${facturaInfo ? facturaInfo.cliente : '—'}</span>
                                </div>
                                <div class="factura-field">
                                    <span class="factura-field-label">Monto</span>
                                    <span class="factura-field-value factura-monto" id="problema-monto-display">${facturaInfo ? '$' + formatNumber(facturaInfo.monto, 2) : '—'}</span>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="problema-fecha" value="${facturaInfo ? facturaInfo.fecha : ''}">
                        <input type="hidden" id="problema-doc" value="${facturaInfo ? facturaInfo.doc : ''}">
                        <input type="hidden" id="problema-cliente" value="${facturaInfo ? facturaInfo.cliente : ''}">
                        <input type="hidden" id="problema-monto" value="${facturaInfo ? facturaInfo.monto : ''}">
                    </div>

                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-step">${isEdit ? '' : '3'}</span>
                            <h3>Descripción del Problema <span class="required">*</span></h3>
                        </div>
                        <textarea id="problema-observacion" class="premium-textarea" rows="5" placeholder="Describe detalladamente qué ocurrió con esta factura, qué problema se presentó, cómo se resolvió...">${existingRecord && existingRecord.observacion ? sanitizeHTML(existingRecord.observacion) : ''}</textarea>
                    </div>

                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-step">${isEdit ? '' : '4'}</span>
                            <h3>Imágenes de Soporte</h3>
                            <span class="image-counter" id="image-counter">${this.existingImages.length + this.selectedImages.length}/3</span>
                        </div>
                        
                        <div class="upload-zone" id="problema-upload-area">
                            <input type="file" id="problema-images" accept="image/*" multiple style="display: none;">
                            <div class="upload-zone-content">
                                <div class="upload-zone-icon">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                </div>
                                <p class="upload-zone-title">Arrastra imágenes aquí</p>
                                <p class="upload-zone-subtitle">o <span class="upload-zone-link">haz clic para seleccionar</span></p>
                                <p class="upload-zone-hint">Máx. 3 imágenes • JPG/PNG • 5MB cada una</p>
                            </div>
                        </div>

                        <div id="problema-image-previews" class="image-previews"></div>
                    </div>
                </div>

                <div class="premium-modal-footer">
                    <button type="button" class="btn btn-ghost" id="btn-cancel-problema">Cancelar</button>
                    <button type="button" class="btn btn-gradient" id="btn-save-problema">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        ${isEdit ? 'Guardar Cambios' : 'Guardar Problema'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        this.renderImagePreviews();

        if (!isEdit) {
            const searchInput = document.getElementById('problema-factura-search');
            const dropdown = document.getElementById('problema-factura-dropdown');

            searchInput.addEventListener('input', (e) => this.filterDropdown(e.target.value));
            searchInput.addEventListener('focus', () => {
                if (this.interlogicRecords.length > 0) this.filterDropdown(searchInput.value);
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#problema-factura-search') && !e.target.closest('#problema-factura-dropdown')) {
                    dropdown.style.display = 'none';
                }
            });
        }

        const uploadArea = document.getElementById('problema-upload-area');
        const fileInput = document.getElementById('problema-images');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) this.handleImageSelection(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', (e) => this.handleImageSelection(e.target.files));

        document.getElementById('btn-cancel-problema').addEventListener('click', () => this.hideForm());
        document.getElementById('btn-save-problema').addEventListener('click', () => this.saveProblema());
        modal.addEventListener('click', (e) => { if (e.target === modal) this.hideForm(); });
    },

    showEditForm(id) {
        const record = this.records.find(r => r.id === id);
        if (!record) { showToast('Problema no encontrado', 'error'); return; }
        this.showForm(record);
    },

    hideForm() {
        const modal = document.getElementById('problema-modal');
        if (modal) modal.remove();
        this.selectedFactura = null;
        this.editingId = null;
        this.selectedImages = [];
        this.existingImages = [];
    },

    async loadInterlogicRecords() {
        try {
            const db = firebase.firestore();
            let snapshot = await db.collection('interlogic')
                .orderBy('createdAt', 'desc')
                .limit(500)
                .get();
            this.interlogicRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (this.interlogicRecords.length === 0) showToast('No se encontraron facturas recientes.', 'warning');
        } catch (error) {
            console.error('Error loading interlogic records:', error);
            showToast('Error al cargar facturas.', 'error');
        }
    },

    filterDropdown(query) {
        const dropdown = document.getElementById('problema-factura-dropdown');
        const q = query.toLowerCase().trim();

        let filtered = this.interlogicRecords;
        if (q) {
            filtered = this.interlogicRecords.filter(r => {
                const docStr = String(r.doc || '').toLowerCase();
                const docNumStr = String(r.docNum || '').toLowerCase();
                const clienteStr = String(r.cliente || '').toLowerCase();
                const fechaStr = r.fecha ? formatDate(r.fecha, false).toLowerCase() : '';
                const montoStr = String(r.venta || '').toLowerCase();
                return docStr.includes(q) || docNumStr.includes(q) || clienteStr.includes(q) || fechaStr.includes(q) || montoStr.includes(q);
            });
        }

        filtered = filtered.slice(0, 50);

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="8" x2="14" y2="14"/><line x1="14" y1="8" x2="8" y2="14"/></svg><p>No se encontraron facturas</p></div>';
        } else {
            dropdown.innerHTML = filtered.map(r => {
                const fecha = r.fecha ? formatDate(r.fecha, false) : '';
                const doc = sanitizeHTML(r.doc || '');
                const docNum = r.docNum ? '#' + sanitizeHTML(r.docNum) : '';
                const cliente = sanitizeHTML(r.cliente || '');
                const monto = formatNumber(r.venta || 0, 2);
                return `
                    <div class="dropdown-item" onclick="Problemas.selectFactura('${r.id}')">
                        <div class="dropdown-item-left">
                            <div class="dropdown-item-doc">${doc} <span class="dropdown-item-num">${docNum}</span></div>
                            <div class="dropdown-item-cliente">${cliente}</div>
                        </div>
                        <div class="dropdown-item-right">
                            <div class="dropdown-item-monto">$${monto}</div>
                            <div class="dropdown-item-fecha">📅 ${fecha}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        dropdown.style.display = 'block';
    },

    selectFactura(id) {
        const record = this.interlogicRecords.find(r => r.id === id);
        if (!record) return;

        this.selectedFactura = record;

        const searchInput = document.getElementById('problema-factura-search');
        const dropdown = document.getElementById('problema-factura-dropdown');

        searchInput.value = `${record.doc || ''}${record.docNum ? ' #' + record.docNum : ''} — ${record.cliente || ''}`;
        dropdown.style.display = 'none';

        const docDisplay = document.getElementById('problema-doc-display');
        const fechaDisplay = document.getElementById('problema-fecha-display');
        const clienteDisplay = document.getElementById('problema-cliente-display');
        const montoDisplay = document.getElementById('problema-monto-display');

        if (docDisplay) docDisplay.textContent = `${record.doc || ''}${record.docNum ? ' #' + record.docNum : ''}`;
        if (fechaDisplay) fechaDisplay.textContent = record.fecha ? formatDate(record.fecha, false) : '—';
        if (clienteDisplay) clienteDisplay.textContent = record.cliente || '—';
        if (montoDisplay) montoDisplay.textContent = `$${formatNumber(record.venta || 0, 2)}`;

        document.getElementById('problema-fecha').value = record.fecha ? (record.fecha.toDate ? record.fecha.toDate().toISOString().split('T')[0] : record.fecha) : '';
        document.getElementById('problema-doc').value = record.doc || '';
        document.getElementById('problema-cliente').value = record.cliente || '';
        document.getElementById('problema-monto').value = record.venta || 0;

        const facturaCard = document.querySelector('.factura-preview');
        if (facturaCard) {
            facturaCard.classList.add('factura-filled');
            facturaCard.classList.add('factura-animate');
            setTimeout(() => facturaCard.classList.remove('factura-animate'), 600);
        }
    },

    handleImageSelection(files) {
        const totalCount = this.existingImages.length + this.selectedImages.length;
        const remainingSlots = 3 - totalCount;
        if (remainingSlots <= 0) { showToast('Máximo 3 imágenes permitidas.', 'warning'); return; }

        const newFiles = Array.from(files).slice(0, remainingSlots);
        const oversized = newFiles.filter(f => f.size > 5 * 1024 * 1024);
        if (oversized.length > 0) showToast('Algunas imágenes superan 5MB.', 'warning');

        this.selectedImages.push(...newFiles.filter(f => f.size <= 5 * 1024 * 1024));
        this.renderImagePreviews();
    },

    renderImagePreviews() {
        const container = document.getElementById('problema-image-previews');
        const counter = document.getElementById('image-counter');
        if (!container) return;

        const total = this.existingImages.length + this.selectedImages.length;
        if (counter) counter.textContent = `${total}/3`;

        let html = '';
        this.existingImages.forEach((url, idx) => {
            html += `<div class="preview-card"><img src="${url}" alt="Imagen"><button type="button" class="preview-remove" onclick="Problemas.removeExistingImage(${idx})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
        });
        this.selectedImages.forEach((file, idx) => {
            const objectUrl = URL.createObjectURL(file);
            html += `<div class="preview-card preview-new"><img src="${objectUrl}" alt="Nueva"><button type="button" class="preview-remove" onclick="Problemas.removeSelectedImage(${idx})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><span class="preview-badge">NUEVA</span></div>`;
        });

        container.innerHTML = html;
    },

    removeExistingImage(index) { this.existingImages.splice(index, 1); this.renderImagePreviews(); },
    removeSelectedImage(index) { this.selectedImages.splice(index, 1); this.renderImagePreviews(); },

    async saveProblema() {
        const observacion = document.getElementById('problema-observacion').value.trim();
        if (!observacion) { showToast('La observación es obligatoria', 'error'); return; }
        if (!this.editingId && !this.selectedFactura) { showToast('Selecciona una factura primero', 'error'); return; }

        const saveBtn = document.getElementById('btn-save-problema');
        setButtonLoading(saveBtn, true);

        try {
            const db = firebase.firestore();
            let problemaId = this.editingId;

            if (this.editingId) {
                await db.collection('problemas').doc(problemaId).update({
                    observacion, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                const record = this.selectedFactura;
                const fechaStr = record.fecha ? (record.fecha.toDate ? record.fecha.toDate().toISOString().split('T')[0] : record.fecha) : '';
                const newDoc = await db.collection('problemas').add({
                    interlogicId: record.id, fecha: fechaStr, doc: record.doc || '',
                    docNum: record.docNum || '', cliente: record.cliente || '',
                    monto: Number(record.venta || 0), observacion, imagenes: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdBy: firebase.auth().currentUser?.uid || '',
                    createdByName: window.currentUserData?.displayName || 'Usuario'
                });
                problemaId = newDoc.id;
            }

            if (this.selectedImages.length > 0) {
                const uploadedUrls = await this.uploadImages(problemaId, this.selectedImages);
                await db.collection('problemas').doc(problemaId).update({ imagenes: [...this.existingImages, ...uploadedUrls] });
            } else if (this.editingId) {
                await db.collection('problemas').doc(problemaId).update({ imagenes: this.existingImages });
            }

            showToast(this.editingId ? 'Problema actualizado' : 'Problema registrado', 'success');
            this.hideForm();
        } catch (error) {
            console.error('Error saving:', error);
            showToast('Error al guardar: ' + error.message, 'error');
        } finally {
            setButtonLoading(saveBtn, false);
        }
    },

    async uploadImages(problemaId, files) {
        const urls = [];
        const storage = firebase.storage();
        for (const file of files) {
            const ext = file.name.split('.').pop();
            const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
            const ref = storage.ref(`problemas/${problemaId}/${filename}`);
            await ref.put(file);
            urls.push(await ref.getDownloadURL());
        }
        return urls;
    },

    viewImages(id, startIndex = 0) {
        const record = this.records.find(r => r.id === id);
        if (!record || !record.imagenes || record.imagenes.length === 0) return;

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'lightbox-modal';
        
        let currentIndex = startIndex;
        
        const renderSlide = (index) => {
            const url = record.imagenes[index];
            return `
                <div class="lightbox-slide">
                    <img src="${url}" alt="Imagen ${index + 1}">
                </div>
            `;
        };

        modal.innerHTML = `
            <div class="lightbox-container">
                <div class="lightbox-header">
                    <div>
                        <h3>📷 ${sanitizeHTML(record.doc || '')}</h3>
                        <p>${sanitizeHTML(record.cliente || '')} — ${record.imagenes.length} imagen${record.imagenes.length > 1 ? 'es' : ''}</p>
                    </div>
                    <button class="lightbox-close" onclick="document.getElementById('lightbox-modal').remove()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                
                <div class="lightbox-main">
                    ${record.imagenes.length > 1 ? `<button class="lightbox-nav lightbox-prev" onclick="Problemas.lightboxNav(-1)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>` : ''}
                    <div class="lightbox-slide-area" id="lightbox-slide-area">
                        ${renderSlide(currentIndex)}
                    </div>
                    ${record.imagenes.length > 1 ? `<button class="lightbox-nav lightbox-next" onclick="Problemas.lightboxNav(1)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>` : ''}
                </div>

                ${record.imagenes.length > 1 ? `
                <div class="lightbox-counter" id="lightbox-counter">${currentIndex + 1} / ${record.imagenes.length}</div>
                <div class="lightbox-thumbs">
                    ${record.imagenes.map((url, idx) => `
                        <div class="lightbox-thumb ${idx === currentIndex ? 'active' : ''}" onclick="Problemas.lightboxGoTo(${idx})">
                            <img src="${url}" alt="Thumb ${idx + 1}">
                        </div>
                    `).join('')}
                </div>
                ` : `
                <div class="lightbox-single-actions">
                    <a href="${record.imagenes[0]}" target="_blank" class="btn btn-gradient btn-sm">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        Abrir en tamaño completo
                    </a>
                </div>
                `}
            </div>
        `;
        document.body.appendChild(modal);

        // Store for navigation
        this._lightboxRecord = record;
        this._lightboxIndex = currentIndex;

        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    lightboxNav(direction) {
        const record = this._lightboxRecord;
        if (!record) return;
        
        this._lightboxIndex = (this._lightboxIndex + direction + record.imagenes.length) % record.imagenes.length;
        this._updateLightbox();
    },

    lightboxGoTo(index) {
        this._lightboxIndex = index;
        this._updateLightbox();
    },

    _updateLightbox() {
        const record = this._lightboxRecord;
        if (!record) return;
        
        const slideArea = document.getElementById('lightbox-slide-area');
        const counter = document.getElementById('lightbox-counter');
        const thumbs = document.querySelectorAll('.lightbox-thumb');
        
        if (slideArea) {
            slideArea.innerHTML = `<div class="lightbox-slide"><img src="${record.imagenes[this._lightboxIndex]}" alt="Imagen"></div>`;
        }
        if (counter) counter.textContent = `${this._lightboxIndex + 1} / ${record.imagenes.length}`;
        thumbs.forEach((thumb, idx) => {
            thumb.classList.toggle('active', idx === this._lightboxIndex);
        });
    },

    async deleteProblema(id) {
        if (!confirm('¿Eliminar este problema permanentemente?\nSe borrarán también las imágenes asociadas.')) return;

        try {
            const record = this.records.find(r => r.id === id);
            if (record && record.imagenes && record.imagenes.length > 0) {
                const storage = firebase.storage();
                for (const url of record.imagenes) {
                    try { await storage.refFromURL(url).delete(); } catch (e) { /* ignore */ }
                }
            }
            await firebase.firestore().collection('problemas').doc(id).delete();
            showToast('Problema eliminado', 'success');
        } catch (error) {
            console.error('Error deleting:', error);
            showToast('Error al eliminar', 'error');
        }
    }
};

window.Problemas = Problemas;
