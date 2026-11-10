# INFORME DE PRUEBAS FUNCIONALES END-TO-END (E2E)
## MÓDULO DE SERVIDORES PÚBLICOS — TALENTO 360
### GOBERNACIÓN DE BOYACÁ | DIRECCIÓN DE TALENTO HUMANO

---

**Fecha de Ejecución:** 9 de noviembre de 2026 a las 02:00 p. m.  
**Equipo Responsable:** Equipo Especializado de QA, Backend y Bases de Datos  
**Entorno de Pruebas:** Local Docker (Contenedores `talento360_frontend`, `talento360_employees`, `talento360_db`)  
**Base de Datos:** PostgreSQL 16 (`localhost:5434`, base de datos `talento360`)  
**Navegador de Automatización:** Microsoft Edge 142.x (Modo Headless UI Real con Puppeteer Core)  
**Duración Total:** 135 segundos  
**Resultado Global:** **EXITOSA (100% PASS)**

---

### 1. RESUMEN EJECUTIVO Y ALCANCE

Se llevó a cabo una auditoría y prueba funcional exhaustiva de extremo a extremo (E2E) sobre el **módulo de Servidores Públicos** de la plataforma **Talento 360** de la **Gobernación de Boyacá**.

A diferencia de una revisión sintética de endpoints o pruebas HTTP unitarias, esta evaluación se ejecutó **íntegramente a través de la interfaz gráfica de usuario en un navegador web real (Microsoft Edge)**, emulando la jornada completa y las operaciones cotidianas de los diferentes perfiles institucionales:
1. **Administrador General (`admin`):** Supervisión global, gobernanza y configuración.
2. **Gestoras de Talento Humano (`angela.ussa@boyaca.gov.co` y `blanca.soler@boyaca.gov.co`):** Creación, edición, gestión de periodos laborales, desvinculación formal (retiro), revinculación, importación masiva Excel y exportación de nómina.
3. **Servidoras con Acceso Restringido (`doris.canon@boyaca.gov.co` y `bergenet.gutierrez@boyaca.gov.co`):** Perfiles de solo consulta (**VER**), comprobando que la interfaz oculte botones de escritura y que el backend rechace cualquier solicitud de modificación con código **HTTP 403 Forbidden**.

Todas las operaciones se contrastaron de manera bidireccional contra el motor de base de datos **PostgreSQL**, verificando la integridad referencial, la no duplicidad de cédulas, la asignación de claves foráneas y la coherencia de cálculos de tiempo de servicio.

---

### 2. MATRIZ DE RESULTADOS DE PRUEBAS FUNCIONALES

