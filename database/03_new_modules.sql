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
    tipo_destino      VARCHAR(30)   NOT NULL DEFAULT 'Nacional',
    soporte           TEXT,
    creado_en         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_viaticos_estado     ON viaticos(estado);
CREATE INDEX IF NOT EXISTS idx_viaticos_dependencia ON viaticos(dependencia);
CREATE INDEX IF NOT EXISTS idx_viaticos_documento   ON viaticos(documento);

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
    creado_en         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
