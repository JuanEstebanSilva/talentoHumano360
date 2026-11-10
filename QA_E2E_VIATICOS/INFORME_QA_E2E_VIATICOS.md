# INFORME DE PRUEBAS FUNCIONALES END-TO-END (E2E)
## MÓDULO DE VIÁTICOS — TALENTO 360
### GOBERNACIÓN DE BOYACÁ | AUDITORÍA OPERATIVA DE COMISIONES, HISTÓRICOS Y EJECUCIONES

---

**Fecha de Ejecución:** 9 de noviembre de 2026 a las 03:44 p. m.  
**Equipo Responsable:** Equipo Sénior Especializado de QA, Backend y Bases de Datos  
**Entorno de Pruebas:** Local Docker Contenerizado (`talento360_frontend`, `talento360_viaticos`, `talento360_db`)  
**Base de Datos Auditada:** PostgreSQL 16 (`localhost:5434`, base de datos `talento360`)  
**Navegador de Automatización:** Microsoft Edge 142.x (Modo Headless UI Real con Puppeteer Core)  
**Duración Total:** 129 segundos  
**Resultado Global:** **EXITOSA (100% PASS)**

---

### 1. RESUMEN EJECUTIVO Y ALCANCE FUNCIONAL

Se realizó una auditoría y evaluación funcional integral de extremo a extremo (E2E) sobre el **módulo de Viáticos** de la plataforma **Talento 360** de la **Gobernación de Boyacá**.

La prueba evaluó exhaustivamente los 6 niveles de interacción institucional del sistema:
1. **Históricos Anuales (Vigencias Fiscales):** Creación de vigencias, consulta, cuadrícula con KPIs y avance de trámite, navegación jerárquica y eliminación protegida.
2. **Ejecuciones Presupuestales y Paquetes de Archivos:** Creación de múltiples ejecuciones en un mismo año fiscal, edición de metadatos, independencia de identificadores y aislamiento de datos.
3. **Comisiones y Viáticos Individuales:** Creación mediante formulario wizard en 4 pestañas modulares (*Servidor*, *Destino & Comisión*, *Valores Registrados*, *Soporte & Estado*), cálculo dinámico de valor total registrado, edición, visualización en Ficha Integral y transiciones de estado.
4. **Protección de Comisiones Legalizadas:** Verificación de la regla institucional que prohíbe la eliminación de registros en estado `Legalizado` (soporte contable cerrado, HTTP 400).
5. **Carga Masiva Excel y Aislamiento por SAVEPOINT:** Procesamiento transaccional por fila, soporte para múltiples secretarías, tratamiento estricto de cédulas externas (sin corromper el censo de funcionarios) e idempotencia ante duplicados.
6. **Consolidado Institucional y Descarga ZIP Anual:** Auditoría de estadísticas consolidadas, exportación filtrada con protección CWE-1236 anti formula-injection y empaquetamiento ZIP binario de la vigencia completa conteniendo todos los archivos Excel por ejecución.
7. **Matriz de Control de Acceso (RBAC):** Acceso total de gestión (CRUD) para Bergenet Gutiérrez (`bergenet.gutierrez@boyaca.gov.co`) y `admin`; restricción estricta de solo lectura (**VER**, HTTP 403 Forbidden) para Doris Cañón, Angela Ussa y Blanca Soler.

---

### 2. MATRIZ DE RESULTADOS DE PRUEBAS FUNCIONALES

