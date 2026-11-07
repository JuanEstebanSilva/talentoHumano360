# Talento 360 — Plataforma de Gestión de Talento Humano

Plataforma web institucional para la administración integral del talento humano de la **Gobernación de Boyacá**. Diseñada para centralizar la gestión de servidores públicos, modalidades laborales flexibles, comisiones de viáticos, trámites administrativos, vacaciones y **Seguridad y Salud en el Trabajo (SST)**. 

Desarrollada con arquitectura de microservicios en **Node.js**, base de datos relacional **PostgreSQL**, frontend SPA de alto rendimiento con interfaz moderna, diseño accesible (WCAG 2.1 AA) y motor institucional de generación de informes ejecutivos en PDF.

---

## 🏛️ Módulos de la Plataforma

- **📊 Dashboard Integral y Analítico:**
  - Paneles adaptados por rol operativo (`admin`, `employees`, `viaticos`, `horarios`).
  - Métricas en tiempo real, distribución por secretarías/dependencias y control temporal.
  - Generador de informes ejecutivos en **PDF de alta resolución** (formato institucional estandarizado en 2 páginas completas, gráficos vectoriales, cabecera limpia *Talento 360* y espacio amplio para firmas físicas o digitales).

- **👥 Directorio de Servidores Públicos:**
  - Hoja de vida digital y administración completa de la planta institucional (personal activo, plazas vacantes por proveer y registro histórico de servidores retirados con motivo de desvinculación).
  - Flujo de reincorporación / revinculación a la planta.
  - Homologación de cargos y niveles jerárquicos (Directivo, Asesor, Profesional, Técnico, Asistencial).
  - Motor de importación masiva desde plantillas Excel (`.xlsx`) con validación de estructura y exportación de reportes.

- **⏰ Horarios y Modalidades Laborales:**
  - Registro, seguimiento y control de esquemas laborales concertados: **Teletrabajo**, **Trabajo en Casa** y **Horario Flexible**.
  - Importación masiva por Excel con soporte para `Fecha inicio` y `Fecha terminación` (esquemas de vigencia definida o indefinida).
  - Semáforo y alertas preventivas de vencimiento de resoluciones y acuerdos.

- **✈️ Comisiones y Viáticos:**
  - Radicación, liquidación y seguimiento de comisiones departamentales (123 municipios de Boyacá), nacionales y especiales.
  - Parametrización de escalas tarifarias departamentales por año fiscal (2024, 2025, 2026, 2027), pernoctadas y transporte.
  - Filtros dinámicos por vigencia/año y cargue masivo de históricos presupuestales.

- **🏖️ Gestión de Vacaciones y Novedades:**
  - Radicación de solicitudes de vacaciones ordinarias y compensadas.
  - Cálculo automático de días hábiles descontando fines de semana y festivos de Colombia.
  - Flujo de aprobación por talento humano y trazabilidad del estado.

- **📋 Trámites y Solicitudes Administrativas:**
  - Gestión de permisos laborales remunerados, licencias (maternidad, paternidad, luto, remuneradas y no remuneradas) e incapacidades médicas con soporte documental.

- **🦺 Seguridad y Salud en el Trabajo (SST):**
  - Vigilancia epidemiológica y seguimiento a Exámenes Médicos Ocupacionales (EMO).
  - Matriz de entrega y dotación de Elementos de Protección Personal (EPP).
  - Caracterización sociodemográfica de la planta institucional.

---

## 🏗️ Arquitectura y Microservicios

El sistema opera bajo un entorno desacoplado orquestado mediante **Docker Compose**:

| Servicio | Contenedor | Puerto Interno | Responsabilidad |
|---|---|---|---|
| **Frontend Gateway** | `talento360_frontend` | `80` | Servidor Nginx SPA, enrutamiento estático y reverse proxy hacia APIs |
| **Auth Service** | `talento360_auth` | `3001` | Autenticación JWT, control de sesiones, roles y permisos de acceso |
| **Employees Service** | `talento360_employees` | `3002` | Servidores públicos, planta de cargos, retiros e importador Excel |
| **Requests Service** | `talento360_requests` | `3003` | Solicitudes y aprobaciones de vacaciones |
| **Admin Requests** | `talento360_admin_requests` | `3004` | Permisos laborales, incapacidades médicas y licencias |
| **Viáticos Service** | `talento360_viaticos` | `3005` | Comisiones de servicio, liquidación de tarifas y legalizaciones |
| **Dashboard Service** | `talento360_dashboard` | `3006` | Agregación analítica de métricas y KPIs institucionales |
| **Horarios Service** | `talento360_horarios` | `3007` | Modalidades laborales (teletrabajo, trabajo en casa, flexible) |
| **SST Service** | `talento360_sst` | `3008` | Perfil epidemiológico, EMO, dotación EPP y sociodemográfico |
| **PostgreSQL Database** | `talento360_db` | `5432` | Base de datos relacional con esquemas modulares (`01_` a `10_`) |

> **Nota para despliegues Serverless (Render / Netlify):** El proyecto incluye además una arquitectura unificada en `web/backend/server.js` y blueprint `render.yaml`. Consulta la guía en [`docs/DEPLOY_NETLIFY_RENDER.md`](docs/DEPLOY_NETLIFY_RENDER.md).

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

La interfaz y los reportes generados respetan la paleta oficial y los lineamientos gráficos de la Gobernación de Boyacá:
- **Verde Boyacá Principal:** `#355833`
- **Verde Oscuro:** `#1C331A`
- **Amarillo Mostaza:** `#D1AD2A`
- **Rojo Bandera:** `#C42B1C`
- **Gris Pizarra / Neutro:** `#2D3748`

