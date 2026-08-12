// ===================================
// Interlogic - CRUD Module (Create, Read, Update, Delete)
// ===================================

// Tope máximo de documentos descargados por consulta.
// Reduce costo (cada doc = 1 lectura Firestore), red y render.
const MAX_RECORDS = 2000;

const InterlogicCRUD = {
    async loadRecords(useDateRange = false) {
        if (this._loadingRecords) return;
        this._loadingRecords = true;
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        const db = firebase.firestore();
        let query;

        if (useDateRange) {
            const startDate = this.filters.startDate || getLocalDateString();
            let endDate = this.filters.endDate || getLocalDateString();
            const sParts = startDate.split('-').map(Number);
            const eParts = endDate.split('-').map(Number);
            const startTs = firebase.firestore.Timestamp.fromDate(new Date(sParts[0], sParts[1]-1, sParts[2], 0, 0, 0));
            const endTs = firebase.firestore.Timestamp.fromDate(new Date(eParts[0], eParts[1]-1, eParts[2], 23, 59, 59));

            query = db.collection('interlogic')
                .where('fecha', '>=', startTs)
                .where('fecha', '<=', endTs)
                .orderBy('fecha', 'desc')
                .limit(MAX_RECORDS);
        } else {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            ninetyDaysAgo.setHours(0, 0, 0, 0);
            const startTs = firebase.firestore.Timestamp.fromDate(ninetyDaysAgo);

            query = db.collection('interlogic')
                .where('createdAt', '>=', startTs)
                .orderBy('createdAt', 'desc')
                .limit(MAX_RECORDS);
        }

        try {
            this.unsubscribe = query.onSnapshot(snapshot => {
                this.records = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this._truncated = snapshot.size >= MAX_RECORDS;
                this._fullMode = false;

                this.applyFilters();

                if (this.loading) {
                    this.loading = false;
                }
            }, error => {
                console.error('Error in real-time listener:', error);
                showToast('Error en sincronización: ' + error.message, 'error');
            });
        } catch (e) {
            console.error('Error setting up listener:', e);
            showToast('Error al cargar datos. Verifica el índice de Firestore.', 'error');
            this._loadingRecords = false;
        }
        this._loadingRecords = false;
    },

    async loadFullRange() {
        if (this._loadingRecords) return;
        this._loadingRecords = true;

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        const startDate = this.filters.startDate || getLocalDateString();
        let endDate = this.filters.endDate || getLocalDateString();
        const sParts = startDate.split('-').map(Number);
        const eParts = endDate.split('-').map(Number);
        const startTs = firebase.firestore.Timestamp.fromDate(new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0));
        const endTs = firebase.firestore.Timestamp.fromDate(new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59));

        const db = firebase.firestore();
        const baseQuery = db.collection('interlogic')
            .where('fecha', '>=', startTs)
            .where('fecha', '<=', endTs)
            .orderBy('fecha', 'desc');

        showFullLoadOverlay(true, 'Descargando registros del rango…');

        try {
            const all = await fetchAllChunked(baseQuery, {
                chunkSize: 2000,
                onProgress: (total, maybeMore) => {
                    showFullLoadOverlay(true, `Descargados ${total.toLocaleString()} registros…`);
                }
            });

            this.records = all;
            this._truncated = false;
            this._fullMode = true;

            if (this.loading) this.loading = false;
            this.applyFilters();
            showToast('✓ Rango completo cargado (' + all.length.toLocaleString() + ' registros). Modo tiempo real desactivado.', 'success');
        } catch (err) {
            console.error('Error en loadFullRange:', err);
            showToast('Error al cargar el rango completo: ' + err.message, 'error');
        } finally {
            showFullLoadOverlay(false);
            this._loadingRecords = false;
        }
    },

    async reloadListener(useDateRange = false) {
        this._loadingRecords = false;
        this._fullMode = false;
        await this.loadRecords(useDateRange);
    },

    showForm(recordId = null, sourceRecord = null) {
        if (recordId && !window.permissions?.canEdit) {
            showToast('No tienes permisos para editar registros', 'error');
            return;
        }
        if (!recordId && !window.permissions?.canCreate) {
            showToast('No tienes permisos para crear registros', 'error');
            return;
        }

        const record = recordId ? this.records.find(r => r.id === recordId) : null;
        const prefill = sourceRecord || ((!recordId && !sourceRecord) ? (() => {
            try { return JSON.parse(localStorage.getItem('il_last_values') || '{}'); } catch (e) { return {}; }
        })() : null);

        let dateValue = '';
        if (record && record.fecha) {
            const date = record.fecha.toDate ? record.fecha.toDate() : new Date(record.fecha);
            dateValue = formatDateForInput(date);
        } else if (sourceRecord && sourceRecord.fecha) {
            const date = sourceRecord.fecha.toDate ? sourceRecord.fecha.toDate() : new Date(sourceRecord.fecha);
            dateValue = formatDateForInput(date);
        } else if (!recordId) {
            dateValue = formatDateForInput(new Date());
        }

        const val = (field) => {
            if (record) return record[field] || '';
            if (sourceRecord) return sourceRecord[field] || '';
            if (prefill && prefill[field]) return prefill[field];
            return '';
        };

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="premium-modal" style="max-width: 680px;">
                <div class="premium-modal-header">
                    <div class="premium-modal-title">
                        <div class="premium-modal-icon">${record ? '✏️' : (sourceRecord ? '📋' : '➕')}</div>
                        <div>
                            <h2>${record ? 'Editar Registro' : (sourceRecord ? 'Duplicar Registro' : 'Nuevo Registro')}</h2>
                            <p>${record ? 'Modifica los datos de este envío' : (sourceRecord ? 'Crea una copia de un registro existente' : 'Completa los datos del nuevo envío')}</p>
                        </div>
                    </div>
                    <button class="premium-close" onclick="this.closest('.modal-backdrop').remove()" type="button">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div class="premium-modal-body">
                    <form id="interlogic-form">
                        <div class="form-section">
                            <div class="form-section-header">
                                <span class="form-step">1</span>
                                <h3>Información del Documento</h3>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label>Guía</label>
                                    <input type="number" id="il-guia" value="${sourceRecord ? '' : (record ? sanitizeHTML(record.guia || '') : '')}">
                                </div>
                                <div class="form-group">
                                    <label>Empresa</label>
                                    <select id="il-empresa">
                                        <option value="" ${!val('empresa') ? 'selected' : ''}>Seleccionar...</option>
                                        <option value="DALSE" ${val('empresa') === 'DALSE' ? 'selected' : ''}>DALSE</option>
                                        <option value="INCEDE" ${val('empresa') === 'INCEDE' ? 'selected' : ''}>INCEDE</option>
                                    </select>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
                                <div class="form-group">
                                    <label>Fecha</label>
                                    <input type="date" id="il-fecha" value="${dateValue}">
                                </div>
                                <div class="form-group">
                                    <label>Documento</label>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <select id="il-doc" style="flex: 1;">
                                            <option value="" ${!val('doc') ? 'selected' : ''}>Tipo...</option>
                                            <option value="CCF" ${val('doc') === 'CCF' ? 'selected' : ''}>CCF</option>
                                            <option value="FT" ${val('doc') === 'FT' ? 'selected' : ''}>FT</option>
                                            <option value="NC" ${val('doc') === 'NC' ? 'selected' : ''}>NC</option>
                                        </select>
                                        <input type="text" id="il-docNum" placeholder="#" value="${sourceRecord ? '' : (record ? sanitizeHTML(record.docNum || '') : '')}" style="flex: 1;">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="form-section">
                            <div class="form-section-header">
                                <span class="form-step">2</span>
                                <h3>Información del Cliente</h3>
                            </div>
                            <div class="form-group" style="position: relative;">
                                <label>Cliente</label>
                                <input type="text" id="il-cliente" autocomplete="off" value="${sourceRecord ? sanitizeHTML(sourceRecord.cliente || '').replace(/"/g, '&quot;') : (record ? sanitizeHTML(record.cliente || '').replace(/"/g, '&quot;') : '')}">
                                <div id="il-cliente-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--gray-300); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 1300; max-height: 200px; overflow-y: auto;"></div>
                            </div>
                            <div id="il-cliente-observacion" class="cliente-observacion" style="display: none; margin-top: 0.5rem; padding: 0.6rem 0.75rem; background: #fef2f2; border: 1px solid #fca5a5; border-radius: var(--radius-md); color: #dc2626; font-size: 0.85rem; font-weight: 600; line-height: 1.4;"></div>
                            <div class="form-group" style="margin-top: 0.75rem;">
                                <label>Dirección</label>
                                <input type="text" id="il-direccion" placeholder="Dirección del cliente" value="${sanitizeHTML(val('direccion')).replace(/"/g, '&quot;')}">
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
                                <div class="form-group">
                                    <label>Teléfono (WhatsApp)</label>
                                    <input type="text" id="il-telefono" placeholder="Ej: 50370000000" value="${sourceRecord ? sanitizeHTML(sourceRecord.telefono || '').replace(/"/g, '&quot;') : (record ? sanitizeHTML(record.telefono || '').replace(/"/g, '&quot;') : '')}">
                                </div>
                                <div class="form-group">
                                    <label>Departamento</label>
                                    <input type="text" id="il-departamento" value="${sanitizeHTML(val('departamento')).replace(/"/g, '&quot;')}">
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
                                <div class="form-group">
                                    <label>Municipio</label>
                                    <input type="text" id="il-municipio" value="${sanitizeHTML(val('municipio')).replace(/"/g, '&quot;')}">
                                </div>
                                <div></div>
                            </div>
                        </div>

                        <div class="form-section">
                            <div class="form-section-header">
                                <span class="form-step">3</span>
                                <h3>Detalles de Venta</h3>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label>Vendedor</label>
                                    <input type="text" id="il-vendedor" value="${sanitizeHTML(val('vendedor')).replace(/"/g, '&quot;')}">
                                </div>
                                <div class="form-group">
                                    <label for="il-venta">Venta ($)</label>
                                    <input type="number" id="il-venta" step="0.01" value="${sourceRecord ? (sourceRecord.venta || '') : (record ? record.venta : '')}">
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
                                <div class="form-group">
                                    <label>Bultos</label>
                                    <input type="number" id="il-bultos" value="${sourceRecord ? (sourceRecord.bultos || '') : (record ? record.bultos : '')}">
                                </div>
                                <div class="form-group">
                                    <label>Condición Pago</label>
                                    <select id="il-condicionPago">
                                        <option value="" ${!val('condicionPago') ? 'selected' : ''}>Seleccionar...</option>
                                        <option value="Contado" ${val('condicionPago') === 'Contado' ? 'selected' : ''}>Contado</option>
                                        <option value="Crédito" ${val('condicionPago') === 'Crédito' ? 'selected' : ''}>Crédito</option>
                                    </select>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
                                <div class="form-group">
                                    <label>Entrega</label>
                                    <select id="il-entrega">
                                        <option value="" ${!val('entrega') ? 'selected' : ''}>Seleccionar...</option>
                                        <option value="DALSE" ${val('entrega') === 'DALSE' ? 'selected' : ''}>DALSE</option>
                                        <option value="INTERLOGISTIC" ${val('entrega') === 'INTERLOGISTIC' ? 'selected' : ''}>INTERLOGISTIC</option>
                                        <option value="XPRESS" ${val('entrega') === 'XPRESS' ? 'selected' : ''}>XPRESS</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Cobra</label>
                                    <select id="il-cobra">
                                        <option value="" ${!val('cobra') ? 'selected' : ''}>Seleccionar...</option>
                                        <option value="DALSE" ${val('cobra') === 'DALSE' ? 'selected' : ''}>DALSE</option>
                                        <option value="INTERLOGISTIC" ${val('cobra') === 'INTERLOGISTIC' ? 'selected' : ''}>INTERLOGISTIC</option>
                                        <option value="XPRESS" ${val('cobra') === 'XPRESS' ? 'selected' : ''}>XPRESS</option>
                                    </select>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
                                <div class="form-group">
                                    <label>Encargado</label>
                                    <input type="text" id="il-encargado" list="encargados-list" value="${sanitizeHTML(val('encargado')).replace(/"/g, '&quot;')}">
                                    <datalist id="encargados-list">
                                        ${this.getDistinctValues('encargado').map(function(e) { return '<option value="' + sanitizeHTML(e) + '">'; }).join('')}
                                    </datalist>
                                </div>
                                <div class="form-group" id="il-cobrador-group">
                                    <label>Cajas</label>
                                    <input type="number" id="il-cobrador" value="${sourceRecord ? (sourceRecord.cobrador || '') : (record ? record.cobrador || '' : '')}">
                                </div>
                                <div class="form-group" id="il-plazo-group">
                                    <label>Plazo Pago (días)</label>
                                    <input type="number" id="il-plazo" value="30" min="1" max="365">
                                </div>
                            </div>
                        </div>

                        <div id="il-nc-fields" style="display: none; margin-top: 1rem; padding: 1rem; background: #fffbeb; border-radius: var(--radius-md); border: 1px solid #f59e0b;">
                            <div style="font-weight:700; font-size:0.85rem; margin-bottom:0.75rem; color:#92400e;">📋 Opciones de Nota de Crédito</div>
                            <div class="form-group">
                                <label>Afecta saldo de algún CCF/FT</label>
                                <select id="il-nc-afectaSaldo">
                                    <option value="no">No - NC general (no afecta ningún documento)</option>
                                    <option value="si">Sí - Descontar del saldo de un CCF/FT específico</option>
                                </select>
                            </div>
                            <div id="il-nc-ccf-group" style="display: none; margin-top: 0.75rem;">
                                <div class="form-group">
                                    <label>Seleccionar CCF/FT del cliente</label>
                                    <select id="il-nc-interlogicId" style="width: 100%;">
                                        <option value="">-- Seleccionar CCF/FT --</option>
                                    </select>
                                    <div id="il-nc-ccf-info" style="display:none; margin-top:0.5rem; padding:0.5rem; background:white; border-radius:var(--radius-sm); font-size:0.8rem; border:1px solid var(--gray-200);"></div>
                                </div>
                            </div>
                        </div>

                        <div class="form-section" style="margin-bottom: 0;">
                            <div class="form-section-header">
                                <span class="form-step" style="background: linear-gradient(135deg, var(--gray-500), var(--gray-600));">📝</span>
                                <h3>Observaciones</h3>
                            </div>
                            <textarea id="il-observations" rows="3" placeholder="Notas u observaciones sobre este registro..." style="width: 100%; padding: 0.75rem 1rem; border: 2px solid var(--gray-200); border-radius: 16px; font-family: var(--font-family); font-size: 0.9rem; resize: vertical; line-height: 1.6; transition: border-color 0.25s, box-shadow 0.25s;">${sourceRecord ? sanitizeHTML(sourceRecord.observations || '') : (record ? sanitizeHTML(record.observations || '') : '')}</textarea>
                        </div>
                    </form>
                </div>

                <div class="premium-modal-footer">
                    ${!recordId ? '<button type="button" class="btn btn-secondary" id="btn-il-save-another">💾+ Guardar y Agregar Otro</button>' : ''}
                    <button type="submit" class="btn btn-primary" id="btn-il-save" form="interlogic-form">💾 Guardar Registro</button>
                    <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                </div>
            </div>
    `;

        document.body.appendChild(modal);

        var self = this;

        if (record && record.cliente) {
            var clientName = record.cliente.toLowerCase().trim();
            var matchedClient = (window.Clientes?.records || []).find(function(c) {
                return (c.nombre || '').toLowerCase().trim() === clientName;
            });
            var obsDiv = document.getElementById('il-cliente-observacion');
            if (obsDiv && matchedClient && matchedClient.observacionEntrega) {
                obsDiv.textContent = '📦 ' + matchedClient.observacionEntrega;
                obsDiv.style.display = 'block';
            }
        }

        var plazoGroup = document.getElementById('il-plazo-group');
        var plazoInput = document.getElementById('il-plazo');
        var condicionSelect = document.getElementById('il-condicionPago');
        var togglePlazo = function() {
            var isCredito = condicionSelect.value === 'Crédito';
            if (plazoGroup) plazoGroup.style.display = isCredito ? 'block' : 'none';
            if (plazoInput) plazoInput.disabled = !isCredito;
        };
        condicionSelect.addEventListener('change', togglePlazo);
        togglePlazo();

        var docSelect = document.getElementById('il-doc');
        var ncFields = document.getElementById('il-nc-fields');
        var ncAfectaSaldo = document.getElementById('il-nc-afectaSaldo');
        var ncCcfGroup = document.getElementById('il-nc-ccf-group');
        var ncInterlogicId = document.getElementById('il-nc-interlogicId');
        var ncCcfInfo = document.getElementById('il-nc-ccf-info');
        var ventaLabel = document.querySelector('label[for="il-venta"]') || document.getElementById('il-venta')?.closest('.form-group')?.querySelector('label');
        var bultosGroup = document.getElementById('il-bultos')?.closest('.form-group');
        var cobradorGroup = document.getElementById('il-cobrador-group');
        var plazoGroupEl = document.getElementById('il-plazo-group');

        var toggleNCFields = function() {
            var isNC = docSelect.value === 'NC';
            if (ncFields) ncFields.style.display = isNC ? 'block' : 'none';
            if (ventaLabel) ventaLabel.textContent = isNC ? 'Monto NC ($)' : 'Venta ($)';
            if (bultosGroup) bultosGroup.style.display = isNC ? 'none' : 'block';
            if (cobradorGroup) cobradorGroup.style.display = isNC ? 'none' : 'block';
            if (plazoGroupEl) plazoGroupEl.style.display = isNC ? 'none' : (condicionSelect.value === 'Crédito' ? 'block' : 'none');
        };
        docSelect.addEventListener('change', toggleNCFields);
        toggleNCFields();

        var toggleNCCcfGroup = function() {
            var afecta = ncAfectaSaldo.value === 'si';
            if (ncCcfGroup) ncCcfGroup.style.display = afecta ? 'block' : 'none';
            if (afecta) populateCCFList();
        };
        ncAfectaSaldo.addEventListener('change', toggleNCCcfGroup);

        var populateCCFList = function() {
            var clienteActual = document.getElementById('il-cliente').value.trim();
            ncInterlogicId.innerHTML = '<option value="">-- Seleccionar CCF/FT --</option>';

            if (!clienteActual) {
                ncInterlogicId.innerHTML = '<option value="">-- Primero ingresa el cliente arriba --</option>';
                return;
            }

            var clienteLower = clienteActual.toLowerCase();
            var ccfRecords = self.records.filter(function(r) {
                return (r.doc === 'CCF' || r.doc === 'FT') &&
                       (r.cliente || '').toLowerCase().includes(clienteLower);
            });

            if (ccfRecords.length === 0) {
                ncInterlogicId.innerHTML = '<option value="">-- No hay CCF/FT para este cliente --</option>';
                return;
            }

            ccfRecords.forEach(function(r) {
                var estado = r.estadoCobro === 'pagado' ? '✓ Pagado' : (r.estadoCobro === 'parcial' ? '⚠ Parcial' : '● Pendiente');
                var opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = (r.doc || '') + ' #' + (r.docNum || r.guia || '') + ' - ' + formatCurrency(r.venta || 0) + ' (' + estado + ')';
                ncInterlogicId.appendChild(opt);
            });
        };

        ncInterlogicId.addEventListener('change', function() {
            var selectedId = ncInterlogicId.value;
            if (selectedId && ncCcfInfo) {
                var record = self.records.find(function(r) { return r.id === selectedId; });
                if (record) {
                    var cobrado = Number(record.montoCobrado || (record.cobrado === true ? record.venta : 0));
                    var pendiente = Math.max(0, Number(record.venta || 0) - cobrado);
                    ncCcfInfo.style.display = 'block';
                    ncCcfInfo.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><strong>Venta:</strong> ' + formatCurrency(record.venta || 0) + '</div><div><strong>Cobrado:</strong> ' + formatCurrency(cobrado) + '</div><div><strong>Pendiente:</strong> ' + formatCurrency(pendiente) + '</div><div><strong>Estado:</strong> ' + (record.estadoCobro || 'pendiente') + '</div></div>';
                }
            } else if (ncCcfInfo) {
                ncCcfInfo.style.display = 'none';
            }
        });

        var clienteInputNc = document.getElementById('il-cliente');
        clienteInputNc.addEventListener('change', function() {
            if (docSelect.value === 'NC' && ncAfectaSaldo.value === 'si') {
                populateCCFList();
            }
        });

        const clienteInput = document.getElementById('il-cliente');
        const suggestionsBox = document.getElementById('il-cliente-suggestions');
        let debounceTimer = null;

        const selectSuggestionItem = (item) => {
            clienteInput.value = item.dataset.nombre;
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('il-direccion', item.dataset.direccion);
            setVal('il-telefono', item.dataset.telefono);
            setVal('il-departamento', item.dataset.departamento);
            setVal('il-municipio', item.dataset.municipio);
            setVal('il-vendedor', item.dataset.vendedor);

            const obsDiv = document.getElementById('il-cliente-observacion');
            const obs = (item.dataset.observacionEntrega || '').trim();
            if (obsDiv) {
                if (obs) {
                    obsDiv.textContent = '📦 ' + obs;
                    obsDiv.style.display = 'block';
                } else {
                    obsDiv.textContent = '';
                    obsDiv.style.display = 'none';
                }
            }

            suggestionsBox.style.display = 'none';
            suggestionsBox._highlightedIndex = -1;
        };

        const highlightSuggestion = (index) => {
            const items = suggestionsBox.querySelectorAll('[data-index]');
            items.forEach((el, i) => {
                if (i === index) {
                    el.style.background = 'var(--primary-200)';
                } else {
                    el.style.background = '';
                }
            });
        };

        const renderSuggestions = (matches) => {
            if (matches.length === 0) {
                suggestionsBox.style.display = 'none';
                return;
            }

            suggestionsBox.innerHTML = matches.map((c, i) => `
                <div style="padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--gray-100); font-size: 0.85rem; transition: background 0.15s;"
                     data-index="${i}"
                     data-nombre="${sanitizeHTML(c.nombre || '')}"
                     data-direccion="${sanitizeHTML(c.direccion || '')}"
                     data-telefono="${c.telefono || ''}"
                     data-departamento="${sanitizeHTML(c.departamento || c.zona || '')}"
                     data-municipio="${sanitizeHTML(c.municipio || '')}"
                     data-vendedor="${sanitizeHTML(c.vendedor || '')}"
                     data-empresa="${c.empresa || ''}"
                     data-condicionpago="${c.condicionPago || ''}"
                     data-observacion-entrega="${sanitizeHTML(c.observacionEntrega || '')}">
                    <strong>${sanitizeHTML(c.nombre || '')}</strong>
                    ${c.direccion ? `<br><span style="color: var(--text-secondary); font-size: 0.8rem;">📍 ${sanitizeHTML(c.direccion)}</span>` : ''}
                    ${c.telefono ? `<span style="color: var(--text-secondary); font-size: 0.8rem;"> | 📱 ${c.telefono}</span>` : ''}
                    ${c.observacionEntrega ? `<br><span style="color: #dc2626; font-size: 0.78rem; font-weight: 600;">📦 ${sanitizeHTML(c.observacionEntrega)}</span>` : ''}
                </div>
            `).join('');

            suggestionsBox._highlightedIndex = -1;
            suggestionsBox.style.display = 'block';

            suggestionsBox.querySelectorAll('[data-index]').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectSuggestionItem(item);
                });
                item.addEventListener('mouseenter', () => {
                    const idx = parseInt(item.dataset.index);
                    highlightSuggestion(idx);
                    suggestionsBox._highlightedIndex = idx;
                });
            });
        };

        clienteInput.addEventListener('keydown', (e) => {
            const items = suggestionsBox.querySelectorAll('[data-index]');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                let idx = suggestionsBox._highlightedIndex;
                idx = (idx + 1) % items.length;
                highlightSuggestion(idx);
                suggestionsBox._highlightedIndex = idx;
                items[idx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                let idx = suggestionsBox._highlightedIndex;
                idx = (idx <= 0) ? items.length - 1 : idx - 1;
                highlightSuggestion(idx);
                suggestionsBox._highlightedIndex = idx;
                items[idx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                const idx = suggestionsBox._highlightedIndex;
                if (idx >= 0 && idx < items.length) {
                    e.preventDefault();
                    selectSuggestionItem(items[idx]);
                    clienteInput.focus();
                }
            } else if (e.key === 'Escape') {
                suggestionsBox.style.display = 'none';
                suggestionsBox._highlightedIndex = -1;
            }
        });

        const normalizeText = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        const searchClients = async (query) => {
            if (query.length < 1) {
                suggestionsBox.style.display = 'none';
                return;
            }

            suggestionsBox.innerHTML = '<div style="padding: 0.75rem; color: var(--text-secondary);">Buscando clientes...</div>';
            suggestionsBox.style.display = 'block';

            try {
                let allClients = [];

                if (window.Clientes && window.Clientes.loadRecords) {
                    await window.Clientes.loadRecords();
                }

                allClients = window.Clientes ? window.Clientes.getAll() : [];

                if (!allClients || allClients.length === 0) {
                    if (!Interlogic._clientSearchCache) {
                        const db = firebase.firestore();
                        const snapshot = await db.collection('clientes')
                            .orderBy('nombre')
                            .limit(500)
                            .get();
                        Interlogic._clientSearchCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    }
                    allClients = Interlogic._clientSearchCache;
                }

                const queryWords = query.split(/\s+/).filter(w => w.length > 0).map(normalizeText);
                const matches = allClients.filter(c => {
                    const clientName = normalizeText(c.nombre || '');
                    return queryWords.every(word => clientName.includes(word));
                }).slice(0, 10);

                renderSuggestions(matches);
            } catch (error) {
                console.error('Error searching clients:', error);
                suggestionsBox.innerHTML = '<div style="padding: 0.75rem; color: var(--error);">Error al buscar clientes</div>';
            }
        };

        clienteInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = clienteInput.value.toLowerCase().trim();
                searchClients(query);
            }, 200);
        });

        clienteInput.addEventListener('focus', () => {
            const query = clienteInput.value.toLowerCase().trim();
            if (query.length >= 1) {
                searchClients(query);
            }
        });

        clienteInput.addEventListener('blur', () => {
            setTimeout(() => { suggestionsBox.style.display = 'none'; }, 200);
        });

        const saveAnotherBtn = document.getElementById('btn-il-save-another');
        if (saveAnotherBtn) {
            saveAnotherBtn.addEventListener('click', () => {
                this._saveAndAddAnother = true;
                document.getElementById('interlogic-form').dispatchEvent(new Event('submit', { cancelable: true }));
            });
        }

        document.getElementById('interlogic-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('btn-il-save');
            setButtonLoading(saveBtn, true);

            try {
                const dateVal = document.getElementById('il-fecha').value;
                let firebaseDate = null;
                if (dateVal) {
                    const [y, m, d] = dateVal.split('-').map(Number);
                    const localDate = new Date(y, m - 1, d, 12, 0, 0);
                    firebaseDate = firebase.firestore.Timestamp.fromDate(localDate);
                }

                const venta = Number(document.getElementById('il-venta').value) || 0;
                const bultos = Number(document.getElementById('il-bultos').value) || 0;

                const costoEnvio = bultos * 1.85;
                const costoPorcentaje = venta > 0 ? (costoEnvio / venta) * 100 : 0;

                const data = {
                    guia: document.getElementById('il-guia').value || '',
                    empresa: document.getElementById('il-empresa').value || '',
                    fecha: firebaseDate,
                    doc: document.getElementById('il-doc').value || '',
                    docNum: document.getElementById('il-docNum').value.trim() || '',
                    cliente: document.getElementById('il-cliente').value.trim() || '',
                    direccion: document.getElementById('il-direccion').value.trim() || '',
                    telefono: document.getElementById('il-telefono').value.trim() || '',
                    zona: document.getElementById('il-departamento').value.trim() || '',
                    departamento: document.getElementById('il-departamento').value.trim() || '',
                    municipio: document.getElementById('il-municipio').value.trim() || '',
                    vendedor: document.getElementById('il-vendedor').value.trim() || '',
                    condicionPago: document.getElementById('il-condicionPago').value || '',
                    venta: venta,
                    cobrador: document.getElementById('il-cobrador').value.trim() || '',
                    bultos: bultos,
                    costoEnvio: costoEnvio,
                    costoPorcentaje: costoPorcentaje,
                    observations: document.getElementById('il-observations').value.trim() || '',
                    entrega: document.getElementById('il-entrega').value || '',
                    cobra: document.getElementById('il-cobra').value || '',
                    encargado: document.getElementById('il-encargado').value.trim() || '',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (data.condicionPago === 'Crédito') {
                    const plazo = parseInt(document.getElementById('il-plazo').value) || 30;
                    const fechaBase = firebaseDate ? firebaseDate.toDate() : new Date();
                    fechaBase.setHours(12, 0, 0, 0);
                    const fechaVenc = new Date(fechaBase);
                    fechaVenc.setDate(fechaVenc.getDate() + plazo);
                    data.fechaVencimiento = firebase.firestore.Timestamp.fromDate(fechaVenc);
                    if (!recordId) {
                        data.estadoCobro = 'pendiente';
                        data.montoCobrado = 0;
                        data.montoPendiente = venta;
                    }
                }

                const db = firebase.firestore();
                const isNC = data.doc === 'NC';

                if (isNC && !recordId) {
                    // CREAR nueva Nota de Crédito (solo cuando es un registro nuevo)
                    var ncAfectaVal = document.getElementById('il-nc-afectaSaldo').value;
                    var ncInterlogicIdVal = document.getElementById('il-nc-interlogicId').value;

                    var ncData = {
                        ncNum: data.docNum,
                        cliente: data.cliente,
                        monto: venta,
                        motivo: data.observations,
                        fecha: data.fecha,
                        empresa: data.empresa,
                        interlogicId: ncInterlogicIdVal || '',
                        guia: data.guia || '',
                        docRef: ncInterlogicIdVal ? (data.doc + ' #' + data.docNum) : '',
                        afectaSaldo: ncAfectaVal === 'si',
                        estado: 'activa',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdBy: firebase.auth().currentUser.uid
                    };

                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    data.createdBy = firebase.auth().currentUser.uid;

                    if (ncAfectaVal === 'si' && ncInterlogicIdVal) {
                        var batch = db.batch();
                        batch.set(db.collection('notasCredito').doc(), ncData);
                        batch.set(db.collection('interlogic').doc(), data);

                        var ccfDoc = await db.collection('interlogic').doc(ncInterlogicIdVal).get();
                        if (ccfDoc.exists) {
                            var ccfData = ccfDoc.data();
                            var cobradoActualCents = toCents(ccfData.montoCobrado || (ccfData.cobrado === true ? ccfData.venta : 0));
                            var ventaCCFCents = toCents(ccfData.venta || 0);
                            var ventaCents = toCents(venta);
                            var nuevoCobradoCents = cobradoActualCents + ventaCents;
                            var nuevoPendienteCents = Math.max(0, ventaCCFCents - nuevoCobradoCents);
                            var nuevoCobrado = nuevoCobradoCents / 100;
                            var nuevoPendiente = nuevoPendienteCents / 100;
                            var nuevoEstado = nuevoCobradoCents >= ventaCCFCents ? 'pagado' : (nuevoCobradoCents > 0 ? 'parcial' : 'pendiente');

                            batch.update(db.collection('interlogic').doc(ncInterlogicIdVal), {
                                montoCobrado: nuevoCobrado,
                                montoPendiente: nuevoPendiente,
                                estadoCobro: nuevoEstado,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        }

                        await batch.commit();
                        showToast('✓ Nota de Crédito creada y saldo actualizado', 'success');
                    } else {
                        var batch2 = db.batch();
                        batch2.set(db.collection('notasCredito').doc(), ncData);
                        batch2.set(db.collection('interlogic').doc(), data);
                        await batch2.commit();
                        showToast('✓ Nota de Crédito creada', 'success');
                    }
                } else if (recordId) {
                    await db.collection('interlogic').doc(recordId).update(data);
                    showToast('✓ Registro actualizado', 'success');
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    data.createdBy = firebase.auth().currentUser.uid;
                    await db.collection('interlogic').add(data);
                    showToast('✓ Registro creado', 'success');

                    localStorage.setItem('il_last_values', JSON.stringify({
                        empresa: data.empresa,
                        vendedor: data.vendedor,
                        departamento: data.departamento,
                        municipio: data.municipio,
                        condicionPago: data.condicionPago,
                        cobrador: data.cobrador,
                        encargado: data.encargado
                    }));
                }

                if (data.cliente && window.Clientes) {
                    const obsEntrega = document.getElementById('il-cliente-observacion')?.textContent?.replace(/^📦\s*/, '').trim() || '';
                    Clientes.saveFromRecord({
                        nombre: data.cliente,
                        direccion: data.direccion,
                        telefono: data.telefono,
                        departamento: data.departamento,
                        municipio: data.municipio,
                        vendedor: data.vendedor,
                        empresa: data.empresa,
                        condicionPago: data.condicionPago,
                        observacionEntrega: obsEntrega
                    });

                    if (data.condicionPago === 'Crédito' && !isNC) {
                        setTimeout(async () => {
                            try {
                                const eqNombre = data.cliente.toLowerCase().trim();
                                const cliSnap = await firebase.firestore().collection('clientes')
                                    .where('nombreNorm', '==', eqNombre).limit(1).get();
                                if (!cliSnap.empty) {
                                    const cliData = cliSnap.docs[0].data();
                                    const limite = parseFloat(cliData.limiteCredito) || 0;
                                    if (limite > 0) {
                                        const crSnap = await firebase.firestore().collection('interlogic')
                                            .where('cliente', '==', data.cliente)
                                            .where('condicionPago', '==', 'Crédito').get();
                                        const deudaTotal = crSnap.docs.reduce((s, doc) => {
                                            const d = doc.data();
                                            const cob = Number(d.montoCobrado || (d.cobrado === true ? d.venta : 0));
                                            return s + Math.max(0, Number(d.venta || 0) - cob);
                                        }, 0);
                                        if (deudaTotal > limite) {
                                            showToast('⚠️ ATENCIÓN: La deuda total de ' + data.cliente + ' (' + formatCurrency(deudaTotal) + ') excede su límite de crédito (' + formatCurrency(limite) + ')', 'warning');
                                        }
                                    }
                                }
                            } catch(e) { console.warn('Credit limit check error:', e.message); }
                        }, 1000);
                    }
                }
                Interlogic._invalidateClientCache();
                if (this._saveAndAddAnother) {
                    this._saveAndAddAnother = false;
                    modal.remove();
                    await this.loadRecords();
                    this.showForm();
                    return;
                }

                modal.remove();
                await this.loadRecords();
            } catch (error) {
                console.error('Error saving record:', error);
                showToast('Error al guardar: ' + error.message, 'error');
            } finally {
                setButtonLoading(saveBtn, false);
            }
        });
    },

    async deleteRecord(recordId) {
        if (!window.permissions?.canDelete) {
            showToast('No tienes permisos para eliminar registros', 'error');
            return;
        }
        if (!await showConfirm('¿Estás seguro de eliminar este registro?', 'Esta acción no se puede deshacer.')) return;

        try {
            console.log('🗑️ Intentando eliminar registro:', recordId);
            await firebase.firestore().collection('interlogic').doc(recordId).delete();
            console.log('✅ Registro eliminado de Firestore');

            this.records = this.records.filter(r => r.id !== recordId);
            this.applyFilters();

            showToast('✓ Registro eliminado exitosamente', 'success');
        } catch (error) {
            console.error('❌ Error deleting record:', error);
            showToast('Error al eliminar: ' + error.message, 'error');
        }
    },

    duplicateRecord(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record) return;
        this.showForm(null, record);
    },

    async toggleCellField(id, field) {
        if (!window.permissions?.canEdit) {
            showToast('No tienes permisos para editar', 'error');
            return;
        }

        const record = this.records.find(r => r.id === id);
        if (!record) return;

        const current = record[field] || '';
        const next = current === '' ? 'DALSE' :
                     current === 'DALSE' ? 'INTERLOGISTIC' :
                     current === 'INTERLOGISTIC' ? 'XPRESS' : '';

        record[field] = next;
        this.applyFilters();

        try {
            await firebase.firestore().collection('interlogic').doc(id).update({
                [field]: next,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            const label = field === 'entrega' ? '🏢' : '💰';
            showToast(`${label} ${field === 'entrega' ? 'Entrega' : 'Cobra'}: ${next || 'vacío'}`, 'success');
        } catch (error) {
            record[field] = current;
            this.applyFilters();
            showToast('Error al actualizar: ' + error.message, 'error');
        }
    },

    updateBulkDeleteButton() {
        let container = document.getElementById('bulk-actions-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'bulk-actions-container';
            container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 1000; display: none; gap: 0.5rem; align-items: center; flex-direction: row;';
            document.body.appendChild(container);
        }

        if (this.selectedRecords.size > 0) {
            container.style.display = 'inline-flex';
            container.innerHTML = `
                <button class="btn btn-accent" id="btn-create-route-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    ➕ Crear Ruta (${this.selectedRecords.size})
                </button>
                <button class="btn btn-secondary" id="btn-change-date-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    📅 Cambiar Fecha (${this.selectedRecords.size})
                </button>
                <button class="btn btn-primary" id="btn-assign-entrega-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    🚚 Asignar Entrega (${this.selectedRecords.size})
                </button>
                <button class="btn btn-primary" id="btn-assign-cobra-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    💰 Asignar Cobra (${this.selectedRecords.size})
                </button>
                <button class="btn btn-teal" id="btn-mark-entregada-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center; background: #0d9488; color: #fff; border: none;">
                    ✅ Entregada (${this.selectedRecords.size})
                </button>
                <button class="btn btn-danger" id="btn-delete-selected" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    🗑️ Eliminar (${this.selectedRecords.size})
                </button>
            `;
            document.getElementById('btn-delete-selected').onclick = () => this.deleteSelectedRecords();
            document.getElementById('btn-change-date-selected').onclick = () => this.changeDateSelectedRecords();
            document.getElementById('btn-create-route-selected').onclick = () => this.createRouteFromSelection();
            document.getElementById('btn-assign-entrega-selected').onclick = () => this.batchAssignField('entrega');
            document.getElementById('btn-assign-cobra-selected').onclick = () => this.batchAssignField('cobra');
            document.getElementById('btn-mark-entregada-selected').onclick = () => this.batchMarkEntregada();
        } else {
            container.style.display = 'none';
        }
    },

    async deleteSelectedRecords() {
        if (!window.permissions?.canDelete) {
            showToast('No tienes permisos para eliminar registros', 'error');
            return;
        }
        const count = this.selectedRecords.size;
        if (count === 0) return;
        if (!await showConfirm(`¿Eliminar ${count} registro(s)?`, 'Esta acción no se puede deshacer.')) return;

        try {
            const batch = firebase.firestore().batch();
            for (const id of this.selectedRecords) {
                batch.delete(firebase.firestore().collection('interlogic').doc(id));
            }
            await batch.commit();

            this.records = this.records.filter(r => !this.selectedRecords.has(r.id));
            this.selectedRecords.clear();
            this.applyFilters();

            showToast(`✓ ${count} registro(s) eliminado(s) exitosamente`, 'success');
        } catch (error) {
            console.error('❌ Error bulk deleting:', error);
            showToast('Error al eliminar: ' + error.message, 'error');
        }
    },

    batchAssignField(field) {
        if (!window.permissions?.canEdit) {
            showToast('No tienes permisos para editar registros', 'error');
            return;
        }
        const count = this.selectedRecords.size;
        if (count === 0) return;

        const label = field === 'entrega' ? '🚚 Entrega' : '💰 Cobra';

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 380px;">
                <h2 style="margin-bottom: 0.5rem; text-align: center;">${label}</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1.2rem; text-align: center;">
                    Asignar a <strong>${count} registro(s)</strong> seleccionado(s)
                </p>
                <div style="display: flex; gap: 0.8rem; margin-bottom: 0.5rem;">
                    <button id="ba-dalse" class="btn btn-primary" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">
                        🏢 DALSE
                    </button>
                    <button id="ba-interlogistic" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">
                        🚛 INTERLOGISTIC
                    </button>
                    <button id="ba-xpress" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">
                        📦 XPRESS
                    </button>
                </div>
                <button id="ba-clear" class="btn btn-secondary" style="width: 100%; margin-bottom: 0.5rem;">
                    🧹 Limpiar (vacío)
                </button>
                <button id="ba-cancel" class="btn btn-ghost" style="width: 100%;">Cancelar</button>
            </div>
        `;
        document.body.appendChild(modal);

        const self = this;
        const doAssign = async (value) => {
            const btns = ['ba-dalse', 'ba-interlogistic', 'ba-xpress', 'ba-clear'].map(id => document.getElementById(id));
            btns.forEach(b => { if (b) { b.disabled = true; b.style.opacity = '0.6'; } });

            const ids = [...self.selectedRecords];
            try {
                const db = firebase.firestore();
                const batch = db.batch();
                ids.forEach(id => {
                    batch.update(db.collection('interlogic').doc(id), {
                        [field]: value,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();

                self.records.forEach(r => {
                    if (self.selectedRecords.has(r.id)) r[field] = value;
                });
                self.selectedRecords.clear();
                self.applyFilters();
                modal.remove();
                showToast(`✓ ${label}: "${value || 'vacío'}" en ${ids.length} registro(s)`, 'success');
            } catch (error) {
                showToast('Error al actualizar: ' + error.message, 'error');
                btns.forEach(b => { if (b) { b.disabled = false; b.style.opacity = '1'; } });
            }
        };

        document.getElementById('ba-dalse').onclick = () => doAssign('DALSE');
        document.getElementById('ba-interlogistic').onclick = () => doAssign('INTERLOGISTIC');
        document.getElementById('ba-xpress').onclick = () => doAssign('XPRESS');
        document.getElementById('ba-clear').onclick = () => doAssign('');
        document.getElementById('ba-cancel').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    },

    batchMarkEntregada() {
        if (!window.permissions?.canEdit) {
            showToast('No tienes permisos para editar registros', 'error');
            return;
        }
        const count = this.selectedRecords.size;
        if (count === 0) return;

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 480px;">
                <h2 style="margin-bottom: 0.5rem; text-align: center;">✅ Marcar como Entregada</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1.2rem; text-align: center;">
                    <strong>${count} factura(s)</strong> seleccionada(s)
                </p>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Forma de pago (Contado)</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-bottom: 1rem;">
                    <button id="mfp-efectivo" class="mfp-btn" style="background: #f0fdf4;" onmouseenter="this.style.borderColor='#22c55e'" onmouseleave="this.style.borderColor='#d1d5db'">
                        <div style="font-size: 1.8rem; margin-bottom: 0.2rem;">💵</div>
                        <div style="font-weight: 700; color: #166534;">Efectivo</div>
                    </button>
                    <button id="mfp-cheque" class="mfp-btn" style="background: #eff6ff;" onmouseenter="this.style.borderColor='#3b82f6'" onmouseleave="this.style.borderColor='#d1d5db'">
                        <div style="font-size: 1.8rem; margin-bottom: 0.2rem;">🏦</div>
                        <div style="font-weight: 700; color: #1e40af;">Cheque</div>
                    </button>
                    <button id="mfp-transferencia" class="mfp-btn" style="background: #faf5ff;" onmouseenter="this.style.borderColor='#a855f7'" onmouseleave="this.style.borderColor='#d1d5db'">
                        <div style="font-size: 1.8rem; margin-bottom: 0.2rem;">📱</div>
                        <div style="font-weight: 700; color: #6b21a8;">Transferencia</div>
                    </button>
                    <button id="mfp-abono" class="mfp-btn" style="background: #fff7ed;" onmouseenter="this.style.borderColor='#f97316'" onmouseleave="this.style.borderColor='#d1d5db'">
                        <div style="font-size: 1.8rem; margin-bottom: 0.2rem;">📝</div>
                        <div style="font-weight: 700; color: #9a3412;">Abono</div>
                    </button>
                </div>
                <div style="position: relative; text-align: center; margin-bottom: 0.8rem;">
                    <hr style="border: none; border-top: 1px solid var(--gray-200);"><span style="position: absolute; top: -0.6rem; left: 50%; transform: translateX(-50%); background: var(--bg-primary, #fff); padding: 0 0.6rem; font-size: 0.75rem; color: var(--text-secondary);">o</span>
                </div>
                <button id="mfp-solo-entregada" style="width: 100%; padding: 0.8rem; border: 2px solid #d1d5db; border-radius: 12px; background: var(--bg-secondary, #f9fafb); cursor: pointer; font-size: 0.95rem; font-weight: 600; color: var(--text-primary, #111); transition: all 0.15s;" onmouseenter="this.style.borderColor='#6366f1';this.style.background='#eef2ff'" onmouseleave="this.style.borderColor='#d1d5db';this.style.background='var(--bg-secondary, #f9fafb)'">
                    ✅ Solo Entregada (Crédito)
                </button>
                <p style="font-size: 0.72rem; color: var(--text-secondary); text-align: center; margin-top: 0.4rem;">Para facturas de crédito que no requieren pago inmediato</p>
                <button id="mfp-cancel" class="btn btn-ghost" style="width: 100%; margin-top: 0.6rem;">Cancelar</button>
            </div>
        `;
        document.body.appendChild(modal);

        const self = this;
        const doMark = async (formaPago) => {
            const btns = ['mfp-efectivo', 'mfp-cheque', 'mfp-transferencia', 'mfp-abono', 'mfp-solo-entregada'].map(id => document.getElementById(id));
            btns.forEach(b => { if (b) { b.disabled = true; b.style.opacity = '0.5'; } });

            const ids = [...self.selectedRecords];
            try {
                const db = firebase.firestore();
                const batch = db.batch();
                ids.forEach(id => {
                    const update = {
                        entregado: true,
                        fechaEntrega: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    if (formaPago) update.formaPago = formaPago;
                    else update.formaPago = firebase.firestore.FieldValue.delete();
                    batch.update(db.collection('interlogic').doc(id), update);
                });
                await batch.commit();

                self.records.forEach(r => {
                    if (self.selectedRecords.has(r.id)) {
                        r.entregado = true;
                        if (formaPago) r.formaPago = formaPago;
                        else delete r.formaPago;
                    }
                });
                self.selectedRecords.clear();
                self.applyFilters();
                modal.remove();
                const pagoMsg = formaPago ? ' — Pago: ' + formaPago : '';
                showToast('✅ ' + ids.length + ' factura(s) marcada(s) como entregadas' + pagoMsg, 'success');
            } catch (error) {
                showToast('Error al actualizar: ' + error.message, 'error');
                btns.forEach(b => { if (b) { b.disabled = false; b.style.opacity = '1'; } });
            }
        };

        document.getElementById('mfp-efectivo').onclick = () => doMark('Efectivo');
        document.getElementById('mfp-cheque').onclick = () => doMark('Cheque');
        document.getElementById('mfp-transferencia').onclick = () => doMark('Transferencia');
        document.getElementById('mfp-abono').onclick = () => doMark('Abono');
        document.getElementById('mfp-solo-entregada').onclick = () => doMark(null);
        document.getElementById('mfp-cancel').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    },

    async changeDateSelectedRecords() {
        if (!window.permissions?.canEdit) {
            showToast('No tienes permisos para editar registros', 'error');
            return;
        }
        const count = this.selectedRecords.size;
        if (count === 0) return;

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h2 style="margin-bottom: 1rem;">📅 Cambiar Fecha</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Se cambiará la fecha de <strong>${count} registro(s)</strong> seleccionado(s).</p>
                <div class="form-group">
                    <label>Nueva Fecha</label>
                    <input type="date" id="bulk-new-date" value="${getLocalDateString()}" style="padding: 0.5rem 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); width: 100%; font-size: 1rem;">
                </div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="button" class="btn btn-secondary" id="bulk-date-cancel">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="bulk-date-confirm">✓ Aplicar Fecha</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('bulk-date-cancel').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        document.getElementById('bulk-date-confirm').onclick = async () => {
            const newDateVal = document.getElementById('bulk-new-date').value;
            if (!newDateVal) {
                showToast('Selecciona una fecha', 'error');
                return;
            }

            const confirmBtn = document.getElementById('bulk-date-confirm');
            setButtonLoading(confirmBtn, true);

            try {
                const [y, m, d] = newDateVal.split('-').map(Number);
                const newDate = firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));

                const batch = firebase.firestore().batch();
                for (const id of this.selectedRecords) {
                    batch.update(firebase.firestore().collection('interlogic').doc(id), {
                        fecha: newDate,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                await batch.commit();

                this.records.forEach(r => {
                    if (this.selectedRecords.has(r.id)) {
                        r.fecha = newDate;
                    }
                });

                this.selectedRecords.clear();
                this.applyFilters();
                modal.remove();

                showToast(`✓ Fecha actualizada en ${count} registro(s)`, 'success');
            } catch (error) {
                console.error('❌ Error changing dates:', error);
                showToast('Error al cambiar fecha: ' + error.message, 'error');
                setButtonLoading(confirmBtn, false);
            }
        };
    },

    showMobileDetail(id) {
        var r = this.filteredRecords.find(function(x) { return x.id === id; }) || this.records.find(function(x) { return x.id === id; });
        if (!r) return;

        var sheet = document.createElement('div');
        sheet.innerHTML = '<div class="m-sheet-backdrop show" onclick="this.nextElementSibling.remove();this.remove();"></div><div class="m-bottom-sheet show"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">#' + sanitizeHTML(r.guia || 'Detalle') + '</span><button class="m-sheet-close" onclick="this.closest(\'.m-bottom-sheet\').remove();document.querySelector(\'.m-sheet-backdrop\').remove();">✕</button></div><div class="m-sheet-body"><div style="display:flex;flex-direction:column;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Empresa</span><div style="font-weight:500;">' + sanitizeHTML(r.empresa || '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Cliente</span><div style="font-weight:500;">' + sanitizeHTML(r.cliente || '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Dirección</span><div style="font-weight:500;">' + sanitizeHTML(r.direccion || '-') + '</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Fecha</span><div style="font-weight:500;">' + (r.fecha ? formatDateShort(r.fecha) : '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Doc</span><div style="font-weight:500;">' + sanitizeHTML(r.doc || '') + (r.docNum ? ' #' + sanitizeHTML(r.docNum) : '') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Venta</span><div style="font-weight:700;color:#10b981;font-size:1.1rem;">' + formatCurrency(r.venta || 0) + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Bultos</span><div style="font-weight:500;">' + formatNumber(r.bultos || 0) + '</div></div></div>' + (r.formaPago ? '<div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Forma Pago</span><div style="font-weight:600;padding:4px 10px;border-radius:8px;display:inline-block;background:' + (({Efectivo:'#f0fdf4',Cheque:'#eff6ff',Transferencia:'#faf5ff',Abono:'#fff7ed'}[r.formaPago]||'#f3f4f6')) + ';color:' + (({Efectivo:'#166534',Cheque:'#1e40af',Transferencia:'#6b21a8',Abono:'#9a3412'}[r.formaPago]||'#374151')) + ';">' + (({Efectivo:'💵',Cheque:'🏦',Transferencia:'📱',Abono:'📝'}[r.formaPago]||'💳')) + ' ' + sanitizeHTML(r.formaPago) + '</div></div>' : '') + '</div></div></div>';
        document.body.appendChild(sheet);
    },

    showMobileForm(id) {
        var record = id ? (this.filteredRecords.find(function(x) { return x.id === id; }) || this.records.find(function(x) { return x.id === id; })) : null;
        var isEdit = !!record;
        var self = this;

        var sheet = document.createElement('div');
        sheet.innerHTML = '<div class="m-sheet-backdrop show" id="m-form-backdrop"></div><div class="m-bottom-sheet show" id="m-form-sheet"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">' + (isEdit ? 'Editar Registro' : 'Nuevo Registro') + '</span><button class="m-sheet-close" onclick="document.getElementById(\'m-form-sheet\').remove();document.getElementById(\'m-form-backdrop\').remove();">✕</button></div><div class="m-sheet-body"><div class="m-form-group"><label>Guía</label><input type="text" id="mf-guia" value="' + sanitizeHTML(record?.guia || '').replace(/"/g, '&quot;') + '"></div><div class="m-form-row"><div class="m-form-group"><label>Empresa</label><select id="mf-empresa"><option value="DALSE"' + (record?.empresa === 'DALSE' ? ' selected' : '') + '>DALSE</option><option value="INCEDE"' + (record?.empresa === 'INCEDE' ? ' selected' : '') + '>INCEDE</option></select></div><div class="m-form-group"><label>Fecha</label><input type="date" id="mf-fecha" value="' + (record?.fecha ? (typeof record.fecha === 'string' ? record.fecha.split('T')[0] : formatDateForInput(record.fecha)) : formatDateForInput(new Date())) + '"></div></div><div class="m-form-row"><div class="m-form-group"><label>Doc</label><select id="mf-doc"><option value="CCF"' + (record?.doc === 'CCF' ? ' selected' : '') + '>CCF</option><option value="Factura"' + (record?.doc === 'Factura' ? ' selected' : '') + '>Factura</option><option value="Ticket"' + (record?.doc === 'Ticket' ? ' selected' : '') + '>Ticket</option><option value="NC"' + (record?.doc === 'NC' ? ' selected' : '') + '>NC</option></select></div><div class="m-form-group"><label>N° Doc</label><input type="text" id="mf-docNum" value="' + sanitizeHTML(record?.docNum || '').replace(/"/g, '&quot;') + '"></div></div><div class="m-form-group"><label>Cliente</label><input type="text" id="mf-cliente" value="' + sanitizeHTML(record?.cliente || '').replace(/"/g, '&quot;') + '"></div><div id="mf-cliente-observacion" style="display:none;padding:8px 12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;color:#dc2626;font-size:0.8rem;font-weight:600;margin-top:8px;"></div><div class="m-form-group"><label>Dirección</label><input type="text" id="mf-direccion" value="' + sanitizeHTML(record?.direccion || '').replace(/"/g, '&quot;') + '"></div><div class="m-form-group"><label>Vendedor</label><input type="text" id="mf-vendedor" value="' + sanitizeHTML(record?.vendedor || '').replace(/"/g, '&quot;') + '"></div><div class="m-form-row"><div class="m-form-group"><label>Venta ($)</label><input type="number" id="mf-venta" step="0.01" value="' + (record?.venta || '') + '"></div><div class="m-form-group"><label>Bultos</label><input type="number" id="mf-bultos" value="' + (record?.bultos || '') + '"></div></div><div class="m-form-group"><label>Entrega</label><select id="mf-entrega"><option value="">Seleccionar...</option><option value="DALSE"' + (record?.entrega === 'DALSE' ? ' selected' : '') + '>DALSE</option><option value="INTERLOGISTIC"' + (record?.entrega === 'INTERLOGISTIC' ? ' selected' : '') + '>INTERLOGISTIC</option><option value="XPRESS"' + (record?.entrega === 'XPRESS' ? ' selected' : '') + '>XPRESS</option></select></div><div class="m-form-group"><label>Cobra</label><select id="mf-cobra"><option value="">Seleccionar...</option><option value="DALSE"' + (record?.cobra === 'DALSE' ? ' selected' : '') + '>DALSE</option><option value="INTERLOGISTIC"' + (record?.cobra === 'INTERLOGISTIC' ? ' selected' : '') + '>INTERLOGISTIC</option><option value="XPRESS"' + (record?.cobra === 'XPRESS' ? ' selected' : '') + '>XPRESS</option></select></div><div class="m-form-group"><label>Observaciones</label><textarea id="mf-observations" rows="2">' + sanitizeHTML(record?.observations || '') + '</textarea></div></div><div class="m-sheet-footer"><button class="btn btn-primary" id="mf-submit" style="flex:1;">' + (isEdit ? 'Guardar Cambios' : 'Crear Registro') + '</button></div></div>';
        document.body.appendChild(sheet);

        if (record && record.cliente) {
            var mobileClientName = record.cliente.toLowerCase().trim();
            var mobileMatchedClient = (window.Clientes?.records || []).find(function(c) {
                return (c.nombre || '').toLowerCase().trim() === mobileClientName;
            });
            var mobileObsDiv = document.getElementById('mf-cliente-observacion');
            if (mobileObsDiv && mobileMatchedClient && mobileMatchedClient.observacionEntrega) {
                mobileObsDiv.textContent = '📦 ' + mobileMatchedClient.observacionEntrega;
                mobileObsDiv.style.display = 'block';
            }
        }

        var mfDoc = document.getElementById('mf-doc');
        var mfNcFields = document.getElementById('mf-nc-fields');
        var mfNcAfecta = document.getElementById('mf-nc-afectaSaldo');
        var mfNcCcfGroup = document.getElementById('mf-nc-ccf-group');
        var mfNcInterlogicId = document.getElementById('mf-nc-interlogicId');
        var mfToggleNC = function() {
            var isNC = mfDoc.value === 'NC';
            if (mfNcFields) mfNcFields.style.display = isNC ? 'block' : 'none';
        };
        mfDoc.addEventListener('change', mfToggleNC);
        mfToggleNC();

        if (mfNcAfecta) {
            mfNcAfecta.addEventListener('change', function() {
                var afecta = mfNcAfecta.value === 'si';
                if (mfNcCcfGroup) mfNcCcfGroup.style.display = afecta ? 'block' : 'none';
                if (afecta) mfPopulateCCFList();
            });
        }

        var mfPopulateCCFList = function() {
            if (!mfNcInterlogicId) return;
            mfNcInterlogicId.innerHTML = '<option value="">-- Seleccionar CCF/FT --</option>';
            var clienteActual = document.getElementById('mf-cliente').value.trim();
            if (!clienteActual) {
                mfNcInterlogicId.innerHTML = '<option value="">-- Primero ingresa el cliente --</option>';
                return;
            }
            var clienteLower = clienteActual.toLowerCase();
            var ccfRecords = self.records.filter(function(r) {
                return (r.doc === 'CCF' || r.doc === 'FT') && (r.cliente || '').toLowerCase().includes(clienteLower);
            });
            if (ccfRecords.length === 0) {
                mfNcInterlogicId.innerHTML = '<option value="">-- No hay CCF/FT para este cliente --</option>';
                return;
            }
            ccfRecords.forEach(function(r) {
                var estado = r.estadoCobro === 'pagado' ? 'Pagado' : (r.estadoCobro === 'parcial' ? 'Parcial' : 'Pendiente');
                var opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = (r.doc || '') + ' #' + (r.docNum || r.guia || '') + ' - ' + formatCurrency(r.venta || 0) + ' (' + estado + ')';
                mfNcInterlogicId.appendChild(opt);
            });
        };

        var mfClienteInput = document.getElementById('mf-cliente');
        if (mfClienteInput) {
            mfClienteInput.addEventListener('change', function() {
                if (mfDoc.value === 'NC' && mfNcAfecta && mfNcAfecta.value === 'si') {
                    mfPopulateCCFList();
                }
                var clientName = mfClienteInput.value.trim().toLowerCase();
                var obsDiv = document.getElementById('mf-cliente-observacion');
                if (obsDiv && clientName) {
                    var matchedClient = (window.Clientes?.records || []).find(function(c) {
                        return (c.nombre || '').toLowerCase().trim() === clientName;
                    });
                    if (matchedClient && matchedClient.observacionEntrega) {
                        obsDiv.textContent = '📦 ' + matchedClient.observacionEntrega;
                        obsDiv.style.display = 'block';
                    } else {
                        obsDiv.textContent = '';
                        obsDiv.style.display = 'none';
                    }
                } else if (obsDiv) {
                    obsDiv.textContent = '';
                    obsDiv.style.display = 'none';
                }
            });
        }

        document.getElementById('mf-submit').addEventListener('click', async function() {
            var btn = document.getElementById('mf-submit');
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            var _mfFechaVal = document.getElementById('mf-fecha').value;
            var _mfFirebaseDate = null;
            if (_mfFechaVal) {
                var _mfParts = _mfFechaVal.split('-').map(Number);
                _mfFirebaseDate = firebase.firestore.Timestamp.fromDate(new Date(_mfParts[0], _mfParts[1] - 1, _mfParts[2], 12, 0, 0));
            }

            var data = {
                guia: document.getElementById('mf-guia').value,
                empresa: document.getElementById('mf-empresa').value,
                fecha: _mfFirebaseDate,
                doc: document.getElementById('mf-doc').value,
                docNum: document.getElementById('mf-docNum').value,
                cliente: document.getElementById('mf-cliente').value,
                direccion: document.getElementById('mf-direccion').value,
                zona: document.getElementById('mf-departamento')?.value || '',
                departamento: document.getElementById('mf-departamento')?.value || '',
                municipio: document.getElementById('mf-municipio')?.value || '',
                vendedor: document.getElementById('mf-vendedor').value,
                condicionPago: document.getElementById('mf-condicionPago')?.value || '',
                cobrador: document.getElementById('mf-cobrador')?.value || '',
                venta: parseFloat(document.getElementById('mf-venta').value) || 0,
                bultos: parseInt(document.getElementById('mf-bultos').value) || 0,
                costoEnvio: parseFloat(document.getElementById('mf-costoEnvio')?.value) || 0,
                costoPorcentaje: parseFloat(document.getElementById('mf-costoPorcentaje')?.value) || 0,
                observations: document.getElementById('mf-observations').value,
                entrega: document.getElementById('mf-entrega').value || '',
                cobra: document.getElementById('mf-cobra').value || '',
                encargado: document.getElementById('mf-encargado') ? document.getElementById('mf-encargado').value : '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                var isNC = data.doc === 'NC';

                if (isNC) {
                    var ncAfectaVal = document.getElementById('mf-nc-afectaSaldo') ? document.getElementById('mf-nc-afectaSaldo').value : 'no';
                    var ncInterlogicIdVal = document.getElementById('mf-nc-interlogicId') ? document.getElementById('mf-nc-interlogicId').value : '';

                    var ncData = {
                        ncNum: data.docNum,
                        cliente: data.cliente,
                        monto: data.venta,
                        motivo: data.observations,
                        fecha: data.fecha,
                        empresa: data.empresa,
                        interlogicId: ncInterlogicIdVal || '',
                        guia: data.guia || '',
                        docRef: ncInterlogicIdVal ? (data.doc + ' #' + data.docNum) : '',
                        afectaSaldo: ncAfectaVal === 'si',
                        estado: 'activa',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdBy: firebase.auth().currentUser.uid
                    };

                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    data.createdBy = firebase.auth().currentUser.uid;

                    if (ncAfectaVal === 'si' && ncInterlogicIdVal) {
                        var db = firebase.firestore();
                        var batch = db.batch();
                        batch.set(db.collection('notasCredito').doc(), ncData);
                        batch.set(db.collection('interlogic').doc(), data);
                        var ccfDoc = await db.collection('interlogic').doc(ncInterlogicIdVal).get();
                        if (ccfDoc.exists) {
                            var ccfData = ccfDoc.data();
                            var cobradoActualCents = toCents(ccfData.montoCobrado || (ccfData.cobrado === true ? ccfData.venta : 0));
                            var ventaCCFCents = toCents(ccfData.venta || 0);
                            var dataVentaCents = toCents(data.venta);
                            var nuevoCobradoCents = cobradoActualCents + dataVentaCents;
                            var nuevoPendienteCents = Math.max(0, ventaCCFCents - nuevoCobradoCents);
                            var nuevoCobrado = nuevoCobradoCents / 100;
                            var nuevoPendiente = nuevoPendienteCents / 100;
                            var nuevoEstado = nuevoCobradoCents >= ventaCCFCents ? 'pagado' : (nuevoCobradoCents > 0 ? 'parcial' : 'pendiente');
                            batch.update(db.collection('interlogic').doc(ncInterlogicIdVal), {
                                montoCobrado: nuevoCobrado,
                                montoPendiente: nuevoPendiente,
                                estadoCobro: nuevoEstado,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        }
                        await batch.commit();
                        showToast('Nota de Credito creada y saldo actualizado', 'success');
                    } else {
                        var db2 = firebase.firestore();
                        var batch2 = db2.batch();
                        batch2.set(db2.collection('notasCredito').doc(), ncData);
                        batch2.set(db2.collection('interlogic').doc(), data);
                        await batch2.commit();
                        showToast('Nota de Credito creada', 'success');
                    }
                } else if (isEdit) {
                    await firebase.firestore().collection('interlogic').doc(id).update(data);
                    showToast('Registro actualizado', 'success');
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await firebase.firestore().collection('interlogic').add(data);
                    showToast('Registro creado', 'success');
                }

                if (data.cliente && window.Clientes) {
                    var mfObsDiv = document.getElementById('mf-cliente-observacion');
                    var mfObsEntrega = mfObsDiv ? mfObsDiv.textContent.replace(/^📦\s*/, '').trim() : '';
                    Clientes.saveFromRecord({
                        nombre: data.cliente,
                        direccion: data.direccion,
                        telefono: data.telefono,
                        departamento: data.departamento,
                        municipio: data.municipio,
                        vendedor: data.vendedor,
                        empresa: data.empresa,
                        condicionPago: data.condicionPago,
                        observacionEntrega: mfObsEntrega
                    });
                }
                document.getElementById('m-form-sheet').remove();
                document.getElementById('m-form-backdrop').remove();
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
                btn.disabled = false;
                btn.textContent = isEdit ? 'Guardar Cambios' : 'Crear Registro';
            }
        });
    }
};

window.InterlogicCRUD = InterlogicCRUD;
