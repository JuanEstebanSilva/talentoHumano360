# 04. RESULTADOS DETALLADOS DE PRUEBAS AUTOMATIZADAS Y MANUALES
## Registro de Baterías de Pruebas de Integración, Rendimiento y Regresión

---

### 1. ALCANCE DE LA VERIFICACIÓN EXPERIMENTAL

La auditoría final ejecutó **421 pruebas técnicas automatizadas** y verificaciones dinámicas en vivo contra el entorno de contenedores Docker y PostgreSQL.

---

### 2. RESUMEN DE EJECUCIÓN POR SUITE DE PRUEBA

| Suite de Prueba Ejecutada | Archivo de Prueba | Aserciones Totales | PASS | FAIL | N/A | Tasa de Éxito |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Control de Acceso Institucional RBAC** | `test_audit5_matrix.js` | 35 | 35 | 0 | 0 | **100.0%** |
| **Ciberseguridad y Fuzzing OWASP** | `security_audit_suite.js` | 59 | 59 | 0 | 0 | **100.0%** |
| **Ciclo de Vida de Acciones Operativas** | `test_complete_lifecycle_actions.js` | 39 | 39 | 0 | 0 | **100.0%** |
| **Manejo de Fechas y `safe_parse_date`** | `test_prompt_01_dates.js` | 24 | 22 | 0 | 2 | **100.0%** |
| **Concurrencia e Identificadores `REL`** | `test_prompt_02_concurrency.js` | 15 | 15 | 0 | 0 | **100.0%** |
| **Importación Masiva Excel y Tolerancia**| `test_prompt_03_excel_import.js` | 24 | 24 | 0 | 0 | **100.0%** |
| **Integridad Referencial y Antecedentes** | `test_prompt_04_referential_integrity.js` | 23 | 23 | 0 | 0 | **100.0%** |
| **Horarios Laborales y Cero Presencial** | `test_prompt_05_horarios_module.js` | 26 | 26 | 0 | 0 | **100.0%** |
| **Geografía DIVIPOLA Boyacá (123 Mpios)** | `test_prompt_06_divipola.js` | 27 | 27 | 0 | 0 | **100.0%** |
| **Ciclo de Vida de Viáticos y Estados** | `test_prompt_08_lifecycle.js` | 43 | 43 | 0 | 0 | **100.0%** |
| **Protección Formula Injection (CWE-1236)**| `test_prompt_10_formula_injection.js` | 65 | 65 | 0 | 0 | **100.0%** |
| **Secretos JWT y Preservación de Formulario**| `test_prompt_11_auth_secrets_drafts.js` | 19 | 19 | 0 | 0 | **100.0%** |
| **Consola de Errores, IP Real y Backups** | `test_prompt_12_admin_backups_errors.js` | 22 | 22 | 0 | 0 | **100.0%** |
| **Consolidado General de Auditoría** | **13 Suites Evaluadas** | **421** | **419** | **0** | **2** | **99.5%** |

---

### 3. DESGLOSE TÉCNICO DE LAS PRUEBAS PRINCIPALES

#### 3.1. Prueba de Fuzzing de Inyección SQL (Módulo 3 de `security_audit_suite.js`)
- **Objetivo:** Garantizar que ninguna entrada de usuario en búsquedas, autocompletar o filtros pueda alterar el plan de ejecución de PostgreSQL.
- **Vectores probados en endpoints:**
  - `admin'--`
  - `' OR '1'='1`
  - `' OR 1=1 --`
  - `1; SELECT pg_sleep(5); --`
  - `' UNION SELECT null, null, null --`
  - `\" OR \"\"=\"`
  - `') OR ('1'='1`
  - `'; DROP TABLE temp_test; --`
- **Resultados:** 0 excepciones SQL, 0 caídas del servidor Node.js, tiempo medio de respuesta: 18 ms. **Dictamen: Aprobado (Inmune).**

#### 3.2. Prueba de Inyección de Fórmulas en Excel y CSV (`test_prompt_10_formula_injection.js`)
- **Objetivo:** Verificar que fórmulas dinámicas no se ejecuten al abrir los reportes en Microsoft Excel para Windows (CWE-1236).
- **Vectores evaluados:** `=SUMA(1+1)`, `+cmd|' /C calc'!A0`, `-2+5`, `@SUMA(...)`, `|cmd`, `%calc`, cadenas con tabulaciones iniciales (`\t`) y espacios en blanco.
- **Resultados:**
  - En archivos binarios `.xlsx`: Cero celdas serializadas con tipo fórmula (`f`). Todas las entradas peligrosas son prefijadas con apóstrofe y almacenadas como cadenas de texto plano (`s`).
  - En archivos `.csv`: Inclusión del preámbulo UTF-8 BOM (`\uFEFF`) y comilla desarmadora. Números negativos nativos (p. ej. `-1500` o `-3.14`) no se alteran, conservando el tipo numérico legítimo.

#### 3.3. Prueba de Concurrencia y Carrera en Identificadores (`test_prompt_02_concurrency.js`)
- **Objetivo:** Evaluar si 20 peticiones simultáneas de registro de servidores generan identificadores duplicados.
- **Resultados:**
  - 20 solicitudes concurrentes procesadas con HTTP 201 Created.
  - Conjunto de 20 identificadores `REL` con tamaño 20 (cero duplicaciones).

#### 3.4. Prueba de Protección de Datos Históricos (`test_prompt_04_referential_integrity.js`)
- **Objetivo:** Validar que un funcionario con antecedentes no pueda ser borrado por accidente.
- **Acción:** Intento de invocar `DELETE /api/employees/:cedula` sobre un servidor con viáticos y horarios.
- **Resultado:** Backend retorna **HTTP 409 Conflict**. El registro en `personas` permanece intacto en PostgreSQL.

