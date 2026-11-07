/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Talento 360 — Módulo de Monitoreo de Errores y Registro de Incidentes
 * Gobernación de Boyacá · Panel de Control Exclusivo para Administrador
 * Diseño Institucional Estandarizado acorde al Sistema de Gestión
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

  function formatDateTwoLines(dStr) {
    if (!dStr) return '<span class="text-muted">N/A</span>';
    try {
      const d = new Date(dStr);
      const day = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      return `
        <div class="admin-date-wrap">
          <span class="admin-date-day">${escHtml(day)}</span>
          <span class="admin-date-time">${escHtml(time)}</span>
        </div>
      `;
    } catch (_) {
      return escHtml(dStr);
    }
  }

  function cleanDisplayUrl(url) {
    if (!url) return 'N/A';
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const u = new URL(url);
        return (u.pathname + u.search + u.hash) || '/';
      }
      return url;
    } catch (_) {
      return url;
    }
  }

  function renderUserCell(usuario) {
    const raw = (usuario || 'Anónimo').trim();
    const cleanUser = raw.split('@')[0];
    const isAnon = cleanUser.toLowerCase() === 'anónimo' || cleanUser.toLowerCase() === 'anonimo';

    let initials = '?';
    let bg = 'rgba(100, 116, 139, 0.12)';
    let color = '#64748b';

    if (!isAnon) {
      const tokens = cleanUser.split(/[\._\-]/).filter(Boolean);
      if (tokens.length >= 2) {
        initials = (tokens[0][0] + tokens[1][0]).toUpperCase();
      } else if (tokens.length === 1) {
        initials = tokens[0].slice(0, 2).toUpperCase();
      }
      const hash = cleanUser.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const palettes = [
        { bg: 'rgba(2, 132, 199, 0.14)', color: '#0284c7' }, // azul
        { bg: 'rgba(21, 128, 61, 0.14)', color: '#15803d' }, // verde boyacá
        { bg: 'rgba(217, 119, 6, 0.14)', color: '#b45309' }, // ámbar
        { bg: 'rgba(147, 51, 234, 0.14)', color: '#7e22ce' }, // púrpura
        { bg: 'rgba(13, 148, 136, 0.14)', color: '#0f766e' }  // teal
      ];
      const pal = palettes[hash % palettes.length];
      bg = pal.bg;
      color = pal.color;
    }

    return `
      <div class="admin-user-cell" title="Usuario: ${escHtml(raw)}">
        <span class="admin-user-avatar" style="background:${bg}; color:${color};" aria-hidden="true">${escHtml(initials)}</span>
        <span class="admin-user-name">${escHtml(cleanUser)}</span>
      </div>
    `;
  }

  function parseErrorDetail(mensaje, stack, id) {
    const msg = mensaje || 'Sin mensaje de error disponible';
    let errorType = null;
    let cleanMsg = msg;

    const colonIdx = msg.indexOf(':');
    if (colonIdx > 0 && colonIdx < 35) {
      const prefix = msg.slice(0, colonIdx).trim();
      if (/^[A-Za-z0-9_]+Error$|^Error\s*\d*$/.test(prefix)) {
        errorType = prefix;
        cleanMsg = msg.slice(colonIdx + 1).trim();
      }
    }

    return `
      <div class="admin-error-detail-wrap" style="max-width:320px;">
        <div class="admin-error-title-row" style="display:flex; align-items:center; gap:8px;">
          ${errorType ? `<span class="admin-token-pill" style="font-size:0.72rem; font-weight:800; padding:2px 7px; border-radius:6px; background:rgba(220,38,38,0.1); color:#b91c1c; border:1px solid rgba(220,38,38,0.2);">${escHtml(errorType)}</span>` : ''}
          <span class="admin-msg-text" style="font-size:0.83rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px; display:inline-block;" title="${escHtml(msg)}">${escHtml(cleanMsg)}</span>
        </div>
        ${stack ? `
          <div class="admin-stack-hint-row" style="margin-top:2px;">
            <button type="button" class="badge-stack-pill" onclick="AdminErrorsModule.openDetailModal(${id})" title="Ver la traza completa de llamadas">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <span>Ver Traza Completa</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
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
    const resEl = document.getElementById('stat-admin-err-resolved');
    const rateEl = document.getElementById('stat-admin-err-rate');

    if (totalEl) totalEl.textContent = (s.total || 0).toLocaleString('es-CO');
    if (p404El) p404El.textContent = (s.errores404 || 0).toLocaleString('es-CO');
    if (jsEl) jsEl.textContent = ((s.erroresConsola || 0) + (s.erroresApi || 0)).toLocaleString('es-CO');
    if (userEl) userEl.textContent = (s.reportadosUsuario || 0).toLocaleString('es-CO');
    if (resEl) resEl.textContent = (s.resueltos || 0).toLocaleString('es-CO');

    if (rateEl && s.total > 0) {
      const pct = Math.round(((s.resueltos || 0) / s.total) * 100);
      rateEl.textContent = `${pct}% solucionadas con éxito`;
    }

    const pendBadge = document.getElementById('stat-admin-err-pend-badge');
    if (pendBadge) {
      const pend = s.pendientes || 0;
      pendBadge.textContent = `${pend} pendiente${pend === 1 ? '' : 's'}`;
    }

    const countBadge = document.getElementById('admin-errors-count-badge');
    if (countBadge) {
      countBadge.textContent = `${(s.total || 0).toLocaleString('es-CO')} incidencias`;
    }
  }

  function getTipoBadge(tipo, reportadoPorUsuario = false) {
    const t = String(tipo || '').toUpperCase();
    let badgeHtml = '';

    if (t === 'PAGE_404' || t === 'NOT_FOUND_404') {
      badgeHtml = `<span class="badge badge-warning" style="font-size:0.80rem; font-weight:700; padding:5px 11px; border-radius:9999px; display:inline-flex; align-items:center; gap:5px;" title="Página o ruta 404 no encontrada"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><line x1="12" y1="7.5" x2="12" y2="12.5"/><circle cx="12" cy="16.5" r="0.8" fill="currentColor"/></svg>Error 404</span>`;
    } else if (t === 'CONSOLE_ERROR') {
      badgeHtml = `<span class="badge badge-danger" style="font-size:0.80rem; font-weight:700; padding:5px 11px; border-radius:9999px; display:inline-flex; align-items:center; gap:5px;" title="Error de JavaScript en el navegador"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Consola JS</span>`;
    } else if (t === 'API_ERROR') {
      badgeHtml = `<span class="badge badge-secondary" style="font-size:0.80rem; font-weight:700; padding:5px 11px; border-radius:9999px; display:inline-flex; align-items:center; gap:5px;" title="Fallo en microservicio o red"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>API / Red</span>`;
    } else {
      badgeHtml = `<span class="badge badge-info" style="font-size:0.80rem; font-weight:700; padding:5px 11px; border-radius:9999px;" title="Excepción del sistema">${escHtml(t)}</span>`;
    }

    if (reportadoPorUsuario) {
      return `
        <div class="admin-type-badge-wrap" style="display:flex; flex-direction:column; align-items:center; gap:4px;">
          ${badgeHtml}
          <span class="badge badge-user-report-inline" style="font-size:0.71rem;" title="Reportado manualmente por el usuario mediante botón">🙋 Por Usuario</span>
        </div>
      `;
    }

    return `<div class="admin-type-badge-wrap" style="display:flex; justify-content:center;">${badgeHtml}</div>`;
  }

  function renderEstadoSelect(item) {
    const est = item.estado || 'Pendiente';
    let cls = 'status-pendiente';
    if (est === 'Resuelto') cls = 'status-resuelto';
    else if (est === 'En Revisión' || est === 'Revisado') cls = 'status-revision';

    return `
      <div class="admin-status-dropdown-wrap">
        <select 
          class="admin-status-select ${cls}" 
          onchange="AdminErrorsModule.updateStatus(${item.id}, this.value)"
          title="Haz clic para cambiar el estado de la incidencia">
          <option value="Pendiente" ${est === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
          <option value="En Revisión" ${(est === 'En Revisión' || est === 'Revisado') ? 'selected' : ''}>🔍 En Revisión</option>
          <option value="Resuelto" ${est === 'Resuelto' ? 'selected' : ''}>✅ Resuelto</option>
        </select>
      </div>
    `;
  }

  async function updateStatus(id, nuevoEstado) {
    try {
      const item = currentErrors.find(e => e.id === id);
      if (item) item.estado = nuevoEstado;
      renderTable();
      renderStats();

      await API.updateAdminErrorStatus(id, nuevoEstado);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Estado actualizado a "${nuevoEstado}".`, 'success');
      }
      await loadData(currentPagination.page);
    } catch (err) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('No se pudo actualizar el estado.', 'error');
      }
      await loadData(currentPagination.page);
    }
  }

  function renderTable() {
    const tbody = document.getElementById('admin-errors-tbody');
    const emptyBox = document.getElementById('admin-errors-empty');
    const countInfo = document.getElementById('admin-errors-count-info');
    const paginationControls = document.getElementById('admin-errors-pagination-bar');

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
          ${renderEstadoSelect(item)}
        </td>
        <td style="text-align: center;">
          ${getTipoBadge(item.tipo, item.reportado_por_usuario)}
        </td>
        <td class="col-error-msg">
          ${parseErrorDetail(item.mensaje, item.stack, item.id)}
        </td>
        <td class="col-error-url">
          <div class="admin-url-box" title="${escHtml(item.url || 'No especificada')}">
            <svg class="admin-url-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span class="admin-url-text">${escHtml(cleanDisplayUrl(item.url))}</span>
          </div>
        </td>
        <td class="td-user-col">
          ${renderUserCell(item.usuario)}
        </td>
        <td style="text-align: center;">
          ${formatDateTwoLines(item.creado_en)}
        </td>
        <td class="td-actions" style="text-align: center;">
          <div class="td-actions-wrap" style="justify-content: center; gap: 8px;">
            <button class="btn-action-view" title="Ver detalles y traza completa" aria-label="Ver detalles del error ${item.id}" onclick="AdminErrorsModule.openDetailModal(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-action-delete" title="Eliminar registro" aria-label="Eliminar registro de error ${item.id}" onclick="AdminErrorsModule.confirmDelete(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPaginationButtons();
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
          <div class="admin-detail-badges-group">
            ${renderEstadoSelect(item)}
            ${getTipoBadge(item.tipo, item.reportado_por_usuario)}
          </div>
          <span style="font-size:0.80rem; font-weight:800; color:var(--text-secondary); letter-spacing:0.04em; text-transform:uppercase;">
            Incidencia Técnica #${item.id}
          </span>
        </div>

        <div class="admin-detail-msg-card">
          <div class="admin-detail-msg-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>Mensaje del Fallo Técnico</span>
          </div>
          <div class="admin-detail-msg-content">${escHtml(item.mensaje)}</div>
        </div>

        <div class="admin-detail-grid">
          <div class="admin-detail-metric-card">
            <div class="admin-detail-metric-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </div>
            <div class="admin-detail-metric-info">
              <span class="admin-detail-metric-label">Ruta / URL Completa</span>
              <span class="admin-detail-metric-val">${escHtml(item.url || 'No especificada')}</span>
            </div>
          </div>

          <div class="admin-detail-metric-card">
            <div class="admin-detail-metric-icon" style="background:rgba(2,132,199,0.08); color:#0284c7;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div class="admin-detail-metric-info">
              <span class="admin-detail-metric-label">Usuario</span>
              <span class="admin-detail-metric-val">${renderUserCell(item.usuario)}</span>
            </div>
          </div>

          <div class="admin-detail-metric-card">
            <div class="admin-detail-metric-icon" style="background:rgba(217,119,6,0.08); color:#b45309;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="admin-detail-metric-info">
              <span class="admin-detail-metric-label">Fecha y Hora de Detección</span>
              <span class="admin-detail-metric-val">${formatDate(item.creado_en)}</span>
            </div>
          </div>

          <div class="admin-detail-metric-card">
            <div class="admin-detail-metric-icon" style="background:rgba(147,51,234,0.08); color:#7e22ce;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div class="admin-detail-metric-info">
              <span class="admin-detail-metric-label">Dirección IP de Origen</span>
              <span class="admin-detail-metric-val font-mono">${escHtml(item.ip || 'No registrada')}</span>
            </div>
          </div>
        </div>

        ${item.detalles && Object.keys(item.detalles).length > 0 ? `
          <div class="admin-detail-section">
            <label class="admin-detail-label">Contexto del Entorno y Navegador:</label>
            <pre class="admin-detail-json">${escHtml(JSON.stringify(item.detalles, null, 2))}</pre>
          </div>
        ` : ''}

        ${item.stack ? `
          <div class="admin-terminal-window">
            <div class="admin-terminal-bar">
              <div class="admin-terminal-dots">
                <span class="admin-terminal-dot dot--red"></span>
                <span class="admin-terminal-dot dot--yellow"></span>
                <span class="admin-terminal-dot dot--green"></span>
                <span class="admin-terminal-title" style="margin-left:8px;">Traza de Pila (Stack Trace)</span>
              </div>
              <button type="button" class="admin-terminal-copy-btn" onclick="AdminErrorsModule.copyStackToClipboard(${item.id})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copiar Traza</span>
              </button>
            </div>
            <pre id="stack-content-${item.id}" class="admin-detail-stack">${escHtml(item.stack)}</pre>
          </div>
        ` : ''}

        ${item.estado === 'Resuelto' && item.resuelto_en ? `
          <div class="admin-detail-resolved-info">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Incidencia marcada como resuelta el <strong>${formatDate(item.resuelto_en)}</strong> por <strong>${escHtml(item.resuelto_por || 'admin')}</strong>.</span>
          </div>
        ` : ''}
      </div>
    `;

    const modalActions = [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }
    ];

    if (item.estado !== 'Resuelto') {
      modalActions.unshift({
        text: 'Marcar como Resuelto',
        cls: 'btn-primary',
        action: async () => {
          await updateStatus(item.id, 'Resuelto');
          App.closeModal();
        }
      });
    }

    App.openModal(
      `Detalle de Incidencia Técnica #${item.id}`,
      modalBody,
      modalActions,
      'modal-lg'
    );
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

  function confirmDelete(id) {
    const requiredConfirmation = 'ELIMINAR';
    const html = `
      <div style="padding:10px 4px 6px; text-align:center;">
        <div style="width:58px;height:58px;margin:0 auto 16px;border-radius:50%;background:rgba(239,68,68,0.12);border:2px solid rgba(239,68,68,0.25);display:flex;align-items:center;justify-content:center;color:#dc2626;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="width:28px;height:28px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </div>
        <h3 style="font-size:18px;font-weight:800;color:var(--text-primary);margin-bottom:8px;">¿Eliminar Registro de Incidencia #${id}?</h3>
        <p style="font-size:13.5px;color:var(--text-secondary);line-height:1.5;max-width:440px;margin:0 auto 16px;">
          Esta acción removerá el registro técnico de error de manera permanente de la base de datos y no se puede deshacer.
        </p>

        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.22);border-radius:12px;padding:14px 16px;margin-bottom:18px;text-align:left;">
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:#dc2626;margin-bottom:6px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Confirmación Requerida
          </div>
          <p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.45;">
            Para confirmar la eliminación, por favor escribe exactamente <strong style="color:#dc2626;user-select:all;">${requiredConfirmation}</strong> a continuación:
          </p>
        </div>

        <div style="margin-bottom:10px;">
          <input
            type="text"
            id="admin-confirm-delete-input"
            class="form-input"
            placeholder="Escribe ${requiredConfirmation}"
            autocomplete="off"
            style="text-align:center; font-weight:800; font-size:14.5px; letter-spacing:0.8px; text-transform:uppercase; border:1.5px solid var(--color-border); padding:10px 14px; width:100%; border-radius:8px;"
            oninput="
              const val = this.value.trim().toUpperCase();
              const btn = document.getElementById('btn-confirm-delete-action');
              if (btn) {
                if (val === '${requiredConfirmation}') {
                  btn.disabled = false;
                  btn.style.opacity = '1';
                  btn.style.cursor = 'pointer';
                  btn.style.boxShadow = '0 4px 14px rgba(220, 38, 38, 0.4)';
                } else {
                  btn.disabled = true;
                  btn.style.opacity = '0.45';
                  btn.style.cursor = 'not-allowed';
                  btn.style.boxShadow = 'none';
                }
              }
            "
          />
        </div>
      </div>
    `;

    App.openModal('Confirmar Eliminación de Incidencia', html, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      {
        text: 'Sí, Eliminar Registro',
        cls: 'btn-danger',
        id: 'btn-confirm-delete-action',
        action: async () => {
          const inputEl = document.getElementById('admin-confirm-delete-input');
          const typedVal = inputEl ? inputEl.value.trim().toUpperCase() : '';
          if (typedVal !== requiredConfirmation) {
            App.showToast(`Debes escribir "${requiredConfirmation}" para proceder.`, 'warning');
            if (inputEl) inputEl.focus();
            return;
          }
          const btn = document.getElementById('btn-confirm-delete-action');
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Eliminando...';
          }
          try {
            await API.deleteAdminError(id);
            App.closeModal();
            App.showToast('Registro de error eliminado correctamente.', 'success');
            await loadData(currentPagination.page);
          } catch (err) {
            if (btn) {
              btn.disabled = false;
              btn.textContent = 'Sí, Eliminar Registro';
            }
            App.showToast('Error al eliminar el registro.', 'error');
          }
        }
      }
    ]);

    setTimeout(() => {
      const btn = document.getElementById('btn-confirm-delete-action');
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.45';
        btn.style.cursor = 'not-allowed';
      }
      const inp = document.getElementById('admin-confirm-delete-input');
      if (inp) inp.focus();
    }, 50);
  }

  function confirmClearAll(onlyResolved = false) {
    const requiredConfirmation = onlyResolved ? 'DEPURAR' : 'LIMPIAR';
    const title = onlyResolved ? 'Depurar Errores Resueltos' : 'Limpiar Todo el Historial';
    const desc = onlyResolved
      ? 'Se eliminarán permanentemente todas las incidencias marcadas como <strong>Resuelto</strong>.'
      : 'Se vaciará completamente el registro histórico de incidencias y errores del sistema.';

    const html = `
      <div style="padding:10px 4px 6px; text-align:center;">
        <div style="width:58px;height:58px;margin:0 auto 16px;border-radius:50%;background:rgba(239,68,68,0.12);border:2px solid rgba(239,68,68,0.25);display:flex;align-items:center;justify-content:center;color:#dc2626;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="width:28px;height:28px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </div>
        <h3 style="font-size:18px;font-weight:800;color:var(--text-primary);margin-bottom:8px;">${title}</h3>
        <p style="font-size:13.5px;color:var(--text-secondary);line-height:1.5;max-width:440px;margin:0 auto 16px;">
          ${desc} Esta acción no se puede deshacer.
        </p>

        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.22);border-radius:12px;padding:14px 16px;margin-bottom:18px;text-align:left;">
          <p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.45;">
            Para confirmar, escribe exactamente <strong style="color:#dc2626;user-select:all;">${requiredConfirmation}</strong> a continuación:
          </p>
        </div>

        <div style="margin-bottom:10px;">
          <input
            type="text"
            id="admin-confirm-clear-input"
            class="form-input"
            placeholder="Escribe ${requiredConfirmation}"
            autocomplete="off"
            style="text-align:center; font-weight:800; font-size:14.5px; letter-spacing:0.8px; text-transform:uppercase; border:1.5px solid var(--color-border); padding:10px 14px; width:100%; border-radius:8px;"
            oninput="
              const val = this.value.trim().toUpperCase();
              const btn = document.getElementById('btn-confirm-clear-action');
              if (btn) {
                if (val === '${requiredConfirmation}') {
                  btn.disabled = false;
                  btn.style.opacity = '1';
                  btn.style.cursor = 'pointer';
                  btn.style.boxShadow = '0 4px 14px rgba(220, 38, 38, 0.4)';
                } else {
                  btn.disabled = true;
                  btn.style.opacity = '0.45';
                  btn.style.cursor = 'not-allowed';
                  btn.style.boxShadow = 'none';
                }
              }
            "
          />
        </div>
      </div>
    `;

    App.openModal(title, html, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      {
        text: onlyResolved ? 'Sí, Depurar Resueltos' : 'Sí, Vaciar Todo',
        cls: 'btn-danger',
        id: 'btn-confirm-clear-action',
        action: async () => {
          const inputEl = document.getElementById('admin-confirm-clear-input');
          const typedVal = inputEl ? inputEl.value.trim().toUpperCase() : '';
          if (typedVal !== requiredConfirmation) {
            App.showToast(`Debes escribir "${requiredConfirmation}" para proceder.`, 'warning');
            if (inputEl) inputEl.focus();
            return;
          }
          const btn = document.getElementById('btn-confirm-clear-action');
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Procesando...';
          }
          try {
            await API.clearAllAdminErrors(onlyResolved);
            App.closeModal();
            App.showToast(onlyResolved ? 'Incidentes resueltos eliminados.' : 'Historial de errores depurado.', 'success');
            await loadData(1);
          } catch (err) {
            if (btn) {
              btn.disabled = false;
              btn.textContent = 'Reintentar';
            }
            App.showToast('Error al depurar.', 'error');
          }
        }
      }
    ]);

    setTimeout(() => {
      const btn = document.getElementById('btn-confirm-clear-action');
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.45';
        btn.style.cursor = 'not-allowed';
      }
      const inp = document.getElementById('admin-confirm-clear-input');
      if (inp) inp.focus();
    }, 50);
  }

  async function render(container) {
    if (!container) return;

    container.innerHTML = `
      <div class="module-enter">
        
        <!-- Encabezado Institucional Estandarizado Gobernación de Boyacá -->
        <div class="module-header-card">
          <div class="module-header-info">
            <div class="module-header-brand">
              <img src="imgs/logoCondor.png" alt="Escudo Gobernación de Boyacá" class="module-header-logo logo-light-theme" />
              <img src="imgs/logoCondorBlanco.png" alt="Escudo Gobernación de Boyacá" class="module-header-logo logo-dark-theme" />
              <span class="module-header-brand-text">Gobernación de Boyacá · Administración del Sistema</span>
            </div>
            <h1 class="module-hero-title">Centro de Monitoreo de Errores</h1>
            <p class="module-hero-desc">Supervisión en tiempo real de fallos técnicos, excepciones de JavaScript, errores de microservicios y reportes de usuario en Talento 360.</p>
          </div>
          <div class="module-header-actions" style="display:flex; align-items:center; gap:12px;">
            <button id="btn-admin-err-refresh" class="btn-action-slide-admin btn-slide--green" title="Actualizar lista de incidencias">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              <span class="btn-slide-label">Actualizar</span>
            </button>
            <button id="btn-admin-err-clear-resolved" class="btn-action-slide-admin btn-slide--blue" title="Eliminar incidencias resueltas">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span class="btn-slide-label">Depurar Resueltos</span>
            </button>
            <button id="btn-admin-err-clear-all" class="btn-action-slide-admin btn-slide--red" title="Vaciar todo el registro">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              <span class="btn-slide-label">Limpiar Todo</span>
            </button>
          </div>
        </div>

        <!-- 5 Tarjetas Métricas KPI Oficiales (stats-grid de 5 Columnas Completas) -->
        <div class="stats-grid" style="margin-bottom: 20px;">
          <div class="stat-card">
            <div class="stat-icon stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" id="stat-admin-err-total">0</div>
              <div class="stat-label">Total Incidencias Registradas</div>
              <div style="margin-top:4px;">
                <span class="badge badge-warning" id="stat-admin-err-pend-badge" style="font-size:0.72rem;">0 pendientes</span>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9.5"/>
                <line x1="12" y1="7.5" x2="12" y2="12.5"/>
                <circle cx="12" cy="16.5" r="0.8" fill="currentColor"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" id="stat-admin-err-404">0</div>
              <div class="stat-label">Páginas 404 Detectadas</div>
              <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; display:block;">Enlaces rotos o no encontrados</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" id="stat-admin-err-js">0</div>
              <div class="stat-label">Excepciones de Consola y API</div>
              <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; display:block;">Fallos JS y microservicios</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" id="stat-admin-err-user">0</div>
              <div class="stat-label">Reportes de Usuarios</div>
              <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; display:block;">Enviados mediante botón de reporte</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value text-success" id="stat-admin-err-resolved">0</div>
              <div class="stat-label">Incidencias Resueltas</div>
              <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; display:block;" id="stat-admin-err-rate">Eficacia técnica del sistema</span>
            </div>
          </div>
        </div>

        <!-- Filtros y Búsqueda Estandarizados (filters-card) -->
        <div class="filters-card">
          <div class="filters-row" style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end;">
            <div class="filter-group" style="flex:2.2; min-width:240px;">
              <label class="filter-label" for="admin-filter-search">Buscar Incidencia</label>
              <input type="text" id="admin-filter-search" class="filter-input" placeholder="Buscar por mensaje, URL o usuario..." aria-label="Buscar incidencia" />
            </div>

            <div class="filter-group" style="flex:1.4; min-width:190px;">
              <label class="filter-label" for="admin-filter-tipo">Tipo de Fallo</label>
              <select id="admin-filter-tipo" class="filter-select" aria-label="Filtrar por tipo de fallo">
                <option value="TODOS">TODOS LOS TIPOS</option>
                <option value="PAGE_404">Páginas 404 No Encontradas</option>
                <option value="CONSOLE_ERROR">Errores de Consola / JS</option>
                <option value="API_ERROR">Errores de API / Backend</option>
                <option value="UNHANDLED_REJECTION">Promesas No Controladas</option>
              </select>
            </div>

            <div class="filter-group" style="flex:1.2; min-width:170px;">
              <label class="filter-label" for="admin-filter-estado">Estado</label>
              <select id="admin-filter-estado" class="filter-select" aria-label="Filtrar por estado">
                <option value="TODOS">TODOS LOS ESTADOS</option>
                <option value="Pendiente" selected>Solo Pendientes</option>
                <option value="En Revisión">En Revisión</option>
                <option value="Resuelto">Resueltos</option>
              </select>
            </div>

            <div class="filters-actions-wrap" style="display:flex; gap:8px; align-items:flex-end;">
              <button type="button" class="btn-filter-clear" id="btn-admin-filter-clear" title="Restablecer filtros de búsqueda" aria-label="Limpiar filtros">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;flex-shrink:0;">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                <span>Limpiar</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Tabla de Resultados en Table Card Oficial -->
        <div class="table-card">
          <div class="table-header">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="table-title">Incidencias y Fallos Técnicos Registrados</span>
              <span class="table-count" id="admin-errors-count-badge">
                <span class="skeleton" style="width:80px;height:14px;border-radius:4px;" aria-hidden="true"></span>
              </span>
            </div>
            <div style="font-size:0.82rem; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
              <span class="status-indicator-live" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; box-shadow:0 0 8px #22c55e;"></span>
              <span>Monitoreo Activo</span>
            </div>
          </div>

          <div class="table-wrap">
            <table class="admin-table-styled" aria-label="Listado de incidencias técnicas">
              <thead>
                <tr>
                  <th scope="col" style="width: 140px; text-align: center;">Estado</th>
                  <th scope="col" style="width: 155px; text-align: center;">Tipo</th>
                  <th scope="col">Detalle del Incidente</th>
                  <th scope="col" style="width: 220px;">Ruta / URL Afectada</th>
                  <th scope="col" style="width: 155px; text-align: left; padding-left: 16px;">Usuario</th>
                  <th scope="col" style="width: 140px; text-align: center;">Fecha y Hora</th>
                  <th scope="col" style="width: 90px; text-align: center;">Acciones</th>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </div>
            <h3 class="empty-title">Plataforma Operando con Normalidad</h3>
            <p class="empty-desc">No se registran fallos técnicos ni incidencias pendientes con los filtros seleccionados.</p>
          </div>

          <!-- Footer y Paginador -->
          <div class="pagination" id="admin-errors-pagination-bar" style="display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-top:1px solid var(--color-border, #e2e8f0);">
            <span class="pagination-info" id="admin-errors-count-info" style="font-size:0.83rem; color:var(--text-secondary);">Mostrando 0 incidencias</span>
            <div class="pagination-btns" style="display:flex; gap:8px; align-items:center;">
              <button id="admin-errors-btn-prev" class="btn btn-sm btn-outline" style="border-radius:8px; padding:4px 12px; display:inline-flex; align-items:center; gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                <span>Anterior</span>
              </button>
              <span id="admin-errors-page-indicator" style="font-size:0.82rem; font-weight:700; color:var(--text-primary); padding:0 8px;">Página 1</span>
              <button id="admin-errors-btn-next" class="btn btn-sm btn-outline" style="border-radius:8px; padding:4px 12px; display:inline-flex; align-items:center; gap:6px;">
                <span>Siguiente</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    `;

    setupEvents();
    await loadData(1);

    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
      loadData(currentPagination.page);
    }, 45 * 1000);
  }

  function setupEvents() {
    const btnRefresh = document.getElementById('btn-admin-err-refresh');
    if (btnRefresh) {
      btnRefresh.onclick = () => {
        loadData(currentPagination.page);
        if (typeof App !== 'undefined' && App.showToast) App.showToast('Incidentes actualizados', 'info');
      };
    }

    const btnClearResolved = document.getElementById('btn-admin-err-clear-resolved');
    if (btnClearResolved) {
      btnClearResolved.onclick = () => confirmClearAll(true);
    }

    const btnClearAll = document.getElementById('btn-admin-err-clear-all');
    if (btnClearAll) {
      btnClearAll.onclick = () => confirmClearAll(false);
    }

    const filterTipo = document.getElementById('admin-filter-tipo');
    if (filterTipo) {
      filterTipo.onchange = (e) => {
        currentFilterTipo = e.target.value;
        loadData(1);
      };
    }

    const filterEstado = document.getElementById('admin-filter-estado');
    if (filterEstado) {
      filterEstado.onchange = (e) => {
        currentFilterEstado = e.target.value;
        loadData(1);
      };
    }

    const filterSearch = document.getElementById('admin-filter-search');
    let searchDebounce = null;
    if (filterSearch) {
      filterSearch.oninput = (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          currentSearch = e.target.value.trim();
          loadData(1);
        }, 320);
      };
    }

    const btnClearFilters = document.getElementById('btn-admin-filter-clear');
    if (btnClearFilters) {
      btnClearFilters.onclick = () => {
        currentSearch = '';
        currentFilterTipo = 'TODOS';
        currentFilterEstado = 'TODOS';
        if (filterSearch) filterSearch.value = '';
        if (filterTipo) filterTipo.value = 'TODOS';
        if (filterEstado) filterEstado.value = 'TODOS';
        loadData(1);
      };
    }

    const prevBtn = document.getElementById('admin-errors-btn-prev');
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (currentPagination.page > 1) {
          loadData(currentPagination.page - 1);
        }
      };
    }

    const nextBtn = document.getElementById('admin-errors-btn-next');
    if (nextBtn) {
      nextBtn.onclick = () => {
        if (currentPagination.page < currentPagination.totalPages) {
          loadData(currentPagination.page + 1);
        }
      };
    }
  }

  return {
    render,
    loadData,
    updateStatus,
    openDetailModal,
    copyStackToClipboard,
    confirmDelete,
    confirmClearAll
  };
})();

if (typeof window !== 'undefined') {
  window.AdminErrorsModule = AdminErrorsModule;
}
