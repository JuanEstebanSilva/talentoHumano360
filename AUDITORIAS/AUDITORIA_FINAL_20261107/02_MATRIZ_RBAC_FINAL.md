# 02. MATRIZ DEFINITIVA DE CONTROL DE ACCESO (RBAC) FINAL
## Resultados de Verificación de Permisos Institucionales — Gobernación de Boyacá

---

### 1. MODELO INSTITUCIONAL OFICIAL DE TALENTO 360

La Gobernación de Boyacá definió un esquema de seguridad basado en **visión operativa compartida con segregación estricta de responsabilidades de mutación**:
1. **Administrador (`admin`):** Acceso integral y absoluto (`CRUD`) en todos los módulos de la plataforma, administración de usuarios, auditoría del sistema y copias de seguridad.
2. **Funcionarias de Talento Humano (`angela.ussa`, `blanca.soler`, `doris.canon`, `bergenet.gutierrez`):**
   - **Permiso de Escritura / Mutación (`CRUD`):** Confinado exclusivamente al módulo funcional asignado a su cargo.
   - **Permiso de Lectura / Auditoría (`VER`):** **Transversal e irrestricto** sobre los tres módulos principales (`Servidores Públicos`, `Horarios` y `Viáticos`) para facilitar la consulta de expedientes, acuerdos y comisiones entre dependencias.

---

### 2. MATRIZ DEFINITIVA: MANDATO INSTITUCIONAL VS. ESTADO REAL COMPROBADO

A continuación se presenta el contraste verificado mediante llamadas HTTP automatizadas contra el entorno productivo en vivo:

| Cuenta / Usuario | Servidores Públicos | Horarios Laborales | Viáticos Institucionales | Administración Global / Backups |
|---|:---:|:---:|:---:|:---:|
| **`admin`** | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **TOTAL**<br>Real: **TOTAL (200)** |
| **`angela.ussa`** | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **VER**<br>Real: **VER (200)** ✅ | Mandato: **VER**<br>Real: **VER (200)** ✅ | Mandato: **DENEGADO**<br>Real: **DENEGADO (403)** 🔒 |
| **`blanca.soler`** | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **VER**<br>Real: **VER (200)** ✅ | Mandato: **VER**<br>Real: **VER (200)** ✅ | Mandato: **DENEGADO**<br>Real: **DENEGADO (403)** 🔒 |
| **`doris.canon`** | Mandato: **VER**<br>Real: **VER (200)** ✅ | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **VER**<br>Real: **VER (200)** ✅ | Mandato: **DENEGADO**<br>Real: **DENEGADO (403)** 🔒 |
| **`bergenet.gutierrez`** | Mandato: **VER**<br>Real: **VER (200)** ✅ | Mandato: **VER**<br>Real: **VER (200)** ✅ | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **DENEGADO**<br>Real: **DENEGADO (403)** 🔒 |
| **`No Autenticado`** | Mandato: **DENEGADO**<br>Real: **DENEGADO (401)** 🔒 | Mandato: **DENEGADO**<br>Real: **DENEGADO (401)** 🔒 | Mandato: **DENEGADO**<br>Real: **DENEGADO (401)** 🔒 | Mandato: **DENEGADO**<br>Real: **DENEGADO (401)** 🔒 |

---

### 3. EVIDENCIA EXPERIMENTAL CASO POR CASO EN TIEMPO DE EJECUCIÓN

#### 3.1. Pruebas sobre la Cuenta de Ángela Ussa (`angela.ussa@boyaca.gov.co`)
- **Módulo Servidores Públicos:**
  - `GET /api/employees`: Retorna **HTTP 200 OK** (Listado de funcionarios).
  - `POST /api/employees`: Concede acceso a mutación (valida campos del payload).
- **Módulo Horarios Laborales:**
  - `GET /api/horarios`: Retorna **HTTP 200 OK** (Lectura transversal autorizada).
  - `POST /api/horarios`: Retorna **HTTP 403 Forbidden** (Mutación no autorizada bloqueada).
- **Módulo Viáticos:**
  - `GET /api/viaticos`: Retorna **HTTP 200 OK** (Lectura transversal autorizada).
  - `POST /api/viaticos`: Retorna **HTTP 403 Forbidden** (Mutación no autorizada bloqueada).
  - `DELETE /api/viaticos/1`: Retorna **HTTP 403 Forbidden** (Eliminación bloqueada).
- **Consola Técnica:**
  - `GET /api/admin/backups`: Retorna **HTTP 403 Forbidden**.

