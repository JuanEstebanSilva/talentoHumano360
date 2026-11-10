# CATÁLOGO DE ERRORES, DEFECTOS Y VULNERABILIDADES ENCONTRADAS
## Talento 360 | Auditoría Funcional End-to-End (E2E)
### Seis Módulos de Permisos, Licencias, Incapacidades y SST — Gobernación de Boyacá

---

### ÍNDICE DE DEFECTOS DETECTADOS

| ID Defecto | Severidad | Módulo | Tipo de Defecto | Resumen |
| :--- | :---: | :--- | :--- | :--- |
| **DEF-001** | **Alta** | Licencias / Permisos | Seguridad (Subida de Archivos) | Carga arbitraria de archivos ejecutables sin validación de tipo MIME real |
| **DEF-002** | **Alta** | Administración de Solicitudes | Seguridad (Control de Acceso RBAC) | Escalamiento horizontal: radicación de Licencias por usuarios con rol exclusivo de Permisos |
| **DEF-003** | **Alta** | SST | Seguridad (Autorización / Confidencialidad) | Exposición no autorizada de estadísticas y diagnósticos institucionales a rol Funcionario |
| **DEF-004** | **Crítica** | Permisos / Licencias | Backend (Sintaxis SQL / Disponibilidad) | Error 500 en estadísticas por colocación errónea de casting `::int` antes de `FILTER` |
| **DEF-005** | **Media** | Permisos Laborales | Funcionalidad Incompleta | Ausencia de endpoint y token criptográfico para aprobación/rechazo directo en correos |
| **DEF-006** | **Baja** | Incapacidades SST | Interfaz / Integración | Desalineación de nombre de atributo entre respuesta del backend e interfaz gráfica |

---

## 1. DEF-001: CARGA ARBITRARIA DE ARCHIVOS Y AUSENCIA DE SNIFFING DE MAGIC BYTES EN SOPORTES DOCUMENTALES

- **Severidad:** **Alta**
- **Módulo Afectado:** Licencias / Permisos Laborales (`solicitudes_admin_soportes`)
- **Tipo de Defecto:** Vulnerabilidad de Seguridad (CWE-434: Unrestricted Upload of File with Dangerous Type)

#### A. Descripción del Problema
Al radicar solicitudes que requieren soportes documentales (por ejemplo, Licencia por Luto o permisos con soportes), el backend permite adjuntar archivos a través de un arreglo JSON con contenido en Base64. Sin embargo, en la ruta genérica de solicitudes (`parseGenericSoportes`), el sistema almacena directamente los bytes en la columna `contenido` (tipo `BYTEA`) sin validar la extensión permitida (`.pdf`, `.png`, `.jpg`) ni inspeccionar la firma de bytes iniciales (*magic bytes*). Durante la auditoría se constató que un archivo malicioso con extensión `.bat` (`virus_script.bat`) fue aceptado con código `HTTP 201 Created` y guardado en la base de datos institucional.

#### B. Pasos Exactos de Reproducción
1. Generar un token JWT firmado para el usuario `sebastian.rincon@boyaca.gov.co` (rol `Permisos y Licencias`).
2. Ejecutar la siguiente petición HTTP `POST /api/admin-requests`:

```bash
curl -X POST http://localhost/api/admin-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_SEBASTIAN>" \
  -d '{
    "tipo": "Licencia",
    "persona": "RODRIGO ALVAREZ MONTES",
    "documento": "71999111",
    "correoSolicitante": "rodrigo.alvarez@boyaca.gov.co",
    "sectorial": "SECRETARIA GENERAL",
    "dependencia": "DIRECCION GENERAL DE TALENTO HUMANO",
    "nivel": "PROFESIONAL",
    "cargo": "PROFESIONAL UNIVERSITARIO",
    "modalidad": "varios_dias",
    "fechaInicio": "01/09/2026",
    "fechaFin": "07/09/2026",
    "motivoCategoria": "Licencia por Luto",
    "soportes": [
      {
        "nombre": "script_ejecutable.bat",
        "tipo": "application/x-bat",
        "base64": "QGVjaG8gb2ZmDQplY2hvIFZJUlVTIUFMRVJUQVBJ"
      }
    ]
  }'
```

#### C. Comportamiento Actual
El servidor responde:
```json
HTTP/1.1 201 Created
{
  "message": "Solicitud creada.",
  "id": 67,
  "radicado": "LIC-2026-00067"
}
```
El archivo ejecutable `.bat` queda persistido en la tabla `solicitudes_admin_soportes` con `tipo_mime = 'application/x-bat'`.

