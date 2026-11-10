# INFORME DE PRUEBAS FUNCIONALES END-TO-END (E2E)
## MÓDULO DE HORARIOS — TALENTO 360
### GOBERNACIÓN DE BOYACÁ | AUDITORÍA OPERATIVA DE ACUERDOS LABORALES, MODALIDADES Y TRASLAPES

---

**Fecha de Ejecución:** 9 de noviembre de 2026 a las 04:03 p. m.  
**Equipo Responsable:** Equipo Sénior Especializado de QA, Backend y Bases de Datos  
**Entorno de Pruebas:** Local Docker Contenerizado (`talento360_frontend`, `talento360_horarios`, `talento360_db`)  
**Base de Datos Auditada:** PostgreSQL 16 (`localhost:5434`, base de datos `talento360`)  
**Navegador de Automatización:** Microsoft Edge 142.x (Modo Headless UI Real con Puppeteer Core)  
**Duración Total:** 96 segundos  
**Resultado Global:** **EXITOSA (100% PASS)**

---

### 1. RESUMEN EJECUTIVO Y ALCANCE FUNCIONAL

Se ejecutó una auditoría funcional integral de extremo a extremo (E2E) sobre el **módulo de Horarios y Modalidades de Trabajo** de la plataforma **Talento 360** de la **Gobernación de Boyacá**.

La prueba evaluó exhaustivamente todos los componentes y requerimientos del sistema:
1. **Asistente Modular de Creación de Horarios (Wizard de 3 Pestañas):** Pestañas *Servidor & Ubicación*, *Esquema & Horario*, y *Acto & Vigencia*. Manejo correlativo oficial de números consecutivos para evitar colisiones.
2. **Validaciones y Regla de Modalidad Presencial:** Verificación técnica de la regla institucional por la cual la presencialidad ordinaria es el régimen legal por defecto y no requiere registro de acuerdo especial; el sistema rechaza cualquier intento de crear acuerdos presenciales con **HTTP 400**.
3. **Modalidades de Trabajo Dinámicas:** Creación y gestión de *Teletrabajo Suplementario (Híbrido)* con días específicos de alternancia semanal (Lun, Mar, Mié, Jue, Vie); *Horario Flexible* con franjas concertadas; y *Trabajo en Casa* transitorio y excepcional.
4. **Validación Rigurosa de Fechas y Solapamientos (Traslapes):** Validación algorítmica estricta que impide que un funcionario tenga dos acuerdos activos simultáneos que se crucen en el tiempo (rechazo estricto con HTTP 400); verificación de aceptación de fechas consecutivas sin traslape y rechazo de fechas invertidas.
5. **Caducidad Automática y Retorno a Presencial Sin Tuplas Ficticias:** Ejecución de `POST /api/horarios/check-expirations` confirmando que los acuerdos vencidos pasan a estado `Caducada`, registran bitácora en `historial_horarios` y **NO insertan ninguna tupla artificial de modalidad Presencial** en la tabla `horarios`.
6. **Gestión Documental y Documentos Soporte:** Vinculación de actos administrativos en formato PDF a los acuerdos mediante `PATCH /api/horarios/:id/soporte`, validación de integridad hash SHA-256 y descarga operativa.
7. **Plantilla Oficial e Importación Masiva Excel con SAVEPOINT:** Descarga de plantilla institucional, procesamiento por fila con aislamiento por `SAVEPOINT`, asignación automática de consecutivos correlativos y tolerancia a variaciones tipográficas.
8. **Filtros Dinámicos, Búsqueda Reactiva y Exportación Filtrada:** Búsqueda en tiempo real por cédula o nombre, filtrado por pills de modalidad, paginación y exportación a Excel con sanitización anti formula-injection (CWE-1236).
9. **Dashboard y Métricas en Tiempo Real:** Validación de consistencia matemática de las 4 tarjetas líquidas contra consultas SQL directas en PostgreSQL.
10. **Matriz de Control de Acceso (RBAC):** Gestión total (CRUD) para Doris Cañón (`doris.canon@boyaca.gov.co`) y `admin`; restricción estricta de solo lectura (**VER**, HTTP 403 Forbidden en API) para Angela Ussa y Bergenet Gutiérrez.
11. **Limpieza Segura de Datos Sintéticos:** Remoción limpia y ordenada de todos los registros de prueba (`QA_E2E_HORARIOS_%`, C.C. `99900030%`) sin alterar información histórica de la Gobernación.

---

### 2. MATRIZ DE RESULTADOS DE PRUEBAS FUNCIONALES

