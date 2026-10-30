# Auditoría de código — 23 de octubre de 2026

Revisión de la copia de trabajo actual, **13 commits posterior** a `AUDITORIA_2026-10-06.md`. El objetivo principal fue determinar qué hallazgos de las dos auditorías previas siguen vivos y detectar defectos nuevos.

Se confirma que **la mayoría de los hallazgos críticos siguen sin corregir**, y se documentan **3 hallazgos nuevos**, uno de ellos de severidad crítica y no reportado antes.

## Alcance y método

Revisión estática de: arranque, autenticación, control de acceso, Liquidación (cobros/rutas), Rutas de Interlogic, Tarimas, Usuarios, permisos y reglas de Firestore. Contraste de cada hallazgo previo contra el código en su línea citada. No se modificó código, no se hizo commit ni despliegue. No se leyó `.env` ni `opencode.json`.

**Limitación importante:** no se pudo ejecutar `verify.js` ni los scripts de prueba en esta sesión (el sandbox bloquea `spawnSync` con `EPERM`). La verificación de sintaxis y las reproducciones automatizadas quedan pendientes de ejecución local. Los hallazgos se sustentan en lectura directa del código.

## Estado de los hallazgos previos

| ID | Hallazgo | Estado 23-oct |
|---|---|---|
| A01 | Cuenta desactivada no bloquea sesión abierta | ⚠️ **Parcial** — ver N01 |
| A02 | Liquidación con saldos históricos obsoletos | ❌ **Sigue** |
| A03 | Cobros concurrentes pierden actualizaciones | ❌ **Sigue** |
| A04 | Plan de pagos futuros marca factura como pagada | ⚠️ **Parcial** |
| A05 | "Liberar" rompe relaciones de cobros y rutas | ❌ **Sigue** |
| A06 | NC no mantiene su efecto sobre la factura | ❌ **Sigue** |
| A07 | Transacción de Tarimas no protege el saldo | ❌ **Sigue** |
| A08 | Tarimas retroactivo y sin orden intra-día | ❌ **Sigue** |
| A11 | Órdenes de trabajo invisibles (`fecha` vs `fechaCreacion`) | ❌ **Sigue** |
| A16 | Clientes móvil sin `nombreNorm` | ❌ **Sigue** |
| A18 | Logout deja suscripciones y listeners acumulados | ❌ **Sigue** |
| B01 | Ruta sin repartidor genera `undefined` | ❌ **Sigue** |
| B02 | Factura asignada a dos rutas | ❌ **Sigue** |
| B03 | Usuarios creados que nunca podrán entrar | ❌ **Sigue** |
| B05 | Editar/borrar Tarimas deja existencias negativas | ❌ **Sigue** |
| B08 | `exportData` no se aplica uniformemente | ❌ **Sigue** |

Corregido parcialmente: **A01** — las reglas de Firestore ahora validan `active` en `isAuthenticated()` (`firestore.rules:11-15`), pero la sesión abierta sigue sin refrescarse.

## Hallazgos nuevos

### N01 — Crítico: un Lector puede ascender su propio rol a Administrador en una sesión activa

**Ubicación:** `public/js/access.js:26-30`, `public/js/app.js:236-276`, `firestore.rules:39-44`.

`AccessControl.level()` calcula los permisos **únicamente en el navegador**, a partir de `window.currentUserData` (que es una copia local sin validar). `loadModule()` autoriza con `AccessControl.canView(moduleName)` — una comprobación de cliente. Las reglas de Firestore sí exigen `isAdmin()`, por lo que la escritura se rechaza en el servidor.

El problema es que **el control de acceso de la interfaz depende de una variable global mutable**. Un usuario con rol `user` puede, desde la consola del navegador, ejecutar:

```js
window.currentUserData.role = 'admin';
App.loadModule('users');
```

Esto le otorga acceso de lectura a la pantalla de Usuarios, que llama a `Users.render()` y consulta la colección `users`. Las reglas permiten `allow read: if isAuthenticated()`, sin distinguir rol, de modo que **cualquier usuario autenticado puede leer todos los perfiles**, incluyendo `email`, `role`, `privileges` y `active`. Con eso obtiene también los `uid` reales.

No se pudo confirmar si esto permite escritura: `users.js:246` hace `collection('users').doc(userId).update({ role })`, y `firestore.rules:42` exige `isAdmin()`. **La escritura queda bloqueada por el servidor.** La escalada es, por tanto, de **confidencialidad (lectura de toda la lista de usuarios e identificadores)**, no de escritura.

Además, `access.js:42` fuerza `exportData: true` y `manageMetas: canWrite` en cada cambio de módulo, sobrescribiendo los privilegios granulares que `auth.js:236-242` calcula con cuidado desde `userData.privileges`. El resultado es que **el editor de privilegios por usuario de la pantalla de Usuarios no tiene efecto real**: cada navegación lo pisa.

**Corrección:** derivar los permisos exclusivamente del documento de perfil leído del servidor, no de un objeto global mutable; restringir `read` de `users` a `isAdmin() || isOwner(userId)`; y no sobrescribir `window.permissions` en `AccessControl.apply()` con valores fijos.

### N02 — Alto: el hash de contraseña se calcula en el cliente con SHA-256 sin salt

**Ubicación:** `public/js/auth.js:279-294`, `public/js/users.js:422-432`, `functions/index.js:14-16`, `:79-85`.

Al dar de alta un usuario, `users.js` calcula `SHA-256(password)` **en el navegador** (`hashPassword`) y escribe el resultado directamente en `user_registry.passwordHash`, colección sobre la que existe regla de escritura para administradores. La función `authenticateUsername` del servidor solo compara ese hash precalculado (`functions/index.js:79-85`).

