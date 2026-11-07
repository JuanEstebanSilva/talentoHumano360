-- ============================================================================
-- MIGRACIÓN 23: Integridad Referencial y Claves Foráneas (AUD-010 / PROMPT 4)
-- Plataforma Talento 360 - Gobernación de Boyacá
-- Relaciones: personas (cedula) <-> horarios (documento) & viaticos (documento)
-- ============================================================================

BEGIN;

-- 1. Asegurar restricción UNIQUE sobre personas(cedula)
-- (PostgreSQL permite múltiples valores NULL para plazas vacantes en índices UNIQUE estándar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personas_cedula_unique'
  ) THEN
    ALTER TABLE personas ADD CONSTRAINT personas_cedula_unique UNIQUE (cedula);
  END IF;
END $$;

-- 2. Normalización de 3 errores tipográficos históricos documentados en horarios:
-- Diagnóstico con evidencia documental:
--   a) id_horario 122 (Andrea Paola Buitrago): '1055273529' -> '1055273259' (PER0565 en personas)
--   b) id_horario 28  (Ana Julia Vargas Cuesta): '24135481' -> '24138481' (PER0253 en personas)
--   c) id_horario 83  (Eliécer Oswaldo Hernández): '74324196' -> '74324136' (PER0582 en personas)
UPDATE horarios SET documento = '1055273259' WHERE id_horario = 122 AND documento = '1055273529';
UPDATE horarios SET documento = '24138481' WHERE id_horario = 28 AND documento = '24135481';
UPDATE horarios SET documento = '74324136' WHERE id_horario = 83 AND documento = '74324196';

-- 3. Clave Foránea en horarios -> personas(cedula) con ON DELETE RESTRICT ON UPDATE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_horarios_personas'
  ) THEN
    ALTER TABLE horarios 
      ADD CONSTRAINT fk_horarios_personas 
      FOREIGN KEY (documento) 
      REFERENCES personas(cedula) 
      ON DELETE RESTRICT 
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Índice para acelerar comprobaciones de integridad y consultas en horarios
CREATE INDEX IF NOT EXISTS idx_horarios_documento_fk ON horarios(documento);

-- 4. Clave Foránea en viaticos -> personas(cedula) con ON DELETE RESTRICT ON UPDATE CASCADE
-- Nota institucional: 1.347 registros históricos con documento NULL (rubros presupuestales agregados)
-- son válidos bajo el estándar SQL sin infringir la restricción referencial.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_viaticos_personas'
  ) THEN
    ALTER TABLE viaticos 
      ADD CONSTRAINT fk_viaticos_personas 
      FOREIGN KEY (documento) 
      REFERENCES personas(cedula) 
      ON DELETE RESTRICT 
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Índice para acelerar comprobaciones de integridad y consultas en viáticos
CREATE INDEX IF NOT EXISTS idx_viaticos_documento_fk ON viaticos(documento);

COMMIT;

