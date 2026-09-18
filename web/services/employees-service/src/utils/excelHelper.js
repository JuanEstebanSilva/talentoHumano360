// src/utils/excelHelper.js
const XLSX = require('xlsx');
const crypto = require('crypto');

/**
 * Limpia y normaliza cadenas de texto:
 * - Elimina caracteres no imprimibles y espacios duros (\xa0, \u00A0).
 * - Convierte 'NaN', 'null', 'undefined', 'N/A' o cadenas vacías a null.
 * - Aplica trim() cuidadoso.
 */
function sanitizeString(val) {
  if (val === null || val === undefined) return null;
  const str = String(val)
    .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\xa0]/g, ' ')
    .trim();

  if (!str) return null;
  const lower = str.toLowerCase();
  if (['nan', 'null', 'undefined', 'n/a', 'none', '-', '.'].includes(lower)) return null;
  return str;
}

/**
 * Evalúa y normaliza el valor de la Cédula:
 * - Si es una cédula numérica válida, la limpia y la acepta (cedulaLimpia: digitos).
 * - Si viene vacía, null, undefined, "NAN", "DESCONOCIDA", "SIN CEDULA", etc.,
 *   pero la fila contiene información de un funcionario real (nombre, cargo, etc.),
 *   se acepta como funcionario válido con cedulaLimpia: NULL (NUNCA se inventa una cédula falsa).
 * - Solo si la fila no tiene datos de identidad ni cédula, se descarta.
 *
 * @param {*} val
 * @param {Object} [rawRow=null]
 * @param {number} [rowNumber=0]
 * @param {string} [sheetName='Principal']
/**
 * Valida la columna CEDULA según las especificaciones de negocio:
 * - Aplica .trim().toUpperCase().
 * - Considera como inválidos los valores null, undefined, "", "NAN", y "DESCONOCIDA".
 *
 * @param {*} val
 * @returns {{ esInvalida: boolean, cedulaLimpia: string|null, esProvisional: boolean, valorOriginal: string }}
 */
function validarCedulaExcel(val) {
  if (val === null || val === undefined) {
    return { esInvalida: true, cedulaLimpia: null, esProvisional: false, valorOriginal: '' };
  }
  const str = String(val)
    .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\xa0]/g, ' ')
    .trim()
    .toUpperCase();

  const invalidos = [
    '', 'NAN', 'DESCONOCIDA', 'NULL', 'UNDEFINED', 'N/A', 'NONE', '0', '-', '.',
    'NO REPORTADA', 'NO REPORTADO', 'SIN CEDULA', 'POR ASIGNAR', 'DESCONOCIDO',
    'SIN CÉDULA', 'NO TIENE', 'PENDIENTE', 'SIN DOCUMENTO'
  ];

  if (invalidos.includes(str)) {
    return { esInvalida: true, cedulaLimpia: null, esProvisional: false, valorOriginal: str };
  }

  // Si ya tiene formato provisional existente (ej: PROV-00024)
  if (/^PROV-\d+$/i.test(str)) {
    return { esInvalida: false, cedulaLimpia: str, esProvisional: true, valorOriginal: str };
  }

  // Cédula numérica estándar
  const soloDigitos = str.replace(/[^\d]/g, '');
  if (soloDigitos.length >= 4) {
    return { esInvalida: false, cedulaLimpia: soloDigitos, esProvisional: false, valorOriginal: str };
  }

  // Documento especial o alfanumérico extranjero
  if (str.length >= 3) {
    return { esInvalida: false, cedulaLimpia: str, esProvisional: false, valorOriginal: str };
  }

  return { esInvalida: true, cedulaLimpia: null, esProvisional: false, valorOriginal: str };
}

/**
 * Genera el identificador provisional secuencial con formato PROV-00001
 * @param {number} num
 * @returns {string}
 */
function formatCedulaProvisional(num) {
  return `PROV-${String(num).padStart(5, '0')}`;
}

/**
 * Evalúa y normaliza el valor de la Cédula:
 * - Valida la columna CEDULA.
 * - Si es válida, retorna cedulaLimpia.
 * - Si es inválida pero la fila tiene datos de persona, la marca como sinCedula para asignación de PROV-.
 *
 * @param {*} val
 * @param {Object} [rawRow=null]
 * @param {number} [rowNumber=0]
 * @param {string} [sheetName='Principal']
 * @returns {{ esValida: boolean, cedulaLimpia: string|null, sinCedula: boolean, esProvisional: boolean, valorOriginal: string, motivoRechazo?: string }}
 */
