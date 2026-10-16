const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../public/js/' + name + '.js'), 'utf8');

function setup(user) {
    const context = vm.createContext({ document: { getElementById: () => null }, window: { currentUserData: user, PRIVILEGES: [{ key: 'exportData', def: true }, { key: 'manageMetas', def: true }] }, console });
    vm.runInContext(read('access'), context);
    return { context, access: context.window.AccessControl };
}

for (const role of ['user', 'editor', 'admin']) {
    test(`Tarimas visible sin configuración previa para ${role}`, () => {
        const { access } = setup({ role });
        assert.equal(access.canView('tarimas'), true);
        assert.equal(access.level('tarimas'), role === 'user' ? 'read' : 'write');
    });
}

test('Solo lectura no obtiene escritura aunque se configure write', () => {
    const { access, context } = setup({ role: 'user', moduleAccess: { tarimas: 'write' } });
    access.apply('tarimas');
    assert.equal(context.window.permissions.canCreate, false);
    assert.equal(context.window.permissions.canEdit, false);
    assert.equal(context.window.permissions.canDelete, false);
});

test('Editor escribe en todos los módulos operativos e ignora permisos antiguos', () => {
    const { access, context } = setup({ role: 'editor', moduleAccess: { tarimas: 'hidden', interlogic: 'read' }, privileges: { exportData: false, manageMetas: false } });
    context.document = { getElementById: () => null };
    for (const module of access.modules) {
        assert.equal(access.canView(module.key), true);
        access.apply(module.key);
        assert.equal(context.window.permissions.canEdit, module.key !== 'users');
        assert.equal(context.window.permissions.canCreate, module.key !== 'users');
        assert.equal(context.window.permissions.canDelete, false);
        assert.equal(context.window.permissions.exportData, true);
    }
});

test('Administrador conserva acceso completo a gestión y módulos', () => {
    const { access, context } = setup({ role: 'admin', moduleAccess: { users: 'hidden', tarimas: 'hidden' } });
    for (const module of access.modules) assert.equal(access.level(module.key), 'write');
    access.apply('tarimas');
    assert.equal(context.window.permissions.canDelete, true);
});

test('Sin perfil, cuenta inactiva o módulo desconocido no dan acceso', () => {
    for (const user of [null, { role: 'admin', active: false }]) {
        const { access } = setup(user);
        for (const module of access.modules) assert.equal(access.canView(module.key), false);
    }
    assert.equal(setup({ role: 'admin' }).access.canView('inexistente'), false);
});

test('La navegación permite consultar Usuarios y Configuraciones a todos los roles', async () => {
    for (const role of ['user', 'editor', 'admin']) {
        const { context, access } = setup({ role });
        const loaded = [];
        Object.assign(context, { AccessControl: access, showToast: () => assert.fail('No debe bloquear el acceso') });
        context.window.Users = { render: async () => loaded.push('users') };
        context.window.Settings = { init: async () => loaded.push('settings') };
        vm.runInContext(read('app'), context);
        const app = context.window.App;
        app.updateBottomNavActive = () => {};
        await app.loadModule('users');
        await app.loadModule('settings');
        assert.deepEqual(loaded, ['users', 'settings']);
    }
});

test('Menús de escritorio y móvil muestran todos los módulos al lector', () => {
    const { context, access } = setup({ role: 'user', moduleAccess: { interlogic: 'hidden' } });
    const nodes = ['tarimas', 'interlogic', 'users'].flatMap(module => [true, false].map(sidebar => ({
        dataset: { module }, textContent: module, style: {}, getAttribute: () => module,
        classList: { contains: () => sidebar }
    })));
    context.document = { getElementById: () => null, querySelectorAll: () => nodes };
    access.syncNavigation();
    assert.equal(nodes[0].style.display, '');
    assert.equal(nodes[1].style.display, '');
    for (const node of nodes) assert.equal(node.style.display, '');
    context.window.currentUserData = { role: 'admin' };
    access.syncNavigation();
    for (const node of nodes) assert.equal(node.style.display, '');
});

