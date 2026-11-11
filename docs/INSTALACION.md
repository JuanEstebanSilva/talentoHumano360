# Guía de Instalación y Puesta en Marcha
## Talento 360 — Gobernación de Boyacá

Esta guía detalla los pasos requeridos para instalar y poner en funcionamiento la plataforma **Talento 360** desde cero en cualquier entorno compatible con Docker (Linux Ubuntu/Debian, Windows con WSL2 o macOS).

---

## 1. Requisitos Previos

### 1.1. Requisitos de Software
- **Docker Engine:** Versión 24.0.0 o superior ([Instrucciones oficiales](https://docs.docker.com/engine/install/)).
- **Docker Compose:** Plugin Compose v2.20.0 o superior (`docker compose version`).
- **Git:** Versión 2.30 o superior.
- **Node.js (Opcional):** Versión 18+ o 20+ solo si se desea ejecutar las suites de pruebas de diagnóstico directamente en el host.

### 1.2. Requisitos de Hardware Recomendados
| Componente | Mínimo (Pruebas / Desarrollo) | Recomendado (Producción Institucional) |
| :--- | :--- | :--- |
| **Procesador (CPU)** | 2 Núcleos (x86_64) | 4 Núcleos o superior |
| **Memoria RAM** | 4 GB | 8 GB o superior |
| **Almacenamiento** | 20 GB de espacio libre (SSD) | 50 GB de espacio libre (SSD NVMe) |
| **Red** | Conexión Ethernet / LAN local | Conexión Gigabit Ethernet con IP fija |

---

## 2. Clonación del Repositorio

Abre una terminal y clona el repositorio institucional en la ubicación deseada:

```bash
git clone https://github.com/JuanEstebanSilva/talentoHumano360.git talento360
cd talento360
```

---

## 3. Configuración de Variables de Entorno

El proyecto incluye plantillas con valores seguros predeterminados. Copia la plantilla oficial de variables:

```bash
# Copiar plantilla en la carpeta web (donde opera Docker Compose)
cp web/.env.example web/.env

# Si te encuentras en la raíz, también puedes inicializar .env en la raíz
cp .env.example .env
```

Abre `web/.env` con tu editor preferido (e.g. `nano web/.env`) y ajusta las variables de producción:
- `POSTGRES_PASSWORD`: Asigna una clave segura para la base de datos.
- `JWT_SECRET`: Genera una cadena aleatoria criptográfica de 64 caracteres (ejecuta `openssl rand -hex 32`).
- Configura las credenciales SMTP si deseas habilitar notificaciones de correo reales.

---

## 4. Construcción y Ejecución de Contenedores

Para compilar las imágenes e iniciar la arquitectura completa de microservicios:

```bash
cd web
docker compose up -d --build
```

El proceso descargará la imagen base oficial de PostgreSQL 16 Alpine, compilará los microservicios Node.js 20 y levantará el contenedor de Nginx. La primera inicialización ejecutará automáticamente todos los scripts de esquema y semillas ubicados en `database/`.

---

## 5. Verificación de Estado y Salud

Comprueba que los 10 contenedores se encuentren en estado `Up` y que PostgreSQL esté `healthy`:

```bash
docker compose ps
```

Salida esperada:
```text
NAME                        IMAGE               COMMAND                  SERVICE                 STATUS
talento360_admin_requests   web-admin-requests  "docker-entrypoint.s…"   admin-requests-service  Up
talento360_auth             web-auth            "docker-entrypoint.s…"   auth-service            Up
talento360_dashboard        web-dashboard       "docker-entrypoint.s…"   dashboard-service       Up
talento360_db               postgres:16-alpine  "docker-entrypoint.s…"   postgres                Up (healthy)
talento360_employees        web-employees       "docker-entrypoint.s…"   employees-service       Up
talento360_frontend         web-frontend        "/docker-entrypoint.…"   frontend                Up
talento360_horarios         web-horarios        "docker-entrypoint.s…"   horarios-service        Up
talento360_requests         web-requests        "docker-entrypoint.s…"   requests-service        Up
talento360_sst              web-sst             "docker-entrypoint.s…"   sst-service             Up
talento360_viaticos         web-viaticos        "docker-entrypoint.s…"   viaticos-service        Up
```

---

## 6. Acceso Inicial a la Plataforma

Una vez iniciados los contenedores:
1. Abre tu navegador web en: `http://localhost` (o `http://IP_DEL_SERVIDOR` si instalas en un servidor remoto).
2. Se desplegará la pantalla de autenticación oficial de **Talento 360**.
3. Credenciales administrativas institucionales preconfiguradas en semillas:
   - **Correo Electrónico:** `alejoleo2022@gmail.com`
   - **Contraseña Inicial:** `admin123` (El sistema solicitará su cambio obligatorio si aplica política de primera sesión).

---

## 7. Ejecución de Pruebas de Validación de la Instalación

Para validar que la instalación se completó satisfactoriamente y que los microservicios y la base de datos responden a todas las operaciones:

```bash
# Regresar a la raíz del proyecto
cd ..

# Ejecutar validación de permisos y operaciones RBAC
node tests/rbac_matrix.test.js

# Ejecutar validación de reglas de negocio y algoritmos de viáticos
node tests/viaticos_dates.test.js
```

Ambas pruebas deben finalizar con estado `PASS (100% SATISFACTORIO)`.
