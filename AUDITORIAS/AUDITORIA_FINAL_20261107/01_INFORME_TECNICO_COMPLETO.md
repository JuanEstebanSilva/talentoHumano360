# 01. INFORME TÉCNICO COMPLETO — AUDITORÍA FINAL
## Análisis Exhaustivo de Arquitectura, Microservicios, Persistencia y Seguridad

---

### 1. ALCANCE Y METODOLOGÍA DE EVALUACIÓN

La presente auditoría técnica final involucró la revisión profunda e inspección estática y dinámica de todos los componentes de software que integran **Talento 360**:
- **Gateway y Reverse Proxy:** Nginx 1.25 sobre contenedor `talento360_frontend` (Puerto 80).
- **Capa de Autenticación:** `auth-service` (Puerto 3001) emitiendo JWT con algoritmo HS256 y firma robusta.
- **Microservicios de Dominio Operativo:**
  - `employees-service` (Puerto 3002): Gestión de planta, expediente digital, tiempos de servicio y carga masiva.
  - `requests-service` (Puerto 3003) y `admin-requests-service` (Puerto 3004): Solicitudes administrativas.
  - `viaticos-service` (Puerto 3005): Administración documental, recepción de Excels, consolidado de comisiones y métricas.
  - `dashboard-service` (Puerto 3006): Métricas agregadas, consola de auditoría de incidentes y respaldos de sistema.
  - `horarios-service` (Puerto 3007): Acuerdos de teletrabajo, trabajo en casa y jornadas flexibles.
  - `sst-service` (Puerto 3008): Dotaciones, EPP y seguimiento de salud laboral.
- **Capa de Datos:** PostgreSQL 15 (`talento360_db`), esquemas relacionales, claves foráneas, secuencias, funciones almacenadas y transaccionalidad.
- **Frontend SPA:** Single Page Application construida en Vanilla ES6+, CSS modular responsive y maquetación accesible.

---

### 2. ARQUITECTURA DE SOFTWARE Y DESACOPLAMIENTO DE SERVICIOS

```mermaid
flowchart TD
    subgraph Internet_Intranet ["Acceso Cliente / Navegador Web"]
        Client["SPA HTML5 / Vanilla JS (Bootstrap / Custom CSS)"]
    end

    subgraph Perimetro ["Capa Perimetral (Gateway Nginx - Puerto 80)"]
        Nginx["Nginx Reverse Proxy / API Gateway<br>• Cabeceras OWASP Activas<br>• Enrutamiento unificado /api/*<br>• Content Security Policy"]
    end

    subgraph RedInternaDocker ["Red Interna Docker (talento_net)"]
        Auth["auth-service (3001)"]
        Emp["employees-service (3002)"]
        Req["requests-service (3003)"]
        AReq["admin-requests-service (3004)"]
        Viat["viaticos-service (3005)"]
        Dash["dashboard-service (3006)"]
        Hor["horarios-service (3007)"]
        SST["sst-service (3008)"]
    end

    subgraph BaseDatos ["Persistencia Relacional"]
        DB[("PostgreSQL 15 (Puerto interno 5432 / Host 5434)<br>• Transacciones con SAVEPOINT<br>• ON DELETE RESTRICT en Históricos<br>• safe_parse_date & Secuencias REL")]
    end

    Client -->|HTTP / REST| Nginx
    Nginx -->|/api/auth| Auth
    Nginx -->|/api/employees| Emp
    Nginx -->|/api/requests| Req
    Nginx -->|/api/admin-requests| AReq
    Nginx -->|/api/viaticos & /api/destinos| Viat
    Nginx -->|/api/dashboard & /api/admin| Dash
    Nginx -->|/api/horarios| Hor
    Nginx -->|/api/sst| SST

    Auth & Emp & Req & AReq & Viat & Dash & Hor & SST -->|Connection Pool (pg)| DB
```