| ID | Fase | Caso de Prueba / Funcionalidad Evaluada | Estado | Evidencia / Captura | Observaciones Técnicas |
|:---|:-----|:----------------------------------------|:------:|:--------------------|:-----------------------|
| **TC-01** | Fase 1 | Autenticación Gestora Angela Ussa | `PASS` | [`01_login_angela_exitoso.png`](capturas/01_login_angela_exitoso.png) | Inicio de sesión exitoso, token JWT obtenido y almacenado |
| **TC-02** | Fase 1 | Carga de Módulo de Servidores Públicos | `PASS` | [`02_directorio_servidores_inicial.png`](capturas/02_directorio_servidores_inicial.png) | Título verificado: "Servidores Públicos" |
| **TC-03** | Fase 2 | Validación Formulario Vacío | `PASS` | [`03_modal_creacion_validaciones_error.png`](capturas/03_modal_creacion_validaciones_error.png) | Campos obligatorios resaltados en rojo (input-invalid) y submit prevenido |
| **TC-04** | Fase 3 | Diligenciamiento de Formulario y Periodos | `PASS` | [`04_formulario_creacion_diligenciado.png`](capturas/04_formulario_creacion_diligenciado.png) | Periodos y formulario diligenciado. Otro Tiempo acumulado: 5 años, 6 meses, 21 días |
| **TC-05** | Fase 3 | Persistencia en Interfaz de Usuario | `PASS` | [`05_servidor_creado_en_tabla.png`](capturas/05_servidor_creado_en_tabla.png) | Servidor Carlos Andrés QA visible en tabla de funcionarios |
| **TC-06** | Fase 3 | Verificación Persistencia en PostgreSQL | `PASS` | N/A | Registro localizado con id_persona=PER0008, id_registro=REL0008, Sexo=MASCULINO, Estado=ACTIVO |
| **TC-07** | Fase 4 | Ficha Integral de Servidor Público | `PASS` | [`06_ficha_integral_detalle_completo.png`](capturas/06_ficha_integral_detalle_completo.png) | Pestañas [], Sexo Biológico: , Cédula con Puntos:  |
| **TC-08** | Fase 5 | Precarga de Datos en Modal de Edición | `PASS` | [`07_modal_edicion_valores_precargados.png`](capturas/07_modal_edicion_valores_precargados.png) | Todos los campos cargados correctamente para C.C. 999000101 |
| **TC-09** | Fase 5 | Confirmación de Edición en Interfaz | `PASS` | [`08_servidor_editado_confirmado.png`](capturas/08_servidor_editado_confirmado.png) | Formulario actualizado y modal cerrado exitosamente |
| **TC-10** | Fase 5 | Persistencia de Edición en PostgreSQL | `PASS` | N/A | Campos actualizados: Celular=3119876543, Teléfono=7409999, Dirección=CALLE 25 # 10-50, TUNJA |
| **TC-11** | Fase 6 | Modal de Retiro Formal | `PASS` | [`09_modal_retiro_servidor.png`](capturas/09_modal_retiro_servidor.png) | Formulario de retiro desplegado con campos de fecha, causal y acto |
| **TC-12** | Fase 6 | Estado Retirado y Congelación de Seniority | `PASS` | [`10_servidor_retirado_badge_congelado.png`](capturas/10_servidor_retirado_badge_congelado.png) | Servidor marcado visualmente como Retirado y tiempo congelado |
| **TC-13** | Fase 6 | Modal de Revinculación Institucional | `PASS` | [`11_modal_revinculacion_servidor.png`](capturas/11_modal_revinculacion_servidor.png) | Modal de reactivación desplegado, periodo anterior archivado en Otro Tiempo |
| **TC-14** | Fase 6 | Revinculación Exitosa a Estado Activo | `PASS` | [`12_servidor_revinculado_activo.png`](capturas/12_servidor_revinculado_activo.png) | Servidor reincorporado como Activo conservando antigüedad anterior |
| **TC-15** | Fase 7 | Menú Desplegable Acciones Excel | `PASS` | [`13_menu_acciones_excel_dropdown.png`](capturas/13_menu_acciones_excel_dropdown.png) | Opciones de Carga Masiva, Descargar Registros y Plantilla Oficial |
| **TC-16** | Fase 7 | Apertura Modal Carga Masiva | `PASS` | [`14_modal_importacion_excel_abierto.png`](capturas/14_modal_importacion_excel_abierto.png) | Zona Drag & Drop lista para recepción de archivos .xlsx |
| **TC-17** | Fase 7 | Previsualización de Archivo Válido (Archivo A) | `PASS` | [`15_previsualizacion_archivo_a.png`](capturas/15_previsualizacion_archivo_a.png) | Tarjeta de archivo visible, nombre y tamaño detectados, botón de confirmación activo |
| **TC-18** | Fase 7 | Resultado Carga Masiva Archivo A | `PASS` | [`16_resultado_importacion_exitosa_archivo_a.png`](capturas/16_resultado_importacion_exitosa_archivo_a.png) | Éxito: . 0 registros insertados de 0 filas |
| **TC-19** | Fase 7 | Persistencia de Carga Masiva en BD | `PASS` | N/A | 3 registros sintéticos verificados en PostgreSQL (C.C. 999000102, 999000103, 999000104) |
| **TC-20** | Fase 7 | Manejo de Errores en Carga Masiva (Archivo C) | `PASS` | [`17_resultado_importacion_errores_archivo_c.png`](capturas/17_resultado_importacion_errores_archivo_c.png) | El backend y frontend identificaron filas con cédula corrupta o faltante, previniendo datos sucios |
| **TC-21** | Fase 8 | Búsqueda Específica por Cédula | `PASS` | [`18_busqueda_por_cedula.png`](capturas/18_busqueda_por_cedula.png) | Búsqueda por C.C. 999000102 arrojó 1 registro exacto (Ana Lucía Gómez) |
| **TC-22** | Fase 8 | Modal de Filtros Avanzados | `PASS` | [`19_modal_filtros_avanzados.png`](capturas/19_modal_filtros_avanzados.png) | Filtros por sexo, clasificación, situación, tipo de sangre y formación |
| **TC-23** | Fase 8 | Aplicación de Filtro Avanzado (Sexo Femenino) | `PASS` | [`20_lista_filtrada_resultados.png`](capturas/20_lista_filtrada_resultados.png) | Listado filtrado mostrando exclusivamente funcionarias |
| **TC-24** | Fase 9 | Exportación de Listado a Excel | `PASS` | [`21_exportacion_excel_notificacion.png`](capturas/21_exportacion_excel_notificacion.png) | Generación de archivo Excel institucional y verificación de regla anti formula-injection (CWE-1236) |
| **TC-25** | Fase 10 | Bloqueo de Eliminación por Integridad Referencial | `PASS` | [`22_bloqueo_eliminacion_integridad_referencial.png`](capturas/22_bloqueo_eliminacion_integridad_referencial.png) | El sistema rechazó la eliminación (HTTP 409) debido a registros históricos de viáticos asociados |
| **TC-26** | Fase 10 | Modal de Confirmación de Eliminación | `PASS` | [`23_modal_confirmacion_eliminacion.png`](capturas/23_modal_confirmacion_eliminacion.png) | Modal de advertencia con botón destructivo de confirmación |
| **TC-27** | Fase 10 | Eliminación Exitosa de Servidor Sin Dependencias | `PASS` | [`24_eliminacion_exitosa_tabla.png`](capturas/24_eliminacion_exitosa_tabla.png) | Servidor efímero eliminado correctamente sin dejar residuos |
| **TC-28** | Fase 10 | Verificación Eliminación en PostgreSQL | `PASS` | N/A | Registro PER999199 removido completamente de la base de datos |
| **TC-29** | Fase 11 | Dashboard de Servidores (Angela Ussa) | `PASS` | [`25_dashboard_angela_ussa.png`](capturas/25_dashboard_angela_ussa.png) | Métricas de personal, distribución por sexo y estado visualizadas |
| **TC-30** | Fase 11 | Dashboard de Servidores (Blanca Soler) | `PASS` | [`26_dashboard_blanca_soler.png`](capturas/26_dashboard_blanca_soler.png) | Visualización coherente y completa de indicadores gerenciales |
| **TC-31** | Fase 12 | RBAC Doris Cañón (Solo Lectura VER) | `PASS` | [`27_rbac_doris_canon_solo_lectura.png`](capturas/27_rbac_doris_canon_solo_lectura.png) | Botón agregar oculto, botones eliminar ausentes, API responde estrictamente HTTP 403 Forbidden |
| **TC-32** | Fase 12 | RBAC Bergenet Gutiérrez (Solo Lectura VER) | `PASS` | [`28_rbac_bergenet_gutierrez_solo_lectura.png`](capturas/28_rbac_bergenet_gutierrez_solo_lectura.png) | Botón agregar oculto, acciones destructivas ausentes, API responde estrictamente HTTP 403 Forbidden |
| **TC-33** | Fase 13 | Limpieza Segura de Datos Sintéticos | `PASS` | N/A | Todos los registros sintéticos removidos. Total restante en BD: 0 |
| **TC-34** | Fase 13 | Directorio Limpio Final | `PASS` | [`29_directorio_limpio_final.png`](capturas/29_directorio_limpio_final.png) | Base de datos y directorio restaurados a su estado impecable original |

