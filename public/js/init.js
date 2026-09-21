// Initialization script - loads before everything else
(function () {
    'use strict';

    console.log('🚀 Starting Dalse initialization...');

    window.animateProgressPct = function (el, duration) {
        if (!el) return;
        duration = duration || 2500;
        var start = performance.now();
        var curve = function (t) {
            if (t < 0.15) return t / 0.15 * 0.12;
            if (t < 0.40) return 0.12 + (t - 0.15) / 0.25 * 0.33;
            if (t < 0.65) return 0.45 + (t - 0.40) / 0.25 * 0.27;
            if (t < 0.85) return 0.72 + (t - 0.65) / 0.20 * 0.18;
            return 0.90 + (t - 0.85) / 0.15 * 0.10;
        };
        function tick(now) {
            var elapsed = now - start;
            var t = Math.min(elapsed / duration, 1);
            var pct = Math.round(curve(t) * 100);
            el.textContent = pct + '%';
            if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    };

    // Auto-start percentage counter when loading-screen becomes visible
    document.addEventListener('DOMContentLoaded', function () {
        var ls = document.getElementById('loading-screen');
        if (!ls) return;
        var pctEl = ls.querySelector('.loading-progress-pct');
        if (!pctEl) return;
        if (ls.style.display !== 'none') {
            window.animateProgressPct(pctEl);
        } else {
            new MutationObserver(function () {
                if (ls.style.display !== 'none') {
                    window.animateProgressPct(pctEl);
                }
            }).observe(ls, { attributes: true, attributeFilter: ['style'] });
        }
    });

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
            const wrap = document.createElement('div');
            wrap.style.cssText = 'text-align: center; padding: 2rem; color: white;';
            const h2 = document.createElement('h2');
            h2.style.cssText = 'font-size: 2rem; margin-bottom: 1rem;';
            h2.textContent = '❌ Error';
            const p = document.createElement('p');
            p.style.cssText = 'margin-bottom: 1.5rem;';
            p.textContent = message;
            const btn = document.createElement('button');
            btn.style.cssText = 'padding: 0.75rem 1.5rem; background: white; color: #6366f1; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600;';
            btn.textContent = 'Recargar Página';
            btn.onclick = () => location.reload();
            wrap.append(h2, p, btn);
            loadingScreen.innerHTML = '';
            loadingScreen.appendChild(wrap);
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
