// src/controllers/employeeImportController.js
const multer = require('multer');
const XLSX = require('xlsx');
const { mapRowToFuncionarioDTO } = require('../dto/funcionarioExcelDTO');
const { evaluarCedula, esFilaFantasma, detectarVacante, extraerCargoExcel } = require('../utils/excelHelper');
const EmployeeImportService = require('../services/employeeImportService');

// Configuración de Multer para carga en memoria (límite razonable: 15 MB)
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_EXCEL_ROWS = 5000;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.originalname.startsWith('~$')) {
      return cb(new Error('El archivo enviado (~$) es un archivo temporal de bloqueo de Excel. Debes seleccionar y subir el archivo original de datos.'), false);
    }

    const isExcel = file.originalname.match(/\.(xlsx|xls)$/i) ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel';

    if (isExcel) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo se aceptan archivos Excel (.xlsx o .xls).'), false);
    }
  }
});

const uploadAny = upload.fields([{ name: 'archivo', maxCount: 1 }, { name: 'file', maxCount: 1 }]);

/**
 * Detecta las posiciones de columnas de cargo, código y grado en la hoja de cálculo.
 * Prioriza la segunda aparición (Columna F, G, H) como cargo actual/desempeño,
 * y la primera aparición (Columna A, B, C) como cargo nominal/base.
 */
function detectarMapeoCargos(worksheet) {
  if (!worksheet || !worksheet['!ref']) {
    return {
      colCargoTitular: 0,
      colCodTitular: 1,
      colGraTitular: 2,
      colAsigEncargo: 3,
      colDep: 4,
      colCargoDenom: 5,
      colCodDenom: 6,
      colGraDenom: 7
    };
  }
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  let colCargoTitular = null;
  let colCodTitular = null;
  let colGraTitular = null;
  let colAsigEncargo = null;
  let colDep = null;
  let colCargoDenom = null;
  let colCodDenom = null;
  let colGraDenom = null;

  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
    const val = String(cell?.v || '').trim().toUpperCase();

    if (val.includes('TITULAR') || (val.includes('CARGO') && C < 4)) {
      if (colCargoTitular === null) colCargoTitular = C;
    } else if (val.includes('DENOMINAC') || val.includes('CARGO')) {
      if (colCargoDenom === null) colCargoDenom = C;
    } else if (val.includes('ASIGNAC')) {
      colAsigEncargo = C;
    } else if (val.includes('DEPEN')) {
      colDep = C;
    }
  }

  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
    const val = String(cell?.v || '').trim().toUpperCase();

    if (val.startsWith('COD') || val.includes('CÓDIGO') || val.includes('CODIGO')) {
      if (colDep !== null && C < colDep) {
        if (colCodTitular === null) colCodTitular = C;
      } else if (colDep !== null && C > colDep) {
        if (colCodDenom === null) colCodDenom = C;
      } else {
        if (colCodTitular === null) colCodTitular = C;
        else if (colCodDenom === null) colCodDenom = C;
      }
    }

    if (val.startsWith('GRA') || val.includes('GRADO')) {
      if (colDep !== null && C < colDep) {
        if (colGraTitular === null) colGraTitular = C;
      } else if (colDep !== null && C > colDep) {
        if (colGraDenom === null) colGraDenom = C;
      } else {
        if (colGraTitular === null) colGraTitular = C;
        else if (colGraDenom === null) colGraDenom = C;
      }
    }
  }

  return {
    colCargoTitular: colCargoTitular !== null ? colCargoTitular : 0,
    colCodTitular: colCodTitular !== null ? colCodTitular : 1,
    colGraTitular: colGraTitular !== null ? colGraTitular : 2,
    colAsigEncargo: colAsigEncargo !== null ? colAsigEncargo : 3,
    colDep: colDep !== null ? colDep : 4,
    colCargoDenom: colCargoDenom !== null ? colCargoDenom : 5,
    colCodDenom: colCodDenom !== null ? colCodDenom : 6,
    colGraDenom: colGraDenom !== null ? colGraDenom : 7
  };
}
const uploadMiddleware = (req, res, next) => {
  uploadAny(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'El archivo supera el tamaño máximo permitido de 15 MB. Por favor divida el archivo o reduzca elementos pesados.'
        });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      if (req.files && req.files['archivo'] && req.files['archivo'][0]) {
        req.file = req.files['archivo'][0];
      } else if (req.files && req.files['file'] && req.files['file'][0]) {
        req.file = req.files['file'][0];
      }
    }
    next();
  });
};

