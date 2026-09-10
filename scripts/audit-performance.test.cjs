const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = file => process.argv.includes('--baseline')
    ? execFileSync('git', ['show', 'HEAD:' + file], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const snapshot = id => ({ size: 1, docs: [{ id, data: () => ({}) }] });

function load(file, extras = {}) {
    const context = vm.createContext({
        window: {}, console, setTimeout, clearTimeout,
        document: { getElementById: () => null },
        ...extras
    });
    vm.runInContext(read(file), context);
    return context;
}

test('El período anterior incluye días completos y consecutivos', () => {
    const { Dashboard } = load('public/js/dashboard.js').window;
    for (const days of [1, 7, 30]) {
        const start = new Date(2026, 8, 10);
        const end = new Date(2026, 8, 10 + days - 1, 23, 59, 59, 999);
        const prev = Dashboard.getPrevPeriod(start, end);
        assert.equal(prev.fin.getTime(), start.getTime() - 1);
        assert.equal(prev.fin - prev.inicio, end - start);
        assert.equal(prev.inicio.getHours(), 0);
        assert.equal(prev.fin.getHours(), 23);
    }
});

function dashboardData() {
    const reads = [], listeners = [];
    const db = { collection: () => {
        const query = {
            where: () => query, orderBy: () => query, limit: () => query,
            onSnapshot: callback => { listeners.push(callback); return () => {}; },
            get: () => { const job = deferred(); reads.push(job); return job.promise; }
        };
        return query;
    } };
    const { Dashboard } = load('public/js/dashboard.js', { firebase: { firestore: () => db } }).window;
    Dashboard.init();
    Dashboard.computeAndRender = () => {};
    Dashboard.updateDeltas = () => {};
    return { Dashboard, reads, listeners };
}

test('Varias actualizaciones consultan el período anterior una sola vez', async () => {
    const { Dashboard, reads, listeners } = dashboardData();
    Dashboard.subscribeToData();
    for (let i = 0; i < 5; i++) listeners[0](snapshot(String(i)));
    assert.equal(reads.length, 1);
    reads[0].resolve(snapshot('previous'));
    await flush();
    assert.equal(Dashboard.prevRecords[0].id, 'previous');
});

test('Una respuesta antigua no sobrescribe el período al volver al mismo rango', async () => {
    const { Dashboard, reads, listeners } = dashboardData();
    Dashboard.subscribeToData();
    listeners[0](snapshot('current'));
    Dashboard.subscribeToData();
    listeners[1](snapshot('new-current'));
    reads[1].resolve(snapshot('new-previous'));
    await flush();
    reads[0].resolve(snapshot('old-previous'));
    await flush();
    assert.equal(Dashboard.prevRecords[0].id, 'new-previous');
});

test('Salir del Dashboard descarta respuestas pendientes', async () => {
    const { Dashboard, reads, listeners } = dashboardData();
    Dashboard.subscribeToData();
    listeners[0](snapshot('current'));
    Dashboard.destroy();
    reads[0].resolve(snapshot('late'));
    await flush();
    assert.equal(Dashboard.prevRecords.length, 0);
});

test('Salir durante la creación de gráficos no reactiva el Dashboard', async () => {
    const charts = deferred();
    const area = {};
    const { Dashboard } = load('public/js/dashboard.js', {
        formatDateForInput: () => '2026-09-10',
        document: { getElementById: () => area, querySelectorAll: () => [], querySelector: () => null }
    }).window;
    let subscriptions = 0;
    Dashboard.initCharts = () => charts.promise;
    Dashboard.setupEvents = () => {};
    Dashboard.subscribeToData = () => subscriptions++;
    const pending = Dashboard.render();
    Dashboard.destroy();
    charts.resolve();
    await pending;
    assert.equal(subscriptions, 0);
});

function liquidationData() {
    const jobs = [];
    const db = { collection: name => {
        const query = { orderBy: () => query, limit: () => query, get: () => {
            const job = deferred();
            jobs.push({ name, ...job });
            return job.promise;
        } };
        return query;
    } };
    const { Liquidacion } = load('public/js/liquidacion.js', {
        firebase: { firestore: () => db }, getLocalDateString: () => '2026-09-10',
        document: { getElementById: () => ({}) }
    }).window;
    return { Liquidacion, jobs };
}

test('Liquidación inicia ambas lecturas sin esperar y tolera fallo parcial', async () => {
    const { Liquidacion, jobs } = liquidationData();
    const pending = Liquidacion._loadBase();
    assert.equal(jobs.length, 2);
    jobs[0].reject(new Error('offline'));
    jobs[1].resolve(snapshot('liquidation'));
    await pending;
    assert.equal(Liquidacion.repartidores.length, 0);
    assert.equal(Liquidacion.liquidaciones[0].id, 'liquidation');
});

test('Salir de Liquidación durante una carga no recrea su pantalla ni sus listeners', async () => {
    const { Liquidacion, jobs } = liquidationData();
    let renders = 0, subscriptions = 0;
    Liquidacion._loadLastActions = () => {};
    Liquidacion._renderShell = () => renders++;
    Liquidacion._subscribeAll = () => subscriptions++;
    const pending = Liquidacion.render();
    Liquidacion.cleanup();
    for (let i = 0; i < 2; i++) {
        jobs[i].resolve(snapshot('late'));
        await flush();
    }
    await pending;
    assert.equal(renders, 0);
    assert.equal(subscriptions, 0);
    assert.equal(Liquidacion.repartidores.length, 0);
});

test('Las dependencias mantienen su orden y el arranque espera DOMContentLoaded', () => {
    const html = read('public/index.html');
    const head = execFileSync('git', ['show', 'HEAD:public/index.html'], { cwd: root, encoding: 'utf8' });
    const sources = text => [...text.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1].replace(/\?v=\d+$/, ''));
    assert.deepEqual(sources(html), sources(head));
    for (const [tag, src] of html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)) {
        if (/^js\/(init|auth)\.js/.test(src)) assert.doesNotMatch(tag, /\bdefer\b/);
        else assert.match(tag, /\bdefer\b/);
    }
});
