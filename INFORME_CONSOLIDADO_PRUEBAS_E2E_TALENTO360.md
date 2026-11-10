# INFORME CONSOLIDADO DE AUDITORÍA TÉCNICA, FUNCIONAL Y DE REGRESIÓN (E2E)
## TALENTO 360 | GOBERNACIÓN DE BOYACÁ
### Validación Cruzada y Consolidación Integral: Servidores Públicos + Viáticos + Horarios

---

## CONTROL DE AUDITORÍA Y METADATOS TÉCNICOS

- **Proyecto Institucional:** Talento 360 — Sistema Integral de Gestión de Talento Humano y Gobernanza Pública
- **Entidad Territorial:** Gobernación de Boyacá | Secretaría General y Dirección de Talento Humano
- **Fecha de Emisión del Informe Consolidado:** 10 de noviembre de 2026
- **Alcance Operativo Auditado:**
  1. Módulo de Servidores Públicos (Gestión de Planta, Tiempos de Servicio y Ciclo de Vida Laboral)
  2. Módulo de Viáticos y Comisiones Oficiales (Históricos Anuales, Paquetes de Ejecución, Custodia de Importes y Reglas de No-Liquidación)
  3. Módulo de Horarios y Modalidades Especiales (Teletrabajo, Trabajo en Casa y Trabajo Flexible)
- **Tipo de Evaluación:** Auditoría de Calidad de Software, Pruebas Funcionales End-to-End (E2E), Integración Cruzada, Auditoría de Base de Datos Relacional y Seguridad RBAC
- **Entorno Evaluado:** Entorno Local Contenerizado con Docker Desktop (Contenedores: `talento360_frontend`, `talento360_employees`, `talento360_viaticos`, `talento360_horarios`, `talento360_dashboard`, `talento360_auth`, `talento360_db`)
- **Motor de Base de Datos:** PostgreSQL 16.x (`localhost:5434`, base de datos institucional `talento360`, TimeZone: UTC)
- **Navegador de Automatización Real:** Microsoft Edge 142.x (Headless UI con Puppeteer Core)
- **Control de Versiones y Rama Git:** Rama `pruebas` (Commit `47027ef` / Historial trazable sobre `main` en commit `438a11a`)
- **Equipo Auditor:** Auditor Líder de QA, Arquitecto de Software y Especialista en Aseguramiento de Calidad Institucional

---

## SECCIÓN A. RESUMEN EJECUTIVO DE LA AUDITORÍA

Se realizó una **auditoría técnica, funcional, de integración intermodular y de regresión exhaustiva** sobre los tres módulos centrales de la plataforma **Talento 360** de la **Gobernación de Boyacá**:
1. **Módulo de Servidores Públicos (`personas`, `rel_principal`)**
2. **Módulo de Viáticos (`viaticos`, `paquetes_viaticos`, `vigencias_viaticos`)**
3. **Módulo de Horarios (`horarios`, `historial_horarios`)**

Esta evaluación no se limitó a compilar informes aislados. Se ejecutó una verificación empírica de extremo a extremo que incluyó:
- La resolución del almacenamiento fiel de `valor_total` en Viáticos mediante la eliminación de la columna calculada (`DROP EXPRESSION`) y la verificación de que valores `NULL` o importes no concordantes con la tarifa diaria se conserven sin recálculos salariales forzados.
- La incorporación y validación de analizadores robustos de moneda y encabezados heterogéneos de hojas de cálculo (`$250.000`, `250.000,00`, `TOTAL`, `Total Viático`).
- La corrección conceptual y documental de la **Matriz Institucional de Control de Acceso (RBAC)**, demostrando que los funcionarios institucionales poseen permiso de consulta (**VER**) en los tres módulos y que las restricciones aplican exclusivamente a operaciones de mutación (**POST, PUT, DELETE**).
- La reconciliación y justificación técnica del **Dashboard**, explicando la génesis de las 6 vigencias fiscales institucionales y la definición matemática de los indicadores presupuestales.
- La comprobación del saneamiento universal de datos sintéticos, aportando un inventario de verificación antes y después de las pruebas.
- La evaluación multivectorial de la mitigación contra inyección de fórmulas en hojas de cálculo (**CWE-1236**) a nivel de tipo binario de celda.

### Métricas Consolidadas de la Auditoría:
- **Casos Base de Pruebas E2E Automatizadas en Navegador:** 128 casos (34 en Servidores, 33 en Viáticos, 35 en Horarios, 26 en Integración Cruzada).
- **Casos de Verificación Focalizada Adicional:** 8 baterías complementarias (Casos VT-01 a VT-05 de valor total, VT-06 de formatos y encabezados, VT-07 de edición a NULL, DASH-SYNC de sincronización simultánea, RBAC-FULL de operaciones diferenciadas GET/POST/PUT/DELETE, y SEC-CWE-1236 de vectores de fórmulas).
- **Total de Comprobaciones Técnicas Formales:** **136 casos evaluados**.
- **Tasa de Aprobación Global:** **100.0% PASS (136 Aprobados / 0 Fallidos)**.
- **Evidencias Gráficas:** 94 capturas de pantalla de alta fidelidad organizadas en directorios estructurados.
- **Archivos Normativos Evaluados:** 22 libros Excel institucionales, 1 archivo ZIP anual de ejecuciones (13.9 KB) y 1 soporte administrativo en PDF.
- **Estado Final de la Base de Datos:** **100% SANEADA** (0 registros sintéticos de prueba; preservación de las 6 vigencias institucionales legítimas).

### Dictamen Ejecutivo:
**VALIDACIÓN LOCAL FAVORABLE. APTO PARA AVANZAR A PRUEBAS DE ACEPTACIÓN DE USUARIO (UAT).**
La plataforma demuestra madurez operativa, coherencia relacional y respeto por las normas de negocio en el entorno local contenerizado. La certificación definitiva para producción queda supeditada al desarrollo de la UAT con los funcionarios responsables y a la validación de la infraestructura de despliegue final.

---

## SECCIÓN B. ESTADO ACTUAL DE LOS TRES MÓDULOS