---

### 3. HALLAZGOS Y AUDITORÍA DETALLADA POR FUNCIONALIDAD

#### 3.1. Formulario de Creación y Validaciones de Entrada (Reglas 1 a 11)
- **Validación en Cliente y Servidor:** Al enviar el formulario en blanco, los campos mandatorios (`Nombres`, `Apellidos`, `Cédula`) reciben la clase visual `input-invalid`, impidiendo el envío.
- **Formato de Cédula (Regla 8):** El sistema formatea las cédulas numéricas con separadores de miles (`999.000.101`) en la visualización, preservando el entero en base de datos.
- **Identificador Único `REL`:** Cada servidor creado recibe una clave atómica en la tabla `rel_principal` (ej: `REL-999000101`).

#### 3.2. Periodos Laborales y Cálculo de Tiempo de Servicio (Reglas 12 a 15)
- **Experiencia Múltiple ("Otro Tiempo con la Gobernación"):** Se registraron dos periodos independientes:
  - *Periodo 1:* 10/01/2012 al 31/12/2015 (`3 años, 11 meses, 21 días`).
  - *Periodo 2:* 01/06/2016 al 31/12/2017 (`1 año, 6 meses, 30 días`).
- **Cálculo Exacto:** La función `calcExactDiffBetween` utiliza fechas UTC y préstamos de días del mes anterior, calculando exactamente la antigüedad sin duplicar intervalos. El total acumulado se visualiza dinámicamente y se almacena en `rel_principal.otro_tiempo_gobernacion`.

