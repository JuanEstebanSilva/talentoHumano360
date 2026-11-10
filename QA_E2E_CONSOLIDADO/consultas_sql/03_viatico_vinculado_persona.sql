-- Verificación de Vínculo Foráneo Viático <-> Persona
SELECT v.id_viatico, v.documento, p.nombres, p.apellidos, v.destino, v.dias, v.valor_diario, v.valor_total, v.estado
FROM viaticos v
JOIN personas p ON v.documento = p.cedula
WHERE v.documento = '999000501';