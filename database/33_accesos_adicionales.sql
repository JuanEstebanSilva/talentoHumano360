-- 33_accesos_adicionales.sql
-- Accesos a Gestión Documental (documents) e Informes y Automatización (reports).
--
-- Los servicios admin-requests y sst vuelven a escribir usuarios.modulos y usuarios.permisos
-- cada vez que arrancan (audit-rbac.js, INITIAL_USERS). Un UPDATE directo se perdería en el
-- siguiente arranque. Por eso los accesos de estos dos módulos se guardan en esta tabla y un
-- trigger los añade a modulos y permisos cada vez que se inserta o actualiza un usuario.
-- Para dar o quitar un acceso basta con agregar o borrar una fila de accesos_adicionales.
-- No toca a quien tiene modulos o permisos '*' (ya tiene acceso a todo).

CREATE TABLE IF NOT EXISTS accesos_adicionales (
    username  VARCHAR(160) NOT NULL,
    modulo    VARCHAR(60)  NOT NULL,
    permisos  TEXT         NOT NULL,   -- separados por coma, p. ej. 'documents:read,documents:write'
    PRIMARY KEY (username, modulo)
);

CREATE OR REPLACE FUNCTION aplicar_accesos_adicionales() RETURNS trigger AS $$
DECLARE
    acc RECORD;
    perm TEXT;
BEGIN
    FOR acc IN SELECT modulo, permisos FROM accesos_adicionales
                WHERE LOWER(username) = LOWER(NEW.username) LOOP
        IF NEW.modulos IS NOT NULL AND NEW.modulos <> '*'
           AND NOT (acc.modulo = ANY (string_to_array(NEW.modulos, ','))) THEN
            NEW.modulos := NEW.modulos || ',' || acc.modulo;
        END IF;
        IF NEW.permisos IS NOT NULL AND NEW.permisos <> '' AND NEW.permisos <> '*' THEN
            FOREACH perm IN ARRAY string_to_array(acc.permisos, ',') LOOP
                IF NOT (perm = ANY (string_to_array(NEW.permisos, ','))) THEN
                    NEW.permisos := NEW.permisos || ',' || perm;
                END IF;
            END LOOP;
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accesos_adicionales ON usuarios;
CREATE TRIGGER trg_accesos_adicionales
    BEFORE INSERT OR UPDATE OF modulos, permisos ON usuarios
    FOR EACH ROW EXECUTE FUNCTION aplicar_accesos_adicionales();

-- Gestión documental para quienes administran las hojas de vida.
-- Los documentos sensibles exigen además documents:sensitive (no se asigna aquí).
INSERT INTO accesos_adicionales (username, modulo, permisos) VALUES
    ('angela.ussa@boyaca.gov.co', 'documents', 'documents:read,documents:write'),
    ('blanca.soler@boyaca.gov.co', 'documents', 'documents:read,documents:write'),
-- Informes: reports:read genera informes, siempre limitados a los módulos que el usuario ya
-- puede consultar; reports:write programa automatizaciones.
    ('angela.ussa@boyaca.gov.co', 'reports', 'reports:read,reports:write'),
    ('blanca.soler@boyaca.gov.co', 'reports', 'reports:read,reports:write'),
    ('bergenet.gutierrez@boyaca.gov.co', 'reports', 'reports:read,reports:write'),
    ('doris.canon@boyaca.gov.co', 'reports', 'reports:read,reports:write')
ON CONFLICT (username, modulo) DO NOTHING;

-- Aplicar a los usuarios que ya existen.
UPDATE usuarios SET modulos = modulos
 WHERE LOWER(username) IN (SELECT LOWER(username) FROM accesos_adicionales);
