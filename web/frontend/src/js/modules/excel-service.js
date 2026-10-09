/* ═══════════════════════════════════════════════════════════════════════════
   excel-service.js — Servicio Centralizado para Exportación e Importación
   Masiva de Archivos Excel (.xlsx / .xls)
   ═══════════════════════════════════════════════════════════════════════════ */

const ExcelService = (() => {

  /**
   * Exporta una lista de datos a un archivo Excel (.xlsx) conservando estructura,
   * formatos de fecha, moneda y anchos de columna adaptativos.
   */
  function exportToExcel(options = {}, legacyFilename = 'Talento360_Export') {
    if (typeof XLSX === 'undefined') {
      alert('La biblioteca de Excel (SheetJS) aún no se ha cargado. Por favor recarga la página.');
      return;
    }

    // Compatibilidad si se llama con (dataArray, filename)
    let filename = 'Talento360_Export';
    let sheetName = 'Datos';
    let columns = [];
    let data = [];

    if (Array.isArray(options)) {
      data = options;
      filename = legacyFilename || 'Talento360_Export';
    } else if (options && typeof options === 'object') {
      filename = options.filename || 'Talento360_Export';
      sheetName = options.sheetName || 'Datos';
      columns = options.columns || [];
      data = options.data || [];
    }

    if (!data || !data.length) {
      if (typeof Fx !== 'undefined' && Fx.play) Fx.play('toggle');
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('No hay registros disponibles para exportar con los filtros seleccionados.', 'warning');
      } else {
        alert('No hay registros disponibles para exportar con los filtros seleccionados.');
      }
      return;
    }

    // Transformar registros según las columnas o tomar directamente las llaves
    let rows;
    let colWidths;
    if (columns && columns.length > 0) {
      rows = data.map((item, idx) => {
        const row = {};
        columns.forEach(col => {
          let val = item[col.key];
          if (val === undefined && item[col.header] !== undefined) {
            val = item[col.header];
          }
          if (col.format && typeof col.format === 'function') {
            val = col.format(val, item, idx);
          } else if (val == null) {
            val = '';
          }
          row[col.header] = val;
        });
        return row;
      });

      colWidths = columns.map(col => {
        let maxLen = (col.header || '').length;
        rows.forEach(r => {
          const valStr = String(r[col.header] || '');
          if (valStr.length > maxLen) maxLen = Math.min(valStr.length, 45);
        });
        return { wch: Math.max(col.width || 12, maxLen + 3) };
      });
    } else {
      rows = data;
      const allKeys = Object.keys(rows[0] || {});
      colWidths = allKeys.map(k => {
        let maxLen = k.length;
        rows.forEach(r => {
          const valStr = String(r[k] || '');
          if (valStr.length > maxLen) maxLen = Math.min(valStr.length, 45);
        });
        return { wch: Math.max(12, maxLen + 3) };
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = colWidths;
    ws['!rows'] = [{ hpt: 30.75, customHeight: true }];

    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

    const fullFilename = `${filename}_${new Date().toISOString().split('T')[0]}`;
    saveWorkbookWithHeaderStyle(wb, fullFilename);

    if (typeof Fx !== 'undefined' && Fx.play) Fx.play('success');
  }

  /**
   * Guarda un archivo Excel aplicando estilos profesionales a la fila de encabezados:
   * altura de 41 píxeles (30.75 pt), texto en negrita y centrado vertical y horizontal.
   */
  function saveWorkbookWithHeaderStyle(wb, filename) {
    try {
      if (typeof XLSX.CFB !== 'undefined' && XLSX.CFB.read && XLSX.CFB.write && XLSX.CFB.find) {
        const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
        const cfb = XLSX.CFB.read(bin, { type: 'binary' });

        // 1. Modificar xl/styles.xml para asegurar fuente negrita y centrado
        const stylesEntry = XLSX.CFB.find(cfb, 'Root Entry/xl/styles.xml');
        if (stylesEntry && stylesEntry.content) {
          let stylesXml = typeof stylesEntry.content === 'string'
            ? stylesEntry.content
            : (typeof TextDecoder !== 'undefined'
                ? new TextDecoder('utf-8').decode(stylesEntry.content)
                : String.fromCharCode.apply(null, stylesEntry.content));

          if (stylesXml.includes('<fonts count="1">')) {
            stylesXml = stylesXml.replace(
              '<fonts count="1"><font><sz val="12"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>',
              '<fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>'
            );
          } else if (!stylesXml.includes('<b/>')) {
            stylesXml = stylesXml.replace('</fonts>', '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>');
            stylesXml = stylesXml.replace(/<fonts count="(\d+)">/, (m, c) => `<fonts count="${parseInt(c, 10) + 1}">`);
          }

          if (stylesXml.includes('<cellXfs count="1">')) {
            stylesXml = stylesXml.replace(
              '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>',
              '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs>'
            );
          } else if (!stylesXml.includes('applyAlignment="1"')) {
            stylesXml = stylesXml.replace('</cellXfs>', '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs>');
            stylesXml = stylesXml.replace(/<cellXfs count="(\d+)">/, (m, c) => `<cellXfs count="${parseInt(c, 10) + 1}">`);
          }

          stylesEntry.content = typeof TextEncoder !== 'undefined'
            ? new TextEncoder().encode(stylesXml)
            : stylesXml;
        }

        // 2. Modificar xl/worksheets/sheet1.xml para aplicar estilo s="1" y altura 41px (30.75pt) a la fila 1
        const sheetEntry = XLSX.CFB.find(cfb, 'Root Entry/xl/worksheets/sheet1.xml');
        if (sheetEntry && sheetEntry.content) {
          let sheetXml = typeof sheetEntry.content === 'string'
            ? sheetEntry.content
            : (typeof TextDecoder !== 'undefined'
                ? new TextDecoder('utf-8').decode(sheetEntry.content)
                : String.fromCharCode.apply(null, sheetEntry.content));

          // Asegurar que la fila 1 de títulos tenga exactamente 41 píxeles de alto en Excel (30.75 pt)
          if (sheetXml.includes('<row r="1"')) {
            if (sheetXml.includes('ht="')) {
              sheetXml = sheetXml.replace(/(<row r="1"[^>]*\bht=")[^"]+(")/, '$130.75$2');
            } else {
              sheetXml = sheetXml.replace(/(<row r="1")(?=[ >])/, '$1 ht="30.75" customHeight="1"');
            }
          }

          sheetXml = sheetXml.replace(/(<c r="[A-Z]+1")(\s*\/?>|\s+[^>]*>)/g, (match, prefix, suffix) => {
            if (prefix.includes(' s="') || suffix.includes(' s="')) return match;
            return `${prefix} s="1"${suffix}`;
          });

          sheetEntry.content = typeof TextEncoder !== 'undefined'
            ? new TextEncoder().encode(sheetXml)
            : sheetXml;
        }

        const finalBin = XLSX.CFB.write(cfb, { fileType: 'zip', type: 'binary' });

        if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
          const buf = new ArrayBuffer(finalBin.length);
          const view = new Uint8Array(buf);
          for (let i = 0; i < finalBin.length; i++) view[i] = finalBin.charCodeAt(i) & 0xFF;
          const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.download = `${filename}.xlsx`;
          a.href = url;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          return;
        }
      }
    } catch (err) {
      console.warn('[ExcelService] Estilizado avanzado no disponible, usando fallback estándar:', err);
    }

    // Fallback estándar
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  /**
   * Genera y descarga una plantilla oficial de Excel con ejemplos y cabeceras exactas.
   * Aplica: fila 1 con altura de 41 píxeles (30.75 pt), texto en mayúscula sostenida,
   * negrita y centrado (horizontal y vertical), y autofiltro de tabla.
   */
  function downloadTemplate({ filename = 'Plantilla', sheetName = 'Plantilla', columns = [], sampleRows = [] }) {
    if (typeof XLSX === 'undefined') {
      alert('La biblioteca de Excel aún no está disponible.');
      return;
    }

    // Cabeceras en mayúscula sostenida
    const headers = columns.map(col => String(col.header || col.key || '').toUpperCase());

    // Fila 1 de encabezados (una sola fila)
    const aoa = [headers];

    if (sampleRows && sampleRows.length > 0) {
      sampleRows.forEach(row => {
        if (Array.isArray(row)) {
          aoa.push(row);
        } else if (typeof row === 'object') {
          aoa.push(columns.map(col => row[col.header] ?? row[col.key] ?? ''));
        }
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Altura de la fila de títulos fijada exactamente a 41 píxeles (30.75 pt)
    ws['!rows'] = [
      { hpt: 30.75, customHeight: true }
    ];

    // Formato de tabla: autofiltro activo en la fila de títulos
    const lastRowIdx = Math.max(0, aoa.length - 1);
    const tableRange = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: lastRowIdx, c: headers.length - 1 }
    });
    ws['!autofilter'] = { ref: tableRange };

    // Estilos de celda para motores compatibles
    const headerStyle = {
      font: { bold: true, sz: 11, name: 'Calibri' },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'medium', color: { rgb: '334155' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } }
      }
    };

    for (let c = 0; c < headers.length; c++) {
      const c0 = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[c0]) ws[c0].s = headerStyle;
    }

    const colWidths = columns.map(col => ({
      wch: Math.max((col.header || '').length + 4, col.width || 18)
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
    saveWorkbookWithHeaderStyle(wb, filename);

    if (typeof Fx !== 'undefined' && Fx.play) Fx.play('toggle');
  }

  /**
   * Abre un modal de carga masiva con drag & drop, previsualización en tiempo real,
   * conteo de registros válidos y con errores, y envío al backend.
   */
  function openImportModal({
    title = 'Carga Masiva de Archivo Excel',
    subtitle = 'Seleccione o arrastre un archivo Excel (.xlsx o .xls) con la estructura solicitada',
    moduleName = 'registros',
    columns = [],
    sampleRows = [],
    validateRow,
    onImport
  }) {
    if (typeof XLSX === 'undefined') {
      alert('La biblioteca de Excel (SheetJS) aún no se ha cargado.');
      return;
    }

    // Cerrar modal anterior si existe
    const existing = document.getElementById('excel-import-modal-overlay');
    if (existing) existing.remove();

    let parsedData = [];
    let validRows = [];
    let invalidRows = [];

    const overlay = document.createElement('div');
    overlay.id = 'excel-import-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box excel-modal-card" style="max-width: 820px; width: 95%;">
        <div class="modal-header">
          <div class="modal-header-info">
            <h2 class="modal-title" style="display:flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-green-dark)" stroke-width="2" style="width:24px; height:24px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              ${title}
            </h2>
            <p class="modal-desc">${subtitle}</p>
          </div>
          <button class="modal-close" id="btn-close-excel-modal">&times;</button>
        </div>

        <div class="modal-body" style="padding: 20px 24px; max-height: 70vh; overflow-y: auto;">
          <!-- Paso 1: Descargar Plantilla -->
          <div class="excel-step-banner">
            <div class="excel-step-text">
              <strong>¿No tienes el formato adecuado?</strong>
              <p>Descarga la plantilla modelo con los encabezados requeridos y ejemplos pre-llenados.</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-download-excel-template" style="display:inline-flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Descargar Plantilla Oficial
            </button>
          </div>

          <!-- Paso 2: Zona Drag & Drop -->
          <div class="excel-dropzone" id="excel-dropzone">
            <input type="file" id="excel-file-input" accept=".xlsx, .xls" style="display:none;" />
            <div class="excel-dropzone-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-green-bright)" stroke-width="2" style="width:42px;height:42px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <p class="excel-dropzone-title">Arrastra y suelta tu archivo Excel aquí</p>
            <p class="excel-dropzone-sub">o haz clic para examinar desde tu equipo (.xlsx, .xls)</p>
            <div id="excel-file-info" class="excel-file-info" style="display:none;"></div>
          </div>

          <!-- Paso 3: Resumen y Previsualización -->
          <div id="excel-preview-section" style="display:none; margin-top: 20px;">
            <div class="excel-preview-stats">
              <span class="badge badge--info" id="badge-total-rows">0 registros detectados</span>
              <span class="badge badge--aprobada" id="badge-valid-rows">0 válidos</span>
              <span class="badge badge--rechazada" id="badge-invalid-rows" style="display:none;">0 con errores</span>
            </div>

            <div class="table-wrap" style="margin-top: 12px; max-height: 260px; overflow-y: auto;">
              <table class="table-preview" id="excel-preview-table">
                <thead>
                  <tr id="excel-preview-thead"></tr>
                </thead>
                <tbody id="excel-preview-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="padding: 16px 24px; display:flex; justify-content:flex-end; gap:12px; border-top: 1px solid var(--color-border);">
          <button type="button" class="btn btn-secondary" id="btn-cancel-excel-modal">Cancelar</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-excel-import" disabled style="display:inline-flex; align-items:center; gap:8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span id="btn-confirm-text">Confirmar e Importar</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Elementos del modal
    const closeBtn = overlay.querySelector('#btn-close-excel-modal');
    const cancelBtn = overlay.querySelector('#btn-cancel-excel-modal');
    const downloadTemplateBtn = overlay.querySelector('#btn-download-excel-template');
    const dropzone = overlay.querySelector('#excel-dropzone');
    const fileInput = overlay.querySelector('#excel-file-input');
    const fileInfo = overlay.querySelector('#excel-file-info');
    const previewSection = overlay.querySelector('#excel-preview-section');
    const thead = overlay.querySelector('#excel-preview-thead');
    const tbody = overlay.querySelector('#excel-preview-tbody');
    const badgeTotal = overlay.querySelector('#badge-total-rows');
    const badgeValid = overlay.querySelector('#badge-valid-rows');
    const badgeInvalid = overlay.querySelector('#badge-invalid-rows');
    const confirmBtn = overlay.querySelector('#btn-confirm-excel-import');
    const confirmText = overlay.querySelector('#btn-confirm-text');

    const closeModal = () => {
      overlay.remove();
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Descarga de plantilla
    downloadTemplateBtn.addEventListener('click', () => {
      downloadTemplate({
        filename: `Plantilla_${moduleName.replace(/\s+/g, '_')}`,
        sheetName: moduleName,
        columns,
        sampleRows
      });
    });

    // Drag & Drop handlers
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('excel-dropzone-dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('excel-dropzone-dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('excel-dropzone-dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length) {
        handleFile(e.target.files[0]);
      }
    });

    // Procesar archivo
    function handleFile(file) {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        alert('Por favor seleccione un archivo Excel válido (.xlsx o .xls).');
        return;
      }

      fileInfo.style.display = 'block';
      fileInfo.textContent = `Archivo cargado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          if (!workbook.SheetNames || !workbook.SheetNames.length) {
            alert('El archivo Excel no contiene hojas de cálculo.');
            return;
          }
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          if (!worksheet) {
            alert('No se pudo acceder a la hoja principal del archivo Excel.');
            return;
          }

          // Detectar automáticamente la fila de encabezados reales (evita confundir títulos o banners superiores)
          const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          let headerRowIndex = 0;
          for (let r = 0; r < Math.min(15, rawMatrix.length); r++) {
            const rowVals = (rawMatrix[r] || []).map(v => String(v).toLowerCase().trim());
            const matches = rowVals.filter(v =>
              v.includes('nombre') || v.includes('identifica') || v.includes('cedula') ||
              v.includes('cargo') || v.includes('dependencia') || v.includes('situaci') ||
              v.includes('documento') || v.includes('codigo') || v.includes('grado') ||
              v.includes('secretaria') || v.includes('teletrabajo') || v.includes('modalidad') ||
              v === 'no.' || v === 'no' || v === 'item' || v === 'n°'
            );
            if (matches.length >= 2) {
              headerRowIndex = r;
              break;
            }
          }

          parsedData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: '' });

          // Filtrar filas completamente vacías
          parsedData = (parsedData || []).filter(row =>
            Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '')
          );

          if (!parsedData || !parsedData.length) {
            alert('El archivo no contiene filas de datos o está vacío.');
            return;
          }

          processAndPreview(parsedData);
        } catch (err) {
          console.error('[ExcelService] error parsing file:', err);
          alert('Ocurrió un error al leer el archivo Excel: ' + (err.message || 'Verifica que no esté corrupto o protegido con contraseña.'));
        }
      };
      reader.readAsArrayBuffer(file);
    }

    // Validar y previsualizar
    function processAndPreview(rows) {
      validRows = [];
      invalidRows = [];

      rows.forEach((row, index) => {
        const validation = validateRow ? validateRow(row, index) : { valid: true, cleanRow: row };
        if (validation.valid) {
          validRows.push({ ...validation.cleanRow, _rowIndex: index + 1 });
        } else {
          invalidRows.push({ row, _rowIndex: index + 1, error: validation.error || 'Datos incompletos o inválidos' });
        }
      });

      // Actualizar badges
      badgeTotal.textContent = `${rows.length} registros detectados`;
      badgeValid.textContent = `${validRows.length} válidos`;

      if (invalidRows.length > 0) {
        badgeInvalid.style.display = 'inline-flex';
        badgeInvalid.textContent = `${invalidRows.length} con errores`;
      } else {
        badgeInvalid.style.display = 'none';
      }

      // Renderizar tabla de previsualización
      thead.innerHTML = `
        <th style="width: 50px;">Fila</th>
        <th style="width: 90px;">Estado</th>
        ${columns.map(c => `<th>${c.header}</th>`).join('')}
      `;

      tbody.innerHTML = '';
      const displayRows = [...validRows.map(r => ({ ...r, _status: 'ok' })), ...invalidRows.map(r => ({ ...r.row, _rowIndex: r._rowIndex, _status: 'error', _msg: r.error }))].slice(0, 15);

      displayRows.forEach(item => {
        const tr = document.createElement('tr');
        if (item._status === 'error') tr.className = 'excel-row-error';

        let statusBadge = item._status === 'ok'
          ? `<span class="badge badge--aprobada" style="font-size:10px; padding:2px 6px;">Válido</span>`
          : `<span class="badge badge--rechazada" style="font-size:10px; padding:2px 6px;" title="${item._msg || ''}">Error</span>`;

        tr.innerHTML = `
          <td><strong>#${item._rowIndex}</strong></td>
          <td>${statusBadge}</td>
          ${columns.map(col => {
            const val = item[col.key] || item[col.header] || '';
            return `<td>${String(val).substring(0, 35)}</td>`;
          }).join('')}
        `;
        tbody.appendChild(tr);
      });

      if (rows.length > 15) {
        const trMore = document.createElement('tr');
        trMore.innerHTML = `<td colspan="${columns.length + 2}" style="text-align:center; color:var(--color-slate); font-size:12px; padding:8px;">... y ${rows.length - 15} registros más en el archivo.</td>`;
        tbody.appendChild(trMore);
      }

      previewSection.style.display = 'block';

      if (validRows.length > 0) {
        confirmBtn.disabled = false;
        confirmText.textContent = `Importar ${validRows.length} ${moduleName}`;
      } else {
        confirmBtn.disabled = true;
        confirmText.textContent = 'Sin registros válidos para importar';
      }
    }

    // Acción de confirmación
    confirmBtn.addEventListener('click', async () => {
      if (!validRows.length) return;

      confirmBtn.disabled = true;
      confirmText.textContent = 'Procesando carga...';

      try {
        await onImport(validRows);
        if (typeof Fx !== 'undefined' && Fx.play) Fx.play('success');
        closeModal();
      } catch (err) {
        console.error('[ExcelService] import error:', err);
        alert(`Error al importar: ${err.message || 'Error de conexión.'}`);
        confirmBtn.disabled = false;
        confirmText.textContent = `Reintentar importación (${validRows.length})`;
      }
    });
  }

  return {
    exportToExcel,
    downloadTemplate,
    openImportModal
  };

})();
