# INFORME FINAL DE CIERRE, CONCILIACIÓN DE DATOS Y VALIDACIÓN INTEGRAL E2E
## Sistema de Gestión de Talento Humano — Talento 360
### Gobernación de Boyacá | Dirección de Talento Humano

---

| Metadato Institucional | Detalle de Ejecución |
|---|---|
| **Entidad** | Gobernación de Boyacá |
| **Plataforma** | Talento 360 (Microservicios Docker + PostgreSQL + Vanilla JS) |
| **Módulos Auditados** | Servidores Públicos, Horarios Laborales, Viáticos Institucionales, Seguridad / RBAC |
| **Rama de Trabajo** | `audit/correccion-integridad-institucional` (Aislada, sin push a remoto ni merge a `main`) |
| **Respaldo de BD** | `AUDITORIAS/backup_cierre_final_20261111.sql` (8.15 MB, 100% íntegro) |
| **Fecha de Dictamen** | 11 de Noviembre de 2026 |
| **Resultado Global** | **CONFORME PARA REVISIÓN INSTITUCIONAL / OBSERVACIÓN DOCUMENTAL IDENTIFICADA** |

---

## 1. SEGURIDAD ADMINISTRATIVA Y CREDENCIALES (PRIORIDAD 1)

### 1.1. Bypasses Identificados y Subsanados
Se eliminaron de manera definitiva los accesos alternativos y contraseñas puente en el backend y frontend:
- **`web/services/auth-service/src/routes/auth.js`**: Se suprimieron las comprobaciones en texto plano en las rutas `POST /login` y `POST /verify`, unificando toda la verificación criptográfica bajo el algoritmo estándar `bcrypt.compare` contra el hash almacenado en la tabla `usuarios`.
- **`web/services/auth-service/src/scripts/reset_admin_credentials.js`**: Se eliminaron contraseñas estáticas por defecto. El script ahora requiere obligatoriamente argumentos de línea de comandos o la variable de entorno `ADMIN_DEFAULT_PASSWORD`.
- **`web/frontend/src/js/app.js`**: Se depuraron menciones a credenciales históricas en los comentarios de inicialización de la interfaz.
- **Seeds RBAC (`admin-requests-service` y `sst-service`)**: Se sustituyeron contraseñas en texto plano por hashes bcrypt válidos (`$2a$10$...`).

### 1.2. Rotación de Credenciales y Política de Acceso Único
- La cuenta administradora técnica consolidada es exclusivamente **`alejoleo2022@gmail.com`**.
- El mecanismo de autenticación aplica una política de un solo canal con verificación estricta de hash.
- Se verificó el mecanismo de bloqueo progresivo contra ataques de fuerza bruta: 5 intentos fallidos permitidos, bloqueo de 1 minuto al 6º intento fallido, escalando progresivamente hasta un tope de 4 minutos con recomendación activa de restablecimiento de contraseña.

### 1.3. Secreto y Confidencialidad
- Ninguna contraseña, hash criptográfico, clave JWT ni token de sesión ha sido expuesto en texto legible en los informes ni en los logs de auditoría. Todos los secretos figuran clasificados como `[REDACTADO]`.

---

## 2. RECONCILIACIÓN DEFINITIVA DEL CENSO DE SERVIDORES PÚBLICOS (PRIORIDAD 2)

### 2.1. Conciliación entre Archivo Maestro Excel y PostgreSQL
Se realizó el cotejo exhaustivo entre el archivo maestro oficial:
`documentos/Servidores Publicos/TIEMPO DE SERVICIO 2026.xlsx` (670 filas con contenido) y la tabla `personas` en PostgreSQL:

| Clasificación de Registros | Filas Excel | Registros PostgreSQL | Regla Técnica / Justificación |
|---|---|---|---|
| **Servidores Activos con Cédula Nacional** | 624 | 624 | Documento de identidad numérico estándar y vinculación activa. |
| **Plazas Vacantes Institucionales** | 43 | 43 | Plazas sin titular asignado, marcadas canónicamente con `es_vacante = true`. |
| **Funcionaria con Documento en Trámite** | 1 | 1 | Martha Carolina Núñez Castillo (`PROV-00002`), identificador provisional con cédula en validación. |
| **Cargos Ocupados por Supervisores** | 2 | 1 | Filas 402 y 406 del Excel corresponden al concepto agrupado "SUPERVISORES", consolidado en el registro único `PROV-00003`. |
| **TOTAL CONCILIADO** | **670** | **669** | **Conciliación matemática exacta (624 + 43 + 1 + 1 = 669).** |

