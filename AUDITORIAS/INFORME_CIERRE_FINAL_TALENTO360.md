# INFORME FINAL DE PRECISIÓN, INTEGRIDAD DE DATOS Y CIERRE FUNCIONAL
## Sistema Integral de Gestión de Talento Humano — Talento 360
### Gobernación de Boyacá | Dirección de Talento Humano

---

| Metadato Institucional | Detalle de Ejecución y Certificación |
|---|---|
| **Entidad Mandante** | Gobernación de Boyacá |
| **Plataforma Auditada** | Talento 360 (Microservicios Docker + PostgreSQL + Vanilla JS) |
| **Módulos Auditados** | Servidores Públicos, Horarios Laborales, Viáticos Institucionales, Seguridad / RBAC |
| **Rama de Trabajo** | `audit/correccion-integridad-institucional` (Aislada, sin push a remoto ni merge a `main`) |
| **Respaldo de BD Pre-Intervención** | `AUDITORIAS/backup_cierre_precision_20261111.sql` (8.12 MB, íntegro y restaurable) |
| **Respaldo de BD Previo** | `AUDITORIAS/backup_cierre_final_20261111.sql` (8.15 MB, conservado) |
| **Fecha de Dictamen** | 11 de Noviembre de 2026 |
| **Resultado Global** | **CONFORME PARA REVISIÓN INSTITUCIONAL / OBSERVACIÓN DOCUMENTAL MANTENIDA** |

---

## 1. SEGURIDAD ADMINISTRATIVA, SECRETOS Y ROTACIÓN (PRIORIDAD ALTA)

### 1.1. Bypasses de Autenticación Definitivamente Suprimidos
Se comprobó y certificó que el microservicio de autenticación (`auth-service`) no contiene puertas traseras, contraseñas alternativas ni mecanismos de evasión criptográfica:
- **`web/services/auth-service/src/routes/auth.js`**: Verificación única mediante `bcrypt.compare` contra la columna `password` de la tabla `usuarios`. Toda petición de acceso inválida genera un rechazo con código **HTTP 401 Unauthorized** y descuenta intentos en el motor de protección de fuerza bruta.
- **Protección Progresiva contra Ataques de Fuerza Bruta**: Se comprobó el bloqueo progresivo: 5 intentos fallidos permitidos, bloqueo de 1 minuto al 6º intento fallido, escalando progresivamente hasta un tope de 4 minutos con recomendación activa de restablecimiento de contraseña.

### 1.2. Refactorización Segura del Script de Restablecimiento (`reset_admin_credentials.js`)
Para cumplir las mejores prácticas OWASP y evitar la exposición de credenciales en el historial de comandos de la shell o en el árbol de procesos del sistema operativo (`ps aux` / Task Manager):
- Se eliminó la recepción de contraseñas mediante argumentos por línea de comandos (`process.argv[2]`).
- Se implementó soporte exclusivo para:
  1. Variable de entorno protegida (`ADMIN_PASSWORD` o `ADMIN_DEFAULT_PASSWORD`).
  2. Modo interactivo mediante terminal TTY con captura silenciosa de caracteres (sin eco visual en pantalla).
- Se incorporó un validador estricto de complejidad institucional:
  - Mínimo 8 caracteres.
  - Al menos una letra mayúscula (`[A-Z]`).
  - Al menos una letra minúscula (`[a-z]`).
  - Al menos un dígito numérico (`[0-9]`).
  - Al menos un carácter especial (`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`).
- El script no imprime en consola ni almacena en registros el valor en texto plano ni el hash generado.

### 1.3. Auditoría de Seeds y Cuentas de Microservicios
- Se inspeccionaron los seeds de `admin-requests-service` y `sst-service` (`src/utils/audit-rbac.js`). Todas las credenciales predeterminadas en texto plano fueron reemplazadas por hashes bcrypt válidos (`$2a$10$...`).
- La cláusula de inserción opera con `ON CONFLICT (username) DO NOTHING`, asegurando que ninguna inicialización de microservicio sobrescriba las contraseñas de las cuentas existentes en la base de datos.
- **Cuenta Administradora Técnica Institucional**: Es exclusivamente **`alejoleo2022@gmail.com`**.
- Ninguna contraseña, hash ni secreto se encuentra expuesto en archivos versionados ni en la documentación técnica (`[REDACTADO]`).

