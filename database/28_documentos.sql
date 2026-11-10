-- 28_documentos.sql
-- Gestión documental: tipos, documentos, versiones y auditoría de accesos.
-- Los archivos viven fuera de la base de datos; aquí solo se guardan sus datos y su hash.
-- La cédula se guarda como texto y sin llave foránea, igual que en los demás módulos,
-- para que el expediente sobreviva aunque el registro del servidor cambie o se retire.

CREATE TABLE IF NOT EXISTS tipos_documento (
    id_tipo        SERIAL PRIMARY KEY,
    codigo         VARCHAR(40)  NOT NULL UNIQUE,
    nombre         VARCHAR(160) NOT NULL,
    categoria      VARCHAR(80)  NOT NULL DEFAULT 'General',
    palabras_clave TEXT         NOT NULL DEFAULT '',
    es_sensible    BOOLEAN      NOT NULL DEFAULT FALSE,
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documentos (
    id_documento     SERIAL PRIMARY KEY,
    id_tipo          INTEGER REFERENCES tipos_documento(id_tipo),
    cedula           VARCHAR(40),
    nombre_servidor  VARCHAR(280),
    id_tipo_sugerido INTEGER REFERENCES tipos_documento(id_tipo),
    cedula_sugerida  VARCHAR(40),
    nombre_sugerido  VARCHAR(280),
    titulo           VARCHAR(280) NOT NULL,
    descripcion      TEXT,
    fecha_documento  DATE,
    estado           VARCHAR(30)  NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Clasificado')),
    version_actual   INTEGER      NOT NULL DEFAULT 1,
    creado_por       VARCHAR(160) NOT NULL,
    creado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    eliminado_en     TIMESTAMP,
    eliminado_por    VARCHAR(160),
    CONSTRAINT documentos_clasificado_completo
      CHECK (estado <> 'Clasificado' OR (id_tipo IS NOT NULL AND cedula IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS documento_versiones (
    id_version           SERIAL PRIMARY KEY,
    id_documento         INTEGER      NOT NULL REFERENCES documentos(id_documento) ON DELETE CASCADE,
    numero               INTEGER      NOT NULL,
    nombre_original      VARCHAR(255) NOT NULL,
    mime_type            VARCHAR(120) NOT NULL,
    extension            VARCHAR(10)  NOT NULL,
    tamano_bytes         BIGINT       NOT NULL,
    sha256               CHAR(64)     NOT NULL,
    clave_almacenamiento TEXT         NOT NULL,
    nota                 VARCHAR(500),
    subido_por           VARCHAR(160) NOT NULL,
    subido_en            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_documento, numero)
);

CREATE TABLE IF NOT EXISTS documento_eventos (
    id_evento    BIGSERIAL PRIMARY KEY,
    id_documento INTEGER      NOT NULL REFERENCES documentos(id_documento) ON DELETE CASCADE,
    accion       VARCHAR(40)  NOT NULL,
    detalle      VARCHAR(500),
    usuario      VARCHAR(160) NOT NULL,
    ip           VARCHAR(80),
    creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documentos_cedula  ON documentos(cedula) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_estado  ON documentos(estado) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_tipo    ON documentos(id_tipo);
CREATE INDEX IF NOT EXISTS idx_doc_versiones_hash ON documento_versiones(sha256);
CREATE INDEX IF NOT EXISTS idx_doc_eventos_doc    ON documento_eventos(id_documento, creado_en DESC);

-- Catálogo inicial: debe validarse con el inventario documental de Talento Humano.
INSERT INTO tipos_documento (codigo, nombre, categoria, palabras_clave, es_sensible) VALUES
  ('CEDULA',           'Documento de identidad',                 'Identificación', 'cedula,cc,identificacion,documento de identidad', FALSE),
  ('HOJA_VIDA',        'Hoja de vida',                           'Hoja de vida',   'hoja de vida,hv,sigep', FALSE),
  ('DIPLOMA',          'Diploma o acta de grado',                'Formación',      'diploma,acta de grado,titulo', FALSE),
  ('TARJETA_PROF',     'Tarjeta o matrícula profesional',        'Formación',      'tarjeta profesional,matricula profesional', FALSE),
  ('NOMBRAMIENTO',     'Acto administrativo de nombramiento',    'Vinculación',    'nombramiento,resolucion de nombramiento', FALSE),
  ('ACTA_POSESION',    'Acta de posesión',                       'Vinculación',    'acta de posesion,posesion', FALSE),
  ('CERT_LABORAL',     'Certificación laboral',                  'Vinculación',    'certificacion laboral,certificado laboral,cetil', FALSE),
  ('EVALUACION',       'Evaluación de desempeño',                'Situaciones',    'evaluacion de desempeno,evaluacion,edl', FALSE),
  ('INCAPACIDAD',      'Incapacidad médica',                     'Salud',          'incapacidad', TRUE),
  ('EMO',              'Examen médico ocupacional',              'Salud',          'emo,examen medico,examen ocupacional,historia clinica', TRUE),
  ('OTRO',             'Otro documento',                         'General',        '', FALSE)
ON CONFLICT (codigo) DO NOTHING;

-- Acceso: todo usuario registrado (decisión de la entidad); se controla en el servicio.
