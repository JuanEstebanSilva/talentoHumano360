// src/utils/employeeValidator.js
/**
 * Módulo Senior de Validaciones y Normalizaciones de Reglas de Negocio
 * para el Módulo de Recursos Humanos (Talento 360).
 */

const GRADOS_VALIDOS = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  'N/a', 'NE'
];

const CLASIFICACIONES_EMPLEO = [
  'Carrera Administrativa',
  'Encargo en Vacante Definitiva',
  'Encargo en Vacante Temporal',
  'Encargo con Licencia No Remunerada',
  'Judicatura',
  'Licencia No Remunerada',
  'Empleo de Período Fijo',
  'Provisional en Vacante Definitiva',
  'Provisional en Vacante Temporal',
  'Aprendiz o Contrato SENA',
  'Vacante Definitiva',
  'Vacante Definitiva provista por Provisional',
  'Vacante Temporal',
  'Vacante Temporal provista por Provisional',
  'Libre Nombramiento y Remoción',
  'Trabajador Oficial',
  'Sin clasificar'
];

const CLASIFICACION_EMPLEO_MAP = {
  'C.A': 'Carrera Administrativa',
  'CA': 'Carrera Administrativa',
  'C.A.': 'Carrera Administrativa',
  'CARRERA ADMINISTRATIVA': 'Carrera Administrativa',
  'ENCAR T': 'Encargo en Vacante Temporal',
  'ENCART': 'Encargo en Vacante Temporal',
  'ENCARGO VT': 'Encargo en Vacante Temporal',
  'ENCARGO EN VACANTE TEMPORAL': 'Encargo en Vacante Temporal',
  'ENCARGO VD': 'Encargo en Vacante Definitiva',
  'ENCARGO EN VACANTE DEFINITIVA': 'Encargo en Vacante Definitiva',
  'JUDIC': 'Judicatura',
  'JUDICATURA': 'Judicatura',
  'L.N': 'Licencia No Remunerada',
  'LN': 'Licencia No Remunerada',
  'L.N.': 'Licencia No Remunerada',
  'LICENCIA NO REMUNERADA': 'Licencia No Remunerada',
  'L.N ENCARGO': 'Encargo con Licencia No Remunerada',
  'LN ENCARGO': 'Encargo con Licencia No Remunerada',
  'L.N. ENCARGO': 'Encargo con Licencia No Remunerada',
  'ENCARGO CON LICENCIA NO REMUNERADA': 'Encargo con Licencia No Remunerada',
  'PERIODO': 'Empleo de Período Fijo',
  'PERÍODO': 'Empleo de Período Fijo',
  'PERIODO FIJO': 'Empleo de Período Fijo',
  'EMPLEO DE PERIODO FIJO': 'Empleo de Período Fijo',
  'EMPLEO DE PERÍODO FIJO': 'Empleo de Período Fijo',
  'PROV VD': 'Provisional en Vacante Definitiva',
  'PROVISIONAL VD': 'Provisional en Vacante Definitiva',
  'PROVISIONAL EN VACANTE DEFINITIVA': 'Provisional en Vacante Definitiva',
  'PROV VT': 'Provisional en Vacante Temporal',
  'PROVISIONAL VT': 'Provisional en Vacante Temporal',
  'PROVISIONAL EN VACANTE TEMPORAL': 'Provisional en Vacante Temporal',
  'SENA': 'Aprendiz o Contrato SENA',
  'APRENDIZ SENA': 'Aprendiz o Contrato SENA',
  'CONTRATO SENA': 'Aprendiz o Contrato SENA',
  'APRENDIZ O CONTRATO SENA': 'Aprendiz o Contrato SENA',
  'VD': 'Vacante Definitiva',
  'VACANTE DEFINITIVA': 'Vacante Definitiva',
  'VD PROV': 'Vacante Definitiva provista por Provisional',
  'VACANTE DEFINITIVA PROVISTA POR PROVISIONAL': 'Vacante Definitiva provista por Provisional',
  'VT': 'Vacante Temporal',
  'VACANTE TEMPORAL': 'Vacante Temporal',
  'VT PROV': 'Vacante Temporal provista por Provisional',
  'VACANTE TEMPORAL PROVISTA POR PROVISIONAL': 'Vacante Temporal provista por Provisional',
  'LIBRE NOMBRAMIENTO Y REMOCIÓN': 'Libre Nombramiento y Remoción',
  'LIBRE NOMBRAMIENTO Y REMOCION': 'Libre Nombramiento y Remoción',
  'TRABAJADOR OFICIAL': 'Trabajador Oficial',
  'VACANTE': 'Vacante Definitiva',
  'PROVISIONAL': 'Provisional en Vacante Definitiva',
  'TEMPORAL': 'Encargo en Vacante Temporal',
  'SIN CLASIFICAR': 'Sin clasificar'
};

