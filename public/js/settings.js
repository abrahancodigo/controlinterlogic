// Settings Module
const Settings = {
    settings: null,

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
                    <img src="${this.settings.logo1}" alt="Logo" style="max-height: 40px; max-width: 100px; object-fit: contain;">
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
            <div class="content-header" style="${isMobile ? 'padding:0;' : ''}">
                <h1 style="${isMobile ? 'font-size:1.35rem;font-weight:800;' : ''}">⚙️ Configuraciones</h1>
                <p style="${isMobile ? 'font-size:0.78rem;color:var(--m-text-secondary);' : ''}">Personaliza tu sistema y gestiona usuarios</p>
            </div>

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
                                <div class="logo-upload-area" id="logo1-upload" style="${isMobile ? 'border-radius:10px;min-height:80px;padding:0.75rem;' : ''}">
                                    ${this.settings?.logo1
                ? `<img src="${this.settings.logo1}" alt="Logo 1" style="max-height: 80px; max-width: 100%; object-fit: contain;">`
                : '<p style="color: var(--text-tertiary); font-size:0.85rem;">Haz clic para subir Logo 1</p>'
            }
                                    <input type="file" id="logo1-input" accept="image/*" style="display: none;">
                                </div>
                                ${this.settings?.logo1 ? '<button type="button" class="btn btn-sm btn-secondary" style="margin-top:0.5rem;width:100%;" onclick="Settings.removeLogo(1)">Eliminar Logo 1</button>' : ''}
                            </div>

                            <div class="form-group">
                                <label style="${isMobile ? 'font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;' : ''}">Logo Secundario (Impresión)</label>
                                <div class="logo-upload-area" id="logo2-upload" style="${isMobile ? 'border-radius:10px;min-height:80px;padding:0.75rem;' : ''}">
                                    ${this.settings?.logo2
                ? `<img src="${this.settings.logo2}" alt="Logo 2" style="max-height: 80px; max-width: 100%; object-fit: contain;">`
                : '<p style="color: var(--text-tertiary); font-size:0.85rem;">Haz clic para subir Logo 2</p>'
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
                    <h2 style="${isMobile ? 'font-size:1rem;' : ''}">👥 Gestión de Usuarios</h2>
                </div>
                <div class="card-body" style="${isMobile ? 'padding:0;' : ''}">
                    <p style="margin-bottom: 1rem; color: var(--text-secondary); ${isMobile ? 'font-size:0.85rem;' : ''}">Administra los usuarios del sistema, cambia roles y activa/desactiva cuentas.</p>
                    <button class="btn btn-primary btn-block" onclick="Settings.showUserManagement()" style="${isMobile ? 'min-height:48px;border-radius:12px;font-size:0.9rem;' : ''}">
                        👥 Abrir Gestión de Usuarios
                    </button>
                </div>
            </div>

            <div class="card" style="${isMobile ? 'border-radius:var(--m-radius);padding:var(--m-spacing);margin-bottom:0.75rem;' : ''}">
                <div class="card-header" style="${isMobile ? 'padding:0 0 0.75rem 0;' : ''}">
                    <h2 style="${isMobile ? 'font-size:1rem;' : ''}">📦 Descargar Código Fuente</h2>
                </div>
                <div class="card-body" style="${isMobile ? 'padding:0;' : ''}">
                    ${this.settings?.sourceZipUrl
                        ? `
                        <p style="${isMobile ? 'font-size:0.85rem;margin-bottom:1rem;' : ''}">Descarga el código completo del proyecto.</p>
                        <a href="${this.settings.sourceZipUrl}" class="btn btn-primary btn-block" target="_blank" style="${isMobile ? 'min-height:48px;border-radius:12px;font-size:0.9rem;' : ''}">
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

        // Logo 1 upload
        const logo1Upload = document.getElementById('logo1-upload');
        const logo1Input = document.getElementById('logo1-input');
        if (logo1Upload && logo1Input) {
            logo1Upload.addEventListener('click', () => logo1Input.click());
            logo1Input.addEventListener('change', (e) => this.handleLogoUpload(e, 1));
        }

        // Logo 2 upload
        const logo2Upload = document.getElementById('logo2-upload');
        const logo2Input = document.getElementById('logo2-input');
        if (logo2Upload && logo2Input) {
            logo2Upload.addEventListener('click', () => logo2Input.click());
            logo2Input.addEventListener('change', (e) => this.handleLogoUpload(e, 2));
        }
    },

    async handleLogoUpload(event, logoNumber) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showToast('Por favor selecciona una imagen válida', 'error');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast('La imagen debe ser menor a 2MB', 'error');
            return;
        }

        try {
            // Convert to base64 for storage
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target.result;

                if (logoNumber === 1) {
                    this.settings.logo1 = base64;
                } else {
                    this.settings.logo2 = base64;
                }

                // Re-render to show the new logo
                this.render();
                showToast(`Logo ${logoNumber} cargado. Guarda para aplicar cambios.`, 'info');
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error uploading logo:', error);
            showToast('Error al cargar el logo', 'error');
        }
    },

    removeLogo(logoNumber) {
        if (logoNumber === 1) {
            this.settings.logo1 = '';
        } else {
            this.settings.logo2 = '';
        }
        this.render();
        showToast(`Logo ${logoNumber} eliminado. Guarda para aplicar cambios.`, 'info');
    },

    async handleSubmit(e) {
        e.preventDefault();

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

            await firebase.firestore().collection('config').doc('settings').set(settingsData, { merge: true });

            this.settings = settingsData;
            this.updateBranding();

            showToast('✓ Configuración guardada exitosamente', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Error al guardar la configuración', 'error');
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
