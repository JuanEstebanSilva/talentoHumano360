# AUDITORÍA 04: INFORME TÉCNICO DETALLADO
## Plataforma Institucional Talento 360 — Gobernación de Boyacá

---

### 1. ALCANCE Y METODOLOGÍA DE EVALUACIÓN

La presente auditoría técnica comprende el análisis exhaustivo e inspección rigurosa de los siguientes componentes del ecosistema **Talento 360**:
- **Gateway y Capa Perimetral:** Nginx Reverse Proxy (`web/frontend/nginx.conf`), enrutamiento hacia contenedores internos, cabeceras de seguridad HTTP, terminación SSL/TLS y mitigación CORS/CSP.
- **Capa de Autenticación y Autorización:** `auth-service` (Puerto 3001), generación de JWT, cifrado con bcrypt, caducidad de tokens, políticas de contraseñas y middleware de RBAC.
- **Capa de Microservicios Operativos:**
  - `employees-service` (Puerto 3002): Gestión de servidores públicos, cargos, dependencias y tiempos de servicio.
  - `requests-service` (Puerto 3003) y `admin-requests-service` (Puerto 3004): Trámite de solicitudes administrativas.
  - `viaticos-service` (Puerto 3005): Ingesta masiva Excel, procesamiento de comisiones, generación de estadísticas y control de estados.
  - `dashboard-service` (Puerto 3006): Métricas agregadas y consolas de monitoreo.
  - `horarios-service` (Puerto 3007): Programación laboral, acuerdos de jornada y turnos.
  - `sst-service` (Puerto 3008): Seguridad y salud en el trabajo.
- **Capa de Datos y Persistencia:** PostgreSQL 15 (`talento360_db`), integridad referencial, disparadores (triggers), índices, transaccionalidad, procedimientos almacenados y aislamiento de esquemas.
- **Frontend SPA:** Interfaz web institucional Vanilla JS, CSS3 responsive, manipulación del DOM y comunicación vía `fetch` asíncrono.
- **Regla Metodológica:** Inspección estricta no destructiva, análisis estático de código fuente y ejecución de pruebas de verificación automatizadas en tiempo de ejecución.

---

### 2. ARQUITECTURA DE SOFTWARE Y DESACOPLAMIENTO DE SERVICIOS

```mermaid
flowchart TD
    Client["Navegador Web / Cliente Institucional"]
    Nginx["Nginx Reverse Proxy / Gateway (Puerto 80)"]
    
    subgraph Microservicios Docker
        Auth["auth-service (3001)"]
        Employees["employees-service (3002)"]
        Requests["requests-service (3003)"]
        AdminReq["admin-requests-service (3004)"]
        Viaticos["viaticos-service (3005)"]
        Dashboard["dashboard-service (3006)"]
        Horarios["horarios-service (3007)"]
        SST["sst-service (3008)"]
    end
    
    DB[(PostgreSQL 15 Container - 5432)]
    
    Client -->|HTTP / SPA| Nginx
    Nginx -->|/api/auth| Auth
    Nginx -->|/api/employees| Employees
    Nginx -->|/api/requests| Requests
    Nginx -->|/api/admin| AdminReq
    Nginx -->|/api/viaticos| Viaticos
    Nginx -->|/api/destinos| Viaticos
    Nginx -->|/api/dashboard| Dashboard
    Nginx -->|/api/horarios| Horarios
    Nginx -->|/api/sst| SST
    
    Auth & Employees & Requests & AdminReq & Viaticos & Dashboard & Horarios & SST -->|Connection Pool (pg)| DB
```

#### 2.1. Evaluación del Gateway Nginx
- **Enrutamiento perimetral:** Las directivas de `nginx.conf` mapean de manera limpia cada prefijo `/api/*` hacia el microservicio correspondiente mediante la red interna Docker `talento_net`.
- **Corrección de ruta `/api/destinos`:** Se confirmó que la directiva `location /api/destinos { proxy_pass http://viaticos:3005/destinos; }` resuelve el problema histórico de devolver la página HTML de la SPA; ahora retorna el listado JSON correspondiente con código HTTP 200.
- **Manejo de errores:** Configuración adecuada de `proxy_intercept_errors on;` evitando la divulgación de trazas de pila (stack traces) ante caídas de servicios upstream.

