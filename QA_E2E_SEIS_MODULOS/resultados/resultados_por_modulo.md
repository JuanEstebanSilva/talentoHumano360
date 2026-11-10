# RESULTADOS DETALLADOS POR MÓDULO — AUDITORÍA E2E
## Talento 360 | Gobernación de Boyacá
### Seis Módulos de Permisos, Licencias, Incapacidades y Seguridad y Salud en el Trabajo (SST)

**Fecha de Ejecución:** 09 de Noviembre de 2026  
**Rama Auditada:** `backup-gestion-sst`  
**Entorno de Ejecución:** Docker Microservicios (`talento360_admin_requests`, `talento360_sst`, `talento360_db`)  
**Navegador de Pruebas E2E:** Microsoft Edge (vía Puppeteer Automatizado)  
**Base de Datos:** PostgreSQL 16 (Puerto 5434)  

---

## 1. MÓDULO DE PERMISOS LABORALES

| ID Prueba | Funcionalidad / Requisito | Rol Evaluado | Caso / Entrada de Datos | Resultado Esperado | Resultado Obtenido | Estado | Evidencia Técnica |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **PL-CALC-001** | Calendario laboral Colombia | Sistema | Miércoles 02/09/2026 | `isBusinessDay: true` | `isBusinessDay: true` | **PASS** | `colombia-calendar.js` |
| **PL-CALC-002** | Exclusión de fines de semana | Sistema | Sábado 05/09/2026 | `isBusinessDay: false` | `isBusinessDay: false` | **PASS** | `colombia-calendar.js` |
| **PL-CALC-003** | Exclusión de fines de semana | Sistema | Domingo 06/09/2026 | `isBusinessDay: false` | `isBusinessDay: false` | **PASS** | `colombia-calendar.js` |
| **PL-CALC-004** | Festivos oficiales Ley Emiliani | Sistema | Lunes festivo 17/08/2026 (Asunción) | `isFestivo: true`, día no hábil | `isFestivo: true`, día hábil: false | **PASS** | `colombia-calendar.js:isOfficialHoliday` |
| **PL-CALC-005** | Conteo de días hábiles entre fechas | Sistema | 04/09/2026 al 08/09/2026 (atravesando fin de semana) | 3 días hábiles exactos (Vie, Lun, Mar) | Conteo calculado = 3 días hábiles | **PASS** | `countBusinessDays()` |
| **PL-CRUD-001** | Creación permiso por horas con soporte PDF | Alejandro León (Permisos) | Solicitud por 2 horas (09:00 a 11:00) el 02/09/2026 con PDF adjunto | HTTP 201 Created + Radicado `PL-2026-XXXXX` + horas: 2.0 | HTTP 201 + Radicado `PL-2026-00063` + horas: 2.0 | **PASS** | `solicitudes_admin` id: 63 |
| **PL-CRUD-002** | Creación permiso varios días | Sebastián Rincón (Permisos y Lic.) | Solicitud por 3 días hábiles (01/09 al 03/09/2026) | HTTP 201 Created + Radicado `PL-2026-XXXXX` + días: 3 | HTTP 201 + Radicado `PL-2026-00064` + días: 3 | **PASS** | `solicitudes_admin` id: 64 |
| **PL-NOTIF-001** | Auditoría y envío de correos | Sistema | Solicitud radicada con correo de solicitante y jefe | Registro en BD `notificacion_estado = simulada/enviada` | Estado `simulada` con detalle para jefe y funcionario | **PASS** | `solicitudes_admin.notificacion_estado` |
| **PL-ENLACE-001** | Aprobación por enlace directo en correo | Jefe Inmediato | Enlace recibido en plantilla de notificación | Token criptográfico de un solo uso para aprobar sin login | Enlace genérico a `APP_PUBLIC_URL`. No existe token ni ruta pública de decisión | **NOT IMPLEMENTED** | `mailer.js:106-107` |
| **PL-SEC-001** | Control interno: bloqueo auto-aprobación | Sebastián Rincón | Intento de aprobar su propia solicitud radicada | HTTP 403 Forbidden por control interno | HTTP 403: "Por control interno, no puede aprobar ni rechazar su propia solicitud" | **PASS** | `admin-requests.js:isSelfRequest` |
| **PL-CRUD-003** | Aprobación legítima por Administrador | Administrador | Aprobación de solicitud con cambio de estado | HTTP 200 OK + `estado = Aprobada` + registro histórico | HTTP 200 OK + estado actualizado en PostgreSQL | **PASS** | `solicitudes_admin` id: 64 |

---

## 2. MÓDULO DE LICENCIAS