Para más detalles, consulta la documentación en [`docs/branding/`](docs/branding/README.md).

---

## 💻 Requisitos del Entorno

* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (con Docker Compose v2+)
* **[Git](https://git-scm.com/)**
* **Navegador web moderno** (Google Chrome, Microsoft Edge, Mozilla Firefox o Safari)

---

## 🚀 Despliegue y Ejecución Local

### 1. Clonar el repositorio y acceder a la carpeta de despliegue
```bash
git clone https://github.com/JuanEstebanSilva/talentoHumano360.git
cd talentoHumano360/web
```

### 2. Configurar variables de entorno
* **En Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
* **En Linux / macOS / Git Bash:**
  ```bash
  cp .env.example .env
  ```

### 3. Construir e iniciar los contenedores
```bash
docker compose up --build -d
```
> Este comando inicializa la red interna, levanta la base de datos PostgreSQL cargando automáticamente todos los esquemas (`01_schema.sql` a `10_sst_module.sql`), compila los microservicios e inicia el servidor web Nginx.

### 4. Acceder al sistema
Abre tu navegador e ingresa a:
👉 **[http://localhost](http://localhost)**

---

## 🔑 Credenciales de Acceso

La plataforma cuenta con usuarios precargados según su rol operativo:

| Usuario / Correo | Contraseña | Perfil / Área de Gestión | Módulos Autorizados |
|---|---|---|---|
| `admin` / `admin@boyaca.gov.co` | `admin` | **Administrador Técnico del Sistema** | Centro de errores, copias de seguridad de la plataforma y ajustes |
| `angela.ussa` / `angela.ussa@boyaca.gov.co` | `@Angela123` | **Dirección de Talento Humano** | Servidores públicos, planta de personal y reportes |
| `blanca.soler` / `blanca.soler@boyaca.gov.co` | `@Blanca123` | **Gestión de Servidores Públicos** | Servidores públicos, cargos y novedades de personal |
| `doris.canon` / `doris.canon@boyaca.gov.co` | `@Doris123` | **Control de Horarios y Modalidades** | Teletrabajo, trabajo en casa, horarios flexibles |
| `bergenet.gutierrez` / `bergenet.gutierrez@boyaca.gov.co` | `@Bergenet123` | **Gestión de Viáticos y Comisiones** | Resoluciones de viáticos, liquidación y destinos |

---

## 🛠️ Panel del Administrador del Sistema

El rol de Administrador Técnico (`admin`) cuenta con un entorno dedicado y enfocado exclusivamente en la estabilidad, continuidad e infraestructura de la plataforma:

1. **Centro de Monitoreo de Errores e Incidentes:**
   * **Captura automática de excepciones:** Escucha y registra errores de consola (`console.error`), excepciones de scripts de cliente (`window.onerror`), promesas no capturadas y fallos de microservicios.
   * **Detección y reporte de 404:** Cuando un usuario intenta acceder a una ruta inexistente, el sistema registra el evento y ofrece en la vista un botón interactivo **"Reportar"** para alertar al equipo técnico.
   * **Gestión técnica:** Vista con KPIs en tiempo real (pendientes, resueltos, 404, consola, API), filtrado por tipo/estado, visor modal de stack trace completo y cambio de estado a *Resuelto*.
2. **Copias de Seguridad Integrales (Backups):**
   * **Respaldo bajo demanda (manual):** Generación instantánea de volcados SQL nativos con integridad transaccional (`BEGIN...COMMIT`) de las 27 tablas y más de 18.000 registros de la entidad.
   * **Descarga flexible a disco o memoria USB:** Permite guardar el archivo `.sql` en cualquier directorio local o dispositivo externo.
   * **Programación automática diaria:** Motor programador continuo que genera respaldos diarios a la hora configurada (por defecto 23:00) con políticas de retención automática para optimizar almacenamiento.
3. **Aislamiento Seguro por Roles:**
   * El panel de administración oculta todos los módulos de gestión de talento humano que no conciernen a infraestructura.
   * Las rutas y endpoints de errores y copias de seguridad están estrictamente restringidos y devuelven `403 Forbidden` a usuarios operativos.

---

## 🔄 Mantenimiento y Comandos Frecuentes

Todos los comandos deben ejecutarse dentro de la carpeta `web/`:

| Acción | Comando |
|---|---|
| **Levantar contenedores en segundo plano** | `docker compose up -d` |
| **Recompilar y levantar tras cambios de código** | `docker compose up --build -d` |
| **Recompilar un microservicio específico** | `docker compose up --build -d <nombre-servicio>` |
| **Detener contenedores (preservando datos)** | `docker compose stop` |
| **Reanudar contenedores detenidos** | `docker compose start` |
| **Apagar y desmontar contenedores** | `docker compose down` |
| **Ver estado y salud de los contenedores** | `docker compose ps` |
| **Monitorear logs en tiempo real** | `docker compose logs -f` |
| **Monitorear logs de un microservicio puntual** | `docker compose logs -f <nombre-servicio>` |
| **Reiniciar base de datos desde cero (recarga de datos)** | `docker compose down -v && docker compose up --build -d` |

### Flujo de desarrollo en Frontend (`frontend/src/`)
Los archivos del frontend se encuentran vinculados como volumen directo en el contenedor Nginx. Los cambios en archivos `.html`, `.css` y `.js` se reflejan de inmediato al recargar el navegador con limpieza de caché forzada (**`Ctrl + F5`** o **`Cmd + Shift + R`**).

---

## 📄 Licencia y Uso Institucional

Desarrollado para la **Gobernación de Boyacá** — Subdirección de Talento Humano.  
Todos los derechos reservados © 2026.