---

## 2. CLASIFICACIÓN RIGUROSA DEL CENSO Y TRATAMIENTO DE `PROV-00003` (PRIORIDAD ALTA)

### 2.1. Inspección Forense de las Filas 402 y 406 de `TIEMPO DE SERVICIO 2026.xlsx`
Se analizó minuciosamente el archivo maestro oficial de planta:
`documentos/Servidores Publicos/TIEMPO DE SERVICIO 2026.xlsx` (670 filas con contenido):
- **Fila 402**:
  - Dependencia: `8.4.3 SUBDIRECCION DE COBERTURA Y RURALIDAD`.
  - Cargo: `SUBDIRECTOR TECNICO` (Código `068`, Grado `03`).
  - Primer Apellido: `CARGOS OCUPADOS POR SUPERVISORES`.
  - Cédula, Nombres, Nacimiento, Edad, Sexo, Correo: **Vacíos / No informados**.
  - Clasificación: `L.N`.
- **Fila 406**:
  - Dependencia: `8.4.6 SUBDIRECCION DE CALIDAD EDUCATIVA`.
  - Cargo: `SUBDIRECTOR TECNICO` (Código `068`, Grado `03`).
  - Primer Apellido: `CARGOS OCUPADOS POR SUPERVISORES`.
  - Cédula, Nombres, Nacimiento, Edad, Sexo, Correo: **Vacíos / No informados**.
  - Funciones Pagadas: `128`.

### 2.2. Naturaleza y Tratamiento Semántico de `PROV-00003`
Las filas 402 y 406 no corresponden a una persona natural individualizada, sino a **dos plazas de Subdirector Técnico asignadas funcionalmente a Supervisores de Educación** en la estructura de la Secretaría de Educación de Boyacá.
En la base de datos PostgreSQL, estas filas se encontraban consolidadas bajo el registro técnico `PROV-00003` (`PER0669`).
**Determinación Semántica Aplicada:**
- `PROV-00003` **NO es una persona natural** y no debe contabilizarse ni denominarse como tal.
- Se clasificó técnicamente como **Agrupamiento Institucional de Cargos de Supervisión**.
- Se actualizó el motor de analítica de `dashboard-service` para diferenciar rigurosamente entre personas naturales y conceptos agrupados.

### 2.3. Conciliación Censal Definitiva (670 Filas Excel vs 669 Registros en BD)

```
========================================================================================================================
CATEGORÍA CENSAL INSTITUCIONAL                        FILAS EXCEL   REGISTROS BD   NATURALEZA / JUSTIFICACIÓN TÉCNICA
========================================================================================================================
1. Servidores Activos con Cédula Nacional             624           624            Personas naturales con vinculación activa.
2. Servidora Provisional con Cédula en Trámite        1             1              Persona natural (PROV-00002 / Martha Núñez).
   --> SUB-TOTAL PERSONAS NATURALES ACTIVAS           625           625            TOTAL PERSONAS NATURALES EN SERVICIO
3. Plazas Vacantes de Planta Institucional            43            43             Posiciones sin titular (es_vacante = true).
4. Agrupamiento Institucional de Cargos Supervisión   2             1              Filas 402 y 406 unificadas en PROV-00003.
========================================================================================================================
TOTAL REGISTROS Y POSICIONES CONCILIADOS              670           669            CONCILIACIÓN MATEMÁTICA EXACTA
========================================================================================================================
```

### 2.4. Aclaración del Indicador del Dashboard
El endpoint `GET /api/dashboard/stats` fue actualizado y verificado:
- `empleados.total`: **669** (total de posiciones y registros censales).
- `empleados.activos`: **625** (personas naturales vivas en ejercicio de funciones).
- `empleados.vacantes`: **43** (plazas vacantes institucionales).
- `empleados.agrupados`: **1** (agrupamiento institucional de supervisores `PROV-00003`).
- **Coherencia total:** `625 + 43 + 1 = 669`.