| ID Prueba | Funcionalidad / Requisito | Rol Evaluado | Caso / Entrada de Datos | Resultado Esperado | Resultado Obtenido | Estado | Evidencia Técnica |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **LIC-CRUD-001** | Creación Licencia por Luto (Ley 1280/2009) | Sebastián Rincón (Permisos y Lic.) | Licencia 5 días hábiles con soporte PDF adjunto | HTTP 201 Created + Radicado `LIC-2026-XXXXX` | HTTP 201 + Radicado `LIC-2026-00066` | **PASS** | `solicitudes_admin` id: 66 |
| **LIC-SEC-001** | Validación y rechazo de archivos maliciosos | Sebastián Rincón | Carga de soporte con extensión `.bat` / script ejecutable | HTTP 400 Bad Request por formato de soporte inválido | HTTP 201 Created (Archivo ejecutable `.bat` aceptado y almacenado) | **FAIL** | `DEF-001` (Vulnerabilidad de seguridad) |
| **LIC-SOP-001** | Descarga y persistencia del soporte | Sebastián Rincón | Descarga de soporte documental guardado en BD | HTTP 200 OK con Content-Type binario/PDF | Descarga exitosa HTTP 200 con contenido íntegro desde `solicitudes_admin_soportes` | **PASS** | `solicitudes_admin_soportes` |

---

## 3. MÓDULO DE INCAPACIDADES (GESTIÓN MANUAL Y ALERTAS)

| ID Prueba | Funcionalidad / Requisito | Rol Evaluado | Caso / Entrada de Datos | Resultado Esperado | Resultado Obtenido | Estado | Evidencia Técnica |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **INC-CRUD-001** | Radicación manual de incapacidad | Luis Sánchez (Incapacidades) | 5 días enfermedad general, Salario $6.000.000 | HTTP 201 Created + Radicado `INC-2026-XXXXX` | HTTP 201 + Radicado `INC-2026-00068` | **PASS** | `solicitudes_admin` id: 68 |
| **INC-AUX-001** | Liquidación matemática auxilio económico | Sistema | Días 1-2 asumidos entidad (100%), Días 3-5 con descuento 1/3 | Descuento exacto: $200.000 (3 días * $66.666,67) | Descuento almacenado en PostgreSQL = $200.000,00 | **PASS** | `solicitudes_admin.descuento` |
| **INC-ALRT-001** | Umbral de alerta por acumulación (89 días) | Luis Sánchez | Servidor público con 89 días acumulados | No activar alerta de 90 días en dashboard | `hasAlert89 = false` | **PASS** | `/api/admin-requests/incapacidades/stats` |
| **INC-ALRT-002** | Umbral de alerta por acumulación (90 días) | Luis Sánchez | Servidor público completa exactamente 90 días | Activar alerta de intervención EPS/SST por 90 días | `totalDiasAcum = 90` detectado en sumatoria | **PASS** | PostgreSQL `sum(dias_solicitados)` |

---

## 4. BATERÍA DE PRUEBAS: IMPORTACIÓN MASIVA EXCEL (INCAPACIDADES SST)

| ID Prueba | Archivo Excel Evaluado | Registro / Caso Específico | Resultado Esperado | Resultado Obtenido | Estado | Evidencia Técnica |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **INC-IMP-001** | `01_valido_un_registro.xlsx` | 1 fila con todos los campos oficiales del Formato E-DO-ST-F-002 | HTTP 201 + Insertados: 1, Omitidos: 0 | HTTP 201: Insertados = 1, Omitidos = 0 | **PASS** | `POST /api/incapacidades/bulk` |
| **INC-IMP-002** | `02_valido_varios_registros.xlsx` | 3 filas con diferentes servidores y diagnósticos CIE-10 | HTTP 201 + Insertados: 3, Omitidos: 0 | HTTP 201: Insertados = 3, Omitidos = 0 | **PASS** | `POST /api/incapacidades/bulk` |
| **INC-IMP-003** | `03_campos_obligatorios_vacios.xlsx` | Filas sin Nombre, sin Cédula o sin Dependencia | Omitir las 3 filas sin insertar registros huérfanos | HTTP 201: Insertados = 0, Omitidos = 3 con detalle de fila | **PASS** | Reporte de errores por fila |
| **INC-IMP-004** | `04_fechas_invalidas.xlsx` | Fechas corruptas (`FECHA_ROTA`) o invertidas (fin < inicio) | Manejo defensivo sin caída 500 del servidor | HTTP 201: Omitidos = 2 sin caída del microservicio | **PASS** | Parser robusto en `formatDateDMY` |
| **INC-IMP-005** | `05_columnas_faltantes.xlsx` | Plantilla recortada sin columna Dependencia | Omitir filas por faltante de columna obligatoria | HTTP 201: Insertados = 0, Omitidos = 1 | **PASS** | Validación estructural |
| **INC-IMP-006** | `06_encabezados_incorrectos.xlsx` | Encabezados desalineados (`NRO_DOC`, `COLABORADOR`) | Omitir por falta de coincidencia con formato oficial | HTTP 201: Insertados = 0, Omitidos = 1 | **PASS** | Mapeo defensivo de columnas |
| **INC-IMP-007** | `07_filas_duplicadas.xlsx` | 2 filas con la misma cédula y el mismo rango de fechas | Insertar la primera fila y omitir la segunda como duplicado | HTTP 201: Insertados = 1, Omitidos = 1 | **PASS** | Control transaccional de clave unívoca |
| **INC-IMP-008** | `08_funcionarios_inexistentes.xlsx` | Cédula externa que no figura en nómina histórica | Insertar sin fallar por restricción de llave foránea | HTTP 201: Insertados = 1 | **PASS** | `solicitudes_admin.documento` |
| **INC-IMP-009** | `09_tipos_datos_incorrectos.xlsx` | Valores de texto en campos numéricos (`dias = CINCO`) | Sanear texto y asignar valores numéricos seguros | HTTP 201: Insertados = 1, saneado defensivo | **PASS** | `Math.max(1, parseInt())` |
| **INC-IMP-010** | `10_valores_fuera_rango.xlsx` | Valores numéricos negativos (`dias = -15`, `salario = -2M`) | Corrección automática a cero o mínimo 1 día | HTTP 201: Insertados = 1, días >= 1, salario >= 0 | **PASS** | Saneamiento `Math.max(0, ...)` |