#### 2.2. Aislamiento y Resiliencia en Docker
- Todos los servicios definen `restart: unless-stopped` y dependen de la base de datos mediante condiciones `service_healthy`.
- El archivo `docker-compose.yml` fija la variable `NODE_ENV: production` de forma explícita en todos los contenedores de Node.js, deshabilitando la divulgación de errores detallados en los payloads de respuesta.

---

### 3. EVALUACIÓN DETALLADA DEL MÓDULO DE VIÁTICOS

#### 3.1. Delimitación Estricta del Negocio Institucional
Se verificó formalmente el cumplimiento del mandato institucional: **Talento 360 NO liquida viáticos ni administra pagos**.
- **Inspección de endpoints:** El endpoint residual `POST /api/viaticos/calcular-liquidacion` fue removido en la remediación previa y actualmente retorna `404 Not Found`.
- **Inspección de artefactos:** El archivo `web/backend/viaticos-service/src/services/viaticosCalculator.js` fue aislado y archivado con prefijo `_deprecated_`, sin ser importado por ningún controlador o ruta del sistema.
- **Tratamiento de valores:** Los campos monetarios (`valor_viatico`, `gasto_viaje`, etc.) se conservan como importes reportados desde los archivos Excel de la Gobernación, registrándose en PostgreSQL en tipo `numeric(12,2)` sin sufrir alteraciones de cálculo tarifario ni dependencias de grado o pernoctada.

#### 3.2. Proceso de Carga Masiva y Procesamiento Excel
- **Resiliencia ante discrepancias de personal (`AUD-NUEVO-008`):** Se verificó el algoritmo en `src/services/excel-service.js`. Cuando una cédula reportada en el archivo Excel no existe en la tabla maestra `personas`, el sistema:
  1. Registra un registro provisional en `personas` con los nombres y cédula extraídos del archivo.
  2. Utiliza **SAVEPOINTS de base de datos** (`SAVEPOINT viatico_sp_...`) por cada fila procesada.
  3. Si una fila presenta inconsistencias de datos insolubles, se hace `ROLLBACK TO SAVEPOINT`, registrando el error en el resumen final sin abortar la transacción completa del lote.
- **Protección contra Inyección de Fórmulas (CWE-1236 / CSV Injection):** La exportación a Excel implementa la sanitización obligatoria prefijando con apóstrofe (`'`) cualquier celda de texto que comience con `=, +, -, @, \t, \r`.
- **Codificación:** Archivos CSV/Excel exportados incluyen el preámbulo UTF-8 BOM (`\uFEFF`), garantizando visualización correcta de tildes y caracteres especiales en Microsoft Excel para Windows.

#### 3.3. Estadísticas Agregadas y Consultas
- Se auditaron las funciones de agregación en `src/controllers/viaticos.controller.js`:
  - Conteos de viajes por servidor público (`COUNT(id_viatico)`).
  - Sumatorias monetarias registradas por funcionario (`SUM(valor_viatico)`).
  - Distribución temporal por año, mes y trimestre.
  - Destinos más frecuentes y dependencias que concentran mayor volumen de comisiones.
- Todas las consultas emplean agregaciones estándar de PostgreSQL sobre las columnas indexadas, con tiempos de respuesta inferiores a **65 ms** para un volumen de **6,556 registros de viáticos** en la base de datos de auditoría.

---

### 4. EVALUACIÓN DEL MÓDULO DE HORARIOS

#### 4.1. Estructura y Administración de Jornadas
- La tabla `horarios` almacena la asignación de turnos, hora de entrada, hora de salida, días laborales y observaciones del acuerdo de horario.
- La consulta `GET /api/horarios` procesó exitosamente **136 acuerdos de horarios** en un tiempo medio de **18 ms**.

