const AccessControl = {
    modules: [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'interlogic', label: 'Control Interlogic' },
        { key: 'entregas', label: 'Entregas' },
        { key: 'tarimas', label: 'Tarimas Walmart' },
        { key: 'ivette', label: 'Inventario Ivette' },
        { key: 'problemas', label: 'Problemas' },
        { key: 'clientes', label: 'Clientes' },
        { key: 'flota', label: 'Flota y Mantenimiento' },
        { key: 'deliveries', label: 'Entrega de Muebles' },
        { key: 'kpi', label: 'Evaluación KPI' },
        { key: 'asistencia', label: 'Asistencia' },
        { key: 'settings', label: 'Configuraciones' },
        { key: 'users', label: 'Gestión de Usuarios' }
    ],

    role(user) {
        const current = user === undefined ? this.currentUser() : user;
        const role = String(current?.role || 'user').toLowerCase();
        return ['admin', 'editor', 'user'].includes(role) ? role : 'user';
    },

    label(role) {
        return role === 'admin' ? 'Administrador' : role === 'editor' ? 'Editor' : 'Lector';
    },

    level(moduleName, user) {
        if (window.ModuleRegistry && !ModuleRegistry.has(moduleName)) return 'hidden';
        const module = this.modules.find(item => item.key === moduleName);
        const current = user === undefined ? this.currentUser() : user;
        if (!module || !current || current.active === false) return 'hidden';
        const role = this.role(current);
        if (moduleName === 'users' && role !== 'admin') return 'hidden';
        if (role !== 'admin') {
            const priv = current.privileges || {};
            if (Array.isArray(priv.modules) && priv.modules.length && !priv.modules.includes(moduleName)) return 'hidden';
            if (priv.readOnly === true) return 'read';
        }
        return role === 'user' ? 'read' : 'write';
    },

    currentUser() {
        const auth = (typeof Auth !== 'undefined') ? Auth : (window.Auth || null);
        return auth && auth.userData ? auth.userData : null;
    },

    canView(moduleName, user) {
        return this.level(moduleName, user) !== 'hidden';
    },

    basePermissions(user) {
        const role = this.role(user);
        const priv = (user && user.privileges) || {};
        const granted = (key, fallback) => typeof priv[key] === 'boolean' ? priv[key] : fallback;
        const readOnly = role !== 'admin' && priv.readOnly === true;
        const canWriteRole = (role === 'admin' || role === 'editor') && !readOnly;
        const perms = {
            isAdmin: role === 'admin', isEditor: role === 'editor', isUser: role === 'user',
            canCreate: canWriteRole, canEdit: canWriteRole, canDelete: role === 'admin' && !readOnly,
            readOnly: readOnly,
            modules: role === 'admin' || !Array.isArray(priv.modules) || !priv.modules.length ? null : priv.modules,
            entregaScope: role === 'admin' || !Array.isArray(priv.entregaScope) ? [] : priv.entregaScope.map(v => String(v).toUpperCase()),
            manageMetas: role === 'admin' ? true : granted('manageMetas', canWriteRole),
            exportData: role === 'admin' ? true : granted('exportData', true),
            themeDefault: null
        };
        const catalog = window.PRIVILEGES || [];
        catalog.forEach(p => {
            perms[p.key] = role === 'admin' ? true : (typeof priv[p.key] === 'boolean' ? priv[p.key] : p.def);
        });
        return perms;
    },

    apply(moduleName) {
        const user = this.currentUser();
        const role = this.role(user);
        const level = this.level(moduleName, user);
        const canWrite = level === 'write';
        window.permissions = Object.assign({}, this.basePermissions(user), {
            canCreate: canWrite,
            canEdit: canWrite,
            canDelete: canWrite && role === 'admin',
            readOnly: level === 'read',
            themeDefault: (window.permissions && window.permissions.themeDefault) || null
        });
        const roleLabel = document.getElementById('user-role');
        if (roleLabel) roleLabel.textContent = this.label(role);
    },

    syncNavigation() {
        const query = (document.getElementById('ux-global-search')?.value || '').toLowerCase().trim();
        document.querySelectorAll('.nav-item[data-module], .bn-item[data-module]').forEach(item => {
            const label = (item.getAttribute('data-ux-label') || item.textContent || '').toLowerCase();
            const visible = this.canView(item.dataset.module) && (!item.classList.contains('nav-item') || !query || label.includes(query));
            item.style.display = visible ? '' : 'none';
        });
    }
};

window.AccessControl = AccessControl;
