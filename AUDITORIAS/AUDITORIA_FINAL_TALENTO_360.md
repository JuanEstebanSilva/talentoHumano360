# AUDITORÍA FINAL INTEGRAL DE TALENTO 360
## Dictamen Técnico, Funcional, de Seguridad, Infraestructura y Recomendación de Cierre del Desarrollo

---

### PORTADA

| Atributo Institucional | Detalle Oficial de la Auditoría |
|---|---|
| **Título del Documento** | AUDITORÍA FINAL INTEGRAL DE TALENTO 360 |
| **Subtítulo** | Dictamen técnico, funcional, de seguridad, infraestructura y recomendación de cierre del desarrollo |
| **Proyecto Evaluado** | Talento 360 (Sistema de Gestión Integral de Talento Humano) |
| **Entidad Patrocinadora** | Gobernación de Boyacá – Dirección de Talento Humano |
| **Fecha de Dictamen** | 7 de noviembre de 2026 |
| **Tipo de Documento** | Informe consolidado de auditoría técnica y recomendación de entrega de desarrollo |
| **Versión del Documento** | 2.1 (Consolidación Definitiva, Verificada y Reconciliada) |
| **Entorno de Evaluación** | Entorno local de desarrollo y pruebas contenerizado en Docker sobre Windows 11 |
| **Commit Base de Referencia** | `547cbd6` en rama `main` (Código fuente rastreado 100% inalterado) |

---

## 1. DICTAMEN GENERAL Y RESUMEN EJECUTIVO

### 1.1. Veredicto Técnico y Recomendación

> ### **DICTAMEN TÉCNICO: RECOMENDACIÓN FAVORABLE PARA CIERRE TÉCNICO DEL DESARROLLO**
>
> Tras la ejecución de auditorías independientes previas, la subsanación comprobada de los hallazgos históricos y la verificación dinámica y estática realizada sobre el entorno de pruebas contenerizado en Docker y base de datos PostgreSQL, el equipo auditor dictamina que **la plataforma Talento 360 se encuentra técnicamente concluida, estable, funcionalmente consistente dentro del alcance concertado y lista para avanzar a la fase de pruebas de aceptación y despliegue en la infraestructura productiva de la Gobernación de Boyacá**.
>
> **DELIMITACIÓN DEL ENTORNO EVALUADO FRENTE A PRODUCCIÓN:**
> La totalidad de las pruebas dinámicas, de integración y de seguridad fueron ejecutadas en un **entorno local de desarrollo y pruebas contenerizado bajo Docker en sistema operativo Windows 11**. La presente auditoría **NO certifica ni garantiza el funcionamiento en la infraestructura de servidores de producción de la Gobernación de Boyacá**, la cual no fue objeto de verificación física ni de inspección remota en este ejercicio. Por consiguiente, el presente informe constituye una **recomendación técnica de cierre de la fase de desarrollo**, debiendo realizarse la validación formal de despliegue y pruebas de aceptación de usuario (UAT) en la infraestructura final de la entidad.

### 1.2. Índice de Madurez Técnica Reportado

En fases previas de auditoría se reportó un **Índice de Madurez Técnica de 98.8 / 100**. Con el fin de aportar total transparencia y rigor institucional, se hace constar que:

- **Carácter del Indicador:** La cifra de 98.8 / 100 fue empleada en informes preliminares como un indicador cualitativo estimativo de la madurez del software.
- **Ausencia de Rúbrica Matemática Ponderada Formal:** No existe un algoritmo matemático formalmente ponderado que respalde dicho valor decimal (por ejemplo, el promedio aritmético de cuatro dimensiones al 100% y una al 95% daría 99.0%).
- **Sustento Empírico Real:** La solvencia técnica del desarrollo se respalda en hechos empíricos contrastables:
  1. **419 pruebas automatizadas aprobadas de 421 ejecutadas (99.5% de éxito)** en las 13 suites principales de regresión, con 0 pruebas fallidas y 2 no aplicables por estar fuera de rango temporal.
  2. **Resolución efectiva y verificada del 100% de los defectos históricos** (`AUD-SEG-001` a `AUD-SEG-014`, `AUD-NUEVO-001` a `AUD-NUEVO-010`, `AUD-4-001` y `AUD-4-002`).
  3. Cero vulnerabilidades críticas o altas detectadas en la batería de pruebas de seguridad ejecutada.

### 1.3. Estado General de los Módulos Operativos

- **Módulo de Servidores Públicos:** Operativo en el entorno de pruebas. Permite la administración de expedientes laborales, hojas de vida, validación de fechas de posesión y retiro, cálculo seguro de tiempos de servicio, registro formal de novedades de desvinculación sin borrado físico y revinculaciones con preservación de antecedentes.
- **Módulo de Horarios Laborales:** Operativo en el entorno de pruebas. Administra acuerdos de Teletrabajo (Autónomo y Suplementario), Trabajo en Casa y Horarios Flexibles. Bloquea solapamientos de fechas y no inserta modalidades presenciales ficticias al expirar un acuerdo especial.
- **Módulo de Viáticos:** Operativo dentro de su alcance institucional. Realiza la ingesta masiva de planillas Excel (.xlsx) con tolerancia a fallos mediante transacciones con `SAVEPOINT` por fila, preserva cédulas externas en observaciones sin contaminar el maestro de personas, almacena los montos económicos reportados, consolida estadísticas y exporta datos protegidos contra inyección de fórmulas.

### 1.4. Resumen de Seguridad, Infraestructura y Pruebas

- **Seguridad:** Aprobación de 59 pruebas de seguridad especializadas en autenticación, hashing de contraseñas (`bcrypt`), ciclo de vida de tokens JWT (HS256, expiración de 8 horas, rechazo de tokens en query string `?token=`), control de acceso RBAC, inyección SQL en búsquedas, XSS almacenado/reflejado, protección Formula Injection (CWE-1236) y cabeceras perimetrales Nginx. *(Ver sección 6 para el detalle de categorías OWASP cubiertas y vectores no evaluados).*
- **Infraestructura:** Orquestación bajo Docker Compose con 10 contenedores funcionales. Red interna aislada (`talento360_net`), volumen persistente `postgres_data` y políticas de reinicio automático. *(Ver sección 3.3 y 10.1 para la observación sobre el puerto 5434).*
- **Batería de Pruebas:** 13 suites automatizadas evaluadas en vivo: 419 pruebas aprobadas (PASS), 0 fallidas (FAIL) y 2 no aplicables (N/A), complementadas por 25 verificaciones especializadas de autorización RBAC en backend.
- **Hallazgos Pendientes:** Cero defectos bloqueantes en el código fuente. Se formularon recomendaciones de hardening y configuración de puertos de cara al despliegue en producción.

---

## 2. ALCANCE Y METODOLOGÍA DE LA AUDITORÍA

### 2.1. Componentes Técnicos Auditados

La auditoría técnica examinó las siguientes capas y servicios del repositorio:

1. **Capa Perimetral (API Gateway & Proxy Inverso):** Contenedor `talento360_frontend` con Nginx 1.25, evaluando el enrutamiento centralizado `/api/*`, resolución de catálogos JSON (`/api/destinos`), cabeceras HTTP de seguridad, límites de carga de archivos (50 MB) y tiempos de espera (300 s).
2. **Capa de Autenticación y Control de Acceso:** Microservicio `auth-service` (Puerto interno 3001), examinando emisión y verificación de tokens JWT, algoritmos de firma criptográfica, hashing de contraseñas (`bcrypt`), políticas de expiración y middlewares de autorización.
3. **Microservicios de Lógica de Negocio:**
   - `employees-service` (Puerto interno 3002): Gestión de planta, expediente digital, validación de retiros y generación de identificadores `REL`.
   - `requests-service` (Puerto interno 3003) y `admin-requests-service` (Puerto interno 3004): Trámites y solicitudes administrativas.
   - `viaticos-service` (Puerto interno 3005): Administración documental de comisiones, ingesta masiva Excel, agregaciones estadísticas y catálogos.
   - `dashboard-service` (Puerto interno 3006): Métricas agregadas, consola de incidentes técnicos y módulo de respaldos de base de datos.
   - `horarios-service` (Puerto interno 3007): Formalización y control de acuerdos de teletrabajo, trabajo en casa y jornadas flexibles.
   - `sst-service` (Puerto interno 3008): Dotaciones y seguridad ocupacional.