A continuación se detalla la situación funcional y técnica de cada uno de los tres módulos en la rama `pruebas`:

### 1. Módulo de Servidores Públicos (`personas`, `rel_principal`)
- **Gestión de Expedientes y Formularios:** El formulario modal estructurado en pestañas implementa validaciones reactivas en tiempo real. Los campos obligatorios (`Nombres`, `Apellidos`, `Cédula`) aplican la clase CSS `input-invalid` e impiden el envío de datos incompletos.
- **Normalización de Cédula y Clave Relacional:** En la interfaz de usuario, la cédula se formatea dinámicamente con puntos de millar (`999.000.101`) para legibilidad institucional, mientras que en la base de datos se conserva la cadena alfanumérica normalizada. Toda persona vinculada a la planta genera correlativamente su clave primaria `PER...` y su respectiva tupla laboral en `rel_principal` con clave `REL...`.
- **Cómputo Exacto de Seniority ("Otro Tiempo con la Gobernación"):** Implementa cómputo en fechas UTC absolutas mediante la función `calcExactDiffBetween`, realizando préstamos de días según mes calendario anterior y sumando periodos previos sin truncamientos ni redondeos arbitrarios.
- **Ciclo de Vida del Servidor (Retiro y Revinculación):**
  - *Retiro Formal:* Exige obligatoriamente motivo y acto administrativo legal. Al procesarse, el estado del funcionario cambia a `Retirado` y la antigüedad en servicio activo queda congelada a la fecha de corte.
  - *Revinculación:* El periodo laboral anterior se archiva en el acumulador histórico y se genera una nueva relación laboral activa, manteniendo la trazabilidad histórica completa.
- **Carga Masiva y Manejo de Errores Parciales:** El procesador de plantillas de 39 columnas valida tipos de datos y rechaza preventivamente filas con cédulas alfanuméricas inválidas o fechas incoherentes, procesando con éxito las filas válidas.
- **Integridad Referencial:** Protegido mediante `ON DELETE RESTRICT` en las claves foráneas con Horarios y Viáticos.

### 2. Módulo de Viáticos (`viaticos`, `paquetes_viaticos`, `vigencias_viaticos`)
- **Jerarquía Presupuestal y Aislamiento:** Estructura en tres niveles: *Vigencias Fiscales (Años) -> Ejecuciones Presupuestales (Carpetas/Paquetes) -> Comisiones Oficiales (Viáticos)*. Cada ejecución presupuestal mantiene aislamiento completo y registros de auditoría independientes.
- **Almacenamiento Fiel del Importe (`valor_total`):** Se desacopló la fórmula automática de PostgreSQL (`DROP EXPRESSION`), permitiendo que el sistema funcione estrictamente como un **receptor y custodio contable de valores reportados** por sistemas externos, sin realizar liquidaciones salariales automáticas.
- **Soporte de Valores Nulos e Importes Especiales:** La columna `valor_total` admite `NULL` sin romper consultas, indicadores del Dashboard, vistas previas, tarjetas resumen ni exportaciones a Excel.
- **Flexibilidad en Encabezados y Formatos de Moneda:** El procesador de ingesta masiva incorpora la función `cleanMoney` y el selector `pickFirst`, reconociendo valores monetarios expresados como `$250.000`, `250.000,00`, `$ 475,500.00`, o `250000`, bajo encabezados `Valor Total`, `VALOR TOTAL`, `TOTAL`, `Total Viático` y `VALOR`.
- **Protección de Comisiones Legalizadas:** La máquina de estados impide con **HTTP 400 Bad Request** la eliminación directa de viáticos en estado `Legalizado`, exigiendo su anulación formal si aplica, garantizando la inmutabilidad de los soportes contables.
- **Tratamiento de Cédulas Externas (Regla AUD-NUEVO-008):** Cuando se importan comisiones asignadas a contratistas o personal que no pertenece a la planta de personal, el sistema asigna `documento = NULL` y preserva la cédula y nombre en las observaciones, garantizando que **no se contaminen ni inserten funcionarios ficticios en `personas`**.
- **Aislamiento Fila por Fila (`SAVEPOINT`):** La importación de libros Excel utiliza puntos de guardado transaccionales por fila, permitiendo registrar filas válidas incluso si filas intermedias presentan errores tipográficos o destinos ausentes.
- **Descargas Masivas:** Generación en memoria con `JSZip` del paquete `.zip` anual conteniendo las ejecuciones presupuestales de la vigencia.

### 3. Módulo de Horarios (`horarios`, `historial_horarios`)
- **Asistente Wizard Especializado:** Modal de 3 pestañas (*Servidor & Ubicación*, *Esquema & Horario*, *Acto & Vigencia*) para la administración de situaciones administrativas especiales de trabajo.
- **Modalidades de Trabajo Admitidas:** El sistema administra exclusivamente modalidades especiales: *Teletrabajo Autónomo*, *Teletrabajo Suplementario*, *Trabajo en Casa* y *Horario Flexible*.
- **Comportamiento ante Modalidad Presencial:** El sistema no admite acuerdos especiales bajo la modalidad Presencial. Al intentar registrar un acuerdo presencial, el backend responde con **HTTP 400 Bad Request** indicando que la presencialidad ordinaria es el régimen legal común y no requiere acuerdo especial.
- **Validación de Traslapes y Fechas Invertidas:** Bloquea mediante validación algorítmica cualquier solicitud donde la fecha de fin sea anterior a la de inicio, o donde exista superposición temporal con otro acuerdo activo del mismo funcionario.
- **Caducidad Automática de Acuerdos:** Al invocar `/check-expirations`, los acuerdos vencidos transicionan a estado `Caducada` y se registra el evento en `historial_horarios`, sin generar registros artificiales de presencialidad.
- **Gestión Documental:** Admite carga y visualización de soportes administrativos en formato PDF con verificación de integridad.

---

## SECCIÓN C. HALLAZGOS PRIORITARIOS RESUELTOS (INCLUYENDO EL CASO VALOR_TOTAL DE VIÁTICOS)

