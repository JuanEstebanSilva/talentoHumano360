-- ═══════════════════════════════════════════════════════════════════════════════
-- 44_clean_servidores_publicos_deploy_v3.sql
-- Tercera limpieza total a estado cero de servidores públicos en el despliegue
-- Gobernación de Boyacá · Talento 360
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '44_clean_servidores_publicos_deploy_v3') THEN
    RAISE NOTICE '[Migración 44] Ejecutando limpieza total a estado cero de servidores públicos...';

    -- 1. Desacoplar restricciones de llaves foráneas dependientes
    ALTER TABLE IF EXISTS horarios DROP CONSTRAINT IF EXISTS fk_horarios_personas;
    ALTER TABLE IF EXISTS viaticos DROP CONSTRAINT IF EXISTS fk_viaticos_personas;
    ALTER TABLE IF EXISTS vacaciones DROP CONSTRAINT IF EXISTS fk_vacaciones_personas;
    ALTER TABLE IF EXISTS historial_solicitudes DROP CONSTRAINT IF EXISTS fk_historial_personas;
    ALTER TABLE IF EXISTS solicitudes_admin DROP CONSTRAINT IF EXISTS fk_solicitudes_personas;
    ALTER TABLE IF EXISTS soportes_solicitudes DROP CONSTRAINT IF EXISTS fk_soportes_personas;

    -- 2. Limpiar registros de servidores públicos
    DELETE FROM rel_principal;
    DELETE FROM contactos;
    DELETE FROM educacion;
    DELETE FROM personas;
    DELETE FROM estados WHERE id_estado NOT IN ('EST001', 'EST002', 'EST003', 'EST004', 'EST005');
    DELETE FROM importaciones WHERE modulo IN ('empleados', 'servidores', 'servidores-publicos');

    -- 3. Reiniciar secuencias autonuméricas
    ALTER SEQUENCE IF EXISTS seq_personas_id RESTART WITH 1;
    ALTER SEQUENCE IF EXISTS seq_contactos_id RESTART WITH 1;
    ALTER SEQUENCE IF EXISTS seq_educacion_id RESTART WITH 1;
    ALTER SEQUENCE IF EXISTS seq_rel_principal_id RESTART WITH 1;
    ALTER SEQUENCE IF EXISTS seq_prov_cedula RESTART WITH 1;
    ALTER SEQUENCE IF EXISTS seq_estados_id RESTART WITH 6;

    -- 4. Registrar en schema_migrations
    INSERT INTO schema_migrations (version, description)
    VALUES ('44_clean_servidores_publicos_deploy_v3', 'Tercera limpieza total a estado cero de servidores publicos en el despliegue')
    ON CONFLICT (version) DO NOTHING;

    RAISE NOTICE '✅ [Migración 44] Servidores públicos limpiados a estado cero exitosamente.';
  END IF;
END $$;