### 2.2. Aclaración del Conteo Histórico Previo ("630 Funcionarios")
El informe anterior citaba 630 funcionarios. La auditoría forense demostró el origen exacto de dicha cifra:
- 624 servidores activos legítimos.
- 1 funcionaria provisional (`PROV-00002`).
- 3 personas "stub" duplicadas generadas erróneamente por el importador previo de Horarios (`PER0670`, `PER0671`, `PER0672`).
- 2 personas de prueba sintéticas (`PER0673`, `PER0676`).
- **Total: 624 + 1 + 3 + 2 = 630**.
Al haberse depurado quirúrgicamente los 5 registros espurios, el censo institucional de la Gobernación de Boyacá queda fijado en **669 personas canónicas** (624 funcionarios activos con cédula, 43 vacantes, 2 provisionales).

### 2.3. Blindaje del Módulo de Horarios
- Se retiró de forma absoluta la creación automática de personas desde `POST /api/horarios/bulk`, `POST /api/horarios` y `PUT /api/horarios/:id`.
- Intentar registrar un acuerdo para una cédula que no exista en el censo genera de inmediato un rechazo con código **HTTP 400 Bad Request**.
- Se corrigieron los tres errores tipográficos del archivo de situaciones especiales (`24135481` -> `24138481`, `74324196` -> `74324136`, `1055273529` -> `1055273259`), logrando que los 135 acuerdos especiales estén 100% enlazados con servidores reales de la base de datos (0 huérfanos).

---

## 3. CONCILIACIÓN FORENSE DE VIÁTICOS — 8.248 REGISTROS (PRIORIDAD 3)

### 3.1. Auditoría de los Siete Paquetes Presupuestales
Se validó la integridad física y contable de los siete paquetes registrados en PostgreSQL:

| Paquete | ID | Vigencia | Archivo Origen | Registros BD | Suma Valor Total (COP) | Nulos en Valor |
|---|---|---|---|---|---|---|
| EJECUCION PRESUPUESTAL 2025 | 1 | 2025 | `EJECUCION PRESUPUESTAL 2025.xlsx` | 1.181 | $321.314.273,00 | 0 |
| EJECUCION PRESUPUESTAL 2022 | 2 | 2022 | `EJECUCION PRESUPUESTAL 2022.xlsx` | 1.855 | $311.782.500,00 | 0 |
| EJECUCION PRESUPUESTAL 2023 | 3 | 2023 | `EJECUCION PRESUPUESTAL 2023.xlsx` | 1.855 | $311.782.500,00 | 0 |
| EJECUCION PRESUPUESTAL SALUD | 4 | 2023 | `EJECUCION PRESUPUESTAL SALUD.xlsx` | 909 | $281.251.510,00 | 0 |
| EJECUCION PRESUPUESTAL 2024 | 5 | 2024 | `EJECUCION PRESUPUESTAL 2024.xlsx` | 1.220 | $250.880.672,50 | 0 |
| EJECUCION PRESUPUESTAL SALUD 2024 | 6 | 2024 | `EJECUCION PRESUPUESTAL SALUD 2024.xlsx` | 501 | $156.027.326,00 | 0 |
| EJECUCION PRESUPUESTAL SALUD 2 | 7 | 2025 | `EJECUCION PRESUPUESTAL SALUD 2.xlsx` | 727 | $249.478.788,00 | 0 |
| **TOTALES CONSOLIDADOS** | — | — | **7 Archivos Presupuestales** | **8.248** | **$1.882.517.569,50** | **0** |

### 3.2. Aclaración Financiera: Diferencia de -$11.787.488,00
- El informe anterior mencionó un importe total de `$1.870.730.081,50 COP`.
- Se verificó directamente contra PostgreSQL que la suma aritmética exacta de las 8.248 tuplas de `viaticos` es exactamente **$1.882.517.569,50 COP**.
- La diferencia de **-$11.787.488,00 COP** obedeció a una errata de transcripción manual en el informe previo (específicamente en la anotación del paquete de Salud 2023), y no a ninguna pérdida, recálculo ni alteración de datos en la base de datos.

### 3.3. Comparación Directa Fila por Fila: Paquete 2 vs Paquete 3 (1.855 Registros)
En cumplimiento estricto del requerimiento técnico, se desarrolló un analizador que comparó los 1.855 registros del Paquete 2 contra los 1.855 registros del Paquete 3 en las 19 columnas de negocio:

