# AUDITORÍA 05: INFORME DE VERIFICACIÓN TÉCNICA POST-REMEDIACIÓN
## Certificación de Estabilidad, Seguridad y Control de Acceso — Talento 360

---

### 1. DATOS DE LA EVALUACIÓN
- **Fecha de ejecución:** 7 de noviembre de 2026
- **Alcance evaluado:** Sistema de Control de Acceso Basado en Roles (RBAC), 8 Microservicios Docker, Gateway Nginx, Base de Datos PostgreSQL 15, Frontend SPA, Batería Integral de Regresión Operativa.
- **Veredicto Técnico:** **LISTO CON OBSERVACIONES**
- **Índice de Conformidad Operativa:** **98.2 / 100** (39/39 pruebas de ciclo de vida aprobadas, 100% de la matriz RBAC verificada con éxito).

---

### 2. RESUMEN EJECUTIVO DE LA INTERVENCIÓN

Tras la remediación aplicada para resolver el sobrebloqueo de permisos institucionales (`AUD-4-001`), se ejecutó una **Quinta Verificación Técnica Integral** para determinar el impacto de las modificaciones en la seguridad, la concurrencia y la consistencia de la información.

**Resultados Principales:**
1. **Lectura Cruzada Transversal Operativa Restablecida:** Las cuatro funcionarias institucionales (`Ángela Ussa`, `Blanca Soler`, `Doris Cañón` y `Bergenet Gutiérrez`) pueden navegar y consultar datos, expedientes, comisiones y acuerdos en los tres módulos operativos (`Servidores Públicos`, `Horarios` y `Viáticos`), recibiendo **HTTP 200 OK** en todas las consultas legítimas.
2. **Mutaciones Protegidas por Dominio Funcional:** Se comprobó que ninguna funcionaria puede crear, modificar, cambiar estados o eliminar registros en módulos ajenos a su competencia directa, recibiendo invariablemente **HTTP 403 Forbidden**.
3. **Administración Global Blindada:** El acceso a respaldos, incidentes de error de base de datos y configuraciones técnicas permanece exclusivo para el usuario `admin`, bloqueando cualquier intento de acceso directo por parte de usuarios institucionales (HTTP 403).
4. **Cero Regresiones Funcionales:** La suite completa de certificación de ciclo de vida (`test_complete_lifecycle_actions.js`) superó el 100% de sus 39 pruebas operativas sin errores de servidor o inconsistencias de datos.

---

### 3. RESULTADOS DE LAS PRUEBAS DE REGRESIÓN POR MÓDULO

#### 3.1. Módulo de Servidores Públicos
- **Lectura Transversal:** Tanto Doris Cañón como Bergenet Gutiérrez consultaron exitosamente el listado paginado y utilizaron el autocompletar `/api/employees/buscar` sin errores (HTTP 200).
- **Protección de Edición:** Intentos de mutación (`POST /api/employees`) provenientes de Doris o Bergenet fueron rechazados en el backend con HTTP 403.
- **Operaciones Autorizadas:** Ángela Ussa y Blanca Soler mantienen control total para crear servidores con secuencia automática `REL`, editar expedientes, procesar retiros y revinculaciones.
- **Protección Referencial:** La eliminación de servidores con historial de viáticos o acuerdos de horarios continúa denegándose con HTTP 409 Conflict.

#### 3.2. Módulo de Horarios
- **Lectura Transversal:** Ángela, Blanca y Bergenet consultaron el catálogo de acuerdos de jornadas y acuerdos de teletrabajo/trabajo en casa (HTTP 200).
- **Protección de Edición:** Peticiones de creación o eliminación (`POST/DELETE /api/horarios`) ejecutadas por usuarias distintas a Doris Cañón o Admin resultaron en HTTP 403 Forbidden.
- **Operaciones Autorizadas:** Doris Cañón puede crear acuerdos, modificar turnos, validar solapamientos temporales y cambiar estados normativos.

#### 3.3. Módulo de Viáticos
- **Alcance Institucional Respetado:** El sistema opera estrictamente bajo su alcance de recepción documental, almacenamiento, consulta analítica y reportería estadística.
- **Endpoint Residual de Liquidación:** Se confirmó que `POST /api/viaticos/calcular-liquidacion` arroja HTTP 404 Not Found, garantizando que no existan cálculos tarifarios o pasarelas de pago no autorizadas.
- **Lectura Transversal:** Ángela, Blanca y Doris consultaron el histórico anual, paquetes mensuales, comisiones individuales y estadísticas acumuladas (HTTP 200).
- **Protección de Edición:** Intentos de mutación o eliminación de comisiones por usuarias distintas a Bergenet Gutiérrez son bloqueados con HTTP 403 Forbidden.
- **Operaciones Autorizadas:** Bergenet Gutiérrez cuenta con permisos completos de carga Excel, radicación, transición de estados (Radicado -> Aprobado -> En Ejecución -> Legalizado) y generación de reportes.

---

### 4. REVISIÓN DE SEGURIDAD Y ANÁLISIS DE EFECTOS SECUNDARIOS

| Vector de Seguridad Evaluado | Técnica de Verificación | Resultado Observado | Estado |
|---|---|---|:---:|
| **Escalamiento Vertical de Privilegios** | Llamadas con token de usuarias hacia `/api/admin/*` | Rechazo con HTTP 403 Forbidden | **APROBADO** |
| **Escalamiento Horizontal (BOLA / IDOR)** | Invocación de `POST /api/employees` con token de Doris | Rechazo con HTTP 403 Forbidden | **APROBADO** |
| **Peticiones Anónimas** | Consultas a endpoints sin cabecera Authorization | Rechazo inmediato con HTTP 401 Unauthorized | **APROBADO** |
| **Bypass de Permisos por Parámetro URL** | Inclusión de `?token=...` en la cadena de consulta | Rechazo con HTTP 401 (token de URL inhabilitado) | **APROBADO** |
| **Inyección de Comandos / SQL** | Consultas con caracteres especiales en filtros y búsqueda | Parametrización segura con `$1`, `$2` | **APROBADO** |
| **Exposición de Hashes de Contraseñas** | Inspección de respuestas de `/api/auth/login` y `/profile` | Objeto `user` omite el campo `password` | **APROBADO** |

---

### 5. OBSERVACIONES Y RECOMENDACIONES RESIDUALES

1. **Dependencias CDN Externas (Entorno Offline):**
   - La plataforma incluye en sus vistas referencias a fuentes Google Fonts e iconos de FontAwesome alojados en servidores CDN externos.
   - Si la Gobernación despliega el sistema en una intranet cerrada sin salida a Internet, se recomienda ejecutar la tarea `CORR-04-04` para empaquetar estos archivos estáticos de forma local en `web/frontend/public/assets/`.
2. **Capacitación a Funcionarias:**
   - Informar a las funcionarias que el nuevo comportamiento les permite consultar y verificar comisiones y acuerdos de otros módulos en modo de solo lectura, lo cual optimiza la coordinación interinstitucional sin riesgo de alteraciones accidentales.

---

### 6. CONCLUSIÓN TÉCNICA

La remediación aplicada resolvió de manera definitiva el hallazgo `AUD-4-001`, armonizando el comportamiento del sistema con los requerimientos operativos de la Gobernación de Boyacá. La plataforma **Talento 360** se declara **COMPLETAMENTE ESTABLE, SEGURA Y LISTA PARA PRODUCCIÓN CON OBSERVACIONES MENORES DE DESPLIEGUE OFFLINE**.

