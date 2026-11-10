-- ============================================================================
-- MIGRACIÓN 22: Secuencias Nativas y Concurrencia Atómica en Servidores Públicos
-- Plataforma Talento 360 - Gobernación de Boyacá
-- Resuelve AUD-006 / PROMPT 2
-- ============================================================================

BEGIN;

-- 1. Crear secuencias nativas para todas las entidades de servidores públicos
CREATE SEQUENCE IF NOT EXISTS seq_personas_id;
CREATE SEQUENCE IF NOT EXISTS seq_contactos_id;
CREATE SEQUENCE IF NOT EXISTS seq_educacion_id;
CREATE SEQUENCE IF NOT EXISTS seq_estados_id;
CREATE SEQUENCE IF NOT EXISTS seq_rel_principal_id;
CREATE SEQUENCE IF NOT EXISTS seq_dependencias_id;
CREATE SEQUENCE IF NOT EXISTS seq_cargos_id;
CREATE SEQUENCE IF NOT EXISTS seq_prov_cedula;

-- 2. Función atómica para formatear el siguiente identificador alfanumérico
CREATE OR REPLACE FUNCTION next_formatted_id(p_seq_name TEXT, p_prefix TEXT, p_width INT)
RETURNS TEXT AS $$
BEGIN
  RETURN p_prefix || LPAD(nextval(p_seq_name)::TEXT, p_width, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION next_formatted_id(TEXT, TEXT, INT) IS 'Genera atómicamente el siguiente ID alfanumérico formateado con relleno de ceros.';

-- 3. Procedimiento para sincronizar las secuencias con los datos históricos existentes
CREATE OR REPLACE FUNCTION sync_all_employee_sequences()
RETURNS VOID AS $$
BEGIN
  PERFORM setval('seq_personas_id', GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(id_persona, '\D', '', 'g'), '')::bigint) FROM personas), 1)));
  PERFORM setval('seq_contactos_id', GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(id_contacto, '\D', '', 'g'), '')::bigint) FROM contactos), 1)));
  PERFORM setval('seq_educacion_id', GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(id_educacion, '\D', '', 'g'), '')::bigint) FROM educacion), 1)));
  PERFORM setval('seq_estados_id', GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(id_estado, '\D', '', 'g'), '')::bigint) FROM estados), 1)));
  PERFORM setval('seq_rel_principal_id', GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(id_registro, '\D', '', 'g'), '')::bigint) FROM rel_principal), 1)));
  PERFORM setval('seq_dependencias_id', GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(id_dependencia, '\D', '', 'g'), '')::bigint) FROM dependencias), 1)));
  PERFORM setval('seq_cargos_id', GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(id_cargo, '\D', '', 'g'), '')::bigint) FROM cargos), 1)));
  PERFORM setval('seq_prov_cedula', GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(cedula, '\D', '', 'g'), '')::bigint) FROM personas WHERE cedula ~ '^PROV-'), 1)));
END;
$$ LANGUAGE plpgsql;

-- 4. Ejecutar sincronización inmediata
SELECT sync_all_employee_sequences();

-- 5. Configurar valores por defecto en columnas para inserciones transparentes
ALTER TABLE personas ALTER COLUMN id_persona SET DEFAULT 'PER' || LPAD(nextval('seq_personas_id')::TEXT, 4, '0');
ALTER TABLE contactos ALTER COLUMN id_contacto SET DEFAULT 'CON' || LPAD(nextval('seq_contactos_id')::TEXT, 4, '0');
ALTER TABLE educacion ALTER COLUMN id_educacion SET DEFAULT 'EDU' || LPAD(nextval('seq_educacion_id')::TEXT, 4, '0');
ALTER TABLE estados ALTER COLUMN id_estado SET DEFAULT 'EST' || LPAD(nextval('seq_estados_id')::TEXT, 4, '0');
ALTER TABLE rel_principal ALTER COLUMN id_registro SET DEFAULT 'REL' || LPAD(nextval('seq_rel_principal_id')::TEXT, 4, '0');
ALTER TABLE dependencias ALTER COLUMN id_dependencia SET DEFAULT 'DEP' || LPAD(nextval('seq_dependencias_id')::TEXT, 3, '0');
ALTER TABLE cargos ALTER COLUMN id_cargo SET DEFAULT 'CAR' || LPAD(nextval('seq_cargos_id')::TEXT, 3, '0');

COMMIT;

