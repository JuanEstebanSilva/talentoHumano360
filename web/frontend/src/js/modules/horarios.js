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
    sort: 'consecutivo',
    order: 'asc',
    stats: {},
  };

  let employeeSearchTimeout = null;
  let currentMinConsecutivo = 1;

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

  // ─── Formateo de Fechas y Cédula ───────────────────────────────────────────
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

  function formatCedulaDots(val) {
    if (!val) return '';
    const clean = String(val).replace(/\D/g, '');
    if (!clean) return String(val);
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function switchFichaTab(tabId) {
    const container = document.querySelector('.ficha-wrapper');
    if (!container) return;
    container.querySelectorAll('.ficha-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    container.querySelectorAll('.ficha-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
    const modalBody = document.getElementById('modal-body');
    if (modalBody && modalBody.scrollTop > 100) {
      modalBody.scrollTo({ top: 90, behavior: 'smooth' });
    }
  }

  function copyFichaText(text, btnId) {
    const btn = document.getElementById(btnId);
    if (!navigator.clipboard) {
      App.showToast('Copiado: ' + text, 'info');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '✓ ¡Copiado!';
        btn.style.background = 'rgba(34, 197, 94, 0.45)';
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.style.background = '';
        }, 1800);
      }
      App.showToast(`Copiado al portapapeles: ${text}`, 'success');
    }).catch(() => {
      App.showToast('Copiado: ' + text, 'info');
    });
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
                    <strong>Descargar Datos en Excel</strong>
                    <small>Exporta los registros (con filtros aplicados o todos los esquemas)</small>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="HorariosModule.closeActionsDropdown(); HorariosModule.downloadTemplate();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                  <div>
                    <strong>Descargar Plantilla Oficial (En blanco)</strong>
                    <small>Plantilla institucional vacía para diligenciar y cargar</small>
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
              <select id="filter-modalidad" class="filter-select" onchange="HorariosModule.applyFilters()">
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
              <select id="filter-estado" class="filter-select" onchange="HorariosModule.applyFilters()">
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
                  <th scope="col" class="th-sortable" onclick="HorariosModule.toggleSortConsecutivo()" title="Clic para ordenar por consecutivo (#) ascendente / descendente" style="width: 75px; text-align: center; cursor: pointer; user-select: none;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; gap:4px; font-weight:700;">
                      # <span id="horarios-sort-indicator" style="font-size:11px; color:var(--color-primary-light, #60a5fa); font-weight:bold;">▲</span>
                    </span>
                  </th>
                  <th scope="col">Servidor Público</th>
                  <th scope="col">Cargo & Clasificación</th>
                  <th scope="col">Dependencia & Secretaría</th>
                  <th scope="col">Situación & Horario</th>
                  <th scope="col">Vigencia & Duración</th>
                  <th scope="col">Estado</th>
                  <th scope="col" style="text-align: center; min-width: 145px; width: 155px;">Acciones</th>
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
        sort: state.sort || 'consecutivo',
        order: state.order || 'asc',
      };

      const res = await API.getHorarios(params);
      state.data = res.data || [];
      state.total = res.total || 0;
      state.totalPages = res.totalPages || 1;

      renderTable();
      renderPagination();
      updateSortIndicator();
      const countEl = document.getElementById('horarios-count');
      if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} esquemas`;
    } catch (err) {
      tbody.removeAttribute('role');
      tbody.setAttribute('aria-busy', 'false');
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="empty-state-title">Error al cargar</span><span class="empty-state-desc">${escHtml(err.message)}</span></div></td></tr>`;
    }
  }

  function abbreviateDays(str) {
    if (!str) return '';
    return str
      .replace(/\blunes\b/gi, 'Lun')
      .replace(/\bmartes\b/gi, 'Mar')
      .replace(/\bmi[eé]rcoles\b/gi, 'Mie')
      .replace(/\bjueves\b/gi, 'Jue')
      .replace(/\bviernes\b/gi, 'Vie')
      .replace(/\bs[aá]bados?\b/gi, 'Sab')
      .replace(/\bdomingos?\b/gi, 'Dom');
  }

  function renderHorarioDetalle(horarioDias) {
    if (!horarioDias) return '';
    const cleanRaw = String(horarioDias).trim();
    const clean = abbreviateDays(cleanRaw);
    // Separar si contiene varias franjas horarias (ej: "8 AM A 12 M, 1 A 5 PM." o separadas por coma antes de una hora/dígito)
    const franjas = clean.split(/,\s*(?=\d)/).map(s => s.trim()).filter(Boolean);

    if (franjas.length <= 1) {
      return `<span class="user-table-sub font-bold" style="color:var(--color-primary-light, #60a5fa); margin-top:3px; display:inline-flex; align-items:center; gap:4px; font-size:11px;" title="${escHtml(cleanRaw)}">⏰ ${escHtml(clean)}</span>`;
    }

    return `
      <div class="user-table-sub font-bold" style="color:var(--color-primary-light, #60a5fa); margin-top:3px; display:flex; flex-direction:column; gap:2px; font-size:11px; line-height:1.25;" title="${escHtml(cleanRaw)}">
        <span style="display:inline-flex; align-items:center; gap:4px;">⏰ ${escHtml(franjas[0])}</span>
        ${franjas.slice(1).map(f => `<span style="display:inline-flex; align-items:center; padding-left:18px;">${escHtml(f)}</span>`).join('')}
      </div>
    `;
  }

  function renderTable() {
    const tbody = document.getElementById('horarios-tbody');
    if (!tbody) return;
    tbody.removeAttribute('role');
    tbody.setAttribute('aria-busy', 'false');

    if (state.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
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
              ${renderHorarioDetalle(horarioDias)}
            </div>
          </td>

          <td>
            <div class="vigencia-cell">
              ${(item.fecha_inicio || item.fecha_fin) ? `
                <div class="vigencia-fechas" style="font-size:11px; color:var(--text-secondary); margin-bottom:2px;">
                  ${item.fecha_inicio ? `<span>${formatDate(item.fecha_inicio)}</span>` : ''}
                  ${(item.fecha_inicio && item.fecha_fin) ? `<span class="fecha-arrow">→</span>` : ''}
                  ${item.fecha_fin ? `<span>${formatDate(item.fecha_fin)}</span>` : ''}
                </div>
              ` : ''}
              <div class="duracion-row">
                <span class="duracion-badge" style="font-size:11px; font-weight:700;">${escHtml(item.duracion_texto || (item.modalidad === 'Trabajo en casa' ? 'No aplica' : item.modalidad === 'Horario flexible' ? '8 horas / día' : item.modalidad === 'Teletrabajo' ? '2 días / semana' : 'Jornada ordinaria'))}</span>
              </div>
              ${item.numero_resolucion ? `
                <div style="margin-top:3px; font-size:11px; color:var(--text-muted); font-family:var(--font-mono, monospace);" title="Resolución: ${escHtml(item.numero_resolucion)}">
                  Res: <strong style="color:var(--text-secondary);">${escHtml(item.numero_resolucion)}</strong>
                </div>
              ` : ''}
            </div>
          </td>

          <td>
            <button type="button" class="badge badge--interactive ${badgeClass(item.estado)}" onclick="HorariosModule.openStatusPicker(${item.id_horario})" title="Clic para cambiar estado de este horario" aria-label="Cambiar estado: ${item.estado}">
              <span>${item.estado}</span>
              <svg class="badge-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </td>

          <td class="td-actions" style="text-align: center;">
            <div class="td-actions-wrap" style="justify-content: center;">
              <button class="btn-action-view" onclick="HorariosModule.openView(${item.id_horario})" title="Ver Detalles y Trazabilidad">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn-action-soporte ${tieneSoporte ? 'btn-action-soporte--has-file' : ''}" onclick="HorariosModule.openUploadSoporteModal(${item.id_horario})" title="${tieneSoporte ? 'Ver / Reemplazar Hoja de Soporte' : 'Adjuntar Hoja de Soporte Firmada'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
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

    const curModalidad = item?.modalidad || 'Teletrabajo';
    const curTipoCalc  = item?.tipo_calculo || 'Hábiles';

    // Parsear días iniciales si es Teletrabajo
    const initialDaysLower = (item?.dias_teletrabajo || 'martes y jueves').toLowerCase();
    const hasLun = initialDaysLower.includes('lun');
    const hasMar = initialDaysLower.includes('mar');
    const hasMie = initialDaysLower.includes('mie') || initialDaysLower.includes('mié');
    const hasJue = initialDaysLower.includes('jue');
    const hasVie = initialDaysLower.includes('vie');

    // Determinar duración inicial sugerida según modalidad
    let defaultDuracion = item?.duracion_texto || '';
    if (!defaultDuracion) {
      if (curModalidad === 'Teletrabajo') {
        const count = [hasLun, hasMar, hasMie, hasJue, hasVie].filter(Boolean).length || 2;
        defaultDuracion = `${count} días / semana`;
      } else if (curModalidad === 'Horario flexible') {
        defaultDuracion = '8 horas / día';
      } else if (curModalidad === 'Trabajo en casa') {
        defaultDuracion = 'No aplica';
      } else {
        defaultDuracion = 'Jornada ordinaria';
      }
    }

    const bodyHtml = `
      <form id="form-horario" class="form-grid" onsubmit="return false;">
        <!-- Sección 1: Servidor Público -->
        <div class="form-group span-2">
          <div class="form-section-header">
            <div class="form-section-icon form-section-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:8px; flex-wrap:wrap;">
              <div>
                <span class="form-section-title">Servidor Público</span>
                <span class="form-section-desc">Identificación y cargo del funcionario institucional</span>
              </div>
              <div id="servidor-locked-indicator" class="badge-servidor-vinculado" style="display:none;" title="Información protegida procedente de la base de datos de servidores públicos">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Datos Institucionales Vinculados (Protegidos)
              </div>
            </div>
          </div>
        </div>

        ${!isEdit ? `
        <div class="form-group span-2 autocomplete-wrapper">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <label for="horario-search-emp" class="form-label" style="font-weight:700; text-transform:uppercase; letter-spacing:0.3px; margin:0;">BUSCAR SERVIDOR EN NÓMINA (NOMBRE O CÉDULA)</label>
            <button type="button" id="btn-unlock-servidor" class="btn btn-secondary btn-sm" style="display:none; font-size:11px; padding:2px 8px; height:auto; cursor:pointer;" title="Desvincular servidor institucional y habilitar ingreso manual">
              ✕ Desvincular / Ingreso manual
            </button>
          </div>
          <input type="text" id="horario-search-emp" class="form-input" placeholder="Escriba el nombre o cédula para buscar en la base de datos de servidores públicos..." autocomplete="off" />
          <div id="horario-emp-results" class="autocomplete-dropdown" style="display:none;"></div>
          <small class="field-hint" style="font-size:11px; color:var(--text-muted); display:block; margin-top:3px;">
            Al seleccionar o buscar un servidor público, se cargan automáticamente todos sus datos institucionales abajo y se protegen contra edición.
          </small>
        </div>` : ''}

        <div class="form-group">
          <label for="horario-nombre" class="form-label required" style="font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">NOMBRES Y APELLIDOS</label>
          <input type="text" id="horario-nombre" class="form-input font-bold" placeholder="Nombres y apellidos completos" value="${escHtml(
            item?.apellidos_nombres || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-documento" class="form-label required" style="font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">DOCUMENTO DE IDENTIDAD (C.C.)</label>
          <input type="text" id="horario-documento" class="form-input font-mono font-bold" placeholder="Número de cédula" value="${escHtml(
            item?.documento || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-cargo" class="form-label required" style="font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">CARGO</label>
          <input type="text" id="horario-cargo" class="form-input" placeholder="Cargo institucional..." value="${escHtml(item?.cargo || '')}" />
        </div>

        <!-- Código y Grado Institucional (Cargados automáticamente de la BD del servidor) -->
        <div class="form-group" style="display:flex; gap:12px;">
          <div style="flex:1;">
            <label for="horario-codigo" class="form-label" style="font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">CÓDIGO</label>
            <input type="text" id="horario-codigo" class="form-input font-mono" placeholder="Ej: 219" value="${escHtml(item?.codigo || '')}" />
            <small class="field-hint" style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">Código del cargo</small>
          </div>
          <div style="flex:1;">
            <label for="horario-grado" class="form-label" style="font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">GRADO</label>
            <input type="text" id="horario-grado" class="form-input font-mono" placeholder="Ej: 05" value="${escHtml(item?.grado || '')}" />
            <small class="field-hint" style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">Grado salarial</small>
          </div>
        </div>

        <div class="form-group">
          <label for="horario-dependencia" class="form-label required" style="font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">DEPENDENCIA</label>
          <input type="text" id="horario-dependencia" class="form-input" placeholder="Ej: CONTROL INTERNO DE GESTION..." value="${escHtml(
            item?.dependencia || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-secretaria" class="form-label" style="font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">SECRETARÍA</label>
          <input type="text" id="horario-secretaria" class="form-input" placeholder="Ej: SECRETARÍA GENERAL..." value="${escHtml(
            item?.secretaria || ''
          )}" />
        </div>

        <div class="form-group span-2">
          <label for="horario-estado" class="form-label required" style="font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">ESTADO DEL ESQUEMA</label>
          <select id="horario-estado" class="filter-select">
            <option value="Activa" ${item?.estado === 'Activa' ? 'selected' : ''}>Activa (En vigencia)</option>
            <option value="Pendiente" ${item?.estado === 'Pendiente' ? 'selected' : ''}>Pendiente de inicio</option>
            <option value="En revisión" ${item?.estado === 'En revisión' ? 'selected' : ''}>En revisión técnica</option>
            <option value="Caducada" ${item?.estado === 'Caducada' ? 'selected' : ''}>Caducada (Finalizada)</option>
          </select>
        </div>

        <!-- Sección 2: Situación Administrativa / Modalidad -->
        <div class="form-group span-2" style="margin-top:var(--space-2);">
          <div class="form-section-header">
            <div class="form-section-icon form-section-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div>
              <span class="form-section-title">Situación Administrativa / Modalidad</span>
              <span class="form-section-desc">Seleccione el esquema laboral acordado con el servidor</span>
            </div>
          </div>
        </div>

        <div class="form-group span-2">
          <div class="modalidad-cards-selector">
            <label class="modalidad-card-option ${curModalidad === 'Teletrabajo' ? 'selected' : ''}">
              <input type="radio" name="modalidad_radio" value="Teletrabajo" ${curModalidad === 'Teletrabajo' ? 'checked' : ''} />
              <div class="mcard-icon">💻</div>
              <div class="mcard-info">
                <strong>Teletrabajo</strong>
                <span>Alternancia de días en casa y oficina</span>
              </div>
            </label>

            <label class="modalidad-card-option ${curModalidad === 'Horario flexible' ? 'selected' : ''}">
              <input type="radio" name="modalidad_radio" value="Horario flexible" ${curModalidad === 'Horario flexible' ? 'checked' : ''} />
              <div class="mcard-icon">⏰</div>
              <div class="mcard-info">
                <strong>Horario Flexible</strong>
                <span>Franjas horarias concertadas</span>
              </div>
            </label>

            <label class="modalidad-card-option ${curModalidad === 'Trabajo en casa' ? 'selected' : ''}">
              <input type="radio" name="modalidad_radio" value="Trabajo en casa" ${curModalidad === 'Trabajo en casa' ? 'checked' : ''} />
              <div class="mcard-icon">🏠</div>
              <div class="mcard-info">
                <strong>Trabajo en Casa</strong>
                <span>Modalidad transitoria y excepcional</span>
              </div>
            </label>

            <label class="modalidad-card-option ${curModalidad === 'Presencial' ? 'selected' : ''}">
              <input type="radio" name="modalidad_radio" value="Presencial" ${curModalidad === 'Presencial' ? 'checked' : ''} />
              <div class="mcard-icon">🏢</div>
              <div class="mcard-info">
                <strong>Presencial</strong>
                <span>Jornada ordinaria en sede física</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Sección 3: Configuración de Días, Horario y Duración Adaptable -->
        <div class="form-group span-2" style="margin-top:var(--space-2);">
          <div class="form-section-header">
            <div class="form-section-icon form-section-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <span class="form-section-title">Esquema de Días, Horario y Duración</span>
              <span class="form-section-desc">Detalle específico según la modalidad seleccionada</span>
            </div>
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
            <span>Días de Teletrabajo / Alternancia Semanal</span>
          </div>

          <div style="margin-bottom:12px;">
            <label class="form-label" style="margin-bottom:6px;">Selección de Días en Casa / Remotos (Clic para alternar):</label>
            <div class="day-chips-group" id="teletrabajo-day-chips" style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="chip-day ${hasLun ? 'active' : ''}" data-day="Lunes" data-abbr="Lun" style="padding:6px 14px; border-radius:20px; font-weight:700; font-size:12px; cursor:pointer; border:1.5px solid var(--color-border); background:var(--color-bg-secondary); color:var(--text-secondary);">Lun</button>
              <button type="button" class="chip-day ${hasMar ? 'active' : ''}" data-day="Martes" data-abbr="Mar" style="padding:6px 14px; border-radius:20px; font-weight:700; font-size:12px; cursor:pointer; border:1.5px solid var(--color-border); background:var(--color-bg-secondary); color:var(--text-secondary);">Mar</button>
              <button type="button" class="chip-day ${hasMie ? 'active' : ''}" data-day="Miércoles" data-abbr="Mie" style="padding:6px 14px; border-radius:20px; font-weight:700; font-size:12px; cursor:pointer; border:1.5px solid var(--color-border); background:var(--color-bg-secondary); color:var(--text-secondary);">Mié</button>
              <button type="button" class="chip-day ${hasJue ? 'active' : ''}" data-day="Jueves" data-abbr="Jue" style="padding:6px 14px; border-radius:20px; font-weight:700; font-size:12px; cursor:pointer; border:1.5px solid var(--color-border); background:var(--color-bg-secondary); color:var(--text-secondary);">Jue</button>
              <button type="button" class="chip-day ${hasVie ? 'active' : ''}" data-day="Viernes" data-abbr="Vie" style="padding:6px 14px; border-radius:20px; font-weight:700; font-size:12px; cursor:pointer; border:1.5px solid var(--color-border); background:var(--color-bg-secondary); color:var(--text-secondary);">Vie</button>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3);">
            <div class="form-group">
              <label for="dias-teletrabajo" class="form-label">Días de Teletrabajo (Texto)</label>
              <input type="text" id="dias-teletrabajo" class="form-input font-bold" placeholder="Ej: martes y jueves" value="${escHtml(item?.dias_teletrabajo || 'martes y jueves')}" />
              <small class="field-hint" style="font-size:11px; color:var(--text-muted);">Se actualiza automáticamente al hacer clic en los días</small>
            </div>
            <div class="form-group">
              <label for="subtipo-teletrabajo" class="form-label">Subtipo</label>
              <select id="subtipo-teletrabajo" class="filter-select">
                <option value="Suplementario (Híbrido)" ${item?.subtipo_teletrabajo === 'Suplementario (Híbrido)' ? 'selected' : ''}>Suplementario (Híbrido)</option>
                <option value="Autónomo" ${item?.subtipo_teletrabajo === 'Autónomo' ? 'selected' : ''}>Autónomo (100% Remoto)</option>
                <option value="Móvil" ${item?.subtipo_teletrabajo === 'Móvil' ? 'selected' : ''}>Móvil (Itinerante)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Subsección Dinámica: Horario Flexible -->
        <div id="dynamic-section-horario-flexible" class="form-group span-2 dynamic-subform" style="display:${curModalidad === 'Horario flexible' ? 'block' : 'none'};">
          <div class="subform-banner subform-banner--cyan">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>Franjas Horarias de Jornada Concertada</span>
          </div>

          <div style="margin-bottom:12px;">
            <label class="form-label" style="margin-bottom:6px;">Franjas comunes institucionales (Clic para aplicar):</label>
            <div class="franja-quick-buttons" style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="btn btn-outline btn-sm chip-franja" data-franja="8:00 AM a 12:00 M y 1:00 PM a 5:00 PM" style="font-size:11px; padding:4px 10px;">8:00 AM - 12:00 M / 1:00 PM - 5:00 PM (8h)</button>
              <button type="button" class="btn btn-outline btn-sm chip-franja" data-franja="7:00 AM a 12:00 M y 1:30 PM a 4:30 PM" style="font-size:11px; padding:4px 10px;">7:00 AM - 12:00 M / 1:30 PM - 4:30 PM (8h)</button>
              <button type="button" class="btn btn-outline btn-sm chip-franja" data-franja="7:30 AM a 12:30 PM y 1:30 PM a 4:30 PM" style="font-size:11px; padding:4px 10px;">7:30 AM - 12:30 PM / 1:30 PM - 4:30 PM (8h)</button>
            </div>
          </div>

          <div class="form-group">
            <label for="franja-ingreso" class="form-label required">Franja Horaria Concertada</label>
            <input type="text" id="franja-ingreso" class="form-input font-bold" placeholder="Ej: 8 AM A 12 M, 1 A 5 PM" value="${escHtml(item?.franja_ingreso || item?.dias_teletrabajo || '8 AM A 12 M, 1 A 5 PM')}" />
          </div>
        </div>

        <!-- Subsección Dinámica: Trabajo en casa -->
        <div id="dynamic-section-trabajo-casa" class="form-group span-2 dynamic-subform" style="display:${curModalidad === 'Trabajo en casa' ? 'block' : 'none'};">
          <div class="subform-banner subform-banner--amber">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Situación transitoria y excepcional. En los registros oficiales no tiene vigencia ni fechas fijas. Duración: No aplica.</span>
          </div>

          <div class="form-group">
            <label for="motivo-trabajo-casa" class="form-label">Justificación o Motivo Transitorio (Opcional)</label>
            <input type="text" id="motivo-trabajo-casa" class="form-input" placeholder="Ej: Situación transitoria de salud o calamidad..." value="${escHtml(item?.motivo_trabajo_casa || '')}" />
          </div>
        </div>

        <!-- Subsección Dinámica: Presencial -->
        <div id="dynamic-section-presencial" class="form-group span-2 dynamic-subform" style="display:${curModalidad === 'Presencial' ? 'block' : 'none'};">
          <div class="subform-banner" style="background:rgba(59, 130, 246, 0.12); color:#2563eb; border:1px solid rgba(59, 130, 246, 0.25);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>Jornada ordinaria en sede física institucional (44 horas semanales, Lunes a Viernes).</span>
          </div>
        </div>

        <!-- Campos de Vigencia y Duración -->
        <div class="form-group">
          <label for="horario-duracion-texto" class="form-label" style="font-weight:700;">Vigencia y Duración</label>
          <input type="text" id="horario-duracion-texto" class="form-input font-bold" value="${escHtml(defaultDuracion)}" placeholder="Ej: 2 días / semana, 8 horas / día, o No aplica" />
          <small class="field-hint" style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">Calculada automáticamente según la modalidad y los días seleccionados</small>
        </div>

        <div class="form-group">
          <label for="horario-fecha-inicio" class="form-label">Fecha de Solicitud / Inicio (Opcional)</label>
          <input type="date" id="horario-fecha-inicio" class="form-input" value="${
            item?.fecha_inicio ? item.fecha_inicio.split('T')[0] : ''
          }" />
          <small class="field-hint" style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">Fecha del registro oficial si existe</small>
        </div>

        <div class="form-group">
          <label for="horario-fecha-fin" class="form-label">Fecha de Finalización (Opcional)</label>
          <input type="date" id="horario-fecha-fin" class="form-input" value="${
            item?.fecha_fin ? item.fecha_fin.split('T')[0] : ''
          }" />
          <small class="field-hint" style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">Solo si el acto administrativo fija una fecha de término explícita</small>
        </div>

        <div class="form-group">
          <label class="form-label">Tipo de Cómputo</label>
          <select id="horario-tipo-calculo" class="filter-select">
            <option value="Hábiles" ${curTipoCalc === 'Hábiles' ? 'selected' : ''}>Días Hábiles (L-V)</option>
            <option value="Calendario" ${curTipoCalc === 'Calendario' ? 'selected' : ''}>Días Calendario</option>
          </select>
        </div>

        <!-- Sección 4: Acto Administrativo y Soporte Digital -->
        <div class="form-group span-2" style="margin-top:var(--space-2);">
          <div class="form-section-header">
            <div class="form-section-icon form-section-icon--amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div>
              <span class="form-section-title">Acto Administrativo y Soporte</span>
              <span class="form-section-desc">Resolución oficial y documento soporte escaneado</span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="horario-resolucion" class="form-label">Número de Resolución (Opcional)</label>
          <input type="text" id="horario-resolucion" class="form-input font-mono font-bold" placeholder="Ej: 0045 de 2026" value="${escHtml(
            item?.numero_resolucion || ''
          )}" />
        </div>

        <div class="form-group">
          <label for="horario-fecha-aprobacion" class="form-label">Fecha del Acto / Aprobación (Opcional)</label>
          <input type="date" id="horario-fecha-aprobacion" class="form-input" value="${
            item?.fecha_aprobacion ? item.fecha_aprobacion.split('T')[0] : (item?.fecha_resolucion ? item.fecha_resolucion.split('T')[0] : '')
          }" />
        </div>

        <!-- Carga de Archivo Soporte (PDF o Imagen de la hoja firmada) -->
        <div class="form-group span-2">
          <label class="form-label">Cargar Hoja de Solicitud / Reporte Firmado (Documento Soporte)</label>
          <div class="excel-dropzone" id="horario-soporte-dropzone" style="padding: 16px; margin: 0; background: var(--color-bg-secondary, rgba(255,255,255,0.02)); border: 2px dashed var(--color-border); cursor: pointer;">
            <input type="file" id="horario-soporte-file" accept=".pdf, image/*" style="display:none;" />
            <div class="excel-dropzone-icon" style="margin-bottom: 6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary, #3b82f6)" stroke-width="2" style="width:32px;height:32px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <p class="excel-dropzone-title" style="font-size:13px; margin-bottom:2px;">Haz clic o arrastra la hoja impresa y firmada (PDF o Imagen)</p>
            <p class="excel-dropzone-sub" style="font-size:11px;">Formatos: PDF, JPG, PNG (hasta 20MB)</p>
            
            <div id="horario-soporte-preview-wrap" style="display:${item?.soporte_acto ? 'block' : 'none'}; margin-top: 10px;">
              <div class="excel-file-preview-card" style="padding: 8px 12px; margin: 0; background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.3);">
                <div class="excel-file-preview-left">
                  <div class="excel-file-preview-icon" style="font-size:16px;">📄</div>
                  <div class="excel-file-preview-info">
                    <div id="horario-soporte-preview-text" class="excel-file-preview-name" style="font-size:12px;">${item?.soporte_acto ? 'Documento firmado cargado' : ''}</div>
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
          document.querySelector('.modal-header-consecutivo')?.remove();
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

    // Inyectar el control de Consecutivo Oficial en la cabecera del modal (al lado del botón de cerrar)
    const modalHeader = document.querySelector('.modal-header');
    const modalCloseBtn = document.getElementById('modal-close');
    if (modalHeader && modalCloseBtn) {
      modalHeader.querySelector('.modal-header-consecutivo')?.remove();

      if (!isEdit) {
        let maxFound = 0;
        if (Array.isArray(state.data) && state.data.length > 0) {
          state.data.forEach((d) => {
            const val = parseInt(d.numero_consecutivo, 10);
            if (!isNaN(val) && val > maxFound) maxFound = val;
          });
        }
        if (typeof state.total === 'number' && state.total > maxFound) {
          maxFound = state.total;
        }
        currentMinConsecutivo = maxFound + 1;
      }

      let consecutivoVal = item?.numero_consecutivo || '';
      if (!consecutivoVal && !isEdit) {
        consecutivoVal = currentMinConsecutivo;
      }

      const consecutivoWrap = document.createElement('div');
      consecutivoWrap.className = 'modal-header-consecutivo';
      consecutivoWrap.innerHTML = `
        <label for="horario-consecutivo" title="${!isEdit ? `Mínimo consecutivo permitido: #${currentMinConsecutivo}` : ''}">
          NO. CONSECUTIVO OFICIAL ${!isEdit ? `<span id="lbl-min-consecutivo" style="font-size:10px; color:var(--text-muted); font-weight:normal;">(Mín. #${currentMinConsecutivo})</span>` : ''}
        </label>
        <input
          type="number"
          id="horario-consecutivo"
          class="form-input font-mono font-bold"
          min="${!isEdit ? currentMinConsecutivo : 1}"
          placeholder="Ej: ${!isEdit ? currentMinConsecutivo : 1}"
          value="${consecutivoVal}"
          title="${!isEdit ? `El consecutivo oficial no puede ser menor a ${currentMinConsecutivo}` : ''}"
        />
      `;
      modalHeader.insertBefore(consecutivoWrap, modalCloseBtn);

      // Si es un nuevo registro, consultar siempre a la API el consecutivo oficial exacto de la BD
      if (!isEdit) {
        API.getNextHorarioConsecutivo()
          .then((res) => {
            if (res && res.nextConsecutivo != null) {
              const apiNext = parseInt(res.nextConsecutivo, 10);
              if (!isNaN(apiNext) && apiNext > 0) {
                currentMinConsecutivo = apiNext;
                const inp = document.getElementById('horario-consecutivo');
                if (inp) {
                  inp.min = currentMinConsecutivo;
                  inp.placeholder = `Ej: ${currentMinConsecutivo}`;
                  const curVal = parseInt(inp.value, 10);
                  if (isNaN(curVal) || curVal < currentMinConsecutivo) {
                    inp.value = currentMinConsecutivo;
                  }
                  inp.setAttribute('title', `El consecutivo oficial no puede ser menor a ${currentMinConsecutivo}`);
                }
                const lblMin = document.getElementById('lbl-min-consecutivo');
                if (lblMin) {
                  lblMin.textContent = `(Mín. #${currentMinConsecutivo})`;
                }
              }
            }
          })
          .catch(() => {});
      }
    }

    // Conectar eventos dinámicos del formulario
    bindModalFormEvents(item);
  }

  // ─── Lógica Dinámica del Formulario (Autocomplete y Días) ─────────────────
  function bindModalFormEvents(item) {
    const isEdit = Boolean(item);

    // 1. Selector de Modalidad dinámico
    const modalidadRadios = document.querySelectorAll('input[name="modalidad_radio"]');
    modalidadRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.modalidad-card-option').forEach((card) => card.classList.remove('selected'));
        radio.closest('.modalidad-card-option')?.classList.add('selected');

        const val = radio.value;
        const secTele = document.getElementById('dynamic-section-teletrabajo');
        const secFlex = document.getElementById('dynamic-section-horario-flexible');
        const secCasa = document.getElementById('dynamic-section-trabajo-casa');
        const secPres = document.getElementById('dynamic-section-presencial');

        if (secTele) secTele.style.display = val === 'Teletrabajo' ? 'block' : 'none';
        if (secFlex) secFlex.style.display = val === 'Horario flexible' ? 'block' : 'none';
        if (secCasa) secCasa.style.display = val === 'Trabajo en casa' ? 'block' : 'none';
        if (secPres) secPres.style.display = val === 'Presencial' ? 'block' : 'none';

        const durInput = document.getElementById('horario-duracion-texto');
        if (durInput) {
          if (val === 'Teletrabajo') {
            const activeDays = Array.from(document.querySelectorAll('#teletrabajo-day-chips .chip-day.active'));
            durInput.value = `${activeDays.length || 2} días / semana`;
          } else if (val === 'Horario flexible') {
            durInput.value = '8 horas / día';
          } else if (val === 'Trabajo en casa') {
            durInput.value = 'No aplica';
          } else if (val === 'Presencial') {
            durInput.value = 'Jornada ordinaria';
          }
        }
      });
    });

    // 2. Chips interactivos de días para Teletrabajo
    const dayChips = document.querySelectorAll('#teletrabajo-day-chips .chip-day');
    dayChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        if (chip.classList.contains('active')) {
          chip.style.background = 'var(--color-primary, #287522)';
          chip.style.borderColor = 'var(--color-primary, #287522)';
          chip.style.color = '#ffffff';
        } else {
          chip.style.background = 'var(--color-bg-secondary)';
          chip.style.borderColor = 'var(--color-border)';
          chip.style.color = 'var(--text-secondary)';
        }

        const activeChips = Array.from(document.querySelectorAll('#teletrabajo-day-chips .chip-day.active'));
        const activeNames = activeChips.map((c) => c.getAttribute('data-day'));

        let daysText = '';
        if (activeNames.length === 0) {
          daysText = '';
        } else if (activeNames.length === 1) {
          daysText = activeNames[0];
        } else if (activeNames.length === 2) {
          daysText = `${activeNames[0]} y ${activeNames[1]}`;
        } else {
          daysText = `${activeNames.slice(0, -1).join(', ')} y ${activeNames[activeNames.length - 1]}`;
        }

        const diasInput = document.getElementById('dias-teletrabajo');
        if (diasInput) diasInput.value = daysText;

        const durInput = document.getElementById('horario-duracion-texto');
        if (durInput) {
          durInput.value = activeNames.length > 0 ? `${activeNames.length} días / semana` : '2 días / semana';
        }
      });

      // Estilo inicial
      if (chip.classList.contains('active')) {
        chip.style.background = 'var(--color-primary, #287522)';
        chip.style.borderColor = 'var(--color-primary, #287522)';
        chip.style.color = '#ffffff';
      }
    });

    // 3. Botones de franja rápida para Horario Flexible
    const franjaButtons = document.querySelectorAll('.chip-franja');
    franjaButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const franjaVal = btn.getAttribute('data-franja');
        const franjaInput = document.getElementById('franja-ingreso');
        if (franjaInput && franjaVal) franjaInput.value = franjaVal;

        const durInput = document.getElementById('horario-duracion-texto');
        if (durInput) durInput.value = '8 horas / día';
      });
    });

    // 4. Autocomplete y carga de datos de servidores públicos institucional
    // Trae apenas la información estrictamente necesaria de la BD:
    // Cédula, Nombres y Apellidos, Código, Grado, Dependencia, Secretaría y Cargo
    const empSearchInput = document.getElementById('horario-search-emp');
    const empResultsDiv = document.getElementById('horario-emp-results');
    const docInputEl = document.getElementById('horario-documento');
    const btnUnlockServidor = document.getElementById('btn-unlock-servidor');
    let docLookupTimeout = null;
    let isManualServidorMode = false;

    const serverFieldIds = [
      'horario-nombre',
      'horario-documento',
      'horario-cargo',
      'horario-codigo',
      'horario-grado',
      'horario-dependencia',
      'horario-secretaria'
    ];

    const setServerFieldsLock = (locked) => {
      // En modo edición no se bloquea, se dejan editables como solicitó el usuario
      if (isEdit) return;

      serverFieldIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.readOnly = locked;
        if (locked) {
          el.setAttribute('readonly', 'readonly');
          el.classList.add('input-locked-servidor');
          el.setAttribute('title', 'Dato institucional vinculado desde la base de datos (bloqueado contra modificación o borrado)');
        } else {
          el.removeAttribute('readonly');
          el.classList.remove('input-locked-servidor');
          el.removeAttribute('title');
        }
      });

      const indicator = document.getElementById('servidor-locked-indicator');
      if (indicator) indicator.style.display = locked ? 'inline-flex' : 'none';
      if (btnUnlockServidor) btnUnlockServidor.style.display = locked ? 'inline-flex' : 'none';
    };

    // Bloqueo estricto por teclado en los campos de servidor cuando están protegidos
    serverFieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (!isEdit && el.readOnly) {
            // Permitir navegación y copiado
            if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || (e.ctrlKey && ['c', 'C', 'a', 'A'].includes(e.key))) {
              return;
            }
            e.preventDefault();
            App.showToast('Este campo está protegido por provenir de la base de datos institucional. Si requiere modificarlo, use el botón "✕ Desvincular / Ingreso manual".', 'warning');
          }
        });
      }
    });

    btnUnlockServidor?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isManualServidorMode = true;
      setServerFieldsLock(false);
      if (empSearchInput) empSearchInput.value = '';
      App.showToast('Campos habilitados para ingreso manual.', 'info');
    });

    const populateServidorFields = (emp, notify = true) => {
      if (!emp) return;
      isManualServidorMode = false;
      const doc = (emp.cedula || emp.documento || '').toString().trim();
      const name = (emp.nombre_completo || emp.nombreCompleto || emp.persona || '').toString().trim();
      const cargo = (emp.cargo || emp.cargoActual || emp.cargo_actual || emp.cargoBase || '').toString().trim();
      const codigo = (emp.codigo || emp.codigoActual || emp.codigo_actual || emp.codigoBase || '').toString().trim();
      const grado = (emp.grado || emp.gradoActual || emp.grado_actual || emp.gradoBase || '').toString().trim();
      const dept = (emp.dependencia || '').toString().trim();
      const sec = (emp.secretaria || '').toString().trim();

      const docEl = document.getElementById('horario-documento');
      const nameEl = document.getElementById('horario-nombre');
      const codigoEl = document.getElementById('horario-codigo');
      const gradoEl = document.getElementById('horario-grado');
      const cargoEl = document.getElementById('horario-cargo');
      const deptEl = document.getElementById('horario-dependencia');
      const secEl = document.getElementById('horario-secretaria');

      if (docEl && doc) docEl.value = doc;
      if (nameEl && name) nameEl.value = name;
      if (codigoEl) codigoEl.value = codigo || '';
      if (gradoEl) gradoEl.value = grado || '';
      if (cargoEl) cargoEl.value = cargo || '';
      if (deptEl) deptEl.value = dept || '';
      if (secEl) secEl.value = sec || '';

      if (empSearchInput && name && doc) {
        empSearchInput.value = `${name} (C.C. ${doc})`;
      }

      // Bloquear los 7 campos para evitar eliminación o alteración de datos institucionales
      setServerFieldsLock(true);

      // Animación azul visible y estilizada en los campos autocompletados
      [docEl, nameEl, codigoEl, gradoEl, cargoEl, deptEl, secEl].forEach((el) => {
        if (el) {
          el.classList.add('input-flash-blue');
          setTimeout(() => {
            el.classList.remove('input-flash-blue');
          }, 1500);
        }
      });

      if (notify && typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Servidor institucional cargado: ${name}`, 'success');
      }
    };

    // Búsqueda en tiempo real desde el campo "Buscar Servidor en Nómina (Nombre o Cédula)"
    empSearchInput?.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(employeeSearchTimeout);

      if (!q) {
        // Si el usuario vació el buscador, desbloquear los campos para ingreso manual
        isManualServidorMode = true;
        setServerFieldsLock(false);
        if (empResultsDiv) empResultsDiv.style.display = 'none';
        return;
      }

      if (q.length < 2) {
        if (empResultsDiv) empResultsDiv.style.display = 'none';
        return;
      }

      employeeSearchTimeout = setTimeout(async () => {
        try {
          const res = await (API.buscarServidor ? API.buscarServidor(q, 8) : API.getEmployees({ q, limit: 8 }));
          const list = res.data || [];
          if (list.length === 0) {
            empResultsDiv.innerHTML = `<div class="autocomplete-item text-muted" style="padding:10px 14px; font-size:12px;">No se encontraron funcionarios con ese criterio</div>`;
          } else {
            empResultsDiv.innerHTML = list
              .map((emp, idx) => {
                const empDoc = emp.cedula || emp.documento || '';
                const empName = emp.nombre_completo || emp.nombreCompleto || emp.persona || 'Servidor Público';
                const empCargo = emp.cargo || emp.cargoActual || emp.cargo_actual || emp.cargoBase || 'Cargo institucional';
                const empCodigo = emp.codigo || emp.codigoActual || emp.codigo_actual || '';
                const empGrado = emp.grado || emp.gradoActual || emp.grado_actual || '';
                const empDept = emp.dependencia || 'Sin dependencia';

                return `
                  <div class="autocomplete-item" data-idx="${idx}" style="padding:10px 14px; border-bottom:1px solid rgba(0,0,0,0.05); cursor:pointer;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                      <strong style="color:var(--color-primary, #2563eb); font-size:13px;">${escHtml(empName)}</strong>
                      <span class="badge" style="font-size:11px; font-family:monospace; background:rgba(37,99,235,0.1); color:#2563eb; padding:2px 6px; border-radius:4px;">C.C. ${escHtml(empDoc)}</span>
                    </div>
                    <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px; display:flex; gap:6px; flex-wrap:wrap;">
                      <span><strong>Cargo:</strong> ${escHtml(empCargo)}</span>
                      ${empCodigo || empGrado ? `<span>(Cód: <strong>${escHtml(empCodigo || '—')}</strong>, Grado: <strong>${escHtml(empGrado || '—')}</strong>)</span>` : ''}
                      <span>· ${escHtml(empDept)}</span>
                    </div>
                  </div>
                `;
              })
              .join('');

            empResultsDiv.querySelectorAll('.autocomplete-item').forEach((itemEl) => {
              itemEl.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(itemEl.getAttribute('data-idx'), 10);
                const selectedEmp = list[idx];
                if (selectedEmp) {
                  populateServidorFields(selectedEmp, true);
                }
                empResultsDiv.style.display = 'none';
                empResultsDiv.innerHTML = '';
              });
            });
          }
          empResultsDiv.style.display = 'block';
        } catch (err) {
          console.error('Error autocomplete:', err);
        }
      }, 250);
    });

    // Búsqueda directa al escribir la Cédula en "Documento de Identidad (C.C.)" (si está en modo manual)
    const lookupServidorByCedula = async (rawDoc) => {
      if (isManualServidorMode || isEdit) return;
      if (!rawDoc) return;
      const cleanDoc = rawDoc.trim().replace(/[.,\s]/g, '');
      if (cleanDoc.length < 4) return;

      try {
        const res = await (API.buscarServidor ? API.buscarServidor(cleanDoc, 1) : API.getEmployees({ q: cleanDoc, limit: 1 }));
        const match = res?.data?.[0];
        if (match) {
          const matchDoc = (match.cedula || match.documento || '').toString().replace(/[.,\s]/g, '');
          if (matchDoc === cleanDoc) {
            populateServidorFields(match, true);
          }
        }
      } catch (err) {
        console.warn('Error consulta servidor por cédula:', err);
      }
    };

    docInputEl?.addEventListener('change', (e) => lookupServidorByCedula(e.target.value));
    docInputEl?.addEventListener('blur', (e) => lookupServidorByCedula(e.target.value));
    docInputEl?.addEventListener('input', (e) => {
      clearTimeout(docLookupTimeout);
      const val = e.target.value.trim().replace(/[.,\s]/g, '');
      if (val.length >= 6) {
        docLookupTimeout = setTimeout(() => lookupServidorByCedula(val), 600);
      }
    });

    document.addEventListener('click', (ev) => {
      if (!empSearchInput?.contains(ev.target) && !empResultsDiv?.contains(ev.target)) {
        if (empResultsDiv) empResultsDiv.style.display = 'none';
      }
    });

    // 5. Carga de archivo de soporte / reporte firmado
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

    // 6. Restricción estricta de Consecutivo Oficial al crear: no dejar disminuir del último que está
    const consecutivoInput = document.getElementById('horario-consecutivo');
    if (consecutivoInput && !isEdit) {
      consecutivoInput.min = currentMinConsecutivo;

      const enforceConsecutivo = () => {
        if (isEdit) return;
        const v = parseInt(consecutivoInput.value, 10);
        if (isNaN(v) || v < currentMinConsecutivo) {
          App.showToast(`El número consecutivo oficial no puede ser menor a #${currentMinConsecutivo} (último registrado: #${currentMinConsecutivo - 1}). Se restableció automáticamente.`, 'warning');
          consecutivoInput.value = currentMinConsecutivo;
        }
        consecutivoInput.style.borderColor = '';
        consecutivoInput.style.boxShadow = '';
        const lblMin = document.getElementById('lbl-min-consecutivo');
        if (lblMin) {
          lblMin.style.color = 'var(--text-muted)';
          lblMin.style.fontWeight = 'normal';
        }
      };

      consecutivoInput.addEventListener('keydown', (e) => {
        if (isEdit) return;
        if (e.key === 'ArrowDown') {
          const v = parseInt(consecutivoInput.value, 10);
          if (isNaN(v) || v <= currentMinConsecutivo) {
            e.preventDefault();
            consecutivoInput.value = currentMinConsecutivo;
            App.showToast(`El consecutivo oficial no puede ser menor a #${currentMinConsecutivo}.`, 'warning');
          }
        }
      });

      consecutivoInput.addEventListener('input', () => {
        if (isEdit) return;
        const raw = consecutivoInput.value.trim();
        if (!raw) return;
        const v = parseInt(raw, 10);
        const lblMin = document.getElementById('lbl-min-consecutivo');
        if (!isNaN(v) && v < currentMinConsecutivo) {
          consecutivoInput.style.borderColor = '#ef4444';
          consecutivoInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.25)';
          if (lblMin) {
            lblMin.style.color = '#ef4444';
            lblMin.style.fontWeight = 'bold';
          }
          if (String(raw).length >= String(currentMinConsecutivo).length) {
            App.showToast(`El número consecutivo oficial no puede ser menor a #${currentMinConsecutivo}.`, 'warning');
            consecutivoInput.value = currentMinConsecutivo;
            consecutivoInput.style.borderColor = '';
            consecutivoInput.style.boxShadow = '';
            if (lblMin) {
              lblMin.style.color = 'var(--text-muted)';
              lblMin.style.fontWeight = 'normal';
            }
          }
        } else {
          consecutivoInput.style.borderColor = '';
          consecutivoInput.style.boxShadow = '';
          if (lblMin) {
            lblMin.style.color = 'var(--text-muted)';
            lblMin.style.fontWeight = 'normal';
          }
        }
      });

      consecutivoInput.addEventListener('change', enforceConsecutivo);
      consecutivoInput.addEventListener('blur', enforceConsecutivo);
    }
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
    const estado = document.getElementById('horario-estado')?.value || 'Activa';

    const modalidadRadio = document.querySelector('input[name="modalidad_radio"]:checked');
    const modalidad = modalidadRadio ? modalidadRadio.value : 'Presencial';

    const fecha_inicio = document.getElementById('horario-fecha-inicio')?.value || null;
    const fecha_fin = document.getElementById('horario-fecha-fin')?.value || null;
    const duracion_texto = document.getElementById('horario-duracion-texto')?.value?.trim() || 
      (modalidad === 'Teletrabajo' ? '2 días / semana' : modalidad === 'Horario flexible' ? '8 horas / día' : modalidad === 'Trabajo en casa' ? 'No aplica' : 'Jornada ordinaria');
    const tipo_calculo = document.getElementById('horario-tipo-calculo')?.value || 'Hábiles';

    // Acto administrativo (opcional, no inventar datos)
    const numero_resolucion = document.getElementById('horario-resolucion')?.value?.trim() || null;
    const fecha_aprobacion = document.getElementById('horario-fecha-aprobacion')?.value || null;
    const soporte_acto = document.getElementById('horario-soporte-val')?.value?.trim() || null;
    const observaciones = document.getElementById('horario-observaciones')?.value?.trim() || '';

    // Validaciones
    if (!documento || !apellidos_nombres) {
      App.showToast('El Documento y Nombre del servidor son requeridos.', 'warning');
      return;
    }

    // Validación de número consecutivo para nuevos registros (no dejar disminuir del último que está)
    if (!existingId) {
      const cVal = numero_consecutivo ? parseInt(numero_consecutivo, 10) : null;
      if (!cVal || cVal < currentMinConsecutivo) {
        App.showToast(`El número consecutivo oficial no puede ser menor a ${currentMinConsecutivo} (último registrado: ${currentMinConsecutivo - 1}).`, 'error');
        const cInp = document.getElementById('horario-consecutivo');
        if (cInp) {
          cInp.value = currentMinConsecutivo;
          cInp.focus();
        }
        return;
      }
    }

    const payload = {
      numero_consecutivo: numero_consecutivo ? parseInt(numero_consecutivo, 10) : null,
      codigo: codigo || null,
      grado: grado || null,
      secretaria: secretaria || null,
      documento,
      apellidos_nombres,
      dependencia: dependencia || 'SECRETARÍA GENERAL',
      cargo: cargo || 'PROFESIONAL UNIVERSITARIO',
      estado,
      modalidad,
      fecha_inicio,
      fecha_fin,
      duracion_texto,
      tipo_calculo,
      numero_resolucion,
      fecha_aprobacion,
      aprobado_por: null,
      soporte_acto,
      observaciones,
    };

    // Campos según modalidad
    if (modalidad === 'Teletrabajo') {
      payload.subtipo_teletrabajo = document.getElementById('subtipo-teletrabajo')?.value || 'Suplementario (Híbrido)';
      payload.dias_teletrabajo = document.getElementById('dias-teletrabajo')?.value?.trim() || 'martes y jueves';
    } else if (modalidad === 'Horario flexible') {
      payload.franja_ingreso = document.getElementById('franja-ingreso')?.value?.trim() || '8 AM A 12 M, 1 A 5 PM';
    } else if (modalidad === 'Trabajo en casa') {
      payload.motivo_trabajo_casa = document.getElementById('motivo-trabajo-casa')?.value?.trim() || null;
    }

    try {
      if (existingId) {
        await API.updateHorario(existingId, payload);
        App.showToast('Esquema de horario actualizado correctamente.', 'success');
      } else {
        await API.createHorario(payload);
        App.showToast('Esquema de horario registrado exitosamente.', 'success');
      }

      document.querySelector('.modal-header-consecutivo')?.remove();
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
    App.openModal('Ficha Integral del Esquema de Horario', renderDetailModalSkeleton(), [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
    ], 'modal-ficha modal-lg');

    const box = document.querySelector('.modal-box');
    if (box) {
      box.classList.add('modal-ficha', 'modal-lg');
      box.style.maxWidth = '900px';
      box.style.width = '92vw';
    }

    try {
      const res = await API.getHorarioById(id);
      const h = res.horario;
      if (!h) {
        App.showToast('No se encontró el esquema solicitado.', 'error');
        App.closeModal();
        return;
      }

      const cleanNombre = (h.apellidos_nombres || '').trim();
      const nameParts = cleanNombre.split(/\s+/).filter(Boolean);
      let cleanApellidos = '';
      let cleanNombres = '';
      if (nameParts.length >= 2) {
        cleanApellidos = nameParts.slice(0, 2).join(' ');
        cleanNombres = nameParts.slice(2).join(' ') || nameParts[1];
      } else {
        cleanNombres = cleanNombre;
      }
      const initials = nameParts.length >= 2
        ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
        : (cleanNombre.slice(0, 2).toUpperCase() || 'SP');
      const isActivo = !h.estado || h.estado.toLowerCase().includes('activ');
      const formattedCc = formatCedulaDots(h.documento);
      const consecutivo = h.numero_consecutivo != null ? h.numero_consecutivo : h.id_horario;
      const modalidadStr = (h.modalidad || 'Teletrabajo').trim();
      const isTeletrabajo = modalidadStr.toLowerCase().includes('teletrabajo');
      const isFlexible = modalidadStr.toLowerCase().includes('flexible');
      const isCasa = modalidadStr.toLowerCase().includes('casa');

      const bodyHtml = `
        <div class="ficha-wrapper">
          <!-- ─── Hero Profile Header ─── -->
          <div class="ficha-hero">
            <div class="ficha-hero-inner">
              <div class="ficha-avatar-box">
                <div class="ficha-avatar">${escHtml(initials)}</div>
                <div class="ficha-avatar-badge ${isActivo ? '' : 'inactivo'}" title="${isActivo ? 'Esquema Activo' : 'Esquema ' + escHtml(h.estado)}"></div>
              </div>
              <div class="ficha-hero-info">
                <h3 class="ficha-hero-name">${escHtml(cleanNombre)}</h3>
                <div class="ficha-hero-sub">
                  <span>Apellidos: <strong>${escHtml(cleanApellidos || cleanNombre)}</strong></span>
                  <span>•</span>
                  <span>Nombres: <strong>${escHtml(cleanNombres || cleanNombre)}</strong></span>
                </div>
                <div class="ficha-hero-pills">
                  <div class="ficha-hero-pill">
                    <span>🪪 C.C. <strong>${escHtml(formattedCc)}</strong></span>
                    ${h.documento ? `
                      <button class="ficha-copy-btn" id="btn-copy-ficha-cc" onclick="HorariosModule.copyFichaText('${escHtml(h.documento)}', 'btn-copy-ficha-cc')" title="Copiar cédula">
                        <svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copiar
                      </button>
                    ` : ''}
                  </div>
                  <span class="ficha-hero-pill ${isActivo ? 'pill--emerald' : ''}">
                    ${isActivo ? '🟢 Activo' : '⚪ ' + escHtml(h.estado)}
                  </span>
                  <span class="ficha-hero-pill">
                    💼 ${escHtml(h.cargo || 'Funcionario')}
                  </span>
                  <span class="ficha-hero-pill">
                    🏢 ${escHtml(h.dependencia || 'Gobernación de Boyacá')}
                  </span>
                </div>
              </div>
              <div class="ficha-hero-logo-wrap" title="Gobernación de Boyacá">
                <img src="imgs/logoCondor.png" alt="Cóndor — Boyacá" class="ficha-hero-condor logo-light-theme" />
                <img src="imgs/logoCondorBlanco.png" alt="Cóndor — Boyacá" class="ficha-hero-condor logo-dark-theme" />
              </div>
            </div>
          </div>

          <!-- ─── Tabs Navigation ─── -->
          <div class="ficha-tabs">
            <button class="ficha-tab-btn active" data-tab="ficha-esquema" onclick="HorariosModule.switchFichaTab('ficha-esquema')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Esquema & Horario
            </button>
            <button class="ficha-tab-btn" data-tab="ficha-acto" onclick="HorariosModule.switchFichaTab('ficha-acto')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Acto Administrativo & Vigencia
            </button>
            <button class="ficha-tab-btn" data-tab="ficha-servidor" onclick="HorariosModule.switchFichaTab('ficha-servidor')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Servidor & Ubicación
            </button>
          </div>

          <!-- ─── Tab 1: Esquema & Horario ─── -->
          <div class="ficha-tab-pane active" id="ficha-esquema">
            <div class="ficha-grid">
              <div class="ficha-card ficha-card--gold">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">💼</div>
                  <span class="ficha-card-label">Modalidad / Situación Administrativa</span>
                </div>
                <div class="ficha-card-val" style="font-size:1.15rem; color:var(--color-gold, #d97706); font-weight:800;">
                  ${escHtml(modalidadStr)}
                </div>
                <div class="ficha-card-sub">Modalidad laboral autorizada institucionalmente</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🗓️</div>
                  <span class="ficha-card-label">Horario Asignado / Días de Alternancia</span>
                </div>
                <div class="ficha-card-val" style="font-weight:700;">
                  ${escHtml(h.dias_teletrabajo || h.franja_ingreso || 'Jornada Ordinaria')}
                </div>
                <div class="ficha-card-sub">Días autorizados o franja horaria aplicable</div>
              </div>

              <!-- Stat Destacado: Duración y Cómputo -->
              <div class="ficha-card ficha-card--featured ficha-grid--full">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">⏳</div>
                  <span class="ficha-card-label" style="color:var(--color-navy);">Duración Autorizada y Tipo de Cómputo</span>
                </div>
                <div class="ficha-card-val" style="font-size:1.25rem; font-weight:800; color:var(--color-success);">
                  ${escHtml(h.duracion_texto || (h.duracion_dias ? `${h.duracion_dias} días autorizados` : 'Vigencia Indefinida'))}
                </div>
                <div class="ficha-card-sub" style="color:var(--color-info);">
                  Cómputo en días <strong>${escHtml(h.tipo_calculo || 'Hábiles')}</strong> según marco regulatorio de la Gobernación de Boyacá
                </div>
              </div>

              ${isTeletrabajo ? `
                <div class="ficha-card">
                  <div class="ficha-card-top">
                    <div class="ficha-card-icon">🏠</div>
                    <span class="ficha-card-label">Subtipo de Teletrabajo</span>
                  </div>
                  <div class="ficha-card-val font-bold">
                    ${escHtml(h.subtipo_teletrabajo || 'Suplementario')}
                  </div>
                  <div class="ficha-card-sub">Alternancia en casa y sede física</div>
                </div>

                <div class="ficha-card">
                  <div class="ficha-card-top">
                    <div class="ficha-card-icon">🏢</div>
                    <span class="ficha-card-label">Días Presenciales / En Casa</span>
                  </div>
                  <div class="ficha-card-val">
                    Casa: <strong>${escHtml(h.dias_teletrabajo || '2')}</strong> &bull; Presencial: <strong>${escHtml(h.dias_presencial || '3')}</strong>
                  </div>
                  <div class="ficha-card-sub">Distribución semanal de jornada</div>
                </div>

                <div class="ficha-card">
                  <div class="ficha-card-top">
                    <div class="ficha-card-icon">🛡️</div>
                    <span class="ficha-card-label">Reporte y Cobertura Positiva ARL</span>
                  </div>
                  <div class="ficha-card-val">
                    ${h.notificacion_arl
                      ? '<span class="badge badge--success" style="font-size:12px; font-weight:700;">✓ Notificado formalmente a ARL</span>'
                      : '<span class="badge badge--revision" style="font-size:12px; font-weight:700;">⏳ Trámite ante ARL pendiente</span>'
                    }
                  </div>
                  <div class="ficha-card-sub">
                    ${h.fecha_reporte_arl ? `Radicado formal: ${formatDate(h.fecha_reporte_arl)}` : 'Cobertura de riesgos laborales en domicilio'}
                  </div>
                </div>

                <div class="ficha-card">
                  <div class="ficha-card-top">
                    <div class="ficha-card-icon">📍</div>
                    <span class="ficha-card-label">Domicilio Laboral Autorizado</span>
                  </div>
                  <div class="ficha-card-val" style="font-size:0.95rem;">
                    ${escHtml(h.domicilio_laboral || 'Tunja, Boyacá')}
                  </div>
                  <div class="ficha-card-sub">Puesto de trabajo en casa registrado para ARL</div>
                </div>
              ` : ''}

              ${isFlexible ? `
                <div class="ficha-card">
                  <div class="ficha-card-top">
                    <div class="ficha-card-icon">⏰</div>
                    <span class="ficha-card-label">Franja Horaria de Entrada</span>
                  </div>
                  <div class="ficha-card-val font-mono" style="font-size:1.1rem; color:var(--color-primary);">
                    ${escHtml(h.franja_ingreso || '07:00 AM - 08:30 AM')}
                  </div>
                  <div class="ficha-card-sub">Ingreso escalonado acordado</div>
                </div>

                <div class="ficha-card">
                  <div class="ficha-card-top">
                    <div class="ficha-card-icon">⏱️</div>
                    <span class="ficha-card-label">Franja Horaria de Salida</span>
                  </div>
                  <div class="ficha-card-val font-mono" style="font-size:1.1rem;">
                    ${escHtml(h.franja_salida || '04:30 PM - 06:00 PM')}
                  </div>
                  <div class="ficha-card-sub">Cumplimiento de 8 horas laborales diarias</div>
                </div>

                <div class="ficha-card ficha-grid--full">
                  <div class="ficha-card-top">
                    <div class="ficha-card-icon">📌</div>
                    <span class="ficha-card-label">Criterio o Justificación de Flexibilidad</span>
                  </div>
                  <div class="ficha-card-val" style="font-size:0.95rem; font-weight:500;">
                    ${escHtml(h.justificacion_flex || h.observaciones || 'Cuidado de hijos / familiares o estudios')}
                  </div>
                  <div class="ficha-card-sub">Concertación laboral bajo lineamientos institucionales</div>
                </div>
              ` : ''}

              ${isCasa ? `
                <div class="ficha-card ficha-grid--full">
                  <div class="ficha-card-top">
                    <div class="ficha-card-icon">📑</div>
                    <span class="ficha-card-label">Motivo Excepcional (Ley 2088 de 2021)</span>
                  </div>
                  <div class="ficha-card-val" style="font-size:0.95rem;">
                    ${escHtml(h.motivo_trabajo_casa || 'Situación ocasional, excepcional o especial debidamente sustentada')}
                  </div>
                  <div class="ficha-card-sub">Habilitación temporal de trabajo en casa</div>
                </div>

                <div class="ficha-card">
                  <div class="ficha-card-top">
                    <div class="ficha-card-icon">📍</div>
                    <span class="ficha-card-label">Lugar de Prestación del Servicio</span>
                  </div>
                  <div class="ficha-card-val">
                    ${escHtml(h.direccion_trabajo_casa || 'Domicilio habitual del servidor')}
                  </div>
                  <div class="ficha-card-sub">Ubicación reportada</div>
                </div>

                <div class="ficha-card">
                  <div class="ficha-card-top">
                    <div class="ficha-card-icon">💻</div>
                    <span class="ficha-card-label">Herramientas y Conectividad TIC</span>
                  </div>
                  <div class="ficha-card-val">
                    ${escHtml(h.herramientas_tic || 'Equipos y TIC suministrados / propios')}
                  </div>
                  <div class="ficha-card-sub">Condiciones tecnológicas para desempeño</div>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- ─── Tab 2: Acto Administrativo & Vigencia ─── -->
          <div class="ficha-tab-pane" id="ficha-acto">
            <div class="ficha-grid">
              <div class="ficha-card ficha-grid--full ficha-card--gold">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📜</div>
                  <span class="ficha-card-label">Acto Administrativo / Resolución</span>
                </div>
                <div class="ficha-card-val font-mono" style="font-size:1.25rem; font-weight:800; color:var(--text-primary);">
                  ${escHtml(h.numero_resolucion || 'Sin Resolución Registrada')}
                </div>
                <div class="ficha-card-sub">Acto administrativo oficial que formaliza la situación laboral</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">✍️</div>
                  <span class="ficha-card-label">Autorización / Trámite</span>
                </div>
                <div class="ficha-card-val" style="font-weight:700;">
                  ${escHtml(h.aprobado_por || 'Dirección de Gestión de Talento Humano')}
                </div>
                <div class="ficha-card-sub">Trámite Institucional Oficial</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📅</div>
                  <span class="ficha-card-label">Fecha de Expedición / Aprobación</span>
                </div>
                <div class="ficha-card-val font-mono">
                  ${formatDate(h.fecha_aprobacion || h.fecha_resolucion)}
                </div>
                <div class="ficha-card-sub">Firma del acto administrativo</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📨</div>
                  <span class="ficha-card-label">Fecha de Notificación al Servidor</span>
                </div>
                <div class="ficha-card-val font-mono">
                  ${formatDate(h.fecha_notificacion)}
                </div>
                <div class="ficha-card-sub">Comunicación oficial al funcionario</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🟢</div>
                  <span class="ficha-card-label">Fecha Inicio de Vigencia</span>
                </div>
                <div class="ficha-card-val font-mono" style="color:var(--color-success); font-weight:700; font-size:1.05rem;">
                  ${formatDate(h.fecha_inicio)}
                </div>
                <div class="ficha-card-sub">Comienzo de efectos de la situación</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🔴</div>
                  <span class="ficha-card-label">Fecha Final de Vigencia</span>
                </div>
                <div class="ficha-card-val font-mono" style="font-weight:700; font-size:1.05rem;">
                  ${h.fecha_fin ? formatDate(h.fecha_fin) : '<span style="color:var(--text-muted);">Indefinida / Sin fecha fin</span>'}
                </div>
                <div class="ficha-card-sub">${h.fecha_fin ? 'Culminación del período autorizado' : 'Vigencia continuada'}</div>
              </div>

              <!-- Soporte Documental Digitalizado -->
              <div class="ficha-card ficha-grid--full ficha-card--featured" style="padding:16px 18px;">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📎</div>
                  <span class="ficha-card-label" style="color:var(--color-navy);">Soporte Documental Escaneado / Digitalizado</span>
                </div>
                <div style="margin-top:8px;">
                  ${h.soporte_acto ? `
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                      <span style="color:var(--color-success); font-weight:700; display:inline-flex; align-items:center; gap:6px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><polyline points="20 6 9 17 4 12"/></svg>
                        Hoja de Resolución Firmada Adjunta al Esquema
                      </span>
                      <div style="display:inline-flex; gap:8px;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="HorariosModule.viewSoporte(${h.id_horario})" style="font-weight:700;">
                          📄 Ver Documento
                        </button>
                        <button type="button" class="btn btn-outline btn-sm" onclick="App.closeModal(); HorariosModule.openUploadSoporteModal(${h.id_horario})">
                          Reemplazar Archivo
                        </button>
                      </div>
                    </div>
                  ` : `
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                      <span style="color:var(--text-muted); font-size:13px;">No cuenta con soporte digitalizado adjunto actualmente.</span>
                      <button type="button" class="btn btn-primary btn-sm" onclick="App.closeModal(); HorariosModule.openUploadSoporteModal(${h.id_horario})" style="font-weight:700;">
                        📎 Adjuntar Resolución Firmada
                      </button>
                    </div>
                  `}
                </div>
              </div>
            </div>
          </div>

          <!-- ─── Tab 3: Servidor & Ubicación ─── -->
          <div class="ficha-tab-pane" id="ficha-servidor">
            <div class="ficha-grid">
              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🪪</div>
                  <span class="ficha-card-label">Cédula de Ciudadanía</span>
                </div>
                <div class="ficha-card-val font-mono" style="font-size:1.1rem; color:var(--color-primary); font-weight:700;">
                  C.C. ${escHtml(formattedCc)}
                </div>
                <div class="ficha-card-sub">Identificación institucional del servidor</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🔢</div>
                  <span class="ficha-card-label">Número Consecutivo</span>
                </div>
                <div class="ficha-card-val font-mono" style="font-size:1.1rem; font-weight:800;">
                  # ${consecutivo}
                </div>
                <div class="ficha-card-sub">Consecutivo en la relación administrativa</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">💼</div>
                  <span class="ficha-card-label">Denominación del Cargo</span>
                </div>
                <div class="ficha-card-val" style="color:var(--color-gold, #d97706); font-weight:700;">
                  ${escHtml(h.cargo || 'No registrado')}
                </div>
                <div class="ficha-card-sub">Cargo que desempeña en la entidad</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🏷️</div>
                  <span class="ficha-card-label">Código y Grado</span>
                </div>
                <div class="ficha-card-val font-mono">
                  Cód. <strong>${escHtml(h.codigo || 'N/A')}</strong> &bull; Grado <strong>${escHtml(h.grado || 'N/A')}</strong>
                </div>
                <div class="ficha-card-sub">Escala y nivel jerárquico</div>
              </div>

              <div class="ficha-card ficha-grid--full ficha-card--gold">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🏢</div>
                  <span class="ficha-card-label">Dependencia Institucional</span>
                </div>
                <div class="ficha-card-val" style="font-size:1.1rem; color:var(--text-primary); font-weight:700;">
                  ${escHtml(h.dependencia || 'No registrada')}
                </div>
                <div class="ficha-card-sub">Área orgánica asignada en la Gobernación de Boyacá</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🏛️</div>
                  <span class="ficha-card-label">Secretaría</span>
                </div>
                <div class="ficha-card-val" style="font-weight:700;">
                  ${escHtml(h.secretaria || h.dependencia || 'Gobernación de Boyacá')}
                </div>
                <div class="ficha-card-sub">Sector administrativo</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📌</div>
                  <span class="ficha-card-label">Estado del Esquema</span>
                </div>
                <div class="ficha-card-val">
                  ${estadoBadge(h.estado)}
                </div>
                <div class="ficha-card-sub">Condición operativa en el sistema</div>
              </div>

              <div class="ficha-card ficha-grid--full">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📝</div>
                  <span class="ficha-card-label">Observaciones Administrativas</span>
                </div>
                <div class="ficha-card-val" style="font-weight:500; font-size:0.92rem; color:var(--text-secondary);">
                  ${escHtml(h.observaciones || 'Sin observaciones registradas a la fecha')}
                </div>
                <div class="ficha-card-sub">Notas de registro o trazabilidad interna</div>
              </div>
            </div>
          </div>
        </div>
      `;

      const actions = [
        { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
      ];
      if (Auth.canEdit()) {
        actions.push({
          text: 'Editar Servidor',
          cls: 'btn-gold',
          action: () => {
            App.closeModal();
            openEdit(h.id_horario);
          }
        });
      }

      App.openModal('Ficha Integral del Esquema de Horario', bodyHtml, actions, 'modal-ficha modal-lg');
      const box2 = document.querySelector('.modal-box');
      if (box2) {
        box2.classList.add('modal-ficha', 'modal-lg');
        box2.style.maxWidth = '900px';
        box2.style.width = '92vw';
      }
      const modalBody = document.getElementById('modal-body');
      if (modalBody) {
        modalBody.scrollTop = 0;
      }
    } catch (err) {
      App.showToast('Error cargando detalle: ' + err.message, 'error');
    }
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
  async function openCreate() {
    try {
      const res = await API.getNextHorarioConsecutivo();
      if (res && res.nextConsecutivo != null) {
        const apiNext = parseInt(res.nextConsecutivo, 10);
        if (!isNaN(apiNext) && apiNext > 0) {
          currentMinConsecutivo = apiNext;
        }
      }
    } catch (_) {}
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
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; background:var(--color-bg-secondary, rgba(255,255,255,0.04)); padding:8px 14px; border-radius:8px; border:1px solid var(--color-border); flex-wrap:wrap; gap:8px;">
              <span style="font-size:12px; color:var(--text-muted);">¿Necesitas la plantilla oficial para diligenciar?</span>
              <button type="button" class="btn btn-outline btn-sm" onclick="HorariosModule.downloadTemplate()" style="font-size:12px; padding:4px 10px; display:inline-flex; align-items:center; gap:5px; font-weight:600;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                Descargar Plantilla Oficial Excel
              </button>
            </div>

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
        // 1. Coincidencia exacta directa
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).normalize('NFC').trim();
          }
        }
        // 2. Coincidencia exacta normalizada (sin tildes, mayúsculas ni espacios)
        const rowKeys = Object.keys(row);
        for (const k of keys) {
          const cleanK = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
          if (!cleanK) continue;
          const foundKey = rowKeys.find(rk => {
            const cleanRK = rk.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            return cleanRK === cleanK;
          });
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
            return String(row[foundKey]).normalize('NFC').trim();
          }
        }
        // 3. Coincidencia por prefijo seguro (mínimo 4 caracteres para evitar colisiones)
        for (const k of keys) {
          const cleanK = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
          if (!cleanK || cleanK.length < 4) continue;
          const foundKey = rowKeys.find(rk => {
            const cleanRK = rk.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            return cleanRK.startsWith(cleanK);
          });
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
            return String(row[foundKey]).normalize('NFC').trim();
          }
        }
        return '';
      };

      const consecutivoRaw = getVal('NO', 'No.', 'No', 'N°', 'Consecutivo', 'Item', 'NUMERO', 'numero_consecutivo');
      const documento = getVal('NO DE CEDULA', 'No. De Cedula', 'Nro. De Identificación', 'De Identificación', 'Identificación', 'Documento', 'Cédula', 'Cedula', 'C.C.', 'CC', 'No. Identificación', 'documento', 'cedula');
      const nombresVal = getVal('NOMBRES', 'Nombre', 'nombres');
      const apellidosVal = getVal('APELLIDOS', 'Apellido', 'apellidos');
      let nombre = [apellidosVal, nombresVal].filter(Boolean).join(' ').trim();
      if (!nombre) {
        nombre = getVal('Nombres y Apellidos', 'Nombre y Apellidos', 'Servidor Público', 'Nombre Completo', 'Funcionario', 'apellidos_nombres');
      }
      const cargo = getVal('CARGO', 'Cargo', 'Cargo Actual', 'Denominación', 'Denominacion', 'cargo') || 'PROFESIONAL UNIVERSITARIO';
      const codigo = getVal('COD', 'Código', 'Codigo', 'codigo');
      const grado = getVal('GRA', 'Grado', 'grado');
      const dependencia = getVal('DEPENDENCIA', 'Dependencia', 'Área', 'Area', 'dependencia') || 'DESPACHO GOBERNADOR';
      const secretaria = getVal('SECRETARIA', 'Secretaría', 'Secretaria', 'secretaria') || dependencia;
      const situacion = getVal('SITUACION', 'Situación', 'Situacion', 'Situación Administrativa', 'Situacion Administrativa', 'Modalidad', 'modalidad') || 'Teletrabajo';
      const diasTeletrabajo = getVal('DIAS DE TELETRABAJO', 'Dias Teletrabajo', 'Días Teletrabajo', 'Dias teletrabajo', 'Días teletrabajo', 'Dias', 'Días', 'Horario', 'Jornada', 'dias_teletrabajo');
      const resolucion = getVal('RESOLUCION', 'Resolución', 'Resolucion', 'No. Resolución', 'No. Resolucion', 'numero_resolucion');
      const fechaRaw = getVal('FECHA', 'fecha', 'Fecha', 'Fecha Inicio', 'fecha_inicio');
      const telefono = getVal('TELEFONO', 'Teléfono', 'Telefono', 'tel.', 'celular');

      if (!documento || !nombre) {
        return { valid: false, error: 'Documento (No de cédula) y Nombre son obligatorios.' };
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
                <span class="excel-kpi-label">Total Filas Archivo</span>
                <span class="excel-kpi-value">${resumen.totalFilas || allCleanRows.length}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--inserted">
                <span class="excel-kpi-label">Servidores Únicos</span>
                <span class="excel-kpi-value">${resumen.servidoresUnicos || resumen.insertados || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--updated">
                <span class="excel-kpi-label">Actualizaciones</span>
                <span class="excel-kpi-value">${resumen.actualizados || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--provisional">
                <span class="excel-kpi-label">Teletrabajo</span>
                <span class="excel-kpi-value">${resumen.teletrabajo || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--updated">
                <span class="excel-kpi-label">Horario Flexible</span>
                <span class="excel-kpi-value">${resumen.horarioFlexible || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--vacant">
                <span class="excel-kpi-label">Trabajo en Casa / Otras</span>
                <span class="excel-kpi-value">${(resumen.trabajoEnCasa || 0) + (resumen.presencial || 0)}</span>
              </div>
            </div>

            <div style="margin-top: 14px; padding: 10px 14px; background: rgba(16,185,129,0.08); border-left: 4px solid var(--color-green-accent); border-radius: 6px; font-size: 12.5px; color: var(--color-text-primary); line-height: 1.5;">
              <strong style="color: var(--color-green-dark);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Control de no duplicidad activo:</strong> Cada servidor público conserva un único esquema vigente en el sistema. Las filas coincidentes entre hojas actualizaron la información del servidor (resolución, prórroga y vigencia) sin duplicar registros.
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

  /**
   * Estructura oficial de columnas para la Plantilla de Horarios y Modalidades:
   * 14 columnas exactas en mayúscula sostenida y orden oficial:
   * 1. NO, 2. NOMBRES, 3. APELLIDOS, 4. NO DE CEDULA, 5. CARGO, 6. COD, 7. GRA,
   * 8. DEPENDENCIA, 9. SECRETARIA, 10. SITUACION, 11. DIAS DE TELETRABAJO,
   * 12. RESOLUCION, 13. FECHA, 14. TELEFONO
   */
  const HORARIOS_EXCEL_COLUMNS = [
    { header: 'NO', key: 'numero_consecutivo', width: 8, sample: '1' },
    { header: 'NOMBRES', key: 'nombres', width: 24, sample: 'KAREN MILENA' },
    { header: 'APELLIDOS', key: 'apellidos', width: 24, sample: 'ABRIL LOPEZ' },
    { header: 'NO DE CEDULA', key: 'documento', width: 20, sample: '1057577168' },
    { header: 'CARGO', key: 'cargo', width: 28, sample: 'ASESOR' },
    { header: 'COD', key: 'codigo', width: 10, sample: '105' },
    { header: 'GRA', key: 'grado', width: 10, sample: '01' },
    { header: 'DEPENDENCIA', key: 'dependencia', width: 32, sample: 'DESPACHO DEL GOBERNADOR' },
    { header: 'SECRETARIA', key: 'secretaria', width: 28, sample: 'SECRETARÍA GENERAL' },
    { header: 'SITUACION', key: 'modalidad', width: 20, sample: 'Teletrabajo' },
    { header: 'DIAS DE TELETRABAJO', key: 'dias_teletrabajo', width: 28, sample: 'martes y jueves' },
    { header: 'RESOLUCION', key: 'numero_resolucion', width: 20, sample: '0045 de 2026' },
    { header: 'FECHA', key: 'fecha_inicio', width: 16, sample: '2026-02-01' },
    { header: 'TELEFONO', key: 'telefono', width: 18, sample: '3101234567' }
  ];

  function downloadTemplate() {
    if (typeof ExcelService !== 'undefined') {
      ExcelService.downloadTemplate({
        filename: 'PLANTILLA_OFICIAL_HORARIOS_Y_MODALIDADES',
        sheetName: 'Situación Administrativa',
        columns: HORARIOS_EXCEL_COLUMNS,
        sampleRows: []
      });
      App.showToast('Descargando plantilla oficial de Horarios y Modalidades en blanco...', 'info');
    } else {
      App.showToast('Servicio Excel no disponible.', 'warning');
    }
  }

  function toggleSortConsecutivo() {
    if (state.sort === 'consecutivo') {
      state.order = state.order === 'asc' ? 'desc' : 'asc';
    } else {
      state.sort = 'consecutivo';
      state.order = 'asc';
    }
    state.page = 1;
    updateSortIndicator();
    loadData();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Ordenado por consecutivo ${state.order === 'asc' ? 'ascendente (1 → 9)' : 'descendente (9 → 1)'}.`, 'info');
    }
  }

  function updateSortIndicator() {
    const el = document.getElementById('horarios-sort-indicator');
    if (!el) return;
    if (state.sort === 'consecutivo') {
      el.textContent = state.order === 'asc' ? '▲' : '▼';
      el.style.opacity = '1';
    } else {
      el.textContent = '⇅';
      el.style.opacity = '0.5';
    }
  }

  async function exportExcel() {
    if (typeof ExcelService === 'undefined') {
      App.showToast('Servicio Excel no disponible. Recargue la página.', 'warning');
      return;
    }

    try {
      // 1. Sincronizar filtros actuales desde el DOM o state.filters
      const searchEl = document.getElementById('horarios-search');
      const modEl = document.getElementById('filter-modalidad');
      const estEl = document.getElementById('filter-estado');

      const filterQ = searchEl ? searchEl.value.trim() : (state.filters.q || '');
      const filterMod = modEl ? modEl.value : (state.filters.modalidad || 'Todas');
      const filterEst = estEl ? estEl.value : (state.filters.estado || 'Todos');
      const filterDep = state.filters.dependencia || 'Todas';

      state.filters.q = filterQ;
      state.filters.modalidad = filterMod;
      state.filters.estado = filterEst;
      state.filters.dependencia = filterDep;

      const hasActiveFilters = Boolean(
        filterQ ||
        (filterMod && filterMod !== 'Todas') ||
        (filterEst && filterEst !== 'Todos') ||
        (filterDep && filterDep !== 'Todas')
      );

      App.showToast(
        hasActiveFilters
          ? 'Consultando registros filtrados para exportar a Excel...'
          : 'Consultando la totalidad de esquemas de horarios para exportar a Excel...',
        'info'
      );

      // 2. Consultar registros con límite alto para abarcar todos los coincidentes
      const res = await API.getHorarios({
        page: 1,
        limit: 100000,
        q: filterQ,
        modalidad: filterMod,
        estado: filterEst,
        dependencia: filterDep,
        sort: state.sort || 'consecutivo',
        order: state.order || 'asc',
      });

      const records = (res && res.data && Array.isArray(res.data) && res.data.length)
        ? res.data
        : (Array.isArray(state.data) && state.data.length ? state.data : []);

      if (!records || !records.length) {
        App.showToast('No hay registros de horarios disponibles para exportar con los filtros seleccionados.', 'warning');
        return;
      }

      // 3. Mapear datos a la estructura oficial requerida
      const exportData = records.map((item, idx) => {
        let nombres = item.persona_nombres || item.nombres || '';
        let apellidos = '';

        if (item.primer_apellido || item.segundo_apellido) {
          apellidos = [item.primer_apellido, item.segundo_apellido].filter(Boolean).join(' ').trim();
        } else if (item.apellidos) {
          apellidos = String(item.apellidos).trim();
        }

        if (!apellidos && !nombres && item.apellidos_nombres) {
          const parts = item.apellidos_nombres.trim().split(/\s+/);
          if (parts.length >= 3) {
            apellidos = parts.slice(0, 2).join(' ');
            nombres = parts.slice(2).join(' ');
          } else if (parts.length === 2) {
            apellidos = parts[0];
            nombres = parts[1];
          } else {
            apellidos = parts[0] || '';
            nombres = '';
          }
        }

        const numConsec = (item.numero_consecutivo != null && item.numero_consecutivo !== '')
          ? item.numero_consecutivo
          : (idx + 1);

        let fechaFormatted = '';
        if (item.fecha_inicio) {
          try {
            if (item.fecha_inicio instanceof Date) {
              fechaFormatted = item.fecha_inicio.toISOString().split('T')[0];
            } else {
              const rawDate = String(item.fecha_inicio).split('T')[0];
              const p = rawDate.split('-');
              fechaFormatted = p.length === 3 ? `${p[0]}-${p[1]}-${p[2]}` : rawDate;
            }
          } catch {
            fechaFormatted = String(item.fecha_inicio || '');
          }
        }

        const tel = item.telefono || item.celular || item.telefono_fijo || '';
        const cargoStr = item.cargo || '';
        const codigoStr = item.codigo || '';
        const gradoStr = item.grado || '';
        const depStr = item.dependencia || '';
        const secStr = item.secretaria || depStr || '';
        const modStr = item.modalidad || '';
        const diasStr = item.dias_teletrabajo || item.franja_ingreso || '';
        const resolStr = item.numero_resolucion || '';

        return {
          // Llaves correspondientes a HORARIOS_EXCEL_COLUMNS.key
          numero_consecutivo: numConsec,
          nombres: nombres || item.apellidos_nombres || '',
          apellidos: apellidos || '',
          documento: item.documento || '',
          cargo: cargoStr,
          codigo: codigoStr,
          grado: gradoStr,
          dependencia: depStr,
          secretaria: secStr,
          modalidad: modStr,
          dias_teletrabajo: diasStr,
          numero_resolucion: resolStr,
          fecha_inicio: fechaFormatted,
          telefono: tel,

          // Llaves directas por encabezado oficial para compatibilidad total
          'NO': numConsec,
          'NOMBRES': nombres || item.apellidos_nombres || '',
          'APELLIDOS': apellidos || '',
          'NO DE CEDULA': item.documento || '',
          'CARGO': cargoStr,
          'COD': codigoStr,
          'GRA': gradoStr,
          'DEPENDENCIA': depStr,
          'SECRETARIA': secStr,
          'SITUACION': modStr,
          'DIAS DE TELETRABAJO': diasStr,
          'RESOLUCION': resolStr,
          'FECHA': fechaFormatted,
          'TELEFONO': tel
        };
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = hasActiveFilters
        ? `Talento360_Horarios_Filtrados_${dateStr}`
        : `Talento360_Horarios_Oficial_${dateStr}`;

      ExcelService.exportToExcel({
        filename: filename,
        sheetName: 'Situación Administrativa',
        columns: HORARIOS_EXCEL_COLUMNS,
        data: exportData
      });

      const descFiltro = hasActiveFilters
        ? `con los filtros seleccionados`
        : `(totalidad del sistema)`;
      App.showToast(`Se exportaron exitosamente ${exportData.length} registros a Excel ${descFiltro}.`, 'success');
    } catch (err) {
      console.error('[HorariosModule] exportExcel error:', err);
      App.showToast('Error al exportar registros: ' + err.message, 'error');
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
    downloadTemplate,
    toggleSortConsecutivo,
    openImportModal,
    viewSoporte,
    openUploadSoporteModal,
    toggleActionsDropdown,
    closeActionsDropdown,
    handleDropdownKeydown,
    switchFichaTab,
    copyFichaText,
  };
})();