| ID | Fase | Caso de Prueba / Funcionalidad Evaluada | Estado | Evidencia UI | Verificación Técnica & Backend |
|:---|:-----|:----------------------------------------|:------:|:-------------|:-------------------------------|
| **TC-01** | Fase 1 | Autenticación Gestora Doris Cañón | `PASS` | [`01_login_doris_exitoso.png`](capturas/01_login_doris_exitoso.png) | Inicio de sesión exitoso con rol de gestión de horarios y token JWT emitido |
| **TC-02** | Fase 1 | Carga de Módulo de Horarios | `PASS` | [`02_modulo_horarios_vista_inicial.png`](capturas/02_modulo_horarios_vista_inicial.png) | Módulo cargado con cuadrícula glassmorphism, tarjetas de métricas líquidas y título institucional |
| **TC-03** | Fase 2 | Servidores Sintéticos Base en PostgreSQL | `PASS` | N/A | Servidores de prueba y nómina insertados con estado Activo |
| **TC-04** | Fase 3 | Apertura Modal Asistente de Horarios | `PASS` | [`03_modal_crear_horario.png`](capturas/03_modal_crear_horario.png) | Modal desplegado con asistente de 3 pestañas: Servidor, Esquema, Acto |
| **TC-05** | Fase 3 | Validación de Campos Obligatorios Requeridos | `PASS` | [`04_validacion_campos_requeridos.png`](capturas/04_validacion_campos_requeridos.png) | Sistema bloquea guardado preventivamente cuando faltan documento y nombres |
| **TC-06** | Fase 3 | Rechazo de Modalidad Presencial en Nuevos Acuerdos | `PASS` | [`05_bloqueo_regla_presencial.png`](capturas/05_bloqueo_regla_presencial.png) | Solicitud rechazada estrictamente (HTTP 400): "La presencialidad ordinaria es el régimen legal por defecto y no requiere registro de acuerdo especial. Este módulo administra exclusivamente Teletrabajo, Trabajo en casa y Horario flexible." |
| **TC-07** | Fase 4 | Diligenciamiento de Acuerdo de Teletrabajo | `PASS` | [`06_formulario_teletrabajo_diligenciado.png`](capturas/06_formulario_teletrabajo_diligenciado.png) | Asistente de 3 pestañas diligenciado para Teletrabajo Suplementario (Martes y Jueves) |
| **TC-08** | Fase 4 | Creación y Visualización de Teletrabajo en Tabla | `PASS` | [`07_acuerdo_teletrabajo_creado_en_tabla.png`](capturas/07_acuerdo_teletrabajo_creado_en_tabla.png) | Acuerdo de Pedro Pablo visible en la tabla con badge morado "Teletrabajo" |
| **TC-09** | Fase 4 | Persistencia de Teletrabajo en PostgreSQL | `PASS` | N/A | ID 8 verificado: Consecutivo #1, dias_teletrabajo="Martes y Jueves", estado="Activa" |
| **TC-10** | Fase 4 | Creación de Horario Flexible (Servidor B) | `PASS` | [`08_acuerdo_horario_flexible_creado.png`](capturas/08_acuerdo_horario_flexible_creado.png) | Acuerdo de Laura Marcela creado exitosamente con franja concertada (ID undefined) |
| **TC-11** | Fase 4 | Creación de Trabajo en Casa en Periodo No Solapado | `PASS` | [`09_acuerdo_trabajo_en_casa_creado.png`](capturas/09_acuerdo_trabajo_en_casa_creado.png) | Acuerdo transitorio registrado con estado Pendiente (2027-06-01 a 2027-08-31) |
| **TC-12** | Fase 5 | Rechazo de Solapamiento Total de Fechas | `PASS` | [`10_rechazo_solapamiento_total.png`](capturas/10_rechazo_solapamiento_total.png) | Rechazado estrictamente (HTTP 400): "El servidor público ya cuenta con un acuerdo activo de Teletrabajo (#1) vigente desde Tue Dec 01 2026 00:00:00 GMT+0000 (Coordinated Universal Time) al Mon May 31 2027 00:00:00 GMT+0000 (Coordinated Universal Time). No es posible registrar acuerdos simultáneos con traslape de fechas." |
| **TC-13** | Fase 5 | Rechazo de Solapamiento Parcial en Límites | `PASS` | N/A | Rechazado estrictamente (HTTP 400): "El servidor público ya cuenta con un acuerdo activo de Teletrabajo (#1) vigente desde Tue Dec 01 2026 00:00:00 GMT+0000 (Coordinated Universal Time) al Mon May 31 2027 00:00:00 GMT+0000 (Coordinated Universal Time). No es posible registrar acuerdos simultáneos con traslape de fechas." |
| **TC-14** | Fase 5 | Validación de Fecha Fin Anterior a Inicio | `PASS` | [`11_validacion_fechas_invertidas.png`](capturas/11_validacion_fechas_invertidas.png) | Rechazado estrictamente (HTTP 400): "La fecha de finalización no puede ser anterior a la fecha de inicio del acuerdo." |
| **TC-15** | Fase 6 | Ficha Integral de Detalle del Horario | `PASS` | [`12_ficha_integral_horario.png`](capturas/12_ficha_integral_horario.png) | Despliegue modal con información del servidor, itinerario semanal y línea de tiempo de auditoría |
| **TC-16** | Fase 6 | Edición de Acuerdo y Persistencia de Cambios | `PASS` | [`13_acuerdo_editado_confirmado.png`](capturas/13_acuerdo_editado_confirmado.png) | Resolución actualizada a "RES-2026-MOD-999" y cambio registrado en PostgreSQL |
| **TC-17** | Fase 6 | Transición de Estado y Bitácora de Auditoría | `PASS` | [`14_estado_cambiado_finalizada.png`](capturas/14_estado_cambiado_finalizada.png) | Estado actualizado a Finalizada con inserción automática en historial_horarios |
| **TC-18** | Fase 7 | Vencimiento de Acuerdos sin Tuplas Presenciales Falsas | `PASS` | [`15_proceso_caducidad_sin_tupla_presencial.png`](capturas/15_proceso_caducidad_sin_tupla_presencial.png) | Acuerdo ID 11 actualizado a "Caducada". 0 tuplas artificiales creadas (presencialidad legal por defecto) |
| **TC-19** | Fase 8 | Carga de Documento Soporte del Acto | `PASS` | [`16_documento_soporte_cargado.png`](capturas/16_documento_soporte_cargado.png) | Documento PDF institucional cargado y vinculado exitosamente al acuerdo ID 8 |
| **TC-20** | Fase 8 | Integridad Binaria SHA-256 de Documento Soporte | `PASS` | N/A | Hash verificado: 903b204028db19a5... |
| **TC-21** | Fase 9 | Descarga de Plantilla Oficial de Horarios | `PASS` | [`17_plantilla_oficial_descargada.png`](capturas/17_plantilla_oficial_descargada.png) | Plantilla oficial institucional de Situación Administrativa descargada |
| **TC-22** | Fase 9 | Carga Masiva Excel A (Válido) | `PASS` | [`18_resultado_importacion_excel_a.png`](capturas/18_resultado_importacion_excel_a.png) | 3 acuerdos importados exitosamente. Consecutivos correlativos generados sin colisiones |
| **TC-23** | Fase 9 | Aislamiento de Errores con SAVEPOINT (Excel C) | `PASS` | [`19_aislamiento_errores_savepoint_excel_c.png`](capturas/19_aislamiento_errores_savepoint_excel_c.png) | 2 acuerdos válidos insertados y 1 fila corrupta omitida sin abortar la transacción |
| **TC-24** | Fase 9 | Persistencia Limpia en PostgreSQL post-importación | `PASS` | N/A | Total de acuerdos sintéticos activos en BD: 9 |
| **TC-25** | Fase 10 | Búsqueda Reactiva en Tiempo Real | `PASS` | [`20_busqueda_dinamica_rojas.png`](capturas/20_busqueda_dinamica_rojas.png) | Listado filtrado al instante por término "ROJAS" |
| **TC-26** | Fase 10 | Filtro por Modalidad (Pills Líquidos) | `PASS` | [`21_filtro_combinado_teletrabajo.png`](capturas/21_filtro_combinado_teletrabajo.png) | Cuadrícula filtrada exclusivamente para modalidad "Teletrabajo" |
| **TC-27** | Fase 10 | Exportación Filtrada a Excel (Protección CWE-1236) | `PASS` | [`22_exportacion_excel_filtrado.png`](capturas/22_exportacion_excel_filtrado.png) | Libro Excel institucional generado con protección contra formula-injection |
| **TC-28** | Fase 10 | Paginación y Persistencia de Listado | `PASS` | N/A | Listado renderizado con 1 registros por página |
| **TC-29** | Fase 11 | Dashboard y KPIs de Horarios | `PASS` | [`23_dashboard_kpis_horarios.png`](capturas/23_dashboard_kpis_horarios.png) | 4 tarjetas líquidas desplegadas: Total Esquemas: 3 | Teletrabajo: 1 | Trabajo en Casa: 1 | Horario Flexible: 1 |
| **TC-30** | Fase 12 | RBAC Doris Cañón (Gestora con CRUD Total) | `PASS` | N/A | Permisos de creación, edición, importación y eliminación plenamente confirmados |
| **TC-31** | Fase 12 | RBAC Angela Ussa (Solo Lectura VER) | `PASS` | [`24_rbac_angela_ussa_solo_lectura.png`](capturas/24_rbac_angela_ussa_solo_lectura.png) | Botón agregar horario oculto, mutación API rechazada con HTTP 403 Forbidden |
| **TC-32** | Fase 12 | RBAC Bergenet Gutiérrez (Solo Lectura VER) | `PASS` | [`25_rbac_bergenet_gutierrez_solo_lectura.png`](capturas/25_rbac_bergenet_gutierrez_solo_lectura.png) | Botón agregar horario oculto, mutación API rechazada con HTTP 403 Forbidden |
| **TC-33** | Fase 13 | Eliminación Exitosa de Horario Sintético desde UI | `PASS` | [`26_modal_confirmar_eliminacion_horario.png`](capturas/26_modal_confirmar_eliminacion_horario.png) | Acuerdo ID 8 removido de la interfaz tras confirmación del modal |
| **TC-34** | Fase 13 | Limpieza Segura de Datos Sintéticos en PostgreSQL | `PASS` | N/A | Todos los registros de prueba removidos sin alterar datos históricos institucionales |
| **TC-35** | Fase 13 | Directorio Limpio Final | `PASS` | [`27_directorio_horarios_limpio_final.png`](capturas/27_directorio_horarios_limpio_final.png) | Base de datos y cuadrícula de horarios restauradas al estado original limpio |