---

## 3. CORRECCIÓN DEFINITIVA DE FECHAS DE VIÁTICOS EN 13 REGISTROS (PRIORIDAD CRÍTICA)

### 3.1. Identificación y Análisis Forense de los 13 Registros Afectados
La comparación directa de los 1.855 registros entre el Paquete 2 (vigencia 2022) y el Paquete 3 (vigencia 2023) reveló que 13 registros presentaban fechas artificiales (`01/01/2022` vs `01/01/2023`).
Se investigaron las celdas exactas en el archivo fuente original `documentos/Viaticos/2022/EJECUCION PRESUPUESTAL 2022.xlsx`:

| Par (P2 / P3) | Funcionario (Anonimizado) | Documento | Hoja Excel / Fila | Contenido Original Celda Fecha | Valor Artificial Previo | Número de Resolución | Corrección Aplicada |
|---|---|---|---|---|---|---|---|
| **#1364 / #3219** | LUIS EUGENIO L. | `413***38` | `DESPACHOGOBER` / 187 | `07,08,0908/2023` (errata 2023) | `01/01/2022` / `01/01/2023` | `2323/08/08/2023` | `NULL` + Traza en obs |
| **#1602 / #3457** | RICARDO S. | `409***61` | `GENERAL` / 89 | `15,16,17/032023` (errata 2023) | `01/01/2022` / `01/01/2023` | `0726/15/03/2023` | `NULL` + Traza en obs |
| **#1653 / #3508** | JORGE OSBALDO C. | `194***53` | `GENERAL` / 140 | `02,0305/2023` (errata 2023) | `01/01/2022` / `01/01/2023` | `1192/002/05/2023` | `NULL` + Traza en obs |
| **#1769 / #3624** | VICTOR JULIO M. | `743***41` | `GENERAL` / 257 | `21/072023` (errata 2023) | `01/01/2022` / `01/01/2023` | `2163/24/07/2023` | `NULL` + Traza en obs |
| **#1920 / #3775** | RODRIGO EDUARDO U. | `SIN_DOC` | `INFRAESTRUCTURA` / 17 | `OTANCHE,SAN PABLO DE BORBUR` | `01/01/2022` / `01/01/2023` | `0167/31/01/2023` | `NULL` + Traza en obs |
| **#1934 / #3789** | NELSON L. | `754***14` | `INFRAESTRUCTURA` / 31 | `SOGAMOSO` (celda fecha omitida) | `01/01/2022` / `01/01/2023` | `0314/13/02/2023` | `NULL` + Traza en obs |
| **#2012 / #3867** | TATIANA DANIELA P. | `SIN_DOC` | `INFRAESTRUCTURA` / 111 | `GUICAN, PANQUEBA` (sin fecha) | `01/01/2022` / `01/01/2023` | `1727/14/06/2023` | `NULL` + Traza en obs |
| **#2087 / #3942** | NELSON L. | `754***14` | `INFRAESTRUCTURA` / 186 | `GÁMEZA` (celda fecha omitida) | `01/01/2022` / `01/01/2023` | `3415/12/10/2023` | `NULL` + Traza en obs |
| **#2121 / #3976** | ENRIQUE L. | `716***66` | `INFRAESTRUCTURA` / 220 | `PAEZ` (celda fecha omitida) | `01/01/2022` / `01/01/2023` | `4102/07/12/2023` | `NULL` + Traza en obs |
| **#2350 / #4205** | JULIO AGAPITO A. | `912***59` | `AGRICULTURA` / 199 | `BARBOSA` (celda fecha omitida) | `01/01/2022` / `01/01/2023` | `2303/04/08/2023` | `NULL` + Traza en obs |
| **#2592 / #4447** | ALBA RUTH G. | `238***61` | `MINAS` / 42 | `CHIVATA` (celda fecha omitida) | `01/01/2022` / `01/01/2023` | `2621/01/09/2023` | `NULL` + Traza en obs |
| **#2626 / #4481** | DEISY PAOLA H. | `105***29` | `GOBIERNO` / 25 | `CUBARA` (celda fecha omitida) | `01/01/2022` / `01/01/2023` | `0402/20/02/2023` | `NULL` + Traza en obs |
| **#2900 / #4755** | LUZ AMELIA P. | `SIN_DOC` | `AMBIENTE` / 127 | `ZETAQUIRA,MIRAFLORES` | `01/01/2022` / `01/01/2023` | `1754/16/06/2023` | `NULL` + Traza en obs |

