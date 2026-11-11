# Políticas de Seguridad, RBAC y Endurecimiento Institucional
## Talento 360 — Gobernación de Boyacá

Este documento establece las normas técnicas, controles criptográficos, matrices de acceso y directrices de protección de datos personales para la plataforma **Talento 360**.

---

## 1. Criptografía y Gestión de Identidades

### 1.1. Algoritmo de Hashing de Contraseñas
- **Bcrypt (`bcryptjs`):** Implementado con un factor de coste (*work factor*) de **12** (4.096 iteraciones).
- **Prohibición de Texto Plano:** Ninguna contraseña se almacena, transmite o compara en texto legible.
- **Mitigación de Ataques de Temporización (*Timing Attacks*):**
  - Cuando se intenta autenticar un usuario no registrado, el sistema ejecuta un hash simulado precomputado (`DUMMY_HASH`) para que el tiempo de cómputo de la respuesta sea idéntico al de un usuario existente, impidiendo la enumeración de cuentas institucionales por análisis estadístico de latencia.
- **Mensaje de Error Genérico:** Respuestas consistentes `401 Unauthorized: Credenciales inválidas.` ante errores de usuario o contraseña.

### 1.2. Flujo de Restablecimiento Seguro de Contraseñas
- Solicitud exclusiva mediante correo electrónico institucional (`@boyaca.gov.co`).
- Generación de token criptográfico aleatorio de alta entropía (`crypto.randomBytes(32).toString('hex')`).
- Almacenamiento seguro del token con función hash y marca de tiempo con **vigencia estricta de 24 horas**.
- Clave provisional con invalidación automática tras el primer uso e imposición de **cambio obligatorio de clave** en el siguiente inicio de sesión.

---

## 2. Gestión de Sesiones y Tokens JWT

- **Emisión Dual:** Emisión de token JWT firmado digitalmente mediante algoritmo `HS256` utilizando `JWT_SECRET`.
- **Protección contra Ataques XSS:**
  - El token se transmite como cookie HTTP con directivas `HttpOnly`, `SameSite=Lax` y `Path=/` (y flag `Secure` bajo HTTPS).
  - Al ser `HttpOnly`, el token no puede ser leído ni exfiltrado por scripts maliciosos ejecutados en el navegador.
- **Compatibilidad con Clientes de Red:** Los microservicios aceptan autenticación tanto por la cookie `talento360_token` como por la cabecera `Authorization: Bearer <token>`.
- **Tiempo de Expiración:** Configurado en 8 horas para coincidir con la jornada laboral institucional estándar, reduciendo el riesgo de sesiones huérfanas en equipos compartidos.

---

## 3. Modelo de Control de Acceso Basado en Roles (RBAC)

El acceso a cada microservicio está protegido por un middleware de autorización granular que valida los permisos del usuario independientemente de su nombre o cargo.

### Matriz de Permisos Transversales:

| Permiso Granular | Módulo / Operación | Administrador | Coordinador Talento | Analista Servidores | Analista Horarios | Analista Viáticos | Analista SST | Funcionario |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `employees:read` | Consultar planta y servidores | ✅ | ✅ | ✅ | ✅ *(Transversal)* | ✅ *(Transversal)* | ✅ *(Transversal)* | ❌ *(Propio)* |
| `employees:write`| Crear, editar o retirar funcionarios | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `horarios:read` | Consultar acuerdos de teletrabajo | ✅ | ✅ | ✅ *(Transversal)* | ✅ | ✅ *(Transversal)* | ✅ *(Transversal)* | ❌ *(Propio)* |
| `horarios:write` | Radicar y finalizar acuerdos horarios | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `viaticos:read` | Consultar históricos y comisiones | ✅ | ✅ | ✅ *(Transversal)* | ✅ *(Transversal)* | ✅ | ✅ *(Transversal)* | ❌ *(Propio)* |
| `viaticos:write` | Radicar comisiones e importar Excel | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `sst:read` | Consultar registros médicos y EPP | ✅ | ✅ | ✅ *(Transversal)* | ✅ *(Transversal)* | ✅ *(Transversal)* | ✅ | ❌ *(Propio)* |
| `sst:write` | Registrar fichas SST y entregas | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `system:admin` | Respaldos, errores y usuarios | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 4. Protección contra Inyección de Fórmulas en Excel (CWE-1236)

Para proteger a los analistas que descargan y abren reportes en Microsoft Excel o LibreOffice Calc:
- Toda exportación de datos a `.xlsx` o `.csv` pasa por una función de sanitización previa.
- Cualquier campo de texto que inicie con caracteres de ejecución de comandos o fórmulas (`=`, `+`, `-`, `@`, `\t`, `\r`) es prefijado con una comilla simple (`'`), neutralizando cualquier intento de inyección de código dinámico.

---

## 5. Integridad Referencial y Protección contra Eliminación en Cascada

Para cumplir con la normatividad de archivo de la gestión pública y evitar pérdidas accidentales de datos:
- Todas las restricciones de clave foránea entre tablas padre y tablas de movimientos están configuradas con **`ON DELETE RESTRICT`**.
- Ejemplo: Si un paquete presupuestal de viáticos tiene comisiones asociadas, PostgreSQL bloquea cualquier intento de eliminación con un error de integridad referencial, y el API devuelve un mensaje explicativo al usuario impidiendo la pérdida de trazabilidad.
- Los módulos de Horarios y Viáticos no crean personas sintéticas ni "stubs" para garantizar que el censo institucional de la Gobernación de Boyacá se mantenga 100% conciliado con la base de datos oficial.

---

## 6. Endurecimiento de Cabeceras HTTP (OWASP ASVS)

El proxy Nginx inyecta cabeceras de seguridad en todas las respuestas hacia el navegador:
- `X-Frame-Options: SAMEORIGIN` (Mitigación de Clickjacking).
- `X-Content-Type-Options: nosniff` (Mitigación de sniffing MIME).
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- `Content-Security-Policy`: Política de lista blanca estricta para scripts y hojas de estilo institucionales.