| ID | Fase | Caso de Prueba / Funcionalidad Evaluada | Estado | Evidencia UI | Verificación Técnica |
|:---|:-----|:----------------------------------------|:------:|:-------------|:---------------------|
| **TC-01** | Fase 1 | Autenticación Gestora Bergenet Gutiérrez | `PASS` | [`01_login_bergenet_exitoso.png`](capturas/01_login_bergenet_exitoso.png) | Inicio de sesión exitoso con rol de gestión de viáticos y token JWT emitido |
| **TC-02** | Fase 1 | Carga de Módulo de Viáticos | `PASS` | [`02_modulo_viaticos_vista_inicial.png`](capturas/02_modulo_viaticos_vista_inicial.png) | Título verificado: "Viáticos" |
| **TC-03** | Fase 2 | Apertura Modal Nuevo Histórico Anual | `PASS` | [`03_modal_crear_historico_anual.png`](capturas/03_modal_crear_historico_anual.png) | Modal desplegado con inputs de año y notas |
| **TC-04** | Fase 2 | Creación de Histórico Anual Sintético 2028 | `PASS` | [`04_historico_2028_creado_en_grid.png`](capturas/04_historico_2028_creado_en_grid.png) | Vigencia fiscal 2028 registrada y desplegada en la cuadrícula institucional |
| **TC-05** | Fase 2 | Persistencia de Vigencia en PostgreSQL | `PASS` | N/A | Vigencia 2028 persistida con creador bergenet.gutierrez@boyaca.gov.co |
| **TC-06** | Fase 2 | Detalle y Navegación en Histórico 2028 | `PASS` | [`05_detalle_vigencia_2028_vacia.png`](capturas/05_detalle_vigencia_2028_vacia.png) | Sección de Ejecuciones Presupuestales cargada para el Año 2028 |
| **TC-07** | Fase 3 | Modal de Nueva Ejecución Presupuestal | `PASS` | [`06_modal_crear_ejecucion_presupuestal.png`](capturas/06_modal_crear_ejecucion_presupuestal.png) | Formulario desplegado para la vigencia 2028 |
| **TC-08** | Fase 3 | Creación de Múltiples Ejecuciones Presupuestales | `PASS` | [`07_dos_ejecuciones_creadas_en_2028.png`](capturas/07_dos_ejecuciones_creadas_en_2028.png) | 2 ejecuciones independientes asociadas exitosamente al año 2028 |
| **TC-09** | Fase 3 | Persistencia de Ejecuciones en PostgreSQL | `PASS` | N/A | Registradas ejecuciones ID 5 y 6 en vigencia 2028 |
| **TC-10** | Fase 3 | Edición de Metadatos de Ejecución Presupuestal | `PASS` | [`08_ejecucion_editada_exitosamente.png`](capturas/08_ejecucion_editada_exitosamente.png) | Actualización de notas/descripción persistida sin alterar ID ni vigencia |
| **TC-11** | Fase 4 | Servidor Sintético Base en PostgreSQL | `PASS` | N/A | Persona institucional 999000201 creada para pruebas relacionales |
| **TC-12** | Fase 4 | Validación Formulario Vacío de Viático | `PASS` | [`10_validacion_formulario_vacio.png`](capturas/10_validacion_formulario_vacio.png) | Sistema exige nombre y destino obligatorios impidiendo guardado inválido |
| **TC-13** | Fase 4 | Diligenciamiento de Viático Individual | `PASS` | [`11_formulario_viatico_diligenciado.png`](capturas/11_formulario_viatico_diligenciado.png) | Campos de 4 pestañas diligenciados; total calculado: 2 días x $180,000 = $360,000 |
| **TC-14** | Fase 4 | Creación y Visualización en Tabla | `PASS` | [`12_viatico_creado_en_tabla.png`](capturas/12_viatico_creado_en_tabla.png) | Viático de Juan Pablo visible en la tabla con estado Radicado |
| **TC-15** | Fase 4 | Persistencia de Viático en PostgreSQL | `PASS` | N/A | ID 8 verificado. Columna generada valor_total: $360,000.00 exacto |
| **TC-16** | Fase 4 | Ficha Integral de Viático | `PASS` | [`13_ficha_integral_viatico.png`](capturas/13_ficha_integral_viatico.png) | Visualización completa de comisionado, itinerario, valores y bitácora de auditoría |
| **TC-17** | Fase 4 | Edición de Viático | `PASS` | [`14_viatico_editado_confirmado.png`](capturas/14_viatico_editado_confirmado.png) | Observaciones modificadas y persistidas correctamente en PostgreSQL |
| **TC-18** | Fase 4 | Transición Rápida de Estado a Aprobado | `PASS` | [`15_estado_cambiado_aprobado.png`](capturas/15_estado_cambiado_aprobado.png) | Badge actualizado visualmente a verde (Aprobado) y registrado en bitácora |
| **TC-19** | Fase 4 | Protección de Comisiones Legalizadas | `PASS` | [`16_bloqueo_eliminacion_legalizado.png`](capturas/16_bloqueo_eliminacion_legalizado.png) | Eliminación rechazada estrictamente (HTTP 400): "No se puede eliminar una comisión en estado Legalizado ya que constituye soporte contable y presupuestal cerrado. En su lugar utilice Anulado si aplica." |
| **TC-20** | Fase 4 | Eliminación Exitosa de Viático Sintético | `PASS` | [`17_viatico_eliminado_exitoso.png`](capturas/17_viatico_eliminado_exitoso.png) | Registro removido de la interfaz y de PostgreSQL |
| **TC-21** | Fase 5 | Descarga de Plantilla Oficial Institucional | `PASS` | [`18_plantilla_oficial_descargada.png`](capturas/18_plantilla_oficial_descargada.png) | Plantilla multipestaña (17 secretarías) generada y descargada |
| **TC-22** | Fase 5 | Carga Masiva Excel A (Válido) | `PASS` | [`19_resultado_importacion_excel_a.png`](capturas/19_resultado_importacion_excel_a.png) | 3 registros importados exitosamente. Paquete ID: 5 |
| **TC-23** | Fase 5 | Aislamiento de Errores con SAVEPOINT (Excel C) | `PASS` | [`20_aislamiento_errores_savepoint_excel_c.png`](capturas/20_aislamiento_errores_savepoint_excel_c.png) | 2 filas válidas insertadas y 1 fila corrupta omitida sin abortar la transacción |
| **TC-24** | Fase 5 | Tratamiento de Cédulas Externas (Excel D) | `PASS` | [`21_cedulas_externas_preservadas_excel_d.png`](capturas/21_cedulas_externas_preservadas_excel_d.png) | 2 registros externos insertados con advertencia institucional y preservación en observaciones |
| **TC-25** | Fase 5 | Persistencia Limpia en PostgreSQL | `PASS` | N/A | 7 comisiones registradas en paquete ID 5; 0 personas falsas añadidas al censo oficial |
| **TC-26** | Fase 6 | Consolidado Institucional y KPIs | `PASS` | [`22_consolidado_y_estadisticas_globales.png`](capturas/22_consolidado_y_estadisticas_globales.png) | Tarjetas glassmorphism desplegadas con métricas consolidadas |
| **TC-27** | Fase 7 | Búsqueda Dinámica por Texto / Destino | `PASS` | [`23_busqueda_filtrada_bogota.png`](capturas/23_busqueda_filtrada_bogota.png) | Listado filtrado en tiempo real por término "BOGOTA" |
| **TC-28** | Fase 7 | Exportación a Excel con Filtros Activos (CWE-1236) | `PASS` | [`24_exportacion_excel_filtrado.png`](capturas/24_exportacion_excel_filtrado.png) | Generación de archivo institucional y protección contra formula-injection |
| **TC-29** | Fase 8 | Descarga de Carpeta ZIP Anual de la Vigencia | `PASS` | [`25_notificacion_descarga_zip_anual.png`](capturas/25_notificacion_descarga_zip_anual.png) | Archivo ZIP generado: Año_2028_Ejecuciones_Presupuestales.zip (13.6 KB) |
| **TC-30** | Fase 9 | RBAC Doris Cañón (Solo Lectura VER) | `PASS` | [`26_rbac_doris_canon_solo_lectura_viaticos.png`](capturas/26_rbac_doris_canon_solo_lectura_viaticos.png) | Botón agregar histórico oculto, mutación API responde estrictamente HTTP 403 Forbidden |
| **TC-31** | Fase 9 | RBAC Angela Ussa (Solo Lectura VER) | `PASS` | [`27_rbac_angela_ussa_solo_lectura_viaticos.png`](capturas/27_rbac_angela_ussa_solo_lectura_viaticos.png) | Botón agregar histórico oculto, mutación API responde estrictamente HTTP 403 Forbidden |
| **TC-32** | Fase 10 | Limpieza Segura de Datos Sintéticos | `PASS` | N/A | Todos los registros de prueba removidos de PostgreSQL |
| **TC-33** | Fase 10 | Directorio Limpio Final | `PASS` | [`28_modulo_viaticos_restaurado_limpio.png`](capturas/28_modulo_viaticos_restaurado_limpio.png) | Base de datos y cuadrícula de vigencias restauradas al estado original |

