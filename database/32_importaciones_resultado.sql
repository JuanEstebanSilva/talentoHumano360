-- 32_importaciones_resultado.sql
-- El historial de cargas registra también las rechazadas (error de validación)
-- y las fallidas (error del servidor, se revierte), con su motivo.

ALTER TABLE importaciones
    ADD COLUMN IF NOT EXISTS resultado VARCHAR(20) NOT NULL DEFAULT 'Completada',
    ADD COLUMN IF NOT EXISTS motivo    TEXT;

DO $$ BEGIN
    ALTER TABLE importaciones
        ADD CONSTRAINT importaciones_resultado_chk CHECK (resultado IN ('Completada', 'Rechazada', 'Fallida'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
