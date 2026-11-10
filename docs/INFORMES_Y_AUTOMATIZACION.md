# Informes y Automatización

Módulo **Informes** del menú. Permite generar informes combinando filtros y programar su generación periódica. Lo atiende `web/services/reports-service`, bajo `/api/reports` y `/api/automation`.

## Qué se puede consultar

Los filtros se adaptan a los datos que existen en la base de datos; las opciones de cada lista salen de los valores reales.

| Informe | Módulo requerido | Filtros principales |
| :--- | :--- | :--- |
| Servidores públicos y vacantes | `employees` | Cédula, nombre, dependencia, cargo, nivel, tipo de vinculación, situación, estado, tipo de registro, sexo, fechas de ingreso y retiro |
| Vacaciones | `requests` | Cédula, nombre, dependencia, cargo, estado, periodo, fechas de inicio y solicitud |
| Permisos, incapacidades y licencias | `admin-requests` | Tipo, cédula, nombre, dependencia, cargo, estado, fechas, días |
| Viáticos y comisiones | `viaticos` | Cédula, nombre, dependencia, destino, tipo de destino, estado, resolución, fechas, valor |
| Horarios y modalidades | `horarios` | Cédula, nombre, dependencia, cargo, modalidad, estado, resolución, vigencia |
| Novedades para nómina | `requests`, `admin-requests` y `viaticos` | Origen, concepto, cédula, nombre, dependencia, estado, fecha |
| SST: exámenes, EPP y perfil sociodemográfico | `sst` | Según cada formato |
| Documentos del repositorio | `documents` | Cédula, nombre, título, tipo, categoría, fecha (sin tipos sensibles) |

### Información que el sistema no tiene

No se incluyeron filtros sobre datos que no existen:

- **Contratos:** no hay tabla de contratos. Se usa el tipo de vinculación y el estado del servidor.
- **Nómina:** no hay periodos ni conceptos de pago. "Novedades para nómina" reúne lo aprobado que afecta el pago.
- **Asistencia:** no hay registros de asistencia, ausencias ni retardos. Lo más cercano son horarios, permisos e incapacidades.
- **Selección:** no hay candidatos ni etapas. Solo plazas vacantes y su OPEC.

## Automatización

1. En **Generar informe**, configura filtros y columnas y revisa la vista previa.
2. Pulsa **Programar** e indica nombre, frecuencia (diaria, semanal, mensual o personalizada), fecha y hora de Colombia.
3. En **Automatizaciones** puedes editar, pausar, reanudar, ejecutar ahora o eliminar.
4. En **Historial de ejecuciones** consultas cada resultado y lo exportas a Excel o PDF.

Comportamiento que conviene conocer:

- **Periodos relativos:** "Mes anterior" se calcula en cada ejecución. Un rango de fechas fijo repetiría siempre los mismos datos, y el formulario lo advierte.
- **Frecuencia mensual:** repite el día de la primera ejecución y, si el mes es más corto, usa su último día.
- **Permisos:** cada ejecución usa los permisos actuales de quien la creó. Si se le retiró el acceso, queda en error y no guarda datos.
- **Servidor apagado:** al volver, las tareas vencidas se ejecutan una sola vez, sin acumular atrasos. En un plan que duerme el servidor, como el gratuito de Render, no correrán a tiempo.
- **Resultados guardados:** se conservan en la base de datos las últimas 30 ejecuciones por automatización. Eliminar una automatización borra también su historial. Cada resultado guarda hasta 20.000 registros.
- **Datos sensibles:** los resultados guardados quedan incluidos en las copias de seguridad SQL.

## Historial de importaciones

La pestaña **Historial de importaciones** muestra cada carga masiva hecha desde los módulos: archivo, usuario, fecha, filas nuevas, actualizadas, ya existentes y omitidas, con sus errores. Cada usuario ve las suyas; Administrador y Coordinador, todas.

Las cargas siguen haciéndose desde cada módulo, con su plantilla y vista previa. El registro lo hace un middleware (`src/utils/importHistory.js` de cada servicio) que lee la respuesta de la ruta de carga, sin cambiar su lógica. También quedan registradas las cargas rechazadas o fallidas, con el motivo.

Si un registro ya existía, cada módulo decide qué hacer según su propia lógica; el historial no evita duplicados.

## Permisos

Por decisión de la entidad, todo usuario registrado puede generar informes y programar automatizaciones. Cada informe solo trae datos de los módulos que el usuario ya puede consultar con el modelo `modulos` + `permisos` del equipo. Cada usuario ve y gestiona solo sus automatizaciones; quien tiene `*` (Administrador) ve todas.

## Agregar un informe o un filtro

Basta con editar `web/services/reports-service/src/utils/catalog.js`: la API y la pantalla se adaptan solas. Las pruebas ejecutan cada fuente y cada filtro contra el esquema real.

## Por qué no se reutilizó tal cual la automatización anterior

La versión de la copia anterior del proyecto ejecutaba URLs configurables con un token interno de administrador, lo que se saltaba los permisos del usuario y permitía llamar direcciones arbitrarias. Además no guardaba filtros ni resultados. Aquí la tarea llama directamente al motor de informes. De esa copia sí se tomaron los criterios de novedades para nómina, las fuentes de datos y el estilo de exportación.