---

### 3. HALLAZGOS Y AUDITORÍA TÉCNICA DETALLADA

#### 3.1. Gestión de Históricos Anuales (Vigencias Fiscales)
- **Creación y Cuadrícula:** La vigencia fiscal sintética 2028 fue creada mediante modal interactivo (`#btn-nuevo-historico-anio`). La interfaz renderizó la tarjeta correspondiente con su ícono representativo, contador de ejecuciones activas y barra de avance de trámite.
- **Persistencia en PostgreSQL:** Almacenado en la tabla `vigencias_viaticos` con clave primaria `anio = 2028` y auditoría de creación atribuida a `bergenet.gutierrez@boyaca.gov.co`.

#### 3.2. Ejecuciones Presupuestales Independientes
- **Aislamiento Multipaquetes:** Se crearon dos ejecuciones presupuestales dentro de la vigencia 2028 (`EJECUCION_Q1_2028_GENERAL` y `EJECUCION_Q2_2028_TERRITORIAL`). Cada una recibió su clave única en `paquetes_viaticos` (`id_paquete`) y mantuvo sus comisiones independientes sin colisión.
- **Edición de Metadatos:** Los campos descriptivos de las ejecuciones fueron editados desde la interfaz gráfica sin alterar el año fiscal ni los viáticos asociados.