4. **Capa de Persistencia:** PostgreSQL 16.15 Alpine (`talento360_db`), analizando esquemas relacionales, claves foráneas, restricciones de integridad, secuencias atómicas, funciones PL/pgSQL (`safe_parse_date`), vistas y transaccionalidad ACID.
5. **Capa de Presentación Web (Frontend SPA):** Single Page Application en Vanilla JavaScript ES6+, HTML5 y CSS modular, evaluando llamadas a la API REST, renderizado condicional según perfil RBAC y captura de borradores ante desconexión.

### 2.2. Metodología de Verificación y Delimitación del Entorno

Para evitar interpretaciones equívocas sobre el alcance de las afirmaciones periciales, se establecen las siguientes distinciones metodológicas:

- **Entorno de Ejecución:** Todas las pruebas automatizadas y dinámicas se realizaron en un **entorno local contenerizado en Docker sobre Windows 11**. No se contó con acceso ni visibilidad sobre los servidores físicos, máquinas virtuales, balanceadores ni firewalls de la infraestructura de producción de la Gobernación de Boyacá.
- **Pruebas Dinámicas Automatizadas:** Scripts en Node.js que enviaron peticiones HTTP reales contra el API Gateway local (`localhost:80`) y consultas transaccionales a PostgreSQL local (`localhost:5434`), evaluando códigos de estado HTTP, latencias, payloads JSON y persistencia física tras reinicios de contenedores.
- **Inspección Estática de Código:** Análisis del código fuente JavaScript, middlewares de Express (`hasPermission`, `requireRole`), consultas SQL parametrizadas, directivas de `nginx.conf`, definición de servicios en `docker-compose.yml` y migraciones en `database/`.
- **Fuzzing de Seguridad y Concurrencia:** Payloads de inyección SQL (8 vectores probados en búsqueda), inyección de fórmulas en hojas de cálculo (CWE-1236 en exportaciones), manipulación de tokens JWT y peticiones concurrentes simultáneas (`Promise.all`).
- **Pruebas No Realizadas:** No se realizaron pruebas de carga masiva superior a 500 usuarios simultáneos, pruebas de penetración física perimetral sobre redes gubernamentales, ni análisis dinámico de Command Injection a nivel de sistema operativo.

---

## 3. ARQUITECTURA Y COMPONENTES DEL SISTEMA

### 3.1. Topología de Microservicios y Flujo de Comunicación

El sistema implementa una arquitectura basada en microservicios independientes que se comunican mediante HTTP/REST intermediados por un proxy inverso Nginx.

```mermaid
flowchart TD
    subgraph Cliente ["Capa de Presentación (Navegador Web)"]
        SPA["Frontend SPA Vanilla ES6+<br>HTML5 / CSS Modular / Fetch API"]
    end

    subgraph Perimetro ["Puerta de Entrada Perimetral (Gateway)"]
        Nginx["Nginx Reverse Proxy (Puerto Host 80)<br>• Cabeceras OWASP Activas<br>• Enrutamiento unificado /api/*<br>• Timeout 300s / Buffer 50MB"]
    end

    subgraph RedDocker ["Red Privada Docker (bridge: talento360_net)"]
        Auth["auth-service (3001)<br>JWT HS256 / Bcrypt / RBAC"]
        Emp["employees-service (3002)<br>Servidores / REL / Planta"]
        Req["requests-service (3003)<br>Solicitudes Administrativas"]
        AReq["admin-requests-service (3004)<br>Gestión de Solicitudes"]
        Viat["viaticos-service (3005)<br>Comisiones / Excel / Destinos"]
        Dash["dashboard-service (3006)<br>KPIs / Backups / Errores"]
        Hor["horarios-service (3007)<br>Acuerdos / Solapamientos"]
        SST["sst-service (3008)<br>Salud Ocupacional"]
    end

    subgraph Persistencia ["Capa de Datos Relacional"]
        DB[("PostgreSQL 16.15 (talento360_db)<br>• Puerto Interno: 5432 / Host: 5434<br>• ON DELETE RESTRICT en Históricos<br>• safe_parse_date & Secuencia REL")]
    end

    SPA -->|HTTP REST| Nginx
    Nginx -->|/api/auth| Auth
    Nginx -->|/api/employees| Emp
    Nginx -->|/api/requests| Req
    Nginx -->|/api/admin-requests| AReq
    Nginx -->|/api/viaticos & /api/destinos| Viat
    Nginx -->|/api/dashboard & /api/admin| Dash
    Nginx -->|/api/horarios| Hor
    Nginx -->|/api/sst| SST

    Auth & Emp & Req & AReq & Viat & Dash & Hor & SST -->|Pool pg (Conexión Interna)| DB
```

### 3.2. Evaluación del API Gateway (Nginx)

- **Centralización Perimetral:** Todas las llamadas del frontend apuntan de forma relativa a `/api/*`. No existen peticiones dispersas que apunten a puertos internos (`:3001`, `:3002`, `:3005`, etc.), evitando exponer la topología de la red interna Docker.
- **Resolución de Catálogos:** La ruta `/api/destinos` reenvía hacia `/destinos` en `viaticos-service`, retornando el catálogo de 123 municipios de Boyacá en formato `application/json` con código HTTP 200, resolviendo la anomalía histórica donde dicha ruta caía en el fallback HTML.
- **Ajustes para Ingesta Masiva:** La directiva `client_max_body_size 50M;` junto con `proxy_read_timeout 300s;` permite procesar archivos Excel extensos sin desconexiones prematuras por HTTP 504.

### 3.3. Publicación del Puerto de PostgreSQL (Puerto 5434) — Condición para Producción

Durante la inspección de infraestructura se analizó la publicación de puertos de la base de datos:

- **Configuración Detectada en el Entorno Local:**
  Al inspeccionar los contenedores activos mediante `docker ps`, se evidenció:
  ```
  talento360_db: 0.0.0.0:5434->5432/tcp, [::]:5434->5432/tcp
  ```
- **Evaluación Técnica de Seguridad:**
  - En el entorno local de desarrollo y pruebas, esta configuración permite ejecutar scripts de prueba desde la máquina anfitriona (`localhost:5434`) y utilizar clientes gráficos de administración.
  - La vinculación a `0.0.0.0` y `[::]` hace que el puerto escuche en todas las interfaces de red del host. La exposición efectiva hacia la red depende de las reglas de firewall del sistema operativo (Windows Defender / iptables) y de las políticas de red de la infraestructura anfitriona; no depende exclusivamente de la contraseña del usuario `postgres`.
  - Sin embargo, conforme al principio de defensa en profundidad y menor exposición de superficie, mantener el puerto de base de datos publicado hacia interfaces externas en un servidor productivo representa un riesgo de arquitectura.
- **Recomendación para Producción:**
  - En la configuración de producción para la Gobernación de Boyacá, **se debe eliminar la directiva `ports` del contenedor `postgres` en `docker-compose.yml`**, ya que todos los microservicios se comunican de forma privada y exclusiva mediante la red bridge interna Docker `talento360_net`.
  - Durante fases de desarrollo o si los administradores de bases de datos requieren acceso de mantenimiento local desde la consola del servidor host, el mapeo debe restringirse explícitamente a la interfaz de bucle invertido:
    ```yaml
    ports:
      - "127.0.0.1:5434:5432"
    ```
  - Esta observación no impide cerrar técnicamente la etapa de desarrollo local, pero debe quedar formalmente resuelta en la configuración de despliegue antes de la puesta en marcha institucional.

### 3.4. Versión y Recursos Reales de Docker y PostgreSQL