/**
 * Normaliza las siglas de clasificación de empleo al nombre completo formal.
 * @param {string|null} val
 * @returns {string}
 */
function normalizarClasificacionEmpleo(val) {
  if (val === null || val === undefined) return 'Sin clasificar';
  const str = String(val).trim().replace(/\s+/g, ' ');
  if (!str || str === '—' || str === '-' || str.toLowerCase() === '(vacías)' || str.toLowerCase() === '(vacias)' || str.toLowerCase() === 'sin clasificar') {
    return 'Sin clasificar';
  }

  const upper = str.toUpperCase();
  if (CLASIFICACION_EMPLEO_MAP[upper]) {
    return CLASIFICACION_EMPLEO_MAP[upper];
  }

  const noDots = upper.replace(/\./g, '').trim();
  if (CLASIFICACION_EMPLEO_MAP[noDots]) {
    return CLASIFICACION_EMPLEO_MAP[noDots];
  }

  const noAccents = upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (CLASIFICACION_EMPLEO_MAP[noAccents]) {
    return CLASIFICACION_EMPLEO_MAP[noAccents];
  }

  const matchCat = CLASIFICACIONES_EMPLEO.find(c => c.toLowerCase() === str.toLowerCase());
  if (matchCat) return matchCat;

  return str;
}

/**
 * Analiza la columna SITUACION (Columna W) y extrae la condición especial o tipo de discapacidad.
 * @param {string|null} rawSituacion
 * @param {string|null} [rawDiscapacidad=null]
 * @returns {{ situacion: string, tipoDiscapacidad: string|null, valido: boolean }}
 */
function parseSituacionYDiscapacidad(rawSituacion, rawDiscapacidad = null) {
  const sitClean = String(rawSituacion || '').trim();
  const discClean = String(rawDiscapacidad || '').trim();

  if (discClean) {
    const sitVal = sitClean ? sitClean.toUpperCase() : 'DISCAPACIDAD';
    return {
      valido: true,
      situacion: sitVal,
      tipoDiscapacidad: discClean.toLowerCase()
    };
  }

  if (!sitClean) {
    return { valido: true, situacion: 'ACTIVO', tipoDiscapacidad: null };
  }

  const sitUpper = sitClean.toUpperCase();
  if (sitUpper.includes('DISCAPACIDAD')) {
    let tipo = null;
    if (sitUpper.includes('AUDITIV')) {
      tipo = 'auditiva';
    } else if (sitUpper.includes('VISUAL')) {
      tipo = 'visual';
    } else if (sitUpper.includes('MOTOR')) {
      tipo = 'motora';
    } else if (sitUpper.includes('COGNITIV')) {
      tipo = 'cognitiva';
    } else if (sitUpper.includes('SORDOMUD')) {
      tipo = 'sordomuda';
    } else if (sitUpper.includes('SORDOCIEG')) {
      tipo = 'sordociega';
    } else {
      const rem = sitUpper.replace(/DISCAPACIDAD[:\s\-]*/gi, '').trim().toLowerCase();
      tipo = rem ? rem : 'auditiva'; // Si sólo dice DISCAPACIDAD pero no detalla
    }

    return {
      valido: true,
      situacion: 'DISCAPACIDAD',
      tipoDiscapacidad: tipo
    };
  }

  return {
    valido: true,
    situacion: sitUpper,
    tipoDiscapacidad: null
  };
}

const ESTADOS_SERVIDOR = ['Activo', 'Inactivo', 'Pensionado'];

const SEXOS_VALIDOS = ['Femenino', 'Masculino', 'Prefiero no decirlo'];

const DISCAPACIDADES_VALIDAS = [
  'visual',
  'auditiva',
  'motora',
  'cognitiva',
  'sordomuda',
  'sordociega'
];

const TIPOS_SANGRE_VALIDOS = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
];

