# AUDITORÍA 05: SEGUIMIENTO DE HALLAZGOS Y ANÁLISIS DE NO-REGRESIÓN
## Trazabilidad Histórica de Hallazgos y Evaluación Post-Remediación — Talento 360

---

### 1. SEGUIMIENTO DE HALLAZGOS DE LA CUARTA AUDITORÍA

| Código Hallazgo | Descripción | Severidad | Estado Previo | Estado Auditoría 5 | Evidencia Técnica Comprobada |
|---|---|:---:|:---:|:---:|---|
| **AUD-4-001** | Sobrebloqueo de lectura cruzada institucional en módulos operativos | ALTA | Detectado | **CORREGIDO Y VERIFICADO** | Las 4 funcionarias reciben HTTP 200 al consultar Servidores, Horarios y Viáticos. Las mutaciones no autorizadas retornan HTTP 403. |
| **AUD-4-002** | Validación permisiva de roles mediante subcadenas en microservicios secundarios | MEDIA | Detectado | **CORREGIDO Y VERIFICADO** | Reemplazo de `includes('administrador')` por igualdad estricta y validación de permisos en `requests`, `admin-requests` y `sst`. |
| **AUD-4-003** | Dependencia de recursos estáticos externos (Google Fonts / CDNs) | BAJA | Detectado | **PENDIENTE (Menor)** | Recomendado para despliegues en redes aisladas (offline). No compromete la operatividad funcional estándar. |

---

### 2. SEGUIMIENTO DE LOS 10 HALLAZGOS DE LA TERCERA AUDITORÍA

| Código | Descripción Resumida | Severidad Original | Estado Post-Remediación 5 | Verificación Operativa en Vivo |
|---|---|:---:|:---:|---|
| **AUD-NUEVO-001** | Control Horizontal de Acceso Multimódulo | ALTA | **CORREGIDO Y VERIFICADO** | Segregación por granularidad de permisos (`:read` vs `:write`). Cero BOLA/IDOR. |
| **AUD-NUEVO-002** | Error 500 en Filtro de Fechas por Formato No ISO | MEDIA | **CORREGIDO Y VERIFICADO** | Función `safe_parse_date` en PostgreSQL procesa formatos DD/MM/YYYY e ISO sin errores 500. |
| **AUD-NUEVO-003** | Ruta Nginx `/api/destinos` devolvía HTML en lugar de JSON | MEDIA | **CORREGIDO Y VERIFICADO** | Retorna catálogo JSON (120 destinos) con HTTP 200 y `Content-Type: application/json`. |
| **AUD-NUEVO-004** | Escalamiento de privilegios admin por subcadenas | ALTA | **CORREGIDO Y VERIFICADO** | Verificación estricta `user.rol === 'Administrador'` activa en backend. |
| **AUD-NUEVO-005** | Fuga de Token JWT mediante Parámetros de URL (`?token=`) | ALTA | **CORREGIDO Y VERIFICADO** | Peticiones con token en query son rechazadas con HTTP 401. Solo cabecera Bearer es admitida. |
| **AUD-NUEVO-006** | Inyección SQL en endpoint de búsqueda `/api/employees/buscar` | CRÍTICA | **CORREGIDO Y VERIFICADO** | Consulta 100% parametrizada con `$1`, `$2`. Inyecciones sintéticas tratadas como texto literal. |
| **AUD-NUEVO-007** | Eliminación indebida de comisiones de viáticos en estado Legalizado | ALTA | **CORREGIDO Y VERIFICADO** | Backend bloquea con HTTP 400 Bad Request cualquier intento de borrado de viáticos formalizados. |
| **AUD-NUEVO-008** | Falla en importación masiva Excel por discrepancias de personal | ALTA | **CORREGIDO Y VERIFICADO** | Algoritmo con `SAVEPOINT` por fila y auto-registro provisional evita interrupción del lote. |
| **AUD-NUEVO-009** | Modo de entorno Docker en desarrollo por omisión | BAJA | **CORREGIDO Y VERIFICADO** | `NODE_ENV: production` configurado de forma explícita en `docker-compose.yml`. |
| **AUD-NUEVO-010** | Endpoints residuales de cálculo tarifario de viáticos | MEDIA | **CORREGIDO Y VERIFICADO** | `POST /api/viaticos/calcular-liquidacion` arroja HTTP 404. Archivo `viaticosCalculator.js` desvinculado. |

---

### 3. EVALUACIÓN DE REGRESIONES Y EFECTOS SECUNDARIOS

Durante la Quinta Auditoría se ejecutó una batería de análisis de no-regresión sobre los siguientes aspectos sensibles:

#### 3.1. ¿Se abrieron rutas GET públicas o no autenticadas?
- **Resultado:** **NO.** Se comprobó que cualquier solicitud sin token JWT hacia `/api/employees`, `/api/horarios`, `/api/viaticos` o `/api/admin/*` es rechazada de inmediato con **HTTP 401 Unauthorized**.

#### 3.2. ¿Se otorgaron privilegios de escritura a usuarios con permiso VER?
- **Resultado:** **NO.** Intentos deliberados de inserción, actualización y eliminación de registros por usuarias en módulos ajenos fueron rechazados con **HTTP 403 Forbidden**.

#### 3.3. ¿Se afectó la integridad de la base de datos?
- **Resultado:** **NO.** La estructura relacional, claves foráneas, secuencias numéricas y disparadores de auditoría operan sin anomalías. El script `database/26_rbac_cross_module_read_and_permissions.sql` preservó intactos los datos maestros y relaciones previas.

#### 3.4. ¿Se mantiene el alcance institucional en Viáticos?
- **Resultado:** **SÍ.** El sistema no realiza liquidaciones automáticas, cálculos de nómina, tablas salariales ni pagos, operando exclusivamente como repositorio de recepción Excel, consulta y análisis estadístico.

---

### 4. ASPECTOS NO VERIFICABLES EN ESTA SESIÓN
- **Comportamiento en Redes Desconectadas (Air-Gapped Intranet):** Al requerir acceso físico a un entorno sin internet para comprobar la carga de fuentes locales de Google Fonts, este aspecto permanece documentado como recomendación de empaquetamiento opcional previa a la entrega en datacenter cerrado.

