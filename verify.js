#!/usr/bin/env node
'use strict';

/**
 * verify.js - Red de seguridad para cambios en el proyecto.
 *
 * Comprueba tres cosas antes de considerar terminado un cambio:
 *   1) Sintaxis:    node --check sobre todos los .js de public/js/ (recursivo).
 *   2) Duplicados:  funciones globales declaradas en mas de un archivo
 *                   (colision en el scope global del navegador).
 *   3) Bump:        si se edito un public/js/*.js o public/css/*.css,
 *                   el ?v=N correspondiente en public/index.html debe subir.
 *
 * Uso:
 *   node verify.js            -> errores hacen fallar (exit 1)
 *   node verify.js --strict   -> los avisos tambien hacen fallar
 *
 * Solo usa modulos nativos de Node (fs, path, child_process). Sin dependencias.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname);
const PUBLIC = path.join(ROOT, 'public');
const JS_DIR = path.join(PUBLIC, 'js');
const IDX = path.join(PUBLIC, 'index.html');

const STRICT = process.argv.includes('--strict');
let errors = [];
let warnings = [];

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

function listJs(dir, out) {
  out = out || [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    errors.push('No se pudo leer el directorio: ' + rel(dir) + ' (' + e.message + ')');
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listJs(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// 1) Sintaxis
function syntaxCheck(files) {
  for (const f of files) {
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (e) {
      const stderr = (e.stderr || '').toString();
      const firstLine = stderr.split('\n').find(Boolean) || e.message;
      errors.push('Sintaxis  ' + rel(f) + ' -> ' + firstLine.trim());
    }
  }
}

// 2) Funciones globales duplicadas entre archivos
function dupGlobals(files) {
  const map = new Map(); // name -> Set<relfile>
  const reFn = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  const reWin = /^window\.([A-Za-z_$][\w$]*)\s*=\s*(?:function|\()/gm;
  const reConst = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function|\(|async\s*\()/gm;

  for (const f of files) {
    let src;
    try {
      src = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const add = (name) => {
      if (!name) return;
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(rel(f));
    };
    let m;
    while ((m = reFn.exec(src))) add(m[1]);
    while ((m = reWin.exec(src))) add(m[1]);
    while ((m = reConst.exec(src))) add(m[1]);
  }

  for (const [name, set] of map) {
    if (set.size > 1) {
      warnings.push('Funcion global posible duplicada "' + name + '" en: ' + [...set].join(', '));
    }
  }
}

// 3) Bump de version en index.html
function bumpCheck() {
  let modified;
  try {
    modified = execFileSync('git', ['diff', '--name-only', 'HEAD'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((p) => p.replace(/\\/g, '/'));
  } catch {
    warnings.push('No se pudo correr git (¿no es un repo?). Chequeo de bump omitido.');
    return;
  }

  const jsMod = modified.filter((p) => p.startsWith('public/js/') && p.endsWith('.js'));
  const cssMod = modified.filter((p) => p.startsWith('public/css/') && p.endsWith('.css'));
  if (jsMod.length === 0 && cssMod.length === 0) return;

  if (!fs.existsSync(IDX)) return;

  let headIdx = '';
  try {
    headIdx = execFileSync('git', ['show', 'HEAD:public/index.html'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
  } catch {
    return;
  }

  const versions = (html) => {
    const v = new Map();
    const re = /(?:src|href)="([^"]+\.(?:js|css))\?v=(\d+)"/g;
    let m;
    while ((m = re.exec(html))) v.set(m[1], parseInt(m[2], 10));
    return v;
  };

  const curV = versions(fs.readFileSync(IDX, 'utf8'));
  const headV = versions(headIdx);

  for (const f of [...jsMod, ...cssMod]) {
    const key = f.replace(/^public\//, '');
    if (!curV.has(key)) {
      warnings.push('Bump  ' + key + ' modificado pero sin ?v= en index.html');
      continue;
    }
    const before = headV.get(key) || 0;
    const after = curV.get(key);
    if (after <= before) {
      errors.push(
        'Bump  ' + key + ' modificado pero ?v= sigue en ' + after + ' (HEAD: ' + before + '). Subir el numero en index.html.'
      );
    }
  }
}

// --- ejecucion ---
const jsFiles = listJs(JS_DIR);
syntaxCheck(jsFiles);
dupGlobals(jsFiles);
bumpCheck();

console.log('\nverify.js  revision de ' + jsFiles.length + ' archivos JS en public/js/\n');

if (warnings.length) {
  console.log('AVISOS:');
  warnings.forEach((w) => console.log('  [warn] ' + w));
  console.log('');
}
if (errors.length) {
  console.log('ERRORES:');
  errors.forEach((e) => console.log('  [ERR ] ' + e));
  console.log('\nFallo: ' + errors.length + ' error(es). Corrige antes de entregar.');
  process.exit(1);
}
if (STRICT && warnings.length) {
  console.log('Fallo en --strict: ' + warnings.length + ' aviso(s) tratados como error.');
  process.exit(1);
}
console.log('OK: sin errores de sintaxis ni de bump.');
process.exit(0);
