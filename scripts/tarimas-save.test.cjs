const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const tipo of ['salida', 'ingreso']) {
    test(`Guardar ${tipo} con la consulta disponible en el navegador`, async () => {
        const writes = [];
        const notices = [];
        const timestamp = date => ({ toMillis: () => date.getTime() });
        const earlier = timestamp(new Date(2026, 9, 15, 12));
        const later = timestamp(new Date(2026, 9, 17, 12));
        const docs = [
            { ref: 'entrada', data: () => ({ tipo: 'ingreso', cantidad: 100, fecha: earlier, totalDespues: 100 }) },
            { ref: 'posterior', data: () => ({ tipo: 'salida', cantidad: 10, fecha: later, totalDespues: 90 }) }
        ];
        const query = { orderBy: () => ({ get: async () => ({ docs }) }), doc: () => 'nuevo' };
        const firestore = () => ({
            collection: name => { assert.equal(name, 'tarimas_walmart'); return query; },
            batch: () => ({ set: (ref, payload) => writes.push({ ref, payload }), update: (ref, payload) => writes.push({ ref, payload }), commit: async () => {} })
        });
        firestore.Timestamp = { fromDate: timestamp };
        const inputs = {
            'tarima-cantidad': { value: '20' }, 'tarima-fecha': { value: '2026-10-16' },
            'tarima-destino': { value: 'Walmart' }, 'tarima-observacion': { value: '' },
            'btn-save-tarima': {}
        };
        const context = vm.createContext({
            window: { currentUserData: { displayName: 'Editor' } },
            AccessControl: { level: () => 'write' }, document: { getElementById: id => inputs[id] },
            firebase: { firestore, auth: () => ({ currentUser: { uid: 'editor' } }) },
            showToast: (message, type) => notices.push({ message, type }), setButtonLoading() {}, console
        });
        vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../public/js/tarimas.js'), 'utf8'), context);
        let closed = false;
        context.window.Tarimas.hideForm = () => { closed = true; };
        await context.window.Tarimas.saveMovimiento(tipo);
        assert.equal(closed, true);
        assert.equal(notices[0].type, 'success');
        assert.equal(writes.length, 2);
        assert.equal(writes[0].ref, 'nuevo');
        assert.equal(writes[0].payload.totalDespues, tipo === 'salida' ? 80 : 120);
        assert.equal(writes[1].ref, 'posterior');
        assert.equal(writes[1].payload.totalDespues, tipo === 'salida' ? 70 : 110);
    });
}