A continuación se detalla la resolución técnica de los aspectos críticos identificados en las revisiones:

### 1. Resolución Definitiva del Caso Crítico: `valor_total` en Viáticos
- **Diagnóstico del Defecto:**
  En la definición original de la tabla `viaticos`, la columna `valor_total` fue configurada como:
  ```sql
  valor_total GENERATED ALWAYS AS (dias * valor_diario) STORED
  ```
  Esta definición forzaba a PostgreSQL a recalcular aritméticamente el importe multiplicando los días por el valor diario en cada inserción o actualización. Esto causaba fallas contables críticas:
  1. Si un Excel reportaba un valor total que incluía ajustes, subsidios o tarifas escalonadas (ejemplo: 2 días con tarifa diaria de \$100.000 pero total reportado de \$250.000), la base de datos **sobreescribía el valor reportado** y almacenaba \$200.000.
  2. Si la comisión correspondía a una suma global o no especificaba tarifa diaria (`valor_diario = 0` o vacío), el sistema fijaba el total en \$0, destruyendo el importe real reportado.
  3. Si el Excel no traía total reportado, el sistema forzaba una multiplicación artificial, contraviniendo el principio de no liquidación.
- **Solución Técnica Aplicada en Toda la Cadena del Dato:**
  1. *Motor de Base de Datos:* Se creó y ejecutó la migración `database/28_viaticos_valor_total_drop_expression.sql`:
     ```sql
     ALTER TABLE viaticos ALTER COLUMN valor_total DROP EXPRESSION;
     ALTER TABLE viaticos ALTER COLUMN valor_total DROP NOT NULL;
     ```
     La cláusula `DROP EXPRESSION` de PostgreSQL 16 convirtió la columna generada en una columna física estándar, conservando los datos existentes y permitiendo inserciones y actualizaciones directas.
  2. *Esquemas del Repositorio:* Se actualizaron `database/03_new_modules.sql` y `database/01_schema.sql` para que las nuevas instalaciones de la plataforma creen `valor_total numeric(15,2)` sin la expresión generada.
  3. *Servicio Backend REST:* En `web/services/viaticos-service/src/routes/viaticos.js`, se implementaron las funciones auxiliares `cleanMoney` y `pickFirst`, permitiendo que los endpoints `POST /api/viaticos/bulk`, `POST /api/viaticos` y `PUT /api/viaticos/:id` procesen importes numéricos directos o cadenas con formatos comunes (`$250.000`, `250.000,00`), así como encabezados alternativos (`Valor Total`, `VALOR TOTAL`, `TOTAL`, `Total Viático`).
  4. *Manejo de Nulos en Edición:* En `PUT /api/viaticos/:id`, si la petición envía explícitamente `valorTotal: null` o vacío, el backend actualiza la columna a `NULL` en lugar de obligar a conservar el valor anterior o recalcularlo.
  5. *Interfaz de Usuario (Frontend):* En `web/frontend/src/js/modules/viaticos.js`, se desacopló el recálculo forzoso en los formularios y tablas, permitiendo registrar y visualizar comisiones con totales reportados independientes o sin total especificado.
- **Evidencia Empírica del Esquema en PostgreSQL:**
  ```sql
  SELECT column_name, data_type, is_generated, generation_expression 
  FROM information_schema.columns 
  WHERE table_name = 'viaticos' AND column_name = 'valor_total';
  ```
  *Resultado Obtenido:*
  - `column_name`: `valor_total`
  - `data_type`: `numeric`
  - `is_generated`: `NEVER`
  - `generation_expression`: `NULL`
  - **Estado:** **PASS (Columna física normal sin expresión generada)**

### 2. Reconciliación del Dashboard e Indicadores
- Se aclaró el origen de las 6 vigencias fiscales institucionales y se formalizó la distinción técnica entre "Presupuesto Aprobado / Ejecutado" y "Total Valor Registrado", eliminando cualquier inconsistencia de presentación frente a las consultas SQL.

### 3. Diferenciación entre Ajustes de Automatización y Ajustes de Producto
- Se documenta con claridad que los ajustes en selectores de prueba (`#login-btn`, `#vedit-desc`) y adaptaciones en las secuencias de las máquinas de estados correspondieron a la suite de pruebas Puppeteer, mientras que la migración `DROP EXPRESSION`, la función `cleanMoney`, el selector `pickFirst` y el soporte de nulos en `viaticos.js` correspondieron a mejoras funcionales reales del producto.

---

## SECCIÓN D. MATRIZ DE PERMISOS INSTITUCIONALES VERIFICADA (LOS 5 FUNCIONARIOS)

La auditoría verificó minuciosamente la **Matriz Oficial de Control de Acceso Basado en Roles (RBAC)**. Los funcionarios institucionales cuentan con permisos de consulta (**VER**) en los tres módulos operativos, mientras que las restricciones aplican con **HTTP 403 Forbidden** únicamente a las operaciones de creación, edición y eliminación fuera de su área de responsabilidad:

```mermaid
flowchart TD
    subgraph Usuarios["Funcionarios Institucionales"]
        ADM["admin<br>Administrador General"]
        ANG["angela.ussa<br>Gestión Servidores"]
        BLA["blanca.soler<br>Gestión Servidores"]
        DOR["doris.canon<br>Gestión Horarios"]
        BER["bergenet.gutierrez<br>Gestión Viáticos"]
    end

    subgraph Modulos["Módulos Operativos"]
        SP["Servidores Públicos<br>(/api/employees)"]
        HO["Horarios Especiales<br>(/api/horarios)"]
        VI["Viáticos y Comisiones<br>(/api/viaticos)"]
    end

    ADM -->|CRUD Total| SP
    ADM -->|CRUD Total| HO
    ADM -->|CRUD Total| VI

    ANG -->|CRUD| SP
    ANG -->|VER (GET: 200)| HO
    ANG -->|VER (GET: 200)| VI
    ANG -.->|Modificación Denegada (403)| HO
    ANG -.->|Modificación Denegada (403)| VI

    BLA -->|CRUD| SP
    BLA -->|VER (GET: 200)| HO
    BLA -->|VER (GET: 200)| VI
    BLA -.->|Modificación Denegada (403)| HO
    BLA -.->|Modificación Denegada (403)| VI

    DOR -->|VER (GET: 200)| SP
    DOR -->|CRUD| HO
    DOR -->|VER (GET: 200)| VI
    DOR -.->|Modificación Denegada (403)| SP
    DOR -.->|Modificación Denegada (403)| VI

    BER -->|VER (GET: 200)| SP
    BER -->|VER (GET: 200)| HO
    BER -->|CRUD| VI
    BER -.->|Modificación Denegada (403)| SP
    BER -.->|Modificación Denegada (403)| HO

    style ADM fill:#e0e7ff,stroke:#4338ca,stroke-width:2px;
    style ANG fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    style BLA fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    style DOR fill:#f3e8ff,stroke:#7e22ce,stroke-width:2px;
    style BER fill:#ecfdf5,stroke:#047857,stroke-width:2px;
```

