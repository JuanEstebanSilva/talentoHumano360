-- ============================================================================
-- MIGRACIÓN 31: Columna presupuesto_inicial en paquetes_viaticos
-- Plataforma Talento 360 - Gobernación de Boyacá
-- Permite registrar un presupuesto inicial asignado a cada ejecución presupuestal
-- ============================================================================

BEGIN;

ALTER TABLE IF EXISTS paquetes_viaticos 
  ADD COLUMN IF NOT EXISTS presupuesto_inicial NUMERIC(15,2) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(160) PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description)
VALUES ('31_paquetes_viaticos_presupuesto_inicial', 'Columna presupuesto_inicial en paquetes_viaticos')
ON CONFLICT (version) DO NOTHING;

COMMIT;

