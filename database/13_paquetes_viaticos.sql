-- ============================================================================
-- 13_paquetes_viaticos.sql: Soporte para Paquetes / Vigencias de Viáticos (Excels)
-- Permite organizar, importar, editar y visualizar viáticos por archivo / año
-- ============================================================================

CREATE TABLE IF NOT EXISTS paquetes_viaticos (
    id_paquete SERIAL PRIMARY KEY,
    nombre VARCHAR(280) NOT NULL,
    archivo_origen VARCHAR(280),
    anio INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    descripcion TEXT,
    creado_por VARCHAR(120) DEFAULT 'admin',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE viaticos ADD COLUMN IF NOT EXISTS id_paquete INT REFERENCES paquetes_viaticos(id_paquete) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_viaticos_paquete ON viaticos(id_paquete);
CREATE INDEX IF NOT EXISTS idx_paquetes_anio ON paquetes_viaticos(anio);
