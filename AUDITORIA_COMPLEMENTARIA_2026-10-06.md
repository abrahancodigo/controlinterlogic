# Auditoría complementaria — 6 de octubre de 2026

## Alcance

Revisión de la copia de trabajo actual: carga de scripts, autenticación y función callable, navegación, permisos, Dashboard, Interlogic (CRUD, filtros, importación/exportación y rutas), Liquidación, Clientes, Entregas, Problemas, Asistencia, KPI, Flota y Tarimas. Se contrastaron reglas, índices y configuración locales de Firebase.

Ya existían `AUDITORIA_2026-10-06.md` y `scripts/audit-local.cjs`. Se revisó el informe, se contrastaron sus principales hallazgos con el código actual y se volvió a ejecutar el diagnóstico. Este documento añade ocho hallazgos; no sustituye ni modifica el informe anterior. Las ubicaciones corresponden al estado local auditado, que contiene cambios pendientes.

No se modificó código de la aplicación ni configuración, no se hicieron commits o despliegues ni escrituras remotas. No se leyeron `.env` ni `opencode.json`.

## Verificación ejecutada

| Comprobación | Resultado |
| --- | --- |
| `node verify.js` | Pasa, 29 archivos JS |
| `node verify.js --strict` | Pasa |
| `node --check functions/index.js` | Pasa |
| `node scripts/audit-local.cjs` | Reproduce 16 comportamientos defectuosos con Firebase y DOM simulados; comprueba carga conjunta de 28 scripts locales y existencia de referencias JS/CSS |
| `node --test scripts/interlogic-crud.test.cjs scripts/audit-performance.test.cjs` | 6 aprobadas y 4 fallidas |

Tres fallos de pruebas proceden de cargar Dashboard sin `fetchAllChunked` de `utils.js`. El cuarto procede de comparar el inventario de scripts con `HEAD` y tratar de forma distinta el SDK de Functions y Tarimas. Estos fallos del entorno de pruebas no demuestran por sí solos una avería del arranque real.

La ejecución exitosa de `audit-local.cjs` significa que se reprodujeron los defectos, no que estén corregidos. No hubo comprobación en navegador autenticado o emulador: datos, reglas e índices desplegados, impresión, Excel real, CDN y diseño visual quedan pendientes de validación en esos entornos.

## Hallazgos adicionales

### B01 — Media: crear una ruta sin repartidor genera un valor `undefined`

**Código:** `public/js/interlogic/routes.js:25`, `:85-98`, `:135`.

El selector permite mantener «Seleccionar repartidor...» y no es obligatorio. Esa opción no tiene `data-nombre`; aun así, `routeData.repartidorNombre` recibe `repOpt.dataset.nombre` porque la opción existe. El resultado es `undefined`. Con la configuración actual, que no habilita `ignoreUndefinedProperties`, Firestore rechaza el documento y la creación de la ruta falla.

**Comprobación:** contraste estático del formulario y la escritura. No se envió el batch a Firebase.

**Corrección:** validar repartidor si es obligatorio; si es opcional, guardar valores vacíos explícitos mediante `repOpt?.dataset.nombre || ''`.

### B02 — Alta: crear otra ruta deja la misma factura asociada a dos rutas

**Código:** `public/js/interlogic/routes.js:7`, `:109-132`.

La selección solo excluye registros anulados. Puede incluir una factura con `rutaId` existente. Al crear la nueva ruta se añade otra `rutaEntregas` y se sobrescribe `interlogic.rutaId`, pero no se elimina ni se invalida la entrega de la ruta anterior. La misma factura queda representada en dos rutas y puede afectar sus cierres. El método tampoco excluye notas de crédito.

**Condición:** seleccionar de nuevo una factura ya asignada y crear otra ruta. También existe una carrera si dos operadores asignan simultáneamente la misma factura.

**Comprobación:** contraste estático de selección y batch.

**Corrección:** comprobar el estado actual de cada factura en una operación consistente; rechazar asignaciones existentes o transferirlas explícitamente, atendiendo rutas liquidadas. Excluir NC del flujo de entregas.

### B03 — Media: se pueden crear usuarios que nunca podrán entrar por nombre de usuario

**Código:** `public/js/users.js:389-390`, `:424-452`; `functions/index.js:59-64`; `public/js/auth.js:133-140`.

El alta solo exige un nombre de usuario no vacío. La función de login acepta exclusivamente `[a-z0-9._-]` y un máximo de 64 caracteres. Nombres como `juan pérez` o `josé` se pueden guardar en el registro, pero el servidor siempre rechaza su autenticación. Un nombre que incluya `@` hace que el cliente utilice login por email, aunque el alta todavía no creó la cuenta de Firebase Auth.

**Comprobación:** contraste estático entre las validaciones de alta y login.

**Corrección:** aplicar el mismo contrato de validación antes del alta y antes de cualquier escritura; coordinar la creación de registro y perfil para evitar altas parciales.