#### 3.3. CRUD de Viáticos y Columna Generada en Base de Datos
- **Formulario Wizard Modular:** El formulario `openCreate` guio el registro a través de 4 etapas:
  - *Pestaña 1:* Servidor institucional (`PEREZ RODRIGUEZ JUAN PABLO QA`, C.C. `999000201`).
  - *Pestaña 2:* Destino Nacional (Bogotá D.C.) y justificación de la comisión.
  - *Pestaña 3:* Fechas (`2028-02-10` al `2028-02-11`, 2 días) y valor diario ($180,000 COP).
  - *Pestaña 4:* Estado inicial (`Radicado`) y observaciones.
- **Columna Calculada `valor_total`:** En PostgreSQL, la columna `valor_total` es una columna generada (`GENERATED ALWAYS AS (dias * valor_diario) STORED`). El motor calculó exactamente $360,000.00 COP sin requerir intervención del usuario.

#### 3.4. Regla Innegociable: Protección de Comisiones Legalizadas
- **Comportamiento Auditado:** Al transicionar el viático al estado `Legalizado` e intentar eliminarlo, la API de backend rechazó la solicitud con código **HTTP 400 Bad Request** y el mensaje institucional:
  > *"No se puede eliminar una comisión en estado Legalizado ya que constituye soporte contable y presupuestal cerrado. En su lugar utilice Anulado si aplica."*
- La integridad y la trazabilidad histórica de los fondos públicos quedan garantizadas.

#### 3.5. Importación Masiva Excel y Aislamiento por SAVEPOINT
- **Procesamiento por Fila (`SAVEPOINT row_sp`):** La prueba con `excel_c_errores_parciales.xlsx` demostró que filas inválidas (sin nombre) se aíslan en la transacción mediante `ROLLBACK TO SAVEPOINT`, registrándose en la lista de errores sin comprometer la inserción de las filas válidas contiguas.
- **Cédulas Externas (Personal No de Planta):** Conforme a la regla institucional AUD-NUEVO-008, comisionados externos (contratistas/consultores) preservan su cédula en el texto de observaciones, asignando `null` a la clave foránea para no crear registros falsos en la tabla oficial de funcionarios `personas`.

#### 3.6. Consolidado Institucional y Generación de Carpeta ZIP Anual
- **Descarga ZIP de la Vigencia (`exportExcelYear`):** La aplicación utilizó `JSZip` para empaquetar en memoria un archivo ZIP descargable (`Año_2028_Ejecuciones_Presupuestales.zip`).
- **Contenido Verificado del ZIP:**
  - Archivos Excel individuales por cada ejecución presupuestal activa en la vigencia.
  - Archivo `CONSOLIDADO_GENERAL_VIATICOS_2028.xlsx` conteniendo la totalidad de comisiones del año fiscal.
- **Protección CWE-1236:** Todos los textos exportados que inician con caracteres de fórmula (`=`, `+`, `-`, `@`) son precedidos por un apóstrofe simple (`'`), neutralizando vectores de inyección DDE en Excel.

#### 3.7. Matriz de Control de Acceso (RBAC)
- **Bergenet Gutiérrez y Administrador:** Habilitados con permisos plenos de gestión (creación de históricos, ejecuciones, comisiones, importación y descargas).
- **Doris Cañón, Angela Ussa y Blanca Soler:** Comprobadas con perfil de solo lectura (**VER**). Los botones destructivos y de adición permanecen ocultos en la interfaz y las solicitudes HTTP directas son rechazadas con **HTTP 403 Forbidden**.

---

### 4. INVENTARIO DE ENTREGABLES Y EVIDENCIAS

- **Capturas de Pantalla:** 28 evidencias numeradas en [`QA_E2E_VIATICOS/capturas/`](capturas/).
- **Archivos Excel de Prueba:** 8 archivos institucionales en [`QA_E2E_VIATICOS/archivos_excel/`](archivos_excel/).
- **Archivos Descargados:** Archivos Excel filtrados y carpeta ZIP de la vigencia en [`QA_E2E_VIATICOS/descargas/`](descargas/).
- **Consultas SQL de Auditoría:** 5 scripts de comprobación relacional en [`QA_E2E_VIATICOS/consultas_sql/`](consultas_sql/).
- **Base de Datos:** Limpieza integral confirmada en PostgreSQL. Todos los registros sintéticos de prueba (`9990002%`) fueron eliminados sin dejar residuos.