const DIPLOMADOS_OPCIONES = [
  'Gestión Pública y Buen Gobierno',
  'Contratación Estatal y Secop II',
  'MIPG - Modelo Integrado de Planeación y Gestión',
  'Derecho Disciplinario y Control Interno',
  'Auditoría y Gestión Financiera Pública',
  'Sistemas Integrados de Gestión (HSEQ)',
  'Capacitación Técnica SENA',
  'Otro Diplomado / Especialización'
];

/**
 * Regla 2: Valida el código de cargo para formularios de creación y edición.
 * Es opcional: puede quedar vacío o null.
 * Admite cualquier combinación de caracteres (letras, números, códigos alfanuméricos).
 */
function validateCodigoCargo(val) {
  if (val === null || val === undefined || String(val).trim() === '' || String(val).trim().toUpperCase() === 'N/A') {
    return { valido: true, valor: null };
  }
  const str = String(val).trim();
  return { valido: true, valor: str };
}

/**
 * Regla 3: Grado es opcional (puede quedar vacío o null).
 * Si tiene valor, debe ser exactamente del 01 al 20, "N/a" o "NE".
 */
function validateGrado(val) {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { valido: true, valor: null };
  }
  const str = String(val).trim();
  const match = GRADOS_VALIDOS.find(g => g.toLowerCase() === str.toLowerCase());
  if (match) {
    return { valido: true, valor: match };
  }
  return { valido: false, error: `El grado "${str}" no es válido. Opciones permitidas: 01 a 20, N/a, NE.` };
}

/**
 * Validación de Tipo de Sangre (Opcional, pero si se ingresa valida las 8 opciones exactas).
 */
function validateTipoSangre(val) {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { valido: true, valor: null };
  }
  const str = String(val).trim().toUpperCase();
  const match = TIPOS_SANGRE_VALIDOS.find(t => t.toUpperCase() === str);
  if (match) {
    return { valido: true, valor: match };
  }
  return { valido: false, error: `Tipo de sangre "${str}" inválido. Opciones permitidas: ${TIPOS_SANGRE_VALIDOS.join(', ')}.` };
}

/**
 * Regla 6: Estado del servidor ("Activo", "Inactivo", "Pensionado").
 */
function validateEstadoServidor(val) {
  if (!val) return { valido: true, valor: 'Activo' };
  const str = String(val).trim();
  const match = ESTADOS_SERVIDOR.find(e => e.toLowerCase() === str.toLowerCase());
  if (match) {
    return { valido: true, valor: match };
  }
  return { valido: false, error: `Estado del servidor inválido. Opciones: ${ESTADOS_SERVIDOR.join(', ')}.` };
}

/**
 * Regla 7: Valida que el nombre completo contenga únicamente letras y espacios.
 * Retorna la desagregación automática en { primerApellido, segundoApellido, nombres, nombreCompleto }.
 */
function validateAndSplitNombre(fullName) {
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    return { valido: false, error: 'El nombre completo es obligatorio.' };
  }
  const cleanStr = fullName.trim().replace(/\s+/g, ' ');
  // Admite letras castellanas (incluyendo acentos, tildes y ñ) y espacios
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(cleanStr)) {
    return { valido: false, error: 'Nombres y Apellidos solo admiten letras y espacios.' };
  }

  const parts = cleanStr.toUpperCase().split(' ');
  let primerApellido = '';
  let segundoApellido = '';
  let nombres = '';

  if (parts.length === 1) {
    primerApellido = parts[0];
    nombres = parts[0];
  } else if (parts.length === 2) {
    primerApellido = parts[0];
    nombres = parts[1];
  } else if (parts.length === 3) {
    primerApellido = parts[0];
    segundoApellido = parts[1];
    nombres = parts[2];
  } else {
    // 4 o más palabras: Apellido1 Apellido2 Nombre1 [Nombre2...]
    primerApellido = parts[0];
    segundoApellido = parts[1];
    nombres = parts.slice(2).join(' ');
  }

  return {
    valido: true,
    primerApellido,
    segundoApellido,
    nombres,
    apellidos: [primerApellido, segundoApellido].filter(Boolean).join(' '),
    nombreCompleto: cleanStr.toUpperCase()
  };
}

/**
 * Regla 8: Cédula en inputs solo admite números. Cédula obligatoria por requerimiento de usuario.
 */