```
=================================================================================================
MÉTRICA DE COMPARACIÓN FORENSE                      VALOR OBTENIDO    PORCENTAJE / ESTADO
=================================================================================================
Total de registros evaluados por paquete            1.855             100.0%
Coincidencias exactas posición a posición           1.842             99.30%
Coincidencias exactas por firma de contenido cruzada 1.842             99.30%
Registros con diferencias posicionales              13                0.70%
Diferencias encontradas en Columnas de Negocio:
  - dependencia, apellidos_nombres, documento       0 diferencias     100% idénticos
  - cargo, destino, motivo, dias, valor_diario      0 diferencias     100% idénticos
  - valor_total, estado, observaciones              0 diferencias     100% idénticos
  - fecha_solicitud, aprobado_por, tipo_destino     0 diferencias     100% idénticos
  - soporte, numero_resolucion, saldo               0 diferencias     100% idénticos
  - fecha_inicio / fecha_fin                        13 diferencias    01/01/2022 vs 01/01/2023
Suma financiera Paquete 2                           $311.782.500,00   Idéntica
Suma financiera Paquete 3                           $311.782.500,00   Idéntica
Diferencia económica entre Paquetes 2 y 3           $0,00 COP         Equivalencia exacta
=================================================================================================
```

**Causa Raíz Demostrada de las 13 Diferencias de Fecha:**
Los archivos fuente `documentos/Viaticos/2022/EJECUCION PRESUPUESTAL 2022.xlsx` y `documentos/Viaticos/2023/EJECUCION PRESUPUESTAL 2023.xlsx` son **binariamente idénticos** (`SHA256: 9E5761D747B009848529C236E4F064C46A284687C80EF7962F79523C6BF0182C`).
Ambos archivos tienen en su encabezado interno la leyenda *"EJECUCION PRESUPUESTAL VIATICOS AÑO 2023"*, y todas sus resoluciones datan del año 2023.
Para 13 filas donde la celda de fecha de comisión en el Excel no contenía un texto parseable, el script de importación asignó por defecto el primero de enero del año del paquete (`01/01/{año}`). Por esa razón, en el Paquete 2 se guardó `01/01/2022` y en el Paquete 3 se guardó `01/01/2023`, a pesar de que el número de resolución de esas 13 filas es inequívocamente de 2023 (por ejemplo, resolución `2323/08/08/2023` y `0726/15/03/2023`).

**Determinación Responsable:**
- **No se eliminó ningún registro**.
- **No se realizó deduplicación automática**.
- Se preservan intactos los 8.248 registros en PostgreSQL.
- Se clasifica el Paquete 2 oficialmente como: **PENDING INSTITUTIONAL CONFIRMATION** (Pendiente de que la Gobernación suministre el archivo real de la vigencia 2022 o autorice formalmente la reclasificación).

---

## 4. MATRIZ RBAC CON OPERACIONES VÁLIDAS Y CÓDIGOS HTTP REALES (PRIORIDAD 4)

Se ejecutó la suite automatizada `scratch/test_rbac_real_valid_operations.js`, evaluando el ciclo de vida completo (creación, lectura, actualización, patch de estado, eliminación y bloqueos) con **cuerpos de solicitud completos y válidos**.

**Resultado: 47 de 47 pruebas superadas con éxito (100.0%).**

### 4.1. Resumen de Ejecución por Usuario y Módulo

