-- database/35_usuario_monitoreo_y_respaldo.sql
-- Creación del usuario técnico con acceso exclusivo a Monitoreo de Errores y Copias de Seguridad
-- Gobernación de Boyacá · Talento 360

DELETE FROM usuarios WHERE LOWER(username) = 'talento360.notificaciones@gmail.com';

INSERT INTO usuarios (
  username,
  password,
  nombre,
  rol,
  cargo_laboral,
  estado,
  modulos,
  permisos,
  debe_cambiar_password
) VALUES (
  'talento360.notificaciones@gmail.com',
  '$2a$12$q8sVQEPGroHKAOu9qt0.Eu8qiia7hCzvrVuOBJQ88TdsxJ1.Ow7M2',
  'Gestor de Monitoreo y Respaldo',
  'Monitoreo y Respaldo',
  'Gestor de Monitoreo de Errores y Copias de Seguridad',
  'ACTIVO',
  'admin-errors,admin-backups',
  'admin-errors:read,admin-errors:write,admin-errors:delete,admin-backups:read,admin-backups:write,admin-backups:download,admin-backups:delete',
  false
);
