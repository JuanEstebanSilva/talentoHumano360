-- ============================================================================
-- MIGRACIÓN 33: Soporte para Estado 'Sin Viático' en Módulo de Viáticos
-- Plataforma Talento 360 - Gobernación de Boyacá
-- Permite registrar y clasificar comisiones oficiales autorizadas 'Sin Viático'
-- ============================================================================

BEGIN;

-- 1. Actualizar restricción de estados canónicos en tabla viáticos
ALTER TABLE viaticos DROP CONSTRAINT IF EXISTS chk_viaticos_estado;
ALTER TABLE viaticos ADD CONSTRAINT chk_viaticos_estado
  CHECK (estado IN ('Radicado', 'Aprobado', 'En Ejecución', 'Legalizado', 'Sin Viático', 'Sin Viáticos', 'Rechazado', 'Anulado'));

-- 2. Normalizar cualquier viático existente que tenga variaciones de sin viáticos
UPDATE viaticos
SET estado = 'Sin Viático', valor_total = 0, valor_diario = 0
WHERE (
  LOWER(observaciones) LIKE '%sin viatico%' 
  OR LOWER(observaciones) LIKE '%sin viático%' 
  OR LOWER(observaciones) LIKE '%sin viaticos%' 
  OR LOWER(observaciones) LIKE '%sin viáticos%'
  OR LOWER(estado) LIKE '%sin viatic%'
) AND estado != 'Sin Viático';

-- 3. Registrar migración en la tabla schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(160) PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description)
VALUES ('33_viaticos_estado_sin_viatico', 'Soporte para estado Sin Viático en modulo de viaticos')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();

COMMIT;