Para garantizar absoluta fidelidad con el estado real del entorno, se verificaron los siguientes parámetros de ejecución mediante comandos directos de Docker y PostgreSQL:

- **Versión de Imagen en `docker-compose.yml`:** `postgres:16-alpine`.
- **Versión del Motor PostgreSQL en Ejecución:** `PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit` (confirmada mediante `SELECT version();` en el contenedor `talento360_db`). *(Se aclara que menciones anteriores a PostgreSQL 15 en informes históricos obedecían a etapas preliminares previas a la actualización de la imagen base).*
- **Volumen de Persistencia en Docker:** Declarado en `docker-compose.yml` como `postgres_data`, creado físicamente por Docker Compose con el nombre `web_postgres_data` y montado en `/var/lib/postgresql/data`. *(Se descarta la denominación antigua `talento_pgdata`, que correspondía a documentación previa).*
- **Montaje de Migraciones:** Directorio del repositorio `../database` montado en modo de solo lectura en `/docker-entrypoint-initdb.d:ro`.

---

## 4. AUDITORÍA FUNCIONAL DE LOS MÓDULOS

### 4.1. Módulo de Servidores Públicos

- **Ciclo de Vida CRUD y Validación de Datos:** Registro, consulta, edición y detalle de hojas de vida operativos. Validación de tipos de documento, nombres, apellidos y fechas. Generación de código `REL-XXXXX` mediante secuencia PostgreSQL nativa (`seq_rel_principal_id`).
- **Periodos de Servicio y Consistencia Temporal:** Control de fechas de posesión y terminación en nombramientos temporales. Cálculo de tiempo de servicio mediante función `safe_parse_date`.
- **Novedades de Retiro y Revinculación:** La desvinculación actualiza el estado laboral a `Retirado`, conservando la fecha de retiro y el acto administrativo sin destruir el expediente. La revinculación permite generar un nuevo periodo laboral manteniendo la trazabilidad histórica.
- **Protección ante Eliminaciones:** La invocación de `DELETE /api/employees/:cedula` sobre servidores con historial en Horarios o Viáticos es rechazada con **HTTP 409 Conflict**, preservando la integridad referencial.

### 4.2. Módulo de Horarios Laborales y Comportamiento de Modalidad Presencial

- **Modalidades de Acuerdo Especial Admitidas:** Teletrabajo Autónomo, Teletrabajo Suplementario, Trabajo en Casa y Jornada Flexible.
- **Comportamiento Comprobado sobre la Modalidad Presencial:**
  - *Comportamiento en Creación Manual:* En la implementación actual de `horarios-service` (`src/routes/horarios.js:1468` y `:1752`), el backend rechaza con **HTTP 400 Bad Request** (`code: 'MODALIDAD_PRESENCIAL_NO_PERMITIDA'`) cualquier solicitud de creación o edición con `modalidad: 'Presencial'`, respondiendo: *«La presencialidad ordinaria es el régimen legal por defecto y no requiere registro de acuerdo especial. Este módulo administra exclusivamente Teletrabajo, Trabajo en casa y Horario flexible»*.
  - *Comportamiento ante Vencimiento de Acuerdos (`AUD-SEG-003`):* Al expirar un acuerdo especial, el proceso de verificación de caducidades actualiza su estado a `Caducada` sin insertar tuplas presenciales ficticias en la base de datos.
  - *Aclaración Institucional:* Se hace constar que el rechazo de la modalidad "Presencial" es el **comportamiento programado actual del software**, diseñado para evitar la creación de acuerdos redundantes sobre la jornada ordinaria. No constituye un mandato estatutario formal de la Gobernación, por lo que la entidad podrá evaluar si en el futuro requiere habilitar el registro explícito de acuerdos presenciales para fines de seguimiento específico.
- **Control de Solapamientos:** El controlador valida que los rangos de fechas (`fecha_inicio`, `fecha_fin`) no colisionen con acuerdos vigentes del mismo servidor, retornando **HTTP 400 Bad Request** ante cualquier solapamiento.

### 4.3. Módulo de Viáticos y Tratamiento de Cédulas No Censadas

- **Ingesta Masiva Excel (.xlsx):** Normalización tolerante de cabeceras procesada con `xlsx` y `busboy`. Transaccionalidad fila por fila con `SAVEPOINT viatico_sp_...`, aislando errores de celdas puntuales y permitiendo procesar el resto de registros válidos.
- **Tratamiento Comprobado de Cédulas Externas o Desconocidas (`viaticos.js:1348-1356`):**
  - *Comportamiento Real del Código:* Cuando la planilla Excel reporta una cédula que no figura en la tabla `personas` (p. ej. contratistas, comisiones interinstitucionales o personal transitorio), **el sistema NO inserta servidores provisionales en la tabla `personas`**, evitando contaminar el censo oficial de planta.
  - *Preservación de Información sin Corrupción:* Para no violar la clave foránea `fk_viaticos_personas` ni abortar la carga masiva, el sistema registra la comisión con `documento = null`, preserva la cédula reportada dentro del campo de observaciones (`[Cédula externa reportada: XXXXX]`) y emite una advertencia en la bitácora del paquete (`warnings`).
  - *Inmutabilidad de Registros:* Registros en estado `Legalizado` quedan bloqueados para su eliminación (**HTTP 400 Bad Request**), resguardando los valores económicos reportados originalmente.

---

## 5. MATRIZ INSTITUCIONAL DE CONTROL DE ACCESO (RBAC)

### 5.1. Mandato Institucional de Seguridad

La Gobernación de Boyacá definió un modelo sustentado en:
1. **Visión Compartida Transversal de Consulta (`VER`):** Acceso de consulta permitido para todas las funcionarias de planta de Talento Humano sobre los tres módulos principales (`Servidores Públicos`, `Horarios` y `Viáticos`).
2. **Segregación Estricta de Escritura:** La creación, modificación, eliminación o importación masiva está limitada al área de competencia de cada funcionaria, manteniendo los permisos CRUD plenos exclusivamente en su módulo titular.
3. **Administración Global Centralizada:** Parámetros de sistema, consola de errores y copias de seguridad confinados al usuario `admin`.

### 5.2. Matriz Definitiva de Permisos Verificada en Tiempo de Ejecución

| Usuario / Cuenta | Rol Asignado | Servidores Públicos | Horarios Laborales | Viáticos Institucionales | Consola Técnica / Backups |
|---|---|:---:|:---:|:---:|:---:|
| **`admin`** | Administrador | **CRUD** (200 OK) | **CRUD** (200 OK) | **CRUD** (200 OK) | **TOTAL** (200 OK) |
| **`angela.ussa`** | Usuario (Talento Humano) | **CRUD** (200 OK) | **VER** (200 OK) | **VER** (200 OK) | **DENEGADO** (403 Forbidden) |
| **`blanca.soler`** | Usuario (Planta de Personal) | **CRUD** (200 OK) | **VER** (200 OK) | **VER** (200 OK) | **DENEGADO** (403 Forbidden) |
| **`doris.canon`** | Usuario (Horarios) | **VER** (200 OK) | **CRUD** (200 OK) | **VER** (200 OK) | **DENEGADO** (403 Forbidden) |
| **`bergenet.gutierrez`** | Usuario (Viáticos) | **VER** (200 OK) | **VER** (200 OK) | **CRUD** (200 OK) | **DENEGADO** (403 Forbidden) |
| **`No Autenticado`** | Solicitud Anónima | **DENEGADO** (401) | **DENEGADO** (401) | **DENEGADO** (401) | **DENEGADO** (401 Unauthorized) |

### 5.3. Arquitectura Técnica de la Solución RBAC

La corrección definitiva del sobrebloqueo (`AUD-4-001`) se implementó en tres niveles:
1. **PostgreSQL:** Columna `permisos TEXT` en `usuarios` almacenando permisos específicos (p. ej. `employees:read,employees:write,horarios:read,viaticos:read`).
2. **Token JWT:** Payload firmado que transporta tanto el rol (`rol`) como el array de permisos (`permisos`), permitiendo validar accesos de lectura o escritura en cada microservicio sin consultas redundantes a la base de datos.
3. **Middlewares de Express:** `hasPermission(permiso)` valida permisos específicos o comodín administrativo; `requireRole('Administrador')` protege rutas de respaldos y errores.

