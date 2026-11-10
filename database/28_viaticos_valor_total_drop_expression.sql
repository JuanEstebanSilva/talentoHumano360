-- ==============================================================================
-- Migración 28: Desacoplar cálculo automático de valor_total en viáticos
-- Regla Institucional: Viáticos es un repositorio de importes reportados de software
-- externo contable y NO un motor de liquidación salarial.
-- Convierte 'valor_total' de columna generada a columna estándar NUMERIC(15,2).
-- ==============================================================================

ALTER TABLE viaticos
ALTER COLUMN valor_total DROP EXPRESSION IF EXISTS;

-- Asegurar que valor_total permita valores nulos cuando el origen no los reporte
ALTER TABLE viaticos
ALTER COLUMN valor_total DROP NOT NULL;

COMMENT ON COLUMN viaticos.valor_total IS 'Importe total reportado oficialmente en el soporte contable/Excel sin recálculo de liquidación';

