# Talento 360 — Plataforma de Gestión de Talento Humano

Plataforma web institucional para la administración integral de servidores públicos de la **Gobernación de Boyacá**, solicitudes de vacaciones, trámites administrativos (permisos, incapacidades, licencias), comisiones de viáticos, modalidades de trabajo/horarios y gestión de **Seguridad y Salud en el Trabajo (SST)**. Desarrollada con arquitectura de microservicios en Node.js, base de datos relacional PostgreSQL y frontend SPA de alto rendimiento con diseño accesible (WCAG 2.1 AA).

---

## 🏛️ Módulos de la Plataforma

- **📊 Dashboard Integral:** Métricas ejecutivas, distribución por dependencias, alertas de solicitudes y exportación de reportes PDF/Excel.
- **👥 Directorio de Servidores Públicos:** Hoja de vida digital, historial de vinculaciones, cargos homologados (Ley 785 de 2005), registro de discapacidades y motor inteligente de importación/exportación masiva en Excel (XLSX).
- **🏖️ Gestión de Vacaciones:** Solicitud, cálculo automático de días hábiles y flujo de aprobación por talento humano.
- **📋 Trámites Administrativos:** Permisos laborales, incapacidades médicas con soporte documental y licencias remuneradas/no remuneradas/maternidad.
- **✈️ Comisiones y Viáticos:** Registro de resoluciones, anticipos, legalizaciones y tarifas departamentales.
- **⏰ Horarios y Modalidades:** Control de esquemas laborales (Presencial, Teletrabajo, Trabajo en Casa y Horario Flexible).
- **🦺 Seguridad y Salud en el Trabajo (SST):** Perfil epidemiológico y seguimiento a EMOs, matriz de entrega de Elementos de Protección Personal (EPP) y caracterización sociodemográfica de la planta.

---

## 🏗️ Arquitectura y Microservicios

| Servicio | Contenedor | Puerto Interno | Responsabilidad |
|---|---|---|---|
| **Frontend Gateway** | `talento360_frontend` | `80` | Servidor Nginx SPA y proxy inverso hacia los microservicios |
| **Auth Service** | `talento360_auth` | `3001` | Autenticación, JWT, roles y permisos de acceso |
| **Employees Service** | `talento360_employees` | `3002` | Servidores públicos, cargos, perfiles e importador masivo |
| **Requests Service** | `talento360_requests` | `3003` | Solicitudes y aprobaciones de vacaciones |
| **Admin Requests** | `talento360_admin_requests` | `3004` | Permisos, incapacidades y licencias |
| **Viáticos Service** | `talento360_viaticos` | `3005` | Comisiones de servicio, viáticos y legalizaciones |
| **Dashboard Service** | `talento360_dashboard` | `3006` | Agregación de KPIs y analítica institucional |
| **Horarios Service** | `talento360_horarios` | `3007` | Modalidades de trabajo y franjas horarias |
| **SST Service** | `talento360_sst` | `3008` | Perfil epidemiológico, EMO, EPP y sociodemográfico |
| **PostgreSQL** | `talento360_db` | `5432` | Base de datos relacional (esquemas `01_` a `10_`) |

> Para despliegues en la nube Serverless (Render / Netlify), el proyecto cuenta además con un **Backend Unificado / API Gateway** en `web/backend/server.js` y blueprint `render.yaml`. Consulta la [Guía de Despliegue en Netlify + Render](docs/DEPLOY_NETLIFY_RENDER.md).

---

## 📸 Vistas de la Aplicación

| Inicio de Sesión | Panel Principal (Dashboard) |
|:---:|:---:|
| ![Login](docs/screenshots/login.png) | ![Dashboard](docs/screenshots/dashboard.png) |

| Perfil del Servidor Público | Gestión de Vacaciones |
|:---:|:---:|
| ![Perfil](docs/screenshots/perfil.png) | ![Vacaciones](docs/screenshots/vacaciones.png) |

| Permisos Administrativos | Incapacidades Médicas |
|:---:|:---:|
| ![Permisos](docs/screenshots/permisos.png) | ![Incapacidades](docs/screenshots/incapacidades.png) |

| Licencias de Maternidad / Paternidad | Directorio de Dependencias |
|:---:|:---:|
| ![Licencias](docs/screenshots/licencia_maternidad.png) | ![Dependencias](docs/screenshots/dependencias.png) |

---

## 🎨 Identidad Institucional

Las normas de colorimetría departamental y recursos gráficos oficiales se encuentran documentados en [`docs/branding/`](docs/branding/README.md).

---

## 💻 Requisitos de Entorno Local

* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (con Docker Compose v2+)
* **[Git](https://git-scm.com/)**

---

## 🚀 Ejecutar desde Cero

### 1. Clonar el repositorio y entrar a la carpeta de ejecución
```bash
git clone https://github.com/juanSilvaE/talentoHumano360.git
cd talentoHumano360/web
```

### 2. Configurar variables de entorno (Solo la primera vez)
* **En Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
* **En Linux / macOS / Git Bash:**
  ```bash
  cp .env.example .env
  ```

### 3. Construir y levantar todos los contenedores
```bash
docker compose up --build -d
```
> Este comando crea la red interna, inicializa PostgreSQL ejecutando automáticamente los esquemas SQL (`01_schema.sql` a `10_sst_module.sql`), compila los microservicios y levanta el servidor web Nginx en segundo plano.

### 4. Abrir la aplicación
Ingresa en tu navegador web a:
👉 **[http://localhost](http://localhost)**

### 5. Iniciar sesión
Credenciales de administrador precargadas:

| Usuario / Alias | Contraseña | Rol |
|---|---|---|
| `admin` o `admin@boyaca.gov.co` | `admin123` | Administrador General |
| `angela.ussa` o `angela.ussa@boyaca.gov.co` | `@Angela123` | Directora de Talento Humano |

---

## 🔄 Flujo de Trabajo tras Modificaciones

### Cambios de Frontend (`.html`, `.css`, `.js`)
La carpeta `frontend/src/` está montada directamente como volumen. **No es necesario reconstruir contenedores.**
1. Guarda los cambios en tu editor.
2. Recarga en el navegador con limpieza de caché forzada: **`Ctrl + F5`** (o **`Cmd + Shift + R`** en Mac).

### Cambios en Microservicios (`services/`)
* **Recompilar todos los servicios:**
  ```bash
  docker compose up --build -d
  ```
* **Recompilar un solo servicio (ejemplo: `sst-service` o `employees-service`):**
  ```bash
  docker compose up --build -d sst-service
  ```

### Cambios en Nginx (`frontend/nginx.conf`)
```bash
docker compose restart frontend
```

### Reiniciar la Base de Datos desde Cero
> ⚠️ **Atención:** Este comando borrará los datos creados localmente y volverá a cargar las tablas y semillas originales.
```bash
docker compose down -v
docker compose up --build -d
```

---

## 🛠️ Comandos Principales

Todos estos comandos deben ejecutarse dentro de la carpeta `web/`:

| Acción | Comando |
|---|---|
| **Levantar todo en segundo plano** | `docker compose up -d` |
| **Recompilar y levantar tras cambios** | `docker compose up --build -d` |
| **Detener contenedores (manteniendo datos)** | `docker compose stop` |
| **Reanudar contenedores detenidos** | `docker compose start` |
| **Apagar y desmontar contenedores** | `docker compose down` |
| **Ver estado de los servicios** | `docker compose ps` |
| **Ver registros/logs en tiempo real** | `docker compose logs -f` |
| **Ver logs de un servicio puntual** | `docker compose logs -f <nombre-servicio>` |