#### D. Comportamiento Esperado
El sistema debe rechazar la petición con `HTTP 400 Bad Request` indicando que el tipo de soporte no es válido, aceptando exclusivamente documentos oficiales (`application/pdf`, `image/jpeg`, `image/png`) validados mediante inspección real de cabecera binaria (*magic bytes*).

#### E. Causa Raíz / Hipótesis Técnica
En el archivo `web/services/admin-requests-service/src/routes/admin-requests.js`, la función auxiliar `parseGenericSoportes`:
```javascript
function parseGenericSoportes(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const s of list) {
    if (!s || !s.nombre || !s.base64) continue;
    const buf = Buffer.from(s.base64, 'base64');
    out.push({ nombre: s.nombre, tipo: s.tipo || 'application/octet-stream', buffer: buf });
  }
  return out;
}
```
A diferencia de `permisos-validator.js` e `incapacidades.js` (que sí implementan `sniffMime`), `parseGenericSoportes` no invoca `sniffMime` ni valida la lista blanca de extensiones.

#### F. Impacto Operativo e Institucional
Riesgo de almacenamiento de archivos ejecutables, scripts dañinos o malware en la base de datos de la Gobernación, con potencial propagación a los equipos de los funcionarios que descarguen los soportes para su revisión.

---

## 2. DEF-002: ESCALAMIENTO HORIZONTAL ENTRE MÓDULOS DEBIDO A FALTA DE VALIDACIÓN RBAC EN RADICACIÓN

- **Severidad:** **Alta**
- **Módulo Afectado:** Permisos Laborales / Licencias (`admin-requests.js`)
- **Tipo de Defecto:** Falla de Control de Acceso (CWE-284: Improper Access Control / Horizontal Privilege Escalation)

#### A. Descripción del Problema
El sistema cuenta con roles diferenciados: `Permisos` (Alejandro León) y `Permisos y Licencias` (Sebastián Rincón). De acuerdo con la matriz de gobernanza institucional, el rol `Permisos` únicamente debe tener autorización para operar solicitudes de Permiso Laboral. Sin embargo, al enviar una petición de radicación con `tipo: 'Licencia'`, el endpoint no verifica si el usuario autenticado tiene el permiso `canManage` o `canCreate` para el submódulo correspondiente.

#### B. Pasos Exactos de Reproducción
1. Generar token JWT para `alejandro.leon@boyaca.gov.co` (rol `Permisos`).
2. Enviar petición `POST /api/admin-requests` con `tipo: "Licencia"`:

```bash
curl -X POST http://localhost/api/admin-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_ALEJANDRO>" \
  -d '{
    "tipo": "Licencia",
    "persona": "PRUEBA NO AUTORIZADA",
    "documento": "71999999",
    "modalidad": "varios_dias",
    "fechaInicio": "01/09/2026",
    "fechaFin": "05/09/2026",
    "motivoCategoria": "Licencia por Luto"
  }'
```

#### C. Comportamiento Actual
La solicitud es aceptada y creada exitosamente con código `HTTP 201 Created`, generando radicado oficial de Licencia `LIC-2026-XXXXX`.

#### D. Comportamiento Esperado
El sistema debe verificar el permiso granular del usuario frente al módulo `licencias` y retornar `HTTP 403 Forbidden`: *"No tiene permisos para radicar ni administrar solicitudes en el módulo de Licencias"*.

#### E. Causa Raíz / Hipótesis Técnica
En `web/services/admin-requests-service/src/routes/admin-requests.js` (líneas 524-540):
```javascript
const modulo = moduloFromTipo(tipo);
const perm = await getModulePermission(pool, req.user, modulo);
const estadoInicial = perm.canApprove ? normalizeStatus(estado) : 'Pendiente';
```
El código consulta `getModulePermission(pool, req.user, modulo)`, pero **nunca evalúa** si `perm.canManage` o `perm.canCreate` es falso para denegar la operación con un 403; únicamente utiliza el permiso para decidir si el estado inicial queda como `Pendiente` o el solicitado.

#### F. Impacto Operativo e Institucional
Violación del principio de menor privilegio y de la asignación formal de responsabilidades en la Dirección de Talento Humano.

---

## 3. DEF-003: EXPOSICIÓN DE ESTADÍSTICAS Y DIAGNÓSTICOS GLOBALES DE SST A USUARIOS CON ROL FUNCIONARIO

