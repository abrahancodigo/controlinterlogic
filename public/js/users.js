// ===================================
// User Management Module (Admin Only)
// ===================================

const Users = {
    users: [],

    // Render users management view
    async render() {
        const contentArea = document.getElementById('content-area');

        contentArea.innerHTML = `
            <div class="content-header">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div>
                        <h1>Gestión de Usuarios</h1>
                        <p>Administra usuarios y sus roles en el sistema</p>
                    </div>
                    <button class="btn btn-primary" id="btn-add-user">➕ Nuevo Usuario</button>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2>Usuarios Registrados</h2>
                </div>
                <div class="card-body">
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
                <p style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    No hay usuarios registrados
                </p>
            `;
            return;
        }

        const currentUserId = firebase.auth().currentUser?.uid;

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
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <h2 style="margin-bottom: 1.5rem;">👥 Nuevo Usuario</h2>
            <form id="add-user-form">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Nombre Completo</label>
                    <input type="text" id="new-user-name" required placeholder="Ej. Juan Pérez">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Nombre de Usuario (Para entrar)</label>
                    <input type="text" id="new-user-username" required placeholder="Ej. jhon_doe">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Contraseña</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="password" id="new-user-password" required minlength="6" style="flex: 1;">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('new-user-password').type = document.getElementById('new-user-password').type === 'password' ? 'text' : 'password'">👁️</button>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label>Rol del Usuario</label>
                    <select id="new-user-role" class="form-control" style="width: 100%; padding: 0.75rem; border: 2px solid var(--gray-200); border-radius: var(--radius-md);">
                        <option value="user">Usuario (Solo Ver)</option>
                        <option value="editor">Editor (Puede crear)</option>
                        <option value="admin">Administrador (Control total)</option>
                    </select>
                </div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                    <button type="button" class="btn btn-secondary" id="close-user-modal">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Crear Usuario</button>
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
            await userRegistryRef.set({
                username: username,
                password: password, // Store in plaintext for simplicity as requested, but could be MD5 or similar
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
