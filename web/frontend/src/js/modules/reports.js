/* ═══════════════════════════════════════════════════════════════════════════
   reports.js — Informes con filtros avanzados y automatización
   ═══════════════════════════════════════════════════════════════════════════ */

const ReportsModule = (() => {
  const PAGE_SIZE = 50;
  const TIME_ZONE = 'America/Bogota';
  const FREQUENCY_LABELS = { diaria: 'Diaria', semanal: 'Semanal', mensual: 'Mensual', personalizada: 'Personalizada' };

  const state = {
    tab: 'generar',
    catalog: null,
    source: null,
    options: {},
    result: null,
    page: 1,
    editing: null,
    automations: [],
    runsPage: 1,
    openRun: null,
  };

  // ─── Utilidades ────────────────────────────────────────────────────────────
  const showError = (prefix, err) => App.showToast(escHtml(`${prefix}: ${err.message}`), 'error');

  function formatDateTime(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO', { timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short' });
  }

  function statusBadge(estado) {
    if (estado === 'Exitosa' || estado === 'Activa') return 'badge--aprobada';
    if (estado === 'Error') return 'badge--rechazada';
    if (estado === 'Pausada') return 'badge--pendiente';
    return 'badge--revision';
  }

  function frequencyText(a) {
    if (a.frecuencia !== 'personalizada') return FREQUENCY_LABELS[a.frecuencia] || a.frecuencia;
    const units = { horas: 'horas', dias: 'días', semanas: 'semanas' };
    return `Cada ${a.intervalo} ${units[a.unidad] || a.unidad}`;
  }

  function bogotaParts(value) {
    const local = new Date(new Date(value).getTime() - 5 * 60 * 60 * 1000).toISOString();
    return { fecha: local.slice(0, 10), hora: local.slice(11, 16) };
  }

  function emptyState(title, desc) {
    return `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      <span class="empty-state-title">${escHtml(title)}</span>
      <span class="empty-state-desc">${escHtml(desc)}</span>
    </div>`;
  }

  const canAutomate = () => Boolean(state.catalog?.puedeAutomatizar);

  // ─── Render principal ──────────────────────────────────────────────────────
  async function render(container) {
    state.tab = 'generar';
    state.source = null;
    state.result = null;
    state.editing = null;
    state.runsPage = 1;

    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <h1 class="page-heading">Informes y Automatización</h1>
            <p class="page-desc">Genera informes con filtros combinados y programa su generación periódica</p>
          </div>
        </div>
        <div class="module-tabs" role="tablist" aria-label="Vistas de informes">
          <button type="button" class="tab-btn active" role="tab" id="rpt-tab-generar" aria-selected="true" onclick="ReportsModule.switchTab('generar')">Generar informe</button>
          <button type="button" class="tab-btn" role="tab" id="rpt-tab-automatizaciones" aria-selected="false" onclick="ReportsModule.switchTab('automatizaciones')">Automatizaciones</button>
          <button type="button" class="tab-btn" role="tab" id="rpt-tab-historial" aria-selected="false" onclick="ReportsModule.switchTab('historial')">Historial de ejecuciones</button>
          <button type="button" class="tab-btn" role="tab" id="rpt-tab-importaciones" aria-selected="false" onclick="ReportsModule.switchTab('importaciones')">Historial de importaciones</button>
        </div>
        <div id="rpt-view"><div class="table-card"><div class="skeleton skeleton-line" style="width:100%;height:18px;"></div></div></div>
      </div>`;

    try {
      state.catalog = await API.getReportCatalog();
    } catch (err) {
      document.getElementById('rpt-view').innerHTML = `<div class="table-card">${emptyState('No se pudieron cargar los informes', err.message)}</div>`;
      return;
    }
    renderView();
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.module-tabs .tab-btn').forEach(btn => {
      const active = btn.id === `rpt-tab-${tab}`;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    renderView();
  }

  function renderView() {
    if (state.tab === 'automatizaciones') renderAutomations();
    else if (state.tab === 'historial') renderRuns();
    else if (state.tab === 'importaciones') renderImports();
    else renderBuilder();
  }

  // ─── Generar informe ───────────────────────────────────────────────────────
  function renderBuilder() {
    const view = document.getElementById('rpt-view');
    if (!view) return;
    const fuentes = state.catalog.fuentes;
    if (!fuentes.length) {
      view.innerHTML = `<div class="table-card">${emptyState('Sin informes disponibles', 'No tienes acceso a ningún módulo con datos para generar informes.')}</div>`;
      return;
    }
    view.innerHTML = `
      ${state.editing ? `<div class="rpt-editing">Estás editando la automatización <strong>${escHtml(state.editing.nombre)}</strong>. Ajusta el informe y pulsa "Programar".
        <button type="button" class="btn btn-secondary btn-sm" onclick="ReportsModule.cancelEdit()">Cancelar edición</button></div>` : ''}
      <div class="filters-card">
        <div class="filter-group">
          <label class="filter-label" for="rpt-source">Informe</label>
          <select id="rpt-source" class="filter-select" onchange="ReportsModule.selectSource(this.value)">
            <option value="">Selecciona qué información quieres consultar</option>
            ${fuentes.map(f => `<option value="${escHtml(f.id)}" ${state.source?.id === f.id ? 'selected' : ''}>${escHtml(f.nombre)}</option>`).join('')}
          </select>
        </div>
        <div id="rpt-source-form"></div>
      </div>
      <div id="rpt-result"></div>`;
    if (state.source) {
      const current = state.editing && state.editing.fuente === state.source.id ? state.editing : null;
      selectSource(state.source.id, current);
    }
  }

  async function selectSource(id, preset = null) {
    const form = document.getElementById('rpt-source-form');
    const resultBox = document.getElementById('rpt-result');
    if (resultBox) resultBox.innerHTML = '';
    state.result = null;
    state.source = state.catalog.fuentes.find(f => f.id === id) || null;
    if (!form) return;
    if (!state.source) { form.innerHTML = ''; return; }

    const selectedColumns = preset?.columnas?.length ? preset.columnas : state.source.columnas.filter(c => c.porDefecto).map(c => c.key);
    form.innerHTML = `
      <p class="page-desc" style="margin:var(--space-2) 0 0">${escHtml(state.source.descripcion)}</p>
      <div class="rpt-filter-grid">${state.source.filtros.map(filterHtml).join('')}</div>
      <details class="rpt-columns">
        <summary>Columnas del informe</summary>
        <div class="rpt-columns-grid">
          ${state.source.columnas.map(c => `<label><input type="checkbox" class="rpt-column" value="${escHtml(c.key)}" ${selectedColumns.includes(c.key) ? 'checked' : ''} /> ${escHtml(c.label)}</label>`).join('')}
        </div>
      </details>
      <div class="rpt-actions">
        <button type="button" class="btn btn-primary" onclick="ReportsModule.generate(1)">Ver resultados</button>
        <button type="button" class="btn btn-secondary" onclick="ReportsModule.clearFilters()">Limpiar filtros</button>
        ${canAutomate() ? '<button type="button" class="btn btn-gold" onclick="ReportsModule.openSchedule()">Programar</button>' : ''}
      </div>`;
    if (App.initDatePickers) App.initDatePickers(form);

    try {
      const res = await API.getReportOptions(id);
      state.options = res.opciones || {};
      Object.entries(state.options).forEach(([key, values]) => {
        const select = document.getElementById(`rpt-f-${key}`);
        if (!select) return;
        select.innerHTML = `<option value="">Todos</option>${values.map(v => `<option value="${escHtml(v)}">${escHtml(v)}</option>`).join('')}`;
      });
    } catch (err) {
      showError('No se pudieron cargar las opciones de los filtros', err);
    }
    if (preset?.filtros) applyFilterValues(preset.filtros);
  }

  function filterHtml(f) {
    const id = `rpt-f-${f.key}`;
    if (f.tipo === 'lista') {
      return `<div class="filter-group"><label class="filter-label" for="${id}">${escHtml(f.label)}</label>
        <select id="${id}" class="filter-select"><option value="">Todos</option></select></div>`;
    }
    if (f.tipo === 'fechas') {
      const periods = Object.entries(state.catalog.periodos)
        .map(([value, label]) => `<option value="${escHtml(value)}">${escHtml(label)}</option>`).join('');
      return `<div class="filter-group"><label class="filter-label" for="${id}">${escHtml(f.label)}</label>
        <select id="${id}" class="filter-select" onchange="ReportsModule.togglePeriod('${f.key}')">
          <option value="">Sin filtro</option>${periods}<option value="personalizado">Rango personalizado</option>
        </select>
        <div class="rpt-date-range" id="${id}-range" hidden>
          <input type="date" id="${id}-desde" class="filter-input" aria-label="${escHtml(f.label)} desde" placeholder="Desde" />
          <input type="date" id="${id}-hasta" class="filter-input" aria-label="${escHtml(f.label)} hasta" placeholder="Hasta" />
        </div></div>`;
    }
    if (f.tipo === 'numero') {
      return `<div class="filter-group"><span class="filter-label">${escHtml(f.label)}</span>
        <div class="rpt-date-range">
          <input type="number" id="${id}-min" class="filter-input" aria-label="${escHtml(f.label)} mínimo" placeholder="Mínimo" />
          <input type="number" id="${id}-max" class="filter-input" aria-label="${escHtml(f.label)} máximo" placeholder="Máximo" />
        </div></div>`;
    }
    const placeholder = f.tipo === 'documento' ? 'Número de cédula' : 'Escribe para buscar';
    return `<div class="filter-group"><label class="filter-label" for="${id}">${escHtml(f.label)}</label>
      <input id="${id}" class="filter-input" maxlength="300" placeholder="${placeholder}" /></div>`;
  }

  function togglePeriod(key) {
    const select = document.getElementById(`rpt-f-${key}`);
    const range = document.getElementById(`rpt-f-${key}-range`);
    if (select && range) range.hidden = select.value !== 'personalizado';
  }

  function collectFilters() {
    const filtros = {};
    (state.source?.filtros || []).forEach(f => {
      const id = `rpt-f-${f.key}`;
      if (f.tipo === 'fechas') {
        const choice = document.getElementById(id)?.value;
        if (choice === 'personalizado') {
          const desde = document.getElementById(`${id}-desde`)?.value;
          const hasta = document.getElementById(`${id}-hasta`)?.value;
          if (desde || hasta) filtros[f.key] = { ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) };
        } else if (choice) {
          filtros[f.key] = { periodo: choice };
        }
      } else if (f.tipo === 'numero') {
        const min = document.getElementById(`${id}-min`)?.value;
        const max = document.getElementById(`${id}-max`)?.value;
        if (min !== '' || max !== '') filtros[f.key] = { min, max };
      } else {
        const value = document.getElementById(id)?.value.trim();
        if (value) filtros[f.key] = value;
      }
    });
    return filtros;
  }

  function setDateValue(id, value) {
    const input = document.getElementById(id);
    if (!input) return;
    if (input._flatpickr) input._flatpickr.setDate(value || null, false);
    else input.value = value || '';
  }

  function applyFilterValues(filtros) {
    Object.entries(filtros).forEach(([key, value]) => {
      const id = `rpt-f-${key}`;
      const filter = state.source.filtros.find(f => f.key === key);
      if (!filter) return;
      if (filter.tipo === 'fechas') {
        const select = document.getElementById(id);
        if (!select) return;
        select.value = value.periodo || 'personalizado';
        togglePeriod(key);
        if (!value.periodo) {
          setDateValue(`${id}-desde`, value.desde);
          setDateValue(`${id}-hasta`, value.hasta);
        }
      } else if (filter.tipo === 'numero') {
        document.getElementById(`${id}-min`).value = value.min ?? '';
        document.getElementById(`${id}-max`).value = value.max ?? '';
      } else {
        const input = document.getElementById(id);
        if (input) input.value = value;
      }
    });
  }

  function clearFilters() {
    if (state.source) selectSource(state.source.id);
  }

  function selectedColumns() {
    return [...document.querySelectorAll('.rpt-column:checked')].map(c => c.value);
  }

  function generate() {
    const columnas = selectedColumns();
    if (!columnas.length) {
      App.showToast('Selecciona al menos una columna.', 'warning');
      return;
    }
    // Paginar y exportar usan estos criterios: siempre coinciden con la tabla en pantalla,
    // aunque el formulario haya cambiado después.
    state.query = { fuente: state.source.id, filtros: collectFilters(), columnas };
    return loadResultPage(1);
  }

  async function loadResultPage(page) {
    const box = document.getElementById('rpt-result');
    if (!box || !state.query) return;
    box.innerHTML = '<div class="table-card"><div class="skeleton skeleton-line" style="width:100%;height:18px;"></div></div>';
    try {
      state.page = page;
      state.result = await API.generateReport({ ...state.query, page, limit: PAGE_SIZE });
      box.innerHTML = resultCard(state.result, { paginated: true });
    } catch (err) {
      box.innerHTML = '';
      showError('No se pudo generar el informe', err);
    }
  }

  function resultTable(result, maxRows) {
    const rows = maxRows ? result.filas.slice(0, maxRows) : result.filas;
    return `<div class="table-wrap"><table>
      <thead><tr>${result.columnas.map(c => `<th>${escHtml(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${result.columnas.map(c => `<td>${escHtml(row[c.key] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }

  function criteriaHtml(result) {
    const chips = (result.criterios || []).map(c => `<span class="rpt-criteria-chip"><strong>${escHtml(c.label)}:</strong> ${escHtml(c.valor)}</span>`).join('');
    return `<div class="rpt-criteria">${chips || '<span>Sin filtros: incluye todos los registros disponibles.</span>'}</div>`;
  }

  function resultCard(result, { paginated = false, runId = null } = {}) {
    const hasRows = result.total > 0 && result.filas.length > 0;
    const exportArgs = runId ? `'run'` : `'live'`;
    return `
      <div class="table-card">
        <div class="table-header">
          <span class="table-title">${escHtml(result.fuenteNombre)}</span>
          <div class="rpt-table-actions">
            <span class="table-count">${result.total.toLocaleString('es-CO')} registros</span>
            ${hasRows ? `
              <button type="button" class="btn btn-secondary btn-sm" onclick="ReportsModule.exportReport('excel', ${exportArgs})">Excel</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="ReportsModule.exportReport('pdf', ${exportArgs})">PDF</button>` : ''}
          </div>
        </div>
        ${criteriaHtml(result)}
        ${hasRows
          ? resultTable(result, paginated ? null : 100)
          : emptyState('Sin resultados', 'Ningún registro coincide con los criterios seleccionados.')}
        ${!paginated && result.filas.length > 100 ? `<div class="rpt-note">Se muestran 100 registros aquí. Exporta el informe para verlos todos.</div>` : ''}
        ${result.truncado ? `<div class="rpt-note rpt-error-text">El resultado se limitó a ${state.catalog.maxFilas.toLocaleString('es-CO')} registros. Agrega filtros para acotarlo.</div>` : ''}
        ${paginated && result.totalPages > 1 ? `
          <div class="pagination">
            <span class="pagination-info">Página ${result.page} de ${result.totalPages}</span>
            <div class="pagination-btns">
              <button type="button" class="page-btn" aria-label="Página anterior" onclick="ReportsModule.loadResultPage(${result.page - 1})" ${result.page <= 1 ? 'disabled' : ''}>‹</button>
              <span class="page-btn active">${result.page}</span>
              <button type="button" class="page-btn" aria-label="Página siguiente" onclick="ReportsModule.loadResultPage(${result.page + 1})" ${result.page >= result.totalPages ? 'disabled' : ''}>›</button>
            </div>
          </div>` : ''}
      </div>`;
  }

  // ─── Exportación ───────────────────────────────────────────────────────────
  async function exportReport(format, origin) {
    try {
      let report;
      if (origin === 'run') {
        report = state.openRun;
      } else {
        App.showToast('Preparando el informe...', 'info');
        report = await API.generateReport({ ...state.query, todo: true });
      }
      if (format === 'excel') exportExcel(report);
      else exportPdf(report);
    } catch (err) {
      showError('No se pudo exportar el informe', err);
    }
  }

  function fileName(report) {
    return `Informe_${report.fuenteNombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_')}`;
  }

  function criteriaRows(report) {
    const rows = [
      ['Informe', report.fuenteNombre],
      ['Generado', formatDateTime(report.generadoEn)],
      ['Registros', report.total],
    ];
    (report.criterios || []).forEach(c => rows.push([c.label, c.valor]));
    if (!report.criterios?.length) rows.push(['Filtros', 'Sin filtros']);
    return rows;
  }

  function exportExcel(report) {
    ExcelService.exportToExcel({
      filename: fileName(report),
      sheetName: 'Informe',
      columns: report.columnas.map(c => ({ header: c.label, key: c.key })),
      data: report.filas,
      extraSheets: [{ name: 'Criterios', rows: [['Criterio', 'Valor'], ...criteriaRows(report)] }],
    });
  }

  function exportPdf(report) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const green = [53, 88, 51];
    const gold = [209, 173, 42];

    const header = () => {
      doc.setFillColor(...green);
      doc.rect(0, 0, pageWidth, 18, 'F');
      doc.setFillColor(...gold);
      doc.rect(0, 18, pageWidth, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(report.fuenteNombre, margin, 11.5);
      doc.text('Talento ', pageWidth - margin - doc.getTextWidth('Talento 360'), 11.5);
      doc.setTextColor(...gold);
      doc.text('360', pageWidth - margin - doc.getTextWidth('360'), 11.5);
    };

    const criteria = criteriaRows(report).map(([label, value]) => `${label}: ${value}`).join('   ·   ');
    doc.setFontSize(8.5);
    const criteriaLines = doc.splitTextToSize(criteria, pageWidth - margin * 2);
    header();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(45, 55, 72);
    doc.text(criteriaLines, margin, 25);

    doc.autoTable({
      startY: 25 + criteriaLines.length * 4,
      margin: { left: margin, right: margin, top: 24, bottom: 14 },
      head: [report.columnas.map(c => c.label)],
      body: report.filas.map(row => report.columnas.map(c => String(row[c.key] ?? '—'))),
      rowPageBreak: 'avoid', // Una fila no se parte entre páginas: sus datos quedan junto a la cédula.
      styles: { fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak' },
      headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 244] },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) header();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(82, 96, 109);
        doc.text('Gobernación de Boyacá · Sistema de Gestión Talento 360', margin, pageHeight - 7);
        doc.text(`Página ${data.pageNumber}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
      },
    });
    doc.save(`${fileName(report)}_${bogotaParts(Date.now()).fecha}.pdf`);
  }

  // ─── Programar ─────────────────────────────────────────────────────────────
  function openSchedule() {
    if (!state.source) return;
    if (!selectedColumns().length) {
      App.showToast('Selecciona al menos una columna.', 'warning');
      return;
    }
    const current = state.editing;
    const start = current ? bogotaParts(current.inicio) : bogotaParts(Date.now() + 60 * 60 * 1000);
    const filtros = collectFilters();
    const fixedDates = Object.values(filtros).some(v => v && (v.desde || v.hasta));
    const body = `
      ${fixedDates ? '<div class="rpt-editing">Este informe usa fechas fijas, así que cada ejecución consultará el mismo rango. Para datos nuevos en cada ejecución, usa un periodo como "Mes anterior".</div>' : ''}
      <div class="form-grid">
        <div class="form-group span-2">
          <label class="form-label" for="rpt-s-name">Nombre *</label>
          <input id="rpt-s-name" class="form-input form-input--no-icon" maxlength="160" value="${escHtml(current?.nombre || '')}" placeholder="Ej: Informe mensual de planta" />
        </div>
        <div class="form-group span-2">
          <label class="form-label" for="rpt-s-freq">Frecuencia *</label>
          <select id="rpt-s-freq" class="filter-select" onchange="ReportsModule.toggleCustomInterval()">
            ${Object.entries(FREQUENCY_LABELS).map(([value, label]) => `<option value="${value}" ${(current?.frecuencia || 'mensual') === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" data-rpt-custom>
          <label class="form-label" for="rpt-s-interval">Repetir cada</label>
          <input id="rpt-s-interval" class="form-input form-input--no-icon" type="number" min="1" max="1000" value="${current?.intervalo || 1}" />
        </div>
        <div class="form-group" data-rpt-custom>
          <label class="form-label" for="rpt-s-unit">Unidad</label>
          <select id="rpt-s-unit" class="filter-select">
            ${[['horas', 'Horas'], ['dias', 'Días'], ['semanas', 'Semanas']].map(([value, label]) => `<option value="${value}" ${(current?.unidad || 'dias') === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="rpt-s-date">Primera ejecución *</label>
          <input id="rpt-s-date" class="form-input" type="date" value="${start.fecha}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="rpt-s-time">Hora (Colombia) *</label>
          <input id="rpt-s-time" class="form-input form-input--no-icon" type="time" value="${start.hora}" />
        </div>
      </div>
      <p class="page-desc">La frecuencia semanal y la mensual repiten el mismo día de la semana o del mes de la primera ejecución.</p>`;
    App.openModal(current ? 'Editar automatización' : 'Programar informe', body, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: current ? 'Guardar cambios' : 'Programar', cls: 'btn-primary', id: 'rpt-s-save', action: saveSchedule },
    ]);
    toggleCustomInterval();
  }

  function toggleCustomInterval() {
    const custom = document.getElementById('rpt-s-freq')?.value === 'personalizada';
    document.querySelectorAll('[data-rpt-custom]').forEach(el => { el.style.display = custom ? '' : 'none'; });
  }

  async function saveSchedule() {
    const nombre = document.getElementById('rpt-s-name')?.value.trim();
    const fecha = document.getElementById('rpt-s-date')?.value;
    const hora = document.getElementById('rpt-s-time')?.value;
    const frecuencia = document.getElementById('rpt-s-freq')?.value;
    if (!nombre) { App.showToast('El nombre es obligatorio.', 'warning'); return; }
    if (!fecha || !hora) { App.showToast('Indica la fecha y la hora de ejecución.', 'warning'); return; }

    const payload = {
      nombre,
      fuente: state.source.id,
      filtros: collectFilters(),
      columnas: selectedColumns(),
      frecuencia,
      inicio: `${fecha}T${hora}`,
      ...(frecuencia === 'personalizada' ? {
        intervalo: Number(document.getElementById('rpt-s-interval')?.value),
        unidad: document.getElementById('rpt-s-unit')?.value,
      } : {}),
    };
    const button = document.getElementById('rpt-s-save');
    if (button) button.disabled = true;
    try {
      const saved = state.editing
        ? await API.updateAutomation(state.editing.id, payload)
        : await API.createAutomation(payload);
      App.closeModal();
      App.showToast(`Automatización guardada. Próxima ejecución: ${escHtml(formatDateTime(saved.proximaEjecucion))}.`, 'success');
      state.editing = null;
      switchTab('automatizaciones');
    } catch (err) {
      showError('No se pudo guardar la automatización', err);
      if (button) button.disabled = false;
    }
  }

  function cancelEdit() {
    state.editing = null;
    state.source = null;
    renderBuilder();
  }

  // ─── Automatizaciones ──────────────────────────────────────────────────────
  async function renderAutomations() {
    const view = document.getElementById('rpt-view');
    if (!view) return;
    view.innerHTML = '<div class="table-card"><div class="skeleton skeleton-line" style="width:100%;height:18px;"></div></div>';
    try {
      const res = await API.getAutomations();
      state.automations = res.data || [];
    } catch (err) {
      view.innerHTML = `<div class="table-card">${emptyState('No se pudieron cargar las automatizaciones', err.message)}</div>`;
      return;
    }
    if (state.tab !== 'automatizaciones') return;
    if (!state.automations.length) {
      view.innerHTML = `<div class="table-card">${emptyState('Sin automatizaciones', 'Configura un informe en "Generar informe" y pulsa "Programar".')}</div>`;
      return;
    }
    const manage = canAutomate();
    view.innerHTML = `
      <div class="table-card">
        <div class="table-header">
          <span class="table-title">Informes programados</span>
          <span class="table-count">${state.automations.length} automatizaciones</span>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Automatización</th><th>Frecuencia</th><th>Próxima ejecución</th><th>Última ejecución</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>${state.automations.map(a => `
            <tr>
              <td><span class="td-primary">${escHtml(a.nombre)}</span><span class="rpt-row-sub">${escHtml(a.fuenteNombre)} · ${escHtml(a.creadoPor)}</span></td>
              <td>${escHtml(frequencyText(a))}</td>
              <td>${a.estado === 'Activa' ? escHtml(formatDateTime(a.proximaEjecucion)) : '—'}</td>
              <td>${escHtml(formatDateTime(a.ultimaEjecucion))}
                ${a.ultimoEstado ? `<span class="rpt-row-sub ${a.ultimoEstado === 'Error' ? 'rpt-error-text' : ''}">${escHtml(a.ultimoEstado)}${a.ultimoTotal !== null ? ` · ${a.ultimoTotal} registros` : ''}</span>` : ''}</td>
              <td><span class="badge ${statusBadge(a.estado)}">${escHtml(a.estado)}</span></td>
              <td class="td-actions"><div class="rpt-table-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="ReportsModule.openRuns(${a.id})">Historial</button>
                ${manage ? `
                  <button type="button" class="btn btn-secondary btn-sm" onclick="ReportsModule.runNow(${a.id})">Ejecutar</button>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="ReportsModule.togglePause(${a.id})">${a.estado === 'Activa' ? 'Pausar' : 'Reanudar'}</button>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="ReportsModule.editAutomation(${a.id})">Editar</button>
                  <button type="button" class="btn btn-danger btn-sm" onclick="ReportsModule.confirmDelete(${a.id})">Eliminar</button>` : ''}
              </div></td>
            </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  }

  async function runNow(id) {
    App.showToast('Generando el informe...', 'info');
    try {
      const res = await API.runAutomation(id);
      if (res.estado === 'Error') App.showToast(escHtml(`La ejecución falló: ${res.mensaje}`), 'error');
      else App.showToast(`Informe generado con ${res.total} registros.`, 'success');
      await renderAutomations();
    } catch (err) {
      showError('No se pudo ejecutar', err);
    }
  }

  async function togglePause(id) {
    const automation = state.automations.find(a => a.id === id);
    if (!automation) return;
    try {
      if (automation.estado === 'Activa') await API.pauseAutomation(id);
      else await API.resumeAutomation(id);
      await renderAutomations();
    } catch (err) {
      showError('No se pudo cambiar el estado', err);
    }
  }

  function editAutomation(id) {
    const automation = state.automations.find(a => a.id === id);
    if (!automation) return;
    const source = state.catalog.fuentes.find(f => f.id === automation.fuente);
    if (!source) {
      App.showToast('Ya no tienes acceso a los datos de este informe.', 'warning');
      return;
    }
    state.editing = automation;
    state.source = source;
    switchTab('generar');
  }

  function confirmDelete(id) {
    const automation = state.automations.find(a => a.id === id);
    if (!automation) return;
    App.openModal('Eliminar automatización',
      `<p>Se eliminará <strong>${escHtml(automation.nombre)}</strong> junto con su historial y sus resultados guardados. Esta acción no se puede deshacer.</p>`, [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          text: 'Eliminar',
          cls: 'btn-danger',
          action: async () => {
            try {
              await API.deleteAutomation(id);
              App.closeModal();
              App.showToast('Automatización eliminada.', 'success');
              await renderAutomations();
            } catch (err) {
              showError('No se pudo eliminar', err);
            }
          },
        },
      ]);
  }

  // ─── Historial ─────────────────────────────────────────────────────────────
  function openRuns(id) {
    state.runsFilter = id;
    state.runsPage = 1;
    switchTab('historial');
  }

  async function renderRuns() {
    const view = document.getElementById('rpt-view');
    if (!view) return;
    view.innerHTML = '<div class="table-card"><div class="skeleton skeleton-line" style="width:100%;height:18px;"></div></div>';
    let res;
    try {
      res = await API.getAutomationRuns({
        page: state.runsPage,
        limit: 20,
        ...(state.runsFilter ? { automatizacion: state.runsFilter } : {}),
      });
    } catch (err) {
      view.innerHTML = `<div class="table-card">${emptyState('No se pudo cargar el historial', err.message)}</div>`;
      return;
    }
    if (state.tab !== 'historial') return;
    const runs = res.data || [];
    view.innerHTML = `
      <div class="table-card">
        <div class="table-header">
          <span class="table-title">Historial de ejecuciones</span>
          <div class="rpt-table-actions">
            ${state.runsFilter ? '<button type="button" class="btn btn-secondary btn-sm" onclick="ReportsModule.clearRunsFilter()">Ver todas</button>' : ''}
            <span class="table-count">${res.total} ejecuciones</span>
          </div>
        </div>
        ${runs.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Automatización</th><th>Inicio</th><th>Origen</th><th>Estado</th><th>Registros</th><th>Acciones</th></tr></thead>
          <tbody>${runs.map(r => `
            <tr>
              <td><span class="td-primary">${escHtml(r.automatizacion)}</span><span class="rpt-row-sub">${escHtml(r.fuenteNombre || '')}</span></td>
              <td>${escHtml(formatDateTime(r.iniciadoEn))}</td>
              <td>${escHtml(r.origen)}</td>
              <td><span class="badge ${statusBadge(r.estado)}">${escHtml(r.estado)}</span>${r.mensaje ? `<span class="rpt-row-sub ${r.estado === 'Error' ? 'rpt-error-text' : ''}">${escHtml(r.mensaje)}</span>` : ''}</td>
              <td>${r.total ?? '—'}</td>
              <td class="td-actions">${r.estado === 'Exitosa' ? `<button type="button" class="btn btn-secondary btn-sm" onclick="ReportsModule.openRun(${r.id})">Ver resultado</button>` : ''}</td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('Sin ejecuciones', 'Aquí aparecerá cada informe generado automáticamente.')}
        ${res.totalPages > 1 ? `
          <div class="pagination">
            <span class="pagination-info">Página ${res.page} de ${res.totalPages}</span>
            <div class="pagination-btns">
              <button type="button" class="page-btn" aria-label="Página anterior" onclick="ReportsModule.goRunsPage(${res.page - 1})" ${res.page <= 1 ? 'disabled' : ''}>‹</button>
              <span class="page-btn active">${res.page}</span>
              <button type="button" class="page-btn" aria-label="Página siguiente" onclick="ReportsModule.goRunsPage(${res.page + 1})" ${res.page >= res.totalPages ? 'disabled' : ''}>›</button>
            </div>
          </div>` : ''}
      </div>`;
  }

  function goRunsPage(page) {
    state.runsPage = page;
    renderRuns();
  }

  function clearRunsFilter() {
    state.runsFilter = null;
    state.runsPage = 1;
    renderRuns();
  }

  async function openRun(id) {
    try {
      state.openRun = await API.getAutomationRun(id);
      App.openModal(`${state.openRun.automatizacion} · ${formatDateTime(state.openRun.iniciadoEn)}`,
        resultCard(state.openRun, { runId: id }),
        [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }],
        'rpt-modal-wide');
    } catch (err) {
      showError('No se pudo abrir el resultado', err);
    }
  }

  // ─── Historial de importaciones ────────────────────────────────────────────
  const IMPORT_MODULES = {
    employees: 'Servidores públicos', requests: 'Vacaciones', 'admin-requests': 'Solicitudes administrativas',
    incapacidades: 'Incapacidades', viaticos: 'Viáticos', horarios: 'Horarios', sst: 'Seguridad y Salud en el Trabajo',
  };

  async function renderImports(page = 1) {
    const view = document.getElementById('rpt-view');
    if (!view) return;
    view.innerHTML = '<div class="table-card"><div class="skeleton skeleton-line" style="width:100%;height:18px;"></div></div>';
    let res;
    try {
      res = await API.getImportHistory({ page, limit: 20 });
    } catch (err) {
      view.innerHTML = `<div class="table-card">${emptyState('No se pudo cargar el historial', err.message)}</div>`;
      return;
    }
    if (state.tab !== 'importaciones') return;
    state.imports = res.data || [];
    view.innerHTML = `
      <div class="table-card">
        <div class="table-header">
          <span class="table-title">Historial de importaciones</span>
          <span class="table-count">${res.total} cargas</span>
        </div>
        ${state.imports.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Módulo</th><th>Archivo</th><th>Fecha</th><th>Filas</th><th>Nuevos</th><th>Actualizados</th><th>Ya existían</th><th>Omitidos</th><th>Acciones</th></tr></thead>
          <tbody>${state.imports.map(i => `
            <tr>
              <td><span class="td-primary">${escHtml(IMPORT_MODULES[i.modulo] || i.modulo)}</span><span class="rpt-row-sub">${escHtml(i.usuario)}</span></td>
              <td>${escHtml(i.archivo || '—')}${i.resultado && i.resultado !== 'Completada' ? `<span class="rpt-row-sub rpt-error-text">${escHtml(i.resultado)}${i.motivo ? `: ${escHtml(i.motivo)}` : ''}</span>` : ''}</td>
              <td>${escHtml(formatDateTime(i.fecha))}</td>
              <td>${i.total}</td><td>${i.insertados}</td><td>${i.actualizados}</td><td>${i.duplicados}</td>
              <td class="${i.omitidos ? 'rpt-error-text' : ''}">${i.omitidos}</td>
              <td class="td-actions">${i.errores.length ? `<button type="button" class="btn btn-secondary btn-sm" onclick="ReportsModule.openImportErrors(${i.id})">Ver errores</button>` : ''}</td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('Sin importaciones', 'Aquí aparecerá cada carga masiva realizada desde los módulos.')}
        ${res.totalPages > 1 ? `
          <div class="pagination">
            <span class="pagination-info">Página ${res.page} de ${res.totalPages}</span>
            <div class="pagination-btns">
              <button type="button" class="page-btn" aria-label="Página anterior" onclick="ReportsModule.renderImports(${res.page - 1})" ${res.page <= 1 ? 'disabled' : ''}>‹</button>
              <span class="page-btn active">${res.page}</span>
              <button type="button" class="page-btn" aria-label="Página siguiente" onclick="ReportsModule.renderImports(${res.page + 1})" ${res.page >= res.totalPages ? 'disabled' : ''}>›</button>
            </div>
          </div>` : ''}
      </div>`;
  }

  function openImportErrors(id) {
    const item = (state.imports || []).find(i => i.id === id);
    if (!item) return;
    const body = `<ul class="rpt-import-errors">${item.errores.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul>
      ${item.omitidos > item.errores.length ? `<p class="page-desc">Se muestran los primeros ${item.errores.length} de ${item.omitidos} errores.</p>` : ''}`;
    App.openModal(`Errores de la carga: ${item.archivo || IMPORT_MODULES[item.modulo] || item.modulo}`, body, [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
    ]);
  }

  return {
    renderImports, openImportErrors,
    render, switchTab, selectSource, togglePeriod, clearFilters, generate, loadResultPage, exportReport,
    openSchedule, toggleCustomInterval, cancelEdit, runNow, togglePause, editAutomation,
    confirmDelete, openRuns, goRunsPage, clearRunsFilter, openRun,
  };
})();

window.ReportsModule = ReportsModule;
