const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/js/interlogic/crud.js'), 'utf8');

async function editMobile(docType) {
    const writes = [];
    let save;
    const values = {
        'mf-fecha': '2026-09-10', 'mf-guia': 'G1', 'mf-empresa': 'DALSE',
        'mf-doc': docType, 'mf-docNum': '001', 'mf-cliente': 'Cliente',
        'mf-direccion': 'Dirección', 'mf-telefono': '123', 'mf-vendedor': 'Ana',
        'mf-venta': '100', 'mf-bultos': '2', 'mf-observations': 'Nota',
        'mf-entrega': 'SOCIO', 'mf-cobra': 'XPRESS'
    };
    const elements = Object.fromEntries(Object.entries(values).map(([id, value]) => [id, {
        value, disabled: false, style: {}, addEventListener(type, fn) {
            if (id === 'mf-submit' && type === 'click') save = fn;
        }, remove() {}
    }]));
    for (const id of ['mf-submit', 'm-form-sheet', 'm-form-backdrop']) {
        elements[id] ||= { disabled: false, style: {}, addEventListener(type, fn) { if (type === 'click') save = fn; }, remove() {} };
    }
    const db = {
        collection(name) {
            return {
                doc(id) { return { update(data) { writes.push({ kind: 'update', name, id, data }); return Promise.resolve(); } }; },
                add(data) { writes.push({ kind: 'add', name, data }); return Promise.resolve(); }
            };
        }
    };
    function firestore() { return db; }
    firestore.Timestamp = { fromDate: date => date };
    firestore.FieldValue = { serverTimestamp: () => 'timestamp' };
    const context = vm.createContext({
        window: { permissions: { canEdit: true, canCreate: true } },
        document: { createElement: () => ({ innerHTML: '' }), body: { appendChild() {} }, getElementById: id => elements[id] || null },
        firebase: { firestore },
        formatDateForInput: () => '2026-09-10', sanitizeHTML: value => String(value),
        showToast() {}, console
    });
    vm.runInContext(source, context);
    const crud = context.window.InterlogicCRUD;
    crud.records = [{ id: 'existing', doc: docType, cliente: '', entrega: 'SOCIO', departamento: 'San Salvador', municipio: 'Centro', condicionPago: 'Crédito', montoCobrado: 25, encargado: 'Pedro' }];
    crud.filteredRecords = [];
    crud.showMobileForm('existing');
    assert.equal(typeof save, 'function');
    await Promise.all([save(), save()]);
    return writes;
}

for (const docType of ['NC', 'CCF']) {
    test(`Edición móvil de ${docType} guarda una vez y conserva campos ocultos`, async () => {
        const writes = await editMobile(docType);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].kind, 'update');
        assert.equal(writes[0].name, 'interlogic');
        assert.equal(writes[0].id, 'existing');
        for (const field of ['departamento', 'municipio', 'condicionPago', 'montoCobrado', 'encargado']) {
            assert.equal(Object.hasOwn(writes[0].data, field), false, field);
        }
        assert.equal(writes[0].data.entrega, 'SOCIO');
        assert.equal(writes[0].data.costoEnvio, 3.7);
    });
}
