// ===================================
// Authentication Module
// ===================================

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
    },

    async handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('login-username').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        const submitBtn = document.getElementById('login-submit-btn');

        errorEl.textContent = '';
        setButtonLoading(submitBtn, true);

        try {
            if (username.includes('@')) {
                await firebase.auth().signInWithEmailAndPassword(username, password);
                return;
            }

            const userRegistryRef = firebase.firestore().collection('user_registry').doc(username);
            let userRegistryDoc = await userRegistryRef.get();

            const registrySnapshot = await firebase.firestore().collection('user_registry').limit(1).get();
            if (registrySnapshot.empty && username === 'admin') {
                await userRegistryRef.set({
                    username: 'admin',
                    password: 'admin123',
                    displayName: 'Admin Principal',
                    role: 'admin',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    active: true,
                    internalEmail: 'admin@dalse.local'
                });
                userRegistryDoc = await userRegistryRef.get();
            }

            if (!userRegistryDoc.exists) {
                errorEl.textContent = 'Usuario o contraseña incorrectos';
                setButtonLoading(submitBtn, false);
                return;
            }

            const registryData = userRegistryDoc.data();

            if (registryData.password !== password) {
                errorEl.textContent = 'Usuario o contraseña incorrectos';
                setButtonLoading(submitBtn, false);
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
                    } catch (regError) {
                        errorEl.textContent = 'Error al activar la cuenta.';
                        setButtonLoading(submitBtn, false);
                    }
                } else {
                    errorEl.textContent = this.getErrorMessage(firebaseError.code);
                    setButtonLoading(submitBtn, false);
                }
            }
        } catch (error) {
            errorEl.textContent = 'Error de conexión.';
            setButtonLoading(submitBtn, false);
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
            const submitBtn = document.getElementById('login-submit-btn');
            if (submitBtn) setButtonLoading(submitBtn, false);
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
            const submitBtn = document.getElementById('login-submit-btn');
            if (submitBtn) setButtonLoading(submitBtn, false);
            const errorEl = document.getElementById('login-error');
            if (errorEl) errorEl.textContent = '';
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
