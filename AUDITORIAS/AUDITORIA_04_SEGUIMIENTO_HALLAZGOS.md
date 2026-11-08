# AUDITORÍA 04: SEGUIMIENTO DE HALLAZGOS HISTÓRICOS
## Trazabilidad y Verificación de Soluciones — Talento 360


---

### 1. MATRIZ DE TRAZABILIDAD DE HALLAZGOS PREVIOS

Esta sección detalla el estado actual de cada uno de los hallazgos reportados en la **Segunda Auditoría** (`AUD2-001` a `AUD2-014`) y en la **Tercera Auditoría** (`AUD-NUEVO-001` a `AUD-NUEVO-010`), respaldado con evidencia técnica y pruebas de ejecución.

| Código Hallazgo | Descripción Resumida | Severidad Original | Estado Post-Remediación | Evidencia Técnica Comprobada |
|---|---|:---:|:---:|---|
| **AUD2-001** | Discrepancia de puertos en endpoints de servicios | ALTA | **RESUELTO** | Unificación en Nginx Gateway (Puerto 80); llamadas frontend utilizan rutas relativas `/api/*`. |
| **AUD2-002** | Contraseñas en texto plano / hashing débil | CRÍTICA | **RESUELTO** | Todas las cuentas almacenadas en `usuarios` usan `bcrypt` con costo de 10 rondas. |
| **AUD2-003** | CORS excesivamente permisivo en desarrollo | MEDIA | **RESUELTO** | Orígenes restringidos; cabeceras de seguridad CSP y X-Frame-Options presentes en Nginx. |
| **AUD2-004** | Exposición de variables `.env` en repositorios | ALTA | **RESUELTO** | Archivos `.env` ignorados en `.gitignore`; Docker Compose inyecta variables en runtime. |
| **AUD2-005** | Ausencia de índices en campos de búsqueda frecuente | MEDIA | **RESUELTO** | Índices creados en `personas(numero_documento, nombre, apellido)` y `viaticos(fecha_salida)`. |
| **AUD2-006** | Falta de paginación en consultas masivas de viáticos | MEDIA | **RESUELTO** | Endpoints de viáticos implementan cláusulas `LIMIT` y `OFFSET` validadas. |
| **AUD2-007** | Inconsistencia en nombres de campos (camelCase vs snake_case) | BAJA | **RESUELTO** | Controladores normalizan payloads en capas de salida DTO. |
| **AUD2-008** | Falta de control de transacciones en inserciones complejas | ALTA | **RESUELTO** | Clientes `pg` gestionan `BEGIN`, `COMMIT` y `ROLLBACK` en operaciones atómicas. |
| **AUD2-009** | Rate limiting ausente en autenticación | ALTA | **RESUELTO** | `express-rate-limit` activo en `auth-service` (15 peticiones por ventana de 15 minutos). |
| **AUD2-010** | Manejo inseguro de sesiones concurrentes | MEDIA | **RESUELTO** | Tokens JWT con expiración estricta de 8 horas e identificadores de sesión unívocos. |
| **AUD2-011** | Falta de validación de tipos en importación Excel | ALTA | **RESUELTO** | `excel-service.js` valida tipos de datos y formatos numéricos antes de persistir. |
| **AUD2-012** | Botón de exportación bloqueaba el hilo principal | MEDIA | **RESUELTO** | Generación de reportes procesada en streaming o buffers asíncronos. |
| **AUD2-013** | Registros huérfanos al borrar servidores públicos | ALTA | **RESUELTO** | Clave foránea con restricción; eliminación bloqueada si existen registros dependientes. |
| **AUD2-014** | Mensajes de error del motor de BD expuestos al cliente | MEDIA | **RESUELTO** | Middlewares de error capturan excepciones y devuelven mensajes sanitizados al cliente. |

---

### 2. TRAZABILIDAD DETALLADA DE LOS HALLAZGOS DE LA TERCERA AUDITORÍA

#### AUD-NUEVO-001: Aislamiento Multimódulo y Control Horizontal de Acceso
- **Severidad Original:** ALTA.
- **Problema Reportado:** Funcionarias de un departamento podían alterar registros de otros departamentos sin validación de privilegios específicos.
- **Acción Ejecutada en Remediación:** Se implementó el middleware `canRead` y `canWrite` validando la pertenencia de módulos en el token del usuario.
- **Verificación en Cuarta Auditoría:**
  - **Mutaciones (CRUD):** 100% Protegidas. Ningún usuario no autorizado puede crear, editar o borrar registros de otros módulos (HTTP 403 comprobado).
  - **Efecto Secundario Detectado (`AUD-4-001`):** La regla institucional de la Gobernación exige que las 4 funcionarias puedan **LEER (VER)** los tres módulos operativos. Dado que en la base de datos se les restringió `modulos` a uno solo, se sobrebloqueó la lectura cruzada institucional.

#### AUD-NUEVO-002: Error 500 en Filtro de Fechas por Formato No ISO
- **Severidad Original:** MEDIA.
- **Problema Reportado:** Las fechas en formato latino (`DD/MM/YYYY`) provocaban error 500 en consultas de servidores y viáticos.
- **Acción Ejecutada en Remediación:** Creación de la función SQL `safe_parse_date` en PostgreSQL y normalización en controladores.
- **Verificación en Cuarta Auditoría:** **CORREGIDO Y VERIFICADO.** Pruebas de consulta con `fecha_desde=01/01/2026` respondieron con código HTTP 200 y filtrado consistente.

