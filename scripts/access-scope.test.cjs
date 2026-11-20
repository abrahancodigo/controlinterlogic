const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/js/access.js'), 'utf8');

function buildContext(userData) {
    const context = vm.createContext({
        Auth: { userData },
        ModuleRegistry: { has: () => true },
        document: {
            getElementById: () => null,
            querySelectorAll: () => []
        }
    });
    context.window = context;
    vm.runInContext(source, context);
    return { ac: context.AccessControl, ctx: context };
}

test('Usuario sin privilegios de modulos ve todos los modulos', () => {
    const { ac } = buildContext({ role: 'user', active: true });
    assert.equal(ac.canView('dashboard'), true);
    assert.equal(ac.canView('interlogic'), true);
    assert.equal(ac.canView('flota'), true);
});

test('Usuario con modules:[interlogic] solo ve interlogic', () => {
    const { ac } = buildContext({ role: 'user', active: true, privileges: { modules: ['interlogic'] } });
    assert.equal(ac.canView('interlogic'), true);
    assert.equal(ac.canView('dashboard'), false);
    assert.equal(ac.canView('flota'), false);
    assert.equal(ac.canView('entregas'), false);
    assert.equal(ac.canView('users'), false);
});

test('Usuario con readOnly nunca obtiene nivel write', () => {
    const { ac } = buildContext({ role: 'editor', active: true, privileges: { modules: ['interlogic'], readOnly: true } });
    assert.equal(ac.level('interlogic'), 'read');
});

test('Editor sin readOnly obtiene nivel write', () => {
    const { ac } = buildContext({ role: 'editor', active: true, privileges: { modules: ['interlogic'] } });
    assert.equal(ac.level('interlogic'), 'write');
});

test('Admin ignora el alcance de modulos', () => {
    const { ac } = buildContext({ role: 'admin', active: true, privileges: { modules: ['interlogic'] } });
    assert.equal(ac.canView('dashboard'), true);
    assert.equal(ac.canView('users'), true);
});

test('Usuario inactivo no ve nada', () => {
    const { ac } = buildContext({ role: 'user', active: false });
    assert.equal(ac.canView('interlogic'), false);
});

test('apply() marca readOnly y bloquea crear/editar/eliminar', () => {
    const { ac, ctx } = buildContext({ role: 'user', active: true, privileges: { modules: ['interlogic'], entregaScope: ['INTERLOGISTIC'], readOnly: true } });
    ac.apply('interlogic');
    const perms = ctx.permissions;
    assert.equal(perms.readOnly, true);
    assert.equal(perms.canCreate, false);
    assert.equal(perms.canEdit, false);
    assert.equal(perms.canDelete, false);
    assert.deepEqual(Array.from(perms.entregaScope), ['INTERLOGISTIC']);
    assert.deepEqual(Array.from(perms.modules), ['interlogic']);
});

test('apply() en usuario sin alcance deja entregaScope vacio', () => {
    const { ac, ctx } = buildContext({ role: 'editor', active: true });
    ac.apply('interlogic');
    assert.deepEqual(Array.from(ctx.permissions.entregaScope), []);
    assert.equal(ctx.permissions.modules, null);
    assert.equal(ctx.permissions.canEdit, true);
});

test('apply() normaliza entregaScope a mayusculas', () => {
    const { ac, ctx } = buildContext({ role: 'user', active: true, privileges: { entregaScope: ['interlogistic'] } });
    ac.apply('interlogic');
    assert.deepEqual(Array.from(ctx.permissions.entregaScope), ['INTERLOGISTIC']);
});