function validateCedulaInput(val, esRequerida = true) {
  if (val === null || val === undefined || String(val).trim() === '') {
    if (esRequerida) {
      return { esVacia: true, valido: false, error: 'La cédula es obligatoria.' };
    }
    return { esVacia: true, valido: true, valor: null };
  }
  const str = String(val).trim();
  if (/^PROV-\d+$/i.test(str)) {
    return { esVacia: false, esProvisional: true, valido: true, valor: str.toUpperCase() };
  }
  if (!/^\d+$/.test(str)) {
    return { esVacia: false, valido: false, error: 'La cédula debe contener únicamente números (sin puntos, comas ni letras).' };
  }
  return { esVacia: false, esProvisional: false, valido: true, valor: str };
}

/**
 * Regla 8 (Lectura): Formateador visual con puntos (ej: 1049603050 -> 1.049.603.050).
 */
function formatCedulaVisual(val) {
  if (!val) return '—';
  const str = String(val).trim();
  if (/^\d+$/.test(str)) {
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  return str;
}

/**
 * Regla 9: Generador atómico de ID temporal PROV-00001 secuencial consultando la BD.
 */
async function generarIdTemporalSecuencial(clientOrPool) {
  const query = `
    SELECT COALESCE(MAX(SUBSTRING(cedula FROM '^PROV-([0-9]+)')::integer), 0) AS max_prov
    FROM personas
    WHERE cedula ~ '^PROV-[0-9]+';
  `;
  const res = await clientOrPool.query(query);
  const currentMax = parseInt(res.rows[0]?.max_prov, 10) || 0;
  const nextNumber = currentMax + 1;
  return `PROV-${String(nextNumber).padStart(5, '0')}`;
}

/**
 * Regla 11: Sexo (Opcional; si tiene valor valida entre Femenino, Masculino, Prefiero no decirlo).
 */
function validateSexo(val) {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { valido: true, valor: null };
  }
  const str = String(val).trim();
  const match = SEXOS_VALIDOS.find(s => s.toLowerCase() === str.toLowerCase());
  if (match) {
    return { valido: true, valor: match };
  }
  // Compatibilidad con F/M simples
  if (/^F$/i.test(str) || /^FEM/i.test(str)) return { valido: true, valor: 'Femenino' };
  if (/^M$/i.test(str) || /^MASC/i.test(str)) return { valido: true, valor: 'Masculino' };
  return { valido: false, error: 'El sexo debe ser "Femenino", "Masculino" o "Prefiero no decirlo".' };
}

/**
 * Regla 12: Situación y Discapacidad (Ambos opcionales).
 */
function validateSituacionDiscapacidad(situacion, discapacidad) {
  return parseSituacionYDiscapacidad(situacion, discapacidad);
}

/**
 * Reglas 13 y 14: Cálculo dinámico de Edad y Tiempo de Servicio.
 * Formato de salida estricto: "X años, Y meses, Z días".
 */
function calcularDiferenciaFechasExacta(fechaInicio, fechaFin = new Date()) {
  if (!fechaInicio) return { anios: 0, meses: 0, dias: 0, texto: 'No disponible' };
  const inicio = fechaInicio instanceof Date ? fechaInicio : new Date(fechaInicio);
  if (isNaN(inicio.getTime())) return { anios: 0, meses: 0, dias: 0, texto: 'No disponible' };

  let anios = fechaFin.getUTCFullYear() - inicio.getUTCFullYear();
  let meses = fechaFin.getUTCMonth() - inicio.getUTCMonth();
  let dias = fechaFin.getUTCDate() - inicio.getUTCDate();

  if (dias < 0) {
    meses -= 1;
    const ultimoDiaMesAnterior = new Date(Date.UTC(fechaFin.getUTCFullYear(), fechaFin.getUTCMonth(), 0)).getUTCDate();
    dias += ultimoDiaMesAnterior;
  }

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  anios = Math.max(0, anios);
  meses = Math.max(0, meses);
  dias = Math.max(0, dias);

  return {
    anios,
    meses,
    dias,
    texto: `${anios} años, ${meses} meses, ${dias} días`
  };
}

/**
 * Regla 16: Funciones (Campo mixto: números entre 00 y 999 o texto explicativo).
 */
function validateFunciones(val) {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { valido: true, valor: null };
  }
  const str = String(val).trim();
  // Si es un número puro
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    if (num >= 0 && num <= 999) {
      return { valido: true, valor: String(num).padStart(2, '0') };
    }
    return { valido: false, error: 'Si el campo Funciones es numérico, debe estar entre 00 y 999.' };
  }
  // Si es texto (decreto, resolución, etc.)
  return { valido: true, valor: str };
}

