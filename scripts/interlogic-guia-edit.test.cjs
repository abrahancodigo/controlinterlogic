const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/js/interlogic/crud.js'), 'utf8');

function setup() {
    const writes = [];
    const toasts = [];
    let removed = false;

    const input = { value: '', focus() {}, select() {}, addEventListener() {} };
    const saveBtn = { onclick: null };
    const cancelBtn = { onclick: null };
    const editor = {
        id: '', className: '', innerHTML: '', style: {},
        contains: () => false,
        remove() { removed = true; },
        querySelector(selector) {
            if (selector === '.il-cell-editor-input') return input;
            if (selector === '.il-cell-editor-save') return saveBtn;
            if (selector === '.il-cell-editor-cancel') return cancelBtn;
            return null;
        },
        getBoundingClientRect: () => ({ width: 220, height: 120, left: 10, right: 230, top: 10, bottom: 130 })
    };

    const document = {
        body: { appendChild() {} },
        getElementById: () => null,
        createElement: () => editor,
        addEventListener() {},
        removeEventListener() {}
    };
    const window = {
        permissions: { canEdit: true },
        innerWidth: 1280,
        innerHeight: 800,
        addEventListener() {},
        removeEventListener() {}
    };
    function firestore() {
        return {
            collection: () => ({
                doc: id => ({
                    update(data) { writes.push({ id, data }); return Promise.resolve(); }
                })
            })
        };
    }
    firestore.FieldValue = { serverTimestamp: () => 'timestamp' };

    const context = vm.createContext({
        window,
        document,
        firebase: { firestore },
        sanitizeHTML: value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        showToast: (message, type) => toasts.push({ message, type }),
        console
    });
    vm.runInContext(source, context);

    const crud = context.window.InterlogicCRUD;
    crud.applyFilters = () => {};
    crud.records = [{ id: 'r1', guia: '123', anulado: false }];

    const anchor = { getBoundingClientRect: () => ({ width: 90, height: 22, left: 10, right: 100, top: 10, bottom: 32 }) };
    return { crud, anchor, editor, input, saveBtn, writes, toasts, isRemoved: () => removed };
}

test('La celda de guía abre un editor numérico sin datalist', () => {
    const { crud, anchor, editor, input } = setup();
    crud.editCellField('r1', 'guia', anchor);
    assert.match(editor.innerHTML, /inputmode="numeric"/);
    assert.doesNotMatch(editor.innerHTML, /datalist/);
    assert.match(editor.innerHTML, /value="123"/);
});

test('Guardar una guía numérica actualiza Firestore y el registro local', async () => {
    const { crud, anchor, input, saveBtn, writes, toasts } = setup();
    crud.editCellField('r1', 'guia', anchor);
    input.value = ' 00123 ';
    await saveBtn.onclick();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].data.guia, '00123');
    assert.equal(crud.records[0].guia, '00123');
    assert.equal(toasts.at(-1).type, 'success');
});

test('Una guía con letras se rechaza y no escribe', async () => {
    const { crud, anchor, input, saveBtn, writes, toasts, isRemoved } = setup();
    crud.editCellField('r1', 'guia', anchor);
    input.value = 'G-123';
    await saveBtn.onclick();
    assert.equal(writes.length, 0);
    assert.equal(isRemoved(), false);
    assert.equal(toasts.at(-1).type, 'warning');
});

test('Se puede limpiar la guía dejándola vacía', async () => {
    const { crud, anchor, input, saveBtn, writes } = setup();
    crud.editCellField('r1', 'guia', anchor);
    input.value = '';
    await saveBtn.onclick();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].data.guia, '');
});