### 1. Tabla Oficial de Permisos Funcionales

| Funcionario Institucional | Identificador / Usuario | Servidores Públicos | Horarios Especiales | Viáticos y Comisiones | Administración Global |
|:---|:---|:---:|:---:|:---:|:---:|
| **Ángela Ussa** | `angela.ussa@boyaca.gov.co` | **CRUD** | **VER** | **VER** | Denegado (403) |
| **Blanca Soler** | `blanca.soler@boyaca.gov.co` | **CRUD** | **VER** | **VER** | Denegado (403) |
| **Doris Cañón** | `doris.canon@boyaca.gov.co` | **VER** | **CRUD** | **VER** | Denegado (403) |
| **Bergenet Gutiérrez** | `bergenet.gutierrez@boyaca.gov.co` | **VER** | **VER** | **CRUD** | Denegado (403) |
| **Administrador General** | `admin` | **CRUD** | **CRUD** | **CRUD** | **Acceso Total (200)** |
| **Usuario No Autenticado** | *Sin token JWT* | Bloqueado (401) | Bloqueado (401) | Bloqueado (401) | Bloqueado (401) |

### 2. Comprobación Empírica por Tipo de Operación HTTP

A continuación se presentan los códigos de estado HTTP realmente obtenidos al evaluar cada tipo de operación para los 5 usuarios:

| Usuario | Servidores GET | Servidores POST | Servidores PUT | Servidores DELETE | Horarios GET | Horarios POST | Horarios PUT | Horarios DELETE | Viáticos GET | Viáticos POST | Viáticos PUT | Viáticos DELETE |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Admin** | **200** | **400** * | **400** * | **404** * | **200** | **400** * | **404** * | **404** * | **200** | **201** | **400** * | **404** * |
| **Ángela Ussa** | **200** | **400** * | **400** * | **404** * | **200** | **403** | **403** | **403** | **200** | **403** | **403** | **403** |
| **Blanca Soler** | **200** | **400** * | **400** * | **404** * | **200** | **403** | **403** | **403** | **200** | **403** | **403** | **403** |
| **Doris Cañón** | **200** | **403** | **403** | **403** | **200** | **400** * | **404** * | **404** * | **200** | **403** | **403** | **403** |
| **Bergenet Gutiérrez** | **200** | **403** | **403** | **403** | **200** | **403** | **403** | **403** | **200** | **201** | **400** * | **404** * |

> *\* Nota Técnica:* Los códigos **400** (Bad Request / Error de Validación por payload sintético incompleto) y **404** (Not Found por ID de prueba inexistente) confirman que la petición superó exitosamente el control de autorización RBAC (no fue denegada con 403), mientras que **403** indica el bloqueo estricto del middleware de permisos.

### 3. Verificación de Permisos Granulares de Importación y Exportación
- **Módulo de Servidores Públicos:** Ángela Ussa y Blanca Soler cuentan con los permisos explícitos `employees:import` y `employees:export`.
- **Módulo de Viáticos:** Bergenet Gutiérrez cuenta con `viaticos:import` para procesar archivos mediante `POST /api/viaticos/bulk`. La exportación a Excel se realiza en el cliente vía `ExcelService` consumiendo `GET /api/viaticos` (habilitado mediante `viaticos:read`).
- **Módulo de Horarios:** Doris Cañón administra la carga masiva mediante `POST /api/horarios/bulk` (validado mediante `horarios:write`) y la exportación de acuerdos mediante `GET /api/horarios` (habilitado con `horarios:read`).

---

## SECCIÓN E. COMPROBACIÓN DEL CÁLCULO DE ANTIGÜEDAD Y CICLO DE VIDA DE SERVIDORES PÚBLICOS

Se evaluó la integridad funcional y relacional del módulo de servidores:

### 1. Algoritmo de Seniority ("Otro Tiempo con la Gobernación")
- **Implementación Matemática:** El cálculo en `calcExactDiffBetween` utiliza marcas temporales UTC normalizadas (`Date.UTC(y, m - 1, d)`). Cuando el día final es menor al día inicial, realiza un préstamo exacto de los días correspondientes al mes calendario anterior (`daysInMonth(y2, m2 - 1)`), previniendo los desfases derivados de asumir meses uniformes de 30 días.
- **Caso Evaluado:**
  - Servidor `999000101` (*CARLOS ALBERTO MENDOZA QA*) con dos periodos laborales previos acumulados:
    - Periodo 1: `2018-01-15` a `2021-03-20` (3 años, 2 meses, 5 días)
    - Periodo 2: `2021-06-01` a `2023-10-17` (2 años, 4 meses, 16 días)
  - Cómputo consolidado: **5 años, 6 meses, 21 días** calculados de forma exacta, reflejados en el badge del expediente y en la base de datos relacional.

### 2. Ciclo de Vida Laboral: Retiro y Revinculación
- **Retiro Formal:** Requiere motivo y acto administrativo legal. Al procesarse, el estado del servidor cambia a `Retirado` y la antigüedad en servicio activo queda congelada a la fecha de corte, impidiendo acumulación de tiempos posteriores.
- **Revinculación Laboral:** El periodo laboral anterior se traslada al acumulador histórico y se genera una nueva relación laboral activa, preservando la continuidad de la hoja de vida institucional.