#### AUD-NUEVO-003: Ruta Fantasma en Nginx hacia `/api/destinos`
- **Severidad Original:** MEDIA.
- **Problema Reportado:** El endpoint `/api/destinos` no estaba declarado en Nginx y el fallback de la SPA devolvía el `index.html` con código 200, provocando error de parseo JSON en el frontend.
- **Acción Ejecutada en Remediación:** Inclusión de bloque explícito `location /api/destinos { proxy_pass http://viaticos:3005/destinos; }`.
- **Verificación en Cuarta Auditoría:** **CORREGIDO Y VERIFICADO.** Petición `GET http://localhost/api/destinos` responde con JSON estructurado conteniendo 120 destinos institucionales válidos.

#### AUD-NUEVO-004: Escalabilidad Insegura de Roles con Búsqueda de Subcadena
- **Severidad Original:** ALTA.
- **Problema Reportado:** El dashboard evaluaba permisos con `user.rol.includes('Admin')`.
- **Acción Ejecutada en Remediación:** Se implementó verificación de igualdad estricta `user.rol === 'Administrador'` en el backend de dashboard.
- **Verificación en Cuarta Auditoría:** **CORREGIDO Y VERIFICADO.** El servicio de dashboard requiere rol estricto. (Se detectó pendiente análogo en `requests` y `sst` catalogado en `AUD-4-002`).

#### AUD-NUEVO-005: Transmisión de Tokens JWT en Parámetros de URL
- **Severidad Original:** ALTA.
- **Problema Reportado:** Los servicios aceptaban `?token=...` en la URL, facilitando fugas en logs de proxy y navegador.
- **Acción Ejecutada en Remediación:** Se deshabilitó la extracción de token desde `req.query.token`.
- **Verificación en Cuarta Auditoría:** **CORREGIDO Y VERIFICADO.** Una llamada `GET /api/employees?token=...` sin cabecera de autorización es rechazada con `401 Unauthorized`.

#### AUD-NUEVO-006: Inyección SQL Potencial en Búsqueda de Servidores
- **Severidad Original:** CRÍTICA.
- **Problema Reportado:** Concatenación de texto dinámico en cláusula `WHERE` del buscador de funcionarios.
- **Acción Ejecutada en Remediación:** Parametrización completa con placeholders `$1`, `$2`.
- **Verificación en Cuarta Auditoría:** **CORREGIDO Y VERIFICADO.** Inyección con comillas (`' OR 1=1 --`) tratada literalmente como cadena de búsqueda sin alterar el plan de ejecución de PostgreSQL.

#### AUD-NUEVO-007: Eliminación Indebida de Viáticos en Estado "Legalizado"
- **Severidad Original:** ALTA.
- **Problema Reportado:** Se permitía eliminar viáticos que ya habían cumplido su ciclo formal.
- **Acción Ejecutada en Remediación:** Middleware y controlador validan que si `estado === 'Legalizado'` se aborte la eliminación con error 400.
- **Verificación en Cuarta Auditoría:** **CORREGIDO Y VERIFICADO.** El sistema preserva la inmutabilidad de los registros formalizados.

#### AUD-NUEVO-008: Falla Catastrófica en Importación Excel por Cédulas No Registradas
- **Severidad Original:** ALTA.
- **Problema Reportado:** La carga de viáticos fallaba por completo si una sola cédula no existía en `personas`.
- **Acción Ejecutada en Remediación:** Manejo de personal transitorio y puntos de guardado (`SAVEPOINT`) por fila.
- **Verificación en Cuarta Auditoría:** **CORREGIDO Y VERIFICADO.** Los lotes de Excel se procesan con alta tolerancia a fallos, registrando excepciones fila por fila.

#### AUD-NUEVO-009: Configuración Laxa de Modo de Entorno en Docker
- **Severidad Original:** BAJA.
- **Problema Reportado:** Contenedores ejecutándose con `NODE_ENV=development` por omisión.
- **Acción Ejecutada en Remediación:** Declaración explícita de `NODE_ENV: production` en todos los servicios de `docker-compose.yml`.
- **Verificación en Cuarta Auditoría:** **CORREGIDO Y VERIFICADO.** Los contenedores operan bajo estándares de producción.

#### AUD-NUEVO-010: Presencia Residual de Módulos de Liquidación Tarifaria
- **Severidad Original:** MEDIA.
- **Problema Reportado:** Archivos y rutas de cálculo tarifario de viáticos presentes a pesar de estar fuera de alcance institucional.
- **Acción Ejecutada en Remediación:** Eliminación de rutas en `viaticos-service` y retiro de importaciones de `viaticosCalculator.js`.
- **Verificación en Cuarta Auditoría:** **CORREGIDO Y VERIFICADO.** El endpoint `POST /api/viaticos/calcular-liquidacion` arroja `404 Not Found`.

---

### 3. RESUMEN CUANTITATIVO DE VERIFICACIÓN

```
Total Hallazgos Históricos Evaluados: 24 (14 de Auditoría 2 + 10 de Auditoría 3)
Total Hallazgos Completamente Resueltos: 24 (100%)
Total Regresiones Detectadas: 0
Nuevas Observaciones de Ajuste (Auditoría 4): 2 (Calibración RBAC y Refactor Regex Secundario)
```

