/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Talento 360 — Módulo de Monitoreo de Errores y Registro de Incidentes
 * Gobernación de Boyacá · Panel de Control Exclusivo para Administrador
 * ═══════════════════════════════════════════════════════════════════════════
 */

const AdminErrorsModule = (() => {
  let currentErrors = [];
  let currentSummary = {};
  let currentPagination = { page: 1, limit: 15, total: 0, totalPages: 1 };
  let currentFilterTipo = 'TODOS';
  let currentFilterEstado = 'TODOS';
  let currentSearch = '';
  let isLoading = false;
  let autoRefreshTimer = null;

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(dStr) {
    if (!dStr) return 'N/A';
    try {
      const d = new Date(dStr);
      return d.toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (_) {
      return dStr;
    }
  }

  async function loadData(page = 1) {
    isLoading = true;
    currentPagination.page = page;

    try {
      const params = {
        page: currentPagination.page,
        limit: currentPagination.limit,
        tipo: currentFilterTipo,
        estado: currentFilterEstado,
        search: currentSearch
      };

      const res = await API.getAdminErrors(params);
      currentErrors = res.errors || [];
      currentPagination = res.pagination || currentPagination;
      currentSummary = res.summary || currentSummary;
    } catch (err) {
      console.error('[AdminErrorsModule] Error al cargar incidencias:', err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('No se pudieron consultar los errores del sistema.', 'error');
      }
    } finally {
      isLoading = false;
      renderTable();
      renderStats();
    }
  }

  function renderStats() {
    const s = currentSummary || {};
    const totalEl = document.getElementById('stat-admin-err-total');
    const p404El = document.getElementById('stat-admin-err-404');
    const jsEl = document.getElementById('stat-admin-err-js');
    const userEl = document.getElementById('stat-admin-err-user');

    if (totalEl) totalEl.textContent = (s.total || 0).toLocaleString('es-CO');
    if (p404El) p404El.textContent = (s.errores404 || 0).toLocaleString('es-CO');
    if (jsEl) jsEl.textContent = ((s.erroresConsola || 0) + (s.erroresApi || 0)).toLocaleString('es-CO');
    if (userEl) userEl.textContent = (s.reportadosUsuario || 0).toLocaleString('es-CO');

    const pendBadge = document.getElementById('stat-admin-err-pend-badge');
    if (pendBadge) {
      pendBadge.textContent = `${s.pendientes || 0} pendientes`;
    }
  }

  function getTipoBadge(tipo) {
    const t = String(tipo || '').toUpperCase();
    if (t === 'PAGE_404') {
      return `<span class="admin-badge badge-warning" title="Página o ruta 404 no encontrada"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Error 404</span>`;
    }
    if (t === 'CONSOLE_ERROR') {
      return `<span class="admin-badge badge-danger" title="Error de JavaScript en el navegador"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Consola JS</span>`;
    }
    if (t === 'API_ERROR') {
      return `<span class="admin-badge badge-secondary" title="Fallo en llamada a microservicio o red"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>API / Servidor</span>`;
    }
    return `<span class="admin-badge badge-info" title="Promesa rechazada o evento no controlado">${escHtml(t)}</span>`;
  }

  function getEstadoBadge(estado) {
    const e = String(estado || 'Pendiente');
    if (e === 'Resuelto') {
      return `<span class="admin-badge badge-success"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>Resuelto</span>`;
    }
    if (e === 'Revisado') {
      return `<span class="admin-badge badge-info"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>En Revisión</span>`;
    }
    return `<span class="admin-badge badge-pending"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Pendiente</span>`;
  }

  function renderTable() {
    const tbody = document.getElementById('admin-errors-tbody');
    const emptyBox = document.getElementById('admin-errors-empty');
    const countInfo = document.getElementById('admin-errors-count-info');
    const paginationControls = document.getElementById('admin-errors-pagination');

    if (!tbody) return;

    if (currentErrors.length === 0) {
      tbody.innerHTML = '';
      if (emptyBox) emptyBox.style.display = 'block';
      if (countInfo) countInfo.textContent = 'Mostrando 0 incidencias';
      if (paginationControls) paginationControls.style.display = 'none';
      return;
    }

    if (emptyBox) emptyBox.style.display = 'none';
    if (paginationControls) paginationControls.style.display = 'flex';

    if (countInfo) {
      const from = (currentPagination.page - 1) * currentPagination.limit + 1;
      const to = Math.min(currentPagination.page * currentPagination.limit, currentPagination.total);
      countInfo.textContent = `Mostrando ${from}–${to} de ${currentPagination.total} incidencias registradas`;
    }

    tbody.innerHTML = currentErrors.map(item => `
      <tr class="admin-error-row ${item.estado === 'Resuelto' ? 'row-resolved' : ''}" data-id="${item.id}">
        <td style="text-align: center;">
          ${getEstadoBadge(item.estado)}
        </td>
        <td style="text-align: center;">
          ${getTipoBadge(item.tipo)}
          ${item.reportado_por_usuario ? '<div style="margin-top:4px;"><span class="admin-badge badge-user-report" title="Reportado manualmente por el usuario mediante botón">🙋 Por Usuario</span></div>' : ''}
        </td>
        <td class="col-error-msg">
          <div class="error-msg-main" title="${escHtml(item.mensaje)}">${escHtml(item.mensaje)}</div>
          ${item.stack ? `<div class="error-has-stack-hint"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Traza de pila disponible</div>` : ''}
        </td>
        <td class="col-error-url" title="${escHtml(item.url || 'No especificada')}">
          <code class="admin-url-code">${escHtml(truncateUrl(item.url || 'N/A', 45))}</code>
        </td>
        <td style="text-align: center;">
          <span class="admin-user-pill" title="Usuario que experimentó la incidencia">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${escHtml(item.usuario || 'Anónimo')}
          </span>
        </td>
        <td style="text-align: center; font-size: 0.82rem; color: var(--text-secondary); white-space: nowrap;">
          ${formatDate(item.creado_en)}
        </td>
        <td class="col-actions" style="text-align: center;">
          <div class="admin-table-actions">
            <button class="btn-action-icon btn-view-error" title="Ver detalles y traza completa" onclick="AdminErrorsModule.openDetailModal(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            ${item.estado !== 'Resuelto' ? `
              <button class="btn-action-icon btn-resolve-error" title="Marcar como resuelto" onclick="AdminErrorsModule.toggleResolve(${item.id}, 'Resuelto')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            ` : `
              <button class="btn-action-icon btn-reopen-error" title="Reabrir incidencia" onclick="AdminErrorsModule.toggleResolve(${item.id}, 'Pendiente')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
              </button>
            `}
            <button class="btn-action-icon btn-delete-error" title="Eliminar registro" onclick="AdminErrorsModule.deleteError(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPaginationButtons();
  }

  function truncateUrl(url, max = 50) {
    if (!url) return '';
    if (url.length <= max) return url;
    try {
      const u = new URL(url);
      const short = u.pathname + u.search + u.hash;
      return short.length > max ? short.slice(0, max) + '…' : short;
    } catch (_) {
      return url.slice(0, max) + '…';
    }
  }

  function renderPaginationButtons() {
    const pageEl = document.getElementById('admin-errors-page-indicator');
    const prevBtn = document.getElementById('admin-errors-btn-prev');
    const nextBtn = document.getElementById('admin-errors-btn-next');

    if (pageEl) {
      pageEl.textContent = `Página ${currentPagination.page} de ${Math.max(1, currentPagination.totalPages)}`;
    }
    if (prevBtn) {
      prevBtn.disabled = currentPagination.page <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = currentPagination.page >= currentPagination.totalPages;
    }
  }

  function openDetailModal(errorId) {
    const item = currentErrors.find(e => e.id === errorId);
    if (!item) return;

    const modalBody = `
      <div class="admin-error-modal-detail">
        <div class="admin-detail-header-badges">
          ${getEstadoBadge(item.estado)}
          ${getTipoBadge(item.tipo)}
          ${item.reportado_por_usuario ? '<span class="admin-badge badge-user-report">🙋 Reporte Voluntario de Usuario</span>' : '<span class="admin-badge badge-auto">🤖 Detección Automática de Sistema</span>'}
        </div>

        <div class="admin-detail-group">
          <label class="admin-detail-label">Mensaje de Error / Excepción:</label>
          <div class="admin-detail-box-message">${escHtml(item.mensaje)}</div>
        </div>

        <div class="admin-detail-grid">
          <div>
            <label class="admin-detail-label">Ruta / URL afectada:</label>
            <div class="admin-detail-box-meta"><code style="word-break: break-all;">${escHtml(item.url || 'No especificada')}</code></div>
          </div>
          <div>
            <label class="admin-detail-label">Usuario en sesión:</label>
            <div class="admin-detail-box-meta">${escHtml(item.usuario || 'Anónimo / Sin autenticar')}</div>
          </div>
          <div>
            <label class="admin-detail-label">Fecha y Hora:</label>
            <div class="admin-detail-box-meta">${formatDate(item.creado_en)}</div>
          </div>
          <div>
            <label class="admin-detail-label">Dirección IP y Origen:</label>
            <div class="admin-detail-box-meta">${escHtml(item.ip_address || '127.0.0.1')}</div>
          </div>
        </div>

        ${item.stack ? `
          <div class="admin-detail-group" style="margin-top:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label class="admin-detail-label" style="margin:0;">Traza de Pila (Stack Trace):</label>
              <button type="button" class="btn-copy-stack" onclick="AdminErrorsModule.copyStackToClipboard('${item.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copiar Traza
              </button>
            </div>
            <pre class="admin-stack-trace" id="stack-content-${item.id}">${escHtml(item.stack)}</pre>
          </div>
        ` : ''}

        ${item.user_agent ? `
          <div class="admin-detail-group" style="margin-top:12px;">
            <label class="admin-detail-label">Navegador y Sistema (User Agent):</label>
            <div class="admin-detail-box-ua">${escHtml(item.user_agent)}</div>
          </div>
        ` : ''}

        ${item.resuelto_en ? `
          <div class="admin-detail-resolved-note" style="margin-top:14px; padding:10px 14px; background:rgba(53,88,51,0.08); border-left:3px solid #355833; border-radius:6px; font-size:0.83rem;">
            ✅ <strong>Resuelto por:</strong> ${escHtml(item.resuelto_por || 'admin')} el ${formatDate(item.resuelto_en)}
          </div>
        ` : ''}
      </div>
    `;

    const actions = [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }
    ];

    if (item.estado !== 'Resuelto') {
      actions.push({
        text: 'Marcar como Resuelto',
        cls: 'btn-primary-cta',
        action: async () => {
          App.closeModal();
          await toggleResolve(item.id, 'Resuelto');
        }
      });
    }

    App.openModal(`Detalle del Incidente #${item.id}`, modalBody, actions);
  }

  function copyStackToClipboard(id) {
    const el = document.getElementById(`stack-content-${id}`);
    if (el && navigator.clipboard) {
      navigator.clipboard.writeText(el.innerText).then(() => {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Traza copiada al portapapeles', 'info');
        }
      });
    }
  }

  async function toggleResolve(id, nuevoEstado) {
    try {
      await API.updateAdminErrorStatus(id, nuevoEstado);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Incidencia marcada como ${nuevoEstado.toLowerCase()}.`, 'success');
      }
      await loadData(currentPagination.page);
    } catch (err) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('No se pudo actualizar el estado.', 'error');
      }
    }
  }

  async function deleteError(id) {
    App.openModal(
      'Confirmar Eliminación',
      '<p style="margin:0; font-size:0.95rem; color:var(--text-secondary);">¿Estás seguro de que deseas eliminar este registro de error? Esta acción no se puede deshacer.</p>',
      [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          text: 'Eliminar Registro',
          cls: 'btn-danger-confirm',
          action: async () => {
            App.closeModal();
            try {
              await API.deleteAdminError(id);
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Registro de error eliminado.', 'success');
              }
              await loadData(currentPagination.page);
            } catch (_) {
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Error al eliminar.', 'error');
              }
            }
          }
        }
      ]
    );
  }

  async function clearAllErrors(onlyResolved = false) {
    const title = onlyResolved ? 'Depurar Errores Resueltos' : 'Limpiar Todo el Historial de Errores';
    const msg = onlyResolved
      ? '¿Deseas eliminar permanentemente todas las incidencias marcadas como resueltas?'
      : '¿Deseas vaciar completamente el registro de errores e incidentes del sistema?';

    App.openModal(
      title,
      `<p style="margin:0; font-size:0.95rem; color:var(--text-secondary);">${msg}</p>`,
      [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          text: onlyResolved ? 'Depurar Resueltos' : 'Vaciar Todo',
          cls: 'btn-danger-confirm',
          action: async () => {
            App.closeModal();
            try {
              await API.clearAllAdminErrors(onlyResolved);
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(onlyResolved ? 'Incidentes resueltos eliminados.' : 'Historial de errores depurado.', 'success');
              }
              await loadData(1);
            } catch (_) {
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Error al depurar.', 'error');
              }
            }
          }
        }
      ]
    );
  }

  async function render(container) {
    if (!container) return;

    container.innerHTML = `
      <div class="admin-panel-container">
        
        <!-- Cabecera del Módulo -->
        <div class="page-header">
          <div class="page-header-info">
            <h1 class="page-title">Centro de Monitoreo de Errores e Incidentes</h1>
            <p class="page-subtitle">Supervisión en tiempo real de fallos técnicos, excepciones de JavaScript, errores de microservicios y páginas 404 reportadas en Talento 360.</p>
          </div>
          <div class="page-actions">
            <button id="btn-admin-err-refresh" class="btn-secondary" title="Actualizar lista de incidencias">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:6px;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              <span>Actualizar</span>
            </button>
            <button id="btn-admin-err-clear-resolved" class="btn-secondary" title="Eliminar únicamente las incidencias resueltas">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:6px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Depurar Resueltos</span>
            </button>
            <button id="btn-admin-err-clear-all" class="btn-secondary" style="color:var(--color-danger, #c42b1c);" title="Vaciar todo el registro">
              <span>Limpiar Todo</span>
            </button>
          </div>
        </div>

        <!-- 4 Tarjetas Métricas KPI -->
        <div class="admin-kpi-grid">
          <div class="admin-kpi-card">
            <div class="kpi-icon-wrap icon-total">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value" id="stat-admin-err-total">0</div>
              <div class="kpi-label">Total Incidencias Registradas</div>
              <div class="kpi-sub" id="stat-admin-err-pend-badge">0 pendientes</div>
            </div>
          </div>

          <div class="admin-kpi-card">
            <div class="kpi-icon-wrap icon-404">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value" id="stat-admin-err-404">0</div>
              <div class="kpi-label">Páginas 404 Detectadas</div>
              <div class="kpi-sub">Enlaces rotos o rutas no encontradas</div>
            </div>
          </div>

          <div class="admin-kpi-card">
            <div class="kpi-icon-wrap icon-js">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value" id="stat-admin-err-js">0</div>
              <div class="kpi-label">Excepciones de Consola y API</div>
              <div class="kpi-sub">Fallos de JavaScript y microservicios</div>
            </div>
          </div>

          <div class="admin-kpi-card">
            <div class="kpi-icon-wrap icon-user">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value" id="stat-admin-err-user">0</div>
              <div class="kpi-label">Reportes de Usuarios</div>
              <div class="kpi-sub">Enviados mediante botón de reporte</div>
            </div>
          </div>
        </div>

        <!-- Filtros y Búsqueda -->
        <div class="admin-filter-bar">
          <div class="filter-group">
            <label for="admin-filter-tipo">Tipo de Fallo:</label>
            <select id="admin-filter-tipo" class="admin-select">
              <option value="TODOS">Todos los Tipos</option>
              <option value="PAGE_404">Páginas 404 No Encontradas</option>
              <option value="CONSOLE_ERROR">Errores de Consola / JavaScript</option>
              <option value="API_ERROR">Errores de API / Backend</option>
              <option value="UNHANDLED_REJECTION">Promesas No Controladas</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="admin-filter-estado">Estado:</label>
            <select id="admin-filter-estado" class="admin-select">
              <option value="TODOS">Todos los Estados</option>
              <option value="Pendiente" selected>Solo Pendientes</option>
              <option value="Resuelto">Resueltos</option>
              <option value="Revisado">En Revisión</option>
            </select>
          </div>

          <div class="filter-search-group">
            <label for="admin-filter-search">Buscar Incidencia:</label>
            <div class="search-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="admin-filter-search" class="admin-search-input" placeholder="Buscar por mensaje, URL o usuario..." />
            </div>
          </div>
        </div>

        <!-- Tabla de Resultados -->
        <div class="admin-card-table-wrap">
          <div class="table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th style="width: 120px; text-align: center;">Estado</th>
                  <th style="width: 140px; text-align: center;">Tipo</th>
                  <th>Detalle del Incidente</th>
                  <th style="width: 220px;">Ruta / URL Afectada</th>
                  <th style="width: 130px; text-align: center;">Usuario</th>
                  <th style="width: 160px; text-align: center;">Fecha y Hora</th>
                  <th style="width: 120px; text-align: center;">Acciones</th>
                </tr>
              </thead>
              <tbody id="admin-errors-tbody">
                <!-- Se llena dinámicamente -->
              </tbody>
            </table>
          </div>

          <!-- Empty State si no hay errores -->
          <div id="admin-errors-empty" class="admin-empty-state" style="display:none;">
            <div class="empty-icon-shield">
              <svg viewBox="0 0 24 24" fill="none" stroke="#355833" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </div>
            <h3 class="empty-title">Plataforma Operando con Normalidad</h3>
            <p class="empty-desc">No se registran errores técnicos ni incidencias 404 pendientes con los filtros seleccionados.</p>
          </div>

          <!-- Paginación y Contador -->
          <div class="admin-table-footer">
            <div id="admin-errors-count-info" class="count-info">Cargando incidencias...</div>
            <div id="admin-errors-pagination" class="pagination-buttons">
              <button id="admin-errors-btn-prev" class="btn-page">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                <span>Anterior</span>
              </button>
              <span id="admin-errors-page-indicator" class="page-indicator">Página 1 de 1</span>
              <button id="admin-errors-btn-next" class="btn-page">
                <span>Siguiente</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    `;

    bindDOMEvents();
    await loadData(1);

    // Auto-refrescar suavemente cada 30 segundos mientras la vista esté activa
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
      if (document.getElementById('admin-errors-tbody')) {
        loadData(currentPagination.page);
      } else {
        clearInterval(autoRefreshTimer);
      }
    }, 30 * 1000);
  }

  function bindDOMEvents() {
    const btnRefresh = document.getElementById('btn-admin-err-refresh');
    if (btnRefresh) btnRefresh.onclick = () => loadData(currentPagination.page);

    const btnClearResolved = document.getElementById('btn-admin-err-clear-resolved');
    if (btnClearResolved) btnClearResolved.onclick = () => clearAllErrors(true);

    const btnClearAll = document.getElementById('btn-admin-err-clear-all');
    if (btnClearAll) btnClearAll.onclick = () => clearAllErrors(false);

    const selectTipo = document.getElementById('admin-filter-tipo');
    if (selectTipo) {
      selectTipo.onchange = (e) => {
        currentFilterTipo = e.target.value;
        loadData(1);
      };
    }

    const selectEstado = document.getElementById('admin-filter-estado');
    if (selectEstado) {
      selectEstado.onchange = (e) => {
        currentFilterEstado = e.target.value;
        loadData(1);
      };
    }

    const inputSearch = document.getElementById('admin-filter-search');
    let searchDebounce = null;
    if (inputSearch) {
      inputSearch.oninput = (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          currentSearch = e.target.value;
          loadData(1);
        }, 300);
      };
    }

    const btnPrev = document.getElementById('admin-errors-btn-prev');
    if (btnPrev) {
      btnPrev.onclick = () => {
        if (currentPagination.page > 1) loadData(currentPagination.page - 1);
      };
    }

    const btnNext = document.getElementById('admin-errors-btn-next');
    if (btnNext) {
      btnNext.onclick = () => {
        if (currentPagination.page < currentPagination.totalPages) loadData(currentPagination.page + 1);
      };
    }
  }

  return {
    render,
    openDetailModal,
    copyStackToClipboard,
    toggleResolve,
    deleteError,
    clearAllErrors,
    refresh: () => loadData(currentPagination.page)
  };
})();

if (typeof window !== 'undefined') {
  window.AdminErrorsModule = AdminErrorsModule;
}
