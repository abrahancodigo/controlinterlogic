// ===================================
// Flota - Core Module
// ===================================

const FlotaCore = {
    vehiculos: [],
    mantenimientos: [],
    ordenesTrabajo: [],
    proveedores: [],
    currentView: 'vehiculos',
    unsubscribeVehiculos: null,
    unsubscribeMantenimientos: null,
    unsubscribeOT: null,
    unsubscribeProveedores: null,
    selectedVehiculoId: null,

    async loadData() {
        const db = firebase.firestore();
        return new Promise((resolve) => {
            const loaded = new Set();
            const total = 4;
            const checkDone = (name) => {
                loaded.add(name);
                if (loaded.size >= total) resolve();
            };

            if (this.unsubscribeVehiculos) this.unsubscribeVehiculos();
            this.unsubscribeVehiculos = db.collection('vehiculos')
                .orderBy('nombre', 'asc')
                .onSnapshot(snap => {
                    this.vehiculos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (loaded.size >= total) this._refreshCurrentView();
                    checkDone('vehiculos');
                }, err => { console.error('Error loading vehiculos:', err); checkDone('vehiculos'); });

            if (this.unsubscribeMantenimientos) this.unsubscribeMantenimientos();
            this.unsubscribeMantenimientos = db.collection('mantenimientos')
                .orderBy('fecha', 'desc').limit(200)
                .onSnapshot(snap => {
                    this.mantenimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (loaded.size >= total) this._refreshCurrentView();
                    checkDone('mantenimientos');
                }, err => { console.error('Error loading mantenimientos:', err); checkDone('mantenimientos'); });

            if (this.unsubscribeOT) this.unsubscribeOT();
            this.unsubscribeOT = db.collection('ordenesTrabajo')
                .orderBy('fecha', 'desc').limit(200)
                .onSnapshot(snap => {
                    this.ordenesTrabajo = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (loaded.size >= total) this._refreshCurrentView();
                    checkDone('ordenes');
                }, err => { console.error('Error loading OT:', err); checkDone('ordenes'); });

            if (this.unsubscribeProveedores) this.unsubscribeProveedores();
            this.unsubscribeProveedores = db.collection('proveedores')
                .orderBy('nombre', 'asc')
                .onSnapshot(snap => {
                    this.proveedores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (loaded.size >= total) this._refreshCurrentView();
                    checkDone('proveedores');
                }, err => { console.error('Error loading proveedores:', err); checkDone('proveedores'); });
        });
    },

    _refreshCurrentView() {
        if (window.innerWidth <= 768) {
            if (document.getElementById('flota-content-mobile')) this.renderCurrentViewMobile();
        } else {
            if (document.getElementById('flota-content')) this.renderCurrentView();
        }
    },

    sanitize(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    formatNumber(num, decimals = 0) {
        return Number(num || 0).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },

    diasParaVencimiento(fechaTs) {
        if (!fechaTs) return 9999;
        const fecha = fechaTs.toDate ? fechaTs.toDate() : new Date(fechaTs);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fecha.setHours(0, 0, 0, 0);
        return Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
    },

    async uploadImage(file, path) {
        const storage = firebase.storage();
        const ref = storage.ref(`${path}_${Date.now()}_${file.name}`);
        await ref.put(file);
        return await ref.getDownloadURL();
    },

    buildFotoSlotsHTML(existingUrls) {
        const urls = existingUrls || [];
        let html = '';
        for (let i = 0; i < 4; i++) {
            const url = urls[i];
            if (url) {
                html += `<div class="fv-slot fv-slot-existing" data-url="${url}">
                    <div style="position:relative;">
                        <img src="${url}" style="width:100%;height:70px;object-fit:cover;border-radius:6px;border:1px solid #e5e5ea;">
                        <button type="button" class="fv-slot-remove" style="position:absolute;top:2px;right:2px;width:22px;height:22px;background:#ef4444;color:white;border:none;border-radius:50%;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;padding:0;">×</button>
                        <span style="display:block;text-align:center;font-size:0.65rem;color:#8e8e93;margin-top:2px;">${i + 1}</span>
                    </div>
                </div>`;
            } else {
                html += `<div class="fv-slot fv-slot-new">
                    <input type="file" accept="image/*" style="width:100%;padding:0.2rem;border:2px dashed #e5e5ea;border-radius:6px;font-size:0.75rem;">
                </div>`;
            }
        }
        return html;
    },

    renderFotoPreviews(fotosArray, legacySingleFoto, inputId) {
        const urls = [];
        if (fotosArray && Array.isArray(fotosArray)) {
            fotosArray.forEach((url, i) => {
                if (url) urls.push(`<div style="position:relative;"><img src="${url}" style="width:100%;height:70px;object-fit:cover;border-radius:6px;border:1px solid #e5e5ea;"><span style="display:block;text-align:center;font-size:0.65rem;color:#8e8e93;margin-top:2px;">${i + 1}</span></div>`);
            });
        } else if (legacySingleFoto) {
            urls.push(`<div style="position:relative;"><img src="${legacySingleFoto}" style="width:100%;height:70px;object-fit:cover;border-radius:6px;border:1px solid #e5e5ea;"><span style="display:block;text-align:center;font-size:0.65rem;color:#8e8e93;margin-top:2px;">1</span></div>`);
        }
        if (urls.length === 0) {
            return '<span style="font-size:0.75rem;color:#8e8e93;">Sin fotos</span>';
        }
        return urls.join('');
    },

    showImageModal(url) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10001;cursor:pointer;';
        overlay.innerHTML = `<img src="${url}" style="max-width:90vw;max-height:90vh;border-radius:8px;">`;
        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
    },

    toDateInput(iso) {
        if (!iso) return '';
        try { return iso.split('T')[0]; } catch { return iso; }
    },

    formatDate(fechaTs) {
        if (!fechaTs) return '-';
        try {
            const d = fechaTs.toDate ? fechaTs.toDate() : new Date(fechaTs);
            return d.toLocaleDateString('es-SV');
        } catch { return '-'; }
    }
};

window.FlotaCore = FlotaCore;
