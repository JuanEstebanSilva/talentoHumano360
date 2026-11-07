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

