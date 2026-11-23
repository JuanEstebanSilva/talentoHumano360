-- =============================================================================
-- Talento 360 — Migración 29: Recuperación de Contraseña y Cambio Obligatorio
-- Gobernación de Boyacá
-- =============================================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1;

COMMENT ON COLUMN usuarios.debe_cambiar_password IS 'Bandera que obliga al usuario a actualizar su contraseña provisional en su siguiente inicio de sesión';
COMMENT ON COLUMN usuarios.password_reset_expires IS 'Fecha y hora límite de validez de la contraseña provisional generada por recuperación';

CREATE TABLE IF NOT EXISTS auth_failed_logins (
  identifier VARCHAR(160) PRIMARY KEY,
  failed_attempts INT NOT NULL DEFAULT 0,
  lockout_tier INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(80) NOT NULL,
  identifier VARCHAR(160),
  ip_address VARCHAR(100),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