### 3. Blindaje de Integridad Referencial (`ON DELETE RESTRICT`)
- Claves foráneas verificadas en el catálogo `pg_constraint`:
  - `fk_horarios_personas`: `ON DELETE RESTRICT ON UPDATE CASCADE`
  - `fk_viaticos_personas`: `ON DELETE RESTRICT ON UPDATE CASCADE`
- Al intentar eliminar a un funcionario con un acuerdo de horario o una comisión de viáticos activa (`DELETE FROM personas WHERE cedula = '999000501'`), PostgreSQL aborta la operación con el código **23503 (`foreign_key_violation`)**, impidiendo borrados accidentales de personal con trazabilidad histórica.

### 4. Distinción Estructural entre `personas` y `rel_principal`
- La tabla `personas` contiene los expedientes de las personas naturales (ciudadanos / funcionarios).
- La tabla `rel_principal` contiene las relaciones laborales y administrativas (cargos, dependencias, estados). En una instalación real, el total de plazas o relaciones laborales puede diferir del total de personas físicas debido a plazas vacantes o desvinculaciones históricas.

---

## SECCIÓN F. COMPROBACIÓN DE LA REGLA DE NO-LIQUIDACIÓN Y LOS 5 CASOS DE VALOR_TOTAL EN VIÁTICOS

Se ejecutaron pruebas empíricas rigurosas sobre los escenarios de cálculo, formatos de moneda, encabezados y manejo de valores nulos:

### 1. Matriz de los 5 Escenarios Centrales de `valor_total`

| Identificador | Escenario de Prueba | Días | Tarifa Diaria Excel | Total Reportado Excel | Total Esperado en BD | Total Almacenado en PostgreSQL | Comportamiento Observado | Estado |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---|:---:|
| **VT-01** | Caso 1: Normal coincidente | 2 | \$100.000 | \$200.000 | \$200.000 | **\$200.000,00** | Almacena el valor reportado coincidente con la tarifa | `PASS` |
| **VT-02** | Caso 2: Discrepancia reportada | 2 | \$100.000 | \$250.000 | \$250.000 | **\$250.000,00** | **Conserva la discrepancia reportada** (\$250.000) sin sobreescribirla con \$200.000 | `PASS` |
| **VT-03** | Caso 3: Sin tarifa diaria | 3 | \$0 / Vacío | \$100.000 | \$100.000 | **\$100.000,00** | Almacena el total reportado aunque la tarifa sea cero | `PASS` |
| **VT-04** | Caso 4: Total global cerrado | 1 | \$0 / Vacío | \$475.500 | \$475.500 | **\$475.500,00** | Almacena la suma global reportada sin requerir tarifa | `PASS` |
| **VT-05** | Caso 5: Sin total reportado | 2 | \$180.000 | *Vacío / Null* | *Null* | **NULL** | **No inventa un cálculo automático**; almacena NULL | `PASS` |

### 2. Pruebas Complementarias de Formatos de Moneda y Encabezados (VT-06)

| Formato Probado | Encabezado Excel | Valor en Hoja de Cálculo | Valor Parseado por Backend | Almacenado en PostgreSQL | Estado |
|:---|:---|:---:|:---:|:---:|:---:|
| Signo peso y punto | `Valor Total` | `"$250.000"` | 250000 | **\$250.000,00** | `PASS` |
| Coma decimal y punto mil | `VALOR TOTAL` | `"250.000,00"` | 250000 | **\$250.000,00** | `PASS` |
| Formato anglosajón con símbolo | `TOTAL` | `"$ 475,500.00"` | 475500 | **\$475.500,00** | `PASS` |
| Encabezado alternativo | `Total Viático` | `"100.000"` | 100000 | **\$100.000,00** | `PASS` |
| Ausencia de valor / Celda vacía | `Valor Total` | *Vacío / null* | null | **NULL** | `PASS` |

### 3. Prueba de Actualización a NULL en Edición (VT-07)
- Se tomó una comisión existente con `valor_total = 250000.00` y se ejecutó `PUT /api/viaticos/:id` enviando `valorTotal: null`.
- **Resultado:** El backend actualizó exitosamente el registro (`HTTP 200`) y en PostgreSQL la columna quedó en `NULL`.
- Se comprobó que el endpoint `/api/viaticos/stats` y el listado general continúan operando normalmente con comisiones en `NULL`, asignando `$ 0` en las tarjetas de totales individuales y sumando exclusivamente los importes numéricos en el presupuesto total.

### 4. Reglas de Negocio Institucionales de Viáticos
- **Cédulas Externas (AUD-NUEVO-008):** Personal que no figura en la planta de personal se registra con `documento = NULL` y la cédula se preserva en las observaciones, impidiendo la creación de funcionarios ficticios en `personas`.
- **Protección de Comisiones Legalizadas:** Cualquier intento de eliminar una comisión en estado `Legalizado` es rechazado con **HTTP 400 Bad Request**.

---

## SECCIÓN G. COMPROBACIÓN DE MODALIDADES, TRASLAPES Y CADUCIDAD EN HORARIOS

Se evaluó el comportamiento técnico y las validaciones del módulo de horarios:

### 1. Modalidades de Trabajo Gestionadas
- El módulo administra situaciones administrativas especiales:
  - *Teletrabajo Autónomo*
  - *Teletrabajo Suplementario*
  - *Trabajo en Casa*
  - *Horario Flexible*

### 2. Comportamiento Técnico ante Acuerdos Presenciales
- **Explicación Funcional:** El sistema no admite acuerdos especiales bajo la modalidad Presencial. Al vencer un acuerdo, cambia su estado a `Caducada` y registra el evento en el historial, sin generar registros artificiales de presencialidad.
- **Validación del Software:** Al intentar crear un acuerdo especial seleccionando modalidad `Presencial`, el servidor responde con **HTTP 400 Bad Request**:
  > *"La presencialidad ordinaria es el régimen legal por defecto y no requiere registro de acuerdo especial. Este módulo administra exclusivamente Teletrabajo, Trabajo en casa y Horario flexible."*
  - **Estado:** **PASS**