- **Severidad:** **Alta**
- **Módulo Afectado:** Seguridad y Salud en el Trabajo (`sst.js`)
- **Tipo de Defecto:** Fuga de Información Sensible / Autorización Rota (CWE-200 / CWE-285)

#### A. Descripción del Problema
El endpoint `GET /api/sst/stats` entrega el resumen consolidado de exámenes médicos ocupacionales, vigencias de EMO, patologías direccionadas a PVE (Programas de Vigilancia Epidemiológica), inventarios de EPP y caracterización sociodemográfica por dependencia. Dicho endpoint solo requiere un token JWT válido pero no comprueba que el usuario pertenezca al equipo de SST o a la Administración, permitiendo que cualquier funcionario de planta consulte diagnósticos agrupados y datos sensibles institucionales.

#### B. Pasos Exactos de Reproducción
1. Iniciar sesión con el usuario `funcionario@boyaca.gov.co` (rol `Funcionario`).
2. Invocar por API o navegador el endpoint:

```bash
curl -X GET http://localhost/api/sst/stats \
  -H "Authorization: Bearer <TOKEN_FUNCIONARIO>"
```

#### C. Comportamiento Actual
El servidor retorna código `HTTP 200 OK` con un JSON que contiene:
- `totalEmo`, `emoVigentes`, `emoAlertas`, `casosSeguimiento`.
- Programas de vigilancia epidemiológica (`PVE Biomecánico / Osteomuscular`).
- Relación de existencias, bajas y dotaciones de todos los elementos de protección personal.
- Caracterización sociodemográfica con rangos de edad, escolaridad y salarios de dependencias.

#### D. Comportamiento Esperado
El sistema debe denegar el acceso a funcionarios que no integren la Subdirección de SST o la Administración con `HTTP 403 Forbidden`: *"Acceso denegado a estadísticas gerenciales de SST"*.

#### E. Causa Raíz / Hipótesis Técnica
En `web/services/sst-service/src/routes/sst.js` (línea 482):
```javascript
router.get('/stats', auth, async (req, res) => { ... });
```
La ruta incluye el middleware genérico `auth`, pero omite el chequeo de permisos de módulo (`getModulePermission(pool, req.user, 'sst')`).

#### F. Impacto Operativo e Institucional
Incumplimiento de las directrices de confidencialidad de la Ley 1581 de 2012 (Protección de Datos Personales) y de la Resolución 2346 de 2007 (Custodia y reserva de historias clínicas y evaluaciones ocupacionales).

---

## 4. DEF-004: ERROR DE SINTAXIS SQL `500 INTERNAL SERVER ERROR` EN ENDPOINT DE ESTADÍSTICAS ADMINISTRATIVAS

- **Severidad:** **Crítica**
- **Módulo Afectado:** Permisos Laborales / Licencias (`admin-requests.js`)
- **Tipo de Defecto:** Bug de Base de Datos / Error de Sintaxis SQL (CWE-398)

#### A. Descripción del Problema
Cuando el Administrador o los usuarios responsables ingresan a la plataforma para ver el resumen estadístico de solicitudes administrativas (`GET /api/admin-requests/stats`), el microservicio falla catastróficamente retornando un error `HTTP 500 Internal Server Error`, impidiendo la visualización de los gráficos de evolución y consolidado de permisos y licencias.

#### B. Pasos Exactos de Reproducción
1. Generar token para el usuario `admin` (rol `Administrador`).
2. Ejecutar la siguiente petición HTTP:

```bash
curl -X GET http://localhost/api/admin-requests/stats \
  -H "Authorization: Bearer <TOKEN_ADMIN>"
```

#### C. Comportamiento Actual
El servidor responde:
```json
HTTP/1.1 500 Internal Server Error
{
  "error": "Error al consultar estadísticas."
}
```
En los logs del contenedor Docker (`docker logs talento360_admin_requests`) se registra:
```
[admin-requests/stats] error: syntax error at or near "FILTER"
```

#### D. Comportamiento Esperado
El servidor debe ejecutar las consultas analíticas de manera limpia y responder `HTTP 200 OK` con el consolidado por estado (`pendientes`, `revision`, `aprobadas`, `rechazadas`, `totalDias`, etc.).