**Causas Técnicas Demostradas:**
1. **9 registros sin fecha informada:** En las hojas de Infraestructura, Agricultura, Minas, Gobierno y Ambiente, la columna de fecha fue omitida en el Excel original y la celda contenía el municipio de destino.
2. **4 registros con erratas de digitación:** En Despacho y General, las fechas tenían omisión de barras tipográficas (p. ej. `07,08,0908/2023` en lugar de `07,08,09/08/2023`), conteniendo inequívocamente el año 2023.
3. **Comportamiento heredado del importador:** En `web/frontend/src/js/modules/viaticos.js` (línea 4807) y en `web/services/viaticos-service/src/routes/viaticos.js` (líneas 1214, 1425, 1438), cuando una fecha venía vacía o no era parseable, el sistema asignaba automáticamente `01/01/2023` o `today`.

### 3.2. Corrección Técnica Aplicada en el Backend y Frontend
1. **Frontend (`web/frontend/src/js/modules/viaticos.js`)**:
   - Se modificó `parseDateRobust`: si la celda está vacía o su contenido no es interpretable como fecha válida de calendario (p. ej. nombres de municipios), retorna `{ start: null, end: null, dias: 1, raw: rawVal, invalid: true }`.
   - Se eliminó por completo el retorno estático `{ start: '01/01/2023', ... }`.
   - Se suprimió la extracción automática de fechas desde el número de resolución, acatando la prohibición expresa de inventar fechas sin regla institucional documentada.
2. **Backend (`web/services/viaticos-service/src/routes/viaticos.js`)**:
   - En `POST /` y `POST /bulk`, se reemplazó `fechaInicio || today` por `fechaInicio || null` y `fechaFin || null`.
   - El contenedor `talento360_viaticos` fue actualizado y reiniciado.
3. **Persistencia en PostgreSQL (`scratch/apply_viaticos_dates_fix.js`)**:
   - En los 26 registros (13 en P2 y 13 en P3), se actualizaron `fecha_inicio = NULL` y `fecha_fin = NULL`.
   - Se incorporó la trazabilidad en la columna `observaciones`:
     `[AUD-FECHA-PRECISION: Fecha artificial retirada (era 01/01/202X). Valor celda Excel: '...'. Pendiente confirmacion institucional]`.
   - Ninguna fecha fue inventada. Los datos originales permanecen documentados y la operación es 100% reversible.

### 3.3. Pruebas de Validación del Parser y de la API
- **Suite de Pruebas de Fechas (`scratch/test_viaticos_date_importer.js`)**: **12 de 12 pruebas superadas (100.0%)**, verificando el correcto tratamiento de fechas ISO, fechas seriales de Excel, fechas regionales, celdas vacías (`null`), cadenas vacías (`""`), erratas con barras faltantes y rechazo de nombres de municipios.
- **Prueba API de Inserción (`scratch/test_api_date_null.js`)**: Comprobado que una comisión enviada sin fecha se almacena en PostgreSQL con `fecha_inicio = NULL` y `fecha_fin = NULL` sin inventar `today` ni `01/01/{año}`.

---

## 4. INVENTARIO EXHAUSTIVO DE LA MATRIZ RBAC (PRIORIDAD ALTA)

Se ejecutó la suite automatizada `scratch/test_rbac_real_valid_operations.js` validando 47 escenarios reales con payloads válidos y completos.

**Resultado Global RBAC: 47 de 47 pruebas superadas con éxito (100.0%).**

