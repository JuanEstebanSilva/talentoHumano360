/* ═══════════════════════════════════════════════════════════════════════════
   report-generator.js — Sistema Unificado de Generación de Reportes (PDF/Excel
   con 7 Criterios A-G), Historial de Auditoría Inmutable, Gestión de Formatos
   Institucionales con Versionamiento y Administración de Responsables RBAC.
   Gobernación de Boyacá · Talento Humano 360
   ═══════════════════════════════════════════════════════════════════════════ */

const GovernanceAndReports = (() => {
  const MESES = [
    { num: 1,  nombre: 'Enero' },
    { num: 2,  nombre: 'Febrero' },
    { num: 3,  nombre: 'Marzo' },
    { num: 4,  nombre: 'Abril' },
    { num: 5,  nombre: 'Mayo' },
    { num: 6,  nombre: 'Junio' },
    { num: 7,  nombre: 'Julio' },
    { num: 8,  nombre: 'Agosto' },
    { num: 9,  nombre: 'Septiembre' },
    { num: 10, nombre: 'Octubre' },
    { num: 11, nombre: 'Noviembre' },
    { num: 12, nombre: 'Diciembre' },
  ];

  const MODULO_LABELS = {
    permisos:         'Permisos Laborales',
    licencias:        'Licencias Laborales',
    incapacidades:    'Incapacidades y Ausentismo SST (E-DO-ST-F-002 V2)',
    epidemiologico:   'Perfil Epidemiológico y EMO (E-DO-ST-F-024 V3)',
    sociodemografico: 'Perfil Sociodemográfico (E-DO-ST-F-011 V5)',
    epp:              'Entrega de Elementos de Protección Personal - EPP (E-DO-ST-F-028 V4)',
  };

  function serviceForModulo(modulo) {
    if (['epidemiologico', 'sociodemografico', 'epp'].includes(modulo)) return 'sst';
    return 'admin-requests';
  }

  function parseRecordDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(s);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatBytes(b) {
    const n = Number(b) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
      reader.readAsDataURL(file);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. GENERADOR DE REPORTES EN PDF Y EXCEL CON 7 CRITERIOS (SECCIÓN 9.4)
  //    Habilitado para: Incapacidades, Epidemiológico, Sociodemográfico y EPP
  // ═══════════════════════════════════════════════════════════════════════════

  function openReportGeneratorModal(opts = {}) {
    const {
      modulo: rawModulo,
      moduleCode,
      moduleName,
      title: rawTitle,
      codigoFormato = 'SG-SST',
      records = [],
      allRecords = [],
      currentData = [],
      filteredRecords = [],
      selectedIds = [],
      selectedRecords = [],
      columns = [],
      pdfColumns = null,
      dateField = 'fechaInicio',
      idField = 'id',
      labelFn = null,
      filenamePrefix: rawFilenamePrefix,
      filenameBase,
      sheetName = 'Reporte',
      buildSummaryFn = null,
      fetchAllFn = null,
    } = opts;
    const modulo = rawModulo || moduleCode || 'sst';
    const title = rawTitle || moduleName || 'Generación de Reportes Institucionales (PDF y Excel)';
    const filenamePrefix = rawFilenamePrefix || filenameBase || 'Reporte_SST';
    const existing = document.getElementById('gov-report-modal-overlay');
    if (existing) existing.remove();

    const baseRecords = Array.isArray(records) && records.length
      ? records
      : (Array.isArray(allRecords) && allRecords.length ? allRecords : (Array.isArray(currentData) ? currentData : []));
    let allRows = baseRecords;
    const currentFiltered = Array.isArray(filteredRecords) && filteredRecords.length ? filteredRecords : allRows;
    const selList = (Array.isArray(selectedIds) && selectedIds.length)
      ? selectedIds
      : (Array.isArray(selectedRecords) ? selectedRecords.map(r => r && r[idField] != null ? r[idField] : r) : []);
    const selectedSet = new Set((selList || []).map(x => String(x)));
    const curYear = new Date().getFullYear();
    const curMonth = new Date().getMonth() + 1;

    if ((!allRows || !allRows.length) && typeof fetchAllFn === 'function') {
      Promise.resolve(fetchAllFn()).then(fetched => {
        if (Array.isArray(fetched) && fetched.length) {
          allRows = fetched;
          if (typeof updateUI === 'function') updateUI();
        }
      }).catch(() => {});
    }

    const getRowLabel = (r, idx) => {
      if (typeof labelFn === 'function') return labelFn(r, idx);
      const rad = r.radicado || `#${r[idField] || idx + 1}`;
      const nom = r.nombreCompleto || r.persona || r.apellidosNombres || 'Servidor';
      const doc = r.documento || '';
      return `${rad} — ${nom} (${doc})`;
    };

    const overlay = document.createElement('div');
    overlay.id = 'gov-report-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width: 820px; width: 96%;">
        <div class="modal-header" style="background: linear-gradient(135deg, #0f291e 0%, #1b4332 100%); color:#fff; border-radius:16px 16px 0 0;">
          <div class="modal-header-info">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="background:rgba(255,255,255,0.16); padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:0.04em;">
                ${escHtml(codigoFormato)}
              </span>
              <span style="font-size:12px; opacity:0.85;">Gobernación de Boyacá · Subdirección SST y Talento Humano</span>
            </div>
            <h2 class="modal-title" style="color:#fff; margin-top:6px;">${escHtml(title)}</h2>
            <p class="modal-desc" style="color:rgba(255,255,255,0.82);">
              Seleccione el criterio de alcance (A–G) y el formato de salida (Reporte Ejecutivo PDF o Plantilla Oficial Excel .xlsx)
            </p>
          </div>
          <button class="modal-close" id="btn-close-gov-report" style="color:#fff;">&times;</button>
        </div>

        <div class="modal-body" style="padding:20px 24px; max-height:74vh; overflow-y:auto;">
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-weight:700; color:#0f172a; margin-bottom:8px; display:block;">
              1. Seleccione el Criterio de Generación del Reporte
            </label>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap:10px;" id="report-criteria-grid">
              <label class="report-crit-card" data-crit="G" style="display:flex; align-items:flex-start; gap:10px; padding:11px 12px; border:2px solid #16a34a; background:#f0fdf4; border-radius:10px; cursor:pointer;">
                <input type="radio" name="rep_criterio" value="G" checked style="margin-top:3px;" />
                <div>
                  <div style="font-weight:700; font-size:13px; color:#0f172a;">G. Filtros Aplicados Actuales</div>
                  <div style="font-size:11.5px; color:#475569;">Exporta los <strong>${currentFiltered.length}</strong> registros filtrados en pantalla.</div>
                </div>
              </label>

              <label class="report-crit-card" data-crit="B" style="display:flex; align-items:flex-start; gap:10px; padding:11px 12px; border:1px solid #cbd5e1; background:#fff; border-radius:10px; cursor:pointer;">
                <input type="radio" name="rep_criterio" value="B" ${selectedSet.size > 0 ? 'checked' : ''} style="margin-top:3px;" />
                <div>
                  <div style="font-weight:700; font-size:13px; color:#0f172a;">B. Registros Seleccionados</div>
                  <div style="font-size:11.5px; color:#475569;">Filas marcadas con casilla en la tabla (<strong>${selectedSet.size}</strong> seleccionados).</div>
                </div>
              </label>

              <label class="report-crit-card" data-crit="A" style="display:flex; align-items:flex-start; gap:10px; padding:11px 12px; border:1px solid #cbd5e1; background:#fff; border-radius:10px; cursor:pointer;">
                <input type="radio" name="rep_criterio" value="A" style="margin-top:3px;" />
                <div>
                  <div style="font-weight:700; font-size:13px; color:#0f172a;">A. Reporte Individual</div>
                  <div style="font-size:11.5px; color:#475569;">Genera el reporte detallado de un (1) registro específico.</div>
                </div>
              </label>

              <label class="report-crit-card" data-crit="C" style="display:flex; align-items:flex-start; gap:10px; padding:11px 12px; border:1px solid #cbd5e1; background:#fff; border-radius:10px; cursor:pointer;">
                <input type="radio" name="rep_criterio" value="C" style="margin-top:3px;" />
                <div>
                  <div style="font-weight:700; font-size:13px; color:#0f172a;">C. Periodo Personalizado</div>
                  <div style="font-size:11.5px; color:#475569;">Rango exacto entre fecha inicial y fecha final.</div>
                </div>
              </label>

              <label class="report-crit-card" data-crit="D" style="display:flex; align-items:flex-start; gap:10px; padding:11px 12px; border:1px solid #cbd5e1; background:#fff; border-radius:10px; cursor:pointer;">
                <input type="radio" name="rep_criterio" value="D" style="margin-top:3px;" />
                <div>
                  <div style="font-weight:700; font-size:13px; color:#0f172a;">D. Mes Específico</div>
                  <div style="font-size:11.5px; color:#475569;">Registros correspondientes a un mes y año.</div>
                </div>
              </label>

              <label class="report-crit-card" data-crit="E" style="display:flex; align-items:flex-start; gap:10px; padding:11px 12px; border:1px solid #cbd5e1; background:#fff; border-radius:10px; cursor:pointer;">
                <input type="radio" name="rep_criterio" value="E" style="margin-top:3px;" />
                <div>
                  <div style="font-weight:700; font-size:13px; color:#0f172a;">E. Varios Meses</div>
                  <div style="font-size:11.5px; color:#475569;">Consolidado comparativo de múltiples meses.</div>
                </div>
              </label>

              <label class="report-crit-card" data-crit="F" style="display:flex; align-items:flex-start; gap:10px; padding:11px 12px; border:1px solid #cbd5e1; background:#fff; border-radius:10px; cursor:pointer;">
                <input type="radio" name="rep_criterio" value="F" style="margin-top:3px;" />
                <div>
                  <div style="font-weight:700; font-size:13px; color:#0f172a;">F. Reporte Anual</div>
                  <div style="font-size:11.5px; color:#475569;">Consolidado completo de un año de vigencia.</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Paneles dinámicos según criterio -->
          <div id="crit-panel-A" class="crit-config-panel" style="display:none; padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;">Seleccione el registro individual:</label>
            <select id="rep-select-individual" class="form-select" style="width:100%; margin-top:6px;">
              ${allRows.map((r, i) => `<option value="${escHtml(String(r[idField] ?? i))}">${escHtml(getRowLabel(r, i))}</option>`).join('')}
            </select>
          </div>

          <div id="crit-panel-C" class="crit-config-panel" style="display:none; padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:14px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label class="form-label" style="font-weight:600;">Fecha Inicial</label>
                <input type="date" id="rep-date-start" class="form-input" value="${curYear}-01-01" />
              </div>
              <div>
                <label class="form-label" style="font-weight:600;">Fecha Final</label>
                <input type="date" id="rep-date-end" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
              </div>
            </div>
          </div>

          <div id="crit-panel-D" class="crit-config-panel" style="display:none; padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:14px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label class="form-label" style="font-weight:600;">Mes</label>
                <select id="rep-single-month" class="form-select">
                  ${MESES.map(m => `<option value="${m.num}" ${m.num === curMonth ? 'selected' : ''}>${m.nombre}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label" style="font-weight:600;">Año</label>
                <input type="number" id="rep-single-month-year" class="form-input" value="${curYear}" min="2020" max="2035" />
              </div>
            </div>
          </div>

          <div id="crit-panel-E" class="crit-config-panel" style="display:none; padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label class="form-label" style="font-weight:600; margin:0;">Seleccione los meses a incluir:</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px; color:#475569;">Año:</span>
                <input type="number" id="rep-multi-month-year" class="form-input" value="${curYear}" min="2020" max="2035" style="width:95px; padding:4px 8px;" />
              </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
              ${MESES.map(m => `
                <label style="display:flex; align-items:center; gap:6px; font-size:12.5px; background:#fff; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer;">
                  <input type="checkbox" class="rep-multi-month-cb" value="${m.num}" ${m.num <= curMonth ? 'checked' : ''} />
                  ${m.nombre}
                </label>
              `).join('')}
            </div>
          </div>

          <div id="crit-panel-F" class="crit-config-panel" style="display:none; padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;">Seleccione el Año del Reporte Anual:</label>
            <input type="number" id="rep-annual-year" class="form-input" value="${curYear}" min="2020" max="2035" style="max-width:200px; margin-top:6px;" />
          </div>

          <!-- Resumen de coincidencia en tiempo real -->
          <div id="rep-match-banner" style="padding:12px 16px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <strong id="rep-match-count" style="color:#166534; font-size:14px;">0 registros listos para exportar</strong>
              <div id="rep-match-desc" style="font-size:12px; color:#15803d;">Criterio seleccionado</div>
            </div>
            <span class="badge badge--aprobada" id="rep-format-badge">${escHtml(codigoFormato)}</span>
          </div>
        </div>

        <div class="modal-footer" style="padding:16px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-top:1px solid var(--color-border);">
          <button type="button" class="btn btn-secondary" id="btn-cancel-gov-report">Cerrar</button>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary" id="btn-export-report-excel" style="display:inline-flex; align-items:center; gap:7px; border-color:#16a34a; color:#15803d; font-weight:600;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              Exportar Reporte en Excel (.xlsx)
            </button>
            <button type="button" class="btn btn-primary" id="btn-export-report-pdf" style="display:inline-flex; align-items:center; gap:7px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Generar Reporte Institucional PDF
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#btn-close-gov-report').addEventListener('click', close);
    overlay.querySelector('#btn-cancel-gov-report').addEventListener('click', close);

    function getActiveCriterion() {
      const checked = overlay.querySelector('input[name="rep_criterio"]:checked');
      return checked ? checked.value : 'G';
    }

    function resolveMatchingRecords() {
      const crit = getActiveCriterion();
      if (crit === 'A') {
        const selId = overlay.querySelector('#rep-select-individual')?.value;
        const found = allRows.filter((r, i) => String(r[idField] ?? i) === String(selId));
        return {
          rows: found,
          label: `A. Reporte Individual (${found[0] ? getRowLabel(found[0], 0) : 'Sin selección'})`
        };
      }
      if (crit === 'B') {
        const found = allRows.filter(r => selectedSet.has(String(r[idField])));
        return {
          rows: found,
          label: `B. Registros Seleccionados en Tabla (${found.length})`
        };
      }
      if (crit === 'C') {
        const sVal = overlay.querySelector('#rep-date-start')?.value;
        const eVal = overlay.querySelector('#rep-date-end')?.value;
        const dStart = sVal ? new Date(sVal + 'T00:00:00') : null;
        const dEnd = eVal ? new Date(eVal + 'T23:59:59') : null;
        const found = allRows.filter(r => {
          const dt = parseRecordDate(r[dateField] || r.creadoEn || r.fechaRadicacion || r.fechaEmo || r.fechaEntrega);
          if (!dt) return true;
          if (dStart && dt < dStart) return false;
          if (dEnd && dt > dEnd) return false;
          return true;
        });
        return {
          rows: found,
          label: `C. Periodo Personalizado (${sVal || 'Inicio'} a ${eVal || 'Hoy'})`
        };
      }
      if (crit === 'D') {
        const m = parseInt(overlay.querySelector('#rep-single-month')?.value, 10) || curMonth;
        const y = parseInt(overlay.querySelector('#rep-single-month-year')?.value, 10) || curYear;
        const mObj = MESES.find(x => x.num === m);
        const found = allRows.filter(r => {
          const dt = parseRecordDate(r[dateField] || r.creadoEn || r.fechaRadicacion || r.fechaEmo || r.fechaEntrega);
          if (!dt) return false;
          return dt.getFullYear() === y && (dt.getMonth() + 1) === m;
        });
        return {
          rows: found,
          label: `D. Mes Específico (${mObj ? mObj.nombre : m} de ${y})`
        };
      }
      if (crit === 'E') {
        const y = parseInt(overlay.querySelector('#rep-multi-month-year')?.value, 10) || curYear;
        const checkedMonths = Array.from(overlay.querySelectorAll('.rep-multi-month-cb:checked')).map(cb => parseInt(cb.value, 10));
        const found = allRows.filter(r => {
          const dt = parseRecordDate(r[dateField] || r.creadoEn || r.fechaRadicacion || r.fechaEmo || r.fechaEntrega);
          if (!dt) return false;
          return dt.getFullYear() === y && checkedMonths.includes(dt.getMonth() + 1);
        });
        const mNames = MESES.filter(m => checkedMonths.includes(m.num)).map(m => m.nombre.slice(0, 3)).join(', ');
        return {
          rows: found,
          label: `E. Varios Meses (${mNames || 'Ninguno'} - ${y})`
        };
      }
      if (crit === 'F') {
        const y = parseInt(overlay.querySelector('#rep-annual-year')?.value, 10) || curYear;
        const found = allRows.filter(r => {
          const dt = parseRecordDate(r[dateField] || r.creadoEn || r.fechaRadicacion || r.fechaEmo || r.fechaEntrega);
          if (!dt) return true;
          return dt.getFullYear() === y;
        });
        return {
          rows: found,
          label: `F. Reporte Anual Consolidado (Vigencia ${y})`
        };
      }
      return {
        rows: currentFiltered,
        label: `G. Registros según filtros aplicados (${currentFiltered.length})`
      };
    }

    function updateUI() {
      const crit = getActiveCriterion();
      overlay.querySelectorAll('.report-crit-card').forEach(card => {
        const active = card.getAttribute('data-crit') === crit;
        card.style.border = active ? '2px solid #16a34a' : '1px solid #cbd5e1';
        card.style.background = active ? '#f0fdf4' : '#fff';
      });
      overlay.querySelectorAll('.crit-config-panel').forEach(p => { p.style.display = 'none'; });
      const activePanel = overlay.querySelector(`#crit-panel-${crit}`);
      if (activePanel) activePanel.style.display = 'block';

      const { rows, label } = resolveMatchingRecords();
      overlay.querySelector('#rep-match-count').textContent = `${rows.length} registro(s) incluidos en el reporte`;
      overlay.querySelector('#rep-match-desc').textContent = label;
    }

    overlay.querySelectorAll('input[name="rep_criterio"], #rep-select-individual, #rep-date-start, #rep-date-end, #rep-single-month, #rep-single-month-year, #rep-multi-month-year, .rep-multi-month-cb, #rep-annual-year')
      .forEach(el => el.addEventListener('change', updateUI));

    updateUI();

    // Exportar en Excel (.xlsx)
    overlay.querySelector('#btn-export-report-excel').addEventListener('click', () => {
      const { rows, label } = resolveMatchingRecords();
      if (!rows.length) {
        App.showToast('No hay registros que coincidan con el criterio seleccionado.', 'warning');
        return;
      }
      ExcelService.exportToExcel({
        filename: `${filenamePrefix}_${getActiveCriterion()}`,
        sheetName,
        columns,
        data: rows,
      });
      App.showToast(`Reporte Excel generado (${rows.length} registros - ${label}).`, 'success');
    });

    // Exportar en PDF Institucional
    overlay.querySelector('#btn-export-report-pdf').addEventListener('click', () => {
      const { rows, label } = resolveMatchingRecords();
      if (!rows.length) {
        App.showToast('No hay registros que coincidan con el criterio seleccionado.', 'warning');
        return;
      }
      generateInstitutionalPdf({
        modulo,
        title,
        codigoFormato,
        criterionLabel: label,
        rows,
        columns: pdfColumns || columns.slice(0, 10),
        filenamePrefix: `${filenamePrefix}_${getActiveCriterion()}`,
        buildSummaryFn,
      });
    });
  }

  function generateInstitutionalPdf({
    modulo,
    title: rawTitle,
    moduleName,
    subtitle,
    codigoFormato = 'SG-SST',
    criterionLabel = 'Exportación Institucional',
    rows: rawRows,
    records,
    columns = [],
    filenamePrefix: rawFilenamePrefix,
    filename,
    buildSummaryFn,
  } = {}) {
    const rows = Array.isArray(rawRows) ? rawRows : (Array.isArray(records) ? records : []);
    const title = rawTitle || moduleName || 'Reporte Institucional';
    const filenamePrefix = rawFilenamePrefix || filename || 'Reporte_Institucional';
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('La biblioteca PDF (jsPDF) no está cargada en este momento.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? (Auth.getUser() || {}) : {};

    // Encabezado Institucional Gobernación de Boyacá
    doc.setFillColor(15, 41, 30);
    doc.rect(0, 0, pageW, 68, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('GOBERNACIÓN DE BOYACÁ — SECRETARÍA GENERAL', 36, 24);
    doc.setFontSize(10.5);
    doc.text('DIRECCIÓN DE TALENTO HUMANO · SUBDIRECCIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO', 36, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`${title} · Código Oficial: ${codigoFormato}`, 36, 55);

    // Metadatos del reporte
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`Criterio de Generación: ${criterionLabel}`, 36, 86);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Fecha de generación: ${new Date().toLocaleString('es-CO')}   |   Generado por: ${user.name || user.username || 'Usuario Autorizado'}   |   Total registros: ${rows.length}`,
      36,
      101
    );

    let startY = 114;
    if (typeof buildSummaryFn === 'function') {
      const summaryText = buildSummaryFn(rows);
      if (summaryText) {
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(187, 247, 208);
        doc.roundedRect(36, 110, pageW - 72, 24, 4, 4, 'FD');
        doc.setTextColor(22, 101, 52);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(String(summaryText), 46, 125);
        startY = 144;
      }
    }

    const head = [columns.map(c => String(c.header || c.key || '').toUpperCase())];
    const body = rows.map((item, idx) =>
      columns.map(col => {
        let val = item[col.key];
        if (val === undefined && item[col.header] !== undefined) val = item[col.header];
        if (typeof col.format === 'function') val = col.format(val, item, idx);
        return val == null ? '' : String(val);
      })
    );

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY,
        head,
        body,
        margin: { left: 36, right: 36, bottom: 40 },
        styles: {
          fontSize: 7.5,
          cellPadding: 4,
          overflow: 'linebreak',
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [27, 67, 50],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(
            `Talento Humano 360 · Gobernación de Boyacá · Confidencial (Ley 1581 de 2012) · Página ${data.pageNumber} de ${pageCount}`,
            36,
            doc.internal.pageSize.getHeight() - 18
          );
        },
      });
    }

    const outName = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(outName);
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Reporte PDF descargado (${rows.length} registros).`, 'success');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. VISOR DE HISTORIAL, AUDITORÍA Y TRAZABILIDAD INMUTABLE (SECCIÓN 8)
  //    Disponible en los 6 submódulos
  // ═══════════════════════════════════════════════════════════════════════════

  async function openAuditModal(moduloOrObj, customTitle = '') {
    const existing = document.getElementById('gov-audit-modal-overlay');
    if (existing) existing.remove();

    const modulo = (typeof moduloOrObj === 'object' && moduloOrObj !== null)
      ? (moduloOrObj.modulo || moduloOrObj.moduleCode || 'permisos')
      : String(moduloOrObj || 'permisos');
    const resolvedTitle = (typeof moduloOrObj === 'object' && moduloOrObj !== null)
      ? (moduloOrObj.moduloLabel || moduloOrObj.moduleLabel || customTitle)
      : customTitle;

    const service = serviceForModulo(modulo);
    const label = resolvedTitle || MODULO_LABELS[modulo] || modulo;

    const overlay = document.createElement('div');
    overlay.id = 'gov-audit-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width: 980px; width: 96%;">
        <div class="modal-header" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:#fff; border-radius:16px 16px 0 0;">
          <div class="modal-header-info">
            <span style="background:rgba(255,255,255,0.14); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700;">
              TRAZABILIDAD INMUTABLE · SECCIÓN 8
            </span>
            <h2 class="modal-title" style="color:#fff; margin-top:6px;">Historial de Operaciones y Auditoría — ${escHtml(label)}</h2>
            <p class="modal-desc" style="color:rgba(255,255,255,0.8);">
              Registro cronológico inalterable de creaciones, ediciones, aprobaciones, rechazos, cargas masivas y eliminaciones.
            </p>
          </div>
          <button class="modal-close" id="btn-close-gov-audit" style="color:#fff;">&times;</button>
        </div>

        <div class="modal-body" style="padding:18px 24px; max-height:75vh; overflow-y:auto;">
          <!-- Barra de filtros de auditoría -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-bottom:14px; background:#f8fafc; padding:12px; border:1px solid #e2e8f0; border-radius:10px;">
            <div>
              <label class="form-label" style="font-size:11px;">Tipo de Operación</label>
              <select id="aud-filter-op" class="form-select">
                <option value="Todas">Todas las operaciones</option>
                <option value="CREACION">Creación / Radicación</option>
                <option value="MODIFICACION">Modificación / Edición</option>
                <option value="APROBACION">Aprobación</option>
                <option value="RECHAZO">Rechazo</option>
                <option value="CAMBIO_ESTADO">Cambio de Estado</option>
                <option value="IMPORTACION_MASIVA">Importación Masiva Excel</option>
                <option value="DOCUMENTO_INSTITUCIONAL">Documento Institucional</option>
                <option value="INVENTARIO_EPP">Inventario EPP</option>
                <option value="ELIMINACION">Eliminación</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:11px;">Usuario Responsable</label>
              <input type="text" id="aud-filter-user" class="form-input" placeholder="Correo o nombre..." />
            </div>
            <div>
              <label class="form-label" style="font-size:11px;">Desde Fecha</label>
              <input type="date" id="aud-filter-start" class="form-input" />
            </div>
            <div>
              <label class="form-label" style="font-size:11px;">Hasta Fecha</label>
              <input type="date" id="aud-filter-end" class="form-input" />
            </div>
            <div>
              <label class="form-label" style="font-size:11px;">Radicado / Observación</label>
              <input type="text" id="aud-filter-q" class="form-input" placeholder="Buscar radicado o ID..." />
            </div>
          </div>

          <div id="aud-table-container" class="table-wrap" style="max-height:420px; overflow-y:auto;">
            <div style="padding:32px; text-align:center; color:#64748b;">Cargando historial de auditoría...</div>
          </div>
        </div>

        <div class="modal-footer" style="padding:14px 24px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--color-border);">
          <span id="aud-total-counter" style="font-size:12.5px; color:#475569; font-weight:600;">0 eventos registrados</span>
          <button type="button" class="btn btn-secondary" id="btn-close-gov-audit-footer">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#btn-close-gov-audit').addEventListener('click', close);
    overlay.querySelector('#btn-close-gov-audit-footer').addEventListener('click', close);

    let currentAuditRows = [];

    async function loadAudit() {
      const container = overlay.querySelector('#aud-table-container');
      const counter = overlay.querySelector('#aud-total-counter');
      try {
        const params = {
          modulo,
          tipoOperacion: overlay.querySelector('#aud-filter-op').value,
          usuario: overlay.querySelector('#aud-filter-user').value.trim(),
          fechaInicio: overlay.querySelector('#aud-filter-start').value,
          fechaFin: overlay.querySelector('#aud-filter-end').value,
          q: overlay.querySelector('#aud-filter-q').value.trim(),
          limit: 100,
        };
        const res = await API.getAuditoriaModulos(params, service);
        currentAuditRows = res.data || [];
        counter.textContent = `${res.total || currentAuditRows.length} operación(es) registrada(s) en el historial inmutable`;

        if (!currentAuditRows.length) {
          container.innerHTML = `
            <div style="padding:36px; text-align:center; color:#64748b;">
              No se encontraron registros de auditoría con los filtros seleccionados.
            </div>
          `;
          return;
        }

        const badgeColor = (op) => {
          if (op === 'CREACION') return 'badge--info';
          if (op === 'APROBACION') return 'badge--aprobada';
          if (op === 'RECHAZO' || op === 'ELIMINACION') return 'badge--rechazada';
          return 'badge--pendiente';
        };

        container.innerHTML = `
          <table class="data-table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Operación</th>
                <th>Radicado / ID</th>
                <th>Usuario Responsable</th>
                <th>Observaciones / Detalle</th>
                <th style="text-align:center;">Trazabilidad JSON</th>
              </tr>
            </thead>
            <tbody>
              ${currentAuditRows.map((row, i) => `
                <tr>
                  <td style="white-space:nowrap;">${escHtml(formatDateTime(row.fecha_hora))}</td>
                  <td><span class="badge ${badgeColor(row.tipo_operacion)}">${escHtml(row.tipo_operacion)}</span></td>
                  <td><strong>${escHtml(row.radicado || `#${row.id_registro}`)}</strong></td>
                  <td>
                    <div style="font-weight:600;">${escHtml(row.nombre_usuario || row.usuario_responsable)}</div>
                    <div style="font-size:11px; color:#64748b;">${escHtml(row.usuario_responsable)} (${escHtml(row.rol_usuario || 'Rol')})</div>
                  </td>
                  <td>${escHtml(row.observaciones || '—')}</td>
                  <td style="text-align:center;">
                    <button type="button" class="btn btn-secondary btn-sm btn-view-audit-diff" data-idx="${i}" style="font-size:11px; padding:3px 8px;">
                      Ver Antes / Después
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        container.querySelectorAll('.btn-view-audit-diff').forEach(btn => {
          btn.addEventListener('click', () => {
            const item = currentAuditRows[Number(btn.getAttribute('data-idx'))];
            if (!item) return;
            showAuditDiffDialog(item);
          });
        });
      } catch (err) {
        container.innerHTML = `<div style="padding:24px; color:#b91c1c;">Error al cargar auditoría: ${escHtml(err.message)}</div>`;
      }
    }

    ['#aud-filter-op', '#aud-filter-start', '#aud-filter-end'].forEach(sel => {
      overlay.querySelector(sel).addEventListener('change', loadAudit);
    });
    ['#aud-filter-user', '#aud-filter-q'].forEach(sel => {
      overlay.querySelector(sel).addEventListener('input', () => {
        clearTimeout(overlay._audTimer);
        overlay._audTimer = setTimeout(loadAudit, 320);
      });
    });

    await loadAudit();
  }

  function showAuditDiffDialog(item) {
    const prevStr = item.valores_anteriores ? JSON.stringify(item.valores_anteriores, null, 2) : 'Sin estado previo (Creación / Operación inicial)';
    const nextStr = item.valores_nuevos ? JSON.stringify(item.valores_nuevos, null, 2) : 'Registro eliminado (Se conserva este respaldo inmutable)';

    const dlg = document.createElement('div');
    dlg.className = 'modal-overlay';
    dlg.style.zIndex = '10050';
    dlg.innerHTML = `
      <div class="modal-box" style="max-width:860px; width:95%;">
        <div class="modal-header">
          <div class="modal-header-info">
            <h3 class="modal-title">Detalle de Trazabilidad — ${escHtml(item.radicado || `#${item.id_registro}`)} (${escHtml(item.tipo_operacion)})</h3>
            <p class="modal-desc">${escHtml(formatDateTime(item.fecha_hora))} · Responsable: ${escHtml(item.nombre_usuario || item.usuario_responsable)}</p>
          </div>
          <button class="modal-close" id="btn-close-diff">&times;</button>
        </div>
        <div class="modal-body" style="padding:18px 24px; display:grid; grid-template-columns:1fr 1fr; gap:14px; max-height:70vh; overflow-y:auto;">
          <div>
            <div style="font-weight:700; font-size:12px; color:#b91c1c; margin-bottom:6px;">VALORES ANTERIORES</div>
            <pre style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; font-size:11px; overflow-x:auto; max-height:360px;">${escHtml(prevStr)}</pre>
          </div>
          <div>
            <div style="font-weight:700; font-size:12px; color:#15803d; margin-bottom:6px;">VALORES NUEVOS</div>
            <pre style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px; font-size:11px; overflow-x:auto; max-height:360px;">${escHtml(nextStr)}</pre>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(dlg);
    dlg.querySelector('#btn-close-diff').addEventListener('click', () => dlg.remove());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. GESTOR DE FORMATOS Y DOCUMENTOS INSTITUCIONALES (SECCIÓN 11)
  //    Disponible en los 6 submódulos (Descarga para todos; Carga/Versiones para Responsable/Admin)
  // ═══════════════════════════════════════════════════════════════════════════

  async function openInstitutionalDocumentsModal(moduloOrObj, canManageArg = false) {
    const existing = document.getElementById('gov-docs-modal-overlay');
    if (existing) existing.remove();

    const modulo = (typeof moduloOrObj === 'object' && moduloOrObj !== null)
      ? (moduloOrObj.modulo || moduloOrObj.moduleCode || 'permisos')
      : String(moduloOrObj || 'permisos');
    const canManage = (typeof moduloOrObj === 'object' && moduloOrObj !== null && typeof moduloOrObj.canManage === 'boolean')
      ? moduloOrObj.canManage
      : Boolean(canManageArg);

    const service = serviceForModulo(modulo);
    const label = (typeof moduloOrObj === 'object' && moduloOrObj !== null && (moduloOrObj.moduloLabel || moduloOrObj.moduleLabel))
      || MODULO_LABELS[modulo]
      || modulo;

    const overlay = document.createElement('div');
    overlay.id = 'gov-docs-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width: 920px; width: 96%;">
        <div class="modal-header" style="background: linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%); color:#fff; border-radius:16px 16px 0 0;">
          <div class="modal-header-info">
            <span style="background:rgba(255,255,255,0.18); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700;">
              REPOSITORIO DOCUMENTAL CON CONTROL DE VERSIONES · SECCIÓN 11
            </span>
            <h2 class="modal-title" style="color:#fff; margin-top:6px;">Formatos, Guías y Documentos Institucionales — ${escHtml(label)}</h2>
            <p class="modal-desc" style="color:rgba(255,255,255,0.85);">
              Consulte y descargue los formatos oficiales vigentes del submódulo.${canManage ? ' Como responsable autorizado, puede publicar nuevos formatos o actualizar versiones.' : ''}
            </p>
          </div>
          <button class="modal-close" id="btn-close-gov-docs" style="color:#fff;">&times;</button>
        </div>

        <div class="modal-body" style="padding:20px 24px; max-height:74vh; overflow-y:auto;">
          ${canManage ? `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; margin-bottom:16px;">
              <div>
                <strong style="color:#166534; font-size:13px;">Administración Documental Habilitada</strong>
                <div style="font-size:12px; color:#15803d;">Puede cargar formatos PDF, Word (.docx), Excel (.xlsx) o guías técnicas para este submódulo.</div>
              </div>
              <button type="button" class="btn btn-primary btn-sm" id="btn-toggle-new-doc-form">
                + Publicar Nuevo Formato / Documento
              </button>
            </div>

            <form id="form-new-inst-doc" style="display:none; padding:16px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; margin-bottom:18px;">
              <h4 style="margin:0 0 12px 0; color:#0f172a;">Publicar o Actualizar Formato Institucional</h4>
              <input type="hidden" id="doc-edit-id" value="" />
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap:12px;">
                <div>
                  <label class="form-label">Código del Formato</label>
                  <input type="text" id="doc-codigo" class="form-input" placeholder="Ej: E-DO-ST-F-024" />
                </div>
                <div>
                  <label class="form-label">Categoría</label>
                  <select id="doc-categoria" class="form-select">
                    <option value="Formato Institucional">Formato Institucional</option>
                    <option value="Protocolo SST">Protocolo SST</option>
                    <option value="Instructivo / Guía">Instructivo / Guía</option>
                    <option value="Normativa / Reglamento">Normativa / Reglamento</option>
                    <option value="Circular / Comunicado">Circular / Comunicado</option>
                  </select>
                </div>
                <div>
                  <label class="form-label">Versión</label>
                  <input type="text" id="doc-version" class="form-input" value="1.0" />
                </div>
              </div>
              <div style="margin-top:10px;">
                <label class="form-label">Nombre Oficial del Documento *</label>
                <input type="text" id="doc-nombre" class="form-input" required placeholder="Nombre descriptivo del formato o protocolo..." />
              </div>
              <div style="margin-top:10px;">
                <label class="form-label">Descripción / Instrucciones de Uso</label>
                <textarea id="doc-descripcion" class="form-input" rows="2" placeholder="Propósito e instrucciones para los servidores públicos..."></textarea>
              </div>
              <div style="margin-top:10px;">
                <label class="form-label">Archivo Adjunto (PDF, DOCX, XLSX, TXT - Máx. 15 MB) *</label>
                <input type="file" id="doc-archivo" class="form-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg" />
              </div>
              <div id="doc-obs-cambio-wrap" style="margin-top:10px; display:none;">
                <label class="form-label">Motivo de Actualización de Versión</label>
                <input type="text" id="doc-obs-cambio" class="form-input" placeholder="Ej: Actualización de encabezados vigencia 2026..." />
              </div>
              <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-doc-form">Cancelar</button>
                <button type="submit" class="btn btn-primary btn-sm" id="btn-save-doc-form">Guardar y Publicar</button>
              </div>
            </form>
          ` : ''}

          <div id="gov-docs-list-container">
            <div style="padding:28px; text-align:center; color:#64748b;">Cargando documentos institucionales...</div>
          </div>
        </div>

        <div class="modal-footer" style="padding:14px 24px; display:flex; justify-content:flex-end; border-top:1px solid var(--color-border);">
          <button type="button" class="btn btn-secondary" id="btn-close-gov-docs-footer">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#btn-close-gov-docs').addEventListener('click', close);
    overlay.querySelector('#btn-close-gov-docs-footer').addEventListener('click', close);

    const formEl = overlay.querySelector('#form-new-inst-doc');
    if (canManage && formEl) {
      overlay.querySelector('#btn-toggle-new-doc-form').addEventListener('click', () => {
        formEl.reset();
        overlay.querySelector('#doc-edit-id').value = '';
        overlay.querySelector('#doc-obs-cambio-wrap').style.display = 'none';
        formEl.style.display = formEl.style.display === 'none' ? 'block' : 'none';
      });
      overlay.querySelector('#btn-cancel-doc-form').addEventListener('click', () => {
        formEl.style.display = 'none';
      });

      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = overlay.querySelector('#doc-edit-id').value;
        const nombre = overlay.querySelector('#doc-nombre').value.trim();
        const codigoFormato = overlay.querySelector('#doc-codigo').value.trim();
        const categoria = overlay.querySelector('#doc-categoria').value;
        const version = overlay.querySelector('#doc-version').value.trim() || '1.0';
        const descripcion = overlay.querySelector('#doc-descripcion').value.trim();
        const obsCambio = overlay.querySelector('#doc-obs-cambio').value.trim();
        const fileInput = overlay.querySelector('#doc-archivo');
        const file = fileInput.files && fileInput.files[0];

        if (!nombre) {
          App.showToast('El nombre del documento es obligatorio.', 'warning');
          return;
        }
        if (!editId && !file) {
          App.showToast('Seleccione el archivo que desea publicar.', 'warning');
          return;
        }

        const saveBtn = overlay.querySelector('#btn-save-doc-form');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
        try {
          let base64 = null;
          let nombreArchivo = null;
          let tipoMime = null;
          if (file) {
            base64 = await fileToBase64(file);
            nombreArchivo = file.name;
            tipoMime = file.type || 'application/octet-stream';
          }

          if (editId) {
            await API.updateDocumentoInstitucional(editId, {
              codigoFormato,
              nombre,
              descripcion,
              categoria,
              nuevaVersion: version,
              observacionCambio: obsCambio,
              nombreArchivo,
              tipoMime,
              base64,
            }, service);
            App.showToast('Documento institucional actualizado correctamente.', 'success');
          } else {
            await API.createDocumentoInstitucional({
              modulo,
              codigoFormato,
              nombre,
              descripcion,
              categoria,
              version,
              nombreArchivo,
              tipoMime,
              base64,
            }, service);
            App.showToast('Documento institucional publicado correctamente.', 'success');
          }
          formEl.style.display = 'none';
          await loadDocs();
        } catch (err) {
          App.showToast(err.message || 'Error al guardar documento.', 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar y Publicar';
        }
      });
    }

    async function loadDocs() {
      const container = overlay.querySelector('#gov-docs-list-container');
      try {
        const res = await API.getDocumentosInstitucionales(modulo, service);
        const docs = res.data || [];
        if (!docs.length) {
          container.innerHTML = `<div style="padding:28px; text-align:center; color:#64748b;">No hay documentos institucionales publicados en este submódulo.</div>`;
          return;
        }

        container.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${docs.map(d => `
              <div style="padding:16px; border:1px solid #e2e8f0; border-radius:12px; background:#fff; display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap;">
                <div style="flex:1; min-width:260px;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                    <span class="badge badge--info">${escHtml(d.codigo_formato || 'FORMATO OFICIAL')}</span>
                    <span class="badge badge--aprobada">Versión ${escHtml(d.version_actual)}</span>
                    <span style="font-size:11.5px; color:#64748b;">${escHtml(d.categoria || 'Formato')}</span>
                  </div>
                  <h4 style="margin:4px 0; font-size:14.5px; color:#0f172a;">${escHtml(d.nombre)}</h4>
                  <p style="margin:4px 0 8px 0; font-size:12.5px; color:#475569;">${escHtml(d.descripcion || '')}</p>
                  <div style="font-size:11.5px; color:#64748b;">
                    Archivo: <strong>${escHtml(d.nombre_archivo)}</strong> (${formatBytes(d.tamano_bytes)}) · Actualizado: ${escHtml(formatDateTime(d.fecha_actualizacion))} · Versiones: ${d.total_versiones || 1}
                  </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                  <button type="button" class="btn btn-primary btn-sm btn-dl-inst-doc" data-id="${d.id_documento}" data-name="${escHtml(d.nombre_archivo)}">
                    Descargar Vigente
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm btn-ver-inst-doc" data-id="${d.id_documento}" data-title="${escHtml(d.nombre)}">
                    Versiones (${d.total_versiones || 1})
                  </button>
                  ${canManage ? `
                    <button type="button" class="btn btn-secondary btn-sm btn-replace-inst-doc" data-id="${d.id_documento}">
                      Nueva Versión
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm btn-del-inst-doc" data-id="${d.id_documento}" style="color:#b91c1c;">
                      Retirar
                    </button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;

        container.querySelectorAll('.btn-dl-inst-doc').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await API.downloadDocumentoInstitucional(btn.dataset.id, btn.dataset.name, service);
            } catch (err) {
              App.showToast(err.message, 'error');
            }
          });
        });

        container.querySelectorAll('.btn-ver-inst-doc').forEach(btn => {
          btn.addEventListener('click', () => showDocumentVersionsDialog(btn.dataset.id, btn.dataset.title, service));
        });

        if (canManage) {
          container.querySelectorAll('.btn-replace-inst-doc').forEach(btn => {
            btn.addEventListener('click', () => {
              const docObj = docs.find(x => String(x.id_documento) === String(btn.dataset.id));
              if (!docObj || !formEl) return;
              overlay.querySelector('#doc-edit-id').value = docObj.id_documento;
              overlay.querySelector('#doc-codigo').value = docObj.codigo_formato || '';
              overlay.querySelector('#doc-categoria').value = docObj.categoria || 'Formato Institucional';
              const nextVer = !isNaN(parseFloat(docObj.version_actual)) ? (parseFloat(docObj.version_actual) + 1).toFixed(1) : `${docObj.version_actual}.1`;
              overlay.querySelector('#doc-version').value = nextVer;
              overlay.querySelector('#doc-nombre').value = docObj.nombre || '';
              overlay.querySelector('#doc-descripcion').value = docObj.descripcion || '';
              overlay.querySelector('#doc-obs-cambio-wrap').style.display = 'block';
              formEl.style.display = 'block';
              formEl.scrollIntoView({ behavior: 'smooth' });
            });
          });

          container.querySelectorAll('.btn-del-inst-doc').forEach(btn => {
            btn.addEventListener('click', async () => {
              if (!confirm('¿Desea retirar este documento institucional de la vista activa?')) return;
              try {
                await API.deleteDocumentoInstitucional(btn.dataset.id, service);
                App.showToast('Documento retirado.', 'success');
                await loadDocs();
              } catch (err) {
                App.showToast(err.message, 'error');
              }
            });
          });
        }
      } catch (err) {
        container.innerHTML = `<div style="padding:20px; color:#b91c1c;">Error al cargar documentos: ${escHtml(err.message)}</div>`;
      }
    }

    await loadDocs();
  }

  async function showDocumentVersionsDialog(docId, docTitle, service) {
    const dlg = document.createElement('div');
    dlg.className = 'modal-overlay';
    dlg.style.zIndex = '10050';
    dlg.innerHTML = `
      <div class="modal-box" style="max-width:680px; width:94%;">
        <div class="modal-header">
          <div class="modal-header-info">
            <h3 class="modal-title">Historial de Versiones — ${escHtml(docTitle)}</h3>
            <p class="modal-desc">Control de versiones institucionales almacenadas en la base de datos.</p>
          </div>
          <button class="modal-close" id="btn-close-ver-dlg">&times;</button>
        </div>
        <div class="modal-body" id="ver-dlg-body" style="padding:18px 24px; max-height:60vh; overflow-y:auto;">
          Cargando versiones...
        </div>
      </div>
    `;
    document.body.appendChild(dlg);
    dlg.querySelector('#btn-close-ver-dlg').addEventListener('click', () => dlg.remove());

    try {
      const res = await API.getDocumentoVersiones(docId, service);
      const list = res.data || [];
      const body = dlg.querySelector('#ver-dlg-body');
      body.innerHTML = `
        <table class="data-table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr>
              <th>Versión</th>
              <th>Archivo</th>
              <th>Fecha</th>
              <th>Subido por</th>
              <th>Observación</th>
              <th>Descargar</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(v => `
              <tr>
                <td><span class="badge badge--info">v${escHtml(v.version)}</span></td>
                <td>${escHtml(v.nombre_archivo)}</td>
                <td>${escHtml(formatDateTime(v.fecha_version))}</td>
                <td>${escHtml(v.subido_por || 'Sistema')}</td>
                <td>${escHtml(v.observacion_cambio || '—')}</td>
                <td>
                  <button type="button" class="btn btn-secondary btn-sm btn-dl-ver" data-vid="${v.id_version}" data-name="${escHtml(v.nombre_archivo)}">
                    Descargar
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      body.querySelectorAll('.btn-dl-ver').forEach(btn => {
        btn.addEventListener('click', () => {
          API.downloadDocumentoInstitucional(docId, btn.dataset.name, service, btn.dataset.vid);
        });
      });
    } catch (err) {
      dlg.querySelector('#ver-dlg-body').innerHTML = `<div style="color:#b91c1c;">${escHtml(err.message)}</div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ADMINISTRACIÓN DE RESPONSABLES POR SUBMÓDULO (SECCIÓN 7 - SOLO ADMIN)
  // ═══════════════════════════════════════════════════════════════════════════

  async function openResponsablesModal(moduloOrObj = 'permisos') {
    const existing = document.getElementById('gov-resp-modal-overlay');
    if (existing) existing.remove();

    const defaultModulo = (typeof moduloOrObj === 'object' && moduloOrObj !== null)
      ? (moduloOrObj.modulo || moduloOrObj.moduleCode || 'permisos')
      : String(moduloOrObj || 'permisos');

    const overlay = document.createElement('div');
    overlay.id = 'gov-resp-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width: 900px; width: 96%;">
        <div class="modal-header" style="background: linear-gradient(135deg, #0f291e 0%, #1b4332 100%); color:#fff; border-radius:16px 16px 0 0;">
          <div class="modal-header-info">
            <span style="background:rgba(255,255,255,0.16); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700;">
              CONTROL DE ACCESO RBAC POR MÓDULO · SECCIÓN 7
            </span>
            <h2 class="modal-title" style="color:#fff; margin-top:6px;">Gestión de Responsables por Submódulo</h2>
            <p class="modal-desc" style="color:rgba(255,255,255,0.84);">
              Asigne o modifique los funcionarios responsables de administrar Permisos, Licencias, Incapacidades y SST sin modificar el código fuente.
            </p>
          </div>
          <button class="modal-close" id="btn-close-gov-resp" style="color:#fff;">&times;</button>
        </div>

        <div class="modal-body" style="padding:20px 24px; max-height:74vh; overflow-y:auto;">
          <form id="form-gov-resp" style="padding:16px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; margin-bottom:18px;">
            <h4 style="margin:0 0 10px 0; color:#0f172a;">Asignar o Actualizar Responsable de Submódulo</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
              <div>
                <label class="form-label">Submódulo *</label>
                <select id="resp-modulo" class="form-select">
                  ${Object.entries(MODULO_LABELS).map(([k, v]) => `<option value="${k}" ${k === defaultModulo ? 'selected' : ''}>${escHtml(v)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label">Correo Institucional / Usuario *</label>
                <input type="text" id="resp-username" class="form-input" required placeholder="nombre.apellido@boyaca.gov.co" />
              </div>
              <div>
                <label class="form-label">Nombre Completo del Responsable *</label>
                <input type="text" id="resp-nombre" class="form-input" required placeholder="Ej: Sandra Roa" />
              </div>
              <div>
                <label class="form-label">Cargo / Rol en el Módulo</label>
                <input type="text" id="resp-cargo" class="form-input" placeholder="Responsable de Módulo" />
              </div>
            </div>
            <div style="display:flex; gap:18px; align-items:center; flex-wrap:wrap; margin-top:12px;">
              <label style="display:flex; align-items:center; gap:6px; font-size:12.5px;">
                <input type="checkbox" id="resp-aprobar" checked /> Puede aprobar / cambiar estados
              </label>
              <label style="display:flex; align-items:center; gap:6px; font-size:12.5px;">
                <input type="checkbox" id="resp-importar" checked /> Puede importar Excel masivamente
              </label>
              <label style="display:flex; align-items:center; gap:6px; font-size:12.5px;">
                <input type="checkbox" id="resp-exportar" checked /> Puede exportar reportes y plantillas
              </label>
              <button type="submit" class="btn btn-primary btn-sm" style="margin-left:auto;">Guardar Asignación</button>
            </div>
          </form>

          <div id="gov-resp-table-wrap">Cargando asignaciones...</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#btn-close-gov-resp').addEventListener('click', () => overlay.remove());

    async function loadResponsables() {
      const wrap = overlay.querySelector('#gov-resp-table-wrap');
      try {
        const res = await API.getGovernancePermissions('', 'admin-requests');
        const list = res.responsables || [];
        wrap.innerHTML = `
          <table class="data-table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr>
                <th>Submódulo</th>
                <th>Nombre del Responsable</th>
                <th>Usuario / Correo</th>
                <th>Cargo</th>
                <th>Permisos</th>
                <th style="text-align:center;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(r => `
                <tr>
                  <td><strong>${escHtml(MODULO_LABELS[r.modulo] || r.modulo)}</strong></td>
                  <td>${escHtml(r.nombre_responsable)}</td>
                  <td><code>${escHtml(r.username)}</code></td>
                  <td>${escHtml(r.cargo_responsable || '')}</td>
                  <td>
                    ${r.puede_aprobar ? '<span class="badge badge--aprobada" style="font-size:10px;">Aprobar</span> ' : ''}
                    ${r.puede_importar ? '<span class="badge badge--info" style="font-size:10px;">Importar</span> ' : ''}
                    ${r.puede_exportar ? '<span class="badge badge--pendiente" style="font-size:10px;">Exportar</span>' : ''}
                  </td>
                  <td style="text-align:center;">
                    <button type="button" class="btn btn-secondary btn-sm btn-del-resp" data-id="${r.id_asignacion}" style="color:#b91c1c;">
                      Remover
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        wrap.querySelectorAll('.btn-del-resp').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('¿Desea remover esta asignación de responsable?')) return;
            try {
              await API.deleteModuloResponsable(btn.dataset.id, 'admin-requests');
              await API.deleteModuloResponsable(btn.dataset.id, 'sst').catch(() => {});
              App.showToast('Asignación removida.', 'success');
              await loadResponsables();
            } catch (err) {
              App.showToast(err.message, 'error');
            }
          });
        });
      } catch (err) {
        wrap.innerHTML = `<div style="color:#b91c1c;">${escHtml(err.message)}</div>`;
      }
    }

    overlay.querySelector('#form-gov-resp').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        modulo: overlay.querySelector('#resp-modulo').value,
        username: overlay.querySelector('#resp-username').value.trim(),
        nombreResponsable: overlay.querySelector('#resp-nombre').value.trim(),
        cargoResponsable: overlay.querySelector('#resp-cargo').value.trim() || 'Responsable de Módulo',
        puedeAprobar: overlay.querySelector('#resp-aprobar').checked,
        puedeImportar: overlay.querySelector('#resp-importar').checked,
        puedeExportar: overlay.querySelector('#resp-exportar').checked,
      };
      try {
        await API.saveModuloResponsable(payload, 'admin-requests');
        await API.saveModuloResponsable(payload, 'sst').catch(() => {});
        App.showToast('Responsable asignado correctamente.', 'success');
        await loadResponsables();
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });

    await loadResponsables();
  }

  return {
    openReportGeneratorModal,
    generateInstitutionalPdf,
    openAuditModal,
    openInstitutionalDocumentsModal,
    openResponsablesModal,
  };
})();
