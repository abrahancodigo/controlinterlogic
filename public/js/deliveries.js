// ===================================
// Deliveries Module
// ===================================

const Deliveries = {
    deliveries: [],
    userIsAdmin: false,

    // Render deliveries view
    async render() {
        if (window.innerWidth <= 768) {
            return this.renderMobile();
        }
        return this.renderDesktop();
    },

    async renderDesktop() {
        const contentArea = document.getElementById('content-area');

        // Check permissions
        const canCreate = window.permissions?.canCreate;
        const canEdit = window.permissions?.canEdit;
        const canDelete = window.permissions?.canDelete;

        this.userIsAdmin = window.permissions?.isAdmin;

        // Build form HTML for canCreate
        const formHTML = canCreate ? `
            <div class="card" id="new-delivery-form-card">
                <div class="card-header">
                    <h2>Nueva Entrega</h2>
                </div>
                <div class="card-body">
                    <form id="delivery-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="delivery-folio">Folio (auto-generado, editable)</label>
                                <input type="text" id="delivery-folio" placeholder="Se asignará automáticamente..." readonly style="background: #f3f4f6;">
                            </div>
                            <div class="form-group">
                                <label for="delivery-fecha">Fecha de Entrega *</label>
                                <input type="date" id="delivery-fecha" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="delivery-cliente">Cliente *</label>
                                <input type="text" id="delivery-cliente" required placeholder="Nombre del cliente">
                            </div>
                            <div class="form-group">
                                <label for="delivery-tienda">Nombre de la Tienda *</label>
                                <input type="text" id="delivery-tienda" required placeholder="Nombre de la tienda">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="delivery-tipo-mueble">Tipo de Mueble *</label>
                                <input type="text" id="delivery-tipo-mueble" required placeholder="Ej: Sofá, Mesa, Silla">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="delivery-accesorios">Accesorios *</label>
                            <textarea id="delivery-accesorios" required placeholder="Lista de accesorios incluidos (uno por línea)"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="delivery-image">Imagen (opcional)</label>
                            <input type="file" id="delivery-image" accept="image/*" style="padding: 0.5rem;">
                            <small style="color: #6b7280; display: block; margin-top: 0.25rem;">Formatos: JPG, PNG, WebP. Máximo 5MB.</small>
                        </div>
                        
                        <div style="display: flex; gap: 1rem; margin-top: 2rem; flex-wrap: wrap;">
                            <button type="submit" class="btn btn-primary">
                                💾 Registrar Entrega
                            </button>
                            <button type="button" id="btn-registrar-imprimir" class="btn btn-accent">
                                🖨️ Registrar e Imprimir
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="Deliveries.resetForm()">
                                🔄 Limpiar Formulario
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        ` : `
            <div class="card" style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); border: 2px dashed #6366f1;">
                <div class="card-body" style="text-align: center; padding: 1.5rem;">
                    <span style="font-size: 2rem;">👁️</span>
                    <h3 style="margin: 0.5rem 0; color: #4338ca;">Modo Solo Visualización</h3>
                    <p style="color: #6366f1; margin: 0;">Puedes ver e imprimir entregas, pero no crear, editar o eliminar.</p>
                </div>
            </div>
        `;

        contentArea.innerHTML = `
            <div class="content-header">
                <h1>📋 Entrega de Muebles</h1>
                <p>Registra y gestiona las entregas de muebles</p>
            </div>
            
            ${formHTML}
            
            <div class="card">
                <div class="card-header">
                    <h2>Entregas Registradas</h2>
                </div>
                <div class="card-body">
                    <div id="deliveries-list-container">
                        <div style="text-align: center; padding: 2rem;">
                            <div class="loading-spinner" style="margin: 0 auto;"></div>
                            <p>Cargando entregas...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Only setup form handlers if user has create permissions
        if (canCreate) {
            // Set default date to today
            const fechaEl = document.getElementById('delivery-fecha');
            if (fechaEl) {
                fechaEl.value = formatDateForInput(new Date());
            }

            // Pre-generate folio
            await this.generateNextFolio();

            // Setup form handler
            const form = document.getElementById('delivery-form');
            if (form) {
                form.addEventListener('submit', (e) => this.handleSubmit(e));
            }

            // Setup register and print button
            const regPrintBtn = document.getElementById('btn-registrar-imprimir');
            if (regPrintBtn) {
                regPrintBtn.addEventListener('click', (e) => this.handleSubmit(e, true));
            }
        }

        // Load deliveries (for all users)
        await this.loadDeliveries();
    },

    // Generate next folio preview
    async generateNextFolio() {
        const folioEl = document.getElementById('delivery-folio');
        if (!folioEl) return;

        try {
            const db = firebase.firestore();
            const currentYear = new Date().getFullYear();
            const counterRef = db.collection('config').doc('counters');
            const counterDoc = await counterRef.get();

            let counters = counterDoc.exists ? counterDoc.data() : {};
            let yearKey = `deliveries_${currentYear}`;
            let nextNumber = (counters[yearKey] || 0) + 1;

            // Format: YYYYNNN
            const suggestedFolio = `${currentYear}${String(nextNumber).padStart(3, '0')}`;

            folioEl.value = suggestedFolio;
            folioEl.removeAttribute('readonly');
            folioEl.style.background = '';
        } catch (error) {
            console.error('Error generating folio:', error);
            folioEl.placeholder = 'Error al generar folio';
        }
    },

    // Handle form submission
    async handleSubmit(e, shouldPrint = false) {
        if (e && e.preventDefault) e.preventDefault();

        // Check permissions
        if (!window.permissions?.canCreate) {
            showToast('No tienes permisos para realizar esta acción', 'error');
            return;
        }

        // Get the triggering button or the submit button
        const submitBtn = document.querySelector('#delivery-form button[type="submit"]');
        const regPrintBtn = document.getElementById('btn-registrar-imprimir');

        setButtonLoading(submitBtn, true);
        if (regPrintBtn) regPrintBtn.disabled = true;

        try {
            const user = firebase.auth().currentUser;
            const db = firebase.firestore();

            // Get folio from input (user may have edited it)
            const folioInput = document.getElementById('delivery-folio').value.trim();
            let folio = folioInput;

            // If no folio provided, generate one
            if (!folio) {
                const currentYear = new Date().getFullYear();
                const counterRef = db.collection('config').doc('counters');

                await db.runTransaction(async (transaction) => {
                    const counterDoc = await transaction.get(counterRef);
                    let counters = counterDoc.exists ? counterDoc.data() : {};
                    let yearKey = `deliveries_${currentYear}`;
                    let nextNumber = (counters[yearKey] || 0) + 1;

                    folio = `${currentYear}${String(nextNumber).padStart(3, '0')}`;
                    transaction.set(counterRef, { [yearKey]: nextNumber }, { merge: true });
                });
            } else {
                // User provided custom folio - still update counter if it's a standard format
                const folioMatch = folio.match(/^(\d{4})(\d{3,})$/);
                if (folioMatch) {
                    const year = parseInt(folioMatch[1]);
                    const number = parseInt(folioMatch[2]);
                    const counterRef = db.collection('config').doc('counters');
                    const counterDoc = await counterRef.get();
                    let counters = counterDoc.exists ? counterDoc.data() : {};
                    let yearKey = `deliveries_${year}`;
                    let currentCounter = counters[yearKey] || 0;

                    // Only update counter if the new number is higher
                    if (number > currentCounter) {
                        await counterRef.set({ [yearKey]: number }, { merge: true });
                    }
                }
            }

            // Parse date correctly to avoid timezone issues
            // The input gives us "YYYY-MM-DD", we need to treat this as local date
            const dateInput = document.getElementById('delivery-fecha').value;
            const [year, month, day] = dateInput.split('-').map(Number);
            // Create date at noon local time to avoid any timezone day-shift issues
            const localDate = new Date(year, month - 1, day, 12, 0, 0);

            // Get form data
            const deliveryData = {
                folio: folio,
                fecha: firebase.firestore.Timestamp.fromDate(localDate),
                cliente: document.getElementById('delivery-cliente').value.trim(),
                tienda: document.getElementById('delivery-tienda').value.trim(),
                tipoMueble: document.getElementById('delivery-tipo-mueble').value.trim(),
                accesorios: document.getElementById('delivery-accesorios').value.trim(),
                createdBy: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Handle image upload if present
            const imageInput = document.getElementById('delivery-image');
            if (imageInput && imageInput.files && imageInput.files[0]) {
                const file = imageInput.files[0];

                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showToast('La imagen es demasiado grande. Máximo 5MB.', 'error');
                    setButtonLoading(submitBtn, false);
                    return;
                }

                // Upload to Firebase Storage
                const storage = firebase.storage();
                const fileExt = file.name.split('.').pop();
                const fileName = `deliveries/${folio}_${Date.now()}.${fileExt}`;
                const storageRef = storage.ref(fileName);

                try {
                    const snapshot = await storageRef.put(file);
                    const downloadURL = await snapshot.ref.getDownloadURL();
                    deliveryData.imageUrl = downloadURL;
                    deliveryData.imagePath = fileName;
                } catch (uploadError) {
                    console.error('Error uploading image:', uploadError);
                    showToast('Error al subir imagen, pero la entrega se guardará sin imagen', 'warning');
                }
            }

            // Save to Firestore
            const docRef = await db.collection('deliveries').add(deliveryData);

            showToast(`✓ Entrega ${folio} registrada exitosamente`, 'success');

            // Optionally print
            if (shouldPrint) {
                const createdDelivery = {
                    id: docRef.id,
                    ...deliveryData,
                };

                // Add to internal list so printDelivery can find it
                this.deliveries.unshift(createdDelivery);
                this.printDelivery(docRef.id);
            }

            // Reset form
            this.resetForm();

            // Reload deliveries
            await this.loadDeliveries();

        } catch (error) {
            console.error('Error saving delivery:', error);
            showToast('Error al guardar la entrega', 'error');
        } finally {
            setButtonLoading(submitBtn, false);
            if (regPrintBtn) regPrintBtn.disabled = false;
        }
    },

    // Reset form
    resetForm() {
        const form = document.getElementById('delivery-form');
        if (form) {
            form.reset();
        }
        const fechaEl = document.getElementById('delivery-fecha');
        if (fechaEl) {
            fechaEl.value = formatDateForInput(new Date());
        }
        // Regenerate folio for next entry
        this.generateNextFolio();
    },

    // Load deliveries from Firestore
    async loadDeliveries() {
        try {
            // All authenticated users can see all deliveries
            const snapshot = await firebase.firestore()
                .collection('deliveries')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();

            this.deliveries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (this.isMobile) {
                this.renderMobileCards();
            } else {
                this.renderDeliveriesList();
            }
        } catch (error) {
            console.error('Error loading deliveries:', error);
            showToast('Error al cargar entregas', 'error');

            const container = document.getElementById('deliveries-list-container');
            if (container) {
                container.innerHTML = `
                    <p style="text-align: center; color: var(--error); padding: 2rem;">
                        Error al cargar entregas. Intenta de nuevo.
                    </p>
                `;
            }
        }
    },

    // Render deliveries list
    renderDeliveriesList() {
        const container = document.getElementById('deliveries-list-container');
        if (!container) return;

        // Get permissions again for rendering buttons
        const canEdit = window.permissions?.canEdit;
        const canDelete = window.permissions?.canDelete;

        if (this.deliveries.length === 0) {
            container.innerHTML = `
                <p style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    No hay entregas registradas
                </p>
            `;
            return;
        }

        const tableHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Folio</th>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th>Tienda</th>
                            <th>Tipo de Mueble</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.deliveries.map(delivery => `
                            <tr>
                                <td data-label="Folio"><strong>${delivery.folio || delivery.id.substring(0, 8).toUpperCase()}</strong></td>
                                <td data-label="Fecha">${delivery.fecha ? formatDate(delivery.fecha) : 'N/A'}</td>
                                <td data-label="Cliente">${sanitizeHTML(delivery.cliente)}</td>
                                <td data-label="Tienda">${sanitizeHTML(delivery.tienda)}</td>
                                <td data-label="Mueble">${sanitizeHTML(delivery.tipoMueble)}</td>
                                <td class="actions-cell">
                                    <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                                        <button 
                                            class="btn btn-sm btn-secondary" 
                                            onclick="Deliveries.viewDelivery('${delivery.id}')"
                                            title="Ver detalles"
                                            style="min-width: 32px; padding: 0.25rem 0.5rem;"
                                        >👁️</button>
                                        <button 
                                            class="btn btn-sm btn-accent ${!canEdit ? 'btn-disabled' : ''}" 
                                            onclick="${canEdit ? `Deliveries.editDelivery('${delivery.id}')` : ''}"
                                            ${!canEdit ? 'disabled' : ''}
                                            title="Editar"
                                            style="min-width: 32px; padding: 0.25rem 0.5rem;"
                                        >✏️</button>
                                        <button 
                                            class="btn btn-sm btn-primary" 
                                            onclick="Deliveries.printDelivery('${delivery.id}')"
                                            title="Imprimir"
                                            style="min-width: 32px; padding: 0.25rem 0.5rem;"
                                        >🖨️</button>
                                        ${delivery.imageUrl ? `
                                        <button 
                                            class="btn btn-sm btn-info" 
                                            onclick="Deliveries.viewImage('${delivery.id}')"
                                            title="Ver imagen"
                                            style="min-width: 32px; padding: 0.25rem 0.5rem; background: #3b82f6;"
                                        >🖼️</button>
                                        ` : ''}
                                        <button 
                                            class="btn btn-sm btn-danger ${!canDelete ? 'btn-disabled' : ''}" 
                                            onclick="${canDelete ? `Deliveries.deleteDelivery('${delivery.id}')` : ''}"
                                            ${!canDelete ? 'disabled' : ''}
                                            title="Eliminar"
                                            style="min-width: 32px; padding: 0.25rem 0.5rem;"
                                        >🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHTML;
    },

    // View delivery image
    viewImage(deliveryId) {
        const delivery = this.deliveries.find(d => d.id === deliveryId);
        if (!delivery || !delivery.imageUrl) return;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 1rem;
        `;

        modal.innerHTML = `
            <button onclick="this.parentElement.remove()" style="
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: white;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                font-size: 1.5rem;
                cursor: pointer;
                z-index: 10;
            ">✕</button>
            <div style="max-width: 90vw; max-height: 90vh; text-align: center;">
                <img src="${delivery.imageUrl}" style="max-width: 100%; max-height: 85vh; border-radius: 0.5rem;" alt="Imagen de entrega ${delivery.folio}">
                <p style="color: white; margin-top: 1rem; font-size: 1.1rem;">
                    📦 Entrega: <strong>${delivery.folio || delivery.id.substring(0, 8).toUpperCase()}</strong>
                </p>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    // View delivery details
    viewDelivery(deliveryId) {
        const delivery = this.deliveries.find(d => d.id === deliveryId);
        if (!delivery) return;

        // Get permissions again for rendering buttons
        const canEdit = window.permissions?.canEdit;
        const canDelete = window.permissions?.canDelete;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 1rem;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 1rem; padding: 2rem; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin-bottom: 1.5rem;">Detalle de Entrega</h2>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <strong>Fecha:</strong><br>
                        ${delivery.fecha ? formatDate(delivery.fecha) : 'N/A'}
                    </div>
                    <div>
                        <strong>Cliente:</strong><br>
                        ${sanitizeHTML(delivery.cliente)}
                    </div>
                    <div>
                        <strong>Tienda:</strong><br>
                        ${sanitizeHTML(delivery.tienda)}
                    </div>
                    <div>
                        <strong>Tipo de Mueble:</strong><br>
                        ${sanitizeHTML(delivery.tipoMueble)}
                    </div>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <strong>Accesorios:</strong><br>
                    <pre style="white-space: pre-wrap; font-family: var(--font-family); margin-top: 0.5rem;">${sanitizeHTML(delivery.accesorios)}</pre>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="Deliveries.printDelivery('${deliveryId}')">
                        🖨️ Imprimir
                    </button>
                    <button class="btn btn-accent ${!canEdit ? 'btn-disabled' : ''}" 
                            onclick="${canEdit ? `this.closest('[style*=fixed]').remove(); Deliveries.editDelivery('${deliveryId}')` : ''}"
                            ${!canEdit ? 'disabled' : ''}>
                        ✏️ Editar
                    </button>
                    <button class="btn btn-danger ${!canDelete ? 'btn-disabled' : ''}" 
                            onclick="${canDelete ? `Deliveries.deleteDelivery('${deliveryId}')` : ''}"
                            ${!canDelete ? 'disabled' : ''}>
                        🗑️ Eliminar
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('[style*=fixed]').remove()">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    // Edit delivery
    editDelivery(deliveryId) {
        // Check permissions
        if (!window.permissions?.canEdit) {
            showToast('No tienes permisos para editar entregas', 'error');
            return;
        }

        const delivery = this.deliveries.find(d => d.id === deliveryId);
        if (!delivery) return;

        // Format date for input
        let dateValue = '';
        if (delivery.fecha) {
            const date = delivery.fecha.toDate ? delivery.fecha.toDate() : new Date(delivery.fecha);
            dateValue = formatDateForInput(date);
        }

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 1rem;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 1rem; padding: 2rem; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin-bottom: 1.5rem;">✏️ Editar Entrega</h2>
                
                <form id="edit-delivery-form">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label for="edit-folio"><strong>Folio</strong></label>
                        <input type="text" id="edit-folio" value="${sanitizeHTML(delivery.folio || delivery.id.substring(0, 8).toUpperCase())}" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 0.5rem;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label for="edit-fecha"><strong>Fecha *</strong></label>
                        <input type="date" id="edit-fecha" value="${dateValue}" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 0.5rem;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label for="edit-cliente"><strong>Cliente *</strong></label>
                        <input type="text" id="edit-cliente" value="${sanitizeHTML(delivery.cliente)}" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 0.5rem;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label for="edit-tienda"><strong>Tienda *</strong></label>
                        <input type="text" id="edit-tienda" value="${sanitizeHTML(delivery.tienda)}" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 0.5rem;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label for="edit-tipo-mueble"><strong>Tipo de Mueble *</strong></label>
                        <input type="text" id="edit-tipo-mueble" value="${sanitizeHTML(delivery.tipoMueble)}" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 0.5rem;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1.5rem;">
                        <label for="edit-accesorios"><strong>Accesorios *</strong></label>
                        <textarea id="edit-accesorios" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 0.5rem; min-height: 100px;">${sanitizeHTML(delivery.accesorios)}</textarea>
                    </div>

                    <div class="form-group" style="margin-bottom: 1.5rem; border-top: 1px solid #eee; padding-top: 1rem;">
                        <label><strong>Imagen</strong></label>
                        <div id="image-preview-container" style="${delivery.imageUrl ? '' : 'display: none;'} margin-bottom: 0.5rem; text-align: center;">
                            <img id="current-image-preview" src="${delivery.imageUrl || ''}" style="max-height: 100px; border-radius: 0.25rem;">
                            <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                                <span style="font-size: 0.8rem; color: #666;">Imagen actual</span>
                                <button type="button" id="btn-delete-image" class="btn btn-sm btn-danger" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">
                                    🗑️ Eliminar
                                </button>
                            </div>
                        </div>
                        <input type="hidden" id="delete-image-flag" value="false">
                        <input type="file" id="edit-image" accept="image/*" style="width: 100%; padding: 0.5rem;">
                        <small style="color: #6b7280; display: block; margin-top: 0.25rem;">Subir nueva imagen para reemplazar la actual (Max 5MB)</small>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('[style*=fixed]').remove()">
                            Cancelar
                        </button>
                        <button type="submit" class="btn btn-primary" id="btn-save-edit">
                            💾 Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Delete image button handler
        const btnDeleteImage = document.getElementById('btn-delete-image');
        if (btnDeleteImage) {
            btnDeleteImage.onclick = () => {
                document.getElementById('image-preview-container').style.display = 'none';
                document.getElementById('delete-image-flag').value = 'true';
                document.getElementById('edit-image').value = ''; // Reset file input
            };
        }

        // Image file input change handler to reset delete flag if new image selected
        document.getElementById('edit-image').onchange = () => {
            document.getElementById('delete-image-flag').value = 'false';
        };

        // Handle form submission
        const form = document.getElementById('edit-delivery-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const saveBtn = document.getElementById('btn-save-edit');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando...';

            try {
                // Parse date correctly to avoid timezone issues
                const dateInput = document.getElementById('edit-fecha').value;
                const [year, month, day] = dateInput.split('-').map(Number);
                const localDate = new Date(year, month - 1, day, 12, 0, 0);

                const updatedData = {
                    folio: document.getElementById('edit-folio').value.trim(),
                    fecha: firebase.firestore.Timestamp.fromDate(localDate),
                    cliente: document.getElementById('edit-cliente').value.trim(),
                    tienda: document.getElementById('edit-tienda').value.trim(),
                    tipoMueble: document.getElementById('edit-tipo-mueble').value.trim(),
                    accesorios: document.getElementById('edit-accesorios').value.trim(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                const deleteImageFlag = document.getElementById('delete-image-flag').value === 'true';

                // Handle image upload if present
                const imageInput = document.getElementById('edit-image');
                if (imageInput && imageInput.files && imageInput.files[0]) {
                    const file = imageInput.files[0];

                    // Validate file size (max 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        showToast('La imagen es demasiado grande. Máximo 5MB.', 'error');
                        saveBtn.disabled = false;
                        saveBtn.textContent = '💾 Guardar Cambios';
                        return;
                    }

                    // Upload to Firebase Storage
                    const storage = firebase.storage();
                    const fileExt = file.name.split('.').pop();
                    const fileName = `deliveries/${updatedData.folio}_${Date.now()}.${fileExt}`;
                    const storageRef = storage.ref(fileName);

                    const snapshot = await storageRef.put(file);
                    const downloadURL = await snapshot.ref.getDownloadURL();

                    updatedData.imageUrl = downloadURL;
                    updatedData.imagePath = fileName;
                } else if (deleteImageFlag) {
                    // Update to remove image fields if flagged for deletion
                    updatedData.imageUrl = firebase.firestore.FieldValue.delete();
                    updatedData.imagePath = firebase.firestore.FieldValue.delete();

                    // Try to delete from storage if path exists (optional, best effort)
                    if (delivery.imagePath) {
                        try {
                            await firebase.storage().ref(delivery.imagePath).delete();
                        } catch (err) {
                            console.log('Error removing old image from storage:', err);
                        }
                    }
                }

                await firebase.firestore().collection('deliveries').doc(deliveryId).update(updatedData);

                showToast('✓ Entrega actualizada exitosamente', 'success');
                modal.remove();

                // Reload deliveries
                await this.loadDeliveries();
            } catch (error) {
                console.error('Error updating delivery:', error);
                showToast('Error al actualizar: ' + error.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Guardar Cambios';
            }
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    // Delete delivery
    async deleteDelivery(deliveryId) {
        // Check permissions
        if (!window.permissions?.canDelete) {
            showToast('No tienes permisos para eliminar entregas', 'error');
            return;
        }

        if (!await showConfirm('¿Eliminar entrega?', 'Esta acción no se puede deshacer. El registro se borrará permanentemente.')) return;

        // Proceed with deletion
        try {
            await firebase.firestore().collection('deliveries').doc(deliveryId).delete();
            showToast('Registro eliminado exitosamente', 'success');

            // Reload list
            await this.loadDeliveries();
        } catch (error) {
            console.error('Error deleting delivery:', error);
            showToast('Error al eliminar entrega', 'error');
        }
    },

    // Print delivery
    async printDelivery(deliveryId) {
        const delivery = this.deliveries.find(d => d.id === deliveryId);
        if (!delivery) return;

        const printArea = document.getElementById('print-area');
        if (!printArea) {
            console.error('Print area not found');
            return;
        }

        // Always reload settings to ensure fresh logos
        if (window.Settings && window.Settings.loadSettings) {
            await window.Settings.loadSettings();
        }

        // Get company settings
        const settings = window.Settings?.settings || {};
        const companyName = settings.companyName || 'DALSE';
        // Use logo2 for print, fallback to logo1 if logo2 not set
        const printLogo = settings.logo2 || settings.logo1 || '';

        // Build logo HTML with onload handling
        let logoHTML = '';
        if (printLogo) {
            logoHTML = `<img id="print-logo-img" src="${printLogo}" alt="Logo" style="max-height: 60px; max-width: 150px; object-fit: contain;">`;
        }

        printArea.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #000;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        ${logoHTML}
                        <div>
                            <h1 style="font-size: 1.8rem; margin: 0; color: #000;">${sanitizeHTML(companyName)}</h1>
                            <p style="margin: 5px 0 0 0; color: #555;">Registro de Entrega de Muebles</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-weight: bold; font-size: 1.2rem;">Folio: ${delivery.folio || delivery.id.substring(0, 8).toUpperCase()}</p>
                        <p style="margin: 5px 0 0 0;">Fecha: ${delivery.fecha ? formatDate(delivery.fecha) : 'N/A'}</p>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                    <div style="padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
                        <strong style="display: block; margin-bottom: 5px; color: #666; font-size: 0.85rem; text-transform: uppercase;">Cliente</strong>
                        <span style="font-size: 1rem; font-weight: bold;">${sanitizeHTML(delivery.cliente)}</span>
                    </div>
                    <div style="padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
                        <strong style="display: block; margin-bottom: 5px; color: #666; font-size: 0.85rem; text-transform: uppercase;">Tienda</strong>
                        <span style="font-size: 1rem; font-weight: bold;">${sanitizeHTML(delivery.tienda)}</span>
                    </div>
                    <div style="padding: 12px; border: 1px solid #ddd; border-radius: 8px; grid-column: span 2;">
                        <strong style="display: block; margin-bottom: 5px; color: #666; font-size: 0.85rem; text-transform: uppercase;">Tipo de Mueble</strong>
                        <span style="font-size: 1rem; font-weight: bold;">${sanitizeHTML(delivery.tipoMueble)}</span>
                    </div>
                </div>
                
                <div style="margin-bottom: 25px;">
                    <h2 style="font-size: 1rem; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; text-transform: uppercase; color: #444;">Accesorios</h2>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; min-height: 80px; border: 1px solid #eee; white-space: pre-wrap; font-family: inherit; line-height: 1.5;">${sanitizeHTML(delivery.accesorios)}</div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 50px;">
                    <div style="text-align: center;">
                        <div style="height: 70px;"></div>
                        <div style="border-top: 1.5px solid #000; padding-top: 8px;">
                            <strong style="display: block; font-size: 0.85rem;">Firma y Sello del Cliente</strong>
                        </div>
                    </div>
                    <div style="text-align: center;">
                        <div style="height: 70px;"></div>
                        <div style="border-top: 1.5px solid #000; padding-top: 8px;">
                            <strong style="display: block; font-size: 0.85rem;">Firma del Entregador</strong>
                        </div>
                    </div>
                    <div style="text-align: center;">
                        <div style="height: 70px;"></div>
                        <div style="border-top: 1.5px solid #000; padding-top: 8px;">
                            <strong style="display: block; font-size: 0.85rem;">Fecha</strong>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 40px; text-align: center; color: #888; font-size: 0.75rem; border-top: 1px dashed #eee; padding-top: 15px;">
                    Registro generado el: ${new Date().toLocaleString()}
                </div>
            </div>
        `;

        // Wait for logo image to load
        const logoImg = document.getElementById('print-logo-img');
        if (logoImg) {
            await new Promise((resolve) => {
                if (logoImg.complete) {
                    resolve();
                } else {
                    logoImg.onload = resolve;
                    logoImg.onerror = resolve;
                }
            });
        }

        // Create preview modal
        const previewModal = document.createElement('div');
        previewModal.id = 'print-preview-modal';
        previewModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10002;
            padding: 1rem;
        `;

        previewModal.innerHTML = `
            <div style="background: white; border-radius: 1rem; max-width: 900px; width: 100%; max-height: 95vh; display: flex; flex-direction: column; position: relative;">
                <button id="close-print-preview" style="
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    font-size: 1.2rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                ">✕</button>
                
                <div style="padding: 1rem 2rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0;">📄 Vista Previa de Impresión</h3>
                    <div style="display: flex; gap: 0.5rem; margin-right: 50px;">
                        <button id="btn-download-pdf" class="btn btn-accent">
                            📥 Descargar PDF
                        </button>
                        <button id="btn-do-print" class="btn btn-primary">
                            🖨️ Imprimir
                        </button>
                    </div>
                </div>
                
                <div style="flex: 1; overflow-y: auto; overflow-x: auto; padding: 1.5rem; background: #e5e5e5;">
                    <div style="
                        background: white; 
                        box-shadow: 0 4px 20px rgba(0,0,0,0.15); 
                        margin: 0 auto;
                        width: 8.5in;
                        min-height: 11in;
                        padding: 0.5in;
                        box-sizing: border-box;
                    ">
                        ${printArea.innerHTML}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(previewModal);

        // Close button handler
        document.getElementById('close-print-preview').onclick = () => {
            previewModal.remove();
            printArea.innerHTML = '';
        };

        // Print button handler
        document.getElementById('btn-do-print').onclick = () => {
            previewModal.style.display = 'none';
            window.print();
            setTimeout(() => {
                previewModal.remove();
                printArea.innerHTML = '';
            }, 500);
        };

        // PDF download handler
        document.getElementById('btn-download-pdf').onclick = async () => {
            const pdfBtn = document.getElementById('btn-download-pdf');
            const originalText = pdfBtn.innerHTML;
            pdfBtn.innerHTML = '⏳ Generando...';
            pdfBtn.disabled = true;

            try {
                const element = previewModal.querySelector('[style*="width: 8.5in"]');
                const folio = delivery.folio || delivery.id.substring(0, 8).toUpperCase();

                const opt = {
                    margin: 0,
                    filename: `Entrega_${folio}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                };

                await html2pdf().set(opt).from(element).save();
                showToast('PDF descargado exitosamente', 'success');
            } catch (error) {
                console.error('Error generating PDF:', error);
                showToast('Error al generar PDF', 'error');
            } finally {
                pdfBtn.innerHTML = originalText;
                pdfBtn.disabled = false;
            }
        };

        // Close on background click
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) {
                previewModal.remove();
                printArea.innerHTML = '';
            }
        });
    },

    // ============= MOBILE RENDER =============
    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        this.isMobile = true;

        contentArea.innerHTML = `
            <div style="padding: 0 0 8px 0;">
                <h1 style="font-size:1.35rem;font-weight:800;margin-bottom:2px;">📋 Entregas</h1>
                <p style="font-size:0.78rem;color:#8e8e93;">Registro de entregas de muebles</p>
            </div>
            <div class="m-actions-bar">
                <button class="btn btn-primary" id="md-btn-add" style="border-radius:20px;">➕ Nueva Entrega</button>
                <button class="btn" id="md-btn-refresh" style="border-radius:20px;">🔄 Actualizar</button>
            </div>
            <div class="m-data-list" id="md-data-list">
                <div style="text-align:center;padding:40px;color:#8e8e93;">Cargando entregas...</div>
            </div>
        `;

        await this.loadDeliveries();

        document.getElementById('md-btn-add').addEventListener('click', () => this.showMobileForm());
        document.getElementById('md-btn-refresh').addEventListener('click', () => this.loadDeliveries());
    },

    renderMobileCards() {
        const list = document.getElementById('md-data-list');
        if (!list) return;

        const canEdit = window.permissions?.canEdit;
        const canDelete = window.permissions?.canDelete;

        if (!this.deliveries || this.deliveries.length === 0) {
            list.innerHTML = '<div class="m-empty"><div class="m-empty-icon">📭</div><div class="m-empty-title">Sin entregas</div><div class="m-empty-text">No hay registros aún.</div></div>';
            return;
        }

        list.innerHTML = this.deliveries.map(d => {
            const folio = d.folio || d.id.substring(0,8).toUpperCase();
            return `
            <div class="m-data-card" onclick="Deliveries.showMobileView('${d.id}')">
                <div class="m-card-header">
                    <span class="m-card-title">#${folio}</span>
                    <span class="m-card-badge primary">${sanitizeHTML(d.tipoMueble || 'Mueble')}</span>
                </div>
                <div class="m-card-rows">
                    <div class="m-card-row"><span class="m-card-label">Cliente</span><span class="m-card-value">${sanitizeHTML(d.cliente || '-')}</span></div>
                    <div class="m-card-row"><span class="m-card-label">Tienda</span><span class="m-card-value">${sanitizeHTML(d.tienda || '-')}</span></div>
                    <div class="m-card-row"><span class="m-card-label">Fecha</span><span class="m-card-value">${d.fecha ? formatDate(d.fecha) : '-'}</span></div>
                </div>
                <div class="m-card-actions" onclick="event.stopPropagation()">
                    <button class="m-card-action" onclick="Deliveries.showMobileView('${d.id}')" title="Ver">👁️</button>
                    ${canEdit ? `<button class="m-card-action" onclick="Deliveries.showMobileForm('${d.id}')" title="Editar">✏️</button>` : ''}
                    ${canDelete ? `<button class="m-card-action delete" onclick="Deliveries.deleteDelivery('${d.id}')" title="Eliminar">🗑️</button>` : ''}
                </div>
            </div>`;
        }).join('');
    },

    showMobileView(id) {
        const d = this.deliveries.find(x => x.id === id);
        if (!d) return;
        const sheet = document.createElement('div');
        sheet.innerHTML = '<div class="m-sheet-backdrop show" onclick="this.nextElementSibling.remove();this.remove();"></div><div class="m-bottom-sheet show"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">#' + (d.folio || d.id.substring(0,8).toUpperCase()) + '</span><button class="m-sheet-close" onclick="this.closest(\'.m-bottom-sheet\').remove();document.querySelector(\'.m-sheet-backdrop\').remove();">✕</button></div><div class="m-sheet-body"><div style="display:flex;flex-direction:column;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Cliente</span><div style="font-weight:500;">' + sanitizeHTML(d.cliente || '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Tienda</span><div style="font-weight:500;">' + sanitizeHTML(d.tienda || '-') + '</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Fecha</span><div style="font-weight:500;">' + (d.fecha ? formatDate(d.fecha) : '-') + '</div></div><div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Mueble</span><div style="font-weight:500;">' + sanitizeHTML(d.tipoMueble || '-') + '</div></div></div>' + (d.accesorios ? '<div><span style="font-size:0.65rem;text-transform:uppercase;color:#8e8e93;font-weight:600;">Accesorios</span><div style="font-weight:500;">' + sanitizeHTML(d.accesorios) + '</div></div>' : '') + '</div></div><div class="m-sheet-footer">' + (window.permissions?.canEdit ? '<button class="m-card-action" onclick="var s=document.querySelector(\'.m-bottom-sheet\');var b=document.querySelector(\'.m-sheet-backdrop\');s.remove();b.remove();Deliveries.showMobileForm(\'' + d.id + '\')">✏️ Editar</button>' : '') + ' 🖨️ <button class="m-card-action" onclick="Deliveries.printDelivery(\'' + d.id + '\')">Imprimir</button>' + (window.permissions?.canDelete ? '<button class="m-card-action delete" onclick="var s=document.querySelector(\'.m-bottom-sheet\');var b=document.querySelector(\'.m-sheet-backdrop\');s.remove();b.remove();Deliveries.deleteDelivery(\'' + d.id + '\')">🗑️ Eliminar</button>' : '') + '</div></div>';
        document.body.appendChild(sheet);
    },

    showMobileForm(id) {
        const d = id ? this.deliveries.find(x => x.id === id) : null;
        const isEdit = !!d;
        const sheet = document.createElement('div');
        sheet.innerHTML = '<div class="m-sheet-backdrop show" id="mdf-backdrop"></div><div class="m-bottom-sheet show" id="mdf-sheet"><div class="m-sheet-handle"></div><div class="m-sheet-header"><span class="m-sheet-title">' + (isEdit ? 'Editar Entrega' : 'Nueva Entrega') + '</span><button class="m-sheet-close" onclick="document.getElementById(\'mdf-sheet\').remove();document.getElementById(\'mdf-backdrop\').remove();">✕</button></div><div class="m-sheet-body"><div class="m-form-group"><label>Cliente</label><input type="text" id="mdf-cliente" value="' + (d?.cliente || '') + '"></div><div class="m-form-row"><div class="m-form-group"><label>Tienda</label><input type="text" id="mdf-tienda" value="' + (d?.tienda || '') + '"></div><div class="m-form-group"><label>Fecha</label><input type="date" id="mdf-fecha" value="' + (d?.fecha ? (typeof d.fecha === 'string' ? d.fecha.split('T')[0] : typeof d.fecha.toDate === 'function' ? d.fecha.toDate().toISOString().split('T')[0] : String(d.fecha).split('T')[0]) : new Date().toISOString().split('T')[0]) + '"></div></div><div class="m-form-group"><label>Tipo de Mueble</label><select id="mdf-tipoMueble"><option>Sala</option><option>Comedor</option><option>Recámara</option><option>Colchón</option><option>Estufa</option><option>Refrigerador</option><option>Lavadora</option><option>Otro</option></select></div><div class="m-form-group"><label>Accesorios</label><textarea id="mdf-accesorios" rows="2">' + (d?.accesorios || '') + '</textarea></div></div><div class="m-sheet-footer"><button class="btn" onclick="document.getElementById(\'mdf-sheet\').remove();document.getElementById(\'mdf-backdrop\').remove();">Cancelar</button><button class="btn btn-primary" id="mdf-submit">' + (isEdit ? 'Guardar' : 'Crear') + '</button></div></div>';
        document.body.appendChild(sheet);

        document.getElementById('mdf-submit').addEventListener('click', async () => {
            const btn = document.getElementById('mdf-submit');
            btn.disabled = true; btn.textContent = 'Guardando...';
            const data = {
                cliente: document.getElementById('mdf-cliente').value,
                tienda: document.getElementById('mdf-tienda').value,
                fecha: document.getElementById('mdf-fecha').value,
                tipoMueble: document.getElementById('mdf-tipoMueble').value,
                accesorios: document.getElementById('mdf-accesorios').value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            try {
                const db = firebase.firestore();
                if (isEdit) {
                    await db.collection('deliveries').doc(id).update(data);
                } else {
                    data.folio = await this.generateFolio();
                    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    data.createdBy = window.currentUserData?.displayName || 'Usuario';
                    await db.collection('deliveries').add(data);
                }
                showToast(isEdit ? 'Actualizado' : 'Creado', 'success');
                document.getElementById('mdf-sheet').remove();
                document.getElementById('mdf-backdrop').remove();
                await this.loadDeliveries();
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
                btn.disabled = false;
                btn.textContent = isEdit ? 'Guardar' : 'Crear';
            }
        });
    }
};

// Make Deliveries available globally
window.Deliveries = Deliveries;
