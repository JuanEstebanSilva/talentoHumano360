-- ─────────────────────────────────────────────────────────────────────────────
-- Talento 360 — Módulo de Seguridad y Salud en el Trabajo (SST)
-- Script: 10_sst_module.sql
-- Descripción: Esquema para los tres formatos oficiales de la Subdirección de
--              Seguridad y Salud en el Trabajo (Gobernación de Boyacá):
--              1. Perfil Epidemiológico y EMO (Código E-DO-ST-F-024 V3)
--              2. Entrega de Elementos de Protección Personal - EPP (Código E-DO-ST-F-028 V4)
--              3. Perfil Sociodemográfico (Código E-DO-ST-F-011 V5)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Tabla: sst_perfil_epidemiologico (Formato E-DO-ST-F-024) ─────────────
CREATE TABLE IF NOT EXISTS sst_perfil_epidemiologico (
    id_epidemiologico         SERIAL PRIMARY KEY,
    tipo_identificacion       VARCHAR(60)   NOT NULL DEFAULT 'Cédula de Ciudadanía',
    documento                 VARCHAR(60)   NOT NULL,
    apellidos                 VARCHAR(160)  NOT NULL,
    nombres                   VARCHAR(160)  NOT NULL,
    nombre_completo           VARCHAR(320)  NOT NULL,
    telefono                  VARCHAR(60),
    edad                      INTEGER,
    fecha_ingreso             VARCHAR(60),
    dependencia               VARCHAR(300)  NOT NULL,
    sede_trabajo              VARCHAR(300)  DEFAULT 'CASA DE LA TORRE',
    cargo                     VARCHAR(280),
    fecha_emo                 DATE,
    tipo_emo                  VARCHAR(80)   NOT NULL DEFAULT 'Periódico',
    restricciones             TEXT          DEFAULT 'NINGUNA',
    recomendaciones           TEXT          DEFAULT 'Pausas activas e higiene postural',
    direccionado_pve          VARCHAR(200)  DEFAULT 'No aplica',
    direccionado_eps          VARCHAR(200)  DEFAULT 'No aplica',
    fecha_proximo_emo         DATE,
    accidente_trabajo         VARCHAR(20)   NOT NULL DEFAULT 'NO',
    fecha_accidente           DATE,
    estado_actual_accidente   VARCHAR(250),
    cumplio_rehabilitacion    VARCHAR(15)   DEFAULT 'N/A',
    enfermedad_laboral        VARCHAR(20)   NOT NULL DEFAULT 'NO',
    fecha_enfermedad          DATE,
    estado_actual_enfermedad  VARCHAR(250),
    estado_final_caso         VARCHAR(100)  NOT NULL DEFAULT 'Vigente',
    actividades_pendientes    TEXT,
    soporte                   TEXT,
    creado_por                VARCHAR(120)  DEFAULT 'admin',
    creado_en                 TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sst_epi_doc    ON sst_perfil_epidemiologico(documento);
CREATE INDEX IF NOT EXISTS idx_sst_epi_tipo   ON sst_perfil_epidemiologico(tipo_emo);
CREATE INDEX IF NOT EXISTS idx_sst_epi_estado ON sst_perfil_epidemiologico(estado_final_caso);
CREATE INDEX IF NOT EXISTS idx_sst_epi_dep    ON sst_perfil_epidemiologico(dependencia);

-- ─── 2. Tabla: sst_entrega_epp (Formato E-DO-ST-F-028 / Instructivo E-DO-ST-I-007) ──
CREATE TABLE IF NOT EXISTS sst_entrega_epp (
    id_entrega_epp                SERIAL PRIMARY KEY,
    documento                     VARCHAR(60)   NOT NULL,
    nombre_completo               VARCHAR(320)  NOT NULL,
    telefono                      VARCHAR(60),
    secretaria                    VARCHAR(280)  DEFAULT 'SECRETARIA GENERAL',
    dependencia                   VARCHAR(300)  NOT NULL,
    sede_trabajo                  VARCHAR(300)  DEFAULT 'CASA DE LA TORRE',
    cargo                         VARCHAR(280)  DEFAULT 'PROFESIONAL UNIVERSITARIO',
    tipo_vinculacion              VARCHAR(120)  DEFAULT 'CARRERA ADMINISTRATIVA',
    restricciones_recomendaciones TEXT          DEFAULT 'NINGUNA',
    codigo_elemento               VARCHAR(20)   NOT NULL DEFAULT 'A',
    elemento_epp                  VARCHAR(200)  NOT NULL,
    talla                         VARCHAR(40)   DEFAULT 'N/A',
    cantidad                      VARCHAR(60)   NOT NULL DEFAULT '1 UNIDAD',
    fecha_entrega                 DATE          NOT NULL DEFAULT CURRENT_DATE,
    estado_entrega                VARCHAR(60)   NOT NULL DEFAULT 'Entregado',
    firmado_funcionario           BOOLEAN       DEFAULT TRUE,
    observaciones                 TEXT,
    soporte                       TEXT,
    creado_por                    VARCHAR(120)  DEFAULT 'admin',
    creado_en                     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sst_epp_doc    ON sst_entrega_epp(documento);
CREATE INDEX IF NOT EXISTS idx_sst_epp_elem   ON sst_entrega_epp(codigo_elemento);
CREATE INDEX IF NOT EXISTS idx_sst_epp_estado ON sst_entrega_epp(estado_entrega);

-- ─── 3. Tabla: sst_perfil_sociodemografico (Formato E-DO-ST-F-011) ───────────
CREATE TABLE IF NOT EXISTS sst_perfil_sociodemografico (
    id_sociodemografico   SERIAL PRIMARY KEY,
    tipo_identificacion   VARCHAR(60)   NOT NULL DEFAULT 'Cédula de Ciudadanía',
    documento             VARCHAR(60)   NOT NULL,
    apellidos             VARCHAR(160)  NOT NULL,
    nombres               VARCHAR(160)  NOT NULL,
    nombre_completo       VARCHAR(320)  NOT NULL,
    sexo                  VARCHAR(40)   DEFAULT 'Masculino',
    anio_nacimiento       INTEGER,
    edad                  INTEGER,
    raza_etnia            VARCHAR(80)   DEFAULT 'Blanco/Mestizo',
    estado_civil          VARCHAR(60)   DEFAULT 'Soltero (a)',
    composicion_familiar  VARCHAR(250)  DEFAULT 'Conyuge Permanente, Hijos',
    tipo_vivienda         VARCHAR(60)   DEFAULT 'Propia',
    estrato               VARCHAR(10)   DEFAULT '3',
    municipio_residencia  VARCHAR(120)  DEFAULT 'Tunja',
    municipio_trabajo     VARCHAR(120)  DEFAULT 'Tunja',
    escolaridad           VARCHAR(100)  DEFAULT 'Profesional',
    ocupacion_profesion   VARCHAR(200),
    rango_ingresos        VARCHAR(80)   DEFAULT 'Entre 3 y 6 SMMLV',
    denominacion_cargo    VARCHAR(200)  DEFAULT 'Profesional Universitario',
    tipo_cargo            VARCHAR(80)   DEFAULT 'Profesional',
    tipo_vinculacion      VARCHAR(100)  DEFAULT 'Carrera Administrativa',
    antiguedad_cargo      VARCHAR(80)   DEFAULT 'Entre 1 y 4 años',
    antiguedad_entidad    VARCHAR(80)   DEFAULT 'Entre 1 y 4 años',
    dependencia           VARCHAR(300)  NOT NULL,
    sede_trabajo          VARCHAR(300)  DEFAULT 'CASA DE LA TORRE',
    creado_por            VARCHAR(120)  DEFAULT 'admin',
    creado_en             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sst_soc_doc ON sst_perfil_sociodemografico(documento);
CREATE INDEX IF NOT EXISTS idx_sst_soc_dep ON sst_perfil_sociodemografico(dependencia);

-- ─── 4. Tabla: sst_historial ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sst_historial (
    id_historial    SERIAL PRIMARY KEY,
    submodulo       VARCHAR(60)  NOT NULL,
    id_registro     INTEGER      NOT NULL,
    accion          VARCHAR(120) NOT NULL,
    detalle         VARCHAR(500),
    realizado_por   VARCHAR(120) DEFAULT 'Sistema',
    fecha           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── 5. Datos Iniciales de Referencia Institucional (SST Gobernación) ────────
INSERT INTO sst_perfil_epidemiologico (
    tipo_identificacion, documento, apellidos, nombres, nombre_completo, telefono, edad,
    fecha_ingreso, dependencia, sede_trabajo, cargo, fecha_emo, tipo_emo,
    restricciones, recomendaciones, direccionado_pve, direccionado_eps, fecha_proximo_emo,
    accidente_trabajo, fecha_accidente, estado_actual_accidente, cumplio_rehabilitacion,
    enfermedad_laboral, estado_final_caso, actividades_pendientes
)
SELECT
    'Cédula de Ciudadanía', '1003481573', 'ROMERO MARIN', 'IVAN DARIO', 'ROMERO MARIN IVAN DARIO', '3213938142', 31,
    '2023-02-15', 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE', 'PROFESIONAL UNIVERSITARIO',
    '2026-01-15', 'Periódico', 'NINGUNA', 'Pausas activas visuales y ergonómicas cada 2 horas',
    'PVE Biomecánico / Osteomuscular', 'No aplica', '2027-01-15',
    'NO', NULL, NULL, 'N/A', 'NO', 'Vigente', 'Control periódico anual programado'
WHERE NOT EXISTS (SELECT 1 FROM sst_perfil_epidemiologico LIMIT 1);

INSERT INTO sst_perfil_epidemiologico (
    tipo_identificacion, documento, apellidos, nombres, nombre_completo, telefono, edad,
    fecha_ingreso, dependencia, sede_trabajo, cargo, fecha_emo, tipo_emo,
    restricciones, recomendaciones, direccionado_pve, direccionado_eps, fecha_proximo_emo,
    accidente_trabajo, fecha_accidente, estado_actual_accidente, cumplio_rehabilitacion,
    enfermedad_laboral, estado_final_caso, actividades_pendientes
)
SELECT
    'Cédula de Ciudadanía', '40028155', 'SAAVEDRA RODRIGUEZ', 'YAZMIN ROCIO', 'SAAVEDRA RODRIGUEZ YAZMIN ROCIO', '3104589210', 44,
    '2018-06-01', 'SSAL - Dirección de Aseguramiento en Salud', 'SECRETARÍA DE SALUD DEL DEPARTAMENTO DE BOYACÁ.', 'AUXILIAR ADMINISTRATIVO',
    '2026-02-20', 'Post Incapacidad', 'Evitar levantamiento de cargas mayores a 5 kg y bipedestación prolongada',
    'Adecuación de puesto de trabajo y seguimiento por medicina laboral ARL Positiva',
    'PVE Biomecánico / Osteomuscular', 'Control por Ortopedia EPS / ARL Positiva', '2026-08-20',
    'SI', '2025-12-26', 'En recuperación de fractura de peroné (CIE-10 S824)', 'SI', 'NO', 'En Seguimiento',
    'Verificar cumplimiento de recomendaciones médicas en puesto de trabajo'
WHERE (SELECT COUNT(*) FROM sst_perfil_epidemiologico) = 1;

INSERT INTO sst_entrega_epp (
    documento, nombre_completo, telefono, secretaria, dependencia, sede_trabajo, cargo,
    tipo_vinculacion, restricciones_recomendaciones, codigo_elemento, elemento_epp,
    talla, cantidad, fecha_entrega, estado_entrega, firmado_funcionario, observaciones
)
SELECT
    '1003481573', 'ROMERO MARIN IVAN DARIO', '3213938142', '5. SECRETARIA GENERAL',
    'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE',
    'PROFESIONAL UNIVERSITARIO', 'CARRERA ADMINISTRATIVA', 'NINGUNA',
    'A', 'A. Casco de seguridad', 'N/A', '1 UNIDAD', '2026-01-15', 'Entregado', TRUE,
    'Entrega oficial según Formato E-DO-ST-F-028 V4 e Instructivo E-DO-ST-I-007'
WHERE NOT EXISTS (SELECT 1 FROM sst_entrega_epp LIMIT 1);

INSERT INTO sst_entrega_epp (
    documento, nombre_completo, telefono, secretaria, dependencia, sede_trabajo, cargo,
    tipo_vinculacion, restricciones_recomendaciones, codigo_elemento, elemento_epp,
    talla, cantidad, fecha_entrega, estado_entrega, firmado_funcionario, observaciones
)
SELECT
    '1003481573', 'ROMERO MARIN IVAN DARIO', '3213938142', '5. SECRETARIA GENERAL',
    'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE',
    'PROFESIONAL UNIVERSITARIO', 'CARRERA ADMINISTRATIVA', 'NINGUNA',
    'T', 'T. Chaleco Trabajo en campo', 'L', '1 UNIDAD', '2026-01-15', 'Entregado', TRUE,
    'Dotación para visitas técnicas de inspección SST'
WHERE (SELECT COUNT(*) FROM sst_entrega_epp) = 1;

INSERT INTO sst_entrega_epp (
    documento, nombre_completo, telefono, secretaria, dependencia, sede_trabajo, cargo,
    tipo_vinculacion, restricciones_recomendaciones, codigo_elemento, elemento_epp,
    talla, cantidad, fecha_entrega, estado_entrega, firmado_funcionario, observaciones
)
SELECT
    '1003481573', 'ROMERO MARIN IVAN DARIO', '3213938142', '5. SECRETARIA GENERAL',
    'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE',
    'PROFESIONAL UNIVERSITARIO', 'CARRERA ADMINISTRATIVA', 'NINGUNA',
    'P', 'P. Guantes de Nitrilo', 'M', '1 CAJA', '2026-01-15', 'Entregado', TRUE,
    'Suministro de bioseguridad SST'
WHERE (SELECT COUNT(*) FROM sst_entrega_epp) = 2;

INSERT INTO sst_perfil_sociodemografico (
    tipo_identificacion, documento, apellidos, nombres, nombre_completo, sexo,
    anio_nacimiento, edad, raza_etnia, estado_civil, composicion_familiar,
    tipo_vivienda, estrato, municipio_residencia, municipio_trabajo,
    escolaridad, ocupacion_profesion, rango_ingresos, denominacion_cargo,
    tipo_cargo, tipo_vinculacion, antiguedad_cargo, antiguedad_entidad,
    dependencia, sede_trabajo
)
SELECT
    'Cédula de Ciudadanía', '1003481573', 'ROMERO MARIN', 'IVAN DARIO', 'ROMERO MARIN IVAN DARIO', 'Masculino',
    1994, 31, 'Blanco/Mestizo', 'Soltero (a)', 'OTROS (Hermanos, Sobrinos, Ahijados, Hijastros, Entre otros )',
    'Arriendo', '3', 'Tunja', 'Tunja',
    'Especialización', 'Ingeniero Industrial', 'Entre 3 y 6 SMMLV', 'Profesional Universitario',
    'Profesional', 'Carrera Administrativa', 'Entre 1 y 4 años', 'Entre 1 y 4 años',
    'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE'
WHERE NOT EXISTS (SELECT 1 FROM sst_perfil_sociodemografico LIMIT 1);
