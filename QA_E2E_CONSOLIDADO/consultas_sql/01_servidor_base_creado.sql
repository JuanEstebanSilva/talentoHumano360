-- Verificación de Servidor Base para Validación Cruzada
SELECT p.cedula, p.nombres, p.nombre_completo, r.id_estado, r.fecha_ingreso
FROM personas p
JOIN rel_principal r ON p.id_persona = r.id_persona
WHERE p.cedula = '999000501';