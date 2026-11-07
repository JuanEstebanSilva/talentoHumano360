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
      colEncargo: 0,
      colEncargoCod: 1,
      colEncargoGra: 2,
      colEncargoAsig: 3,
      colDep: 4,
      colCargoTitular: 5,
      colCodTitular: 6,
      colGraTitular: 7,
      colCargoNominal: 5,
      colCodNominal: 6,
      colGraNominal: 7,
      colCargoActual: 5,
      colCodActual: 6,
      colGraActual: 7
    };
  }
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  let colEncargo = null;
  let colEncargoCod = null;
  let colEncargoGra = null;
  let colEncargoAsig = null;
  let colDep = null;
  let colCargoTitular = null;
  let colCodTitular = null;
  let colGraTitular = null;

  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
    const val = String(cell?.v || '').trim().toUpperCase();

    if (val.includes('DENOMINAC') && val.includes('ENCARGO')) {
      colEncargo = C;
    } else if (val.includes('DENOMINAC') && !val.includes('ENCARGO')) {
      colCargoTitular = C;
    } else if (val.includes('ASIGNAC')) {
      colEncargoAsig = C;
    } else if (val.includes('DEPEN')) {
      colDep = C;
    }
  }

  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
    const val = String(cell?.v || '').trim().toUpperCase();

    if (val.startsWith('COD') || val.includes('CÓDIGO') || val.includes('CODIGO')) {
      if (colDep !== null && C < colDep) {
        if (colEncargoCod === null) colEncargoCod = C;
      } else if (colDep !== null && C > colDep) {
        if (colCodTitular === null) colCodTitular = C;
      } else {
        if (colEncargoCod === null) colEncargoCod = C;
        else if (colCodTitular === null) colCodTitular = C;
      }
    }

    if (val.startsWith('GRA') || val.includes('GRADO')) {
      if (colDep !== null && C < colDep) {
        if (colEncargoGra === null) colEncargoGra = C;
      } else if (colDep !== null && C > colDep) {
        if (colGraTitular === null) colGraTitular = C;
      } else {
        if (colEncargoGra === null) colEncargoGra = C;
        else if (colGraTitular === null) colGraTitular = C;
      }
    }
  }

  return {
    colEncargo: colEncargo !== null ? colEncargo : 0,
    colEncargoCod: colEncargoCod !== null ? colEncargoCod : 1,
    colEncargoGra: colEncargoGra !== null ? colEncargoGra : 2,
    colEncargoAsig: colEncargoAsig !== null ? colEncargoAsig : 3,
    colDep: colDep !== null ? colDep : 4,
    colCargoTitular: colCargoTitular !== null ? colCargoTitular : 5,
    colCodTitular: colCodTitular !== null ? colCodTitular : 6,
    colGraTitular: colGraTitular !== null ? colGraTitular : 7,
    colCargoNominal: colCargoTitular !== null ? colCargoTitular : 5,
    colCodNominal: colCodTitular !== null ? colCodTitular : 6,
    colGraNominal: colGraTitular !== null ? colGraTitular : 7,
    colCargoActual: colCargoTitular !== null ? colCargoTitular : 5,
    colCodActual: colCodTitular !== null ? colCodTitular : 6,
    colGraActual: colGraTitular !== null ? colGraTitular : 7
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

        const cellEncargo = getCellVal(colMap.colEncargo);
        const cellEncargoCod = getCellVal(colMap.colEncargoCod);
        const cellEncargoGra = getCellVal(colMap.colEncargoGra);
        const cellEncargoAsig = getCellVal(colMap.colEncargoAsig);
        const cellCargoTitular = getCellVal(colMap.colCargoTitular);
        const cellCodTitular = getCellVal(colMap.colCodTitular);
        const cellGraTitular = getCellVal(colMap.colGraTitular);
        const cellDep = getCellVal(colMap.colDep);

        if (cellEncargo) rawRow['__ENCARGO_DENOMINACION__'] = cellEncargo;
        if (cellEncargoCod) rawRow['__ENCARGO_CODIGO__'] = cellEncargoCod;
        if (cellEncargoGra) rawRow['__ENCARGO_GRADO__'] = cellEncargoGra;
        if (cellEncargoAsig) rawRow['__ENCARGO_ASIGNACION__'] = cellEncargoAsig;

        if (cellCargoTitular) {
          rawRow['__CARGO_TITULAR__'] = cellCargoTitular;
          rawRow['__CARGO_ACTUAL__'] = cellCargoTitular;
          rawRow['__CARGO_NOMINAL__'] = cellCargoTitular;
        }
        if (cellCodTitular) {
          rawRow['__CODIGO_TITULAR__'] = cellCodTitular;
          rawRow['__CODIGO_ACTUAL__'] = cellCodTitular;
          rawRow['__CODIGO_NOMINAL__'] = cellCodTitular;
        }
        if (cellGraTitular) {
          rawRow['__GRADO_TITULAR__'] = cellGraTitular;
          rawRow['__GRADO_ACTUAL__'] = cellGraTitular;
          rawRow['__GRADO_NOMINAL__'] = cellGraTitular;
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
    // Se ejecuta el UPSERT con todos los registros válidos (los sin cédula se guardan con cedula=NULL)
    let resultadoBD = { insertados: 0, actualizados: 0, fallidos: 0 };

    if (registrosValidos.length > 0) {
      const importService = new EmployeeImportService(pool);
      const { resumen, errores: erroresBD } = await importService.upsertBatch(registrosValidos);
      resultadoBD = resumen;

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

    return res.status(statusCode).json({
      success: totalProcesadosExitosos > 0 || (registrosValidos.length === 0 && filasConErrores.length === 0),
      mensaje: `Procesamiento completado: ${resultadoBD.insertados} nuevos (Insert), ${resultadoBD.actualizados} actualizados (Update)${msgVacantes || msgProvisionales}, ${filasConErrores.length} fila(s) descartadas.`,
      archivo: req.file.originalname,
      estrategiaTransaccional: 'SAVEPOINT_POR_FILA_TOLERANTE_A_FALLOS',
      filasInsertadas: resultadoBD.insertados,
      filasActualizadas: resultadoBD.actualizados,
      filasRechazadas: filasConErrores,
      metadata: {
        totalHojas: hojasProcesadas.length,
        totalFilasLeidas,
        filasFantasmaOmitidas,
        totalRegistrosValidos: registrosValidos.length,
        totalProvisionales,
        totalVacantes,
        totalSinCedula: totalProvisionales,
        totalErrores: filasConErrores.length,
        statusHttp: statusCode
      },
      reporte: {
        totalInsertados: resultadoBD.insertados,
        totalActualizados: resultadoBD.actualizados,
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
        provisionales: totalProvisionales,
        vacantes: totalVacantes,
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
  importarExcel
};
