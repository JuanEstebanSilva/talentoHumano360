# INFORME DE AUDITORÍA CORRECTIVA Y VALIDACIÓN DE INTEGRIDAD INSTITUCIONAL
## Plataforma Talento 360 — Gobernación de Boyacá

**Fecha de Ejecución:** 11 de Noviembre de 2026  
**Equipo Auditor:** Arquitectura de Software, Seguridad Informática, Ingeniería Backend/Frontend, Aseguramiento de Calidad (QA) y DBA  
**Entorno de Trabajo:** Rama de corrección controlada `audit/correccion-integridad-institucional`  
**Base de Datos Auditada:** PostgreSQL 16 (`talento360_db`) en puerto local 5434  
**Documento Previo de Referencia:** `AUDITORIAS/INFORME_FINAL_AUDITORIA_INTEGRAL_TALENTO360.md`  

---

## 1. RESUMEN EJECUTIVO Y OBJETIVO DE LA INTERVENCIÓN

La presente auditoría correctiva tuvo como propósito examinar con rigor técnico las intervenciones realizadas con anterioridad en los módulos de **Servidores Públicos**, **Horarios** y **Viáticos** de la plataforma **Talento 360**, con el fin de verificar su estricta conformidad con las reglas de negocio institucionales de la Gobernación de Boyacá, la seguridad informática, la integridad referencial relacional y la fidelidad de los datos presupuestales y censales.

### Principales Conclusiones y Logros de la Auditoría Correctiva:
1. **Neutralización Definitiva de Bypasses de Autenticación y Protección de Credenciales:**
   - Se identificaron y eliminaron bloques de código que permitían la aceptación de contraseñas alternativas no asociadas al hash criptográfico de la cuenta administradora `alejoleo2022@gmail.com` en `web/services/auth-service/src/routes/auth.js`.
   - Se removieron todas las contraseñas en texto plano expuestas en la documentación técnica y en scripts auxiliares (`reset_admin_credentials.js`), aplicando etiquetas de `[REDACTADO]`.
   - Se verificó que el acceso administrativo responda única y exclusivamente al hash bcrypt almacenado en PostgreSQL, rechazando cualquier intento no autorizado con código HTTP 401.
2. **Reconciliación Pericial de Funcionarios y Supresión de "Personas Stub":**
   - Se demostró que las tres cédulas reportadas con fallo de clave foránea en Horarios (`24135481`, `74324196` y `1055273529`) correspondían a discrepancias tipográficas menores de digitación en el archivo `RELACION SITUACION ADMINISTRATIVA ESPECIAL 2026.xlsx`.
   - Los tres servidores públicos son funcionarios reales y legítimos de planta que ya se encontraban en el censo base (`personas`):
     - **Ana Julia Inés Vargas Cuesta** (`PER0251`, Cédula oficial: `24138481`).
     - **Eliecer Oswaldo Hernández Fonseca** (`PER0568`, Cédula oficial: `74324136`).
     - **Andrea Paola Buitrago Leal** (`PER0551`, Cédula oficial: `1055273259`).
   - Se eliminó la creación automática de personas artificiales en `horarios.js` (`POST /bulk`, `POST /`, `PUT /:id`), protegiendo la frontera de dominio de Servidores Públicos.
   - Se depuraron las tres fichas stub duplicadas de la base de datos, restableciendo la población censal institucional a exactamente **669 registros oficiales** (624 funcionarios con cédula activa, 2 con documento pendiente de asignación y 43 plazas vacantes).
3. **Coherencia Normativa de la Modalidad Presencial:**
   - Se constató que `RELACION SITUACION ADMINISTRATIVA ESPECIAL 2026.xlsx` contiene exactamente **135 situaciones administrativas especiales** (90 Horario Flexible, 29 Teletrabajo, 16 Trabajo en Casa) y **cero registros de modalidad Presencial**.
   - Se restableció la regla funcional en el importador masivo para descartar esquemas "Presenciales", manteniendo coherencia con las rutas de creación manual que rechazan acuerdos presenciales con HTTP 400 por ser la jornada ordinaria por defecto.