/**
 * Regla 18: Matrícula Profesional.
 * Admite letras, números, guiones y cualquier formato oficial de tarjeta profesional.
 */
function validateMatricula(val) {
  if (val === null || val === undefined || String(val).trim() === '' || String(val).trim().toUpperCase() === 'NO REGISTRADO') {
    return { valido: true, valor: null };
  }
  const str = String(val).trim();
  return { valido: true, valor: str };
}

/**
 * Regla 20: Teléfono Fijo (Solo numérico, entre 6 y 12 dígitos).
 */
function validateTelefonoFijo(val) {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { valido: true, valor: null };
  }
  const str = String(val).trim().replace(/[\s\-\.]/g, '');
  if (!/^\d{6,12}$/.test(str)) {
    return { valido: false, error: 'El teléfono fijo debe contener entre 6 y 12 dígitos numéricos.' };
  }
  return { valido: true, valor: str };
}

/**
 * Regla 21: Celulares (Hasta 3 números independientes, cada uno entre 9 y 10 dígitos).
 */
function validateCelulares(input) {
  if (!input) return { valido: true, celulares: [] };

  let arr = [];
  if (Array.isArray(input)) {
    arr = input;
  } else if (typeof input === 'string') {
    arr = input.split(/[\/\,\;]/);
  }

  const cleaned = [];
  for (let i = 0; i < arr.length; i++) {
    const raw = String(arr[i] || '').trim().replace(/[\s\-\.]/g, '');
    if (!raw) continue;
    if (!/^\d{9,10}$/.test(raw)) {
      return {
        valido: false,
        error: `El número de celular "${arr[i]}" no es válido. Debe tener entre 9 y 10 dígitos numéricos.`
      };
    }
    cleaned.push(raw);
  }

  if (cleaned.length > 3) {
    return { valido: false, error: 'El formulario solo permite registrar hasta 3 números celulares independientes.' };
  }

  return { valido: true, celulares: cleaned };
}

/**
 * Regla 22: Correo electrónico (Validación exigiendo @).
 */
function validateEmail(val, campoNombre = 'Correo electrónico') {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { valido: true, valor: null };
  }
  const str = String(val).trim().toLowerCase();
  if (!str.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return { valido: false, error: `${campoNombre} debe tener un formato válido que incluya "@" y dominio.` };
  }
  return { valido: true, valor: str };
}

/**
 * Valida y calcula periodos de 'Otro Tiempo con la Gobernación' (Experiencia Múltiple).
 * Soporta arreglo de objetos [{ desde: 'YYYY-MM-DD', hasta: 'YYYY-MM-DD' }].
 * En cada fila, 'desde' y 'hasta' son obligatorios, y 'hasta' >= 'desde'.
 * Calcula automáticamente la duración de cada periodo y el acumulado total en formato "X años, Y meses, Z días".
 */
