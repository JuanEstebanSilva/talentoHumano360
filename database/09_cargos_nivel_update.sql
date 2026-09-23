-- ============================================================
-- 09_cargos_nivel_update.sql
-- Actualización del nivel jerárquico de cargos según
-- Decreto Ley 785 de 2005 / Función Pública Colombia:
-- 0xx -> DIRECTIVO, 1xx -> ASESOR, 2xx -> PROFESIONAL,
-- 3xx -> TÉCNICO, 4xx -> ASISTENCIAL
-- ============================================================

UPDATE cargos SET nivel = CASE
  WHEN codigo ~ '^0[0-9]{2}' THEN 'DIRECTIVO'
  WHEN codigo ~ '^1[0-9]{2}' THEN 'ASESOR'
  WHEN codigo ~ '^2[0-9]{2}' THEN 'PROFESIONAL'
  WHEN codigo ~ '^3[0-9]{2}' THEN 'TÉCNICO'
  WHEN codigo ~ '^4[0-9]{2}' THEN 'ASISTENCIAL'
  WHEN cargo ILIKE '%ASESOR%' THEN 'ASESOR'
  WHEN cargo ILIKE '%DIRECTOR%' OR cargo ILIKE '%SUBDIRECTOR%' OR cargo ILIKE '%GOBERNADOR%' OR cargo ILIKE '%SECRETARIO DE DESPACHO%' OR cargo ILIKE '%GERENTE%' OR cargo ILIKE '%COORDINADOR%' THEN 'DIRECTIVO'
  WHEN cargo ILIKE '%PROFESIONAL%' OR cargo ILIKE '%MEDICO%' OR cargo ILIKE '%ANALISTA%' OR cargo ILIKE '%INSPECTOR%' OR cargo ILIKE '%TESORERO%' OR cargo ILIKE '%ALMACENISTA%' THEN 'PROFESIONAL'
  WHEN cargo ILIKE '%TECNICO%' OR cargo ILIKE '%TÉCNICO%' THEN 'TÉCNICO'
  WHEN cargo ILIKE '%AUXILIAR%' OR cargo ILIKE '%SECRETARI%' OR cargo ILIKE '%CONDUCTOR%' OR cargo ILIKE '%CELADOR%' OR cargo ILIKE '%OPERARIO%' THEN 'ASISTENCIAL'
  WHEN cargo ILIKE '%CONTRATISTA%' THEN 'CONTRATISTA'
  ELSE COALESCE(NULLIF(nivel, ''), 'PROFESIONAL')
END;