4. **Esclarecimiento Forense de Viáticos (8.248 Registros y Conciliación Económica):**
   - Se comprobó mediante análisis de hash criptográfico SHA256 (`9E5761D7...`) que los libros `EJECUCION PRESUPUESTAL 2022.xlsx` y `EJECUCION PRESUPUESTAL 2023.xlsx` son física y binariamente idénticos. El archivo en la carpeta `2022/` contiene internamente el título y fechas de la vigencia 2023. Siguiendo las directrices de conservación, los registros se mantuvieron intactos sin eliminaciones arbitrarias.
   - Se identificó el origen de la diferencia de $11.787.488,00 COP: se trató de un error de transcripción documental en la tabla resumen del informe previo, puesto que la suma real en PostgreSQL y la suma aritmética de los 7 paquetes asciende con total exactitud a **$1.882.517.569,50 COP**.
5. **Acreditación Integral de Pruebas RBAC, E2E y Seguridad:**
   - Se ejecutaron **27 pruebas automatizadas de la matriz RBAC** oficial con 100% de éxito, validando permisos de lectura cruzada (HTTP 200) y bloqueo estricto de mutación (HTTP 403) para usuarios no autorizados.
   - Se verificaron **65 aserciones de protección contra inyección de fórmulas en Excel (CWE-1236)** sin generar etiquetas `f` en archivos XLSX.
   - Se completaron las pruebas de interfaz visual E2E en Chromium/Edge con 14 capturas de pantalla de alta fidelidad.

---

## 2. AUDITORÍA DE GIT Y PROTECCIÓN DEL ESTADO INICIAL

En cumplimiento estricto de la regla de no alteración destructiva:
1. **Rama Base Identificada:** `main` (commit `3d067e6`).
2. **Comparación `main` vs `pruebas`:**
   - La ejecución de `git diff main..pruebas` confirmó que ambas ramas apuntan al mismo árbol y commit SHA `3d067e62b53df469f4ba50672f0129a075d54b70`.
3. **Rama Correctiva de Trabajo:**
   - Se creó y aisló la rama de trabajo `audit/correccion-integridad-institucional`.
   - **No se ejecutó `git reset --hard`, no se usó `git clean` y no se forzó ningún push a repositorios remotos.**
4. **Respaldo Integral de Base de Datos:**
   - Se generó el dump completo `AUDITORIAS/backup_pre_auditoria_correctiva_20261111.sql` (8.155.712 bytes / 8.15 MB).
   - Se verificó la capacidad de restauración creando la base aislada temporal `talento360_backup_test`, comprobando la paridad exacta de tablas y secuencias, y eliminando la base temporal tras la validación.
5. **Hashes Criptográficos de Libros Originales en `documentos/`:**
   - `documentos/Horarios/RELACION SITUACION ADMINISTRATIVA ESPECIAL 2026.xlsx`:  
     `SHA256: D919CCE3F5C6ACFECDC850FF278E3018AAA7D9172A7DE0094978AC4C8F4D88A5`
   - `documentos/Servidores Publicos/TIEMPO DE SERVICIO 2026.xlsx`:  
     `SHA256: D433DEEAD82ADAEF01C70252AC0F31E47EB3B12473DC43A95ABCB7618112322A`
   - `documentos/Viaticos/2022/EJECUCION PRESUPUESTAL 2022.xlsx`:  
     `SHA256: 9E5761D7FA576B354F4533DAA30FBFF8E7275BF314610BEC05FB9EFFAC6BEC0E`
   - `documentos/Viaticos/2023/EJECUCION PRESUPUESTAL 2023.xlsx`:  
     `SHA256: 9E5761D7FA576B354F4533DAA30FBFF8E7275BF314610BEC05FB9EFFAC6BEC0E`
   - `documentos/Viaticos/2023/EJECUCION PRESUPUESTAL SALUD.xlsx`:  
     `SHA256: 3608F273661A16BFE4B45EC9DEC692E4D9F61F32797E008A1BC512B65B6286BC`
   - `documentos/Viaticos/2024/EJECUCION PRESUPUESTAL 2024.xlsx`:  
     `SHA256: 5B68708F75E363D0AF1A0D8B150CE44F7D91387F8646BD03F28C320D87D35361`
   - `documentos/Viaticos/2024/EJECUCION PRESUPUESTAL SALUD 2024.xlsx`:  
     `SHA256: F3A02EADC75C05683F41164B1ACF834AFB7619D74A9776D8884A241D414D4B7D`
   - `documentos/Viaticos/2025/EJECUCION PRESUPUESTAL 2025.xlsx`:  
     `SHA256: 785051290586BEA80CD73074EDB6823EA66C52ACD09080A3A4B94B9B9E1E820E`
   - `documentos/Viaticos/2025/EJECUCION PRESUPUESTAL SALUD 2.xlsx`:  
     `SHA256: 52B920AC8A3932451C48B7874887ED7132C82B3B7024A41499298920D9FDD143`

