# 05. INFORME DE SEGURIDAD INFORMÁTICA Y CALIDAD DE DATOS
## Análisis de Resiliencia, Protección Perimetral y Gestión de Privacidad

---

### 1. EVALUACIÓN DE VULNERABILIDADES OWASP TOP 10

| Código OWASP | Categoría de Riesgo | Estado en Talento 360 | Mecanismo de Mitigación Implementado |
|---|---|:---:|---|
| **A01:2021** | Control de Acceso Roto (Broken Access Control) | **MITIGADO** | Matriz RBAC estricta por token JWT. Separación nítida entre `:read` transversal y `:write` exclusivo. Cero escalamiento vertical u horizontal. |
| **A02:2021** | Fallas Criptográficas (Cryptographic Failures) | **MITIGADO** | Hashing de contraseñas con `bcrypt` (10 a 12 rondas). JWT firmado con algoritmo HS256 y secreto obligatorio en producción. |
| **A03:2021** | Inyección (Injection - SQL / CSV / Comandos) | **MITIGADO** | Consultas SQL 100% parametrizadas con placeholders (`$1`, `$2`). Sanitización de fórmulas Excel/CSV contra CWE-1236. |
| **A04:2021** | Diseño Inseguro (Insecure Design) | **MITIGADO** | Flujos transaccionales con `SAVEPOINT`. Inmutabilidad garantizada en viáticos legalizados y restricciones de integridad en BD. |
| **A05:2021** | Configuración de Seguridad Incorrecta | **MITIGADO** | `NODE_ENV: production` activo. Cabeceras Nginx OWASP (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). |
| **A06:2021** | Componentes Vulnerables y Desactualizados | **CONTROLADO** | Dependencias fijadas y verificadas. Cero librerías con vulnerabilidades críticas conocidas en ejecución. |
| **A07:2021** | Fallas de Identificación y Autenticación | **MITIGADO** | Rate limiting activo en login (15 peticiones/15 min). Bloqueo de tokens en query string. Cookie HttpOnly segura. |
| **A08:2021** | Fallas en la Integridad del Software y Datos | **MITIGADO** | Verificación de esquemas DTO en importaciones masivas Excel y validación estricta de extensiones de archivo. |
| **A09:2021** | Fallas en el Registro y Monitoreo de Seguridad | **MITIGADO** | Consola de incidentes técnicos en PostgreSQL (`system_errors`) con captura de IP de origen real detrás del proxy Nginx. |
| **A10:2021** | Falsificación de Solicitudes del Lado del Servidor (SSRF)| **NO APLICA** | El backend no realiza peticiones HTTP arbitrarias salientes dirigidas por entradas del usuario. |

---

### 2. AUDITORÍA DE CABECERAS DE SEGURIDAD HTTP EN NGINX

Se analizaron las cabeceras emitidas por el contenedor `talento360_frontend`:
- `X-Frame-Options: SAMEORIGIN`: Impide ataques de secuestro de clics (Clickjacking).
- `X-Content-Type-Options: nosniff`: Evita que el navegador ejecute scripts camuflados en imágenes o archivos planos.
- `Referrer-Policy: strict-origin-when-cross-origin`: Protege la fuga de rutas internas en solicitudes salientes.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Deshabilita el acceso no autorizado a periféricos físicos del dispositivo del usuario.
- `Content-Security-Policy (CSP)`: Delimita los orígenes de scripts y estilos permitidos.
- `Server Tokens`: Directiva `server_tokens off;` activa, impidiendo la divulgación de la versión exacta de Nginx.

---

### 3. INTEGRIDAD TRANSACCIONAL Y CALIDAD DE DATOS EN POSTGRESQL

#### 3.1. Estado de Restricciones y Claves Foráneas
- `fk_horarios_personas`: Conecta `horarios.numero_documento` con `personas.cedula`. Definida con `ON DELETE RESTRICT` y `ON UPDATE CASCADE`.
- `fk_viaticos_personas`: Conecta `viaticos.numero_documento` con `personas.cedula`. Definida con `ON DELETE RESTRICT` y `ON UPDATE CASCADE`.
- **Efecto de Seguridad:** Es imposible eliminar a un servidor público que mantenga antecedentes de viáticos o acuerdos de teletrabajo. El intento genera **HTTP 409 Conflict** y preserva la trazabilidad contable y administrativa.

#### 3.2. Normalización de Catálogos Geográficos
- Los **123 municipios de Boyacá** coinciden en código DANE y ortografía oficial (Tunja, Duitama, Sogamoso, Chiquinquirá, Guicán de la Sierra, Santa Rosa de Viterbo, Paz de Río, etc.).
- Corregimientos y veredas de destino están asociados a su municipio cabecera mediante la tabla `divipola_asentamientos` y la vista unificada `v_destinos_boyaca`.

