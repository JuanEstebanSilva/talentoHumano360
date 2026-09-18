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
const { calcularDiferenciaFechasExacta, sumarTiemposExactos } = require('../utils/employeeValidator');

/**
 * Normaliza las cabeceras de la fila:
 * - Aplica trim() a los nombres de columna (limpia 'POSTGRADO ', 'TIEMPO DE SERVICIO ', 'CORREO PERSONAL ').
 * - Descarta columnas basura tipo Unnamed (ej. Unnamed: 38).
 */
function cleanRowHeaders(rawRow) {
  const row = {};
  for (const [key, value] of Object.entries(rawRow || {})) {
    const trimmedKey = (key || '').trim();
    if (!trimmedKey) continue;
    if (trimmedKey.toLowerCase().startsWith('unnamed')) continue; // Ignora Unnamed: 38
    row[trimmedKey] = value;
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
    const evaluacion = evaluarCedula(row['CEDULA'] || row['CÉDULA'] || row['DOCUMENTO'], row, rowNumber, sheetName);
    if (!evaluacion.esValida) {
      throw new Error(evaluacion.motivoRechazo || `Fila sin datos de servidor ni cédula en la fila ${rowNumber}.`);
    }
    cedula = evaluacion.cedulaLimpia || null;
    esDocumentoPendiente = evaluacion.esProvisional || !cedula;
  }

  // 2. Parseo estricto de fechas
  const fechaNacimiento = parseExcelDate(row['NACIMIENTO'] || row['FECHA NACIMIENTO']);
  const fechaIngreso = parseExcelDate(row['INGRESO'] || row['FECHA INGRESO']);
  const fechaEncargo = parseExcelDate(row['FECHA ENCARGO']);

  // 3. Cálculo dinámico de Edad y Tiempo de Servicio (Reglas 13 y 14: "X años, Y meses, Z días")
  const edadObj = fechaNacimiento ? calcularDiferenciaFechasExacta(fechaNacimiento) : null;
  const tiempoServicioObj = fechaIngreso ? calcularDiferenciaFechasExacta(fechaIngreso) : null;

  // 4. Denominación del Cargo y Consolidación de Columnas (Regla 1)
  // Se prioriza de forma estricta la columna F (Cargo Actual), G (Código Actual), H (Grado Actual)
  // pero manteniendo compatibilidad total si la fila trae denominación nominal en columnas A, B, C.
  const cargoActualText = sanitizeString(
    rawRow['__CARGO_ACTUAL__'] ||
    row['DENOMINACIÓN CARGO_1'] || row['DENOMINACION CARGO_1'] || row['CARGO_1'] ||
    row['DENOMINACIÓN CARGO.1'] || row['DENOMINACION CARGO.1'] || row['CARGO.1'] ||
    row['CARGO ACTUAL'] || row['DENOMINACIÓN CARGO ACTUAL'] || row['DENOMINACION CARGO ACTUAL'] ||
    row['DENOMINACIÓN CARGO'] || row['DENOMINACION CARGO'] || row['CARGO']
  ) || null;

  const codigoActual = sanitizeString(
    rawRow['__CODIGO_ACTUAL__'] ||
    row['COD._1'] || row['COD_1'] || row['CODIGO_1'] || row['CÓDIGO_1'] ||
    row['COD..1'] || row['COD.1'] || row['CODIGO.1'] || row['CÓDIGO.1'] ||
    row['CODIGO ACTUAL'] || row['CÓDIGO ACTUAL'] || row['COD. ACTUAL'] || row['COD ACTUAL'] ||
    row['COD.'] || row['COD'] || row['CODIGO'] || row['CÓDIGO']
  ) || null;

  const gradoActual = sanitizeString(
    rawRow['__GRADO_ACTUAL__'] ||
    row['GRA._1'] || row['GRA_1'] || row['GRADO_1'] ||
    row['GRA..1'] || row['GRA.1'] || row['GRADO.1'] ||
    row['GRADO ACTUAL'] || row['GRA. ACTUAL'] || row['GRA ACTUAL'] ||
    row['GRA.'] || row['GRA'] || row['GRADO']
  ) || null;

  const cargoNominalText = sanitizeString(
    rawRow['__CARGO_NOMINAL__'] ||
    row['DENOMINACIÓN CARGO'] || row['DENOMINACION CARGO'] || row['CARGO BASE'] || row['CARGO NOMINAL']
  ) || cargoActualText || 'CARGO POR DEFINIR';

  const codigoNominal = sanitizeString(
    rawRow['__CODIGO_NOMINAL__'] ||
    row['COD.'] || row['COD'] || row['CODIGO'] || row['CÓDIGO']
  ) || codigoActual;

  const gradoNominal = sanitizeString(
    rawRow['__GRADO_NOMINAL__'] ||
    row['GRA.'] || row['GRA'] || row['GRADO']
  ) || gradoActual;

  // Cargo principal consolidado (prioriza F, G, H)
  const cargoPrincipal = cargoActualText || cargoNominalText;

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
  const rawDiplomado = sanitizeString(row['DIPLOMADO O CAP SENA']);
  const tieneDiplomado = Boolean(rawDiplomado && !['NO', 'NINGUNO', 'N/A', 'NONE'].includes(rawDiplomado.toUpperCase()));

  // 8. Expedición de documento y DIVIPOLA (Regla 10)
  const lugarExpedida = sanitizeString(row['EXPEDIDA']);

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
      fechaNacimientoDate: esVacante ? null : fechaNacimiento,
      fechaNacimientoStr: esVacante ? null : formatDateISO(fechaNacimiento),
      edadCalculada: esVacante ? null : (edadObj ? edadObj.texto : (sanitizeString(row['EDAD']) || null)),
      edadDetallada: esVacante ? null : (edadObj ? edadObj.texto : (sanitizeString(row['EDAD']) || null)),
      sexo: esVacante ? null : sanitizeString(row['SEXO'])
    },
    cargoNominal: {
      denominacion: cargoNominalText,
      codigo: codigoNominal,
      grado: gradoNominal,
      asignacion: sanitizeMoney(row['ASIGNACION'] || row['ASIGNACIÓN'] || rawRow['__ASIGNACION__'])
    },
    cargoActual: {
      denominacion: cargoPrincipal,
      codigo: codigoActual || codigoNominal,
      grado: gradoActual || gradoNominal
    },
    dependencia: sanitizeString(row['DEPENDENCIA'] || row['AREA'] || row['DEPENDENCIA ACTUAL']),
    vinculacion: {
      fechaIngresoDate: esVacante ? null : fechaIngreso,
      fechaIngresoStr: esVacante ? null : formatDateISO(fechaIngreso),
      fechaEncargoDate: esVacante ? null : fechaEncargo,
      fechaEncargoStr: esVacante ? null : formatDateISO(fechaEncargo),
      tiempoServicioCalculado: esVacante ? null : (tiempoServicioObj ? tiempoServicioObj.texto : (sanitizeString(row['TIEMPO DE SERVICIO'] || row['TIEMPO DE SERVICIO ']) || null)),
      clasificacionEmpleo: esVacante ? 'VACANTE' : sanitizeString(row['CLASIFICACION EMPLEO'] || row['CLASIFICACIÓN EMPLEO']),
      situacion: esVacante ? 'VACANTE' : (sanitizeString(row['SITUACION'] || row['SITUACIÓN']) || 'ACTIVO'),
      estadoServidor: esVacante ? 'Activo' : 'Activo', // Regla 6: Por defecto todos en estado "Activo"
      funcionesPag: esVacante ? null : sanitizeString(row['FUNCIONES PAG.'] || row['FUNCIONES PAGADAS']),
      opec: esVacante ? null : sanitizeString(row['OPEC']),
      novedades: esVacante ? 'PLAZA VACANTE' : sanitizeString(row['NOVEDADES']),
      otroTiempoGober: esVacante ? null : sanitizeString(row['OTRO TIEMPO CON LA GOBER']),
      tiempoTotalGobernacion: esVacante ? null : (
        sumarTiemposExactos(
          tiempoServicioObj,
          sanitizeString(row['OTRO TIEMPO CON LA GOBER'])
        )?.texto || null
      )
    },
    academico: {
      estudios: esVacante ? null : sanitizeString(row['ESTUDIOS']),
      matriculaProf: esVacante ? null : sanitizeString(row['MATRICULA PROF.'] || row['MATRICULA PROFESIONAL']),
      institucionPregrado: esVacante ? null : sanitizeString(row['INSTITUCION']),
      postgrado: esVacante ? null : sanitizeString(row['POSTGRADO']),
      institucionPostgrado: esVacante ? null : sanitizeString(row['INSTITUCIÓN']),
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
