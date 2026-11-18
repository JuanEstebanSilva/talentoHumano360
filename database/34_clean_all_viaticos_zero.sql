-- ============================================================================
-- MIGRACIÓN 34: Limpieza Total de Viáticos, Servidores Públicos y Horarios
-- Plataforma Talento 360 - Gobernación de Boyacá
-- Deja el sistema en estado cero (sin años, paquetes ni registros previos)
-- para inicio limpio y autónomo por parte del usuario.
-- ============================================================================

BEGIN;

-- 1. Desvincular temporalmente claves foráneas si existen
ALTER TABLE IF EXISTS horarios DROP CONSTRAINT IF EXISTS fk_horarios_personas;
ALTER TABLE IF EXISTS viaticos DROP CONSTRAINT IF EXISTS fk_viaticos_personas;
ALTER TABLE IF EXISTS vacaciones DROP CONSTRAINT IF EXISTS fk_vacaciones_personas;
ALTER TABLE IF EXISTS historial_solicitudes DROP CONSTRAINT IF EXISTS fk_historial_personas;
ALTER TABLE IF EXISTS solicitudes_admin DROP CONSTRAINT IF EXISTS fk_solicitudes_personas;

-- 2. Limpieza total de Viáticos y Vigencias Anuales
DELETE FROM historial_viaticos;
DELETE FROM viaticos;
DELETE FROM paquetes_viaticos;
DELETE FROM vigencias_viaticos;

-- 3. Limpieza total de Horarios
DELETE FROM historial_horarios;
DELETE FROM horarios;

-- 4. Limpieza total de Servidores Públicos
DELETE FROM rel_principal;
DELETE FROM contactos;
DELETE FROM educacion;
DELETE FROM vacaciones;
DELETE FROM historial_solicitudes;
DELETE FROM personas;

-- 5. Reiniciar secuencias autonuméricas a 1
ALTER SEQUENCE IF EXISTS viaticos_id_viatico_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS historial_viaticos_id_historial_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS paquetes_viaticos_id_paquete_seq RESTART WITH 1;

ALTER SEQUENCE IF EXISTS horarios_id_horario_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS historial_horarios_id_historial_seq RESTART WITH 1;

ALTER SEQUENCE IF EXISTS seq_personas_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_contactos_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_educacion_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_rel_principal_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_prov_cedula RESTART WITH 1;
ALTER SEQUENCE IF EXISTS vacaciones_id_vacacion_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS historial_solicitudes_id_historial_seq RESTART WITH 1;

-- 6. Registrar migración en la tabla schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(160) PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description)
VALUES ('34_clean_all_viaticos_zero', 'Limpieza total a estado cero de viaticos, servidores publicos, horarios y vigencias anuales')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();

COMMIT;

