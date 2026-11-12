# Talento 360 — Sistema Integral de Gestión de Talento Humano
## Gobernación de Boyacá — Dirección de Talento Humano

---

## 1. Identificación del Proyecto

* **Nombre del Sistema:** Talento 360 — Plataforma Integral de Gestión de Talento Humano.
* **Entidad Contratante:** Gobernación de Boyacá.
* **Dependencia Líder:** Secretaría General — Dirección de Talento Humano.
* **Tipo de Proyecto:** Aplicación web empresarial distribuida basada en microservicios contenerizados con Docker, proxy inverso Nginx y base de datos relacional PostgreSQL.
* **Licencia / Uso:** Uso exclusivo e institucional de la Gobernación de Boyacá.

---

## 2. Propósito del Sistema

**Talento 360** centraliza, moderniza y digitaliza los procesos de administración de personal de la Gobernación de Boyacá. El sistema resuelve la dispersión histórica de información generada por el manejo de múltiples hojas de cálculo, previene inconsistencias censales en la planta de servidores públicos, automatiza el control de acuerdos laborales (Teletrabajo y Trabajo en Casa), asegura la recepción y procesamiento de comisiones de viáticos, e integra los trámites de solicitudes y expedientes de Seguridad y Salud en el Trabajo (SST).

---

## 3. Funcionalidades Principales Implementadas

El sistema cuenta con los siguientes módulos institucionales en pleno funcionamiento:

1. **Directorio y Expediente de Servidores Públicos:**
   - Hoja de vida digitalizada de servidores públicos activos, en encargo y retirados.
   - Clasificación por dependencias oficiales, cargos, niveles jerárquicos y municipios (DIVIPOLA Boyacá).
   - Importación masiva desde archivos Excel oficiales con validación transaccional y prevención de duplicados.
   - Historial de retiros, revinculaciones y novedades de nómina.

2. **Monitoreo y Control de Acuerdos de Horarios:**
   - Gestión de modalidades de trabajo: Teletrabajo, Trabajo en Casa y Horario Flexible.
   - Control estricto de vigencias temporales y detección automática de solapamientos.
   - Carga y visualización de actos administrativos de soporte en PDF.
   - Aislamiento transaccional que preserva el censo oficial sin crear personas sintéticas.

3. **Recepción y Procesamiento de Viáticos:**
   - Registro de comisiones de servicio, destinos departamentales y nacionales.
   - Normalización inteligente de duración con 12 reglas de validación (rango de fechas, valores numéricos, descarte de textos de resolución).
   - Asociación a paquetes presupuestales y cálculo de valores totales.
   - Protección estricta de integridad referencial (`ON DELETE RESTRICT`) contra eliminación accidental de paquetes con comisiones vinculadas.

4. **Bandeja de Solicitudes y Trámites de Personal:**
   - Radicación y aprobación digital de vacaciones, permisos administrativos remunerados e incapacidades médicas.
   - Flujo de revisión por jefes inmediatos y Dirección de Talento Humano.

5. **Seguridad y Salud en el Trabajo (SST):**
   - Registro y control de Evaluaciones Médicas Ocupacionales (EMO).
   - Entrega y seguimiento de Elementos de Protección Personal (EPP).
   - Caracterización sociodemográfica y matrices de riesgo institucional.

6. **Dashboard Ejecutivo y Auditoría Operativa:**
   - Métricas y KPIs en tiempo real de planta de personal, licencias y comisiones activas.
   - Generación de reportes ejecutivos en PDF vectorial con identidad institucional oficial.
   - Consola de monitoreo de errores del sistema y registro de actividad de copias de seguridad.

---

## 4. Arquitectura Técnica

Talento 360 opera bajo un modelo de **microservicios desacoplados**, donde cada servicio atiende un dominio específico, aislando posibles fallos y permitiendo el mantenimiento independiente:

```mermaid
graph TD
    Client["Navegador Web / Red Local"] -->|Puerto HTTP 80| Nginx["Gateway Nginx (talento360_frontend)"]

    subgraph "Red Interna Docker: talento360_net"
        Nginx -->|/ (HTML/JS/CSS)| UI["Frontend Web (Vanilla JS ES6+)"]
        Nginx -->|/api/auth/| S1["auth-service :3001"]
        Nginx -->|/api/employees/| S2["employees-service :3002"]
        Nginx -->|/api/requests/| S3["requests-service :3003"]
        Nginx -->|/api/admin-requests/| S4["admin-requests-service :3004"]
        Nginx -->|/api/viaticos/| S5["viaticos-service :3005"]
        Nginx -->|/api/dashboard/| S6["dashboard-service :3006"]
        Nginx -->|/api/horarios/| S7["horarios-service :3007"]
        Nginx -->|/api/sst/| S8["sst-service :3008"]

        S1 & S2 & S3 & S4 & S5 & S6 & S7 & S8 -->|Conexión TCP 5432| DB[("PostgreSQL 16 (talento360_db)")]
    end

    subgraph "Persistencia Física"
        DB --> Vol[("Volumen Docker: postgres_data")]
    end
```

