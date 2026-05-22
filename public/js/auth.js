// ===================================
// Authentication Module
// ===================================

const Auth = {
    // Initialize authentication listeners
    init() {
        // Auth state observer
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                await this.handleUserLogin(user);
            } else {
                this.handleUserLogout();
            }
        });

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Auth tabs
        const authTabs = document.querySelectorAll('.auth-tab');
        authTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
        });
    },

    // Handle login form submission
    async handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('login-username').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        const submitBtn = e.target.querySelector('button[type="submit"]');

        errorEl.textContent = '';
        setButtonLoading(submitBtn, true);

        try {
            // EMERGENCY FALLBACK: If input contains '@', try traditional email login
            if (username.includes('@')) {
                console.log('📧 Login de emergencia (correo):', username);
                await firebase.auth().signInWithEmailAndPassword(username, password);
                return;
            }

            // 1. Find user in registry
            console.log('🔍 Buscando usuario en el registro:', username);
            const userRegistryRef = firebase.firestore().collection('user_registry').doc(username);
            let userRegistryDoc = await userRegistryRef.get();

            // SEED: If registry is EMPTY and user is trying 'admin', create it
            const registrySnapshot = await firebase.firestore().collection('user_registry').limit(1).get();
            if (registrySnapshot.empty && username === 'admin') {
                console.log('🌱 Sembrando cuenta admin inicial...');
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
                showToast('🔑 Cuenta inicial: admin / admin123', 'info');
            }

            if (!userRegistryDoc.exists) {
                console.warn('❌ Usuario no encontrado en registro');
                errorEl.textContent = 'Usuario o contraseña incorrectos';
                setButtonLoading(submitBtn, false);
                return;
            }

            const registryData = userRegistryDoc.data();

            // 2. Validate password
            if (registryData.password !== password) {
                console.warn('❌ Contraseña incorrecta');
                errorEl.textContent = 'Usuario o contraseña incorrectos';
                setButtonLoading(submitBtn, false);
                return;
            }

            const internalEmail = registryData.internalEmail || `${username}@dalse.local`;

            // 3. Try to login with Firebase
            try {
                console.log('🔑 Login interno Firebase:', internalEmail);
                await firebase.auth().signInWithEmailAndPassword(internalEmail, password);
            } catch (firebaseError) {
                // 4. Auto-register if not in Firebase Auth
                if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/invalid-credential') {
                    console.log('🆕 Creando usuario en Auth...');
                    try {
                        const userCredential = await firebase.auth().createUserWithEmailAndPassword(internalEmail, password);
                        const user = userCredential.user;

                        await user.updateProfile({ displayName: registryData.displayName });

                        // Check if a user document already exists for this email to avoid duplicates
                        const existingUserSnap = await firebase.firestore().collection('users')
                            .where('email', '==', internalEmail)
                            .limit(1)
                            .get();
                        if (!existingUserSnap.empty) {
                            // Update the existing doc with uid and latest info
                            const existingDocId = existingUserSnap.docs[0].id;
                            await firebase.firestore().collection('users').doc(existingDocId).set({
                                uid: user.uid,
                                email: internalEmail,
                                username: username,
                                displayName: registryData.displayName,
                                role: registryData.role,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                active: true
                            }, { merge: true });
                        } else {
                            // No existing doc, create a new one using the uid as ID
                            await firebase.firestore().collection('users').doc(user.uid).set({
                                uid: user.uid,
                                email: internalEmail,
                                username: username,
                                displayName: registryData.displayName,
                                role: registryData.role,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                active: true
                            });
                        }
                        console.log('✅ Auto-registro exitoso');
                    } catch (regError) {
                        console.error('Auto-reg error:', regError);
                        errorEl.textContent = 'Error al activar la cuenta.';
                        setButtonLoading(submitBtn, false);
                    }
                } else {
                    errorEl.textContent = this.getErrorMessage(firebaseError.code);
                    setButtonLoading(submitBtn, false);
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            errorEl.textContent = 'Error de conexión.';
            setButtonLoading(submitBtn, false);
        }
    },

    // Handle register form submission
    async handleRegister(e) {
        e.preventDefault();

        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const errorEl = document.getElementById('register-error');
        const submitBtn = e.target.querySelector('button[type="submit"]');

        errorEl.textContent = '';
        setButtonLoading(submitBtn, true);

        try {
            // Create user account
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Update profile
            await user.updateProfile({
                displayName: name
            });

            // Check if this is the first user (will be admin)
            const usersSnapshot = await firebase.firestore().collection('users').get();
            const isFirstUser = usersSnapshot.empty;

            // Create user document in Firestore
            await firebase.firestore().collection('users').doc(user.uid).set({
                uid: user.uid,
                email: user.email,
                displayName: name,
                role: isFirstUser ? 'admin' : 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                active: true
            });

            showToast(isFirstUser ?
                '¡Cuenta creada! Eres el administrador.' :
                '¡Cuenta creada exitosamente!',
                'success'
            );

            // User login will be handled by onAuthStateChanged
        } catch (error) {
            console.error('Register error:', error);
            errorEl.textContent = this.getErrorMessage(error.code);
            setButtonLoading(submitBtn, false);
        }
    },

    // Handle user login
    async handleUserLogin(user) {
        try {
            // Get user data from Firestore
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();

            // Check if system has been initialized (has an admin)
            let hasAdmin = false;
            try {
                const configDoc = await firebase.firestore().collection('config').doc('system').get();
                hasAdmin = configDoc.exists && configDoc.data()?.hasAdmin === true;
            } catch (e) {
                console.log('Config check failed, assuming no admin');
            }

            if (!userDoc.exists) {
                // User document doesn't exist, create it
                // If no admin exists, make this user admin
                const newRole = hasAdmin ? 'user' : 'admin';

                await firebase.firestore().collection('users').doc(user.uid).set({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email,
                    role: newRole,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    active: true
                });

                // Mark system as having an admin
                if (newRole === 'admin') {
                    await firebase.firestore().collection('config').doc('system').set({
                        hasAdmin: true,
                        adminSetAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    showToast('¡Bienvenido! Eres el administrador del sistema.', 'success');
                }
            } else {
                // User exists - check if they should be promoted to admin
                const existingData = userDoc.data();
                const role = (existingData.role || 'user').toLowerCase();

                // If no admin exists in the system flag AND this user is not admin,
                // OR if the system flag is missing but this user IS an admin (to fix the flag),
                // handle accordingly.
                if (!hasAdmin) {
                    if (role !== 'admin') {
                        // Promote first logging-in user to admin if flag is missing
                        await firebase.firestore().collection('users').doc(user.uid).update({
                            role: 'admin'
                        });
                        console.log('User promoted to admin (flag was missing)');
                    }

                    // Always set the flag if we are an admin (newly promoted or already was)
                    await firebase.firestore().collection('config').doc('system').set({
                        hasAdmin: true,
                        adminSetAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    console.log('System admin flag set');
                }
            }

            // Re-fetch user data after potential updates
            const updatedUserDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            const userData = updatedUserDoc.exists ? updatedUserDoc.data() : {
                displayName: user.displayName || user.email,
                role: 'user'
            };

            // Check if user is active
            if (userData.active === false) {
                showToast('Tu cuenta ha sido desactivada. Contacta al administrador.', 'error');
                await this.logout();
                return;
            }

            // Store user data globally
            window.currentUserData = userData;

            // Update UI
            this.updateUserUI(userData);

            // Hide login screen, show app
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';

            // Load company branding
            if (window.Settings && window.Settings.loadSettings) {
                await window.Settings.loadSettings();
            }

            // Initialize app
            if (window.App && window.App.init) {
                window.App.init();
            }
        } catch (error) {
            console.error('Error handling user login:', error);
            showToast('Error al cargar datos de usuario', 'error');
        } finally {
            // Always reset login button loading state
            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    setButtonLoading(submitBtn, false);
                }
            }
        }
    },

    // Handle user logout
    handleUserLogout() {
        window.currentUserData = null;

        // Reset Deliveries module state to force fresh role check on next login
        if (window.Deliveries) {
            window.Deliveries.userIsAdmin = false;
            window.Deliveries.deliveries = [];
        }

        // Reset App module to force re-render on next login
        if (window.App) {
            window.App.currentModule = null;
        }

        // Close any open modals
        document.querySelectorAll('[style*="position: fixed"]').forEach(modal => {
            if (modal.id !== 'loading-screen' && modal.id !== 'login-screen' && modal.id !== 'app') {
                modal.remove();
            }
        });

        // Reset login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.reset();
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                setButtonLoading(submitBtn, false);
            }
            const errorEl = document.getElementById('login-error');
            if (errorEl) errorEl.textContent = '';
        }

        // Reset register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.reset();
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                setButtonLoading(submitBtn, false);
            }
            const errorEl = document.getElementById('register-error');
            if (errorEl) errorEl.textContent = '';
        }

        // Show login screen, hide app
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    },

    // Update user UI elements
    updateUserUI(userData) {
        const userName = document.getElementById('user-name');
        const userRole = document.getElementById('user-role');

        const role = (userData.role || 'user').toLowerCase();

        if (userName) {
            userName.textContent = userData.displayName || userData.email;
        }

        if (userRole) {
            let roleLabel = 'Usuario';
            if (role === 'admin') roleLabel = 'Administrador';
            if (role === 'editor') roleLabel = 'Editor';
            userRole.textContent = roleLabel;
        }

        // Setup global permissions for UI logic
        window.permissions = {
            isAdmin: role === 'admin',
            isEditor: role === 'editor',
            isUser: role === 'user',
            canCreate: role === 'admin' || role === 'editor',
            canEdit: role === 'admin',
            canDelete: role === 'admin'
        };

        console.log('🔐 Permissions updated:', window.permissions);

        // Show/hide admin-only elements
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            const isUsersMenuItem = el.getAttribute('data-module') === 'users';
            if (!isUsersMenuItem) {
                el.style.display = role === 'admin' ? '' : 'none';
            }
        });
    },

    // Logout
    async logout() {
        try {
            await firebase.auth().signOut();
            showToast('Sesión cerrada', 'info');
        } catch (error) {
            console.error('Logout error:', error);
            showToast('Error al cerrar sesión', 'error');
        }
    },

    // Switch between login and register tabs
    switchAuthTab(tab) {
        const tabs = document.querySelectorAll('.auth-tab');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        if (tab === 'login') {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        }
    },

    // Get user-friendly error messages
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

        return messages[errorCode] || 'Error de autenticación. Intenta de nuevo.';
    }
};

// Initialize auth when Firebase is ready
function initAuthWhenReady() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        console.log('🔐 Initializing Auth module...');
        Auth.init();
    } else {
        console.log('⏳ Waiting for Firebase before initializing Auth...');
        setTimeout(initAuthWhenReady, 100);
    }
}

// Start checking for Firebase
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthWhenReady);
} else {
    initAuthWhenReady();
}
