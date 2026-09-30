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

-- ============================================================

-- SEED DATA: MÓDULO DE VIÁTICOS (Basado en Servidores Públicos)

-- ============================================================

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'DESPACHO DEL GOBERNADOR', 'MARTÍNEZ PÉREZ LAURA', '1000000001', 'PROFESIONAL UNIVERSITARIO', 'BOGOTÁ, D.C.', 'Mesas de trabajo técnico-institucionales con el Departamento Nacional de Planeación (DNP) para formulación de proyectos departamentales',
    '15/04/2026', '17/04/2026', 3, 180000, 'Finalizada',
    'Comisión cumplida a satisfacción. Informe técnico de compromisos DNP radicado.', '05/04/2026', 'Angela Ussa', 'Nacional', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000001' AND fecha_inicio = '15/04/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Finalizada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000001' AND fecha_inicio = '15/04/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'DIRECCIÓN DE TALENTO HUMANO', 'TORRES RIVERA CARLOS ANDRÉS', '1000000002', 'COORDINADOR DE ÁREA', 'PAIPA, BOYACÁ', 'Coordinación y facilitación de la jornada departamental de bienestar laboral y capacitación a enlaces provinciales de talento humano',
    '02/05/2026', '04/05/2026', 3, 220000, 'Aprobada',
    'Aprobado según programación del Plan de Bienestar e Incentivos 2026.', '20/04/2026', 'Angela Ussa', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000002' AND fecha_inicio = '02/05/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000002' AND fecha_inicio = '02/05/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE HACIENDA', 'ROJAS GÓMEZ DIANA CAROLINA', '1000000003', 'TÉCNICO ADMINISTRATIVO', 'SOGAMOSO, BOYACÁ', 'Apoyo operativo y logístico en la jornada de fiscalización tributaria a contribuyentes de vehículos e impuesto al consumo',
    '18/05/2026', '20/05/2026', 3, 130000, 'Finalizada',
    'Legalización de gastos radicada ante tesorería departamental.', '10/05/2026', 'Angela Ussa', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000003' AND fecha_inicio = '18/05/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Finalizada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000003' AND fecha_inicio = '18/05/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'OFICINA JURÍDICA', 'MORENO SUÁREZ JUAN SEBASTIÁN', '1000000004', 'ASESOR JURÍDICO', 'BOGOTÁ, D.C.', 'Representación judicial de la Gobernación de Boyacá y sustentación oral en audiencia ante el Consejo de Estado',
    '08/06/2026', '09/06/2026', 2, 240000, 'Aprobada',
    'Comisión de carácter prioritario para defensa jurídica departamental.', '28/05/2026', 'Angela Ussa', 'Nacional', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000004' AND fecha_inicio = '08/06/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000004' AND fecha_inicio = '08/06/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE SALUD', 'GÓMEZ RUIZ PAULA ANDREA', '1000000005', 'PROFESIONAL UNIVERSITARIO', 'PUERTO BOYACÁ, BOYACÁ', 'Inspección, vigilancia y control sanitario a la red hospitalaria pública y centros de atención primaria en el Magdalena Medio',
    '16/06/2026', '19/06/2026', 4, 190000, 'Aprobada',
    'Seguimiento especial a la dotación biomédica del hospital regional.', '05/06/2026', 'Angela Ussa', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000005' AND fecha_inicio = '16/06/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000005' AND fecha_inicio = '16/06/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE EDUCACIÓN', 'CASTRO DÍAZ MIGUEL ÁNGEL', '1000000006', 'COORDINADOR DE ÁREA', 'CHIQUINQUIRÁ, BOYACÁ', 'Auditoría técnica a la ejecución del Programa de Alimentación Escolar (PAE) e infraestructura en instituciones educativas provinciales',
    '06/07/2026', '08/07/2026', 3, 220000, 'Finalizada',
    'Actas de supervisión suscritas con rectores y operadores del PAE.', '25/06/2026', 'Angela Ussa', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000006' AND fecha_inicio = '06/07/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Finalizada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000006' AND fecha_inicio = '06/07/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'DIRECCIÓN DE TALENTO HUMANO', 'SILVA PARRA NATALIA FERNANDA', '1000000007', 'PROFESIONAL UNIVERSITARIO', 'DUITAMA, BOYACÁ', 'Socialización del plan institucional de inducción y reinducción para servidores públicos de dependencias desconcentradas',
    '21/07/2026', '22/07/2026', 2, 170000, 'Aprobada',
    'Talleres programados en jornada continua de 8:00 am a 5:00 pm.', '12/07/2026', 'Carlos Andrés Torres Rivera', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000007' AND fecha_inicio = '21/07/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000007' AND fecha_inicio = '21/07/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE INFRAESTRUCTURA PÚBLICA', 'VARGAS PEÑA ANDRÉS FELIPE', '1000000008', 'PROFESIONAL ESPECIALIZADO', 'MIRAFLORES, BOYACÁ', 'Interventoría técnica y seguimiento geotécnico a puntos críticos de la vía Miraflores - Páez de la provincia de Lengupá',
    '10/08/2026', '14/08/2026', 5, 210000, 'Aprobada',
    'Informe de estabilidad de taludes y recomendaciones geotécnicas.', '30/07/2026', 'Angela Ussa', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000008' AND fecha_inicio = '10/08/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000008' AND fecha_inicio = '10/08/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA GENERAL', 'RODRÍGUEZ NIÑO MARÍA CAMILA', '1000000009', 'PROFESIONAL UNIVERSITARIO', 'VILLA DE LEYVA, BOYACÁ', 'Supervisión de archivo central, organización de fondos acumulados y aplicación de tablas de retención documental (TRD)',
    '24/08/2026', '26/08/2026', 3, 175000, 'Aprobada',
    'Diagnóstico integral de archivo provincial completado.', '15/08/2026', 'Juan Pablo Morales Niño', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000009' AND fecha_inicio = '24/08/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000009' AND fecha_inicio = '24/08/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE HACIENDA', 'HERRERA LÓPEZ SANTIAGO', '1000000010', 'PROFESIONAL ESPECIALIZADO', 'BOGOTÁ, D.C.', 'Capacitación y mesa de trabajo en el Ministerio de Hacienda y Crédito Público sobre el nuevo marco normativo del Sistema General de Participaciones (SGP)',
    '02/09/2026', '04/09/2026', 3, 210000, 'Aprobada',
    'Acreditación del taller y memoria técnica de distribución de recursos SGP.', '20/08/2026', 'Angela Ussa', 'Nacional', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000010' AND fecha_inicio = '02/09/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000010' AND fecha_inicio = '02/09/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE CULTURA Y PATRIMONIO', 'PARDO RUIZ VALENTINA', '1000000011', 'PROFESIONAL UNIVERSITARIO', 'MEDELLÍN, ANTIOQUIA', 'Participación en la Fiesta del Libro y la Cultura y Encuentro de Gestores de Patrimonio Cultural Inmaterial',
    '15/09/2026', '18/09/2026', 4, 190000, 'Aprobada',
    'Ponencia institucional sobre patrimonio inmaterial de Boyacá.', '01/09/2026', 'Angela Ussa', 'Nacional', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000011' AND fecha_inicio = '15/09/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000011' AND fecha_inicio = '15/09/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE INFRAESTRUCTURA PÚBLICA', 'CÁRDENAS LÓPEZ JORGE IVÁN', '1000000012', 'COORDINADOR DE ÁREA', 'SOATÁ, BOYACÁ', 'Revisión técnica de banco de maquinaria amarilla del departamento y obras de mitigación por ola invernal en la provincia de Norte',
    '28/09/2026', '30/09/2026', 3, 230000, 'En revisión',
    'Pendiente disponibilidad de vehículo institucional para traslado.', '18/09/2026', NULL, 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000012' AND fecha_inicio = '28/09/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'En revisión', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000012' AND fecha_inicio = '28/09/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'OFICINA JURÍDICA', 'PRIETO GARCÍA MÓNICA ALEJANDRA', '1000000013', 'ASESOR JURÍDICO', 'TUNJA, BOYACÁ', 'Acompañamiento a diligencia de inspección judicial adelantada por la Contraloría General de Boyacá en sedes anexas',
    '05/10/2026', '06/10/2026', 2, 180000, 'Aprobada',
    'Comisión local con viáticos de alimentación y transporte urbano oficial.', '28/09/2026', 'Angela Ussa', 'Municipal', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000013' AND fecha_inicio = '05/10/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000013' AND fecha_inicio = '05/10/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE DESARROLLO EMPRESARIAL', 'SUÁREZ MEJÍA DANIEL ESTEBAN', '1000000014', 'TÉCNICO ADMINISTRATIVO', 'GUATEQUE, BOYACÁ', 'Acompañamiento logístico al registro y rueda de negocios de productores agroindustriales del Valle de Tenza',
    '14/10/2026', '16/10/2026', 3, 130000, 'Pendiente',
    'En trámite de visto bueno por el Secretario de Desarrollo Empresarial.', '02/10/2026', NULL, 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000014' AND fecha_inicio = '14/10/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Pendiente', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000014' AND fecha_inicio = '14/10/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE TURISMO', 'NIÑO CORTÉS CLAUDIA PATRICIA', '1000000015', 'PROFESIONAL UNIVERSITARIO', 'CARTAGENA DE INDIAS, BOLÍVAR', 'Representación de Boyacá en el Congreso Nacional de Turismo Sostenible y Rueda de Negocios Turística',
    '21/10/2026', '24/10/2026', 4, 220000, 'Pendiente',
    'Cotización de tiquetes aéreos en proceso de emisión.', '08/10/2026', NULL, 'Nacional', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000015' AND fecha_inicio = '21/10/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Pendiente', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000015' AND fecha_inicio = '21/10/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE TURISMO', 'RINCÓN DUARTE CAROLINA', '1000000016', 'TÉCNICO ADMINISTRATIVO', 'NOBSA, BOYACÁ', 'Supervisión de puntos de información turística y caracterización de prestadores de servicios hoteleros y gastronómicos',
    '28/10/2026', '29/10/2026', 2, 120000, 'Aprobada',
    'Articulación con la alcaldía municipal para censo de artesanos.', '19/10/2026', 'Angela Ussa', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000016' AND fecha_inicio = '28/10/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000016' AND fecha_inicio = '28/10/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE AMBIENTE Y DESARROLLO SOSTENIBLE', 'MORENO CASTRO FELIPE ANDRÉS', '1000000017', 'PROFESIONAL ESPECIALIZADO', 'AQUITANIA, BOYACÁ', 'Monitoreo de calidad de agua y verificación de planes de manejo ambiental en la cuenca del Lago de Tota',
    '04/11/2026', '06/11/2026', 3, 190000, 'Aprobada',
    'Toma de muestras fisicoquímicas en conjunto con Corpoboyacá.', '22/10/2026', 'Angela Ussa', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000017' AND fecha_inicio = '04/11/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000017' AND fecha_inicio = '04/11/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE CULTURA Y PATRIMONIO', 'TORRES CÁRDENAS ISABELLA', '1000000018', 'PROFESIONAL UNIVERSITARIO', 'MONGUÍ, BOYACÁ', 'Evaluación técnica del estado de conservación de bienes de interés cultural y monumentos arquitectónicos',
    '09/11/2026', '10/11/2026', 2, 160000, 'Aprobada',
    'Ficha técnica de monumentos y diagnóstico estructural preliminar.', '28/10/2026', 'Valentina Pardo Ruiz', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000018' AND fecha_inicio = '09/11/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000018' AND fecha_inicio = '09/11/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE AGRICULTURA', 'PÁEZ SOTO CAMILO ANDRÉS', '1000000019', 'PROFESIONAL ESPECIALIZADO', 'VENTAQUEMADA, BOYACÁ', 'Evaluación de daños agropecuarios por heladas y entrega técnica de insumos a asociaciones paperas',
    '12/11/2026', '13/11/2026', 2, 180000, 'Aprobada',
    'Levantamiento de actas RUAT de afectación climática.', '03/11/2026', 'Angela Ussa', 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000019' AND fecha_inicio = '12/11/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000019' AND fecha_inicio = '12/11/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE GOBIERNO Y ACCIÓN COMUNAL', 'BERNAL REYES LUCÍA FERNANDA', '1000000020', 'PROFESIONAL UNIVERSITARIO', 'MONIQUIRÁ, BOYACÁ', 'Capacitación a líderes comunales en formulación de proyectos para los Fondos de Desarrollo Comunal',
    '18/11/2026', '19/11/2026', 2, 160000, 'Pendiente',
    'Convocatoria emitida a presidentes de Juntas de Acción Comunal.', '06/11/2026', NULL, 'Departamental', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000020' AND fecha_inicio = '18/11/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Pendiente', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000020' AND fecha_inicio = '18/11/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'DESPACHO DEL GOBERNADOR', 'JUAN ESTEBAN SILVA E', '1051064446', 'ANALISTA DE SISTEMAS', 'BOGOTÁ, D.C.', 'Taller de interoperabilidad pública y arquitectura de gobierno digital con el Ministerio de las TIC',
    '25/11/2026', '27/11/2026', 3, 185000, 'Aprobada',
    'Comisión para adopción del marco de interoperabilidad X-Road en Boyacá.', '12/11/2026', 'Angela Ussa', 'Nacional', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1051064446' AND fecha_inicio = '25/11/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1051064446' AND fecha_inicio = '25/11/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'DESPACHO DEL GOBERNADOR', 'ROJAS HERRERA ANDRÉS FELIPE', '1000000023', 'SECRETARIO DE DESPACHO', 'BOGOTÁ, D.C.', 'Reunión de coordinación con la Federación Nacional de Departamentos (FND) y comisiones económicas del Congreso',
    '01/12/2026', '02/12/2026', 2, 260000, 'Aprobada',
    'Mesa de concertación sobre rentas cedidas de licores y tabaco.', '20/11/2026', 'Angela Ussa', 'Nacional', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '1000000023' AND fecha_inicio = '01/12/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Aprobada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '1000000023' AND fecha_inicio = '01/12/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE SALUD', 'HERNANDEZ TORRES CARLOS ARTURO', '80125478', 'MÉDICO ESPECIALISTA', 'BUCARAMANGA, SANTANDER', 'Simposio de salud pública regional y vigilancia epidemiológica del dengue y zika en frontera interdepartamental',
    '05/07/2026', '07/07/2026', 3, 150000, 'Finalizada',
    'Informe epidemiológico presentado ante el comité de salud pública.', '28/06/2026', 'Angela Ussa', 'Nacional', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '80125478' AND fecha_inicio = '05/07/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Finalizada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '80125478' AND fecha_inicio = '05/07/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE EDUCACIÓN', 'RODRIGUEZ PEÑA MARIA ELENA', '52741236', 'AUXILIAR ADMINISTRATIVO', 'MEDELLÍN, ANTIOQUIA', 'Congreso nacional de educación pública y gestión docente',
    '10/06/2026', '13/06/2026', 4, 135000, 'En revisión',
    'Pendiente confirmación de viabilidad por disponibilidad de cupos institucionales.', '05/06/2026', NULL, 'Nacional', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '52741236' AND fecha_inicio = '10/06/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'En revisión', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '52741236' AND fecha_inicio = '10/06/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);

