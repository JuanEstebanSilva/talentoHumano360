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
    if (t === 'PAGE_404' || t === 'NOT_FOUND_404') {
      return `<span class="badge badge-warning" title="Página o ruta 404 no encontrada"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Error 404</span>`;
    }
    if (t === 'CONSOLE_ERROR') {
      return `<span class="badge badge-danger" title="Error de JavaScript en el navegador"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Consola JS</span>`;
    }
    if (t === 'API_ERROR') {
      return `<span class="badge badge-secondary" title="Fallo en llamada a microservicio o red"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>API / Red</span>`;
    }
    return `<span class="badge badge-info" title="Excepción del sistema">${escHtml(t)}</span>`;
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
      // Actualización optimista inmediata
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
          ${renderEstadoSelect(item)}
        </td>
        <td style="text-align: center;">
          ${getTipoBadge(item.tipo)}
          ${item.reportado_por_usuario ? '<div style="margin-top:4px;"><span class="badge badge-user-report" title="Reportado manualmente por el usuario mediante botón">🙋 Por Usuario</span></div>' : ''}
        </td>
        <td class="col-error-msg">
          <div class="error-msg-main" title="${escHtml(item.mensaje)}">${escHtml(item.mensaje)}</div>
          ${item.stack ? `<div class="error-has-stack-hint"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Traza de pila disponible</div>` : ''}
        </td>
        <td class="col-error-url" title="${escHtml(item.url || 'No especificada')}">
          <span class="admin-url-text">${escHtml(truncateUrl(item.url || 'N/A', 40))}</span>
        </td>
        <td style="text-align: center;">
          <span class="admin-user-text" title="Usuario que experimentó la incidencia">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>${escHtml(item.usuario || 'Anónimo')}</span>
          </span>
        </td>
        <td style="text-align: center; font-size: 0.82rem; color: var(--text-secondary); white-space: nowrap;">
          ${formatDate(item.creado_en)}
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

  function truncateUrl(url, max = 40) {
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
          ${renderEstadoSelect(item)}
          ${getTipoBadge(item.tipo)}
          ${item.reportado_por_usuario ? '<span class="badge badge-user-report">🙋 Reporte Voluntario de Usuario</span>' : '<span class="badge badge-auto">🤖 Detección Automática de Sistema</span>'}
        </div>

        <div class="admin-detail-group">
          <label class="admin-detail-label">Mensaje de Error / Excepción:</label>
          <div class="admin-detail-box-message">${escHtml(item.mensaje)}</div>
        </div>

        <div class="admin-detail-grid">
          <div>
            <label class="admin-detail-label">Ruta / URL afectada:</label>
            <div class="admin-detail-box-meta"><span class="admin-url-text" style="font-weight:600;">${escHtml(item.url || 'No especificada')}</span></div>
          </div>
          <div>
            <label class="admin-detail-label">Usuario registrado:</label>
            <div class="admin-detail-box-meta"><strong>${escHtml(item.usuario || 'Anónimo')}</strong></div>
          </div>
          <div>
            <label class="admin-detail-label">Fecha y Hora:</label>
            <div class="admin-detail-box-meta">${formatDate(item.creado_en)}</div>
          </div>
          <div>
            <label class="admin-detail-label">Dirección IP:</label>
            <div class="admin-detail-box-meta">${escHtml(item.ip_address || '127.0.0.1')}</div>
          </div>
        </div>

        ${item.stack ? `
          <div class="admin-detail-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label class="admin-detail-label" style="margin:0;">Traza de Pila (Stack Trace):</label>
              <button class="btn btn-secondary btn-sm" onclick="AdminErrorsModule.copyStackToClipboard(${item.id})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copiar Traza
              </button>
            </div>
            <pre id="stack-content-${item.id}" class="admin-detail-stack">${escHtml(item.stack)}</pre>
          </div>
        ` : ''}

        ${item.estado === 'Resuelto' && item.resuelto_en ? `
          <div class="admin-detail-resolved-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Incidencia marcada como resuelta el <strong>${formatDate(item.resuelto_en)}</strong> por <strong>${escHtml(item.resuelto_por || 'admin')}</strong>.</span>
          </div>
        ` : ''}
      </div>
    `;

    App.openModal(
      `Detalle de Incidencia Técnica #${item.id}`,
      modalBody,
      [
        { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }
      ],
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

  /**
   * Eliminación con doble confirmación tipada (como en Viáticos)
   */
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
      <div class="admin-panel-container">
        
        <!-- Cabecera del Módulo -->
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div class="page-header-info">
            <h1 class="page-title" style="font-size:1.6rem; font-weight:800; color:var(--text-primary); margin:0 0 6px;">Centro de Monitoreo de Errores e Incidentes</h1>
            <p class="page-subtitle" style="font-size:0.88rem; color:var(--text-secondary); margin:0;">Supervisión técnica de fallos, excepciones de JavaScript, errores de servidor y páginas 404 reportadas en Talento 360.</p>
          </div>
          <div class="page-actions" style="display:flex; align-items:center; gap:10px;">
            <button id="btn-admin-err-refresh" class="btn btn-outline" title="Actualizar lista de incidencias" style="display:inline-flex; align-items:center; gap:8px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              <span>Actualizar</span>
            </button>
            <button id="btn-admin-err-clear-resolved" class="btn btn-secondary" title="Eliminar incidencias resueltas" style="display:inline-flex; align-items:center; gap:8px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Depurar Resueltos</span>
            </button>
            <button id="btn-admin-err-clear-all" class="btn btn-outline" style="color:var(--color-danger, #c42b1c); border-color:rgba(196,43,28,0.35);" title="Vaciar todo el registro">
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
              <option value="En Revisión">En Revisión</option>
              <option value="Resuelto">Resueltos</option>
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
                  <th style="width: 140px; text-align: center;">Estado</th>
                  <th style="width: 140px; text-align: center;">Tipo</th>
                  <th>Detalle del Incidente</th>
                  <th style="width: 220px;">Ruta / URL Afectada</th>
                  <th style="width: 130px; text-align: center;">Usuario</th>
                  <th style="width: 160px; text-align: center;">Fecha y Hora</th>
                  <th style="width: 110px; text-align: center;">Acciones</th>
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
            <p class="empty-desc">No se registran fallos técnicos ni incidencias pendientes con los filtros seleccionados.</p>
          </div>

          <!-- Footer y Paginador -->
          <div class="admin-table-footer">
            <div id="admin-errors-count-info" class="count-info">Cargando incidencias...</div>
            <div id="admin-errors-pagination" class="pagination-buttons">
              <button id="admin-errors-btn-prev" class="btn-page">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                <span>Anterior</span>
              </button>
              <span id="admin-errors-page-indicator" style="font-size:0.83rem; font-weight:700; color:var(--text-primary);">Página 1</span>
              <button id="admin-errors-btn-next" class="btn-page">
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
