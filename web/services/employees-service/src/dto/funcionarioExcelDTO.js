// src/dto/funcionarioExcelDTO.js
const {
  sanitizeString,
  sanitizeCedula,
  evaluarCedula,
  sanitizeEmail,
  sanitizeMoney,
  parseExcelDate,
  formatDateISO,
  calcularDiferenciaFechas
} = require('../utils/excelHelper');
const {
  calcularDiferenciaFechasExacta,
  sumarTiemposExactos,
  normalizarClasificacionEmpleo,
  parseSituacionYDiscapacidad
} = require('../utils/employeeValidator');

/**
 * Normaliza las cabeceras de la fila:
 * - Aplica trim() a los nombres de columna (limpia 'POSTGRADO ', 'TIEMPO DE SERVICIO ', 'CORREO PERSONAL ').
 * - Descarta columnas basura tipo Unnamed (ej. Unnamed: 38).
 * - Registra tanto la clave original limpia como su versión en mayúsculas para búsquedas seguras.
 */
function cleanRowHeaders(rawRow) {
  const row = {};
  for (const [key, value] of Object.entries(rawRow || {})) {
    const trimmedKey = (key || '').trim();
    if (!trimmedKey) continue;
    if (trimmedKey.toLowerCase().startsWith('unnamed')) continue; // Ignora Unnamed: 38
    row[trimmedKey] = value;
    const upperKey = trimmedKey.toUpperCase();
    if (!row[upperKey]) {
      row[upperKey] = value;
    }
  }
  return row;
}

/**
 * Mapea una fila cruda de Excel al DTO estructurado del Funcionario aplicando las 22 reglas.
 * @param {Object} rawRow
 * @param {number} rowNumber
 * @param {string} [sheetName='Principal']
 * @param {string|null} [cedulaFinal=null] Cédula pre-validada y sanitizada (o null si no tiene)
 * @param {boolean} [documentoPendiente=false]
 * @param {boolean} [esVacante=false]
 */
