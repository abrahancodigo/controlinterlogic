// ===================================
// ThemeManager - Dalse
// Light / Dark / Auto con persistencia y reaccion al sistema
// ===================================

const ThemeManager = {
    STORAGE_KEY: 'dalse-theme',
    VALID_MODES: ['light', 'dark', 'auto'],

    /** Modo elegido por el usuario (light/dark/auto) */
    mode: 'auto',

    /** Tema efectivo aplicado al <html> (light/dark) */
    effective: 'light',

    /** MatchMedia del sistema */
    _mql: null,
    _onSystemChange: null,

    init() {
        // El anti-flash en <head> ya establecio data-theme y data-theme-mode.
        // Solo sincronizamos el estado interno.
        const root = document.documentElement;
        this.mode = root.getAttribute('data-theme-mode') || 'auto';
        this.effective = root.getAttribute('data-theme') || 'light';

        // Listo el sistema para modo auto
        if (window.matchMedia) {
            this._mql = window.matchMedia('(prefers-color-scheme: dark)');
            this._onSystemChange = () => {
                if (this.mode === 'auto') this._applyAuto();
            };
            if (this._mql.addEventListener) {
                this._mql.addEventListener('change', this._onSystemChange);
            } else if (this._mql.addListener) {
                // Safari viejo
                this._mql.addListener(this._onSystemChange);
            }
        }

        // Inyectar la UI del toggle cuando el DOM este listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.renderToggle());
        } else {
            this.renderToggle();
        }

        // Escuchar login/logout para (re)renderizar el toggle segun el sidebar
        document.addEventListener('dalse:auth-changed', () => this.renderToggle());

        console.log(`[Theme] init -> mode=${this.mode}, effective=${this.effective}`);
    },

    /** Lee el modo desde localStorage; cae en 'auto' si no hay o es invalido */
    _readStored() {
        try {
            const v = localStorage.getItem(this.STORAGE_KEY);
            return this.VALID_MODES.includes(v) ? v : 'auto';
        } catch (e) {
            return 'auto';
        }
    },

    /** Resuelve el tema efectivo segun el modo y el sistema */
    _resolveEffective(mode) {
        if (mode === 'dark') return 'dark';
        if (mode === 'light') return 'light';
        // auto
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    },

    /** Aplica al <html> el tema efectivo y persiste el modo */
    _apply(mode, { persist = true } = {}) {
        const root = document.documentElement;
        const effective = this._resolveEffective(mode);
        root.setAttribute('data-theme', effective);
        root.setAttribute('data-theme-mode', mode);
        this.mode = mode;
        this.effective = effective;
        if (persist) {
            try { localStorage.setItem(this.STORAGE_KEY, mode); } catch (e) { /* sin storage */ }
        }
        // Actualizar la UI del toggle si ya existe
        this._updateToggleUI();
        console.log(`[Theme] applied mode=${mode}, effective=${effective}`);
    },

    /** Re-evalua solo cuando estamos en auto */
    _applyAuto() {
        if (this.mode !== 'auto') return;
        const effective = this._resolveEffective('auto');
        const root = document.documentElement;
        if (root.getAttribute('data-theme') !== effective) {
            root.setAttribute('data-theme', effective);
            this.effective = effective;
            this._updateToggleUI();
        }
    },

    /** Cicla entre los 3 modos al hacer click en el toggle */
    cycle() {
        const order = ['light', 'dark', 'auto'];
        const next = order[(order.indexOf(this.mode) + 1) % order.length];
        this._apply(next);
        const labels = { light: 'Claro', dark: 'Oscuro', auto: 'Automático' };
        if (typeof showToast === 'function') {
            showToast(`Tema: ${labels[next]}`, 'info', 2000);
        }
    },

    /** Set explicito (util para test y para wiring futuro) */
    set(mode) {
        if (!this.VALID_MODES.includes(mode)) return;
        this._apply(mode);
    },

    /** Inyecta la fila del toggle dentro del sidebar-footer (entre user-info y logout) */
    renderToggle() {
        const footer = document.querySelector('.sidebar-footer');
        if (!footer) return; // todavia no esta el DOM (login screen)

        // Evitar duplicar
        if (document.getElementById('theme-toggle-row')) return;

        const row = document.createElement('div');
        row.id = 'theme-toggle-row';
        row.className = 'theme-toggle-row';
        row.setAttribute('role', 'group');
        row.setAttribute('aria-label', 'Selector de tema');
        const icons = {
            light: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
            dark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
            auto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`
        };
        row.innerHTML = `
            <button type="button" class="theme-opt" data-mode="light" title="Tema claro" aria-label="Tema claro">
                <span class="theme-opt-icon">${icons.light}</span>
                <span class="theme-opt-label">Claro</span>
            </button>
            <button type="button" class="theme-opt" data-mode="dark" title="Tema oscuro" aria-label="Tema oscuro">
                <span class="theme-opt-icon">${icons.dark}</span>
                <span class="theme-opt-label">Oscuro</span>
            </button>
            <button type="button" class="theme-opt" data-mode="auto" title="Seguir al sistema" aria-label="Seguir al sistema">
                <span class="theme-opt-icon">${icons.auto}</span>
                <span class="theme-opt-label">Auto</span>
            </button>
        `;
        // Insertar antes del boton de logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn && logoutBtn.parentNode === footer) {
            footer.insertBefore(row, logoutBtn);
        } else {
            footer.appendChild(row);
        }

        // Listeners
        row.addEventListener('click', (e) => {
            const btn = e.target.closest('.theme-opt');
            if (!btn) return;
            const mode = btn.getAttribute('data-mode');
            if (mode) this.set(mode);
        });

        this._updateToggleUI();
    },

    /** Marca el boton activo segun this.mode */
    _updateToggleUI() {
        const row = document.getElementById('theme-toggle-row');
        if (!row) return;
        row.querySelectorAll('.theme-opt').forEach((btn) => {
            const isActive = btn.getAttribute('data-mode') === this.mode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }
};

window.ThemeManager = ThemeManager;
