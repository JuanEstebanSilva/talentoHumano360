-- ============================================================================
-- MIGRACIÓN 24: Depuración Integral del Catálogo DIVIPOLA Boyacá
-- Plataforma Talento 360 - Gobernación de Boyacá
-- Resuelve AUD-005 / AUD-006 / TSK-006 (Responsable: Bergenet Gutiérrez)
-- ============================================================================

BEGIN;

-- 1. Normalización de Nombres Oficiales DANE para los 123 Municipios de Boyacá
-- Corrección de discrepancias tipográficas históricas
UPDATE divipola 
SET municipio = 'SANTA ROSA DE VITERBO' 
WHERE codigo_depto = '15' AND codigo_mpio = '15693';

UPDATE divipola 
SET municipio = 'SAN PABLO DE BORBUR' 
WHERE codigo_depto = '15' AND codigo_mpio = '15681';

UPDATE divipola 
SET municipio = 'GUICÁN DE LA SIERRA' 
WHERE codigo_depto = '15' AND codigo_mpio = '15332';

-- Asegurar nombres canónicos oficiales según DANE DIVIPOLA
UPDATE divipola SET municipio = 'BELÉN' WHERE codigo_depto = '15' AND codigo_mpio = '15087';
UPDATE divipola SET municipio = 'BETÉITIVA' WHERE codigo_depto = '15' AND codigo_mpio = '15092';
UPDATE divipola SET municipio = 'BOYACÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15104';
UPDATE divipola SET municipio = 'BUSBANZÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15114';
UPDATE divipola SET municipio = 'CHIQUINQUIRÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15176';
UPDATE divipola SET municipio = 'CHIVATÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15187';
UPDATE divipola SET municipio = 'CIÉNEGA' WHERE codigo_depto = '15' AND codigo_mpio = '15189';
UPDATE divipola SET municipio = 'CÓMBITA' WHERE codigo_depto = '15' AND codigo_mpio = '15204';
UPDATE divipola SET municipio = 'COVARACHÍA' WHERE codigo_depto = '15' AND codigo_mpio = '15218';
UPDATE divipola SET municipio = 'CUBARÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15223';
UPDATE divipola SET municipio = 'CUÍTIVA' WHERE codigo_depto = '15' AND codigo_mpio = '15226';
UPDATE divipola SET municipio = 'CHÍQUIZA' WHERE codigo_depto = '15' AND codigo_mpio = '15232';
UPDATE divipola SET municipio = 'GACHANTIVÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15293';
UPDATE divipola SET municipio = 'GÁMEZA' WHERE codigo_depto = '15' AND codigo_mpio = '15296';
UPDATE divipola SET municipio = 'GUAYATÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15325';
UPDATE divipola SET municipio = 'JERICÓ' WHERE codigo_depto = '15' AND codigo_mpio = '15368';
UPDATE divipola SET municipio = 'MARIPÍ' WHERE codigo_depto = '15' AND codigo_mpio = '15442';
UPDATE divipola SET municipio = 'MONGUÍ' WHERE codigo_depto = '15' AND codigo_mpio = '15466';
UPDATE divipola SET municipio = 'MONIQUIRÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15469';
UPDATE divipola SET municipio = 'NUEVO COLÓN' WHERE codigo_depto = '15' AND codigo_mpio = '15494';
UPDATE divipola SET municipio = 'OICATÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15500';
UPDATE divipola SET municipio = 'PÁEZ' WHERE codigo_depto = '15' AND codigo_mpio = '15514';
UPDATE divipola SET municipio = 'PAZ DE RÍO' WHERE codigo_depto = '15' AND codigo_mpio = '15537';
UPDATE divipola SET municipio = 'PUERTO BOYACÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15572';
UPDATE divipola SET municipio = 'QUÍPAMA' WHERE codigo_depto = '15' AND codigo_mpio = '15580';
UPDATE divipola SET municipio = 'RAMIRIQUÍ' WHERE codigo_depto = '15' AND codigo_mpio = '15599';
UPDATE divipola SET municipio = 'RÁQUIRA' WHERE codigo_depto = '15' AND codigo_mpio = '15600';
UPDATE divipola SET municipio = 'RONDÓN' WHERE codigo_depto = '15' AND codigo_mpio = '15621';
UPDATE divipola SET municipio = 'SABOYÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15632';
UPDATE divipola SET municipio = 'SÁCHICA' WHERE codigo_depto = '15' AND codigo_mpio = '15638';
UPDATE divipola SET municipio = 'SAMACÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15646';
UPDATE divipola SET municipio = 'SAN JOSÉ DE PARE' WHERE codigo_depto = '15' AND codigo_mpio = '15664';
UPDATE divipola SET municipio = 'SANTA MARÍA' WHERE codigo_depto = '15' AND codigo_mpio = '15690';
UPDATE divipola SET municipio = 'SANTA SOFÍA' WHERE codigo_depto = '15' AND codigo_mpio = '15696';
UPDATE divipola SET municipio = 'SOATÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15753';
UPDATE divipola SET municipio = 'SOCOTÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15755';
UPDATE divipola SET municipio = 'SOTAQUIRÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15763';
UPDATE divipola SET municipio = 'SORACÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15764';
UPDATE divipola SET municipio = 'SUSACÓN' WHERE codigo_depto = '15' AND codigo_mpio = '15774';
UPDATE divipola SET municipio = 'SUTAMARCHÁN' WHERE codigo_depto = '15' AND codigo_mpio = '15776';
UPDATE divipola SET municipio = 'TIBANÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15804';
UPDATE divipola SET municipio = 'TINJACÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15808';
UPDATE divipola SET municipio = 'TOGÜÍ' WHERE codigo_depto = '15' AND codigo_mpio = '15816';
UPDATE divipola SET municipio = 'TÓPAGA' WHERE codigo_depto = '15' AND codigo_mpio = '15820';
UPDATE divipola SET municipio = 'TUNUNGUÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15832';
UPDATE divipola SET municipio = 'TURMEQUÉ' WHERE codigo_depto = '15' AND codigo_mpio = '15835';
UPDATE divipola SET municipio = 'TUTAZÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15839';
UPDATE divipola SET municipio = 'ÚMBITA' WHERE codigo_depto = '15' AND codigo_mpio = '15842';
UPDATE divipola SET municipio = 'VIRACACHÁ' WHERE codigo_depto = '15' AND codigo_mpio = '15879';

