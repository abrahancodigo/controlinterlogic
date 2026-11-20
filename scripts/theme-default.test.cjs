const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/js/theme.js'), 'utf8');

function setup(initialStorage = {}) {
    const store = Object.assign({}, initialStorage);
    const root = {
        attrs: {},
        setAttribute(k, v) { this.attrs[k] = v; },
        getAttribute(k) { return this.attrs[k] ?? null; }
    };
    const context = vm.createContext({
        localStorage: {
            getItem: k => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: k => { delete store[k]; }
        },
        document: { documentElement: root },
        window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
        console
    });
    context.window.matchMedia = () => ({ matches: false, addEventListener() {} });
    vm.runInContext(source, context);
    return { tm: context.window.ThemeManager, root, store };
}

test('applyProfileDefault aplica claro cuando no hay tema guardado', () => {
    const { tm, root } = setup();
    const changed = tm.applyProfileDefault('light', 'uidMax');
    assert.equal(changed, true);
    assert.equal(root.getAttribute('data-theme'), 'light');
    assert.equal(root.getAttribute('data-theme-mode'), 'light');
});

test('applyProfileDefault no pisa una eleccion manual previa del usuario', () => {
    const { tm, root } = setup({ 'dalse-theme': 'dark' });
    const changed = tm.applyProfileDefault('light', 'uidMax');
    assert.equal(changed, false);
    assert.equal(root.getAttribute('data-theme'), null);
});

test('applyProfileDefault solo actua una vez por usuario y navegador', () => {
    const { tm, store } = setup();
    assert.equal(tm.applyProfileDefault('light', 'uidMax'), true);
    assert.equal(tm.applyProfileDefault('light', 'uidMax'), false);
    assert.equal(store['dalse-theme-default:uidMax'], 'light');
});

test('applyProfileDefault no persiste en dalse-theme (deja libre al toggle)', () => {
    const { tm, store } = setup();
    tm.applyProfileDefault('light', 'uidMax');
    assert.equal(store['dalse-theme'], undefined);
});

test('applyProfileDefault ignora valores invalidos', () => {
    const { tm, root } = setup();
    assert.equal(tm.applyProfileDefault('neon', 'uidMax'), false);
    assert.equal(root.getAttribute('data-theme'), null);
});

test('El toggle manual sigue funcionando despues del default del perfil', () => {
    const { tm, root, store } = setup();
    tm.applyProfileDefault('light', 'uidMax');
    tm.set('dark');
    assert.equal(root.getAttribute('data-theme'), 'dark');
    assert.equal(store['dalse-theme'], 'dark');
});

test('Marcadores distintos por usuario son independientes', () => {
    const { tm } = setup();
    assert.equal(tm.applyProfileDefault('light', 'uidMax'), true);
    assert.equal(tm.applyProfileDefault('dark', 'uidOtro'), true);
});