/**
 * Valida la estructura mínima requerida de columnas en la primera fila de la hoja de cálculo.
 */
function validarEstructuraHoja(worksheet, sheetName) {
  if (!worksheet || !worksheet['!ref']) {
    return { valida: false, motivo: `La hoja "${sheetName}" está completamente vacía.` };
  }
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const headers = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
    if (cell && cell.v !== undefined && cell.v !== null) {
      const hStr = String(cell.v).replace(/[\u200B-\u200D\uFEFF\u00A0\u00AD]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
      if (hStr) headers.push(hStr);
    }
  }
  if (headers.length === 0) {
    return { valida: false, motivo: `La hoja "${sheetName}" no contiene encabezados en la primera fila.` };
  }

  const tieneIdentidad = headers.some(h =>
    h.includes('CEDULA') || h.includes('CÉDULA') || h.includes('DOCUMENTO') || h.includes('CC') ||
    h.includes('NOMBRE') || h.includes('APELLIDO') || h.includes('FUNCIONARIO')
  );
  const tieneOrganizacional = headers.some(h =>
    h.includes('CARGO') || h.includes('DENOMINAC') || h.includes('DEPEN') || h.includes('AREA') || h.includes('ÁREA')
  );

  if (!tieneIdentidad && !tieneOrganizacional) {
    return {
      valida: false,
      motivo: `La hoja "${sheetName}" no contiene las columnas requeridas para servidores públicos (requiere columnas de identidad como CÉDULA/NOMBRES y de cargo/dependencia). Columnas detectadas: ${headers.slice(0, 8).join(', ')}`
    };
  }

  return { valida: true, headers };
}

/**
 * Pre-auditoría / Dry-Run de importación (Vista Previa de Sincronización):
 * Lee el archivo Excel en memoria y lo compara contra la base de datos institucional
 * SIN escribir ningún cambio, detectando altas, actualizaciones, ausencias y vacantes.
 */
