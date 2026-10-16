const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(mobile = false) {
    const elements = {};
    for (const id of ['interlogic-table-body', 'interlogic-table-footer', 'il-pagination-top', 'm-data-list']) {
        elements[id] = { innerHTML: 'Cargando...', style: {} };
    }
    const listeners = [];
    const query = {
        where() { return this; }, orderBy() { return this; }, limit() { return this; },
        onSnapshot(next, error) { listeners.push({ next, error }); return () => {}; }
    };
    function firestore() { return { collection: () => query }; }
    firestore.Timestamp = { fromDate: value => value };
    const context = vm.createContext({
        window: {}, localStorage: { getItem: () => null }, firebase: { firestore },
        document: { getElementById: id => elements[id] || null, querySelectorAll: () => [] },
        console: { error() {} }, showToast() {}, showFullLoadOverlay() {},
        setTimeout, clearTimeout, requestAnimationFrame: fn => fn(),
        formatCurrencySigned: value => String(value), formatNumber: value => String(value),
        sanitizeHTML: value => String(value),
        fetchAllChunked: async () => { throw Error('permission-denied'); }
    });
    for (const file of ['core', 'render', 'filters', 'crud']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/interlogic/' + file + '.js'), 'utf8'), context);
    }
    const il = Object.assign({}, context.window.InterlogicCore, context.window.InterlogicRender, context.window.InterlogicFilters, context.window.InterlogicCRUD);
    il.isMobile = mobile;
    il.updateMobileControls = () => {};
    return { il, listeners, elements, target: elements[mobile ? 'm-data-list' : 'interlogic-table-body'] };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 100));
const snapshot = records => ({ size: records.length, docs: records.map(r => ({ id: r.id, data: () => r })), docChanges: () => records.map(() => ({ type: 'added' })) });

for (const mobile of [false, true]) {
    test(`Consulta inicial vacía finaliza la carga en ${mobile ? 'móvil' : 'escritorio'}`, async () => {
        const { il, listeners, target } = setup(mobile);
        il.records = [{ id: 'anterior' }];
        await il.loadRecords(true);
        listeners[0].next(snapshot([]));
        await flush();
        assert.equal(il.records.length, 0);
        assert.match(target.innerHTML, /Sin registros|No hay registros aquí/);
    });
    test(`Error de consulta finaliza la carga en ${mobile ? 'móvil' : 'escritorio'}`, async () => {
        const { il, listeners, target } = setup(mobile);
        await il.loadRecords(true);
        listeners[0].error(Error('permission-denied'));
        assert.match(target.innerHTML, /No se pudieron cargar/);
        assert.doesNotMatch(target.innerHTML, /Cargando/);
    });
}

test('Actualizaciones con documentos siguen procesándose', async () => {
    const { il, listeners } = setup();
    let updates = 0;
    il.scheduleApplyFilters = () => updates++;
    await il.loadRecords(true);
    listeners[0].next(snapshot([{ id: 'primero' }]));
    listeners[0].next(snapshot([{ id: 'segundo' }]));
    assert.equal(updates, 2);
    assert.equal(il.records[0].id, 'segundo');
});

test('Error en rango histórico libera la carga y muestra el fallo', async () => {
    const { il, target } = setup();
    await il.loadFullRange();
    assert.equal(il._loadingRecords, false);
    assert.match(target.innerHTML, /No se pudieron cargar/);
});


test('Reintentar después de un error vuelve a procesar la consulta', async () => {
    const { il, listeners, target } = setup();
    await il.loadRecords(true);
    listeners[0].error(Error('unavailable'));
    assert.match(target.innerHTML, /data-il-retry/);
    await il.reloadListener(true);
    assert.equal(listeners.length, 2);
    listeners[1].next(snapshot([]));
    await flush();
    assert.match(target.innerHTML, /Sin registros/);
    assert.doesNotMatch(target.innerHTML, /No se pudieron cargar/);
});
