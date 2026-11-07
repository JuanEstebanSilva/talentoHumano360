-- ============================================================================
-- 20_viaticos_escalas_decretos.sql: Escalas Salariales y Decretos de Viáticos
-- Gobernación de Boyacá - Plataforma Talento 360
-- Soporte normativo para liquidación según Decretos Salariales 2024, 2025 y 2026
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS viaticos_escalas (
    id_escala SERIAL PRIMARY KEY,
    anio INT NOT NULL,
    numero_decreto VARCHAR(120) NOT NULL,
    salario_desde NUMERIC(15,2) NOT NULL,
    salario_hasta NUMERIC(15,2) NOT NULL,
    tarifa_pernocta NUMERIC(15,2) NOT NULL,
    tarifa_sin_pernocta NUMERIC(15,2) NOT NULL,
    descripcion VARCHAR(280),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_viaticos_escalas_anio ON viaticos_escalas(anio);
CREATE INDEX IF NOT EXISTS idx_viaticos_escalas_rango ON viaticos_escalas(anio, salario_desde, salario_hasta);

-- ----------------------------------------------------------------------------
-- Vigencia 2024: Decreto Nacional 304 de 2024 (Escala de Viáticos Sector Público)
-- ----------------------------------------------------------------------------
INSERT INTO viaticos_escalas (anio, numero_decreto, salario_desde, salario_hasta, tarifa_pernocta, tarifa_sin_pernocta, descripcion)
VALUES
  (2024, 'Decreto 304 de 2024', 0.00, 1636315.00, 145419.00, 72710.00, 'Escala 1: Hasta $1.636.315'),
  (2024, 'Decreto 304 de 2024', 1636316.00, 2656324.00, 213916.00, 106958.00, 'Escala 2: De $1.636.316 a $2.656.324'),
  (2024, 'Decreto 304 de 2024', 2656325.00, 3630985.00, 263634.00, 131817.00, 'Escala 3: De $2.656.325 a $3.630.985'),
  (2024, 'Decreto 304 de 2024', 3630986.00, 4757781.00, 314939.00, 157470.00, 'Escala 4: De $3.630.986 a $4.757.781'),
  (2024, 'Decreto 304 de 2024', 4757782.00, 5922825.00, 384662.00, 192331.00, 'Escala 5: De $4.757.782 a $5.922.825'),
  (2024, 'Decreto 304 de 2024', 5922826.00, 8356593.00, 468966.00, 234483.00, 'Escala 6: De $5.922.826 a $8.356.593'),
  (2024, 'Decreto 304 de 2024', 8356594.00, 11233155.00, 601765.00, 300883.00, 'Escala 7: De $8.356.594 a $11.233.155'),
  (2024, 'Decreto 304 de 2024', 11233156.00, 15176439.00, 717309.00, 358655.00, 'Escala 8: De $11.233.156 a $15.176.439'),
  (2024, 'Decreto 304 de 2024', 15176440.00, 999999999.00, 841670.00, 420835.00, 'Escala 9: De $15.176.440 en adelante')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Vigencia 2025: Decreto Nacional 0269 de 2025
-- ----------------------------------------------------------------------------
INSERT INTO viaticos_escalas (anio, numero_decreto, salario_desde, salario_hasta, tarifa_pernocta, tarifa_sin_pernocta, descripcion)
VALUES
  (2025, 'Decreto 0269 de 2025', 0.00, 1791765.00, 159234.00, 79617.00, 'Escala 1: Hasta $1.791.765'),
  (2025, 'Decreto 0269 de 2025', 1791766.00, 2908675.00, 234238.00, 117119.00, 'Escala 2: De $1.791.766 a $2.908.675'),
  (2025, 'Decreto 0269 de 2025', 2908676.00, 3975929.00, 288679.00, 144340.00, 'Escala 3: De $2.908.676 a $3.975.929'),
  (2025, 'Decreto 0269 de 2025', 3975930.00, 5209770.00, 344858.00, 172429.00, 'Escala 4: De $3.975.930 a $5.209.770'),
  (2025, 'Decreto 0269 de 2025', 5209771.00, 6485493.00, 421205.00, 210603.00, 'Escala 5: De $5.209.771 a $6.485.493'),
  (2025, 'Decreto 0269 de 2025', 6485494.00, 9150469.00, 513518.00, 256759.00, 'Escala 6: De $6.485.494 a $9.150.469'),
  (2025, 'Decreto 0269 de 2025', 9150470.00, 12300305.00, 658933.00, 329467.00, 'Escala 7: De $9.150.470 a $12.300.305'),
  (2025, 'Decreto 0269 de 2025', 12300306.00, 16618201.00, 785453.00, 392727.00, 'Escala 8: De $12.300.306 a $16.618.201'),
  (2025, 'Decreto 0269 de 2025', 16618202.00, 999999999.00, 921629.00, 460815.00, 'Escala 9: De $16.618.202 en adelante')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Vigencia 2026: Proyección Salarial Institucional Boyacá
-- ----------------------------------------------------------------------------
INSERT INTO viaticos_escalas (anio, numero_decreto, salario_desde, salario_hasta, tarifa_pernocta, tarifa_sin_pernocta, descripcion)
VALUES
  (2026, 'Decreto Salarial 2026', 0.00, 1899271.00, 168788.00, 84394.00, 'Escala 1: Hasta $1.899.271'),
  (2026, 'Decreto Salarial 2026', 1899272.00, 3083196.00, 248292.00, 124146.00, 'Escala 2: De $1.899.272 a $3.083.196'),
  (2026, 'Decreto Salarial 2026', 3083197.00, 4214485.00, 306000.00, 153000.00, 'Escala 3: De $3.083.197 a $4.214.485'),
  (2026, 'Decreto Salarial 2026', 4214486.00, 5522356.00, 365550.00, 182775.00, 'Escala 4: De $4.214.486 a $5.522.356'),
  (2026, 'Decreto Salarial 2026', 5522357.00, 6874623.00, 446477.00, 223239.00, 'Escala 5: De $5.522.357 a $6.874.623'),
  (2026, 'Decreto Salarial 2026', 6874624.00, 9699497.00, 544329.00, 272165.00, 'Escala 6: De $6.874.624 a $9.699.497'),
  (2026, 'Decreto Salarial 2026', 9699498.00, 13038323.00, 698469.00, 349235.00, 'Escala 7: De $9.699.498 a $13.038.323'),
  (2026, 'Decreto Salarial 2026', 13038324.00, 17615293.00, 832580.00, 416290.00, 'Escala 8: De $13.038.324 a $17.615.293'),
  (2026, 'Decreto Salarial 2026', 17615294.00, 999999999.00, 976927.00, 488464.00, 'Escala 9: De $17.615.294 en adelante')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Normalización Institucional de Estados en Viáticos (AUD-005 / TSK-005)
-- Transforma estados legados a la máquina de estados canónica de 6 estados:
-- Radicado, Aprobado, En Ejecución, Legalizado, Rechazado, Anulado
-- ----------------------------------------------------------------------------
UPDATE viaticos SET estado = 'Aprobado' WHERE estado = 'Aprobada';
UPDATE viaticos SET estado = 'Legalizado' WHERE estado = 'Finalizada';
UPDATE viaticos SET estado = 'Radicado' WHERE estado = 'Pendiente' OR estado = 'En revisión';

COMMIT;

