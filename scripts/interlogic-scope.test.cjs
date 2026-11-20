const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/js/interlogic/crud.js'), 'utf8');

function buildContext(permissions) {
    const calls = [];
    function queryNode() {
        const node = {
            _type: 'query',
            where(field, op, value) { calls.push({ kind: 'where', field, op, value }); node._type = 'query'; return node; },
            orderBy(field, dir) { calls.push({ kind: 'orderBy', field, dir }); return node; },
            limit(n) { calls.push({ kind: 'limit', n }); return node; },
            onSnapshot(cb) { calls.push({ kind: 'onSnapshot' }); return () => {}; },
            get() { return Promise.resolve({ docs: [], size: 0, empty: true }); }
        };
        return node;
    }
    const firestore = () => {
        const base = queryNode();
        base.collection = name => {
            calls.push({ kind: 'collection', name });
            const col = queryNode();
            col.where = (f, o, v) => { calls.push({ kind: 'where', field: f, op: o, value: v }); return col; };
            col.orderBy = (f, d) => { calls.push({ kind: 'orderBy', field: f, dir: d }); return col; };
            col.limit = n => { calls.push({ kind: 'limit', n }); return col; };
            col.onSnapshot = cb => { calls.push({ kind: 'onSnapshot' }); return () => {}; };
            return col;
        };
        return base;
    };
    firestore.Timestamp = { fromDate: d => d };
    firestore.FieldValue = { serverTimestamp: () => 'ts' };

    const document = { getElementById: () => null, querySelector: () => null, body: { appendChild() {} }, createElement: () => ({}) };
    const context = vm.createContext({
        window: { permissions },
        document,
        firebase: { firestore },
        console,
        setTimeout,
        clearTimeout,
        sanitizeHTML: v => String(v),
        showToast: () => {},
        showFullLoadOverlay: () => {},
        getLocalDateString: () => '2026-11-20',
        RT_MAX_RECORDS: 800,
        fetchAllChunked: async q => { calls.push({ kind: 'fetchAllChunked' }); return []; },
        formatDate: v => String(v),
        formatDateShort: v => String(v),
        formatDateForInput: d => String(d),
        formatCurrency: n => String(n),
        InterlogicFilters: { apply: () => {} },
        InterlogicRender: { render: () => {}, renderLoadingRow: () => {} }
    });
    vm.runInContext(source, context);
    const crud = context.window.InterlogicCRUD || context.InterlogicCRUD;
    return { crud, calls };
}

test('Sin alcance de entrega, la consulta no filtra por entrega', () => {
    const { crud, calls } = buildContext({ entregaScope: [] });
    assert.equal(crud._scopeQuery({ where() { return this; } }) !== null, true);
    assert.equal(calls.filter(c => c.kind === 'where' && c.field === 'entrega').length, 0);
});

test('Con alcance INTERLOGISTIC, _scopeQuery agrega where entrega in [INTERLOGISTIC]', () => {
    const { crud, calls } = buildContext({ entregaScope: ['INTERLOGISTIC'] });
    const q = { where(field, op, value) { calls.push({ kind: 'where', field, op, value }); return q; } };
    crud._scopeQuery(q);
    const entregaWhere = calls.filter(c => c.kind === 'where' && c.field === 'entrega');
    assert.equal(entregaWhere.length, 1);
    assert.equal(entregaWhere[0].op, 'in');
    assert.deepEqual(Array.from(entregaWhere[0].value), ['INTERLOGISTIC']);
});

test('_entregaScope devuelve null cuando no hay permisos definidos', () => {
    const { crud } = buildContext({});
    assert.equal(crud._entregaScope(), null);
});

test('_entregaScope devuelve el arreglo cuando hay permisos', () => {
    const { crud } = buildContext({ entregaScope: ['INTERLOGISTIC', 'DALSE'] });
    assert.deepEqual(Array.from(crud._entregaScope()), ['INTERLOGISTIC', 'DALSE']);
});