### 4.1. Inventario Detallado de Pruebas RBAC con Verificación en PostgreSQL

| ID | Usuario Evaluado | Módulo | Operación | Método y Endpoint | HTTP Esperado | HTTP Obtenido | Verificación en PostgreSQL | Estado |
|---|---|---|---|---|:---:|:---:|---|:---:|
| **RBAC-01** | Ángela Ussa | Servidores | Crear Servidor | `POST /api/employees` | 201 | **201** | Tupla creada en `personas` (`99999901`) y `rel_principal` | **PASS** |
| **RBAC-02** | Ángela Ussa | Servidores | Verificar Creación | `SELECT FROM personas` | 1 reg | **1 reg** | Registro `99999901` verificado en base de datos | **PASS** |
| **RBAC-03** | Blanca Soler | Servidores | Actualizar Servidor | `PUT /api/employees/99999901` | 200 | **200** | Asignación salarial y nombres actualizados en BD | **PASS** |
| **RBAC-04** | Blanca Soler | Servidores | Verificar Actualización | `SELECT FROM personas` | Nombre OK | **Nombre OK** | Contenido `'EDITADO'` verificado en BD | **PASS** |
| **RBAC-05** | Doris Cañón | Servidores | Intento Crear Servidor | `POST /api/employees` | 403 | **403** | Bloqueo estricto por middleware RBAC (sin permisos) | **PASS** |
| **RBAC-06** | Bergenet Gutiérrez | Servidores | Intento Editar Servidor | `PUT /api/employees/99999901` | 403 | **403** | Bloqueo estricto por middleware RBAC (sin permisos) | **PASS** |
| **RBAC-07** | Doris Cañón | Servidores | Intento Borrar Servidor | `DELETE /api/employees/99999901`| 403 | **403** | Bloqueo estricto por middleware RBAC (sin permisos) | **PASS** |
| **RBAC-08** | Ángela Ussa | Servidores | Eliminar Servidor | `DELETE /api/employees/99999901`| 200 | **200** | Eliminación en cascada controlada de servidor sintético | **PASS** |
| **RBAC-09** | Ángela Ussa | Servidores | Verificar Eliminación | `SELECT FROM personas` | 0 regs | **0 regs** | Cédula `99999901` eliminada limpiamente de PostgreSQL | **PASS** |
| **RBAC-10** | Doris Cañón | Horarios | Crear Acuerdo Flexible | `POST /api/horarios` | 201 | **201** | Acuerdo creado para servidor válido (`1057611073`) | **PASS** |
| **RBAC-11** | Doris Cañón | Horarios | Verificar Creación | `SELECT FROM horarios` | 1 reg | **1 reg** | Tupla con observaciones de prueba verificada en BD | **PASS** |
| **RBAC-12** | Doris Cañón | Horarios | Actualizar Franja Horaria | `PUT /api/horarios/:id` | 200 | **200** | Franja horaria modificada a 07:30 - 16:30 | **PASS** |
| **RBAC-13** | Doris Cañón | Horarios | Verificar Actualización | `SELECT FROM horarios` | 07:30 | **07:30** | Franja 07:30 persistida en PostgreSQL | **PASS** |
| **RBAC-14** | Ángela Ussa | Horarios | Intento Crear Horario | `POST /api/horarios` | 403 | **403** | Bloqueo estricto por middleware RBAC (sin permisos) | **PASS** |
| **RBAC-15** | Bergenet Gutiérrez | Horarios | Intento Editar Horario | `PUT /api/horarios/:id` | 403 | **403** | Bloqueo estricto por middleware RBAC (sin permisos) | **PASS** |
| **RBAC-16** | Blanca Soler | Horarios | Intento Borrar Horario | `DELETE /api/horarios/:id` | 403 | **403** | Bloqueo estricto por middleware RBAC (sin permisos) | **PASS** |
| **RBAC-17** | Doris Cañón | Horarios | Eliminar Acuerdo | `DELETE /api/horarios/:id` | 200 | **200** | Acuerdo sintético eliminado por gestora autorizada | **PASS** |
| **RBAC-18** | Doris Cañón | Horarios | Verificar Eliminación | `SELECT FROM horarios` | 0 regs | **0 regs** | ID de acuerdo eliminado limpiamente de PostgreSQL | **PASS** |
| **RBAC-19** | Bergenet Gutiérrez | Viáticos | Crear Viático Radicado | `POST /api/viaticos` | 201 | **201** | Viático creado con radicado `VIT-2026-XXXXX` | **PASS** |
| **RBAC-20** | Bergenet Gutiérrez | Viáticos | Verificar Creación | `SELECT FROM viaticos` | 1 reg | **1 reg** | Resolución `TEST-RBAC-2026` verificada en PostgreSQL | **PASS** |
| **RBAC-21** | Bergenet Gutiérrez | Viáticos | Modificar Destino/Valor | `PUT /api/viaticos/:id` | 200 | **200** | Destino modificado a DUITAMA y valor a 450.000 COP | **PASS** |
| **RBAC-22** | Bergenet Gutiérrez | Viáticos | Verificar Actualización | `SELECT FROM viaticos` | DUITAMA | **DUITAMA** | Destino actualizado verificado en PostgreSQL | **PASS** |
| **RBAC-23** | Bergenet Gutiérrez | Viáticos | Cambiar Estado a Aprobado | `PATCH /api/viaticos/:id/status`| 200 | **200** | Transición de estado a `'Aprobado'` exitosa | **PASS** |
| **RBAC-24** | Bergenet Gutiérrez | Viáticos | Verificar Estado en BD | `SELECT FROM viaticos` | Aprobado | **Aprobado** | Estado `'Aprobado'` verificado en PostgreSQL | **PASS** |
| **RBAC-25** | Ángela Ussa | Viáticos | Intento Crear Viático | `POST /api/viaticos` | 403 | **403** | Bloqueo estricto por middleware RBAC (sin permisos) | **PASS** |
| **RBAC-26** | Doris Cañón | Viáticos | Intento Editar Viático | `PUT /api/viaticos/:id` | 403 | **403** | Bloqueo estricto por middleware RBAC (sin permisos) | **PASS** |
| **RBAC-27** | Blanca Soler | Viáticos | Intento Borrar Viático | `DELETE /api/viaticos/:id` | 403 | **403** | Bloqueo estricto por middleware RBAC (sin permisos) | **PASS** |
| **RBAC-28** | Bergenet Gutiérrez | Viáticos | Eliminar Viático Radicado | `DELETE /api/viaticos/:id` | 200 | **200** | Eliminación autorizada de viático de prueba | **PASS** |
| **RBAC-29** | Bergenet Gutiérrez | Viáticos | Verificar Eliminación | `SELECT FROM viaticos` | 0 regs | **0 regs** | Viático eliminado limpiamente de PostgreSQL | **PASS** |
| **RBAC-30** | Administrador | Servidores | Crear Servidor Admin | `POST /api/employees` | 201 | **201** | Operación administrativa global autorizada | **PASS** |
| **RBAC-31** | Administrador | Horarios | Crear Horario Admin | `POST /api/horarios` | 201 | **201** | Operación administrativa global autorizada | **PASS** |
| **RBAC-32** | Administrador | Viáticos | Crear Viático Admin | `POST /api/viaticos` | 201 | **201** | Operación administrativa global autorizada | **PASS** |
| **RBAC-33** | Administrador | Servidores | Eliminar Servidor Admin | `DELETE /api/employees/:ced` | 200 | **200** | Eliminación administrativa verificada | **PASS** |
| **RBAC-34** | Administrador | Horarios | Eliminar Horario Admin | `DELETE /api/horarios/:id` | 200 | **200** | Eliminación administrativa verificada | **PASS** |
| **RBAC-35** | Administrador | Viáticos | Eliminar Viático Admin | `DELETE /api/viaticos/:id` | 200 | **200** | Eliminación administrativa verificada | **PASS** |
| **RBAC-36** | Ángela Ussa | Servidores | Consulta Listado | `GET /api/employees?limit=5` | 200 | **200** | Acceso de lectura autorizado | **PASS** |
| **RBAC-37** | Ángela Ussa | Horarios | Consulta Cruzada Horarios | `GET /api/horarios?limit=5` | 200 | **200** | Acceso de solo lectura cross-module autorizado | **PASS** |
| **RBAC-38** | Ángela Ussa | Viáticos | Consulta Cruzada Viáticos | `GET /api/viaticos?limit=5` | 200 | **200** | Acceso de solo lectura cross-module autorizado | **PASS** |
| **RBAC-39** | Blanca Soler | Servidores | Consulta Listado | `GET /api/employees?limit=5` | 200 | **200** | Acceso de lectura autorizado | **PASS** |
| **RBAC-40** | Blanca Soler | Horarios | Consulta Cruzada Horarios | `GET /api/horarios?limit=5` | 200 | **200** | Acceso de solo lectura cross-module autorizado | **PASS** |
| **RBAC-41** | Blanca Soler | Viáticos | Consulta Cruzada Viáticos | `GET /api/viaticos?limit=5` | 200 | **200** | Acceso de solo lectura cross-module autorizado | **PASS** |
| **RBAC-42** | Doris Cañón | Servidores | Consulta Cruzada Servidores | `GET /api/employees?limit=5` | 200 | **200** | Acceso de solo lectura cross-module autorizado | **PASS** |
| **RBAC-43** | Doris Cañón | Horarios | Consulta Listado | `GET /api/horarios?limit=5` | 200 | **200** | Acceso de lectura autorizado | **PASS** |
| **RBAC-44** | Doris Cañón | Viáticos | Consulta Cruzada Viáticos | `GET /api/viaticos?limit=5` | 200 | **200** | Acceso de solo lectura cross-module autorizado | **PASS** |
| **RBAC-45** | Bergenet Gutiérrez | Servidores | Consulta Cruzada Servidores | `GET /api/employees?limit=5` | 200 | **200** | Acceso de solo lectura cross-module autorizado | **PASS** |
| **RBAC-46** | Bergenet Gutiérrez | Horarios | Consulta Cruzada Horarios | `GET /api/horarios?limit=5` | 200 | **200** | Acceso de solo lectura cross-module autorizado | **PASS** |
| **RBAC-47** | Bergenet Gutiérrez | Viáticos | Consulta Listado | `GET /api/viaticos?limit=5` | 200 | **200** | Acceso de lectura autorizado | **PASS** |

