-- Verificación de Vínculo Foráneo Horario <-> Persona
SELECT h.id_horario, h.documento, p.nombres, p.primer_apellido, h.modalidad, h.dias_teletrabajo, h.estado
FROM horarios h
JOIN personas p ON h.documento = p.cedula
WHERE h.documento = '999000501';