for (const mobile of [true, false]) {
    test(`Botones de rol funcionan en ${mobile ? 'móvil' : 'escritorio'} sin duplicar listeners`, () => {
        const { context, access } = setup({ role: 'admin' });
        const listeners = [];
        const container = { dataset: {}, innerHTML: '', querySelectorAll: () => [], addEventListener: (type, fn) => listeners.push(fn) };
        Object.assign(context, {
            AccessControl: access,
            document: { getElementById: () => container },
            firebase: { auth: () => ({ currentUser: { uid: 'admin' } }) },
            sanitizeHTML: value => String(value || '')
        });
        vm.runInContext(read('users'), context);
        const users = context.window.Users;
        context.window.permissions = { isAdmin: true };
        users.isMobile = mobile;
        users.users = [{ id: 'other', role: 'user', email: 'example@example.com' }];
        users.renderUsersTable();
        users.renderUsersTable();
        assert.equal(listeners.length, 1);
        assert.doesNotMatch(container.innerHTML, /stopPropagation/);
        assert.match(container.innerHTML, /data-action="toggle-role"/);
        assert.doesNotMatch(container.innerHTML, /Privilegios|data-module-access/);
        let selected;
        users.toggleRole = uid => { selected = uid; };
        context.window.permissions = { isAdmin: true };
        listeners[0]({ target: { closest: () => ({ dataset: { action: 'toggle-role', uid: 'other' } }) } });
        assert.equal(selected, 'other');
    });
}


test('Tarimas de solo lectura bloquea formulario, guardado y eliminación', async () => {
    const { context, access } = setup({ role: 'user' });
    let notices = 0;
    Object.assign(context, { AccessControl: access, showToast: () => notices++ });
    access.apply('tarimas');
    vm.runInContext(read('tarimas'), context);
    context.window.Tarimas.showForm('ingreso');
    await context.window.Tarimas.saveMovimiento('ingreso');
    await context.window.Tarimas.deleteMovimiento('record');
    assert.equal(notices, 3);
});

test('Liquidación de solo lectura no abre formularios ni envía escrituras', async () => {
    const { context, access } = setup({ role: 'user' });
    let notices = 0;
    Object.assign(context, { AccessControl: access, showToast: () => notices++ });
    access.apply('liquidacion');
    vm.runInContext(read('liquidacion'), context);
    const liq = context.window.Liquidacion;
    liq._openPay('record');
    liq._openNewRoute();
    await assert.rejects(liq._commitChunks([{ t: 'update' }]), /No tienes permiso/);
    assert.equal(notices, 2);
    context.window.currentUserData.role = 'editor';
    access.apply('liquidacion');
    await assert.rejects(liq._commitChunks([{ t: 'delete' }]), /Solo el administrador/);
});


test('Lector no puede modificar configuración ni gestionar cuentas mediante llamadas directas', async () => {
    const { context, access } = setup({ role: 'user' });
    let warnings = 0;
    Object.assign(context, {
        AccessControl: access, showToast: () => warnings++,
        firebase: { auth: () => ({ currentUser: { uid: 'reader' } }) }
    });
    access.apply('settings');
    vm.runInContext(read('settings'), context);
    const settings = context.window.Settings;
    await settings.handleSubmit({ preventDefault() {} });
    await settings.handleFinancialSubmit({ preventDefault() {} });
    await settings.handleLogoUpload({});
    settings.removeLogo(1);
    assert.equal(warnings, 4);
    vm.runInContext(read('users'), context);
    for (const role of ['user', 'editor']) {
        context.window.currentUserData.role = role;
        access.apply('users');
        const users = context.window.Users;
        await users.toggleRole('other');
        await users.toggleActive('other', true);
        await users.deleteUser('other');
        users.showAddUserForm();
    }
});


test('Asignar rol guarda solo el rol y evita envíos duplicados', async () => {
    const { context, access } = setup({ role: 'admin' });
    const writes = [];
    let click;
    const select = { value: 'editor', focus() {} };
    const save = { disabled: false };
    const modal = {
        dataset: {}, innerHTML: '', remove() {},
        addEventListener(type, handler) { if (type === 'click') click = handler; },
        querySelector(selector) { return selector === '#user-role-select' ? select : save; }
    };
    Object.assign(context, {
        AccessControl: access, showToast() {}, sanitizeHTML: value => String(value),
        document: { getElementById: () => null, createElement: () => modal, body: { appendChild() {} } },
        firebase: { auth: () => ({ currentUser: { uid: 'admin' } }), firestore: () => ({ collection: () => ({ doc: id => ({ update: async data => writes.push({ id, data }) }) }) }) }
    });
    access.apply('users');
    vm.runInContext(read('users'), context);
    const users = context.window.Users;
    users.users = [{ id: 'other', role: 'user', displayName: 'Usuario' }];
    users.loadUsers = async () => {};
    await users.toggleRole('other');
    assert.match(modal.innerHTML, /Lector/);
    assert.doesNotMatch(modal.innerHTML, /data-module-access|data-priv/);
    const event = { target: { closest: () => ({ dataset: { roleAction: 'save' } }) } };
    await Promise.all([click(event), click(event)]);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].id, 'other');
    assert.equal(JSON.stringify(writes[0].data), JSON.stringify({ role: 'editor' }));
});
