// Settings Module
const Settings = {
    settings: null,

    _sanitizeUrl(url) {
        return sanitizeUrl(url);
    },

    async init() {
        await this.loadSettings();
        this.render();
    },

    async loadSettings() {
        try {
            const doc = await firebase.firestore().collection('config').doc('settings').get();
            if (doc.exists) {
                this.settings = doc.data();
            } else {
                // Default settings
                this.settings = {
                    companyName: 'Dalse',
                    logo1: '',
                    logo2: '',
                    sourceZipUrl: ''
                };
            }
            // Update sidebar with company branding
            this.updateBranding();
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = {
                companyName: 'Dalse',
                logo1: '',
                logo2: '',
                sourceZipUrl: ''
            };
        }
    },

    updateBranding() {
        const sidebarHeader = document.querySelector('.sidebar-header h2');
        if (sidebarHeader && this.settings) {
            if (this.settings.logo1) {
                sidebarHeader.innerHTML = `
                    <img src="${this._sanitizeUrl(this.settings.logo1)}" alt="Logo" style="max-height: 40px; max-width: 100px; object-fit: contain;">
                    <span style="display: block; margin-top: 5px;">${sanitizeHTML(this.settings.companyName)}</span>
                `;
            } else {
                sidebarHeader.innerHTML = `📦 ${sanitizeHTML(this.settings.companyName)}`;
            }
        }
    },

    render() {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;
        const isMobile = window.innerWidth <= 768;

        contentArea.innerHTML = `
            ${SharedComponents.renderModuleHeader({
                icon: 'settings',
                title: 'Configuraciones',
                subtitle: 'Personaliza tu sistema y gestiona usuarios'
            })}

            <div class="card" style="${isMobile ? 'border-radius:var(--m-radius);padding:var(--m-spacing);margin-bottom:0.75rem;' : ''}">
                <div class="card-header" style="${isMobile ? 'padding:0 0 0.75rem 0;' : ''}">
                    <h2 style="${isMobile ? 'font-size:1rem;' : ''}">🏢 Información de la Empresa</h2>
                </div>
                <div class="card-body" style="${isMobile ? 'padding:0;' : ''}">
                    <form id="settings-form">
                        <div class="form-group">
                            <label for="company-name" style="${isMobile ? 'font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;' : ''}">Nombre de la Empresa</label>
                            <input type="text" id="company-name" value="${sanitizeHTML(this.settings?.companyName || 'Dalse')}" placeholder="Nombre de tu empresa" style="${isMobile ? 'min-height:44px;font-size:0.95rem;border-radius:10px;' : ''}">
                        </div>

                        <div class="form-row" style="${isMobile ? 'grid-template-columns:1fr;gap:0.75rem;' : ''}">
                            <div class="form-group">
                                <label style="${isMobile ? 'font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;' : ''}">Logo Principal</label>
                                <div class="logo-upload-area" id="logo1-upload">
                                    ${this.settings?.logo1
                ? `<div class="logo-preview"><img src="${this._sanitizeUrl(this.settings.logo1)}" alt="Logo 1"><div class="logo-preview-hint"><span>Clic para reemplazar</span></div></div>`
                : this._logoPlaceholderHTML(1)
            }
                                    <input type="file" id="logo1-input" accept="image/*" style="display: none;">
                                </div>
                                ${this.settings?.logo1 ? '<button type="button" class="btn btn-sm btn-secondary" style="margin-top:0.5rem;width:100%;" onclick="Settings.removeLogo(1)">Eliminar Logo 1</button>' : ''}
                            </div>

                            <div class="form-group">
                                <label style="${isMobile ? 'font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;' : ''}">Logo Secundario (Impresión)</label>
                                <div class="logo-upload-area" id="logo2-upload">
                                    ${this.settings?.logo2
                ? `<div class="logo-preview"><img src="${this._sanitizeUrl(this.settings.logo2)}" alt="Logo 2"><div class="logo-preview-hint"><span>Clic para reemplazar</span></div></div>`
                : this._logoPlaceholderHTML(2)
            }
                                    <input type="file" id="logo2-input" accept="image/*" style="display: none;">
                                </div>
                                ${this.settings?.logo2 ? '<button type="button" class="btn btn-sm btn-secondary" style="margin-top:0.5rem;width:100%;" onclick="Settings.removeLogo(2)">Eliminar Logo 2</button>' : ''}
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="source-zip-url" style="${isMobile ? 'font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;' : ''}">URL del Código Fuente</label>
                            <input type="text" id="source-zip-url" value="${sanitizeHTML(this.settings?.sourceZipUrl || '')}" placeholder="https://github.com/TU_USUARIO/..." style="${isMobile ? 'min-height:44px;font-size:0.9rem;border-radius:10px;' : ''}">
                            <small style="color: var(--text-tertiary); font-size:0.7rem;">URL del archivo .zip del repositorio GitHub.</small>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block" style="${isMobile ? 'min-height:48px;border-radius:12px;font-size:0.95rem;margin-top:0.5rem;' : ''}">💾 Guardar Configuración</button>
                    </form>
                </div>
            </div>

            <div class="card" style="${isMobile ? 'border-radius:var(--m-radius);padding:var(--m-spacing);margin-bottom:0.75rem;' : ''}">
                <div class="card-header" style="${isMobile ? 'padding:0 0 0.75rem 0;' : ''}">
                    <h2 style="${isMobile ? 'font-size:1rem;' : ''}">💰 Configuración Financiera</h2>
                </div>
                <div class="card-body" style="${isMobile ? 'padding:0;' : ''}">
                    <form id="financial-settings-form">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label for="fin-tasa-mora">Tasa Interés Moratorio (% mensual)</label>
                                <input type="number" id="fin-tasa-mora" step="0.01" min="0" value="${this.settings?.tasaInteresMoratorio || '0'}" style="${isMobile ? 'min-height:44px;font-size:0.95rem;border-radius:10px;' : ''}">
                            </div>
                            <div class="form-group">
                                <label for="fin-dias-recordatorio">Días Antes de Recordatorio</label>
                                <input type="number" id="fin-dias-recordatorio" min="0" max="30" value="${this.settings?.diasRecordatorio || '3'}" style="${isMobile ? 'min-height:44px;font-size:0.95rem;border-radius:10px;' : ''}">
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top:1rem;">
                            <div class="form-group">
                                <label for="fin-descuento-pp">Descuento Pronto Pago (%)</label>
                                <input type="number" id="fin-descuento-pp" step="0.1" min="0" max="50" value="${this.settings?.descuentoProntoPago || '0'}" style="${isMobile ? 'min-height:44px;font-size:0.95rem;border-radius:10px;' : ''}">
                            </div>
                            <div class="form-group">
                                <label for="fin-dias-pp">Días para Pronto Pago</label>
                                <input type="number" id="fin-dias-pp" min="1" max="30" value="${this.settings?.diasProntoPago || '10'}" style="${isMobile ? 'min-height:44px;font-size:0.95rem;border-radius:10px;' : ''}">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block" style="margin-top:1rem;${isMobile ? 'min-height:48px;border-radius:12px;font-size:0.95rem;' : ''}">💾 Guardar Configuración Financiera</button>
                    </form>
                </div>
            </div>

            ${window.permissions?.isAdmin ? `
            <div class="card" style="${isMobile ? 'border-radius:var(--m-radius);padding:var(--m-spacing);margin-bottom:0.75rem;' : ''}">
                <div class="card-header" style="${isMobile ? 'padding:0 0 0.75rem 0;' : ''}">
                    <h2 style="${isMobile ? 'font-size:1rem;' : ''}">👥 Gestión de Usuarios</h2>
                </div>
                <div class="card-body" style="${isMobile ? 'padding:0;' : ''}">
                    <p style="margin-bottom: 1rem; color: var(--text-secondary); ${isMobile ? 'font-size:0.85rem;' : ''}">Administra los usuarios del sistema, cambia roles y activa/desactiva cuentas.</p>
                    <button class="btn btn-primary btn-block" onclick="Settings.showUserManagement()" style="${isMobile ? 'min-height:48px;border-radius:12px;font-size:0.9rem;' : ''}">
                        👥 Abrir Gestión de Usuarios
                    </button>
                </div>
            </div>` : ''}

            <div class="card" style="${isMobile ? 'border-radius:var(--m-radius);padding:var(--m-spacing);margin-bottom:0.75rem;' : ''}">
                <div class="card-header" style="${isMobile ? 'padding:0 0 0.75rem 0;' : ''}">
                    <h2 style="${isMobile ? 'font-size:1rem;' : ''}">📦 Descargar Código Fuente</h2>
                </div>
                <div class="card-body" style="${isMobile ? 'padding:0;' : ''}">
                    ${this.settings?.sourceZipUrl
                        ? `
                        <p style="${isMobile ? 'font-size:0.85rem;margin-bottom:1rem;' : ''}">Descarga el código completo del proyecto.</p>
                        <a href="${sanitizeHref(this.settings.sourceZipUrl)}" class="btn btn-primary btn-block" target="_blank" rel="noopener noreferrer" style="${isMobile ? 'min-height:48px;border-radius:12px;font-size:0.9rem;' : ''}">
                            ⬇️ Descargar Código (.zip)
                        </a>
                        `
                        : `
                        <p style="color: var(--text-tertiary); ${isMobile ? 'font-size:0.85rem;' : ''}">Configura la URL del repositorio GitHub en el formulario de arriba.</p>
                        `
                    }
                </div>
            </div>
        `;

        this.setupEventListeners();
    },

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('settings-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Financial settings form
        const finForm = document.getElementById('financial-settings-form');
        if (finForm) {
            finForm.addEventListener('submit', (e) => this.handleFinancialSubmit(e));
        }

        // Logo 1 upload
        const logo1Upload = document.getElementById('logo1-upload');
        const logo1Input = document.getElementById('logo1-input');
        if (logo1Upload && logo1Input) {
            logo1Upload.addEventListener('click', () => logo1Input.click());
            logo1Input.addEventListener('click', (e) => e.stopPropagation());
            logo1Input.addEventListener('change', (e) => this.handleLogoUpload(e, 1));
        }

        // Logo 2 upload
        const logo2Upload = document.getElementById('logo2-upload');
        const logo2Input = document.getElementById('logo2-input');
        if (logo2Upload && logo2Input) {
            logo2Upload.addEventListener('click', () => logo2Input.click());
            logo2Input.addEventListener('click', (e) => e.stopPropagation());
            logo2Input.addEventListener('change', (e) => this.handleLogoUpload(e, 2));
        }
    },

    _requireWrite() {
        if (window.permissions?.isAdmin) return true;
        showToast('Solo un administrador puede modificar la configuración.', 'warning');
        return false;
    },

    _captureUnsavedInputs() {
        return {
            companyName: document.getElementById('company-name')?.value,
            sourceZipUrl: document.getElementById('source-zip-url')?.value
        };
    },

    _restoreUnsavedInputs(saved) {
        if (!saved) return;
        const companyName = document.getElementById('company-name');
        const sourceZipUrl = document.getElementById('source-zip-url');
        if (companyName && saved.companyName !== undefined) companyName.value = saved.companyName;
        if (sourceZipUrl && saved.sourceZipUrl !== undefined) sourceZipUrl.value = saved.sourceZipUrl;
    },

    async handleLogoUpload(event, logoNumber) {
        const input = event.target;
        if (!this._requireWrite()) { input.value = ''; return; }
        const file = input.files && input.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Por favor selecciona una imagen válida', 'error');
            input.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast('La imagen debe ser menor a 5MB', 'error');
            input.value = '';
            return;
        }

        try {
            const base64 = await this._compressLogo(file);

            if (logoNumber === 1) {
                this.settings.logo1 = base64;
            } else {
                this.settings.logo2 = base64;
            }

            this._updateLogoArea(logoNumber, base64);
            showToast(`Logo ${logoNumber} cargado. Guarda para aplicar cambios.`, 'info');
        } catch (error) {
            console.error('Error uploading logo:', error);
            showToast('Error al cargar el logo', 'error');
        } finally {
            input.value = '';
        }
    },

    _compressLogo(file, maxWidth = 400) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
            reader.onload = () => {
                if (file.type === 'image/svg+xml') {
                    resolve(reader.result);
                    return;
                }
                const img = new Image();
                img.onerror = () => reject(new Error('Imagen inválida'));
                img.onload = () => {
                    const scale = Math.min(1, maxWidth / img.width);
                    const width = Math.max(1, Math.round(img.width * scale));
                    const height = Math.max(1, Math.round(img.height * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { resolve(reader.result); return; }
                    ctx.drawImage(img, 0, 0, width, height);
                    const isPng = file.type === 'image/png';
                    const out = isPng
                        ? canvas.toDataURL('image/png')
                        : canvas.toDataURL('image/jpeg', 0.9);
                    resolve(out.length < reader.result.length ? out : reader.result);
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    },

    _logoPlaceholderHTML(number) {
        const name = number === 1 ? 'principal' : 'secundario';
        return `<div class="logo-placeholder">
            <div class="icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>
            <p class="main">Subir logo ${name}</p>
            <p class="sub">PNG o JPG · máx. 5 MB</p>
        </div>`;
    },

    _updateLogoArea(logoNumber, base64) {
        const area = document.getElementById(`logo${logoNumber}-upload`);
        if (!area) return;
        const input = document.getElementById(`logo${logoNumber}-input`);
        const existing = area.querySelector('.logo-preview img');
        if (existing) {
            existing.src = this._sanitizeUrl(base64);
        } else {
            area.querySelector('.logo-placeholder')?.remove();
            const wrap = document.createElement('div');
            wrap.className = 'logo-preview';
            const img = document.createElement('img');
            img.src = this._sanitizeUrl(base64);
            img.alt = `Logo ${logoNumber}`;
            const hint = document.createElement('div');
            hint.className = 'logo-preview-hint';
            hint.innerHTML = '<span>Clic para reemplazar</span>';
            wrap.appendChild(img);
            wrap.appendChild(hint);
            if (input) {
                area.insertBefore(wrap, input);
            } else {
                area.appendChild(wrap);
            }
        }

        const group = area.closest('.form-group');
        if (group && !document.getElementById(`logo${logoNumber}-remove`)) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = `logo${logoNumber}-remove`;
            btn.className = 'btn btn-sm btn-secondary';
            btn.style.cssText = 'margin-top:0.5rem;width:100%;';
            btn.textContent = `Eliminar Logo ${logoNumber}`;
            btn.addEventListener('click', () => this.removeLogo(logoNumber));
            group.appendChild(btn);
        }

        this.updateBranding();
    },

    removeLogo(logoNumber) {
        if (!this._requireWrite()) return;
        if (logoNumber === 1) {
            this.settings.logo1 = '';
        } else {
            this.settings.logo2 = '';
        }

        const area = document.getElementById(`logo${logoNumber}-upload`);
        if (area) {
            area.querySelector('.logo-preview')?.remove();
            if (!area.querySelector('.logo-placeholder')) {
                const wrap = document.createElement('div');
                wrap.innerHTML = this._logoPlaceholderHTML(logoNumber);
                area.appendChild(wrap.firstElementChild);
            }
        }
        document.getElementById(`logo${logoNumber}-remove`)?.remove();

        this.updateBranding();
        showToast(`Logo ${logoNumber} eliminado. Guarda para aplicar cambios.`, 'info');
    },

    async handleSubmit(e) {
        e.preventDefault();
        if (!this._requireWrite()) return;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);

        try {
            const companyName = document.getElementById('company-name').value.trim();
            const sourceZipUrl = document.getElementById('source-zip-url').value.trim();

            const settingsData = {
                companyName: companyName || 'Dalse',
                logo1: this.settings.logo1 || '',
                logo2: this.settings.logo2 || '',
                sourceZipUrl: sourceZipUrl || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const totalBytes = new Blob([JSON.stringify(settingsData)]).size;
            if (totalBytes > 900 * 1024) {
                showToast(`Los logos pesan demasiado (${Math.round(totalBytes / 1024)} KB). Usa imágenes más livianas.`, 'error', 6000);
                return;
            }

            await firebase.firestore().collection('config').doc('settings').set(settingsData, { merge: true });

            this.settings = settingsData;
            this.updateBranding();

            showToast('✓ Configuración guardada exitosamente', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            const detail = error?.code === 'invalid-argument'
                ? 'El documento excede el límite de Firestore. Reduce el peso de los logos.'
                : (error?.message || 'Intenta de nuevo.');
            showToast(`Error al guardar: ${detail}`, 'error', 6000);
        } finally {
            setButtonLoading(submitBtn, false);
        }
    },

    async handleFinancialSubmit(e) {
        e.preventDefault();
        if (!this._requireWrite()) return;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);
        try {
            const intOrDefault = (id, def) => {
                const raw = document.getElementById(id).value;
                return raw === '' ? def : (parseInt(raw, 10) || 0);
            };
            const finData = {
                tasaInteresMoratorio: parseFloat(document.getElementById('fin-tasa-mora').value) || 0,
                diasRecordatorio: intOrDefault('fin-dias-recordatorio', 3),
                descuentoProntoPago: parseFloat(document.getElementById('fin-descuento-pp').value) || 0,
                diasProntoPago: intOrDefault('fin-dias-pp', 10),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await firebase.firestore().collection('config').doc('settings').set(finData, { merge: true });
            this.settings = { ...this.settings, ...finData };
            showToast('✓ Configuración financiera guardada', 'success');
        } catch (error) {
            console.error('Error saving financial settings:', error);
            showToast('Error al guardar', 'error');
        } finally {
            setButtonLoading(submitBtn, false);
        }
    },

    showUserManagement() {
        // Switch to users module
        const usersNav = document.querySelector('[data-module="users"]');
        if (usersNav) {
            usersNav.click();
        } else {
            // If users module exists, initialize it directly
            if (typeof Users !== 'undefined') {
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                Users.render();
            }
        }
    }
};

// Make Settings globally available
window.Settings = Settings;

if (window.ModuleRegistry) {
    ModuleRegistry.register({
        key: 'settings',
        label: 'Configuraciones',
        render: () => Settings.init()
    });
}
