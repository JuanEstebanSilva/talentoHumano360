# Guía de Configuración del Sistema
## Talento 360 — Gobernación de Boyacá

Este documento describe detalladamente todos los parámetros de configuración, variables de entorno, ajustes de red y personalización de servicios para la plataforma **Talento 360**.

---

## 1. Archivo de Variables de Entorno (`.env`)

El archivo `.env` ubicado en `web/.env` es el punto central de parametrización para Docker Compose y todos los microservicios.

### 1.1. Configuración de Entorno y Servidor
| Variable | Descripción | Valor por Defecto | Consideración en Producción |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Entorno de ejecución (`development`, `production`, `test`) | `development` | Cambiar obligatoriamente a `production`. |
| `APP_PUBLIC_URL` | URL base accesible por los usuarios para enlaces en correos | `http://localhost` | Indicar IP del servidor o dominio institucional (e.g. `http://192.168.1.100` o `https://talento360.boyaca.gov.co`). |
| `ALLOWED_ORIGINS` | Orígenes autorizados en políticas CORS (separados por coma) | `http://localhost,http://127.0.0.1` | Incluir los dominios o IPs autorizados de la intranet institucional. |

### 1.2. Configuración de PostgreSQL
| Variable | Descripción | Valor por Defecto | Recomendación de Seguridad |
| :--- | :--- | :--- | :--- |
| `POSTGRES_DB` | Nombre de la base de datos institucional | `talento360` | Mantener para consistencia con scripts de migración. |
| `POSTGRES_USER` | Usuario administrador del motor de BD | `postgres` | Usuario estándar del motor. |
| `POSTGRES_PASSWORD` | Contraseña maestra de la base de datos | `admin123` | **Crítico:** Cambiar por una clave de mínimo 16 caracteres alfanuméricos con símbolos. |
| `POSTGRES_PORT_BINDING`| Mapeo del puerto de PostgreSQL al host | `127.0.0.1:5432:5432` | En producción pura en servidor dedicado, aislar dejando el puerto únicamente interno dentro de la red Docker (`talento360_net`). |

### 1.3. Seguridad y Tokens Criptográficos (JWT)
| Variable | Descripción | Valor por Defecto | Recomendación |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | Llave secreta para firma y verificación de tokens | `talento360_secret_2026` | **Crítico:** Generar una clave criptográfica de al menos 64 caracteres mediante `openssl rand -hex 32`. Los microservicios abortarán el arranque en producción si la clave no cumple con la longitud mínima requerida. |
| `JWT_EXPIRES_IN` | Tiempo de vida del token de sesión | `8h` | 8 horas cubre la jornada laboral institucional estándar. |
| `COOKIE_SECURE` | Flag `Secure` en cookies HTTP de sesión | `false` | Establecer en `true` cuando se implemente certificado SSL/TLS con HTTPS. |
| `COOKIE_SAME_SITE`| Política SameSite para cookies de sesión | `Lax` | `Lax` ofrece equilibrio óptimo entre seguridad CSRF y navegación interna. |

### 1.4. Servicio de Correo Electrónico (SMTP)
| Variable | Descripción | Ejemplo de Configuración |
| :--- | :--- | :--- |
| `MAIL_ENABLED` | Habilitar envíos de correo reales (`true`/`false`) | `true` |
| `SMTP_HOST` | Dirección del servidor SMTP institucional | `smtp.gmail.com` / `smtp.office365.com` |
| `SMTP_PORT` | Puerto de conexión SMTP | `587` (STARTTLS) o `465` (SSL) |
| `SMTP_SECURE` | Usar SSL directo | `false` para puerto 587, `true` para 465 |
| `SMTP_USER` | Correo de la cuenta de notificaciones | `talento360.notificaciones@gmail.com` |
| `SMTP_PASS` | Contraseña de aplicación generada | Contraseña de 16 caracteres para Gmail o App Secret |
| `MAIL_FROM` | Nombre y remitente visible del mensaje | `Talento 360 — Gobernación de Boyacá <talento360.notificaciones@gmail.com>` |
| `MAIL_REDIRECT_TO` | Buzón para desvío de pruebas (Opcional) | `auditoria@boyaca.gov.co` (Deja vacío en producción) |

---

## 2. Configuración de Nginx y Gateway (`web/frontend/nginx.conf`)

El archivo de configuración de Nginx gestiona:
- **Límite de Subida de Archivos:** `client_max_body_size 50M;` (permite la carga de resoluciones escaneadas en PDF y archivos masivos de nómina en Excel).
- **Timeouts de Operación:** `proxy_read_timeout 180s;` (previene desconexiones durante importaciones voluminosas de datos históricos).
- **Cabeceras de Seguridad:** Implementa CSP, HSTS opcional, X-Frame-Options SAMEORIGIN y X-Content-Type-Options nosniff.
- **Rutas de Microservicios:**
  ```nginx
  location /api/auth/           { proxy_pass http://auth-service:3001/; }
  location /api/employees/      { proxy_pass http://employees-service:3002/; }
  location /api/requests/       { proxy_pass http://requests-service:3003/; }
  location /api/admin-requests/ { proxy_pass http://admin-requests-service:3004/; }
  location /api/viaticos/       { proxy_pass http://viaticos-service:3005/; }
  location /api/dashboard/      { proxy_pass http://dashboard-service:3006/; }
  location /api/horarios/       { proxy_pass http://horarios-service:3007/; }
  location /api/sst/            { proxy_pass http://sst-service:3008/; }
  ```
