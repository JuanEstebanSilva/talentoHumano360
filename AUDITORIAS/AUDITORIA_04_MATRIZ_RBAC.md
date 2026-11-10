# AUDITORÍA 04: MATRIZ DE CONTROL DE ACCESO (RBAC)
## Evaluación de Permisos Institucionales — Gobernación de Boyacá

---

### 1. REGLA INSTITUCIONAL VIGENTE: VISIÓN COMPARTIDA DE LECTURA

De conformidad con los lineamientos definidos para la Gobernación de Boyacá, la plataforma **Talento 360** debe garantizar un esquema de **seguridad por dominio de escritura con visibilidad operativa compartida**:
1. **Administrador (`admin`):** Acceso integral y absoluto (`CRUD`) en todos los módulos de la plataforma, administración de usuarios, auditoría del sistema y configuraciones globales.
2. **Funcionarias de Talento Humano (`angela.ussa`, `blanca.soler`, `doris.canon`, `bergenet.gutierrez`):**
   - **Permiso de Escritura / Mutación (`CRUD`):** Estrictamente acotado a su área funcional de competencia.
   - **Permiso de Lectura / Auditoría (`VER`):** **Transversal e irrestricto** sobre los tres módulos principales (`Servidores Públicos`, `Horarios` y `Viáticos`). Todas las funcionarias deben poder consultar el universo de servidores, sus acuerdos de horarios y las comisiones de viáticos para análisis interdepartamental.

---

### 2. MATRIZ DEFINITIVA: MANDATO INSTITUCIONAL VS. ESTADO REAL DETECTADO

A continuación se compara el mandato institucional exigido frente al estado real arrojado por las pruebas automatizadas en tiempo de ejecución de la Cuarta Auditoría:

| Usuario | Módulo Servidores Públicos | Módulo Horarios Laborales | Módulo Viáticos Institucionales | Administración Global / Logs |
|---|:---:|:---:|:---:|:---:|
| **admin** | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **TOTAL**<br>Real: **TOTAL (200)** |
| **angela.ussa** | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **VER**<br>Real: <span style="color:red">**BLOQUEADO (403)**</span> | Mandato: **VER**<br>Real: <span style="color:red">**BLOQUEADO (403)**</span> | Mandato: **DENEGADO**<br>Real: **DENEGADO (403)** |
| **blanca.soler** | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **VER**<br>Real: <span style="color:red">**BLOQUEADO (403)**</span> | Mandato: **VER**<br>Real: <span style="color:red">**BLOQUEADO (403)**</span> | Mandato: **DENEGADO**<br>Real: **DENEGADO (403)** |
| **doris.canon** | Mandato: **VER**<br>Real: <span style="color:red">**BLOQUEADO (403)**</span> | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **VER**<br>Real: <span style="color:red">**BLOQUEADO (403)**</span> | Mandato: **DENEGADO**<br>Real: **DENEGADO (403)** |
| **bergenet.gutierrez** | Mandato: **VER**<br>Real: <span style="color:red">**BLOQUEADO (403)**</span> | Mandato: **VER**<br>Real: <span style="color:red">**BLOQUEADO (403)**</span> | Mandato: **CRUD**<br>Real: **CRUD (200)** | Mandato: **DENEGADO**<br>Real: **DENEGADO (403)** |

---

### 3. RESULTADOS DE PRUEBAS DE CAMPO CONTROLADAS (EVIDENCIA CRUDA)

Durante la sesión de auditoría del 7 de noviembre de 2026, se ejecutaron transacciones HTTP contra los endpoints reales mediante el suite de verificación técnica:

#### 3.1. Pruebas sobre la Cuenta de Doris Canon (`doris.canon`)
- **Acción:** `GET /api/horarios` (Lectura de su módulo propio)
  - **Código HTTP:** `200 OK`
  - **Resultado:** Retornó 136 acuerdos de jornada.
- **Acción:** `POST /api/horarios` (Creación en su módulo propio)
  - **Código HTTP:** Permitido (cumple permisos `horarios:write`).
- **Acción:** `GET /api/viaticos` (Lectura transversal requerida)
  - **Código HTTP:** `403 Forbidden` (`{"error": "Permisos insuficientes."}`)
  - **Dictamen:** <span style="color:red">**NO CONFORME CON MANDATO INSTITUCIONAL**</span> (Hallazgo `AUD-4-001`).
- **Acción:** `POST /api/viaticos` (Mutación no autorizada en Viáticos)
  - **Código HTTP:** `403 Forbidden`
  - **Dictamen:** **CONFORME.** Bloqueo de escritura exitoso.
- **Acción:** `GET /api/employees` (Lectura transversal requerida)
  - **Código HTTP:** `403 Forbidden`
  - **Dictamen:** <span style="color:red">**NO CONFORME CON MANDATO INSTITUCIONAL**</span> (Hallazgo `AUD-4-001`).