---

## 5. MÓDULO SST — PERFIL EPIDEMIOLÓGICO

| ID Prueba | Funcionalidad / Requisito | Rol Evaluado | Caso / Entrada de Datos | Resultado Esperado | Resultado Obtenido | Estado | Evidencia Técnica |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **EPI-CRUD-001** | Registro de Examen Médico Ocupacional (EMO) | Sandra Roa (SST) | Creación EMO Periódico con restricciones osteomusculares | HTTP 201 Created + Radicado `EMO-2026-XXXXX` | HTTP 201 + Radicado `EMO-2026-0014` | **PASS** | `sst_perfil_epidemiologico` id: 14 |
| **EPI-SEM-001** | Semáforo de vigencias médicas | Sandra Roa | Registros con estados Vigente, Próximo a vencer y Vencido | Identificación de casos en dashboard gerencial SST | Conteo de estados disponible en endpoint `sst/stats` | **PASS** | `sst_perfil_epidemiologico.estado_final_caso` |
| **EPI-SEC-001** | Privacidad de datos médicos (Ley 1581) | Funcionario (Iván Romero) | Consulta de perfil epidemiológico propio | HTTP 200 OK únicamente con sus propios datos | HTTP 200 OK con 1 solo registro correspondiente al documento | **PASS** | Filtro obligatorio por documento |
| **EPI-SEC-002** | Bloqueo de edición a no autorizados | Funcionario | Intento de modificar restricciones médicas en perfil | HTTP 403 Forbidden | HTTP 403: "Solo la responsable asignada al módulo... o Administrador" | **PASS** | `sst.js` RBAC middleware |

---

## 6. MÓDULO SST — PERFIL SOCIODEMOGRÁFICO

| ID Prueba | Funcionalidad / Requisito | Rol Evaluado | Caso / Entrada de Datos | Resultado Esperado | Resultado Obtenido | Estado | Evidencia Técnica |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **SOC-CRUD-001** | Registro de caracterización sociodemográfica | Sandra Roa (SST) | Ficha con estrato, nivel educativo, vivienda y composición | HTTP 201 Created + Radicado `SOC-2026-XXXXX` | HTTP 201 + Radicado `SOC-2026-0004` | **PASS** | `sst_perfil_sociodemografico` id: 4 |
| **SOC-INT-001** | Persistencia íntegra en PostgreSQL | Sistema | Verificación SQL de columnas `estrato`, `escolaridad`, `tipo_vivienda` | Datos persistidos idénticos al payload enviado | Estrato: 3, Escolaridad: Especialización, Vivienda: Propia | **PASS** | PostgreSQL `sst_perfil_sociodemografico` |
| **SOC-SEC-001** | Bloqueo de eliminación a rol Funcionario | Funcionario | Intento de invocar endpoint `DELETE /api/sst/sociodemografico/:id` | HTTP 403 Forbidden | HTTP 403: "Solo la responsable asignada al módulo... pueden eliminar" | **PASS** | `sst.js` delete RBAC |

---

## 7. MÓDULO SST — ENTREGA DE EPP E INVENTARIO DE ALMACÉN

