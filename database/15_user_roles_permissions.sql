-- database/15_user_roles_permissions.sql
-- Adición de control de módulos y definición de usuarios con roles y accesos específicos

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos VARCHAR(255) DEFAULT '*';

-- Actualizar o insertar usuarios definidos para pruebas y operación
DELETE FROM usuarios WHERE LOWER(username) IN ('admin', 'admin@boyaca.gov.co', 'angela.ussa@boyaca.gov.co', 'bergenet.gutierrez@boyaca.gov.co', 'doris.canon@boyaca.gov.co');

INSERT INTO usuarios (username, password, nombre, rol, cargo_laboral, estado, modulos) VALUES
('admin', '$2a$10$6KxndawYS6zz0r7PMzG4JeepSfqGCa8heMaJIn9g2R4Zqeg29wOQW', 'Administrador', 'Administrador', 'Administrador del Sistema', 'ACTIVO', '*'),
('angela.ussa@boyaca.gov.co', '$2a$10$Qiy07yznq5fSnFhEUTHKaux5uBZrWZ6E34uB.uFEJIMmF9WK/vzhy', 'Angela Ussa', 'Usuario', 'Gestión de Servidores Públicos', 'ACTIVO', 'dashboard,employees'),
('bergenet.gutierrez@boyaca.gov.co', '$2a$10$qLIhhIK4eDPpwdhR.NAbwOkvWfEmUcTjF1kZ9eJHG0dC/2D/ymfi6', 'Bergenet Gutierrez', 'Usuario', 'Gestión de Viáticos', 'ACTIVO', 'dashboard,viaticos'),
('doris.canon@boyaca.gov.co', '$2a$10$7sH2fGXq8jR7z68CKofTAu0iuWyhKjz9tA8KzdWcTC9/3JvaPi2LC', 'Doris Cañon', 'Usuario', 'Gestión de Horarios y Modalidades', 'ACTIVO', 'dashboard,horarios');
