# Auditoría del código local — 6 de octubre de 2026

Se encontraron **28 hallazgos: 11 de prioridad alta, 16 de prioridad media y 1 de prioridad baja**. Dieciséis comportamientos se reprodujeron ejecutando el código real con Firebase y DOM simulados. Los demás se sustentan en la lectura de consultas, escrituras y reglas locales. Estos resultados no indican cuántos registros de producción están afectados.

## Alcance y resultados

Se revisaron arranque, autenticación, navegación, Dashboard, Interlogic y sus submódulos, Clientes, Entregas, Problemas, Liquidación, KPI, Asistencia, Flota y Tarimas. También se contrastaron consultas y escrituras con las reglas, índices y configuración locales de Firebase, y se revisó la función de autenticación del servidor. Se comprobaron las referencias JS/CSS del HTML. No se leyeron `.env` ni `opencode.json`.

| Comprobación | Resultado |
| --- | --- |
| `node verify.js` y `node verify.js --strict` | Pasan: 29 archivos JS sin errores de sintaxis, colisiones detectadas por el verificador ni errores de versión |
| `node --check functions/index.js` | Pasa |
| Carga conjunta de los 28 scripts locales del HTML en VM | Pasa, con entorno simulado; no ejecuta el arranque real de Firebase |
| Referencias JS/CSS locales en `public/index.html` | Existen |
| Pruebas existentes: `node --test scripts/interlogic-crud.test.cjs scripts/audit-performance.test.cjs` | 10 pruebas: 6 pasan y 4 fallan; explicación en A28 |
| `node scripts/audit-local.cjs` | 16 reproducciones de defectos confirmadas |

La auditoría se realizó sobre la copia de trabajo con sus cambios pendientes, no exclusivamente sobre `HEAD`. Se añadieron este informe y el script de diagnóstico. No se modificó código de la aplicación, no se hizo commit ni despliegue, y no hubo escrituras remotas.

No se ejecutó una sesión autenticada en un navegador ni un emulador de Firebase. Quedan fuera de la comprobación efectiva las reglas realmente desplegadas, los índices existentes en producción, las credenciales, los datos reales, la disponibilidad de CDN, los flujos reales de impresión/Excel y el aspecto visual en dispositivos. Pasar el verificador no comprueba esas condiciones ni los defectos de negocio siguientes.

## Prioridad alta

### A01. Desactivar una cuenta no bloquea sus operaciones en una sesión abierta

**Ubicación:** `firestore.rules:11`, `firestore.rules:16`, `firestore.rules:22`, `storage.rules:5`, `public/js/auth.js:154`, `public/js/users.js:326`.

Las reglas comprueban autenticación y rol, pero no `users/{uid}.active`. La interfaz comprueba `active` al iniciar sesión y no suscribe cambios del perfil. Un administrador/editor ya conectado conserva autorización de escritura después de que se cambie su perfil a `active: false`. Un usuario conectado conserva acceso de lectura.

**Corrección:** validar el estado activo en la autorización de datos y atender cambios de perfil en sesiones abiertas. Confirmado por contraste de código; no se probó contra reglas desplegadas.

### A02. Liquidación conserva saldos históricos antiguos después de cobrar o entregar

**Ubicación:** `public/js/liquidacion.js:222`, `public/js/liquidacion.js:254`, `public/js/liquidacion.js:277`, `public/js/liquidacion.js:993`.

El listener solo incluye registros creados hoy. Las facturas anteriores se cargan una vez; las operaciones escriben en Firebase sin actualizar ese histórico local ni releerlo. Una factura antigua puede seguir apareciendo pendiente después de guardarla y permite repetir el cobro desde su estado antiguo.

**Reproducción local:** ejecutar dos veces `_deliverAndCollect()` sobre una venta de 100 crea dos cobros que suman 200, mientras el registro local continúa con `montoCobrado: 0`.

**Corrección:** refrescar los registros afectados y hacer el cobro idempotente con validación del estado actual en el servidor/transacción.

### A03. Dos cobros o notas de crédito simultáneos pueden perder actualizaciones

