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

INSERT INTO paquetes_viaticos (id_paquete, nombre, archivo_origen, anio, descripcion)
VALUES 
    (1, 'Ejecución Presupuestal 2022', 'EJECUCION PRESUPUESTAL 2022.xlsx', 2022, 'Vigencia fiscal 2022 institucional'),
    (2, 'Ejecución Presupuestal 2023', 'EJECUCION PRESUPUESTAL 2023.xlsx', 2023, 'Vigencia fiscal 2023 institucional'),
    (3, 'Ejecución Presupuestal 2024', 'EJECUCION PRESUPUESTAL 2024.xlsx', 2024, 'Vigencia fiscal 2024 institucional'),
    (4, 'Ejecución Presupuestal 2025', 'EJECUCION PRESUPUESTAL 2025.xlsx', 2025, 'Vigencia fiscal 2025 institucional'),
    (5, 'Ejecución Presupuestal 2026', 'EJECUCION PRESUPUESTAL 2026.xlsx', 2026, 'Vigencia fiscal 2026 en curso')
ON CONFLICT (id_paquete) DO NOTHING;

UPDATE viaticos SET id_paquete = 1 WHERE id_paquete IS NULL AND fecha_inicio LIKE '%2022%';
UPDATE viaticos SET id_paquete = 2 WHERE id_paquete IS NULL AND fecha_inicio LIKE '%2023%';
UPDATE viaticos SET id_paquete = 3 WHERE id_paquete IS NULL AND fecha_inicio LIKE '%2024%';
UPDATE viaticos SET id_paquete = 4 WHERE id_paquete IS NULL AND fecha_inicio LIKE '%2025%';
UPDATE viaticos SET id_paquete = 5 WHERE id_paquete IS NULL;

SELECT setval('paquetes_viaticos_id_paquete_seq', COALESCE((SELECT MAX(id_paquete) FROM paquetes_viaticos), 1));
