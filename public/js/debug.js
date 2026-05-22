// Debug script - Add to index.html before other scripts
console.log('🔍 Dalse Debug Script Loaded');

// Catch all errors
window.addEventListener('error', function (e) {
    console.error('❌ Global Error:', e.error);
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: white;">
                <h2>❌ Error al cargar</h2>
                <p>${e.message}</p>
                <p style="font-size: 0.875rem; margin-top: 1rem;">
                    Abre la consola del navegador (F12) para más detalles
                </p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: white; color: #6366f1; border: none; border-radius: 0.5rem; cursor: pointer;">
                    Recargar Página
                </button>
            </div>
        `;
    }
});

// Check if Firebase is loaded
window.addEventListener('load', function () {
    console.log('📄 Page loaded');

    setTimeout(() => {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase not loaded!');
            alert('Error: Firebase no se cargó correctamente. Verifica tu conexión a internet.');
        } else {
            console.log('✅ Firebase loaded successfully');
        }
    }, 2000);
});