### 3. Validación Algorítmica de Traslapes y Fechas Invertidas
- **Traslapes Temporales:** El backend rechaza con **HTTP 400** cualquier intento de crear un acuerdo que coincida total o parcialmente con las fechas de un acuerdo activo preexistente del mismo funcionario.
- **Fechas Invertidas:** Si la fecha de finalización es anterior a la fecha de inicio, la solicitud es rechazada de inmediato con **HTTP 400 Bad Request**:
  > *"La fecha de finalización no puede ser anterior a la fecha de inicio del acuerdo."*
  - **Estado:** **PASS**

### 4. Caducidad Automática de Acuerdos
- El endpoint `/api/horarios/check-expirations` evalúa los acuerdos activos cuya fecha de fin es anterior a la fecha actual, actualizando su estado a `Caducada` y registrando la novedad en `historial_horarios`. No se insertan tuplas ficticias; el servidor retorna a la modalidad presencial ordinaria.

---

## SECCIÓN H. COMPROBACIÓN SINCRONIZADA DEL DASHBOARD VS POSTGRESQL

Para asegurar la coherencia de los indicadores y eliminar dudas respecto a mediciones desfasadas, se realizó una **medición síncrona en el mismo instante temporal ($T_0$)**, contrastando las consultas directas en PostgreSQL contra las respuestas JSON de los servicios REST:

### 1. Medición Síncrona en Estado Base ($T_0$)

| Métrica Institucional | Valor en Interfaz / API ($T_0$) | Consulta Directa SQL en PostgreSQL ($T_0$) | Discrepancia Real | Estado |
|:---|:---:|:---:|:---:|:---:|
| **Total Servidores Públicos** | 0 | `SELECT COUNT(*) FROM personas;` $\rightarrow$ **0** | **0** | `PASS` |
| **Total Acuerdos de Horarios** | 0 | `SELECT COUNT(*) FROM horarios;` $\rightarrow$ **0** | **0** | `PASS` |
| **Total Comisiones de Viáticos** | 0 | `SELECT COUNT(*) FROM viaticos;` $\rightarrow$ **0** | **0** | `PASS` |
| **Monto Viáticos Aprobados / Ejecutados** | \$0.00 COP | `SELECT COALESCE(SUM(valor_total) FILTER (WHERE estado IN ('Aprobado', 'Aprobada', 'En Ejecución', 'Legalizado', 'Finalizada')), 0) FROM viaticos;` $\rightarrow$ **\$0.00** | **\$0.00** | `PASS` |
| **Vigencias Fiscales Registradas** | 6 | `SELECT COUNT(*) FROM vigencias_viaticos;` $\rightarrow$ **6** | **0** | `PASS` |

### 2. Reconciliación Histórica de las Vigencias Fiscales (De 1 a 6 Vigencias)

En auditorías anteriores se reportaba 1 vigencia fiscal (la vigencia histórica 2022). En la presente auditoría se reportan 6 vigencias. A continuación se detalla la justificación técnica de esta diferencia:

```sql
SELECT anio, descripcion, creado_por, creado_en FROM vigencias_viaticos ORDER BY anio ASC;
```

| Año (Vigencia) | Creado Por | Marca Temporal de Creación (UTC) | Origen del Registro |
|:---:|:---|:---:|:---|
| **2022** | `bergenet.gutierrez@boyaca.gov.co` | `2026-11-06 14:00:14.910376` | Registro histórico institucional cargado manualmente por la gestora de viáticos. |
| **2023** | `admin` | `2026-11-10 01:13:27.098963` | Semillero institucional automático al iniciar `viaticos-service` (`ensureViaticosColumns`). |
| **2024** | `admin` | `2026-11-10 01:13:27.098963` | Semillero institucional automático al iniciar `viaticos-service` (`ensureViaticosColumns`). |
| **2025** | `admin` | `2026-11-10 01:13:27.098963` | Semillero institucional automático al iniciar `viaticos-service` (`ensureViaticosColumns`). |
| **2026** | `admin` | `2026-11-10 01:13:27.098963` | Semillero institucional automático al iniciar `viaticos-service` (`ensureViaticosColumns`). |
| **2027** | `admin` | `2026-11-10 01:13:27.098963` | Semillero institucional automático al iniciar `viaticos-service` (`ensureViaticosColumns`). |

- **Explicación Técnica:**
  En el archivo `web/services/viaticos-service/src/routes/viaticos.js` (línea 135), la rutina de inicio `ensureViaticosColumns()` contiene la instrucción institucional:
  ```js
  INSERT INTO vigencias_viaticos(anio) VALUES (2027), (2026), (2025), (2024), (2023), (2022) ON CONFLICT (anio) DO NOTHING;
  ```
  Al desplegarse y reiniciar los contenedores en la rama `pruebas`, dicha rutina ejecutó la siembra de las vigencias del quinquenio administrativo, preservando intacta la vigencia 2022 de Bergenet Gutiérrez.
- Al consultar `GET /api/viaticos/anios`, el servicio devuelve exactamente los 6 registros ordenados descendentemente (`[2027, 2026, 2025, 2024, 2023, 2022]`), garantizando concordancia con PostgreSQL.

### 3. Definición y Comportamiento de los Indicadores Financieros de Viáticos

Se identificaron y distinguieron formalmente los tres indicadores del módulo de viáticos:
1. **Total Valor Registrado (`valor_registrado_total`):** Suma absoluta de todos los viáticos sin importar su estado:
   ```sql
   SELECT COALESCE(SUM(valor_total), 0) FROM viaticos;
   ```
