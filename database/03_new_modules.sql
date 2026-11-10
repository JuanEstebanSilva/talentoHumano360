-- ─────────────────────────────────────────────────────────────────────────────
-- Talento 360 — Módulos Nuevos
-- Script: 03_new_modules.sql
-- Descripción: Tablas para los módulos Viáticos y Gestión de Solicitudes
--              Administrativas (Permisos, Incapacidades, Licencias)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Tabla: viaticos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS viaticos (
    id_viatico        SERIAL PRIMARY KEY,
    dependencia       VARCHAR(280),
    apellidos_nombres VARCHAR(280),
    documento         VARCHAR(60),
    cargo             VARCHAR(280),
    destino           VARCHAR(280)  NOT NULL DEFAULT 'SIN ESPECIFICAR',
    motivo            VARCHAR(500),
    fecha_inicio      VARCHAR(80),
    fecha_fin         VARCHAR(80),
    dias              INTEGER       NOT NULL DEFAULT 1,
    valor_diario      NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_total       NUMERIC(15,2),
    estado            VARCHAR(80)   NOT NULL DEFAULT 'Pendiente',
    observaciones     VARCHAR(500),
    fecha_solicitud   VARCHAR(80),
    aprobado_por      VARCHAR(160),
    numero_resolucion VARCHAR(120),
    saldo             NUMERIC(15,2),
    tipo_destino      VARCHAR(30)   NOT NULL DEFAULT 'Nacional',
    soporte           TEXT,
    creado_en         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_viaticos_estado     ON viaticos(estado);
CREATE INDEX IF NOT EXISTS idx_viaticos_dependencia ON viaticos(dependencia);
CREATE INDEX IF NOT EXISTS idx_viaticos_documento   ON viaticos(documento);
CREATE INDEX IF NOT EXISTS idx_viaticos_resolucion  ON viaticos(numero_resolucion);

-- ─── Tabla: solicitudes_admin ─────────────────────────────────────────────────
-- Contiene Permisos Laborales, Incapacidades y Licencias
CREATE TABLE IF NOT EXISTS solicitudes_admin (
    id_solicitud      SERIAL PRIMARY KEY,
    tipo              VARCHAR(80)   NOT NULL CHECK (tipo IN ('Permiso Laboral', 'Incapacidad', 'Licencia')),
    dependencia       VARCHAR(280),
    apellidos_nombres VARCHAR(280),
    documento         VARCHAR(60),
    cargo             VARCHAR(280),
    fecha_inicio      VARCHAR(80),
    fecha_fin         VARCHAR(80),
    dias_solicitados  INTEGER       NOT NULL DEFAULT 1,
    motivo            VARCHAR(500),
    estado            VARCHAR(80)   NOT NULL DEFAULT 'Pendiente',
    observaciones     VARCHAR(500),
    fecha_solicitud   VARCHAR(80),
    aprobado_por      VARCHAR(160),
    nota_gestion      VARCHAR(500),
    -- Campos extendidos Formulario Permisos Laborales (CamposFormulario.xlsx)
    correo_solicitante   VARCHAR(200),
    codigo               VARCHAR(80),
    grado                VARCHAR(80),
    sectorial            VARCHAR(200),
    nivel                VARCHAR(80),
    modalidad            VARCHAR(20),
    jornada              VARCHAR(40),
    hora_entrada         VARCHAR(5),
    hora_salida          VARCHAR(5),
    horas_solicitadas    NUMERIC(5,2),
    motivo_categoria     VARCHAR(40),
    motivo_incentivo     VARCHAR(40),
    jefe_nombre          VARCHAR(200),
    jefe_correo          VARCHAR(200),
    registrado_por       VARCHAR(120),
    notificacion_estado  VARCHAR(20) DEFAULT 'pendiente',
    notificacion_detalle VARCHAR(500),
    notificacion_fecha   TIMESTAMP,
    -- Campos extendidos Formato 9. INCAPACIDADES SST (E-DO-ST-F-002 Versión 2)
    fecha_radicacion     VARCHAR(80),
    sede                 VARCHAR(200),
    eps                  VARCHAR(120),
    prorroga             VARCHAR(10) DEFAULT 'NO',
    causa_motivo         VARCHAR(200),
    codigo_cie10         VARCHAR(80),
    salario              NUMERIC(15,2) DEFAULT 0,
    descuento            NUMERIC(15,2) DEFAULT 0,
    acto_administrativo  VARCHAR(150),
    creado_en         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Soportes adjuntos de solicitudes_admin
CREATE TABLE IF NOT EXISTS solicitudes_admin_soportes (
    id_soporte     SERIAL PRIMARY KEY,
    id_solicitud   INTEGER NOT NULL REFERENCES solicitudes_admin(id_solicitud) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_mime      VARCHAR(80)  NOT NULL,
    tamano_bytes   INTEGER      NOT NULL,
    contenido      BYTEA        NOT NULL,
    subido_por     VARCHAR(120),
    creado_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sol_admin_soportes_sol ON solicitudes_admin_soportes(id_solicitud);

CREATE INDEX IF NOT EXISTS idx_sol_admin_tipo        ON solicitudes_admin(tipo);
CREATE INDEX IF NOT EXISTS idx_sol_admin_estado      ON solicitudes_admin(estado);
CREATE INDEX IF NOT EXISTS idx_sol_admin_dependencia ON solicitudes_admin(dependencia);
CREATE INDEX IF NOT EXISTS idx_sol_admin_documento   ON solicitudes_admin(documento);

-- ─── Historial de solicitudes_admin ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historial_solicitudes_admin (
    id_historial     SERIAL PRIMARY KEY,
    id_solicitud     INTEGER NOT NULL REFERENCES solicitudes_admin(id_solicitud) ON DELETE CASCADE,
    estado_nuevo     VARCHAR(80) NOT NULL,
    nota             VARCHAR(500) NOT NULL DEFAULT 'Cambio realizado desde la interfaz web',
    actualizado_por  VARCHAR(120) NOT NULL DEFAULT CURRENT_USER,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── Historial de viáticos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historial_viaticos (
    id_historial     SERIAL PRIMARY KEY,
    id_viatico       INTEGER NOT NULL REFERENCES viaticos(id_viatico) ON DELETE CASCADE,
    estado_nuevo     VARCHAR(80) NOT NULL,
    nota             VARCHAR(500) NOT NULL DEFAULT 'Cambio realizado desde la interfaz web',
    actualizado_por  VARCHAR(120) NOT NULL DEFAULT CURRENT_USER,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tablas transaccionales de viaticos y solicitudes_admin inician vacías para producción.

-- ─── Tablas de Gobernanza, Responsables por Módulo, Auditoría Inmutable y Documentos Institucionales ───
CREATE TABLE IF NOT EXISTS modulo_responsables (
    id_asignacion         SERIAL PRIMARY KEY,
    modulo                VARCHAR(60)  NOT NULL,
    username              VARCHAR(120) NOT NULL,
    nombre_responsable    VARCHAR(200) NOT NULL,
    cargo_responsable     VARCHAR(200) DEFAULT 'Profesional / Responsable de Módulo',
    correo_notificacion   VARCHAR(200),
    documento_responsable VARCHAR(60),
    activo                BOOLEAN      NOT NULL DEFAULT TRUE,
    puede_aprobar         BOOLEAN      NOT NULL DEFAULT TRUE,
    puede_importar        BOOLEAN      NOT NULL DEFAULT TRUE,
    puede_exportar        BOOLEAN      NOT NULL DEFAULT TRUE,
    asignado_por          VARCHAR(120) DEFAULT 'Sistema',
    actualizado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (modulo, username)
);
CREATE INDEX IF NOT EXISTS idx_mod_resp_modulo ON modulo_responsables(modulo);
CREATE INDEX IF NOT EXISTS idx_mod_resp_user   ON modulo_responsables(LOWER(username));

CREATE TABLE IF NOT EXISTS auditoria_modulos (
    id_auditoria         SERIAL PRIMARY KEY,
    modulo               VARCHAR(60)  NOT NULL,
    id_registro          VARCHAR(80)  NOT NULL,
    radicado             VARCHAR(100),
    usuario_responsable  VARCHAR(160) NOT NULL,
    nombre_usuario       VARCHAR(200),
    rol_usuario          VARCHAR(80),
    tipo_operacion       VARCHAR(60)  NOT NULL,
    valores_anteriores   JSONB,
    valores_nuevos       JSONB,
    observaciones        TEXT,
    fecha_hora           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_aud_mod_modulo ON auditoria_modulos(modulo);
CREATE INDEX IF NOT EXISTS idx_aud_mod_reg    ON auditoria_modulos(modulo, id_registro);
CREATE INDEX IF NOT EXISTS idx_aud_mod_fecha  ON auditoria_modulos(fecha_hora DESC);

CREATE TABLE IF NOT EXISTS documentos_institucionales (
    id_documento         SERIAL PRIMARY KEY,
    modulo               VARCHAR(60)  NOT NULL,
    codigo_formato       VARCHAR(80),
    nombre               VARCHAR(255) NOT NULL,
    descripcion          TEXT,
    categoria            VARCHAR(100) DEFAULT 'Formato Institucional',
    version_actual       VARCHAR(30)  NOT NULL DEFAULT '1.0',
    nombre_archivo       VARCHAR(255) NOT NULL,
    tipo_mime            VARCHAR(120) NOT NULL,
    tamano_bytes         INTEGER      NOT NULL DEFAULT 0,
    contenido            BYTEA        NOT NULL,
    subido_por           VARCHAR(160) DEFAULT 'Sistema',
    fecha_carga          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activo               BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_doc_inst_modulo ON documentos_institucionales(modulo);

CREATE TABLE IF NOT EXISTS documentos_institucionales_versiones (
    id_version           SERIAL PRIMARY KEY,
    id_documento         INTEGER      NOT NULL REFERENCES documentos_institucionales(id_documento) ON DELETE CASCADE,
    version              VARCHAR(30)  NOT NULL,
    nombre_archivo       VARCHAR(255) NOT NULL,
    tipo_mime            VARCHAR(120) NOT NULL,
    tamano_bytes         INTEGER      NOT NULL DEFAULT 0,
    contenido            BYTEA        NOT NULL,
    observacion_cambio   TEXT,
    subido_por           VARCHAR(160) DEFAULT 'Sistema',
    fecha_version        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_doc_ver_doc ON documentos_institucionales_versiones(id_documento);
