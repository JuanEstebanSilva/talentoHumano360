# AUDITORÍA 05: REGISTRO DE CAMBIOS Y PLAN DE ACCIÓN PENDIENTE
## Bitácora de Modificaciones e Instrucciones de Mantenimiento — Talento 360

---

### 1. BITÁCORA DETALLADA DE ARCHIVOS MODIFICADOS

A continuación se detallan los archivos del repositorio que fueron modificados para implementar la solución al hallazgo `AUD-4-001` y mitigar `AUD-4-002`:

| Archivo Modificado | Componente | Motivo de la Modificación | Resumen del Cambio Técnico |
|---|---|---|---|
| `database/26_rbac_cross_module_read_and_permissions.sql` | Base de Datos | Corrección de causa raíz en persistencia | Agrega columna `permisos TEXT` a `usuarios` y configura los módulos operativos y permisos granulares para los 5 usuarios. |
| `web/services/auth-service/src/routes/auth.js` | Autenticación | Emisión de permisos granulares | Modifica `/login` y `/profile` para recuperar `permisos` de BD y pasar la lista granular al JWT payload. |
| `web/services/employees-service/src/routes/employees.js` | Microservicio Servidores | Validación estricta de permisos | Ajusta `hasPermission` para permitir `read` con la asignación del módulo, pero exigir `:write` para mutaciones. |
| `web/services/viaticos-service/src/routes/viaticos.js` | Microservicio Viáticos | Validación estricta de permisos | Ajusta `hasPermission` para permitir `read` con la asignación del módulo, pero exigir `:write` para mutaciones. |
| `web/services/horarios-service/src/routes/horarios.js` | Microservicio Horarios | Validación estricta de permisos | Ajusta `hasPermission` para permitir `read` con la asignación del módulo, pero exigir `:write` para mutaciones. |
| `web/services/requests-service/src/routes/requests.js` | Microservicio Solicitudes | Subsanación de `AUD-4-002` | Reemplaza `includes('administrador')` por igualdad estricta y validación en `permissions`. |
| `web/services/admin-requests-service/src/routes/admin-requests.js` | Microservicio Admin Solicitudes | Subsanación de `AUD-4-002` | Reemplaza `includes('administrador')` por igualdad estricta y validación en `permissions`. |
| `web/services/sst-service/src/routes/sst.js` | Microservicio SST | Subsanación de `AUD-4-002` | Reemplaza `includes('administrador')` por igualdad estricta y validación en `permissions`. |
| `web/frontend/src/js/auth.js` | Frontend Client | Control de interfaz de usuario | Refina `Auth.canEdit(moduleName)` para exigir `:write` explícito antes de renderizar botones de mutación. |

---

### 2. EVALUACIÓN DE RIESGOS RESIDUALES

1. **Riesgo de Desincronización en Nuevos Usuarios:**
   - Si en el futuro un administrador crea un nuevo usuario directamente en la base de datos sin poblar la columna `permisos`, la función `resolvePermissions` utilizará el fallback estándar asignando permisos basados en la columna `modulos`.
   - *Mitigación implementada:* La función `resolvePermissions` contempla fallback automático transparente.
2. **Riesgo de Acceso Concurrente durante Migraciones:**
   - El script de migración SQL utiliza `IF NOT EXISTS` y updates atómicos sin bloquear tablas exclusivas ni requerir reinicio del motor PostgreSQL.

---

### 3. PLAN DE TRABAJO PENDIENTE Y RECOMENDACIONES FINALES

| Tarea Recomendada | Prioridad | Responsable Sugerido | Descripción |
|---|:---:|:---:|---|
| **Empaquetamiento Offline de Recursos Estáticos (`CORR-04-04`)** | BAJA | Equipo de Infraestructura | Descargar fuentes Google Fonts (Roboto, Montserrat) e iconos FontAwesome en `web/frontend/public/assets/` para despliegues en servidores sin salida a Internet. |
| **Capacitación a los Usuarios Clave** | MEDIA | Dirección de Talento Humano | Presentar a Ángela Ussa, Blanca Soler, Doris Cañón y Bergenet Gutiérrez la nueva funcionalidad de consulta compartida y las garantías de protección sobre sus datos. |
| **Monitoreo Periódico de Logs** | BAJA | Administrador Técnico | Supervisar la consola de errores (`/api/admin/errors`) tras el paso a producción oficial de la Gobernación de Boyacá. |

