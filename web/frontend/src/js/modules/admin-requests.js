/* ═══════════════════════════════════════════════════════════════════════════
   admin-requests.js — Gestión de Solicitudes Administrativas
   (Permisos Laborales, Incapacidades, Licencias)
   Gobernación de Boyacá · Talento 360
   ═══════════════════════════════════════════════════════════════════════════ */

const AdminRequestsModule = (() => {
  const TIPOS = { permisos: 'Permiso Laboral', licencias: 'Licencia' };
  const ESTADOS = ['Todos', 'Pendiente', 'En revisión', 'Aprobada', 'Finalizada', 'Rechazada'];

  let state = { tipo: 'Permiso Laboral', data: [], total: 0, page: 1, totalPages: 1, filters: {} };
  let permisosCatalogs = null;
  let currentSoportes = [];       // Nuevos archivos a subir en modal [{ nombre, tipo, base64, size }]
  let existingSoportes = [];      // Soportes ya guardados en el servidor [{ id_soporte, nombre_archivo, tipo_mime, tamano_bytes }]
  let deletedSoporteIds = [];     // IDs de soportes a eliminar en edición
  let currentModalidad = 'dia';   // 'horas' | 'dia' | 'varios_dias'
  let searchDebounceTimer = null;

  // ─── Helpers de Estilo y Badges ──────────────────────────────────────────────
  function badgeClass(estado) {
    const e = (estado || '').toLowerCase();
    if (e.includes('aprobad'))  return 'badge--aprobada';
    if (e.includes('finaliz'))  return 'badge--finalizada';
    if (e.includes('rechazad')) return 'badge--rechazada';
    if (e.includes('revis'))    return 'badge--revision';
    return 'badge--pendiente';
  }

  function tipoBadge(tipo) {
    if (tipo === 'Permiso Laboral') return 'badge--permiso';
    if (tipo === 'Incapacidad')     return 'badge--incapacidad';
    return 'badge--licencia';
  }

  function tipoPlural(tipo) {
    if (tipo === 'Permiso Laboral' || tipo === 'permisos') return 'Permisos Laborales';
    if (tipo === 'Incapacidad' || tipo === 'incapacidades') return 'Incapacidades';
    if (tipo === 'Licencia' || tipo === 'licencias') return 'Licencias';
    return tipo || 'Permisos Laborales';
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function cleanName(str) {
    return String(str || '').replace(/^\d+(\.\d+)*\s*/, '').trim();
  }

  // ─── Calendario Colombiano (Cálculo de Días Hábiles y Festivos) ───────────────
  const DAY_MS = 24 * 60 * 60 * 1000;
  function utc(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function addDays(date, n) { return new Date(date.getTime() + n * DAY_MS); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoKey(date) { return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`; }

  function easterSunday(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return utc(year, month, day);
  }

  function nextMonday(date) {
    const dow = date.getUTCDay();
    const delta = dow === 1 ? 0 : (8 - dow) % 7;
    return addDays(date, delta);
  }

  const festivosCache = new Map();
  function festivos(year) {
    if (festivosCache.has(year)) return festivosCache.get(year);
    const set = new Set();
    [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]].forEach(([m, d]) => set.add(isoKey(utc(year, m, d))));
    [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].forEach(([m, d]) => set.add(isoKey(nextMonday(utc(year, m, d)))));
    const easter = easterSunday(year);
    set.add(isoKey(addDays(easter, -3)));
    set.add(isoKey(addDays(easter, -2)));
    set.add(isoKey(nextMonday(addDays(easter, 39))));
    set.add(isoKey(nextMonday(addDays(easter, 60))));
    set.add(isoKey(nextMonday(addDays(easter, 68))));
    festivosCache.set(year, set);
    return set;
  }

  function isFestivo(date) { return festivos(date.getUTCFullYear()).has(isoKey(date)); }
  function isBusinessDay(date) {
    const dow = date.getUTCDay();
    return dow !== 0 && dow !== 6 && !isFestivo(date);
  }

  function countBusinessDays(start, end) {
    let n = 0;
    for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
      if (isBusinessDay(d)) n++;
    }
    return n;
  }

  function nthBusinessDay(start, n) {
    let d = start, count = isBusinessDay(d) ? 1 : 0;
    while (count < n) {
      d = addDays(d, 1);
      if (isBusinessDay(d)) count++;
    }
    return d;
  }

  function parseDMY(str) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((str || '').trim());
    if (!m) return null;
    const d = utc(+m[3], +m[2], +m[1]);
    return (d.getUTCFullYear() === +m[3] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[1]) ? d : null;
  }

  function parseInputDate(str) {
    if (!str) return null;
    const s = str.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const p = s.split('-');
      return utc(+p[0], +p[1], +p[2]);
    }
    return parseDMY(s);
  }

  function formatDMY(date) {
    if (!date) return '';
    return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
  }

  function formatISO(date) {
    if (!date) return '';
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  }

  function dmyToISO(dmy) {
    const d = parseDMY(dmy);
    return d ? formatISO(d) : '';
  }

  function isoToDMY(iso) {
    const d = parseInputDate(iso);
    return d ? formatDMY(d) : (iso || '');
  }

  // ─── Carga de Catálogos de Permisos Laborales ────────────────────────────────
  async function ensureCatalogs() {
    if (permisosCatalogs) return permisosCatalogs;
    try {
      permisosCatalogs = await API.getPermisosCatalogs();
      return permisosCatalogs;
    } catch (err) {
      console.warn('[AdminRequests] No se pudieron cargar los catálogos del servidor:', err);
      return null;
    }
  }

  // ─── Cambio de Pestaña Principal ─────────────────────────────────────────────
  function setTipo(tipo, activeBtn) {
    state.tipo = tipo; state.page = 1; state.filters = {};
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');

    const heading = document.getElementById('adm-heading');
    if (heading) heading.textContent = tipoPlural(tipo);
    const tableTitle = document.getElementById('adm-table-title');
    if (tableTitle) tableTitle.textContent = tipoPlural(tipo);

    const sideMap = {
      'Permiso Laboral': 'nav-permisos',
      'Incapacidad': 'nav-incapacidades',
      'Licencia': 'nav-licencias',
    };
    document.querySelectorAll('.nav-subitem').forEach(b => b.classList.remove('active'));
    const sideBtn = document.getElementById(sideMap[tipo]);
    if (sideBtn) sideBtn.classList.add('active');

    const countEl = document.getElementById('adm-count');
    if (countEl) {
      countEl.innerHTML = `<span class="skeleton" style="width:110px;height:14px;border-radius:4px;display:inline-block;" aria-hidden="true"></span>`;
    }
    renderSkeletonTable();
    load();
  }

  function renderSkeletonRows(count = 6) {
    return Array.from({ length: count }).map((_, i) => `
      <tr class="skeleton-row" aria-hidden="true" style="animation-delay: ${i * 0.08}s">
        <td><div class="skeleton skeleton-line" style="width: 85px; height: 16px; border-radius: 4px;"></div></td>
        <td>
          <div class="skeleton-user-cell">
            <div class="skeleton skeleton-avatar" aria-hidden="true"></div>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-line skeleton-line--title" style="width: ${i % 2 === 0 ? '80%' : '65%'}; height: 14px;"></div>
              <div class="skeleton skeleton-line" style="width: 45%; height: 11px;"></div>
            </div>
          </div>
        </td>
        <td><div class="skeleton skeleton-line" style="width: ${i % 3 === 0 ? '85%' : '70%'}; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-badge" style="width: 95px; height: 22px;"></div></td>
        <td><div class="skeleton skeleton-line" style="width: 75px; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-line" style="width: 55px; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-badge" style="width: 88px; height: 24px;"></div></td>
        <td>
          <div class="skeleton-actions-wrap">
            <div class="skeleton skeleton-btn"></div>
            <div class="skeleton skeleton-btn"></div>
            ${Auth.canEdit() ? '<div class="skeleton skeleton-btn"></div>' : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderSkeletonTable() {
    const tbody = document.getElementById('adm-tbody');
    if (!tbody) return;
    tbody.setAttribute('aria-busy', 'true');
    tbody.setAttribute('role', 'progressbar');
    tbody.setAttribute('aria-label', 'Cargando listado de solicitudes...');
    tbody.innerHTML = renderSkeletonRows(6);
  }

  async function load() {
    renderSkeletonTable();
    try {
      const params = { tipo: state.tipo, page: state.page, limit: 20, ...state.filters };
      const res = await API.getAdminRequests(params);
      state.data = res.data || [];
      state.total = res.total || 0;
      state.totalPages = res.totalPages || 1;
      renderTable();
      renderPagination();
      const countEl = document.getElementById('adm-count');
      if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} registros`;
    } catch (err) { App.showToast('Error al cargar solicitudes: ' + err.message, 'error'); }
  }

  function renderTable() {
    const tbody = document.getElementById('adm-tbody');
    if (!tbody) return;
    tbody.removeAttribute('role');
    tbody.setAttribute('aria-busy', 'false');
    if (!state.data.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="empty-state-title">No hay solicitudes de ${state.tipo}</span>
        <span class="empty-state-desc">No se encontraron registros coincidentes.</span>
        </div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.data.map(r => {
      const durLabel = r.duracion || (r.diasSolicitados != null ? `${r.diasSolicitados} d` : '—');
      return `
      <tr>
        <td class="td-radicado">${escHtml(r.radicado)}</td>
        <td>
          <div class="user-table-cell">
            <span class="td-primary" title="${escHtml(r.persona)}">${escHtml(truncate(r.persona, 28) || '—')}</span>
            <span class="user-table-cc font-mono">${r.documento ? `C.C. ${escHtml(r.documento)}` : '—'}</span>
          </div>
        </td>
        <td title="${escHtml(cleanName(r.dependencia))}">${escHtml(truncate(cleanName(r.dependencia), 26) || '—')}</td>
        <td><span class="badge ${tipoBadge(r.tipo)}">${escHtml(r.tipo)}</span></td>
        <td>${escHtml(r.fechaInicio || '—')}</td>
        <td>
          <span class="badge badge--neutral" title="Duración calculada: ${escHtml(durLabel)}" style="font-weight:600;font-size:0.78rem;">
            ${escHtml(durLabel)}
          </span>
        </td>
        <td>
          <button type="button" class="badge badge--interactive ${badgeClass(r.estado)}" onclick="AdminRequestsModule.openStatusPicker(${r.id})" title="Clic para cambiar estado de esta solicitud" aria-label="Cambiar estado: ${r.estado}">
            <span>${escHtml(r.estado)}</span>
            <svg class="badge-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </td>
        <td class="td-actions">
          <div class="td-actions-wrap">
            <button class="btn-action-view" onclick="AdminRequestsModule.openView(${r.id})" title="Ver Detalles de Solicitud">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-action-edit" onclick="AdminRequestsModule.openEdit(${r.id})" title="Editar Solicitud">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${Auth.canEdit() ? `<button class="btn-action-delete" onclick="AdminRequestsModule.confirmDelete(${r.id},'${escHtml(r.persona)}')" title="Eliminar Solicitud">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function renderPagination() {
    const el = document.getElementById('adm-pagination');
    if (!el) return;
    el.innerHTML = `
      <span class="pagination-info">Mostrando ${state.data.length} de ${state.total.toLocaleString('es-CO')}</span>
      <div class="pagination-btns">
        <button class="page-btn" onclick="AdminRequestsModule.goPage(${state.page-1})" ${state.page<=1?'disabled':''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
        <span class="page-btn active">${state.page}</span>
        <span style="color:var(--text-muted);font-size:var(--text-sm)">/ ${state.totalPages}</span>
        <button class="page-btn" onclick="AdminRequestsModule.goPage(${state.page+1})" ${state.page>=state.totalPages?'disabled':''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMULARIO DINÁMICO DE PERMISOS LABORALES (GOBERNACIÓN DE BOYACÁ)
  // ═══════════════════════════════════════════════════════════════════════════

  function buildPermisoFormHtml(r = {}, isEdit = false) {
    const cat = permisosCatalogs || {
      sectoriales: [], niveles: [], modalidades: [], jornadas: {}, motivos: [], soportes: {}
    };

    const curSectorial = r.sectorial || '';
    const curNivel = r.nivel || '';
    const curModalidad = r.modalidad || 'dia';
    const curJornada = r.jornada || 'Todo el día';
    const curMotivoCat = r.motivoCategoria || 'DILIGENCIA_PERSONAL';

    // Sectoriales
    const sectorialOptions = cat.sectoriales.map(s => {
      const sel = s.nombre === curSectorial ? 'selected' : '';
      return `<option value="${escHtml(s.nombre)}" ${sel}>${escHtml(s.nombre)}</option>`;
    }).join('');

    // Niveles
    const nivelOptions = cat.niveles.map(n => {
      const sel = n.nombre === curNivel ? 'selected' : '';
      return `<option value="${escHtml(n.nombre)}" ${sel}>${escHtml(n.nombre)}</option>`;
    }).join('');

    // Motivos
    const motivoOptions = cat.motivos.map(m => {
      const sel = m.id === curMotivoCat ? 'selected' : '';
      return `<option value="${escHtml(m.id)}" ${sel}>${escHtml(m.label)}</option>`;
    }).join('');

    // Fechas en formato ISO para los inputs <input type="date">
    const fiIso = dmyToISO(r.fechaInicio) || new Date().toISOString().slice(0, 10);
    const ffIso = dmyToISO(r.fechaFin) || fiIso;

    return `
      <div class="permiso-form-wrap">
        <div class="permiso-alert-banner permiso-alert-banner--info" style="margin-bottom:14px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <div>
            <strong>Formulario Oficial de Permisos Laborales · Gobernación de Boyacá</strong>
            <div style="font-size:0.8rem;opacity:0.9;">Complete los campos requeridos. Al radicar la solicitud se enviará una notificación por correo electrónico institucional al jefe inmediato correspondiente.</div>
          </div>
        </div>

        <!-- INFORMACIÓN DEL SERVIDOR PÚBLICO -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Información del Servidor Público</span>
          </div>

          <div class="form-grid">
            <div class="form-group span-2" style="position:relative;">
              <label class="form-label">Buscar Servidor (Cédula o Nombre) *</label>
              <div class="autocomplete-wrapper" style="position:relative;">
                <input id="af-perm-search" class="form-input" placeholder="Escriba el nombre o cédula para autocompletar..." autocomplete="off" />
                <div id="af-perm-autocomplete" class="autocomplete-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:999;"></div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Número de Cédula *</label>
              <input id="af-perm-doc" class="form-input font-mono" placeholder="Ej: 1049601234" value="${escHtml(r.documento || '')}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Nombre Completo del Servidor *</label>
              <input id="af-perm-persona" class="form-input" placeholder="APELLIDOS Y NOMBRES COMPLETOS" value="${escHtml(r.persona || '')}" required />
            </div>

            <!-- Código y Grado del Servidor -->
            <div class="form-group">
              <label class="form-label">Código del Cargo / Servidor</label>
              <input id="af-perm-codigo" class="form-input font-mono" placeholder="Ej: 219" value="${escHtml(r.codigo || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label">Grado del Servidor</label>
              <input id="af-perm-grado" class="form-input font-mono" placeholder="Ej: 01" value="${escHtml(r.grado || '')}" />
            </div>

            <div class="form-group span-2">
              <label class="form-label">Correo Institucional del Servidor *</label>
              <input id="af-perm-email" type="email" class="form-input" placeholder="ejemplo@boyaca.gov.co" value="${escHtml(r.correoSolicitante || '')}" required />
              <span class="form-help-text" style="font-size:0.75rem;color:var(--text-muted);">Debe ser el correo institucional del servidor (@boyaca.gov.co) para recibir confirmación.</span>
            </div>
          </div>
        </div>

        <!-- UBICACIÓN ADMINISTRATIVA Y CARGO -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Ubicación Administrativa y Cargo</span>
          </div>

          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label">Sectorial *</label>
              <select id="af-perm-sectorial" class="filter-select" onchange="AdminRequestsModule.onSectorialChange()">
                <option value="">-- Seleccione la Sectorial --</option>
                ${sectorialOptions}
              </select>
            </div>

            <div class="form-group span-2">
              <label class="form-label">Dependencia / Dirección / Oficina *</label>
              <select id="af-perm-dep" class="filter-select">
                <option value="">-- Primero seleccione una Sectorial --</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Nivel Jerárquico *</label>
              <select id="af-perm-nivel" class="filter-select" onchange="AdminRequestsModule.onNivelChange()">
                <option value="">-- Seleccione Nivel --</option>
                ${nivelOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Cargo *</label>
              <select id="af-perm-cargo" class="filter-select">
                <option value="">-- Primero seleccione el Nivel --</option>
              </select>
            </div>
          </div>
        </div>

        <!-- MODALIDAD Y TIEMPO SOLICITADO -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Modalidad y Duración del Permiso</span>
          </div>

          <!-- Selector Segmentado de Modalidad -->
          <div class="permiso-modalidad-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
            <button type="button" id="btn-mod-horas" class="permiso-modalidad-card ${curModalidad === 'horas' ? 'is-active' : ''}" onclick="AdminRequestsModule.setModalidad('horas')">
              <div style="font-size:1.4rem;margin-bottom:4px;">⏱️</div>
              <div class="permiso-modalidad-title">Unas Horas</div>
              <div class="permiso-modalidad-desc">Salida y entrada dentro de una jornada</div>
            </button>

            <button type="button" id="btn-mod-dia" class="permiso-modalidad-card ${curModalidad === 'dia' ? 'is-active' : ''}" onclick="AdminRequestsModule.setModalidad('dia')">
              <div style="font-size:1.4rem;margin-bottom:4px;">☀️</div>
              <div class="permiso-modalidad-title">Un Día</div>
              <div class="permiso-modalidad-desc">Jornada completa o medio día</div>
            </button>

            <button type="button" id="btn-mod-varios" class="permiso-modalidad-card ${curModalidad === 'varios_dias' ? 'is-active' : ''}" onclick="AdminRequestsModule.setModalidad('varios_dias')">
              <div style="font-size:1.4rem;margin-bottom:4px;">📅</div>
              <div class="permiso-modalidad-title">Varios Días</div>
              <div class="permiso-modalidad-desc">Rango de fechas consecutivas</div>
            </button>
          </div>

          <!-- Sub-panel MODALIDAD: HORAS -->
          <div id="perm-pane-horas" style="display:${curModalidad === 'horas' ? 'block' : 'none'};">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Fecha del Permiso *</label>
                <input id="af-perm-horas-fecha" type="date" class="form-input" value="${fiIso}" onchange="AdminRequestsModule.calcHorasPermiso()" />
              </div>

              <div class="form-group">
                <label class="form-label">Jornada Laboral *</label>
                <select id="af-perm-horas-jornada" class="filter-select" onchange="AdminRequestsModule.calcHorasPermiso()">
                  <option value="Mañana" ${(r.jornada || '').includes('Mañana') ? 'selected' : ''}>Mañana (08:00 a 12:00)</option>
                  <option value="Tarde" ${(r.jornada || '').includes('Tarde') ? 'selected' : ''}>Tarde (14:00 a 18:00)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Hora de Salida *</label>
                <input id="af-perm-horas-salida" type="time" class="form-input" value="${escHtml(r.horaSalida || '09:00')}" onchange="AdminRequestsModule.calcHorasPermiso()" />
              </div>

              <div class="form-group">
                <label class="form-label">Hora de Entrada *</label>
                <input id="af-perm-horas-entrada" type="time" class="form-input" value="${escHtml(r.horaEntrada || '11:00')}" onchange="AdminRequestsModule.calcHorasPermiso()" />
              </div>

              <div class="form-group span-2">
                <div id="af-perm-horas-resumen" class="permiso-alert-banner permiso-alert-banner--info" style="display:flex;align-items:center;justify-content:space-between;">
                  <span>Cálculo: <strong id="af-perm-horas-val">2 horas</strong></span>
                  <span id="af-perm-horas-badge" class="badge badge--aprobada">Ventana válida</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Sub-panel MODALIDAD: 1 DÍA -->
          <div id="perm-pane-dia" style="display:${curModalidad === 'dia' ? 'block' : 'none'};">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Fecha del Permiso *</label>
                <input id="af-perm-dia-fecha" type="date" class="form-input" value="${fiIso}" />
              </div>

              <div class="form-group">
                <label class="form-label">Jornada Solicitada *</label>
                <select id="af-perm-dia-jornada" class="filter-select">
                  <option value="Todo el día" ${curJornada === 'Todo el día' ? 'selected' : ''}>Todo el día</option>
                  <option value="Toda la mañana" ${curJornada === 'Toda la mañana' ? 'selected' : ''}>Toda la mañana (08:00 a 12:00)</option>
                  <option value="Toda la tarde" ${curJornada === 'Toda la tarde' ? 'selected' : ''}>Toda la tarde (14:00 a 18:00)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Sub-panel MODALIDAD: VARIOS DÍAS -->
          <div id="perm-pane-varios" style="display:${curModalidad === 'varios_dias' ? 'block' : 'none'};">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Fecha de Inicio *</label>
                <input id="af-perm-varios-fi" type="date" class="form-input" value="${fiIso}" onchange="AdminRequestsModule.calcDiasHabiles()" />
              </div>

              <div class="form-group">
                <label class="form-label">Fecha de Fin *</label>
                <input id="af-perm-varios-ff" type="date" class="form-input" value="${ffIso}" onchange="AdminRequestsModule.calcDiasHabiles()" />
              </div>

              <div class="form-group span-2">
                <div id="af-perm-varios-resumen" class="permiso-alert-banner permiso-alert-banner--info" style="display:flex;align-items:center;justify-content:space-between;">
                  <span>Días hábiles solicitados: <strong id="af-perm-dias-val">1 día hábil</strong></span>
                  <span style="font-size:0.75rem;opacity:0.85;">Excluye sábados, domingos y festivos colombianos</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- MOTIVO / JUSTIFICACIÓN -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Motivo o Justificación</span>
          </div>

          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label">Categoría del Motivo *</label>
              <select id="af-perm-motivo-cat" class="filter-select" onchange="AdminRequestsModule.onMotivoCatChange()">
                ${motivoOptions}
              </select>
            </div>

            <!-- Sub-opción condicional: INCENTIVOS -->
            <div id="perm-wrap-incentivos" class="form-group span-2" style="display:${curMotivoCat === 'INCENTIVOS' ? 'block' : 'none'};">
              <label class="form-label">Tipo de Incentivo *</label>
              <select id="af-perm-motivo-inc" class="filter-select" onchange="AdminRequestsModule.onMotivoIncChange()">
                <option value="">-- Seleccione el Incentivo --</option>
              </select>
            </div>

            <!-- Banner Informativo de Reglas de Incentivo -->
            <div id="perm-incentivo-banner" class="form-group span-2" style="display:none;">
              <div class="permiso-alert-banner permiso-alert-banner--warn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div id="perm-incentivo-banner-text" style="font-size:0.82rem;"></div>
              </div>
            </div>

            <div class="form-group span-2">
              <label class="form-label">Detalle del Motivo / Observaciones</label>
              <textarea id="af-perm-obs" class="form-input" rows="2" placeholder="Detalle la justificación o información adicional para su jefe inmediato...">${escHtml(r.observaciones || '')}</textarea>
            </div>
          </div>
        </div>

        <!-- NOTIFICACIÓN AL JEFE INMEDIATO -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Notificación al Jefe Inmediato</span>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nombre del Jefe Inmediato *</label>
              <input id="af-perm-jefe-nombre" class="form-input" placeholder="Nombre completo del jefe..." value="${escHtml(r.jefeNombre || '')}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Correo Institucional del Jefe Inmediato *</label>
              <input id="af-perm-jefe-correo" type="email" class="form-input" placeholder="jefe@boyaca.gov.co" value="${escHtml(r.jefeCorreo || '')}" oninput="AdminRequestsModule.validateJefeEmailLive()" required />
              <div id="af-perm-jefe-correo-feedback" style="font-size:0.75rem;margin-top:3px;color:var(--text-muted);">
                Debe pertenecer al dominio institucional (@boyaca.gov.co).
              </div>
            </div>
          </div>
        </div>

        <!-- SOPORTES Y ANEXOS -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Soportes y Anexos (PDF, JPG, PNG)</span>
          </div>

          <div id="perm-dropzone" class="permiso-soportes-dropzone" onclick="document.getElementById('af-perm-file-input').click()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:36px;height:36px;margin:0 auto 8px;color:var(--color-green-dark,#287522);display:block;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">Haga clic aquí o arrastre los archivos de soporte</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Formatos permitidos: PDF, JPG, PNG (máx. 5 MB por archivo, hasta 5 archivos)</div>
            <input type="file" id="af-perm-file-input" multiple accept=".pdf,.png,.jpg,.jpeg" style="display:none;" onchange="AdminRequestsModule.handleFileSelect(event)" />
          </div>

          <!-- Lista de Archivos Cargados -->
          <div id="perm-soportes-list" class="soporte-file-list" style="margin-top:12px;"></div>
        </div>
      </div>
    `;
  }

  // ─── Inicialización y Binders del Formulario de Permisos ─────────────────────
  async function initPermisoForm(r = {}, isEdit = false) {
    currentSoportes = [];
    deletedSoporteIds = [];
    existingSoportes = [];
    currentModalidad = r.modalidad || 'dia';

    await ensureCatalogs();

    // Poblar Dependencias de la sectorial inicial (limpiando números)
    const curSectorial = r.sectorial || '';
    populateDependencias(curSectorial, r.dependencia);

    // Poblar Cargos del nivel inicial
    const curNivel = r.nivel || '';
    populateCargos(curNivel, r.cargo);

    // Poblar Incentivos si aplica
    const curMotivoCat = r.motivoCategoria || 'DILIGENCIA_PERSONAL';
    populateIncentivos(curMotivoCat, r.motivoIncentivo);

    // Cargar soportes existentes si estamos editando
    if (isEdit && r.id) {
      try {
        const sops = await API.getAdminRequestSoportes(r.id);
        existingSoportes = Array.isArray(sops) ? sops : [];
      } catch (err) {
        console.warn('[AdminRequests] Error al cargar soportes:', err);
      }
    }

    renderSoportesList();
    bindAutocomplete();
    bindDropzoneEvents();

    if (currentModalidad === 'horas') calcHorasPermiso();
    else if (currentModalidad === 'varios_dias') calcDiasHabiles();
  }

  function populateDependencias(sectorialNombre, selectedVal) {
    const selEl = document.getElementById('af-perm-dep');
    if (!selEl) return;
    const cat = permisosCatalogs;
    if (!cat || !cat.sectoriales) return;

    const sec = cat.sectoriales.find(s => s.nombre === sectorialNombre);
    if (!sec || !sec.dependencias || !sec.dependencias.length) {
      selEl.innerHTML = `<option value="${escHtml(cleanName(sectorialNombre || ''))}">${escHtml(cleanName(sectorialNombre) || '-- Sin dependencias registradas --')}</option>`;
      return;
    }

    const cleanSelected = cleanName(selectedVal);

    selEl.innerHTML = sec.dependencias.map(d => {
      const cleaned = cleanName(d);
      const isSel = (cleaned === cleanSelected || sec.dependencias.length === 1) ? 'selected' : '';
      return `<option value="${escHtml(cleaned)}" ${isSel}>${escHtml(cleaned)}</option>`;
    }).join('');
  }

  function populateCargos(nivelNombre, selectedVal) {
    const selEl = document.getElementById('af-perm-cargo');
    if (!selEl) return;
    const cat = permisosCatalogs;
    if (!cat || !cat.niveles) return;

    const niv = cat.niveles.find(n => n.nombre === nivelNombre);
    if (!niv || !niv.cargos || !niv.cargos.length) {
      selEl.innerHTML = '<option value="">-- No hay cargos definidos --</option>';
      return;
    }

    selEl.innerHTML = niv.cargos.map(c => {
      const isSel = (c === selectedVal || niv.cargos.length === 1) ? 'selected' : '';
      return `<option value="${escHtml(c)}" ${isSel}>${escHtml(c)}</option>`;
    }).join('');
  }

  function populateIncentivos(catId, selectedVal) {
    const wrap = document.getElementById('perm-wrap-incentivos');
    const selEl = document.getElementById('af-perm-motivo-inc');
    if (!selEl || !wrap) return;

    if (catId !== 'INCENTIVOS') {
      wrap.style.display = 'none';
      updateIncentivoBanner(null);
      return;
    }

    wrap.style.display = 'block';
    const cat = permisosCatalogs;
    const m = (cat && cat.motivos) ? cat.motivos.find(x => x.id === 'INCENTIVOS') : null;
    const ops = (m && m.opciones) ? m.opciones : [];

    selEl.innerHTML = '<option value="">-- Seleccione el Incentivo --</option>' +
      ops.map(o => {
        const isSel = o.id === selectedVal ? 'selected' : '';
        return `<option value="${escHtml(o.id)}" ${isSel}>${escHtml(o.label)}</option>`;
      }).join('');

    if (selectedVal) {
      const op = ops.find(o => o.id === selectedVal);
      updateIncentivoBanner(op);
    }
  }

  function updateIncentivoBanner(op) {
    const banner = document.getElementById('perm-incentivo-banner');
    const textEl = document.getElementById('perm-incentivo-banner-text');
    if (!banner || !textEl) return;

    if (!op || !op.reglas || !op.reglas.ayuda) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'block';
    let extra = '';
    if (op.reglas.soporteObligatorio) {
      extra += ' <strong>(Soporte documental obligatorio en sección de soportes)</strong>.';
    }
    if (op.reglas.diasExactos) {
      extra += ` <strong>Duración exacta fijada por norma: ${op.reglas.diasExactos} días hábiles</strong>.`;
    }
    textEl.innerHTML = `${escHtml(op.reglas.ayuda)}${extra}`;
  }

  function onSectorialChange() {
    const secName = document.getElementById('af-perm-sectorial')?.value || '';
    populateDependencias(secName);
  }

  function onNivelChange() {
    const nivName = document.getElementById('af-perm-nivel')?.value || '';
    populateCargos(nivName);
  }

  function onMotivoCatChange() {
    const catId = document.getElementById('af-perm-motivo-cat')?.value || '';
    populateIncentivos(catId);
  }

  function onMotivoIncChange() {
    const incId = document.getElementById('af-perm-motivo-inc')?.value || '';
    const cat = permisosCatalogs;
    const m = cat ? cat.motivos.find(x => x.id === 'INCENTIVOS') : null;
    const op = (m && m.opciones) ? m.opciones.find(o => o.id === incId) : null;
    updateIncentivoBanner(op);

    // Regla especial de MATRIMONIO: 3 días hábiles fijos en modalidad varios_dias
    if (incId === 'MATRIMONIO') {
      setModalidad('varios_dias');
      const fiEl = document.getElementById('af-perm-varios-fi');
      const ffEl = document.getElementById('af-perm-varios-ff');
      if (fiEl && ffEl && fiEl.value) {
        const start = parseInputDate(fiEl.value);
        if (start) {
          const end = nthBusinessDay(start, 3);
          ffEl.value = formatISO(end);
          calcDiasHabiles();
        }
      }
    }
  }

  function setModalidad(mod) {
    currentModalidad = mod;
    ['horas', 'dia', 'varios'].forEach(m => {
      const btn = document.getElementById(`btn-mod-${m}`);
      const pane = document.getElementById(`perm-pane-${m}`);
      const isTarget = (m === 'varios' ? 'varios_dias' : m) === mod;
      if (btn) btn.classList.toggle('is-active', isTarget);
      if (pane) pane.style.display = isTarget ? 'block' : 'none';
    });

    if (mod === 'horas') calcHorasPermiso();
    else if (mod === 'varios_dias') calcDiasHabiles();
  }

  function calcHorasPermiso() {
    const jornada = document.getElementById('af-perm-horas-jornada')?.value || 'Mañana';
    const salida = document.getElementById('af-perm-horas-salida')?.value || '';
    const entrada = document.getElementById('af-perm-horas-entrada')?.value || '';
    const valEl = document.getElementById('af-perm-horas-val');
    const badgeEl = document.getElementById('af-perm-horas-badge');
    if (!valEl || !badgeEl) return;

    if (!salida || !entrada) {
      valEl.textContent = 'Indique hora de salida y entrada';
      badgeEl.className = 'badge badge--pendiente';
      badgeEl.textContent = 'Incompleto';
      return;
    }

    const [sh, sm] = salida.split(':').map(Number);
    const [eh, em] = entrada.split(':').map(Number);
    const sMin = sh * 60 + sm;
    const eMin = eh * 60 + em;
    const diff = eMin - sMin;

    if (diff <= 0) {
      valEl.textContent = 'La hora de entrada debe ser posterior a la de salida';
      badgeEl.className = 'badge badge--rechazada';
      badgeEl.textContent = 'Horario inválido';
      return;
    }

    // Validación de ventana horaria según jornada
    const isManana = jornada.includes('Mañana');
    const wMin = isManana ? 8 * 60 : 14 * 60;
    const wMax = isManana ? 12 * 60 : 18 * 60;
    const windowName = isManana ? '08:00 a 12:00' : '14:00 a 18:00';

    if (sMin < wMin || eMin > wMax) {
      valEl.textContent = `Fuera de la ventana de ${jornada} (${windowName})`;
      badgeEl.className = 'badge badge--rechazada';
      badgeEl.textContent = 'Fuera de jornada';
      return;
    }

    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    let label = '';
    if (hrs > 0 && mins > 0) label = `${hrs} h ${mins} min`;
    else if (hrs > 0) label = `${hrs} ${hrs === 1 ? 'hora' : 'horas'}`;
    else label = `${mins} minutos`;

    valEl.textContent = `${label} (${(diff / 60).toFixed(2)} horas)`;
    badgeEl.className = 'badge badge--aprobada';
    badgeEl.textContent = 'Válido';
  }

  function calcDiasHabiles() {
    const fiVal = document.getElementById('af-perm-varios-fi')?.value;
    const ffVal = document.getElementById('af-perm-varios-ff')?.value;
    const valEl = document.getElementById('af-perm-dias-val');
    if (!valEl) return;

    if (!fiVal || !ffVal) {
      valEl.textContent = 'Seleccione fechas de inicio y fin';
      return;
    }

    const dStart = parseInputDate(fiVal);
    const dEnd = parseInputDate(ffVal);
    if (!dStart || !dEnd) {
      valEl.textContent = 'Fechas inválidas';
      return;
    }

    if (dEnd.getTime() < dStart.getTime()) {
      valEl.innerHTML = '<span style="color:#ef4444;">La fecha de fin no puede ser anterior a la de inicio</span>';
      return;
    }

    const n = countBusinessDays(dStart, dEnd);
    valEl.textContent = `${n} ${n === 1 ? 'día hábil' : 'días hábiles'}`;
  }

  function validateJefeEmailLive() {
    const input = document.getElementById('af-perm-jefe-correo');
    const feed = document.getElementById('af-perm-jefe-correo-feedback');
    if (!input || !feed) return;
    const val = input.value.trim().toLowerCase();
    if (!val) {
      feed.style.color = 'var(--text-muted)';
      feed.textContent = 'Debe pertenecer al dominio institucional (@boyaca.gov.co).';
      return;
    }
    if (!val.endsWith('@boyaca.gov.co')) {
      feed.style.color = '#ef4444';
      feed.textContent = '⚠ Atención: El correo debe terminar en @boyaca.gov.co para el envío institucional.';
    } else {
      feed.style.color = '#10b981';
      feed.textContent = '✓ Dominio institucional correcto (@boyaca.gov.co).';
    }
  }

  // ─── Autocompletado de Servidores Públicos ───────────────────────────────────
  function bindAutocomplete() {
    const searchInput = document.getElementById('af-perm-search');
    const dropdown = document.getElementById('af-perm-autocomplete');
    if (!searchInput || !dropdown) return;

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchDebounceTimer);
      if (q.length < 2) {
        dropdown.style.display = 'none';
        return;
      }
      searchDebounceTimer = setTimeout(async () => {
        try {
          const res = await API.getEmployees({ q, limit: 7 });
          const emps = res.data || [];
          if (!emps.length) {
            dropdown.innerHTML = '<div style="padding:10px 14px;color:var(--text-muted);font-size:0.85rem;">No se encontraron servidores coincidentes.</div>';
            dropdown.style.display = 'block';
            return;
          }
          dropdown.innerHTML = emps.map(emp => {
            const nom = emp.apellidos_nombres || emp.persona || emp.nombreCompleto || `${emp.primer_apellido || ''} ${emp.primer_nombre || ''}`.trim();
            const doc = emp.documento || emp.cedula || '';
            const dep = cleanName(emp.dependencia || '');
            const car = emp.cargo || '';
            const email = emp.email || emp.correo || emp.correoInstitucional || '';
            const codigo = emp.codigoActual || emp.codigoBase || emp.codigo || '';
            const grado = emp.gradoActual || emp.gradoBase || emp.grado || '';
            const empJson = escHtml(JSON.stringify({ nom, doc, dep, car, email, codigo, grado }));
            return `
              <div class="autocomplete-item" onclick="AdminRequestsModule.selectEmployee(${empJson})" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--color-border,#e2e8f0);">
                <div class="autocomplete-item-name" style="font-weight:700;font-size:0.88rem;color:var(--text-primary);">${escHtml(nom)}</div>
                <div class="autocomplete-item-meta" style="font-size:0.75rem;color:var(--text-muted);">
                  C.C. ${escHtml(doc)} ${codigo ? `· Cód. ${escHtml(codigo)}` : ''} ${grado ? `· Grado ${escHtml(grado)}` : ''} · ${escHtml(dep || 'Sin dep.')} · ${escHtml(car || 'Sin cargo')}
                </div>
              </div>
            `;
          }).join('');
          dropdown.style.display = 'block';
        } catch (err) {
          console.warn('[AdminRequests] Error en autocomplete:', err);
        }
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  function selectEmployee(emp) {
    const searchInput = document.getElementById('af-perm-search');
    const docInput = document.getElementById('af-perm-doc');
    const nomInput = document.getElementById('af-perm-persona');
    const emailInput = document.getElementById('af-perm-email');
    const codInput = document.getElementById('af-perm-codigo');
    const gradoInput = document.getElementById('af-perm-grado');
    const dropdown = document.getElementById('af-perm-autocomplete');

    if (dropdown) dropdown.style.display = 'none';
    if (searchInput) searchInput.value = emp.nom || '';
    if (docInput) docInput.value = emp.doc || '';
    if (nomInput) nomInput.value = emp.nom || '';
    if (emailInput && emp.email) emailInput.value = emp.email;
    if (codInput) codInput.value = emp.codigo || '';
    if (gradoInput) gradoInput.value = emp.grado || '';

    // Auto-detección de Sectorial y Dependencia
    const cat = permisosCatalogs;
    if (cat && cat.sectoriales && emp.dep) {
      const depUpper = cleanName(emp.dep).toUpperCase();
      let matchedSec = null;
      let matchedDep = null;

      for (const s of cat.sectoriales) {
        if (depUpper.includes(s.nombre.toUpperCase()) || s.nombre.toUpperCase().includes(depUpper)) {
          matchedSec = s.nombre;
        }
        for (const d of (s.dependencias || [])) {
          const dClean = cleanName(d).toUpperCase();
          if (depUpper.includes(dClean) || dClean.includes(depUpper)) {
            matchedSec = s.nombre;
            matchedDep = cleanName(d);
            break;
          }
        }
        if (matchedDep) break;
      }

      if (matchedSec) {
        const secEl = document.getElementById('af-perm-sectorial');
        if (secEl) {
          secEl.value = matchedSec;
          populateDependencias(matchedSec, matchedDep);
        }
      }
    }

    // Auto-detección de Nivel y Cargo
    if (cat && cat.niveles && emp.car) {
      const carUpper = emp.car.toUpperCase();
      let matchedNiv = null;
      let matchedCar = null;

      for (const n of cat.niveles) {
        for (const c of (n.cargos || [])) {
          if (carUpper.includes(c.toUpperCase()) || c.toUpperCase().includes(carUpper)) {
            matchedNiv = n.nombre;
            matchedCar = c;
            break;
          }
        }
        if (matchedCar) break;
      }

      if (matchedNiv) {
        const nivEl = document.getElementById('af-perm-nivel');
        if (nivEl) {
          nivEl.value = matchedNiv;
          populateCargos(matchedNiv, matchedCar);
        }
      }
    }

    App.showToast(`Servidor ${emp.nom} seleccionado.`, 'info');
  }

  // ─── Gestión de Archivos y Soportes (Drag & Drop) ─────────────────────────────
  function bindDropzoneEvents() {
    const dropzone = document.getElementById('perm-dropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault(); e.stopPropagation();
        dropzone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault(); e.stopPropagation();
        dropzone.classList.remove('is-dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length) processFiles(files);
    });
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files && files.length) processFiles(files);
  }

  function processFiles(files) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    const maxBytes = 5 * 1024 * 1024;
    const totalFiles = (existingSoportes.length - deletedSoporteIds.length) + currentSoportes.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (totalFiles + currentSoportes.length >= 5) {
        App.showToast('No puede adjuntar más de 5 archivos de soporte en total.', 'warning');
        break;
      }
      if (!allowed.includes(file.type.toLowerCase())) {
        App.showToast(`Archivo "${file.name}" rechazado: solo se permiten archivos PDF, JPG o PNG.`, 'warning');
        continue;
      }
      if (file.size > maxBytes) {
        App.showToast(`Archivo "${file.name}" supera el límite de 5 MB (${formatBytes(file.size)}).`, 'warning');
        continue;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const comma = dataUrl.indexOf(',');
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        currentSoportes.push({
          nombre: file.name,
          tipo: file.type || 'application/pdf',
          size: file.size,
          base64: base64
        });
        renderSoportesList();
      };
      reader.readAsDataURL(file);
    }
  }

  function renderSoportesList() {
    const listEl = document.getElementById('perm-soportes-list');
    if (!listEl) return;

    let html = '';

    // Soportes Existentes (en edición)
    existingSoportes.forEach(s => {
      const isDeleted = deletedSoporteIds.includes(s.id_soporte);
      html += `
        <div class="soporte-file-item" style="${isDeleted ? 'opacity:0.4;text-decoration:line-through;background:rgba(239,68,68,0.08);' : ''}">
          <div class="soporte-file-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--color-green-dark,#287522);flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span style="font-weight:600;">${escHtml(s.nombre_archivo)}</span>
            <span style="color:var(--text-muted);font-size:0.75rem;">(${formatBytes(s.tamano_bytes)})</span>
            <span class="badge badge--aprobada" style="font-size:0.7rem;">Guardado</span>
          </div>
          <div>
            ${isDeleted ? `
              <button type="button" class="btn btn-secondary" style="padding:3px 8px;font-size:0.75rem;" onclick="AdminRequestsModule.restoreExistingSoporte(${s.id_soporte})">Restaurar</button>
            ` : `
              <button type="button" class="btn btn-secondary" style="padding:3px 8px;font-size:0.75rem;color:#ef4444;" onclick="AdminRequestsModule.removeExistingSoporte(${s.id_soporte})" title="Eliminar este soporte">Eliminar</button>
            `}
          </div>
        </div>
      `;
    });

    // Nuevos Soportes Agregados
    currentSoportes.forEach((s, idx) => {
      html += `
        <div class="soporte-file-item">
          <div class="soporte-file-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:#3b82f6;flex-shrink:0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span style="font-weight:600;">${escHtml(s.nombre)}</span>
            <span style="color:var(--text-muted);font-size:0.75rem;">(${formatBytes(s.size)})</span>
            <span class="badge badge--revision" style="font-size:0.7rem;">Nuevo</span>
          </div>
          <button type="button" class="btn btn-secondary" style="padding:3px 8px;font-size:0.75rem;color:#ef4444;" onclick="AdminRequestsModule.removeNewSoporte(${idx})" title="Quitar archivo">Quitar</button>
        </div>
      `;
    });

    if (!existingSoportes.length && !currentSoportes.length) {
      html = '<div style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:6px;">No hay soportes adjuntos actualmente.</div>';
    }

    listEl.innerHTML = html;
  }

  function removeNewSoporte(index) {
    currentSoportes.splice(index, 1);
    renderSoportesList();
  }

  function removeExistingSoporte(id) {
    if (!deletedSoporteIds.includes(id)) deletedSoporteIds.push(id);
    renderSoportesList();
  }

  function restoreExistingSoporte(id) {
    deletedSoporteIds = deletedSoporteIds.filter(x => x !== id);
    renderSoportesList();
  }

  // ─── Lectura y Validación del Formulario de Permisos ─────────────────────────
  function readPermisoForm() {
    const persona = document.getElementById('af-perm-persona')?.value.trim();
    const documento = document.getElementById('af-perm-doc')?.value.trim();
    const codigo = document.getElementById('af-perm-codigo')?.value.trim() || '';
    const grado = document.getElementById('af-perm-grado')?.value.trim() || '';
    const correoSolicitante = document.getElementById('af-perm-email')?.value.trim();
    const sectorial = document.getElementById('af-perm-sectorial')?.value.trim();
    const dependencia = cleanName(document.getElementById('af-perm-dep')?.value.trim());
    const nivel = document.getElementById('af-perm-nivel')?.value.trim();
    const cargo = document.getElementById('af-perm-cargo')?.value.trim();
    const motivoCat = document.getElementById('af-perm-motivo-cat')?.value.trim();
    const motivoInc = document.getElementById('af-perm-motivo-inc')?.value.trim();
    const observaciones = document.getElementById('af-perm-obs')?.value.trim();
    const jefeNombre = document.getElementById('af-perm-jefe-nombre')?.value.trim();
    const jefeCorreo = document.getElementById('af-perm-jefe-correo')?.value.trim();

    if (!documento) { App.showToast('El número de cédula es obligatorio.', 'warning'); return null; }
    if (!persona) { App.showToast('El nombre del servidor público es obligatorio.', 'warning'); return null; }
    if (!correoSolicitante || !correoSolicitante.includes('@')) { App.showToast('El correo institucional del servidor es inválido.', 'warning'); return null; }
    if (!sectorial) { App.showToast('Debe seleccionar la sectorial correspondiente.', 'warning'); return null; }
    if (!dependencia) { App.showToast('Debe seleccionar la dependencia correspondiente.', 'warning'); return null; }
    if (!nivel) { App.showToast('Debe seleccionar el nivel jerárquico.', 'warning'); return null; }
    if (!cargo) { App.showToast('Debe seleccionar el cargo.', 'warning'); return null; }
    if (!jefeNombre) { App.showToast('El nombre del jefe inmediato es obligatorio.', 'warning'); return null; }
    if (!jefeCorreo || !jefeCorreo.includes('@')) { App.showToast('El correo del jefe inmediato es obligatorio.', 'warning'); return null; }

    let fechaInicio = '', fechaFin = '', jornada = 'Todo el día', horaSalida = null, horaEntrada = null;

    if (currentModalidad === 'horas') {
      const f = document.getElementById('af-perm-horas-fecha')?.value;
      if (!f) { App.showToast('Indique la fecha para el permiso por horas.', 'warning'); return null; }
      fechaInicio = isoToDMY(f);
      fechaFin = fechaInicio;
      jornada = document.getElementById('af-perm-horas-jornada')?.value || 'Mañana';
      horaSalida = document.getElementById('af-perm-horas-salida')?.value || '';
      horaEntrada = document.getElementById('af-perm-horas-entrada')?.value || '';
      if (!horaSalida || !horaEntrada) { App.showToast('Indique la hora de salida y hora de entrada.', 'warning'); return null; }
    } else if (currentModalidad === 'dia') {
      const f = document.getElementById('af-perm-dia-fecha')?.value;
      if (!f) { App.showToast('Indique la fecha para el permiso de un día.', 'warning'); return null; }
      fechaInicio = isoToDMY(f);
      fechaFin = fechaInicio;
      jornada = document.getElementById('af-perm-dia-jornada')?.value || 'Todo el día';
    } else if (currentModalidad === 'varios_dias') {
      const fi = document.getElementById('af-perm-varios-fi')?.value;
      const ff = document.getElementById('af-perm-varios-ff')?.value;
      if (!fi || !ff) { App.showToast('Indique las fechas de inicio y fin.', 'warning'); return null; }
      fechaInicio = isoToDMY(fi);
      fechaFin = isoToDMY(ff);
      jornada = 'Todo el día';
    }

    const payload = {
      tipo: 'Permiso Laboral',
      persona, documento, codigo, grado, correoSolicitante,
      sectorial, dependencia, nivel, cargo,
      modalidad: currentModalidad, jornada,
      fechaInicio, fechaFin,
      horaSalida, horaEntrada,
      motivoCategoria: motivoCat,
      motivoIncentivo: motivoCat === 'INCENTIVOS' ? motivoInc : null,
      observaciones,
      jefeNombre, jefeCorreo,
      soportes: currentSoportes.map(s => ({ nombre: s.nombre, tipo: s.tipo, base64: s.base64 })),
      soportesEliminar: deletedSoporteIds,
    };

    return payload;
  }

  // ─── Modal de Creación ───────────────────────────────────────────────────────
  async function openCreate() {
    if (state.tipo === 'Permiso Laboral') {
      await ensureCatalogs();
      App.openModal('Radicar Permiso Laboral · Gobernación de Boyacá', buildPermisoFormHtml({}, false), [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        { text: 'Radicar Solicitud', cls: 'btn-primary', id: 'adm-save-btn', action: savePermisoCreate },
      ], 'modal-ficha');
      initPermisoForm({}, false);
    } else {
      App.openModal(`Nueva Solicitud — ${state.tipo}`, buildForm(), [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        { text: 'Crear Solicitud', cls: 'btn-primary', id: 'adm-save-btn', action: saveCreate },
      ]);
    }
  }

  async function savePermisoCreate() {
    const body = readPermisoForm();
    if (!body) return;
    const btn = document.getElementById('adm-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Radicando solicitud...'; }

    try {
      const res = await API.createAdminRequest(body);
      App.closeModal();
      let notiMsg = 'Solicitud de permiso radicada correctamente.';
      if (res.radicado) notiMsg += ` Radicado: ${res.radicado}.`;
      if (res.notificacion && res.notificacion.estado === 'enviada') {
        notiMsg += ' Se envió correo de notificación al jefe inmediato.';
      } else if (res.notificacion && res.notificacion.estado === 'simulada') {
        notiMsg += ' (Notificación simulada en entorno de pruebas).';
      }
      App.showToast(notiMsg, 'success');
      await load();
    } catch (err) {
      App.showToast(err.message || 'Error al radicar el permiso.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Radicar Solicitud'; }
    }
  }

  // ─── Modal de Edición ───────────────────────────────────────────────────────
  async function openEdit(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;

    if (r.tipo === 'Permiso Laboral') {
      await ensureCatalogs();
      App.openModal(`Editar Permiso Laboral (${r.radicado || ''})`, buildPermisoFormHtml(r, true), [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        { text: 'Actualizar Permiso', cls: 'btn-gold', id: 'adm-save-btn', action: () => savePermisoEdit(id) },
      ], 'modal-ficha');
      initPermisoForm(r, true);
    } else {
      App.openModal('Editar Solicitud', buildForm(r), [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        { text: 'Actualizar', cls: 'btn-gold', id: 'adm-save-btn', action: () => saveEdit(id) },
      ]);
    }
  }

  async function savePermisoEdit(id) {
    const body = readPermisoForm();
    if (!body) return;
    const btn = document.getElementById('adm-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }

    try {
      await API.updateAdminRequest(id, body);
      App.closeModal();
      App.showToast('Solicitud de permiso laboral actualizada.', 'success');
      await load();
    } catch (err) {
      App.showToast(err.message || 'Error al actualizar el permiso.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Actualizar Permiso'; }
    }
  }

  // ─── Modal de Vista Detallada ────────────────────────────────────────────────
  async function openView(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;

    if (r.tipo === 'Permiso Laboral') {
      openPermisoView(r);
    } else {
      openLegacyView(r);
    }
  }

  async function openPermisoView(r) {
    let soportes = [];
    try {
      soportes = await API.getAdminRequestSoportes(r.id);
    } catch (e) {
      console.warn('[AdminRequests] Error al cargar soportes para vista:', e);
    }

    const durLabel = r.duracion || (r.diasSolicitados != null ? `${r.diasSolicitados} días hábiles` : '—');
    const soportesHtml = (soportes && soportes.length) ? soportes.map(s => `
      <div class="soporte-file-item" style="margin-bottom:6px;">
        <div class="soporte-file-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--color-green-dark,#287522);flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span style="font-weight:600;">${escHtml(s.nombre_archivo)}</span>
          <span style="color:var(--text-muted);font-size:0.75rem;">(${formatBytes(s.tamano_bytes)})</span>
        </div>
        <a href="${API.getAdminRequestSoporteUrl(r.id, s.id_soporte)}" target="_blank" download="${escHtml(s.nombre_archivo)}" class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Descargar
        </a>
      </div>
    `).join('') : '<div style="color:var(--text-muted);font-size:0.82rem;padding:6px 0;">No se adjuntaron soportes a esta solicitud.</div>';

    const notiBadge = (r.notificacionEstado === 'enviada') ? '<span class="badge badge--aprobada">Notificado por correo</span>' :
      (r.notificacionEstado === 'simulada') ? '<span class="badge badge--revision">Simulado (Pruebas)</span>' :
      '<span class="badge badge--pendiente">Pendiente de envío</span>';

    const content = `
      <div class="detail-modal-card" style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--color-border,#e2e8f0);padding-bottom:10px;">
          <div>
            <div style="font-size:1.15rem;font-weight:800;color:var(--text-primary);">${escHtml(r.radicado)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);">Radicado oficial de Permiso Laboral</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge badge--permiso" style="font-weight:700;">${escHtml(durLabel)}</span>
            <span class="badge ${badgeClass(r.estado)}">${escHtml(r.estado)}</span>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-item detail-grid--full">
            <span class="detail-label">Servidor Público</span>
            <span class="detail-value" style="font-weight:700;">${escHtml(r.persona || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Cédula de Ciudadanía</span>
            <span class="detail-value font-mono">${escHtml(r.documento || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Código del Servidor</span>
            <span class="detail-value font-mono">${escHtml(r.codigo || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Grado del Servidor</span>
            <span class="detail-value font-mono">${escHtml(r.grado || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Correo Institucional</span>
            <span class="detail-value">${escHtml(r.correoSolicitante || '—')}</span>
          </div>

          <div class="detail-item detail-grid--full">
            <span class="detail-label">Sectorial / Dependencia</span>
            <span class="detail-value">${escHtml(r.sectorial || '')} ${r.dependencia ? `— ${escHtml(cleanName(r.dependencia))}` : ''}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Nivel Jerárquico</span>
            <span class="detail-value">${escHtml(r.nivel || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Cargo</span>
            <span class="detail-value">${escHtml(r.cargo || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Modalidad</span>
            <span class="detail-value" style="text-transform:capitalize;">${r.modalidad ? (r.modalidad === 'horas' ? 'Unas Horas' : r.modalidad === 'dia' ? 'Un Día' : 'Varios Días') : '—'}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Jornada</span>
            <span class="detail-value">${escHtml(r.jornada || 'Todo el día')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Fecha Inicio</span>
            <span class="detail-value">${escHtml(r.fechaInicio || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Fecha Fin</span>
            <span class="detail-value">${escHtml(r.fechaFin || '—')}</span>
          </div>

          ${r.modalidad === 'horas' ? `
          <div class="detail-item">
            <span class="detail-label">Horario Solicitado</span>
            <span class="detail-value font-mono">${escHtml(r.horaSalida || '—')} a ${escHtml(r.horaEntrada || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Horas Totales</span>
            <span class="detail-value font-mono">${r.horasSolicitadas != null ? `${r.horasSolicitadas} h` : '—'}</span>
          </div>
          ` : ''}

          <div class="detail-item detail-grid--full">
            <span class="detail-label">Motivo o Justificación</span>
            <span class="detail-value" style="font-weight:600;">${escHtml(r.motivo || '—')}</span>
          </div>

          ${r.observaciones ? `
          <div class="detail-item detail-grid--full">
            <span class="detail-label">Observaciones / Detalle</span>
            <span class="detail-value">${escHtml(r.observaciones)}</span>
          </div>` : ''}

          <!-- Notificación al Jefe -->
          <div class="detail-item detail-grid--full" style="background:var(--bg-hover,#f8fafc);padding:10px 12px;border-radius:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span class="detail-label" style="font-weight:700;color:var(--text-primary);margin-bottom:0;">Notificación al Jefe Inmediato</span>
              ${notiBadge}
            </div>
            <div style="font-size:0.86rem;color:var(--text-primary);">${escHtml(r.jefeNombre || 'No registrado')} &lt;${escHtml(r.jefeCorreo || 'Sin correo')}&gt;</div>
            <div style="margin-top:8px;">
              <button type="button" class="btn btn-secondary" style="font-size:0.78rem;padding:4px 10px;" onclick="AdminRequestsModule.reenviarNotificacion(${r.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;margin-right:4px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Reenviar Notificación por Correo
              </button>
            </div>
          </div>

          <!-- Soportes -->
          <div class="detail-item detail-grid--full">
            <span class="detail-label">Soportes Documentales (${(soportes && soportes.length) || 0})</span>
            <div style="margin-top:6px;">${soportesHtml}</div>
          </div>
        </div>
      </div>
    `;

    const actions = [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
    ];
    if (Auth.canEdit()) {
      actions.push({
        text: 'Editar Permiso',
        cls: 'btn-gold',
        action: () => {
          App.closeModal();
          openEdit(r.id);
        }
      });
    }

    App.openModal(`Detalles · Permiso Laboral (${r.radicado || ''})`, content, actions, 'modal-ficha');
  }

  async function reenviarNotificacion(id) {
    try {
      App.showToast('Reenviando notificación al jefe inmediato...', 'info');
      const res = await API.reenviarNotificacionAdminRequest(id);
      App.showToast(res.message || 'Notificación reenviada con éxito.', 'success');
      await load();
    } catch (err) {
      App.showToast(err.message || 'Error al reenviar notificación.', 'error');
    }
  }

  // ─── Modal Tradicional (Incapacidades / Licencias) ───────────────────────────
  function buildForm(r = {}) {
    const dis = Auth.canEdit() ? '' : 'disabled';
    const tipos = Object.values(TIPOS);
    return `
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Tipo *</label>
          <select id="af-tipo" class="filter-select" ${dis}>
            ${tipos.map(t => `<option ${(r.tipo||state.tipo) === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select id="af-estado" class="filter-select" ${dis}>
            ${ESTADOS.filter(s=>s!=='Todos').map(s=>`<option ${r.estado===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Nombre Completo *</label>
          <input id="af-nombre" class="form-input" placeholder="APELLIDO APELLIDO NOMBRE..." value="${escHtml(r.persona||'')}" ${dis} required />
        </div>
        <div class="form-group">
          <label class="form-label">Documento</label>
          <input id="af-doc" class="form-input font-mono" placeholder="Número de cédula" value="${escHtml(r.documento||'')}" ${dis} />
        </div>
        <div class="form-group">
          <label class="form-label">Cargo</label>
          <input id="af-cargo" class="form-input" placeholder="Cargo del servidor..." value="${escHtml(r.cargo||'')}" ${dis} />
        </div>
        <div class="form-group span-2">
          <label class="form-label">Dependencia</label>
          <input id="af-dep" class="form-input" placeholder="Secretaría / Dependencia..." value="${escHtml(r.dependencia||'')}" ${dis} />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha Inicio</label>
          <input id="af-fi" class="form-input" placeholder="DD/MM/AAAA" value="${escHtml(r.fechaInicio||'')}" ${dis} />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha Fin</label>
          <input id="af-ff" class="form-input" placeholder="DD/MM/AAAA" value="${escHtml(r.fechaFin||'')}" ${dis} />
        </div>
        <div class="form-group">
          <label class="form-label">Días Solicitados</label>
          <input id="af-dias" class="form-input" type="number" min="1" value="${escHtml(r.diasSolicitados||'1')}" ${dis} />
        </div>
        <div class="form-group">
          <label class="form-label">Aprobado Por</label>
          <input id="af-aprobado" class="form-input" placeholder="Nombre del aprobador..." value="${escHtml(r.aprobadoPor||'')}" ${dis} />
        </div>
        <div class="form-group span-2">
          <label class="form-label">Motivo</label>
          <input id="af-motivo" class="form-input" placeholder="Motivo de la solicitud..." value="${escHtml(r.motivo||'')}" ${dis} />
        </div>
        <div class="form-group span-2">
          <label class="form-label">Observaciones / Nota de Gestión</label>
          <input id="af-obs" class="form-input" placeholder="Observaciones o nota del coordinador..." value="${escHtml(r.observaciones||'')}" ${dis} />
        </div>
      </div>`;
  }

  function openLegacyView(r) {
    const content = `
      <div class="detail-modal-card">
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Radicado</span>
            <span class="detail-value">${escHtml(r.radicado || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Estado</span>
            <div class="detail-badge-wrap"><span class="badge ${badgeClass(r.estado)}">${escHtml(r.estado || '—')}</span></div>
          </div>
          <div class="detail-item detail-grid--full">
            <span class="detail-label">Servidor Público</span>
            <span class="detail-value">${escHtml(r.persona || '—')}</span>
          </div>
          <div class="detail-item detail-grid--full">
            <span class="detail-label">Dependencia</span>
            <span class="detail-value">${escHtml(cleanName(r.dependencia) || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tipo de Trámite</span>
            <span class="detail-value">${escHtml(r.tipo || state.tipo || 'Solicitud Admin')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Días Solicitados</span>
            <span class="detail-value">${r.diasSolicitados ?? '—'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Fecha de Inicio</span>
            <span class="detail-value">${escHtml(r.fechaInicio || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Fecha de Fin</span>
            <span class="detail-value">${escHtml(r.fechaFin || '—')}</span>
          </div>
          ${r.motivo ? `
          <div class="detail-item detail-grid--full">
            <span class="detail-label">Motivo / Justificación</span>
            <span class="detail-value">${escHtml(r.motivo)}</span>
          </div>` : ''}
          ${r.observaciones ? `
          <div class="detail-item detail-grid--full">
            <span class="detail-label">Observaciones</span>
            <span class="detail-value">${escHtml(r.observaciones)}</span>
          </div>` : ''}
        </div>
      </div>
    `;
    const actions = [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
    ];
    if (Auth.canEdit()) {
      actions.push({
        text: 'Editar Solicitud',
        cls: 'btn-gold',
        action: () => {
          App.closeModal();
          openEdit(r.id);
        }
      });
    }
    App.openModal(`Detalles · ${r.tipo || state.tipo} (${r.radicado || ''})`, content, actions);
  }

  async function saveCreate() {
    const body = readForm();
    if (!body) return;
    const btn = document.getElementById('adm-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      const res = await API.createAdminRequest(body);
      App.closeModal();
      App.showToast(`Solicitud creada. Radicado: ${res.radicado || ''}`, 'success');
      await load();
    } catch (err) { App.showToast(err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Crear Solicitud'; } }
  }

  async function saveEdit(id) {
    const body = readForm();
    if (!body) return;
    const btn = document.getElementById('adm-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
    try {
      await API.updateAdminRequest(id, body);
      App.closeModal();
      App.showToast('Solicitud actualizada.', 'success');
      await load();
    } catch (err) { App.showToast(err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Actualizar'; } }
  }

  function readForm() {
    const nombre = document.getElementById('af-nombre')?.value.trim();
    if (!nombre) { App.showToast('El nombre es requerido.', 'warning'); return null; }
    return {
      tipo: document.getElementById('af-tipo')?.value,
      persona: nombre,
      documento: document.getElementById('af-doc')?.value.trim(),
      dependencia: cleanName(document.getElementById('af-dep')?.value.trim()),
      cargo: document.getElementById('af-cargo')?.value.trim(),
      fechaInicio: document.getElementById('af-fi')?.value.trim(),
      fechaFin: document.getElementById('af-ff')?.value.trim(),
      diasSolicitados: parseInt(document.getElementById('af-dias')?.value) || 1,
      motivo: document.getElementById('af-motivo')?.value.trim(),
      estado: document.getElementById('af-estado')?.value || 'Pendiente',
      observaciones: document.getElementById('af-obs')?.value.trim(),
      aprobadoPor: document.getElementById('af-aprobado')?.value.trim(),
      notaGestion: document.getElementById('af-obs')?.value.trim(),
    };
  }

  function confirmDelete(id, nombre) {
    App.openModal('Confirmar Eliminación', `<p style="color:var(--text-secondary)">¿Eliminar la solicitud de <strong style="color:var(--text-primary)">${escHtml(nombre)}</strong>?</p>`, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Eliminar', cls: 'btn-danger', action: async () => {
        try { await API.deleteAdminRequest(id); App.closeModal(); App.showToast('Solicitud eliminada.','success'); await load(); }
        catch(err) { App.showToast(err.message,'error'); }
      }},
    ]);
  }

  function applyFilters() {
    state.page = 1;
    state.filters = {
      q: document.getElementById('adm-q')?.value.trim() || '',
      estado: document.getElementById('adm-estado')?.value || '',
    };
    load();
  }

  function clearFilters() {
    ['adm-q','adm-estado'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    state.filters = {}; state.page = 1; load();
  }

  function goPage(p) { if (p < 1 || p > state.totalPages) return; state.page = p; load(); }

  // ─── Dropdown de Acciones Secundarias ────────────────────────────────────────
  function toggleActionsDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('adm-dropdown-menu');
    const toggleBtn = document.getElementById('adm-dropdown-toggle');
    if (!menu || !toggleBtn) return;
    const isHidden = menu.hasAttribute('hidden');
    if (isHidden) {
      menu.removeAttribute('hidden');
      toggleBtn.setAttribute('aria-expanded', 'true');
      const firstItem = menu.querySelector('.actions-dropdown-item');
      if (firstItem) firstItem.focus();
    } else {
      closeActionsDropdown();
    }
  }

  function closeActionsDropdown() {
    const menu = document.getElementById('adm-dropdown-menu');
    const toggleBtn = document.getElementById('adm-dropdown-toggle');
    if (menu) menu.setAttribute('hidden', '');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.focus();
    }
  }

  function handleDropdownKeydown(event) {
    if (event.key === 'Escape') {
      closeActionsDropdown();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const menu = document.getElementById('adm-dropdown-menu');
      if (menu && menu.hasAttribute('hidden')) {
        toggleActionsDropdown(event);
      } else if (menu) {
        const first = menu.querySelector('.actions-dropdown-item');
        if (first) first.focus();
      }
    }
  }

  function bindDropdownOutsideClick() {
    document.addEventListener('click', (e) => {
      const wrap = document.querySelector('.actions-dropdown-wrap');
      const menu = document.getElementById('adm-dropdown-menu');
      if (menu && !menu.hasAttribute('hidden') && wrap && !wrap.contains(e.target)) {
        menu.setAttribute('hidden', '');
        const toggleBtn = document.getElementById('adm-dropdown-toggle');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const menu = document.getElementById('adm-dropdown-menu');
        if (menu && !menu.hasAttribute('hidden')) {
          closeActionsDropdown();
        }
      }
    });
  }

  // ─── Renderizado Principal del Módulo ────────────────────────────────────────
  async function render(container, tipoKey, navItem) {
    const tipoLabel = TIPOS[tipoKey] || 'Permiso Laboral';

    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <h1 class="page-heading" id="adm-heading">${tipoPlural(tipoLabel)}</h1>
            <p class="page-desc">Gestione solicitudes administrativas del personal con validaciones oficiales y notificación automática</p>
          </div>
          <div class="page-actions" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <!-- Dropdown Acciones Secundarias -->
            <div class="actions-dropdown-wrap">
              <button
                type="button"
                class="btn btn-secondary actions-dropdown-btn"
                id="adm-dropdown-toggle"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="adm-dropdown-menu"
                onclick="AdminRequestsModule.toggleActionsDropdown(event)"
                onkeydown="AdminRequestsModule.handleDropdownKeydown(event)"
                title="Opciones secundarias (Excel y plantillas)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                <span>Acciones</span>
                <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div
                class="actions-dropdown-menu"
                id="adm-dropdown-menu"
                role="menu"
                aria-labelledby="adm-dropdown-toggle"
                hidden
              >
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="AdminRequestsModule.closeActionsDropdown(); AdminRequestsModule.exportExcel();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <div>
                    <strong>Exportar Solicitudes a Excel</strong>
                    <small>Descarga el listado filtrado actual en formato .xlsx</small>
                  </div>
                </button>
                ${Auth.canEdit() ? `
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="AdminRequestsModule.closeActionsDropdown(); AdminRequestsModule.openImportModal();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <div>
                    <strong>Carga Masiva Excel</strong>
                    <small>Importar registros desde plantilla institucional</small>
                  </div>
                </button>` : ''}
              </div>
            </div>

            <!-- Botón de Acción Principal -->
            ${Auth.canEdit() ? `
            <button class="btn btn-primary btn-primary-cta" onclick="AdminRequestsModule.openCreate()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Nueva Solicitud</span>
            </button>` : ''}
          </div>
        </div>

        <div class="module-tabs">
          <button class="tab-btn ${tipoLabel==='Permiso Laboral'?'active':''}" onclick="AdminRequestsModule.setTipo('Permiso Laboral',this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Permisos Laborales
          </button>
          <button class="tab-btn" style="display:none" hidden onclick="App.navigate('incapacidades')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Incapacidades
          </button>
          <button class="tab-btn ${tipoLabel==='Licencia'?'active':''}" onclick="AdminRequestsModule.setTipo('Licencia',this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            Licencias
          </button>
        </div>

        <div class="filters-card">
          <div class="filters-row">
            <div class="filter-group" style="flex:2">
              <label class="filter-label">Buscar</label>
              <input id="adm-q" class="filter-input" placeholder="Nombre, cédula, dependencia, radicado..." />
            </div>
            <div class="filter-group">
              <label class="filter-label">Estado</label>
              <select id="adm-estado" class="filter-select">
                ${ESTADOS.map(s => `<option>${s}</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-primary" onclick="AdminRequestsModule.applyFilters()">Filtrar</button>
            <button class="btn btn-secondary" onclick="AdminRequestsModule.clearFilters()">Limpiar</button>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <span class="table-title" id="adm-table-title">${tipoPlural(tipoLabel)}</span>
            <span class="table-count" id="adm-count"><span class="skeleton" style="width:110px;height:14px;border-radius:4px;display:inline-block;" aria-hidden="true"></span></span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Radicado</th><th>Servidor Público</th><th>Dependencia</th>
                <th>Tipo</th><th>Fecha Inicio</th><th>Duración</th><th>Estado</th><th>Acciones</th>
              </tr></thead>
              <tbody id="adm-tbody" role="progressbar" aria-busy="true" aria-label="Cargando solicitudes...">
                ${renderSkeletonRows(6)}
              </tbody>
            </table>
          </div>
          <div class="pagination" id="adm-pagination"></div>
        </div>
      </div>`;

    document.getElementById('adm-q')?.addEventListener('keypress', e => { if (e.key === 'Enter') applyFilters(); });
    bindDropdownOutsideClick();

    state.tipo = tipoLabel; state.page = 1; state.filters = {};
    ensureCatalogs();
    await load();
  }

  // ─── Selector Rápido de Estados ─────────────────────────────────────────────
  const STATUS_CONFIG = [
    {
      id: 'aprobada', name: 'Aprobada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
      desc: 'Aprobar solicitud institucional', cls: 'status-card-opt--aprobada',
    },
    {
      id: 'rechazada', name: 'Rechazada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      desc: 'Denegar o rechazar trámite', cls: 'status-card-opt--rechazada',
    },
    {
      id: 'revision', name: 'En revisión',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      desc: 'En verificación médica o validación de soportes', cls: 'status-card-opt--revision',
    },
    {
      id: 'pendiente', name: 'Pendiente',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      desc: 'En espera de visto bueno o turno de trámite', cls: 'status-card-opt--pendiente',
    },
    {
      id: 'finalizada', name: 'Finalizada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      desc: 'Trámite culminado y archivado', cls: 'status-card-opt--finalizada',
    },
  ];

  function openStatusPicker(id) {
    if (!Auth.canEdit()) {
      App.showToast('No tienes permisos de edición para cambiar estados.', 'warning');
      return;
    }
    const r = state.data.find(x => x.id === id);
    if (!r) return;

    const cardsHtml = STATUS_CONFIG.map(opt => {
      const isCurrent = r.estado === opt.name;
      return `
        <button type="button" class="status-card-opt ${opt.cls} ${isCurrent ? 'is-current' : ''}" onclick="AdminRequestsModule.selectQuickStatus(${r.id}, '${opt.name}')" title="Marcar como ${opt.name}">
          <div class="status-opt-icon">${opt.icon}</div>
          <div class="status-opt-info">
            <div class="status-opt-title-row">
              <span class="status-opt-name">${opt.name}</span>
              ${isCurrent ? '<span class="status-current-badge">Estado actual</span>' : ''}
            </div>
            <span class="status-opt-desc">${opt.desc}</span>
          </div>
          <div class="status-opt-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>`;
    }).join('');

    const bodyHtml = `
      <div class="status-picker-container">
        <div class="status-picker-hero">
          <div class="status-picker-rad">${escHtml(r.radicado)}</div>
          <div class="status-picker-person">${escHtml(r.persona)}</div>
          <div class="status-picker-tags">
            <span class="status-picker-tag">📋 ${escHtml(r.tipo)}</span>
            <span class="status-picker-tag">📅 ${escHtml(r.fechaInicio || '—')} (${escHtml(r.duracion || r.diasSolicitados + ' d')})</span>
            <span class="status-picker-tag">Estado actual: <strong class="badge ${badgeClass(r.estado)}" style="margin-left:4px">${escHtml(r.estado)}</strong></span>
          </div>
        </div>

        <div class="status-picker-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <span>Selecciona el nuevo estado para esta solicitud:</span>
        </div>

        <div class="status-cards-grid">
          ${cardsHtml}
        </div>

        <div class="form-group" style="margin-top:var(--space-2);">
          <label class="form-label">Nota de Gestión / Concepto (Opcional)</label>
          <input id="adm-quick-status-note" class="form-input form-input--no-icon" placeholder="Ej: Aprobado según soporte recibido..." value="${escHtml(r.observaciones || '')}" />
        </div>
      </div>`;

    App.openModal('Gestión Rápida de Estado', bodyHtml, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
    ]);
  }

  async function selectQuickStatus(id, newStatus) {
    const note = document.getElementById('adm-quick-status-note')?.value.trim();
    try {
      await API.updateAdminRequestStatus(id, newStatus, note);
      App.closeModal();
      App.showToast(`Estado actualizado a "${newStatus}".`, 'success');
      await load();
    } catch (err) {
      App.showToast(err.message || 'Error al cambiar estado.', 'error');
    }
  }

  // ─── Exportación e Importación de Excel ──────────────────────────────────────
  const EXCEL_COLUMNS = [
    { header: 'Radicado', key: 'radicado', width: 18, sample: 'PL-2026-00045' },
    { header: 'Tipo', key: 'tipo', width: 18, sample: 'Permiso Laboral' },
    { header: 'Cédula', key: 'documento', width: 15, sample: '1049601234' },
    { header: 'Servidor Público', key: 'persona', width: 32, sample: 'GARCIA MARTINEZ LUIS FERNANDO' },
    { header: 'Código', key: 'codigo', width: 12, sample: '219' },
    { header: 'Grado', key: 'grado', width: 10, sample: '01' },
    { header: 'Sectorial', key: 'sectorial', width: 28, sample: 'SECRETARIA DE HACIENDA' },
    { header: 'Dependencia', key: 'dependencia', width: 30, sample: 'DIRECCION FINANCIERA Y FISCAL' },
    { header: 'Cargo', key: 'cargo', width: 26, sample: 'PROFESIONAL UNIVERSITARIO' },
    { header: 'Fecha Inicio', key: 'fechaInicio', width: 16, sample: '15/05/2026' },
    { header: 'Fecha Fin', key: 'fechaFin', width: 16, sample: '15/05/2026' },
    { header: 'Duración', key: 'duracion', width: 16, sample: '1 día' },
    { header: 'Motivo o Diagnóstico', key: 'motivo', width: 32, sample: 'Diligencia personal urgente' },
    { header: 'Estado', key: 'estado', width: 16, sample: 'Aprobada' },
    { header: 'Observaciones', key: 'observaciones', width: 30, sample: 'Soporte recibido' },
  ];

  async function exportExcel() {
    try {
      App.showToast('Generando archivo Excel...', 'info');
      const res = await API.getAdminRequests({ tipo: state.tipo, ...state.filters, page: 1, limit: 10000 });
      const records = res.data || state.data;
      ExcelService.exportToExcel({
        filename: `Talento360_${(state.tipo || 'Solicitudes_Admin').replace(/\s+/g, '_')}`,
        sheetName: tipoPlural(state.tipo),
        columns: EXCEL_COLUMNS,
        data: records
      });
      App.showToast(`Se exportaron ${records.length} registros de ${tipoPlural(state.tipo)} exitosamente.`, 'success');
    } catch (err) {
      App.showToast('Error al exportar: ' + err.message, 'error');
    }
  }

  function openImportModal() {
    ExcelService.openImportModal({
      title: `Carga Masiva de Solicitudes Administrativas (${tipoPlural(state.tipo)})`,
      subtitle: `Importe registros masivos de ${tipoPlural(state.tipo).toLowerCase()} mediante un archivo Excel (.xlsx / .xls)`,
      moduleName: tipoPlural(state.tipo).toLowerCase(),
      columns: EXCEL_COLUMNS.filter(c => c.key !== 'radicado'),
      sampleRows: [
        {
          'Tipo': state.tipo || 'Permiso Laboral',
          'Cédula': '1049612345',
          'Servidor Público': 'GOMEZ PEREZ ANDREA PAOLA',
          'Código': '219',
          'Grado': '02',
          'Dependencia': 'SECRETARÍA DE EDUCACIÓN',
          'Cargo': 'AUXILIAR ADMINISTRATIVO',
          'Fecha Inicio': '01/06/2026',
          'Fecha Fin': '01/06/2026',
          'Días': '1',
          'Motivo o Diagnóstico': 'Cita médica especializada EPS',
          'Estado': 'Pendiente',
          'Observaciones': 'Anexa orden médica'
        }
      ],
      validateRow: (row) => {
        const documento = (row['Cédula'] || row.documento || row.cedula || row['Documento'] || '').toString().trim();
        const persona = (row['Servidor Público'] || row.persona || row.nombreCompleto || row['Nombre Completo'] || '').toString().trim();
        const dependencia = cleanName((row['Dependencia'] || row.dependencia || '').toString().trim());
        if (!documento || !persona || !dependencia) {
          return { valid: false, error: 'Cédula, Servidor y Dependencia son requeridos.' };
        }
        return {
          valid: true,
          cleanRow: {
            tipo: (row['Tipo'] || row.tipo || state.tipo || 'Permiso Laboral').toString().trim(),
            documento, persona, dependencia,
            codigo: (row['Código'] || row.codigo || '').toString().trim(),
            grado: (row['Grado'] || row.grado || '').toString().trim(),
            cargo: (row['Cargo'] || row.cargo || '').toString().trim(),
            fechaInicio: (row['Fecha Inicio'] || row.fechaInicio || '').toString().trim(),
            fechaFin: (row['Fecha Fin'] || row.fechaFin || '').toString().trim(),
            diasSolicitados: parseInt(row['Días'] || row.diasSolicitados || row.dias || 1) || 1,
            motivo: (row['Motivo o Diagnóstico'] || row.motivo || row.diagnostico || '').toString().trim(),
            estado: (row['Estado'] || row.estado || 'Pendiente').toString().trim(),
            observaciones: (row['Observaciones'] || row.observaciones || '').toString().trim()
          }
        };
      },
      onImport: async (rows) => {
        const res = await API.bulkCreateAdminRequests(rows);
        App.showToast(res.message || `${res.inserted} solicitudes importadas.`, 'success');
        await load();
      }
    });
  }

  return {
    render, openCreate, openView, openEdit, openStatusPicker, selectQuickStatus, confirmDelete,
    applyFilters, clearFilters, goPage, setTipo, exportExcel, openImportModal,
    toggleActionsDropdown, closeActionsDropdown, handleDropdownKeydown,
    // Métodos del formulario de Permisos
    setModalidad, onSectorialChange, onNivelChange, onMotivoCatChange, onMotivoIncChange,
    calcHorasPermiso, calcDiasHabiles, validateJefeEmailLive,
    selectEmployee, handleFileSelect, removeNewSoporte, removeExistingSoporte, restoreExistingSoporte,
    reenviarNotificacion
  };
})();