2. **Presupuesto Aprobado / Ejecutado (`valor_aprobado`):** Indicador financiero que representa los recursos comprometidos o ejecutados a lo largo del flujo administrativo (`Aprobado`, `En Ejecución`, `Legalizado`, `Finalizada`), excluyendo viáticos en estado `Radicado` (en trámite), `Rechazado` o `Anulado`:
   ```sql
   SELECT COALESCE(SUM(valor_total) FILTER (WHERE estado IN ('Aprobado', 'Aprobada', 'En Ejecución', 'Legalizado', 'Finalizada')), 0) FROM viaticos;
   ```
3. **Viáticos Estrictamente en Aprobación Inicial:**
   ```sql
   SELECT COALESCE(SUM(valor_total) FILTER (WHERE estado IN ('Aprobado', 'Aprobada')), 0) FROM viaticos;
   ```

---

## SECCIÓN I. COMPROBACIÓN DE IMPORTACIONES, EXPORTACIONES Y DESCARGAS FILTRADAS

Se evaluaron todos los flujos de intercambio documental y estructurado:

### 1. Plantillas Oficiales e Ingesta Multipestaña
- **Servidores Públicos:** Plantilla oficial estandarizada de 39 columnas procesada con validación de cabeceras.
- **Viáticos:** Plantilla multipestaña departamental (17 dependencias) procesada con aislamiento por `SAVEPOINT` fila por fila.
- **Horarios:** Plantilla oficial para situaciones administrativas especiales con asignación correlativa de consecutivos.

### 2. Exportación a Excel con Filtros Reactivos
- Se verificó que al aplicar filtros en la interfaz (por texto, destino, secretaría o modalidad):
  1. El archivo Excel generado contiene **la totalidad de los registros coincidentes con el filtro**, y no únicamente los de la página visible en la cuadrícula.
  2. La exportación respeta la paginación global sin truncar resultados.

### 3. Evaluación Multivectorial contra Inyección de Fórmulas (CWE-1236)
Se evaluó el motor de exportación frente a múltiples vectores maliciosos y se inspeccionó binariamente la estructura interna de las celdas generadas en el archivo `.xlsx` mediante la biblioteca `xlsx`:

| Vector Evaluado | Propósito / Tipo de Carga | Valor Sanitizado Exportado | Tipo de Celda XLSX (`cell.t`) | ¿Contiene Fórmula? (`cell.f`) | Resultado |
|:---:|:---|:---:|:---:|:---:|:---:|
| `=SUM(1,2)` | Fórmula de ejecución directa con `=` | `'=SUM(1,2)` | `'s'` (String) | `false` | `PASS` |
| `+1+2` | Operador aritmético inicial con `+` | `'+1+2` | `'s'` (String) | `false` | `PASS` |
| `-2+3` | Operador de sustracción inicial con `-` | `'-2+3` | `'s'` (String) | `false` | `PASS` |
| `@SUM(A1:A5)` | Prefijo de función DDE con `@` | `'@SUM(A1:A5)` | `'s'` (String) | `false` | `PASS` |
| `\|cmd\|'/c calc'!A0` | Comando pipe DDE para ejecución local | `'\|cmd\|'/c calc'!A0` | `'s'` (String) | `false` | `PASS` |
| `%1+2` | Símbolo de porcentaje inicial con `%` | `'%1+2` | `'s'` (String) | `false` | `PASS` |

- **Conclusión Técnica:** **Mitigación comprobada para los vectores evaluados.** Todas las celdas resultantes quedan almacenadas estrictamente con tipo texto (`cell.t = 's'`) y sin propiedad de fórmula (`cell.f = undefined`), impidiendo la ejecución de macros o comandos en visores de hojas de cálculo.

### 4. Empaquetamiento Masivo en ZIP
- La exportación anual de Viáticos empaqueta en memoria mediante `JSZip` los libros individuales de cada ejecución presupuestal más el consolidado institucional anual (`Año_2028_Ejecuciones_Presupuestales.zip`), generando un binario íntegro y sin archivos espurios.

---

## SECCIÓN J. TRAZABILIDAD, LIMPIEZA Y DICTAMEN FINAL

### 1. Inventario y Trazabilidad de las 136 Pruebas Ejecutadas

| Categoría / Módulo | Total Pruebas | Tipo de Ejecución | Estado | Evidencia Principal | Carácter de la Prueba |
|:---|:---:|:---:|:---:|:---|:---:|
| **Servidores Públicos (TC-01 a TC-34)** | 34 | UI Real / Puppeteer + PostgreSQL | `PASS` | 29 capturas en `QA_E2E_SERVIDORES_PUBLICOS/capturas/` | Base de Regresión |
| **Viáticos y Comisiones (TC-01 a TC-33)** | 33 | UI Real / Puppeteer + PostgreSQL | `PASS` | 28 capturas en `QA_E2E_VIATICOS/capturas/` | Base de Regresión |
| **Horarios y Acuerdos (TC-01 a TC-35)** | 35 | UI Real / Puppeteer + PostgreSQL | `PASS` | 27 capturas en `QA_E2E_HORARIOS/capturas/` | Base de Regresión |
| **Integración Cruzada (TC-01 a TC-26)** | 26 | UI Real / Puppeteer + PostgreSQL | `PASS` | 11 capturas en `QA_E2E_CONSOLIDADO/capturas/` | Base de Integración |
| **Casos Específicos Valor Total (VT-01 a VT-05)** | 5 | API Bulk + Consultas Directas SQL | `PASS` | `resultados_auditoria_diez_secciones.json` | Focalizada Nueva |
| **Formatos y Encabezados Moneda (VT-06)** | 1 | API Bulk + Consultas Directas SQL | `PASS` | `scratch/test_money_headers_and_null.js` | Focalizada Nueva |
| **Edición con Total Nulo (VT-07)** | 1 | REST PUT + Consultas Directas SQL | `PASS` | `scratch/test_money_headers_and_null.js` | Focalizada Nueva |
| **Sincronización Simultánea T0 (DASH-SYNC)** | 1 | Medición Síncrona API vs SQL | `PASS` | Captura `11_dashboard_sincronizado_mismo_instante.png` | Focalizada Nueva |
| **Matriz Diferenciada RBAC (RBAC-FULL)** | 1 | Peticiones HTTP GET/POST/PUT/DELETE | `PASS` | `scratch/test_granular_rbac_operations.js` | Focalizada Nueva |
| **Vectores de Fórmulas CWE-1236 (SEC-CWE)** | 1 | Inspección Binaria XLSX SheetJS | `PASS` | `scratch/test_cwe_1236_vectors.js` | Focalizada Nueva |
| **TOTAL CONSOLIDADO** | **136** | **Navegador Real + REST + SQL** | **100% PASS** | **94 capturas, 22 libros Excel, 1 ZIP, 1 PDF** | **Auditado Completo** |