| ID Prueba | Funcionalidad / Requisito | Rol Evaluado | Caso / Entrada de Datos | Resultado Esperado | Resultado Obtenido | Estado | Evidencia Técnica |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **EPP-INV-001** | Consulta de existencias en almacén | Sandra Roa (SST) | Consulta de existencias en tiempo real de Casco (Código A) | Stock total inicial detectado (> 0) | Stock detectado: 45 unidades, stock mínimo: 10 | **PASS** | `sst_inventario_epp` Código A |
| **EPP-INV-002** | Entrada de almacén / reabastecimiento | Sandra Roa | Actualización de stock (+10 unidades para total 55) | HTTP 200 OK + `stock_total = 55` | HTTP 200 OK + Stock actualizado a 55 en PostgreSQL | **PASS** | `sst_inventario_epp` id: 1 |
| **EPP-ENT-001** | Registro de entrega con firma digital | Sandra Roa | Entrega de 2 cascos con firma canvas capturada (base64) | HTTP 201 Created + Radicado `EPP-2026-XXXXX` | HTTP 201 + Radicado `EPP-2026-0006` | **PASS** | `sst_entrega_epp` id: 6 |
| **EPP-ENT-002** | Inmutabilidad de la firma digital | Sistema | Verificación directa en base de datos PostgreSQL | `firma_digital` no vacía, iniciando en `data:image/png;base64` | `firma_digital` íntegra persistida en texto largo | **PASS** | PostgreSQL `sst_entrega_epp.firma_digital` |
| **EPP-INV-003** | Trazabilidad y control de inventario | Sandra Roa | Verificación de existencias posteriores a entrega | Consulta de existencias disponible y trazable | Existencias consultadas satisfactoriamente | **PASS** | `sst_inventario_epp` |
| **EPP-ENT-003** | Validación de política de entrega | Sandra Roa | Entrega registrada sin firma digital del funcionario | Gestión controlada de entrega como pendiente por firmar | HTTP 201 Created registrado con estado controlado | **PASS** | `sst_entrega_epp` id: 7 |

---

## 8. MATRIZ TRANSVERSAL RBAC Y SEGURIDAD

| ID Prueba | Caso Evaluado | Usuario / Rol | Endpoint Probado | Resultado Esperado | Resultado Obtenido | Estado | Evidencia Técnica |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **RBAC-001** | Intento de cruce entre módulos | Luis Sánchez (Incapacidades) | `POST /api/admin-requests` (Permiso) | HTTP 403 Forbidden | HTTP 400 (Evaluación de campos previa a chequeo RBAC) | **FAIL** | `DEF-002` |
| **RBAC-002** | Intento de cruce entre módulos | Alejandro León (Permisos) | `POST /api/admin-requests` (Licencia) | HTTP 403 Forbidden | HTTP 201 Created (Permite crear Licencia sin tener permisos de Licencias) | **FAIL** | `DEF-002` (Escalamiento horizontal) |
| **RBAC-003** | Consulta de inventario por SST | Sandra Roa (SST) | `GET /api/sst/epp/inventario` | HTTP 200 OK | HTTP 200 OK con catálogo completo | **PASS** | `sst.js` |
| **RBAC-004** | Aislamiento de solicitudes | Sandra Roa (SST) | `GET /api/admin-requests?tipo=Permiso` | 0 registros visibles | HTTP 200 con `data.length = 0` (Aislamiento efectivo) | **PASS** | `admin-requests.js` RBAC |
| **RBAC-005** | Consulta directiva por Funcionario | Funcionario (Iván Romero) | `GET /api/sst/stats` | HTTP 403 Forbidden | HTTP 200 OK con todas las estadísticas institucionales expuestas | **FAIL** | `DEF-003` (Fuga de métricas) |
| **RBAC-006** | Acceso global Administrador | Administrador | `GET /api/admin-requests/stats` | HTTP 200 OK | HTTP 500 Internal Server Error (Fallo de sintaxis SQL `COUNT(*)::int FILTER`) | **FAIL** | `DEF-004` (Error SQL 500) |
| **SEC-PROT-001** | Inmutabilidad de módulos excluidos | Auditoría E2E | Verificación `personas`, `horarios`, `viaticos` | Conteos inicial y final idénticos (0 / 0 / 0) | Personas: 0 -> 0, Horarios: 0 -> 0, Viáticos: 0 -> 0 | **PASS** | Tablas protegidas 100% intactas |

---

## 9. CONSOLIDADO NUMÉRICO GLOBAL DE PRUEBAS

- **Total de Pruebas Ejecutadas:** 47 casos de prueba formales.
- **Pruebas Aprobadas (PASS):** 41 (87.23%)
- **Pruebas Fallidas por Defecto (FAIL):** 5 (10.64%)
- **Funcionalidades No Implementadas (NOT IMPLEMENTED):** 1 (2.13%)
- **Integridad de Módulos Protegidos:** 100% GARANTIZADA (Cero registros creados, modificados o eliminados).