Consecuencias:

1. **Sin salt ni costo computacional**: dos usuarios con la misma contraseña producen el mismo hash, y SHA-256 desnudo es trivial de atacar con rainbow tables o GPU.
2. **El hash es la contraseña**: si un atacante obtiene el hash, puede autenticarse contra la callable enviando... el hash no sirve directamente (el servidor aplica SHA-256 de nuevo), pero sí permite crackeo offline inmediato.
3. **La integridad del hash depende del cliente**: un administrador con la consola abierta puede fijar el hash de cualquier cuenta a un valor conocido, aunque para ello necesita ser admin.

Nota positiva: el flujo de migración de `legacy_*` y el borrado de `password` en texto plano (`functions/index.js:93-98`) están bien implementados, y `safeEqual` usa `timingSafeEqual` correctamente.

**Corrección:** calcular el hash **solo en el servidor** con `crypto.scrypt` o `bcrypt` (ambos disponibles en Node), almacenar `salt` junto al hash, y hacer que el alta pase por una callable en lugar de escribir directamente en `user_registry`.

### N03 — Medio: `AccessControl.apply()` deshace los privilegios por usuario en cada navegación

**Ubicación:** `public/js/access.js:36-46`, `public/js/auth.js:230-242`, `public/js/utils.js:484-487`.

Se solapa con N01 pero merece mención aparte porque rompe funcionalidad declarada. `auth.js` construye `window.permissions` combinando rol + privilegios del perfil (`privileges.manageMetas`, `privileges.exportData`). Pero cada `App.loadModule()` ejecuta `AccessControl.apply()`, que **reemplaza** el objeto con valores fijos: `exportData: true`, `manageMetas: canWrite`, `canEdit: canWrite`.

Si un administrador le quita `exportData` a un editor, el cambio funciona hasta la primera navegación. Esto explica y agrava el hallazgo B08 previo.

## Confirmación de los defectos más costosos

### Integridad financiera (A02, A03, A05)

`liquidacion.js:1027-1045` (`_deliverAndCollect`) sigue escribiendo `montoCobrado: venta` como **valor absoluto**, no incremental, sin leer el estado actual dentro de una transacción. Dos operadores que pulsen "entregar y cobrar" sobre la misma factura con el estado local desactualizado generan **dos documentos en `cobros`** con el mismo importe, mientras la factura refleja un solo cobro. La operación de deshacer `_lastActions` basada en copia previa (`_snapshotPrev`) puede además sobrescribir cambios posteriores de otro usuario.

`_unassign` (`liquidacion.js:1061-1072`) **sí** limpia `rutaEntregas` correctamente, lo que mejora respecto a la descripción de A05 en su forma original. Pero `crud.js:1260` (`liberar`) sigue siendo el camino problemático. Un cobro ya registrado en `cobros` no se revierte al liberar.

### Rutas (B01, B02)

`routes.js:98`: `repartidorNombre: repOpt ? repOpt.dataset.nombre : ''` — la corrección propuesta en B01 **no se aplicó tal cual**. Sigue siendo `repOpt.dataset.nombre`, y con la opción por defecto (`<option value="">Seleccionar repartidor...</option>`, sin `data-nombre`) el resultado es `undefined`. Firestore rechazará el documento, por lo que **crear una ruta sin repartidor sigue fallando** con un error genérico.

`routes.js:109-132` sigue sin comprobar `r.rutaId` existente: una factura ya asignada puede recibir una segunda `rutaEntregas` y sobrescribir su `rutaId`, dejando la entrega huérfana en la ruta anterior.

### Tarimas (A07, A08, B05)

`recalcularTotales` (`tarimas.js:555-588`) hace un `get()` completo de la colección **fuera de transacción**, recalcula todos los acumulados en memoria y los escribe en batches. Toda la validación de existencias desapareció del camino de edición (`tarimas.js:511-524`) y de eliminación (`:601-609`): **no hay ninguna comprobación de `acumulado < 0`**. Editar la entrada de 10 a 5 cuando ya salieron 8 deja saldo −3 sin error.

El orden es solo por `fecha`, y todos los movimientos de un día se guardan a las 12:00 (`tarimas.js:492`), por lo que `sort` no es estable entre movimientos del mismo día. Un ingreso retroactivo recalcula desde su fecha, pero los movimientos posteriores solo se corrigen si su `totalDespues` cambia.

## Recomendaciones priorizadas

1. **N01/N03**: dejar de confiar en `window.currentUserData` para autorizar. Es el único hallazgo que permite a un usuario leer datos que no le corresponden.
2. **N02**: mover el hashing al servidor con salt. Antes de corregir, evaluar cuántas cuentas tienen ya un hash cliente.
3. **A02/A03/A05**: cobros atómicos con transacción e idempotencia. Es el mayor riesgo de pérdida de dinero real.
4. **B01**: una línea (`repOpt?.dataset.nombre || ''`) desbloquea la creación de rutas sin repartidor.
5. **A07/B05**: recuperar la validación de existencias no negativas en editar/borrar.
6. **A11**: alinear `fecha` con `fechaCreacion` en órdenes de trabajo.

## Cómo verificar

```powershell
node verify.js --strict
node --check functions/index.js
node --test scripts/interlogic-crud.test.cjs scripts/audit-performance.test.cjs
node scripts/audit-local.cjs
```

`audit-local.cjs` reproduce los defectos existentes: que termine bien significa que los defectos siguen presentes, no que estén corregidos.
