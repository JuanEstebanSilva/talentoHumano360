# 🚀 Guía de Despliegue: Talento 360 en Netlify + Render

Esta guía explica paso a paso cómo poner en línea **Talento 360** utilizando **Netlify** para el Frontend (SPA estática) y **Render** para el Backend (Node.js API Gateway + PostgreSQL).

---

## 📐 Arquitectura del Despliegue

```
                       ┌────────────────────────────────┐
                       │           USUARIOS             │
                       └──────────────┬─────────────────┘
                                      │
                                      ▼
                       ┌────────────────────────────────┐
                       │     NETLIFY (Frontend SPA)     │
                       │  https://talento360.netlify.app │
                       └──────────────┬─────────────────┘
                                      │ fetch('/api/...')
                                      ▼
                       ┌────────────────────────────────┐
                       │      RENDER (API Gateway)      │
                       │ https://talento360.onrender.com│
                       └──────────────┬─────────────────┘
                                      │ PostgreSQL Pool
                                      ▼
                       ┌────────────────────────────────┐
                       │   RENDER / SUPABASE POSTGRES   │
                       │       (Base de Datos)          │
                       └────────────────────────────────┘
```

---

## PASO 1: Subir los cambios a GitHub

Abre tu terminal en la raíz del proyecto y ejecuta:

```powershell
git add .
git commit -m "feat: configuracion para despliegue en Netlify y Render"
git push origin main
```

---

## PASO 2: Desplegar Base de Datos y Backend en Render (Gratis)

### Opción A — Despliegue Rápido con Blueprint (Recomendado, 1 Clic)

Render incluye soporte para el archivo `render.yaml` que ya configuramos en tu proyecto:

1. Ingresa a **[dashboard.render.com](https://dashboard.render.com/)** e inicia sesión con tu cuenta de GitHub.
2. En el panel principal, haz clic en el botón **New +** y selecciona **Blueprint**.
3. Conecta tu repositorio `juanSilvaE/talentoHumano360`.
4. Render leerá automáticamente el archivo `render.yaml` y te mostrará:
   - Base de datos PostgreSQL: `talento360-db` (Plan Free).
   - Servicio Web: `talento360-backend` (Plan Free).
5. Haz clic en **Apply**.
6. Render creará la base de datos y levantará el backend.
7. Al arrancar por primera vez, el backend **inicializará automáticamente** todas las tablas (`01_schema.sql` a `10_sst_module.sql`) sin que tengas que hacer nada más.
8. Copia la URL de tu servicio web generado por Render (por ejemplo: `https://talento360-backend.onrender.com`).

---

### Opción B — Despliegue Manual en Render (Paso a Paso)

Si prefieres crearlos individualmente:

#### 2.1 Crear la Base de Datos PostgreSQL
1. En Render Dashboard, haz clic en **New +** > **PostgreSQL**.
2. Nombre: `talento360-db`.
3. Database: `talento360`.
4. User: `postgres`.
5. Plan: **Free**.
6. Haz clic en **Create Database**.
7. Una vez creada, copia el valor de **Internal Database URL** (o External Database URL si vas a conectar desde fuera).

#### 2.2 Crear el Web Service del Backend
1. En Render Dashboard, haz clic en **New +** > **Web Service**.
2. Conecta tu repositorio de GitHub.
3. Configura los siguientes campos:
   - **Name**: `talento360-backend`
   - **Runtime**: `Node` (o `Docker`)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
4. En la sección **Environment Variables**, añade:
   - `DATABASE_URL` = *(Pega la Internal Database URL que copiaste en el paso 2.1)*
   - `JWT_SECRET` = `talento360_secret_produccion_2026`
   - `JWT_EXPIRES_IN` = `8h`
5. Haz clic en **Create Web Service**.
6. Una vez desplegado, copia la URL pública de tu backend (ejemplo: `https://talento360-backend.onrender.com`).

---

## PASO 3: Desplegar el Frontend en Netlify

1. Ingresa a **[app.netlify.com](https://app.netlify.com/)** e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **Add new site** > **Import an existing project**.
3. Selecciona **GitHub** y busca tu repositorio `juanSilvaE/talentoHumano360`.
4. Netlify detectará automáticamente el archivo `netlify.toml` que ya dejamos listo:
   - **Base directory**: *(dejar vacío)*
   - **Build command**: *(dejar vacío)*
   - **Publish directory**: `web/frontend/src`
5. Haz clic en **Deploy site**.
6. En pocos segundos tendrás tu URL pública de Netlify (ejemplo: `https://talento360-boyaca.netlify.app`).

---

## PASO 4: Conectar el Frontend con el Backend

Tienes **dos formas** sencillas de indicarle al frontend cuál es la URL del backend en Render:

### Método 1 (El más directo y definitivo):
Abre en tu editor el archivo `web/frontend/src/js/config.js` y coloca tu URL de Render:

```javascript
window.TALENTO360_API_URL = 'https://talento360-backend.onrender.com';
```

Guarda, haz `git commit` y `git push`:
```powershell
git add web/frontend/src/js/config.js
git commit -m "fix: configurar URL de backend en produccion"
git push origin main
```
Netlify actualizará tu sitio automáticamente en menos de 1 minuto.

---

### Método 2 (Instantáneo desde la consola del navegador):
Abre tu sitio en Netlify, presiona `F12` (Herramientas de Desarrollador), ve a la pestaña **Console** y ejecuta:

```javascript
localStorage.setItem('TALENTO360_API_URL', 'https://talento360-backend.onrender.com');
location.reload();
```

¡Listo! Tu frontend quedará enlazado al backend de Render inmediatamente en ese navegador sin esperar un nuevo deploy.

---

## PASO 5: Iniciar Sesión en Producción

Ingresa a la URL de Netlify e inicia sesión con cualquiera de los administradores preconfigurados:

| Usuario / Correo | Contraseña | Rol |
|---|---|---|
| `admin` o `admin@boyaca.gov.co` | `admin123` | Administrador General |
| `angela.ussa` o `angela.ussa@boyaca.gov.co` | `@Angela123` | Directora de Talento Humano |

---

## ℹ️ Notas Importantes sobre el Plan Gratuito de Render

- **Inactividad (Spin down):** En el plan Free de Render, si no hay visitas durante 15 minutos, el servidor se "duerme". Al recibir una nueva visita, puede demorar entre **30 y 50 segundos** en despertar. Una vez despierto, funciona a velocidad normal.
- **Base de Datos:** El plan gratuito de PostgreSQL en Render incluye 1 GB de almacenamiento, suficiente para miles de funcionarios y registros.
