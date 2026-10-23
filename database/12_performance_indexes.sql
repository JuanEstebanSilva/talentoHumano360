-- ============================================================================
-- 12_performance_indexes.sql: Índices de Alto Rendimiento para Carga Masiva
-- Asegura respuestas <100ms en paginación y búsquedas con +20,000 registros
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_personas_cedula ON personas(cedula);
CREATE INDEX IF NOT EXISTS idx_personas_nombre ON personas(nombre_completo);
CREATE INDEX IF NOT EXISTS idx_rel_persona ON rel_principal(id_persona);
CREATE INDEX IF NOT EXISTS idx_horarios_consecutivo ON horarios(numero_consecutivo);
CREATE INDEX IF NOT EXISTS idx_horarios_fechas_fin ON horarios(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_horarios_consecutivo_expr ON horarios (COALESCE(numero_consecutivo, 999999), id_horario);

ANALYZE personas;
ANALYZE rel_principal;
ANALYZE viaticos;
ANALYZE horarios;
