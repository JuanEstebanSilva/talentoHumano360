-- 31_soportes_solicitudes.sql
-- Soportes de permisos, incapacidades y licencias, guardados en la gestión documental.
-- Si se elimina la solicitud, el documento se conserva para trazabilidad.

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS id_solicitud_admin INTEGER REFERENCES solicitudes_admin(id_solicitud) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_solicitud ON documentos(id_solicitud_admin) WHERE id_solicitud_admin IS NOT NULL;

-- Las incapacidades usan el tipo INCAPACIDAD, ya marcado como sensible. Las licencias también,
-- porque pueden revelar maternidad, luto o salud: conviene validarlo con Talento Humano.
INSERT INTO tipos_documento (codigo, nombre, categoria, palabras_clave, es_sensible) VALUES
  ('SOPORTE_PERMISO',  'Soporte de permiso laboral', 'Situaciones', 'permiso laboral', FALSE),
  ('SOPORTE_LICENCIA', 'Soporte de licencia',        'Salud',       'licencia de maternidad,licencia de paternidad,licencia', TRUE)
ON CONFLICT (codigo) DO NOTHING;