---

## 5. Tecnologías Utilizadas

Todas las herramientas y dependencias han sido verificadas en el entorno operativo del proyecto:

* **Entorno de Contenedores:** Docker Engine 24+ y Docker Compose v2.
* **Servidor Web y Proxy Inverso:** Nginx 1.25 Alpine.
* **Backend Runtime:** Node.js 20 LTS (Alpine).
* **Framework Backend:** Express.js 4.18 con middleware de compresión, CORS y rate limiting.
* **Base de Datos:** PostgreSQL 16 Alpine con extensiones de optimización e integridad referencial.
* **Frontend:** JavaScript Vanilla moderno (ES6+ modular), HTML5 semántico y CSS3 institucional unificado.
* **Seguridad y Criptografía:** Bcrypt (`bcryptjs` coste 12), JSON Web Tokens (`jsonwebtoken`), y protección Formula Injection (CWE-1236).
* **Manejo de Archivos:** `multer` para subidas multipartes y `xlsx` (SheetJS) para lectura y sanitización de hojas de cálculo.

---

## 6. Estructura de Directorios

El repositorio se organiza bajo una estructura limpia y orientada a la entrega institucional:

```text
talento360/
├── README.md                           # Documento principal de presentación y recepción
├── .gitignore                          # Exclusión profesional de secretos y temporales
├── .env.example                        # Plantilla oficial de variables de entorno
├── package.json                        # Definición de dependencias raíz
│
├── database/                           # Scripts SQL de esquema, migraciones 01-29 y semillas
├── deploy/                             # Herramientas de despliegue on-premise y systemd
│   ├── README.md                       # Manual de operación del actualizador
│   ├── scripts/                        # Scripts bash de actualización y respaldo
│   └── systemd/                        # Unidades de temporizador para automatización
│
├── docs/                               # Documentación técnica oficial completa
│   ├── ARQUITECTURA.md                 # Arquitectura de capas y microservicios
│   ├── INSTALACION.md                  # Procedimiento de instalación paso a paso
│   ├── CONFIGURACION.md                # Catálogo de variables de entorno y Nginx
│   ├── DESPLIEGUE.md                   # Guía de despliegue en servidor Linux
│   ├── SEGURIDAD.md                    # Políticas RBAC, criptografía y ASVS
│   ├── MANTENIMIENTO.md                # Respaldos, restauración y optimización
│   ├── SOLUCION_PROBLEMAS.md           # Guía de solución de incidentes (Troubleshooting)
│   ├── INFORME_ORGANIZACION_FINAL_TALENTO360.md # Acta técnica de depuración
│   ├── branding/                       # Manual de identidad institucional y logos
│   └── screenshots/                    # Catálogo fotográfico de pantallas
│
├── tests/                              # Suites automatizadas de regresión
│   ├── README.md                       # Instrucciones de ejecución de pruebas
│   ├── rbac_matrix.test.js             # Matriz de 15 operaciones CRUD transversales
│   └── viaticos_dates.test.js          # Pruebas de duración, fechas y protección FK
│
└── web/                                # Código fuente de la aplicación
    ├── docker-compose.yml              # Orquestador maestro de los 10 contenedores
    ├── .env.example                    # Plantilla local de variables de entorno
    ├── frontend/                       # Código del cliente web y configuración Nginx
    └── services/                       # Los 8 microservicios desacoplados
```

---

## 7. Requisitos Previos

### Obligatorios:
* Servidor físico o virtual con arquitectura `x86_64` (Ubuntu Server 22.04 / 24.04 LTS recomendado).
* **Docker Engine** 24.0.0+ y plugin **Docker Compose** 2.20+.
* Recursos de hardware mínimos: 2 CPU, 4 GB de RAM y 20 GB de almacenamiento SSD.
* Recursos recomendados para producción: 4 CPU, 8 GB de RAM y 50 GB de almacenamiento SSD NVMe.

### Opcionales:
* Node.js 18+ o 20+ (únicamente si se van a ejecutar pruebas unitarias o diagnósticos fuera de los contenedores).

---

## 8. Procedimiento de Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/JuanEstebanSilva/talentoHumano360.git talento360
   cd talento360
   ```

2. **Configurar las variables de entorno:**
   ```bash
   cp web/.env.example web/.env
   cp .env.example .env
   ```
   Edita `web/.env` y establece contraseñas robustas para `POSTGRES_PASSWORD` y `JWT_SECRET`.

3. **Construir y levantar la plataforma:**
   ```bash
   cd web
   docker compose up -d --build
   ```

---

## 9. Configuración del Sistema

El archivo `web/.env` centraliza los parámetros operativos principales:
* `POSTGRES_DB`: Base de datos institucional (`talento360`).
* `POSTGRES_USER`: Usuario administrador (`postgres`).
* `POSTGRES_PASSWORD`: Clave de conexión a la base de datos.
* `JWT_SECRET`: Secreto criptográfico de 64 caracteres para firma de sesiones.
* `JWT_EXPIRES_IN`: Tiempo de expiración de sesión (por defecto `8h`).
* `ALLOWED_ORIGINS`: Lista blanca de orígenes CORS permitidos.
* `SMTP_*`: Parámetros de conexión a servidor de correo institucional para notificaciones.

Para consultar el detalle completo de cada parámetro, consulta la [Guía de Configuración](docs/CONFIGURACION.md).

---

## 10. Comandos de Ejecución y Operación

Desde la carpeta `web/`:

```bash
# Iniciar todos los contenedores en segundo plano
docker compose up -d

