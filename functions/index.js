const crypto = require('node:crypto');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore, Timestamp } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

admin.initializeApp();

const auth = getAuth();
const db = getFirestore();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPasswordScrypt(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, useSalt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString('hex');
  return { passwordHash: `scrypt$${useSalt}$${derived}`, salt: useSalt };
}

function verifyPasswordScrypt(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const derived = crypto.scryptSync(password, parts[1], SCRYPT_KEYLEN, SCRYPT_PARAMS).toString('hex');
  return safeEqual(derived, parts[2]);
}

function legacyHash(value) {
  let result = 0;
  for (let i = 0; i < value.length; i++) {
    result = ((result << 5) - result) + value.charCodeAt(i);
    result |= 0;
  }
  return `legacy_${Math.abs(result).toString(36)}`;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const ALLOWED_MODULES = ['dashboard', 'interlogic', 'entregas', 'tarimas', 'ivette', 'problemas', 'clientes', 'flota', 'deliveries', 'kpi', 'asistencia', 'settings', 'users'];
const ALLOWED_ENTREGAS = ['DALSE', 'INTERLOGISTIC', 'XPRESS', 'INCEDE'];

function sanitizePrivileges(input) {
  const privileges = {};
  if (Array.isArray(input?.modules)) {
    privileges.modules = Array.from(new Set(input.modules.filter(key => ALLOWED_MODULES.includes(key))));
  }
  if (Array.isArray(input?.entregaScope)) {
    privileges.entregaScope = Array.from(new Set(input.entregaScope
      .map(value => String(value).toUpperCase().trim())
      .filter(value => ALLOWED_ENTREGAS.includes(value))));
  }
  if (typeof input?.readOnly === 'boolean') {
    privileges.readOnly = input.readOnly;
  }
  return privileges;
}

function sanitizePreferences(input) {
  const preferences = {};
  const theme = String(input?.theme || '');
  if (['light', 'dark', 'auto'].includes(theme)) preferences.theme = theme;
  return preferences;
}

async function checkRateLimit(username, ip) {
  const key = hash(`${username}:${ip || 'unknown'}`);
  const ref = db.collection('login_attempt_limits').doc(key);
  const now = Date.now();

  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : {};
    const startedAt = data.startedAt?.toMillis?.() || 0;

    if (startedAt && now - startedAt < WINDOW_MS && data.attempts >= MAX_ATTEMPTS) {
      throw new HttpsError('resource-exhausted', 'Demasiados intentos. Intenta más tarde.');
    }

    transaction.set(ref, {
      startedAt: startedAt && now - startedAt < WINDOW_MS
        ? data.startedAt
        : Timestamp.fromMillis(now),
      attempts: startedAt && now - startedAt < WINDOW_MS ? (data.attempts || 0) + 1 : 1
    });
  });

  return ref;
}

