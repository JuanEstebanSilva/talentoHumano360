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
            <span class="table-count" id="horarios-count">Cargando...</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Servidor Público</th>
                  <th>Dependencia & Cargo</th>
                  <th>Modalidad</th>
                  <th>Vigencia & Duración</th>
                  <th>Acto Administrativo</th>
                  <th>Estado</th>
                  <th style="text-align:right">Acciones</th>
                </tr>
              </thead>
              <tbody id="horarios-tbody">
                <tr><td colspan="7"><div class="empty-state loading-pulse">Cargando esquemas de horarios...</div></td></tr>
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
    return Array(5).fill(0).map(() => `<div class="stat-card skeleton" style="height:80px" aria-busy="true" role="progressbar"></div>`).join('');
  }

  function renderSkeletonTable() {
    const tbody = document.getElementById('horarios-tbody');
    if (!tbody) return;
    const skeletonRows = Array.from({ length: 6 }).map((_, i) => `
      <tr class="skeleton-row" style="animation-delay: ${i * 0.08}s">
        <td>
          <div class="skeleton-user-cell">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-text-group">
              <div class="skeleton-bar" style="width: 140px; height: 14px;"></div>
              <div class="skeleton-bar" style="width: 90px; height: 11px;"></div>
            </div>
          </div>
        </td>
        <td>
          <div class="skeleton-text-group">
            <div class="skeleton-bar" style="width: 130px; height: 13px;"></div>
            <div class="skeleton-bar" style="width: 80px; height: 11px;"></div>
          </div>
        </td>
        <td><div class="skeleton-bar" style="width: 85px; height: 22px; border-radius: 12px;"></div></td>
        <td>
          <div class="skeleton-text-group">
            <div class="skeleton-bar" style="width: 110px; height: 13px;"></div>
            <div class="skeleton-bar" style="width: 60px; height: 11px;"></div>
          </div>
        </td>
        <td><div class="skeleton-bar" style="width: 100px; height: 13px;"></div></td>
        <td><div class="skeleton-bar" style="width: 75px; height: 20px; border-radius: 12px;"></div></td>
        <td>
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            <div class="skeleton-bar" style="width: 28px; height: 28px; border-radius: 6px;"></div>
            <div class="skeleton-bar" style="width: 28px; height: 28px; border-radius: 6px;"></div>
          </div>
        </td>
      </tr>
    `).join('');
    tbody.innerHTML = skeletonRows;
    tbody.setAttribute('aria-busy', 'true');
    tbody.setAttribute('role', 'progressbar');
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
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-state-title">Error al cargar</span><span class="empty-state-desc">${escHtml(err.message)}</span></div></td></tr>`;
    }
  }

  function renderTable() {
    const tbody = document.getElementById('horarios-tbody');
    if (!tbody) return;
    tbody.removeAttribute('role');
    tbody.setAttribute('aria-busy', 'false');

    if (state.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span class="empty-state-title">No hay esquemas registrados</span>
        <span class="empty-state-desc">No se encontraron esquemas de horarios con los filtros aplicados.</span>
        </div></td></tr>`;
      return;
    }

    const canManage = Auth.canEdit();

    tbody.innerHTML = state.data.map(item => {
      const tipoCalculoTag = item.tipo_calculo === 'Hábiles'
        ? `<span class="tag-calc-pill tag-habiles">Hábiles</span>`
        : `<span class="tag-calc-pill tag-calendario">Calendario</span>`;
      const vigenciaFin = item.fecha_fin ? formatDate(item.fecha_fin) : 'Indefinida';
      const fechaAprob = item.fecha_aprobacion ? `Aprob: ${formatDate(item.fecha_aprobacion)}` : 'Automático';

      return `
        <tr>
          <td>
            <div class="user-table-cell">
              <span class="td-primary" title="${escHtml(item.apellidos_nombres)}">${escHtml(truncate(item.apellidos_nombres, 28))}</span>
              <span class="user-table-cc font-mono">C.C. ${escHtml(item.documento)}</span>
            </div>
          </td>

          <td>
            <div class="user-table-cell">
              <span class="user-table-title" title="${escHtml(item.dependencia)}">${escHtml(truncate(item.dependencia, 28))}</span>
              <span class="user-table-sub" title="${escHtml(item.cargo)}">${escHtml(truncate(item.cargo, 26))}</span>
            </div>
          </td>

          <td>
            <div style="display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">
              ${modalidadBadge(item.modalidad)}
              ${item.subtipo_teletrabajo ? `<span class="user-table-sub" style="font-weight:500;">${escHtml(item.subtipo_teletrabajo.replace(/\s*\(.*?\)/, ''))}</span>` : ''}
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
            </div>
          </td>

          <td>
            <div class="user-table-cell">
              <span class="resolucion-val font-mono">${escHtml(item.numero_resolucion || 'S/N')}</span>
              <span class="user-table-sub" title="Aprobado por: ${escHtml(item.aprobado_por || 'Angela Ussa')}">${fechaAprob}</span>
            </div>
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
              ${item.soporte_acto ? `
              <button class="btn-action-soporte" onclick="HorariosModule.viewSoporte(${item.id_horario})" title="Ver Acto Administrativo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>` : ''}
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

        <div class="form-group span-2 autocomplete-wrapper">
          <label for="horario-search-emp" class="form-label required">Buscar Servidor (Nombre o Cédula)</label>
          <input type="text" id="horario-search-emp" class="form-input" placeholder="Escriba el nombre o cédula del funcionario..." autocomplete="off" value="${escHtml(
            item ? `${item.apellidos_nombres} - ${item.documento}` : ''
          )}" ${isEdit ? 'readonly' : ''} />
          <div id="horario-emp-results" class="autocomplete-dropdown" style="display:none;"></div>
        </div>

        <div class="form-group">
          <label for="horario-documento" class="form-label required">Documento de Identidad (C.C.)</label>
          <input type="text" id="horario-documento" class="form-input" readonly placeholder="Número de documento" value="${escHtml(
            item?.documento || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-nombre" class="form-label required">Nombres y Apellidos</label>
          <input type="text" id="horario-nombre" class="form-input" readonly placeholder="Nombres completos" value="${escHtml(
            item?.apellidos_nombres || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-dependencia" class="form-label required">Dependencia / Secretaría</label>
          <input type="text" id="horario-dependencia" class="form-input" placeholder="Dependencia..." value="${escHtml(
            item?.dependencia || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-cargo" class="form-label required">Cargo</label>
          <input type="text" id="horario-cargo" class="form-input" placeholder="Cargo institucional..." value="${escHtml(item?.cargo || '')}" />
        </div>

        <div class="form-group span-2">
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
              <label for="dias-teletrabajo" class="form-label">Días Remotos (Casa)</label>
              <input type="text" id="dias-teletrabajo" class="form-input" placeholder="Ej: Martes y Jueves" value="${escHtml(item?.dias_teletrabajo || 'Martes, Jueves')}" />
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
            <input type="text" id="justificacion-flex" class="form-input" placeholder="Ej: Cuidado de menores, estudios superiores..." value="${escHtml(item?.justificacion_flex || '')}" />
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

        <div class="form-group span-2">
          <label for="horario-soporte" class="form-label">Soporte o Enlace del Acto Administrativo</label>
          <input type="text" id="horario-soporte" class="form-input" placeholder="Ej: EXP-2026-TALENTO-089 o enlace documental" value="${escHtml(
            item?.soporte_acto || ''
          )}" />
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
    const soporte_acto = document.getElementById('horario-soporte')?.value?.trim();
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
      soporte_acto,
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
  async function openDetailModal(id) {
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
              <h3>${escHtml(h.apellidos_nombres)}</h3>
              <p><strong>C.C.:</strong> ${escHtml(h.documento)} &nbsp;|&nbsp; <strong>Dependencia:</strong> ${escHtml(
        h.dependencia
      )}</p>
              <p><strong>Cargo:</strong> ${escHtml(h.cargo)}</p>
            </div>
            <div class="detail-header-badges">
              ${modalidadBadge(h.modalidad)}
              ${estadoBadge(h.estado)}
            </div>
          </div>

          <!-- Metadata Administrativa -->
          <div class="detail-section">
            <h4 class="detail-section-title">Acto Administrativo y Notificación</h4>
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
                <span class="detail-label">Soporte Digital</span>
                <span class="detail-val">${escHtml(h.soporte_acto || 'En expediente')}</span>
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
    { header: 'Cédula', key: 'documento', width: 15, sample: '1000000007' },
    { header: 'Servidor Público', key: 'apellidos_nombres', width: 32, sample: 'SILVA PARRA NATALIA FERNANDA' },
    { header: 'Dependencia', key: 'dependencia', width: 30, sample: 'DIRECCIÓN DE TALENTO HUMANO' },
    { header: 'Cargo', key: 'cargo', width: 28, sample: 'PROFESIONAL UNIVERSITARIO' },
    { header: 'Modalidad', key: 'modalidad', width: 18, sample: 'Teletrabajo' },
    { header: 'Fecha Inicio', key: 'fecha_inicio', width: 16, sample: '01/10/2026' },
    { header: 'Duración', key: 'duracion_texto', width: 20, sample: '1 año' },
    { header: 'Tipo Cómputo', key: 'tipo_calculo', width: 16, sample: 'Hábiles' },
    { header: 'Número Resolución', key: 'numero_resolucion', width: 20, sample: 'RES-2026-0512' },
    { header: 'Estado', key: 'estado', width: 15, sample: 'Activa' },
  ];

  function openImportModal() {
    if (typeof ExcelService === 'undefined') {
      App.showToast('Módulo de importación Excel no disponible.', 'error');
      return;
    }

    ExcelService.openImportModal({
      title: 'Carga Masiva de Esquemas de Horarios y Modalidades',
      subtitle: 'Importe esquemas laborales (Presencial, Teletrabajo, Trabajo en casa, Horario flexible) mediante un archivo Excel (.xlsx / .xls)',
      moduleName: 'horarios',
      columns: EXCEL_COLUMNS,
      sampleRows: [
        {
          'Cédula': '1000000007',
          'Servidor Público': 'SILVA PARRA NATALIA FERNANDA',
          'Dependencia': 'DIRECCIÓN DE TALENTO HUMANO',
          'Cargo': 'PROFESIONAL UNIVERSITARIO',
          'Modalidad': 'Teletrabajo',
          'Fecha Inicio': '01/10/2026',
          'Duración': '1 año',
          'Tipo Cómputo': 'Hábiles',
          'Número Resolución': 'RES-2026-0512',
          'Estado': 'Activa',
        },
        {
          'Cédula': '1000000005',
          'Servidor Público': 'GÓMEZ RUIZ PAULA ANDREA',
          'Dependencia': 'SECRETARÍA DE SALUD',
          'Cargo': 'PROFESIONAL UNIVERSITARIO',
          'Modalidad': 'Presencial',
          'Fecha Inicio': '01/09/2026',
          'Duración': 'Permanente',
          'Tipo Cómputo': 'Hábiles',
          'Número Resolución': 'RES-2026-0140',
          'Estado': 'Activa',
        },
        {
          'Cédula': '1000000008',
          'Servidor Público': 'VARGAS PEÑA ANDRÉS FELIPE',
          'Dependencia': 'SECRETARÍA DE INFRAESTRUCTURA PÚBLICA',
          'Cargo': 'PROFESIONAL ESPECIALIZADO',
          'Modalidad': 'Horario flexible',
          'Fecha Inicio': '15/09/2026',
          'Duración': '6 meses',
          'Tipo Cómputo': 'Hábiles',
          'Número Resolución': 'RES-2026-0320',
          'Estado': 'Activa',
        },
      ],
      validateRow: (row) => {
        const documento = (row['Cédula'] || row['Documento'] || row.documento || row.cedula || '').toString().trim();
        const nombre = (row['Servidor Público'] || row['Nombres y Apellidos'] || row['Nombre Completo'] || row.apellidos_nombres || row.persona || '').toString().trim();
        const modalidad = (row['Modalidad'] || row.modalidad || 'Presencial').toString().trim();
        const fechaInicio = (row['Fecha Inicio'] || row['Fecha inicio'] || row.fecha_inicio || row.inicio || '').toString().trim();

        if (!documento || !nombre) {
          return { valid: false, error: 'Cédula y Nombre de Servidor Público son obligatorios.' };
        }

        return {
          valid: true,
          cleanRow: {
            documento,
            apellidos_nombres: nombre,
            dependencia: (row['Dependencia'] || row.dependencia || 'SECRETARÍA GENERAL').toString().trim(),
            cargo: (row['Cargo'] || row['Cargo Actual'] || row.cargo || 'PROFESIONAL UNIVERSITARIO').toString().trim(),
            modalidad,
            fecha_inicio: fechaInicio || new Date().toISOString().split('T')[0],
            duracion_texto: (row['Duración'] || row['Duracion'] || row.duracion_texto || (modalidad === 'Presencial' ? 'Permanente' : '1 año')).toString().trim(),
            tipo_calculo: (row['Tipo Cómputo'] || row['Tipo Computo'] || row['Tipo Calculo'] || row.tipo_calculo || 'Hábiles').toString().trim(),
            numero_resolucion: (row['Número Resolución'] || row['Numero Resolucion'] || row['Resolución'] || row.numero_resolucion || '').toString().trim(),
            estado: (row['Estado'] || row.estado || 'Activa').toString().trim(),
          },
        };
      },
      onImport: async (cleanRows) => {
        const res = await API.bulkCreateHorarios(cleanRows);
        App.showToast(res.message || `${res.inserted} esquemas importados exitosamente.`, 'success');
        await loadData();
        loadStats();
      },
    });
  }

  function exportExcel() {
    if (typeof ExcelService !== 'undefined') {
      const exportData = state.data.map((item) => ({
        'C.C.': item.documento,
        'Servidor Público': item.apellidos_nombres,
        'Dependencia': item.dependencia,
        'Cargo': item.cargo,
        'Modalidad': item.modalidad,
        'Estado': item.estado,
        'Fecha Inicio': item.fecha_inicio,
        'Fecha Fin': item.fecha_fin || 'Indefinida',
        'Duración': item.duracion_texto || `${item.duracion_dias} días`,
        'Tipo Cálculo': item.tipo_calculo,
        'Resolución': item.numero_resolucion || 'S/N',
        'Fecha Aprobación': item.fecha_aprobacion || 'Automático',
        'Autorizado Por': item.aprobado_por || 'Angela Ussa',
      }));
      ExcelService.exportToExcel(exportData, 'Esquemas_Horarios_Talento360');
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
    toggleActionsDropdown,
    closeActionsDropdown,
    handleDropdownKeydown,
  };
})();