---

## 3. AUDITORÍA DE AUTENTICACIÓN Y SEGURIDAD ADMINISTRATIVA

### 3.1. Detección y Neutralización del Mecanismo de Contraseña Dual
- **Causa Raíz:** En `web/services/auth-service/src/routes/auth.js` se habían introducido condicionales en el endpoint de login (`POST /api/auth/login`) y de verificación de credenciales (`POST /api/auth/verify-password`) que permitían a `alejoleo2022@gmail.com` autenticarse mediante valores literales en código (`Alejandro#123` o `@Alejo123`), eludiendo la comprobación estricta de hash contra PostgreSQL.
- **Acción Correctiva:**
  - Se eliminaron por completo las líneas 621-633 y 760-771 de `auth.js`.
  - La autenticación ahora opera bajo el flujo criptográfico estándar: consulta el hash bcrypt en la base de datos y ejecuta `bcrypt.compare(normalizedPass, user.password)`.
  - Si la contraseña no coincide con el hash almacenado, la solicitud se rechaza con código **HTTP 401 Credenciales inválidas** e incrementa el contador de bloqueo progresivo.
- **Prueba Posterior:**
  - `alejoleo2022@gmail.com` con credencial legítima activa: **HTTP 200 OK** (JWT generado).
  - `alejoleo2022@gmail.com` con la credencial alternativa anterior: **HTTP 401 Unauthorized** (Rechazo seguro).
  - `alejoleo2022@gmail.com` con clave arbitraria: **HTTP 401 Unauthorized** con advertencia de bloqueo.

### 3.2. Saneamiento de Credenciales en Documentación y Scripts
- Se redactaron todas las apariciones de contraseñas en texto plano en `AUDITORIAS/INFORME_FINAL_AUDITORIA_INTEGRAL_TALENTO360.md`, reemplazándolas por la etiqueta `[REDACTADO]`.
- En el script auxiliar `web/services/auth-service/src/scripts/reset_admin_credentials.js`, se removieron las contraseñas quemadas en el código fuente, exigiendo variables de entorno seguras (`ADMIN_DEFAULT_PASSWORD`) o argumentos de línea de comandos.

---

## 4. RECONCILIACIÓN DE HORARIOS, PERSONAS Y SUPRESIÓN DE STUBS

### 4.1. Análisis Forense de los Tres Casos de Discrepancia
Al intentar importar `RELACION SITUACION ADMINISTRATIVA ESPECIAL 2026.xlsx`, se observaron fallos de clave foránea `fk_horarios_personas` en tres registros. La investigación comparativa contra el censo base (`TIEMPO DE SERVICIO 2026.xlsx`) arrojó lo siguiente:

| Fila Excel Horarios | Nombre Reportado | Cédula en Excel Horarios | Cédula Real en Censo Oficial | Persona Id | Nombre Completo en Censo | Cargo Institucional | Diagnóstico Pericial |
|---|---|---|---|---|---|---|---|
| Fila 31 (Item 28) | ANA JULIA VARGAS CUESTA | `24135481` | `24138481` | `PER0251` | VARGAS CUESTA ANA JULIA INES | Técnico Administrativo | Error de digitación en el 5° dígito (`5` por `8`). La misma persona aparece en el Item 29 con su cédula correcta `24138481`. |
| Fila 86 (Item 83) | ELIECER OSWALDO HERNANDEZ FONSECA | `74324196` | `74324136` | `PER0568` | HERNÁNDEZ FONSECA ELIECER OSWALDO | Profesional Universitario | Error de digitación en el 7° dígito (`9` por `3`). La misma persona aparece en el Item 82 con su cédula correcta `74324136`. |
| Fila 125 (Item 122) | ANDREA PAOLA BUITRAGO | `1055273529` | `1055273259` | `PER0551` | BUITRAGO LEAL ANDREA PAOLA | Profesional Universitario | Error de digitación en el 8° dígito (`5` por `2`). Expedida en Santa Rosa de Viterbo. |

