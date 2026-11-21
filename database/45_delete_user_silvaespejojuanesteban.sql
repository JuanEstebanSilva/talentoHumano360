-- ═══════════════════════════════════════════════════════════════════════════════
-- 45_delete_user_silvaespejojuanesteban.sql
-- Eliminación definitiva del usuario silvaespejojuanesteban@gmail de la plataforma
-- Gobernación de Boyacá · Talento 360
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '45_delete_user_silvaespejojuanesteban') THEN
    RAISE NOTICE '[Migración 45] Eliminando usuario silvaespejojuanesteban@gmail de la plataforma...';

    -- 1. Eliminar intentos fallidos o bloqueos de acceso asociados
    DELETE FROM auth_failed_logins 
    WHERE LOWER(identifier) LIKE '%silvaespejojuanesteban%';

    -- 2. Eliminar el usuario de la tabla usuarios
    DELETE FROM usuarios 
    WHERE LOWER(username) LIKE '%silvaespejojuanesteban%' 
       OR LOWER(username) = 'silvaespejojuanesteban@gmail' 
       OR LOWER(username) = 'silvaespejojuanesteban@gmail.com';

    -- 3. Registrar migración en schema_migrations
    INSERT INTO schema_migrations (version, description)
    VALUES ('45_delete_user_silvaespejojuanesteban', 'Eliminacion definitiva del usuario silvaespejojuanesteban@gmail de la plataforma')
    ON CONFLICT (version) DO NOTHING;

    RAISE NOTICE '✅ [Migración 45] Usuario silvaespejojuanesteban@gmail eliminado exitosamente de la plataforma.';
  END IF;
END $$;