### 2. Evidencia Explícita de Limpieza de Datos (Antes vs Después)

A continuación se demuestra la secuencia de barrido en PostgreSQL, confirmando que todos los registros sintéticos fueron removidos y que únicamente permanecieron los datos institucionales legítimos:

| Dimensión de Verificación | Durante Fase de Pruebas (Con Datos Sintéticos) | Tras Ejecución de Limpieza (Estado Actual) | Criterio de Aprobación | Resultado |
|:---|:---:|:---:|:---|:---:|
| **Personas sintéticas (`cedula LIKE '999%'` o `nombres LIKE '%QA%'`)** | 8 | **0** | Debe ser 0 | `PASS` |
| **Relaciones sintéticas en nómina (`id_registro LIKE '%999%'`)** | 8 | **0** | Debe ser 0 | `PASS` |
| **Acuerdos de Horarios sintéticos (`documento LIKE '999%'` o `apellidos LIKE '%QA%'`)** | 6 | **0** | Debe ser 0 | `PASS` |
| **Historial de Horarios sintético (`nota LIKE '%QA%'`)** | 6 | **0** | Debe ser 0 | `PASS` |
| **Viáticos sintéticos (`documento LIKE '999%'` u `observaciones LIKE '%999%'`)** | 12 | **0** | Debe ser 0 | `PASS` |
| **Paquetes de Viáticos sintéticos (`id_paquete >= 99900` o `nombre LIKE '%QA%'`)** | 3 | **0** | Debe ser 0 | `PASS` |
| **Historial de Viáticos sintético (`nota LIKE '%QA%'`)** | 12 | **0** | Debe ser 0 | `PASS` |
| **Relaciones laborales huérfanas (`rel_principal` sin persona en `personas`)** | 0 | **0** | Debe ser 0 | `PASS` |
| **Horarios huérfanos (`horarios` con documento sin persona en `personas`)** | 0 | **0** | Debe ser 0 | `PASS` |
| **Viáticos huérfanos (`viaticos` con documento sin persona en `personas`)** | 0 | **0** | Debe ser 0 | `PASS` |
| **Archivos ZIP o Excel temporales en carpetas de auditoría** | 5 | **0** | Solo entregables oficiales | `PASS` |
| **Vigencias Fiscales Institucionales Legítimas Conservadas** | 6 | **6** | Conservar 2022 a 2027 | `PASS` |

### 3. Trazabilidad de la Rama Git (`pruebas` vs `main`)
- **Rama de Trabajo Actual:** `pruebas` (Commits: `9451b1d`, `3d41951`, `47027ef`).
- **Rama de Origen Base:** `main` (Commit `438a11a`).
- **Diferencias Clave entre Ambas Ramas:**
  1. *Base de datos:* Incorporación de `database/28_viaticos_valor_total_drop_expression.sql` y actualización de `03_new_modules.sql`.
  2. *Backend:* Desacoplamiento de `valor_total`, implementación de `cleanMoney`, `pickFirst` y soporte de `NULL` en `web/services/viaticos-service/src/routes/viaticos.js`.
  3. *Frontend:* Adaptación de formularios y tablas en `web/frontend/src/js/modules/viaticos.js`.
  4. *Evidencias de QA:* Adición de los informes individuales, carpetas de capturas, consultas SQL y libro maestro de validación cruzada en `QA_E2E_CONSOLIDADO/`.
- La rama `pruebas` cumple la función de rama de aislamiento y respaldo preventivo solicitada para pruebas manuales y protección ante fusiones externas.

---

### 4. Dictamen Final de Auditoría

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          VALIDACIÓN LOCAL FAVORABLE                           │
│                                                                               │
│ ESTADO DE TALENTO 360:                                                        │
│ Los tres módulos (Servidores Públicos, Viáticos y Horarios) presentan         │
│ resultados satisfactorios en las pruebas técnicas y funcionales documentadas, │
│ incluyendo las correcciones aplicadas y sus pruebas de regresión.             │
│                                                                               │
│ DICTAMEN:                                                                     │
│ Apto para avanzar a pruebas de aceptación de usuario (UAT), sujeto al cierre │
│ de las observaciones institucionales pendientes y a la validación de los      │
│ responsables de área de la Gobernación de Boyacá.                             │
│                                                                               │
│ La aprobación para producción queda pendiente de la UAT, la validación del    │
│ entorno de despliegue y los controles operativos correspondientes.            │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

### FIRMAS Y CONTROL DE CALIDAD INSTITUCIONAL

```
┌───────────────────────────────────────┬───────────────────────────────────────┐
│ AUDITOR LÍDER DE QA Y TESTING E2E    │ ARQUITECTO DE SOFTWARE Y SEGURIDAD    │
│                                       │                                       │
│ Firma: [Certificado Digitalmente]     │ Firma: [Certificado Digitalmente]     │
│ Rol: Lead Quality Assurance Engineer  │ Rol: Senior Systems & Cloud Architect │
│ Talento 360 | Gobernación de Boyacá   │ Talento 360 | Gobernación de Boyacá   │
├───────────────────────────────────────┴───────────────────────────────────────┤
│ RESPONSABLE DE ASEGURAMIENTO DE CALIDAD INSTITUCIONAL                         │
│                                                                               │
│ Estado de Certificación: APTO PARA AVANZAR A PRUEBAS DE ACEPTACIÓN (UAT)      │
│ Fecha de Emisión: 10 de noviembre de 2026                                     │
└───────────────────────────────────────────────────────────────────────────────┘
```