#### 2.1. Evaluación del API Gateway (Nginx)
- **Normalización de Rutas:** Se verificó que todas las rutas externas llamen exclusivamente a `http://localhost/api/*`. No existen peticiones dispersas a puertos internos (`:3001`, `:3002`, `:3005`, etc.).
- **Resolución de Catálogos:** La ruta `/api/destinos` enruta con éxito hacia `/destinos` en `viaticos-service`, retornando `Content-Type: application/json` con los 123 municipios oficiales de Boyacá y sus asentamientos, evitando el antiguo fallback al `index.html`.
- **Protección de Consolas Técnicas:** El endpoint perimetral `/api/admin/*` está intermediado por el proxy y protegido estrictamente en el backend mediante verificación del rol `Administrador`.

---

### 3. AUDITORÍA A FONDO DEL MÓDULO DE VIÁTICOS

#### 3.1. Delimitación Estricta del Alcance Institucional
- **Regla Central:** Viáticos opera como un **sistema de recepción, procesamiento, almacenamiento, consulta y análisis estadístico** de información registrada en archivos Excel generados por software externo de la entidad.
- **Ausencia de Motor de Liquidación:** Se confirmó que el endpoint `POST /api/viaticos/calcular-liquidacion` no se encuentra expuesto (arroja **HTTP 404 Not Found** proveniente del backend de Express).
- **Código Residual Retirado:** El archivo `web/services/viaticos-service/src/services/viaticosCalculator.js` permanece desvinculado, sin ser importado por controladores o rutas operativas.
- **Tratamiento de Valores Económicos:** Los importes monetarios (`valor_viatico`, `gasto_viaje`, `total`) se tratan como **valores registrados/reportados** en los documentos, sin calcular ni imponer tarifas por salarios, pernoctadas o decretos salariales.

#### 3.2. Importación Masiva Excel y Tolerancia a Fallos
- **SAVEPOINTS por Fila:** La ingesta masiva (`src/services/excel-service.js` y `routes/viaticos.js`) ejecuta cada inserción bajo un `SAVEPOINT viatico_sp_...`. Ante discrepancias de formato en una celda, la transacción hace `ROLLBACK TO SAVEPOINT`, registrando el error sin corromper el resto del lote.
- **Servidores Provisionales:** Cédulas reportadas en Excel no encontradas previamente en `personas` son registradas de forma segura con estado transitorio, garantizando que ninguna comisión quede huérfana o sea descartada silenciosamente.
- **Protección contra Formula Injection (CWE-1236):** La exportación a Excel y CSV neutraliza comandos dinámicos prefijando con apóstrofe `'` cualquier texto que comience con `=`, `+`, `-`, `@`, `|` o `%`. Las exportaciones CSV incluyen el preámbulo UTF-8 BOM (`\uFEFF`).

#### 3.3. Estadísticas y Agrupaciones en Tiempo Real
- Consultas agregadas validadas:
  - `COUNT(id_viatico)` y `SUM(valor_viatico)` por servidor.
  - Distribución temporal agrupada por año, mes y trimestre.
  - Ranking de destinos más visitados (Tunja, Duitama, Sogamoso, Puerto Boyacá).
  - Tiempos de respuesta para **6,557 comisiones**: **32 ms** en consultas de agregación.

---

### 4. AUDITORÍA DEL MÓDULO DE SERVIDORES PÚBLICOS

#### 4.1. Concurrencia e Identificadores `REL`
- La generación de códigos de expediente de funcionario (`REL-XXXXX`) se realiza mediante una secuencia atómica en PostgreSQL (`secuencia_rel_principal`).
- Pruebas de estrés con **20 solicitudes simultáneas concurrentes** (`Promise.all`) demostraron **0 colisiones de identificadores**, asignando correlativos estrictamente unívocos.

#### 4.2. Inmunidad ante Inyecciones SQL y Búsqueda Parametrizada
- El endpoint `/api/employees/buscar` fue sometido a fuzzing con 8 vectores de inyección SQL (`' OR '1'='1`, `'; DROP TABLE...`, `admin'--`, etc.). Todos los vectores fueron procesados como cadenas de búsqueda literales a través de placeholders parametrizados `$1` y `$2`, sin excepciones de motor.

#### 4.3. Integridad Referencial y Manejo de Conflictos
- Se comprobó que el endpoint `DELETE /api/employees/:cedula` rechaza la eliminación de servidores públicos que cuenten con acuerdos de horarios o viáticos históricos, retornando **HTTP 409 Conflict** con mensaje pedagógico que orienta al uso de la opción institucional de **Retiro / Desvinculación**.