---

## 5. VALIDACIÓN DE EXPORTACIÓN EXCEL, FILTROS Y PROTECCIÓN CWE-1236

### 5.1. Comparación Exhaustiva: Excel Descargado vs PostgreSQL
Se ejecutó la suite `scratch/test_filtered_excel_and_integrity.js`, verificando que la exportación a Excel solicite `limit=10000` para **descargar la totalidad del conjunto filtrado** y no únicamente la página activa:

```
========================================================================================================================
MÓDULO              CRITERIO DE FILTRO                PÁGINA UI   TOTAL EXCEL   TOTAL BD   CONCORDANCIA CONTENIDO
========================================================================================================================
Servidores Públicos Dependencia: TESORERÍA GENERAL   10 regs     20 regs       20 regs    EXACTA (20 de 20 filas coincidentes)
Horarios Especiales Modalidad: Horario flexible     10 regs     90 regs       90 regs    EXACTA (90 de 90 filas coincidentes)
Viáticos            Paquete: 1 (Presupuesto 2025)   10 regs     1.181 regs    1.181 regs EXACTA (1.181 de 1.181 coincidentes)
========================================================================================================================
```

### 5.2. Protección contra Inyección de Fórmulas Dinámicas (CWE-1236)
- Se ejecutó la suite `scratch/test_prompt_10_formula_injection.js` (65/65 aserciones superadas).
- `ExcelService` antepone un apóstrofe de escape (`'`) a cualquier celda cuyo valor comience con caracteres de ejecución (`=`, `+`, `-`, `@`), neutralizando vectores de ataque DDE en hojas de cálculo.