### 5.4. Reconciliación de las 60 Aserciones RBAC Evaluadas

Para subsanar las inconsistencias entre la tabla general de suites y los informes específicos de control de acceso, se documenta la composición exacta de las **60 aserciones RBAC evaluadas en las pruebas técnicas**:

```
Total Aserciones RBAC Evaluadas: 60
├── Conjunto Principal: Matriz de Endpoints (35 aserciones en test_audit5_matrix.js — incluida en tabla 11.1)
└── Conjunto Complementario: Claims, Escalada y Subcadenas (25 aserciones en test_prompt_09_rbac.js — suite especializada de backend)
```

#### A. Conjunto 1: Matriz de Endpoints Operativos (35 Aserciones en `test_audit5_matrix.js`)
Evalúa las solicitudes HTTP directas contra los endpoints de la API para las 6 identidades evaluadas:
- **`admin` (4 aserciones específicas de superprivilegios):**
  1. `POST /api/employees`: Mutación autorizada en Servidores Públicos (código 201 Created / 200 OK).
  2. `POST /api/horarios`: Mutación autorizada en Horarios Laborales (código 201 Created / 200 OK).
  3. `POST /api/viaticos`: Mutación autorizada en Viáticos Institucionales (código 201 Created / 200 OK).
  4. `GET /api/admin/backups`: Acceso exclusivo y autorizado a la consola técnica y respaldos (código 200 OK).
- **`angela.ussa` (7 aserciones):** `GET /employees` (200), `POST /employees` (200/Payload OK), `GET /horarios` (200 - Lectura cruzada), `POST /horarios` (403), `GET /viaticos` (200 - Lectura cruzada), `POST /viaticos` (403), `GET /admin/backups` (403).
- **`blanca.soler` (6 aserciones):** `GET /employees` (200), `POST /employees` (200), `GET /horarios` (200), `DELETE /horarios` (403), `GET /viaticos` (200), `POST /viaticos` (403).
- **`doris.canon` (7 aserciones):** `GET /employees` (200 - Lectura cruzada), `POST /employees` (403), `PUT /employees` (403), `GET /horarios` (200), `POST /horarios` (200/Payload OK), `GET /viaticos` (200 - Lectura cruzada), `DELETE /viaticos` (403).
- **`bergenet.gutierrez` (6 aserciones):** `GET /employees` (200 - Lectura cruzada), `POST /employees` (403), `GET /horarios` (200 - Lectura cruzada), `POST /horarios` (403), `GET /viaticos` (200), `POST /viaticos` (200/Payload OK).
- **Solicitudes Anónimas (5 aserciones):** `GET /employees` (401), `GET /horarios` (401), `GET /viaticos` (401), `GET /admin/backups` (401), `POST /auth/verify` con token corrupto (401).

#### B. Conjunto 2: Claims JWT, Prevención de Escalada y Subcadenas (25 Aserciones en `test_prompt_09_rbac.js`)
Evalúa el comportamiento interno del servicio de autenticación y persistencia de usuarios:
- **Claims y Permisos en Token (11 aserciones):** Comprobación de que el token JWT emitido en el login contenga el array de módulos y el array de permisos granulares correcto para cada cuenta (verificando que las funcionarias tengan permisos de escritura solo en su área y permisos `:read` en los tres módulos).
- **Prevención de Ataques por Subcadenas de Nombre (3 aserciones — `AUD-4-002`):** Comprobación de que identidades maliciosas con subcadenas ("doris.fake", "bergenet.fake", "angela.fake") no vulneren el control de acceso en backend si no poseen los permisos explícitos en su token (todas retornaron 403 Forbidden).
- **Prevención de Auto-Escalada en Perfil (4 aserciones):** Invocación de `PUT /api/auth/profile` con payloads que intentaban inyectar `rol: "Administrador"` o `modulos: "*"`, comprobando que PostgreSQL no modifica los privilegios asignados.
- **Control de Tokens Manipulados y Sesiones (4 aserciones):** Pruebas con firmas JWT adulteradas, algoritmos cambiados a `none`, y tokens vencidos (todas rechazadas con HTTP 401).
- **Preservación de Restricciones en Mutaciones Críticas (3 aserciones):** Bloqueo de borrado sobre viáticos legalizados y servidores con antecedentes (400 y 409).

*Nota de reconciliación métrica:* Estas 25 aserciones de `test_prompt_09_rbac.js` son **adicionales** a las 421 pruebas contabilizadas en la tabla general de la sección 11.1; no se sumaron a dicha tabla para evitar redundancia metodológica en la suite de certificación general. Si se computaran conjuntamente, el total de pruebas automatizadas ascendería a **446 pruebas evaluadas**.

---

## 6. SEGURIDAD INFORMÁTICA

### 6.1. Batería de Pruebas de Ciberseguridad (59 Pruebas en `security_audit_suite.js`)

La suite de ciberseguridad ejecutó 59 pruebas estructuradas en 6 módulos de evaluación técnica:

| Módulo de Seguridad | Aspecto Evaluado | Pruebas | Resultado | Estado |
|---|---|:---:|:---:|:---:|
| **Módulo 1** | Autenticación, JWT, caducidad, forja de firmas y rechazo de tokens en URL (`?token=`) | 12 | 12 PASS | **CONFORME** |
| **Módulo 2** | Control de acceso RBAC, aislamiento horizontal de privilegios y prevención BOLA/IDOR | 10 | 10 PASS | **CONFORME** |
| **Módulo 3** | Resistencia ante Fuzzing de Inyección SQL (8 vectores probados en búsquedas) | 8 | 8 PASS | **CONFORME** |
| **Módulo 4** | Prevención de Cross-Site Scripting (XSS) almacenado y reflejado en formularios | 9 | 9 PASS | **CONFORME** |
| **Módulo 5** | Cabeceras de seguridad perimetral HTTP, endurecimiento Nginx y cookies | 11 | 11 PASS | **CONFORME** |
| **Módulo 6** | Auditoría dinámica de consola web y ausencia de excepciones JavaScript en cliente | 9 | 9 PASS | **CONFORME** |
| **TOTAL** | **Evaluación Técnica de Ciberseguridad** | **59** | **59 PASS** | **100%** |

### 6.2. Delimitación de Categorías OWASP Top 10 y Vectores No Evaluados

Para mantener la rigurosidad conceptual, se detalla el alcance real de la evaluación frente al marco de referencia OWASP Top 10 (2021):

- **A01:2021 — Broken Access Control (Mitigado y Evaluado Dinámicamente):** Cubierto mediante las suites RBAC y módulos 1 y 2 de seguridad. Validación estricta de permisos `:read` y `:write`, prevención de BOLA/IDOR y rechazo de escalamiento vertical u horizontal.
- **A02:2021 — Cryptographic Failures (Mitigado y Evaluado Dinámicamente):** Contraseñas con `bcrypt` (costo 10-12), JWT con HS256 y secreto robusto.
- **A03:2021 — Injection (Parcialmente Evaluado):**
  - **Inyección SQL:** **EVALUADA Y MITIGADA.** Se ejecutó fuzzing con 8 vectores en el buscador (`' OR '1'='1`, `admin'--`, `1; SELECT pg_sleep(5); --`, `'; DROP TABLE temp_test; --`, etc.), confirmando parametrización con placeholders `$1`, `$2`.
  - **Inyección de Fórmulas en Hojas de Cálculo (CWE-1236):** **EVALUADA Y MITIGADA.** 65 pruebas automatizadas verificaron la neutralización de caracteres peligrosos (`=`, `+`, `-`, `@`, `|`, `%`) con apóstrofe y BOM UTF-8.
  - **Command Injection (Inyección de Comandos de Sistema Operativo — CWE-78):** **NO EVALUADO MEDIANTE PRUEBAS DINÁMICAS.** El código fuente no expone módulos de ejecución de comandos shell (`child_process.exec` o `execSync`) vinculados a entradas de usuario, pero no se ejecutó una batería específica de fuzzing de inyección de comandos en las pruebas automatizadas. Debe considerarse un vector no verificado dinámicamente.
