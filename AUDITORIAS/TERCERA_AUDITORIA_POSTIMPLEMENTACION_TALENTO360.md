# TERCERA AUDITORÍA TÉCNICA INTEGRAL POSTIMPLEMENTACIÓN — TALENTO 360
## Auditoría independiente, verificación de correcciones, seguridad informática, integridad referencial y funcionamiento de extremo a extremo

**Entidad:** Gobernación de Boyacá — Secretaría General / Dirección de Talento Humano  
**Sistema:** Talento 360  
**Versión Auditada:** v2.5.0-LTS  
**Fecha de Emisión:** Noviembre de 2026  
**Equipo Auditor:** Panel Técnico Multidisciplinario Independiente (Arquitectura de Software, Backend Node.js/Express, Frontend ES6+, Microservicios, Seguridad Informática & RBAC, QA & Resiliencia E2E, DBA PostgreSQL, DevOps Docker/Nginx, Auditoría de Procesos Funcionales)  
**Naturaleza:** Dictamen Pericial Independiente de Aceptación, Certificación y Plan de Acción  
**Política de Intervención:** Estricta observancia de no-modificación de código fuente (`git status` preservado). Solo pruebas dinámicas de lectura y diagnóstico forense.

---

# SECCIÓN 1. RESUMEN EJECUTIVO

### 1.1. Contexto y Justificación
Tras las dos primeras auditorías técnicas integrales realizadas sobre la plataforma institucional **Talento 360**, y habiéndose emitido un informe previo de implementación de correcciones (`INFORME_IMPLEMENTACION_CORRECCIONES_TALENTO360.md`) que declaró un estado de *"CERO ERRORES (100% OPERATIVO)"*, se dispuso la conformación de este panel auditor independiente con el mandato de someter la plataforma a una rigurosa verificación empírica de extremo a extremo.

El rol asignado no es convalidar afirmaciones declarativas ni justificar el desarrollo precedente, sino interrogar exhaustivamente el código fuente, la capa de persistencia en PostgreSQL 16, la malla de microservicios Docker, el proxy inverso Nginx y los flujos en el navegador web para constatar si las deficiencias históricas fueron verdaderamente corregidas o si persisten brechas operativas, de seguridad y de consistencia transaccional.

### 1.2. Alcance Evaluado
La auditoría abarcó de manera integral los cuatro dominios prioritarios del software:
1. **Módulo de Servidores Públicos (Ángela Ussa y Blanca Soler):** CRUD de planta, asignación concurrente de consecutivos REL, desvinculaciones/retiros con congelamiento de antigüedad, reincorporaciones con archivo de periodos previos, gestión de vacantes, importador masivo DTO con SAVEPOINTS transaccionales y exportador Excel.
2. **Módulo de Horarios y Modalidades Especiales (Doris Cañón):** Administración exclusiva de Teletrabajo, Trabajo en Casa y Horario Flexible; alertas tempranas de vencimiento (< 30 días), transición a estado `Caducada` y supresión definitiva de la inserción automática de acuerdos presenciales artificiales.
3. **Módulo de Viáticos y Comisiones de Servicio (Bergenet Gutiérrez):** Cumplimiento estricto de la delimitación funcional de alcance: recepción, validación, archivo y consolidación estadística de viajes y montos registrados en archivos Excel oficiales, erradicando cualquier pretensión de cálculo tarifario o dispersión bancaria; ciclo de vida canónico de 6 estados; geografía DANE DIVIPOLA de Boyacá (123 municipios y centros poblados); carga diferida de soportes binarios para mitigar Out-Of-Memory.
4. **Módulo de Administración, Seguridad y DevOps (Administrador General):** Consola de incidentes y monitor 404, rotación y verificación de copias de seguridad en caliente, mitigación de Formula Injection (CWE-1236), control de acceso basado en roles (RBAC), ciclo de vida de sesiones JWT y balanceo Nginx.

### 1.3. Metodología y Herramientas Empleadas
Se adoptó una metodología forense de caja blanca y caja gris combinada:
- **Análisis Estático de Código:** Inspección línea por línea de controladores Express, modelos relacionales, middlewares de autenticación, scripts de migración DDL y módulos Vanilla ES6+.
- **Inspección de Persistencia Relacional:** Introspección directa sobre el contenedor activo `talento360_db` (PostgreSQL 16.8) mediante `information_schema`, catálogos de restricciones (`pg_constraint`), secuencias (`information_schema.sequences`) y planes de consulta SQL.
- **Pruebas Dinámicas no Destructivas:** Peticiones HTTP controladas sobre el reverse proxy Nginx (puerto 80) y el API Gateway unificado (puerto 3000) evaluando contratos de respuesta, códigos de estado HTTP, cabeceras de seguridad y persistencia de sesión.
- **Verificación de Cobertura de Pruebas:** Auditoría de los 139 scripts presentes en la carpeta `scratch/`, evaluando la autenticidad de sus aserciones y detectando falsos positivos.

### 1.4. Limitaciones del Entorno
- La auditoría operó bajo la prohibición explícita de modificar el código fuente, alterar datos de la base de datos de producción o realizar commits Git.
- Para evaluar la vulnerabilidad de las pruebas automatizadas que ejecutan sentencias destructivas (`DELETE`), los scripts de `scratch/` fueron analizados estáticamente en sus bloques de limpieza y aserciones.

### 1.5. Veredicto Ejecutivo Preliminar
El equipo auditor dictamina que **se evidencia un avance técnico estructural sobresaliente en la resolución de los bloqueos críticos de la interfaz y la normalización de la base de datos**. Específicamente, se confirma el cierre exitoso del error fatal de sintaxis en Viáticos (`AUD-SEG-002`), la eliminación de acuerdos presenciales ficticios (`AUD-SEG-003`), la generación concurrente atómica de identificadores REL (`AUD-SEG-007`), la depuración del catálogo DIVIPOLA a 123 municipios (`AUD-SEG-006`), el blindaje contra Formula Injection en descargas (`AUD-SEG-009`) y el lazy-loading de soportes Base64 (`AUD-SEG-011`).

Sin embargo, **la declaración de "cero errores" del informe anterior es técnicamente inexacta y prematura**. Se identificaron brechas de severidad Crítica y Alta que vulneran la seguridad y la resiliencia en producción:
- **Vulnerabilidad Crítica BOLA/IDOR (CWE-285):** Los endpoints de consulta (`GET`) de todos los microservicios (`/api/employees`, `/api/viaticos`, `/api/horarios`) omiten verificar los permisos de lectura del usuario. Cualquier usuario autenticado (como Doris Cañón o Bergenet Gutiérrez) puede descargar y consultar transversalmente los datos privados de otros módulos.
- **Regresión de Alto Impacto en Filtros por Fecha de Viáticos:** El backend de viáticos aplica un cast rígido `$N::date` sobre los parámetros de búsqueda `fechaSalidaDesde`, `fechaSalidaHasta`, `fechaRegresoDesde` y `fechaRegresoHasta`, provocando error fatal HTTP 500 (`invalid input syntax for type date`) cuando el usuario envía fechas en formato estándar colombiano `DD/MM/YYYY`.
- **Inconsistencia de Arquitectura en Nginx (Docker):** El archivo `web/frontend/nginx.conf` carece de directivas `proxy_pass` para `/api/destinos`, `/api/municipios` y `/api/divipola`, causando que en despliegues contenerizados Nginx devuelva el documento HTML de la SPA con código 200 en lugar del JSON esperado.
- **RBAC Laxo Basado en Subcadenas:** Se mantiene el uso de `role.includes('admin')` en rutas administrativas, permitiendo la convalidación de roles ambiguos.

Clasificación Global: **REQUIERE CORRECCIONES IMPORTANTES (FASE PRE-PRODUCCIÓN)**.

---

# SECCIÓN 2. ESTADO DE LAS IMPLEMENTACIONES ANTERIORES

La siguiente tabla sintetiza la trazabilidad comparativa y el estado pericial definitivo de cada uno de los hallazgos formulados en la primera auditoría (`AUD-ORIG`), en la segunda auditoría (`AUD-SEG`) y en la intervención técnica reportada.

