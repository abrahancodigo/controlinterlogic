# AGENTS.md - Reglas vinculantes para cualquier AI

> Lo leen Aider, Claude Code, Cursor, opencode, Qwen, Kilo, miMocode, etc.
> **Antes de tocar codigo, lee todo este archivo y obedecelo.**
> Si una instruccion del usuario contradice algo aqui, confirma antes de saltarte la regla.

## Regla de oro

**Entender el flujo antes de tocar. Verificar que no se rompe despues.**

1. Antes de editar, abre `public/index.html` y revisa el orden de carga de los `<script>`
   (lineas ~376-421). Ahi se ve que depende de que.
2. Toca **solo lo minimo necesario**. No refactorices, renombres ni reformatees codigo
   que funciona.
3. Antes de entregar, corre `node verify.js` (ver "Verificacion obligatoria").

## Stack y estructura

**JavaScript vanilla + Firebase Hosting.** Sin build, sin bundler, sin transpilacion:
el navegador carga los `.js` en el orden de `public/index.html`.

- Firebase Web SDK **compat 10.7.1** (CDN gstatic). Usa la API `firebase.firestore()`,
  no la modular: todo el codigo asume `firebase.*` global.
- `functions/` es un paquete Node aparte, con su propio `package.json`. Se despliega
  con el resto pero se instala por separado.
- No hay tests automatizados. `verify.js` es la unica red de seguridad.

Orden de carga relevante (index.html):

```
theme.js -> init.js (no defer) -> utils.js -> access.js -> modules.js
  -> shared/components.js -> dashboard.js -> app.js
  -> auth.js (no defer) -> users.js -> settings.js -> deliveries.js
  -> interlogic/core -> render -> filters -> crud -> excel -> routes -> index
  -> entregas -> problemas -> clientes -> kpi -> asistencia
  -> flota/core -> vehicles -> maintenance -> orders -> index
  -> tarimas -> ivette -> ux_redesign
```

`init.js` y `auth.js` se cargan **sin** `defer`; el resto (incluido `theme.js`) con
`defer`. No reordenes ni quites `defer` sin entender la dependencia.

## Modulos

Los 13 modulos del nav (`data-module`): `dashboard`, `interlogic`, `entregas`,
`tarimas`, `ivette`, `problemas`, `clientes`, `flota`, `deliveries`, `kpi`,
`asistencia`, `settings`, `users`.

- `entregas` es un **reporte sobre la coleccion `interlogic`**; `deliveries` es
  **Entrega de Muebles** (otra cosa). No los confundas.
- Los modulos antiguos `liquidacion`, `cobranza` y `repartidores` ya no existen.
- Cada modulo se registra con `ModuleRegistry.register({ key, label, render, cleanup })`
  y se renderiza solo cuando el usuario abre su seccion. Si el `<script>` no esta en
  `index.html`, `ModuleRegistry.has()` da false, la nav lo oculta y `App.loadModule`
  falla: no hay error de sintaxis que te avise.

### Para agregar o quitar un modulo hay que tocar 4 sitios

1. `<script>` en `public/index.html` (con `?v=1`).
2. `AccessControl.modules` en `public/js/access.js` (si no esta ahi, `level()` = `hidden`).
3. `ModuleRegistry.register(...)` al final del archivo del modulo (patron: al final,
   despues de definir el objeto literal).
4. HTML del nav: `.nav-item` en el sidebar, `.bn-item` en la bottom nav movil y, si
   aplica, el menu "Mas".

### Desktop y movil son dos renders distintos

Muchos modulos ramifican en `render()` con `window.innerWidth <= 768` y tienen
`renderMobile()` + otra plantilla HTML (`ivette.js`, `problemas.js`, `tarimas.js`);
otros solo guardan `this.isMobile` y ramifican dentro del mismo render (`entregas.js`).
**Un cambio de UI casi siempre hay que aplicarlo en las dos rutas**, no solo en la de
escritorio.