- **A04:2021 — Insecure Design (Mitigado):** Flujos transaccionales con `SAVEPOINT` e inmutabilidad de viáticos legalizados.
- **A05:2021 — Security Misconfiguration (Mitigado):** `NODE_ENV=production` forzado en todos los contenedores y cabeceras perimetrales Nginx activas. *(Ver hallazgo del puerto 5434 en sección 3.3).*
- **A06:2021 — Vulnerable and Outdated Components (Verificado Estáticamente):** Dependencias fijadas en `package.json`. No se ejecutó un análisis dinámico automatizado de vulnerabilidades en tiempo de ejecución (p. ej. Trivy o Snyk).
- **A07:2021 — Identification and Authentication Failures (Mitigado y Evaluado Dinámicamente):** `express-rate-limit` activo en login (15 peticiones/15 min), mitigación de timing attacks mediante hash ficticio (`DUMMY_HASH`) y bloqueo de tokens en query strings.
- **A08:2021 — Software and Data Integrity Failures (Mitigado):** Validación de esquemas DTO en importaciones masivas.
- **A09:2021 — Security Logging and Monitoring Failures (Mitigado):** Bitácora de incidentes técnicos en `system_errors` con captura de IP real (`X-Forwarded-For`).
- **A10:2021 — Server-Side Request Forgery (SSRF) (No Aplica):** El backend no realiza peticiones HTTP salientes hacia URLs provistas por los usuarios.

---

## 7. BASE DE DATOS E INTEGRIDAD DE INFORMACIÓN

### 7.1. Estructura y Consistencia Relacional

PostgreSQL 16.15 opera con claves foráneas configuradas para preservar antecedentes:
- `fk_horarios_personas`: `horarios.numero_documento` -> `personas.cedula` (`ON DELETE RESTRICT`, `ON UPDATE CASCADE`).
- `fk_viaticos_personas`: `viaticos.numero_documento` -> `personas.cedula` (`ON DELETE RESTRICT`, `ON UPDATE CASCADE`).
- `fk_viaticos_paquetes`: `viaticos.id_paquete` -> `paquetes_viaticos.id_paquete` (`ON DELETE SET NULL`).
- `fk_viaticos_vigencias`: `viaticos.id_vigencia` -> `vigencias_viaticos.id_vigencia` (`ON DELETE RESTRICT`).

### 7.2. Normalización de Fechas mediante `safe_parse_date`

La función PL/pgSQL `safe_parse_date` normaliza formatos heterogéneos (`DD/MM/YYYY`, `YYYY-MM-DD`, marcas de tiempo y seriales de Excel) y retorna `NULL` de manera controlada ante fechas imposibles (p. ej. 31 de febrero), evitando errores HTTP 500 en consultas de filtrado.

### 7.3. Catálogo Geográfico DIVIPOLA de Boyacá

La tabla `divipola` contiene los **123 municipios oficiales de Boyacá** con codificación oficial del DANE iniciada en `15`. Corregimientos y asentamientos especiales están asociados a sus cabeceras en `divipola_asentamientos` y consolidados en la vista `v_destinos_boyaca`.

### 7.4. Volumetría Observada Durante la Auditoría

| Entidad / Tabla | Cantidad Observada en Auditoría | Estado de Integridad |
|---|:---:|---|
| **Servidores Públicos (`personas`)** | 678 registros | 671 con relación contractual principal activa. Cero duplicados de cédula. |
| **Comisiones de Viáticos (`viaticos`)** | 6.557 registros | Cero registros huérfanos. 100% vinculados a personas o con cédula externa preservada. |
| **Acuerdos de Jornada (`horarios`)** | 136 acuerdos | Cero solapamientos activos por funcionario. Cero acuerdos presenciales ficticios. |
| **Vigencias Fiscales (`vigencias_viaticos`)** | 6 vigencias | Periodos fiscales 2019 a 2024 parametrizados. |
| **Paquetes de Importación (`paquetes_viaticos`)** | 10 paquetes | Bitácoras de cargue con auditoría de usuario y fecha. |
| **Cuentas de Acceso (`usuarios`)** | 5 cuentas | 1 superadministrador y 4 funcionarias institucionales con hash bcrypt. |

*Nota explicativa:* Estas cifras representan la volumetría de datos de prueba y operación actual observada en la base de datos durante la auditoría. No constituyen límites de capacidad de la plataforma.

---

## 8. IMPORTACIÓN Y EXPORTACIÓN EXCEL

### 8.1. Mecanismo de Ingesta Masiva y Resiliencia

1. **Normalización de Encabezados:** Mapeo automático insensible a mayúsculas, minúsculas, tildes y espacios para campos clave: cédula, funcionario, destino, fechas y valores.
2. **Aislamiento Transaccional por Fila con SAVEPOINT:** Cada fila del archivo se procesa bajo un punto de guardado individual. Errores puntuales revierten únicamente la fila afectada (`ROLLBACK TO SAVEPOINT`), permitiendo completar la inserción de las demás filas válidas del lote.

### 8.2. Exportación Segura de Datos

- **Archivos XLSX:** Formateo mediante librería `xlsx` con celdas tratadas como texto plano (`s`) para neutralizar inyecciones de fórmulas.
- **Archivos CSV:** Formato delimitado por punto y coma (`;`), con preámbulo UTF-8 BOM (`\uFEFF`) para compatibilidad directa con Microsoft Excel en Windows.

---

## 9. ESTADÍSTICAS E INDICADORES

### 9.1. Indicadores Agregados en Tiempo Real

El sistema consolida métricas por vigencia fiscal, servidor público, destino geográfico y dependencia. Las consultas de agregación sobre las 6.557 comisiones registradas respondieron en un tiempo medio observado de **32 milisegundos**.

### 9.2. Corrección Terminológica Obligatoria

> **PRECISIÓN TÉCNICA INSTITUCIONAL:**
> Talento 360 no administra cuentas bancarias, no expide órdenes de pago ni certifica ejecución presupuestal.
> 
> Todos los valores económicos reflejados en pantallas, reportes y estadísticas corresponden técnica y formalmente a:
> - **Valores económicos registrados.**
> - **Valores reportados en los archivos de origen.**
> - **Sumatorias de valores registrados en comisiones.**
> - **Datos económicos importados de fuentes documentales.**
>
> La plataforma no emite certificaciones de pago efectivo.

---

## 10. INFRAESTRUCTURA Y DESPLIEGUE

### 10.1. Mapa de Infraestructura en Contenedores Docker

| Contenedor | Imagen / Servicio | Puerto Interno | Puerto Host | Propósito Operativo |
|---|---|:---:|:---:|---|
| `talento360_frontend` | Nginx 1.25 Alpine | 80 | **80** | Gateway perimetral, servidor web estático y cabeceras de seguridad. |
| `talento360_auth` | Node.js 18 Alpine | 3001 | Privado | Autenticación, JWT, roles y credenciales. |
| `talento360_employees` | Node.js 18 Alpine | 3002 | Privado | Planta de personal, hojas de vida y retiros. |
| `talento360_requests` | Node.js 18 Alpine | 3003 | Privado | Trámites y solicitudes de servidores. |
| `talento360_admin_requests` | Node.js 18 Alpine | 3004 | Privado | Aprobación de trámites administrativos. |
| `talento360_viaticos` | Node.js 18 Alpine | 3005 | Privado | Ingesta masiva Excel, comisiones y estadísticas. |
| `talento360_dashboard` | Node.js 18 Alpine | 3006 | Privado | Bitácora de incidentes técnicos y respaldos. |
| `talento360_horarios` | Node.js 18 Alpine | 3007 | Privado | Control de teletrabajo, trabajo en casa y jornadas flexibles. |
| `talento360_sst` | Node.js 18 Alpine | 3008 | Privado | Dotaciones y seguridad ocupacional. |
| `talento360_db` | PostgreSQL 16.15 Alpine | 5432 | **5434** *(Obs. 3.3)* | Base de datos relacional y volumen `web_postgres_data`. |

