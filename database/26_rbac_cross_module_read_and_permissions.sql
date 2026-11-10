-- database/26_rbac_cross_module_read_and_permissions.sql
-- Subsanación AUD-4-001: Habilitar lectura cruzada transversal institucional (VER)
-- y segregación estricta de permisos de mutación (CRUD) por dominio funcional.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos TEXT;

-- 1. Superadministrador con privilegios globales
UPDATE usuarios SET 
  modulos = '*', 
  permisos = '*' 
WHERE LOWER(username) IN ('admin', 'admin@boyaca.gov.co');

-- 2. Ángela Ussa y Blanca Soler: CRUD en Servidores Públicos, VER en Horarios y Viáticos
UPDATE usuarios SET 
  modulos = 'dashboard,employees,horarios,viaticos', 
  permisos = 'dashboard:read,employees:read,employees:write,employees:delete,employees:import,employees:export,horarios:read,viaticos:read' 
WHERE LOWER(username) IN ('angela.ussa@boyaca.gov.co', 'blanca.soler@boyaca.gov.co');

-- 3. Doris Cañón: CRUD en Horarios, VER en Servidores Públicos y Viáticos
UPDATE usuarios SET 
  modulos = 'dashboard,employees,horarios,viaticos', 
  permisos = 'dashboard:read,employees:read,horarios:read,horarios:write,horarios:delete,viaticos:read' 
WHERE LOWER(username) IN ('doris.canon@boyaca.gov.co');

-- 4. Bergenet Gutiérrez: CRUD en Viáticos, VER en Servidores Públicos y Horarios
UPDATE usuarios SET 
  modulos = 'dashboard,employees,horarios,viaticos', 
  permisos = 'dashboard:read,employees:read,horarios:read,viaticos:read,viaticos:write,viaticos:status,viaticos:import,viaticos:delete' 
WHERE LOWER(username) IN ('bergenet.gutierrez@boyaca.gov.co');

-- 5. Sandra Roa: SST (Perfil Epidemiológico, Perfil Sociodemográfico y Entrega de EPP)
UPDATE usuarios SET
  modulos = 'sst',
  permisos = 'sst:read,sst:write,epidemiologico:read,epidemiologico:write,sociodemografico:read,sociodemografico:write,epp:read,epp:write'
WHERE LOWER(username) IN ('sandra.roa@boyaca.gov.co');

-- 6. Luis Sanchez: Incapacidades
UPDATE usuarios SET
  modulos = 'admin-requests,incapacidades',
  permisos = 'admin-requests:read,admin-requests:write,incapacidades:read,incapacidades:write,requests:read,requests:write'
WHERE LOWER(username) IN ('luis.sanches@boyaca.gov.co', 'luis.sanchez@boyaca.gov.co');

-- 7. Alejandro Leon: Permisos
UPDATE usuarios SET
  modulos = 'admin-requests,permisos',
  permisos = 'admin-requests:read,admin-requests:write,permisos:read,permisos:write,requests:read,requests:write'
WHERE LOWER(username) IN ('alejandro.leon@boyaca.edu.co', 'alejandro.leon@boyaca.gov.co');

-- 8. Sebastian Rincon: Permisos y Licencias
UPDATE usuarios SET
  modulos = 'admin-requests,permisos,licencias',
  permisos = 'admin-requests:read,admin-requests:write,permisos:read,permisos:write,licencias:read,licencias:write,requests:read,requests:write'
WHERE LOWER(username) IN ('sebastian.rincon@boyaca.gov.co');