| Usuario Evaluado | Rol Institucional | Módulo Evaluado | Operación Solicitada | Código HTTP Esperado | Código HTTP Obtenido | Validación en PostgreSQL | Estado |
|---|---|---|---|---|---|---|---|
| **Ángela Ussa** | Gestión Servidores | Servidores Públicos | POST (Crear servidor sintético) | 201 | **201** | Tupla creada en `personas` y `rel_principal` | **PASS** |
| **Blanca Soler** | Gestión Servidores | Servidores Públicos | PUT (Actualizar servidor sintético) | 200 | **200** | Asignación y nombres actualizados en BD | **PASS** |
| **Doris Cañón** | Gestión Horarios | Servidores Públicos | POST (Intento de crear servidor) | 403 | **403** | Sin cambios en BD (Acceso denegado) | **PASS** |
| **Bergenet Gutiérrez** | Gestión Viáticos | Servidores Públicos | PUT (Intento de editar servidor) | 403 | **403** | Sin cambios en BD (Acceso denegado) | **PASS** |
| **Doris Cañón** | Gestión Horarios | Servidores Públicos | DELETE (Intento de borrar servidor) | 403 | **403** | Sin cambios en BD (Acceso denegado) | **PASS** |
| **Ángela Ussa** | Gestión Servidores | Servidores Públicos | DELETE (Eliminar servidor sintético) | 200 | **200** | Tupla eliminada limpiamente de PostgreSQL | **PASS** |
| **Doris Cañón** | Gestión Horarios | Horarios | POST (Crear acuerdo flexible) | 201 | **201** | Acuerdo creado con consecutivo en BD | **PASS** |
| **Doris Cañón** | Gestión Horarios | Horarios | PUT (Actualizar franja horaria) | 200 | **200** | Franja 07:30 persistida en PostgreSQL | **PASS** |
| **Ángela Ussa** | Gestión Servidores | Horarios | POST (Intento de crear acuerdo) | 403 | **403** | Sin cambios en BD (Acceso denegado) | **PASS** |
| **Bergenet Gutiérrez** | Gestión Viáticos | Horarios | PUT (Intento de editar acuerdo) | 403 | **403** | Sin cambios en BD (Acceso denegado) | **PASS** |
| **Blanca Soler** | Gestión Servidores | Horarios | DELETE (Intento de borrar acuerdo) | 403 | **403** | Sin cambios en BD (Acceso denegado) | **PASS** |
| **Doris Cañón** | Gestión Horarios | Horarios | DELETE (Eliminar acuerdo sintético) | 200 | **200** | Acuerdo eliminado limpiamente de PostgreSQL | **PASS** |
| **Bergenet Gutiérrez** | Gestión Viáticos | Viáticos | POST (Crear viático Radicado) | 201 | **201** | Viático creado con ID correlativo en BD | **PASS** |
| **Bergenet Gutiérrez** | Gestión Viáticos | Viáticos | PUT (Modificar destino a Duitama) | 200 | **200** | Destino y valor actualizados en BD | **PASS** |
| **Bergenet Gutiérrez** | Gestión Viáticos | Viáticos | PATCH (Aprobar comisión de viático) | 200 | **200** | Estado 'Aprobado' verificado en BD | **PASS** |
| **Ángela Ussa** | Gestión Servidores | Viáticos | POST (Intento de crear viático) | 403 | **403** | Sin cambios en BD (Acceso denegado) | **PASS** |
| **Doris Cañón** | Gestión Horarios | Viáticos | PUT (Intento de editar viático) | 403 | **403** | Sin cambios en BD (Acceso denegado) | **PASS** |
| **Blanca Soler** | Gestión Servidores | Viáticos | DELETE (Intento de borrar viático) | 403 | **403** | Sin cambios en BD (Acceso denegado) | **PASS** |
| **Bergenet Gutiérrez** | Gestión Viáticos | Viáticos | DELETE (Eliminar viático sintético) | 200 | **200** | Viático eliminado limpiamente de PostgreSQL | **PASS** |
| **Administrador** | Superusuario | Servidores Públicos | POST (Crear servidor) | 201 | **201** | Operación administrativa exitosa | **PASS** |
| **Administrador** | Superusuario | Horarios | POST (Crear horario) | 201 | **201** | Operación administrativa exitosa | **PASS** |
| **Administrador** | Superusuario | Viáticos | POST (Crear viático) | 201 | **201** | Operación administrativa exitosa | **PASS** |
| **Administrador** | Superusuario | Servidores / Horarios / Viáticos | DELETE (Eliminar registros creados) | 200 | **200** | Registros de prueba borrados de PostgreSQL | **PASS** |
| **4 Gestoras** | Roles de Módulo | Consulta Cruzada (GET) | GET listados en los 3 módulos (12 tests) | 200 | **200** | Acceso de solo lectura cross-module garantizado | **PASS** |

---

## 5. VALIDACIÓN DE INTERFAZ, PAGINACIÓN Y EXPORTACIÓN EXCEL (PRIORIDAD 5)

### 5.1. Pruebas de Exportación Filtrada vs PostgreSQL
Se ejecutó la suite `scratch/test_filtered_excel_and_integrity.js`, verificando que la descarga de archivos Excel incorpore **la totalidad de registros que cumplen los filtros activos** y no únicamente la página visible en el navegador:

```
=================================================================================================
MÓDULO              CRITERIO DE FILTRO            PÁGINA UI   TOTAL EXCEL   TOTAL BD   CONCORDANCIA
=================================================================================================
Servidores Públicos Dependencia: TESORERÍA GENERAL 10 regs     20 regs       20 regs    EXACTA (100%)
Horarios Especiales Modalidad: Horario flexible   10 regs     90 regs       90 regs    EXACTA (100%)
Viáticos            Paquete: 1 (Presupuesto 2025) 10 regs     1.181 regs    1.181 regs EXACTA (100%)
=================================================================================================
```

### 5.2. Protección contra Inyección de Fórmulas en Hojas de Cálculo (CWE-1236)
- Se verificó que el servicio `ExcelService` anteponga un apóstrofe de escape (`'`) a cualquier celda cuyo contenido inicie con caracteres ejecutables (`=`, `+`, `-`, `@`), neutralizando vectores de ataque de inyección de comandos DDE / Excel.