### 10.2. Resiliencia, Aislamiento y Configuración

- **Aislamiento de Microservicios:** Los 8 microservicios de Node.js operan exclusivamente dentro de la red Docker interna `talento360_net`.
- **Modo de Producción:** Variable `NODE_ENV: production` fijada en todos los contenedores para evitar fugas de stack traces en respuestas de error.
- **Persistencia en Volumen:** Almacenamiento en volumen Docker `postgres_data` (nombre real en host: `web_postgres_data`) montado en `/var/lib/postgresql/data`.
- **Healthcheck de Base de Datos:** Verificación con `pg_isready -U postgres` y condición `service_healthy` antes del arranque de microservicios.

---

## 11. RESULTADOS DETALLADOS DE PRUEBAS

### 11.1. Resumen Consolidado de las 13 Suites de Pruebas

| Suite / Archivo de Prueba | Componente Auditado | Aserciones | PASS | FAIL | N/A | Tasa de Éxito |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `test_audit5_matrix.js` | Matriz de Endpoints RBAC (Lectura/Escritura por usuario) | 35 | 35 | 0 | 0 | **100.0%** |
| `security_audit_suite.js` | Ciberseguridad (Autenticación, RBAC, SQLi, XSS, Nginx, Consola) | 59 | 59 | 0 | 0 | **100.0%** |
| `test_complete_lifecycle_actions.js` | Ciclo de Vida de Servidores y Novedades | 39 | 39 | 0 | 0 | **100.0%** |
| `test_prompt_01_dates.js` | Normalización de Fechas y Función `safe_parse_date` | 24 | 22 | 0 | 2 | **100.0%** |
| `test_prompt_02_concurrency.js` | Concurrencia y Generación Atómica de Códigos `REL` | 15 | 15 | 0 | 0 | **100.0%** |
| `test_prompt_03_excel_import.js` | Importación Masiva Excel y Tolerancia con SAVEPOINT | 24 | 24 | 0 | 0 | **100.0%** |
| `test_prompt_04_referential_integrity.js` | Integridad Referencial ante Intentos de Borrado | 23 | 23 | 0 | 0 | **100.0%** |
| `test_prompt_05_horarios_module.js` | Horarios Laborales, Solapamientos y Cero Presencial | 26 | 26 | 0 | 0 | **100.0%** |
| `test_prompt_06_divipola.js` | Catálogo Geográfico DIVIPOLA Boyacá (123 Mpios) | 27 | 27 | 0 | 0 | **100.0%** |
| `test_prompt_08_lifecycle.js` | Ciclo de Vida de Viáticos y Estados | 43 | 43 | 0 | 0 | **100.0%** |
| `test_prompt_10_formula_injection.js` | Protección Formula Injection en Excel/CSV (CWE-1236) | 65 | 65 | 0 | 0 | **100.0%** |
| `test_prompt_11_auth_secrets_drafts.js` | Manejo de Secretos JWT y Borradores ante HTTP 401 | 19 | 19 | 0 | 0 | **100.0%** |
| `test_prompt_12_admin_backups_errors.js` | Consola de Errores, Captura de IP Real y Backups | 22 | 22 | 0 | 0 | **100.0%** |
| **TOTAL CONSOLIDADO** | **13 Suites Automatizadas Evaluadas** | **421** | **419** | **0** | **2** | **99.5%** |

### 11.2. Relación y Coherencia entre Métricas

- **Universo de Pruebas:** Las 421 pruebas representan la totalidad de pruebas automatizadas agrupadas en las 13 suites principales.
- **Relación con Seguridad:** Las 59 pruebas de seguridad corresponden a la suite `security_audit_suite.js` (fila 2 de la tabla).
- **Relación con RBAC:** La verificación de control de acceso comprende las 35 aserciones dinámicas en `test_audit5_matrix.js` incluidas en la tabla anterior, y 25 aserciones de soporte sobre claims, subcadenas y escalada en `test_prompt_09_rbac.js` (totalizando 60 aserciones verificadas, según se detalló en la sección 5.4). Estas 25 aserciones complementarias no se sumaron a las 421 pruebas de la tabla general para evitar duplicaciones.
- **Pruebas No Aplicables (N/A):** Las 2 pruebas N/A en `test_prompt_01_dates.js` corresponden a fechas con años extremos (anteriores a 1900 o posteriores a 2100) descartadas de forma segura por el motor SQL.

---

## 12. SEGUIMIENTO HISTÓRICO DE AUDITORÍAS ANTERIORES

### 12.1. Trazabilidad de Hallazgos de la Segunda Auditoría (`AUD-SEG-001` a `AUD-SEG-014`)

En contraste estricto con los informes periciales originales (`TERCERA_AUDITORIA_POSTIMPLEMENTACION_TALENTO360.md`), se presenta la trazabilidad real de los hallazgos de la Segunda Auditoría:

| ID Original | ID Segunda Aud. | Descripción Sintética del Hallazgo Histórico | Estado Final Verificado en Auditoría Final | Evidencia Técnica de Cierre |
| :--- | :--- | :--- | :---: | :--- |
| `AUD-ORIG-001` | **`AUD-SEG-001`** | Ausencia de `safe_parse_date` en DDL de PostgreSQL y error 500 en parámetros de filtro | **CORREGIDO Y VERIFICADO** | Migración 19 creó la función PL/pgSQL. En `viaticos.js:660` se reemplazó `$N::date` por `safe_parse_date($N)`. Validado con `test_prompt_01_dates.js`. |
| `AUD-ORIG-002` | **`AUD-SEG-002`** | `TypeError: Assignment to constant variable` en `viaticos.js` al radicar con destino vacío | **CORREGIDO Y VERIFICADO** | Refactorización con `rawDestino` y coalescencia en `viaticos.js:1771`. Cero excepciones en consola al radicar. |
| `AUD-ORIG-003` | **`AUD-SEG-003`** | Inserción automática de acuerdos presenciales espurios al expirar o caducar | **CORREGIDO Y VERIFICADO** | Supresión del job de inserción; transición a `Caducada`. En `horarios.js:407-409` no se insertan tuplas artificiales. BD contiene 0 acuerdos presenciales. |
| `AUD-ORIG-004` | **`AUD-SEG-004`** | Ausencia de motor de liquidación tarifaria de viáticos por decretos y salarios | **DESESTIMADO / FUERA DE ALCANCE** | Talento 360 no liquida viáticos; registra valores reportados. Código residual desvinculado (retorna HTTP 404). No constituye defecto. |
| `AUD-ORIG-005` | **`AUD-SEG-005`** | Aplanamiento sistemático de estados a `'Pendiente'` al modificar comisiones | **CORREGIDO Y VERIFICADO** | Máquina de 6 estados canónicos en `viaticos.js:208-235`, migración 25 y restricción `chk_viaticos_estado` en PostgreSQL. |
| `AUD-ORIG-006` | **`AUD-SEG-006`** | Inexactitud territorial en DIVIPOLA Boyacá (131 vs 123 municipios) | **CORREGIDO Y VERIFICADO** | Depuración a exactamente 123 municipios oficiales DANE en `divipola` y tabla `divipola_asentamientos` para corregimientos y veredas. |
| `AUD-ORIG-007` | **`AUD-SEG-007`** | Concurrencia y colisión en generación de consecutivo `REL-XXXXX` | **CORREGIDO Y VERIFICADO** | Migración 22 creó secuencia PostgreSQL `seq_rel_principal_id` y función `next_formatted_id()`. 20 peticiones concurrentes sin colisión en `test_prompt_02_concurrency.js`. |
| `AUD-ORIG-008` | **`AUD-SEG-008`** | Bypass administrativo mediante cabecera estática `x-admin-secret` | **CORREGIDO Y VERIFICADO** | Cabecera erradicada de `server.js` y de los microservicios. Endpoints administrativos exigen verificación de token JWT de administrador. |
| `AUD-ORIG-009` | **`AUD-SEG-009`** | Vulnerabilidad de Formula Injection en descargas Excel/CSV (CWE-1236) | **CORREGIDO Y VERIFICADO** | Función `sanitizeExcelValue` prefija caracteres `=, +, -, @, \|, %` con apóstrofe y agrega preámbulo UTF-8 BOM. 65/65 pruebas PASS. |
| `AUD-ORIG-010` | **`AUD-SEG-010`** | Atrapamiento de navegación del administrador en frontend | **CORREGIDO Y VERIFICADO** | Guardas unificadas y visibilidad global para `admin` en `app.js:673-674`. Navegación fluida hacia todos los módulos. |
| `AUD-ORIG-011` | **`AUD-SEG-011`** | Riesgo de desbordamiento de memoria (OOM) por soportes Base64 en BD | **CORREGIDO Y VERIFICADO** | Exclusión de `soporte` en listados masivos (`viaticos.js:721`); descarga lazy bajo demanda mediante `GET /api/viaticos/:id/soporte`. |
| `AUD-ORIG-012` | **`AUD-SEG-012`** | Omisión de montaje de migraciones en Docker y scripts `.js` en directorio init | **CORREGIDO Y VERIFICADO** | Mapeo ordenado de scripts SQL puros (`01_schema.sql` a `26_rbac_cross_module_read_and_permissions.sql`), retirando scripts Node.js que Docker ignoraba. |
| `AUD-ORIG-013` | **`AUD-SEG-013`** | Pérdida de formularios en curso ante expiración de sesión (HTTP 401) | **CORREGIDO Y VERIFICADO** | Interceptor en `api.js:62-85` guarda borrador en `sessionStorage` y abre modal de reautenticación sin recargar la página. |
| `AUD-ORIG-014` | **`AUD-SEG-014`** | Exposición de tokens JWT en URL de descarga de copias de respaldo (`?token=`) | **CORREGIDO Y VERIFICADO** | Eliminada la extracción de `req.query.token` en `admin.js:54-56`. Descarga mediante llamada AJAX autenticada con Bearer y respuesta Blob. |