function validateOtroTiempoPeriodos(input) {
  if (!input) {
    return { valido: true, periodos: [], acumuladoTexto: null };
  }

  let periodos = input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return { valido: true, periodos: [], acumuladoTexto: null };
    }
    // Si viene como JSON stringificado
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        periodos = JSON.parse(trimmed);
      } catch {
        return { valido: true, periodos: [], acumuladoTexto: trimmed };
      }
    } else {
      // Texto plano histórico heredado
      return { valido: true, periodos: [], acumuladoTexto: trimmed };
    }
  }

  if (!Array.isArray(periodos)) {
    return { valido: false, error: 'El formato de Otro Tiempo con la Gobernación debe ser un arreglo de periodos.' };
  }

  if (periodos.length === 0) {
    return { valido: true, periodos: [], acumuladoTexto: null };
  }

  const periodosValidados = [];
  let totalAnios = 0;
  let totalMeses = 0;
  let totalDias = 0;

  for (let i = 0; i < periodos.length; i++) {
    const p = periodos[i];
    if (!p || typeof p !== 'object') {
      return { valido: false, error: `El periodo #${i + 1} no tiene un formato válido.` };
    }

    const desdeStr = (p.desde || '').trim();
    const hastaStr = (p.hasta || '').trim();

    if (!desdeStr || !hastaStr) {
      return {
        valido: false,
        error: `En el periodo #${i + 1}, tanto la fecha de inicio (desde) como la fecha de fin (hasta) son obligatorias.`
      };
    }

    const fechaDesde = new Date(desdeStr + (desdeStr.includes('T') ? '' : 'T00:00:00Z'));
    const fechaHasta = new Date(hastaStr + (hastaStr.includes('T') ? '' : 'T00:00:00Z'));

    if (isNaN(fechaDesde.getTime())) {
      return { valido: false, error: `La fecha de inicio "${desdeStr}" en el periodo #${i + 1} no es válida.` };
    }
    if (isNaN(fechaHasta.getTime())) {
      return { valido: false, error: `La fecha de fin "${hastaStr}" en el periodo #${i + 1} no es válida.` };
    }

    if (fechaHasta < fechaDesde) {
      return {
        valido: false,
        error: `En el periodo #${i + 1}, la fecha de fin (${hastaStr}) debe ser mayor o igual a la fecha de inicio (${desdeStr}).`
      };
    }

    const diff = calcularDiferenciaFechasExacta(fechaDesde, fechaHasta);
    totalAnios += diff.anios;
    totalMeses += diff.meses;
    totalDias += diff.dias;

    periodosValidados.push({
      desde: desdeStr,
      hasta: hastaStr,
      anios: diff.anios,
      meses: diff.meses,
      dias: diff.dias,
      duracionTexto: diff.texto
    });
  }

  // Normalizar días a meses (30 días = 1 mes)
  if (totalDias >= 30) {
    totalMeses += Math.floor(totalDias / 30);
    totalDias = totalDias % 30;
  }
  // Normalizar meses a años (12 meses = 1 año)
  if (totalMeses >= 12) {
    totalAnios += Math.floor(totalMeses / 12);
    totalMeses = totalMeses % 12;
  }

  const acumuladoTexto = `${totalAnios} años, ${totalMeses} meses, ${totalDias} días`;

  return {
    valido: true,
    periodos: periodosValidados,
    acumuladoTexto,
    anios: totalAnios,
    meses: totalMeses,
    dias: totalDias
  };
}

const MESES_NOMBRES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

/**
 * Parsea fechas en formatos variados: DD/MM/YYYY, DD-MM-YYYY, '31 de enero de 2019' o solo año YYYY.
 */
function parseFechaFlexible(str) {
  if (!str) return null;
  let s = String(str).trim().toLowerCase();

  // Caso: 31 de enero de 2019
  const textMatch = s.match(/^(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})$/i);
  if (textMatch) {
    const d = parseInt(textMatch[1], 10);
    const m = MESES_NOMBRES[textMatch[2].toLowerCase()];
    const y = parseInt(textMatch[3], 10);
    if (m && y >= 1900 && y <= 2100 && d >= 1 && d <= 31) {
      return new Date(Date.UTC(y, m - 1, d));
    }
  }

  // Normalizar separadores / y -
  s = s.replace(/[\-\.]+/g, '/');

  // Formato DD/MM/YYYY o D/M/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return new Date(Date.UTC(y, mo - 1, d));
    }
  }

  // Formato solo año: 2021
  const mYear = s.match(/^(\d{4})$/);
  if (mYear) {
    const y = parseInt(mYear[1], 10);
    if (y >= 1900 && y <= 2100) {
      return new Date(Date.UTC(y, 11, 31));
    }
  }

  return null;
}

/**
 * Parsea textos de duración como "2 años, 1 meses, 15 días", "2 años", "6 meses", etc.
 */
function parseDuracionTexto(t) {
  if (!t) return { anios: 0, meses: 0, dias: 0 };
  if (typeof t === 'object' && ('anios' in t || 'meses' in t || 'dias' in t)) {
    return {
      anios: parseInt(t.anios) || 0,
      meses: parseInt(t.meses) || 0,
      dias: parseInt(t.dias) || 0
    };
  }
  let str = String(t).toLowerCase();
  str = str.replace(/a\?\?os|a\?os/gi, 'años');

  const aniosMatch = str.match(/(\d+)\s*(?:año|ano|a\b)/i);
  const mesesMatch = str.match(/(\d+)\s*(?:mes|m\b)/i);
  const diasMatch = str.match(/(\d+)\s*(?:día|dia|d\b)/i);

  return {
    anios: aniosMatch ? parseInt(aniosMatch[1], 10) : 0,
    meses: mesesMatch ? parseInt(mesesMatch[1], 10) : 0,
    dias: diasMatch ? parseInt(diasMatch[1], 10) : 0
  };
}

