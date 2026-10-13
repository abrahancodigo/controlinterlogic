const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
const observations = [];
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
const escapeText = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function element(value = '') {
    return {
        value, innerHTML: '', textContent: '', style: {}, dataset: {}, handlers: {}, children: [],
        classList: { add() {}, remove() {}, contains() { return false; } },
        addEventListener(type, callback) { this.handlers[type] = callback; },
        querySelector() { return element(); }, querySelectorAll() { return []; },
        appendChild(child) { this.children.push(child); }, remove() {}, reset() {},
        removeAttribute() {}, getAttribute() { return null; }
    };
}

function fixture(file, values = {}, extras = {}) {
    const nodes = new Map(Object.entries(values).map(([key, value]) => [key, element(value)]));
    const document = {
        readyState: 'loading', body: element(), documentElement: element(),
        getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
        createElement() { return element(); }, addEventListener() {},
        querySelector() { return element(); }, querySelectorAll() { return []; }
    };
    const context = vm.createContext({
        window: { innerWidth: 375, addEventListener() {}, removeEventListener() {}, permissions: { canCreate: true, canEdit: true, canDelete: true } },
        document, console: quiet, setTimeout() { return 1; }, clearTimeout() {},
        requestAnimationFrame() {}, localStorage: { getItem() { return null; }, setItem() {} },
        sessionStorage: { getItem() { return null; }, setItem() {} },
        sanitizeHTML: escapeText, formatDate: () => 'fecha', formatDateForInput: () => '2026-10-06',
        formatCurrency: value => '$' + value, formatNumber: String,
        getLocalDateString: () => '2026-10-06',
        showToast() {}, setButtonLoading() {}, confirm: () => true,
        ...extras
    });
    vm.runInContext(read(file), context, { filename: file });
    return { context, nodes, document };
}

function database(initial = {}) {
    const writes = [];
    let nextId = 0;
    const db = {
        collection(name) {
            const query = {
                where() { return query; }, orderBy() { return query; }, limit() { return query; },
                async get() { return { empty: false, docs: [{ id: 'initial', data: () => initial }] }; },
                doc(id = 'new-' + (++nextId)) {
                    const ref = { id, name };
                    ref.update = async data => { writes.push({ type: 'update', ref, data }); };
                    ref.set = async data => { writes.push({ type: 'set', ref, data }); };
                    ref.delete = async () => { writes.push({ type: 'delete', ref }); };
                    return ref;
                },
                async add(data) { const ref = query.doc(); writes.push({ type: 'add', ref, data }); return ref; }
            };
            return query;
        },
        batch() {
            return {
                update(ref, data) { writes.push({ type: 'update', ref, data }); },
                set(ref, data) { writes.push({ type: 'set', ref, data }); },
                delete(ref) { writes.push({ type: 'delete', ref }); }, async commit() {}
            };
        },
        async runTransaction(callback) {
            return callback({ set(ref, data) { writes.push({ type: 'set', ref, data }); } });
        }
    };
    const firestore = () => db;
    firestore.Timestamp = { fromDate: date => date, now: () => 'timestamp' };
    firestore.FieldValue = { serverTimestamp: () => 'server-time', delete: () => 'deleted' };
    return { db, writes, firebase: { firestore, auth: () => ({ currentUser: { uid: 'uid-1' } }) } };
}

async function inspect(label, callback) {
    await callback();
    observations.push(label);
    process.stdout.write('CONFIRMADO: ' + label + '\n');
}