exports.authenticateUsername = onCall({ maxInstances: 20 }, async request => {
  const username = String(request.data?.username || '').trim().toLowerCase();
  const password = String(request.data?.password || '');

  if (!/^[a-z0-9._-]{1,64}$/.test(username) || !password || password.length > 256) {
    throw new HttpsError('unauthenticated', 'Usuario o contraseña incorrectos.');
  }

  const attemptRef = await checkRateLimit(username, request.rawRequest?.ip);

  const registryRef = db.collection('user_registry').doc(username);
  const registrySnapshot = await registryRef.get();
  if (!registrySnapshot.exists) {
    throw new HttpsError('unauthenticated', 'Usuario o contraseña incorrectos.');
  }

  const registry = registrySnapshot.data();
  if (registry.active === false) {
    throw new HttpsError('unauthenticated', 'Usuario o contraseña incorrectos.');
  }

  const passwordHash = hash(password);
  const storedHash = String(registry.passwordHash || '');
  const legacyPasswordHash = storedHash.startsWith('legacy_');
  const scryptPasswordHash = storedHash.startsWith('scrypt$');
  const valid = registry.passwordHash
    ? (legacyPasswordHash
      ? safeEqual(storedHash, legacyHash(password))
      : scryptPasswordHash
        ? verifyPasswordScrypt(password, storedHash)
        : safeEqual(storedHash, passwordHash))
    : safeEqual(registry.password, password);

  if (!valid) {
    throw new HttpsError('unauthenticated', 'Usuario o contraseña incorrectos.');
  }

  await attemptRef.delete();

  if (!registry.passwordHash || legacyPasswordHash) {
    const upgraded = hashPasswordScrypt(password);
    await registryRef.update({
      passwordHash: upgraded.passwordHash,
      salt: upgraded.salt,
      password: FieldValue.delete()
    });
  }

  const email = String(registry.internalEmail || `${username}@dalse.local`).trim().toLowerCase();
  const displayName = String(registry.displayName || username).slice(0, 120);
  const matchingUsers = await db.collection('users').where('email', '==', email).get();
  const existingUserData = matchingUsers.docs.map(doc => doc.data());

  const existingProfile = existingUserData.find(data => Boolean(data.uid)) || existingUserData[0];
  if (existingProfile?.active === false) {
    throw new HttpsError('unauthenticated', 'Usuario o contraseña incorrectos.');
  }
  const storedRole = existingProfile?.role || registry.role;
  const role = ['admin', 'editor', 'user'].includes(String(storedRole).toLowerCase())
    ? String(storedRole).toLowerCase()
    : 'user';

  let authUser;
  try {
    authUser = await auth.getUserByEmail(email);
    if (authUser.disabled) {
      throw new HttpsError('unauthenticated', 'Usuario o contraseña incorrectos.');
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error.code !== 'auth/user-not-found') throw error;
    try {
      authUser = await auth.createUser({ email, password, displayName, disabled: false });
    } catch (createError) {
      if (createError.code !== 'auth/email-already-exists') throw createError;
      authUser = await auth.getUserByEmail(email);
    }
  }

  const userRef = db.collection('users').doc(authUser.uid);
  await userRef.set({
    uid: authUser.uid,
    email,
    username,
    displayName,
    role,
    active: existingProfile?.active ?? true,
    ...(existingProfile?.privileges || registry.privileges ? { privileges: existingProfile?.privileges || registry.privileges } : {}),
    ...(existingProfile?.preferences || registry.preferences ? { preferences: existingProfile?.preferences || registry.preferences } : {}),
    ...(existingProfile?.createdAt ? { createdAt: existingProfile.createdAt } : {})
  }, { merge: true });

  for (const userDoc of matchingUsers.docs) {
    if (userDoc.id !== authUser.uid) await userDoc.ref.delete();
  }

  if (role === 'admin') {
    await db.collection('config').doc('system').set({
      hasAdmin: true,
      adminSetAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  let customToken;
  try {
    customToken = await auth.createCustomToken(authUser.uid);
  } catch (tokenError) {
    throw new HttpsError('internal', 'No se pudo generar la sesión. Verifica que Auth esté habilitado en Firebase. Detalle: ' + (tokenError.message || tokenError.code));
  }

  return { customToken };
});

exports.createManagedUser = onCall({ maxInstances: 10 }, async request => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  const adminProfile = await db.collection('users').doc(request.auth.uid).get();
  const adminRole = String(adminProfile.exists ? adminProfile.data().role : '').toLowerCase();
  if (adminRole !== 'admin' || adminProfile.data().active === false) {
    throw new HttpsError('permission-denied', 'Solo un administrador puede crear usuarios.');
  }

  const displayName = String(request.data?.displayName || '').trim().slice(0, 120);
  const username = String(request.data?.username || '').trim().toLowerCase();
  const password = String(request.data?.password || '');
  const role = String(request.data?.role || 'user').toLowerCase();

  if (!displayName) {
    throw new HttpsError('invalid-argument', 'El nombre es obligatorio.');
  }
  if (!/^[a-z0-9._-]{1,64}$/.test(username)) {
    throw new HttpsError('invalid-argument', 'El usuario solo admite minúsculas, números, punto, guion y guion bajo (sin acentos ni espacios).');
  }
  if (password.length < 6 || password.length > 256) {
    throw new HttpsError('invalid-argument', 'La contraseña debe tener entre 6 y 256 caracteres.');
  }
  if (!['admin', 'editor', 'user'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Rol no válido.');
  }

  const privileges = sanitizePrivileges(request.data?.privileges);
  const preferences = sanitizePreferences(request.data?.preferences);

  const registryRef = db.collection('user_registry').doc(username);
  const registrySnapshot = await registryRef.get();
  if (registrySnapshot.exists) {
    throw new HttpsError('already-exists', 'Ese nombre de usuario ya existe.');
  }

  const internalEmail = `${username}@dalse.local`;
  const matchingUsers = await db.collection('users').where('email', '==', internalEmail).get();
  if (!matchingUsers.empty) {
    throw new HttpsError('already-exists', 'Ese nombre de usuario ya existe.');
  }

  const secret = hashPasswordScrypt(password);

  let authUser;
  try {
    authUser = await auth.createUser({ email: internalEmail, password, displayName, disabled: false });
  } catch (createError) {
    if (createError.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Ese nombre de usuario ya existe.');
    }
    throw new HttpsError('internal', 'No se pudo crear la cuenta: ' + (createError.message || createError.code));
  }

  await registryRef.set({
    username,
    uid: authUser.uid,
    passwordHash: secret.passwordHash,
    salt: secret.salt,
    displayName,
    role,
    privileges,
    createdAt: FieldValue.serverTimestamp(),
    active: true,
    internalEmail
  });

  await db.collection('users').doc(authUser.uid).set({
    uid: authUser.uid,
    displayName,
    username,
    email: internalEmail,
    role,
    privileges,
    preferences,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: request.auth.uid
  });

  return { username, role, uid: authUser.uid };
});