INSERT INTO viaticos (
    dependencia, apellidos_nombres, documento, cargo, destino, motivo,
    fecha_inicio, fecha_fin, dias, valor_diario, estado,
    observaciones, fecha_solicitud, aprobado_por, tipo_destino, soporte
)
SELECT
    'SECRETARÍA DE HACIENDA', 'GARCIA MARTINEZ LUIS FERNANDO', '79850123', 'PROFESIONAL UNIVERSITARIO', 'BOGOTÁ, D.C.', 'Capacitación extraordinaria en sistemas de recaudo digital DIAN sin radicación oportuna',
    '20/05/2026', '22/05/2026', 3, 120000, 'Rechazada',
    'Rechazada por no cumplir los términos reglamentarios de solicitud (mínimo 8 días de antelación).', '18/05/2026', 'Carlos Andrés Torres Rivera', 'Nacional', NULL
WHERE NOT EXISTS (SELECT 1 FROM viaticos WHERE documento = '79850123' AND fecha_inicio = '20/05/2026' LIMIT 1);

INSERT INTO historial_viaticos (id_viatico, estado_nuevo, nota, actualizado_por)
SELECT id_viatico, 'Rechazada', 'Registro inicial de comisión de viáticos institucional', 'admin'
FROM viaticos
WHERE documento = '79850123' AND fecha_inicio = '20/05/2026'
  AND NOT EXISTS (SELECT 1 FROM historial_viaticos WHERE historial_viaticos.id_viatico = viaticos.id_viatico);
