// ===================================
// Main Application
// ===================================

const App = {
    currentModule: null,

    init() {
        console.log('📱 Initializing App module...');
        this.setupNavigation();
        this.setupSidebarToggle();
        this.setupMobileNav();
        this.loadModule('dashboard');
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const module = item.dataset.module;
                if (module) {
                    this.loadModule(module);
                    navItems.forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');
                    if (window.innerWidth <= 768) {
                        document.getElementById('sidebar').classList.remove('open');
                    }
                }
            });
        });
    },

    setupSidebarToggle() {
        const toggleBtn = document.getElementById('sidebar-toggle');
        const mobileToggleBtn = document.getElementById('mobile-toggle');
        const floatingToggleBtn = document.getElementById('floating-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const mainContent = document.querySelector('.main-content');

        const toggleSidebar = () => {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                const isOpen = sidebar.classList.toggle('open');
                if (overlay) {
                    if (isOpen) overlay.classList.add('show');
                    else overlay.classList.remove('show');
                }
            } else {
                const isCollapsed = sidebar.classList.toggle('collapsed');
                if (mainContent) {
                    if (isCollapsed) mainContent.classList.add('expanded');
                    else mainContent.classList.remove('expanded');
                }
                if (floatingToggleBtn) {
                    if (isCollapsed) floatingToggleBtn.classList.add('show');
                    else floatingToggleBtn.classList.remove('show');
                }
            }
        };
        const closeSidebar = () => {
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('show');
        };
        if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
        if (mobileToggleBtn) mobileToggleBtn.addEventListener('click', toggleSidebar);
        if (floatingToggleBtn) floatingToggleBtn.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', closeSidebar);
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (sidebar && sidebar.classList.contains('open') &&
                    !sidebar.contains(e.target) &&
                    !toggleBtn?.contains(e.target) &&
                    !mobileToggleBtn?.contains(e.target)) {
                    closeSidebar();
                }
            }
        });
    },

    // ---------- Mobile Bottom Navigation ----------
    setupMobileNav() {
        const bnItems = document.querySelectorAll('.bn-item[data-module]');
        const moreBtn = document.getElementById('bn-more-btn');
        const moreMenu = document.getElementById('more-menu');
        const moreOverlay = document.getElementById('more-overlay');
        const moreClose = document.getElementById('more-menu-close');
        const moreList = document.getElementById('more-menu-list');
        const profileBtn = document.getElementById('mobile-profile-btn');
        const closeMore = () => this.setMoreMenu(false);

        // Bottom nav clicks
        bnItems.forEach(item => {
            item.addEventListener('click', () => {
                const module = item.dataset.module;
                this.loadModule(module);
                this.updateBottomNavActive(module);
                closeMore();
                // Reset more button active state
                if (moreBtn) moreBtn.classList.remove('active');
            });
        });

        // More menu toggle
        if (moreBtn) {
            moreBtn.addEventListener('click', () => {
                this.populateMoreMenu();
                this.setMoreMenu(!moreMenu?.classList.contains('show'));
            });
        }
        if (profileBtn) profileBtn.addEventListener('click', () => {
            this.populateMoreMenu();
            this.setMoreMenu(!moreMenu?.classList.contains('show'));
        });

        // Close more menu
        if (moreClose) {
            moreClose.addEventListener('click', () => {
                closeMore();
            });
        }
        if (moreOverlay) {
            moreOverlay.addEventListener('click', () => {
                closeMore();
            });
        }

        // Handle more menu items
        if (moreList) {
            moreList.addEventListener('click', (e) => {
                if (e.target.closest('[data-mobile-logout]')) {
                    closeMore();
                    document.getElementById('logout-btn')?.click();
                    return;
                }
                const item = e.target.closest('.more-item');
                if (item) {
                    const module = item.dataset.module;
                    this.loadModule(module);
                    this.updateBottomNavActive(module);
                    closeMore();
                }
            });
        }
        document.addEventListener('keydown', (e) => {
            if (!moreMenu?.classList.contains('show')) return;
            if (e.key === 'Escape') { closeMore(); return; }
            if (e.key !== 'Tab') return;
            const items = [...moreMenu.querySelectorAll('button:not(:disabled)')];
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        });
    },

    setMoreMenu(open) {
        const menu = document.getElementById('more-menu');
        menu?.classList.toggle('show', open);
        document.getElementById('more-overlay')?.classList.toggle('show', open);
        document.body.classList.toggle('mobile-menu-open', open);
        ['bn-more-btn', 'mobile-profile-btn'].forEach(id => document.getElementById(id)?.setAttribute('aria-expanded', String(open)));
        if (open) { this._moreTrigger = document.activeElement; menu?.focus(); }
        else this._moreTrigger?.focus();
    },

    populateMoreMenu() {
        const list = document.getElementById('more-menu-list');
        if (!list) return;
        list.replaceChildren();
        const profile = document.createElement('div');
        profile.className = 'mobile-account';
        const name = document.createElement('strong');
        name.textContent = document.getElementById('user-name')?.textContent || 'Mi cuenta';
        const role = document.createElement('span');
        role.textContent = document.getElementById('user-role')?.textContent || '';
        profile.append(name, role);
        list.appendChild(profile);

        // Los módulos ya presentes en la barra inferior no se repiten en "Más"
        const bottomModules = [...document.querySelectorAll('.bn-item[data-module]')].map(item => item.dataset.module);

        // Construye "Más" a partir de los ítems del sidebar, así móvil muestra
        // exactamente las mismas opciones que la versión PC (mobile-first).
        const navItems = document.querySelectorAll('.nav-item[data-module]');
        navItems.forEach(item => {
            const module = item.dataset.module;
            if (bottomModules.includes(module)) return;
            if (item.style.display === 'none') return;

            const icon = item.querySelector('.nav-icon');
            const label = item.querySelector('.nav-text');
            const div = document.createElement('button');
            div.className = 'more-item';
            div.dataset.module = module;
            div.innerHTML =
                `<span class="more-item-icon">${icon ? icon.innerHTML : ''}</span>` +
                `<span class="more-item-label">${label ? label.textContent : module}</span>`;
            list.appendChild(div);
        });
        const logout = document.createElement('button');
        logout.className = 'mobile-logout';
        logout.dataset.mobileLogout = '';
        logout.textContent = 'Cerrar sesión';
        list.appendChild(logout);
    },

    updateBottomNavActive(moduleName) {
        document.querySelectorAll('.bn-item').forEach(btn => {
            btn.classList.remove('active');
        });
        // Also remove "Más" active state
        const moreBtn = document.getElementById('bn-more-btn');
        if (moreBtn) moreBtn.classList.remove('active');
        
        // Map module to bottom nav item
        const bnItem = document.querySelector(`.bn-item[data-module="${moduleName}"]`);
        if (bnItem) {
            bnItem.classList.add('active');
        } else {
            // Highlight "Más" for other modules
            if (moreBtn) moreBtn.classList.add('active');
        }
        // Also update sidebar nav
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        const sidebarItem = document.querySelector(`.nav-item[data-module="${moduleName}"]`);
        if (sidebarItem) sidebarItem.classList.add('active');
        document.querySelectorAll('.bn-item').forEach(btn => {
            if (btn.classList.contains('active')) btn.setAttribute('aria-current', 'page');
            else btn.removeAttribute('aria-current');
        });
        const title = document.getElementById('mobile-section-title');
        if (title) title.textContent = moduleName === 'dashboard' ? 'Inicio' : moduleName === 'interlogic' ? 'Interlogic' : sidebarItem?.querySelector('.nav-text')?.textContent || 'Dalse';
    },

    async loadModule(moduleName) {
        if (this.currentModule === moduleName) return;

        if (this.currentModule === 'interlogic' && window.Interlogic && window.Interlogic.unsubscribe) {
            window.Interlogic.unsubscribe(); window.Interlogic.unsubscribe = null;
            window.Interlogic.selectedRecords.clear();
        }
        if (this.currentModule === 'liquidacion' && window.Liquidacion) {
            if (window.Liquidacion.cleanup) window.Liquidacion.cleanup();
        }
        if (this.currentModule === 'kpi' && window.KpiEvaluation && window.KpiEvaluation.unsubscribe) {
            window.KpiEvaluation.unsubscribe(); window.KpiEvaluation.unsubscribe = null;
        }
        if (this.currentModule === 'clientes' && window.Clientes) {
            window.Clientes._cacheExpiry = 0; // invalida caché al salir
            window.Clientes.selectedRecords.clear();
        }
        if (this.currentModule === 'problemas' && window.Problemas && window.Problemas.unsubscribe) {
            window.Problemas.unsubscribe(); window.Problemas.unsubscribe = null;
        }
        if (this.currentModule === 'flota' && window.Flota) {
            if (window.Flota.unsubscribeVehiculos) { window.Flota.unsubscribeVehiculos(); window.Flota.unsubscribeVehiculos = null; }
            if (window.Flota.unsubscribeMantenimientos) { window.Flota.unsubscribeMantenimientos(); window.Flota.unsubscribeMantenimientos = null; }
            if (window.Flota.unsubscribeOT) { window.Flota.unsubscribeOT(); window.Flota.unsubscribeOT = null; }
            if (window.Flota.unsubscribeProveedores) { window.Flota.unsubscribeProveedores(); window.Flota.unsubscribeProveedores = null; }
        }
        if (this.currentModule === 'tarimas' && window.Tarimas) {
            if (window.Tarimas.cleanup) window.Tarimas.cleanup();
        }

        var bulkContainer = document.getElementById('bulk-actions-container');
        if (bulkContainer) bulkContainer.remove();

        if (this.currentModule === 'dashboard' && window.Dashboard) {
            if (window.Dashboard.destroy) { window.Dashboard.destroy(); }
        }

        this.currentModule = moduleName;
        this.updateBottomNavActive(moduleName);
        const contentArea = document.getElementById('content-area');
        if (contentArea) contentArea.dataset.visualModule = moduleName;

        try {
            switch (moduleName) {
                case 'dashboard':
                    if (window.Dashboard && window.Dashboard.render) await window.Dashboard.render();
                    break;
                case 'deliveries':
                    if (window.Deliveries && window.Deliveries.render) await window.Deliveries.render();
                    break;
                case 'interlogic':
                    if (window.Interlogic && window.Interlogic.render) await window.Interlogic.render();
                    break;
                case 'settings':
                    if (!(await isAdmin())) {
                        showToast('No tienes permisos para acceder a esta sección', 'error');
                        this.loadModule('dashboard'); return;
                    }
                    if (window.Settings && window.Settings.init) await window.Settings.init();
                    break;
                case 'users':
                    if (!(await isAdmin())) {
                        showToast('No tienes permisos para acceder a esta sección', 'error');
                        this.loadModule('dashboard'); return;
                    }
                    if (window.Users && window.Users.render) await window.Users.render();
                    break;
                case 'liquidacion':
                    if (window.Liquidacion && window.Liquidacion.render) await window.Liquidacion.render();
                    break;
                                case 'kpi':
                    if (window.KpiEvaluation && window.KpiEvaluation.render) await window.KpiEvaluation.render();
                    break;

                case 'clientes':
                    if (window.Clientes && window.Clientes.render) await window.Clientes.render();
                    break;
                case 'problemas':
                    if (window.Problemas && window.Problemas.render) await window.Problemas.render();
                    break;
                case 'flota':
                    if (window.Flota && window.Flota.render) await window.Flota.render();
                    break;
                case 'asistencia':
                    if (window.Asistencia && window.Asistencia.render) await window.Asistencia.render();
                    break;
                case 'tarimas':
                    if (window.Tarimas && window.Tarimas.render) await window.Tarimas.render();
                    break;
                default:
                    console.warn(`Unknown module: ${moduleName}`);
            }
        } catch (error) {
            console.error(`Error loading module ${moduleName}:`, error);
            showToast('Error al cargar el módulo', 'error');
        }
    },

    async loadBranding() {
        try {
            if (window.Settings && window.Settings.loadSettings) {
                await window.Settings.loadSettings();
            }
        } catch (error) {
            console.error('Error loading branding:', error);
        }
    }
};

window.App = App;
