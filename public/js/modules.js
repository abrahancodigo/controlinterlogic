// ===================================
// Module Registry
// Cada módulo se registra a sí mismo con { key, label, render, cleanup }.
// app.js y access.js consultan este registro: si un módulo no está registrado
// (p. ej. se borraron sus <script>), la nav se oculta y el resto del sistema
// sigue funcionando sin él.
// ===================================

const ModuleRegistry = {
    _modules: new Map(),

    register(def) {
        if (!def || !def.key) return;
        this._modules.set(def.key, {
            key: def.key,
            label: def.label || def.key,
            render: typeof def.render === 'function' ? def.render : null,
            cleanup: typeof def.cleanup === 'function' ? def.cleanup : null
        });
    },

    has(key) {
        return this._modules.has(key);
    },

    get(key) {
        return this._modules.get(key) || null;
    },

    keys() {
        return Array.from(this._modules.keys());
    },

    async render(key) {
        const mod = this._modules.get(key);
        if (!mod || !mod.render) return false;
        await mod.render();
        return true;
    },

    cleanup(key) {
        const mod = this._modules.get(key);
        if (!mod || !mod.cleanup) return;
        try {
            mod.cleanup();
        } catch (error) {
            console.error('Error limpiando el módulo ' + key + ':', error);
        }
    }
};

window.ModuleRegistry = ModuleRegistry;