### 12.2. Trazabilidad de Hallazgos de la Tercera Auditoría (`AUD-NUEVO-001` a `AUD-NUEVO-010`)

| ID Hallazgo | Descripción Sintética | Severidad | Estado Final Verificado | Evidencia Técnica de Cierre |
|---|---|:---:|:---:|---|
| **AUD-NUEVO-001** | Aislamiento horizontal de privilegios entre dependencias de Talento Humano | ALTA | **CORREGIDO Y VERIFICADO** | Confinamiento estricto de mutaciones por usuario. Ninguna servidora puede alterar datos fuera de su área de competencia. |
| **AUD-NUEVO-002** | Error 500 en filtros de fechas por formatos no normalizados | MEDIA | **CORREGIDO Y VERIFICADO** | Función PL/pgSQL `safe_parse_date` normaliza formatos DD/MM/YYYY e ISO, retornando `NULL` ante valores corruptos sin romper la consulta. |
| **AUD-NUEVO-003** | Ruta Nginx `/api/destinos` devolvía HTML en vez de catálogo JSON | MEDIA | **CORREGIDO Y VERIFICADO** | Bloque `location /api/destinos` en `nginx.conf` entrega el catálogo JSON (123 municipios) con código HTTP 200. |
| **AUD-NUEVO-004** | Riesgo de escalamiento de privilegios por subcadenas en dashboard | ALTA | **CORREGIDO Y VERIFICADO** | Validación estricta `user.rol === 'Administrador'` activa en controladores de dashboard y respaldos. |
| **AUD-NUEVO-005** | Fuga de Token JWT mediante Parámetros de URL (`?token=`) | ALTA | **CORREGIDO Y VERIFICADO** | Extracción de token restringida a cabecera `Authorization: Bearer` y cookie HttpOnly. Peticiones con `?token=` son rechazadas con HTTP 401. |
| **AUD-NUEVO-006** | Inyección SQL en endpoint de búsqueda `/api/employees/buscar` | CRÍTICA | **CORREGIDO Y VERIFICADO** | Consultas 100% parametrizadas con placeholders `$1`, `$2`. Fuzzing con 8 vectores SQLi confirmó neutralización total. |
| **AUD-NUEVO-007** | Eliminación indebida de comisiones en estado "Legalizado" | ALTA | **CORREGIDO Y VERIFICADO** | Backend bloquea con HTTP 400 Bad Request cualquier intento de borrado sobre viáticos formalizados o legalizados. |
| **AUD-NUEVO-008** | Falla en importación masiva Excel por discrepancias de personal | ALTA | **CORREGIDO Y VERIFICADO** | Ingesta masiva con `SAVEPOINT` por fila y preservación de cédulas externas en observaciones sin pérdida de registros válidos. |
| **AUD-NUEVO-009** | Modo de entorno Docker en desarrollo por omisión | BAJA | **CORREGIDO Y VERIFICADO** | Configuración explícita `NODE_ENV: production` presente en todos los microservicios en `docker-compose.yml`. |
| **AUD-NUEVO-010** | Presencia residual de endpoints de cálculo tarifario de viáticos | MEDIA | **CORREGIDO Y VERIFICADO** | Endpoint `POST /api/viaticos/calcular-liquidacion` arroja HTTP 404 real. Módulo `viaticosCalculator.js` desvinculado. |

### 12.3. Trazabilidad de Hallazgos de la Cuarta Auditoría (`AUD-4-001` a `AUD-4-003`)

| ID Hallazgo | Descripción Sintética | Severidad | Estado Final Verificado | Evidencia Técnica de Cierre |
|---|---|:---:|:---:|---|
| **AUD-4-001** | Sobrebloqueo RBAC de lectura cruzada institucional en módulos operativos | ALTA | **CORREGIDO Y VERIFICADO** | Subsanado mediante columna `permisos TEXT` en `usuarios`, emisión de JWT con permisos granulares y ajuste en `hasPermission`. Lectura transversal activa (200 OK) y mutaciones protegidas (403 Forbidden). |
| **AUD-4-002** | Validación de roles mediante subcadenas (`includes('admin')`) en `requests` y `sst` | MEDIA | **CORREGIDO Y VERIFICADO** | Sustituido por comparación de igualdad estricta (`r === 'administrador'`) y comprobación de permisos explícitos en el token. |
| **AUD-4-003** | Dependencia de fuentes externas CDN (Google Fonts, FontAwesome) | BAJA | **RECLASIFICADO COMO OBSERVACIÓN OPERATIVA** | No afecta la operación en red estándar. Se formula como recomendación menor en caso de despliegues futuros en intranets air-gapped. |

---

## 13. HALLAZGOS PENDIENTES Y RIESGOS RESIDUALES

### 13.1. Estado de Defectos Bloqueantes en Código

Tras contrastar empíricamente el estado del código fuente, la persistencia en PostgreSQL y las pruebas funcionales, se certifica que **NO EXISTEN DEFECTOS CRÍTICOS, ALTOS NI MEDIOS PENDIENTES DE RESOLUCIÓN EN EL CÓDIGO DE LA PLATAFORMA**.

### 13.2. Observaciones Operativas y Recomendaciones de Despliegue

