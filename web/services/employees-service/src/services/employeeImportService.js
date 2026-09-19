// src/services/employeeImportService.js

class EmployeeImportService {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Obtiene el número máximo actual de una tabla con prefijo alfanumérico (ej: PER0012 -> 12).
   */
  async getMaxId(client, table, col) {
    const res = await client.query(`SELECT ${col} FROM ${table}`);
    let max = 0;
    for (const row of res.rows) {
      const val = row[col.toLowerCase()] || '';
      const digits = val.replace(/\D/g, '');
      if (digits) {
        const num = parseInt(digits, 10);
        if (num > max) max = num;
      }
    }
    return max;
  }

  /**
   * Busca o crea una dependencia evitando duplicados.
   */
  async findOrCreateDependencia(client, depCache, idGenerators, nombre) {
    const cleanName = (nombre || 'DIRECCIÓN DE TALENTO HUMANO').trim().toUpperCase();
    if (depCache.has(cleanName)) return depCache.get(cleanName);

    const existing = await client.query(
      'SELECT id_dependencia FROM dependencias WHERE LOWER(dependencia) = LOWER($1) LIMIT 1',
      [cleanName]
    );

    if (existing.rows.length > 0) {
      const id = existing.rows[0].id_dependencia;
      depCache.set(cleanName, id);
      return id;
    }

    idGenerators.dep++;
    const newId = 'DEP' + String(idGenerators.dep).padStart(3, '0');
    await client.query(
      'INSERT INTO dependencias (id_dependencia, dependencia, responsable, cargo_directivo, correo_responsable, extension_telefonica, funciones) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [newId, cleanName, 'POR ASIGNAR', 'DIRECTOR', 'contacto@boyaca.gov.co', '100', 'Gestión institucional']
    );

    depCache.set(cleanName, newId);
    return newId;
  }

  /**
   * Busca o crea un cargo evitando duplicados.
   */
  async findOrCreateCargo(client, cargoCache, idGenerators, cargoData, defaultNombre = 'PROFESIONAL') {
    const denominacion = (cargoData?.denominacion || defaultNombre).trim().toUpperCase();
    const codigo = cargoData?.codigo || 'N/A';
    const grado = cargoData?.grado || 'N/A';
    const asignacion = cargoData?.asignacion != null ? `$${Number(cargoData.asignacion).toLocaleString('es-CO')}` : '$0';
    const cacheKey = `${denominacion}|${codigo}|${grado}`;

    if (cargoCache.has(cacheKey)) return cargoCache.get(cacheKey);

    const existing = await client.query(
      'SELECT id_cargo FROM cargos WHERE LOWER(cargo) = LOWER($1) AND (codigo = $2 OR codigo = \'N/A\') LIMIT 1',
      [denominacion, codigo]
    );

    if (existing.rows.length > 0) {
      const id = existing.rows[0].id_cargo;
      cargoCache.set(cacheKey, id);
      return id;
    }

    idGenerators.cargo++;
    const newId = 'CAR' + String(idGenerators.cargo).padStart(3, '0');
    await client.query(
      'INSERT INTO cargos (id_cargo, tipo_cargo, cargo, codigo, grado, asignacion_sueldo, nivel) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [newId, 'PLANTA', denominacion, codigo, grado, asignacion, 'PROFESIONAL']
    );

    cargoCache.set(cacheKey, newId);
    return newId;
  }

