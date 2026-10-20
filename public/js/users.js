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
            ${SharedComponents.renderModuleHeader({
                icon: 'users',
                title: 'Gestión de Usuarios',
                subtitle: 'Administra usuarios y sus roles',
                actions: `<button class="btn btn-primary" id="btn-add-user" ${!window.permissions?.isAdmin ? 'disabled' : ''}>➕ Nuevo Usuario</button>`
            })}
            
            <div class="card" style="${isMobile ? 'border-radius:var(--m-radius);padding:var(--m-spacing);' : ''}">
                <div class="card-header" style="${isMobile ? 'padding:0 0 0.75rem 0;' : ''}">
                    <h2 style="${isMobile ? 'font-size:1rem;' : ''}">Usuarios Registrados</h2>
                </div>
                <div class="card-body" style="${isMobile ? 'padding:0;' : ''}">
                    <div id="users-table-container">
                        <div style="text-align: center; padding: 2rem;">
                            <div class="loading-progress" style="margin: 0 auto;"><div class="loading-progress-bar"><div class="loading-progress-fill"></div></div><div class="loading-progress-pct">0%</div></div>
                            <p>Cargando usuarios...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (window.animateProgressPct) {
            var pctEl = document.querySelector('#users-table-container .loading-progress-pct');
            if (pctEl) window.animateProgressPct(pctEl);
        }

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

        if (!container.dataset.actionsBound) {
            container.dataset.actionsBound = '1';
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn || btn.disabled || !window.permissions?.isAdmin) return;
                const action = btn.dataset.action;
                const uid = btn.dataset.uid;
                if (action === 'toggle-role') Users.toggleRole(uid, btn.dataset.role);
                else if (action === 'toggle-active') Users.toggleActive(uid, btn.dataset.active === 'true');
                else if (action === 'delete-user') Users.deleteUser(uid, btn.dataset.username);

            });
        }

        const disableActions = () => {
            if (!window.permissions?.isAdmin) container.querySelectorAll('[data-action]').forEach(button => { button.disabled = true; });
        };
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
                    '<div class="m-card-row"><span class="m-card-label">Rol</span><span class="m-card-value">' + AccessControl.label(AccessControl.role(user)) + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Estado</span><span class="m-card-value" style="color:' + (user.active !== false ? '#10b981' : '#ef4444') + ';">' + (user.active !== false ? '● Activo' : '● Inactivo') + '</span></div>' +
                    '<div class="m-card-row"><span class="m-card-label">Registro</span><span class="m-card-value" style="font-size:0.75rem;">' + (user.createdAt ? formatDate(user.createdAt) : 'N/A') + '</span></div>' +
                    '</div>' +
                    (user.id !== currentUserId ? '<div class="m-card-actions" style="justify-content:flex-start;">' +
                        '<button class="m-card-action" data-action="toggle-role" data-uid="' + sanitizeHTML(user.id) + '" data-role="' + sanitizeHTML(user.role) + '" title="Cambiar Rol" style="font-size:0.75rem;width:auto;padding:0 12px;border-radius:10px;background:var(--m-primary-light);color:var(--m-primary);">🔄 Rol</button>' +

                        '<button class="m-card-action" data-action="toggle-active" data-uid="' + sanitizeHTML(user.id) + '" data-active="' + (user.active !== false) + '" title="' + (user.active !== false ? 'Desactivar' : 'Activar') + '" style="background:' + (user.active !== false ? '#fef2f2' : '#d1fae5') + ';color:' + (user.active !== false ? '#ef4444' : '#10b981') + ';">' + (user.active !== false ? '🚫' : '✅') + '</button>' +
                        '<button class="m-card-action delete" data-action="delete-user" data-uid="' + sanitizeHTML(user.id) + '" data-username="' + sanitizeHTML(user.username || '') + '" title="Eliminar">🗑️</button>' +
                    '</div>' : '<div style="font-size:0.75rem;color:var(--m-text-secondary);text-align:center;padding-top:8px;border-top:0.5px solid var(--m-separator);">Eres tú</div>') +
                '</div>';
            }).join('') + '</div>';
            disableActions();
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
                                        ${AccessControl.label(AccessControl.role(user))}
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
                                            <button class="btn btn-sm btn-secondary" data-action="toggle-role" data-uid="${sanitizeHTML(user.id)}">Cambiar rol</button>
                                            <button 
                                                class="btn btn-sm ${user.active !== false ? 'btn-danger' : 'btn-success'}" 
                                                data-action="toggle-active" data-uid="${sanitizeHTML(user.id)}" data-active="${user.active !== false}"
                                            >
                                                ${user.active !== false ? 'Desactivar' : 'Activar'}
                                            </button>
                                            <button 
                                                class="btn btn-sm btn-danger" 
                                                data-action="delete-user" data-uid="${sanitizeHTML(user.id)}" data-username="${sanitizeHTML(user.username || '')}"
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
        disableActions();


    },

    // Toggle user role (cycles through User -> Editor -> Admin)
    async toggleRole(userId) {
        if (!window.permissions?.isAdmin || userId === firebase.auth().currentUser?.uid) return;
        const user = this.users.find(item => item.id === userId);
        if (!user) return;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="premium-modal" style="max-width:460px;" role="dialog" aria-modal="true" aria-labelledby="role-title">
                <div class="premium-modal-header">
                    <div class="premium-modal-title">
                        <div class="premium-modal-icon">🛡️</div>
                        <div>
                            <h2 id="role-title">Asignar rol</h2>
                            <p>${sanitizeHTML(user.displayName || user.email || user.id)}</p>
                        </div>
                    </div>
                    <button type="button" class="premium-close" data-role-action="cancel" aria-label="Cerrar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="premium-modal-body">
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label for="user-role-select">Rol del usuario</label>
                        <select id="user-role-select" class="form-control" style="width:100%;">
                            ${[['user', 'Lector'], ['editor', 'Editor'], ['admin', 'Administrador']].map(([value, label]) => `<option value="${value}" ${AccessControl.role(user) === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                    </div>
                    <p style="margin-bottom:0.5rem;">Todos pueden ver el sistema completo.</p>
                    <p style="font-size:0.85rem;color:var(--text-secondary);">Lector: solo consultar. Editor: crear y modificar información, sin gestionar usuarios. Administrador: acceso total y eliminación. El usuario debe volver a iniciar sesión para actualizar sus opciones.</p>
                </div>
                <div class="premium-modal-footer" style="${window.innerWidth <= 768 ? 'flex-direction:column;' : ''}">
                    <button type="button" class="btn btn-secondary" data-role-action="cancel" style="${window.innerWidth <= 768 ? 'width:100%;min-height:44px;' : ''}">Cancelar</button>
                    <button type="button" class="btn btn-gradient" data-role-action="save" style="${window.innerWidth <= 768 ? 'width:100%;min-height:44px;' : ''}">Guardar rol</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', async event => {
            const action = event.target.closest('[data-role-action]')?.dataset.roleAction;
            if (modal.dataset.saving === '1') return;
            if (event.target === modal || action === 'cancel') { modal.remove(); return; }
            if (action !== 'save' || !window.permissions?.isAdmin) return;
            const role = modal.querySelector('#user-role-select').value;
            if (!['user', 'editor', 'admin'].includes(role)) return;
            const button = modal.querySelector('[data-role-action="save"]');
            button.disabled = true;
            modal.dataset.saving = '1';
            try {
                await firebase.firestore().collection('users').doc(userId).update({ role });
                showToast('Rol actualizado. El usuario debe volver a iniciar sesión.', 'success');
                modal.remove();
                await this.loadUsers();
            } catch (error) {
                console.error('Error updating role:', error);
                showToast('No se pudo guardar el rol.', 'error');
                button.disabled = false;
                modal.dataset.saving = '0';
            }
        });
        modal.querySelector('#user-role-select').focus();
    },

    // Toggle user active status
    async toggleActive(userId, currentActive) {
        if (!window.permissions?.isAdmin || userId === firebase.auth().currentUser?.uid) return;
        const newActive = !currentActive;
        const action = newActive ? 'Activar' : 'Desactivar';

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content modal-confirm" role="dialog" aria-modal="true" aria-labelledby="active-title">
                <div class="icon">${newActive ? '✅' : '🚫'}</div>
                <h2 id="active-title" style="margin-bottom: 0.5rem;">¿${action} Usuario?</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">${newActive ? 'El usuario podrá acceder al sistema.' : 'El usuario no podrá acceder al sistema.'}</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button type="button" class="btn btn-secondary" data-active-action="cancel">Cancelar</button>
                    <button type="button" class="btn ${newActive ? 'btn-success' : 'btn-danger'}" data-active-action="confirm">Sí, ${action}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', async event => {
            if (modal.dataset.saving === '1') return;
            const button = event.target.closest('[data-active-action]');
            const choice = button?.dataset.activeAction;
            if (event.target === modal || choice === 'cancel') { modal.remove(); return; }
            if (choice !== 'confirm' || !window.permissions?.isAdmin) return;
            button.disabled = true;
            modal.dataset.saving = '1';
            try {
                await firebase.firestore().collection('users').doc(userId).update({ active: newActive });
                modal.remove();
                showToast(`Usuario ${newActive ? 'activado' : 'desactivado'} exitosamente`, 'success');
                await this.loadUsers();
            } catch (error) {
                console.error('Error updating user status:', error);
                showToast('Error al actualizar estado: ' + error.message, 'error');
                button.disabled = false;
                modal.dataset.saving = '0';
            }
        });
        modal.querySelector('[data-active-action="cancel"]').focus();
    },

    // Delete user completely
    async deleteUser(userId, username) {
        if (!window.permissions?.isAdmin || userId === firebase.auth().currentUser?.uid) return;
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
    if (!window.permissions?.isAdmin) return;
    const isMobile = window.innerWidth <= 768;
    const labelStyle = isMobile ? 'style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;"' : '';
    const fieldStyle = isMobile ? 'min-height:44px;font-size:0.95rem;border-radius:10px;' : '';
    const btnStyle = isMobile ? 'width:100%;min-height:44px;border-radius:10px;' : '';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    modal.innerHTML = `
        <div class="premium-modal" style="max-width:500px;" role="dialog" aria-modal="true" aria-labelledby="add-user-title">
            <div class="premium-modal-header">
                <div class="premium-modal-title">
                    <div class="premium-modal-icon">👥</div>
                    <div>
                        <h2 id="add-user-title">Nuevo Usuario</h2>
                        <p>Crea la cuenta con usuario, contraseña y rol</p>
                    </div>
                </div>
                <button type="button" class="premium-close" data-user-action="close" aria-label="Cerrar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="premium-modal-body">
                <form id="add-user-form">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label ${labelStyle}>Nombre Completo</label>
                        <input type="text" id="new-user-name" required placeholder="Ej. Juan Pérez" style="${fieldStyle}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label ${labelStyle}>Nombre de Usuario</label>
                        <input type="text" id="new-user-username" required placeholder="Ej. jhon_doe" style="${fieldStyle}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label ${labelStyle}>Contraseña</label>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="password" id="new-user-password" required minlength="6" style="flex: 1; ${fieldStyle}">
                            <button type="button" class="btn btn-secondary" style="${isMobile ? 'min-height:44px;min-width:44px;border-radius:10px;' : ''}" onclick="document.getElementById('new-user-password').type = document.getElementById('new-user-password').type === 'password' ? 'text' : 'password'">👁️</button>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label ${labelStyle}>Rol del Usuario</label>
                        <select id="new-user-role" class="form-control" style="width: 100%; padding: 0.75rem; border: 2px solid var(--gray-200); border-radius: var(--radius-md); ${fieldStyle}">
                            <option value="user">Lector (Solo consultar)</option>
                            <option value="editor">Editor (Sin gestión de usuarios)</option>
                            <option value="admin">Administrador (Control total)</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="premium-modal-footer" style="${isMobile ? 'flex-direction:column;' : ''}">
                <button type="button" class="btn btn-secondary" data-user-action="close" style="${btnStyle}">Cancelar</button>
                <button type="submit" class="btn btn-gradient" form="add-user-form" style="${btnStyle}">Crear Usuario</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const form = document.getElementById('add-user-form');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = modal.querySelector('button[type="submit"]');
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

    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('[data-user-action="close"]')) modal.remove();
    });
};