---

## 6. REVISIÓN DE INTEGRIDAD REFERENCIAL Y LIMPIEZA FINAL DE DATOS

Se ejecutó la suite `scratch/verify_referential_integrity.js` evaluando todas las relaciones de clave foránea en PostgreSQL:
- Claves huérfanas en `horarios` → `personas`: **0**.
- Claves huérfanas en `viaticos` → `personas`: **0**.
- Claves huérfanas en `viaticos` → `paquetes_viaticos`: **0**.
- Claves huérfanas en `rel_principal` → `personas`: **0**.
- Claves huérfanas en `historial_viaticos` → `viaticos`: **0**.

### Conteos Oficiales Consolidados en Base de Datos:
- `personas`: **669 registros canónicos** (624 funcionarios con cédula activa + 1 provisional en trámite + 43 vacantes institucionales + 1 agrupamiento de supervisores).
- `horarios`: **135 acuerdos de situaciones especiales** (90 Flexibles, 29 Teletrabajo, 16 Trabajo en Casa, 0 Presenciales).
- `viaticos`: **8.248 comisiones históricas**.
- `paquetes_viaticos`: **7 paquetes presupuestales** ($1.882.517.569,50 COP).
- `usuarios`: **14 cuentas institucionales** con contraseñas encriptadas mediante bcrypt.

