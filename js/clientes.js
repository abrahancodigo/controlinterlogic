// ===================================
// Clientes (Client Management) Module
// ===================================

const Clientes = {
    records: [],
    filteredRecords: [],
    loading: false,
    searchQuery: '',
    currentSort: { field: 'nombre', direction: 'asc' },
    selectedRecords: new Set(),

    // Render the module
    async render() {
        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }
        return this.renderDesktop();
    },

    async renderDesktop() {
        this.isMobile = false;
        const content = document.getElementById('content-area');
        if (!content) return;

        content.innerHTML = `
            <div class="content-header">
                <h1>👥 Gestión de Clientes</h1>
                <p>Directorio de clientes registrados</p>
            </div>

            <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
                <div class="stat-card">
                    <h3>Total Clientes</h3>
                    <p id="stat-total-clientes">0</p>
                </div>
                <div class="stat-card">
                    <h3>Con Teléfono</h3>
                    <p id="stat-con-telefono">0</p>
                </div>
                <div class="stat-card">
                    <h3>Con Dirección</h3>
                    <p id="stat-con-direccion">0</p>
                </div>
            </div>

            <div class="card">
                <div class="module-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0;">
                        <input type="text" id="clientes-search" placeholder="🔍 Buscar cliente por nombre, dirección, teléfono..."
                               style="flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 0.9rem; min-width: 200px;">
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="Clientes.showForm()">➕ Nuevo Cliente</button>
                        <button class="btn btn-secondary" onclick="Clientes.showImportExcel()">📤 Importar Excel</button>
                        <button class="btn btn-secondary" onclick="Clientes.exportToExcel()">📥 Exportar Excel</button>
                    </div>
                </div>

                <div class="table-container" style="overflow-x: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 40px; text-align: center;">
                                    <input type="checkbox" id="select-all-clientes" title="Seleccionar todos" style="cursor: pointer; width: 16px; height: 16px;">
                                </th>
                                <th style="cursor: pointer;" onclick="Clientes.setSort('nombre')">Nombre <span class="sort-indicator" data-field="nombre"></span></th>
                                <th style="cursor: pointer;" onclick="Clientes.setSort('direccion')">Dirección <span class="sort-indicator" data-field="direccion"></span></th>
                                <th style="cursor: pointer;" onclick="Clientes.setSort('telefono')">Teléfono <span class="sort-indicator" data-field="telefono"></span></th>
                                <th style="cursor: pointer;" onclick="Clientes.setSort('zona')">Zona <span class="sort-indicator" data-field="zona"></span></th>
                                <th style="cursor: pointer;" onclick="Clientes.setSort('vendedor')">Vendedor <span class="sort-indicator" data-field="vendedor"></span></th>
                                <th style="cursor: pointer;" onclick="Clientes.setSort('empresa')">Empresa <span class="sort-indicator" data-field="empresa"></span></th>
                                <th style="cursor: pointer;" onclick="Clientes.setSort('condicionPago')">Cond. Pago <span class="sort-indicator" data-field="condicionPago"></span></th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="clientes-table-body">
                            <tr><td colspan="9" style="text-align: center; padding: 2rem;">Cargando clientes...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Setup search
        const searchInput = document.getElementById('clientes-search');
        const tableBody = document.getElementById('clientes-table-body');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.applyFilters();
        });

        // Select-all checkbox
        document.getElementById('select-all-clientes').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.cliente-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                if (e.target.checked) {
                    this.selectedRecords.add(cb.dataset.id);
                } else {
                    this.selectedRecords.delete(cb.dataset.id);
                }
            });
            this.updateBulkDeleteButton();
        });

        // Row checkboxes (event delegation)
        tableBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('cliente-checkbox')) {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    this.selectedRecords.add(id);
                } else {
                    this.selectedRecords.delete(id);
                }
                // Update select-all state
                const checkboxes = document.querySelectorAll('.cliente-checkbox');
                const selectAll = document.getElementById('select-all-clientes');
                selectAll.checked = this.selectedRecords.size >= checkboxes.length && checkboxes.length > 0;
                selectAll.indeterminate = this.selectedRecords.size > 0 && this.selectedRecords.size < checkboxes.length;
                this.updateBulkDeleteButton();
            }
        });

        // Action buttons (event delegation)
        tableBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit-cliente');
            if (editBtn && !editBtn.disabled) {
                const id = editBtn.dataset.id;
                if (id) this.showForm(id);
                return;
            }
            const deleteBtn = e.target.closest('.btn-delete-cliente');
            if (deleteBtn && !deleteBtn.disabled) {
                const id = deleteBtn.dataset.id;
                if (id) this.deleteRecord(id);
                return;
            }
        });

        // Load data
        await this.loadRecords();
    },

// Load records from Firestore with real-time sync
  // Returns a Promise that resolves when the first data arrives
  loadRecords() {
    // If already loading, return the existing promise
    if (this._loadPromise) {
      return this._loadPromise;
    }

    this._loadPromise = new Promise((resolve, reject) => {
      if (this.unsubscribe) {
        this.unsubscribe();
      }

      const db = firebase.firestore();
      this.unsubscribe = db.collection('clientes')
        .orderBy('nombre', 'asc')
        .onSnapshot(snapshot => {
          this.records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          this.applyFilters();

          if (this.loading) {
            this.loading = false;
          }

          // Resolve the promise so callers waiting for data can proceed
          if (this._loadPromise) {
            this._loadPromise = null;
          }
          resolve();
        }, error => {
          console.error('Error in clientes listener:', error);
          showToast('Error en sincronización: ' + error.message, 'error');
          if (this._loadPromise) {
            this._loadPromise = null;
          }
          reject(error);
        });
    });

    return this._loadPromise;
  },

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    },

    // Apply search and sort
    applyFilters() {
        let filtered = [...this.records];

        // Search filter
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                (r.nombre || '').toLowerCase().includes(q) ||
                (r.direccion || '').toLowerCase().includes(q) ||
                (r.telefono || '').toLowerCase().includes(q) ||
                (r.zona || '').toLowerCase().includes(q) ||
                (r.vendedor || '').toLowerCase().includes(q) ||
                (r.empresa || '').toLowerCase().includes(q)
            );
        }

        // Sort
        if (this.currentSort.field) {
            const { field, direction } = this.currentSort;
            filtered.sort((a, b) => {
                const valA = String(a[field] || '').toLowerCase();
                const valB = String(b[field] || '').toLowerCase();
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return direction === 'desc' ? -cmp : cmp;
            });
        }

        this.filteredRecords = filtered;
        if (this.isMobile) {
            this.renderMobileCards();
        } else {
            this.renderTable();
            this.updateStats();
        }
    },

    setSort(field) {
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort = { field, direction: 'asc' };
        }

        // Update sort indicators
        document.querySelectorAll('.sort-indicator').forEach(el => {
            el.textContent = '';
        });
        const indicator = document.querySelector(`.sort-indicator[data-field="${field}"]`);
        if (indicator) {
            indicator.textContent = this.currentSort.direction === 'asc' ? ' ▲' : ' ▼';
        }

        this.applyFilters();
    },

    // Render table
    renderTable() {
        const tableBody = document.getElementById('clientes-table-body');
        if (!tableBody) return;

        if (this.filteredRecords.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem;">No hay clientes registrados${this.searchQuery ? ' que coincidan con la búsqueda' : ''}.</td>
                </tr>
            `;
            return;
        }

        const canEdit = window.permissions?.canEdit;
        const canDelete = window.permissions?.canDelete;

        tableBody.innerHTML = this.filteredRecords.map(c => `
            <tr>
                <td style="text-align: center;">
                    <input type="checkbox" class="cliente-checkbox" data-id="${sanitizeHTML(c.id)}" ${this.selectedRecords.has(c.id) ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
                </td>
                <td><strong>${sanitizeHTML(c.nombre || '')}</strong></td>
                <td>${sanitizeHTML(c.direccion || '')}</td>
                <td>${c.telefono ? `<a href="https://wa.me/${String(c.telefono).replace(/\D/g, '')}" target="_blank" style="color: var(--primary-600); text-decoration: none;">${sanitizeHTML(c.telefono)}</a>` : ''}</td>
                <td>${sanitizeHTML(c.zona || '')}</td>
                <td>${sanitizeHTML(c.vendedor || '')}</td>
                <td><span class="badge ${c.empresa === 'DALSE' ? 'badge-primary' : 'badge-accent'}">${sanitizeHTML(c.empresa || '')}</span></td>
                <td>${sanitizeHTML(c.condicionPago || '')}</td>
                <td class="actions-cell">
                    <button class="btn-icon btn-secondary ${!canEdit ? 'btn-disabled' : ''} btn-edit-cliente" 
                            data-id="${sanitizeHTML(c.id)}"
                            ${!canEdit ? 'disabled' : ''} title="Editar">✏️</button>
                    <button class="btn-icon btn-danger ${!canDelete ? 'btn-disabled' : ''} btn-delete-cliente" 
                            data-id="${sanitizeHTML(c.id)}"
                            ${!canDelete ? 'disabled' : ''} title="Eliminar">🗑️</button>
                </td>
            </tr>
        `).join('');

        // Update select-all checkbox state
        const selectAll = document.getElementById('select-all-clientes');
        if (selectAll) {
            const checkboxes = document.querySelectorAll('.cliente-checkbox');
            selectAll.checked = checkboxes.length > 0 && this.selectedRecords.size >= checkboxes.length;
            selectAll.indeterminate = this.selectedRecords.size > 0 && this.selectedRecords.size < checkboxes.length;
        }
    },

    // Update stats
    updateStats() {
        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el('stat-total-clientes', this.filteredRecords.length);
        el('stat-con-telefono', this.filteredRecords.filter(c => c.telefono).length);
        el('stat-con-direccion', this.filteredRecords.filter(c => c.direccion).length);
    },

    // Show create/edit form
    showForm(recordId = null) {
        const record = recordId ? this.records.find(r => r.id === recordId) : null;

        if (recordId && !window.permissions?.canEdit) {
            showToast('No tienes permisos para editar', 'error');
            return;
        }
        if (!recordId && !window.permissions?.canCreate) {
            showToast('No tienes permisos para crear', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px;">
                <h2 style="margin-bottom: 1.5rem;">${record ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}</h2>
                
                <form id="cliente-form">
                    <div class="form-group">
                        <label>Nombre *</label>
                        <input type="text" id="cl-nombre" value="${sanitizeHTML(record?.nombre || '')}" required>
                    </div>

                    <div class="form-group" style="margin-top: 1rem;">
                        <label>📍 Dirección</label>
                        <input type="text" id="cl-direccion" value="${sanitizeHTML(record?.direccion || '')}">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group">
                            <label>📱 Teléfono</label>
                            <input type="text" id="cl-telefono" placeholder="Ej: 50370000000" value="${record?.telefono || ''}">
                        </div>
                        <div class="form-group">
                            <label>Zona</label>
                            <input type="text" id="cl-zona" value="${sanitizeHTML(record?.zona || '')}">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group">
                            <label>Vendedor</label>
                            <input type="text" id="cl-vendedor" value="${sanitizeHTML(record?.vendedor || '')}">
                        </div>
                        <div class="form-group">
                            <label>Empresa</label>
                            <select id="cl-empresa">
                                <option value="" ${!record?.empresa ? 'selected' : ''}>Seleccionar...</option>
                                <option value="DALSE" ${record?.empresa === 'DALSE' ? 'selected' : ''}>DALSE</option>
                                <option value="INCEDE" ${record?.empresa === 'INCEDE' ? 'selected' : ''}>INCEDE</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 1rem;">
                        <label>Condición de Pago</label>
                        <select id="cl-condicionPago">
                            <option value="" ${!record?.condicionPago ? 'selected' : ''}>Seleccionar...</option>
                            <option value="Contado" ${record?.condicionPago === 'Contado' ? 'selected' : ''}>Contado</option>
                            <option value="Crédito" ${record?.condicionPago === 'Crédito' ? 'selected' : ''}>Crédito</option>
                        </select>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group">
                            <label>Límite de Crédito ($)</label>
                            <input type="number" id="cl-limiteCredito" step="0.01" min="0" value="${record?.limiteCredito || ''}" placeholder="Ej: 5000">
                        </div>
                        <div class="form-group">
                            <label>Plazo de Pago (días)</label>
                            <select id="cl-plazoPago">
                                <option value="15" ${record?.plazoPago === 15 || record?.plazoPago === '15' ? 'selected' : ''}>15 días</option>
                                <option value="30" ${!record?.plazoPago || record?.plazoPago === 30 || record?.plazoPago === '30' ? 'selected' : ''}>30 días</option>
                                <option value="45" ${record?.plazoPago === 45 || record?.plazoPago === '45' ? 'selected' : ''}>45 días</option>
                                <option value="60" ${record?.plazoPago === 60 || record?.plazoPago === '60' ? 'selected' : ''}>60 días</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                        <button type="submit" class="btn btn-primary" id="btn-cl-save">💾 Guardar</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        document.getElementById('cliente-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('btn-cl-save');
            setButtonLoading(saveBtn, true);

            try {
                const nombre = document.getElementById('cl-nombre').value.trim();
                if (!nombre) {
                    showToast('El nombre es obligatorio', 'error');
                    setButtonLoading(saveBtn, false);
                    return;
                }

                const data = {
                    nombre,
                    nombreNorm: nombre.toLowerCase().trim(),
                    direccion: document.getElementById('cl-direccion').value.trim(),
                    telefono: document.getElementById('cl-telefono').value.trim(),
                    zona: document.getElementById('cl-zona').value.trim(),
                    vendedor: document.getElementById('cl-vendedor').value.trim(),
                    empresa: document.getElementById('cl-empresa').value,
                    condicionPago: document.getElementById('cl-condicionPago').value,
                    limiteCredito: parseFloat(document.getElementById('cl-limiteCredito').value) || 0,
                    plazoPago: parseInt(document.getElementById('cl-plazoPago').value) || 30,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                const db = firebase.firestore();
                if (recordId) {
                    await db.collection('clientes').doc(recordId).update(data);
                    showToast('✓ Cliente actualizado', 'success');
                } else {
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    data.createdBy = firebase.auth().currentUser.uid;
                    await db.collection('clientes').add(data);
                    showToast('✓ Cliente creado', 'success');
                }

                modal.remove();
            } catch (error) {
                console.error('Error saving client:', error);
                showToast('Error al guardar: ' + error.message, 'error');
            } finally {
                setButtonLoading(saveBtn, false);
            }
        });
    },

    // Delete a client
    async deleteRecord(recordId) {
        if (!window.permissions?.canDelete) {
            showToast('No tienes permisos para eliminar', 'error');
            return;
        }
        if (!await showConfirm('¿Eliminar este cliente?', 'Esta acción no se puede deshacer.')) return;

        try {
            await firebase.firestore().collection('clientes').doc(recordId).delete();
            this.records = this.records.filter(r => r.id !== recordId);
            this.selectedRecords.delete(recordId);
            this.applyFilters();
            this.updateBulkDeleteButton();
            showToast('✓ Cliente eliminado', 'success');
        } catch (error) {
            console.error('Error deleting client:', error);
            showToast('Error al eliminar: ' + error.message, 'error');
        }
    },

    // Update bulk delete button visibility
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
                <button class="btn btn-danger" id="btn-delete-selected-clientes" style="padding: 0.7rem 1.2rem; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); gap: 0.5rem; display: inline-flex; align-items: center;">
                    🗑️ Eliminar (${this.selectedRecords.size})
                </button>
            `;
            document.getElementById('btn-delete-selected-clientes').onclick = () => this.deleteSelectedRecords();
        } else {
            container.style.display = 'none';
        }
    },

    // Delete selected records
    async deleteSelectedRecords() {
        if (!window.permissions?.canDelete) {
            showToast('No tienes permisos para eliminar', 'error');
            return;
        }
        const count = this.selectedRecords.size;
        if (count === 0) return;
        if (!await showConfirm(`¿Eliminar ${count} cliente(s)?`, 'Esta acción no se puede deshacer.')) return;

        try {
            const batch = firebase.firestore().batch();
            for (const id of this.selectedRecords) {
                batch.delete(firebase.firestore().collection('clientes').doc(id));
            }
            await batch.commit();

            this.records = this.records.filter(r => !this.selectedRecords.has(r.id));
            this.selectedRecords.clear();
            this.applyFilters();
            this.updateBulkDeleteButton();

            showToast(`✓ ${count} cliente(s) eliminado(s)`, 'success');
        } catch (error) {
            console.error('Error bulk deleting clients:', error);
            showToast('Error al eliminar: ' + error.message, 'error');
        }
    },

    // Export to Excel
    exportToExcel() {
        if (this.filteredRecords.length === 0) {
            showToast('No hay datos para exportar', 'error');
            return;
        }

        const data = this.filteredRecords.map(c => ({
            'Nombre': c.nombre || '',
            'Dirección': c.direccion || '',
            'Teléfono': c.telefono || '',
            'Zona': c.zona || '',
            'Vendedor': c.vendedor || '',
            'Empresa': c.empresa || '',
            'Condición Pago': c.condicionPago || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
        XLSX.writeFile(wb, `Clientes_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('✓ Archivo exportado', 'success');
    },

    // Static method: save/update client from external modules (e.g., interlogic)
    async saveFromRecord(clientData) {
        if (!clientData.nombre || !clientData.nombre.trim()) return;

        const db = firebase.firestore();
        const nombreNorm = clientData.nombre.toLowerCase().trim();

        try {
            // Check if client already exists
            const existing = await db.collection('clientes')
                .where('nombreNorm', '==', nombreNorm)
                .limit(1)
                .get();

            if (!existing.empty) {
                // Update existing client — only overwrite fields that have a value
                const existingData = existing.docs[0].data();
                const updateData = {
                    nombre: clientData.nombre.trim(),
                    nombreNorm,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                // Only update fields if the new value is non-empty, or if existing was empty
                const fields = ['direccion', 'telefono', 'zona', 'vendedor', 'empresa', 'condicionPago'];
                fields.forEach(f => {
                    const newVal = clientData[f] || '';
                    if (newVal || !existingData[f]) {
                        updateData[f] = newVal;
                    }
                });
                await db.collection('clientes').doc(existing.docs[0].id).update(updateData);

                // Update local cache immediately
                const existingIndex = this.records.findIndex(r => r.id === existing.docs[0].id);
                if (existingIndex >= 0) {
                    this.records[existingIndex] = { ...this.records[existingIndex], ...updateData };
                }
            } else {
                // Create new client
                const data = {
                    nombre: clientData.nombre.trim(),
                    nombreNorm,
                    direccion: clientData.direccion || '',
                    telefono: clientData.telefono || '',
                    zona: clientData.zona || '',
                    vendedor: clientData.vendedor || '',
                    empresa: clientData.empresa || '',
                    condicionPago: clientData.condicionPago || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdBy: firebase.auth().currentUser?.uid || 'system'
                };
                const docRef = await db.collection('clientes').add(data);

                // Update local cache immediately
                this.records.push({ id: docRef.id, ...data });
            }
        } catch (error) {
            console.error('Error auto-saving client:', error);
            // Don't show toast to avoid noise — this is a background operation
        }
    },

    // Import clients from Excel
    showImportExcel() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h2 style="margin-bottom: 1.5rem;">📤 Importar Clientes desde Excel</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Selecciona un archivo Excel (.xlsx) con las columnas en este orden:</p>
                <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 0.85rem; overflow-x: auto;">
                    <code>Nombre | Dirección | Teléfono | Zona | Vendedor | Empresa | Condición Pago</code>
                </div>
                <div class="form-group">
                    <input type="file" id="cl-import-file" accept=".xlsx,.xls,.csv" style="padding: 1rem; border: 2px dashed var(--gray-300); border-radius: var(--radius-md); width: 100%; cursor: pointer;">
                </div>
                <div id="cl-import-preview" style="display: none; margin-top: 1rem; max-height: 300px; overflow-y: auto;"></div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="button" class="btn btn-secondary" id="cl-import-cancel">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="cl-import-confirm" disabled>Importar Clientes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let parsedData = [];

        document.getElementById('cl-import-file').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const workbook = XLSX.read(evt.target.result, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    parsedData = [];
                    // Skip header row if it looks like headers
                    const startRow = (rows.length > 0 && typeof rows[0][0] === 'string' && rows[0][0].toLowerCase().includes('nombre')) ? 1 : 0;

                    for (let i = startRow; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r || !r[0]) continue;
                        parsedData.push({
                            nombre: String(r[0] || '').trim(),
                            direccion: String(r[1] || '').trim(),
                            telefono: String(r[2] || '').trim(),
                            zona: String(r[3] || '').trim(),
                            vendedor: String(r[4] || '').trim(),
                            empresa: String(r[5] || '').trim(),
                            condicionPago: String(r[6] || '').trim()
                        });
                    }

                    const preview = document.getElementById('cl-import-preview');
                    if (parsedData.length > 0) {
                        preview.style.display = 'block';
                        preview.innerHTML = `
                            <p style="margin-bottom: 0.5rem;"><strong>${parsedData.length} clientes encontrados:</strong></p>
                            <table style="width: 100%; font-size: 0.8rem;">
                                <thead><tr><th>Nombre</th><th>Dirección</th><th>Teléfono</th><th>Zona</th></tr></thead>
                                <tbody>
                                    ${parsedData.slice(0, 10).map(d => `
                                        <tr>
                                            <td>${sanitizeHTML(d.nombre)}</td>
                                            <td>${sanitizeHTML(d.direccion)}</td>
                                            <td>${d.telefono}</td>
                                            <td>${sanitizeHTML(d.zona)}</td>
                                        </tr>
                                    `).join('')}
                                    ${parsedData.length > 10 ? '<tr><td colspan="4" style="text-align:center">... y ' + (parsedData.length - 10) + ' más</td></tr>' : ''}
                                </tbody>
                            </table>
                        `;
                        document.getElementById('cl-import-confirm').disabled = false;
                    } else {
                        preview.style.display = 'block';
                        preview.innerHTML = '<p style="color: var(--error);">No se encontraron clientes válidos en el archivo.</p>';
                    }
                } catch (err) {
                    console.error('Error parsing Excel:', err);
                    showToast('Error al leer el archivo: ' + err.message, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        };

        document.getElementById('cl-import-confirm').onclick = async () => {
            if (parsedData.length === 0) return;

            const confirmBtn = document.getElementById('cl-import-confirm');
            setButtonLoading(confirmBtn, true);

            try {
                const db = firebase.firestore();
                const uid = firebase.auth().currentUser.uid;
                let created = 0;
                let updated = 0;

                for (const client of parsedData) {
                    const nombreNorm = client.nombre.toLowerCase().trim();
                    if (!nombreNorm) continue;

                    const existing = await db.collection('clientes')
                        .where('nombreNorm', '==', nombreNorm)
                        .limit(1)
                        .get();

                    const data = {
                        nombre: client.nombre,
                        nombreNorm,
                        direccion: client.direccion,
                        telefono: client.telefono,
                        zona: client.zona,
                        vendedor: client.vendedor,
                        empresa: client.empresa,
                        condicionPago: client.condicionPago,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };

                    if (!existing.empty) {
                        await db.collection('clientes').doc(existing.docs[0].id).update(data);
                        updated++;
                    } else {
                        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                        data.createdBy = uid;
                        await db.collection('clientes').add(data);
                        created++;
                    }
                }

                showToast(`✓ ${created} creados, ${updated} actualizados`, 'success');
                modal.remove();
            } catch (error) {
                console.error('Import error:', error);
                showToast('Error al importar: ' + error.message, 'error');
                setButtonLoading(confirmBtn, false);
            }
        };

        document.getElementById('cl-import-cancel').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    },

    // Get all clients for autocomplete (cached from real-time listener)
    getAll() {
        return this.records || [];
    },

    // ============= MOBILE RENDER =============
    async renderMobile() {
        const content = document.getElementById('content-area');
        this.isMobile = true;

        content.innerHTML = `
            <div style="padding:0 0 8px 0;">
                <h1 style="font-size:1.35rem;font-weight:800;margin-bottom:2px;">👥 Clientes</h1>
                <p style="font-size:0.78rem;color:#8e8e93;">Directorio de clientes</p>
            </div>
            <div class="m-search-bar">
                <span class="search-icon-m">🔍</span>
                <input type="text" id="mc-search" placeholder="Buscar por nombre, dirección, teléfono..." value="${String(this.searchQuery || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="m-stats-row" id="mc-stats">
                <div class="m-stat-chip"><div class="m-stat-chip-label">Total</div><div class="m-stat-chip-value" id="mc-total">0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Con Teléfono</div><div class="m-stat-chip-value" id="mc-phone">0</div></div>
                <div class="m-stat-chip"><div class="m-stat-chip-label">Con Dirección</div><div class="m-stat-chip-value" id="mc-addr">0</div></div>
            </div>
            <div class="m-actions-bar">
                <button class="btn btn-primary" id="mc-btn-add" style="border-radius:20px;">➕ Nuevo</button>
                <button class="btn" id="mc-btn-export" style="border-radius:20px;">📥 Excel</button>
            </div>
            <div class="m-data-list" id="mc-data-list">
                <div style="text-align:center;padding:40px;color:#8e8e93;">Cargando...</div>
            </div>
        `;

        await this.loadRecords();

        document.getElementById('mc-search').addEventListener('input', e => {
            this.searchQuery = e.target.value;
            this.applyFilters();
        });
        document.getElementById('mc-btn-add').addEventListener('click', () => this.showMobileForm());
        document.getElementById('mc-btn-export').addEventListener('click', () => this.mobileExportExcel());

        const dataList = document.getElementById('mc-data-list');
        if (dataList && !this._mobileListListener) {
            dataList.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.btn-edit-m');
                const deleteBtn = e.target.closest('.btn-delete-m');
                const telLink = e.target.closest('.m-tel-link');
                const card = e.target.closest('.m-data-card');
                if (editBtn) {
                    e.stopPropagation();
                    const id = editBtn.dataset.id;
                    if (id) this.showMobileForm(id);
                    return;
                }
                if (deleteBtn) {
                    e.stopPropagation();
                    const id = deleteBtn.dataset.id;
                    if (id) this.deleteRecord(id);
                    return;
                }
                if (telLink) {
                    e.stopPropagation();
                    return;
                }
                if (card) {
                    const id = card.dataset.id;
                    if (id) this.showMobileDetail(id);
                }
            });
            this._mobileListListener = true;
        }
    },

    renderMobileCards() {
        var list = document.getElementById('mc-data-list');
        if (!list) return;

        if (this.filteredRecords.length === 0) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📭</div><div class="m-empty-title">Sin clientes</div><div class="m-empty-text">No hay registros.</div></div>';
        } else {
            list.innerHTML = this.filteredRecords.map(function(c) {
                return '<div class="m-data-card" data-id="' + sanitizeHTML(c.id) + '">' +
                    '<div class="m-card-header"><span class="m-card-title">' + sanitizeHTML(c.nombre || 'Sin nombre') + '</span>' +
                    '<span class="m-card-badge primary">' + sanitizeHTML(c.empresa || 'Cliente') + '</span></div>' +
                    '<div class="m-card-rows">' +
                    '<div class="m-card-row"><span class="m-card-label">Teléfono</span><span class="m-card-value">' + (c.telefono ? '<a href="tel:' + sanitizeHTML(c.telefono) + '" class="m-tel-link" style="color:#7c3aed;">' + sanitizeHTML(c.telefono) + '</a>' : '-') + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Dirección</span><span class="m-card-value">' + sanitizeHTML(c.direccion || '-') + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Zona</span><span class="m-card-value">' + sanitizeHTML(c.zona || '-') + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Vendedor</span><span class="m-card-value">' + sanitizeHTML(c.vendedor || '-') + '</span></div>' +
                    '</div>' +
                    (window.permissions?.canEdit ? '<div class="m-card-actions"><button class="m-card-action btn-edit-m" data-id="' + sanitizeHTML(c.id) + '">✏️</button>' + (window.permissions?.canDelete ? '<button class="m-card-action delete btn-delete-m" data-id="' + sanitizeHTML(c.id) + '">🗑️</button>' : '') + '</div>' : '') +
                    '</div>';
            }).join('');
        }

        var conPhone = 0, conAddr = 0;
        for (var ci = 0; ci < this.filteredRecords.length; ci++) {
            var cc = this.filteredRecords[ci];
            if (cc.telefono) conPhone++;
            if (cc.direccion) conAddr++;
        }
        var total = this.filteredRecords.length;
        var s = function(id,v) { var e=document.getElementById(id); if(e) e.textContent=v; };
        s('mc-total', total); s('mc-phone', conPhone); s('mc-addr', conAddr);
    },

    showMobileDetail(id) {
        var c = this.filteredRecords.find(function(x){return x.id===id;}) || this.records.find(function(x){return x.id===id;});
        if (!c) return;
        var sheet = document.createElement('div');
        sheet.innerHTML = `<div class="m-sheet-backdrop show"></div><div class="m-bottom-sheet show"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">${sanitizeHTML(c.nombre || 'Cliente')}</span><button class="m-sheet-close">✕</button></div><div class="m-sheet-body"><div style="display:flex;flex-direction:column;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Empresa</span><div style="font-weight:500;">${sanitizeHTML(c.empresa || '-')}</div></div>` + (c.telefono ? `<div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Teléfono</span><div style="font-weight:500;"><a href="tel:${sanitizeHTML(c.telefono)}" style="color:#7c3aed;text-decoration:none;">${sanitizeHTML(c.telefono)}</a></div></div>` : '') + `<div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Dirección</span><div style="font-weight:500;">${sanitizeHTML(c.direccion || '-')}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Zona</span><div style="font-weight:500;">${sanitizeHTML(c.zona || '-')}</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Vendedor</span><div style="font-weight:500;">${sanitizeHTML(c.vendedor || '-')}</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Cond. Pago</span><div style="font-weight:500;">${sanitizeHTML(c.condicionPago || '-')}</div></div></div></div></div>` + (window.permissions?.canEdit ? `<div class="m-sheet-footer"><button class="m-card-action btn-edit-m" data-id="${sanitizeHTML(c.id)}">✏️ Editar</button>` + (window.permissions?.canDelete ? `<button class="m-card-action delete btn-delete-m" data-id="${sanitizeHTML(c.id)}">🗑️ Eliminar</button>` : '') + `</div>` : '') + `</div>`;
        var backdrop = sheet.querySelector('.m-sheet-backdrop');
        var bottomSheet = sheet.querySelector('.m-bottom-sheet');
        var closeBtn = sheet.querySelector('.m-sheet-close');
        if (closeBtn) closeBtn.addEventListener('click', function() { sheet.remove(); });
        if (backdrop) backdrop.addEventListener('click', function() { sheet.remove(); });
        var editBtn = sheet.querySelector('.btn-edit-m');
        var deleteBtn = sheet.querySelector('.btn-delete-m');
        if (editBtn) editBtn.addEventListener('click', function() { sheet.remove(); Clientes.showMobileForm(editBtn.dataset.id); });
        if (deleteBtn) deleteBtn.addEventListener('click', function() { sheet.remove(); Clientes.deleteRecord(deleteBtn.dataset.id); });
        document.body.appendChild(sheet);
    },

    showMobileForm(id) {
        var c = id ? (this.filteredRecords.find(function(x){return x.id===id;}) || this.records.find(function(x){return x.id===id;})) : null;
        var isEdit = !!c;
        var esc = function(v) { return String(v == null ? '' : v).replace(/"/g, '&quot;'); };
        var sheet = document.createElement('div');
        sheet.innerHTML = '<div class="m-sheet-backdrop show" id="mcf-backdrop"></div><div class="m-bottom-sheet show" id="mcf-sheet"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">' + (isEdit ? 'Editar Cliente' : 'Nuevo Cliente') + '</span><button class="m-sheet-close">✕</button></div><div class="m-sheet-body"><div class="m-form-group"><label>Nombre</label><input type="text" id="mcf-nombre" value="' + esc(c?.nombre) + '"></div><div class="m-form-row"><div class="m-form-group"><label>Teléfono</label><input type="tel" id="mcf-telefono" value="' + esc(c?.telefono) + '"></div><div class="m-form-group"><label>Empresa</label><input type="text" id="mcf-empresa" value="' + esc(c?.empresa) + '"></div></div><div class="m-form-group"><label>Dirección</label><input type="text" id="mcf-direccion" value="' + esc(c?.direccion) + '"></div><div class="m-form-row"><div class="m-form-group"><label>Zona</label><input type="text" id="mcf-zona" value="' + esc(c?.zona) + '"></div><div class="m-form-group"><label>Vendedor</label><input type="text" id="mcf-vendedor" value="' + esc(c?.vendedor) + '"></div></div><div class="m-form-group"><label>Condición de Pago</label><select id="mcf-condicion"><option value="">-</option><option value="Contado"' + (c?.condicionPago==='Contado'?' selected':'') + '>Contado</option><option value="Crédito"' + (c?.condicionPago==='Crédito'?' selected':'') + '>Crédito</option></select></div><div class="m-form-row"><div class="m-form-group"><label>Límite Crédito ($)</label><input type="number" id="mcf-limite" step="0.01" value="' + esc(c?.limiteCredito) + '"></div><div class="m-form-group"><label>Plazo (días)</label><select id="mcf-plazo"><option value="15"' + (c?.plazoPago==15||c?.plazoPago=='15'?' selected':'') + '>15</option><option value="30"' + (!c?.plazoPago||c?.plazoPago==30||c?.plazoPago=='30'?' selected':'') + '>30</option><option value="45"' + (c?.plazoPago==45||c?.plazoPago=='45'?' selected':'') + '>45</option><option value="60"' + (c?.plazoPago==60||c?.plazoPago=='60'?' selected':'') + '>60</option></select></div></div></div><div class="m-sheet-footer"><button class="btn" id="mcf-cancel">Cancelar</button><button class="btn btn-primary" id="mcf-submit">' + (isEdit ? 'Guardar' : 'Crear') + '</button></div></div>';
        document.body.appendChild(sheet);

        var removeSheet = function() {
            var s = document.getElementById('mcf-sheet');
            var b = document.getElementById('mcf-backdrop');
            if (s) s.remove();
            if (b) b.remove();
        };
        var closeBtn = document.querySelector('#mcf-sheet .m-sheet-close');
        var cancelBtn = document.getElementById('mcf-cancel');
        if (closeBtn) closeBtn.addEventListener('click', removeSheet);
        if (cancelBtn) cancelBtn.addEventListener('click', removeSheet);

        document.getElementById('mcf-submit').addEventListener('click', async function() {
            var btn = document.getElementById('mcf-submit'); btn.disabled = true; btn.textContent = 'Guardando...';
            try {
                var nombre = document.getElementById('mcf-nombre').value.trim();
                if (!nombre) { showToast('El nombre es obligatorio', 'error'); btn.disabled = false; btn.textContent = isEdit ? 'Guardar' : 'Crear'; return; }
                var data = { nombre: nombre, telefono: document.getElementById('mcf-telefono').value.trim(), empresa: document.getElementById('mcf-empresa').value.trim(), direccion: document.getElementById('mcf-direccion').value.trim(), zona: document.getElementById('mcf-zona').value.trim(), vendedor: document.getElementById('mcf-vendedor').value.trim(), condicionPago: document.getElementById('mcf-condicion').value, limiteCredito: parseFloat(document.getElementById('mcf-limite').value)||0, plazoPago: parseInt(document.getElementById('mcf-plazo').value)||30, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
                var db = firebase.firestore();
                if (isEdit) { await db.collection('clientes').doc(id).update(data); }
                else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('clientes').add(data); }
                showToast(isEdit ? 'Actualizado' : 'Creado', 'success');
                removeSheet();
            } catch(err) { showToast('Error: '+err.message,'error'); btn.disabled=false; btn.textContent=isEdit?'Guardar':'Crear'; }
        });
    },

    mobileExportExcel() {
        if (typeof XLSX === 'undefined') { showToast('Excel no disponible','error'); return; }
        if (!this.filteredRecords.length) { showToast('No hay datos','warning'); return; }
        var data = this.filteredRecords.map(function(c){return {Nombre:c.nombre||'',Teléfono:c.telefono||'',Empresa:c.empresa||'',Dirección:c.direccion||'',Zona:c.zona||'',Vendedor:c.vendedor||'',CondPago:c.condicionPago||''};});
        var ws = XLSX.utils.json_to_sheet(data);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
        XLSX.writeFile(wb, 'Clientes_'+new Date().toISOString().split('T')[0]+'.xlsx');
        showToast('Excel exportado');
    }
};

// Make available globally
window.Clientes = Clientes;
