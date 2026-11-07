-- ═══════════════════════════════════════════════════════════════════════════════
-- 18_system_errors_and_backups.sql — Módulo de Monitoreo de Errores y Backups
-- Gobernación de Boyacá · Talento 360 · Administración del Sistema
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_errors (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL, -- 'PAGE_404', 'CONSOLE_ERROR', 'API_ERROR', 'UNHANDLED_REJECTION'
  mensaje TEXT NOT NULL,
  url TEXT,
  stack TEXT,
  usuario VARCHAR(150) DEFAULT 'Anónimo',
  ip_address VARCHAR(100),
  user_agent TEXT,
  estado VARCHAR(30) DEFAULT 'Pendiente', -- 'Pendiente', 'Revisado', 'Resuelto'
  reportado_por_usuario BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resuelto_en TIMESTAMP WITH TIME ZONE,
  resuelto_por VARCHAR(150)
);

CREATE INDEX IF NOT EXISTS idx_system_errors_tipo ON system_errors(tipo);
CREATE INDEX IF NOT EXISTS idx_system_errors_estado ON system_errors(estado);
CREATE INDEX IF NOT EXISTS idx_system_errors_creado_en ON system_errors(creado_en DESC);

CREATE TABLE IF NOT EXISTS system_backups (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  filepath TEXT NOT NULL,
  filesize BIGINT DEFAULT 0,
  tipo VARCHAR(50) DEFAULT 'MANUAL', -- 'MANUAL', 'AUTOMATICO'
  creado_por VARCHAR(150) DEFAULT 'admin',
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  estado VARCHAR(50) DEFAULT 'Completado',
  detalles TEXT
);

CREATE INDEX IF NOT EXISTS idx_system_backups_creado_en ON system_backups(creado_en DESC);

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Valores iniciales de configuración para copias de seguridad automáticas
INSERT INTO system_settings (key, value) VALUES
  ('backup_daily_enabled', 'true'),
  ('backup_daily_hour', '23'),
  ('backup_daily_minute', '00'),
  ('backup_retention_days', '30')
ON CONFLICT (key) DO NOTHING;
