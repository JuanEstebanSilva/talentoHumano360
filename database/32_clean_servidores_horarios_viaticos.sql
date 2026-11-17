-- ============================================================================
-- MIGRACIÓN 32: Limpieza Completa de Datos en Servidores Públicos, Horarios y Viáticos
-- Plataforma Talento 360 - Gobernación de Boyacá
-- Deja los módulos de Servidores Públicos, Horarios y Viáticos completamente limpios (cero registros)
-- para inicio formal de operaciones y carga de información oficial limpia.
-- ============================================================================

BEGIN;

-- 1. Desacoplar restricciones de claves foráneas restrictivas
ALTER TABLE IF EXISTS horarios DROP CONSTRAINT IF EXISTS fk_horarios_personas;
ALTER TABLE IF EXISTS viaticos DROP CONSTRAINT IF EXISTS fk_viaticos_personas;
ALTER TABLE IF EXISTS vacaciones DROP CONSTRAINT IF EXISTS fk_vacaciones_personas;
ALTER TABLE IF EXISTS historial_solicitudes DROP CONSTRAINT IF EXISTS fk_historial_personas;
ALTER TABLE IF EXISTS solicitudes_admin DROP CONSTRAINT IF EXISTS fk_solicitudes_personas;

-- 2. Limpiar registros de Servidores Públicos
DELETE FROM rel_principal;
DELETE FROM contactos;
DELETE FROM educacion;
DELETE FROM vacaciones;
DELETE FROM historial_solicitudes;
DELETE FROM personas;
DELETE FROM estados WHERE id_estado NOT IN ('EST001', 'EST002', 'EST003', 'EST004', 'EST005');
INSERT INTO estados (id_estado, clasificacion_empleo, situacion, funciones_pagadas, novedades, opec) VALUES
('EST001', 'EMPLEADO PÚBLICO', 'ACTIVO', 'TOTAL', 'Sin novedades', 'SI'),
('EST002', 'EMPLEADO PÚBLICO', 'ENCARGO', 'TOTAL', 'Encargo temporal', 'SI'),
('EST003', 'EMPLEADO PÚBLICO', 'RETIRADO', 'NINGUNA', 'Retiro voluntario', 'NO'),
('EST004', 'EMPLEADO PÚBLICO', 'PROVISIONAL', 'TOTAL', 'Nombramiento provisional', 'SI'),
('EST005', 'EMPLEADO PÚBLICO', 'VACANTE DEFINITIVA', 'NINGUNA', 'Cargo vacante', 'NO')
ON CONFLICT (id_estado) DO NOTHING;

-- 3. Limpiar registros de Horarios
DELETE FROM historial_horarios;
DELETE FROM horarios;

-- 4. Limpiar registros de Viáticos y Ejecuciones Presupuestales
DELETE FROM historial_viaticos;
DELETE FROM viaticos;
DELETE FROM paquetes_viaticos;
DELETE FROM vigencias_viaticos;

-- 5. Reiniciar secuencias autonuméricas a 1
ALTER SEQUENCE IF EXISTS seq_personas_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_contactos_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_educacion_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_rel_principal_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_prov_cedula RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_estados_id RESTART WITH 6;
ALTER SEQUENCE IF EXISTS vacaciones_id_vacacion_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS historial_solicitudes_id_historial_seq RESTART WITH 1;

ALTER SEQUENCE IF EXISTS horarios_id_horario_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS historial_horarios_id_historial_seq RESTART WITH 1;

ALTER SEQUENCE IF EXISTS viaticos_id_viatico_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS historial_viaticos_id_historial_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS paquetes_viaticos_id_paquete_seq RESTART WITH 1;

-- 6. Registrar migración en la tabla schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(160) PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description)
VALUES ('32_clean_servidores_horarios_viaticos', 'Limpieza completa de datos en servidores publicos, horarios y viaticos')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();

COMMIT;
