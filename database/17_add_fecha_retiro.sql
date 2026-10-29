-- ═══════════════════════════════════════════════════════════════════════════
-- 17_add_fecha_retiro.sql
-- Agrega columna fecha_retiro en rel_principal para trazabilidad de retiros
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS fecha_retiro VARCHAR(40);

COMMENT ON COLUMN rel_principal.fecha_retiro IS 'Fecha de retiro efectiva del servidor público (congelamiento de tiempo de servicio)';
