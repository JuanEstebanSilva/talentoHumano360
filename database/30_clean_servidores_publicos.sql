-- ============================================================================
-- MIGRACIÓN 30: Limpieza Completa de Datos de Prueba en Servidores Públicos
-- Plataforma Talento 360 - Gobernación de Boyacá
-- Deja el módulo de servidores públicos en estado limpio (cero registros)
-- para inicio de operación real con datos oficiales.
-- ============================================================================

BEGIN;

-- 1. Desacoplar restricciones de claves foráneas que restrinjan la eliminación
ALTER TABLE IF EXISTS horarios DROP CONSTRAINT IF EXISTS fk_horarios_personas;
ALTER TABLE IF EXISTS viaticos DROP CONSTRAINT IF EXISTS fk_viaticos_personas;

-- 2. Limpiar registros relacionales y transaccionales de servidores públicos
DELETE FROM rel_principal;
DELETE FROM personas;
DELETE FROM contactos;
DELETE FROM educacion;

-- 3. Limpiar estados específicos de servidores públicos (mantener los 5 catálogos base EST001 a EST005)
DELETE FROM estados WHERE id_estado NOT IN ('EST001', 'EST002', 'EST003', 'EST004', 'EST005');

-- 4. Reiniciar secuencias autonuméricas de servidores públicos a sus valores iniciales
ALTER SEQUENCE IF EXISTS seq_personas_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_contactos_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_educacion_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_rel_principal_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_prov_cedula RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_estados_id RESTART WITH 6;

-- 5. Registrar migración en la tabla schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(160) PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description)
VALUES ('30_clean_servidores_publicos', 'Limpieza completa de datos de prueba de servidores publicos')
ON CONFLICT (version) DO NOTHING;

COMMIT;

