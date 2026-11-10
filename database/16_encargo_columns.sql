-- Migración 16: Columnas explícitas de Encargo en rel_principal
ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS encargo_denominacion VARCHAR(280);
ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS encargo_codigo VARCHAR(80);
ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS encargo_grado VARCHAR(80);
ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS encargo_asignacion VARCHAR(120);
