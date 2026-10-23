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
    valor_total       NUMERIC(15,2) GENERATED ALWAYS AS (dias * valor_diario) STORED,
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