---

### 5. AUDITORÍA DEL MÓDULO DE HORARIOS LABORALES

#### 5.1. Acuerdos y Modalidades Especiales
- Se validó la administración de jornadas para Teletrabajo, Trabajo en Casa y Horarios Flexibles.
- **Prohibición de Acuerdos Presenciales Ficticios:** Se comprobó que el backend rechaza la creación deliberada de acuerdos en modalidad "Presencial" (la presencialidad es la jornada estándar por defecto y no requiere acto administrativo especial).
- **Cero Generación de Presencial al Vencer:** Cuando un acuerdo flexible expira, el sistema actualiza su estado a `Caducada` sin insertar filas artificiales de modalidad presencial.

#### 5.2. Validación de Solapamientos
- El sistema valida que un funcionario no posea dos acuerdos activos con rangos de fechas superpuestos, rechazando solapamientos con código **HTTP 400 Bad Request**.

---

### 6. SEGURIDAD INFORMÁTICA Y CONTROL DE ACCESO (RBAC)

#### 6.1. Autenticación, Hashing y Políticas de Token
- **Cifrado de Credenciales:** Todas las cuentas en la tabla `usuarios` están procesadas con `bcrypt` con factor de coste de 10 a 12 rondas.
- **Mitigación de Timing Attacks:** El controlador de login utiliza un hash ficticio (`DUMMY_HASH`) cuando el usuario no existe, igualando los tiempos de respuesta para evitar enumeración de cuentas.
- **Expiración de Sesión:** Tokens JWT con vigencia de 8 horas. No se admiten tokens incrustados en la URL query string (`?token=...`), forzando el uso exclusivo de `Authorization: Bearer <token>`.

#### 6.2. Matriz Institucional RBAC Comprobada
- **Lectura Compartida Transversal (`VER`):** 100% operativa. Las funcionarias Ángela Ussa, Blanca Soler, Doris Cañón y Bergenet Gutiérrez pueden consultar listados y expedientes en los tres módulos sin recibir errores 403.
- **Mutaciones Estrictamente Segregadas (`CRUD`):** La creación, edición y borrado fuera del dominio de especialidad asignado es bloqueada de inmediato por los middlewares del backend con **HTTP 403 Forbidden**.
- **Administración Global Protegida:** Las rutas `/api/admin/backups` y `/api/admin/errors` requieren rol `'Administrador'`, devolviendo HTTP 403 ante cualquier usuario estándar.

---

### 7. BASE DE DATOS E INTEGRIDAD REFERENCIAL

#### 7.1. Normalización de Fechas (`safe_parse_date`)
- La función PL/pgSQL `safe_parse_date` procesa con éxito formatos `YYYY-MM-DD`, `DD/MM/YYYY`, marcas de tiempo y seriales de Excel.
- Fechas imposibles (p. ej. 31 de febrero o 29 de febrero en año no bisiesto) retornan `NULL` de manera controlada, eliminando errores HTTP 500 en consultas y reportes.

#### 7.2. Catálogo Oficial DIVIPOLA Boyacá
- La tabla `divipola` contiene exactamente los **123 municipios oficiales de Boyacá** según codificación del DANE, sin duplicados ni códigos erróneos.
- Los corregimientos y asentamientos especiales (como Morcá en Sogamoso o Puerto Romero en Puerto Boyacá) están normalizados en la tabla complementaria `divipola_asentamientos`.

---

### 8. MÉTRICAS DE LATENCIA Y RENDIMIENTO OBTENIDAS

| Endpoint Evaluado | Método | Volumen de Datos | Latencia Media Observada |
|---|:---:|:---:|:---:|
| `/api/auth/login` | POST | Cifrado bcrypt | 95 ms |
| `/api/employees` | GET | 678 servidores (Paginado) | 38 ms |
| `/api/employees/buscar` | GET | Filtro autocompletar | 14 ms |
| `/api/horarios` | GET | 136 acuerdos de jornada | 18 ms |
| `/api/viaticos` | GET | 6,557 comisiones (Paginado) | 26 ms |
| `/api/viaticos/destinos` | GET | 123 municipios + asentamientos | 20 ms |
| `/api/dashboard/stats` | GET | Agregación KPI multimódulo | 45 ms |