#### 4.2. Validaciones de Conflicto y Solapamiento
- Se comprobó la existencia de validaciones en la creación de nuevos acuerdos para evitar que un mismo servidor público cuente con dos acuerdos de jornada activos en rangos de fechas superpuestos.
- El módulo permite auditar el cumplimiento de acuerdos sin inferir cálculos de nómina o descuentos, manteniéndose dentro de su alcance documental y organizativo.

---

### 5. EVALUACIÓN DEL MÓDULO DE SERVIDORES PÚBLICOS

#### 5.1. Consulta, Paginación y Filtrado Parametrizado
- **Mitigación de Inyección SQL (`AUD-NUEVO-006`):** Se verificó el endpoint `/api/employees/buscar`. A diferencia de versiones anteriores donde existía concatenación de literales SQL, la consulta actual se encuentra 100% parametrizada:
  ```javascript
  const query = `
    SELECT p.numero_documento, p.nombre, p.apellido, r.cargo_actual, r.dependencia
    FROM personas p
    JOIN rel_principal r ON p.numero_documento = r.numero_documento
    WHERE ($1 = '' OR p.numero_documento ILIKE $2 OR p.nombre ILIKE $2 OR p.apellido ILIKE $2)
    LIMIT 50;
  `;
  ```
- **Filtros por Fecha Seguros (`AUD-NUEVO-002`):** La función auxiliar en base de datos `safe_parse_date` previene excepciones en tiempo de ejecución al recibir cadenas en formatos ambiguos (`DD/MM/YYYY` vs `YYYY-MM-DD`), convirtiéndolas de forma segura a tipo `DATE` o retornando `NULL` ante valores no procesables.

#### 5.2. Protección de Integridad Referencial en Eliminación
- Se probó el endpoint `DELETE /api/employees/:cedula` intentando eliminar a un servidor con antecedentes de viáticos y horarios:
  - **Resultado en tiempo de ejecución:** El backend denegó la operación retornando código **HTTP 409 Conflict**:
    ```json
    {
      "success": false,
      "error": "No es posible eliminar el servidor público porque cuenta con registros históricos asociados (acuerdos de horarios, comisiones de viáticos o antecedentes). Para desvincular al servidor sin perder la trazabilidad institucional, utilice la opción de Retiro / Cambio de Estado."
    }
    ```
  - Esto garantiza que no ocurran borrados en cascada no deseados ni se creen registros huérfanos en las comisiones de viáticos.

---

### 6. SEGURIDAD Y CONTROL DE ACCESO BASADO EN ROLES (RBAC)

#### 6.1. Autenticación y Gestión de Tokens
- El servicio `auth-service` emite JSON Web Tokens firmados con algoritmo HS256 y secreto configurable en entorno (`JWT_SECRET`).
- Se verificó que las contraseñas en la tabla `usuarios` están procesadas mediante `bcrypt` con costo de trabajo adecuado ($2b$10$).
- Se confirmó el rechazo inmediato (`401 Unauthorized`) ante intentos de autenticación mediante tokens incrustados en la URL query string (`?token=...`), obligando al uso de la cabecera estándar `Authorization: Bearer <token>`.

#### 6.2. Evaluación de Permisos de Escritura (Mutaciones)
Se comprobó que las restricciones de escritura se aplican con rigor absoluto:
- Intento de `doris.canon` creando un registro en Viáticos: **Rechazado con 403 Forbidden** (`{"error": "Permisos insuficientes."}`).
- Intento de `doris.canon` creando un Servidor Público: **Rechazado con 403 Forbidden**.
- Intento de `bergenet.gutierrez` creando un Acuerdo de Horario: **Rechazado con 403 Forbidden**.
- Las mutaciones de datos permanecen blindadas y bajo estricto control funcional.

#### 6.3. Análisis de Nuevos Hallazgos de Seguridad