**Ubicación:** `public/js/liquidacion.js:1069`, `public/js/liquidacion.js:1143`, `public/js/liquidacion.js:1555`, `public/js/interlogic/crud.js:788`, `public/js/interlogic/crud.js:1752`.

Los nuevos saldos se calculan desde una copia local o una lectura ordinaria y se guardan como valores absolutos en batches. No se valida que el saldo siga siendo el mismo. Dos clientes que parten de 0 y abonan 20 y 30 pueden dejar dos comprobantes por 50 y una factura con solo 20 o 30 cobrados. El deshacer basado en una copia anterior también puede sobrescribir cambios posteriores.

**Corrección:** transacciones sobre la factura actual, identificadores de operación y controles de concurrencia para deshacer. Firebase describe el seguimiento de lecturas y reintentos en su [documentación de transacciones](https://firebase.google.com/docs/firestore/manage-data/transactions).

### A04. Un plan de pagos futuros marca una factura como pagada

**Ubicación:** `public/js/liquidacion.js:1143`.

El estado se calcula usando `nuevoCobrado + progTotal`, aunque los pagos programados se guardan con `estado: 'programado'` y todavía no se recibieron.

**Reproducción local:** venta de 100, abono recibido de 20 y plan futuro de 80 producen `montoCobrado: 20`, `montoPendiente: 80`, `estadoCobro: 'pagado'` y `cobrado: true`.

**Corrección:** decidir el estado pagado exclusivamente con dinero/ajustes efectivamente aplicados; mantener el plan como compromiso futuro.

### A05. “Liberar” rompe las relaciones de cobros y rutas

**Ubicación:** `public/js/interlogic/crud.js:1190`.

La operación borra `rutaId` y reinicia el cobro en la factura, pero deja los documentos de `cobros` y `rutaEntregas` intactos. Luego permite eliminar o anular la factura. Puede quedar una entrega en la ruta y comprobantes asociados a una factura liberada o eliminada.

**Reproducción local:** una factura con ruta y 100 cobrados recibe una sola escritura sobre `interlogic`; no hay operaciones sobre las colecciones relacionadas.

**Corrección:** definir una reversión consistente, comprobar si la ruta está liquidada y conservar la trazabilidad financiera.

### A06. Editar, borrar o anular una NC no mantiene su efecto sobre la factura

**Ubicación:** `public/js/interlogic/crud.js:755`, `public/js/interlogic/crud.js:818`, `public/js/interlogic/crud.js:900`, `public/js/interlogic/crud.js:1111`.

Crear una NC puede crear `notasCredito`, crear el registro NC en `interlogic` y reducir el saldo de otra factura. Editarla actualiza únicamente su registro en `interlogic`; borrarla o anularla tampoco revierte el descuento ni sincroniza `notasCredito`. La NC creada no conserva en su documento Interlogic el vínculo completo necesario para revertirla con fiabilidad.

**Reproducción local:** borrar un registro NC genera únicamente el borrado de `interlogic`; no elimina/revierte los demás efectos.

**Corrección:** enlazar ambos registros y gestionar cambios/reversiones con una operación coherente sobre todos los documentos afectados.

### A07. La transacción de Tarimas no protege el saldo leído

**Ubicación:** `public/js/tarimas.js:532`.

La lectura del último movimiento se hace con `query.get()` ordinario dentro del callback; la transacción solo escribe un documento nuevo. No lee un documento de saldo mediante `transaction.get()`, por lo que no hay un saldo común sobre el cual detectar conflictos.

**Reproducción local:** partiendo de 10, dos ingresos de 5 y 7 guardan saldos 15 y 17; el saldo correcto sería 22. Dos salidas pueden pasar ambas la validación de existencias.

**Corrección:** usar un documento de saldo leído y actualizado dentro de la transacción. El criterio de concurrencia está explicado en la [documentación de Firebase](https://firebase.google.com/docs/firestore/manage-data/transactions).

### A08. Tarimas calcula mal movimientos retroactivos y carece de orden dentro del día

**Ubicación:** `public/js/tarimas.js:172`, `public/js/tarimas.js:189`, `public/js/tarimas.js:502`, `public/js/tarimas.js:540`.

Un movimiento nuevo usa el saldo del movimiento más reciente, aunque se registre con una fecha anterior. No recalcula los movimientos posteriores. Además, todos se guardan a las 12:00 de la fecha seleccionada y se ordenan únicamente por `fecha`, sin secuencia de operación dentro de un mismo día.

**Reproducción local:** con saldo 10 el 6 de octubre, agregar una entrada de 5 el día 5 guarda 15 en el movimiento retroactivo, pero el saldo visible del movimiento del día 6 permanece en 10.

**Corrección:** definir una secuencia estable y recalcular o mantener un saldo independiente consistente al insertar, editar o eliminar movimientos.

### A09. Asistencia conserva un autoguardado al cambiar de quincena

**Ubicación:** `public/js/asistencia.js:111`, `public/js/asistencia.js:128`, `public/js/asistencia.js:462`.

Al descartar cambios y cambiar de período no se cancela `saveTimer`. El callback calcula el período al ejecutarse y usa el estado mutable de ese momento. Puede guardar en la quincena nueva durante su carga, con información incompleta o de la anterior. Tampoco se cancela al salir del módulo.

**Reproducción local:** marcar cambios, descartar y pasar a noviembre deja el callback pendiente; al ejecutarlo escribe `asistencia/2026-11-1`.

**Corrección:** cancelar/terminar el guardado antes de cambiar de período o salir, y capturar una copia del período y datos de cada escritura.

### A10. Formularios insertan datos como HTML sin escape suficiente

**Ubicación:** `public/js/deliveries.js:1168`, `public/js/clientes.js:365`, `public/js/kpi.js:308`, `public/js/flota/vehicles.js:250`, `public/js/utils.js:189`.

Entregas móvil concatena cliente, tienda y accesorios directamente en `innerHTML`. En otros formularios, `sanitizeHTML()` escapa texto, pero no las comillas necesarias para introducirlo en atributos `value="..."`. Un nombre con comillas rompe el formulario; datos manipulados pueden introducir atributos de eventos o elementos ejecutables al abrir una edición. Hay campos de Interlogic y Entregas escritorio que ya utilizan un escape adicional correcto, pero no está aplicado de forma uniforme.

**Reproducción local:** el cliente `Ana" data-audit="injected` crea un atributo HTML adicional en el formulario móvil de Entregas. Se comprobó el HTML generado; no se ejecutó una carga maliciosa en un navegador.

**Corrección:** asignar valores mediante propiedades DOM o escapar según el contexto de texto/atributo y eliminar concatenaciones de datos sin escape.

### A11. Las órdenes de trabajo nuevas no aparecen en la consulta de Flota

**Ubicación:** `public/js/flota/core.js:52`, `public/js/flota/orders.js:175`.

La consulta usa `orderBy('fecha')`, pero el formulario guarda `fechaCreacion`, `fechaInicio` y eventualmente `fechaFinEstimada`; no guarda `fecha`. El registro se crea correctamente y queda excluido de la lista. Firestore excluye documentos sin el campo de ordenación, según su [documentación de consultas](https://firebase.google.com/docs/firestore/query-data/order-limit-data).

**Reproducción local:** la escritura de una orden nueva contiene `fechaCreacion` y carece de `fecha`.

**Corrección:** alinear el campo guardado con el consultado y contemplar los registros existentes sin ese campo.

## Prioridad media

### A12. Los botones de Usuarios no funcionan en móvil

**Ubicación:** `public/js/users.js:90`, `public/js/users.js:111`, `public/js/users.js:188`.

La rama móvil devuelve antes de instalar el listener que procesa `data-action`. Además, su contenedor de acciones llama a `event.stopPropagation()`, lo que impediría la delegación al contenedor superior aun moviendo el listener sin atender este detalle.

**Reproducción local:** se renderizan cuatro acciones y el contenedor no tiene listener de clic.

**Corrección:** instalar la delegación para ambas vistas y permitir que los eventos lleguen al contenedor que los procesa.

### A13. Los editores no pueden generar correlativos de Entregas

**Ubicación:** `public/js/deliveries.js:167`, `public/js/deliveries.js:265`, `public/js/deliveries.js:1192`, `firestore.rules:73`.

La interfaz permite crear a editores, pero generar un folio escribe `config/counters`, donde solo un administrador puede escribir. En móvil toda creación pasa por este contador. En escritorio el folio estándar también intenta incrementarlo cuando supera el valor actual.

**Corrección:** hacer la asignación de folios en una operación autorizada para la creación de entregas, con alcance limitado sobre el contador.

### A14. Entregas escritorio permite folios duplicados

**Ubicación:** `public/js/deliveries.js:186`, `public/js/deliveries.js:234`, `public/js/deliveries.js:257`, `public/js/deliveries.js:320`.

El folio sugerido ya queda escrito en el input. Dos formularios pueden obtener el mismo siguiente número y guardar ambos ese valor. La ruta normal que lo guarda no reserva un número en una transacción ni comprueba su unicidad; además, la actualización ordinaria del contador puede retroceder con escritores concurrentes.

**Corrección:** reservar el folio al guardar y crear la entrega en la misma operación; validar por separado los folios manuales.

### A15. Editar una entrega móvil cambia el tipo de mueble

**Ubicación:** `public/js/deliveries.js:1168`, `public/js/deliveries.js:1183`.

El selector empieza en `Sala`; no se selecciona el valor de la entrega existente ni se conservan tipos personalizados.

**Reproducción local:** editar un `Refrigerador` y guardar sin tocar el selector escribe `Sala`.

**Corrección:** seleccionar el valor original y agregar una opción para valores existentes fuera del catálogo.

### A16. Clientes móvil no mantiene la clave usada para buscar duplicados

**Ubicación:** `public/js/clientes.js:971`, `public/js/clientes.js:613`, `public/js/clientes.js:782`.

El formulario móvil no guarda `nombreNorm`. Un cliente nuevo queda fuera de búsquedas por esa clave; al renombrar uno existente mantiene la clave del nombre anterior. La importación y el autoguardado desde Interlogic pueden crear duplicados o actualizar el cliente equivocado.

**Reproducción local:** crear `Ana` desde el formulario móvil produce una escritura sin `nombreNorm`.

**Corrección:** calcular y guardar la clave normalizada en creación y edición, y revisar registros móviles previos.

### A17. La importación de Clientes deja la pantalla y caché anteriores

**Ubicación:** `public/js/clientes.js:765`, `public/js/clientes.js:811`, `public/js/clientes.js:143`.

Después de importar se muestra éxito y se cierra el modal, pero no se actualiza `records`, no se invalida la caché y no se vuelve a renderizar. El usuario sigue viendo datos antiguos y el autocompletado puede seguir usando esa copia.

**Corrección:** actualizar o recargar la lista al terminar y reflejar también importaciones parcialmente completadas si falla una escritura.

### A18. Cerrar sesión deja suscripciones, permisos y listeners acumulados

**Ubicación:** `public/js/auth.js:183`, `public/js/auth.js:192`, `public/js/app.js:7`, `public/js/app.js:34`.

Logout vacía solo parte del estado y pone `App.currentModule` a `null`, sin pasar por la limpieza del módulo activo. Conserva `window.permissions` y listeners de Dashboard/Interlogic/Flota, entre otros. Cada login llama otra vez a `App.init()`, que añade más listeners a los mismos controles; el botón de sidebar puede alternar dos veces después de entrar por segunda vez. Los listener de Firebase restantes pueden recibir errores al salir.

**Reproducción local:** logout desde Interlogic no invoca su unsubscribe y conserva `permissions.canDelete`.

**Corrección:** una limpieza común de sesión y una inicialización de navegación que se ejecute una sola vez.

### A19. Cargas pendientes pueden actuar después de cambiar de pantalla

**Ubicación:** `public/js/flota/index.js:15`, `public/js/users.js:43`, `public/js/interlogic/crud.js:92`, `public/js/liquidacion.js:254`.

Flota espera lecturas y luego renderiza sin comprobar si continúa siendo el módulo activo. Usuarios también accede a botones y contenedores tras un `await` sin comprobar su existencia. El histórico de Liquidación y los rangos completos de Interlogic no invalidan las respuestas antiguas; pueden repoblar estado o sobrescribir una carga más reciente.

**Reproducción local:** iniciar Flota, cambiar `App.currentModule` a Clientes y resolver la carga pendiente sigue invocando el render de Flota.

**Corrección:** tokens de carga/render y descarte de respuestas al cambiar de módulo o rango, como ya se hace en parte del Dashboard y en la carga inicial de Liquidación.

### A20. Problemas no guarda la eliminación parcial de imágenes

**Ubicación:** `public/js/problemas.js:756`.

Solo actualiza `imagenes` si se añaden imágenes nuevas o si no queda ninguna. Quitar una de varias y guardar sin añadir otra no persiste la lista restante.

**Reproducción local:** editar un problema dejando una imagen solo escribe la observación; el campo `imagenes` no se actualiza.

**Corrección:** guardar la lista final de imágenes en toda edición y gestionar los objetos de Storage eliminados.

### A21. Un usuario borrado antes de su primer login puede reaparecer

**Ubicación:** `public/js/users.js:455`, `public/js/users.js:341`, `functions/index.js:68`, `functions/index.js:133`.

Al crear el perfil provisional de `users` no se incluye `username`, aunque sí se crea `user_registry/{username}`. El botón de borrar obtiene el username del perfil y, si está vacío, deja intacto el registro de credenciales. Al iniciar sesión después, la función encuentra ese registro y vuelve a crear el perfil.

**Corrección:** conservar una referencia fiable al registro de credenciales y coordinar ambos borrados. También debe definirse el tratamiento de la cuenta de Firebase Auth existente.

### A22. El primer login pierde privilegios asignados al perfil provisional

**Ubicación:** `public/js/users.js:291`, `functions/index.js:102`, `functions/index.js:133`, `functions/index.js:143`.

Se pueden editar privilegios antes de que el nuevo usuario entre. La función toma algunos campos del perfil provisional y lo elimina después de crear el perfil UID, pero no copia `privileges`. Restricciones asignadas allí vuelven a sus valores por defecto.

**Corrección:** migrar explícitamente los campos administrativos del perfil provisional al perfil definitivo antes de eliminarlo.

### A23. El permiso de metas ofrece guardar a usuarios que las reglas rechazan

**Ubicación:** `public/js/utils.js:438`, `public/js/auth.js:236`, `public/js/dashboard.js:400`, `public/js/dashboard.js:967`, `public/js/dashboard.js:1040`, `firestore.rules:73`.

`manageMetas` es verdadero por defecto para todos los roles y habilita el modal de metas/comisiones. Guardar escribe en `config/dashboard`, donde únicamente un administrador tiene autorización. Incluso asignando expresamente este privilegio a un editor, la escritura se rechaza.

**Corrección:** alinear el privilegio visible con la autorización real de escritura y su alcance.

### A24. Configuración acepta logos demasiado grandes para Firestore

**Ubicación:** `public/js/settings.js:224`, `public/js/settings.js:232`, `public/js/settings.js:274`.

Se permiten archivos de hasta 2 MiB por logo y se guardan ambos como base64 en un único documento. Base64 aumenta el tamaño; basta una imagen de alrededor de 800 KiB para exceder por sí sola 1 MiB al codificarla. Firestore limita cada documento a 1 MiB, según sus [límites oficiales](https://firebase.google.com/docs/firestore/quotas).

**Corrección:** almacenar imágenes fuera del documento o reducirlas y validar el tamaño total codificado antes de guardar. La re-renderización al cargar un logo también puede perder cambios de campos que todavía no se hayan guardado.

### A25. La tendencia de seis meses presenta totales incompletos con más de 3.000 registros

**Ubicación:** `public/js/dashboard.js:1086`, `public/js/dashboard.js:1099`.

La tendencia consulta únicamente los 3.000 registros más recientes del rango. No pagina ni avisa que está incompleta. Meses anteriores pueden quedar con cero o totales parciales, mientras el resto del Dashboard sí permite cargar rangos completos.

**Corrección:** agregar por mes o paginar el rango y mostrar un estado explícito si se aplica un límite.

### A26. La tendencia conserva filtros antiguos

**Ubicación:** `public/js/dashboard.js:891`, `public/js/dashboard.js:1087`, `public/js/dashboard.js:1102`.

Los datos de tendencia se filtran antes de almacenarlos. Su clave de caché solo contiene la fecha final, no las dimensiones seleccionadas. Cambiar vendedor, empresa o zona actualiza los demás paneles, pero volver a Tendencia reutiliza los resultados del filtro anterior.

**Corrección:** conservar los datos base y volver a filtrarlos, o invalidar la caché por rango y filtros; descartar también respuestas antiguas.

### A27. El borrado de imágenes de Storage carece de una autorización compatible

**Ubicación:** `storage.rules:22`, `storage.rules:32`, `storage.rules:47`, `storage.rules:56`, `public/js/problemas.js:814`, `public/js/problemas.js:945`.

Todas las reglas de escritura exigen propiedades de `request.resource` propias de un archivo nuevo, incluyendo `size` y `contentType`, sin una ruta de autorización específica para el borrado. Los métodos que eliminan imágenes capturan y silencian el error; pueden borrar el problema de Firestore mientras dejan sus archivos, o fallar al limpiar una subida parcial. Este hallazgo debe validarse con el emulador de reglas antes de cambiarlas. La referencia de [Security Rules de Storage](https://firebase.google.com/docs/reference/security/storage) distingue los metadatos nuevos de `request.resource` de los existentes en `resource`.

**Corrección:** definir autorización de delete por rol/propiedad utilizando el recurso existente, separada de validaciones de archivos subidos, y atender los errores de limpieza.

## Prioridad baja

### A28. Las pruebas de rendimiento no reflejan las dependencias y scripts actuales

**Ubicación:** `scripts/audit-performance.test.cjs:20`, `scripts/audit-performance.test.cjs:60`, `scripts/audit-performance.test.cjs:157`.

Tres pruebas fallan con `fetchAllChunked is not defined`: cargan Dashboard aislado sin su dependencia de `utils.js`. Ese helper sí se carga antes de Dashboard en la aplicación. La cuarta prueba compara el listado con `HEAD` después de eliminar de un solo lado el SDK de Functions y no contempla Tarimas.

Los cuatro fallos no prueban por sí mismos que la pantalla de Dashboard o el orden de scripts estén rotos. La prueba de período previo, la de salida durante creación de gráficos, dos pruebas de Liquidación y las dos de edición móvil NC/CCF sí pasan.

**Corrección:** actualizar el entorno de pruebas para incluir utilidades y validar dependencias necesarias sin fijar todo el inventario de scripts a un commit histórico.

## Orden propuesto de resolución

1. Integridad de cobros, planes, NC y relaciones de rutas: A02–A06.
2. Seguridad y persistencia: A01, A09 y A10.
3. Saldos de tarimas y órdenes invisibles: A07, A08 y A11.
4. Permisos, sesiones, navegación y formularios: A12–A24.
5. Estadísticas, limpieza de archivos y mantenimiento de pruebas: A25–A28.

Antes de reparar datos existentes conviene contrastar cobros contra saldos, buscar órdenes sin `fecha`, revisar NC cuyo registro/efecto difiere y detectar clientes sin `nombreNorm`. Esta auditoría no ejecutó reparaciones de datos ni determinó qué documentos reales requieren intervención.

## Cómo repetir las comprobaciones

```powershell
node verify.js --strict
node --check functions/index.js
node --test scripts/interlogic-crud.test.cjs scripts/audit-performance.test.cjs
node scripts/audit-local.cjs
```

El script de auditoría comprueba las reproducciones documentadas mediante aserciones sobre el comportamiento defectuoso observado. Que termine con código 0 significa que logró reproducir esos defectos; no significa que estén resueltos. Tras corregirlos habrá que convertir esas reproducciones en pruebas del comportamiento esperado.
