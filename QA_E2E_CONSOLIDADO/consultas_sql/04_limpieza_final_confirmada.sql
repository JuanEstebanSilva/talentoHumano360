-- Verificación Final de Limpieza de Registros Sintéticos
SELECT 
  (SELECT COUNT(*) FROM personas WHERE cedula LIKE '999%') AS personas_qa,
  (SELECT COUNT(*) FROM horarios WHERE documento LIKE '999%') AS horarios_qa,
  (SELECT COUNT(*) FROM viaticos WHERE documento LIKE '999%') AS viaticos_qa,
  (SELECT COUNT(*) FROM vigencias_viaticos WHERE anio = 2029) AS vigencias_qa;