---

## 7. DICTAMEN TÉCNICO FINAL Y ESTADO DE COMPONENTES

| Componente Auditado | Dictamen Técnico | Sustento de la Calificación |
|---|:---:|---|
| **Seguridad Administrativa y Secretos** | **PASS** | Bypasses suprimidos, login unificado por hash bcrypt, bloqueo progresivo validado, `reset_admin_credentials.js` refactorizado sin argumentos CLI, cero secretos en repositorio. |
| **Censo de Servidores Públicos** | **PASS** | Conciliación matemática exacta (670 filas Excel vs 669 registros BD). Distinción semántica rigurosa entre personas naturales (625), vacantes (43) y agrupamientos de supervisores (1). |
| **Integridad de Horarios** | **PASS** | 135 acuerdos activos preservados con 0 huérfanos, 3 cédulas corregidas, eliminación definitiva de creación stub y validación de traslapes activa. |
| **Fechas de Viáticos (13 Registros)** | **PASS** | Fechas artificiales retiradas y persistidas como `NULL` en PostgreSQL con trazabilidad en observaciones. Importer corregido en frontend y backend sin valores por defecto. 12/12 unit tests aprobados. |
| **Matriz RBAC (47 Escenarios)** | **PASS** | 47 pruebas ejecutadas con datos válidos y códigos HTTP reales (201, 200, 403) verificadas contra PostgreSQL. Segregación estricta por módulo y consultas de solo lectura cross-module garantizadas. |
| **Exportación Excel y Filtros** | **PASS** | Descarga del 100% del universo filtrado (limit=10000), correspondencia exacta fila a fila contra PostgreSQL y sanitización CWE-1236. |
| **Viáticos Presupuestales (8.248 Registros)** | **PENDING INSTITUTIONAL CONFIRMATION** | La plataforma almacena y gestiona íntegramente los 8.248 registros por $1.882.517.569,50 COP. Sin embargo, la identidad física de los archivos 2022 y 2023 (`SHA256: 9E5761D7...`) constituye un hallazgo documental que requiere pronunciamiento formal de la Gobernación de Boyacá para determinar si se reemplaza el libro de 2022 o se consolida formalmente la vigencia. |

### Conclusión Final y Entrega
La plataforma **Talento 360** se entrega con datos fieles, sin fechas inventadas, con clasificación censal transparente, gobernanza de seguridad robustecida y trazabilidad completa.

Todo el trabajo permanece aislado y resguardado en la rama local **`audit/correccion-integridad-institucional`**, sin haberse realizado merges ni pushes hacia la rama `main` ni a servidores remotos, quedando a disposición de la comisión evaluadora institucional de la Gobernación de Boyacá.
