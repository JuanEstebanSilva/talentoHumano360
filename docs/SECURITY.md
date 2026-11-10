# Manual de Seguridad y Endurecimiento — Talento 360

Este documento detalla la arquitectura de seguridad, políticas criptográficas, directrices de despliegue y procedimientos operativos seguros para la plataforma **Talento 360** (Gobernación de Boyacá).

---

## 1. Política de Contraseñas y Criptografía

* **Algoritmo de Hashing:** Bcrypt (`bcryptjs`) con factor de coste salino **12** (4096 iteraciones de estiramiento de clave).
* **Almacenamiento:** Ninguna contraseña se almacena ni compara en texto plano.
* **Mitigación de Enumeración y Ataques de Temporización:**
  * Si un usuario no existe o la contraseña es incorrecta, el sistema devuelve un error genérico `401: Credenciales inválidas.`.
  * Se ejecuta una comparación criptográfica simulada con hash precomputado (`DUMMY_HASH`) cuando el usuario no existe para igualar los tiempos de respuesta del servidor (mitigación de *timing attacks*).
* **Longitud Mínima:** La actualización de contraseña exige un mínimo de 8 caracteres alfanuméricos.
* **Migración Automática:** Las cuentas heredadas se actualizan a hash bcrypt de forma transparente al iniciar sesión o mediante el script idempotente `database/14_hash_passwords_migration.js`.

---

## 2. Gestión de Sesiones y Tokens JWT

* **Almacenamiento de Sesión:**
  * Se emite una cookie segura `talento360_token` con atributos `HttpOnly; SameSite=Lax` (y `Secure` en producción bajo HTTPS).
  * La cookie `HttpOnly` impide el acceso al token mediante scripts del navegador, neutralizando ataques de exfiltración vía XSS.
* **Compatibilidad Dual:** Todos los microservicios aceptan autenticación tanto por cabecera `Authorization: Bearer <token>` como por cookie `talento360_token`.
* **Expiración de Sesión:** Configurada por defecto en 8 horas (`JWT_EXPIRES_IN=8h`).

---

## 3. Endurecimiento de Nginx y Cabeceras HTTP (OWASP ASVS)

El proxy inverso Nginx (`web/frontend/nginx.conf`) implementa las siguientes directivas de protección:

| Cabecera / Directiva | Valor | Propósito de Seguridad |
| :--- | :--- | :--- |
| `server_tokens` | `off` | Oculta la versión exacta de Nginx para mitigar fingerprinting. |
| `X-Frame-Options` | `SAMEORIGIN` | Previene ataques de Clickjacking. |
| `X-Content-Type-Options` | `nosniff` | Impide que el navegador interprete archivos con tipos MIME incorrectos. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Protege URLs internas en enlaces externos. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Bloquea el acceso a hardware sensible del dispositivo. |
| `Content-Security-Policy` | Restricción por lista blanca | Permite scripts y estilos únicamente de `'self'` y CDNs institucionales (`cdn.jsdelivr.net`, `fonts.googleapis.com`). |

---

## 4. Protección contra Fuerza Bruta y DoS (Rate Limiting)

* **Nginx Gateway:**
  * Endpoint `/api/auth/login`: Límite estricto de **10 peticiones/minuto** por IP (`zone=auth_limit:10m rate=10r/m burst=5 nodelay`).
  * Endpoints Generales: Límite de **30 peticiones/segundo** por IP (`zone=api_general:10m rate=30r/s burst=30 nodelay`).
* **Express Auth Service:**
  * Capa de defensa secundaria con `express-rate-limit` limitando a 10 intentos cada 15 minutos en `/api/auth/login`.

---

## 5. Prevención de Cross-Site Scripting (XSS) y Validación de Adjuntos

* **Escape Sistemático del DOM:** Todos los campos dinámicos provenientes de base de datos (`persona`, `radicado`, `dependencia`, `destino`, `observaciones`, etc.) se escapan mediante `escHtml(...)` antes de su inserción en plantillas HTML.
* **Filtro Estricto de Protocolos para Adjuntos (`viewSoporte`):**
  * Solo se admiten formatos MIME seguros: `data:image/(png|jpeg|webp);base64,...`, `data:application/pdf;base64,...` o URLs que comiencen estrictamente por `https://`.
  * Se bloquean esquemas peligrosos (`javascript:`, `data:text/html`, `vbscript:`).
  * Los visualizadores `iframe` de PDF incluyen el atributo restrictivo `sandbox="allow-scripts allow-same-origin"`.

---

## 6. Erradicación de Endpoints Destructivos

* El endpoint `/api/admin/init-db` ha sido completamente eliminado del código de backend y bloqueado con regla `404 Not Found` en Nginx.
* La inicialización de base de datos solo puede ejecutarse de forma deliberada por consola CLI interna:
  ```bash
  npm run db:init
  ```

---

## 7. Despliegue en Render y Gestión de Secretos

* **Render Blueprint (`render.yaml`):**
  * Se eliminaron todas las credenciales de base de datos en texto plano.
  * La variable `DATABASE_URL` está configurada con `sync: false`, lo que obliga a definirla de forma segura en las variables de entorno privadas del Dashboard de Render.
* **Rotación Pendiente Obligatoria:** La contraseña de base de datos expuesta previamente en la configuración de Render (`[REDACTADA_EN_REPOSITORIO]`) debe ser rotada de inmediato desde la consola administrativa de Render.

---

## 8. Cumplimiento de Datos Personales y SST (Ley 1581 de 2012)

* Los módulos de Seguridad y Salud en el Trabajo (SST) procesan datos catalogados como sensibles (historias clínicas ocupacionales, restricciones laborales, diagnósticos EMO).
* Todo acceso de modificación o exportación requiere perfil administrativo (`Administrador` o `Coordinador`).
* Se recomienda implementar auditoría inmutable de accesos en el SIEM institucional para las consultas del sub-módulo epidemiológico.
