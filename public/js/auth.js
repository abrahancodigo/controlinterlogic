// ===================================
// Authentication Module
// ===================================

// Helper: reset button from loading state
function authResetBtn(btn) {
    if (!btn) return;
    btn.classList.remove('loading');
    btn.disabled = false;
}

// Helper: show error with shake
function authShowError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('shake');
    // Force reflow for animation to replay
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 600);
}

const Auth = {
    init() {
        // Show loading until auth state resolves
        const ls = document.getElementById('loading-screen');
        if (ls) {
            ls.style.display = 'flex';
            ls.style.pointerEvents = 'auto';
        }

        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                await this.handleUserLogin(user);
            } else {
                this.handleUserLogout();
            }
        });

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Restore remembered username
        try {
            const remembered = localStorage.getItem('dalse-remembered-user');
            if (remembered) {
                document.getElementById('login-username').value = remembered;
                document.getElementById('login-remember').checked = true;
                document.getElementById('login-password').focus();
            }
        } catch (e) {}

        // Password visibility toggle
        const pwToggle = document.getElementById('pw-toggle');
        const pwInput = document.getElementById('login-password');
        if (pwToggle && pwInput) {
            pwToggle.addEventListener('click', () => {
                const isVisible = pwToggle.classList.toggle('visible');
                pwInput.type = isVisible ? 'text' : 'password';
                pwToggle.setAttribute('aria-label', isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña');
            });
        }

        // Mouse parallax on login screen
        this.initParallax();
    },

    initParallax() {
        const screen = document.getElementById('login-screen');
        if (!screen || window.innerWidth < 768) return; // skip on mobile

        const orbsWrap = document.querySelector('.auth-orbs');
        const container = document.querySelector('.auth-container');

        // Wait for entrance animation to finish
        setTimeout(() => {
            let mx = 0, my = 0, raf = null;

            const onMove = (e) => {
                mx = (e.clientX / window.innerWidth) * 2 - 1;
                my = (e.clientY / window.innerHeight) * 2 - 1;
                if (!raf) raf = requestAnimationFrame(update);
            };

            const update = () => {
                raf = null;
                if (orbsWrap) orbsWrap.style.transform = `translate(${mx * 20}px, ${my * 20}px)`;
                if (container) container.style.transform =
                    `perspective(800px) rotateX(${my * -1.2}deg) rotateY(${mx * 1.2}deg)`;
            };

            screen.addEventListener('mousemove', onMove);
            screen.addEventListener('mouseleave', () => {
                mx = 0; my = 0;
                if (raf) { cancelAnimationFrame(raf); raf = null; }
                if (orbsWrap) orbsWrap.style.transform = '';
                if (container) container.style.transform = '';
            });
        }, 900);
    },

    async handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('login-username').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        const submitBtn = document.getElementById('login-submit-btn');
        const rememberChk = document.getElementById('login-remember');

        // Handle remember me
        try {
            if (rememberChk && rememberChk.checked) {
                localStorage.setItem('dalse-remembered-user', username);
            } else {
                localStorage.removeItem('dalse-remembered-user');
            }
        } catch (e) {}

        errorEl.textContent = '';
        errorEl.classList.remove('shake');
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            if (username.includes('@')) {
                await firebase.auth().signInWithEmailAndPassword(username, password);
                return;
            }

            const authenticate = firebase.functions().httpsCallable('authenticateUsername');
            const result = await authenticate({ username, password });
            await firebase.auth().signInWithCustomToken(result.data.customToken);
        } catch (error) {
            const message = error.code === 'functions/unauthenticated'
                ? 'Usuario o contraseña incorrectos.'
                : error.code === 'functions/resource-exhausted'
                    ? 'Demasiados intentos. Intenta más tarde.'
                    : 'Error de conexión.';
            authShowError(errorEl, message);
            authResetBtn(submitBtn);
        }
    },

    async handleUserLogin(user) {
        try {
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                await this.logout();
                showToast('No existe un perfil autorizado para esta cuenta.', 'error');
                return;
            }

            const userData = userDoc.data();

            if (userData.active === false) {
                showToast('Tu cuenta ha sido desactivada.', 'error');
                await this.logout();
                return;
            }

            window.currentUserData = userData;
            this.updateUserUI(userData);

            const loadingScreen = document.getElementById('loading-screen');
            const loginScreen = document.getElementById('login-screen');
            const appEl = document.getElementById('app');
            if (loadingScreen) { loadingScreen.style.display = 'none'; loadingScreen.style.pointerEvents = 'none'; }
            if (loginScreen) loginScreen.style.display = 'none';
            if (appEl) appEl.style.display = 'flex';

            if (window.Settings && window.Settings.loadSettings) {
                await window.Settings.loadSettings();
            }
            if (window.App && window.App.init) {
                window.App.init();
            }
        } catch (error) {
            showToast('Error al cargar datos de usuario', 'error');
        } finally {
            authResetBtn(document.getElementById('login-submit-btn'));
        }
    },

    handleUserLogout() {
        window.currentUserData = null;
        if (window.Deliveries) { window.Deliveries.userIsAdmin = false; window.Deliveries.deliveries = []; }
        if (window.App) { window.App.currentModule = null; }

        document.querySelectorAll('.modal-backdrop, .dash-detail-backdrop, .dash-detail-modal, #toast-container, #full-load-overlay').forEach(modal => {
            modal.remove();
        });

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.reset();
            authResetBtn(document.getElementById('login-submit-btn'));
            const errorEl = document.getElementById('login-error');
            if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('shake'); }
        }

        const loadingScreen = document.getElementById('loading-screen');
        const loginScreen = document.getElementById('login-screen');
        const appEl = document.getElementById('app');
        if (loadingScreen) { loadingScreen.style.display = 'none'; loadingScreen.style.pointerEvents = 'none'; }
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appEl) appEl.style.display = 'none';
    },

    updateUserUI(userData) {
        const userName = document.getElementById('user-name');
        const userRole = document.getElementById('user-role');
        const role = (userData.role || 'user').toLowerCase();

        if (userName) userName.textContent = userData.displayName || userData.email;
        if (userRole) {
            let roleLabel = 'Usuario';
            if (role === 'admin') roleLabel = 'Administrador';
            if (role === 'editor') roleLabel = 'Editor';
            userRole.textContent = roleLabel;
        }

        window.permissions = {
            isAdmin: role === 'admin', isEditor: role === 'editor', isUser: role === 'user',
            canCreate: role === 'admin' || role === 'editor',
            canEdit: role === 'admin', canDelete: role === 'admin'
        };

        document.querySelectorAll('.admin-only').forEach(el => {
            if (el.getAttribute('data-module') !== 'users') {
                el.style.display = role === 'admin' ? '' : 'none';
            }
        });
    },

    async logout() {
        try {
            await firebase.auth().signOut();
        } catch (error) {
            showToast('Error al cerrar sesión', 'error');
        }
    },

    getErrorMessage(errorCode) {
        const messages = {
            'auth/email-already-in-use': 'Este correo ya está registrado',
            'auth/invalid-email': 'Correo electrónico inválido',
            'auth/operation-not-allowed': 'Operación no permitida',
            'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
            'auth/user-disabled': 'Esta cuenta ha sido desactivada',
            'auth/user-not-found': 'Usuario no encontrado',
            'auth/wrong-password': 'Contraseña incorrecta',
            'auth/invalid-credential': 'Credenciales inválidas',
            'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde'
        };
        return messages[errorCode] || 'Error de autenticación.';
    }
};

// ===================================
// Password Hashing Helper
// ===================================

async function hashPassword(password) {
    if (crypto.subtle && crypto.subtle.digest) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const chr = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return 'legacy_' + Math.abs(hash).toString(36);
}

function initAuthWhenReady() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        Auth.init();
    } else {
        setTimeout(initAuthWhenReady, 200);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthWhenReady);
} else {
    initAuthWhenReady();
}