/**
 * Extrae la denominación del cargo desde una fila de Excel:
 * Prioriza la Columna F (Cargo Actual / Desempeño) y luego la Columna A (Cargo Nominal / Base).
 * Tolera nombres repetidos, sufijos de SheetJS (_1) y renombrados (CARGO ACTUAL).
 *
 * @param {Object} rawRow
 * @returns {string}
 */
function extraerCargoExcel(rawRow) {
  if (!rawRow || typeof rawRow !== 'object') return '';
  return String(
    rawRow['__CARGO_ACTUAL__'] ||
    rawRow['DENOMINACIÓN CARGO_1'] || rawRow['DENOMINACION CARGO_1'] || rawRow['CARGO_1'] ||
    rawRow['DENOMINACIÓN CARGO.1'] || rawRow['DENOMINACION CARGO.1'] || rawRow['CARGO.1'] ||
    rawRow['CARGO ACTUAL'] || rawRow['DENOMINACIÓN CARGO ACTUAL'] || rawRow['DENOMINACION CARGO ACTUAL'] ||
    rawRow['__CARGO_NOMINAL__'] ||
    rawRow['DENOMINACIÓN CARGO'] || rawRow['DENOMINACION CARGO'] || rawRow['CARGO'] ||
    ''
  ).trim();
}

/**
 * Evalúa y normaliza el valor de la Cédula:
 * - Valida la columna CEDULA.
 * - Si es válida, retorna cedulaLimpia.
 * - Si es inválida pero la fila tiene datos de persona, la marca como sinCedula para asignación de PROV-.
 *
 * @param {*} val
 * @param {Object} [rawRow=null]
 * @param {number} [rowNumber=0]
 * @param {string} [sheetName='Principal']
 * @returns {{ esValida: boolean, cedulaLimpia: string|null, sinCedula: boolean, esProvisional: boolean, valorOriginal: string, motivoRechazo?: string }}
 */
function evaluarCedula(val, rawRow = null, rowNumber = 0, sheetName = 'Principal') {
  const resValidacion = validarCedulaExcel(val);

  if (!resValidacion.esInvalida) {
    return {
      esValida: true,
      sinCedula: resValidacion.esProvisional,
      esProvisional: resValidacion.esProvisional,
      cedulaLimpia: resValidacion.cedulaLimpia,
      valorOriginal: resValidacion.valorOriginal
    };
  }

  // Si la cédula es inválida, verificar si la fila contiene datos reales de identidad de un funcionario
  if (rawRow && typeof rawRow === 'object') {
    const nombres = String(rawRow['NOMBRES'] || '').trim();
    const apellido1 = String(rawRow['PRIMER APELLIDO'] || '').trim();
    const apellido2 = String(rawRow['SEGUNDO APELLIDO'] || '').trim();
    const nombreCompleto = String(rawRow['NOMBRE COMPLETO'] || rawRow['FUNCIONARIO'] || '').trim();
    const cargo = extraerCargoExcel(rawRow);
    const dependencia = String(rawRow['DEPENDENCIA'] || rawRow['AREA'] || '').trim();

    const tieneIdentidad = Boolean(nombres || apellido1 || apellido2 || nombreCompleto || cargo || dependencia);

    if (tieneIdentidad) {
      return {
        esValida: true,
        sinCedula: true,
        esProvisional: true,
        cedulaLimpia: null, // Será asignada secuencialmente como PROV-XXXXX
        valorOriginal: resValidacion.valorOriginal || 'SIN_CEDULA'
      };
    }
  }

  return {
    esValida: false,
    sinCedula: false,
    esProvisional: false,
    cedulaLimpia: null,
    valorOriginal: resValidacion.valorOriginal || 'VACÍA',
    motivoRechazo: 'Fila sin cédula válida ni datos de identidad de servidor público.'
  };
}

/**
 * Detecta si una fila del Excel corresponde a una plaza vacante abierta:
 * Regla de negocio estricta:
 * La ÚNICA manera de determinar que una fila es una vacante abierta es si en la columna
 * "PRIMER APELLIDO" (o sus variaciones de cabecera) dice o contiene la palabra "VACANTE".
 *
 * Si la palabra "VACANTE" aparece en cualquier otra columna (por ejemplo en "NOVEDADES",
 * "SITUACION", etc.), NO se considera vacante abierta, ya que corresponde a un funcionario real
 * que ocupó o cubre dicha vacante. Dicho funcionario debe crearse/registrarse común y corriente.
 *
 * @param {Object} rawRow
 * @returns {boolean}
 */
