-- ─────────────────────────────────────────────────────────────────────────────
-- Talento 360 — Módulo de Horarios y Modalidades de Trabajo
-- Script: 04_horarios.sql
-- Descripción: Tablas para la gestión de esquemas de horarios asignados a
--              usuarios (Presencial, Teletrabajo, Trabajo en casa, Horario flexible)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Tabla: horarios ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS horarios (
    id_horario            SERIAL PRIMARY KEY,
    documento             VARCHAR(60)   NOT NULL,
    apellidos_nombres     VARCHAR(280)  NOT NULL,
    dependencia           VARCHAR(280)  NOT NULL DEFAULT 'SECRETARÍA GENERAL',
    cargo                 VARCHAR(280)  NOT NULL DEFAULT 'PROFESIONAL UNIVERSITARIO',
    modalidad             VARCHAR(60)   NOT NULL CHECK (modalidad IN ('Presencial', 'Teletrabajo', 'Trabajo en casa', 'Horario flexible')),
    estado                VARCHAR(80)   NOT NULL DEFAULT 'Activa',
    
    -- REQ-026 & REQ-027: Duración y Fechas
    fecha_inicio          DATE          NOT NULL,
    fecha_fin             DATE,
    duracion_texto        VARCHAR(120),  -- e.g. "1 año, 2 meses y 15 días"
    duracion_dias         INTEGER       NOT NULL DEFAULT 1,
    tipo_calculo          VARCHAR(30)   NOT NULL DEFAULT 'Hábiles' CHECK (tipo_calculo IN ('Hábiles', 'Habiles', 'Calendario')),
    
    -- REQ-028: Metadata administrativa
    numero_resolucion     VARCHAR(120),  -- e.g. "RES-2026-0412"
    fecha_aprobacion      DATE,
    fecha_notificacion    DATE,
    aprobado_por          VARCHAR(180)  DEFAULT 'Angela Ussa',
    soporte_acto          TEXT,
    
    -- REQ-023: Campos dinámicos para Teletrabajo (Ley 1221 de 2008 / Dec. 1227 de 2022)
    subtipo_teletrabajo   VARCHAR(80),   -- 'Suplementario (Híbrido)', 'Autónomo', 'Móvil'
    dias_teletrabajo      VARCHAR(200),  -- e.g. "Lunes, Miércoles"
    dias_presencial       VARCHAR(200),  -- e.g. "Martes, Jueves, Viernes"
    domicilio_laboral     VARCHAR(300),  -- Dirección para ARL
    notificacion_arl      BOOLEAN       DEFAULT FALSE,
    fecha_reporte_arl     DATE,
    
    -- REQ-023: Campos dinámicos para Trabajo en casa (Ley 2088 de 2021)
    motivo_trabajo_casa   VARCHAR(500),  -- Justificación excepcional o transitoria
    direccion_trabajo_casa VARCHAR(300),
    herramientas_tic      VARCHAR(300),  -- Equipos propios / suministrados
    prorroga              BOOLEAN       DEFAULT FALSE,
    
    -- REQ-023: Campos dinámicos para Horario flexible
    franja_ingreso        VARCHAR(50),   -- e.g. "07:00 - 08:30"
    franja_salida         VARCHAR(50),   -- e.g. "16:30 - 18:00"
    horas_semanales       INTEGER       DEFAULT 40,
    tiempo_almuerzo       VARCHAR(50)   DEFAULT '1 hora',
    justificacion_flex    VARCHAR(500),  -- Cuidado de hijos, estudio, condición de salud
    
    -- Observaciones y auditoría
    observaciones         VARCHAR(500),
    creado_por            VARCHAR(120)  DEFAULT 'admin',
    creado_en             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_horarios_doc       ON horarios(documento);
CREATE INDEX IF NOT EXISTS idx_horarios_modalidad ON horarios(modalidad);
CREATE INDEX IF NOT EXISTS idx_horarios_estado    ON horarios(estado);
CREATE INDEX IF NOT EXISTS idx_horarios_fechas    ON horarios(fecha_inicio, fecha_fin);

-- ─── Tabla: historial_horarios ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historial_horarios (
    id_historial        SERIAL PRIMARY KEY,
    id_horario          INTEGER NOT NULL REFERENCES horarios(id_horario) ON DELETE CASCADE,
    accion              VARCHAR(120) NOT NULL,
    estado_anterior     VARCHAR(80),
    estado_nuevo        VARCHAR(80),
    nota                VARCHAR(500),
    actualizado_por     VARCHAR(120) NOT NULL DEFAULT 'Sistema',
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hist_horarios_id ON historial_horarios(id_horario);

-- Tablas transaccionales de horarios e historial_horarios inician vacías para producción.