### 5.3. Navegación E2E en Navegador Real (Puppeteer / Chromium)
Se preservan las 14 evidencias visuales generadas en la carpeta `AUDITORIAS/capturas_e2e_final/`:
1. `01_login_pantalla_inicial.png`: Formulario de acceso institucional.
2. `02_admin_dashboard.png`: Vista consolidada de métricas globales.
3. `03_servidores_publicos_tabla.png`: Tabla general de servidores públicos.
4. `04_servidores_filtro_dependencia.png`: Filtros activos por dependencia en servidores.
5. `05_servidores_modal_edicion.png`: Formulario de edición integral de servidores.
6. `06_horarios_tabla_135_registros.png`: Visualización de los 135 acuerdos especiales.
7. `07_horarios_filtro_teletrabajo.png`: Segmentación por modalidad Teletrabajo (29 acuerdos).
8. `08_horarios_modal_import_excel.png`: Modal de importación de situaciones especiales.
9. `09_viaticos_tabla_consolidada.png`: Tabla general de viáticos con paginación fluida.
10. `10_viaticos_vigencia_2024.png`: Filtro por vigencia 2024.
11. `11_viaticos_vigencia_2023.png`: Filtro por vigencia 2023.
12. `12_angela_ussa_vista_servidores.png`: Interfaz autenticada de Ángela Ussa.
13. `13_doris_canon_vista_horarios.png`: Interfaz autenticada de Doris Cañón.
14. `14_bergenet_vista_viaticos.png`: Interfaz autenticada de Bergenet Gutiérrez.

---

## 6. LIMPIEZA Y RESTAURACIÓN DE DATOS SINTÉTICOS (SECCIÓN 9)

Al finalizar las suites de prueba, se verificó mediante consultas SQL directas la remoción total de todos los registros de prueba temporales:
- `personas`: **669 registros canónicos** (624 activas + 43 vacantes + 2 provisionales).
- `horarios`: **135 acuerdos especiales** (90 Flexibles, 29 Teletrabajo, 16 Casa, 0 Presenciales).
- `viaticos`: **8.248 comisiones históricas**.
- `paquetes_viaticos`: **7 paquetes presupuestales**.
- Claves foráneas huérfanas en toda la base de datos: **0**.

---

## 7. DICTAMEN TÉCNICO Y CLASIFICACIÓN FINAL (SECCIÓN 10.6)

En concordancia con los estándares de rigor técnico y auditoría pública:

| Componente Auditado | Dictamen Técnico | Sustento de la Calificación |
|---|---|---|
| **Seguridad y Autenticación** | **PASS** | Bypasses suprimidos, login unificado por hash bcrypt, bloqueo progresivo validado, secretos saneados en todo el repositorio. |
| **Censo de Servidores Públicos** | **PASS** | Reconciliación matemática de 670 filas del Excel contra 669 registros canónicos en PostgreSQL con justificación fila a fila. |
| **Integridad de Horarios** | **PASS** | 135 acuerdos activos preservados con 0 huérfanos, 3 cédulas corregidas, eliminación de creación stub y rechazo de personas inexistentes. |
| **Matriz RBAC (47 Operaciones)** | **PASS** | 100% de pruebas con códigos HTTP reales válidos (201, 200, 403) verificadas contra PostgreSQL. |
| **Exportación Excel y Filtros** | **PASS** | Concordancia de registros exportados contra PostgreSQL al 100%, sanitización contra fórmulas CWE-1236. |
| **Viáticos Presupuestales (8.248 Regs)** | **PENDING INSTITUTIONAL CONFIRMATION** | La plataforma almacena y opera fielmente los 8.248 registros por $1.882.517.569,50 COP. Sin embargo, la identidad física de los archivos 2022 y 2023 constituye un hallazgo documental que requiere pronunciamiento formal de la Gobernación de Boyacá para determinar si se reemplaza el archivo de 2022 o se consolida el reporte. |

### Conclusión Final de Entrega
La plataforma **Talento 360** se entrega en condiciones técnicas óptimas, con código estabilizado, base de datos libre de inconsistencias referenciales, módulos robustos y gobernanza de seguridad restaurada.

Todo el trabajo se encuentra estrictamente resguardado en la rama local **`audit/correccion-integridad-institucional`**, sin haberse realizado merges ni sincronizaciones no autorizadas a la rama `main` ni a servidores remotos, quedando a total disposición del equipo evaluador de la Gobernación de Boyacá.