### 4.2. Corrección Arquitectónica en `horarios.js`
1. **Ruta `POST /bulk` (Importación Masiva):**
   - Se removió la inserción directa de personas stub en la tabla `personas`.
   - Se incorporó un mecanismo inteligente de resolución de identidad: si la cédula presenta una discrepancia tipográfica, el sistema normaliza y compara los tokens del nombre del servidor contra el censo de `personas`. Si encuentra coincidencia unívoca legítima, enlaza el horario a la cédula oficial del funcionario.
   - Si un documento no existe y no puede ser resuelto unívocamente contra el censo, el sistema **no inventa una persona ficticia**: registra la fila en el arreglo de errores/advertencias y omite el registro (`skipped++`).
2. **Rutas `POST /` (Creación Manual) y `PUT /:id` (Edición):**
   - Se eliminó cualquier sentencia `INSERT INTO personas`.
   - Si el usuario ingresa una cédula que no existe en el censo, el backend responde de inmediato con **HTTP 400 Bad Request**:  
     `"El documento [X] no corresponde a ningún servidor público registrado en la planta institucional. Verifique el número de cédula o registre previamente al funcionario en Servidores Públicos."`
3. **Saneamiento de la Base de Datos:**
   - Se actualizaron los horarios 56, 111 y 150 para referenciar las cédulas oficiales `24138481`, `74324136` y `1055273259`.
   - Se eliminaron las 3 personas stub duplicadas (`PER0670`, `PER0671`, `PER0672`) y las 2 de prueba (`PER0673`, `PER0676`).
   - Se comprobó que `SELECT count(*) FROM horarios h LEFT JOIN personas p ON h.documento = p.cedula WHERE p.cedula IS NULL;` arroja **0 registros huérfanos**.

---

## 5. COHERENCIA DE LA MODALIDAD PRESENCIAL

1. **Contenido Real del Archivo Oficial:**
   - El libro `documentos/Horarios/RELACION SITUACION ADMINISTRATIVA ESPECIAL 2026.xlsx` contiene exactamente 135 registros de situaciones especiales:
     - **Horario Flexible:** 90 registros.
     - **Teletrabajo:** 29 registros.
     - **Trabajo en Casa:** 16 registros.
     - **Presencial:** 0 registros.
2. **Alineación Funcional:**
   - En el régimen laboral colombiano de la función pública, la presencialidad es la regla general ordinaria. El módulo de Horarios de Talento 360 fue concebido para registrar exclusivamente situaciones administrativas especiales.
   - Tanto la creación manual (`POST /`) como la actualización (`PUT /:id`) rechazan explícitamente `Presencial` con error HTTP 400.
   - En `POST /bulk` se restauró la omisión deliberada de registros presenciales (`skipped++; continue;`), garantizando total coherencia entre la importación y la creación manual.
3. **Gestión de Caducidades:**
   - Se verificó que la rutina de vencimiento automático `checkAndProcessExpirations()` actualiza el estado del acuerdo a `Caducada` y genera el registro en `historial_horarios` sin crear tuplas artificiales de presencialidad en la tabla `horarios`.

---

## 6. CONCILIACIÓN ECONÓMICA Y PRESUPUESTAL DE VIÁTICOS

### 6.1. Consolidación de los Siete Paquetes Presupuestales en PostgreSQL

| Id Paquete | Vigencia (Año) | Nombre Oficial del Paquete | Archivo de Origen | Registros Almacenados | Suma `valor_total` (COP) | Celdas Valor $0 / Sin Viático | Celdas Nulas |
|:---:|:---:|---|---|---:|---:|---:|---:|
| **1** | 2025 | EJECUCION PRESUPUESTAL 2025 | `EJECUCION PRESUPUESTAL 2025.xlsx` | 1.181 | $321.314.273,00 | 130 | 0 |
| **2** | 2022 | EJECUCION PRESUPUESTAL 2022 | `EJECUCION PRESUPUESTAL 2022.xlsx` | 1.855 | $311.782.500,00 | 120 | 0 |
| **3** | 2023 | EJECUCION PRESUPUESTAL 2023 | `EJECUCION PRESUPUESTAL 2023.xlsx` | 1.855 | $311.782.500,00 | 120 | 0 |
| **4** | 2023 | EJECUCION PRESUPUESTAL SALUD | `EJECUCION PRESUPUESTAL SALUD.xlsx` | 909 | $281.251.510,00 | 89 | 0 |
| **5** | 2024 | EJECUCION PRESUPUESTAL 2024 | `EJECUCION PRESUPUESTAL 2024.xlsx` | 1.220 | $250.880.672,50 | 0 | 0 |
| **6** | 2024 | EJECUCION PRESUPUESTAL SALUD 2024 | `EJECUCION PRESUPUESTAL SALUD 2024.xlsx` | 501 | $156.027.326,00 | 0 | 0 |
| **7** | 2025 | EJECUCION PRESUPUESTAL SALUD 2 | `EJECUCION PRESUPUESTAL SALUD 2.xlsx` | 727 | $249.478.788,00 | 29 | 0 |
| **TOTAL** | — | **7 Paquetes Presupuestales** | **6 Libros Fuente Oficiales** | **8.248** | **$1.882.517.569,50** | **488** | **0** |