# Detener los contenedores sin borrar datos
docker compose stop

# Reiniciar los servicios tras cambios de configuración
docker compose restart

# Consultar el estado de salud de los 10 contenedores
docker compose ps

# Ver registros de actividad en tiempo real
docker compose logs -f
```

---

## 11. Procedimiento de Actualización Continua

Para entornos de producción on-premise en Linux, el proyecto incluye un script de actualización protegida en `deploy/scripts/actualizar-talento360.sh`:

1. **Funcionamiento:**
   - Bloqueo de concurrencia mediante `flock`.
   - Generación automática de respaldo binario (`pg_dump -Fc`) y verificación de integridad previa.
   - Bloqueo preventivo ante cambios en esquemas SQL o Compose (requiere revisión manual).
   - Reconstrucción de microservicios con `--no-deps` para nunca reiniciar ni recrear PostgreSQL.
   - Verificación de respuesta HTTP en `http://127.0.0.1/` con rollback automático si el frontend falla.

Para habilitar la actualización automatizada con temporizadores del sistema operativo, consulta la [Guía de Despliegue](deploy/README.md).

---

## 12. Copias de Seguridad y Restauración

### Generar Respaldo Manual:
```bash
docker exec talento360_db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > respaldo_talento360.dump
```

### Restauración Segura:
Consulte la [Guía de Mantenimiento](docs/MANTENIMIENTO.md) para el protocolo de aislamiento previo en base de datos temporal y restauración definitiva.

---

## 13. Seguridad y Control de Acceso (RBAC)

* **Hashing:** Bcrypt cost factor 12 con mitigación de ataques de temporización.
* **Cookies de Sesión:** Token JWT en cookie `HttpOnly; SameSite=Lax` para neutralizar ataques XSS.
* **Permisos Granulares:** Validación de capacidades operativas (`employees:write`, `viaticos:write`, etc.) en cada endpoint, desacoplada de nombres de usuario.
* **Protección contra Inyección de Fórmulas:** Sanitización estricta de caracteres de disparo (`=`, `+`, `-`, `@`) en exportaciones de Excel (CWE-1236).
* **Protección de Datos:** Claves foráneas configuradas con `ON DELETE RESTRICT` para evitar pérdidas accidentales de trazabilidad histórica.

Para mayores detalles, consulta el documento de [Políticas de Seguridad](docs/SEGURIDAD.md).

---

## 14. Auditoría y Validación Técnica

Durante el ciclo de desarrollo se llevaron a cabo múltiples auditorías técnicas independientes y exhaustivas que constituyen evidencia verificable del aseguramiento de calidad del software:
* **Matriz de Operaciones RBAC:** 15 de 15 operaciones CRUD transversales aprobadas (`tests/rbac_matrix.test.js`).
* **Validación de Fechas y Duración:** 12 casos de cálculo de comisiones y algoritmos de parsing superados (`tests/viaticos_dates.test.js`).
* **Conciliación Censal:** Censo institucional conciliado sin registros duplicados ni dependencias huérfanas.
* **Protección Cascade:** Verificación de bloqueo ante intentos de eliminación de entidades con relaciones activas.

> **Nota de Transparencia:** Las auditorías realizadas certifican la validación técnica y correctiva del código fuente y su base de datos. No constituyen certificación institucional oficial, la cual corresponde a los órganos de control y seguridad de la información de la Gobernación de Boyacá.

---

## 15. Mantenimiento y Continuidad Técnica

El desarrollador o administrador de sistemas que reciba este proyecto cuenta con documentación estandarizada y modular:
* Arquitectura técnica detallada: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
* Guía de instalación desde cero: [`docs/INSTALACION.md`](docs/INSTALACION.md).
* Guía de despliegue on-premise: [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).
* Guía de despliegue continuo en nube (GitHub `main` + Vercel + Render + Neon): [`docs/DEPLOY_VERCEL_RENDER_NEON.md`](docs/DEPLOY_VERCEL_RENDER_NEON.md).
* Manual de mantenimiento y backups: [`docs/MANTENIMIENTO.md`](docs/MANTENIMIENTO.md).
* Solución de problemas comunes: [`docs/SOLUCION_PROBLEMAS.md`](docs/SOLUCION_PROBLEMAS.md).
* Inventario de archivos históricos archivados: `Adicionales/Inventario_Adicionales.md` (archivo local).

---

## 16. Estado del Proyecto

**Sistema desarrollado y con auditoría correctiva técnica finalizada, preparado para revisión y aprobación institucional antes de su puesta en operación formal.**