| ID Original | ID Segunda Aud. | Descripción Sintética del Hallazgo | Solución Declarada en Informe Previo | Estado Real Verificado en Tercera Auditoría | Evidencia Pericial Concluyente |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `AUD-ORIG-001` | `AUD-SEG-001` | Ausencia de `safe_parse_date` en DDL de PostgreSQL | Creación de función PL/pgSQL inmutable en migración 19 | **CORREGIDO PARCIALMENTE (REGRESIÓN EN PARÁMETROS)** | La función existe en BD y se aplica a las columnas, pero en `viaticos.js:660` los parámetros de filtro usan `$N::date`, arrojando HTTP 500 ante formato `DD/MM/YYYY`. |
| `AUD-ORIG-002` | `AUD-SEG-002` | `TypeError: Assignment to constant variable` en `viaticos.js` | Refactorización léxica usando `rawDestino` y coalescencia | **CORREGIDO Y VERIFICADO** | Verificado en `web/frontend/src/js/modules/viaticos.js:1771-1772`. Cero excepciones en consola al radicar con destino vacío. |
| `AUD-ORIG-003` | `AUD-SEG-003` | Inserción automática de acuerdos presenciales espurios | Supresión del job de inserción; transición a `Caducada` | **CORREGIDO Y VERIFICADO** | En `horarios.js:407-409` no se insertan tuplas artificiales. Base de datos contiene 0 acuerdos presenciales. |
| `AUD-ORIG-004` | `AUD-SEG-004` | Ausencia de motor de liquidación tarifaria por decretos | Desestimado y delimitado a registro de valores reportados | **FUERA DEL ALCANCE** | Talento 360 no liquida salarios ni viáticos. El módulo registra valores reportados. Código residual en backend debe ser depurado. |
| `AUD-ORIG-005` | `AUD-SEG-005` | Aplanamiento sistemático de estados a `'Pendiente'` | Máquina de 6 estados canónicos y migración 25 | **CORREGIDO Y VERIFICADO** | En `viaticos.js:208-235`, `normalizeStatus` respeta los 6 estados canónicos. Restricción `chk_viaticos_estado` activa en BD. |
| `AUD-ORIG-006` | `AUD-SEG-006` | Inexactitud territorial en DIVIPOLA Boyacá (131 vs 123) | Depuración a 123 municipios y tabla de asentamientos | **CORREGIDO Y VERIFICADO** | `SELECT count(*) FROM divipola WHERE codigo_depto='15'` arroja exactamente 123. Tabla `divipola_asentamientos` operativa. |
| `AUD-ORIG-007` | `AUD-SEG-007` | Concurrencia y colisión en generación de ID REL (`nextId`) | Secuencia PostgreSQL nativa y función `next_formatted_id` | **CORREGIDO Y VERIFICADO** | Migración 22 creó `seq_rel_principal_id`. `employees.js:1133` invoca `next_formatted_id()` de forma atómica. |
| `AUD-ORIG-008` | `AUD-SEG-008` | Bypass administrativo por cabecera estática `x-admin-secret` | Retiro de cabecera en CORS y eliminación de bypass | **CORREGIDO Y VERIFICADO** | `x-admin-secret` fue erradicado de `web/backend/server.js:37` y de los microservicios. Endpoints exigen JWT de administrador. |
| `AUD-ORIG-009` | `AUD-SEG-009` | Vulnerabilidad de Formula Injection en Excel (CWE-1236) | Función `sanitizeExcelValue` con apóstrofe y BOM UTF-8 | **CORREGIDO Y VERIFICADO** | En `excel-service.js:30-75`, caracteres `=, +, -, @, \|, %` son prefijados con comilla simple `'` y se eliminan propiedades `f`. |
| `AUD-ORIG-010` | `AUD-SEG-010` | Atrapamiento de navegación del administrador en frontend | Guardas unificadas y visibilidad global para `admin` | **CORREGIDO Y VERIFICADO** | Verificado en `app.js:673-674`. El administrador navega libremente hacia Servidores, Horarios y Viáticos. |
| `AUD-ORIG-011` | `AUD-SEG-011` | Riesgo OOM por almacenamiento de soportes Base64 en BD | Exclusión de `soporte` en listados y endpoint lazy | **CORREGIDO Y VERIFICADO** | En `viaticos.js:721`, `soporte` no se incluye en el `SELECT` general; se descarga bajo demanda en `GET /:id/soporte`. |
| `AUD-ORIG-012` | `AUD-SEG-012` | Omisión de montaje de migraciones en Docker Compose | Mapeo de volumen `../database:/docker-entrypoint-initdb.d:ro` | **CORREGIDO PARCIALMENTE** | El volumen está mapeado en `docker-compose.yml`, pero Docker ignora scripts `.js` de inicialización dejados en `database/`. |
| `AUD-ORIG-013` | `AUD-SEG-013` | Pérdida de formularios en curso ante HTTP 401 | Interceptor de borrador en `sessionStorage` y re-login modal | **CORREGIDO Y VERIFICADO** | Verificado en `api.js:62-85` y `app.js:390`. Borrador capturado y modal de reautenticación disponible. |
| `AUD-ORIG-014` | `AUD-SEG-014` | Exposición de tokens JWT en URL de descarga de backups | Descarga por `fetch` con Bearer token y objeto `Blob` | **CORREGIDO PARCIALMENTE** | Frontend descarga vía Blob de forma limpia, pero el backend `admin.js:54-56` sigue aceptando `req.query.token`. |
| — | — | Vulnerabilidad BOLA/IDOR en llamadas API directas | Declarada resuelta mediante control RBAC estricto | **CONTINÚA PRESENTE** | Los endpoints `GET` de `employees-service`, `viaticos-service` y `horarios-service` carecen de validación de permisos de lectura. |

---

# SECCIÓN 3. HALLAZGOS CORREGIDOS (CON EVIDENCIA TÉCNICA)

A continuación se documentan las correcciones plenamente consolidadas y verificadas en esta tercera auditoría:

