# Arquitectura de Microservicios Backend
## Sistema de Gestión de Talento Humano — Talento 360
### Gobernación de Boyacá

Este directorio contiene los **8 microservicios desacoplados** desarrollados en **Node.js 20 / Express**, orquestados a través de Docker Compose e interconectados mediante la red privada `talento360_net`.

---

## 🗺️ Mapa de Microservicios y Puertos Internos

| Directorio del Servicio | Contenedor Docker | Puerto Interno | Ruta en Nginx | Módulo Administrativo |
| :--- | :--- | :--- | :--- | :--- |
| **`auth-service/`** | `talento360_auth` | `3001` | `/api/auth/` | Autenticación, tokens JWT, roles y perfiles institucionales. |
| **`employees-service/`** | `talento360_employees` | `3002` | `/api/employees/` | Servidores públicos, hoja de vida, planta, retiros y revinculaciones. |
| **`requests-service/`** | `talento360_requests` | `3003` | `/api/requests/` | Solicitudes de vacaciones, permisos remunerados e incapacidades. |
| **`admin-requests-service/`** | `talento360_admin_requests` | `3004` | `/api/admin-requests/` | Bandeja de aprobación y trámites de solicitudes de talento humano. |
| **`viaticos-service/`** | `talento360_viaticos` | `3005` | `/api/viaticos/` | Radicación, liquidación salarial, decretos y estados de comisiones. |
| **`dashboard-service/`** | `talento360_dashboard` | `3006` | `/api/dashboard/` & `/api/admin/` | KPIs en tiempo real, generador PDF, consola de errores y backups. |
| **`horarios-service/`** | `talento360_horarios` | `3007` | `/api/horarios/` | Acuerdos de teletrabajo, trabajo en casa, horarios y vigencias. |
| **`sst-service/`** | `talento360_sst` | `3008` | `/api/sst/` | Seguridad y Salud en el Trabajo, EMO, EPP y caracterización. |

---

## 🔒 Estándares de Seguridad Compartidos
1. **Validación JWT al Arranque:** Los microservicios validan la presencia y robustez de `JWT_SECRET`. Si falta en producción, el contenedor detiene su ejecución para evitar tokens vulnerables.
2. **Control de Acceso Basado en Roles (RBAC):** Middleware compartido que valida permisos granulares (`employees:write`, `viaticos:write`, etc.) desacoplados del nombre de usuario.
3. **Manejo Centralizado de Excepciones:** Errores no controlados se registran de forma estructurada en la base de datos para seguimiento en la consola de auditoría.
4. **Protección Formula Injection (CWE-1236):** Toda exportación de datos a Excel/CSV se sanitiza anteponiendo comilla simple a caracteres disparadores (`=`, `+`, `-`, `@`).