### B04 — Media: una fecha vacía bloquea el formulario móvil de Entregas

**Código:** `public/js/deliveries.js:1171-1187`, `:1201-1204`.

El botón se deshabilita antes de construir la fecha. Los inputs están fuera de un formulario validado y la fecha puede quedar vacía. `Timestamp.fromDate()` recibe entonces una fecha inválida y lanza una excepción antes del `try`. No se ejecuta el manejador que muestra el error y rehabilita el botón; queda «Guardando...» sin terminar.

**Comprobación:** contraste estático del orden de ejecución y del alcance del `try`.

**Corrección:** validar campos y fecha antes de deshabilitar, y proteger conversión y escritura con `try/finally`.

### B05 — Alta: editar o borrar una entrada de Tarimas puede dejar existencias negativas

**Código:** `public/js/tarimas.js:520-529`, `:575-595`, `:605-608`.

La validación de saldo no negativo solo existe en la creación de movimientos. La edición y eliminación guardan primero el cambio y después recalculan sin comprobar `acumulado < 0`. Por ejemplo, con una entrada de 10 y una salida posterior de 8, editar la entrada a 5 deja saldo -3; borrarla deja -8.

Además, modificación y recálculo son operaciones separadas: si el segundo paso falla, el movimiento ya cambió pero los saldos derivados conservan valores anteriores. Un nuevo movimiento concurrente también puede basarse en esos valores intermedios.

**Comprobación:** contraste estático y trazado aritmético del algoritmo; no se modificaron movimientos reales.

**Corrección:** validar el efecto completo antes de persistir y proteger el saldo común frente a concurrencia. Definir una política consistente de corrección de movimientos históricos.

### B06 — Media: los filtros históricos de KPI no consultan el histórico solicitado

**Código:** `public/js/kpi.js:90-96`, `:117-125`, `:136-144`.

El listener descarga únicamente las 500 evaluaciones más recientes. Cambiar las fechas solo filtra ese subconjunto en memoria; no cambia la consulta ni pagina. Si el período elegido está antes de esas 500 evaluaciones, la pantalla puede mostrar cero resultados aunque existan registros. Los promedios y exportaciones también operan sobre el subconjunto incompleto.

**Comprobación:** contraste estático de consulta y eventos de filtros.

**Corrección:** consultar por el rango elegido y paginar, o indicar explícitamente la limitación y permitir cargar el rango completo.

### B07 — Media: Asistencia anuncia guardado correcto incluso después de un fallo

**Código:** `public/js/asistencia.js:111-125`, `:128-134`, `:484-487`, `:535-536`.

El autoguardado muestra «Guardado automáticamente» sin esperar la escritura. Además, `saveToFirestore()` captura errores sin propagarlos ni devolver un resultado; el guardado manual muestra «Guardado correctamente» y un toast de éxito después de esperar esa función aunque haya fallado. La importación también puede anunciar éxito sin persistencia efectiva.

**Comprobación:** el script existente reprodujo el anuncio anticipado del autoguardado; los falsos éxitos manuales se sustentan en el flujo del `catch` y los llamadores.

**Corrección:** devolver o propagar el resultado de persistencia, esperar el guardado y anunciar éxito únicamente después de confirmarlo.

### B08 — Media: el privilegio de exportación no se aplica de forma uniforme

**Código:** `public/js/utils.js:440`; `public/js/dashboard.js:401`; `public/js/interlogic/excel.js:48`, `:154`; `public/js/clientes.js:989`; `public/js/kpi.js:101`; `public/js/liquidacion.js:311-312`, `:417`, `:515`.

El catálogo presenta `exportData` como «Exportar datos (Excel / PDF)». Dashboard atiende el permiso, pero otros módulos siguen ofreciendo/exportando datos sin comprobarlo. Quitar el privilegio no impide las exportaciones desde esas secciones.

**Comprobación:** contraste estático de los consumidores del permiso y los puntos de exportación.

**Corrección:** definir el alcance del privilegio y aplicarlo a botones y métodos de exportación. Si pretende impedir extracción de datos, una restricción solo visual no basta mientras el usuario conserve acceso de lectura a esos mismos datos.

## Prioridades de resolución

1. **Integridad financiera:** A02–A06 del informe previo: históricos desactualizados, cobros concurrentes, planes futuros, liberación y notas de crédito.
2. **Inventario y rutas:** A07–A08 y B02/B05: saldo transaccional, movimientos retroactivos, existencias negativas y asignaciones duplicadas.
3. **Sesiones, persistencia y HTML:** A01, A09–A10, A18–A19 y B07.
4. **Operación cotidiana:** A11–A17, A20–A24 y B01/B03/B04.
5. **Estadísticas, privilegios y mantenimiento:** A25–A28 y B06/B08.

El informe previo documenta 28 hallazgos. Este complemento añade ocho observaciones específicas. No se determinó cuántos documentos de producción están afectados; esa medición requiere revisar datos reales con consultas de diagnóstico.
