/* ═══════════════════════════════════════════════════════════════════════════
   horarios.js — Módulo de Horarios y Modalidades de Trabajo (Talento 360)
   Gestión de esquemas laborales: Presencial, Teletrabajo, Trabajo en casa y Horario flexible.
   ═══════════════════════════════════════════════════════════════════════════ */

const HorariosModule = (() => {
  const MODALIDADES = ['Todas', 'Presencial', 'Teletrabajo', 'Trabajo en casa', 'Horario flexible'];
  const ESTADOS     = ['Todos', 'Activa', 'Pendiente', 'En revisión', 'Caducada', 'Finalizada'];

  let state = {
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    filters: { q: '', modalidad: 'Todas', estado: 'Todos', dependencia: 'Todas' },
    stats: {},
  };

  let employeeSearchTimeout = null;

  // ─── Badges de Modalidad y Estado ──────────────────────────────────────────
  function badgeClass(estado) {
    const e = (estado || '').toLowerCase();
    if (e.includes('activa') || e.includes('aprobad')) return 'badge--aprobada';
    if (e.includes('caducad') || e.includes('finaliz')) return 'badge--finalizada';
    if (e.includes('revis')) return 'badge--revision';
    if (e.includes('rechazad')) return 'badge--rechazada';
    return 'badge--pendiente';
  }

  function estadoBadge(estado) {
    return `<span class="badge ${badgeClass(estado)}">${escHtml(estado || 'Activa')}</span>`;
  }

  function modalidadBadge(modalidad) {
    const m = (modalidad || '').toLowerCase();
    if (m.includes('teletrabajo')) {
      return `<span class="badge badge--teletrabajo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> Teletrabajo</span>`;
    }
    if (m.includes('casa')) {
      return `<span class="badge badge--trabajo-casa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> Trabajo en casa</span>`;
    }
    if (m.includes('flexible')) {
      return `<span class="badge badge--horario-flex"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Horario flexible</span>`;
    }
    return `<span class="badge badge--presencial"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-3"/></svg> Presencial</span>`;
  }

  // ─── Formateo de Fechas ───────────────────────────────────────────────────
  function formatDate(dStr) {
    if (!dStr) return '<span class="text-muted">Sin definir</span>';
    try {
      const parts = dStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  }

  // ─── Dropdown de Opciones Secundarias (Ley de Hick & WCAG 2.1 AA) ──────────
  function toggleActionsDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('horarios-dropdown-menu');
    const toggleBtn = document.getElementById('horarios-dropdown-toggle');
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
    const menu = document.getElementById('horarios-dropdown-menu');
    const toggleBtn = document.getElementById('horarios-dropdown-toggle');
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
      const menu = document.getElementById('horarios-dropdown-menu');
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
      const menu = document.getElementById('horarios-dropdown-menu');
      if (menu && !menu.hasAttribute('hidden') && wrap && !wrap.contains(e.target)) {
        menu.setAttribute('hidden', '');
        const toggleBtn = document.getElementById('horarios-dropdown-toggle');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const menu = document.getElementById('horarios-dropdown-menu');
        if (menu && !menu.hasAttribute('hidden')) {
          closeActionsDropdown();
        }
      }
    });
  }

  // ─── Renderizado Principal ────────────────────────────────────────────────
  async function render(container) {
    const canManage = Auth.canEdit();

    container.innerHTML = `
      <div class="module-enter">
        <!-- Encabezado de Página -->
        <div class="page-header">
          <div class="page-header-info">
            <h1 class="page-heading">Horarios y Modalidades</h1>
            <p class="page-desc">
              Administración de esquemas de trabajo institucional: Presencial, Teletrabajo, Trabajo en casa y Horarios flexibles
            </p>
          </div>
          <div class="page-actions" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <!-- Dropdown de Opciones Secundarias (Hick's Law) -->
            <div class="actions-dropdown-wrap">
              <button
                type="button"
                class="btn btn-secondary actions-dropdown-btn"
                id="horarios-dropdown-toggle"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="horarios-dropdown-menu"
                onclick="HorariosModule.toggleActionsDropdown(event)"
                onkeydown="HorariosModule.handleDropdownKeydown(event)"
                title="Opciones secundarias (Excel y plantillas)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                <span>Acciones</span>
                <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div
                class="actions-dropdown-menu"
                id="horarios-dropdown-menu"
                role="menu"
                aria-labelledby="horarios-dropdown-toggle"
                hidden
              >
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="HorariosModule.closeActionsDropdown(); HorariosModule.exportExcel();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <div>
                    <strong>Exportar Esquemas a Excel</strong>
                    <small>Descarga el listado filtrado actual en formato .xlsx</small>
                  </div>
                </button>
                ${
                  canManage
                    ? `<button
                        type="button"
                        role="menuitem"
                        tabindex="-1"
                        class="actions-dropdown-item"
                        onclick="HorariosModule.closeActionsDropdown(); HorariosModule.openImportModal();"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <div>
                          <strong>Carga Masiva Excel</strong>
                          <small>Importar registros desde plantilla institucional</small>
                        </div>
                      </button>`
                    : ''
                }
              </div>
            </div>

            <!-- Acción Primaria (CTA - Visual Salience) -->
            ${
              canManage
                ? `<button class="btn btn-primary btn-primary-cta" onclick="HorariosModule.openCreate()">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                     <span>Nuevo Horario</span>
                   </button>`
                : ''
            }
          </div>
        </div>

        <!-- Tarjetas de Métricas Líquidas -->
        <div class="stats-grid" id="horarios-stats-grid" style="margin-bottom:var(--space-5);">
          ${renderStatsSkeletons()}
        </div>

        <!-- Barra de Búsqueda y Filtros -->
        <div class="filters-card">
          <div class="filters-row">
            <div class="filter-group" style="flex:2">
              <label class="filter-label">Buscar</label>
              <input id="horarios-search" class="filter-input" placeholder="Nombre, cédula, dependencia o resolución..." value="${escHtml(
                state.filters.q || ''
              )}" onkeypress="if(event.key==='Enter')HorariosModule.applyFilters()" />
            </div>
            <div class="filter-group">
              <label class="filter-label">Modalidad</label>
              <select id="filter-modalidad" class="filter-select">
                ${MODALIDADES.map(
                  (m) =>
                    `<option value="${m}" ${
                      state.filters.modalidad === m ? 'selected' : ''
                    }>${m === 'Todas' ? 'Todas las modalidades' : m}</option>`
                ).join('')}
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">Estado</label>
              <select id="filter-estado" class="filter-select">
                ${ESTADOS.map(
                  (e) =>
                    `<option value="${e}" ${
                      state.filters.estado === e ? 'selected' : ''
                    }>${e === 'Todos' ? 'Todos los estados' : e}</option>`
                ).join('')}
              </select>
            </div>
            <button class="btn btn-primary" onclick="HorariosModule.applyFilters()">Filtrar</button>
            <button class="btn btn-secondary" onclick="HorariosModule.clearFilters()">Limpiar</button>
          </div>
        </div>

        <!-- Contenedor de Tabla -->
        <div class="table-card">
          <div class="table-header table-header--horarios">
            <span class="table-title">Registro de Horarios y Modalidades</span>
            <button type="button" class="btn-check-vencimientos" onclick="HorariosModule.checkExpirations()" title="Verificar esquemas próximos a vencer o vencidos">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              <span>Verificar Vencimientos</span>
            </button>
            <span class="table-count" id="horarios-count">
              <span class="skeleton" style="width:110px;height:14px;border-radius:4px;" aria-hidden="true"></span>
            </span>
          </div>
          <div class="table-wrap">
            <table aria-label="Registro de Horarios y Modalidades">
              <thead>
                <tr>
                  <th scope="col" style="width: 55px; text-align: center;">No.</th>
                  <th scope="col">Servidor Público</th>
                  <th scope="col">Cargo & Clasificación</th>
                  <th scope="col">Dependencia & Secretaría</th>
                  <th scope="col">Situación & Horario</th>
                  <th scope="col">Vigencia & Duración</th>
                  <th scope="col" style="text-align: center;">Soporte</th>
                  <th scope="col">Estado</th>
                  <th scope="col" style="text-align:right">Acciones</th>
                </tr>
              </thead>
              <tbody id="horarios-tbody" aria-busy="true" role="progressbar" aria-label="Cargando esquemas de horarios...">
                ${renderSkeletonRows()}
              </tbody>
            </table>
          </div>
          <div class="pagination" id="horarios-pagination"></div>
        </div>
      </div>
    `;

    bindDropdownOutsideClick();
    loadStats();
    await loadData();
  }

  function renderStatsSkeletons() {
    return Array(5).fill(0).map(() => `
      <div class="stat-card" aria-busy="true" role="progressbar">
        <div class="stat-icon skeleton" style="width:48px;height:48px;border-radius:12px;"></div>
        <div class="stat-info" style="display:flex;flex-direction:column;gap:6px;flex:1;">
          <span class="skeleton skeleton-line" style="width:50px;height:24px;border-radius:4px;margin-bottom:0;"></span>
          <span class="skeleton skeleton-line" style="width:90px;height:12px;border-radius:4px;margin-bottom:0;"></span>
        </div>
      </div>
    `).join('');
  }

  function renderSkeletonRows(count = 7) {
    return Array.from({ length: count }).map((_, i) => `
      <tr class="skeleton-row" style="animation-delay: ${i * 0.07}s" aria-hidden="true">
        <td style="text-align:center;"><div class="skeleton" style="width:32px; height:20px; border-radius:4px; margin:0 auto;"></div></td>
        <td>
          <div class="skeleton-user-cell">
            <div class="skeleton skeleton-avatar" aria-hidden="true"></div>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-line skeleton-line--title" style="width:${i % 2 === 0 ? '80%' : '70%'}; height:14px;"></div>
              <div class="skeleton skeleton-line" style="width:55%; height:11px;"></div>
            </div>
          </div>
        </td>
        <td>
          <div class="skeleton-text-group">
            <div class="skeleton skeleton-line" style="width:${i % 3 === 0 ? '85%' : '75%'}; height:13px;"></div>
            <div class="skeleton skeleton-line" style="width:45%; height:11px;"></div>
          </div>
        </td>
        <td>
          <div class="skeleton-text-group">
            <div class="skeleton skeleton-line" style="width:80%; height:13px;"></div>
            <div class="skeleton skeleton-line" style="width:50%; height:11px;"></div>
          </div>
        </td>
        <td><div class="skeleton skeleton-badge" style="width:95px; height:22px;"></div></td>
        <td>
          <div class="skeleton-text-group">
            <div class="skeleton skeleton-line" style="width:110px; height:13px;"></div>
            <div class="skeleton skeleton-line" style="width:65px; height:11px;"></div>
          </div>
        </td>
        <td style="text-align:center;"><div class="skeleton" style="width:65px; height:24px; border-radius:6px; margin:0 auto;"></div></td>
        <td><div class="skeleton skeleton-badge" style="width:75px; height:22px;"></div></td>
        <td>
          <div class="skeleton-actions-wrap">
            <div class="skeleton skeleton-btn"></div>
            <div class="skeleton skeleton-btn"></div>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderSkeletonTable() {
    const countEl = document.getElementById('horarios-count');
    if (countEl) {
      countEl.innerHTML = `<span class="skeleton" style="width:110px;height:14px;border-radius:4px;" aria-hidden="true"></span>`;
    }
    const tbody = document.getElementById('horarios-tbody');
    if (!tbody) return;
    tbody.setAttribute('aria-busy', 'true');
    tbody.setAttribute('role', 'progressbar');
    tbody.setAttribute('aria-label', 'Cargando esquemas de horarios...');
    tbody.innerHTML = renderSkeletonRows();
  }

  // ─── Carga de Estadísticas ────────────────────────────────────────────────
  function loadStats() {
    API.getHorariosStats().then(stats => {
      state.stats = stats;
      const grid = document.getElementById('horarios-stats-grid');
      if (!grid) return;

      grid.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon stat-icon--blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${parseInt(stats.total) || 0}</span>
            <span class="stat-label">Total Esquemas</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon--green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-3"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${parseInt(stats.presencial) || 0}</span>
            <span class="stat-label">Presencial</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon--purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${parseInt(stats.teletrabajo) || 0}</span>
            <span class="stat-label">Teletrabajo</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon--orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${parseInt(stats.trabajoEnCasa) || 0}</span>
            <span class="stat-label">Trabajo en Casa</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon--teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${parseInt(stats.horarioFlexible) || 0}</span>
            <span class="stat-label">Horario Flexible</span>
          </div>
        </div>
      `;
    }).catch(e => console.error('[HorariosModule] Error cargando stats:', e));
  }

  // ─── Carga de Datos y Tabla ────────────────────────────────────────────────
  async function loadData() {
    renderSkeletonTable();
    const tbody = document.getElementById('horarios-tbody');
    if (!tbody) return;

    try {
      const params = {
        page: state.page,
        limit: state.limit,
        q: state.filters.q,
        modalidad: state.filters.modalidad,
        estado: state.filters.estado,
        dependencia: state.filters.dependencia,
      };

      const res = await API.getHorarios(params);
      state.data = res.data || [];
      state.total = res.total || 0;
      state.totalPages = res.totalPages || 1;

      renderTable();
      renderPagination();
      const countEl = document.getElementById('horarios-count');
      if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} esquemas`;
    } catch (err) {
      tbody.removeAttribute('role');
      tbody.setAttribute('aria-busy', 'false');
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><span class="empty-state-title">Error al cargar</span><span class="empty-state-desc">${escHtml(err.message)}</span></div></td></tr>`;
    }
  }

  function renderTable() {
    const tbody = document.getElementById('horarios-tbody');
    if (!tbody) return;
    tbody.removeAttribute('role');
    tbody.setAttribute('aria-busy', 'false');

    if (state.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span class="empty-state-title">No hay esquemas registrados</span>
        <span class="empty-state-desc">No se encontraron esquemas de horarios con los filtros aplicados.</span>
        </div></td></tr>`;
      return;
    }

    const canManage = Auth.canEdit();

    tbody.innerHTML = state.data.map((item, idx) => {
      const tipoCalculoTag = item.tipo_calculo === 'Hábiles'
        ? `<span class="tag-calc-pill tag-habiles">Hábiles</span>`
        : `<span class="tag-calc-pill tag-calendario">Calendario</span>`;
      const vigenciaFin = item.fecha_fin ? formatDate(item.fecha_fin) : 'Indefinida';
      const consecutivo = item.numero_consecutivo != null ? item.numero_consecutivo : (idx + 1);
      const codGrado = (item.codigo || item.grado)
        ? `<span class="font-mono" style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">Cód. ${escHtml(item.codigo || '—')} &bull; Grd. ${escHtml(item.grado || '—')}</span>`
        : '';
      const secr = item.secretaria
        ? `<span class="user-table-sub" title="${escHtml(item.secretaria)}" style="color:var(--text-muted); font-size:11px;">Sec: ${escHtml(truncate(item.secretaria, 26))}</span>`
        : '';
      const horarioDias = item.dias_teletrabajo || item.franja_ingreso || '';
      const tieneSoporte = Boolean(item.soporte_acto);

      return `
        <tr>
          <td style="text-align:center;">
            <span class="badge-consecutivo font-mono font-bold" style="background:var(--color-bg-secondary, rgba(255,255,255,0.06)); padding:4px 8px; border-radius:6px; border:1px solid var(--color-border); font-size:12px;" title="Consecutivo Oficial #${consecutivo}">
              #${consecutivo}
            </span>
          </td>

          <td>
            <div class="user-table-cell">
              <span class="td-primary" title="${escHtml(item.apellidos_nombres)}">${escHtml(truncate(item.apellidos_nombres, 28))}</span>
              <span class="user-table-cc font-mono">C.C. ${escHtml(item.documento)}</span>
            </div>
          </td>

          <td>
            <div class="user-table-cell">
              <span class="user-table-title" title="${escHtml(item.cargo)}">${escHtml(truncate(item.cargo, 28))}</span>
              ${codGrado}
            </div>
          </td>

          <td>
            <div class="user-table-cell">
              <span class="user-table-title" title="${escHtml(item.dependencia)}">${escHtml(truncate(item.dependencia, 28))}</span>
              ${secr}
            </div>
          </td>

          <td>
            <div class="user-table-cell">
              <div style="display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">
                ${modalidadBadge(item.modalidad)}
              </div>
              ${horarioDias ? `<span class="user-table-sub font-bold" style="color:var(--color-primary-light, #60a5fa); margin-top:3px; display:inline-flex; align-items:center; gap:4px;" title="${escHtml(horarioDias)}">⏰ ${escHtml(truncate(horarioDias, 30))}</span>` : ''}
            </div>
          </td>

          <td>
            <div class="vigencia-cell">
              <div class="vigencia-fechas">
                <span>${formatDate(item.fecha_inicio)}</span>
                <span class="fecha-arrow">→</span>
                <span>${vigenciaFin}</span>
              </div>
              <div class="duracion-row">
                <span class="duracion-badge">${escHtml(item.duracion_texto || `${item.duracion_dias} días`)}</span>
                ${tipoCalculoTag}
              </div>
              ${item.numero_resolucion ? `
                <div style="margin-top:3px; font-size:11px; color:var(--text-muted); font-family:var(--font-mono, monospace);">
                  Res: <strong style="color:var(--text-secondary);">${escHtml(item.numero_resolucion)}</strong>
                </div>
              ` : ''}
            </div>
          </td>

          <td style="text-align:center;">
            ${tieneSoporte ? `
              <button type="button" class="btn btn-secondary btn-sm" onclick="HorariosModule.viewSoporte(${item.id_horario})" title="Ver Reporte / Documento Firmado Adjunto" style="display:inline-flex; align-items:center; gap:5px; font-size:11px; padding:4px 8px; color:var(--color-green-bright, #22c55e); border-color:rgba(34,197,94,0.3);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:13px;height:13px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span>Cargado</span>
              </button>
            ` : `
              <button type="button" class="btn btn-outline btn-sm" onclick="HorariosModule.openUploadSoporteModal(${item.id_horario})" title="Subir Hoja Firmada / Reporte Escaneado" style="display:inline-flex; align-items:center; gap:5px; font-size:11px; padding:4px 8px; color:var(--text-muted); opacity:0.85;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <span>Adjuntar</span>
              </button>
            `}
          </td>

          <td>
            <button type="button" class="badge badge--interactive ${badgeClass(item.estado)}" onclick="HorariosModule.openStatusPicker(${item.id_horario})" title="Clic para cambiar estado de este horario" aria-label="Cambiar estado: ${item.estado}">
              <span>${item.estado}</span>
              <svg class="badge-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </td>

          <td class="td-actions">
            <div class="td-actions-wrap">
              <button class="btn-action-view" onclick="HorariosModule.openView(${item.id_horario})" title="Ver Detalles y Trazabilidad">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn-action-soporte" onclick="HorariosModule.openUploadSoporteModal(${item.id_horario})" title="${tieneSoporte ? 'Ver / Reemplazar Hoja de Soporte' : 'Adjuntar Hoja de Soporte Firmada'}" style="${tieneSoporte ? 'color:var(--color-green-bright, #22c55e);' : ''}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>
              ${canManage ? `
              <button class="btn-action-edit" onclick="HorariosModule.openEdit(${item.id_horario})" title="Editar Esquema">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-action-delete" onclick="HorariosModule.confirmDelete(${item.id_horario}, '${escHtml(item.apellidos_nombres)}')" title="Eliminar Esquema">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  function renderPagination() {
    const el = document.getElementById('horarios-pagination');
    if (!el) return;
    el.innerHTML = `
      <span class="pagination-info">Mostrando ${state.data.length} de ${state.total.toLocaleString('es-CO')} esquemas</span>
      <div class="pagination-btns">
        <button class="page-btn" onclick="HorariosModule.goPage(${state.page - 1})" ${state.page <= 1 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="page-btn active">${state.page}</span>
        <span style="color:var(--text-muted);font-size:var(--text-sm)">/ ${state.totalPages}</span>
        <button class="page-btn" onclick="HorariosModule.goPage(${state.page + 1})" ${state.page >= state.totalPages ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`;
  }


  // ─── Modal de Creación / Edición Dinámico ──────────────────────────────────
  function openScheduleModal(item = null) {
    const isEdit = Boolean(item);
    const title = isEdit ? 'Editar Esquema de Horario' : 'Registrar Nuevo Esquema de Horario';

    const curModalidad = item?.modalidad || 'Presencial';
    const curTipoCalc  = item?.tipo_calculo || 'Hábiles';

    const bodyHtml = `
      <form id="form-horario" class="form-grid" onsubmit="return false;">
        <!-- Consecutivo, Código y Grado Institucional -->
        <div class="form-group span-2" style="display:flex; gap:16px; align-items:center; background:var(--color-bg-secondary, rgba(255,255,255,0.03)); padding:14px 18px; border-radius:var(--radius-md); border:1px solid var(--color-border); flex-wrap:wrap;">
          <div style="flex:1; min-width:140px;">
            <label for="horario-consecutivo" class="form-label" style="margin-bottom:4px; font-weight:700;">No. Consecutivo Oficial</label>
            <input type="number" id="horario-consecutivo" class="form-input font-mono font-bold" min="1" placeholder="Ej: 1" value="${item?.numero_consecutivo || ''}" style="width:100%;" />
            <small class="field-hint" style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">Autoincrementable o asignado manualmente</small>
          </div>
          <div style="flex:1; min-width:120px;">
            <label for="horario-codigo" class="form-label" style="margin-bottom:4px;">Código</label>
            <input type="text" id="horario-codigo" class="form-input font-mono" placeholder="Ej: 219" value="${escHtml(item?.codigo || '')}" style="width:100%;" />
            <small class="field-hint" style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">Código del cargo</small>
          </div>
          <div style="flex:1; min-width:120px;">
            <label for="horario-grado" class="form-label" style="margin-bottom:4px;">Grado</label>
            <input type="text" id="horario-grado" class="form-input font-mono" placeholder="Ej: 05" value="${escHtml(item?.grado || '')}" style="width:100%;" />
            <small class="field-hint" style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">Grado salarial</small>
          </div>
        </div>

        <!-- Sección: Servidor Público -->
        <div class="form-group span-2">
          <div class="form-section-header">
            <div class="form-section-icon form-section-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <span class="form-section-title">Servidor Público</span>
              <span class="form-section-desc">Búsqueda y datos del funcionario institucional</span>
            </div>
          </div>
        </div>

        ${!isEdit ? `
        <div class="form-group span-2 autocomplete-wrapper">
          <label for="horario-search-emp" class="form-label">Buscar Servidor en Nómina (Nombre o Cédula)</label>
          <input type="text" id="horario-search-emp" class="form-input" placeholder="Escriba para autocompletar desde el directorio de empleados..." autocomplete="off" />
          <div id="horario-emp-results" class="autocomplete-dropdown" style="display:none;"></div>
          <small class="field-hint" style="font-size:11px; color:var(--text-muted); display:block; margin-top:3px;">
            Selecciona un funcionario para autocompletar sus datos o digítalos manualmente abajo.
          </small>
        </div>` : ''}

        <div class="form-group">
          <label for="horario-documento" class="form-label required">Documento de Identidad (C.C.)</label>
          <input type="text" id="horario-documento" class="form-input font-mono font-bold" placeholder="Número de documento / Cédula" value="${escHtml(
            item?.documento || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-nombre" class="form-label required">Nombres y Apellidos</label>
          <input type="text" id="horario-nombre" class="form-input font-bold" placeholder="Nombres y apellidos completos" value="${escHtml(
            item?.apellidos_nombres || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-dependencia" class="form-label required">Dependencia</label>
          <input type="text" id="horario-dependencia" class="form-input" placeholder="Ej: CONTROL INTERNO DE GESTION..." value="${escHtml(
            item?.dependencia || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-secretaria" class="form-label">Secretaría</label>
          <input type="text" id="horario-secretaria" class="form-input" placeholder="Ej: DESPACHO GOBERNADOR..." value="${escHtml(
            item?.secretaria || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-cargo" class="form-label required">Cargo</label>
          <input type="text" id="horario-cargo" class="form-input" placeholder="Cargo institucional..." value="${escHtml(item?.cargo || '')}" />
        </div>

        <div class="form-group">
          <label for="horario-estado" class="form-label required">Estado del Esquema</label>
          <select id="horario-estado" class="filter-select">
            <option value="Activa" ${item?.estado === 'Activa' ? 'selected' : ''}>Activa (En vigencia)</option>
            <option value="Pendiente" ${item?.estado === 'Pendiente' ? 'selected' : ''}>Pendiente de inicio</option>
            <option value="En revisión" ${item?.estado === 'En revisión' ? 'selected' : ''}>En revisión técnica</option>
            <option value="Caducada" ${item?.estado === 'Caducada' ? 'selected' : ''}>Caducada (Finalizada)</option>
          </select>
        </div>

        <!-- Sección: Modalidad de Trabajo -->
        <div class="form-group span-2" style="margin-top:var(--space-2);">
          <div class="form-section-header">
            <div class="form-section-icon form-section-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div>
              <span class="form-section-title">Modalidad de Trabajo</span>
              <span class="form-section-desc">Seleccione el esquema laboral acordado</span>
            </div>
          </div>
        </div>

        <div class="form-group span-2">
          <div class="modalidad-cards-selector">
            <label class="modalidad-card-option ${curModalidad === 'Presencial' ? 'selected' : ''}">
              <input type="radio" name="modalidad_radio" value="Presencial" ${curModalidad === 'Presencial' ? 'checked' : ''} />
              <div class="mcard-icon">🏢</div>
              <div class="mcard-info">
                <strong>Presencial</strong>
                <span>Jornada ordinaria en sede física</span>
              </div>
            </label>

            <label class="modalidad-card-option ${curModalidad === 'Teletrabajo' ? 'selected' : ''}">
              <input type="radio" name="modalidad_radio" value="Teletrabajo" ${curModalidad === 'Teletrabajo' ? 'checked' : ''} />
              <div class="mcard-icon">💻</div>
              <div class="mcard-info">
                <strong>Teletrabajo</strong>
                <span>Esquema híbrido o autónomo</span>
              </div>
            </label>

            <label class="modalidad-card-option ${curModalidad === 'Trabajo en casa' ? 'selected' : ''}">
              <input type="radio" name="modalidad_radio" value="Trabajo en casa" ${curModalidad === 'Trabajo en casa' ? 'checked' : ''} />
              <div class="mcard-icon">🏠</div>
              <div class="mcard-info">
                <strong>Trabajo en casa</strong>
                <span>Modalidad transitoria y excepcional</span>
              </div>
            </label>

            <label class="modalidad-card-option ${curModalidad === 'Horario flexible' ? 'selected' : ''}">
              <input type="radio" name="modalidad_radio" value="Horario flexible" ${curModalidad === 'Horario flexible' ? 'checked' : ''} />
              <div class="mcard-icon">⏰</div>
              <div class="mcard-info">
                <strong>Horario flexible</strong>
                <span>Franjas escalonadas de horario</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Subsección Dinámica: Teletrabajo -->
        <div id="dynamic-section-teletrabajo" class="form-group span-2 dynamic-subform" style="display:${curModalidad === 'Teletrabajo' ? 'block' : 'none'};">
          <div class="subform-banner subform-banner--purple">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <span>Configuración de Teletrabajo</span>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3);">
            <div class="form-group">
              <label for="subtipo-teletrabajo" class="form-label required">Tipo de Teletrabajo</label>
              <select id="subtipo-teletrabajo" class="filter-select">
                <option value="Suplementario (Híbrido)" ${item?.subtipo_teletrabajo === 'Suplementario (Híbrido)' ? 'selected' : ''}>Suplementario (Híbrido: Días casa / oficina)</option>
                <option value="Autónomo" ${item?.subtipo_teletrabajo === 'Autónomo' ? 'selected' : ''}>Autónomo (100% Remoto)</option>
                <option value="Móvil" ${item?.subtipo_teletrabajo === 'Móvil' ? 'selected' : ''}>Móvil (Itinerante sin sede fija)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="domicilio-laboral" class="form-label required">Dirección Domicilio Laboral (ARL)</label>
              <input type="text" id="domicilio-laboral" class="form-input" placeholder="Ej: Calle 20 # 10-45, Tunja" value="${escHtml(item?.domicilio_laboral || '')}" />
            </div>
            <div class="form-group">
              <label for="dias-teletrabajo" class="form-label">Días Remotos (Casa) o Franja</label>
              <input type="text" id="dias-teletrabajo" class="form-input" placeholder="Ej: martes y jueves" value="${escHtml(item?.dias_teletrabajo || 'martes y jueves')}" />
            </div>
            <div class="form-group">
              <label for="dias-presencial" class="form-label">Días en Sede Presencial</label>
              <input type="text" id="dias-presencial" class="form-input" placeholder="Ej: Lunes, Miércoles y Viernes" value="${escHtml(item?.dias_presencial || 'Lunes, Miércoles, Viernes')}" />
            </div>
            <div class="form-group" style="display:flex; align-items:center; justify-content:center;">
              <label class="form-checkbox-label" style="margin:0;">
                <input type="checkbox" id="notificacion-arl" ${item?.notificacion_arl ? 'checked' : ''} />
                <span>¿Notificado formalmente ante la ARL?</span>
              </label>
            </div>
            <div class="form-group">
              <label for="fecha-reporte-arl" class="form-label">Fecha de Reporte ARL</label>
              <input type="date" id="fecha-reporte-arl" class="form-input" value="${item?.fecha_reporte_arl ? item.fecha_reporte_arl.split('T')[0] : ''}" />
            </div>
          </div>
        </div>

        <!-- Subsección Dinámica: Trabajo en casa -->
        <div id="dynamic-section-trabajo-casa" class="form-group span-2 dynamic-subform" style="display:${curModalidad === 'Trabajo en casa' ? 'block' : 'none'};">
          <div class="subform-banner subform-banner--amber">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Nota institucional: Al activar Trabajo en casa, se suspenderán temporalmente las solicitudes de vacaciones activas de este servidor.</span>
          </div>

          <div class="form-group" style="margin-bottom:var(--space-3);">
            <label for="motivo-trabajo-casa" class="form-label required">Justificación Excepcional o Transitoria</label>
            <textarea id="motivo-trabajo-casa" class="form-textarea" rows="2" placeholder="Describa la situación de salud, calamidad o caso fortuito...">${escHtml(item?.motivo_trabajo_casa || '')}</textarea>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3);">
            <div class="form-group">
              <label for="direccion-trabajo-casa" class="form-label">Lugar de Prestación del Servicio</label>
              <input type="text" id="direccion-trabajo-casa" class="form-input" placeholder="Dirección de residencia o estadía transitoria" value="${escHtml(item?.direccion_trabajo_casa || '')}" />
            </div>
            <div class="form-group">
              <label for="herramientas-tic" class="form-label">Herramientas TIC / Equipos</label>
              <input type="text" id="herramientas-tic" class="form-input" placeholder="Ej: Portátil institucional + conectividad propia" value="${escHtml(item?.herramientas_tic || 'Equipo propio y conectividad institucional VPN')}" />
            </div>
          </div>

          <div class="form-group" style="margin-top:var(--space-2);">
            <label class="form-checkbox-label">
              <input type="checkbox" id="prorroga-trabajo-casa" ${item?.prorroga ? 'checked' : ''} />
              <span>¿Es una prórroga extraordinaria del periodo inicial?</span>
            </label>
          </div>
        </div>

        <!-- Subsección Dinámica: Horario Flexible -->
        <div id="dynamic-section-horario-flexible" class="form-group span-2 dynamic-subform" style="display:${curModalidad === 'Horario flexible' ? 'block' : 'none'};">
          <div class="subform-banner subform-banner--cyan">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>Bandas y Franjas de Flexibilidad Horaria Concertada</span>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3);">
            <div class="form-group">
              <label for="franja-ingreso" class="form-label required">Banda Horaria de Ingreso</label>
              <input type="text" id="franja-ingreso" class="form-input" placeholder="Ej: 07:00 - 08:30" value="${escHtml(item?.franja_ingreso || '07:00 - 08:30')}" />
            </div>
            <div class="form-group">
              <label for="franja-salida" class="form-label required">Banda Horaria de Salida</label>
              <input type="text" id="franja-salida" class="form-input" placeholder="Ej: 16:30 - 18:00" value="${escHtml(item?.franja_salida || '16:30 - 18:00')}" />
            </div>
            <div class="form-group">
              <label for="horas-semanales" class="form-label required">Jornada Semanal Total</label>
              <select id="horas-semanales" class="filter-select">
                <option value="40" ${item?.horas_semanales === 40 ? 'selected' : ''}>40 Horas semanales</option>
                <option value="44" ${item?.horas_semanales === 44 ? 'selected' : ''}>44 Horas semanales</option>
              </select>
            </div>
            <div class="form-group">
              <label for="tiempo-almuerzo" class="form-label">Tiempo de Almuerzo</label>
              <input type="text" id="tiempo-almuerzo" class="form-input" placeholder="Ej: 1 hora" value="${escHtml(item?.tiempo_almuerzo || '1 hora')}" />
            </div>
          </div>

          <div class="form-group" style="margin-top:var(--space-2);">
            <label for="justificacion-flex" class="form-label">Justificación o Concertación</label>
            <input type="text" id="justificacion-flex" class="form-input" placeholder="Ej: Cuidado de menores, estudios superiores, franja 8 AM A 12 M..." value="${escHtml(item?.justificacion_flex || '')}" />
          </div>
        </div>

        <!-- Sección: Vigencia y Duración -->
        <div class="form-group span-2" style="margin-top:var(--space-2);">
          <div class="form-section-header">
            <div class="form-section-icon form-section-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div>
              <span class="form-section-title">Vigencia y Duración</span>
              <span class="form-section-desc">Vigencia temporal o permanente del esquema</span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="horario-fecha-inicio" class="form-label required">Fecha de Inicio</label>
          <input type="date" id="horario-fecha-inicio" class="form-input" value="${
            item?.fecha_inicio
              ? item.fecha_inicio.split('T')[0]
              : new Date().toISOString().split('T')[0]
          }" />
        </div>

        <div class="form-group">
          <label class="form-label">Tipo de Cómputo</label>
          <div class="tipo-calculo-pill-toggle">
            <button type="button" class="pill-calc-btn ${curTipoCalc === 'Hábiles' ? 'active' : ''}" data-calc="Hábiles">
              📅 Días Hábiles (L-V)
            </button>
            <button type="button" class="pill-calc-btn ${curTipoCalc === 'Calendario' ? 'active' : ''}" data-calc="Calendario">
              🗓️ Días Calendario
            </button>
            <input type="hidden" id="horario-tipo-calculo" value="${curTipoCalc}" />
          </div>
        </div>

        <div class="form-group span-2">
          <div class="duration-header-row">
            <label for="horario-duracion-texto" class="form-label">Duración del Esquema</label>
            <span id="duration-preview-pill" class="duration-badge-pill duration-badge-pill--valid">✓ Válido</span>
          </div>

          <div class="duration-input-wrap">
            <input type="text" id="horario-duracion-texto" class="form-input font-bold" placeholder="Ej: 6 meses, 1 año, 45 días o Permanente..." value="${escHtml(
              item?.duracion_texto || (curModalidad === 'Presencial' ? 'Permanente' : '6 meses')
            )}" />
          </div>

          <div class="quick-duration-chips">
            <span class="chips-label">Atajos comunes:</span>
            <button type="button" class="chip-duration" data-dur="15 días">15 días</button>
            <button type="button" class="chip-duration" data-dur="1 mes">1 mes</button>
            <button type="button" class="chip-duration" data-dur="3 meses">3 meses</button>
            <button type="button" class="chip-duration" data-dur="6 meses">6 meses</button>
            <button type="button" class="chip-duration" data-dur="1 año">1 año</button>
            <button type="button" class="chip-duration" data-dur="2 años">2 años</button>
            <button type="button" class="chip-duration" data-dur="Permanente">Permanente</button>
          </div>
        </div>

        <div class="form-group">
          <label for="horario-fecha-fin" class="form-label">Fecha de Finalización</label>
          <input type="date" id="horario-fecha-fin" class="form-input" value="${
            item?.fecha_fin ? item.fecha_fin.split('T')[0] : ''
          }" />
          <small class="field-hint" style="font-size:11px; color:var(--text-muted);">Calculada automáticamente o configurable manualmente</small>
        </div>

        <div class="form-group" style="justify-content:center;">
          <div class="notice-retorno-box">
            <span>ℹ️ Al culminar la vigencia, el servidor retornará automáticamente a la modalidad <strong>Presencial</strong>.</span>
          </div>
        </div>

        <!-- Sección: Acto Administrativo -->
        <div class="form-group span-2" style="margin-top:var(--space-2);">
          <div class="form-section-header">
            <div class="form-section-icon form-section-icon--amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div>
              <span class="form-section-title">Acto Administrativo</span>
              <span class="form-section-desc">Resolución y formalización institucional</span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="horario-resolucion" class="form-label required">Número de Resolución</label>
          <input type="text" id="horario-resolucion" class="form-input font-mono font-bold" placeholder="Ej: RES-2026-0412" value="${escHtml(
            item?.numero_resolucion || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-fecha-aprobacion" class="form-label">Fecha de Aprobación</label>
          <input type="date" id="horario-fecha-aprobacion" class="form-input" value="${
            item?.fecha_aprobacion ? item.fecha_aprobacion.split('T')[0] : ''
          }" />
        </div>

        <div class="form-group">
          <label for="horario-fecha-notificacion" class="form-label">Fecha de Notificación</label>
          <input type="date" id="horario-fecha-notificacion" class="form-input" value="${
            item?.fecha_notificacion ? item.fecha_notificacion.split('T')[0] : ''
          }" />
        </div>

        <div class="form-group">
          <label for="horario-aprobado-por" class="form-label">Aprobado / Autorizado Por</label>
          <input type="text" id="horario-aprobado-por" class="form-input" value="${escHtml(
            item?.aprobado_por || 'Angela Ussa'
          )}" />
        </div>

        <!-- Sección: Soporte Documental (Hoja impresa y firmada) -->
        <div class="form-group span-2">
          <label class="form-label">Cargar Hoja de Solicitud / Reporte Firmado (Documento Soporte)</label>
          <div class="excel-dropzone" id="horario-soporte-dropzone" style="padding: 20px 16px; margin: 0; background: var(--color-bg-secondary, rgba(255,255,255,0.02)); border: 2px dashed var(--color-border); cursor: pointer;">
            <input type="file" id="horario-soporte-file" accept=".pdf, image/*" style="display:none;" />
            <div class="excel-dropzone-icon" style="margin-bottom: 6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary, #3b82f6)" stroke-width="2" style="width:36px;height:36px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <p class="excel-dropzone-title" style="font-size:13px; margin-bottom:2px;">Haz clic o arrastra la hoja impresa y firmada (PDF o Imagen)</p>
            <p class="excel-dropzone-sub" style="font-size:11px;">Formatos soportados: PDF, JPG, PNG (hasta 20MB)</p>
            
            <div id="horario-soporte-preview-wrap" style="display:${item?.soporte_acto ? 'block' : 'none'}; margin-top: 10px;">
              <div class="excel-file-preview-card" style="padding: 10px 14px; margin: 0; background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.3);">
                <div class="excel-file-preview-left">
                  <div class="excel-file-preview-icon" style="font-size:18px;">📄</div>
                  <div class="excel-file-preview-info">
                    <div id="horario-soporte-preview-text" class="excel-file-preview-name" style="font-size:12px;">${item?.soporte_acto ? 'Documento firmado actualmente cargado' : ''}</div>
                  </div>
                </div>
                <div style="display:flex; gap:6px;">
                  ${item?.soporte_acto ? `<button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); HorariosModule.viewSoporte(${item.id_horario})" style="font-size:11px; padding:3px 8px;">Ver</button>` : ''}
                  <button type="button" id="btn-remove-horario-soporte" class="btn btn-danger btn-sm" style="font-size:11px; padding:3px 8px;" title="Remover soporte">Remover</button>
                </div>
              </div>
            </div>
            <input type="hidden" id="horario-soporte-val" value="${escHtml(item?.soporte_acto || '')}" />
          </div>
        </div>

        <div class="form-group span-2">
          <label for="horario-observaciones" class="form-label">Observaciones Generales</label>
          <textarea id="horario-observaciones" class="form-textarea" rows="2" placeholder="Anotaciones administrativas adicionales...">${escHtml(
            item?.observaciones || ''
          )}</textarea>
        </div>
      </form>
    `;

    const footerButtons = [
      {
        text: 'Cancelar',
        cls: 'btn-secondary',
        action: () => {
          document.querySelector('.modal-box')?.classList.remove('modal-schedule');
          App.closeModal();
        },
      },
      {
        text: isEdit ? 'Guardar Cambios' : 'Crear Esquema de Horario',
        cls: 'btn-primary',
        action: () => submitScheduleForm(item?.id_horario),
      },
    ];

    App.openModal(title, bodyHtml, footerButtons);
    document.querySelector('.modal-box')?.classList.add('modal-schedule');

    // Conectar eventos dinámicos del formulario
    bindModalFormEvents(item);
  }

  // ─── Lógica Dinámica del Formulario (Autocomplete y Fechas) ─────────────────
  function bindModalFormEvents(item) {
    // 1. Selector de Modalidad dinámico
    const modalidadRadios = document.querySelectorAll('input[name="modalidad_radio"]');
    modalidadRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.modalidad-card-option').forEach((card) => card.classList.remove('selected'));
        radio.closest('.modalidad-card-option')?.classList.add('selected');

        const val = radio.value;
        const secTele = document.getElementById('dynamic-section-teletrabajo');
        const secCasa = document.getElementById('dynamic-section-trabajo-casa');
        const secFlex = document.getElementById('dynamic-section-horario-flexible');

        if (secTele) secTele.style.display = val === 'Teletrabajo' ? 'block' : 'none';
        if (secCasa) secCasa.style.display = val === 'Trabajo en casa' ? 'block' : 'none';
        if (secFlex) secFlex.style.display = val === 'Horario flexible' ? 'block' : 'none';

        const durInput = document.getElementById('horario-duracion-texto');
        if (val === 'Presencial' && (!durInput.value || durInput.value === '6 meses' || durInput.value === '1 año')) {
          durInput.value = 'Permanente';
        } else if (val !== 'Presencial' && durInput.value === 'Permanente') {
          durInput.value = '6 meses';
        }

        triggerLiveDateCalculation();
      });
    });

    // 2. Selector de Días Hábiles vs Calendario
    const pillCalcButtons = document.querySelectorAll('.pill-calc-btn');
    pillCalcButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        pillCalcButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const calcVal = btn.getAttribute('data-calc');
        const inputHidden = document.getElementById('horario-tipo-calculo');
        if (inputHidden) inputHidden.value = calcVal;
        triggerLiveDateCalculation();
      });
    });

    // 3. Chips de acceso rápido de duración
    const chips = document.querySelectorAll('.chip-duration');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const durInput = document.getElementById('horario-duracion-texto');
        if (durInput) {
          durInput.value = chip.getAttribute('data-dur');
          triggerLiveDateCalculation();
        }
      });
    });

    // 4. Input flexible de duración
    const durInput = document.getElementById('horario-duracion-texto');
    durInput?.addEventListener('input', () => {
      triggerLiveDateCalculation();
    });

    const startDateInput = document.getElementById('horario-fecha-inicio');
    startDateInput?.addEventListener('change', () => {
      triggerLiveDateCalculation();
    });

    // 5. Autocomplete de servidores públicos
    const empSearchInput = document.getElementById('horario-search-emp');
    const empResultsDiv = document.getElementById('horario-emp-results');

    empSearchInput?.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(employeeSearchTimeout);

      if (q.length < 2) {
        if (empResultsDiv) empResultsDiv.style.display = 'none';
        return;
      }

      employeeSearchTimeout = setTimeout(async () => {
        try {
          const res = await API.getEmployees({ q, limit: 6 });
          const list = res.data || [];
          if (list.length === 0) {
            empResultsDiv.innerHTML = `<div class="autocomplete-item text-muted">No se encontraron funcionarios</div>`;
          } else {
            empResultsDiv.innerHTML = list
              .map(
                (emp) => `
              <div class="autocomplete-item" data-doc="${escHtml(emp.cedula || emp.documento)}" data-name="${escHtml(
                  emp.nombre_completo || emp.persona
                )}" data-dept="${escHtml(emp.dependencia || '')}" data-cargo="${escHtml(emp.cargo || '')}">
                <strong>${escHtml(emp.nombre_completo || emp.persona)}</strong>
                <small class="text-muted">C.C. ${escHtml(emp.cedula || emp.documento)} — ${escHtml(
                  emp.cargo || 'Funcionario'
                )}</small>
              </div>
            `
              )
              .join('');

            empResultsDiv.querySelectorAll('.autocomplete-item').forEach((itemEl) => {
              itemEl.addEventListener('click', () => {
                const doc = itemEl.getAttribute('data-doc');
                const name = itemEl.getAttribute('data-name');
                const dept = itemEl.getAttribute('data-dept');
                const cargo = itemEl.getAttribute('data-cargo');

                document.getElementById('horario-documento').value = doc;
                document.getElementById('horario-nombre').value = name;
                document.getElementById('horario-dependencia').value = dept || 'SECRETARÍA GENERAL';
                document.getElementById('horario-cargo').value = cargo || 'PROFESIONAL UNIVERSITARIO';
                empSearchInput.value = `${name} (C.C. ${doc})`;
                empResultsDiv.style.display = 'none';
              });
            });
          }
          empResultsDiv.style.display = 'block';
        } catch (err) {
          console.error('Error autocomplete:', err);
        }
      }, 250);
    });

    document.addEventListener('click', (ev) => {
      if (!empSearchInput?.contains(ev.target) && !empResultsDiv?.contains(ev.target)) {
        if (empResultsDiv) empResultsDiv.style.display = 'none';
      }
    });

    // 6. Carga de archivo de soporte / reporte firmado
    const soporteDropzone = document.getElementById('horario-soporte-dropzone');
    const soporteFileInput = document.getElementById('horario-soporte-file');
    const soporteValInput = document.getElementById('horario-soporte-val');
    const soportePreviewWrap = document.getElementById('horario-soporte-preview-wrap');
    const soportePreviewText = document.getElementById('horario-soporte-preview-text');
    const btnRemoveSoporte = document.getElementById('btn-remove-horario-soporte');

    const handleFormSoporteFile = (file) => {
      if (!file) return;
      if (!file.type.match('image.*') && file.type !== 'application/pdf') {
        App.showToast('Por favor seleccione un archivo PDF o una imagen (JPG/PNG).', 'error');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        App.showToast('El archivo supera los 20MB permitidos.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (soporteValInput) soporteValInput.value = e.target.result;
        if (soportePreviewText) soportePreviewText.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        if (soportePreviewWrap) soportePreviewWrap.style.display = 'block';
        App.showToast(`Archivo "${file.name}" cargado como soporte.`, 'success');
      };
      reader.readAsDataURL(file);
    };

    soporteDropzone?.addEventListener('click', () => soporteFileInput?.click());
    soporteFileInput?.addEventListener('change', (e) => {
      if (e.target.files?.length) handleFormSoporteFile(e.target.files[0]);
    });
    soporteDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      soporteDropzone.classList.add('excel-dropzone-dragover');
    });
    soporteDropzone?.addEventListener('dragleave', () => soporteDropzone.classList.remove('excel-dropzone-dragover'));
    soporteDropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      soporteDropzone.classList.remove('excel-dropzone-dragover');
      if (e.dataTransfer.files?.length) handleFormSoporteFile(e.dataTransfer.files[0]);
    });

    btnRemoveSoporte?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (soporteValInput) soporteValInput.value = '';
      if (soporteFileInput) soporteFileInput.value = '';
      if (soportePreviewWrap) soportePreviewWrap.style.display = 'none';
      App.showToast('Documento soporte removido.', 'info');
    });

    // 7. Auto-asignar consecutivo sugerido al crear
    if (!item) {
      API.getNextHorarioConsecutivo?.().then((res) => {
        const cInput = document.getElementById('horario-consecutivo');
        if (cInput && !cInput.value && res?.nextConsecutivo) {
          cInput.value = res.nextConsecutivo;
        }
      }).catch(() => {});
    }

    // Ejecutar cálculo inicial
    triggerLiveDateCalculation();
  }

  // ─── Recálculo en Vivo de Fechas y Validación ──────────────────────────────
  let calcDebounce = null;
  function triggerLiveDateCalculation() {
    clearTimeout(calcDebounce);
    calcDebounce = setTimeout(async () => {
      const fechaInicio = document.getElementById('horario-fecha-inicio')?.value;
      const duracionTexto = document.getElementById('horario-duracion-texto')?.value?.trim();
      const tipoCalculo = document.getElementById('horario-tipo-calculo')?.value || 'Hábiles';
      const pill = document.getElementById('duration-preview-pill');
      const finInput = document.getElementById('horario-fecha-fin');

      if (!fechaInicio) return;

      const dLower = (duracionTexto || '').toLowerCase();
      if (!duracionTexto || dLower.includes('permanente') || dLower.includes('indefinid') || dLower.includes('sin definir')) {
        if (pill) {
          pill.className = 'duration-badge-pill duration-badge-pill--valid';
          pill.textContent = '✓ Vigencia permanente';
        }
        if (finInput && (!finInput.value || dLower.includes('permanente'))) finInput.value = '';
        return;
      }

      try {
        const res = await API.calculateHorarioDates({
          fechaInicio,
          duracionTexto,
          tipoCalculo,
        });

        if (res.valid) {
          if (pill) {
            pill.className = 'duration-badge-pill duration-badge-pill--valid';
            pill.textContent = res.duracionDias > 0 ? `✓ ${res.duracionTexto} (${res.duracionDias} días)` : `✓ ${res.duracionTexto}`;
          }
          if (finInput && res.fechaFin) {
            finInput.value = res.fechaFin;
          }
        }
      } catch (err) {
        if (pill) {
          pill.className = 'duration-badge-pill duration-badge-pill--error';
          pill.textContent = `ℹ️ Ej: 6 meses, 1 año o 45 días`;
        }
      }
    }, 200);
  }

  // ─── Envío del Formulario (Creación o Edición) ─────────────────────────────
  async function submitScheduleForm(existingId = null) {
    const numero_consecutivo = document.getElementById('horario-consecutivo')?.value;
    const codigo = document.getElementById('horario-codigo')?.value?.trim();
    const grado = document.getElementById('horario-grado')?.value?.trim();
    const secretaria = document.getElementById('horario-secretaria')?.value?.trim();

    const documento = document.getElementById('horario-documento')?.value?.trim();
    const apellidos_nombres = document.getElementById('horario-nombre')?.value?.trim();
    const dependencia = document.getElementById('horario-dependencia')?.value?.trim();
    const cargo = document.getElementById('horario-cargo')?.value?.trim();
    const estado = document.getElementById('horario-estado')?.value;

    const modalidadRadio = document.querySelector('input[name="modalidad_radio"]:checked');
    const modalidad = modalidadRadio ? modalidadRadio.value : 'Presencial';

    const fecha_inicio = document.getElementById('horario-fecha-inicio')?.value;
    const fecha_fin = document.getElementById('horario-fecha-fin')?.value;
    const duracion_texto = document.getElementById('horario-duracion-texto')?.value?.trim();
    const tipo_calculo = document.getElementById('horario-tipo-calculo')?.value || 'Hábiles';

    // Acto administrativo
    const numero_resolucion = document.getElementById('horario-resolucion')?.value?.trim();
    const fecha_aprobacion = document.getElementById('horario-fecha-aprobacion')?.value;
    const fecha_notificacion = document.getElementById('horario-fecha-notificacion')?.value;
    const aprobado_por = document.getElementById('horario-aprobado-por')?.value?.trim();
    const soporte_acto = document.getElementById('horario-soporte-val')?.value?.trim();
    const observaciones = document.getElementById('horario-observaciones')?.value?.trim();

    // Validaciones básicas
    if (!documento || !apellidos_nombres) {
      App.showToast('Debes seleccionar un funcionario válido.', 'warning');
      return;
    }
    if (!fecha_inicio) {
      App.showToast('La fecha de inicio es requerida.', 'warning');
      return;
    }
    if (!numero_resolucion) {
      App.showToast('El Número de Resolución es obligatorio.', 'warning');
      return;
    }

    const payload = {
      numero_consecutivo: numero_consecutivo ? parseInt(numero_consecutivo, 10) : null,
      codigo: codigo || null,
      grado: grado || null,
      secretaria: secretaria || null,
      documento,
      apellidos_nombres,
      dependencia,
      cargo,
      estado,
      modalidad,
      fecha_inicio,
      fecha_fin: fecha_fin || null,
      duracion_texto: duracion_texto || (modalidad === 'Presencial' ? 'Permanente' : '6 meses'),
      tipo_calculo,
      numero_resolucion,
      fecha_aprobacion: fecha_aprobacion || null,
      fecha_notificacion: fecha_notificacion || null,
      aprobado_por: aprobado_por || 'Angela Ussa',
      soporte_acto: soporte_acto || null,
      observaciones,
    };

    // Campos dinámicos según modalidad
    if (modalidad === 'Teletrabajo') {
      payload.subtipo_teletrabajo = document.getElementById('subtipo-teletrabajo')?.value;
      payload.domicilio_laboral = document.getElementById('domicilio-laboral')?.value?.trim();
      payload.dias_teletrabajo = document.getElementById('dias-teletrabajo')?.value?.trim();
      payload.dias_presencial = document.getElementById('dias-presencial')?.value?.trim();
      payload.notificacion_arl = document.getElementById('notificacion-arl')?.checked;
      payload.fecha_reporte_arl = document.getElementById('fecha-reporte-arl')?.value || null;
    } else if (modalidad === 'Trabajo en casa') {
      payload.motivo_trabajo_casa = document.getElementById('motivo-trabajo-casa')?.value?.trim();
      payload.direccion_trabajo_casa = document.getElementById('direccion-trabajo-casa')?.value?.trim();
      payload.herramientas_tic = document.getElementById('herramientas-tic')?.value?.trim();
      payload.prorroga = document.getElementById('prorroga-trabajo-casa')?.checked;
    } else if (modalidad === 'Horario flexible') {
      payload.franja_ingreso = document.getElementById('franja-ingreso')?.value?.trim();
      payload.franja_salida = document.getElementById('franja-salida')?.value?.trim();
      payload.horas_semanales = parseInt(document.getElementById('horas-semanales')?.value, 10) || 40;
      payload.tiempo_almuerzo = document.getElementById('tiempo-almuerzo')?.value?.trim();
      payload.justificacion_flex = document.getElementById('justificacion-flex')?.value?.trim();
    }

    try {
      if (existingId) {
        await API.updateHorario(existingId, payload);
        App.showToast('Esquema de horario actualizado correctamente.', 'success');
      } else {
        const res = await API.createHorario(payload);
        if (res.pausedVacationsCount > 0) {
          App.showToast(
            'Esquema registrado. Se pausó preventivamente la solicitud de vacaciones en curso.',
            'info'
          );
        } else {
          App.showToast('Esquema de horario creado exitosamente.', 'success');
        }
      }

      document.querySelector('.modal-box')?.classList.remove('modal-schedule');
      App.closeModal();
      await loadData();
      await loadStats();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }

  // ─── Modal de Vista Detallada & Trazabilidad (Historial) ───────────────────
  function renderDetailModalSkeleton() {
    return `
      <div class="skeleton-detail-wrapper" role="progressbar" aria-busy="true" aria-label="Cargando detalle del horario...">
        <div class="skeleton-detail-header">
          <div class="skeleton skeleton-avatar skeleton-avatar--lg"></div>
          <div class="skeleton-text-group" style="flex:1;">
            <div class="skeleton skeleton-line skeleton-line--title" style="width: 55%; height: 20px;"></div>
            <div class="skeleton skeleton-line" style="width: 40%; height: 13px;"></div>
            <div class="skeleton skeleton-line" style="width: 30%; height: 12px;"></div>
          </div>
          <div style="display:flex; gap:8px;">
            <div class="skeleton skeleton-badge" style="width: 95px; height: 24px;"></div>
            <div class="skeleton skeleton-badge" style="width: 75px; height: 24px;"></div>
          </div>
        </div>

        <div class="skeleton-detail-section">
          <div class="skeleton skeleton-line skeleton-line--title" style="width: 35%; height: 16px;"></div>
          <div class="skeleton-detail-grid">
            <div class="skeleton-detail-item">
              <div class="skeleton skeleton-line" style="width: 60%; height: 11px;"></div>
              <div class="skeleton skeleton-line" style="width: 85%; height: 15px;"></div>
            </div>
            <div class="skeleton-detail-item">
              <div class="skeleton skeleton-line" style="width: 50%; height: 11px;"></div>
              <div class="skeleton skeleton-line" style="width: 70%; height: 15px;"></div>
            </div>
            <div class="skeleton-detail-item">
              <div class="skeleton skeleton-line" style="width: 65%; height: 11px;"></div>
              <div class="skeleton skeleton-line" style="width: 80%; height: 15px;"></div>
            </div>
          </div>
        </div>

        <div class="skeleton-detail-section">
          <div class="skeleton skeleton-line skeleton-line--title" style="width: 30%; height: 16px;"></div>
          <div class="skeleton-detail-grid">
            <div class="skeleton-detail-item">
              <div class="skeleton skeleton-line" style="width: 55%; height: 11px;"></div>
              <div class="skeleton skeleton-line" style="width: 75%; height: 15px;"></div>
            </div>
            <div class="skeleton-detail-item">
              <div class="skeleton skeleton-line" style="width: 60%; height: 11px;"></div>
              <div class="skeleton skeleton-line" style="width: 80%; height: 15px;"></div>
            </div>
            <div class="skeleton-detail-item">
              <div class="skeleton skeleton-line" style="width: 50%; height: 11px;"></div>
              <div class="skeleton skeleton-line" style="width: 65%; height: 15px;"></div>
            </div>
          </div>
        </div>

        <div class="skeleton-detail-section">
          <div class="skeleton skeleton-line skeleton-line--title" style="width: 40%; height: 16px;"></div>
          <div class="skeleton-timeline-item">
            <div class="skeleton skeleton-avatar skeleton-avatar--sm"></div>
            <div class="skeleton-text-group" style="flex:1;">
              <div class="skeleton skeleton-line" style="width: 45%; height: 13px;"></div>
              <div class="skeleton skeleton-line" style="width: 70%; height: 12px;"></div>
            </div>
          </div>
          <div class="skeleton-timeline-item">
            <div class="skeleton skeleton-avatar skeleton-avatar--sm"></div>
            <div class="skeleton-text-group" style="flex:1;">
              <div class="skeleton skeleton-line" style="width: 40%; height: 13px;"></div>
              <div class="skeleton skeleton-line" style="width: 60%; height: 12px;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function openDetailModal(id) {
    App.openModal('Detalle de Esquema de Horario', renderDetailModalSkeleton(), [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
    ]);

    try {
      const res = await API.getHorarioById(id);
      const h = res.horario;
      const hist = res.historial || [];

      const bodyHtml = `
        <div class="horario-detail-modal">
          <!-- Cabecera de Funcionario -->
          <div class="detail-header-card glass">
            <div class="employee-avatar avatar-char avatar--lg">${(h.apellidos_nombres || 'F')[0]}</div>
            <div class="detail-header-info">
              <h3>
                ${escHtml(h.apellidos_nombres)}
                <span class="font-mono text-muted" style="font-size:13px; font-weight:normal; margin-left:6px;">(#${h.numero_consecutivo || h.id_horario})</span>
              </h3>
              <p>
                <strong>C.C.:</strong> ${escHtml(h.documento)} &nbsp;|&nbsp;
                <strong>Dependencia:</strong> ${escHtml(h.dependencia)}
                ${h.secretaria ? ` &nbsp;|&nbsp; <strong>Secretaría:</strong> ${escHtml(h.secretaria)}` : ''}
              </p>
              <p>
                <strong>Cargo:</strong> ${escHtml(h.cargo)}
                ${h.codigo ? ` &bull; <strong>Cód:</strong> ${escHtml(h.codigo)}` : ''}
                ${h.grado ? ` &bull; <strong>Grd:</strong> ${escHtml(h.grado)}` : ''}
              </p>
            </div>
            <div class="detail-header-badges">
              ${modalidadBadge(h.modalidad)}
              ${estadoBadge(h.estado)}
            </div>
          </div>

          <!-- Metadata Administrativa -->
          <div class="detail-section">
            <h4 class="detail-section-title">Acto Administrativo, Notificación y Soporte</h4>
            <div class="detail-grid detail-grid--3col">
              <div class="detail-item">
                <span class="detail-label">Número de Resolución</span>
                <span class="detail-val font-mono font-bold">${escHtml(h.numero_resolucion || 'S/N')}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Fecha de Aprobación</span>
                <span class="detail-val">${formatDate(h.fecha_aprobacion)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Fecha de Notificación</span>
                <span class="detail-val">${formatDate(h.fecha_notificacion)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Autorizado Por</span>
                <span class="detail-val">${escHtml(h.aprobado_por || 'Angela Ussa')}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Soporte Documental Firmado</span>
                <span class="detail-val">
                  ${h.soporte_acto ? `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="HorariosModule.viewSoporte(${h.id_horario})" style="display:inline-flex; align-items:center; gap:5px; font-size:11px; padding:3px 8px; color:var(--color-green-bright, #22c55e);">
                      📄 Ver Hoja Firmada
                    </button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="App.closeModal(); HorariosModule.openUploadSoporteModal(${h.id_horario})" style="display:inline-flex; align-items:center; gap:5px; font-size:11px; padding:3px 8px; margin-left:4px;">
                      Cambiar
                    </button>
                  ` : `
                    <button type="button" class="btn btn-primary btn-sm" onclick="App.closeModal(); HorariosModule.openUploadSoporteModal(${h.id_horario})" style="display:inline-flex; align-items:center; gap:5px; font-size:11px; padding:3px 8px;">
                      📎 Cargar Hoja Firmada
                    </button>
                  `}
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Tipo de Cómputo</span>
                <span class="detail-val">${escHtml(h.tipo_calculo)}</span>
              </div>
            </div>
          </div>

          <!-- Vigencia & Duración -->
          <div class="detail-section">
            <h4 class="detail-section-title">Vigencia y Duración</h4>
            <div class="detail-grid detail-grid--3col">
              <div class="detail-item">
                <span class="detail-label">Fecha de Inicio</span>
                <span class="detail-val">${formatDate(h.fecha_inicio)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Fecha de Finalización</span>
                <span class="detail-val">${formatDate(h.fecha_fin)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Duración Registrada</span>
                <span class="detail-val font-bold text-accent">${escHtml(h.duracion_texto || `${h.duracion_dias} días`)}</span>
              </div>
            </div>
          </div>

          <!-- Detalles Específicos de Modalidad -->
          ${renderModalidadSpecificDetails(h)}

          <!-- Trazabilidad / Historial de Auditoría -->
          <div class="detail-section">
            <h4 class="detail-section-title">Trazabilidad de Cambios y Reglas Automáticas</h4>
            ${
              hist.length === 0
                ? `<p class="text-muted">Sin registros de cambios en el historial.</p>`
                : `
              <div class="history-timeline">
                ${hist
                  .map(
                    (entry) => `
                  <div class="history-timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <div class="timeline-header">
                        <strong>${escHtml(entry.accion)}</strong>
                        <span class="text-muted">${formatDate(entry.fecha_actualizacion)}</span>
                      </div>
                      <p class="timeline-note">${escHtml(entry.nota || 'Actualización de registro')}</p>
                      <small class="text-muted">Por: ${escHtml(entry.actualizado_por || 'Sistema')}</small>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            `
            }
          </div>
        </div>
      `;

      App.openModal('Detalle de Esquema de Horario', bodyHtml, [
        { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
      ]);
    } catch (err) {
      App.showToast('Error cargando detalle: ' + err.message, 'error');
    }
  }

  function renderModalidadSpecificDetails(h) {
    if (h.modalidad === 'Teletrabajo') {
      return `
        <div class="detail-section">
          <h4 class="detail-section-title">Condiciones de Teletrabajo</h4>
          <div class="detail-grid detail-grid--2col">
            <div class="detail-item">
              <span class="detail-label">Subtipo</span>
              <span class="detail-val">${escHtml(h.subtipo_teletrabajo || 'Suplementario')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Domicilio Laboral (ARL)</span>
              <span class="detail-val">${escHtml(h.domicilio_laboral || 'No registrado')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Días en Casa</span>
              <span class="detail-val">${escHtml(h.dias_teletrabajo || 'N/A')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Días Presenciales</span>
              <span class="detail-val">${escHtml(h.dias_presencial || 'N/A')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Reporte a ARL</span>
              <span class="detail-val">${h.notificacion_arl ? '✓ Notificado formalmente' : 'Pendiente de reporte'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Fecha Reporte ARL</span>
              <span class="detail-val">${formatDate(h.fecha_reporte_arl)}</span>
            </div>
          </div>
        </div>
      `;
    }

    if (h.modalidad === 'Trabajo en casa') {
      return `
        <div class="detail-section">
          <h4 class="detail-section-title">Condiciones de Trabajo en Casa (Ley 2088 de 2021)</h4>
          <div class="detail-grid detail-grid--2col">
            <div class="detail-item detail-item--full">
              <span class="detail-label">Justificación Excepcional</span>
              <span class="detail-val">${escHtml(h.motivo_trabajo_casa || 'Sin justificación registrada')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Lugar de Prestación</span>
              <span class="detail-val">${escHtml(h.direccion_trabajo_casa || 'Domicilio')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Equipos / TIC</span>
              <span class="detail-val">${escHtml(h.herramientas_tic || 'Suministrados')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Condición de Prórroga</span>
              <span class="detail-val">${h.prorroga ? 'Sí (Prórroga extraordinaria)' : 'Periodo inicial'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Efecto en Vacaciones</span>
              <span class="detail-val text-amber font-bold">Pausa automática activa</span>
            </div>
          </div>
        </div>
      `;
    }

    if (h.modalidad === 'Horario flexible') {
      return `
        <div class="detail-section">
          <h4 class="detail-section-title">Bandas Horarias y Flexibilidad Concertada</h4>
          <div class="detail-grid detail-grid--2col">
            <div class="detail-item">
              <span class="detail-label">Franja de Ingreso</span>
              <span class="detail-val font-mono">${escHtml(h.franja_ingreso || '07:00 - 08:30')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Franja de Salida</span>
              <span class="detail-val font-mono">${escHtml(h.franja_salida || '16:30 - 18:00')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Jornada Semanal</span>
              <span class="detail-val">${h.horas_semanales || 40} Horas</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Tiempo de Almuerzo</span>
              <span class="detail-val">${escHtml(h.tiempo_almuerzo || '1 hora')}</span>
            </div>
            <div class="detail-item detail-item--full">
              <span class="detail-label">Justificación</span>
              <span class="detail-val">${escHtml(h.justificacion_flex || 'Concertación laboral')}</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="detail-section">
        <h4 class="detail-section-title">Jornada Presencial Ordinaria</h4>
        <p class="text-muted">Jornada institucional ordinaria en las instalaciones de la Gobernación de Boyacá de 8:00 a.m. a 12:00 m. y de 2:00 p.m. a 6:00 p.m.</p>
      </div>
    `;
  }

  // ─── Modal de Cambio Rápido de Estado (1 Clic) ──────────────────────────────
  const STATUS_CONFIG = [
    {
      id: 'activa',
      name: 'Activa',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
      desc: 'Esquema vigente y activo formalmente con acto administrativo',
      cls: 'status-card-opt--aprobada',
    },
    {
      id: 'caducada',
      name: 'Caducada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      desc: 'Vigencia culminada. Retorna automáticamente a jornada presencial ordinaria',
      cls: 'status-card-opt--finalizada',
    },
    {
      id: 'revision',
      name: 'En revisión',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      desc: 'En verificación técnica de requisitos, ARL o concertación',
      cls: 'status-card-opt--revision',
    },
    {
      id: 'pendiente',
      name: 'Pendiente',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      desc: 'Registrado en espera de acto administrativo formal',
      cls: 'status-card-opt--pendiente',
    },
    {
      id: 'rechazada',
      name: 'Rechazada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      desc: 'Solicitud no viable administrativamente o desistida',
      cls: 'status-card-opt--rechazada',
    },
  ];

  function openStatusPicker(id) {
    if (!Auth.canEdit()) {
      App.showToast('No tienes permisos de edición para cambiar estados.', 'warning');
      return;
    }
    const r = state.data.find((x) => String(x.id_horario) === String(id));
    if (!r) return;

    const cardsHtml = STATUS_CONFIG.map((opt) => {
      const isCurrent = r.estado === opt.name;
      return `
        <button type="button" class="status-card-opt ${opt.cls} ${isCurrent ? 'is-current' : ''}" onclick="HorariosModule.selectQuickStatus(${r.id_horario}, '${opt.name}')" title="Marcar como ${opt.name}">
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
          <div class="status-picker-rad">${escHtml(r.numero_resolucion || 'RES-HORARIO')}</div>
          <div class="status-picker-person">${escHtml(r.apellidos_nombres)}</div>
          <div class="status-picker-tags">
            <span class="status-picker-tag">🏢 ${escHtml(r.modalidad)}</span>
            <span class="status-picker-tag">📅 ${formatDate(r.fecha_inicio)} → ${r.fecha_fin ? formatDate(r.fecha_fin) : 'Indefinida'}</span>
            <span class="status-picker-tag">⏱️ ${escHtml(r.duracion_texto || `${r.duracion_dias} días`)}</span>
            <span class="status-picker-tag">Estado actual: <strong class="badge ${badgeClass(r.estado)}" style="margin-left:4px">${r.estado}</strong></span>
          </div>
        </div>

        <div class="status-picker-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <span>Selecciona el nuevo estado para este esquema laboral:</span>
        </div>

        <div class="status-cards-grid">
          ${cardsHtml}
        </div>

        <div class="form-group" style="margin-top:var(--space-2);">
          <label class="form-label">Observación / Justificación del Cambio (Opcional)</label>
          <input id="quick-status-obs" class="form-input form-input--no-icon" placeholder="Ej: Cambio de estado según acto administrativo..." />
        </div>
      </div>`;

    App.openModal('Gestión Rápida de Estado', bodyHtml, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
    ]);
  }

  async function selectQuickStatus(id, newStatus) {
    const obsInput = document.getElementById('quick-status-obs');
    const nota = obsInput ? obsInput.value.trim() : '';
    try {
      await API.updateHorarioStatus(id, newStatus, nota || `Cambio de estado a ${newStatus}`);
      App.closeModal();
      App.showToast(`Estado cambiado a "${newStatus}" exitosamente.`, 'success');
      await loadData();
      loadStats();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }

  // ─── Funciones Públicas de Gestión y Filtros ───────────────────────────────
  function openCreate() {
    openScheduleModal();
  }

  function openEdit(id) {
    const item = state.data.find((d) => String(d.id_horario) === String(id));
    if (item) {
      openScheduleModal(item);
    } else {
      App.showToast('Esquema no encontrado.', 'error');
    }
  }

  function openView(id) {
    openDetailModal(id);
  }

  function viewSoporte(id) {
    const item = state.data.find((x) => String(x.id_horario) === String(id));
    if (!item || !item.soporte_acto) {
      App.showToast('Este esquema no cuenta con acto administrativo digital adjunto.', 'info');
      return;
    }
    const soporte = item.soporte_acto;
    if (soporte.startsWith('data:image/')) {
      App.openModal(`Acto Administrativo - ${item.numero_resolucion || 'S/N'}`, `
        <div style="text-align:center;padding:var(--space-2);">
          <img src="${soporte}" alt="Acto Administrativo" style="max-width:100%;max-height:70vh;border-radius:var(--radius-md);box-shadow:0 8px 24px rgba(0,0,0,0.3);" />
          <div style="margin-top:var(--space-4);">
            <a href="${soporte}" download="resolucion_${item.numero_resolucion || item.documento}.png" class="btn btn-primary btn-sm">Descargar Imagen</a>
          </div>
        </div>
      `, [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }]);
    } else if (soporte.startsWith('data:application/pdf')) {
      App.openModal(`Acto Administrativo - ${item.numero_resolucion || 'S/N'}`, `
        <div style="width:100%;height:70vh;">
          <iframe src="${soporte}" style="width:100%;height:100%;border:none;border-radius:var(--radius-md);"></iframe>
        </div>
      `, [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }]);
    } else {
      App.openModal(`Acto Administrativo - ${item.numero_resolucion || 'S/N'}`, `
        <div style="padding:var(--space-4);text-align:center;">
          <p style="color:var(--text-secondary);margin-bottom:var(--space-3);">Referencia documental o enlace registrado:</p>
          <div style="font-family:monospace; background:rgba(0,0,0,0.05); padding:10px; border-radius:6px; margin-bottom:15px; word-break:break-all;">${escHtml(soporte)}</div>
          <a href="${soporte}" target="_blank" rel="noopener" class="btn btn-primary">Abrir Documento</a>
        </div>
      `, [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }]);
    }
  }

  async function openUploadSoporteModal(id) {
    let item = state.data.find((x) => String(x.id_horario) === String(id));
    if (!item) {
      try {
        const res = await API.getHorarioById(id);
        item = res.horario;
      } catch (e) {
        App.showToast('Esquema no encontrado.', 'error');
        return;
      }
    }
    if (!item) return;

    let pendingBase64 = null;
    let pendingFileName = '';
    const hasCurrent = Boolean(item.soporte_acto);

    const modalBody = `
      <div style="padding:var(--space-2);">
        <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-4); background:var(--color-bg-secondary, rgba(255,255,255,0.04)); padding:12px 16px; border-radius:var(--radius-md); border:1px solid var(--color-border);">
          <div class="employee-avatar avatar-char" style="width:40px; height:40px; font-size:16px;">${(item.apellidos_nombres || 'F')[0]}</div>
          <div style="flex:1;">
            <div style="font-weight:600; font-size:14px; color:var(--text-primary);">${escHtml(item.apellidos_nombres)}</div>
            <div style="font-size:12px; color:var(--text-muted);">
              C.C. ${escHtml(item.documento)} &bull; ${escHtml(item.cargo)} ${item.numero_consecutivo ? `&bull; #${item.numero_consecutivo}` : ''}
            </div>
          </div>
          ${modalidadBadge(item.modalidad)}
        </div>

        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:var(--space-3); line-height:1.5;">
          Adjunte la hoja oficial o resolución firmada (PDF o imagen escaneada, máx. 15MB) que respalda y autoriza este esquema de alternancia / teletrabajo.
        </p>

        ${hasCurrent ? `
          <div id="current-soporte-box" style="display:flex; align-items:center; justify-content:space-between; background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.25); border-radius:var(--radius-md); padding:10px 14px; margin-bottom:var(--space-4);">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">📄</span>
              <div>
                <span style="font-size:12px; font-weight:600; color:var(--color-green-bright, #22c55e);">Documento de soporte actual registrado</span>
                <div style="font-size:11px; color:var(--text-muted);">Puede visualizarlo o reemplazarlo subiendo uno nuevo a continuación.</div>
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="HorariosModule.viewSoporte(${item.id_horario})" style="font-size:11px; padding:3px 8px;">
                👁️ Ver Actual
              </button>
              <button type="button" id="btn-delete-soporte" class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px; color:#ef4444; border-color:rgba(239,68,68,0.3);">
                🗑️ Eliminar
              </button>
            </div>
          </div>
        ` : ''}

        <div id="dropzone-soporte-modal" class="upload-dropzone" style="border:2px dashed var(--color-border); border-radius:var(--radius-lg); padding:28px 16px; text-align:center; background:rgba(255,255,255,0.02); cursor:pointer; transition:all 0.2s ease;">
          <input type="file" id="input-soporte-modal" accept=".pdf,image/png,image/jpeg,image/webp" style="display:none;" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:36px; height:36px; color:var(--color-primary-light, #60a5fa); margin:0 auto var(--space-2);">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <div style="font-weight:600; font-size:13px; color:var(--text-primary); margin-bottom:4px;">
            Haga clic o arrastre aquí el documento escaneado
          </div>
          <div style="font-size:11px; color:var(--text-muted);">
            Soporta PDF o Imágenes (JPG, PNG, WebP) hasta 15MB
          </div>
        </div>

        <div id="soporte-modal-preview" style="display:none; margin-top:var(--space-3); padding:10px 14px; background:var(--color-bg-secondary, rgba(255,255,255,0.04)); border:1px solid var(--color-border); border-radius:var(--radius-md); align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="soporte-preview-icon" style="font-size:18px;">📄</span>
            <div>
              <div id="soporte-preview-name" style="font-size:12px; font-weight:600; color:var(--text-primary);">archivo.pdf</div>
              <div id="soporte-preview-size" style="font-size:11px; color:var(--text-muted);">0 KB</div>
            </div>
          </div>
          <button type="button" id="btn-remove-new-soporte" class="btn btn-outline btn-sm" style="color:#ef4444; border-color:rgba(239,68,68,0.3); font-size:11px; padding:2px 6px;">✕ Quitar</button>
        </div>
      </div>
    `;

    App.openModal(
      'Cargar Soporte Documental',
      modalBody,
      [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          text: 'Guardar Documento',
          cls: 'btn-primary',
          id: 'btn-save-soporte-modal',
          action: async () => {
            if (!pendingBase64 && !hasCurrent) {
              App.showToast('Seleccione un archivo PDF o imagen para cargar.', 'warning');
              return;
            }
            if (!pendingBase64 && hasCurrent) {
              App.closeModal();
              return;
            }
            try {
              const res = await API.updateHorarioSoporte(id, pendingBase64);
              App.closeModal();
              App.showToast(res.message || 'Soporte documental guardado exitosamente.', 'success');
              await loadData();
              loadStats();
            } catch (err) {
              App.showToast('Error al guardar documento: ' + err.message, 'error');
            }
          }
        }
      ]
    );

    setTimeout(() => {
      const dropzone = document.getElementById('dropzone-soporte-modal');
      const fileInput = document.getElementById('input-soporte-modal');
      const previewEl = document.getElementById('soporte-modal-preview');
      const previewName = document.getElementById('soporte-preview-name');
      const previewSize = document.getElementById('soporte-preview-size');
      const previewIcon = document.getElementById('soporte-preview-icon');
      const btnRemoveNew = document.getElementById('btn-remove-new-soporte');
      const btnDeleteCurrent = document.getElementById('btn-delete-soporte');

      if (!dropzone || !fileInput) return;

      dropzone.onclick = () => fileInput.click();

      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--color-primary, #3b82f6)';
        dropzone.style.background = 'rgba(59, 130, 246, 0.08)';
      };

      dropzone.ondragleave = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--color-border)';
        dropzone.style.background = 'rgba(255,255,255,0.02)';
      };

      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--color-border)';
        dropzone.style.background = 'rgba(255,255,255,0.02)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFile(e.dataTransfer.files[0]);
        }
      };

      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFile(e.target.files[0]);
        }
      };

      function handleFile(file) {
        if (file.size > 15 * 1024 * 1024) {
          App.showToast('El archivo supera el límite de 15MB.', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          pendingBase64 = ev.target.result;
          pendingFileName = file.name;
          if (previewEl) {
            previewEl.style.display = 'flex';
            if (previewName) previewName.textContent = file.name;
            if (previewSize) previewSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
            if (previewIcon) previewIcon.textContent = file.type.includes('pdf') ? '📕' : '🖼️';
          }
        };
        reader.readAsDataURL(file);
      }

      if (btnRemoveNew) {
        btnRemoveNew.onclick = () => {
          pendingBase64 = null;
          pendingFileName = '';
          fileInput.value = '';
          if (previewEl) previewEl.style.display = 'none';
        };
      }

      if (btnDeleteCurrent) {
        btnDeleteCurrent.onclick = async () => {
          if (!confirm('¿Desea eliminar el soporte documental de este esquema?')) return;
          try {
            await API.updateHorarioSoporte(id, null);
            App.closeModal();
            App.showToast('Soporte documental eliminado.', 'success');
            await loadData();
            loadStats();
          } catch (err) {
            App.showToast('Error al eliminar soporte: ' + err.message, 'error');
          }
        };
      }
    }, 50);
  }

  function confirmDelete(id, nombre) {
    if (!Auth.canEdit()) {
      App.showToast('No tienes permisos para eliminar esquemas.', 'warning');
      return;
    }
    App.openModal(
      'Confirmar Eliminación',
      `
      <div style="padding:var(--space-3); text-align:center;">
        <div style="width:52px; height:52px; border-radius:50%; background:rgba(239,68,68,0.12); color:#ef4444; display:flex; align-items:center; justify-content:center; margin:0 auto var(--space-3);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </div>
        <h3 class="delete-modal-title">¿Eliminar este esquema laboral?</h3>
        <p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.5;">
          Se eliminará de forma permanente el registro del servidor público <strong>${escHtml(nombre)}</strong>. Esta acción no se puede deshacer.
        </p>
      </div>
      `,
      [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          text: 'Sí, Eliminar',
          cls: 'btn-danger',
          action: async () => {
            try {
              await API.deleteHorario(id);
              App.closeModal();
              App.showToast('Esquema eliminado exitosamente.', 'success');
              await loadData();
              loadStats();
            } catch (err) {
              App.showToast('Error al eliminar: ' + err.message, 'error');
            }
          }
        }
      ]
    );
  }

  function applyFilters() {
    const q = document.getElementById('horarios-search')?.value.trim() || '';
    const mod = document.getElementById('filter-modalidad')?.value || 'Todas';
    const est = document.getElementById('filter-estado')?.value || 'Todos';

    state.filters.q = q;
    state.filters.modalidad = mod;
    state.filters.estado = est;
    state.page = 1;
    loadData();
  }

  function clearFilters() {
    state.filters = { q: '', modalidad: 'Todas', estado: 'Todos', dependencia: 'Todas' };
    const searchInput = document.getElementById('horarios-search');
    if (searchInput) searchInput.value = '';
    const selMod = document.getElementById('filter-modalidad');
    if (selMod) selMod.value = 'Todas';
    const selEst = document.getElementById('filter-estado');
    if (selEst) selEst.value = 'Todos';
    state.page = 1;
    loadData();
  }

  function goPage(p) {
    if (p < 1 || p > state.totalPages) return;
    state.page = p;
    loadData();
  }

  async function checkExpirations() {
    try {
      const res = await API.checkHorariosExpirations();
      if (res.expiredCount > 0) {
        App.showToast(
          `Se detectaron ${res.expiredCount} esquemas vencidos. Se aplicó el retorno automático a Presencial.`,
          'info'
        );
      } else {
        App.showToast('No hay esquemas vencidos pendientes de caducar.', 'success');
      }
      await loadData();
      loadStats();
    } catch (err) {
      App.showToast('Error en verificación: ' + err.message, 'error');
    }
  }

  const EXCEL_COLUMNS = [
    { header: 'No.', key: 'numero_consecutivo', width: 8, sample: '1' },
    { header: 'Nombres y Apellidos', key: 'apellidos_nombres', width: 35, sample: 'SILVA PARRA NATALIA FERNANDA' },
    { header: 'De Identificación', key: 'documento', width: 18, sample: '1000000007' },
    { header: 'Cargo', key: 'cargo', width: 30, sample: 'PROFESIONAL UNIVERSITARIO' },
    { header: 'Código', key: 'codigo', width: 12, sample: '219' },
    { header: 'Grado', key: 'grado', width: 10, sample: '05' },
    { header: 'Dependencia', key: 'dependencia', width: 32, sample: 'CONTROL INTERNO DE GESTION' },
    { header: 'Secretaría', key: 'secretaria', width: 32, sample: 'DESPACHO GOBERNADOR' },
    { header: 'Situación', key: 'modalidad', width: 20, sample: 'Teletrabajo' },
    { header: 'Dias Teletrabajo', key: 'dias_teletrabajo', width: 28, sample: 'martes y jueves' },
  ];

  function openImportModal() {
    const existing = document.getElementById('excel-hor-modal-overlay');
    if (existing) existing.remove();

    let selectedFile = null;

    const overlay = document.createElement('div');
    overlay.id = 'excel-hor-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box excel-import-modal-box" style="max-width: 680px; width: 95%;">
        <div class="modal-header">
          <div class="modal-header-info">
            <h2 class="modal-title" style="display:flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-green-bright)" stroke-width="2" style="width:24px; height:24px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Carga Masiva de Horarios y Modalidades
            </h2>
            <p class="modal-desc">Cargue un archivo Excel (.xlsx o .xls) para importar o actualizar esquemas de trabajo y alternancia en el sistema.</p>
          </div>
          <button class="modal-close" id="btn-close-hor-import">&times;</button>
        </div>

        <div class="modal-body" style="padding: 20px 24px; max-height: 75vh; overflow-y: auto;">
          <!-- Sección de Selección y Confirmación de Archivo -->
          <div id="hor-upload-section">
            <div class="excel-dropzone" id="hor-excel-dropzone">
              <input type="file" id="hor-excel-file-input" accept=".xlsx, .xls" style="display:none;" />
              <div class="excel-dropzone-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-green-bright)" stroke-width="2" style="width:48px;height:48px;">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </div>
              <p class="excel-dropzone-title" id="hor-dropzone-main-text">
                Haz clic para seleccionar o arrastra aquí tu archivo Excel
              </p>
              <p class="excel-dropzone-sub">
                Formatos soportados: archivos Excel (.xlsx, .xls)
              </p>
            </div>

            <!-- Previsualización del archivo seleccionado con opción de cancelar/cambiar -->
            <div id="hor-file-preview" style="display:none; margin-top: 16px;">
              <div class="excel-file-preview-card">
                <div class="excel-file-preview-left">
                  <div class="excel-file-preview-icon">
                    📊
                  </div>
                  <div class="excel-file-preview-info">
                    <div id="hor-file-name" class="excel-file-preview-name"></div>
                    <div id="hor-file-size" class="excel-file-preview-size"></div>
                  </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-change-hor-file" style="font-size: 12px; padding: 6px 14px; font-weight: 600;">
                  Cambiar archivo
                </button>
              </div>

              <!-- Cuadro Informativo de Confirmación Previa -->
              <div class="excel-notice-card">
                <div class="excel-notice-icon">📋</div>
                <div class="excel-notice-content">
                  <strong>Confirmación de Carga Masiva</strong>
                  <p>Al confirmar la importación, se procesarán los registros de todas las hojas del archivo para crear o actualizar los esquemas laborales en la base de datos institucional.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Mensaje de Aceptación y Resultados (Aparece tras procesar con éxito) -->
          <div id="hor-import-result" style="display:none;"></div>
        </div>

        <div class="modal-footer" id="hor-import-footer" style="padding: 16px 24px; display:flex; justify-content:flex-end; gap:12px; border-top: 1px solid var(--color-border);">
          <button type="button" class="btn btn-secondary" id="btn-cancel-hor-import">Cancelar</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-hor-import" disabled style="display:inline-flex; align-items:center; gap:8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span id="btn-confirm-hor-text">Confirmar Importación</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#btn-close-hor-import');
    const cancelBtn = overlay.querySelector('#btn-cancel-hor-import');
    const dropzone = overlay.querySelector('#hor-excel-dropzone');
    const fileInput = overlay.querySelector('#hor-excel-file-input');
    const filePreview = overlay.querySelector('#hor-file-preview');
    const fileNameEl = overlay.querySelector('#hor-file-name');
    const fileSizeEl = overlay.querySelector('#hor-file-size');
    const changeFileBtn = overlay.querySelector('#btn-change-hor-file');
    const confirmBtn = overlay.querySelector('#btn-confirm-hor-import');
    const confirmText = overlay.querySelector('#btn-confirm-hor-text');
    const uploadSection = overlay.querySelector('#hor-upload-section');
    const resultDiv = overlay.querySelector('#hor-import-result');
    const modalFooter = overlay.querySelector('#hor-import-footer');

    const closeModal = () => overlay.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    const resetSelection = () => {
      selectedFile = null;
      fileInput.value = '';
      dropzone.style.display = 'block';
      filePreview.style.display = 'none';
      confirmBtn.disabled = true;
      confirmText.textContent = 'Confirmar Importación';
    };

    changeFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetSelection();
      fileInput.click();
    });

    const selectFile = (file) => {
      if (!file) return;
      if (file.name.startsWith('~$')) {
        App.showToast('Archivo temporal de bloqueo (~$). Cierra Excel y selecciona el original.', 'error');
        fileInput.value = '';
        return;
      }
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        App.showToast('Por favor selecciona un archivo Excel (.xlsx o .xls).', 'error');
        fileInput.value = '';
        return;
      }
      selectedFile = file;

      fileNameEl.textContent = file.name;
      const sizeKb = (file.size / 1024);
      fileSizeEl.textContent = sizeKb >= 1024
        ? `${(sizeKb / 1024).toFixed(2)} MB`
        : `${sizeKb.toFixed(1)} KB`;

      dropzone.style.display = 'none';
      filePreview.style.display = 'block';
      confirmBtn.disabled = false;
      confirmText.textContent = 'Confirmar Importación';
    };

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length) selectFile(e.target.files[0]);
    });
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
      if (e.dataTransfer.files && e.dataTransfer.files.length) selectFile(e.dataTransfer.files[0]);
    });

    function validateRow(row) {
      const getVal = (...keys) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).normalize('NFC').trim();
          }
        }
        const rowKeys = Object.keys(row);
        for (const k of keys) {
          const cleanK = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
          if (!cleanK) continue;
          const foundKey = rowKeys.find(rk => {
            const cleanRK = rk.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            return cleanRK === cleanK || cleanRK.includes(cleanK) || cleanK.includes(cleanRK);
          });
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
            return String(row[foundKey]).normalize('NFC').trim();
          }
        }
        return '';
      };

      const consecutivoRaw = getVal('No.', 'No', 'N°', 'Consecutivo', 'Item', 'NUMERO', 'numero_consecutivo');
      const documento = getVal('De Identificación', 'Identificación', 'Documento', 'Cédula', 'Cedula', 'C.C.', 'CC', 'No. Identificación', 'documento', 'cedula');
      const nombre = getVal('Nombres y Apellidos', 'Nombre y Apellidos', 'Servidor Público', 'Nombre Completo', 'Nombre', 'Nombres', 'Funcionario', 'apellidos_nombres');
      const cargo = getVal('Cargo', 'Cargo Actual', 'Denominación', 'Denominacion', 'cargo') || 'PROFESIONAL UNIVERSITARIO';
      const codigo = getVal('Código', 'Codigo', 'codigo');
      const grado = getVal('Grado', 'grado');
      const dependencia = getVal('Dependencia', 'Área', 'Area', 'dependencia') || 'DESPACHO GOBERNADOR';
      const secretaria = getVal('Secretaría', 'Secretaria', 'secretaria') || dependencia;
      const situacion = getVal('Situación', 'Situacion', 'Situación Administrativa', 'Situacion Administrativa', 'Modalidad', 'modalidad') || 'Teletrabajo';
      const diasTeletrabajo = getVal('Dias Teletrabajo', 'Días Teletrabajo', 'Dias teletrabajo', 'Días teletrabajo', 'Dias', 'Días', 'Horario', 'Jornada', 'dias_teletrabajo');
      const resolucion = getVal('Resolución', 'Resolucion', 'Res.', 'Res', 'numero_resolucion');
      const fechaRaw = getVal('fecha', 'Fecha', 'Fecha Inicio', 'fecha_inicio');

      if (!documento || !nombre) {
        return { valid: false, error: 'Documento y Nombres y Apellidos son obligatorios.' };
      }

      let modalidadNorm = situacion;
      const sitLower = situacion.toLowerCase();
      if (sitLower.includes('teletrabajo')) {
        modalidadNorm = 'Teletrabajo';
      } else if (sitLower.includes('casa') || sitLower.includes('domicilio')) {
        modalidadNorm = 'Trabajo en casa';
      } else if (sitLower.includes('flexible')) {
        modalidadNorm = 'Horario flexible';
      } else if (sitLower.includes('presencial')) {
        modalidadNorm = 'Presencial';
      }

      let parsedFecha = null;
      if (fechaRaw) {
        const s = String(fechaRaw).toLowerCase().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          parsedFecha = s;
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
          const parts = s.split('/');
          parsedFecha = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else {
          const months = {
            enero: '01', febrero: '02', marzo: '03', abril: '04',
            mayo: '05', junio: '06', julio: '07', agosto: '08',
            septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
          };
          const match = s.match(/(\d{1,2})\s*(?:de)?\s*([a-záéíóúñ]+)\s*(?:de)?\s*(\d{4})/i);
          if (match && months[match[2].toLowerCase()]) {
            parsedFecha = `${match[3]}-${months[match[2].toLowerCase()]}-${match[1].padStart(2, '0')}`;
          }
        }
      }

      const numConsecutivo = consecutivoRaw && !isNaN(parseInt(consecutivoRaw, 10))
        ? parseInt(consecutivoRaw, 10)
        : null;

      return {
        valid: true,
        cleanRow: {
          numero_consecutivo: numConsecutivo,
          documento,
          apellidos_nombres: nombre,
          cargo,
          codigo,
          grado,
          dependencia,
          secretaria,
          modalidad: modalidadNorm,
          dias_teletrabajo: diasTeletrabajo,
          numero_resolucion: resolucion || null,
          fecha_inicio: parsedFecha || new Date().toISOString().split('T')[0],
          duracion_texto: (modalidadNorm === 'Presencial' ? 'Permanente' : '1 año'),
          tipo_calculo: 'Hábiles',
          estado: 'Activa',
        },
      };
    }

    confirmBtn.addEventListener('click', async () => {
      if (!selectedFile) return;

      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      confirmText.innerHTML = `
        <span class="btn-progress-pulse" aria-hidden="true"></span>
        Procesando Carga Masiva...
      `;
      App.showToast('Analizando hojas y procesando registros... Por favor espere.', 'info');

      try {
        if (typeof XLSX === 'undefined') {
          throw new Error('La biblioteca SheetJS aún no se ha cargado en el navegador.');
        }

        const fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(new Uint8Array(e.target.result));
          reader.onerror = reject;
          reader.readAsArrayBuffer(selectedFile);
        });

        const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
        if (!workbook.SheetNames || !workbook.SheetNames.length) {
          throw new Error('El archivo Excel no contiene ninguna hoja de cálculo.');
        }

        const allCleanRows = [];
        const hojasProcesadas = [];
        const observaciones = [];

        // Iterar sobre TODAS las hojas del documento Excel
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;

          const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          if (!rawMatrix || !rawMatrix.length) continue;

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

          const sheetRows = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: '' });
          const filteredRows = (sheetRows || []).filter(row =>
            Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '')
          );

          if (!filteredRows.length) continue;

          hojasProcesadas.push(sheetName);

          filteredRows.forEach((row, idx) => {
            const validation = validateRow(row);
            if (validation.valid) {
              allCleanRows.push(validation.cleanRow);
            } else {
              observaciones.push({
                hoja: sheetName,
                fila: idx + 2,
                error: validation.error,
              });
            }
          });
        }

        if (!allCleanRows.length) {
          throw new Error('No se encontraron filas con datos de servidores ni esquemas de horario en las hojas del archivo.');
        }

        const res = await API.bulkCreateHorarios({
          rows: allCleanRows,
          hojasProcesadas,
        });

        if (typeof Fx !== 'undefined' && Fx.play) Fx.play('success');

        const { resumen = {}, errors = [] } = res;
        const totalHojas = hojasProcesadas.length;

        uploadSection.style.display = 'none';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <!-- Mensaje de Aceptación de Carga Masiva -->
          <div class="excel-success-banner">
            <div class="excel-success-icon-badge">
              ✅
            </div>
            <h3 class="excel-success-title">
              ¡Carga Masiva Aceptada y Procesada con Éxito!
            </h3>
            <p class="excel-success-desc">
              El archivo <strong>${escHtml(selectedFile.name)}</strong> fue validado y cargado en el sistema correctamente.
            </p>
          </div>

          <!-- Información Detallada sobre lo Realizado -->
          <div class="excel-summary-box">
            <div class="excel-summary-topbar">
              <span class="excel-summary-heading">
                <span>📊</span> Resumen de Operaciones Realizadas
              </span>
              <span class="badge badge--info excel-sheets-badge">
                ${totalHojas} Hoja(s) Procesada(s)
              </span>
            </div>

            <div class="excel-kpi-grid">
              <div class="excel-kpi-tile excel-kpi-tile--total">
                <span class="excel-kpi-label">Total Filas</span>
                <span class="excel-kpi-value">${resumen.totalFilas || allCleanRows.length}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--inserted">
                <span class="excel-kpi-label">Nuevos Registros</span>
                <span class="excel-kpi-value">${resumen.insertados || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--updated">
                <span class="excel-kpi-label">Actualizados</span>
                <span class="excel-kpi-value">${resumen.actualizados || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--provisional">
                <span class="excel-kpi-label">Teletrabajo</span>
                <span class="excel-kpi-value">${resumen.teletrabajo || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--vacant">
                <span class="excel-kpi-label">Otras Modalidades</span>
                <span class="excel-kpi-value">${resumen.otrasModalidades || 0}</span>
              </div>
            </div>

            ${(errors.length > 0 || observaciones.length > 0) ? `
              <div class="excel-error-log-card" style="margin-top:14px;">
                <strong class="excel-error-log-title">Observaciones / Inconsistencias (${errors.length + observaciones.length}):</strong>
                <ul class="excel-error-log-list">
                  ${[...observaciones.map(o => `<li>Hoja "${o.hoja}", Fila ${o.fila}: ${escHtml(o.error)}</li>`), ...errors.map(e => `<li>${escHtml(e)}</li>`)].slice(0, 30).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;

        modalFooter.innerHTML = `
          <button type="button" class="btn btn-primary" id="btn-accept-hor-import" style="min-width: 140px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:17px;height:17px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Aceptar
          </button>
        `;

        const acceptBtn = modalFooter.querySelector('#btn-accept-hor-import');
        acceptBtn.addEventListener('click', async () => {
          overlay.remove();
          App.showToast(`Carga masiva finalizada: ${resumen.insertados || 0} creados, ${resumen.actualizados || 0} actualizados.`, 'success');
          await loadData();
          loadStats();
        });

      } catch (err) {
        console.error('[HorariosModule] import error:', err);
        App.showToast('Error al importar: ' + err.message, 'error');
        confirmBtn.disabled = false;
        confirmText.textContent = 'Reintentar Importación';
        cancelBtn.disabled = false;
      }
    });
  }

  function exportExcel() {
    if (typeof ExcelService !== 'undefined') {
      const exportData = state.data.map((item, idx) => ({
        'No.': item.numero_consecutivo != null ? item.numero_consecutivo : (idx + 1),
        'Nombres y Apellidos': item.apellidos_nombres,
        'De Identificación': item.documento,
        'Cargo': item.cargo,
        'Código': item.codigo || '',
        'Grado': item.grado || '',
        'Dependencia': item.dependencia,
        'Secretaría': item.secretaria || '',
        'Situación': item.modalidad,
        'Resolución': item.numero_resolucion || '',
        'Fecha Inicio': item.fecha_inicio || '',
        'Dias Teletrabajo': item.dias_teletrabajo || item.franja_ingreso || '',
        'Estado': item.estado,
        'Soporte Adjunto': item.soporte_acto ? 'Sí' : 'No',
      }));
      ExcelService.exportToExcel(exportData, 'LISTADO_TELETRABAJADORES_MODALIDAD_ALTERNANCIA');
    } else {
      App.showToast('Servicio Excel no disponible.', 'warning');
    }
  }

  return {
    render,
    openCreate,
    openEdit,
    openView,
    openStatusPicker,
    selectQuickStatus,
    confirmDelete,
    applyFilters,
    clearFilters,
    goPage,
    checkExpirations,
    exportExcel,
    openImportModal,
    viewSoporte,
    openUploadSoporteModal,
    toggleActionsDropdown,
    closeActionsDropdown,
    handleDropdownKeydown,
  };
})();
