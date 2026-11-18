-- ═══════════════════════════════════════════════════════════════════════════════
-- 41_swap_cargo_encargo_rel_principal.sql
-- Corrección e inversión de cargos titulares y cargos en encargo para rel_principal
-- Gobernación de Boyacá · Sistema de Gestión de Talento Humano
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  new_cargo_base_id VARCHAR(64);
  old_cargo_base_nombre TEXT;
  old_cargo_base_cod TEXT;
  old_cargo_base_gra TEXT;
  swapped_count INT := 0;
BEGIN
  -- Garantizar existencia de schema_migrations
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(160) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Solo ejecutar si no ha sido aplicada previamente
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '41_swap_cargo_encargo_rel_principal') THEN
    RAISE NOTICE '[Migración 41] Iniciando inversión de cargos y encargos en rel_principal...';

    FOR r IN 
      SELECT rp.id_registro, rp.id_cargo_base, rp.id_cargo_actual,
             rp.encargo_denominacion, rp.encargo_codigo, rp.encargo_grado,
             cb.cargo AS base_cargo, cb.codigo AS base_codigo, cb.grado AS base_grado
      FROM rel_principal rp
      JOIN cargos cb ON cb.id_cargo = rp.id_cargo_base
      WHERE rp.encargo_denominacion IS NOT NULL 
        AND TRIM(rp.encargo_denominacion) != ''
    LOOP
      old_cargo_base_nombre := r.base_cargo;
      old_cargo_base_cod := r.base_codigo;
      old_cargo_base_gra := r.base_grado;

      -- 1. Intentar reutilizar id_cargo_actual si coincide con el nombre de encargo_denominacion
      new_cargo_base_id := NULL;
      SELECT c.id_cargo INTO new_cargo_base_id
      FROM cargos c
      WHERE c.id_cargo = r.id_cargo_actual
        AND UPPER(TRIM(c.cargo)) = UPPER(TRIM(r.encargo_denominacion))
      LIMIT 1;

      -- 2. Si no coincide, buscar en cargos por denominación, código y grado
      IF new_cargo_base_id IS NULL THEN
        SELECT id_cargo INTO new_cargo_base_id
        FROM cargos
        WHERE UPPER(TRIM(cargo)) = UPPER(TRIM(r.encargo_denominacion))
          AND COALESCE(TRIM(codigo), '') = COALESCE(TRIM(r.encargo_codigo), '')
          AND COALESCE(TRIM(grado), '') = COALESCE(TRIM(r.encargo_grado), '')
        LIMIT 1;
      END IF;

      -- 3. Si no coincide código/grado exacto, buscar por denominación
      IF new_cargo_base_id IS NULL THEN
        SELECT id_cargo INTO new_cargo_base_id
        FROM cargos
        WHERE UPPER(TRIM(cargo)) = UPPER(TRIM(r.encargo_denominacion))
        LIMIT 1;
      END IF;

      -- 4. Si aún no existe el cargo titular, crearlo
      IF new_cargo_base_id IS NULL THEN
        new_cargo_base_id := 'CARG' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
        INSERT INTO cargos (id_cargo, tipo_cargo, cargo, codigo, grado, nivel)
        VALUES (
          new_cargo_base_id,
          'PLANTA',
          UPPER(TRIM(r.encargo_denominacion)),
          COALESCE(r.encargo_codigo, 'N/A'),
          COALESCE(r.encargo_grado, 'N/A'),
          'PROFESIONAL'
        );
      END IF;

      -- 5. Actualizar rel_principal:
      -- - id_cargo_base: pasa a ser el cargo titular (new_cargo_base_id)
      -- - id_cargo_actual: pasa a ser el cargo ejercido en encargo (r.id_cargo_base)
      -- - encargo_denominacion: pasa a ser el nombre del cargo en encargo (old_cargo_base_nombre)
      -- - encargo_codigo: código del encargo
      -- - encargo_grado: grado del encargo
      UPDATE rel_principal
      SET id_cargo_base = new_cargo_base_id,
          id_cargo_actual = r.id_cargo_base,
          encargo_denominacion = old_cargo_base_nombre,
          encargo_codigo = old_cargo_base_cod,
          encargo_grado = old_cargo_base_gra
      WHERE id_registro = r.id_registro;

      swapped_count := swapped_count + 1;
    END LOOP;

    -- Registrar migración como aplicada
    INSERT INTO schema_migrations (version, description)
    VALUES ('41_swap_cargo_encargo_rel_principal', 'Corrección e inversión de cargo titular y cargo en encargo para rel_principal')
    ON CONFLICT (version) DO NOTHING;

    RAISE NOTICE '✅ [Migración 41] Se invirtieron exitosamente % registros de encargo en rel_principal.', swapped_count;
  ELSE
    RAISE NOTICE '[Migración 41] Ya aplicada previamente en schema_migrations. Omitiendo inversión repetida.';
  END IF;
END $$;
