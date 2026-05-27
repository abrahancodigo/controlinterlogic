// ===================================
// User Management Module (Admin Only)
// ===================================

const Users = {
    users: [],

    // Render users management view
    async render() {
        const contentArea = document.getElementById('content-area');
        const isMobile = window.innerWidth <= 768;
        this.isMobile = isMobile;

        contentArea.innerHTML = `
            <div class="content-header" style="${isMobile ? 'padding:0;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; ${isMobile ? 'flex-direction:column;align-items:stretch;gap:0.5rem;' : ''}">
                    <div>
                        <h1 style="${isMobile ? 'font-size:1.35rem;font-weight:800;' : ''}">Gestión de Usuarios</h1>
                        <p style="${isMobile ? 'font-size:0.78rem;color:var(--m-text-secondary);' : ''}">Administra usuarios y sus roles</p>
                    </div>
                    <button class="btn btn-primary" id="btn-add-user" style="${isMobile ? 'min-height:44px;border-radius:10px;width:100%;font-size:0.9rem;' : ''}">➕ Nuevo Usuario</button>
                </div>
            </div>
            
            <div class="card" style="${isMobile ? 'border-radius:var(--m-radius);padding:var(--m-spacing);' : ''}">
                <div class="card-header" style="${isMobile ? 'padding:0 0 0.75rem 0;' : ''}">
                    <h2 style="${isMobile ? 'font-size:1rem;' : ''}">Usuarios Registrados</h2>
                </div>
                <div class="card-body" style="${isMobile ? 'padding:0;' : ''}">
                    <div id="users-table-container">
                        <div style="text-align: center; padding: 2rem;">
                            <div class="loading-spinner" style="margin: 0 auto;"></div>
                            <p>Cargando usuarios...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadUsers();

        // Add event listener for adding users
        document.getElementById('btn-add-user').onclick = () => this.showAddUserForm();
    },

    // Load users from Firestore
    async loadUsers() {
        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .orderBy('createdAt', 'desc')
                .get();

            this.users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            this.renderUsersTable();
        } catch (error) {
            console.error('Error loading users:', error);
            showToast('Error al cargar usuarios', 'error');

            document.getElementById('users-table-container').innerHTML = `
                <p style="text-align: center; color: var(--error); padding: 2rem;">
                    Error al cargar usuarios. Intenta de nuevo.
                </p>
            `;
        }
    },

    // Render users table
    renderUsersTable() {
        const container = document.getElementById('users-table-container');

        if (this.users.length === 0) {
            container.innerHTML = `
                <p style="text-align: center; padding: 2rem; color: var(--text-secondary); ${this.isMobile ? 'font-size:0.85rem;' : ''}">
                    No hay usuarios registrados
                </p>
            `;
            return;
        }

        const currentUserId = firebase.auth().currentUser?.uid;

        if (this.isMobile) {
            container.innerHTML = '<div class="m-data-list">' + this.users.map(user => {
                const isYou = user.id === currentUserId;
                return '<div class="m-data-card" style="padding:12px;">' +
                    '<div class="m-card-header">' +
                    '<span class="m-card-title">' + sanitizeHTML(user.displayName || 'Sin nombre') + '</span>' +
                    (isYou ? '<span class="m-card-badge primary" style="font-size:0.55rem;">TÚ</span>' : '') +
                    '</div>' +
                    '<div class="m-card-rows">' +
                    '<div class="m-card-row"><span class="m-card-label">Email</span><span class="m-card-value" style="font-size:0.78rem;">' + sanitizeHTML(user.email) + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Rol</span><span class="m-card-value">' + (user.role === 'admin' ? 'Administrador' : user.role === 'editor' ? 'Editor' : 'Usuario') + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Estado</span><span class="m-card-value" style="color:' + (user.active !== false ? '#10b981' : '#ef4444') + ';">' + (user.active !== false ? '● Activo' : '● Inactivo') + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Registro</span><span class="m-card-value" style="font-size:0.75rem;">' + (user.createdAt ? formatDate(user.createdAt) : 'N/A') + '</span></div>' +
                    '</div>' +
                    (user.id !== currentUserId ? '<div class="m-card-actions" onclick="event.stopPropagation()" style="justify-content:flex-start;">' +
                        '<button class="m-card-action" onclick="Users.toggleRole(\'' + user.id + '\',\'' + user.role + '\')" title="Cambiar Rol" style="font-size:0.75rem;width:auto;padding:0 12px;border-radius:10px;background:var(--m-primary-light);color:var(--m-primary);">🔄 Rol</button>' +
                        '<button class="m-card-action" onclick="Users.toggleActive(\'' + user.id + '\',' + (user.active !== false) + ')" title="' + (user.active !== false ? 'Desactivar' : 'Activar') + '" style="background:' + (user.active !== false ? '#fef2f2' : '#d1fae5') + ';color:' + (user.active !== false ? '#ef4444' : '#10b981') + ';">' + (user.active !== false ? '🚫' : '✅') + '</button>' +
                        '<button class="m-card-action delete" onclick="Users.deleteUser(\'' + user.id + '\',\'' + (user.username || '') + '\')" title="Eliminar">🗑️</button>' +
                    '</div>' : '<div style="font-size:0.75rem;color:var(--m-text-secondary);text-align:center;padding-top:8px;border-top:0.5px solid var(--m-separator);">Eres tú</div>') +
                '</div>';
            }).join('') + '</div>';
            return;
        }

        const tableHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Correo</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th>Fecha de Registro</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.users.map(user => `
                            <tr>
                                <td>
                                    <strong>${sanitizeHTML(user.displayName || 'Sin nombre')}</strong>
                                    ${user.id === currentUserId ? '<span class="badge badge-admin" style="margin-left: 0.5rem;">Tú</span>' : ''}
                                </td>
                                <td>${sanitizeHTML(user.email)}</td>
                                <td>
                                    <span class="badge ${user.role === 'admin' ? 'badge-admin' : (user.role === 'editor' ? 'badge-editor' : 'badge-user')}">
                                        ${user.role === 'admin' ? 'Administrador' : (user.role === 'editor' ? 'Editor' : 'Usuario')}
                                    </span>
                                </td>
                                <td>
                                    ${user.active !== false ?
                '<span style="color: var(--success);">● Activo</span>' :
                '<span style="color: var(--error);">● Inactivo</span>'
            }
                                </td>
                                <td>${user.createdAt ? formatDate(user.createdAt) : 'N/A'}</td>
                                <td>
                                    ${user.id !== currentUserId ? `
                                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                            <button 
                                                class="btn btn-sm btn-secondary" 
                                                onclick="Users.toggleRole('${user.id}', '${user.role}')"
                                            >
                                                Cambiar Rol
                                            </button>
                                            <button 
                                                class="btn btn-sm ${user.active !== false ? 'btn-danger' : 'btn-success'}" 
                                                onclick="Users.toggleActive('${user.id}', ${user.active !== false})"
                                            >
                                                ${user.active !== false ? 'Desactivar' : 'Activar'}
                                            </button>
                                            <button 
                                                class="btn btn-sm btn-danger" 
                                                onclick="Users.deleteUser('${user.id}', '${user.username || ''}')"
                                                title="Eliminar usuario permanentemente"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ` : '<em style="color: var(--text-tertiary);">No disponible</em>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHTML;
    },

    // Toggle user role (cycles through User -> Editor -> Admin)
    async toggleRole(userId, currentRole) {
        let newRole = 'user';
        if (currentRole === 'user') newRole = 'editor';
        else if (currentRole === 'editor') newRole = 'admin';
        else newRole = 'user';

        const roleLabels = {
            'admin': 'Administrador',
            'editor': 'Editor',
            'user': 'Usuario (Vista)'
        };

        const roleName = roleLabels[newRole];

        // Create custom confirmation modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.5); display: flex;
            align-items: center; justify-content: center; z-index: 10001; padding: 1rem;
        `;
        modal.innerHTML = `
            <div style="background: white; border-radius: 1rem; padding: 2rem; max-width: 400px; width: 100%; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">👤</div>
                <h3 style="margin-bottom: 1rem;">¿Cambiar Rol?</h3>
                <p style="color: #6b7280; margin-bottom: 1.5rem;">El usuario será cambiado a: <strong>${roleName}</strong></p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="btn-cancel" class="btn btn-secondary">Cancelar</button>
                    <button id="btn-confirm" class="btn btn-primary">Sí, Cambiar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-cancel').onclick = () => modal.remove();
        document.getElementById('btn-confirm').onclick = async () => {
            modal.remove();
            try {
                await firebase.firestore().collection('users').doc(userId).update({ role: newRole });
                showToast('Rol actualizado exitosamente', 'success');
                await this.loadUsers();
            } catch (error) {
                console.error('Error updating role:', error);
                showToast('Error al actualizar rol: ' + error.message, 'error');
            }
        };
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    // Toggle user active status
    async toggleActive(userId, currentActive) {
        const newActive = !currentActive;
        const action = newActive ? 'Activar' : 'Desactivar';

        // Create custom confirmation modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.5); display: flex;
            align-items: center; justify-content: center; z-index: 10001; padding: 1rem;
        `;
        modal.innerHTML = `
            <div style="background: white; border-radius: 1rem; padding: 2rem; max-width: 400px; width: 100%; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">${newActive ? '✅' : '🚫'}</div>
                <h3 style="margin-bottom: 1rem;">¿${action} Usuario?</h3>
                <p style="color: #6b7280; margin-bottom: 1.5rem;">${newActive ? 'El usuario podrá acceder al sistema.' : 'El usuario no podrá acceder al sistema.'}</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="btn-cancel-active" class="btn btn-secondary">Cancelar</button>
                    <button id="btn-confirm-active" class="btn ${newActive ? 'btn-success' : 'btn-danger'}">Sí, ${action}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-cancel-active').onclick = () => modal.remove();
        document.getElementById('btn-confirm-active').onclick = async () => {
            modal.remove();
            try {
                await firebase.firestore().collection('users').doc(userId).update({ active: newActive });
                showToast(`Usuario ${newActive ? 'activado' : 'desactivado'} exitosamente`, 'success');
                await this.loadUsers();
            } catch (error) {
                console.error('Error updating user status:', error);
                showToast('Error al actualizar estado: ' + error.message, 'error');
            }
        };
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    // Delete user completely
    async deleteUser(userId, username) {
        if (!await showConfirm('¿Eliminar usuario permanentemente?', 'Esta acción no se puede deshacer. Se borrará el usuario del sistema.')) {
            return;
        }

        try {
            // 1. Delete from 'users' collection
            await firebase.firestore().collection('users').doc(userId).delete();

            // 2. If username exists, also delete from 'user_registry'
            if (username) {
                const registryRef = firebase.firestore().collection('user_registry').doc(username.toLowerCase());
                const registryDoc = await registryRef.get();
                if (registryDoc.exists) {
                    await registryRef.delete();
                }
            }

            showToast('Usuario eliminado correctamente', 'success');
            await this.loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            showToast('Error al eliminar usuario: ' + error.message, 'error');
        }
    }
};

// Make Users available globally
window.Users = Users;

// Add AddUserForm functionality
Users.showAddUserForm = function () {
    const isMobile = window.innerWidth <= 768;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    if (isMobile) {
        modal.style.alignItems = 'flex-end';
        modal.style.padding = '0';
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; ${isMobile ? 'max-height:92vh;border-radius:var(--radius-xl) var(--radius-xl) 0 0;margin-bottom:0;padding:var(--spacing-lg);' : ''}">
            <h2 style="margin-bottom: 1.5rem; ${isMobile ? 'font-size:1.1rem;' : ''}">👥 Nuevo Usuario</h2>
            <form id="add-user-form">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label ${isMobile ? 'style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;"' : ''}>Nombre Completo</label>
                    <input type="text" id="new-user-name" required placeholder="Ej. Juan Pérez" style="${isMobile ? 'min-height:44px;font-size:0.95rem;border-radius:10px;' : ''}">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label ${isMobile ? 'style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;"' : ''}>Nombre de Usuario</label>
                    <input type="text" id="new-user-username" required placeholder="Ej. jhon_doe" style="${isMobile ? 'min-height:44px;font-size:0.95rem;border-radius:10px;' : ''}">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label ${isMobile ? 'style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;"' : ''}>Contraseña</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="password" id="new-user-password" required minlength="6" style="flex: 1; ${isMobile ? 'min-height:44px;font-size:0.95rem;border-radius:10px;' : ''}">
                        <button type="button" class="btn btn-secondary" style="${isMobile ? 'min-height:44px;min-width:44px;border-radius:10px;' : ''}" onclick="document.getElementById('new-user-password').type = document.getElementById('new-user-password').type === 'password' ? 'text' : 'password'">👁️</button>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label ${isMobile ? 'style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;"' : ''}>Rol del Usuario</label>
                    <select id="new-user-role" class="form-control" style="width: 100%; padding: 0.75rem; border: 2px solid var(--gray-200); border-radius: var(--radius-md); ${isMobile ? 'min-height:44px;font-size:0.95rem;border-radius:10px;' : ''}">
                        <option value="user">Usuario (Solo Ver)</option>
                        <option value="editor">Editor (Puede crear)</option>
                        <option value="admin">Administrador (Control total)</option>
                    </select>
                </div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem; ${isMobile ? 'flex-direction:column;' : ''}">
                    <button type="button" class="btn btn-secondary" id="close-user-modal" style="${isMobile ? 'width:100%;min-height:44px;border-radius:10px;' : ''}">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="${isMobile ? 'width:100%;min-height:44px;border-radius:10px;' : ''}">Crear Usuario</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const form = document.getElementById('add-user-form');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);

        const name = document.getElementById('new-user-name').value.trim();
        const username = document.getElementById('new-user-username').value.trim().toLowerCase();
        const password = document.getElementById('new-user-password').value;
        const role = document.getElementById('new-user-role').value;

        try {
            // 1. Check if username already exists in registry
            const userRegistryRef = firebase.firestore().collection('user_registry').doc(username);
            const userRegistryDoc = await userRegistryRef.get();

            if (userRegistryDoc.exists) {
                showToast('Ese nombre de usuario ya existe', 'error');
                setButtonLoading(submitBtn, false);
                return;
            }

            // 2. Save to user_registry (this will be used by login)
            // Note: We don't create the Firebase Auth user yet to avoid logging out the admin.
            // The Firebase Auth user will be created on the first login of this new user.
            const passwordHash = await hashPassword(password);

            await userRegistryRef.set({
                username: username,
                passwordHash: passwordHash,
                displayName: name,
                role: role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                active: true,
                internalEmail: `${username}@dalse.local`
            });
            // Also create a document in the 'users' collection so it appears immediately in the admin UI
            await firebase.firestore().collection('users').add({
                displayName: name,
                email: `${username}@dalse.local`,
                role: role,
                active: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: firebase.auth().currentUser?.uid || null
            });

            showToast('Usuario creado correctamente', 'success');
            modal.remove();
            this.loadUsers();
        } catch (error) {
            console.error('Error creating user:', error);
            showToast('Error al crear usuario: ' + error.message, 'error');
            setButtonLoading(submitBtn, false);
        }
    };

    document.getElementById('close-user-modal').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
};

// ===================================
// Password Hashing Helper
// ===================================

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