/**
 * Normaliza y calcula el tiempo acumulado de 'Otro Tiempo con la Gobernación'
 * a partir de un array de periodos [{ desde, hasta }], o de un texto plano (duración o rangos de fechas).
 * Retorna { anios, meses, dias, texto: "X años, Y meses, Z días", tieneValor: boolean }
 */
function calcularOtroTiempoNormalizado(periodos, textoRaw, fechaReferencia = null) {
  // 1. Si periodos es un array con objetos estructurados { desde, hasta }
  if (Array.isArray(periodos) && periodos.length > 0) {
    const validos = periodos.filter(p => p && p.desde && p.hasta);
    if (validos.length > 0) {
      let totalAnios = 0, totalMeses = 0, totalDias = 0;
      for (const p of validos) {
        const d1 = new Date(p.desde + (p.desde.includes('T') ? '' : 'T00:00:00Z'));
        const d2 = new Date(p.hasta + (p.hasta.includes('T') ? '' : 'T00:00:00Z'));
        if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
          const diff = calcularDiferenciaFechasExacta(d1, d2);
          totalAnios += diff.anios;
          totalMeses += diff.meses;
          totalDias += diff.dias;
        }
      }
      if (totalDias >= 30) {
        totalMeses += Math.floor(totalDias / 30);
        totalDias = totalDias % 30;
      }
      if (totalMeses >= 12) {
        totalAnios += Math.floor(totalMeses / 12);
        totalMeses = totalMeses % 12;
      }
      if (totalAnios > 0 || totalMeses > 0 || totalDias > 0) {
        return {
          anios: totalAnios, meses: totalMeses, dias: totalDias,
          texto: `${totalAnios} años, ${totalMeses} meses, ${totalDias} días`,
          tieneValor: true
        };
      }
    }
  }

  // 2. Si hay textoRaw (o primer elemento si periodos tiene [{ nota: "..." }])
  let rawStr = '';
  if (typeof textoRaw === 'string' && textoRaw.trim()) {
    rawStr = textoRaw.trim();
  } else if (Array.isArray(periodos) && periodos.length > 0 && periodos[0]?.nota) {
    rawStr = String(periodos[0].nota).trim();
  }

  if (!rawStr || rawStr.toUpperCase() === 'NO REGISTRADO' || rawStr.toUpperCase() === 'NINGUNO' || rawStr === '0' || rawStr === '—') {
    return { anios: 0, meses: 0, dias: 0, texto: '0 años, 0 meses, 0 días', tieneValor: false };
  }

  // Si el texto raw es una duración directa explícita ("1 año", "2 a??os", "2 años", "6 meses", "15 días")
  const duracionDirecta = parseDuracionTexto(rawStr);
  if (duracionDirecta.anios > 0 || duracionDirecta.meses > 0 || duracionDirecta.dias > 0) {
    return {
      ...duracionDirecta,
      texto: `${duracionDirecta.anios} años, ${duracionDirecta.meses} meses, ${duracionDirecta.dias} días`,
      tieneValor: true
    };
  }

  // Extraer rangos de fechas en el texto histórico
  let cleanText = rawStr
    .replace(/del\s+/gi, '')
    .replace(/y\s+otros\s+tiempos/gi, '')
    .replace(/faltan\s+tiempos\s+anteriores/gi, '')
    .trim();

  const dateRegexPattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})\s*(?:al|a|\-)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4}|\d{4})/gi;

  let match;
  let totalAnios = 0, totalMeses = 0, totalDias = 0;
  let matchesFound = 0;

  while ((match = dateRegexPattern.exec(cleanText)) !== null) {
    const f1Str = match[1];
    const f2Str = match[2];
    const f1 = parseFechaFlexible(f1Str);
    const f2 = parseFechaFlexible(f2Str);

    if (f1 && f2 && f2 >= f1) {
      const diff = calcularDiferenciaFechasExacta(f1, f2);
      totalAnios += diff.anios;
      totalMeses += diff.meses;
      totalDias += diff.dias;
      matchesFound++;
    }
  }

  // Si no se encontró con el patrón completo pero hay un rango abierto tipo "01-02-2016 AL"
  if (matchesFound === 0 && fechaReferencia) {
    const openMatch = cleanText.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})\s*(?:al|a|\-)\s*(?:…|\.{2,}|)$/i);
    if (openMatch) {
      const f1 = parseFechaFlexible(openMatch[1]);
      const f2 = fechaReferencia instanceof Date ? fechaReferencia : new Date(fechaReferencia);
      if (f1 && !isNaN(f2.getTime()) && f2 >= f1) {
        const diff = calcularDiferenciaFechasExacta(f1, f2);
        totalAnios += diff.anios;
        totalMeses += diff.meses;
        totalDias += diff.dias;
        matchesFound++;
      }
    }
  }

  if (matchesFound > 0) {
    if (totalDias >= 30) {
      totalMeses += Math.floor(totalDias / 30);
      totalDias = totalDias % 30;
    }
    if (totalMeses >= 12) {
      totalAnios += Math.floor(totalMeses / 12);
      totalMeses = totalMeses % 12;
    }
    return {
      anios: totalAnios, meses: totalMeses, dias: totalDias,
      texto: `${totalAnios} años, ${totalMeses} meses, ${totalDias} días`,
      tieneValor: true
    };
  }

  return { anios: 0, meses: 0, dias: 0, texto: '0 años, 0 meses, 0 días', tieneValor: false };
}