-- 2. Asegurar eliminación estricta de códigos duplicados o erróneos si persistieran
DELETE FROM divipola WHERE codigo_depto = '15' AND codigo_mpio IN ('15334', '15228', '15564');

-- 3. Tabla Especializada de Corregimientos, Centros Poblados y Asentamientos de Boyacá
-- Permite registrar comisiones con detalle geográfico preservando la relación con el municipio padre
CREATE TABLE IF NOT EXISTS divipola_asentamientos (
    id_asentamiento SERIAL PRIMARY KEY,
    codigo_depto VARCHAR(5) NOT NULL DEFAULT '15',
    codigo_mpio VARCHAR(10) NOT NULL REFERENCES divipola(codigo_mpio) ON DELETE RESTRICT ON UPDATE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'CORREGIMIENTO', -- 'CORREGIMIENTO', 'CENTRO POBLADO', 'INSPECCION', 'VEREDA'
    codigo_dane_asentamiento VARCHAR(20),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_asentamiento_mpio_nombre UNIQUE (codigo_mpio, nombre)
);

-- Índices para búsqueda de alto rendimiento e insensibilidad a acentos
CREATE INDEX IF NOT EXISTS idx_divipola_asent_mpio ON divipola_asentamientos (codigo_mpio);
CREATE INDEX IF NOT EXISTS idx_divipola_asent_nombre ON divipola_asentamientos (TRANSLATE(LOWER(nombre), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn'));
CREATE INDEX IF NOT EXISTS idx_divipola_search_mpio ON divipola (TRANSLATE(LOWER(municipio), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn'));

-- 4. Registrar Asentamientos y Corregimientos Oficiales de Boyacá vinculados a sus Municipios Padres
DELETE FROM divipola_asentamientos WHERE nombre LIKE '%?%';
INSERT INTO divipola_asentamientos (codigo_depto, codigo_mpio, nombre, tipo, codigo_dane_asentamiento)
VALUES
  -- Sogamoso (15759)
  ('15', '15759', 'MORCÁ', 'CORREGIMIENTO', '15759001'),
  ('15', '15759', 'VENECIA', 'CORREGIMIENTO', '15759002'),
  ('15', '15759', 'PALOBLANCO', 'CENTRO POBLADO', '15759003'),
  -- Puerto Boyacá (15572)
  ('15', '15572', 'EL DOS Y MEDIO', 'CORREGIMIENTO', '15572002'),
  ('15', '15572', 'PUERTO ROMERO', 'CORREGIMIENTO', '15572001'),
  ('15', '15572', 'PUERTO SERVIEZ', 'CORREGIMIENTO', '15572003'),
  -- Villa de Leyva (15407)
  ('15', '15407', 'LA COLORADA', 'CORREGIMIENTO', '15407001'),
  -- Nobsa (15491)
  ('15', '15491', 'BELENCITO', 'CENTRO POBLADO', '15491001'),
  -- Duitama (15238)
  ('15', '15238', 'SURBA Y BONZA', 'CORREGIMIENTO', '15238001'),
  ('15', '15238', 'TOBOSÍA', 'CORREGIMIENTO', '15238002'),
  -- Tunja (15001)
  ('15', '15001', 'PIRGUA', 'VEREDA', '15001001'),
  ('15', '15001', 'LA HOYADA', 'VEREDA', '15001002')
ON CONFLICT (codigo_mpio, nombre) DO UPDATE 
SET tipo = EXCLUDED.tipo, codigo_dane_asentamiento = EXCLUDED.codigo_dane_asentamiento, activo = TRUE;

-- 5. Vista Canónica Unificada de Destinos de Boyacá
CREATE OR REPLACE VIEW v_destinos_boyaca AS
SELECT 
    d.codigo_mpio AS codigo,
    d.codigo_mpio,
    d.municipio AS nombre,
    d.municipio,
    d.departamento,
    'MUNICIPIO'::VARCHAR(50) AS tipo,
    NULL::VARCHAR(120) AS asentamiento,
    d.municipio || ', BOYACÁ' AS destino_completo,
    d.municipio AS municipio_base_tarifa
FROM divipola d
WHERE d.codigo_depto = '15'
UNION ALL
SELECT 
    COALESCE(a.codigo_dane_asentamiento, a.codigo_mpio || '-' || a.id_asentamiento::text) AS codigo,
    d.codigo_mpio,
    a.nombre || ' (' || d.municipio || ')' AS nombre,
    d.municipio,
    d.departamento,
    a.tipo,
    a.nombre AS asentamiento,
    a.nombre || ', ' || d.municipio || ', BOYACÁ' AS destino_completo,
    d.municipio AS municipio_base_tarifa
FROM divipola_asentamientos a
JOIN divipola d ON d.codigo_mpio = a.codigo_mpio
WHERE a.activo = TRUE;

COMMIT;