#### 3.2. Pruebas sobre la Cuenta de Bergenet Gutiérrez (`bergenet.gutierrez`)
- **Acción:** `GET /api/viaticos` (Lectura de su módulo propio)
  - **Código HTTP:** `200 OK`
  - **Resultado:** Retornó 6,556 comisiones registradas.
- **Acción:** `POST /api/viaticos` (Carga/Edición de su módulo propio)
  - **Código HTTP:** Permitido (cumple permisos `viaticos:write`, `viaticos:import`).
- **Acción:** `GET /api/employees` (Lectura transversal requerida)
  - **Código HTTP:** `403 Forbidden`
  - **Dictamen:** <span style="color:red">**NO CONFORME CON MANDATO INSTITUCIONAL**</span> (Hallazgo `AUD-4-001`).
- **Acción:** `GET /api/horarios` (Lectura transversal requerida)
  - **Código HTTP:** `403 Forbidden`
  - **Dictamen:** <span style="color:red">**NO CONFORME CON MANDATO INSTITUCIONAL**</span> (Hallazgo `AUD-4-001`).

#### 3.3. Pruebas sobre las Cuentas de Ángela Ussa y Blanca Soler
- **Acción:** `GET /api/employees` (Lectura de su módulo propio)
  - **Código HTTP:** `200 OK`
  - **Resultado:** Retornó 678 servidores públicos activos.
- **Acción:** `POST /api/employees` (Creación en su módulo propio)
  - **Código HTTP:** Permitido (cumple permisos `employees:write`).
- **Acción:** `GET /api/viaticos` y `GET /api/horarios` (Lectura transversal requerida)
  - **Código HTTP:** `403 Forbidden`
  - **Dictamen:** <span style="color:red">**NO CONFORME CON MANDATO INSTITUCIONAL**</span> (Hallazgo `AUD-4-001`).

---

### 4. DIAGNÓSTICO DE CAUSA RAÍZ (POR QUÉ OCURRE EL SOBREBLOQUEO)

El sobrebloqueo se origina en la conjunción de dos factores implementados en la remediación anterior:

1. **Configuración en Base de Datos (`tabla usuarios`):**
   ```sql
   -- Asignación actual en la base de datos:
   -- angela.ussa: modulos = 'dashboard,employees'
   -- blanca.soler: modulos = 'dashboard,employees'
   -- doris.canon: modulos = 'dashboard,horarios'
   -- bergenet.gutierrez: modulos = 'dashboard,viaticos'
   ```
2. **Lógica de Generación de Permisos en `auth-service`:**
   En `auth-service/src/controllers/auth.controller.js`, la función `getPermissionsForModules(modulos)` otorga únicamente permisos asociados a las cadenas literales presentes en la columna `modulos`. Al no incluir los otros módulos en la lista, el payload del JWT carece de `employees:read`, `horarios:read` o `viaticos:read`.
3. **Middleware de Rutas (`canRead`):**
   Tanto en `employees-service`, `viaticos-service` como en `horarios-service`, el middleware `canRead(moduleName)` rechaza la petición con `403 Forbidden` si el JWT no contiene el módulo o el permiso `:read`.
4. **Comportamiento en Frontend:**
   En `web/frontend/public/app.js`, la función `renderSidebar()` oculta los elementos de navegación para los módulos que no están en `user.modules`. Si la usuaria intenta ingresar manualmente mediante la URL, el backend devuelve 403 y la interfaz la redirige al Dashboard.

---

### 5. ESPECIFICACIÓN DE CORRECCIÓN (PARA LA FASE DE REMEDIACIÓN)

Para alinear el sistema al 100% con el mandato institucional sin comprometer la seguridad:

1. **Actualizar la asignación de módulos en la base de datos:**
   A las 4 funcionarias (`angela.ussa`, `blanca.soler`, `doris.canon`, `bergenet.gutierrez`), asignarles en la columna `modulos` los tres módulos operativos: `'dashboard,employees,horarios,viaticos'`.
2. **Diferenciar permisos de lectura frente a permisos de escritura:**
   Asegurar que la matriz de permisos otorgada en `auth.controller.js` conceda a todas las funcionarias los permisos de lectura transversal:
   - `employees:read`
   - `horarios:read`
   - `viaticos:read`
   - `dashboard:read`
   Y restringir los permisos de escritura/mutación (`:write`, `:delete`, `:import`) estrictamente a la especialista designada:
   - Ángela / Blanca: `employees:write`, `employees:delete`, `employees:import`, `employees:export`
   - Doris: `horarios:write`, `horarios:delete`
   - Bergenet: `viaticos:write`, `viaticos:status`, `viaticos:import`, `viaticos:delete`
3. **Frontend (SPA):**
   Ajustar la vista en el cliente para que muestre en modo "Solo Lectura" (ocultando botones de crear, editar, eliminar o importar) cuando la usuaria navegue en un módulo donde solo posee permiso `:read`.

