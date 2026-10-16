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

    role(user = window.currentUserData) {
        const role = String(user?.role || 'user').toLowerCase();
        return ['admin', 'editor', 'user'].includes(role) ? role : 'user';
    },

    label(role) {
        return role === 'admin' ? 'Administrador' : role === 'editor' ? 'Editor' : 'Lector';
    },

    level(moduleName, user = window.currentUserData) {
        const module = this.modules.find(item => item.key === moduleName);
        if (!module || !user || user.active === false) return 'hidden';
        return this.role(user) === 'user' || (moduleName === 'users' && this.role(user) !== 'admin') ? 'read' : 'write';
    },

    canView(moduleName, user = window.currentUserData) {
        return this.level(moduleName, user) !== 'hidden';
    },

    apply(moduleName) {
        const role = this.role();
        const canWrite = this.level(moduleName) === 'write';
        window.permissions = {
            isAdmin: role === 'admin', isEditor: role === 'editor', isUser: role === 'user',
            canCreate: canWrite, canEdit: canWrite, canDelete: canWrite && role === 'admin',
            manageMetas: canWrite, exportData: true
        };
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
