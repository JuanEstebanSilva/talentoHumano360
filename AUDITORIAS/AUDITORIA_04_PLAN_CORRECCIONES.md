# AUDITORÍA 04: PLAN PRIORIZADO DE CORRECCIONES Y AJUSTES
## Recomendaciones de Ingeniería Post-Auditoría — Talento 360

---

### 1. OBJETIVO DEL PLAN

El presente plan establece la hoja de ruta técnica detallada para implementar las correcciones y mejoras identificadas en la **Cuarta Auditoría Técnica Integral**. 

Dado que la auditoría opera bajo la regla estricta de **NO MODIFICACIÓN**, este documento sirve como la guía de ejecución paso a paso para la fase posterior de estabilización final, garantizando que el sistema alcance el 100% de cumplimiento funcional e institucional sin introducir regresiones.

---

### 2. CLASIFICACIÓN Y PRIORIZACIÓN DE TAREAS

| ID Tarea | Hallazgo Asociado | Prioridad | Componente Afectado | Esfuerzo Estimado |
|---|---|:---:|---|:---:|
| **CORR-04-01** | `AUD-4-001` | **ALTA** | Base de Datos (`usuarios`) y `auth-service` | 1.5 Horas |
| **CORR-04-02** | `AUD-4-001` | **ALTA** | Frontend (`app.js`, vistas operativas) | 2.0 Horas |
| **CORR-04-03** | `AUD-4-002` | **MEDIA** | `requests`, `admin-requests`, `sst` (Middlewares) | 1.0 Hora |
| **CORR-04-04** | `AUD-4-003` | **BAJA** | `frontend` (Descarga local de tipografías/iconos) | 1.5 Horas |

---

### 3. ESPECIFICACIÓN DETALLADA DE LAS ACCIONES CORRECTIVAS

#### TAREA CORR-04-01: Habilitar Lectura Cruzada Transversal en Backend y BD
- **Objetivo:** Permitir que las funcionarias institucionales lean (`VER`) los 3 módulos operativos mientras conservan la exclusividad de escritura en su área.
- **Paso 1 (Base de Datos):** Actualizar la columna `modulos` en la tabla `usuarios` para incluir todos los módulos operativos en las 4 funcionarias:
  ```sql
  UPDATE usuarios 
  SET modulos = 'dashboard,employees,horarios,viaticos'
  WHERE username IN (
    'angela.ussa@boyaca.gov.co',
    'blanca.soler@boyaca.gov.co',
    'doris.canon@boyaca.gov.co',
    'bergenet.gutierrez@boyaca.gov.co'
  );
  ```
- **Paso 2 (Auth Service):** Refinar en `web/backend/auth-service/src/controllers/auth.controller.js` la asignación de permisos según el perfil y usuario:
  - Todas las 4 funcionarias reciben por defecto:
    `['dashboard:read', 'employees:read', 'horarios:read', 'viaticos:read']`
  - Se agregan condicionalmente los permisos de mutación:
    - Si el usuario es Ángela o Blanca: agregar `['employees:write', 'employees:delete', 'employees:import', 'employees:export']`
    - Si el usuario es Doris: agregar `['horarios:write', 'horarios:delete']`
    - Si el usuario es Bergenet: agregar `['viaticos:write', 'viaticos:status', 'viaticos:import', 'viaticos:delete']`
- **Criterio de Aceptación:**
  - `doris.canon` puede ejecutar `GET /api/viaticos` y `GET /api/employees` recibiendo `200 OK`.
  - `doris.canon` al ejecutar `POST /api/viaticos` continúa recibiendo `403 Forbidden`.

---

#### TAREA CORR-04-02: Adaptación del Frontend para Vistas en "Solo Lectura"
- **Objetivo:** Brindar una experiencia de usuario clara donde las opciones de edición se oculten o deshabiliten si la usuaria carece de permisos de escritura para ese módulo.
- **Paso 1 (Sidebar y Enlaces de Navegación):**
  - En `web/frontend/public/app.js`, verificar que el menú lateral muestre los enlaces a Servidores, Horarios y Viáticos para las 4 funcionarias.
