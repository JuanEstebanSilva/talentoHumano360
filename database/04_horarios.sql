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

-- ============================================================

-- SEED DATA: MÓDULO DE HORARIOS (Basado en Servidores Públicos)

-- ============================================================

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000002', 'TORRES RIVERA CARLOS ANDRÉS', 'DIRECCIÓN DE TALENTO HUMANO', 'COORDINADOR DE ÁREA', 'Teletrabajo', 'Activa',
    '2026-02-01'::date, '2026-12-31'::date, '11 meses', 228, 'Hábiles',
    'RES-2026-5555', '2026-01-20'::date, '2026-01-22'::date, 'Angela Ussa',
    'Suplementario (Híbrido)', 'Martes, Jueves', 'Lunes, Miércoles, Viernes', 'Calle 18 # 11-45, Tunja, Boyacá',
    TRUE, '2026-01-25'::date, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Acuerdo voluntario de teletrabajo concertado con la Dirección de Talento Humano bajo Decreto 1227 de 2022.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000002' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-02-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000002' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-02-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000001', 'MARTÍNEZ PÉREZ LAURA', 'DESPACHO DEL GOBERNADOR', 'PROFESIONAL UNIVERSITARIO', 'Presencial', 'Activa',
    '2026-01-01'::date, '2026-12-31'::date, '1 año', 246, 'Hábiles',
    'RES-2026-0999', '2025-12-28'::date, '2025-12-29'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '2 horas', NULL, 'Jornada ordinaria en sede central Palacio de la Torre de la Gobernación de Boyacá.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000001' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000001' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000003', 'ROJAS GÓMEZ DIANA CAROLINA', 'SECRETARÍA DE HACIENDA', 'TÉCNICO ADMINISTRATIVO', 'Teletrabajo', 'Activa',
    '2026-01-15'::date, '2026-11-30'::date, '10 meses y 15 días', 215, 'Hábiles',
    'RES-2026-0312', '2026-01-10'::date, '2026-01-12'::date, 'Angela Ussa',
    'Suplementario (Híbrido)', 'Miércoles, Viernes', 'Lunes, Martes, Jueves', 'Carrera 10 # 22-15, Duitama, Boyacá',
    TRUE, '2026-01-14'::date, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Esquema suplementario con atención presencial de tesorería y recaudo los días asignados.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000003' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-01-15'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000003' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-01-15'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000004', 'MORENO SUÁREZ JUAN SEBASTIÁN', 'OFICINA JURÍDICA', 'ASESOR JURÍDICO', 'Presencial', 'Activa',
    '2026-01-01'::date, '2026-12-31'::date, '1 año', 246, 'Hábiles',
    'RES-2026-0105', '2025-12-30'::date, '2025-12-31'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '2 horas', NULL, 'Jornada presencial institucional para sustanciación de audiencias y conceptos jurídicos.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000004' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000004' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000005', 'GÓMEZ RUIZ PAULA ANDREA', 'SECRETARÍA DE SALUD', 'PROFESIONAL UNIVERSITARIO', 'Horario flexible', 'Activa',
    '2026-01-15'::date, '2026-12-31'::date, '11 meses y 15 días', 236, 'Hábiles',
    'RES-2026-0048', '2026-01-10'::date, '2026-01-12'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, '07:00 - 08:30', '16:00 - 17:30', 40,
    '1 hora', 'Cuidado de familiar en primer grado de consanguinidad y estudios de posgrado en salud pública.', 'Aprobado según lineamientos de bienestar y flexibilización laboral de la Gobernación de Boyacá.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000005' AND modalidad = 'Horario flexible' AND fecha_inicio = '2026-01-15'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000005' AND modalidad = 'Horario flexible' AND fecha_inicio = '2026-01-15'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000006', 'CASTRO DÍAZ MIGUEL ÁNGEL', 'SECRETARÍA DE EDUCACIÓN', 'COORDINADOR DE ÁREA', 'Presencial', 'Activa',
    '2026-01-10'::date, '2026-12-31'::date, '11 meses y 21 días', 240, 'Hábiles',
    'RES-2026-0022', '2026-01-05'::date, '2026-01-08'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '2 horas', NULL, 'Coordinación presencial de supervisión educativa y administración de planta docente.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000006' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-10'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000006' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-10'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000007', 'SILVA PARRA NATALIA FERNANDA', 'DIRECCIÓN DE TALENTO HUMANO', 'PROFESIONAL UNIVERSITARIO', 'Trabajo en casa', 'Activa',
    '2026-03-01'::date, '2026-08-31'::date, '6 meses', 125, 'Hábiles',
    'RES-2026-0210', '2026-02-24'::date, '2026-02-26'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, 'Situación de salud temporal certificada por EPS y recuperación médica (Ley 2088 de 2021).', 'Calle 24 # 9-60, Sogamoso, Boyacá',
    'Equipo institucional portátil verificado por TIC y acceso a red VPN corporativa.', FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Habilitación transitoria conforme a lineamientos de salud ocupacional de la ARL.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000007' AND modalidad = 'Trabajo en casa' AND fecha_inicio = '2026-03-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000007' AND modalidad = 'Trabajo en casa' AND fecha_inicio = '2026-03-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000008', 'VARGAS PEÑA ANDRÉS FELIPE', 'SECRETARÍA DE INFRAESTRUCTURA PÚBLICA', 'PROFESIONAL ESPECIALIZADO', 'Teletrabajo', 'Activa',
    '2026-01-15'::date, '2027-01-14'::date, '1 año', 246, 'Hábiles',
    'RES-2026-0198', '2026-01-08'::date, '2026-01-10'::date, 'Angela Ussa',
    'Autónomo', 'Lunes, Martes, Miércoles, Jueves, Viernes', 'Sin días presenciales fijos (trabajo por entregables de interventoría)', 'Manzana B Casa 4, Sogamoso, Boyacá',
    TRUE, '2026-01-12'::date, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Teletrabajador autónomo con plan de trabajo por hitos y entregables de supervisión técnica de obras.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000008' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-01-15'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000008' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-01-15'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000009', 'RODRÍGUEZ NIÑO MARÍA CAMILA', 'SECRETARÍA GENERAL', 'PROFESIONAL UNIVERSITARIO', 'Horario flexible', 'Activa',
    '2026-02-01'::date, '2026-11-30'::date, '10 meses', 208, 'Hábiles',
    'RES-2026-0344', '2026-01-25'::date, '2026-01-28'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, '07:30 - 08:30', '16:30 - 17:30', 40,
    '1 hora', 'Estudios de posgrado en Derecho Administrativo en jornada nocturna en la UPTC.', 'Cumplimiento estricto de 8 horas diarias de servicio efectivo.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000009' AND modalidad = 'Horario flexible' AND fecha_inicio = '2026-02-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000009' AND modalidad = 'Horario flexible' AND fecha_inicio = '2026-02-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000010', 'HERRERA LÓPEZ SANTIAGO', 'SECRETARÍA DE HACIENDA', 'PROFESIONAL ESPECIALIZADO', 'Presencial', 'Activa',
    '2026-01-01'::date, '2026-12-31'::date, '1 año', 246, 'Hábiles',
    'RES-2026-0018', '2025-12-28'::date, '2025-12-30'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '2 horas', NULL, 'Atención presencial en ventanilla de rentas departamentales y liquidación de impuestos.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000010' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000010' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000011', 'PARDO RUIZ VALENTINA', 'SECRETARÍA DE CULTURA Y PATRIMONIO', 'PROFESIONAL UNIVERSITARIO', 'Teletrabajo', 'Activa',
    '2026-02-15'::date, '2026-12-15'::date, '10 meses', 205, 'Hábiles',
    'RES-2026-0415', '2026-02-10'::date, '2026-02-12'::date, 'Angela Ussa',
    'Suplementario (Híbrido)', 'Lunes, Miércoles', 'Martes, Jueves, Viernes', 'Carrera 6 # 13-40, Villa de Leyva, Boyacá',
    TRUE, '2026-02-14'::date, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Gestión y coordinación de convocatorias culturales departamentales y concertación de estímulos.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000011' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-02-15'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000011' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-02-15'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000012', 'CÁRDENAS LÓPEZ JORGE IVÁN', 'SECRETARÍA DE INFRAESTRUCTURA PÚBLICA', 'COORDINADOR DE ÁREA', 'Presencial', 'Activa',
    '2026-01-01'::date, '2026-12-31'::date, '1 año', 246, 'Hábiles',
    'RES-2026-0012', '2025-12-29'::date, '2025-12-31'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '2 horas', NULL, 'Coordinación presencial de interventorías de obra pública y atención de emergencias viales.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000012' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000012' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000013', 'PRIETO GARCÍA MÓNICA ALEJANDRA', 'OFICINA JURÍDICA', 'ASESOR JURÍDICO', 'Teletrabajo', 'Activa',
    '2026-03-01'::date, '2026-12-31'::date, '10 meses', 206, 'Hábiles',
    'RES-2026-0480', '2026-02-25'::date, '2026-02-27'::date, 'Angela Ussa',
    'Suplementario (Híbrido)', 'Martes, Jueves', 'Lunes, Miércoles, Viernes', 'Calle 21 # 9-80, Tunja, Boyacá',
    TRUE, '2026-02-28'::date, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Elaboración de proyectos de decretos, resoluciones y respuestas a acciones de tutela.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000013' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-03-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000013' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-03-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000014', 'SUÁREZ MEJÍA DANIEL ESTEBAN', 'SECRETARÍA DE DESARROLLO EMPRESARIAL', 'TÉCNICO ADMINISTRATIVO', 'Presencial', 'Activa',
    '2026-01-01'::date, '2026-12-31'::date, '1 año', 246, 'Hábiles',
    'RES-2026-0014', '2025-12-28'::date, '2025-12-30'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '2 horas', NULL, 'Atención a empresarios, emprendedores y ventanilla de programas de competitividad.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000014' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000014' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000015', 'NIÑO CORTÉS CLAUDIA PATRICIA', 'SECRETARÍA DE TURISMO', 'PROFESIONAL UNIVERSITARIO', 'Horario flexible', 'Activa',
    '2026-01-15'::date, '2026-12-31'::date, '11 meses y 15 días', 236, 'Hábiles',
    'RES-2026-0088', '2026-01-10'::date, '2026-01-12'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, '07:00 - 08:00', '16:00 - 17:00', 40,
    '1 hora', 'Madre cabeza de hogar con hijos menores en edad preescolar.', 'Horario escalonado concertado para favorecer la conciliación de vida familiar y laboral.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000015' AND modalidad = 'Horario flexible' AND fecha_inicio = '2026-01-15'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000015' AND modalidad = 'Horario flexible' AND fecha_inicio = '2026-01-15'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000017', 'MORENO CASTRO FELIPE ANDRÉS', 'SECRETARÍA DE AMBIENTE Y DESARROLLO SOSTENIBLE', 'PROFESIONAL ESPECIALIZADO', 'Teletrabajo', 'Activa',
    '2026-02-01'::date, '2026-12-31'::date, '11 meses', 228, 'Hábiles',
    'RES-2026-0222', '2026-01-26'::date, '2026-01-28'::date, 'Angela Ussa',
    'Suplementario (Híbrido)', 'Lunes, Jueves', 'Martes, Miércoles, Viernes', 'Avenida Universitaria # 45-20, Tunja, Boyacá',
    TRUE, '2026-01-30'::date, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Evaluación y estructuración de proyectos de mitigación del cambio climático y reforestación.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000017' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-02-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000017' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-02-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000019', 'PÁEZ SOTO CAMILO ANDRÉS', 'SECRETARÍA DE AGRICULTURA', 'PROFESIONAL ESPECIALIZADO', 'Presencial', 'Activa',
    '2026-01-01'::date, '2026-12-31'::date, '1 año', 246, 'Hábiles',
    'RES-2026-0019', '2025-12-28'::date, '2025-12-30'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '2 horas', NULL, 'Coordinación presencial de asistencia técnica agropecuaria y cadenas productivas.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000019' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000019' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000020', 'BERNAL REYES LUCÍA FERNANDA', 'SECRETARÍA DE GOBIERNO Y ACCIÓN COMUNAL', 'PROFESIONAL UNIVERSITARIO', 'Trabajo en casa', 'Activa',
    '2026-04-01'::date, '2026-09-30'::date, '6 meses', 124, 'Hábiles',
    'RES-2026-0390', '2026-03-25'::date, '2026-03-27'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, 'Condición médica post-quirúrgica certificada por EPS y prescripción de reposo relativo.', 'Calle 15 # 10-25, Paipa, Boyacá',
    'Equipo institucional portátil y acceso a correo corporativo.', FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Trabajo transitorio bajo Ley 2088 de 2021 con entregables semanales de seguimiento comunal.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000020' AND modalidad = 'Trabajo en casa' AND fecha_inicio = '2026-04-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000020' AND modalidad = 'Trabajo en casa' AND fecha_inicio = '2026-04-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000022', 'MORALES NIÑO JUAN PABLO', 'SECRETARÍA GENERAL', 'SECRETARIO DE DESPACHO', 'Presencial', 'Activa',
    '2026-01-01'::date, '2026-12-31'::date, '1 año', 246, 'Hábiles',
    'RES-2026-0001', '2025-12-28'::date, '2025-12-29'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '2 horas', NULL, 'Dirección administrativa general institucional de la Gobernación de Boyacá.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000022' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000022' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000024', 'MÉNDEZ ROJAS LAURA CAMILA', 'SECRETARÍA DE PLANEACIÓN', 'SECRETARIO DE DESPACHO', 'Presencial', 'Activa',
    '2026-01-01'::date, '2026-12-31'::date, '1 año', 246, 'Hábiles',
    'RES-2026-0002', '2025-12-28'::date, '2025-12-29'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '2 horas', NULL, 'Dirección de planeación departamental, seguimiento al Plan de Desarrollo y regalías.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000024' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000024' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000025', 'TORRES RIVERA DIANA MARCELA', 'SECRETARÍA DE GOBIERNO Y ACCIÓN COMUNAL', 'COORDINADOR DE ÁREA', 'Presencial', 'Activa',
    '2026-01-01'::date, '2026-12-31'::date, '1 año', 246, 'Hábiles',
    'RES-2026-0025', '2025-12-28'::date, '2025-12-30'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '2 horas', NULL, 'Coordinación presencial de mesas de orden público y derechos humanos.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000025' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000025' AND modalidad = 'Presencial' AND fecha_inicio = '2026-01-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1051064446', 'JUAN ESTEBAN SILVA E', 'DESPACHO DEL GOBERNADOR', 'ANALISTA DE SISTEMAS', 'Teletrabajo', 'Activa',
    '2026-01-15'::date, '2026-12-31'::date, '11 meses y 15 días', 236, 'Hábiles',
    'RES-2026-0112', '2026-01-10'::date, '2026-01-12'::date, 'Angela Ussa',
    'Suplementario (Híbrido)', 'Lunes, Miércoles, Viernes', 'Martes, Jueves', 'Calle 19 # 8-32, Tunja, Boyacá',
    TRUE, '2026-01-14'::date, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Desarrollo, aseguramiento tecnológico y modernización de la plataforma Talento 360.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1051064446' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-01-15'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1051064446' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2026-01-15'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1003481573', 'ROMERO MARIN IVAN DARIO', 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'PROFESIONAL UNIVERSITARIO', 'Horario flexible', 'Activa',
    '2026-01-15'::date, '2026-12-31'::date, '11 meses y 15 días', 236, 'Hábiles',
    'RES-2026-0145', '2026-01-10'::date, '2026-01-12'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, NULL, NULL,
    NULL, FALSE, '07:00 - 08:30', '16:00 - 17:30', 40,
    '1 hora', 'Atención y seguimiento a inspecciones en campo del sistema de gestión SST y pausas activas.', 'Esquema flexible concertado con la Subdirección de SST de la Gobernación.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1003481573' AND modalidad = 'Horario flexible' AND fecha_inicio = '2026-01-15'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Activa', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1003481573' AND modalidad = 'Horario flexible' AND fecha_inicio = '2026-01-15'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '79850123', 'GARCIA MARTINEZ LUIS FERNANDO', 'SECRETARÍA DE HACIENDA', 'PROFESIONAL UNIVERSITARIO', 'Teletrabajo', 'Caducada',
    '2025-02-01'::date, '2025-12-31'::date, '11 meses', 228, 'Hábiles',
    'RES-2025-0115', '2025-01-20'::date, '2025-01-22'::date, 'Angela Ussa',
    'Suplementario (Híbrido)', 'Martes, Jueves', 'Lunes, Miércoles, Viernes', 'Calle 18 # 11-45, Tunja, Boyacá',
    TRUE, '2025-01-25'::date, NULL, NULL,
    NULL, FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Esquema vencido en vigencia anterior. Registrado en histórico para trazabilidad institucional.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '79850123' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2025-02-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Caducada', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '79850123' AND modalidad = 'Teletrabajo' AND fecha_inicio = '2025-02-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