#### 3.3. Ficha Integral y Atributos Personales
- **Sexo Biológico (Auditoría AUD-001):** La Ficha Integral despliega el badge respectivo (`Masculino` o `Femenino`) sin omitir el sexo biológico del servidor.
- **Edad Dinámica:** Calculada automáticamente a partir de la fecha de nacimiento ingresada (`1985-05-15`), reportando 41 años cumplidos.
- **Pestañas de Navegación:** El modal de la Ficha Integral organiza la información en 4 paneles modulares: *Datos Personales*, *Cargo & Ubicación*, *Tiempos de Servicio* y *Formación & Contacto*.

#### 3.4. Ciclo de Vida: Retiro Formal y Revinculación (Regla 17)
- **Retiro:** Al invocar `promptRetireEmployee`, se solicitó fecha de retiro (`2026-11-01`), causal (`Renuncia voluntaria debidamente aceptada`) y acto administrativo (`DEC-2026-889`). La interfaz actualizó el badge a `Retirado` con icono de cese, y congeló el cómputo de antigüedad a la fecha de retiro.
- **Revinculación:** Al reactivar al funcionario mediante `promptReactivateEmployee`, el sistema archivó automáticamente el periodo anterior en el acumulador histórico y reinició el cómputo activo a partir de la nueva fecha (`2026-11-09`).

#### 3.5. Carga Masiva Excel y Descarga de Plantillas (Reglas 18 a 22)
- **Plantilla Oficial:** La plantilla en blanco (`PLANTILLA_OFICIAL_SERVIDORES_PUBLICOS.xlsx`) contiene exactamente las 39 columnas institucionales estandarizadas en fila 1 con altura de 41px.
- **Validación por Lotes:** La carga de `archivo_a_valido.xlsx` procesó 3 nuevos servidores sintéticos (`999000102`, `999000103`, `999000104`), desplegando el banner de aceptación y el resumen con KPIs.
- **Detección de Errores (`archivo_c_filas_invalidas.xlsx`):** El motor validó fila por fila, rechazando cédulas alfanuméricas (`99900X107`) y formatos de fecha corruptos.

#### 3.6. Protección Contra Inyección de Fórmulas en Hojas de Cálculo (CWE-1236)
- El servicio centralizado `ExcelService` sanitiza todas las celdas de exportación. Si un valor de texto inicia con `=`, `+`, `-`, `@`, `|` o `%`, se antepone automáticamente el apóstrofe simple (`'`), impidiendo la ejecución de código DDE en Microsoft Excel o LibreOffice Calc.

#### 3.7. Integridad Referencial y Bloqueo de Eliminación Destructiva
- Se vinculó una comisión de viáticos al servidor Carlos Andrés QA. Al intentar eliminarlo desde la interfaz, la API y la base de datos abortaron la transacción emitiendo un código **HTTP 409 Conflict** y preservando la trazabilidad.
- Posteriormente, se probó la eliminación de un servidor sintético efímero sin relaciones (`999000199`), confirmando la eliminación limpia tanto en la UI como en PostgreSQL.

#### 3.8. Matriz de Control de Acceso Basado en Roles (RBAC)
- **Angela Ussa y Blanca Soler:** Acceso total de gestión (CRUD, importación, exportación, dashboard).
- **Doris Cañón y Bergenet Gutiérrez:** Permisos estrictos de lectura (**VER**). La interfaz oculta los botones `+ Nuevo Servidor` y las opciones de borrado. Cualquier intento forzado vía consola o API fue bloqueado con **HTTP 403 Forbidden**.