  /**
   * Procesa un lote de funcionarios DTOs con transacciones y SAVEPOINTS.
   * Realiza UPSERT aplicando las 22 reglas de negocio.
   * @param {Array} dtos
   */
  async upsertBatch(dtos) {
    const client = await this.pool.connect();
    const resumen = {
      totalFilas: dtos.length,
      procesadosExitosos: 0,
      insertados: 0,
      actualizados: 0,
      fallidos: 0
    };
    const errores = [];

    try {
      await client.query('BEGIN');

      // 1. Inicializar contadores de IDs secuenciales
      const idGenerators = {
        per: await this.getMaxId(client, 'personas', 'id_persona'),
        con: await this.getMaxId(client, 'contactos', 'id_contacto'),
        edu: await this.getMaxId(client, 'educacion', 'id_educacion'),
        est: await this.getMaxId(client, 'estados', 'id_estado'),
        rel: await this.getMaxId(client, 'rel_principal', 'id_registro'),
        dep: await this.getMaxId(client, 'dependencias', 'id_dependencia'),
        cargo: await this.getMaxId(client, 'cargos', 'id_cargo')
      };

      // Caches en memoria
      const depCache = new Map();
      const cargoCache = new Map();
      const usedPersonaIds = new Set();

      // Regla 10: Pre-cargar mapa de DIVIPOLA (municipio -> departamento) para mapeo automático
      const divipolaRes = await client.query('SELECT departamento, municipio FROM divipola');
      const divipolaMap = new Map();
      for (const r of divipolaRes.rows) {
        divipolaMap.set(r.municipio.trim().toLowerCase(), r.departamento.trim().toUpperCase());
      }

      // 2. Procesar cada fila de forma aislada
      for (const item of dtos) {
        const { rowNumber, funcionario, cargoNominal, cargoActual, dependencia, vinculacion, academico, contacto } = item;
        const savepointName = `sp_row_${rowNumber}`;

        try {
          await client.query(`SAVEPOINT ${savepointName}`);

          // Resolver dependencias y cargos
          const depId = await this.findOrCreateDependencia(client, depCache, idGenerators, dependencia);
          const cargoNominalDef = (cargoNominal?.denominacion && cargoNominal.denominacion !== 'CARGO POR DEFINIR')
            ? cargoNominal
            : (cargoActual?.denominacion ? cargoActual : cargoNominal);
          const cargoBaseId = await this.findOrCreateCargo(client, cargoCache, idGenerators, cargoNominalDef, 'PROFESIONAL UNIVERSITARIO');
          const cargoActualId = cargoActual?.denominacion
            ? await this.findOrCreateCargo(client, cargoCache, idGenerators, cargoActual, cargoNominalDef?.denominacion || 'PROFESIONAL UNIVERSITARIO')
            : cargoBaseId;

          // Regla 10: Auto-asignar Departamento usando tabla DIVIPOLA
          let ciudadExp = (funcionario.expedida || 'TUNJA').trim().toUpperCase();
          let deptoExp = 'BOYACÁ';
          if (divipolaMap.has(ciudadExp.toLowerCase())) {
            deptoExp = divipolaMap.get(ciudadExp.toLowerCase());
          }

          // Verificar si el funcionario o plaza ya existe:
          let existing = { rows: [] };

          if (funcionario.cedula) {
            existing = await client.query(
              `SELECT r.id_registro, r.id_persona, r.id_contacto, r.id_educacion, r.id_estado, p.cedula, p.documento_pendiente
               FROM personas p
               LEFT JOIN rel_principal r ON r.id_persona = p.id_persona
               WHERE p.cedula = $1
               LIMIT 1`,
              [funcionario.cedula]
            );
          } else if (funcionario.es_vacante) {
            const excludeClause = usedPersonaIds.size > 0
              ? `AND p.id_persona NOT IN (${Array.from(usedPersonaIds).map((_, i) => `$${i + 4}`).join(',')})`
              : '';
            const queryParams = [depId, cargoActualId, cargoBaseId];
            if (usedPersonaIds.size > 0) {
              queryParams.push(...Array.from(usedPersonaIds));
            }
            existing = await client.query(
              `SELECT r.id_registro, r.id_persona, r.id_contacto, r.id_educacion, r.id_estado, p.cedula, p.documento_pendiente
               FROM personas p
               JOIN rel_principal r ON r.id_persona = p.id_persona
               WHERE p.es_vacante = true
                 AND r.id_dependencia = $1
                 AND (r.id_cargo_actual = $2 OR r.id_cargo_base = $3)
                 ${excludeClause}
               ORDER BY r.id_registro
               LIMIT 1`,
              queryParams
            );
          } else if (funcionario.nombreCompleto) {
            existing = await client.query(
              `SELECT r.id_registro, r.id_persona, r.id_contacto, r.id_educacion, r.id_estado, p.cedula, p.documento_pendiente
               FROM personas p
               LEFT JOIN rel_principal r ON r.id_persona = p.id_persona
               WHERE LOWER(TRIM(p.nombre_completo)) = LOWER(TRIM($1))
               LIMIT 1`,
              [funcionario.nombreCompleto]
            );
          }

          if (existing.rows.length > 0) {
            // ───────────────────────────────────────────────
            // CASO A: EL FUNCIONARIO EXISTE -> ACTUALIZAR
            // ───────────────────────────────────────────────
            const prev = existing.rows[0];
            const personaId = prev.id_persona;
            const contactoId = prev.id_contacto;
            const educacionId = prev.id_educacion;
            const estadoId = prev.id_estado;
            const registroId = prev.id_registro;
            usedPersonaIds.add(personaId);

            // 1. Actualizar personas
            if (funcionario.es_vacante) {
              await client.query(
                `UPDATE personas
                 SET primer_apellido = $1,
                     segundo_apellido = $2,
                     nombres = $3,
                     nombre_completo = $4,
                     cedula = NULL,
                     expedida = NULL,
                     departamento_expedicion = NULL,
                     ciudad_expedicion = NULL,
                     tipo_sangre = NULL,
                     fecha_nacimiento = NULL,
                     edad = NULL,
                     sexo = NULL,
                     documento_pendiente = false,
                     es_vacante = true,
                     tipo_discapacidad = NULL
                 WHERE id_persona = $5`,
                [
                  funcionario.primerApellido,
                  funcionario.segundoApellido,
                  funcionario.nombres,
                  funcionario.nombreCompleto,
                  personaId
                ]
              );
            } else {
              await client.query(
                `UPDATE personas
                 SET primer_apellido = COALESCE($1, primer_apellido),
                     segundo_apellido = COALESCE($2, segundo_apellido),
                     nombres = COALESCE($3, nombres),
                     nombre_completo = COALESCE($4, nombre_completo),
                     cedula = COALESCE($5, cedula),
                     expedida = COALESCE($6, expedida),
                     tipo_sangre = COALESCE($7, tipo_sangre),
                     fecha_nacimiento = COALESCE($8, fecha_nacimiento),
                     edad = COALESCE($9, edad),
                     sexo = COALESCE($10, sexo),
                     documento_pendiente = $11,
                     es_vacante = $12,
                     departamento_expedicion = COALESCE($13, departamento_expedicion),
                     ciudad_expedicion = COALESCE($14, ciudad_expedicion),
                     tipo_discapacidad = COALESCE($15, tipo_discapacidad)
                 WHERE id_persona = $16`,
                [
                  funcionario.primerApellido,
                  funcionario.segundoApellido,
                  funcionario.nombres,
                  funcionario.nombreCompleto,
                  funcionario.cedula || null,
                  funcionario.expedida,
                  funcionario.tipoSangre,
                  funcionario.fechaNacimientoStr,
                  funcionario.edadCalculada,
                  funcionario.sexo,
                  Boolean(funcionario.documento_pendiente),
                  Boolean(funcionario.es_vacante),
                  deptoExp,
                  ciudadExp,
                  funcionario.tipoDiscapacidad || null,
                  personaId
                ]
              );
            }

            // 2. Actualizar contactos
            if (contactoId) {
              if (funcionario.es_vacante) {
                await client.query(
                  `UPDATE contactos
                   SET direccion = NULL, ciudad = NULL, telefono_fijo = NULL,
                       celular = NULL, celulares = NULL, correo_personal = NULL, correo_institucional = NULL
                   WHERE id_contacto = $1`,
                  [contactoId]
                );
              } else {
                await client.query(
                  `UPDATE contactos
                   SET direccion = COALESCE($1, direccion),
                       ciudad = COALESCE($2, ciudad),
                       telefono_fijo = COALESCE($3, telefono_fijo),
                       celular = COALESCE($4, celular),
                       celulares = COALESCE($5, celulares),
                       correo_personal = COALESCE($6, correo_personal),
                       correo_institucional = COALESCE($7, correo_institucional)
                   WHERE id_contacto = $8`,
                  [
                    contacto.direccion,
                    contacto.ciudad,
                    contacto.telefonoFijo,
                    contacto.celular,
                    contacto.celulares,
                    contacto.correoPersonal,
                    contacto.correoInstitucional,
                    contactoId
                  ]
                );
              }
            }

            // 3. Actualizar educacion
            if (educacionId) {
              if (funcionario.es_vacante) {
                await client.query(
                  `UPDATE educacion
                   SET estudios = NULL, matricula_profesional = NULL, institucion_estudios = NULL,
                       postgrado = NULL, institucion_postgrado = NULL, diplomado_cap_sena = NULL,
                       tiene_diplomado = false, correo_institucional = NULL
                   WHERE id_educacion = $1`,
                  [educacionId]
                );
              } else {
                await client.query(
                  `UPDATE educacion
                   SET estudios = COALESCE($1, estudios),
                       matricula_profesional = COALESCE($2, matricula_profesional),
                       institucion_estudios = COALESCE($3, institucion_estudios),
                       postgrado = COALESCE($4, postgrado),
                       institucion_postgrado = COALESCE($5, institucion_postgrado),
                       diplomado_cap_sena = COALESCE($6, diplomado_cap_sena),
                       tiene_diplomado = $7,
                       correo_institucional = COALESCE($8, correo_institucional)
                   WHERE id_educacion = $9`,
                  [
                    academico.estudios,
                    academico.matriculaProf,
                    academico.institucionPregrado,
                    academico.postgrado,
                    academico.institucionPostgrado,
                    academico.diplomadoCapSena,
                    Boolean(academico.tieneDiplomado),
                    contacto.correoInstitucional,
                    educacionId
                  ]
                );
              }
            }

            // 4. Actualizar estados (Regla 6: estado_servidor = 'Activo')
            if (estadoId) {
              if (funcionario.es_vacante) {
                await client.query(
                  `UPDATE estados
                   SET clasificacion_empleo = COALESCE($1, 'Vacante Definitiva'),
                       situacion = 'VACANTE',
                       estado_servidor = 'Activo',
                       funciones = $2,
                       funciones_pagadas = $2,
                       novedades = 'PLAZA VACANTE',
                       opec = NULL
                   WHERE id_estado = $3`,
                  [
                    vinculacion.clasificacionEmpleo || 'Vacante Definitiva',
                    vinculacion.funcionesPag || null,
                    estadoId
                  ]
                );
              } else {
                await client.query(
                  `UPDATE estados
                   SET clasificacion_empleo = COALESCE($1, clasificacion_empleo),
                       situacion = $2,
                       estado_servidor = 'Activo',
                       funciones = $3,
                       funciones_pagadas = $3,
                       novedades = COALESCE($4, novedades),
                       opec = COALESCE($5, opec)
                   WHERE id_estado = $6`,
                  [
                    vinculacion.clasificacionEmpleo || 'Sin clasificar',
                    vinculacion.situacion || 'ACTIVO',
                    vinculacion.funcionesPag || null,
                    vinculacion.novedades,
                    vinculacion.opec,
                    estadoId
                  ]
                );
              }
            }

            // 5. Actualizar rel_principal
            if (registroId) {
              if (funcionario.es_vacante) {
                await client.query(
                  `UPDATE rel_principal
                   SET id_cargo_base = COALESCE($1, id_cargo_base),
                       id_cargo_actual = COALESCE($2, id_cargo_actual),
                       id_dependencia = COALESCE($3, id_dependencia),
                       otro_tiempo_gobernacion = NULL,
                       fecha_ingreso = NULL,
                       tiempo_servicio = NULL,
                       fecha_encargo = NULL,
                       tiempo_total_gobernacion = NULL
                   WHERE id_registro = $4`,
                  [
                    cargoBaseId,
                    cargoActualId,
                    depId,
                    registroId
                  ]
                );
              } else {
                await client.query(
                  `UPDATE rel_principal
                   SET id_cargo_base = COALESCE($1, id_cargo_base),
                       id_cargo_actual = COALESCE($2, id_cargo_actual),
                       id_dependencia = COALESCE($3, id_dependencia),
                       otro_tiempo_gobernacion = $4,
                       fecha_ingreso = $5,
                       tiempo_servicio = $6,
                       fecha_encargo = $7,
                       tiempo_total_gobernacion = $8
                   WHERE id_registro = $9`,
                  [
                    cargoBaseId,
                    cargoActualId,
                    depId,
                    vinculacion.otroTiempoGober,
                    vinculacion.fechaIngresoStr,
                    vinculacion.tiempoServicioCalculado,
                    vinculacion.fechaEncargoStr,
                    vinculacion.tiempoTotalGobernacion,
                    registroId
                  ]
                );
              }
            }

            await client.query(`RELEASE SAVEPOINT ${savepointName}`);
            resumen.actualizados++;
            resumen.procesadosExitosos++;

          } else {
            // ───────────────────────────────────────────────
            // CASO B: EL FUNCIONARIO NO EXISTE -> INSERTAR
            // ───────────────────────────────────────────────
            idGenerators.per++;
            idGenerators.con++;
            idGenerators.edu++;
            idGenerators.est++;
            idGenerators.rel++;

            const newPersonId = 'PER' + String(idGenerators.per).padStart(4, '0');
            const newContactId = 'CON' + String(idGenerators.con).padStart(4, '0');
            const newEduId = 'EDU' + String(idGenerators.edu).padStart(4, '0');
            const newEstadoId = 'EST' + String(idGenerators.est).padStart(4, '0');
            const newRecordId = 'REL' + String(idGenerators.rel).padStart(4, '0');
            usedPersonaIds.add(newPersonId);

            // 1. Insertar en personas
            await client.query(
              `INSERT INTO personas (
                 id_persona, cedula, primer_apellido, segundo_apellido, nombres,
                 nombre_completo, expedida, departamento_expedicion, ciudad_expedicion,
                 tipo_sangre, tipo_discapacidad, fecha_nacimiento, edad, sexo, documento_pendiente, es_vacante
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
              [
                newPersonId,
                funcionario.es_vacante ? null : (funcionario.cedula || null),
                funcionario.primerApellido || (funcionario.es_vacante ? 'VACANTE' : 'NO REGISTRADO'),
                funcionario.segundoApellido || '',
                funcionario.nombres || (funcionario.es_vacante ? 'PLAZA VACANTE' : 'NO REGISTRADO'),
                funcionario.nombreCompleto,
                funcionario.es_vacante ? null : (funcionario.expedida || 'TUNJA'),
                funcionario.es_vacante ? null : deptoExp,
                funcionario.es_vacante ? null : ciudadExp,
                funcionario.es_vacante ? null : (funcionario.tipoSangre || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (funcionario.tipoDiscapacidad || null),
                funcionario.es_vacante ? null : (funcionario.fechaNacimientoStr || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (funcionario.edadCalculada || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (funcionario.sexo || 'NO REGISTRADO'),
                funcionario.es_vacante ? false : Boolean(funcionario.documento_pendiente),
                Boolean(funcionario.es_vacante)
              ]
            );

            // 2. Insertar en contactos (Regla 21: array de celulares)
            await client.query(
              `INSERT INTO contactos (
                 id_contacto, direccion, ciudad, telefono_fijo, celular, celulares,
                 correo_personal, correo_institucional
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                newContactId,
                funcionario.es_vacante ? null : (contacto.direccion || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (contacto.ciudad || 'TUNJA, BOYACA'),
                funcionario.es_vacante ? null : (contacto.telefonoFijo || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (contacto.celular || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : contacto.celulares,
                funcionario.es_vacante ? null : (contacto.correoPersonal || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (contacto.correoInstitucional || 'NO REGISTRADO')
              ]
            );

            // 3. Insertar en educacion (Regla 19: tiene_diplomado)
            await client.query(
              `INSERT INTO educacion (
                 id_educacion, estudios, matricula_profesional, institucion_estudios,
                 postgrado, institucion_postgrado, diplomado_cap_sena, tiene_diplomado, correo_institucional
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                newEduId,
                funcionario.es_vacante ? null : (academico.estudios || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (academico.matriculaProf || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (academico.institucionPregrado || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (academico.postgrado || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (academico.institucionPostgrado || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (academico.diplomadoCapSena || 'NO REGISTRADO'),
                Boolean(academico.tieneDiplomado),
                funcionario.es_vacante ? null : (contacto.correoInstitucional || 'NO REGISTRADO')
              ]
            );

            // 4. Insertar en estados (Regla 6: estado_servidor = 'Activo' por defecto)
            await client.query(
              `INSERT INTO estados (
                 id_estado, clasificacion_empleo, situacion, funciones_pagadas, novedades, opec, estado_servidor, funciones
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                newEstadoId,
                funcionario.es_vacante ? (vinculacion.clasificacionEmpleo || 'Vacante Definitiva') : (vinculacion.clasificacionEmpleo || 'Sin clasificar'),
                funcionario.es_vacante ? 'VACANTE' : (vinculacion.situacion || 'ACTIVO'),
                funcionario.es_vacante ? null : (vinculacion.funcionesPag || null),
                funcionario.es_vacante ? 'PLAZA VACANTE' : (vinculacion.novedades || ''),
                funcionario.es_vacante ? null : (vinculacion.opec || 'NO REGISTRADO'),
                funcionario.es_vacante ? 'Activo' : 'Activo',
                funcionario.es_vacante ? null : (vinculacion.funcionesPag || null)
              ]
            );

            // 5. Insertar en rel_principal
            await client.query(
              `INSERT INTO rel_principal (
                 id_registro, id_persona, id_cargo_base, id_cargo_actual, id_dependencia,
                 id_educacion, id_contacto, id_estado, otro_tiempo_gobernacion,
                 tiempo_total_gobernacion, fecha_ingreso, tiempo_servicio, fecha_encargo
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                newRecordId,
                newPersonId,
                cargoBaseId,
                cargoActualId,
                depId,
                newEduId,
                newContactId,
                newEstadoId,
                funcionario.es_vacante ? null : (vinculacion.otroTiempoGober || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : vinculacion.tiempoTotalGobernacion,
                funcionario.es_vacante ? null : (vinculacion.fechaIngresoStr || 'NO REGISTRADO'),
                funcionario.es_vacante ? null : (vinculacion.tiempoServicioCalculado || '0 AÑOS'),
                funcionario.es_vacante ? null : (vinculacion.fechaEncargoStr || 'NO REGISTRADO')
              ]
            );

            await client.query(`RELEASE SAVEPOINT ${savepointName}`);
            resumen.insertados++;
            resumen.procesadosExitosos++;
          }

        } catch (rowError) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          resumen.fallidos++;
          errores.push({
            hoja: item.hoja || 'Principal',
            fila: rowNumber,
            cedula: funcionario.cedula,
            nombre: funcionario.nombreCompleto,
            error: rowError.message
          });
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return { resumen, errores };
  }
}

module.exports = EmployeeImportService;