#### E. Causa Raíz / Hipótesis Técnica
En el archivo `web/services/admin-requests-service/src/routes/admin-requests.js` (líneas 385-392):
```javascript
const baseByType = await pool.query(
  `SELECT tipo,
          COUNT(*)::int FILTER (WHERE estado='Pendiente') AS pendientes,
          COUNT(*)::int FILTER (WHERE estado='En revisión') AS revision,
          COUNT(*)::int FILTER (WHERE estado='Aprobada' OR estado='Finalizada') AS aprobadas,
          COUNT(*)::int FILTER (WHERE estado='Rechazada') AS rechazadas,
          COUNT(*)::int FILTER (WHERE estado='Finalizada') AS finalizadas,
          COUNT(*)::int AS total
   FROM solicitudes_admin GROUP BY tipo`
);
```
**Análisis sintáctico de PostgreSQL:** La cláusula estándar de agregación filtrada en SQL es `COUNT(*) FILTER (WHERE ...)`. Al intercalar la conversión de tipo `::int` entre `COUNT(*)` y `FILTER`, el parser de PostgreSQL finaliza la expresión en `::int` y al encontrar el token `FILTER` arroja inmediatamente un error fatal de sintaxis. La sintaxis correcta debe ser `(COUNT(*) FILTER (WHERE ...))::int` o simplemente `COUNT(*) FILTER (WHERE ...)`.

#### F. Impacto Operativo e Institucional
Inoperatividad total de los paneles de control y métricas gerenciales de permisos y licencias en la interfaz web de Talento 360.

---

## 5. DEF-005: AUSENCIA DE MECANISMO DE APROBACIÓN / RECHAZO DIRECTO MEDIANTE TOKEN EN CORREOS

- **Severidad:** **Media**
- **Módulo Afectado:** Permisos Laborales (`mailer.js` / `admin-requests.js`)
- **Tipo de Defecto:** Funcionalidad Incompleta / Disparidad frente a Requerimientos

#### A. Descripción del Problema
El requerimiento funcional estipula que el jefe inmediato debe recibir en la notificación por correo electrónico un enlace seguro que le permita aprobar o rechazar la solicitud de permiso laboral directamente desde su dispositivo móvil o cliente de correo, sin requerir iniciar sesión en el aplicativo interno.

#### B. Pasos Exactos de Reproducción
1. Inspeccionar la función de generación de correos en `web/services/admin-requests-service/src/utils/mailer.js`.
2. Radicar un permiso laboral y revisar el cuerpo HTML generado para el jefe inmediato.

#### C. Comportamiento Actual
En `mailer.js` (líneas 106-107):
```javascript
const actionUrl = process.env.APP_PUBLIC_URL || 'http://localhost';
```
El correo incluye únicamente un botón que redirige a la página principal de la plataforma (`http://localhost`), obligando al jefe a autenticarse manualmente y buscar la solicitud. No existe token de firma HMAC ni ruta pública como `/api/admin-requests/decision?token=...`.

#### D. Comportamiento Esperado
El sistema debe generar un token criptográfico de un solo uso (con vigencia de 72 horas y clave secreta), enviando botones con enlaces parametrizados:
- `http://localhost/api/admin-requests/public/decision?token=<TOKEN_FIRMA>&accion=aprobar`
- `http://localhost/api/admin-requests/public/decision?token=<TOKEN_FIRMA>&accion=rechazar`

#### E. Impacto Operativo e Institucional
Retrasos en la aprobación oportuna de permisos laborales por parte de supervisores y directores que acceden desde redes externas o dispositivos móviles institucionales.

---

## 6. DEF-006: DESALINEACIÓN DE ATRIBUTOS EN RESPUESTA DE IMPORTACIÓN MASIVA DE INCAPACIDADES

- **Severidad:** **Baja**
- **Módulo Afectado:** Incapacidades SST (`incapacidades.js` frontend vs backend)
- **Tipo de Defecto:** Inconsistencia de Interfaz / Mapeo de Atributos

#### A. Descripción del Problema
Al completar una importación masiva desde Excel mediante el Formato E-DO-ST-F-002, el backend retorna el objeto con las claves `{ inserted, skipped, errors }`. Sin embargo, en el código JavaScript del frontend (`incapacidades.js`), la rutina que actualiza la alerta de resultados intenta leer `res.duplicatesSkipped`. Como dicha clave no existe, la notificación al usuario muestra `undefined` omitidos.

#### B. Causa Raíz
En `web/frontend/src/js/modules/incapacidades.js` (línea 164), se busca `res.duplicatesSkipped`, mientras que el endpoint en `web/services/admin-requests-service/src/routes/incapacidades.js` (línea 865) devuelve `{ inserted, skipped, errors }`.

#### C. Impacto Operativo
Confusión visual menor en el usuario de nómina al interpretar el resultado del procesamiento de archivos Excel con duplicados.

