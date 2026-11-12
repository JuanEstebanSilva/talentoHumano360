# Despliegue Automático Cloud — Talento 360 (GitHub + Vercel + Render + Neon PostgreSQL)

Guía técnica de operación, despliegue continuo (`CI/CD`) y **protección absoluta de la base de datos institucional** para la plataforma **Talento 360 — Dirección de Talento Humano, Gobernación de Boyacá**.

---

## 1. Arquitectura General

| Capa | Plataforma | Raíz / Configuración | Rama de Producción |
|---|---|---|---|
| **Control de código y CI/CD** | GitHub (`JuanEstebanSilva/talentoHumano360`) | Raíz del repositorio | `main` |
| **Frontend estático (HTML/CSS/JS)** | Vercel | `vercel.json` → `web/frontend/src` | `main` |
| **Backend unificado (API Gateway + 8 servicios Express)** | Render | `render.yaml` → `package.json` (`npm start` → `web/backend/server.js`) | `main` |
| **Base de datos PostgreSQL persistente** | Neon PostgreSQL | Conexión TLS (`sslmode=require`) | N/A (persistente) |
| **Despliegue On-Premise / LAN (alternativo)** | Docker Compose + Nginx | `web/docker-compose.yml` + `web/nginx.conf` | — |

### Comportamiento del `git push` a `main`

1. Un `git push origin main` dispara automáticamente:
   - **Vercel:** ejecuta `node scripts/build-frontend-env.js`, inyecta la variable pública `API_BASE_URL` en `web/frontend/src/js/env.js` y publica `web/frontend/src` mediante `vercel.json`.
   - **Render:** ejecuta `npm install` y reinicia `npm start` (`web/backend/server.js`) escuchando en `process.env.PORT`.
2. Los despliegues **NO** recrean, truncan ni sobrescriben la base de datos en **Neon**.

---

## 2. Regla de Protección Absoluta de la Base de Datos

> **NUNCA se debe ejecutar `DROP`, `TRUNCATE`, `DELETE` masivo ni restablecimiento de usuarios/contraseñas en un despliegue de código.**

Protecciones implementadas en `web/backend/scripts/init-db.js` y `web/backend/server.js`:

1. **`AUTO_INIT_DB=false` en producción:** El arranque de `server.js` no ejecuta inicialización destructiva; verifica conectividad (`SELECT 1`) y opcionalmente aplica solo migraciones aditivas seguras si se invoca `npm run db:migrate`.
2. **Detección de esquema existente:** Si la base de datos ya contiene tablas en el esquema `public`, `init-db.js` **prohíbe** ejecutar scripts de bootstrap (`01_schema.sql` u otros scripts de semilla/limpieza), incluso si se invocara con `--force` en `NODE_ENV=production`.
3. **Exclusión de reinicio de usuarios y datos:** El script `15_user_roles_permissions.sql` y sentencias de limpieza de pruebas quedan excluidos de los flujos de arranque/migración en la nube.
4. **Historial de migraciones aditivas:** Las migraciones aditivas idempotentes se registran en la tabla `schema_migrations` (`npm run db:migrate` / `npm run db:status`).
5. **Discos efímeros en Render:** El plan gratuito de Render reinicia el sistema de archivos local en cada deploy o suspensión. La persistencia real vive en **Neon PostgreSQL**; los respaldos locales de disco no sustituyen los respaldos/branches de Neon ni `pg_dump` externo.

---

## 3. Variables de Entorno por Plataforma

### 3.1. Vercel (Frontend)

| Variable | Visibilidad | Ejemplo / Descripción |
|---|---|---|
| `API_BASE_URL` | Pública (compilada en `env.js`) | URL pública del backend en Render, ej. `https://talento360-backend.onrender.com` (sin `/` final). |

> **Seguridad:** Nunca configures secretos (`JWT_SECRET`, `DATABASE_URL`, `SMTP_PASS`) en Vercel. `scripts/build-frontend-env.js` únicamente acepta una URL `http://` o `https://` válida.

### 3.2. Render (Backend)

