// ===================================
// Flota - Coordinator Module
// ===================================

const FlotaApp = {
    ...FlotaCore,
    ...FlotaVehicles,
    ...FlotaMaintenance,
    ...FlotaOrders,

    async init() {
        await this.loadData();
    },

    async render() {
        await this.loadData();
        if (window.innerWidth <= 768) return this.renderMobile();
        return this.renderDesktop();
    },

    async renderDesktop() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div class="module-header">
                <div>
                    <h1>Flota y Mantenimiento</h1>
                    <p>Gestion de vehiculos, mantenimientos, ordenes de trabajo y talleres</p>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn ${this.currentView==='vehiculos'?'btn-primary':'btn-secondary'}" id="fl-tab-vehiculos">Vehiculos</button>
                    <button class="btn ${this.currentView==='mantenimiento'?'btn-primary':'btn-secondary'}" id="fl-tab-mantenimiento">Mantenimiento</button>
                    <button class="btn ${this.currentView==='ordenes'?'btn-primary':'btn-secondary'}" id="fl-tab-ordenes">Ordenes de Trabajo</button>
                    <button class="btn ${this.currentView==='talleres'?'btn-primary':'btn-secondary'}" id="fl-tab-talleres">Talleres</button>
                </div>
            </div>
            <div id="flota-content">
                <div style="text-align:center;padding:2rem;">Cargando datos...</div>
            </div>
        `;

        document.getElementById('fl-tab-vehiculos').addEventListener('click', () => { this.currentView='vehiculos'; this.renderDesktop(); });
        document.getElementById('fl-tab-mantenimiento').addEventListener('click', () => { this.currentView='mantenimiento'; this.renderDesktop(); });
        document.getElementById('fl-tab-ordenes').addEventListener('click', () => { this.currentView='ordenes'; this.renderDesktop(); });
        document.getElementById('fl-tab-talleres').addEventListener('click', () => { this.currentView='talleres'; this.renderDesktop(); });

        this.renderCurrentView();
    },

    async renderMobile() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div style="padding:0.5rem;">
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:1rem;">
                    <button class="btn ${this.currentView==='vehiculos'?'btn-primary':'btn-secondary'}" id="fl-tab-vehiculos-m" style="font-size:0.8rem;padding:0.4rem 0.6rem;">Vehiculos</button>
                    <button class="btn ${this.currentView==='mantenimiento'?'btn-primary':'btn-secondary'}" id="fl-tab-mantenimiento-m" style="font-size:0.8rem;padding:0.4rem 0.6rem;">Manto</button>
                    <button class="btn ${this.currentView==='ordenes'?'btn-primary':'btn-secondary'}" id="fl-tab-ordenes-m" style="font-size:0.8rem;padding:0.4rem 0.6rem;">OT</button>
                    <button class="btn ${this.currentView==='talleres'?'btn-primary':'btn-secondary'}" id="fl-tab-talleres-m" style="font-size:0.8rem;padding:0.4rem 0.6rem;">Talleres</button>
                </div>
                <div id="flota-content-mobile">
                    <div style="text-align:center;padding:1rem;">Cargando...</div>
                </div>
            </div>
        `;
        document.getElementById('fl-tab-vehiculos-m').addEventListener('click', () => { this.currentView='vehiculos'; this.renderMobile(); });
        document.getElementById('fl-tab-mantenimiento-m').addEventListener('click', () => { this.currentView='mantenimiento'; this.renderMobile(); });
        document.getElementById('fl-tab-ordenes-m').addEventListener('click', () => { this.currentView='ordenes'; this.renderMobile(); });
        document.getElementById('fl-tab-talleres-m').addEventListener('click', () => { this.currentView='talleres'; this.renderMobile(); });

        this.renderCurrentViewMobile();
    },

    renderCurrentView() {
        switch (this.currentView) {
            case 'vehiculos': this.renderVehiculos(); break;
            case 'mantenimiento': this.renderMantenimiento(); break;
            case 'ordenes': this.renderOrdenes(); break;
            case 'talleres': this.renderTalleres(); break;
        }
    },

    renderCurrentViewMobile() {
        switch (this.currentView) {
            case 'vehiculos': this.renderVehiculosMobile(); break;
            case 'mantenimiento': this.renderMantenimientoMobile(); break;
            case 'ordenes': this.renderOrdenesMobile(); break;
            case 'talleres': this.renderTalleresMobile(); break;
        }
    },

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.nav-btn-flota').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-view-flota="${view}"]`)?.classList.add('active');
        this.render();
    }
};

window.Flota = FlotaApp;
