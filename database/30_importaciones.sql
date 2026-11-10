-- 30_importaciones.sql
-- Historial común de las cargas masivas de todos los módulos.

CREATE TABLE IF NOT EXISTS importaciones (
    id_importacion SERIAL PRIMARY KEY,
    modulo         VARCHAR(60)  NOT NULL,
    archivo        VARCHAR(255),
    usuario        VARCHAR(160) NOT NULL,
    total_filas    INTEGER      NOT NULL DEFAULT 0,
    insertados     INTEGER      NOT NULL DEFAULT 0,
    actualizados   INTEGER      NOT NULL DEFAULT 0,
    duplicados     INTEGER      NOT NULL DEFAULT 0,
    omitidos       INTEGER      NOT NULL DEFAULT 0,
    errores        JSONB        NOT NULL DEFAULT '[]'::jsonb,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_importaciones_usuario ON importaciones(LOWER(usuario), creado_en DESC);