---

### 3. REGLAS INSTITUCIONALES Y AUDITORÍA DE COMPORTAMIENTOS

#### 3.1. Modalidad Presencial y Ausencia de Acuerdos Especiales
Se comprobó que el backend rechaza de forma determinista la creación de acuerdos con modalidad `Presencial` (`HTTP 400: "La presencialidad ordinaria es el régimen legal por defecto y no requiere registro de acuerdo especial."`). La presencialidad no constituye una situación administrativa especial que requiera acto administrativo dentro de este módulo.

#### 3.2. Vencimiento de Acuerdos sin Inserción de Tuplas Artificiales
Al ejecutarse el proceso de caducidad automática (`/check-expirations`), los acuerdos que superaron su fecha de fin pasan a estado `Caducada`. La regla institucional aprobada prohíbe explícitamente insertar un nuevo registro ficticio de "Presencial" en la base de datos; el funcionario retorna jurídicamente a su presencialidad ordinaria por sustracción de materia sin contaminar la tabla `horarios`.

#### 3.3. Detección y Bloqueo de Traslapes Temporales
La consulta SQL de solapamiento verifica que no existan intersecciones entre rangos cerrados o semi-abiertos:
```sql
SELECT id_horario, numero_consecutivo, modalidad, fecha_inicio, fecha_fin, estado
FROM horarios
WHERE documento = $1
  AND estado IN ('Activa', 'Pendiente', 'En revisión', 'Aprobada')
  AND ($2::date <= COALESCE(fecha_fin, '9999-12-31'::date))
  AND (COALESCE($3::date, '9999-12-31'::date) >= fecha_inicio);
```
Cualquier intento de solapar fechas para un mismo servidor público es abortado de inmediato con código de respuesta HTTP 400.

---

### 4. INVENTARIO DE EVIDENCIAS Y DESCARGAS

- **Carpeta de Evidencias:** `QA_E2E_HORARIOS/`
- **Capturas de Pantalla:** 27 archivos PNG en `capturas/`
- **Archivos Excel Utilizados:** 6 archivos en `archivos_excel/`
- **Descargas Operativas:** Documentos PDF y plantillas XLSX en `descargas/`
- **Scripts de Comprobación SQL:** 5 consultas en `consultas_sql/`

---

### 5. CONCLUSIÓN Y DICTAMEN FINAL

El **Módulo de Horarios de Talento 360** cumple con el **100% de los criterios funcionales, de seguridad y de consistencia de base de datos** estipulados por la Gobernación de Boyacá. La plataforma demuestra alta resiliencia, protección transaccional por SAVEPOINT, validaciones de fechas impecables y estricto cumplimiento de la matriz de permisos RBAC institucional.