INSERT INTO horarios (
    documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
    fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
    numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
    subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral,
    notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa, direccion_trabajo_casa,
    herramientas_tic, prorroga, franja_ingreso, franja_salida, horas_semanales,
    tiempo_almuerzo, justificacion_flex, observaciones, creado_por
)
SELECT
    '1000000009', 'RODRÍGUEZ NIÑO MARÍA CAMILA', 'SECRETARÍA GENERAL', 'PROFESIONAL UNIVERSITARIO', 'Trabajo en casa', 'Caducada',
    '2025-10-01'::date, '2026-01-01'::date, '3 meses', 64, 'Hábiles',
    'RES-2025-0740', '2025-09-25'::date, '2025-09-28'::date, 'Angela Ussa',
    NULL, NULL, NULL, NULL,
    FALSE, NULL, 'Condición de salud transitoria superada favorablemente.', 'Carrera 7 # 14-30, Duitama, Boyacá',
    'Equipo propio verificado por TIC', FALSE, NULL, NULL, 40,
    '1 hora', NULL, 'Vigencia culminada. Retorno automático a modalidad presencial aplicado.', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE documento = '1000000009' AND modalidad = 'Trabajo en casa' AND fecha_inicio = '2025-10-01'::date LIMIT 1);

INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
SELECT id_horario, 'Asignación Inicial de Esquema', NULL, 'Caducada', 'Registro inicial formal de esquema de jornada laboral mediante resolución administrativa', 'admin'
FROM horarios
WHERE documento = '1000000009' AND modalidad = 'Trabajo en casa' AND fecha_inicio = '2025-10-01'::date
  AND NOT EXISTS (SELECT 1 FROM historial_horarios WHERE historial_horarios.id_horario = horarios.id_horario);

