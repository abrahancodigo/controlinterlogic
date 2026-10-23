const AccessControl = {
    modules: [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'interlogic', label: 'Control Interlogic' },
        { key: 'tarimas', label: 'Tarimas Walmart' },
        { key: 'problemas', label: 'Problemas' },
        { key: 'clientes', label: 'Clientes' },
        { key: 'flota', label: 'Flota y Mantenimiento' },
        { key: 'liquidacion', label: 'Liquidación' },
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
        const module = this.modules.find(item => item.key === moduleName);
        const current = user === undefined ? this.currentUser() : user;
        if (!module || !current || current.active === false) return 'hidden';
        return this.role(current) === 'user' || (moduleName === 'users' && this.role(current) !== 'admin') ? 'read' : 'write';
    },

    currentUser() {
        return Auth && Auth.userData ? Auth.userData : null;
    },

    canView(moduleName, user) {
        return this.level(moduleName, user) !== 'hidden';
    },

    apply(moduleName) {
        const user = this.currentUser();
        const role = this.role(user);
        const canWrite = this.level(moduleName, user) === 'write';
        const priv = (user && user.privileges) || {};
        const granted = (key, fallback) => typeof priv[key] === 'boolean' ? priv[key] : fallback;
        window.permissions = Object.assign({}, window.permissions, {
            isAdmin: role === 'admin', isEditor: role === 'editor', isUser: role === 'user',
            canCreate: canWrite, canEdit: canWrite, canDelete: canWrite && role === 'admin',
            manageMetas: granted('manageMetas', canWrite),
            exportData: granted('exportData', true)
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