async function previsualizarExcel(req, res, pool) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No se ha adjuntado ningún archivo. Debe enviarse un archivo Excel bajo el campo "archivo".'
    });
  }

  try {
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false });
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        error: `El archivo Excel no pudo ser interpretado (${parseErr.message}).`
      });
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El archivo Excel no contiene ninguna hoja de cálculo disponible para lectura.'
      });
    }

    let algunaHojaConCabeceraValida = false;
    let primerErrorEstructura = '';
    for (const sName of workbook.SheetNames) {
      const ws = workbook.Sheets[sName];
      if (!ws || !ws['!ref']) continue;
      const validacion = validarEstructuraHoja(ws, sName);
      if (validacion.valida) {
        algunaHojaConCabeceraValida = true;
      } else if (!primerErrorEstructura) {
        primerErrorEstructura = validacion.motivo;
      }
    }

    if (!algunaHojaConCabeceraValida) {
      return res.status(400).json({
        success: false,
        error: primerErrorEstructura || 'El archivo Excel no contiene las columnas requeridas para servidores públicos.'
      });
    }

    const excelPersonas = [];
    const excelCedulasSet = new Set();
    const excelVacantes = [];
    let provisionalesCount = 0;
    const hojasProcesadas = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;
      const validacion = validarEstructuraHoja(worksheet, sheetName);
      if (!validacion.valida) continue;

      hojasProcesadas.push(sheetName);
      const colMap = detectarMapeoCargos(worksheet);
      const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : { s: { r: 0, c: 0 } };
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: null });

      rawRows.forEach((rawRow, idx) => {
        const rowNumber = idx + 2;
        if (esFilaFantasma(rawRow)) return;

        const actualSheetRow = range.s.r + 1 + idx;
        const getCellVal = (c) => {
          if (c === undefined || c === null) return null;
          const cell = worksheet[XLSX.utils.encode_cell({ r: actualSheetRow, c })];
          if (cell && cell.v !== undefined && cell.v !== null) {
            const s = String(cell.v).trim();
            return s !== '' ? s : null;
          }
          return null;
        };

        const cellCargoTitular = getCellVal(colMap.colCargoTitular);
        const cellCodTitular = getCellVal(colMap.colCodTitular);
        const cellGraTitular = getCellVal(colMap.colGraTitular);
        const cellCargoDenom = getCellVal(colMap.colCargoDenom);
        const cellCodDenom = getCellVal(colMap.colCodDenom);
        const cellGraDenom = getCellVal(colMap.colGraDenom);
        const cellDep = getCellVal(colMap.colDep);

        const cargo = cellCargoDenom || cellCargoTitular || extraerCargoExcel(rawRow) || 'CARGO POR DEFINIR';
        const dependencia = cellDep || String(rawRow['DEPENDENCIA'] || rawRow['AREA'] || 'DIRECCIÓN DE TALENTO HUMANO').trim();

        const esVacante = detectarVacante(rawRow);
        if (esVacante) {
          excelVacantes.push({
            fila: rowNumber,
            hoja: sheetName,
            cargo,
            dependencia,
            codigo: cellCodDenom || cellCodTitular || 'N/A',
            grado: cellGraDenom || cellGraTitular || 'N/A'
          });
          return;
        }

        const nombres = String(rawRow['NOMBRES'] || '').trim();
        const apellido1 = String(rawRow['PRIMER APELLIDO'] || '').trim();
        const apellido2 = String(rawRow['SEGUNDO APELLIDO'] || '').trim();
        const nombreCompleto = [apellido1, apellido2, nombres].filter(Boolean).join(' ').trim() ||
          String(rawRow['NOMBRE COMPLETO'] || rawRow['FUNCIONARIO'] || 'SERVIDOR').trim();

        const valorCedulaCrudo = rawRow['NUMERO DE CEDULA'] ?? rawRow['NÚMERO DE CÉDULA'] ?? rawRow['NUMERO CEDULA'] ?? rawRow['CEDULA'] ?? rawRow['CÉDULA'] ?? rawRow['DOCUMENTO'] ?? rawRow['CC'];
        const evaluacion = evaluarCedula(valorCedulaCrudo, rawRow, rowNumber, sheetName);

        if (evaluacion.sinCedula || evaluacion.esProvisional || !evaluacion.cedulaLimpia) {
          provisionalesCount++;
          excelPersonas.push({
            fila: rowNumber,
            hoja: sheetName,
            cedula: null,
            nombreCompleto,
            cargo,
            dependencia,
            esProvisional: true
          });
        } else {
          excelCedulasSet.add(evaluacion.cedulaLimpia);
          excelPersonas.push({
            fila: rowNumber,
            hoja: sheetName,
            cedula: evaluacion.cedulaLimpia,
            nombreCompleto,
            cargo,
            dependencia,
            esProvisional: false
          });
        }
      });
    }

    // Consultar estado actual de la base de datos
    const [dbActivosRes, dbVacantesRes] = await Promise.all([
      pool.query(`
        SELECT 
          p.id_persona,
          p.cedula,
          p.nombre_completo,
          r.id_registro,
          r.fecha_ingreso,
          d.dependencia,
          COALESCE(c_act.cargo, c_base.cargo, 'CARGO NO REGISTRADO') AS cargo
        FROM rel_principal r
        JOIN personas p ON p.id_persona = r.id_persona
        JOIN estados e ON e.id_estado = r.id_estado
        LEFT JOIN dependencias d ON d.id_dependencia = r.id_dependencia
        LEFT JOIN cargos c_act ON c_act.id_cargo = r.id_cargo_actual
        LEFT JOIN cargos c_base ON c_base.id_cargo = r.id_cargo_base
        WHERE COALESCE(p.es_vacante, false) = false
          AND NOT (
            UPPER(COALESCE(e.situacion, '')) IN ('VACANTE', 'VACANTE DEFINITIVA') 
            OR p.nombre_completo LIKE 'PLAZA VACANTE%'
            OR UPPER(COALESCE(p.primer_apellido, '')) = 'VACANTE'
          )
          AND LOWER(COALESCE(e.estado_servidor, 'Activo')) = 'activo'
          AND UPPER(COALESCE(e.situacion, '')) != 'RETIRADO'
          AND p.cedula IS NOT NULL AND p.cedula != ''
        ORDER BY p.nombre_completo ASC
      `),
      pool.query(`
        SELECT 
          r.id_registro,
          p.id_persona,
          d.dependencia,
          COALESCE(c_act.cargo, c_base.cargo, 'CARGO NO REGISTRADO') AS cargo
        FROM rel_principal r
        JOIN personas p ON p.id_persona = r.id_persona
        JOIN estados e ON e.id_estado = r.id_estado
        LEFT JOIN dependencias d ON d.id_dependencia = r.id_dependencia
        LEFT JOIN cargos c_act ON c_act.id_cargo = r.id_cargo_actual
        LEFT JOIN cargos c_base ON c_base.id_cargo = r.id_cargo_base
        WHERE COALESCE(p.es_vacante, false) = true
           OR UPPER(COALESCE(e.situacion, '')) IN ('VACANTE', 'VACANTE DEFINITIVA') 
           OR p.nombre_completo LIKE 'PLAZA VACANTE%'
           OR UPPER(COALESCE(p.primer_apellido, '')) = 'VACANTE'
      `)
    ]);

    const dbActivos = dbActivosRes.rows;
    const dbVacantes = dbVacantesRes.rows;
    const dbCedulasMap = new Map();
    for (const a of dbActivos) {
      if (a.cedula) dbCedulasMap.set(a.cedula, a);
    }

    const coincidentes = [];
    const nuevosIngresos = [];
    const ausentes = [];

    for (const p of excelPersonas) {
      if (p.cedula && dbCedulasMap.has(p.cedula)) {
        coincidentes.push(p);
      } else {
        nuevosIngresos.push(p);
      }
    }

    for (const a of dbActivos) {
      if (!excelCedulasSet.has(a.cedula)) {
        ausentes.push(a);
      }
    }

    return res.status(200).json({
      success: true,
      nombreArchivo: req.file.originalname,
      hojasProcesadas,
      resumen: {
        totalFilasExcel: excelPersonas.length + excelVacantes.length,
        servidoresEnExcel: excelPersonas.length,
        vacantesEnExcel: excelVacantes.length,
        nuevos: nuevosIngresos.length,
        actualizaciones: coincidentes.length,
        ausentes: ausentes.length,
        provisionales: provisionalesCount,
        servidoresActivosBD: dbActivos.length,
        vacantesActualesBD: dbVacantes.length
      },
      detalleAusentes: ausentes.map(a => ({
        cedula: a.cedula,
        nombre: a.nombre_completo,
        cargo: a.cargo,
        dependencia: a.dependencia,
        fechaIngreso: a.fecha_ingreso
      })),
      detalleNuevos: nuevosIngresos.slice(0, 100).map(n => ({
        cedula: n.cedula || 'TEMPORAL',
        nombre: n.nombreCompleto,
        cargo: n.cargo,
        dependencia: n.dependencia
      })),
      totalNuevos: nuevosIngresos.length
    });
  } catch (err) {
    console.error('[previsualizarExcel] error:', err);
    return res.status(500).json({
      success: false,
      error: `Error interno al previsualizar el archivo Excel: ${err.message}`
    });
  }
}

