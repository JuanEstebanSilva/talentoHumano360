# Esquema y Scripts de Base de Datos — PostgreSQL 16
## Sistema de Gestión de Talento Humano — Talento 360
### Gobernación de Boyacá

Este directorio contiene todos los scripts SQL de inicialización, definición de esquemas (DDL), catálogos institucionales (DML), índices de rendimiento, restricciones de integridad referencial y configuración del control de acceso basado en roles (RBAC).

---

## ⚙️ Inicialización Automática en Docker

Cuando el contenedor `talento360_db` arranca por primera vez con un volumen vacío (`postgres_data`), el motor de PostgreSQL ejecuta de forma secuencial y transparente todos los archivos `.sql` presentes en este directorio en orden alfanumérico:

```
01_schema.sql ──────────► Crea las 29 tablas relacionales y secuencias maestras
02_seed_data.sql ───────► Inserta los catálogos base de cargos y dependencias
...
26_rbac_*.sql ──────────► Establece los permisos de lectura transversal e inmunidad de mutación
27_clean_*.sql ─────────► Garantiza que las tablas transaccionales arranquen en cero tuplas
```

---

## 📋 Catálogo de Scripts y Funcionalidades

| Archivo | Propósito y Contenido |
| :--- | :--- |
| `01_schema.sql` | Definición de tablas base: `personas`, `rel_principal`, `contactos`, `educacion`, `vacaciones`. |
| `02_seed_data.sql` | Población de catálogos iniciales de la estructura institucional de la Gobernación. |
| `03_new_modules.sql` | Estructuras para solicitudes, incapacidades, licencias y trámites administrativos. |
| `04_horarios.sql` | Tabla `horarios` para modalidades especiales (Teletrabajo, Trabajo en Casa, Flexible). |
| `05_divipola_and_hr_rules.sql` | Catálogo de municipios y reglas de validación de datos laborales. |
| `06_hr_updates_experiencia_multiple.sql` | Soporte para múltiples periodos de experiencia laboral previa y acumulada. |
| `07_add_tiempo_total_gobernacion.sql` | Columnas para el cómputo dinámico de antigüedad en la entidad. |
| `08_full_divipola_update.sql` | Actualización masiva de códigos geográficos DIVIPOLA (DANE). |
| `09_cargos_nivel_update.sql` | Homologación de niveles jerárquicos: Directivo, Asesor, Profesional, Técnico, Asistencial. |
| `10_sst_module.sql` | Tablas del módulo de Seguridad y Salud en el Trabajo (Exámenes Médicos, Dotaciones EPP). |
| `12_performance_indexes.sql` | Índices B-Tree optimizados para acelerar búsquedas por cédula, nombres y fechas. |
| `13_paquetes_viaticos.sql` | Soporte para agrupación y vigencias fiscales de comisiones de viáticos. |
| `15_user_roles_permissions.sql` | Modelo RBAC institucional con roles `admin`, `angela`, `blanca`, `doris`, `bergenet`. |
| `16_encargo_columns.sql` | Campos de encargo de funciones (`encargo_denominacion`, `encargo_codigo`, `encargo_grado`). |
| `17_add_fecha_retiro.sql` | Trazabilidad del flujo formal de retiro y desvinculación de personal. |
| `18_system_errors_and_backups.sql` | Tablas de auditoría técnica: `system_errors` y `backups`. |
| `19_add_safe_parse_date_and_fixes.sql` | Función almacenada `safe_parse_date` para parseo inmune a errores de fecha. |
| `20_viaticos_escalas_decretos.sql` | Tabla `viaticos_escalas` con decretos salariales y tarifas oficiales 2024–2026. |
| `21_fix_divipola_boyaca.sql` | Corrección y ajuste de nombres de municipios de Boyacá. |
| `22_sequences_and_concurrency_employees.sql` | Bloqueos consultivos y secuencias atómicas para identificadores `REL`. |
| `23_foreign_keys_and_referential_integrity.sql` | Claves foráneas estrictas y protección `ON DELETE RESTRICT` para históricos. |
| `24_divipola_boyaca_asentamientos_y_normalizacion.sql` | Cobertura georreferenciada integral de los 123 municipios de Boyacá. |
| `25_viaticos_ciclo_de_vida_y_estados.sql` | Máquina de estados canónica de viáticos y protección contable de registros legalizados. |
| `26_rbac_cross_module_read_and_permissions.sql` | Permiso de lectura transversal institucional para todos los usuarios autenticados. |
| `27_clean_transactional_inserts.sql` | Limpieza controlada de tablas transaccionales para arranque productivo en limpio. |

---

## 🏛️ Catálogos que se Conservan Intactos
- **Dependencias:** 100 dependencias oficiales de la Gobernación de Boyacá.
- **Cargos:** 72 cargos de la planta global clasificados por nivel jerárquico.
- **DIVIPOLA Boyacá:** Los 123 municipios oficiales del departamento.
- **Escalas Salariales de Viáticos:** Decretos anuales con tarifas reglamentarias.
- **Usuarios y Roles RBAC:** Cuentas oficiales preconfiguradas con contraseñas seguras.

---

## 📊 Tablas Transaccionales que Inician en Cero (0 Registros)
- `personas` (Servidores Públicos)
- `rel_principal` (Relaciones y Actos Laborales)
- `viaticos` (Comisiones de Servicios)
- `horarios` (Acuerdos y Esquemas Laborales)
- `contactos`, `educacion`, `vacaciones`, `historial_solicitudes`