```
+---------------------------------------------------------------------------------------+
| HALLAZGO AUD-4-001 (SEVERIDAD ALTA): Sobrebloqueo de Lectura Cruzada Institucional   |
+---------------------------------------------------------------------------------------+
| Localización: Middlewares canRead() en employees, viaticos y horarios.                |
| Descripción:                                                                         |
| En la corrección del hallazgo AUD-NUEVO-001 (Tercera Auditoría), se impuso un control |
| que exige que el usuario tenga asignado el módulo correspondiente en usuarios.modulos |
| para poder realizar peticiones GET.                                                   |
| Como a las funcionarias se les asignó únicamente su módulo primario, Doris Canon      |
| no puede ver Viáticos ni Servidores; Bergenet no puede ver Servidores ni Horarios;     |
| Ángela y Blanca no pueden ver Viáticos ni Horarios.                                   |
| Impacto:                                                                             |
| Contraviene la regla institucional de la Gobernación de Boyacá, la cual estipula      |
| que todas las funcionarias de Talento Humano deben contar con permiso de LECTURA      |
| (VER) transversal sobre todos los módulos operativos.                                 |
+---------------------------------------------------------------------------------------+
```

```
+---------------------------------------------------------------------------------------+
| HALLAZGO AUD-4-002 (SEVERIDAD MEDIA): Validación de Roles por Subcadena en Servicios  |
|                                       Secundarios                                     |
+---------------------------------------------------------------------------------------+
| Localización: requests-service, admin-requests-service, sst-service.                  |
| Descripción:                                                                         |
| Funciones canEdit(role) implementadas con:                                           |
|   return role.toLowerCase().includes('administrador') || ...                         |
| Riesgo:                                                                               |
| Si en el futuro se crea un rol como 'Administrador_Observador' o 'No_Administrador',  |
| la expresión regular evaluará a true, otorgando privilegios indebidos.                |
| Solución requerida:                                                                  |
| Reemplazar por igualdad estricta (===) o mapeo centralizado de permisos can(perm).    |
+---------------------------------------------------------------------------------------+
```

---

### 7. INTEGRIDAD DE BASE DE DATOS Y CONCURRENCIA

- **Estado de secuencias y claves primarias:** Todas las tablas principales (`usuarios`, `personas`, `rel_principal`, `viaticos`, `horarios`) cuentan con llaves primarias válidas y secuencias auto-incrementales sincronizadas con sus valores máximos actuales.
- **Índices de optimización:**
  - `idx_viaticos_cedula` en `viaticos(numero_documento)`
  - `idx_viaticos_fecha_salida` en `viaticos(fecha_salida)`
  - `idx_personas_nombre` en `personas(nombre, apellido)`
  - `idx_horarios_cedula` en `horarios(numero_documento)`
- **Concurrencia:** Los pools de conexión de `pg` están acotados a un máximo de 10 conexiones simultáneas por contenedor, garantizando que el servidor PostgreSQL (límite predeterminado de 100 conexiones) nunca alcance saturación por picos en los microservicios.

---

### 8. MÉTRICAS DE RENDIMIENTO Y LATENCIA OBTENIDAS

Las siguientes mediciones de latencia fueron recolectadas durante las pruebas de auditoría automatizadas sobre el entorno de contenedores:

| Endpoint Evaluado | Método | Tamaño de Payload | Tiempo de Respuesta Promedio |
|---|:---:|:---:|:---:|
| `/api/auth/login` | POST | 1.2 KB | 115 ms (procesamiento bcrypt) |
| `/api/employees` | GET | 678 registros (184 KB) | 42 ms |
| `/api/employees/buscar?q=ANGELA` | GET | 8 registros (2.8 KB) | 16 ms |
| `/api/viaticos` | GET | Paginado (15 KB) | 28 ms |
| `/api/viaticos/estadisticas` | GET | Agregado (4.2 KB) | 52 ms |
| `/api/viaticos/destinos` | GET | 120 destinos (6.5 KB) | 21 ms |
| `/api/horarios` | GET | 136 registros (34 KB) | 18 ms |

