# 03. SEGUIMIENTO HISTÓRICO DE AUDITORÍAS ANTERIORES
## Trazabilidad Definitiva, Descarte Fundamentado y Verificación Técnica

---

### 1. OBJETIVO DEL SEGUIMIENTO HISTÓRICO

Uno de los mandatos esenciales de esta Auditoría Final es **cerrar el ciclo histórico de observaciones**, evaluando objetivamente cada uno de los hallazgos acumulados desde las auditorías 2, 3 y 4. 

Se descartan de forma fundamentada aquellas observaciones que:
- Ya fueron remediadas y verificadas con pruebas en tiempo de ejecución.
- Corresponden a interpretaciones desactualizadas o contradicen el mandato institucional.
- Se encuentran expresamente fuera del alcance de la plataforma (como liquidaciones económicas en Viáticos).

---

### 2. MATRIZ DE TRAZABILIDAD Y ESTADO DEFINITIVO DE HALLAZGOS

| Identificador Original | Descripción Sintética | Severidad Original | Estado Final Verificado | Fundamentación Técnica / Evidencia Comprobada |
|---|---|:---:|:---:|---|
| **AUD-4-001** | Sobrebloqueo RBAC de lectura cruzada en módulos operativos | ALTA | **CORREGIDO Y VERIFICADO** | Subsanado mediante la columna `permisos TEXT` en `usuarios`, emisión de JWT con permisos granulares y ajuste en `hasPermission`. Lectura transversal activa en HTTP 200 y mutaciones protegidas en HTTP 403. |
| **AUD-4-002** | Validación de roles por subcadenas (`includes('admin')`) | MEDIA | **CORREGIDO Y VERIFICADO** | En `requests`, `admin-requests` y `sst` se sustituyó por igualdad estricta (`r === 'administrador'`) y validación de permisos en el payload. |
| **AUD-4-003** | Dependencia de recursos estáticos externos (Google Fonts / CDNs) | BAJA | **DESCARTADO COMO DEFECTO** *(Observación Operativa Menor)* | No afecta la operatividad del sistema en red estándar. Solo aplica si la Gobernación despliega en una intranet desconectada (air-gapped). |
| **AUD-NUEVO-001** | Aislamiento horizontal de privilegios entre dependencias | ALTA | **CORREGIDO Y VERIFICADO** | Confinamiento estricto de mutaciones por usuario. Ninguna servidora puede modificar comisiones o expedientes fuera de su área. |
| **AUD-NUEVO-002** | Error 500 en filtros de fechas por formatos no ISO | MEDIA | **CORREGIDO Y VERIFICADO** | Función SQL `safe_parse_date` en PostgreSQL normaliza formatos DD/MM/YYYY e ISO de manera controlada. |
| **AUD-NUEVO-003** | Ruta Nginx `/api/destinos` devolvía HTML en vez de JSON | MEDIA | **CORREGIDO Y VERIFICADO** | Bloque `location /api/destinos` en `nginx.conf` entrega el catálogo JSON (123 municipios) con HTTP 200. |
| **AUD-NUEVO-004** | Escalamiento de privilegios admin por subcadenas en dashboard | ALTA | **CORREGIDO Y VERIFICADO** | Validación estricta `user.rol === 'Administrador'` activa en controladores de dashboard y respaldos. |
| **AUD-NUEVO-005** | Fuga de Token JWT mediante Parámetros de URL (`?token=`) | ALTA | **CORREGIDO Y VERIFICADO** | Extracción de token restringida a cabecera `Authorization: Bearer` y cookie HttpOnly. Peticiones con `?token=` arrojan 401. |
| **AUD-NUEVO-006** | Inyección SQL en endpoint de búsqueda `/api/employees/buscar` | CRÍTICA | **CORREGIDO Y VERIFICADO** | Consulta 100% parametrizada con `$1`, `$2`. Fuzzing con 8 vectores SQLi confirmó neutralización total. |
| **AUD-NUEVO-007** | Eliminación indebida de comisiones en estado "Legalizado" | ALTA | **CORREGIDO Y VERIFICADO** | Backend bloquea con HTTP 400 Bad Request cualquier intento de borrado sobre viáticos formalizados/legalizados. |
| **AUD-NUEVO-008** | Falla en importación masiva Excel por discrepancias de personal | ALTA | **CORREGIDO Y VERIFICADO** | Ingesta masiva con `SAVEPOINT` por fila y registro de funcionarios provisionales garantiza 0% de pérdida de registros. |
| **AUD-NUEVO-009** | Modo de entorno Docker en desarrollo por omisión | BAJA | **CORREGIDO Y VERIFICADO** | Configuración explícita `NODE_ENV: production` presente en todos los microservicios en `docker-compose.yml`. |
| **AUD-NUEVO-010** | Presencia residual de endpoints de cálculo tarifario | MEDIA | **CORREGIDO Y VERIFICADO** | Endpoint `POST /api/viaticos/calcular-liquidacion` arroja HTTP 404 real. Módulo `viaticosCalculator.js` desvinculado. |
| **AUD2-001** | Discrepancia de puertos en endpoints de servicios | ALTA | **CORREGIDO Y VERIFICADO** | Centralización en Nginx Gateway (Puerto 80); llamadas relativas `/api/*`. |
| **AUD2-002** | Contraseñas en texto plano / hashing débil | CRÍTICA | **CORREGIDO Y VERIFICADO** | Todas las cuentas en `usuarios` procesadas con `bcrypt` (10 a 12 rondas). |
| **AUD2-003** | Cabeceras de seguridad ausentes en proxy | MEDIA | **CORREGIDO Y VERIFICADO** | Cabeceras CSP, X-Frame-Options, X-Content-Type-Options y Referrer-Policy activas en Nginx. |
| **AUD2-004** | Exposición de variables de entorno en repositorios | ALTA | **CORREGIDO Y VERIFICADO** | Inyección segura de variables en Docker Compose e inclusión de `.env` en `.gitignore`. |
| **AUD2-005** | Ausencia de índices en campos de búsqueda frecuente | MEDIA | **CORREGIDO Y VERIFICADO** | Índices B-tree y funcionales activos en `personas`, `viaticos` y `horarios`. |
| **AUD2-006** | Falta de paginación en consultas masivas de viáticos | MEDIA | **CORREGIDO Y VERIFICADO** | Endpoints de consulta implementan cláusulas `LIMIT` y `OFFSET` validadas. |
| **AUD2-007** | Inconsistencia de convenciones de nombres en payloads | BAJA | **CORREGIDO Y VERIFICADO** | Capa DTO y controladores normalizan salidas JSON de manera uniforme. |
| **AUD2-008** | Inserciones complejas sin control de transacciones | ALTA | **CORREGIDO Y VERIFICADO** | Transaccionalidad atómica (`BEGIN`, `COMMIT`, `ROLLBACK`) en creación de servidores y horarios. |
| **AUD2-009** | Ausencia de protección contra ataques de fuerza bruta | ALTA | **CORREGIDO Y VERIFICADO** | `express-rate-limit` activo en `auth-service` (protección contra ataques de diccionario). |
| **AUD2-010** | Manejo inseguro de sesiones concurrentes | MEDIA | **CORREGIDO Y VERIFICADO** | Tokens JWT con expiración estricta de 8 horas y rechazo de firmas adulteradas. |
| **AUD2-011** | Validación insuficiente de tipos en importaciones Excel | ALTA | **CORREGIDO Y VERIFICADO** | `excelHelper.js` y `employeeValidator.js` validan tipos, longitudes y formatos de fecha. |
| **AUD2-012** | Generación de reportes bloqueaba el hilo principal | MEDIA | **CORREGIDO Y VERIFICADO** | Generación asíncrona y buffers de streaming para reportes masivos. |
| **AUD2-013** | Registros huérfanos al eliminar servidores públicos | ALTA | **CORREGIDO Y VERIFICADO** | Claves foráneas con `ON DELETE RESTRICT`; eliminación rechazada con HTTP 409 Conflict. |
| **AUD2-014** | Mensajes de error del motor de BD expuestos al cliente | MEDIA | **CORREGIDO Y VERIFICADO** | Manejadores de error capturan excepciones internas y retornan mensajes sanitizados. |

