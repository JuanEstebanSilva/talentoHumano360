-- ============================================================================
-- 27_clean_transactional_inserts.sql
-- Limpieza integral de registros transaccionales de:
-- 1. Viáticos (viaticos, historial_viaticos, paquetes_viaticos)
-- 2. Horarios (horarios, historial_horarios)
-- 3. Servidores Públicos (personas, rel_principal, contactos, educacion, vacaciones, historial_solicitudes)
-- Mantiene intactos los catálogos institucionales, usuarios y roles del sistema.
-- ============================================================================

BEGIN;

TRUNCATE TABLE 
  historial_viaticos,
  viaticos,
  paquetes_viaticos,
  historial_horarios,
  horarios,
  historial_solicitudes,
  vacaciones,
  rel_principal,
  contactos,
  educacion,
  personas
RESTART IDENTITY CASCADE;

-- Reinicio de secuencias numéricas a 1
ALTER SEQUENCE IF EXISTS viaticos_id_viatico_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS historial_viaticos_id_historial_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS paquetes_viaticos_id_paquete_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS horarios_id_horario_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS historial_horarios_id_historial_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_personas_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_rel_principal_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_contactos_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_educacion_id RESTART WITH 1;
ALTER SEQUENCE IF EXISTS vacaciones_id_vacacion_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS historial_solicitudes_id_historial_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_prov_cedula RESTART WITH 1;

COMMIT;