## Permisos

- Roles: `admin`, `editor`, `user` (se muestra como "Lector").
- `AccessControl.level()` devuelve `hidden` / `read` / `write`; `access.js` lo traduce a
  `window.permissions` (`canCreate`, `canEdit`, `canDelete`, `readOnly`, `exportData`,
  `manageMetas`, `entregaScope`).
- Privilegios granulares por usuario en `users/{uid}.privileges`:
  `modules[]`, `readOnly`, `entregaScope[]`, `manageMetas`, `exportData`.
- `window.permissions` solo es valido **despues** de `AccessControl.apply(modulo)`, que
  llama `App.loadModule()`. No lo leas antes de renderizar.
- `canDelete` es exclusivo de `admin`. Los modulos deben usar `window.permissions.*`
  en vez de comparar roles a mano.

## Control Interlogic (modulo principal)

- La coleccion es `interlogic` (una fila = una guia/venta). Dinero: usar
  `InterlogicCore.signedAmount()` / `signedAmount()` de `utils.js`.
- **Notas de credito (`doc === 'NC'`) cuentan negativo**; registros con `anulado: true`
  cuentan 0. Restar/sumar con `venta` directo rompe los totales.
- Los porcentajes/costos se redondean con `toCents`/`fromCents` (enteros), no con
  aritmetica de floats suelta.
- `_fullMode = true` significa que el rango se cargo completo con `loadFullRange()` (sin
  listener en tiempo real); no asumas listener activo.
- La tabla se renderiza en `InterlogicRender._renderTableNow()` y usa delegacion de
  eventos en `contentArea`. No agregues listeners por fila.
- Columnas ocultas se persisten en `localStorage['il_hidden_cols']`.

## Datos y backend

- Colecciones en `firestore.rules`: `interlogic`, `entregas`/`rutaEntregas`/`rutas`,
  `tarimas_walmart`, `ivette_movimientos`, `deliveries`, `problemas`, `clientes`,
  `proveedores`, `repartidores`, `vehiculos`, `mantenimientos`, `ordenesTrabajo`,
  `kpiEvaluations`, `asistencia`, `notasCredito`, `users`, `user_registry`, `config`,
  `login_attempt_limits`.
- Cloud Functions en `functions/index.js`: `authenticateUsername` (login por nombre de
  usuario; el frontend lo llama via `httpsCallable`) y `createManagedUser`.
- El login NO es email directo: `auth.js` resuelve usuario -> email con la function y
  luego `signInWithEmailAndPassword`.

## Librerias CDN

`apexcharts`, `exceljs`, `xlsx`, `html2pdf`/`jspdf` **no** estan en `<script>`: se cargan
bajo demanda con `ensureLib(nombre)` de `utils.js` (y se precargan al final). Para usarlas:

```js
await ensureLib('xlsx');
```

No agregues `<script src="...cdn...">` para esto; rompe el arranque y duplica descargas.

## Prohibido tocar sin aprobacion explicita

- `firestore.rules`, `firestore.indexes.json` - seguridad e indices.
- `firebase.json`, `.firebaserc`, `storage.rules` - despliegue.
- `.env` - secretos. Nunca lo leas, imprimas ni commitees.
- `public/js/auth.js`, `public/js/init.js` - autenticacion y arranque.
- `public/js/interlogic/core.js`, `public/js/flota/core.js` - nucleo de cada modulo.
- `opencode.json` - config de las AIs (contiene API keys).
- Scripts historicos de raiz (`fix_*.js`, `fix_*.py`, `apply_*.js`, `add_*.js`,
  `nvidia_integrate.py`): parches de un solo uso, no los recicles.

## Convenios obligatorios