- **Paso 2 (Ocultamiento de Controles de Mutación):**
  - En las vistas de Servidores (`employees.html` o plantillas JS): Si `!hasPermission('employees:write')`, ocultar los botones de *"Nuevo Servidor"*, *"Importar Excel"*, *"Eliminar"* y las acciones de edición en la tabla.
  - En las vistas de Viáticos: Si `!hasPermission('viaticos:write')`, ocultar el botón *"Cargar Archivo Excel"*, *"Cambiar Estado"* y deshabilitar botones de eliminación.
  - En las vistas de Horarios: Si `!hasPermission('horarios:write')`, ocultar el botón *"Asignar Nuevo Horario"*.
- **Criterio de Aceptación:**
  - Cuando Bergenet navega a Servidores Públicos, puede buscar y ver fichas técnicas, pero no ve botones de edición o borrado.

---

#### TAREA CORR-04-03: Refactorización de Verificación de Roles en Servicios Secundarios
- **Objetivo:** Eliminar la evaluación de roles mediante subcadenas (`role.toLowerCase().includes('administrador')`).
- **Archivos a intervenir:**
  - `web/backend/requests-service/src/middlewares/auth.js`
  - `web/backend/admin-requests-service/src/middlewares/auth.js`
  - `web/backend/sst-service/src/middlewares/auth.js`
- **Acción:**
  Sustituir:
  ```javascript
  // Código actual:
  const isAdmin = user.rol && user.rol.toLowerCase().includes('administrador');
  ```
  Por validación estricta:
  ```javascript
  // Código robusto:
  const isAdmin = user.rol === 'Administrador' || (Array.isArray(user.roles) && user.roles.includes('Administrador'));
  ```
- **Criterio de Aceptación:**
  - Ningún rol arbitrario que contenga la palabra "administrador" (p. ej. `Observador_Administrador`) obtiene privilegios de mutación.

---

#### TAREA CORR-04-04: Empaquetamiento Offline de Recursos Estáticos (Opcional / Despliegue)
- **Objetivo:** Garantizar autonomía total de la plataforma en redes cerradas o intranets gubernamentales sin conexión a internet.
- **Acción:**
  - Descargar los archivos WOFF2 de Google Fonts (Montserrat, Roboto) e iconos FontAwesome y alojarlos en `web/frontend/public/assets/fonts/` y `web/frontend/public/assets/css/`.
  - Ajustar `nginx.conf` en la cabecera `Content-Security-Policy` para remover dominios externos innecesarios en producción (`fonts.googleapis.com`, `fonts.gstatic.com`, `cdn.jsdelivr.net`).
- **Criterio de Aceptación:**
  - La plataforma renderiza correctamente su tipografía institucional e iconografía aún con el cable de red desconectado o el gateway de internet bloqueado.

---

### 4. PROTOCOLO DE PRUEBAS DE REGRESIÓN POST-IMPLEMENTACIÓN

Tras la aplicación de las 4 tareas correctivas, se deberá ejecutar la siguiente batería de pruebas de certificación:

1. **Prueba de Ingesta Masiva de Viáticos:**
   - Cargar un archivo Excel con 1,000 registros incluyendo funcionarios existentes y no registrados en `personas`.
   - Verificar que se creen los 1,000 registros sin errores 500 y que las estadísticas agregadas reflejen los totales correctos.
2. **Prueba de Transversalidad RBAC:**
   - Iniciar sesión consecutiva con las 5 cuentas (`admin`, `angela`, `blanca`, `doris`, `bergenet`).
   - Verificar que todas puedan visualizar listados en `/api/employees`, `/api/horarios` y `/api/viaticos`.
   - Verificar que únicamente la encargada autorizada pueda ejecutar `POST`, `PUT` o `DELETE` en su módulo respectivo.
3. **Prueba de Inmutabilidad de Servidores con Antecedentes:**
   - Intentar eliminar un funcionario que tenga viáticos registrados.
   - Confirmar recepción de HTTP `409 Conflict`.