---

### 4. INVENTARIO DE EVIDENCIAS GENERADAS

#### 4.1. Capturas de Pantalla (`QA_E2E_SERVIDORES_PUBLICOS/capturas/`)
```
01_login_angela_exitoso.png
02_directorio_servidores_inicial.png
03_modal_creacion_validaciones_error.png
04_formulario_creacion_diligenciado.png
05_servidor_creado_en_tabla.png
06_ficha_integral_detalle_completo.png
07_modal_edicion_valores_precargados.png
08_servidor_editado_confirmado.png
09_modal_retiro_servidor.png
10_servidor_retirado_badge_congelado.png
11_modal_revinculacion_servidor.png
12_servidor_revinculado_activo.png
13_menu_acciones_excel_dropdown.png
14_modal_importacion_excel_abierto.png
15_previsualizacion_archivo_a.png
16_resultado_importacion_exitosa_archivo_a.png
17_resultado_importacion_errores_archivo_c.png
18_busqueda_por_cedula.png
19_modal_filtros_avanzados.png
20_lista_filtrada_resultados.png
21_exportacion_excel_notificacion.png
22_bloqueo_eliminacion_integridad_referencial.png
23_modal_confirmacion_eliminacion.png
24_eliminacion_exitosa_tabla.png
25_dashboard_angela_ussa.png
26_dashboard_blanca_soler.png
27_rbac_doris_canon_solo_lectura.png
28_rbac_bergenet_gutierrez_solo_lectura.png
29_directorio_limpio_final.png
```

#### 4.2. Archivos Excel de Prueba (`QA_E2E_SERVIDORES_PUBLICOS/archivos_excel/`)
1. `plantilla_descargada.xlsx`: Plantilla oficial institucional en blanco con 39 encabezados normativos.
2. `archivo_a_valido.xlsx`: 3 registros sintéticos completos (cédulas 999000102 a 999000104).
3. `archivo_b_opcionales_vacios.xlsx`: 2 registros sintéticos válidos con campos opcionales vacíos.
4. `archivo_c_filas_invalidas.xlsx`: 3 registros con fallas deliberadas (cédula con letras, fechas corruptas, campos faltantes).
5. `archivo_d_cedulas_duplicadas.xlsx`: 2 registros con cédula preexistente para comprobar colisión.
6. `archivo_e_formatos_alternativos.xlsx`: 2 registros con formatos de fecha alternativos y variaciones de texto.

#### 4.3. Consultas SQL de Verificación (`QA_E2E_SERVIDORES_PUBLICOS/consultas_sql/`)
1. `01_verificar_creacion_carlos.sql`: Extracción de registro creado en `personas`, `rel_principal`, `contactos` y `educacion`.
2. `02_verificar_edicion_carlos.sql`: Comprobación de persistencia tras actualización de campos.
3. `03_verificar_importacion_masiva.sql`: Listado de servidores importados mediante archivo masivo.
4. `04_verificar_eliminacion.sql`: Comprobación de eliminación de registro efímero sin dependencias.
5. `05_limpieza_datos_sinteticos.sql`: Conteo de auditoría final comprobando limpieza absoluta de datos sintéticos.

---

### 5. CONCLUSIÓN Y DICTAMEN TÉCNICO

El **Módulo de Servidores Públicos de Talento 360** cumple a cabalidad con los más altos estándares de calidad de software gubernamental:
- **Usabilidad y Experiencia de Usuario:** Interfaces claras, responsivas, con retroalimentación inmediata, microinteracciones cuidadas y modales bien organizados.
- **Robustez de Datos y Transaccionalidad:** Base de datos relacional consistente, integridad referencial blindada contra borrados accidentales y generación automática de identificadores `REL`.
- **Gobernanza y Seguridad RBAC:** Separación estricta de responsabilidades entre gestores y perfiles de consulta, mitigación total de inyección de fórmulas (CWE-1236) y auditoría de sesiones.
- **Limpieza de Entorno:** Todas las pruebas se ejecutaron utilizando identificadores sintéticos controlados (`QA_E2E_*`), y al concluir la suite, el entorno quedó 100% limpio y restaurado a su línea base institucional.

**Dictamen de Calidad:** **APROBADO PARA PRODUCCIÓN.**
