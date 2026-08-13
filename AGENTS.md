# AGENTS.md - Reglas vinculantes para cualquier AI

> Este archivo lo leen automaticamente Aider, Claude Code, Cursor, opencode, Qwen,
> Kilo, miMocode, etc. **Antes de tocar codigo, lee todo este archivo y obedecelo.**
> Si una instruccion del usuario contradice algo aqui, confirma antes de saltarte la regla.

## Regla de oro

**Entender el flujo antes de tocar. Verificar que no se rompe despues.**

1. Antes de editar, abre `public/index.html` y revisa el orden de carga de los `<script>`
   (lineas ~370-430). Ahi se ve que depende de que.
2. Toca **solo lo minimo necesario** para resolver lo pedido. No "aproveches" para
   refactorizar, renombrar ni reformatear codigo que funciona.
3. Antes de entregar, corre la verificacion (ver seccion "Verificacion obligatoria").

## Estructura del proyecto

Proyecto **JavaScript vanilla + Firebase Hosting**. Sin `package.json`, sin build, sin
bundlers, sin tests automaticos. El navegador carga los `.js` directamente en orden.

Orden de carga (lo importante):

```
CDNs:        apexcharts, exceljs, xlsx, html2pdf
Firebase:    app / auth / firestore / storage (compat 10.7.1)
Nucleo:      theme.js  ->  init.js  ->  utils.js  ->  dashboard.js  ->  app.js
             auth.js  ->  users.js  ->  settings.js  ->  deliveries.js
Interlogic:  interlogic/core.js -> render.js -> filters.js -> crud.js
             -> excel.js -> routes.js -> index.js
Otros:       problemas.js, clientes.js, liquidacion.js, entregas.js,
             repartidores.js, kpi.js, asistencia.js
Cobranza:    cobranza/core.js -> dashboard.js -> alerts.js -> gestiones.js
             -> adjustments.js -> index.js
Flota:       flota/core.js -> vehicles.js -> maintenance.js -> orders.js -> index.js
```

- Cada modulo se inicializa cuando el usuario abre su seccion (no todo de una vez).
- `core.js` de cada subcarpeta es la base del modulo: **no lo cambies salvo que sea
  estrictamente necesario**, porque los demas archivos del modulo dependen de el.
- Patrones en uso: objetos literales tipo `const X = { ... }` con metodos (p. ej.
  `InterlogicRender`, `Clientes`, `Cobranza`), delegacion de eventos en un contenedor
  padre (no listeners individuales por boton), y cache-busting con `?v=N` en `index.html`.

## Prohibido tocar sin aprobacion explicita

Estos archivos son criticos o sensibles. **No los modifiques** salvo que el usuario te
lo pida explicitamente, y aun asi confirma el alcance antes:

- `firestore.rules` y `firestore.indexes.json` - seguridad y indices de la BD.
- `firebase.json`, `.firebaserc`, `storage.rules` - config de despliegue.
- `.env` - secretos. Nunca lo leas, lo imprimas ni lo commitees.
- `public/js/auth.js` y `public/js/init.js` - autenticacion y arranque.
- `public/js/interlogic/core.js`, `public/js/cobranza/core.js`, `public/js/flota/core.js`
  - nucleo de cada modulo.
- `opencode.json` - configuracion de las AIs (incluye API keys).
- Scripts historicos en la raiz: `fix_*.js`, `fix_*.py`, `apply_*.js`, `add_*.js`,
  `nvidia_integrate.py`, `fix_corruption.js`. Son parches de un solo uso: no los recicles.

## Convenios obligatorios

### Bump de version (cache-busting)
Cada vez que edites un `public/js/*.js` o `public/css/*.css` que se carga con `?v=N`
en `index.html`, **sube ese numero** (p. ej. `render.js?v=4` -> `render.js?v=5`).
Si el archivo no tenia `?v=`, agregaselo al editarlo. Esto fuerza al navegador a usar
la version nueva y evita el clasico "lo arregle pero el cliente sigue viendo el viejo".

### Estilo
- **Sin comentarios** a menos que el usuario los pida.
- No reformatees archivos completos ni cambies estilo de codigo que ya funciona.
- No agregues librerias nuevas (no hay `package.json`; el proyecto es vanilla + CDN).
- Respeta los patrones existentes (objetos literales, delegacion de eventos, etc.).
- Si anades un elemento al DOM que dispara eventos, usa el listener delegado que ya
  existe en el contenedor padre; no anadas un `addEventListener` nuevo por elemento.

### Commits
- No commitees nada salvo que el usuario te lo pida explicitamente.
- Si te pide commit, revisa `git status` y `git diff` primero y stage solo lo pertinente.
- Mensajes en español, estilo del historial: `fix(modulo): descripcion` o `feat(modulo): ...`.

## Verificacion obligatoria antes de entregar

**La verificacion es AUTOMATICA.** No necesitas que el usuario te la pida:

- **Plugin de opencode** (`.opencode/plugins/verify.js`): despues de cada edicion a un
  archivo de `public/js/` o `public/css/`, corre `node verify.js` y si falla te
  devuelve el error en el propio resultado de la herramienta. Corrigelo y continua.
- **Git pre-commit hook** (`.git/hooks/pre-commit`): bloquea cualquier commit si
  `verify.js` falla. Aplica a todas las AIs y al usuario.

Si aun asi quieres confirmar a mano (recomendado tras cambios grandes):

```bash
node verify.js
```

Que hace `verify.js` (sin dependencias, solo Node nativo):
1. `node --check` sobre los 36 `.js` de `public/js/` -> errores de sintaxis.
2. Detecta funciones globales declaradas en mas de un archivo (colision de scope).
3. Verifica que si se edito un JS/CSS, su `?v=N` en `index.html` haya subido.

- Si **falla** (por el plugin o a mano), corrige antes de dar por terminado el cambio.
  No entregues con errores ni fuerces un commit que el hook va a bloquear.
- Con `node verify.js --strict` los avisos tambien cuentan como fallo (mas estricto).

### Si verify.js falla por el bump despues de editar un JS/CSS
Es el comportamiento esperado: editaste `render.js` pero todavia no subiste `?v=` en
`index.html`. Sube el numero (p. ej. `render.js?v=5` -> `?v=6`) y vuelve a correr
`node verify.js` hasta que pase. No ignores el aviso.

## Codigo de referencia rapida

- `InterlogicRender._renderTableNow()` en `public/js/interlogic/render.js` - render de
  la tabla principal; usa delegacion de eventos en `contentArea` (render.js ~411).
- `Clientes`, `Cobranza`, `Flota` - modulos con la misma estructura (objeto literal + metodos).
- `public/index.html` lineas ~370-430 - orden de carga de todos los scripts.
- `firestore.rules` - reglas de seguridad (prohibido tocar sin aprobacion).

## Nota para la AI

Si tienes duda sobre si un cambio puede romper el flujo, **prefiere preguntar antes** a
hacer el cambio. La prioridad numero uno es **no romper lo que ya funciona**.
