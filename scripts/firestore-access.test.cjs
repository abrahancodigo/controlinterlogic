const { test } = require('node:test');
const assert = require('node:assert/strict');
const host = process.env.FIRESTORE_EMULATOR_HOST;
const project = 'demo-controlinterlogic';
const modules = ['dashboard', 'interlogic', 'tarimas', 'problemas', 'clientes', 'flota', 'liquidacion', 'deliveries', 'kpi', 'asistencia'];
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const value = x => typeof x === 'boolean' ? { booleanValue: x } : typeof x === 'number' ? { integerValue: String(x) } : typeof x === 'object' ? { mapValue: { fields: fields(x) } } : { stringValue: x };
const fields = data => Object.fromEntries(Object.entries(data).map(([key, val]) => [key, value(val)]));
const token = uid => {
    const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
    return encode({ alg: 'none', typ: 'JWT' }) + '.' + encode({ sub: uid, user_id: uid, aud: project, iss: 'https://securetoken.google.com/' + project, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, firebase: { sign_in_provider: 'custom', identities: {} } }) + '.';
};
async function request(method, path, uid, data) {
    assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/);
    const headers = { 'Content-Type': 'application/json' };
    if (uid) headers.Authorization = 'Bearer ' + (uid === 'owner' ? uid : token(uid));
    const mask = method === 'PATCH' ? '?' + Object.keys(data).map(key => 'updateMask.fieldPaths=' + encodeURIComponent(key)).join('&') : '';
    const response = await fetch(base + '/' + path + mask, { method, headers, body: data ? JSON.stringify({ fields: fields(data) }) : undefined });
    const body = await response.text();
    return { status: response.status, body };
}
async function allowed(method, path, uid, data) {
    const response = await request(method, path, uid, data);
    assert.ok(response.status >= 200 && response.status < 300, `${method} ${path} ${uid}: ${response.status} ${response.body}`);
}
async function denied(method, path, uid, data) {
    const response = await request(method, path, uid, data);
    assert.equal(response.status, 403, `${method} ${path} ${uid}: ${response.status} ${response.body}`);
}
async function profile(uid, role, access, extra = {}) {
    await allowed('PATCH', 'users/' + uid, 'owner', { role, active: true, moduleAccess: access, ...extra });
}

test('Reglas reales: lector, editor y administrador', { skip: !host }, async t => {
    assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/);
    const reset = await fetch('http://' + host + '/emulator/v1/projects/' + project + '/databases/(default)/documents', { method: 'DELETE' });
    assert.equal(reset.ok, true);
    const oldAccess = Object.fromEntries(modules.map(key => [key, 'hidden']));
    await profile('reader', 'user', oldAccess);
    await profile('editor', 'editor', oldAccess, { privileges: { manageMetas: false, exportData: false } });
    await profile('admin', 'admin', {});
    const collections = ['interlogic', 'tarimas_walmart', 'deliveries', 'kpiEvaluations', 'clientes', 'problemas', 'asistencia', 'empleados', 'vehiculos', 'mantenimientos', 'ordenesTrabajo', 'proveedores', 'cobros', 'gestiones', 'ajustes', 'liquidaciones', 'repartidores', 'rutas', 'rutaEntregas', 'notasCredito'];
    for (const collection of collections) {
        await t.test(collection + ': todos consultan, lector no escribe, editor crea/modifica, admin elimina', async () => {
            const path = collection + '/matrix';
            await allowed('PATCH', path, 'owner', { cantidad: 1 });
            for (const uid of ['reader', 'editor', 'admin']) {
                await allowed('GET', path, uid);
                await allowed('GET', collection, uid);
            }
            await denied('PATCH', path, 'reader', { cantidad: 2 });
            await denied('PATCH', collection + '/new-reader', 'reader', { cantidad: 2 });
            await denied('DELETE', path, 'reader');
            await allowed('PATCH', collection + '/new-editor', 'editor', { cantidad: 2 });
            await allowed('PATCH', path, 'editor', { cantidad: 3 });
            await denied('DELETE', path, 'editor');
            await allowed('PATCH', collection + '/new-admin', 'admin', { cantidad: 4 });
            await allowed('PATCH', path, 'admin', { cantidad: 5 });
            await allowed('DELETE', path, 'admin');
        });
    }
    await t.test('Roles existentes sin configuración siguen funcionando', async () => {
        await allowed('PATCH', 'users/legacy', 'owner', { role: 'user' });
        await allowed('GET', 'tarimas_walmart/new-admin', 'legacy');
        await denied('PATCH', 'tarimas_walmart/new-admin', 'legacy', { cantidad: 9 });
    });
    await t.test('Configuraciones, metas y contadores siguen solo el rol', async () => {
        for (const doc of ['settings', 'dashboard', 'counters']) {
            const path = 'config/' + doc;
            await allowed('PATCH', path, 'admin', { prueba: 1 });
            await allowed('GET', path, 'reader');
            await denied('PATCH', path, 'reader', { prueba: 2 });
            await allowed('PATCH', path, 'editor', { prueba: 3 });
            await denied('DELETE', path, 'editor');
        }
        await denied('PATCH', 'config/system', 'editor', { hasAdmin: false });
    });
    await t.test('Usuarios visibles para todos; solo admin crea, modifica, desactiva y elimina', async () => {
        for (const uid of ['reader', 'editor']) {
            await allowed('GET', 'users', uid);
            await allowed('GET', 'users/admin', uid);
            await denied('PATCH', 'users/new-' + uid, uid, { role: 'admin' });
            await denied('PATCH', 'users/' + uid, uid, { role: 'admin' });
            await denied('PATCH', 'users/' + uid, uid, { displayName: 'Otro nombre' });
            await denied('PATCH', 'users/legacy', uid, { active: false });
            await denied('DELETE', 'users/legacy', uid);
        }
        await allowed('PATCH', 'users/managed', 'admin', { role: 'user', active: true });
        await allowed('PATCH', 'users/managed', 'admin', { role: 'editor' });
        await allowed('PATCH', 'interlogic/admin-grant', 'managed', { cantidad: 1 });
        await allowed('PATCH', 'users/managed', 'admin', { role: 'user' });
        await denied('PATCH', 'interlogic/admin-grant', 'managed', { cantidad: 2 });
        await allowed('DELETE', 'users/managed', 'admin');
    });
    await t.test('Credenciales y registro de acceso permanecen protegidos', async () => {
        await allowed('PATCH', 'user_registry/internal', 'owner', { value: 'private' });
        for (const uid of ['reader', 'editor']) {
            await denied('GET', 'user_registry/internal', uid);
            await denied('PATCH', 'user_registry/internal', uid, { role: 'admin' });
            await denied('PATCH', 'login_attempt_limits/internal', uid, { attempts: 0 });
        }
    });
    await t.test('Inactivos, cuentas sin perfil y anónimos no acceden', async () => {
        await profile('inactive', 'admin', {}, { active: false });
        for (const uid of ['inactive', 'no-profile', null]) {
            await denied('GET', 'tarimas_walmart/new-admin', uid);
            await denied('PATCH', 'tarimas_walmart/new-admin', uid, { cantidad: 9 });
        }
        await allowed('GET', 'users/inactive', 'inactive');
    });
});
