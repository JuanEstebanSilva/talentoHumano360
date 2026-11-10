-- ============================================================================
-- MIGRACIÓN 19: Función robusta safe_parse_date e integridad de fechas
-- Plataforma Talento 360 - Gobernación de Boyacá
-- Resuelve AUD-001 y AUD-009 / PROMPT 1
-- ============================================================================

BEGIN;

-- 1. Crear o reemplazar la función safe_parse_date
-- Soporta formatos ISO (YYYY-MM-DD, timestamp ISO), DD/MM/YYYY y DD-MM-YYYY
-- Retorna NULL de forma segura ante entradas nulas, vacías o fechas inválidas/imposibles.
CREATE OR REPLACE FUNCTION safe_parse_date(p_date_text TEXT) 
RETURNS DATE AS $$
DECLARE
  v_clean TEXT;
BEGIN
  IF p_date_text IS NULL THEN
    RETURN NULL;
  END IF;

  v_clean := TRIM(p_date_text);
  IF v_clean = '' OR v_clean ILIKE 'null' OR v_clean ILIKE 'undefined' THEN
    RETURN NULL;
  END IF;

  -- Formato ISO: YYYY-MM-DD o ISO con hora (ej: 2026-03-15 o 2026-03-15T08:00:00Z)
  IF v_clean ~ '^\d{4}[-/]\d{1,2}[-/]\d{1,2}' THEN
    BEGIN
      RETURN to_date(SUBSTRING(v_clean FROM 1 FOR 10), 'YYYY-MM-DD');
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END IF;

  -- Formato latinoamericano/colombiano estándar: DD/MM/YYYY o DD-MM-YYYY
  IF v_clean ~ '^\d{1,2}[-/]\d{1,2}[-/]\d{4}' THEN
    BEGIN
      RETURN to_date(REPLACE(v_clean, '-', '/'), 'DD/MM/YYYY');
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END IF;

  -- Intento final de conversión controlada ante otros formatos reconocibles
  BEGIN
    RETURN v_clean::DATE;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION safe_parse_date(TEXT) IS 'Parsea cadenas de fecha tolerando entradas ISO, DD/MM/YYYY, vacías o inválidas retornando NULL de forma segura.';

-- 2. Índices funcionales para optimizar filtros de fecha en el módulo de viáticos (si la tabla ya existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'viaticos') THEN
    CREATE INDEX IF NOT EXISTS idx_viaticos_safe_fecha_inicio ON viaticos (safe_parse_date(fecha_inicio));
    CREATE INDEX IF NOT EXISTS idx_viaticos_safe_fecha_fin ON viaticos (safe_parse_date(fecha_fin));
    CREATE INDEX IF NOT EXISTS idx_viaticos_safe_fecha_solicitud ON viaticos (safe_parse_date(fecha_solicitud));
  END IF;
END $$;

COMMIT;