### Bump de version (cache-busting)
Si editas un `public/js/*.js` o `public/css/*.css` referenciado con `?v=N` en
`index.html`, **sube ese numero** (`?v=4` -> `?v=5`). Si no tenia `?v=`, agregaselo.
Sin esto el cliente sigue viendo la version vieja y el bug "no se arregla".

### Estilo
- **Sin comentarios** salvo que el usuario los pida.
- No reformatees archivos completos ni cambies el estilo existente.
- No agregues librerias ni dependencias nuevas.
- Patrones en uso: objeto literal `const X = { ... }` con metodos, delegacion de
  eventos en un contenedor padre, `SharedComponents.renderModuleHeader(...)`.
- Si agregas elementos al DOM, engancha eventos con el listener delegado del contenedor;
  no un `addEventListener` por elemento.
- Tema: el anti-flash vive en un `<script>` inline del `<head>` y `ThemeManager` solo
  sincroniza. No muevas ese script ni las hojas de estilo antes de el.

### localStorage (claves en uso)
`dalse-theme`, `dalse-theme-default:<uid>`, `dalse-remembered-user`, `il_hidden_cols`,
`il_col_order`, `il_last_values`, `ux-compact`, `entregas_cols`. No renombres estas
claves: rompen preferencias ya guardadas en los navegadores de los usuarios.

### Commits
- No commitees salvo que el usuario lo pida explicitamente.
- Revisa `git status` y `git diff` y stagea solo lo pertinente.
- Mensajes en español, estilo del historial: `fix(modulo): ...`, `feat(modulo): ...`.

## Verificacion obligatoria antes de entregar

**No hay plugin ni hook automatico: la verificacion es manual.** No existe
`.opencode/plugins/verify.js` ni `.git/hooks/pre-commit` (verificado). Si no corres
`verify.js`, nadie lo corre por ti.

```bash
node verify.js          # errores -> exit 1
node verify.js --strict # los avisos tambien fallan
```

`verify.js` (solo Node nativo, sin dependencias) comprueba:
1. `node --check` sobre los **33** `.js` de `public/js/` (recursivo).
2. Funciones globales declaradas en mas de un archivo (colision de scope global).
3. Que el `?v=N` en `index.html` haya subido para cada JS/CSS modificado segun git.

Si falla por el bump es lo esperado: sube el `?v=` y vuelve a correrlo hasta que pase.

## Trampas conocidas

- `public/js/signature-pad.js` existe pero **no se carga**. No lo agregues al HTML.
- `public/diagnostico-login.html` es herramienta temporal y esta en `.gitignore`.
- `preview/`, `.visual-backups/`, `.opencode/`, `.claude/`, `.perch/`, `.freebuff/`,
  `.commandcode/`, `.mimocode/` estan gitignoreados: son locales, no los commitees.
- Hay `vercel.json` ademas de Firebase; el deploy normal es Firebase. No borres ninguno.
- `README.md`/`DEPLOY_GUIDE.md` estan desactualizados (hablan solo de "deliveries").
  La fuente de verdad es el codigo y `index.html`.

## Deploy

```bash
firebase deploy --only hosting          # solo frontend (lo habitual)
firebase deploy --only functions
firebase deploy --only firestore:rules   # requiere aprobacion
firebase serve                           # local
```

## Codigo de referencia rapida

- `public/index.html` (~376-421): orden de carga y versiones `?v=`.
- `public/js/app.js`: `App.loadModule()` (permiso -> cleanup -> render).
- `public/js/access.js`: permisos y visibilidad del nav.
- `public/js/modules.js`: `ModuleRegistry`.
- `public/js/interlogic/render.js`: `_renderTableNow()` (tabla principal).
- `public/js/shared/components.js`: header de modulo y componentes compartidos.
- `public/js/utils.js`: `signedAmount`, `ensureLib`, toasts, fechas, sanitizacion.

## Nota para la AI

Si dudas si un cambio rompe el flujo, **pregunta antes**. La prioridad numero uno es
**no romper lo que ya funciona**.
