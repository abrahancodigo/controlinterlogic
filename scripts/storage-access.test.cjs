const { test } = require('node:test');
const assert = require('node:assert/strict');
const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const project = 'demo-controlinterlogic';
const bucket = project + '.appspot.com';
const token = uid => {
    const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
    return encode({ alg: 'none', typ: 'JWT' }) + '.' + encode({ sub: uid, user_id: uid, aud: project, iss: 'https://securetoken.google.com/' + project, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, firebase: { sign_in_provider: 'custom', identities: {} } }) + '.';
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
async function profile(uid, role, active = true) {
    assert.match(firestoreHost, /^(127\.0\.0\.1|localhost):\d+$/);
    const response = await fetch(`http://${firestoreHost}/v1/projects/${project}/databases/(default)/documents/users/${uid}`, {
        method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { role: { stringValue: role }, active: { booleanValue: active } } })
    });
    assert.equal(response.ok, true, await response.text());
}
async function request(method, name, uid, expected) {
    assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/);
    const headers = {};
    if (uid) headers.Authorization = 'Bearer ' + token(uid);
    const boundary = 'role-test-boundary';
    if (method === 'POST') headers['X-Goog-Upload-Protocol'] = 'multipart';
    if (method === 'POST') headers['Content-Type'] = 'multipart/related; boundary=' + boundary;
    const upload = Buffer.concat([Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=utf-8\r\n\r\n' + JSON.stringify({ name, contentType: 'image/png' }) + '\r\n--' + boundary + '\r\nContent-Type: image/png\r\n\r\n'), png, Buffer.from('\r\n--' + boundary + '--\r\n')]);
    const path = method === 'POST' ? '?uploadType=multipart&name=' + encodeURIComponent(name) : '/' + encodeURIComponent(name);
    const response = await fetch(`http://${host}/v0/b/${bucket}/o${path}`, { method, headers, body: method === 'POST' ? upload : undefined });
    const body = await response.text();
    if (expected === 'allow') assert.ok(response.status >= 200 && response.status < 300, `${method} ${name} ${uid}: ${response.status} ${body}`);
    else assert.equal(response.status, 403, `${method} ${name} ${uid}: ${response.status} ${body}`);
}

test('Archivos: lectores consultan, editores suben y solo administrador elimina', { skip: !host || !firestoreHost }, async t => {
    await profile('storage-reader', 'user');
    await profile('storage-editor', 'editor');
    await profile('storage-admin', 'admin');
    await profile('storage-inactive', 'admin', false);
    for (const folder of ['deliveries', 'problemas', 'asistencia', 'vehiculos']) {
        await t.test(folder, async () => {
            const name = folder + '/role-test.png';
            await request('POST', name, 'storage-reader', 'deny');
            await request('POST', name, 'storage-editor', 'allow');
            await request('GET', name, 'storage-reader', 'allow');
            await request('POST', name, 'storage-reader', 'deny');
            await request('POST', name, 'storage-editor', 'allow');
            await request('DELETE', name, 'storage-editor', 'deny');
            await request('DELETE', name, 'storage-reader', 'deny');
            await request('GET', name, null, 'deny');
            await request('POST', name, 'storage-inactive', 'deny');
            await request('DELETE', name, 'storage-admin', 'allow');
        });
    }
});