#### 3.2. Pruebas sobre la Cuenta de Blanca Soler (`blanca.soler@boyaca.gov.co`)
- **Módulo Servidores Públicos:**
  - `GET /api/employees`: Retorna **HTTP 200 OK** (Listado de funcionarios).
  - `POST /api/employees`: Concede acceso a mutación.
- **Módulo Horarios Laborales:**
  - `GET /api/horarios`: Retorna **HTTP 200 OK** (Lectura transversal autorizada).
  - `DELETE /api/horarios/1`: Retorna **HTTP 403 Forbidden** (Eliminación bloqueada).
- **Módulo Viáticos:**
  - `GET /api/viaticos`: Retorna **HTTP 200 OK** (Lectura transversal autorizada).
  - `POST /api/viaticos`: Retorna **HTTP 403 Forbidden** (Mutación bloqueada).
- **Consola Técnica:**
  - `GET /api/admin/backups`: Retorna **HTTP 403 Forbidden**.

#### 3.3. Pruebas sobre la Cuenta de Doris Cañón (`doris.canon@boyaca.gov.co`)
- **Módulo Servidores Públicos:**
  - `GET /api/employees`: Retorna **HTTP 200 OK** (Lectura transversal autorizada).
  - `POST /api/employees`: Retorna **HTTP 403 Forbidden** (Creación bloqueada).
  - `PUT /api/employees/1`: Retorna **HTTP 403 Forbidden** (Edición bloqueada).
- **Módulo Horarios Laborales:**
  - `GET /api/horarios`: Retorna **HTTP 200 OK** (Listado de acuerdos).
  - `POST /api/horarios`: Concede acceso a mutación (valida campos del payload).
- **Módulo Viáticos:**
  - `GET /api/viaticos`: Retorna **HTTP 200 OK** (Lectura transversal autorizada).
  - `DELETE /api/viaticos/1`: Retorna **HTTP 403 Forbidden** (Eliminación bloqueada).
- **Consola Técnica:**
  - `GET /api/admin/backups`: Retorna **HTTP 403 Forbidden**.

#### 3.4. Pruebas sobre la Cuenta de Bergenet Gutiérrez (`bergenet.gutierrez@boyaca.gov.co`)
- **Módulo Servidores Públicos:**
  - `GET /api/employees`: Retorna **HTTP 200 OK** (Lectura transversal autorizada).
  - `POST /api/employees`: Retorna **HTTP 403 Forbidden** (Creación bloqueada).
- **Módulo Horarios Laborales:**
  - `GET /api/horarios`: Retorna **HTTP 200 OK** (Lectura transversal autorizada).
  - `POST /api/horarios`: Retorna **HTTP 403 Forbidden** (Creación bloqueada).
- **Módulo Viáticos:**
  - `GET /api/viaticos`: Retorna **HTTP 200 OK** (Listado de comisiones).
  - `POST /api/viaticos`: Concede acceso a mutación (valida campos del payload).
- **Consola Técnica:**
  - `GET /api/admin/backups`: Retorna **HTTP 403 Forbidden**.

#### 3.5. Pruebas sobre Solicitudes Anónimas (Sin Token)
- `GET /api/employees`: Retorna **HTTP 401 Unauthorized**.
- `GET /api/horarios`: Retorna **HTTP 401 Unauthorized**.
- `GET /api/viaticos`: Retorna **HTTP 401 Unauthorized**.
- `GET /api/admin/backups`: Retorna **HTTP 401 Unauthorized**.
- `POST /api/auth/verify` con token corrupto: Retorna **HTTP 401 Unauthorized**.

---

### 4. COMPORTAMIENTO EN EL CLIENTE WEB (FRONTEND SPA)

- **Menú Lateral (Sidebar):** Muestra de forma limpia los tres módulos funcionales para todas las funcionarias institucionales.
- **Modo "Solo Lectura":** Cuando una usuaria ingresa a un módulo donde únicamente posee permiso `VER`, la interfaz:
  - Oculta los botones de *"Nuevo Servidor"*, *"Nuevo Horario"*, *"Nuevo Viático"*.
  - Oculta las acciones de edición y eliminación en las tablas de datos.
  - Oculta las opciones de *"Carga Masiva Excel"*.
  - Mantiene activos los filtros, búsquedas y visualizadores de detalle técnico.
- **Consistencia Bidireccional:** Aún si un usuario malicioso intentara forzar la aparición de botones mediante DevTools, cualquier llamada de red hacia endpoints de mutación es denegada por los middlewares del backend.