async function main() {
    await inspect('Usuarios móvil: 4 acciones renderizadas sin listener delegado', () => {
        const f = fixture('public/js/users.js', {}, { firebase: database().firebase });
        const users = f.context.window.Users;
        users.users = [{ id: 'other', email: 'other@local', role: 'user', active: true }];
        users.isMobile = true;
        users.renderUsersTable();
        const container = f.document.getElementById('users-table-container');
        assert.equal((container.innerHTML.match(/data-action=/g) || []).length, 4);
        assert.equal(container.handlers.click, undefined);
    });

    await inspect('Entregas móvil: editar Refrigerador guarda Sala', async () => {
        const data = database();
        const f = fixture('public/js/deliveries.js', {
            'mdf-cliente': 'Cliente', 'mdf-tienda': 'Tienda', 'mdf-fecha': '2026-10-06',
            'mdf-tipoMueble': 'Sala', 'mdf-accesorios': ''
        }, { firebase: data.firebase });
        const module = f.context.window.Deliveries;
        module.deliveries = [{ id: 'd-1', tipoMueble: 'Refrigerador' }];
        module.loadDeliveries = async () => {};
        module.showMobileForm('d-1');
        await f.document.getElementById('mdf-submit').handlers.click();
        assert.equal(data.writes[0].data.tipoMueble, 'Sala');
    });

    await inspect('Clientes móvil: nuevo cliente no guarda nombreNorm', async () => {
        const data = database();
        const f = fixture('public/js/clientes.js', { 'mcf-nombre': 'Ana' }, { firebase: data.firebase });
        const module = f.context.window.Clientes;
        module.applyFilters = () => {};
        module.showMobileForm();
        await f.document.getElementById('mcf-submit').handlers.click();
        assert.equal(data.writes[0].data.nombre, 'Ana');
        assert.equal(data.writes[0].data.nombreNorm, undefined);
    });

    await inspect('Flota: una nueva orden no contiene el campo fecha usado por su consulta', async () => {
        const data = database();
        const f = fixture('public/js/flota/orders.js', {
            'o-vehiculo': 'v-1', 'o-descripcion': 'Reparación', 'o-estado': 'pendiente',
            'o-prioridad': 'media', 'o-fechaInicio': '2026-10-06'
        }, { firebase: data.firebase });
        const module = f.context.window.FlotaOrders;
        module.vehiculos = [];
        module.sanitize = escapeText;
        module.showModalOrden();
        await f.document.getElementById('orden-form').handlers.submit({ preventDefault() {} });
        assert.equal(data.writes[0].data.fecha, undefined);
        assert.equal(data.writes[0].data.fechaCreacion, 'server-time');
        assert.match(read('public/js/flota/core.js'), /collection\('ordenesTrabajo'\)[\s\S]*?orderBy\('fecha'/);
    });

    await inspect('Tarimas: dos entradas desde saldo 10 guardan saldos 15 y 17, no 22', async () => {
        const data = database({ totalDespues: 10 });
        const fixtures = [5, 7].map(cantidad => fixture('public/js/tarimas.js', {
            'tarima-cantidad': String(cantidad), 'tarima-fecha': '2026-10-06'
        }, { firebase: data.firebase }));
        for (const f of fixtures) f.context.window.Tarimas.hideForm = () => {};
        await Promise.all(fixtures.map(f => f.context.window.Tarimas.saveMovimiento('ingreso')));
        assert.deepEqual(data.writes.map(w => w.data.totalDespues), [15, 17]);
    });

    await inspect('Tarimas: entrada retroactiva de 5 deja el saldo visible en 10, no 15', async () => {
        const data = database({ totalDespues: 10 });
        const f = fixture('public/js/tarimas.js', {
            'tarima-cantidad': '5', 'tarima-fecha': '2026-10-05'
        }, { firebase: data.firebase });
        const module = f.context.window.Tarimas;
        module.hideForm = () => {};
        await module.saveMovimiento('ingreso');
        module.records = [
            { fecha: new Date(2026, 9, 6), tipo: 'ingreso', cantidad: 10, totalDespues: 10 },
            data.writes[0].data
        ];
        module.calcularTotales();
        assert.equal(module.totalActual, 10);
        assert.equal(data.writes[0].data.totalDespues, 15);
    });

    await inspect('Entregas móvil: el nombre guardado introduce un atributo HTML adicional', () => {
        const f = fixture('public/js/deliveries.js');
        const module = f.context.window.Deliveries;
        module.deliveries = [{ id: 'd-1', cliente: 'Ana" data-audit="injected' }];
        module.showMobileForm('d-1');
        assert.match(f.document.body.children[0].innerHTML, /value="Ana" data-audit="injected"/);
    });

    await inspect('Liquidación: pago 20 y plan futuro 80 marcan pagada una venta de 100 con saldo 80', async () => {
        const data = database();
        const f = fixture('public/js/liquidacion.js', {
            'liq-pay-monto': '20', 'liq-pay-metodo': 'efectivo',
            'liq-pay-plan-fecha-0': '2026-10-13', 'liq-pay-plan-monto-0': '80'
        }, { firebase: data.firebase });
        const module = f.context.window.Liquidacion;
        module.queue = [{ id: 'sale', venta: 100, montoCobrado: 0, cliente: 'Ana' }];
        module._openPay('sale');
        module._planRows = 1;
        f.document.getElementById('liq-pay-plan').checked = true;
        await f.document.getElementById('liq-pay-form').handlers.submit({ preventDefault() {} });
        const write = data.writes.find(w => w.ref.name === 'interlogic');
        assert.equal(write.data.montoCobrado, 20);
        assert.equal(write.data.montoPendiente, 80);
        assert.equal(write.data.cobrado, true);
        assert.equal(write.data.estadoCobro, 'pagado');
    });

    await inspect('Liquidación: cobrar dos veces desde el mismo estado crea cobros por 200 para venta 100', async () => {
        const data = database();
        const f = fixture('public/js/liquidacion.js', {}, { firebase: data.firebase });
        const module = f.context.window.Liquidacion;
        module.queue = [{ id: 'old-sale', venta: 100, montoCobrado: 0, entregado: false }];
        await module._deliverAndCollect('old-sale');
        await module._deliverAndCollect('old-sale');
        assert.equal(data.writes.filter(w => w.ref.name === 'cobros').reduce((sum, w) => sum + w.data.monto, 0), 200);
        assert.equal(module.queue[0].montoCobrado, 0);
    });

    await inspect('Interlogic: liberar limpia factura sin tocar cobros ni rutaEntregas', async () => {
        const data = database();
        const f = fixture('public/js/interlogic/crud.js', {}, {
            firebase: data.firebase, showConfirm: async () => true
        });
        const module = vm.runInContext('InterlogicCRUD', f.context);
        module.records = [{ id: 'sale', venta: 100, rutaId: 'r-1', montoCobrado: 100, cobrado: true }];
        module.selectedRecords = new Set(['sale']);
        module.applyFilters = () => {};
        await module.liberarSelectedRecords();
        assert.equal(data.writes.length, 1);
        assert.equal(data.writes[0].ref.name, 'interlogic');
        assert.equal(data.writes[0].data.montoCobrado, 0);
    });

    await inspect('Interlogic: borrar NC no revierte su aplicación ni borra notasCredito', async () => {
        const data = database();
        const f = fixture('public/js/interlogic/crud.js', {}, {
            firebase: data.firebase, showConfirm: async () => true
        });
        const module = vm.runInContext('InterlogicCRUD', f.context);
        module.records = [{ id: 'nc', doc: 'NC', venta: 20 }];
        module.applyFilters = () => {};
        await module.deleteRecord('nc');
        assert.equal(data.writes.length, 1);
        assert.equal(data.writes[0].type, 'delete');
        assert.equal(data.writes[0].ref.name, 'interlogic');
    });

    await inspect('Asistencia: autoguardado anuncia éxito antes de que termine la escritura', async () => {
        const pending = deferred();
        let timer;
        const f = fixture('public/js/asistencia.js', {}, {
            firebase: { firestore: () => ({ collection: () => ({ doc: () => ({ set: () => pending.promise }) }) }) },
            setTimeout: callback => { timer = callback; return 1; }
        });
        const module = vm.runInContext('Asistencia', f.context);
        module.markDirty();
        timer();
        assert.equal(f.document.getElementById('asis-status').textContent, 'Guardado automáticamente');
        assert.equal(module.dirty, true);
        pending.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });

    await inspect('Asistencia: descartar cambios al cambiar quincena conserva el autoguardado pendiente', async () => {
        let timer;
        const data = database();
        const f = fixture('public/js/asistencia.js', {}, {
            firebase: data.firebase, setTimeout: callback => { timer = callback; return 1; },
            confirm: (() => { let n = 0; return () => ++n !== 1; })()
        });
        const module = vm.runInContext('Asistencia', f.context);
        module.loadFromFirestore = async () => {};
        module.populateSelects = () => {};
        module.renderTable = () => {};
        module.markDirty();
        await module.changePeriod(2026, 11, 1);
        timer();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(data.writes.find(w => w.ref.id !== '_config').ref.id, '2026-11-1');
    });

    await inspect('Flota: una carga pendiente termina pintando Flota tras cambiar de módulo', async () => {
        const pending = deferred();
        const f = fixture('public/js/flota/index.js', {}, {
            FlotaCore: {}, FlotaVehicles: {}, FlotaMaintenance: {}, FlotaOrders: {}
        });
        const module = f.context.window.Flota;
        let paints = 0;
        module.loadData = () => pending.promise;
        module.renderMobile = () => paints++;
        f.context.window.App = { currentModule: 'flota' };
        const render = module.render();
        f.context.window.App.currentModule = 'clientes';
        pending.resolve();
        await render;
        assert.equal(paints, 1);
    });

    await inspect('Problemas: eliminar una de dos imágenes sin añadir otra no persiste la lista', async () => {
        const data = database();
        const f = fixture('public/js/problemas.js', { 'problema-observacion': 'Observación' }, { firebase: data.firebase });
        const module = f.context.window.Problemas;
        module.editingId = 'p-1';
        module.existingImages = ['imagen-restante'];
        module.selectedImages = [];
        module.hideForm = () => {};
        await module.saveProblema();
        assert.equal(data.writes.length, 1);
        assert.equal(data.writes[0].data.imagenes, undefined);
    });

    await inspect('Logout: conserva permissions y no cancela la suscripción Interlogic', () => {
        const f = fixture('public/js/auth.js');
        let cancellations = 0;
        f.context.window.Interlogic = { unsubscribe: () => cancellations++ };
        f.context.window.App = { currentModule: 'interlogic' };
        f.context.window.Auth = vm.runInContext('Auth', f.context);
        f.context.window.Auth.handleUserLogout();
        assert.equal(cancellations, 0);
        assert.equal(f.context.window.permissions.canDelete, true);
    });

    const html = read('public/index.html');
    const sources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]).filter(src => src.startsWith('js/'));
    const shared = fixture('public/js/utils.js').context;
    const failures = [];
    for (const source of sources) {
        const file = 'public/' + source.split('?')[0];
        if (file === 'public/js/utils.js') continue;
        try { vm.runInContext(read(file), shared, { filename: file }); }
        catch (error) { failures.push({ file, error: error.message }); }
    }
    assert.deepEqual(failures, []);
    process.stdout.write('OK: carga conjunta de ' + sources.length + ' scripts locales en VM sin colisiones.\n');
    const missingAssets = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"?]+)(?:\?[^" ]*)?"/g)]
        .map(match => match[1]).filter(file => !fs.existsSync(path.join(root, 'public', file)));
    assert.deepEqual(missingAssets, []);
    process.stdout.write('OK: referencias locales JS/CSS de index.html existentes.\n');
    process.stdout.write(observations.length + ' reproducciones locales confirmadas; Firebase y DOM simulados, sin conexiones ni escrituras remotas.\n');
}

main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
