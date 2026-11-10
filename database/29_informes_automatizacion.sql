-- 29_informes_automatizacion.sql
-- Informes con filtros y automatización de su generación.
-- Los resultados de cada ejecución se conservan aquí para consultarlos y exportarlos después.

-- Muchos módulos guardan fechas como texto: esta función las interpreta sin fallar.
CREATE OR REPLACE FUNCTION reporte_fecha(valor text) RETURNS date AS $$
BEGIN
  IF valor IS NULL OR btrim(valor) = '' THEN RETURN NULL; END IF;
  IF valor ~ '^\d{4}-\d{1,2}-\d{1,2}' THEN
    RETURN to_date(substring(valor FROM '^\d{4}-\d{1,2}-\d{1,2}'), 'YYYY-MM-DD');
  END IF;
  IF valor ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
    RETURN to_date(substring(valor FROM '^\d{1,2}/\d{1,2}/\d{4}'), 'DD/MM/YYYY');
  END IF;
  IF valor ~ '^\d{1,2}-\d{1,2}-\d{4}' THEN
    RETURN to_date(substring(valor FROM '^\d{1,2}-\d{1,2}-\d{4}'), 'DD-MM-YYYY');
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE TABLE IF NOT EXISTS automatizaciones (
    id_automatizacion SERIAL PRIMARY KEY,
    nombre            VARCHAR(160) NOT NULL,
    fuente            VARCHAR(60)  NOT NULL,
    filtros           JSONB        NOT NULL DEFAULT '{}'::jsonb,
    columnas          JSONB        NOT NULL DEFAULT '[]'::jsonb,
    frecuencia        VARCHAR(20)  NOT NULL CHECK (frecuencia IN ('diaria', 'semanal', 'mensual', 'personalizada')),
    intervalo         INTEGER,
    unidad            VARCHAR(10)  CHECK (unidad IN ('horas', 'dias', 'semanas')),
    inicio            TIMESTAMPTZ  NOT NULL,
    proxima_ejecucion TIMESTAMPTZ,
    ultima_ejecucion  TIMESTAMPTZ,
    estado            VARCHAR(20)  NOT NULL DEFAULT 'Activa' CHECK (estado IN ('Activa', 'Pausada')),
    creado_por        VARCHAR(160) NOT NULL,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automatizacion_ejecuciones (
    id_ejecucion      SERIAL PRIMARY KEY,
    id_automatizacion INTEGER      NOT NULL REFERENCES automatizaciones(id_automatizacion) ON DELETE CASCADE,
    origen            VARCHAR(20)  NOT NULL DEFAULT 'Programada' CHECK (origen IN ('Programada', 'Manual')),
    estado            VARCHAR(20)  NOT NULL DEFAULT 'En curso' CHECK (estado IN ('En curso', 'Exitosa', 'Error')),
    iniciado_en       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalizado_en     TIMESTAMPTZ,
    total_filas       INTEGER,
    truncado          BOOLEAN      NOT NULL DEFAULT FALSE,
    mensaje           VARCHAR(500),
    fuente            VARCHAR(60)  NOT NULL, -- Fuente que generó estas filas; la automatización puede cambiar después.
    fuente_nombre     VARCHAR(160),
    criterios         JSONB,
    columnas          JSONB,
    filas             JSONB
);

CREATE INDEX IF NOT EXISTS idx_automatizaciones_proxima ON automatizaciones(proxima_ejecucion) WHERE estado = 'Activa';
CREATE INDEX IF NOT EXISTS idx_automatizaciones_creador ON automatizaciones(LOWER(creado_por));
CREATE INDEX IF NOT EXISTS idx_auto_ejecuciones_auto    ON automatizacion_ejecuciones(id_automatizacion, iniciado_en DESC);

-- Los permisos de este módulo se asignan en 33_accesos_adicionales.sql.