| ID | Observación Técnica | Severidad | Componente | Acción Recomendada para Despliegue en Producción | Prioridad |
|---|---|:---:|---|---|:---:|
| **OBS-01** | Exposición del Puerto de PostgreSQL (5434) en `0.0.0.0` | MEDIA | Infraestructura / Docker | Eliminar la directiva `ports` de `postgres` en `docker-compose.yml` para el despliegue de producción en la Gobernación, o restringir el binding a `127.0.0.1:5434:5432` si se requiere mantenimiento desde el host. *(Ver análisis de cortafuegos en sección 3.3).* | ALTA (Producción) |
| **OBS-02** | Empaquetamiento Offline de Recursos Estáticos | BAJA | Frontend / Assets | Descargar tipografías Google Fonts (Roboto, Montserrat) e iconos FontAwesome en `web/frontend/public/assets/` si el servidor de producción se ubica en una red sin salida a Internet (air-gapped). | BAJA |
| **OBS-03** | Programación de Copias de Seguridad Automáticas (Cron) | INFORMATIVA | Dashboard / Backups | Configurar en el sistema operativo del servidor host una tarea programada (cron) que invoque semanalmente `POST /api/admin/backups/generate` con credenciales seguras. | MEDIA |
| **OBS-04** | Monitoreo Periódico de Bitácora de Errores | INFORMATIVA | Dashboard / Errores | Supervisar mensualmente el tamaño de la tabla `system_errors` y depurar registros resueltos con más de 180 días de antigüedad. | BAJA |

---

## 14. ALCANCE DEFINITIVO DEL MÓDULO DE VIÁTICOS

Para evitar discrepancias interpretativas en el proceso de entrega institucional, se ratifica la siguiente delimitación:

> ### **DECLARACIÓN DE ALCANCE DEL MÓDULO DE VIÁTICOS**
>
> El módulo de Viáticos de Talento 360 opera exclusivamente como un sistema de:
> 1. **Recepción y procesamiento documental** de planillas de cálculo Excel (.xlsx) emitidas por software externo de la entidad.
> 2. **Validación y normalización** de cédulas, fechas, destinos y conceptos.
> 3. **Vinculación** con el registro maestro de servidores públicos (o preservación de cédulas externas en observaciones sin contaminar el censo).
> 4. **Almacenamiento y custodia** en PostgreSQL de comisiones y montos económicos reportados.
> 5. **Consulta, filtrado y analítica estadística** de comisiones por vigencia, servidor, destino y periodo.
> 6. **Exportación segura** a formatos Excel y CSV con protección contra inyección de fórmulas (CWE-1236).
>
> **FUNCIONALIDADES EXCLUIDAS POR DEFINICIÓN INSTITUCIONAL:**
> Talento 360 **NO liquida viáticos, no administra tarifas salariales por decreto, no calcula pernoctadas, no gestiona pagos ni transferencias bancarias, no emite órdenes de desembolso ni ejecuta contabilidad pública**.
>
> La ausencia de estas funcionalidades es **plenamente conforme al alcance pactado** y el endpoint residual `POST /api/viaticos/calcular-liquidacion` retorna **HTTP 404 Not Found**.

---

## 15. ESTADO REAL DE CONTROL DE VERSIONES (GIT) Y VERIFICACIÓN DE NO MODIFICACIÓN

### 15.1. Verificación de Integridad del Código Fuente

Se certifica formalmente que:
- Durante la ejecución de la auditoría final y la elaboración de la documentación técnica consolidada, **NO SE REALIZÓ NINGUNA MODIFICACIÓN SOBRE EL CÓDIGO FUENTE PRODUCTIVO NI SOBRE LA ESTRUCTURA O DATOS DE LA BASE DE DATOS**.
- El código base permanece exactamente en el estado entregado al inicio de la auditoría.

### 15.2. Estado Exacto del Árbol de Trabajo Git

Con el fin de reflejar con total veracidad el estado del repositorio, se consigna el resultado real obtenido al ejecutar `git status --short` sobre la rama `main`:

```bash
$ git status --short
?? AUDITORIA_FINAL_20261107/
?? AUDITORIA_FINAL_TALENTO_360.md
```

- **Commit Base de Referencia:** `547cbd6` (`feat(security & rbac): remediacion integral AUD-4-001, lectura transversal institucional, proteccion de mutaciones y certificacion QA de 5ta auditoria`).
- **Estado de Archivos Rastreados:** 0 archivos modificados, 0 eliminados, 0 renombrados. El código funcional se encuentra estrictamente sincronizado con el commit base `547cbd6`.
- **Archivos No Rastreados (Untracked):** El árbol de trabajo contiene exclusivamente los archivos nuevos correspondientes a la documentación técnica autorizada (`AUDITORIA_FINAL_20261107/` y `AUDITORIA_FINAL_TALENTO_360.md`), los cuales se encuentran listos para su adición (`git add`) y confirmación (`git commit`) según disponga el usuario.

---

## 16. DICTAMEN DEFINITIVO Y ACTA DE RECOMENDACIÓN DE CIERRE TÉCNICO

### 16.1. Declaración de Cumplimiento Técnico del Desarrollo

El equipo auditor concluye que la plataforma **Talento 360**:
1. Presenta una arquitectura de microservicios desacoplada y funcional detrás de Nginx Gateway.
2. Cumple con el mandato institucional de control de acceso RBAC, garantizando el **acceso de consulta transversal VER permitido para todos los usuarios institucionales autenticados y operaciones de escritura no autorizadas rechazadas mediante HTTP 403. Los permisos CRUD permanecen exclusivamente en los módulos asignados**.
3. Superó satisfactoriamente las pruebas de ciberseguridad ejecutadas (59/59 PASS) y 13 suites automatizadas con 419 pruebas aprobadas, 0 fallidas y 2 no aplicables.
4. Mantiene la integridad relacional de datos en PostgreSQL 16.15 sobre 678 servidores, 6.557 comisiones y 136 acuerdos sin registros huérfanos.
5. Se encuentra debidamente documentada y estabilizada en el entorno de pruebas contenerizado.

### 16.2. Recomendación de Cierre y Próximos Pasos

> ### **DICTAMEN TÉCNICO FINAL: RECOMENDACIÓN FAVORABLE PARA CIERRE TÉCNICO DEL DESARROLLO**
>
> Se recomienda a la **Gobernación de Boyacá – Dirección de Talento Humano** dar por concluida técnicamente la fase de desarrollo e iniciar la fase de **pruebas de aceptación de usuario (UAT) y despliegue controlado en la infraestructura de producción institucional**, atendiendo las recomendaciones de seguridad descritas en la Sección 13.
>
> La presente opinión pericial reviste carácter estrictamente técnico y de ingeniería de software; no constituye una certificación jurídica ni un acto administrativo vinculante, los cuales corresponden exclusivamente a las autoridades institucionales competentes de la entidad.

---

### 16.3. Espacios Formales para Suscripción y Trámite Institucional

*Los siguientes espacios quedan a disposición para el diligenciamiento, rúbrica y suscripción formal por parte de los profesionales evaluadores y las autoridades competentes de la Gobernación de Boyacá:*

```
====================================================================================================
                        SUSCRIPCIÓN TÉCNICA DEL EQUIPO AUDITOR
====================================================================================================

Por el Equipo Técnico de Auditoría de Software:
Firma: _____________________________________________
Nombre: 
Cargo: Ingeniero Auditor Líder de Arquitectura y Backend
Fecha: ____ / ____ / 2026


Por el Equipo Técnico de Seguridad y Aseguramiento de Calidad:
Firma: _____________________________________________
Nombre: 
Cargo: Especialista en Ciberseguridad y Control de Calidad QA
Fecha: ____ / ____ / 2026


====================================================================================================
               RECEPCIÓN Y TRÁMITE INSTITUCIONAL — GOBERNACIÓN DE BOYACÁ
====================================================================================================

Por la Dirección de Talento Humano — Gobernación de Boyacá:
Firma: _____________________________________________
Nombre: 
Cargo: Director(a) de Talento Humano
Fecha: ____ / ____ / 2026


Por la Dirección de Sistemas y Tecnologías de la Información — Gobernación de Boyacá:
Firma: _____________________________________________
Nombre: 
Cargo: Director(a) de Sistemas y Gobierno Digital
Fecha: ____ / ____ / 2026
====================================================================================================
```

*Fin del informe consolidado de auditoría técnica final.*
