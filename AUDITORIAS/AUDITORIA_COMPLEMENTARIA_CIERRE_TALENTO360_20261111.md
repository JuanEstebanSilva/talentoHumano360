# INFORME DE AUDITORÍA COMPLEMENTARIA Y CIERRE DE HALLAZGOS RESIDUALES — TALENTO 360
## Gobernación de Boyacá | Dirección de Talento Humano
**Fecha de Ejecución:** 11 de noviembre de 2026  
**Rama de Trabajo:** `audit/correccion-integridad-institucional`  
**Estado General de la Auditoría:** APROBADA SIN RESERVAS (100% DE PRUEBAS SUPERADAS: 148/148)  

---

## 1. RESUMEN EJECUTIVO Y METADATOS DE LA INTERVENCIÓN

En cumplimiento de las instrucciones de auditoría técnica y cierre de hallazgos residuales, el equipo multidisciplinario senior de ingeniería de software, arquitectura de bases de datos, seguridad informática y aseguramiento de calidad (QA) ejecutó una intervención exhaustiva y focalizada sobre el sistema **Talento 360**.

La intervención se estructuró en diez (10) frentes críticos de validación, garantizando la preservación estricta de la información preexistente, la eliminación definitiva de anomalías en el tratamiento de fechas y duraciones de comisiones de viáticos, la diferenciación taxonómica del censo de servidores públicos frente a agrupamientos técnicos institucionales, la verificación de blindaje contra ataques de fuerza bruta y enumeración de usuarios, la ejecución completa de una matriz RBAC de 58 pruebas, la neutralización de inyecciones de fórmulas (CWE-1236), la conciliación fila por fila entre exportaciones Excel y PostgreSQL, y la ratificación criptográfica del hallazgo documental de viáticos 2022-2023.

### Cuadro Consolidado de Baterías de Prueba

| Batería de Prueba | Módulo / Componente | Casos Evaluados | Exitosos | Fallidos | Tasa de Éxito |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Batería 1: Fechas y Duración** | Viáticos (Parser, Importador, Backend y BD) | 12 | 12 | 0 | **100.0%** |
| **Batería 2: Seguridad y Fuerza Bruta** | Auth Service (Lockout, Bcrypt, Enumeración) | 10 | 10 | 0 | **100.0%** |
| **Batería 3: Matriz RBAC Expandida** | Servidores, Horarios, Viáticos, Admin, Anónimo | 58 | 58 | 0 | **100.0%** |
| **Batería 4: Sanitización CWE-1236** | ExcelService (Inyección de Fórmulas SheetJS) | 33 | 33 | 0 | **100.0%** |
| **Batería 5: Filtros, Exportación e Integridad** | Censo, Horarios (135), Viáticos (8.248), FKs (17) | 35 | 35 | 0 | **100.0%** |
| **TOTAL CONSOLIDADO** | **Sistema Completo Talento 360** | **148** | **148** | **0** | **100.0%** |

---

## 2. RESPALDO PREVIO E INTEGRIDAD DE LA BASE DE DATOS

Previo a cualquier intervención en el esquema y en los registros de la base de datos relacional PostgreSQL, se generó un volcado físico y lógico completo del esquema `public`:

- **Archivo de Respaldo:** `AUDITORIAS/backup_complementaria_20261111.sql`
- **Tamaño del Archivo:** 8.528.257 bytes (8,13 MB)
- **Algoritmo Criptográfico:** SHA-256
- **Hash de Integridad:** `C5B2F5A0FF70D61864E204F265ED47DC46FFD83044A146D012B1C36588BF8C55`
- **Verificación:** Integridad confirmada; no se alteró la estructura preexistente salvo la relajación de restricciones innecesarias en `viaticos.dias`.

---

## 3. CORRECCIÓN DEFINITIVA DEL PARSER DE FECHAS Y DURACIÓN DE VIÁTICOS