---

### 3. JUSTIFICACIÓN DETALLADA DE OBSERVACIONES DESCARTADAS

#### 3.1. Liquidación Tarifaria Automática en Viáticos
- **Motivo de Descarte:** **EXPRESAMENTE FUERA DE ALCANCE**.
- **Justificación:** Los requerimientos institucionales de la Gobernación de Boyacá ratifican que Talento 360 tiene por objeto la recepción documental, almacenamiento, consulta y análisis estadístico de los viáticos registrados en archivos Excel emitidos por otros sistemas institucionales. La ausencia de algoritmos de liquidación por decreto, pernoctadas o salarios no constituye un defecto, sino la estricta fidelidad al alcance funcional contratado.

#### 3.2. Clasificación de Lectura Cruzada como Vulnerabilidad BOLA
- **Motivo de Descarte:** **FALSO POSITIVO METODOLÓGICO**.
- **Justificación:** En la Tercera Auditoría se catalogó la lectura transversal de módulos como una falla de control de acceso. Sin embargo, en el contexto institucional de Talento Humano, las cuatro funcionarias requieren visibilidad compartida para verificar la vinculación de servidores con comisiones y acuerdos de horarios. Dado que las operaciones de mutación (`CRUD`) permanecen blindadas, la visibilidad operativa no vulnera la seguridad del sistema.