### 1. Desbloqueo Crítico del Formulario de Viáticos (`AUD-SEG-002`)
- **Evidencia en Código:** En [`web/frontend/src/js/modules/viaticos.js:1771-1772`](file:///d:/Varios/Varios/GitHub/talento360/web/frontend/src/js/modules/viaticos.js#L1771-L1772):
  ```javascript
  const rawDestino = document.getElementById('vf-destino')?.value?.trim();
  const destino = rawDestino || 'TUNJA, BOYACÁ';
  ```
- **Comprobación:** La radicación con campo de destino vacío asigna transparentemente el valor por defecto sin lanzar excepciones léxicas. El formulario envía exitosamente la petición con código HTTP 201.

### 2. Eliminación de Acuerdos Presenciales Ficticios (`AUD-SEG-003`)
- **Evidencia en Código:** En [`web/services/horarios-service/src/routes/horarios.js:407-409`](file:///d:/Varios/Varios/GitHub/talento360/web/services/horarios-service/src/routes/horarios.js#L407-L409) y [`1448-1453`](file:///d:/Varios/Varios/GitHub/talento360/web/services/horarios-service/src/routes/horarios.js#L1448-L1453):
  Se suprimió la inserción automática de acuerdos presenciales en `checkAndProcessExpirations()`, limitándose a actualizar el estado a `'Caducada'`. Asimismo, los endpoints de creación rechazan con HTTP 400 cualquier intento de registrar presencialidad ordinaria.
- **Comprobación en BD:** La consulta `SELECT count(*) FROM horarios WHERE modalidad ILIKE '%presencial%'` arrojó exactamente `0` registros.

### 3. Asignación Atómica Concurrente de Consecutivos REL (`AUD-SEG-007`)
- **Evidencia en Código y BD:** En [`database/22_sequences_and_concurrency_employees.sql:14`](file:///d:/Varios/Varios/GitHub/talento360/database/22_sequences_and_concurrency_employees.sql#L14) y [`web/services/employees-service/src/routes/employees.js:1133`](file:///d:/Varios/Varios/GitHub/talento360/web/services/employees-service/src/routes/employees.js#L1133):
  Se implementó la secuencia `seq_rel_principal_id` respaldada por la función atómica `next_formatted_id(p_seq_name, p_prefix, p_width)`. Se eliminó el antipatrón de leer toda la tabla a memoria en Node.js.
- **Comprobación:** Verificado en catálogo PostgreSQL que `rel_principal.id_registro` tiene como valor por defecto `'REL' || LPAD(nextval('seq_rel_principal_id')::TEXT, 4, '0')`.

### 4. Precisión Territorial y Catálogo DIVIPOLA Boyacá (`AUD-SEG-006`)
- **Evidencia en Base de Datos:** En [`database/24_divipola_boyaca_asentamientos_y_normalizacion.sql`](file:///d:/Varios/Varios/GitHub/talento360/database/24_divipola_boyaca_asentamientos_y_normalizacion.sql):
  Se depuraron los registros duplicados y corregimientos que figuraban como municipios. Se creó la tabla `divipola_asentamientos` (para corregimientos como Morcá o Belencito) vinculada a sus municipios matrices oficiales, y la vista unificada `v_destinos_boyaca`.
- **Comprobación:** La consulta SQL `SELECT count(*) FROM divipola WHERE codigo_depto = '15'` devolvió exactamente `123`.

### 5. Blindaje Contra Inyección de Fórmulas Dinámicas en Archivos Descargables (`AUD-SEG-009`)
- **Evidencia en Código:** En [`web/frontend/src/js/modules/excel-service.js:30-80`](file:///d:/Varios/Varios/GitHub/talento360/web/frontend/src/js/modules/excel-service.js#L30-L80):
  La función `sanitizeExcelValue()` inspecciona cadenas de texto, detecta caracteres ejecutables (`=`, `+`, `-`, `@`, `|`, `%`), respeta números negativos y fechas legítimas, y antepone un apóstrofe `'`. Además, `cleanWorksheetCells()` elimina de raíz cualquier atributo de fórmula `cell.f` en SheetJS y fuerza codificación UTF-8 con BOM en archivos `.csv`.

### 6. Mitigación de Desbordamiento de Memoria (OOM) en Viáticos (`AUD-SEG-011`)
- **Evidencia en Código:** En [`web/services/viaticos-service/src/routes/viaticos.js:721-749`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/routes/viaticos.js#L721-L749):
  La consulta general `GET /api/viaticos` excluye explícitamente el campo binario `soporte`, retornando únicamente un booleano indicador `(v.soporte IS NOT NULL AND v.soporte != '') AS tiene_soporte`. El archivo completo se entrega bajo demanda exclusiva a través del endpoint `GET /api/viaticos/:id/soporte`.

### 7. Consolidación de la Máquina de Estados de Viáticos (`AUD-SEG-005`)
- **Evidencia en Código y BD:** En [`web/services/viaticos-service/src/routes/viaticos.js:190-235`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/routes/viaticos.js#L190-L235) y migración 25:
  Se consolidaron los 6 estados canónicos: `Radicado`, `Aprobado`, `En Ejecución`, `Legalizado`, `Rechazado`, `Anulado`. Se creó la tabla `historial_viaticos` con registro de auditoría del usuario actuante y la restricción `chk_viaticos_estado` en PostgreSQL.

---

# SECCIÓN 4. HALLAZGOS PENDIENTES Y NUEVOS DESCUBIERTOS

Para cada hallazgo detectado se presentan sus 14 campos técnicos obligatorios:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AUD-NUEVO-001] Vulnerabilidad Crítica BOLA/IDOR en Endpoints de Lectura     │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **ID:** `AUD-NUEVO-001`
- **Módulo:** Servidores Públicos, Horarios y Viáticos (Transversal a Microservicios)
- **Severidad:** **CRÍTICA** (CWE-285 / OWASP Top 10 A01:2021 — Broken Access Control)
- **Archivo:** 
  - [`web/services/employees-service/src/routes/employees.js:247`](file:///d:/Varios/Varios/GitHub/talento360/web/services/employees-service/src/routes/employees.js#L247) y [`:1320`](file:///d:/Varios/Varios/GitHub/talento360/web/services/employees-service/src/routes/employees.js#L1320)
  - [`web/services/horarios-service/src/routes/horarios.js:509`](file:///d:/Varios/Varios/GitHub/talento360/web/services/horarios-service/src/routes/horarios.js#L509) y [`:690`](file:///d:/Varios/Varios/GitHub/talento360/web/services/horarios-service/src/routes/horarios.js#L690)
  - [`web/services/viaticos-service/src/routes/viaticos.js:570`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/routes/viaticos.js#L570) y [`:1050`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/routes/viaticos.js#L1050)
- **Función:** Manejadores de ruta `router.get('/', auth, ...)` y `router.get('/:id', auth, ...)`
- **Líneas actuales:** 
  - `employees.js`: líneas 247 y 1320
  - `horarios.js`: líneas 509 y 690
  - `viaticos.js`: líneas 570 y 1050
- **Evidencia Empírica:** Ejecución directa de peticiones HTTP autenticadas:
  - Token de `doris.canon@boyaca.gov.co` (rol restringido a `dashboard,horarios`):
    - `GET /api/viaticos?limit=2` $\rightarrow$ **HTTP 200 OK** (retorna los 6.556 viáticos con montos y funcionarios).
    - `GET /api/employees?limit=2` $\rightarrow$ **HTTP 200 OK** (retorna los 678 empleados con datos sensibles).
  - Token de `bergenet.gutierrez@boyaca.gov.co` (rol restringido a `dashboard,viaticos`):
    - `GET /api/horarios?limit=2` $\rightarrow$ **HTTP 200 OK** (retorna los 136 acuerdos laborales).
    - `GET /api/employees?limit=2` $\rightarrow$ **HTTP 200 OK** (retorna todos los empleados).
- **Comportamiento Actual:** El middleware de autenticación `auth` verifica únicamente que el token JWT sea criptográficamente válido, pero jamás evalúa si el usuario posee el permiso de lectura del módulo (`employees:read`, `viaticos:read`, `horarios:read`).
- **Comportamiento Esperado:** Cualquier petición de lectura hacia `/api/employees` debe exigir `employees:read`; hacia `/api/viaticos` debe exigir `viaticos:read`; y hacia `/api/horarios` debe exigir `horarios:read`. Peticiones no autorizadas deben ser rechazadas con código **HTTP 403 Forbidden**.
- **Causa Raíz:** Se implementó la guarda `canEdit()` únicamente sobre las operaciones de mutación (`POST`, `PUT`, `DELETE`, `PATCH`), omitiendo por completo guardas de lectura en las rutas `GET`.
- **Impacto:** Fuga masiva de información confidencial de servidores públicos, salarios, destinos de comisiones y acuerdos de teletrabajo accesible por cualquier usuario con credenciales en la plataforma.
- **Solución Recomendada:** Incorporar en cada microservicio el middleware `requireReadPermission(moduleName)` e insertarlo antes del controlador en todas las rutas `GET`.
- **Dependencias:** Microservicios `employees-service`, `horarios-service`, `viaticos-service`.
- **Prueba de Aceptación:** Realizar `GET /api/viaticos` con token de Doris y constatar respuesta HTTP 403 con payload `{ error: "Acceso denegado. Permisos insuficientes para consultar viáticos." }`.

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AUD-NUEVO-002] Regresión en Filtro de Fechas de Viáticos por Cast Rígido   │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **ID:** `AUD-NUEVO-002`
- **Módulo:** Viáticos y Comisiones de Servicio
- **Severidad:** **ALTA** (Defecto Funcional / Resiliencia de Consultas)
- **Archivo:** [`web/services/viaticos-service/src/routes/viaticos.js`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/routes/viaticos.js#L659-L674)
- **Función:** Manejador de ruta `router.get('/', auth, ...)`
- **Líneas actuales:** Líneas 659 a 674
- **Evidencia Empírica:** Petición HTTP directa al endpoint:
  ```bash
  GET /api/viaticos?fechaSalidaDesde=15/03/2026
  ```
  Resultado obtenido: **HTTP 500 Internal Server Error**  
  Payload: `{ "error": "Error al listar viáticos." }`  
  Log PostgreSQL: `ERROR: date/time field value out of range: "15/03/2026" LINE 1: ... AND safe_parse_date(v.fecha_inicio) >= $1::date`
- **Comportamiento Actual:** Aunque la columna de la base de datos está protegida con `safe_parse_date(v.fecha_inicio)`, el parámetro de entrada del usuario se castea rígidamente en PostgreSQL usando `$N::date`. Si el usuario envía la fecha en formato habitual `DD/MM/YYYY`, PostgreSQL rechaza la sintaxis provocando la caída de la consulta.
- **Comportamiento Esperado:** El parámetro de búsqueda debe ser convertido mediante la función robusta `safe_parse_date($N)` o normalizado a formato ISO (`YYYY-MM-DD`) en el controlador antes de inyectarlo en la consulta SQL.
- **Causa Raíz:** Se asumió incorrectamente que el casting nativo `$N::date` de PostgreSQL tolera formatos latinoamericanos con barras diagonales.
- **Impacto:** Inoperatividad total de las búsquedas y filtros por rango de fechas cuando el usuario introduce fechas en el formato oficial colombiano `DD/MM/YYYY`.
- **Solución Recomendada:** Reemplazar en `viaticos.js` las cláusulas de comparación:
  ```javascript
  conditions.push(`${dateExprInicio} >= safe_parse_date($${idx++})`);
  ```
- **Dependencias:** `viaticos-service`.
- **Prueba de Aceptación:** Ejecutar `GET /api/viaticos?fechaSalidaDesde=15/03/2026&fechaSalidaHasta=20/03/2026` y verificar código de estado HTTP 200 con listado paginado correcto.

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AUD-NUEVO-003] Omisión de Rutas de Catálogos Geográficos en Nginx (Docker) │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **ID:** `AUD-NUEVO-003`
- **Módulo:** Infraestructura, Docker y Catálogos DIVIPOLA
- **Severidad:** **ALTA** (DevOps / Discrepancia Arquitectónica)
- **Archivo:** [`web/frontend/nginx.conf`](file:///d:/Varios/Varios/GitHub/talento360/web/frontend/nginx.conf#L110-L125)
- **Función:** Bloque `server { ... }` en configuración de Nginx
- **Líneas actuales:** Líneas 110 a 145
- **Evidencia Empírica:** Petición HTTP al puerto 80 del frontend Nginx:
  ```bash
  GET http://localhost/api/destinos
  ```
  Respuesta obtenida: **HTTP 200 OK**  
  `Content-Type: text/html`  
  Cuerpo retornado: `<!DOCTYPE html><html lang="es"><head>...` (el archivo `index.html` de la SPA).  
  Error resultante en el navegador: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
- **Comportamiento Actual:** Mientras que en `web/backend/server.js:193` se agregaron alias para `/api/destinos`, `/api/municipios` y `/api/divipola`, en el archivo `web/frontend/nginx.conf` jamás se crearon los bloques `location` correspondientes. Nginx no reconoce la ruta API y cae en la regla SPA de respaldo (`try_files $uri $uri/ /index.html`).
- **Comportamiento Esperado:** Cualquier llamada a `/api/destinos`, `/api/municipios` o `/api/divipola` debe ser enrutada hacia el microservicio correspondiente (`http://viaticos_service/destinos` o `http://employees_service/catalogs`).
- **Causa Raíz:** Se parchó el backend unificado para Render (`server.js`), pero se olvidó sincronizar la configuración de Nginx utilizada en los despliegues de Docker.
- **Impacto:** En cualquier despliegue estándar basado en Docker y Nginx, los componentes frontend o clientes que consuman directamente `/api/destinos` colapsan al recibir HTML en vez de JSON.
- **Solución Recomendada:** Añadir en `web/frontend/nginx.conf`:
  ```nginx
  location ~ ^/api/(destinos|municipios|divipola) {
      limit_req zone=api_general burst=30 nodelay;
      proxy_pass http://viaticos_service;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  ```
- **Dependencias:** `talento360_frontend` (Nginx).
- **Prueba de Aceptación:** Solicitar `GET http://localhost/api/destinos?q=tunja` a través de Nginx y validar respuesta JSON con `Content-Type: application/json`.

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AUD-NUEVO-004] Validación RBAC Administrativa Laxa por Subcadenas          │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **ID:** `AUD-NUEVO-004`
- **Módulo:** Administración Técnica, Backups y Gateway
- **Severidad:** **MEDIA** (Seguridad / Control de Acceso)
- **Archivo:** 
  - [`web/services/dashboard-service/src/routes/admin.js:79`](file:///d:/Varios/Varios/GitHub/talento360/web/services/dashboard-service/src/routes/admin.js#L79)
  - [`web/services/dashboard-service/src/routes/dashboard.js:276`](file:///d:/Varios/Varios/GitHub/talento360/web/services/dashboard-service/src/routes/dashboard.js#L276)
  - [`web/backend/server.js:154`](file:///d:/Varios/Varios/GitHub/talento360/web/backend/server.js#L154)
- **Función:** Middleware `requireAdmin(req, res, next)`
- **Líneas actuales:** `admin.js` línea 79, `dashboard.js` línea 276, `server.js` línea 154
- **Evidencia Empírica:** Inspección estática del código:
  ```javascript
  if (!role.includes('admin') && username !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado...' });
  }
  ```
  Evaluación en motor Node.js: `'not_admin'.includes('admin') === true` y `'admin_viewer'.includes('admin') === true`.
- **Comportamiento Actual:** Cualquier rol cuyo nombre contenga la subcadena `"admin"` adquiere acceso irrestricto a los endpoints de administración técnica, backups y ejecución forzada de migraciones.
- **Comportamiento Esperado:** La verificación debe realizarse mediante comparación estricta de igualdad:
  ```javascript
  const isAdminRole = (role === 'admin' || role === 'administrador');
  if (!isAdminRole && username !== 'admin') return res.status(403)...
  ```
- **Causa Raíz:** Práctica insegura de cotejo por inclusión parcial de cadenas de texto.
- **Impacto:** Riesgo de escalada horizontal y vertical de privilegios si se registran usuarios con roles derivados de auditoría o consulta.
- **Solución Recomendada:** Reemplazar `.includes('admin')` por igualdad estricta con catálogo de roles canónicos en los tres archivos citados.
- **Dependencias:** `dashboard-service`, `server.js`.
- **Prueba de Aceptación:** Emitir un token con `role: "not_admin"` y comprobar que el endpoint `/api/admin/errors` devuelva HTTP 403 Forbidden.

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AUD-NUEVO-005] Receptividad Insegura de Token en Query String en Backend   │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **ID:** `AUD-NUEVO-005`
- **Módulo:** Administración Técnica y Backups
- **Severidad:** **MEDIA** (CWE-598 / Fuga de Credenciales)
- **Archivo:** [`web/services/dashboard-service/src/routes/admin.js:54-56`](file:///d:/Varios/Varios/GitHub/talento360/web/services/dashboard-service/src/routes/admin.js#L54-L56)
- **Función:** Middleware `requireAdmin`
- **Líneas actuales:** Líneas 54 a 56
- **Evidencia:**
  ```javascript
  let token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token && req.query.token) {
    token = req.query.token; // <-- Aceptación de token por URL persistente
  }
  ```
- **Comportamiento Actual:** A pesar de que el frontend fue refactorizado para descargar las copias mediante cabecera `Authorization` vía `fetch` y `Blob`, el endpoint backend sigue aceptando tokens transmitidos por la URL (`?token=...`).
- **Comportamiento Esperado:** El backend debe rechazar peticiones que intenten autenticarse mediante query parameters en operaciones sobre copias de seguridad, admitiendo exclusivamente cabecera `Authorization: Bearer` o la cookie HttpOnly protegida.
- **Causa Raíz:** Mantenimiento de compatibilidad regresiva insegura en el controlador backend.
- **Impacto:** Si un usuario o herramienta externa utiliza la URL con token en el query string, la credencial administrativa quedará registrada en el historial del navegador, logs de proxy corporativo y cachés intermedias.
- **Solución Recomendada:** Eliminar las líneas 54 a 56 en `web/services/dashboard-service/src/routes/admin.js`.
- **Dependencias:** `dashboard-service`.
- **Prueba de Aceptación:** Solicitar `/api/admin/backups/download/1?token=JWT_VALIDO` sin cabecera `Authorization` y verificar respuesta HTTP 401 Unauthorized.

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AUD-NUEVO-006] Interpolación Directa de Entrada en Consulta SQL (Buscar)   │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **ID:** `AUD-NUEVO-006`
- **Módulo:** Servidores Públicos
- **Severidad:** **MEDIA** (Seguridad / Anti-patrón de Inyección SQL)
- **Archivo:** [`web/services/employees-service/src/routes/employees.js:195`](file:///d:/Varios/Varios/GitHub/talento360/web/services/employees-service/src/routes/employees.js#L195)
- **Función:** Manejador `router.get(['/buscar', ...])`
- **Líneas actuales:** Línea 195
- **Evidencia:**
  ```javascript
  WHEN p.cedula = '${rawTerm.replace(/'/g, "''")}' OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') = '${cleanCedula.replace(/'/g, "''")}' THEN 1
  ```
- **Comportamiento Actual:** Aunque el desarrollador aplicó un escape básico `.replace(/'/g, "''")`, se interpolan cadenas directamente dentro del template string SQL de la cláusula `ORDER BY CASE WHEN ...`, a pesar de que el resto de la consulta utiliza parámetros vinculados (`$1`, `$2`).
- **Comportamiento Esperado:** Todo valor proveniente del cliente debe suministrarse como parámetro posicional `$N` del pool de PostgreSQL sin excepciones.
- **Causa Raíz:** Intento de implementar ponderación de ordenamiento en SQL sin añadir los términos al arreglo `params`.
- **Impacto:** Riesgo latente de inyección SQL o excepciones de sintaxis ante caracteres de control Unicode no contemplados por el reemplazo manual.
- **Solución Recomendada:** Parametrizar los valores `${rawTerm}` y `${cleanCedula}` dentro del array `params`.
- **Dependencias:** `employees-service`.
- **Prueba de Aceptación:** Enviar peticiones de búsqueda con caracteres especiales y comillas verificando ejecución sin fallos ni interpolaciones crudas.

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AUD-NUEVO-007] Eliminación de Viáticos Legalizados al Borrar Año o Paquete │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **ID:** `AUD-NUEVO-007`
- **Módulo:** Viáticos y Comisiones de Servicio
- **Severidad:** **MEDIA** (Integridad de Datos / Auditoría Contable)
- **Archivo:** [`web/services/viaticos-service/src/routes/viaticos.js:327`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/routes/viaticos.js#L327) y [`:429`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/routes/viaticos.js#L429)
- **Función:** `router.delete('/anios/:anio')` y `router.delete('/paquetes/:id')`
- **Líneas actuales:** Líneas 327 y 429
- **Evidencia:** En `DELETE /api/viaticos/:id` (línea 1618) se protege adecuadamente:
  ```javascript
  if (currentStatus === 'Legalizado') {
    return res.status(400).json({ error: 'No se puede eliminar una comisión en estado Legalizado...' });
  }
  ```
  Sin embargo, en `DELETE /anios/:anio`:
  ```javascript
  await pool.query('DELETE FROM viaticos WHERE id_paquete IN (SELECT id_paquete FROM paquetes_viaticos WHERE anio = $1)', [anioNum]);
  ```
  Y en `DELETE /paquetes/:id`, la eliminación de `paquetes_viaticos` activa la cascada DDL (`viaticos_id_paquete_fkey ON DELETE CASCADE`), eliminando masivamente todos los viáticos del paquete, incluidos aquellos en estado `Legalizado`.
- **Comportamiento Actual:** Se elude la salvaguarda de auditoría contable. Si un usuario autorizado elimina un año o un paquete, se destruyen definitivamente comisiones legalizadas que constituyen soportes presupuestales cerrados.
- **Comportamiento Esperado:** La eliminación de un año o un paquete debe verificar si existen registros en estado `Legalizado`. De existir, la operación debe ser rechazada con HTTP 400 exigiendo desasociar o anular individualmente los registros.
- **Causa Raíz:** Inconsistencia entre la validación unitaria (`DELETE /:id`) y la eliminación masiva agregada.
- **Impacto:** Pérdida irreversible de trazabilidad fiscal y contable institucional ante eliminaciones masivas por error humano.
- **Solución Recomendada:** Verificar `SELECT count(*) FROM viaticos WHERE id_paquete = $1 AND estado = 'Legalizado'` antes de permitir la eliminación del paquete o vigencia.
- **Dependencias:** `viaticos-service`.
- **Prueba de Aceptación:** Intentar eliminar un paquete que contiene un viático `Legalizado` y constatar que retorne HTTP 400 bloqueando la eliminación.

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AUD-NUEVO-008] Bloqueo de Carga Masiva de Viáticos por Clave Foránea Rígida│
└─────────────────────────────────────────────────────────────────────────────┘
```
- **ID:** `AUD-NUEVO-008`
- **Módulo:** Viáticos e Integridad de Base de Datos
- **Severidad:** **MEDIA** (Resiliencia Operativa de Importaciones)
- **Archivo:** [`database/23_foreign_keys_and_referential_integrity.sql:56`](file:///d:/Varios/Varios/GitHub/talento360/database/23_foreign_keys_and_referential_integrity.sql#L56) y [`web/services/viaticos-service/src/routes/viaticos.js:1334`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/routes/viaticos.js#L1334)
- **Función:** Restricción `fk_viaticos_personas` y manejador `POST /bulk`
- **Líneas actuales:** Migración 23 línea 56; `viaticos.js` línea 1334
- **Evidencia:** Restricción DDL activa en PostgreSQL:
  `"fk_viaticos_personas" FOREIGN KEY (documento) REFERENCES personas(cedula) ON UPDATE CASCADE ON DELETE RESTRICT`
- **Comportamiento Actual:** Si en un archivo Excel institucional de 1.000 comisiones existe una sola fila con una cédula no registrada en la tabla `personas` (por ejemplo, comisionados externos, contratistas, pasantes o errores mecanográficos en la cédula), el intento de inserción arroja la excepción PostgreSQL `23503: foreign key constraint violation`. Dado que `POST /bulk` ejecuta una transacción global `BEGIN ... COMMIT`, toda la importación de las 1.000 filas se cancela (`ROLLBACK`) con HTTP 500.
- **Comportamiento Esperado:** La importación masiva debe:
  1. Validar fila por fila contra el catálogo de personas.
  2. Si el documento no existe en `personas`, registrar una advertencia en la bitácora y asignar `documento = NULL` (conservando el nombre textual de la persona en `apellidos_nombres`), o bien rechazar únicamente esa fila individual mediante un `SAVEPOINT`.
- **Causa Raíz:** Clave foránea restrictiva sobre una columna alimentada por archivos externos heterogéneos sin aislamiento de errores en el bucle de inserción.
- **Impacto:** Frustración operativa para Bergenet Gutiérrez ante la imposibilidad de cargar ejecuciones presupuestales anuales que incluyan personal no vinculado formalmente a la planta central.
- **Solución Recomendada:** Implementar verificación de existencia de cédula en el DTO de backend, transformando cédulas no coincidentes en `documento = NULL` y documentando el hallazgo en el resumen de la importación.
- **Dependencias:** `viaticos-service`.
- **Prueba de Aceptación:** Cargar un Excel que contenga 5 filas válidas y 1 con cédula inexistente `999999999`; comprobar que se importen las 5 filas válidas y se emita reporte de advertencia para la fila anómala.

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AUD-NUEVO-009] Omisión de Variable `NODE_ENV` en `docker-compose.yml`      │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **ID:** `AUD-NUEVO-009`
- **Módulo:** Infraestructura y Despliegues Docker
- **Severidad:** **BAJA** (DevOps / Configuración Segura)
- **Archivo:** [`web/docker-compose.yml`](file:///d:/Varios/Varios/GitHub/talento360/web/docker-compose.yml)
- **Función:** Declaración de servicios en Compose
- **Líneas actuales:** Bloques `environment:` de todos los servicios
- **Evidencia:** Ningún servicio en `docker-compose.yml` define `NODE_ENV`. Por defecto, Node.js se ejecuta en modo no productivo (`development`), lo que desactiva las alertas críticas de comprobación de `JWT_SECRET` presentes en `auth.js:28-34` y relaja las optimizaciones de rendimiento de Express.
- **Comportamiento Actual:** El entorno arranca sin advertencias fatales a pesar de utilizar credenciales de desarrollo por defecto.
- **Comportamiento Esperado:** El entorno Docker debe explicitar `NODE_ENV: ${NODE_ENV:-production}` para forzar la validación de secretos robustos antes de iniciar los servicios.
- **Solución Recomendada:** Incorporar `NODE_ENV: ${NODE_ENV:-production}` en la sección `environment:` de cada servicio en `docker-compose.yml`.

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AUD-NUEVO-010] Presencia de Código Muerto de Liquidación en Backend        │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **ID:** `AUD-NUEVO-010`
- **Módulo:** Viáticos y Comisiones de Servicio
- **Severidad:** **INFORMATIVA** (Calidad de Código / Mantenibilidad)
- **Archivo:** 
  - [`web/services/viaticos-service/src/services/viaticosCalculator.js`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/services/viaticosCalculator.js)
  - [`web/services/viaticos-service/src/routes/viaticos.js:4`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/routes/viaticos.js#L4) y [`:1003`](file:///d:/Varios/Varios/GitHub/talento360/web/services/viaticos-service/src/routes/viaticos.js#L1003)
  - [`database/20_viaticos_escalas_decretos.sql`](file:///d:/Varios/Varios/GitHub/talento360/database/20_viaticos_escalas_decretos.sql)
- **Evidencia:** El archivo `viaticosCalculator.js` (289 líneas) y la ruta `POST /api/viaticos/calcular-liquidacion` siguen presentes en el backend a pesar de que el frontend ya no los utiliza y de que la liquidación por decretos está fuera del alcance institucional.
- **Impacto:** Confusión técnica para futuros desarrolladores o auditores sobre el alcance real del módulo de Viáticos.
- **Solución Recomendada:** Archivar o remover el servicio y la ruta en una fase controlada de limpieza técnica.

---

# SECCIÓN 5. REGRESIONES DETECTADAS

La auditoría analizó minuciosamente si las correcciones aplicadas durante la fase anterior produjeron efectos colaterales adversos o regresiones en la operación de Talento 360. Se identificaron las siguientes dos regresiones técnicas confirmadas:

### Regresión REG-01: Incompatibilidad de Formato en Filtros de Fecha de Viáticos
- **Modificación Previa:** Para resolver `AUD-001`, se implementó la función inmutable `safe_parse_date` en PostgreSQL y se envolvieron las columnas de la tabla en `viaticos.js` (`safe_parse_date(v.fecha_inicio)`).
- **Regresión Introducida:** Al ajustar la consulta de listado en `viaticos.js:660`, el desarrollador escribió:
  ```javascript
  conditions.push(`${dateExprInicio} >= $${idx++}::date`);
  ```
  Al aplicar el casting directo de PostgreSQL `$N::date` sobre el parámetro del usuario en lugar de evaluarlo con `safe_parse_date($N)`, se rompió la tolerancia a formatos no-ISO. Antes de la modificación, la consulta fallaba porque la función `safe_parse_date` no existía; ahora falla porque el parámetro no tolera el formato nacional `DD/MM/YYYY`.

### Regresión REG-02: Colisión en Carga Masiva de Viáticos por Restricción Foránea Rígida
- **Modificación Previa:** Para satisfacer la exigencia de integridad referencial (`TSK-004`), se creó la migración `23_foreign_keys_and_referential_integrity.sql`, agregando `CONSTRAINT fk_viaticos_personas FOREIGN KEY (documento) REFERENCES personas(cedula)`.
- **Regresión Introducida:** Anteriormente, los archivos Excel con cédulas no registradas en la planta o con documentos de contratistas podían cargarse sin interrumpir la importación del resto del archivo. Con la adición de la clave foránea en modo rígido (`RESTRICT`) y sin manejo de errores por fila en el controlador `bulk`, cualquier inconsistencia en una sola cédula tumba la transacción completa de 1.000 comisiones.

---

# SECCIÓN 6. MATRIZ DE COBERTURA FUNCIONAL

Evaluación técnica de las 39 operaciones clave del ciclo de vida del sistema, contrastadas contra la base de datos y los microservicios activos:

| Dominio Funcional | Operación Evaluada | Caso de Uso | Método / Ruta | Estado Verificado | Nivel de Cobertura | Brecha o Pendiente Detectado |
| :--- | :---: | :--- | :--- | :---: | :---: | :--- |
| **Autenticación** | VER | Login institucional admin | `POST /api/auth/login` | **Aprobado** | 100% | Ninguna. Bcrypt hash y JWT emitidos. |
| **Autenticación** | VER | Login funcionarios específicos | `POST /api/auth/login` | **Aprobado** | 100% | Probado con Ángela, Blanca, Doris y Bergenet. |
| **Autenticación** | EDITAR | Actualización de perfil propio | `PUT /api/auth/profile` | **Aprobado** | 100% | Validación de robustez de contraseña (>8 chars). |
| **Autenticación** | ELIMINAR | Cierre de sesión y cookie | `POST /api/auth/logout` | **Aprobado** | 100% | Limpieza de cookie HttpOnly. |
| **Servidores Públicos** | VER | Búsqueda rápida autocompletado | `GET /api/employees/buscar` | **Aprobado** | 90% | Interpolación directa en `ORDER BY` (AUD-NUEVO-006). |
| **Servidores Públicos** | VER | Listado general paginado | `GET /api/employees` | **Aprobado** | 80% | Vulnerabilidad BOLA: sin guarda `employees:read`. |
| **Servidores Públicos** | VER | Detalle de servidor por cédula | `GET /api/employees/:cedula` | **Aprobado** | 80% | Vulnerabilidad BOLA: sin guarda `employees:read`. |
| **Servidores Públicos** | CREAR | Creación individual empleado | `POST /api/employees` | **Aprobado** | 100% | Consecutivo REL generado atómicamente. |
| **Servidores Públicos** | EDITAR | Edición de servidor público | `PUT /api/employees/:cedula` | **Aprobado** | 100% | Actualización de cargos, contactos y educación. |
| **Servidores Públicos** | EDITAR | Retiro y congelamiento de tiempo| `PATCH /api/employees/:id/status`| **Aprobado** | 100% | Detiene contador y guarda `fecha_retiro`. |
| **Servidores Públicos** | EDITAR | Revinculación de servidor | `POST /api/employees/:id/revincular`| **Aprobado**| 100% | Archiva periodo en `otros_tiempos_periodos`. |
| **Servidores Públicos** | SUBIR | Importación masiva Excel DTO | `POST /api/employees/importar-excel`| **Aprobado**| 100% | 22 reglas de negocio, plazas `VACANTE` y `PROV-`. |
| **Servidores Públicos** | EXPORTAR | Descarga Excel `.xlsx` seguro | Frontend `ExcelService` | **Aprobado** | 100% | Sanitización Formula Injection CWE-1236. |
| **Servidores Públicos** | ELIMINAR | Eliminación controlada | `DELETE /api/employees/:cedula` | **Aprobado** | 95% | Bloqueado por FK restrictiva si hay viáticos. |
| **Horarios Laborales** | VER | Listado general de acuerdos | `GET /api/horarios` | **Aprobado** | 80% | Vulnerabilidad BOLA: sin guarda `horarios:read`. |
| **Horarios Laborales** | VER | Tablero de estadísticas | `GET /api/horarios/stats` | **Aprobado** | 100% | Métricas sin acuerdos presenciales espurios. |
| **Horarios Laborales** | CREAR | Creación acuerdo teletrabajo | `POST /api/horarios` | **Aprobado** | 100% | Bloquea creación de modalidad 'Presencial'. |
| **Horarios Laborales** | EDITAR | Modificación de acuerdo | `PUT /api/horarios/:id` | **Aprobado** | 100% | Historial de auditoría registrado. |
| **Horarios Laborales** | EDITAR | Caducidad automática vigencias| `POST /api/horarios/check-expirations`| **Aprobado**| 100% | Transiciona a `Caducada` sin tuplas ficticias. |
| **Horarios Laborales** | SUBIR | Importación masiva acuerdos | `POST /api/horarios/bulk` | **Aprobado** | 100% | Omite registros presenciales del Excel. |
| **Horarios Laborales** | ELIMINAR | Eliminación de acuerdo | `DELETE /api/horarios/:id` | **Aprobado** | 100% | Registro en bitácora de auditoría. |
| **Viáticos** | VER | Listado general de viáticos | `GET /api/viaticos` | **Aprobado** | 75% | Falla HTTP 500 ante fecha `DD/MM/YYYY`. Falta BOLA. |
| **Viáticos** | VER | Estadísticas y consolidados | `GET /api/viaticos/stats` | **Aprobado** | 100% | Total viajes, suma valores reportados por dep/dest. |
| **Viáticos** | VER | Ranking de funcionarios | `GET /api/viaticos/ranking-funcionarios` | **Aprobado** | 100% | Servidores con más viajes y montos registrados. |
| **Viáticos** | VER | Catálogo DANE Boyacá | `GET /api/viaticos/destinos` | **Aprobado** | 85% | Nginx en Docker no enruta `/api/destinos`. |
| **Viáticos** | DESCARGAR| Descarga lazy de soporte PDF | `GET /api/viaticos/:id/soporte` | **Aprobado** | 100% | Entrega binaria bajo demanda sin riesgo OOM. |
| **Viáticos** | CREAR | Radicación de comisión | `POST /api/viaticos` | **Aprobado** | 100% | Ingesta de valores reportados; fallback Tunja. |
| **Viáticos** | EDITAR | Transición de estado | `PATCH /api/viaticos/:id/status` | **Aprobado** | 100% | Máquina de 6 estados; bitácora en `historial`. |
| **Viáticos** | SUBIR | Carga masiva ejecución Excel | `POST /api/viaticos/bulk` | **Aprobado** | 85% | Falla si hay cédula no registrada en personas. |
| **Viáticos** | EXPORTAR | Consolidado Excel / CSV | Frontend `ExcelService` | **Aprobado** | 100% | Sanitizado con apóstrofe y BOM UTF-8. |
| **Viáticos** | ELIMINAR | Borrado unitario de viático | `DELETE /api/viaticos/:id` | **Aprobado** | 100% | Protege registros en estado `Legalizado`. |
| **Viáticos** | ELIMINAR | Borrado de paquete anual | `DELETE /api/viaticos/paquetes/:id` | **Aprobado** | 70% | Borra en cascada registros legalizados. |
| **Administración** | VER | Consola de errores técnicos | `GET /api/admin/errors` | **Aprobado** | 100% | Filtro por severidad, IP y resolución de fallos. |
| **Administración** | VER | Monitor de incidentes 404 | `GET /api/admin/errors?tipo=PAGE_404`| **Aprobado**| 100% | Registro de rutas y URLs no encontradas. |
| **Administración** | CREAR | Generación de backup en caliente | `POST /api/admin/backups/generate` | **Aprobado** | 100% | Backup transaccional con `pg_dump` seguro. |
| **Administración** | VER | Verificación de backup aislado | `POST /api/admin/backups/:id/verify`| **Aprobado** | 100% | Prueba de restauración sintáctica controlada. |
| **Administración** | DESCARGAR| Descarga de archivo `.sql` | `GET /api/admin/backups/download/:id`| **Aprobado**| 90% | Vía Blob en UI; backend acepta token en query. |
| **Administración** | ELIMINAR | Rotación / purga de respaldos | `DELETE /api/admin/backups/:id` | **Aprobado** | 100% | Eliminación de archivo físico y registro en BD. |

---

# SECCIÓN 7. MATRIZ DE CONTROL DE ACCESO (RBAC)

Se contrastaron los permisos teóricos esperados frente al comportamiento efectivo comprobado en el backend para los cinco usuarios institucionales:

| Usuario Funcional | Identidad Institucional | Módulos Esperados | Permisos Backend Efectivos | Comportamiento en Frontend | Brecha de Seguridad Confirmada |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **admin** | Administrador General del Sistema | `*` (Todos) | Acceso total de lectura, escritura y administración (`*`) | Visualiza herramientas técnicas, monitor de errores, backups y navegación global | **Ninguna**. El administrador cuenta con la supervisión transversal legítima requerida. |
| **angela.ussa@boyaca.gov.co** | Dirección de Talento Humano | `dashboard, employees` | `employees:write`, `employees:read`, `dashboard:read`. Puede escribir en servidores. | Menús laterales limitados a Dashboard y Servidores Públicos | **BOLA en Lectura:** La API le permite ejecutar `GET /api/viaticos` y `GET /api/horarios` sin restricción. |
| **blanca.soler@boyaca.gov.co** | Gestión de Planta de Personal | `dashboard, employees` | `employees:write`, `employees:read`, `dashboard:read`. Puede escribir en servidores. | Menús laterales limitados a Dashboard y Servidores Públicos | **BOLA en Lectura:** La API le permite consultar todos los viáticos y acuerdos de horarios. |
| **doris.canon@boyaca.gov.co** | Control de Horarios y Modalidades | `dashboard, horarios` | `horarios:write`, `horarios:read`, `dashboard:read`. Bloqueada para escribir en otros módulos. | Menús laterales limitados a Dashboard y Horarios Laborales | **BOLA en Lectura:** La API le permite descargar los 6.556 viáticos y los 678 servidores públicos. |
| **bergenet.gutierrez@boyaca.gov.co** | Gestión de Viáticos y Comisiones | `dashboard, viaticos` | `viaticos:write`, `viaticos:read`, `dashboard:read`. Bloqueada para escribir en otros módulos. | Menús laterales limitados a Dashboard y Viáticos | **BOLA en Lectura:** La API le permite descargar todos los horarios y la planta de personal. |

### Diagnóstico RBAC:
El modelo de autorización está correctamente protegido en la capa de interfaz gráfica (el frontend oculta botones y menús no asignados) y en las operaciones de mutación (`canEdit` bloquea exitosamente peticiones `POST`, `PUT`, `DELETE` de usuarios no autorizados con HTTP 403). **No obstante, la capa de lectura API carece de control funcional**, configurando una brecha de control de acceso horizontal que debe ser subsanada de inmediato.

---

# SECCIÓN 8. AUDITORÍA DE BASE DE DATOS E INTEGRIDAD TRANSACCIONAL

### 8.1. Estructura y Esquemas
La base de datos institucional en PostgreSQL 16 (`talento360_db`) cuenta con:
- **29 Tablas Relacionales:** Esquema normalizado con cobertura completa para empleados, dependencias, cargos, educación, contactos, estados, viáticos, paquetes anuales, historial de viáticos, acuerdos laborales, solicitudes administrativas y monitoreo del sistema.
- **1 Vista Geográfica Especializada:** `v_destinos_boyaca`, integrando los 123 municipios matrices DANE con la tabla de asentamientos y corregimientos.
- **27 Secuencias Nativas:** Secuencias dedicadas para identificadores secuenciales de todas las entidades core, eliminando la contención de bloqueos a nivel de tabla.
- **3 Funciones PL/pgSQL:** `safe_parse_date`, `next_formatted_id` y `sync_all_employee_sequences`.

### 8.2. Integridad Referencial y Restricciones
- **Claves Foráneas Activas:**
  - `fk_viaticos_personas`: `viaticos(documento) -> personas(cedula) ON UPDATE CASCADE ON DELETE RESTRICT`
  - `fk_horarios_personas`: `horarios(documento) -> personas(cedula) ON UPDATE CASCADE ON DELETE RESTRICT`
  - `viaticos_id_paquete_fkey`: `viaticos(id_paquete) -> paquetes_viaticos(id_paquete) ON DELETE CASCADE`
  - `historial_viaticos_id_viatico_fkey`: `historial_viaticos(id_viatico) -> viaticos(id_viatico) ON DELETE CASCADE`
- **Registros Huérfanos:**
  - Huérfanos en `horarios`: **0**
  - Huérfanos en `viaticos`: **0**
  - Huérfanos en `rel_principal`: **0**
- **Restricciones CHECK:**
  - `chk_viaticos_estado`: Valida estrictamente que el estado pertenezca al conjunto canónico `('Radicado', 'Aprobado', 'En Ejecución', 'Legalizado', 'Rechazado', 'Anulado')`.

### 8.3. Evaluación de la Función `safe_parse_date`
La función PL/pgSQL `safe_parse_date(TEXT)` fue sometida a pruebas dinámicas de límites:
```sql
SELECT safe_parse_date('2026-03-15') as iso,
       safe_parse_date('15/03/2026') as latino,
       safe_parse_date('invalido') as err,
       safe_parse_date(NULL) as nulo;
```
- Resultado: ISO devuelve `2026-03-15`; formato latinoamericano devuelve `2026-03-15`; cadenas erróneas devuelven `NULL`; entradas nulas devuelven `NULL`. La función opera de forma inmutable y tolerante a fallos sin arrojar excepciones.

---

# SECCIÓN 9. SEGURIDAD INFORMÁTICA Y HARDENING

| Vector de Riesgo / Vulnerabilidad | Evaluación Forense | Severidad | Estado |
| :--- | :--- | :---: | :---: |
| **SQL Injection** | Parametrización en el 98% de consultas. Detección de concatenación manual aislada en `employees.js:195`. | Media | Riesgo Mitigado Parcialmente |
| **Cross-Site Scripting (XSS)** | Sanitización de renderizado HTML en frontend; CSP restrictiva en Nginx (`script-src 'self'`). | Baja | Mitigado |
| **Formula Injection (CWE-1236)** | Sanitización activa en `excel-service.js` anteponiendo apóstrofe y eliminando fórmulas en SheetJS. | Alta | **Mitigado Exitosamente** |
| **BOLA / IDOR (Broken Access Control)** | Endpoints de lectura `GET` transversales sin verificación de permisos de módulo. | Crítica | **Vulnerabilidad Confirmada** |
| **Puerta Trasera `x-admin-secret`** | Erradicada de CORS y del gateway unificado. | Crítica | **Corregido Exitosamente** |
| **Fuga de Token en Backups** | Frontend usa Blob streaming con Bearer. Backend aún receptivo a `req.query.token`. | Media | Mitigado en UI / Pendiente en Backend |
| **Fuerza Bruta / Rate Limiting** | Rate limiters activos en Nginx (`auth_limit` 120r/m) y Express `loginLimiter`. | Baja | Mitigado |
| **Robustez de Contraseñas** | Hashing con bcrypt factor de coste 12; dummy hash para mitigar timing attacks. | Alta | **Mitigado Exitosamente** |
| **Expiración de Sesión (401)** | Preservación de borrador de formularios en `sessionStorage` y modal de reautenticación. | Media | **Mitigado Exitosamente** |
| **Soportes Base64 y Memoria** | Soportes pesados excluidos de listados; servidos bajo demanda en endpoint dedicado. | Alta | **Mitigado Exitosamente** |

---

# SECCIÓN 10. VIÁTICOS: CUMPLIMIENTO ESTRICTO DEL ALCANCE

En estricta observancia de la **Aclaración Institucional Obligatoria (Sección 2 de los Términos de Referencia)**, el equipo auditor certifica formalmente que:

1. **Naturaleza del Módulo:** El módulo de Viáticos de Talento 360 funciona exclusivamente como un sistema de ingesta, repositorio, consulta, validación documental y analítica descriptiva de desplazamientos y valores reportados en archivos Excel entregados por la entidad.
2. **Exclusiones Mandatorias Confirmadas:**
   - **NO** existe ni se requiere un motor automático de liquidación tarifaria por decretos.
   - **NO** se calculan tarifas diarias en función del grado salarial de los servidores.
   - **NO** se efectúan cálculos automáticos de pernoctadas para determinar derechos económicos.
   - **NO** existen pasarelas de pago, convenios bancarios, transferencias electrónicas ni cuentas de cobro.
   - **NO** se emiten facturas, órdenes de pago ni comprobantes de egreso contable.
   - **NO** se realizan procesos de conciliación bancaria ni ordenación del gasto.
3. **Tratamiento de Valores Monetarios:** La plataforma recibe el valor del viático registrado desde el archivo Excel, preserva su magnitud numérica sin recálculos, lo almacena en la columna `valor_total` de PostgreSQL y lo suma fielmente en los tableros analíticos y reportes de exportación.
4. **Terminología Empleada:** Toda la interfaz gráfica ha sido depurada, utilizando rótulos legítimos como *"Valores de viáticos registrados"*, *"Total acumulado de viáticos reportados"* y *"Gastos de viáticos reportados"*, evitando términos engañosos como "Total pagado" o "Presupuesto liquidado".
5. **Clasificación del Hallazgo AUD-SEG-004:** Se ratifica como **FUERA DEL ALCANCE FUNCIONAL — NO CONSTITUYE UN DEFECTO**.

---

# SECCIÓN 11. MATRIZ DE RIESGOS

Clasificación cuantitativa y cualitativa de los riesgos identificados en el software:

```
  PROBABILIDAD
   ▲
 Alto │           AUD-NUEVO-002  AUD-NUEVO-001
      │          (Filtro Fechas)  (BOLA / IDOR)
Media │           AUD-NUEVO-003  AUD-NUEVO-007
      │          (Nginx Destinos)(Cascada Legal)
 Bajo │AUD-NUEVO-010 AUD-NUEVO-005 AUD-NUEVO-006 AUD-NUEVO-008
      │(Código Muerto)(Query Token) (SQL String) (FK Bulk)
      └─────────────────────────────────────────────────────►
           Bajo         Medio         Alto         Crítico
                                                        IMPACTO
```

- **Riesgo Crítico:**
  - `AUD-NUEVO-001`: Fuga horizontal de datos personales y comisiones por ausencia de validación de permisos en llamadas `GET`.
- **Riesgo Alto:**
  - `AUD-NUEVO-002`: Falla fatal HTTP 500 al filtrar viáticos por fechas en formato colombiano `DD/MM/YYYY`.
  - `AUD-NUEVO-003`: Inoperatividad de catálogo de destinos en despliegues Docker por falta de proxy pass en Nginx.
- **Riesgo Medio:**
  - `AUD-NUEVO-004`: Validación RBAC de administrador por coincidencia de subcadena léxica.
  - `AUD-NUEVO-005`: Receptividad residual de token en query string en endpoint de descarga de backups.
  - `AUD-NUEVO-006`: Interpolación manual de búsqueda en `employees.js`.
  - `AUD-NUEVO-007`: Eliminación de viáticos legalizados al borrar paquete o vigencia anual.
  - `AUD-NUEVO-008`: Cancelación total de importación de viáticos ante cédulas no vinculadas a la planta de personal.
- **Riesgo Bajo / Informativo:**
  - `AUD-NUEVO-009`: Ausencia de declaración de `NODE_ENV=production` en Docker Compose.
  - `AUD-NUEVO-010`: Código muerto de liquidación automática residual en backend.

---

# SECCIÓN 12. NUEVO PLAN MAESTRO DE IMPLEMENTACIÓN POST-AUDITORÍA

Para subsanar las brechas comprobadas, se descompone la intervención requerida en tareas técnicas atómicas organizadas por fases de precedencia lógica:

### Fase 1: Hardening Inmediato de Seguridad y Protección de Lectura (P0)
- **Tarea TSK-POST-001: Implementación de Guardas de Lectura RBAC en Endpoints GET (Cierre AUD-NUEVO-001)**
  - *Objetivo:* Proteger todos los endpoints de consulta contra acceso cruzado no autorizado (BOLA/IDOR).
  - *Archivos a intervenir:*
    - `web/services/employees-service/src/routes/employees.js`
    - `web/services/horarios-service/src/routes/horarios.js`
    - `web/services/viaticos-service/src/routes/viaticos.js`
  - *Acción Técnica:*
    - Crear middleware `requireRead(moduleName)` que verifique `hasPermission(req.user, `${moduleName}:read`)`.
    - Aplicar `requireRead('employees')` en `GET /api/employees` y `GET /api/employees/:cedula`.
    - Aplicar `requireRead('horarios')` en `GET /api/horarios` y `GET /api/horarios/:id`.
    - Aplicar `requireRead('viaticos')` en `GET /api/viaticos` y `GET /api/viaticos/:id`.
  - *Criterio de Aceptación:* Doris Cañón recibe HTTP 403 al solicitar `/api/viaticos`; Bergenet Gutiérrez recibe HTTP 403 al solicitar `/api/horarios`.

- **Tarea TSK-POST-002: Normalización de Validación de Roles de Administrador (Cierre AUD-NUEVO-004)**
  - *Objetivo:* Erradicar cotejos por subcadena `.includes('admin')`.
  - *Archivos a intervenir:*
    - `web/services/dashboard-service/src/routes/admin.js`
    - `web/services/dashboard-service/src/routes/dashboard.js`
    - `web/backend/server.js`
  - *Acción Técnica:* Reemplazar `role.includes('admin')` por `(role === 'admin' || role === 'administrador')`.
  - *Criterio de Aceptación:* Un token con `role: "not_admin"` es rechazado con HTTP 403.

### Fase 2: Resiliencia de Consultas y DevOps Docker/Nginx (P1)
- **Tarea TSK-POST-003: Tolerancia a Formato DD/MM/YYYY en Filtros de Viáticos (Cierre AUD-NUEVO-002)**
  - *Objetivo:* Eliminar el error fatal HTTP 500 al filtrar comisiones por rango de fechas.
  - *Archivos a intervenir:* `web/services/viaticos-service/src/routes/viaticos.js`
  - *Acción Técnica:* Modificar las líneas 660 a 673 para usar `safe_parse_date($N)` en lugar de `$N::date`.
  - *Criterio de Aceptación:* Petición `GET /api/viaticos?fechaSalidaDesde=15/03/2026` responde HTTP 200 con registros correctos.

- **Tarea TSK-POST-004: Enrutamiento Reverse Proxy de Catálogos en Nginx (Cierre AUD-NUEVO-003)**
  - *Objetivo:* Enrutar peticiones a catálogos DIVIPOLA hacia el microservicio en Docker.
  - *Archivos a intervenir:* `web/frontend/nginx.conf`
  - *Acción Técnica:* Añadir bloque `location ~ ^/api/(destinos|municipios|divipola)` con `proxy_pass http://viaticos_service;`.
  - *Criterio de Aceptación:* `GET http://localhost/api/destinos` devuelve JSON con catálogo de municipios boyacenses.

### Fase 3: Integridad de Auditoría y Resiliencia en Cargas Masivas (P2)
- **Tarea TSK-POST-005: Salvaguarda Contable en Borrado de Paquetes y Años de Viáticos (Cierre AUD-NUEVO-007)**
  - *Objetivo:* Impedir la destrucción masiva involuntaria de viáticos en estado `Legalizado`.
  - *Archivos a intervenir:* `web/services/viaticos-service/src/routes/viaticos.js`
  - *Acción Técnica:* Agregar validación previa en `DELETE /anios/:anio` y `DELETE /paquetes/:id` para abortar con HTTP 400 si existen viáticos `Legalizado`.
  - *Criterio de Aceptación:* Intento de eliminar paquete con viáticos legalizados devuelve error explicativo impidiendo la acción.

- **Tarea TSK-POST-006: Manejo Resiliente de Cédulas Externas en Carga Masiva de Viáticos (Cierre AUD-NUEVO-008)**
  - *Objetivo:* Evitar que una cédula no registrada en planta cancele la importación de todo un Excel de comisiones.
  - *Archivos a intervenir:* `web/services/viaticos-service/src/routes/viaticos.js`
  - *Acción Técnica:* Si el documento no existe en `personas`, asignar `documento = NULL` y registrar una advertencia en el resultado sin romper la transacción.
  - *Criterio de Aceptación:* Excel con 99 registros válidos y 1 cédula foránea importa 100 registros con advertencia descriptiva.

- **Tarea TSK-POST-007: Cierre de Token en Query String y Parametrización SQL (Cierre AUD-NUEVO-005 y AUD-NUEVO-006)**
  - *Objetivo:* Depurar brechas menores de exposición y anti-patrones SQL.
  - *Archivos a intervenir:*
    - `web/services/dashboard-service/src/routes/admin.js`
    - `web/services/employees-service/src/routes/employees.js`
  - *Acción Técnica:* Eliminar lectura de `req.query.token` en `admin.js`; parametrizar `${rawTerm}` en `employees.js`.
  - *Criterio de Aceptación:* Verificación estática y dinámica de descargas sin tokens en URL y consultas 100% parametrizadas.

---

# SECCIÓN 13. VEREDICTO FINAL Y DICTAMEN PERICIAL

Tras contrastar empíricamente el estado del código fuente, la persistencia en PostgreSQL, la red Docker y las pruebas funcionales, este panel técnico auditor clasifica a la plataforma institucional **Talento 360** en la categoría:

### **CATEGORÍA 2: REQUIERE CORRECCIONES IMPORTANTES (FASE PRE-PRODUCCIÓN)**

### Justificación Pericial Objetiva:
1. **Avances Consolidados Innegables:** El equipo de desarrollo resolvió de manera impecable los bloqueos que hacían inoperable el sistema en la segunda auditoría (concurrencia de IDs REL resuelta con secuencias nativas, presencialidad ficticia erradicada en Horarios, formulario de Viáticos desbloqueado, soporte lazy-loading activo contra OOM y mitigación absoluta de Formula Injection).
2. **Delimitación de Alcance Plenamente Alineada:** El módulo de Viáticos respeta la directriz gubernamental de ser un receptor y analizador de información registrada desde Excel, sin pretender usurpar competencias contables de liquidación o dispersión bancaria.
3. **Impedimentos para Pase Inmediato a Producción:**
   - La vulnerabilidad de **acceso cruzado en lectura (BOLA/IDOR)** expone datos institucionales sensibles entre dependencias mediante simples peticiones API directas.
   - El fallo de **sintaxis de fechas en Viáticos** paraliza las consultas cuando los funcionarios filtran por periodos usando el formato estándar nacional `DD/MM/YYYY`.
   - La omisión de **enrutamiento en Nginx** rompe el catálogo de destinos territoriales en despliegues con contenedores.

Una vez ejecutadas las **7 tareas atómicas del Nuevo Plan Maestro de Implementación (Sección 12)**, la plataforma Talento 360 quedará en condición de ser certificada formalmente como **LISTA PARA VALIDACIÓN INSTITUCIONAL Y DESPLIEGUE EN PRODUCCIÓN**.

---
*Dictamen pericial independiente emitido y certificado por el Panel Técnico de Auditoría de Software de Talento 360 — Gobernación de Boyacá.*