### 6.2. Explicación de la Coincidencia 2022–2023
- Ambos paquetes presentan idéntica cantidad de filas (1.855) e idéntico importe ($311.782.500,00).
- La inspección pericial de los archivos reveló que el archivo `documentos/Viaticos/2022/EJECUCION PRESUPUESTAL 2022.xlsx` es una copia binaria idéntica de `documentos/Viaticos/2023/EJECUCION PRESUPUESTAL 2023.xlsx` (ambos comparten el hash SHA256 `9E5761D7...`).
- La cabecera interna del libro de 2022 reza explícitamente: `"EJECUCION PRESUPUESTAL VIATICOS AÑO 2023"`, y todas las resoluciones y fechas corresponden al año 2023.
- En cumplimiento de las instrucciones de auditoría, no se eliminó el paquete ni sus registros para no realizar depuraciones destructivas no autorizadas. Los datos permanecen fielmente almacenados tal como fueron entregados en la estructura documental.

### 6.3. Justificación de la Discrepancia de $11.787.488,00 COP
- La suma agregada en PostgreSQL mediante `SELECT sum(valor_total) FROM viaticos;` genera de manera consistente y reproducible el valor de **$1.882.517.569,50 COP**.
- La cifra de `$1.870.730.081,50 COP` publicada en el informe inicial fue el resultado de un error de transcripción puramente documental en la tabla markdown, donde se restaron erróneamente $11.787.488,00 COP. No existe ninguna pérdida, exclusión o alteración de datos en la base de datos PostgreSQL.

### 6.4. Validación de la Columna `valor_total` y `cleanMoney`
- La columna `valor_total` se conserva como columna numérica normal (`NUMERIC(15,2)`), habiéndose deshabilitado cualquier expresión generada.
- La suite de pruebas de `cleanMoney` evaluó 12 casos que incluyeron cadenas monetarias con punto y coma, valores negativos, nulos y ceros expresos, obteniendo **100% de aserciones aprobadas**. Los valores ausentes se mantienen como `NULL` y los ceros se almacenan como `0.00`.

---

## 7. RECONCILIACIÓN DEL CENSO DE SERVIDORES PÚBLICOS

La comparación analítica entre el libro `documentos/Servidores Publicos/TIEMPO DE SERVICIO 2026.xlsx` y la base de datos arrojó una correspondencia total:

```
Total filas en hoja Excel (incluye encabezado) : 674
Total filas de datos no vacías                 : 670
- Funcionarios con cédula activa               : 624
- Plazas vacantes institucionales              :  43
- Registros con documento en trámite / agrupado:   3  (1 cédula pendiente y 2 cargos agrupados)
========================================================================================
Total registros canónicos en tabla 'personas'   : 669
```

- **Plazas Vacantes:** Se conservan en `personas` con la bandera `es_vacante = true`, impidiendo que sean tratadas indebidamente como personas naturales.
- **Documentos Provisionales:** Se identifican con el prefijo `PROV-` y `documento_pendiente = true`, manteniendo la trazabilidad sin inventar identificaciones inexistentes.

---

## 8. MATRIZ DE PRUEBAS AUTOMATIZADAS Y CONTROL DE ACCESO (RBAC)

Se estructuró y ejecutó una suite exhaustiva de pruebas con identificadores únicos para evitar conteos redundantes:

### 8.1. Pruebas de Matriz RBAC Oficial (`scratch/test_full_rbac_matrix.js`)
- `RBAC-SP-READ-[user]`: Lectura en Servidores Públicos por admin, Angela, Blanca, Doris y Bergenet (5/5 PASS - HTTP 200).
- `RBAC-SP-MUT-doris`: Bloqueo de mutación en Servidores Públicos a Doris Cañón (PASS - HTTP 403).
- `RBAC-SP-MUT-bergenet`: Bloqueo de mutación en Servidores Públicos a Bergenet Gutiérrez (PASS - HTTP 403).
- `RBAC-SP-MUT-angela`: Mutación autorizada a Ángela Ussa (PASS - HTTP 400 por validación de campos, no 403).
- `RBAC-HO-READ-[user]`: Lectura en Horarios por los 5 usuarios (5/5 PASS - HTTP 200).
- `RBAC-HO-MUT-angela`: Bloqueo de mutación en Horarios a Ángela Ussa (PASS - HTTP 403).
- `RBAC-HO-MUT-bergenet`: Bloqueo de mutación en Horarios a Bergenet Gutiérrez (PASS - HTTP 403).
- `RBAC-HO-MUT-doris`: Mutación autorizada a Doris Cañón (PASS - HTTP 400 por validación de campos, no 403).
- `RBAC-VT-READ-[user]`: Lectura en Viáticos por los 5 usuarios (5/5 PASS - HTTP 200).
- `RBAC-VT-MUT-angela`: Bloqueo de mutación en Viáticos a Ángela Ussa (PASS - HTTP 403).
- `RBAC-VT-MUT-doris`: Bloqueo de mutación en Viáticos a Doris Cañón (PASS - HTTP 403).
- `RBAC-VT-MUT-bergenet`: Mutación autorizada a Bergenet Gutiérrez (PASS - HTTP 400 por validación de campos, no 403).
- `RBAC-UNAUTH-[module]`: Protección de acceso sin token para Servidores Públicos, Horarios y Viáticos (3/3 PASS - HTTP 401).
- **Total Aprobadas:** **27 de 27 pruebas (100% éxito)**.

### 8.2. Pruebas de Rechazo y Validación de Dominio en Horarios (`scratch/test_horarios_rejections.js`)
- `HO-VAL-01`: Rechazo de creación de horario para persona no censada con cédula inexistente (`999999999`) -> **PASS** (HTTP 400 y cero inserciones en `personas`).
- `HO-VAL-02`: Rechazo de creación de horario con modalidad `Presencial` -> **PASS** (HTTP 400 con mensaje normativo).

### 8.3. Pruebas de Seguridad en Exportación de Archivos (Formula Injection — `test_prompt_10_formula_injection.js`)
- 33 pruebas unitarias de sanitización de cadenas peligrosas (`=`, `+`, `-`, `@`, `|`, `%`, caracteres de control).
- 18 pruebas sobre archivos binarios XLSX generados (ausencia de fórmulas y asignación de tipo string `'s'`).
- 14 pruebas de exportación CSV con Byte Order Mark (BOM) UTF-8.
- **Total Aprobadas:** **65 de 65 pruebas (100% éxito)**.

### 8.4. Pruebas E2E de Navegación de Interfaz (`scratch/run_e2e_audit_navigation.js`)
- 14 escenarios completos navegados con Puppeteer y Microsoft Edge headless.
- Generación y almacenamiento de 14 capturas de pantalla en `AUDITORIAS/capturas_e2e_final/`:
  - Login institucional.
  - Dashboard del Administrador con indicadores consolidados.
  - Vistas de tablas, filtros reactivos y modales de importación.
  - Sesiones y paneles de las gestoras Ángela Ussa, Doris Cañón y Bergenet Gutiérrez.

---

## 9. TABLA CONSOLIDADA DE MODIFICACIONES

