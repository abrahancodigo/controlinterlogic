// ===================================
// Main Application
// ===================================

const App = {
    currentModule: null,

    // Initialize the application
    init() {
        console.log('📱 Initializing App module...');

        // Setup navigation
        this.setupNavigation();

        // Setup sidebar toggle for mobile
        this.setupSidebarToggle();

        // Load initial module
        this.loadModule('interlogic');
    },

    // Initialize Firebase
    initFirebase() {
        // Check if Firebase is available
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded!');
            setTimeout(() => this.initFirebase(), 500);
            return;
        }

        console.log('Initializing Firebase...');

        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyDRgqpevJMpXqyez3uWpgyFZmy7SwrgNEk",
            authDomain: "dalse-e7b96.firebaseapp.com",
            projectId: "dalse-e7b96",
            storageBucket: "dalse-e7b96.firebasestorage.app",
            messagingSenderId: "817518560330",
            appId: "1:817518560330:web:3801a8c2aae41ff2abd2b3"
        };

        try {
            // Check if Firebase is already initialized
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log('✅ Firebase initialized successfully');
            } else {
                console.log('✅ Firebase already initialized');
            }

            // Enable Firestore offline persistence
            firebase.firestore().enablePersistence()
                .then(() => {
                    console.log('✅ Firestore persistence enabled');
                })
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

    // Setup navigation
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                const module = item.dataset.module;
                if (module) {
                    this.loadModule(module);

                    // Update active state
                    navItems.forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');

                    // Close sidebar on mobile
                    if (window.innerWidth <= 768) {
                        document.getElementById('sidebar').classList.remove('open');
                    }
                }
            });
        });
    },

    // Setup sidebar toggle
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

                // Show/hide floating toggle based on collapse state
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

        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleSidebar);
        }

        if (mobileToggleBtn) {
            mobileToggleBtn.addEventListener('click', toggleSidebar);
        }

        if (floatingToggleBtn) {
            floatingToggleBtn.addEventListener('click', toggleSidebar);
        }

        if (overlay) {
            overlay.addEventListener('click', closeSidebar);
        }

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                // If sidebar is open and we click outside of it AND outside the toggle buttons
                if (sidebar && sidebar.classList.contains('open') &&
                    !sidebar.contains(e.target) &&
                    !toggleBtn?.contains(e.target) &&
                    !mobileToggleBtn?.contains(e.target)) {
                    closeSidebar();
                }
            }
        });
    },

    // Load a module
    async loadModule(moduleName) {
        if (this.currentModule === moduleName) return;

        // Cleanup previous module
        if (this.currentModule === 'interlogic' && window.Interlogic && window.Interlogic.unsubscribe) {
            window.Interlogic.unsubscribe();
            window.Interlogic.unsubscribe = null;
        }
        if (this.currentModule === 'despacho' && window.Despacho && window.Despacho.unsubscribe) {
            window.Despacho.unsubscribe();
            window.Despacho.unsubscribe = null;
        }
        if ((this.currentModule === 'liquidacion-contado' || this.currentModule === 'liquidacion-credito') && window.Liquidacion && window.Liquidacion.unsubscribe) {
            window.Liquidacion.unsubscribe();
            window.Liquidacion.unsubscribe = null;
        }
        if (this.currentModule === 'kpi' && window.KpiEvaluation && window.KpiEvaluation.unsubscribe) {
            window.KpiEvaluation.unsubscribe();
            window.KpiEvaluation.unsubscribe = null;
        }
        if (this.currentModule === 'clientes' && window.Clientes && window.Clientes.unsubscribe) {
            window.Clientes.unsubscribe();
            window.Clientes.unsubscribe = null;
        }
        if (this.currentModule === 'problemas' && window.Problemas && window.Problemas.unsubscribe) {
            window.Problemas.unsubscribe();
            window.Problemas.unsubscribe = null;
        }

        this.currentModule = moduleName;

        try {
            switch (moduleName) {
                case 'deliveries':
                    if (window.Deliveries && window.Deliveries.render) {
                        await window.Deliveries.render();
                    }
                    break;

                case 'interlogic':
                    if (window.Interlogic && window.Interlogic.render) {
                        await window.Interlogic.render();
                    }
                    break;

                case 'despacho':
                    if (window.Despacho && window.Despacho.render) {
                        await window.Despacho.render();
                    }
                    break;

                case 'settings':
                    // Check if user is admin
                    const settingsUserIsAdmin = await isAdmin();
                    if (!settingsUserIsAdmin) {
                        showToast('No tienes permisos para acceder a esta sección', 'error');
                        this.loadModule('deliveries');
                        return;
                    }

                    if (window.Settings && window.Settings.init) {
                        await window.Settings.init();
                    }
                    break;

                case 'users':
                    // Check if user is admin
                    const userIsAdmin = await isAdmin();
                    if (!userIsAdmin) {
                        showToast('No tienes permisos para acceder a esta sección', 'error');
                        this.loadModule('deliveries');
                        return;
                    }

                    if (window.Users && window.Users.render) {
                        await window.Users.render();
                    }
                    break;

                case 'liquidacion-contado':
                    if (window.Liquidacion && window.Liquidacion.renderContado) {
                        await window.Liquidacion.renderContado();
                    }
                    break;

                case 'liquidacion-credito':
                    if (window.Liquidacion && window.Liquidacion.renderCredito) {
                        await window.Liquidacion.renderCredito();
                    }
                    break;

                case 'kpi':
                    if (window.KpiEvaluation && window.KpiEvaluation.render) {
                        await window.KpiEvaluation.render();
                    }
                    break;

                case 'asistencia':
                    if (window.Asistencia && window.Asistencia.render) {
                        await window.Asistencia.render();
                    }
                    break;

                case 'clientes':
                    if (window.Clientes && window.Clientes.render) {
                        await window.Clientes.render();
                    }
                    break;

                case 'problemas':
                    if (window.Problemas && window.Problemas.render) {
                        await window.Problemas.render();
                    }
                    break;

                default:
                    console.warn(`Unknown module: ${moduleName}`);
            }
        } catch (error) {
            console.error(`Error loading module ${moduleName}:`, error);
            showToast('Error al cargar el módulo', 'error');
        }
    },

    // Load company branding from settings
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

// Make App available globally
window.App = App;

// Note: App.init() will be called by auth.js after successful login
