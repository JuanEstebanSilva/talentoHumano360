-- =============================================================================
-- Talento 360 — Migración 29: Recuperación de Contraseña y Cambio Obligatorio
-- Gobernación de Boyacá
-- =============================================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN usuarios.debe_cambiar_password IS 'Bandera que obliga al usuario a actualizar su contraseña provisional en su siguiente inicio de sesión';
COMMENT ON COLUMN usuarios.password_reset_expires IS 'Fecha y hora límite de validez de la contraseña provisional generada por recuperación';

