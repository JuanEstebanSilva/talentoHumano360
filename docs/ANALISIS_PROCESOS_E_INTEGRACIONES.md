# Diagnóstico técnico preliminar: procesos e integraciones

**Alcance:** objetivos 1 (procesos documentales) y 7 (sistemas administrativos y pagos), y las dependencias de información de los objetivos 6, 8 y 9.

**Estado:** diagnóstico técnico inicial, pendiente de validación institucional. Los procesos de la oficina, los formatos oficiales y los accesos a sistemas externos no están validados.

**Instrumentos de reunión:** el cuestionario y la matriz de levantamiento están en [Talento 360: instrumentos de levantamiento institucional](https://claude.ai/artifact/HdQZdz5rQWapW9r6htwHTe).

Este documento separa cuatro niveles de certeza:

| Nivel | Significado | Se puede usar como requisito |
| :--- | :--- | :--- |
| Comprobado | Verificado en el código o con una prueba de la aplicación | Solo para describir la aplicación |
| Preliminar | Dicho por el equipo, sin evidencia de la entidad | No |
| Configuración provisional | Ya está en la aplicación, sin respaldo de la entidad | No: debe validarse |
| Por confirmar | Se desconoce y depende de la entidad | No |

## 1. Comprobado en la aplicación

### Documentos

| Dónde | Cómo se guarda | Clasificación y búsqueda | Registro de accesos |
| :--- | :--- | :--- | :--- |
| Gestión Documental | Archivo fuera de la base de datos, con versiones | Sí | Sí |
| Soportes de permisos, incapacidades y licencias | Dentro de Gestión Documental | Sí | Sí |
| Entrada automática desde carpeta | Pasa a la bandeja, y una persona confirma | Sugerida | Sí |
| Viáticos (`soporte`) | Texto dentro de la fila de la tabla | No | No |
| Horarios (`soporte_acto`) | Texto dentro de la fila de la tabla | No | No |
| SST: exámenes y EPP (`soporte`) | Texto dentro de la fila de la tabla | No | No |

Conviven dos formas de guardar adjuntos. Las copias de seguridad SQL no incluyen los archivos de Gestión Documental.

### Recorrido del documento

| Etapa | Qué cubre la aplicación | Qué requiere información de la entidad |
| :--- | :--- | :--- |
| Recepción | Carga manual, carga múltiple y carpeta de entrada | Canales reales, quién recibe y si existe radicación |
| Validación | Tipo real del archivo, tamaño, duplicado exacto y filas de Excel por módulo | Qué hace válido un documento: contenido, firmas y requisitos |
| Clasificación | Tipos de documento, sugerencia por nombre y confirmación humana | Catálogo oficial de tipos y series |
| Almacenamiento | Disco o volumen, con versiones | Ubicación autorizada, respaldo y migración de adjuntos antiguos |
| Consulta | Repositorio, expediente, búsqueda, permisos y registro de accesos | Quién puede consultar cada tipo |
| Aprobación | Las solicitudes tienen estados. Los documentos **no** tienen flujo de aprobación | Qué documentos se aprueban, quién lo hace y cómo |
| Disposición final | Solo eliminación lógica: oculta el documento y conserva el archivo. **No** hay reglas de retención | Tiempos de conservación, destino final y responsable |

### Cargas de archivos e historial

Se ejecutó una carga por cada ruta, contra una base de datos de prueba: vacaciones, solicitudes, viáticos, horarios, los tres formatos de SST y servidores públicos con un archivo Excel real generado para la prueba.

| Caso | Resultado | ¿Queda en el historial? |
| :--- | :--- | :--- |
| 8 cargas confirmadas de los 6 módulos | Registradas con usuario y totales | Sí |
| Carga rechazada (sin filas o archivo vacío, error 400) | No se procesa | Sí, como `Rechazada`, con el motivo |
| Carga fallida (error 500, se revierte) | No guarda datos | Sí, como `Fallida`, con el motivo |
| Carga sin permiso (error 403) | No se procesa | No: es un acceso denegado, no un intento de carga |

Límites de esta comprobación:

- Se probaron las rutas del servidor, no el recorrido por las pantallas.
- Las pantallas de viáticos y horarios ya envían el nombre del archivo.
- Los tres formatos de SST quedan registrados como `sst`, sin distinguir el formato.
- No se ha probado con archivos reales de la entidad.

Conclusión: el historial registra las cargas confirmadas, rechazadas y fallidas de todos los módulos.

### Sistemas externos y pagos

- El backend no hace llamadas HTTP salientes ni se conecta a otra base de datos.
- El código no tiene integración con Humano.
- La aplicación no modela nómina, periodos de pago, conceptos ni desprendibles.
- Sí guarda datos relacionados: valores y resoluciones de viáticos, asignación del cargo, y novedades aprobadas reunidas en el informe "Novedades para nómina".

## 2. Configuración provisional, sin respaldo de la entidad

| Configuración actual | Por qué es provisional |
| :--- | :--- |
| Códigos E-DO-ST-F-011, F-024, F-028 e I-007 en SST | Aparecen en la aplicación. Eso **no** confirma que estén vigentes ni cuál es su versión oficial |
| Catálogo inicial de 13 tipos de documento | Propuesto a partir del código, sin inventario documental |
| Soportes de permiso laboral marcados como **no** sensibles | Un permiso puede contener información de salud, familiar u otros datos personales. Su clasificación está **pendiente de validación** con Talento Humano y el responsable de protección de datos |
| Soportes de incapacidad y licencia marcados como sensibles | Criterio conservador, sin validar |
| Permisos asignados a cada usuario | Basados en los usuarios de ejemplo, sin una matriz de la entidad |
| 30 ejecuciones guardadas por automatización y conservación indefinida de `procesados/` y `rechazados/` | No existe una regla de retención validada |

## 3. Información preliminar, sin validar

Anotaciones del equipo en el borrador anterior. Son punto de partida, no evidencia de la entidad:

| Tema | Lo anotado |
| :--- | :--- |
| Recepción | La mayor parte de la información llega en archivos de Excel por correo |
| Despliegue | Un computador hará de servidor y se accederá por IP, porque no hay espacio en los servidores |
| Archivos y copias de seguridad | Quedarían en ese mismo computador |
| Carpeta de entrada automática | No se sabe cuál sería |

Consecuencias técnicas si esto se confirma:

- **Conexión por IP:** `web/frontend/src/js/config.js` ya usa el backend del mismo origen al entrar por IP o por nombre de equipo. Comprobado abriendo la aplicación por la IP de la red local.
- **Respaldo:** si los datos y sus copias están en el mismo equipo, una falla del disco pierde ambos. Procedimiento y límites de la copia actual en [Copias de seguridad](COPIAS_DE_SEGURIDAD.md).
- **Disponibilidad:** si el computador está apagado, la aplicación no atiende y los informes programados no corren a su hora.
- **Correo y Excel:** la carpeta de entrada no lee correo. Falta definir cómo pasarían los adjuntos a la aplicación.

## 4. Por confirmar

- **Humano y pagos:** se desconoce si los sistemas institucionales ofrecen API, vistas de consulta, archivos exportados u otros mecanismos. Que Talento 360 no tenga conexión hoy **no determina** lo que esos sistemas permiten. Por ahora, la aplicación solo permite incorporar archivos, y ningún archivo de esos sistemas se ha probado.
- **Procesos de la oficina:** cómo se reciben, validan, aprueban y conservan realmente los documentos.
- **Formatos oficiales:** cuáles son, con qué código y versión, y quién los aprueba.

## 5. Estado de los objetivos

| Objetivo | Estado | Dependencia principal |
| :--- | :--- | :--- |
| 1. Analizar procesos documentales | En análisis, con diagnóstico técnico preliminar | Levantamiento con Talento Humano |
| 7. Analizar sistemas y pagos | En análisis, con diagnóstico técnico preliminar | Levantamiento con administradores de sistemas |
| 6. Formularios | Dependencias de información identificadas | Formatos oficiales |
| 8. Servicios para APIs externas | Dependencias de información identificadas | Mecanismos que ofrezcan los sistemas |
| 9. Sincronización con Humano | Dependencias de información identificadas | Acceso a Humano y reglas de cruce de datos |

## 6. Respuestas de la entidad (10 de noviembre de 2026)

| Pregunta | Respuesta | Qué se hizo o qué implica |
| :--- | :--- | :--- |
| TH-01. Cómo llegan los documentos | Casi todo llega en Excel por correo. Los permisos se piden en un Forms; la idea es que se pidan en la aplicación. | Las cargas masivas por Excel ya quedan en el historial de importaciones. El formulario de permisos ya existe en la aplicación (módulo del equipo). |
| TH-08. Formularios vigentes | Dependen de las vistas y permisos de cada usuario. | Se mantienen los formularios actuales de cada módulo, con sus permisos. |
| TH-12. Acceso a Gestión Documental e Informes | Todos los usuarios registrados. | Aplicado: cualquier sesión válida entra a los dos módulos. |
| DA-02 y DA-03. Documentos sensibles | Los ve quien tenga los permisos y módulos para eso. | Los tipos sensibles exigen `documents:sensitive`; los informes solo traen módulos que el usuario puede consultar. |
| DA-04. Conservación | Hasta que alguien los elimine manualmente. | La aplicación no borra documentos de forma automática. |
| SI-01 y SI-02. Humano y pagos | No tienen un sistema avanzado; solo lo básico. | Objetivos 7, 8 y 9: no hay API ni servicio que conectar. La integración se hace con la carga de archivos Excel y la exportación de informes, que ya existen. |
| IN-01 e IN-06. Servidor | Un computador antiguo en la oficina de Talento Humano; acceso solo desde la misma red. | La aplicación ya funciona por IP en la red local (`config.js`). Conviene reservar una IP fija para ese equipo en el router. |
| IN-02. Copias de seguridad | Quedan en el mismo computador. | Riesgo aceptado: si el disco falla se pierden datos y copias. Queda pendiente para próximos pasantes. |
| IN-07. Conexión desde otros equipos de la red | En prueba. | Pendiente del resultado. |