function mapRowToFuncionarioDTO(rawRow, rowNumber, sheetName = 'Principal', cedulaFinal = null, documentoPendiente = false, esVacante = false) {
  const row = cleanRowHeaders(rawRow);

  // 1. Identificador de Cédula y Marca de Documento Pendiente (PROV-)
  let cedula = cedulaFinal;
  let esDocumentoPendiente = Boolean(documentoPendiente || (cedula && String(cedula).startsWith('PROV-')));

  if (cedulaFinal === undefined) {
    const evaluacion = evaluarCedula(row['NUMERO DE CEDULA'] || row['NÚMERO DE CÉDULA'] || row['NUMERO CEDULA'] || row['CEDULA'] || row['CÉDULA'] || row['DOCUMENTO'], row, rowNumber, sheetName);
    if (!evaluacion.esValida) {
      throw new Error(evaluacion.motivoRechazo || `Fila sin datos de servidor ni cédula en la fila ${rowNumber}.`);
    }
    cedula = evaluacion.cedulaLimpia || null;
    esDocumentoPendiente = evaluacion.esProvisional || !cedula;
  }

  // 2. Parseo estricto de fechas
  const fechaNacimiento = parseExcelDate(row['FECHA DE NACIMIENTO'] || row['FECHA NACIMIENTO'] || row['NACIMIENTO']);
  const fechaIngreso = parseExcelDate(row['INGRESO'] || row['FECHA DE INGRESO'] || row['FECHA INGRESO']);
  const fechaEncargo = parseExcelDate(rawRow['__FECHA_ENCARGO__'] || row['FECHA DE ENCARGO'] || row['FECHA ENCARGO']);

  // 3. Cálculo dinámico de Edad y Tiempo de Servicio (Reglas 13 y 14: "X años, Y meses, Z días")
  const edadObj = fechaNacimiento ? calcularDiferenciaFechasExacta(fechaNacimiento) : null;
  const tiempoServicioObj = fechaIngreso ? calcularDiferenciaFechasExacta(fechaIngreso) : null;

  // 4. Denominación del Cargo Titular y Datos de Encargo Oficial
  // En el estándar institucional:
  // - Col F (5), G (6), H (7): Cargo Titular / Base (DENOMINACIÓN CARGO, CÓDIGO, GRADO)
  // - Col A (0), B (1), C (2), D (3): Encargo (DENOMINACIÓN ENCARGO, CÓDIGO, GRADO, ASIGNACIÓN)
  const cargoTitularText = sanitizeString(
    rawRow['__CARGO_TITULAR__'] ||
    rawRow['__CARGO_ACTUAL__'] ||
    row['DENOMINACIÓN CARGO'] || row['DENOMINACION CARGO'] || row['CARGO TITULAR'] ||
    row['DENOMINACIÓN CARGO_1'] || row['DENOMINACION CARGO_1'] || row['CARGO']
  ) || 'CARGO POR DEFINIR';

  const codigoTitular = sanitizeString(
    rawRow['__CODIGO_TITULAR__'] ||
    rawRow['__CODIGO_ACTUAL__'] ||
    row['COD._1'] || row['COD_1'] || row['CODIGO_1'] || row['CÓDIGO_1'] ||
    row['COD.'] || row['COD'] || row['CODIGO'] || row['CÓDIGO']
  ) || 'N/A';

  const gradoTitular = sanitizeString(
    rawRow['__GRADO_TITULAR__'] ||
    rawRow['__GRADO_ACTUAL__'] ||
    row['GRA._1'] || row['GRA_1'] || row['GRADO_1'] ||
    row['GRA.'] || row['GRA'] || row['GRADO']
  ) || 'N/A';

  // Datos específicos del encargo si la persona lo tiene activo
  const encargoDenominacionText = sanitizeString(
    rawRow['__ENCARGO_DENOMINACION__'] ||
    row['DENOMINACIÓN ENCARGO'] || row['DENOMINACION ENCARGO'] || row['ENCARGO']
  ) || null;

  const encargoCodigoText = sanitizeString(
    rawRow['__ENCARGO_CODIGO__'] ||
    (encargoDenominacionText ? (row['COD.'] || row['COD'] || row['CODIGO']) : null)
  ) || null;

  const encargoGradoText = sanitizeString(
    rawRow['__ENCARGO_GRADO__'] ||
    (encargoDenominacionText ? (row['GRA.'] || row['GRA'] || row['GRADO']) : null)
  ) || null;

  const rawAsignacion = rawRow['__ENCARGO_ASIGNACION__'] || row['ASIGNACION'] || row['ASIGNACIÓN'] || row['ASIGNACIO'];
  let encargoAsignacionText = null;
  if (rawAsignacion != null) {
    const s = sanitizeString(rawAsignacion);
    if (s) {
      const num = sanitizeMoney(s);
      encargoAsignacionText = num != null ? `$ ${Number(num).toLocaleString('es-CO')}` : s;
    }
  }

  // Cargo principal consolidado (el titular)
  const cargoPrincipal = cargoTitularText;

  // 5. Nombres y Apellidos (Regla 7)
  let primerApellido = sanitizeString(row['PRIMER APELLIDO']) || '';
  let segundoApellido = sanitizeString(row['SEGUNDO APELLIDO']) || '';
  let nombres = sanitizeString(row['NOMBRES']) || '';
  let nombreCompleto = [primerApellido, segundoApellido, nombres].filter(Boolean).join(' ').trim();

  if (esVacante) {
    nombreCompleto = `PLAZA VACANTE - ${cargoPrincipal}`;
    nombres = 'PLAZA VACANTE';
    primerApellido = 'VACANTE';
    segundoApellido = cargoPrincipal;
  } else if (!nombreCompleto) {
    nombreCompleto = sanitizeString(row['NOMBRE COMPLETO'] || row['FUNCIONARIO']) || `SERVIDOR SIN CÉDULA #${rowNumber}`;
  }

  // 6. Parsing de Celulares (Regla 21: busca números separados por / y los convierte a arreglo)
  const rawCelular = String(row['CELULAR'] || '').trim();
  let celularesArr = [];
  if (rawCelular && rawCelular !== 'NO REGISTRADO') {
    celularesArr = rawCelular
      .split(/[\/\,\;]/)
      .map(num => num.replace(/[^\d]/g, '').trim())
      .filter(num => num.length >= 9 && num.length <= 10)
      .slice(0, 3);
  }

  // 7. Diplomado / Capacitación SENA (Regla 19)
  const rawDiplomado = sanitizeString(row['DIPLOMADO O CAP SENA'] || row['DIPLOMADO'] || row['CAPACITACION SENA']);
  const tieneDiplomado = Boolean(rawDiplomado && !['NO', 'NINGUNO', 'N/A', 'NONE'].includes(rawDiplomado.toUpperCase()));

  // 8. Expedición de documento y DIVIPOLA (Regla 10)
  const lugarExpedida = sanitizeString(row['EXPEDIDA']);

  // Procesar Situación y Condición Especial / Discapacidad (Columna W: SITUACION)
  const situacionRaw = row['SITUACION'] || row['SITUACIÓN'] || row['SITUACION LABORAL'] || row['CONDICIÓN ESPECIAL'] || row['CONDICION ESPECIAL'];
  const discapacidadRaw = row['TIPO DE DISCAPACIDAD'] || row['DISCAPACIDAD'] || row['TIPO DISCAPACIDAD'];
  const parsedSituacion = parseSituacionYDiscapacidad(situacionRaw, discapacidadRaw);

  // Procesar Clasificación de Empleo (Columna V: CLASIFICACION DE EMPLEO)
  const clasifRaw = row['CLASIFICACION DE EMPLEO'] || row['CLASIFICACIÓN DE EMPLEO'] || row['CLASIFICACION EMPLEO'] || row['CLASIFICACIÓN EMPLEO'] || row['CLASIFICACION'] || row['CLASIFICACIÓN'] || row['TIPO DE VINCULACION'] || row['TIPO DE VINCULACIÓN'];
  const clasificacionFinal = esVacante
    ? (clasifRaw ? normalizarClasificacionEmpleo(clasifRaw) : 'Vacante Definitiva')
    : normalizarClasificacionEmpleo(clasifRaw);

  // Procesar Funciones del Cargo (Columna: FUNCIONES PAD.)
  const funcionesPagRaw = sanitizeString(
    row['FUNCIONES PAD.'] ||
    row['FUNCIONES PAD'] ||
    row['FUNCIONES PAG.'] ||
    row['FUNCIONES PAG'] ||
    row['FUNCIONES PÁG.'] ||
    row['FUNCIONES PÁG'] ||
    row['FUNCIONES PAGINA'] ||
    row['FUNCIONES PÁGINA'] ||
    row['FUNCIONES PAGADAS'] ||
    row['FUNCIONES'] ||
    row['PAGINA FUNCIONES'] ||
    row['PÁGINA FUNCIONES']
  );

  return {
    hoja: sheetName,
    rowNumber,
    funcionario: {
      cedula: esVacante ? null : (cedula || null),
      documento_pendiente: esVacante ? false : esDocumentoPendiente,
      es_vacante: Boolean(esVacante),
      sinCedula: esVacante ? false : esDocumentoPendiente,
      expedida: esVacante ? null : lugarExpedida,
      ciudadExpedicion: esVacante ? null : (lugarExpedida || 'TUNJA'),
      departamentoExpedicion: esVacante ? null : 'BOYACÁ',
      nombres: esVacante ? 'PLAZA VACANTE' : (nombres || nombreCompleto),
      primerApellido: esVacante ? 'VACANTE' : primerApellido,
      segundoApellido: esVacante ? '' : segundoApellido,
      nombreCompleto: esVacante ? `PLAZA VACANTE - ${cargoPrincipal}` : nombreCompleto,
      tipoSangre: esVacante ? null : sanitizeString(row['TIPO DE SANGRE']),
      tipoDiscapacidad: esVacante ? null : parsedSituacion.tipoDiscapacidad,
      fechaNacimientoDate: esVacante ? null : fechaNacimiento,
      fechaNacimientoStr: esVacante ? null : formatDateISO(fechaNacimiento),
      edadCalculada: esVacante ? null : (edadObj ? edadObj.texto : (sanitizeString(row['EDAD']) || null)),
      edadDetallada: esVacante ? null : (edadObj ? edadObj.texto : (sanitizeString(row['EDAD']) || null)),
      sexo: esVacante ? null : sanitizeString(row['SEXO'])
    },
    cargoTitular: {
      denominacion: cargoTitularText,
      codigo: codigoTitular,
      grado: gradoTitular
    },
    encargo: {
      denominacion: encargoDenominacionText,
      codigo: encargoCodigoText,
      grado: encargoGradoText,
      asignacion: encargoAsignacionText,
      fechaEncargoDate: fechaEncargo,
      fechaEncargoStr: formatDateISO(fechaEncargo)
    },
    cargoNominal: {
      denominacion: cargoTitularText,
      codigo: codigoTitular,
      grado: gradoTitular,
      asignacion: encargoAsignacionText
    },
    cargoActual: {
      denominacion: encargoDenominacionText || cargoTitularText,
      codigo: encargoCodigoText || codigoTitular,
      grado: encargoGradoText || gradoTitular
    },
    dependencia: sanitizeString(rawRow['__DEPENDENCIA__'] || row['DEPENDENCIA'] || row['AREA'] || row['DEPENDENCIA ACTUAL']),
    vinculacion: {
      fechaIngresoDate: esVacante ? null : fechaIngreso,
      fechaIngresoStr: esVacante ? null : formatDateISO(fechaIngreso),
      fechaEncargoDate: esVacante ? null : fechaEncargo,
      fechaEncargoStr: esVacante ? null : formatDateISO(fechaEncargo),
      tiempoServicioCalculado: esVacante ? null : (tiempoServicioObj ? tiempoServicioObj.texto : (sanitizeString(row['TIEMPO DE SERVICIO'] || row['TIEMPO DE SERVICIO ']) || null)),
      clasificacionEmpleo: clasificacionFinal,
      situacion: esVacante ? 'VACANTE' : parsedSituacion.situacion,
      estadoServidor: esVacante ? 'Activo' : 'Activo', // Regla 6: Por defecto todos en estado "Activo"
      funcionesPag: esVacante ? null : funcionesPagRaw,
      opec: esVacante ? null : sanitizeString(row['OPEC']),
      novedades: esVacante ? 'PLAZA VACANTE' : sanitizeString(row['NOVEDADES']),
      otroTiempoGober: esVacante ? null : sanitizeString(row['OTRO TIEMPO DE LA GOBERNACION'] || row['OTRO TIEMPO DE LA GOBERNACIÓN'] || row['OTRO TIEMPO CON LA GOBER']),
      tiempoTotalGobernacion: esVacante ? null : (
        sumarTiemposExactos(
          tiempoServicioObj,
          sanitizeString(row['OTRO TIEMPO DE LA GOBERNACION'] || row['OTRO TIEMPO DE LA GOBERNACIÓN'] || row['OTRO TIEMPO CON LA GOBER'])
        )?.texto || null
      )
    },
    academico: {
      estudios: esVacante ? null : sanitizeString(row['ESTUDIOS']),
      matriculaProf: esVacante ? null : sanitizeString(row['MATRICULA PROFECIONAL'] || row['MATRICULA PROFESIONAL'] || row['MATRICULA PROF.']),
      institucionPregrado: esVacante ? null : sanitizeString(row['INSTITUCION'] || row['INSTITUCIÓN']),
      postgrado: esVacante ? null : sanitizeString(row['POSTGRADO']),
      institucionPostgrado: esVacante ? null : sanitizeString(row['INSTITUCION POST'] || row['INSTITUCIÓN POST'] || row['INSTITUCION POSTGRADO'] || row['INSTITUCIÓN']),
      diplomadoCapSena: esVacante ? null : rawDiplomado,
      tieneDiplomado: esVacante ? false : tieneDiplomado
    },
    contacto: {
      direccion: esVacante ? null : sanitizeString(row['DIRECCION'] || row['DIRECCIÓN']),
      ciudad: esVacante ? null : sanitizeString(row['CIUDAD']),
      telefonoFijo: esVacante ? null : sanitizeString(row['TELEFONO FIJO'] || row['TELÉFONO FIJO']),
      celular: esVacante ? null : (celularesArr[0] || sanitizeString(row['CELULAR'])),
      celulares: esVacante ? [] : celularesArr,
      correoPersonal: esVacante ? null : sanitizeEmail(row['CORREO PERSONAL']),
      correoInstitucional: esVacante ? null : sanitizeEmail(row['CORREO INSTITUCIONAL'])
    }
  };
}

module.exports = { cleanRowHeaders, mapRowToFuncionarioDTO };
