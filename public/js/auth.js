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

            const userRegistryRef = firebase.firestore().collection('user_registry').doc(username);
            let userRegistryDoc = await userRegistryRef.get();

            const registrySnapshot = await firebase.firestore().collection('user_registry').limit(1).get();
            if (registrySnapshot.empty && username === 'admin') {
                const adminHash = await hashPassword('admin123');
                await userRegistryRef.set({
                    username: 'admin',
                    passwordHash: adminHash,
                    displayName: 'Admin Principal',
                    role: 'admin',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    active: true,
                    internalEmail: 'admin@dalse.local'
                });
                userRegistryDoc = await userRegistryRef.get();
            }

            if (!userRegistryDoc.exists) {
                authShowError(errorEl, 'Usuario o contraseña incorrectos');
                authResetBtn(submitBtn);
                return;
            }

            const registryData = userRegistryDoc.data();

            const inputHash = await hashPassword(password);
            let passwordValid = false;
            if (registryData.passwordHash) {
                passwordValid = registryData.passwordHash === inputHash;
            } else if (registryData.password) {
                console.warn('[SECURITY] Legacy plaintext password detected for user:', username);
                passwordValid = registryData.password === password;
            }

            if (!passwordValid) {
                authShowError(errorEl, 'Usuario o contraseña incorrectos');
                authResetBtn(submitBtn);
                return;
            }

            const internalEmail = registryData.internalEmail || `${username}@dalse.local`;

            try {
                await firebase.auth().signInWithEmailAndPassword(internalEmail, password);
            } catch (firebaseError) {
                if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/invalid-credential') {
                    try {
                        const userCredential = await firebase.auth().createUserWithEmailAndPassword(internalEmail, password);
                        await userCredential.user.updateProfile({ displayName: registryData.displayName });

                        const existingUserSnap = await firebase.firestore().collection('users')
                            .where('email', '==', internalEmail).limit(1).get();
                        if (!existingUserSnap.empty) {
                            await firebase.firestore().collection('users').doc(existingUserSnap.docs[0].id).set({
                                uid: userCredential.user.uid, email: internalEmail,
                                username, displayName: registryData.displayName,
                                role: registryData.role,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(), active: true
                            }, { merge: true });
                        } else {
                            await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
                                uid: userCredential.user.uid, email: internalEmail,
                                username, displayName: registryData.displayName,
                                role: registryData.role,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(), active: true
                            });
                        }
                        return;
                    } catch (regError) {
                        authShowError(errorEl, 'Error al activar la cuenta.');
                        authResetBtn(submitBtn);
                        return;
                    }
                } else {
                    authShowError(errorEl, this.getErrorMessage(firebaseError.code));
                    authResetBtn(submitBtn);
                }
            }
        } catch (error) {
            authShowError(errorEl, 'Error de conexión.');
            authResetBtn(submitBtn);
        }
    },

    async handleUserLogin(user) {
        try {
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();

            let hasAdmin = false;
            try {
                const configDoc = await firebase.firestore().collection('config').doc('system').get();
                hasAdmin = configDoc.exists && configDoc.data()?.hasAdmin === true;
            } catch (e) {}

            if (!userDoc.exists) {
                const newRole = hasAdmin ? 'user' : 'admin';
                await firebase.firestore().collection('users').doc(user.uid).set({
                    uid: user.uid, email: user.email,
                    displayName: user.displayName || user.email,
                    role: newRole, createdAt: firebase.firestore.FieldValue.serverTimestamp(), active: true
                });
                if (newRole === 'admin') {
                    await firebase.firestore().collection('config').doc('system').set({
                        hasAdmin: true, adminSetAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            } else {
                const existingData = userDoc.data();
                const role = (existingData.role || 'user').toLowerCase();
                if (!hasAdmin) {
                    if (role !== 'admin') {
                        await firebase.firestore().collection('users').doc(user.uid).update({ role: 'admin' });
                    }
                    await firebase.firestore().collection('config').doc('system').set({
                        hasAdmin: true, adminSetAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            }

            const updatedUserDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            const userData = updatedUserDoc.exists ? updatedUserDoc.data() : {
                displayName: user.displayName || user.email, role: 'user'
            };

            if (userData.active === false) {
                showToast('Tu cuenta ha sido desactivada.', 'error');
                await this.logout();
                return;
            }

            window.currentUserData = userData;
            this.updateUserUI(userData);

            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('loading-screen').style.pointerEvents = 'none';
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';

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

        document.querySelectorAll('[style*="position: fixed"]').forEach(modal => {
            if (modal.id !== 'loading-screen' && modal.id !== 'login-screen' && modal.id !== 'app') {
                modal.remove();
            }
        });

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.reset();
            authResetBtn(document.getElementById('login-submit-btn'));
            const errorEl = document.getElementById('login-error');
            if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('shake'); }
        }

        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('loading-screen').style.pointerEvents = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
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
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
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