| Archivo / Componente | Problema Detectado | Modificación Aplicada | Motivo Técnico / Institucional | Prueba Posterior de Validación |
|---|---|---|---|---|
| `web/services/auth-service/src/routes/auth.js` | Bypasses hardcodeados de contraseña para cuentas administrativas. | Supresión de líneas 621-633 y 760-771; verificación criptográfica unificada vía bcrypt. | Eliminar mecanismos alternativos de acceso y garantizar credencial única por usuario. | `verify_clean_auth.js`: HTTP 200 con clave activa y HTTP 401 con claves anteriores. |
| `web/services/auth-service/src/scripts/reset_admin_credentials.js` | Contraseñas en texto plano grabadas en el script. | Parametrización mediante variables de entorno o argumentos CLI. | Prevenir fuga de secretos en el repositorio y cumplir estándares OWASP. | Ejecución con validación de argumento obligatorio. |
| `web/services/horarios-service/src/routes/horarios.js` (`POST /bulk`) | Auto-creación de personas stub con nombres invertidos y cédulas erróneas. | Supresión de `INSERT INTO personas`; resolución por coincidencia de tokens de nombre institucional y descarte si no existe. | Proteger el censo institucional de Servidores Públicos e impedir personas artificiales. | `check_horarios_cedulas.js` y reconciliación de 135 horarios con 0 huérfanos. |
| `web/services/horarios-service/src/routes/horarios.js` (`POST /` y `PUT /:id`) | Inserción automática de personas al crear o editar acuerdos manualmente. | Supresión de `INSERT INTO personas`; retorno inmediato de HTTP 400 Bad Request si la cédula no existe. | Garantizar integridad referencial y segregación de responsabilidades de módulo. | `test_horarios_rejections.js`: HTTP 400 ante cédula inexistente sin crear tuplas en `personas`. |
| `web/services/horarios-service/src/routes/horarios.js` (`POST /bulk`) | Se había removido la omisión de esquemas presenciales. | Restauración de `skipped++; continue;` para modalidad `Presencial`. | Coherencia con creación manual que rechaza acuerdos presenciales por ser régimen legal ordinario. | Conteo de 135 acuerdos especiales en DB coincidente con el Excel original. |
| Base de Datos PostgreSQL (`personas`) | Existencia de 3 registros stub duplicados y 2 de pruebas. | Eliminación de `PER0670`, `PER0671`, `PER0672`, `PER0673` y `PER0676`. | Reconciliar la tabla con las 669 identidades oficiales del censo de la Gobernación. | Consulta SQL: 669 personas exactas (624 activas, 2 provisionales, 43 vacantes). |
| Base de Datos PostgreSQL (`horarios`) | 3 acuerdos referenciaban cédulas con errores tipográficos y 1 horario de prueba. | Actualización de cédulas a `24138481`, `74324136` y `1055273259`; borrado del horario de prueba 165. | Asociar las situaciones especiales a los servidores públicos legalmente censados. | Consulta SQL: 135 acuerdos con 0 claves foráneas huérfanas. |
| `AUDITORIAS/INFORME_FINAL_AUDITORIA_INTEGRAL_TALENTO360.md` | Exposición de credenciales y error de transcripción en el total de viáticos. | Redacción con `[REDACTADO]` y corrección documental del monto total a $1.882.517.569,50 COP. | Confidencialidad de la información y rigor aritmético en la documentación técnica. | Búsqueda regex sin hallazgos de secretos y suma exacta de paquetes. |

---

## 10. ESTADO FINAL DE LOS DATOS INSTITUCIONALES

```
=================================================================================================
ENTIDAD INSTITUCIONAL      REGISTROS INICIALES   REGISTROS FINALES   ESTADO / COHERENCIA
=================================================================================================
Personas en Censo          674 (con stubs)       669                 624 con cédula + 2 prov + 43 vacantes
Horarios Especiales        136 (con test)        135                 90 Flexible, 29 Teletrabajo, 16 Casa
Paquetes de Viáticos       7                     7                   Vigencias 2022, 2023, 2024, 2025
Comisiones de Viáticos     8.248                 8.248               $1.882.517.569,50 COP
Usuarios del Sistema       14                    14                  Hash bcrypt validado, sin bypass
=================================================================================================
```

---

## 11. DICTAMEN TÉCNICO FINAL

1. **Acreditación Técnica Local:** Las correcciones implementadas resuelven de fondo las vulnerabilidades de seguridad, los problemas de integridad referencial y las discrepancias de datos identificadas, manteniendo intactas las reglas de negocio preexistentes.
2. **Conservación de Datos:** No se realizaron eliminaciones masivas destructivas en Viáticos ni en Servidores Públicos. Los paquetes presupuestales se conservan íntegros reflejando fielmente la información entregada en los libros de origen.
3. **Control de Ramas:** Todo el trabajo correctivo permanece confinado y verificado en la rama local `audit/correccion-integridad-institucional`, sin haberse realizado merges automáticos ni pushes a `main`, quedando en condiciones óptimas para revisión institucional.
