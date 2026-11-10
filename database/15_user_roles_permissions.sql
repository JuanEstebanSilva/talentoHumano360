-- database/15_user_roles_permissions.sql
-- Adición de control de módulos y definición de usuarios con roles y accesos específicos

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos VARCHAR(255) DEFAULT '*';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos TEXT;

-- Actualizar o insertar usuarios definidos para pruebas y operación
DELETE FROM usuarios WHERE LOWER(username) IN (
  'admin', 'admin@boyaca.gov.co',
  'angela.ussa@boyaca.gov.co',
  'blanca.soler@boyaca.gov.co',
  'bergenet.gutierrez@boyaca.gov.co',
  'doris.canon@boyaca.gov.co',
  'sandra.roa@boyaca.gov.co',
  'luis.sanches@boyaca.gov.co',
  'luis.sanchez@boyaca.gov.co',
  'alejandro.leon@boyaca.edu.co',
  'alejandro.leon@boyaca.gov.co',
  'sebastian.rincon@boyaca.gov.co'
);

INSERT INTO usuarios (username, password, nombre, rol, cargo_laboral, estado, modulos, permisos) VALUES
('admin@boyaca.gov.co', '$2a$12$zkoe.Iv7m74WrDpCt.pgu.lmGXmokTGby9zvOXxvxqFbNvmGUxU8.', 'Administrador', 'Administrador', 'Administrador del Sistema', 'ACTIVO', '*', '*'),
('angela.ussa@boyaca.gov.co', '$2a$10$Qiy07yznq5fSnFhEUTHKaux5uBZrWZ6E34uB.uFEJIMmF9WK/vzhy', 'Angela Ussa', 'Usuario', 'Gestión de Servidores Públicos', 'ACTIVO', 'dashboard,employees,horarios,viaticos', 'dashboard:read,employees:read,employees:write,employees:delete,employees:import,employees:export,horarios:read,viaticos:read'),
('blanca.soler@boyaca.gov.co', '$2a$10$z.YAD5e1rQ1Y80g3yZvNAeYdwxDYvprlaXBFro4.7PQLYL4dd6NWm', 'Blanca Soler', 'Usuario', 'Gestión de Servidores Públicos', 'ACTIVO', 'dashboard,employees,horarios,viaticos', 'dashboard:read,employees:read,employees:write,employees:delete,employees:import,employees:export,horarios:read,viaticos:read'),
('bergenet.gutierrez@boyaca.gov.co', '$2a$10$qLIhhIK4eDPpwdhR.NAbwOkvWfEmUcTjF1kZ9eJHG0dC/2D/ymfi6', 'Bergenet Gutierrez', 'Usuario', 'Gestión de Viáticos', 'ACTIVO', 'dashboard,employees,horarios,viaticos', 'dashboard:read,employees:read,horarios:read,viaticos:read,viaticos:write,viaticos:status,viaticos:import,viaticos:delete'),
('doris.canon@boyaca.gov.co', '$2a$10$7sH2fGXq8jR7z68CKofTAu0iuWyhKjz9tA8KzdWcTC9/3JvaPi2LC', 'Doris Cañon', 'Usuario', 'Gestión de Horarios y Modalidades', 'ACTIVO', 'dashboard,employees,horarios,viaticos', 'dashboard:read,employees:read,horarios:read,horarios:write,horarios:delete,viaticos:read'),
('sandra.roa@boyaca.gov.co', 'Sandra@123', 'Sandra Roa', 'SST', 'Responsable de Seguridad y Salud en el Trabajo (SST)', 'ACTIVO', 'sst', 'sst:read,sst:write,epidemiologico:read,epidemiologico:write,sociodemografico:read,sociodemografico:write,epp:read,epp:write'),
('luis.sanches@boyaca.gov.co', 'Luis@456', 'Luis Sanchez', 'Incapacidades', 'Responsable de Incapacidades y Ausentismo Laboral', 'ACTIVO', 'admin-requests,incapacidades', 'admin-requests:read,admin-requests:write,incapacidades:read,incapacidades:write,requests:read,requests:write'),
('luis.sanchez@boyaca.gov.co', 'Luis@456', 'Luis Sanchez', 'Incapacidades', 'Responsable de Incapacidades y Ausentismo Laboral', 'ACTIVO', 'admin-requests,incapacidades', 'admin-requests:read,admin-requests:write,incapacidades:read,incapacidades:write,requests:read,requests:write'),
('alejandro.leon@boyaca.edu.co', 'Alejandro#123', 'Alejandro Leon', 'Permisos', 'Responsable de Permisos Laborales', 'ACTIVO', 'admin-requests,permisos', 'admin-requests:read,admin-requests:write,permisos:read,permisos:write,requests:read,requests:write'),
('alejandro.leon@boyaca.gov.co', 'Alejandro#123', 'Alejandro Leon', 'Permisos', 'Responsable de Permisos Laborales', 'ACTIVO', 'admin-requests,permisos', 'admin-requests:read,admin-requests:write,permisos:read,permisos:write,requests:read,requests:write'),
('sebastian.rincon@boyaca.gov.co', 'Sebastian#456', 'Sebastian Rincon', 'Permisos y Licencias', 'Responsable de Permisos y Licencias Laborales', 'ACTIVO', 'admin-requests,permisos,licencias', 'admin-requests:read,admin-requests:write,permisos:read,permisos:write,licencias:read,licencias:write,requests:read,requests:write');
