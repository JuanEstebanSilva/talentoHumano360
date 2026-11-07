-- ============================================================================
-- MIGRACIÓN 21: Normalización del Catálogo DIVIPOLA Boyacá (123 Municipios)
-- Plataforma Talento 360 - Gobernación de Boyacá
-- Resuelve AUD-006 / TSK-006
-- ============================================================================

BEGIN;

-- 1. Estandarizar nombre oficial de Guicán de la Sierra en el código DANE 15332
UPDATE divipola 
SET municipio = 'GUICÁN DE LA SIERRA' 
WHERE codigo_depto = '15' AND codigo_mpio = '15332';

-- 2. Eliminar duplicado redundante de Guicán (15334)
DELETE FROM divipola 
WHERE codigo_depto = '15' AND codigo_mpio = '15334';

-- 3. Eliminar duplicado erróneo de Cucaita (15228), preservando el código DANE oficial 15224
DELETE FROM divipola 
WHERE codigo_depto = '15' AND codigo_mpio = '15228';

-- 4. Eliminar duplicado erróneo de Pisba (15564), preservando el código DANE oficial 15550
DELETE FROM divipola 
WHERE codigo_depto = '15' AND codigo_mpio = '15564';

-- 5. Eliminar corregimientos e inspecciones de policía que no constituyen municipios autónomos:
--    - 15572002: EL DOS Y MEDIO (Corregimiento de Puerto Boyacá)
--    - 15407001: LA COLORADA (Corregimiento de Villa de Leyva)
--    - 15759001: MORCÁ (Corregimiento de Sogamoso)
--    - 15572001: PUERTO ROMERO (Corregimiento de Puerto Boyacá)
--    - 15759002: VENECIA (Corregimiento de Sogamoso)
DELETE FROM divipola 
WHERE codigo_depto = '15' AND codigo_mpio IN (
  '15572002', 
  '15407001', 
  '15759001', 
  '15572001', 
  '15759002'
);

COMMIT;

