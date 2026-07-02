// Initialization script - loads before everything else
(function () {
    'use strict';

    console.log('🚀 Starting Dalse initialization...');

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

    function initApp() {
        console.log('📄 DOM ready');

        // Inicializar tema lo antes posible (no depende de Firebase)
        if (window.ThemeManager && typeof window.ThemeManager.init === 'function') {
            window.ThemeManager.init();
        }

        // Wait for Firebase SDK to load (increased timeout for mobile)
        let attempts = 0;
        const maxAttempts = 50;

        const checkFirebase = setInterval(() => {
            attempts++;

            if (typeof firebase !== 'undefined') {
                clearInterval(checkFirebase);
                console.log('✅ Firebase SDK loaded');
                initializeFirebase();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkFirebase);
                console.error('❌ Firebase SDK failed to load after', maxAttempts, 'attempts');
                showError('No se pudo cargar Firebase. Verifica tu conexión a internet.');
            } else {
                console.log('⏳ Waiting for Firebase SDK... attempt', attempts);
            }
        }, 500);
    }

    function initializeFirebase() {
        try {
            const firebaseConfig = {
                apiKey: "AIzaSyDRgqpevJMpXqyez3uWpgyFZmy7SwrgNEk",
                authDomain: "dalse-e7b96.firebaseapp.com",
                projectId: "dalse-e7b96",
                storageBucket: "dalse-e7b96.firebasestorage.app",
                messagingSenderId: "817518560330",
                appId: "1:817518560330:web:3801a8c2aae41ff2abd2b3"
            };

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log('✅ Firebase initialized');
            }

            // Enable Firestore persistence (catch all errors for mobile Safari)
            firebase.firestore().enablePersistence()
                .then(() => console.log('✅ Firestore persistence enabled'))
                .catch(err => {
                    console.warn('Persistence warning:', err.code, err.message);
                    // Non-fatal: app works without persistence
                });

            // Now initialize the app
            if (window.App && typeof window.App.init === 'function') {
                // Don't call App.init here, let auth.js handle it
                console.log('✅ App module ready');
            }

        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            showError('Error al inicializar Firebase: ' + error.message);
        }
    }

    function showError(message) {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: white;">
                    <h2 style="font-size: 2rem; margin-bottom: 1rem;">❌ Error</h2>
                    <p style="margin-bottom: 1.5rem;">${message}</p>
                    <button onclick="location.reload()" style="padding: 0.75rem 1.5rem; background: white; color: #6366f1; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600;">
                        Recargar Página
                    </button>
                </div>
            `;
        }
    }

    // Global error handler
    window.addEventListener('error', function (e) {
        console.error('❌ Global error:', e.message, 'at', e.filename, 'line', e.lineno);
    });

    window.addEventListener('unhandledrejection', function (e) {
        console.error('❌ Unhandled promise rejection:', e.reason);
    });
})();
