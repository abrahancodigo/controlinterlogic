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
        this.loadModule('interlogic');
    },

    initFirebase() {
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded!');
            setTimeout(() => this.initFirebase(), 500);
            return;
        }
        console.log('Initializing Firebase...');
        const firebaseConfig = {
            apiKey: "AIzaSyDRgqpevJMpXqyez3uWpgyFZmy7SwrgNEk",
            authDomain: "dalse-e7b96.firebaseapp.com",
            projectId: "dalse-e7b96",
            storageBucket: "dalse-e7b96.firebasestorage.app",
            messagingSenderId: "817518560330",
            appId: "1:817518560330:web:3801a8c2aae41ff2abd2b3"
        };
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log('✅ Firebase initialized successfully');
            } else {
                console.log('✅ Firebase already initialized');
            }
            firebase.firestore().enablePersistence()
                .then(() => console.log('✅ Firestore persistence enabled'))
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('Persistence failed: Multiple tabs open');
                    } else if (err.code === 'unimplemented') {
                        console.warn('Persistence not available in this browser');
                    } else {
                        console.error('Persistence error:', err);
                    }
                });
        } catch (error) {
            console.error('❌ Error initializing Firebase:', error);
            throw error;
        }
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

        // Bottom nav clicks
        bnItems.forEach(item => {
            item.addEventListener('click', () => {
                const module = item.dataset.module;
                this.loadModule(module);
                this.updateBottomNavActive(module);
                if (moreMenu) moreMenu.classList.remove('show');
                if (moreOverlay) moreOverlay.classList.remove('show');
                // Reset more button active state
                if (moreBtn) moreBtn.classList.remove('active');
            });
        });

        // More menu toggle
        if (moreBtn) {
            moreBtn.addEventListener('click', () => {
                this.populateMoreMenu();
                moreMenu?.classList.toggle('show');
                moreOverlay?.classList.toggle('show');
            });
        }

        // Close more menu
        if (moreClose) {
            moreClose.addEventListener('click', () => {
                moreMenu?.classList.remove('show');
                moreOverlay?.classList.remove('show');
            });
        }
        if (moreOverlay) {
            moreOverlay.addEventListener('click', () => {
                moreMenu?.classList.remove('show');
                moreOverlay?.classList.remove('show');
            });
        }

        // Handle more menu items
        if (moreList) {
            moreList.addEventListener('click', (e) => {
                const item = e.target.closest('.more-item');
                if (item) {
                    const module = item.dataset.module;
                    this.loadModule(module);
                    this.updateBottomNavActive(module);
                    moreMenu?.classList.remove('show');
                    moreOverlay?.classList.remove('show');
                }
            });
        }
    },

    populateMoreMenu() {
        const list = document.getElementById('more-menu-list');
        if (!list || list.children.length > 0) return;

        const items = [
            { icon: '🚨', label: 'Problemas', module: 'problemas' },
            { icon: '📈', label: 'Evaluación KPI', module: 'kpi' },
            { icon: '📅', label: 'Asistencia', module: 'asistencia' },
            { icon: '🚛', label: 'Repartidores', module: 'repartidores' },
            { icon: '💵', label: 'Liquidación de Ruta', module: 'liquidacion-ruta' },
            { icon: '💳', label: 'Cobranza y CxC', module: 'cobranza' },
            { icon: '⚙️', label: 'Configuraciones', module: 'settings' },
            { icon: '🛡️', label: 'Gestión de Usuarios', module: 'users' },
        ];

        items.forEach(item => {
            const div = document.createElement('button');
            div.className = 'more-item';
            div.dataset.module = item.module;
            div.innerHTML = `<span class="more-item-icon">${item.icon}</span><span class="more-item-label">${item.label}</span>`;
            list.appendChild(div);
        });
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
        } else if (moduleName === 'liquidacion-ruta' || moduleName === 'liquidacion-contado' || moduleName === 'liquidacion-credito') {
            const despachoBtn = document.querySelector('.bn-item[data-module="despacho"]');
            if (despachoBtn) despachoBtn.classList.add('active');
        } else {
            // Highlight "Más" for other modules
            if (moreBtn) moreBtn.classList.add('active');
        }
        // Also update sidebar nav
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        const sidebarItem = document.querySelector(`.nav-item[data-module="${moduleName}"]`);
        if (sidebarItem) sidebarItem.classList.add('active');
    },

    async loadModule(moduleName) {
        if (this.currentModule === moduleName) return;

        if (this.currentModule === 'interlogic' && window.Interlogic && window.Interlogic.unsubscribe) {
            window.Interlogic.unsubscribe(); window.Interlogic.unsubscribe = null;
            window.Interlogic.selectedRecords.clear();
        }
        if (this.currentModule === 'despacho' && window.Despacho && window.Despacho.unsubscribe) {
            window.Despacho.unsubscribe(); window.Despacho.unsubscribe = null;
        }
        if ((this.currentModule === 'liquidacion-ruta' || this.currentModule === 'liquidacion-contado' || this.currentModule === 'liquidacion-credito') && window.Liquidacion) {
            if (window.Liquidacion.unsubscribeRoutes) { window.Liquidacion.unsubscribeRoutes(); window.Liquidacion.unsubscribeRoutes = null; }
            if (window.Liquidacion.unsubscribeDeliveries) { window.Liquidacion.unsubscribeDeliveries(); window.Liquidacion.unsubscribeDeliveries = null; }
        }
        if (this.currentModule === 'kpi' && window.KpiEvaluation && window.KpiEvaluation.unsubscribe) {
            window.KpiEvaluation.unsubscribe(); window.KpiEvaluation.unsubscribe = null;
        }
        if (this.currentModule === 'clientes' && window.Clientes && window.Clientes.unsubscribe) {
            window.Clientes.unsubscribe(); window.Clientes.unsubscribe = null;
            window.Clientes.selectedRecords.clear();
        }
        if (this.currentModule === 'problemas' && window.Problemas && window.Problemas.unsubscribe) {
            window.Problemas.unsubscribe(); window.Problemas.unsubscribe = null;
        }
        if (this.currentModule === 'cobranza' && window.Cobranza) {
            if (window.Cobranza.unsubscribeRecords) { window.Cobranza.unsubscribeRecords(); window.Cobranza.unsubscribeRecords = null; }
            if (window.Cobranza.unsubscribeCobros) { window.Cobranza.unsubscribeCobros(); window.Cobranza.unsubscribeCobros = null; }
            if (window.Cobranza.unsubscribeGestiones) { window.Cobranza.unsubscribeGestiones(); window.Cobranza.unsubscribeGestiones = null; }
            if (window.Cobranza.unsubscribeAjustes) { window.Cobranza.unsubscribeAjustes(); window.Cobranza.unsubscribeAjustes = null; }
        }

        var bulkContainer = document.getElementById('bulk-actions-container');
        if (bulkContainer) bulkContainer.remove();

        this.currentModule = moduleName;

        try {
            switch (moduleName) {
                case 'deliveries':
                    if (window.Deliveries && window.Deliveries.render) await window.Deliveries.render();
                    break;
                case 'interlogic':
                    if (window.Interlogic && window.Interlogic.render) await window.Interlogic.render();
                    break;
                case 'despacho':
                    if (window.Despacho && window.Despacho.render) await window.Despacho.render();
                    break;
                case 'settings':
                    if (!(await isAdmin())) {
                        showToast('No tienes permisos para acceder a esta sección', 'error');
                        this.loadModule('interlogic'); return;
                    }
                    if (window.Settings && window.Settings.init) await window.Settings.init();
                    break;
                case 'users':
                    if (!(await isAdmin())) {
                        showToast('No tienes permisos para acceder a esta sección', 'error');
                        this.loadModule('interlogic'); return;
                    }
                    if (window.Users && window.Users.render) await window.Users.render();
                    break;
                case 'liquidacion-ruta':
                case 'liquidacion-contado':
                case 'liquidacion-credito':
                    if (window.Liquidacion && window.Liquidacion.render) await window.Liquidacion.render();
                    break;
                case 'repartidores':
                    if (window.Repartidores && window.Repartidores.render) await window.Repartidores.render();
                    break;
                case 'kpi':
                    if (window.KpiEvaluation && window.KpiEvaluation.render) await window.KpiEvaluation.render();
                    break;
                case 'asistencia':
                    if (window.Asistencia && window.Asistencia.render) await window.Asistencia.render();
                    break;
                case 'clientes':
                    if (window.Clientes && window.Clientes.render) await window.Clientes.render();
                    break;
                case 'problemas':
                    if (window.Problemas && window.Problemas.render) await window.Problemas.render();
                    break;
                case 'cobranza':
                    if (window.Cobranza && window.Cobranza.render) await window.Cobranza.render();
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