### 3.1. Diagnóstico y Problema Residual
En auditorías previas se detectó que el parser frontend (`viaticos.js`) y las rutas backend de viáticos aplicaban un valor por defecto arbitrario (`dias: 1` o `|| 1`) cuando la cadena de fechas de la comisión no contenía fechas analizables y no existía una columna de duración en la fuente. Esto vulneraba el principio de fidelidad documental, asumiendo un día de viático en registros donde la duración real era desconocida. Asimismo, en la base de datos PostgreSQL, la columna `viaticos.dias` contaba con una restricción `NOT NULL DEFAULT 1`.

### 3.2. Acciones Correctivas Implementadas
1. **Modificación de Esquema PostgreSQL:**
   ```sql
   ALTER TABLE viaticos ALTER COLUMN dias DROP NOT NULL;
   ALTER TABLE viaticos ALTER COLUMN dias DROP DEFAULT;
   ```
2. **Conciliación de Datos Históricos:**
   Se identificaron exactamente 26 comisiones de viáticos (13 en el Paquete #2 de 2022 y 13 en el Paquete #3 de 2023) que tenían `fecha_inicio IS NULL` y que habían recibido `dias: 1` artificialmente. Se ejecutó una actualización dirigida estableciendo `dias = NULL` y registrando una traza auditable en `observaciones`:
   `[AUDITORIA 2026-11-11: dias corregido a NULL por ausencia de fecha/duracion en fuente original]`
3. **Refactorización del Parser Frontend (`web/frontend/src/js/modules/viaticos.js`):**
   - Se implementó la función estricta `isValidCalendarDate(d, m, y)`, la cual verifica la existencia real del día en el mes y año dados, evitando que desbordamientos de JavaScript conviertan fechas como `32/01/2023` en `01/02/2023` o `29/02/2023` (año no bisiesto) en `01/03/2023`.
   - Se eliminó el retorno forzado `dias: 1`. Ahora, si la fecha es vacía, nula o inválida y no existe duración explícita, retorna `dias: null, start: null, end: null`.
   - Si existe una columna de duración explícita en la hoja (ej. "Días", "Duración"), dicho valor se conserva fielmente (`parseInt(explicitDias, 10)`).
   - Nunca se inventan fechas como `today` ni `01/01/{año}`.
4. **Refactorización de Rutas Backend (`web/services/viaticos-service/src/routes/viaticos.js`):**
   - En `POST /`: `finalDias` se inicializa estrictamente en `null` si no se especifican fechas ni días explícitos.
   - En `PUT /:id`: se preserva el valor existente de `dias` sin forzar 1.
   - En `POST /bulk`: se eliminó el operador de coalescencia `parseInt(row.dias, 10) || 1`, admitiendo valores nulos.
5. **Ajuste de Renderizado UI:**
   - La tabla de viáticos visualiza un guion institucional em-dash (`—`) cuando `dias === null`.

### 3.3. Resultados de los 12 Casos de Prueba de Fechas y Duración (`test_viaticos_dates_and_duration_complete.js`)

| ID | Caso de Entrada | Comportamiento Esperado | Resultado Obtenido | Estado |
| :---: | :--- | :--- | :--- | :---: |
| **VD-01** | Cadena vacía `""` | `start: null, end: null, dias: null` | `start: null, end: null, dias: null` | ✅ PASS |
| **VD-02** | Rango válido `"15/03/2023 - 18/03/2023"` | `dias: 4, start: 15/03/2023, end: 18/03/2023` | `dias: 4, start: 15/03/2023, end: 18/03/2023` | ✅ PASS |
| **VD-03** | Fecha única `"20/05/2024"` | `dias: 1, start: 20/05/2024, end: 20/05/2024` | `dias: 1, start: 20/05/2024, end: 20/05/2024` | ✅ PASS |
| **VD-04** | Cadena corrupta `"FECHA NO REGISTRADA"` | `dias: null, start: null, end: null` | `dias: null, start: null, end: null` | ✅ PASS |
| **VD-05** | Cadena corrupta con duración explícita (5) | `dias: 5, start: null, end: null` | `dias: 5, start: null, end: null` | ✅ PASS |
| **VD-06** | Fecha imposible `"32/01/2023"` | Rechazo estricto: `dias: null, start: null` | `dias: null, start: null, end: null` | ✅ PASS |
| **VD-07** | Bisiesto inválido `"29/02/2023"` | Rechazo estricto: `dias: null, start: null` | `dias: null, start: null, end: null` | ✅ PASS |
| **VD-08** | Bisiesto válido `"29/02/2024"` | Aceptación: `dias: 1, start: 29/02/2024` | `dias: 1, start: 29/02/2024, end: 29/02/2024` | ✅ PASS |
| **VD-09** | Resolución con fecha `"RES 123 DEL 10/04/2023"` | `dias: 1, start: 10/04/2023` | `dias: 1, start: 10/04/2023, end: 10/04/2023` | ✅ PASS |
| **VD-10** | API POST sin fechas ni días | Persiste `dias: NULL, fecha_inicio: NULL` en BD | Persistido con `dias: null` (HTTP 201) | ✅ PASS |
| **VD-11** | API POST sin fechas pero días explícitos (7) | Persiste `dias: 7, fecha_inicio: NULL` en BD | Persistido con `dias: 7` (HTTP 201) | ✅ PASS |
| **VD-12** | API GET /api/viaticos (Consulta y Filtro) | Recupera registro creado con `dias: null` | Recuperado exactamente con `dias: null` | ✅ PASS |

---

## 4. TAXONOMÍA CENSAL Y DIFERENCIACIÓN INSTITUCIONAL (`PROV-00003`)

### 4.1. Fundamentación Técnica
El registro con identificación `PROV-00003` corresponde al **Agrupamiento Institucional de Supervisores de Educación**. No es una persona natural, sino una entidad técnica censal que consolida administrativamente dos (2) plazas o posiciones de supervisión de la Secretaría de Educación originadas en las fuentes documentales.

### 4.2. Correcciones en Autocompletado y API de Estadísticas
1. **Exclusión de Selección Individual (`employees.js`):**
   Se modificó la consulta del endpoint `/api/employees/autocomplete` para agregar el predicado `p.cedula != 'PROV-00003'`. Con esto se garantiza de forma absoluta que `PROV-00003` no pueda ser seleccionado erróneamente en formularios operativos como una persona física.
2. **Desagregación en el Dashboard (`dashboard.js`):**
   El endpoint `GET /api/dashboard/stats` se actualizó para devolver una taxonomía institucional transparente:
   - `totalRegistrosCensales`: **669** (total de registros en la tabla `personas` de PostgreSQL).
   - `personasNaturales`: **625** (funcionarios activos identificados como personas físicas individuales).
   - `vacantes`: **43** (plazas vacantes reportadas por la planta institucional).
   - `agrupados`: **1** (`PROV-00003` - Agrupamiento de Supervisores de Educación).
   - `posicionesAgrupadas`: **2** (número de posiciones que representa el agrupamiento).
   - `posicionesFuente`: **670** (total de cargos y plazas físicas representadas en la documentación fuente: 625 + 43 + 2 = 670).

---

## 5. SEGURIDAD, GESTIÓN DE CREDENCIALES Y CONTROL DE FUERZA BRUTA

### 5.1. Estado de la Rotación de Credenciales de Administración
- Se verificó que el script de utilidad administrativa `scratch/reset_admin_credentials.js` fue asegurado para solicitar la clave de forma interactiva y silenciosa por consola (TTY), con validación estricta de complejidad (mínimo 10 caracteres, mayúsculas, minúsculas, números y caracteres especiales), eliminando cualquier riesgo de exposición en el historial de comandos (`bash_history` / `PSReadLine`).
- **Trazabilidad Institucional:** Por motivos de gobernanza y respeto a las directrices de seguridad, no se modificó la credencial de producción del usuario administrador definitivo (`alejoleo2022@gmail.com`), ya que cualquier rotación formal de credenciales administrativas debe ser coordinada mediante una ceremonia oficial por parte de la Dirección de TI de la Gobernación de Boyacá.

### 5.2. Bloqueo Progresivo contra Fuerza Bruta (Brute-Force Lockout)
Se evaluó el middleware de seguridad en `web/services/auth-service/src/routes/auth.js` ejecutando la batería automatizada `test_security_brute_force_lockout.js`:
- **Intentos Permitidos:** 5 intentos fallidos consecutivos devuelven código `401 Unauthorized` indicando el número de intentos restantes.
- **Bloqueo al 6to Intento:** Al registrarse el 6to intento fallido, el sistema responde inmediatamente con `429 Too Many Requests` y bloquea la cuenta durante **1 minuto** (60 segundos).
- **Escalamiento Progresivo:** Intentos fallidos posteriores incrementan el bloqueo a 2 minutos y hasta un tope máximo seguro de **4 minutos** (240 segundos).
- **Reseteo Automático:** Al ingresar una credencial válida tras vencer el bloqueo, el contador de intentos fallidos se restablece a cero (0) de inmediato.
- **Mitigación de Enumeración de Usuarios (Timing Attacks):** Cuando se solicita autenticación para un usuario inexistente en el sistema, el backend ejecuta una comparación simulada con un hash bcrypt precalculado (`DUMMY_BCRYPT_HASH`), neutralizando ataques de canal lateral basados en tiempos de respuesta.
- **Inspección de Secretos:** Se ejecutó un escaneo recursivo mediante `scratch/scan_repo_secrets.js` sobre los archivos del repositorio y el historial de Git, confirmando **cero (0) claves o secretos expuestos en texto plano** (todos preservan formato de entorno o `[REDACTADO]`).

---

## 6. MATRIZ RBAC EXPANDIDA (58 PRUEBAS DE CONTROL DE ACCESO)

Se desarrolló y ejecutó el script `scratch/test_rbac_expanded_full_matrix.js`, evaluando la totalidad de perfiles institucionales frente a operaciones CRUD, transiciones de estado (`PATCH status`), importaciones masivas (`/bulk`, `/importar-excel`), accesos cruzados prohibidos y peticiones anónimas/malformadas.

### Resumen de Cumplimiento por Perfil

| Perfil Evaluado | Identidad Institucional | Operaciones CRUD en Módulo Asignado | Intentos de Escritura Cruzada (Horarios / Viáticos / Servidores) | Tasa de Aprobación |
| :--- | :--- | :---: | :---: | :---: |
| **Ángela Ussa** | `angela.ussa@boyaca.gov.co` | Servidores Públicos: POST (201), GET (200), PUT (200), PATCH Status (200), DELETE (200) | Bloqueados con 403 Forbidden (Horarios POST/Bulk, Viáticos POST/Bulk). Lectura permitida (GET 200). | **11 / 11 (100%)** |
| **Blanca Soler** | `blanca.soler@boyaca.gov.co` | Servidores Públicos: POST (201), GET (200), PUT (200), PATCH Status (200), DELETE (200) | Bloqueados con 403 Forbidden (Horarios POST, Viáticos POST). Lectura permitida (GET 200). | **7 / 7 (100%)** |
| **Doris Cañón** | `doris.canon@boyaca.gov.co` | Horarios: POST (201), GET (200), PUT (200), PATCH Status (200), Bulk (200), DELETE (200) | Bloqueados con 403 Forbidden (Servidores POST/Import, Viáticos POST/Bulk). Lectura permitida (GET 200). | **12 / 12 (100%)** |
| **Bergenet Gutiérrez**| `bergenet.gutierrez@boyaca.gov.co`| Viáticos: POST (201), GET (200), PUT (200), PATCH Status (200), Bulk (200), DELETE (200) | Bloqueados con 403 Forbidden (Servidores POST/Import, Horarios POST/Bulk). Lectura permitida (GET 200). | **12 / 12 (100%)** |
| **Administrador** | `alejoleo2022@gmail.com` | Acceso global completo en los 3 módulos: POST (201), PUT (200), PATCH Status (200), DELETE (200) | Autorizado globalmente en todos los endpoints institucionales. | **10 / 10 (100%)** |
| **Anónimo / Corrupto**| Sin Token / Bearer Falsificado | Rechazo inmediato en todas las rutas protegidas | 100% de peticiones bloqueadas con código `401 Unauthorized`. | **6 / 6 (100%)** |
| **TOTAL RBAC** | **58 Casos de Prueba** | **Todas las operaciones CRUD verificadas contra PostgreSQL** | **Cero brechas de seguridad o escalada de privilegios** | **58 / 58 (100%)** |

---

## 7. SANITIZACIÓN CONTRA INYECCIÓN DE FÓRMULAS (CWE-1236)

En el servicio unificado `web/frontend/src/js/modules/excel-service.js` se validó el motor de sanitización mediante `scratch/test_formula_sanitization_cwe1236.js`:
- **Neutralización de Disparadores Maliciosos:** Toda celda de texto que comience con `=`, `+`, `-`, `@`, `|`, `%` o caracteres de control (`\t`, `\r`, `\n`) es neutralizada anteponiendo el apóstrofe `'`, forzando a suites ofimáticas (Microsoft Excel, LibreOffice Calc) a interpretar el contenido como texto plano literal.
- **Preservación de Datos Numéricos y Financieros:** Se comprobó que los tipos `number` nativos (ej. `-1500`, `-3.14159`, `3500000`), las cadenas que representan valores negativos legítimos (ej. `"-1500"`, `"- 1500.50"`), las cifras de moneda (`$3.500.000`), las fechas estándar (`2026-03-01`, `01/03/2026`) y los códigos institucionales (`PROV-00003`, `VIT-2026-0001`, `RES-0012`) **no sufren alteración ni corrupción**.
- **Limpieza de Celdas SheetJS (`cleanWorksheetCells`):** Se eliminan sistemáticamente las propiedades de fórmula `.f` en todas las celdas y se asigna el tipo correcto (`s`, `n`, `b`, `d`).
- **Resultado:** **33 de 33 pruebas superadas (100.0%)**.

---

## 8. EXPORTACIÓN EXCEL, FILTROS Y PAGINACIÓN

Mediante `scratch/test_complete_audit_filters_templates_and_exports.js` se comprobó la correspondencia unívoca entre la interfaz de usuario, los endpoints de la API y el motor relacional PostgreSQL:
1. **Servidores Públicos:**
   - La consulta de censo total devuelve **669 registros** tanto en la API como en PostgreSQL (`SELECT COUNT(*) FROM personas`).
   - El filtro por Dependencia (ej. mayoritaria con 52 servidores) entrega 5 registros en la página 1 (`limit=5`), reporta un total de 52 en la paginación y exporta exactamente **52 registros** con `limit=10000`.
   - La búsqueda de texto filtra con precisión funcionarios por cédula o apellido.
2. **Horarios y Modalidades Especiales:**
   - El universo de acuerdos especiales es exactamente de **135 registros**, coincidiendo en el endpoint paginado y en la exportación total.
   - Desglose por modalidad validado al 100%:
     - **Horario flexible:** 90 acuerdos.
     - **Teletrabajo:** 29 acuerdos.
     - **Trabajo en casa:** 16 acuerdos.
     - **Presencial:** 0 acuerdos (la presencialidad ordinaria no es un acuerdo especial y está expresamente bloqueada).
3. **Viáticos:**
   - Universo consolidado de **8.248 comisiones de viáticos** distribuidas en siete (7) paquetes activos con información:
     - Paquete #1 (2025): 1.181 registros.
     - Paquete #2 (2022): 1.855 registros.
     - Paquete #3 (2023): 1.855 registros.
     - Paquete #4 (Salud 2023): 909 registros.
     - Paquete #5 (2024): 1.220 registros.
     - Paquete #6 (Salud 2024): 501 registros.
     - Paquete #7 (Salud 2 2025): 727 registros.
   - Paquetes #8 y #9 corresponden a carpetas de trabajo 2026 inicializadas (0 registros).
   - Los filtros por paquete, año y dependencia reflejan con exactitud matemática el conteo de PostgreSQL.
4. **Plantillas Oficiales:**
   - Servidores Públicos: 39 columnas oficiales.
   - Horarios: 14 columnas oficiales.
   - Viáticos: 15 columnas oficiales.

---

## 9. INVENTARIO DE CLAVES FORÁNEAS E INTEGRIDAD REFERENCIAL

Se realizó una inspección a través de `information_schema.table_constraints`, constatando la existencia y operación activa de **17 Foreign Keys** en el esquema `public`:

1. `divipola_asentamientos.codigo_mpio` ➔ `divipola.codigo_mpio` (`ON UPDATE CASCADE, ON DELETE RESTRICT`)
2. `documentos_institucionales_versiones.id_documento` ➔ `documentos_institucionales.id_documento` (`ON DELETE CASCADE`)
3. `historial_horarios.id_horario` ➔ `horarios.id_horario` (`ON DELETE CASCADE`)
4. `historial_solicitudes.id_vacacion` ➔ `vacaciones.id_vacacion` (`ON DELETE CASCADE`)
5. `historial_solicitudes_admin.id_solicitud` ➔ `solicitudes_admin.id_solicitud` (`ON DELETE CASCADE`)
6. `historial_viaticos.id_viatico` ➔ `viaticos.id_viatico` (`ON DELETE CASCADE`)
7. `horarios.documento` ➔ `personas.cedula` (`ON UPDATE CASCADE, ON DELETE RESTRICT`)
8. `rel_principal.id_cargo_actual` ➔ `cargos.id_cargo`
9. `rel_principal.id_cargo_base` ➔ `cargos.id_cargo`
10. `rel_principal.id_contacto` ➔ `contactos.id_contacto`
11. `rel_principal.id_dependencia` ➔ `dependencias.id_dependencia`
12. `rel_principal.id_educacion` ➔ `educacion.id_educacion`
13. `rel_principal.id_estado` ➔ `estados.id_estado`
14. `rel_principal.id_persona` ➔ `personas.id_persona`
15. `solicitudes_admin_soportes.id_solicitud` ➔ `solicitudes_admin.id_solicitud` (`ON DELETE CASCADE`)
16. `viaticos.documento` ➔ `personas.cedula` (`ON UPDATE CASCADE, ON DELETE RESTRICT`)
17. `viaticos.id_paquete` ➔ `paquetes_viaticos.id_paquete` (`ON DELETE CASCADE`)

### Verificación de Huérfanos
- **Horarios:** 0 registros huérfanos.
- **Viáticos (`documento NOT NULL`):** 0 registros huérfanos.
- **Viáticos (`documento IS NULL`):** 1.620 registros históricos sin documento de identidad en la planilla original (comportamiento admitido bajo la norma SQL-92).
- **Paquetes de Viáticos:** 0 registros huérfanos.
- **Relaciones Principales (`rel_principal`):** 0 registros huérfanos.
- **Historial de Viáticos:** 0 registros huérfanos.

---

## 10. HALLAZGO DOCUMENTAL DE VIÁTICOS (EVIDENCIA CRIPTOGRÁFICA)

Se comprobó la identidad física y binaria entre los dos archivos fuente de viáticos proporcionados por la entidad territorial para los años 2022 y 2023:

- **Archivo 1:** `documentos/Viaticos/2022/EJECUCION PRESUPUESTAL 2022.xlsx`  
  **Hash SHA-256:** `9e5761d7fa576b354f4533daa30fbff8e7275bf314610bec05fb9effac6bec0e`
- **Archivo 2:** `documentos/Viaticos/2023/EJECUCION PRESUPUESTAL 2023.xlsx`  
  **Hash SHA-256:** `9e5761d7fa576b354f4533daa30fbff8e7275bf314610bec05fb9effac6bec0e`

**Dictamen:** Ambos archivos son idénticos bit por bit. El sistema Talento 360 preserva ambos paquetes de forma independiente para respetar la estructura de carpetas institucionales solicitada por el usuario, dejando constancia de que los 1.855 registros de 2022 y los 1.855 registros de 2023 provienen de un mismo documento fuente duplicado en origen.

---

## 11. VEREDICTO FINAL Y CONTROL DE CAMBIOS

El sistema **Talento 360** se encuentra en estado **100% OPERATIVO, ROBUSTO Y AUDITADO**. Todos los hallazgos residuales han sido solventados y verificados con pruebas automatizadas en condiciones reales.

- **Rama de Trabajo:** `audit/correccion-integridad-institucional`
- **Compromiso Git:** Se mantendrán todos los cambios confirmados localmente en esta rama. De conformidad con las directrices expresas, **no se realiza push a servidores remotos ni merge sobre la rama `main`**.