function detectarVacante(rawRow) {
  if (!rawRow || typeof rawRow !== 'object') return false;

  // Buscar específicamente el valor de la columna 'PRIMER APELLIDO'
  let valPrimerApellido = '';
  for (const [k, v] of Object.entries(rawRow)) {
    const cleanKey = (k || '').trim().toUpperCase();
    if (
      cleanKey === 'PRIMER APELLIDO' ||
      cleanKey === 'PRIMER_APELLIDO' ||
      cleanKey === 'APELLIDO 1' ||
      cleanKey === '1ER APELLIDO'
    ) {
      valPrimerApellido = String(v || '').trim().toUpperCase();
      break;
    }
  }

  if (!valPrimerApellido && rawRow['PRIMER APELLIDO']) {
    valPrimerApellido = String(rawRow['PRIMER APELLIDO']).trim().toUpperCase();
  }

  // La ÚNICA condición: en la columna 'PRIMER APELLIDO' dice / contiene 'VACANTE'
  return valPrimerApellido.includes('VACANTE');
}

/**
 * Detecta si una fila de Excel es una "fila fantasma" (espacios en blanco al final de la hoja, celdas combinadas vacías).
 * Retorna true si no tiene ningún dato útil.
 */
function esFilaFantasma(rawRow) {
  if (!rawRow || typeof rawRow !== 'object') return true;

  const entries = Object.entries(rawRow);
  if (entries.length === 0) return true;

  // Filtrar columnas reales (descartar Unnamed)
  const columnasReales = entries.filter(([k]) => !k.trim().toLowerCase().startsWith('unnamed'));
  if (columnasReales.length === 0) return true;

  for (const [, val] of columnasReales) {
    if (val === null || val === undefined) continue;
    const str = String(val)
      .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\xa0]/g, ' ')
      .trim();
    if (str !== '' && !['nan', 'null', 'undefined', 'n/a', 'none', '-'].includes(str.toLowerCase())) {
      return false; // Se encontró al menos un dato relevante
    }
  }

  return true; // Toda la fila está vacía o solo contiene espacios/NaN
}

/**
 * Limpia y normaliza números de documento/cédula.
 */
function sanitizeCedula(val) {
  const evalResult = evaluarCedula(val);
  return evalResult.esValida ? evalResult.cedulaLimpia : null;
}

/**
 * Normaliza correos electrónicos a minúsculas y sin espacios.
 */
function sanitizeEmail(val) {
  const clean = sanitizeString(val);
  if (!clean) return null;
  return clean.toLowerCase().replace(/\s+/g, '');
}

/**
 * Normaliza montos monetarios o asignaciones salariales.
 */
function sanitizeMoney(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = sanitizeString(val);
  if (!str) return null;
  const cleanNum = str.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleanNum);
  return isNaN(num) ? null : num;
}

/**
 * Parsea fechas de Excel (números seriales, Date objects, y strings variados).
 * Retorna un objeto Date válido o null.
 */
function parseExcelDate(val) {
  if (val === null || val === undefined) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  // 1. Número serial de Excel (ej: 44561)
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return isNaN(d.getTime()) ? null : d;
    }
  }

  const str = sanitizeString(val);
  if (!str) return null;

  // 2. Formato DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d;
  }

  // 3. Formato YYYY/MM/DD o YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Convierte un Date a string en formato estándar YYYY-MM-DD
 */
function formatDateISO(date) {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

/**
 * Calcula la diferencia exacta entre dos fechas en Años, Meses y Días.
 * No asume meses de 30 días, sino los días reales del calendario.
 */
function calcularDiferenciaFechas(fechaInicio, fechaFin = new Date()) {
  if (!fechaInicio || isNaN(fechaInicio.getTime())) {
    return { anios: 0, meses: 0, dias: 0, texto: 'No disponible' };
  }

  let anios = fechaFin.getUTCFullYear() - fechaInicio.getUTCFullYear();
  let meses = fechaFin.getUTCMonth() - fechaInicio.getUTCMonth();
  let dias = fechaFin.getUTCDate() - fechaInicio.getUTCDate();

  if (dias < 0) {
    meses -= 1;
    const ultimoDiaMesAnterior = new Date(Date.UTC(fechaFin.getUTCFullYear(), fechaFin.getUTCMonth(), 0)).getUTCDate();
    dias += ultimoDiaMesAnterior;
  }

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  return {
    anios: Math.max(0, anios),
    meses: Math.max(0, meses),
    dias: Math.max(0, dias),
    texto: `${Math.max(0, anios)} años, ${Math.max(0, meses)} meses, ${Math.max(0, dias)} días`
  };
}

module.exports = {
  sanitizeString,
  sanitizeCedula,
  evaluarCedula,
  validarCedulaExcel,
  formatCedulaProvisional,
  detectarVacante,
  extraerCargoExcel,
  esFilaFantasma,
  sanitizeEmail,
  sanitizeMoney,
  parseExcelDate,
  formatDateISO,
  calcularDiferenciaFechas
};