/**
 * Controlador Senior para procesamiento e importación masiva de Excel con filtrado
 * estricto de filas fantasma, validación de llave primaria (CEDULA) y respuesta Multi-Status.
 */
async function importarExcel(req, res, pool) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No se ha adjuntado ningún archivo. Debe enviarse un archivo Excel bajo el campo "archivo".'
    });
  }

  try {
    // 1. Leer buffer del archivo Excel
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false });
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        error: `El archivo Excel no pudo ser interpretado (${parseErr.message}). Asegúrate de no subir archivos temporales de bloqueo (~$) y que el archivo no esté dañado.`
      });
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El archivo Excel no contiene ninguna hoja de cálculo disponible para lectura.'
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Pre-validaciones globales del libro: tamaño en filas y estructura de cabeceras
    // ──────────────────────────────────────────────────────────────────────────
    let totalFilasEstimadas = 0;
    let algunaHojaConCabeceraValida = false;
    let primerErrorEstructura = '';

    for (const sName of workbook.SheetNames) {
      const ws = workbook.Sheets[sName];
      if (!ws || !ws['!ref']) continue;
      const rng = XLSX.utils.decode_range(ws['!ref']);
      const rowCount = Math.max(0, rng.e.r - rng.s.r);
      totalFilasEstimadas += rowCount;

      const validacion = validarEstructuraHoja(ws, sName);
      if (validacion.valida) {
        algunaHojaConCabeceraValida = true;
      } else if (!primerErrorEstructura) {
        primerErrorEstructura = validacion.motivo;
      }
    }

    if (totalFilasEstimadas === 0) {
      return res.status(400).json({
        success: false,
        error: 'El archivo Excel está completamente vacío o no contiene filas de datos.'
      });
    }

    if (totalFilasEstimadas > MAX_EXCEL_ROWS) {
      return res.status(400).json({
        success: false,
        error: `El archivo supera el límite máximo permitido de ${MAX_EXCEL_ROWS} filas (se detectaron aproximadamente ${totalFilasEstimadas} filas). Por favor divida el archivo o reduzca el tamaño del lote.`
      });
    }

    if (!algunaHojaConCabeceraValida) {
      return res.status(400).json({
        success: false,
        error: primerErrorEstructura || 'El archivo Excel no contiene las columnas requeridas para servidores públicos.'
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Consulta del último ID Provisional (DB):
    // Busca el número más alto actual con prefijo PROV-. Si no hay, inicia en 0.
    // ──────────────────────────────────────────────────────────────────────────
    const maxProvQuery = await pool.query(`
      SELECT COALESCE(MAX(SUBSTRING(cedula FROM '^PROV-([0-9]+)')::integer), 0) AS max_prov
      FROM personas
      WHERE cedula ~ '^PROV-[0-9]+';
    `);
    let provCounter = parseInt(maxProvQuery.rows[0]?.max_prov, 10) || 0;

    // Cache de IDs provisionales existentes en DB para mantener consistencia en re-importaciones
    const existingProvMap = new Map();
    const existingProvQuery = await pool.query(`
      SELECT LOWER(TRIM(nombre_completo)) AS nombre, cedula
      FROM personas
      WHERE cedula ~ '^PROV-[0-9]+';
    `);
    for (const r of existingProvQuery.rows) {
      if (r.nombre && r.cedula) existingProvMap.set(r.nombre, r.cedula);
    }

    /**
     * Generador Secuencial (Padded String):
     * Cada vez que detecta una cédula inválida, incrementa el contador en 1
     * y formatea el string usando .padStart(5, '0') (ej: PROV-00024).
     */
    function generarCedulaProvisional(nombreCompleto = '') {
      const key = (nombreCompleto || '').trim().toLowerCase();
      if (key && existingProvMap.has(key)) {
        return existingProvMap.get(key);
      }
      provCounter += 1;
      const nuevoId = `PROV-${String(provCounter).padStart(5, '0')}`;
      if (key) existingProvMap.set(key, nuevoId);
      return nuevoId;
    }

    // Estructuras de almacenamiento en memoria para segregación estricta
    const registrosValidos = [];
    const filasConErrores = [];
    const hojasProcesadas = [];
    const desglosePorHoja = {};
    let totalFilasLeidas = 0;
    let filasFantasmaOmitidas = 0;
    let totalProvisionales = 0;
    let totalVacantes = 0;

    // 2. Iteración sobre cada hoja del libro
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      const validacionHoja = validarEstructuraHoja(worksheet, sheetName);
      if (!validacionHoja.valida) {
        desglosePorHoja[sheetName] = {
          totalFilas: 0,
          registrosValidos: 0,
          provisionales: 0,
          filasConErrores: 0,
          filasFantasmaOmitidas: 0,
          estado: `Omitida: ${validacionHoja.motivo}`
        };
        continue;
      }

      const colMap = detectarMapeoCargos(worksheet);
      const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : { s: { r: 0, c: 0 } };

      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      if (!rawRows || rawRows.length === 0) {
        desglosePorHoja[sheetName] = {
          totalFilas: 0,
          registrosValidos: 0,
          provisionales: 0,
          filasConErrores: 0,
          filasFantasmaOmitidas: 0,
          estado: 'Hoja vacía'
        };
        continue;
      }

      hojasProcesadas.push(sheetName);
      let validasEnHoja = 0;
      let provisionalesEnHoja = 0;
      let vacantesEnHoja = 0;
      let erroresEnHoja = 0;
      let fantasmasEnHoja = 0;

      rawRows.forEach((rawRow, idx) => {
        const rowNumber = idx + 2; // +2 considerando encabezado en fila 1
        totalFilasLeidas++;

        // Enriquecer rawRow con las celdas directas por coordenadas para garantizar que Col F, G, H siempre se tomen
        const actualSheetRow = range.s.r + 1 + idx;
        const getCellVal = (c) => {
          if (c === undefined || c === null) return null;
          const cell = worksheet[XLSX.utils.encode_cell({ r: actualSheetRow, c })];
          if (cell && cell.v !== undefined && cell.v !== null) {
            const s = String(cell.v).trim();
            return s !== '' ? s : null;
          }
          return null;
        };

        const cellCargoTitular = getCellVal(colMap.colCargoTitular);
        const cellCodTitular = getCellVal(colMap.colCodTitular);
        const cellGraTitular = getCellVal(colMap.colGraTitular);
        const cellAsigEncargo = getCellVal(colMap.colAsigEncargo);
        const cellCargoDenom = getCellVal(colMap.colCargoDenom);
        const cellCodDenom = getCellVal(colMap.colCodDenom);
        const cellGraDenom = getCellVal(colMap.colGraDenom);
        const cellDep = getCellVal(colMap.colDep);

        if (cellCargoTitular && cellCargoTitular.trim()) {
          // El servidor TIENE encargo oficial:
          // Su cargo base/titular es el de Col A
          rawRow['__CARGO_TITULAR__'] = cellCargoTitular;
          rawRow['__CODIGO_TITULAR__'] = cellCodTitular;
          rawRow['__GRADO_TITULAR__'] = cellGraTitular;
          rawRow['__CARGO_BASE__'] = cellCargoTitular;
          rawRow['__CODIGO_BASE__'] = cellCodTitular;
          rawRow['__GRADO_BASE__'] = cellGraTitular;

          // Su cargo en encargo es el de Col F (la plaza/empleo de encargo)
          rawRow['__ENCARGO_DENOMINACION__'] = cellCargoDenom;
          rawRow['__ENCARGO_CODIGO__'] = cellCodDenom;
          rawRow['__ENCARGO_GRADO__'] = cellGraDenom;
          rawRow['__ENCARGO_ASIGNACION__'] = cellAsigEncargo;
          rawRow['__CARGO_ACTUAL__'] = cellCargoDenom;
          rawRow['__CODIGO_ACTUAL__'] = cellCodDenom;
          rawRow['__GRADO_ACTUAL__'] = cellGraDenom;
        } else {
          // El servidor NO tiene encargo:
          // Su cargo titular es el de Col F
          rawRow['__CARGO_TITULAR__'] = cellCargoDenom;
          rawRow['__CODIGO_TITULAR__'] = cellCodDenom;
          rawRow['__GRADO_TITULAR__'] = cellGraDenom;
          rawRow['__CARGO_BASE__'] = cellCargoDenom;
          rawRow['__CODIGO_BASE__'] = cellCodDenom;
          rawRow['__GRADO_BASE__'] = cellGraDenom;
          rawRow['__CARGO_ACTUAL__'] = cellCargoDenom;
          rawRow['__CODIGO_ACTUAL__'] = cellCodDenom;
          rawRow['__GRADO_ACTUAL__'] = cellGraDenom;

          rawRow['__ENCARGO_DENOMINACION__'] = null;
          rawRow['__ENCARGO_CODIGO__'] = null;
          rawRow['__ENCARGO_GRADO__'] = null;
          rawRow['__ENCARGO_ASIGNACION__'] = null;
        }
        if (cellDep) rawRow['__DEPENDENCIA__'] = cellDep;

        // A. Detección y descarte de "Filas Fantasma" (espacios al final, celdas combinadas vacías)
        if (esFilaFantasma(rawRow)) {
          filasFantasmaOmitidas++;
          fantasmasEnHoja++;
          return; // Se descarta silenciosamente para no contaminar la base de datos
        }

        // B. Datos de identidad del servidor
        const nombres = String(rawRow['NOMBRES'] || '').trim();
        const apellido1 = String(rawRow['PRIMER APELLIDO'] || '').trim();
        const apellido2 = String(rawRow['SEGUNDO APELLIDO'] || '').trim();
        const nombreCompleto = [apellido1, apellido2, nombres].filter(Boolean).join(' ').trim() ||
          String(rawRow['NOMBRE COMPLETO'] || rawRow['FUNCIONARIO'] || '').trim();
        const cargo = extraerCargoExcel(rawRow);
        const dependencia = String(rawRow['DEPENDENCIA'] || rawRow['AREA'] || '').trim();

        const tieneDatosFuncionario = Boolean(nombreCompleto || cargo || dependencia);

        // C. Validación de la Cédula (Excel):
        // Durante la iteración, aplica .trim().toUpperCase(). Considera inválidos: null, undefined, "", "NAN", y "DESCONOCIDA".
        const valorCedulaCrudo = rawRow['NUMERO DE CEDULA'] ?? rawRow['NÚMERO DE CÉDULA'] ?? rawRow['NUMERO CEDULA'] ?? rawRow['CEDULA'] ?? rawRow['CÉDULA'] ?? rawRow['DOCUMENTO'] ?? rawRow['CC'];
        const evaluacion = evaluarCedula(valorCedulaCrudo, rawRow, rowNumber, sheetName);

        if (!evaluacion.esValida && !tieneDatosFuncionario) {
          filasFantasmaOmitidas++;
          fantasmasEnHoja++;
          return;
        }

        // D. Detección de Plaza Vacante y Asignación de Identificador (estrictamente por PRIMER APELLIDO = VACANTE)
        const esVacante = detectarVacante(rawRow);
        let cedulaFinal = null;
        let documentoPendiente = false;

        let nombreFinal = nombreCompleto;
        if (esVacante) {
          nombreFinal = `PLAZA VACANTE - ${cargo || 'CARGO POR DEFINIR'}`;
          cedulaFinal = null;
          documentoPendiente = false;
          totalVacantes++;
          vacantesEnHoja++;
        } else if (evaluacion.sinCedula || evaluacion.esProvisional || !evaluacion.cedulaLimpia) {
          cedulaFinal = generarCedulaProvisional(nombreFinal);
          documentoPendiente = true;
          totalProvisionales++;
          provisionalesEnHoja++;
        } else {
          cedulaFinal = evaluacion.cedulaLimpia;
          documentoPendiente = false;
        }

        // E. Inserción Masiva: Mapear registro (combinando cédula real, provisional y vacantes)
        try {
          const dto = mapRowToFuncionarioDTO(rawRow, rowNumber, sheetName, cedulaFinal, documentoPendiente, esVacante);
          registrosValidos.push(dto);
          validasEnHoja++;
        } catch (validationErr) {
          erroresEnHoja++;
          const mensajeError = validationErr.message || 'Error de validación en columnas de datos';
          filasConErrores.push({
            hoja: sheetName,
            fila: rowNumber,
            cedula: cedulaFinal || 'NO ASIGNADA',
            nombre: nombreFinal || 'NO REPORTADO',
            campo: validationErr.campo || 'DATOS_FILA',
            valor: validationErr.valor !== undefined ? validationErr.valor : (valorCedulaCrudo || 'N/A'),
            motivo: mensajeError,
            error: mensajeError,
            detalle: mensajeError
          });
        }
      });

      desglosePorHoja[sheetName] = {
        totalFilas: rawRows.length,
        registrosValidos: validasEnHoja,
        provisionales: provisionalesEnHoja,
        vacantes: vacantesEnHoja,
        filasConErrores: erroresEnHoja,
        filasFantasmaOmitidas: fantasmasEnHoja
      };
    }

    // Si ninguna hoja contenía datos útiles
    if (hojasProcesadas.length === 0 || (registrosValidos.length === 0 && filasConErrores.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'El archivo Excel no contiene filas de datos procesables (todas las hojas están vacías o son filas fantasma).'
      });
    }

    // 3. Procesamiento de Base de Datos:
    // Se ejecuta el UPSERT con todos los registros válidos y sincronización inteligente
    let resultadoBD = { insertados: 0, actualizados: 0, retirados: 0, vacantes: 0, vacantesDepuradas: 0, fallidos: 0, listaRetirados: [] };

    if (registrosValidos.length > 0) {
      const importService = new EmployeeImportService(pool);
      const options = {
        marcarRetirados: req.body?.marcarRetirados !== false && req.body?.marcarRetirados !== 'false' && req.body?.marcarRetirados !== '0',
        sincronizarVacantes: req.body?.sincronizarVacantes !== false && req.body?.sincronizarVacantes !== 'false' && req.body?.sincronizarVacantes !== '0',
        fechaRetiro: req.body?.fechaRetiro || new Date().toISOString().split('T')[0],
        motivoRetiro: req.body?.motivoRetiro || 'Corte oficial de planta'
      };
      const { resumen, errores: erroresBD, listaRetirados } = await importService.upsertBatch(registrosValidos, options);
      resultadoBD = resumen;
      resultadoBD.listaRetirados = listaRetirados || [];

      // Si se produjo algún fallo residual en BD por fila (ej. constraint o dato fuera de rango)
      if (erroresBD && erroresBD.length > 0) {
        for (const errBD of erroresBD) {
          filasConErrores.push({
            hoja: errBD.hoja || 'Principal',
            fila: errBD.fila,
            cedula: errBD.cedula || 'NO ASIGNADA',
            nombre: errBD.nombre || 'N/A',
            campo: errBD.campo || 'BASE_DE_DATOS',
            valor: errBD.valor || errBD.cedula || 'N/A',
            motivo: errBD.error,
            error: errBD.error,
            detalle: errBD.error
          });
        }
      }
    }

    // 4. Código de estado HTTP:
    const statusCode = filasConErrores.length > 0 && (resultadoBD.insertados > 0 || resultadoBD.actualizados > 0)
      ? 207
      : (registrosValidos.length === 0 && filasConErrores.length > 0 ? 422 : 200);

    const totalProcesadosExitosos = resultadoBD.insertados + resultadoBD.actualizados;
    const msgVacantes = totalVacantes > 0 ? ` (${totalVacantes} plazas vacantes registradas)` : '';
    const msgProvisionales = totalProvisionales > 0 ? ` (${totalProvisionales} con cédula provisional PROV-)` : '';
    const msgRetirados = resultadoBD.retirados > 0 ? `, ${resultadoBD.retirados} pasados a Histórico de Retirados` : '';
    const msgVacDep = resultadoBD.vacantesDepuradas > 0 ? `, ${resultadoBD.vacantesDepuradas} vacantes antiguas provistas` : '';

    return res.status(statusCode).json({
      success: totalProcesadosExitosos > 0 || (registrosValidos.length === 0 && filasConErrores.length === 0),
      mensaje: `Sincronización oficial de planta completada: ${resultadoBD.insertados} nuevos, ${resultadoBD.actualizados} actualizados${msgRetirados}${msgVacDep}${msgVacantes || msgProvisionales}, ${filasConErrores.length} fila(s) descartadas.`,
      archivo: req.file.originalname,
      estrategiaTransaccional: 'SAVEPOINT_POR_FILA_TOLERANTE_A_FALLOS',
      filasInsertadas: resultadoBD.insertados,
      filasActualizadas: resultadoBD.actualizados,
      filasRetiradas: resultadoBD.retirados || 0,
      filasRechazadas: filasConErrores,
      detalleRetirados: resultadoBD.listaRetirados || [],
      metadata: {
        totalHojas: hojasProcesadas.length,
        totalFilasLeidas,
        filasFantasmaOmitidas,
        totalRegistrosValidos: registrosValidos.length,
        totalProvisionales,
        totalVacantes,
        totalRetirados: resultadoBD.retirados || 0,
        totalVacantesDepuradas: resultadoBD.vacantesDepuradas || 0,
        totalSinCedula: totalProvisionales,
        totalErrores: filasConErrores.length,
        statusHttp: statusCode
      },
      reporte: {
        totalInsertados: resultadoBD.insertados,
        totalActualizados: resultadoBD.actualizados,
        totalRetirados: resultadoBD.retirados || 0,
        totalVacantesDepuradas: resultadoBD.vacantesDepuradas || 0,
        totalProvisionales,
        totalVacantes,
        totalSinCedula: totalProvisionales,
        totalFallidos: filasConErrores.length
      },
      resumen: {
        totalFilas: totalFilasLeidas,
        procesadosExitosos: totalProcesadosExitosos,
        insertados: resultadoBD.insertados,
        actualizados: resultadoBD.actualizados,
        retirados: resultadoBD.retirados || 0,
        vacantes: totalVacantes,
        vacantesDepuradas: resultadoBD.vacantesDepuradas || 0,
        provisionales: totalProvisionales,
        sinCedula: totalProvisionales,
        fallidos: filasConErrores.length,
        filasFantasmaOmitidas
      },
      hojasProcesadas,
      desglosePorHoja,
      filasConErrores,
      errores: filasConErrores
    });

  } catch (err) {
    console.error('[importarExcel] Error crítico:', err);
    return res.status(500).json({
      success: false,
      error: 'Error interno no controlado al procesar el archivo Excel: ' + err.message
    });
  }
}

module.exports = {
  uploadMiddleware,
  previsualizarExcel,
  importarExcel,
  detectarMapeoCargos
};