| Variable | Requerida | Descripción |
|---|---|---|
| `NODE_ENV` | Sí | `production` |
| `PORT` | Automática | Asignada por Render (Blueprint define `3000` como respaldo). |
| `DATABASE_URL` | Sí | Cadena **Pooled** (`-pooler`) de Neon con `?sslmode=require`. |
| `JWT_SECRET` | Sí | Secreto largo y único generado en Render. |
| `JWT_EXPIRES_IN` | Sí | `8h` |
| `AUTO_INIT_DB` | Sí | `false` (mantener así permanentemente en producción). |
| `ALLOWED_ORIGINS` | Sí | Orígenes permitidos separados por coma, ej. `https://TU-PROYECTO.vercel.app`. |
| `ALLOW_VERCEL_PREVIEWS` | Opcional | `true` si deseas permitir despliegues Preview `*.vercel.app`; `false` para restringir estrictamente a `ALLOWED_ORIGINS`. |
| `APP_PUBLIC_URL` | Sí | URL pública de Vercel, ej. `https://TU-PROYECTO.vercel.app`. |
| `APP_URL` | Sí | Misma URL pública de Vercel (compatibilidad de enlaces en correos). |
| `BACKEND_PUBLIC_URL` | Recomendada | URL pública de Render, ej. `https://talento360-backend.onrender.com` (usada en enlaces directos de aprobación por correo). |
| `MAIL_ENABLED` | Sí | `true` |
| `SMTP_HOST` | Sí | `smtp.gmail.com` |
| `SMTP_PORT` | Sí | `465` |
| `SMTP_SECURE` | Sí | `true` |
| `SMTP_USER` | Sí | Correo emisor institucional (Gmail). |
| `SMTP_PASS` | Sí | **Contraseña de aplicación** de 16 caracteres de Google (no la contraseña normal). |
| `MAIL_FROM` | Sí | Ej. `Talento 360 - Gobernación de Boyacá <correo@gmail.com>`. |

---

## 4. Inicialización Segura de Neon (Solo Primera Vez)

### Caso A: Base de datos Neon nueva sin datos previos

1. Configura temporalmente `DATABASE_URL` (o `DIRECT_URL`) desde un entorno seguro local o durante el primer arranque controlado con:
   - Opción CLI recomendada (sin reiniciar en cada deploy):
     ```bash
     DIRECT_URL="postgresql://..." ALLOW_INITIAL_DB_BOOTSTRAP=true node web/backend/scripts/init-db.js
     ```
   - Opción temporal desde Render (únicamente si la BD tiene 0 tablas): definir `AUTO_INIT_DB=true` y `ALLOW_INITIAL_DB_BOOTSTRAP=true` en el primer arranque, verificar que `init-db.js` creó las tablas, y cambiar **inmediatamente** `AUTO_INIT_DB=false` y eliminar `ALLOW_INITIAL_DB_BOOTSTRAP`.

### Caso B: Base de datos institucional existente (Migración desde otro PostgreSQL)

1. Genera un respaldo lógico desde el servidor de origen:
   ```bash
   pg_dump --format=custom --no-owner --no-acl -h HOST_ORIGEN -U postgres -d talento360 -f talento360_prod.dump
   ```
2. Restaura en Neon usando la cadena **Direct** (`DIRECT_URL`, sin `-pooler`):
   ```bash
   pg_restore --no-owner --no-acl --dbname="postgresql://...ep-direct...neon.tech/neondb?sslmode=require" talento360_prod.dump
   ```
3. Verifica que las tablas y conteos de filas existan y ejecuta solo migraciones aditivas si faltara alguna columna/tabla reciente:
   ```bash
   DIRECT_URL="postgresql://..." npm run db:status
   DIRECT_URL="postgresql://..." npm run db:migrate
   ```
4. Mantén `AUTO_INIT_DB=false` en Render.

---

## 5. Flujo Seguro para Migraciones Futuras y Respaldos

### Aplicar cambios de esquema sin perder datos

1. Crea un script SQL **exclusivamente aditivo e idempotente** (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) en `database/` o intégralo en `runSafeMigrations` de `web/backend/scripts/init-db.js`.
2. Crea primero un **Branch** o snapshot preventivo en Neon desde la consola antes de aplicar cambios estructurales.
3. Ejecuta `DIRECT_URL="..." npm run db:migrate` y verifica con `npm run db:status`.

### Respaldos y Rollback

- **Código (Vercel y Render):** ambas plataformas mantienen historial de despliegues previos y permiten hacer **Rollback** instantáneo a cualquier commit anterior en `main`.
- **Base de datos (Neon):** respaldar antes de cambios críticos con `pg_dump` usando la cadena **Direct**:
  ```bash
  pg_dump --no-owner --no-acl "postgresql://...ep-direct...neon.tech/neondb?sslmode=require" > backup_neon_$(date +%Y%m%d).sql
  ```

---

## 6. Verificación Post-Despliegue

1. `GET https://TU-BACKEND.onrender.com/health` → debe responder HTTP `200` con `{ "status": "ok", ... }`.
2. `GET https://TU-BACKEND.onrender.com/api/db-status` → debe responder `{ "status": "connected", ... }`.
3. Abrir `https://TU-FRONTEND.vercel.app` → confirmar en DevTools Network/Console que no existen errores de CORS ni peticiones a `localhost` o `netlify`.
4. Verificar login, recuperación de contraseña por correo, creación/edición en módulos, filtros, exportaciones Excel/PDF y descarga autenticada de soportes.
5. Realizar un commit inocuo en `main` y confirmar que Vercel y Render se actualizan sin alterar el conteo de registros en Neon.
