-- ============================================================================
-- MIGRACIÓN 25: NORMALIZACIÓN DEL CICLO DE VIDA Y MÁQUINA DE ESTADOS DE VIÁTICOS
-- Hallazgos: AUD-004 / AUD-005 (Responsable funcional: Bergenet Gutiérrez)
-- Plataforma Talento 360 - Gobernación de Boyacá
-- ============================================================================

BEGIN;

-- 1. Normalización de estados históricos existentes en la tabla viaticos
UPDATE viaticos 
SET estado = 'Aprobado' 
WHERE estado IN ('Aprobada', 'aprobada', 'APROBADA', 'Aprobado');

UPDATE viaticos 
SET estado = 'Legalizado' 
WHERE estado IN ('Finalizada', 'finalizada', 'FINALIZADA', 'Legalizada', 'legalizada', 'Legalizado');

UPDATE viaticos 
SET estado = 'En Ejecución' 
WHERE estado IN ('En ejecucion', 'En Ejecucion', 'En ejecución', 'EN EJECUCION');

UPDATE viaticos 
SET estado = 'Radicado' 
WHERE estado IN ('Pendiente', 'pendiente', 'PENDIENTE', 'En revisión', 'En revision', 'Radicada', 'Radicado');

UPDATE viaticos 
SET estado = 'Rechazado' 
WHERE estado IN ('Rechazada', 'rechazada', 'RECHAZADA', 'Rechazado');

UPDATE viaticos 
SET estado = 'Anulado' 
WHERE estado IN ('Anulada', 'anulada', 'ANULADA', 'Anulado');

-- Asignar cualquier residual no reconocido al estado inicial canónico 'Radicado'
UPDATE viaticos 
SET estado = 'Radicado' 
WHERE estado NOT IN ('Radicado', 'Aprobado', 'En Ejecución', 'Legalizado', 'Rechazado', 'Anulado');

-- 2. Actualizar valor por defecto de la columna estado a 'Radicado' y ampliar observaciones a TEXT
ALTER TABLE viaticos ALTER COLUMN estado SET DEFAULT 'Radicado';
ALTER TABLE viaticos ALTER COLUMN observaciones TYPE TEXT;

-- 3. Garantizar restricción CHECK sobre estados canónicos institucionales
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_viaticos_estado'
  ) THEN
    ALTER TABLE viaticos DROP CONSTRAINT chk_viaticos_estado;
  END IF;
  
  ALTER TABLE viaticos
  ADD CONSTRAINT chk_viaticos_estado
  CHECK (estado IN ('Radicado', 'Aprobado', 'En Ejecución', 'Legalizado', 'Rechazado', 'Anulado'));
END $$;

-- 4. Extender tabla historial_viaticos con columna estado_anterior para trazabilidad completa
ALTER TABLE historial_viaticos ADD COLUMN IF NOT EXISTS estado_anterior VARCHAR(80);

-- Normalizar estados históricos en historial_viaticos
UPDATE historial_viaticos 
SET estado_nuevo = 'Aprobado' 
WHERE estado_nuevo IN ('Aprobada', 'aprobada');

UPDATE historial_viaticos 
SET estado_nuevo = 'Legalizado' 
WHERE estado_nuevo IN ('Finalizada', 'finalizada');

-- 5. Índices de rendimiento para consultas de estado e historial
CREATE INDEX IF NOT EXISTS idx_viaticos_estado ON viaticos(estado);
CREATE INDEX IF NOT EXISTS idx_historial_viaticos_id_viatico ON historial_viaticos(id_viatico);
CREATE INDEX IF NOT EXISTS idx_historial_viaticos_fecha ON historial_viaticos(fecha_actualizacion);

COMMIT;