/**
 * Calcula el Tiempo Total en la Gobernación sumando el Tiempo de Servicio y Otro Tiempo en la Gobernación.
 * Ambos tiempos pueden ser objetos { anios, meses, dias }, arreglos de periodos [{ desde, hasta }], o strings con duraciones.
 * Retorna { anios, meses, dias, texto: "X años, Y meses, Z días" } o null si ninguno tiene datos.
 */
function sumarTiemposExactos(tiempo1, tiempo2) {
  function resolverDuracion(t) {
    if (!t) return { anios: 0, meses: 0, dias: 0, tieneValor: false };
    if (Array.isArray(t)) {
      if (t.length === 0) return { anios: 0, meses: 0, dias: 0, tieneValor: false };
      return calcularOtroTiempoNormalizado(t, null);
    }
    if (typeof t === 'object' && ('anios' in t || 'meses' in t || 'dias' in t)) {
      const anios = parseInt(t.anios) || 0;
      const meses = parseInt(t.meses) || 0;
      const dias = parseInt(t.dias) || 0;
      return {
        anios, meses, dias,
        texto: `${anios} años, ${meses} meses, ${dias} días`,
        tieneValor: (anios > 0 || meses > 0 || dias > 0)
      };
    }
    return calcularOtroTiempoNormalizado(null, t);
  }

  const d1 = resolverDuracion(tiempo1);
  const d2 = resolverDuracion(tiempo2);

  if (!d1.tieneValor && !d2.tieneValor) {
    return null;
  }

  let totalAnios = d1.anios + d2.anios;
  let totalMeses = d1.meses + d2.meses;
  let totalDias = d1.dias + d2.dias;

  if (totalDias >= 30) {
    totalMeses += Math.floor(totalDias / 30);
    totalDias = totalDias % 30;
  }
  if (totalMeses >= 12) {
    totalAnios += Math.floor(totalMeses / 12);
    totalMeses = totalMeses % 12;
  }

  const texto = `${totalAnios} años, ${totalMeses} meses, ${totalDias} días`;
  return {
    anios: totalAnios,
    meses: totalMeses,
    dias: totalDias,
    texto
  };
}

module.exports = {
  GRADOS_VALIDOS,
  CLASIFICACIONES_EMPLEO,
  CLASIFICACION_EMPLEO_MAP,
  normalizarClasificacionEmpleo,
  parseSituacionYDiscapacidad,
  ESTADOS_SERVIDOR,
  SEXOS_VALIDOS,
  DISCAPACIDADES_VALIDAS,
  TIPOS_SANGRE_VALIDOS,
  DIPLOMADOS_OPCIONES,
  validateCodigoCargo,
  validateGrado,
  validateEstadoServidor,
  validateAndSplitNombre,
  validateCedulaInput,
  formatCedulaVisual,
  generarIdTemporalSecuencial,
  validateSexo,
  validateTipoSangre,
  validateSituacionDiscapacidad,
  calcularDiferenciaFechasExacta,
  validateFunciones,
  validateMatricula,
  validateTelefonoFijo,
  validateCelulares,
  validateEmail,
  validateOtroTiempoPeriodos,
  sumarTiemposExactos,
  parseDuracionTexto,
  parseFechaFlexible,
  calcularOtroTiempoNormalizado
};


