/* ═══════════════════════════════════════════════════════════════════════════
   requests.js — Vacaciones module
   ═══════════════════════════════════════════════════════════════════════════ */

const RequestsModule = (() => {
  let state = { data: [], total: 0, page: 1, totalPages: 1, filters: {} };

  const ESTADOS = ['Todos', 'Pendiente', 'En revisión', 'Aprobada', 'Finalizada', 'Rechazada'];
  const TIPOS = ['Vacaciones', 'Permiso', 'Incapacidad', 'Licencia maternidad'];

  function badgeClass(estado) {
    const e = (estado || '').toLowerCase();
    if (e.includes('aprobad'))  return 'badge--aprobada';
    if (e.includes('finaliz'))  return 'badge--finalizada';
    if (e.includes('rechazad')) return 'badge--rechazada';
    if (e.includes('revis'))    return 'badge--revision';
    return 'badge--pendiente';
  }

  function renderSkeletonTable() {
    const tbody = document.getElementById('req-tbody');
    if (!tbody) return;
    const skeletonRows = Array.from({ length: 6 }).map((_, i) => `
      <tr class="skeleton-row" style="animation-delay: ${i * 0.08}s">
        <td><div class="skeleton-bar" style="width: 80px; height: 16px;"></div></td>
        <td>
          <div class="skeleton-user-cell">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-text-group">
              <div class="skeleton-bar" style="width: 140px; height: 14px;"></div>
              <div class="skeleton-bar" style="width: 90px; height: 11px;"></div>
            </div>
          </div>
        </td>
        <td><div class="skeleton-bar" style="width: 130px; height: 13px;"></div></td>
        <td><div class="skeleton-bar" style="width: 85px; height: 20px; border-radius: 12px;"></div></td>
        <td><div class="skeleton-bar" style="width: 75px; height: 13px;"></div></td>
        <td><div class="skeleton-bar" style="width: 45px; height: 13px;"></div></td>
        <td><div class="skeleton-bar" style="width: 90px; height: 22px; border-radius: 12px;"></div></td>
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

  async function load() {
    renderSkeletonTable();
    try {
      const params = { page: state.page, limit: 20, ...state.filters };
      const res = await API.getRequests(params);
      state.data = res.data || [];
      state.total = res.total || 0;
      state.totalPages = res.totalPages || 1;
      renderTable();
      renderPagination();
      const countEl = document.getElementById('req-count');
      if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} solicitudes`;
    } catch (err) {
      App.showToast('Error al cargar solicitudes: ' + err.message, 'error');
    }
  }

  function renderTable() {
    const tbody = document.getElementById('req-tbody');
    if (!tbody) return;
    tbody.removeAttribute('role');
    tbody.setAttribute('aria-busy', 'false');
    if (!state.data.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span class="empty-state-title">No hay solicitudes</span>
        <span class="empty-state-desc">No se encontraron solicitudes con los filtros aplicados.</span>
        </div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.data.map(r => `
      <tr>
        <td class="td-radicado">${r.radicado}</td>
        <td>
          <div class="user-table-cell">
            <span class="td-primary" title="${r.persona}">${truncate(r.persona, 28) || '—'}</span>
            <span class="user-table-cc font-mono">${r.documento ? `C.C. ${r.documento}` : '—'}</span>
          </div>
        </td>
        <td title="${r.dependencia}">${truncate(r.dependencia, 28) || '—'}</td>
        <td><span class="badge badge--revision">${r.tipo}</span></td>
        <td>${r.fechaInicio || '—'}</td>
        <td>${r.diasTotales || '—'}</td>
        <td>
          <button type="button" class="badge badge--interactive ${badgeClass(r.estado)}" onclick="RequestsModule.openStatusPicker(${r.id})" title="Clic para cambiar estado de esta solicitud" aria-label="Cambiar estado: ${r.estado}">
            <span>${r.estado}</span>
            <svg class="badge-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </td>
        <td class="td-actions">
          <div class="td-actions-wrap">
            <button class="btn-action-view" onclick="RequestsModule.openView(${r.id})" title="Ver Detalles de Solicitud">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-action-edit" onclick="RequestsModule.openEdit(${r.id})" title="Editar Solicitud">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${Auth.canEdit() ? `<button class="btn-action-delete" onclick="RequestsModule.confirmDelete(${r.id},'${escHtml(r.persona)}')" title="Eliminar Solicitud">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  }

  function renderPagination() {
    const el = document.getElementById('req-pagination');
    if (!el) return;
    el.innerHTML = `
      <span class="pagination-info">Mostrando ${state.data.length} de ${state.total.toLocaleString('es-CO')} solicitudes</span>
      <div class="pagination-btns">
        <button class="page-btn" onclick="RequestsModule.goPage(${state.page - 1})" ${state.page <= 1 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="page-btn active">${state.page}</span>
        <span style="color:var(--text-muted);font-size:var(--text-sm)">/ ${state.totalPages}</span>
        <button class="page-btn" onclick="RequestsModule.goPage(${state.page + 1})" ${state.page >= state.totalPages ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`;
  }

  function openView(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;
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
            <span class="detail-value">${escHtml(r.dependencia || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tipo de Solicitud</span>
            <span class="detail-value">${escHtml(r.tipo || 'Vacaciones')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Días Totales</span>
            <span class="detail-value">${r.diasTotales || 0} días</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Fecha de Inicio</span>
            <span class="detail-value">${escHtml(r.fechaInicio || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Fecha de Fin</span>
            <span class="detail-value">${escHtml(r.fechaFin || '—')}</span>
          </div>
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
          openEdit(id);
        }
      });
    }
    App.openModal(`Detalles de Solicitud · ${r.radicado || ''}`, content, actions);
  }

  function openCreate() {
    App.openModal('Nueva Solicitud de Vacaciones', buildForm(), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Crear Solicitud', cls: 'btn-primary', id: 'req-save-btn', action: saveCreate },
    ]);
  }

  function openEdit(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;
    App.openModal('Editar Solicitud', buildForm(r), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Actualizar', cls: 'btn-gold', id: 'req-save-btn', action: () => saveEdit(id) },
    ]);
  }

  function buildForm(r = {}) {
    const dis = Auth.canEdit() ? '' : 'disabled';
    return `
      <div class="form-grid">
        <div class="form-group span-2">
          <label class="form-label">Nombre Completo *</label>
          <input id="rf-nombre" class="form-input" placeholder="APELLIDO APELLIDO NOMBRE..." value="${escHtml(r.persona||'')}" ${dis} required />
        </div>
        <div class="form-group">
          <label class="form-label">Documento</label>
          <input id="rf-doc" class="form-input" placeholder="Número de cédula" value="${escHtml(r.documento||'')}" ${dis} />
        </div>
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select id="rf-tipo" class="filter-select" ${dis}>
            ${TIPOS.map(t => `<option ${r.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Dependencia</label>
          <input id="rf-dep" class="form-input" placeholder="Secretaría / Dependencia..." value="${escHtml(r.dependencia||'')}" ${dis} />
        </div>
        <div class="form-group span-2">
          <label class="form-label">Cargo</label>
          <input id="rf-cargo" class="form-input" placeholder="Cargo del servidor..." value="${escHtml(r.cargo||'')}" ${dis} />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha Inicio</label>
          <input id="rf-fecha" class="form-input" placeholder="DD/MM/AAAA" value="${escHtml(r.fechaInicio||'')}" ${dis} />
        </div>
        <div class="form-group">
          <label class="form-label">Días Totales</label>
          <input id="rf-dias" class="form-input" type="number" min="1" value="${escHtml(r.diasTotales||'1')}" ${dis} />
        </div>
        <div class="form-group">
          <label class="form-label">Periodos</label>
          <input id="rf-periodos" class="form-input" placeholder="Ej: 2024-2025" value="${escHtml(r.periodos||'')}" ${dis} />
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select id="rf-estado" class="filter-select" ${dis}>
            ${ESTADOS.filter(s => s !== 'Todos').map(s => `<option ${r.estado === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Observaciones</label>
          <input id="rf-obs" class="form-input" placeholder="Notas u observaciones..." value="${escHtml(r.observaciones||'')}" ${dis} />
        </div>
        ${r.id ? `<div class="form-group span-2">
          <label class="form-label">Nota de Gestión</label>
          <input id="rf-nota" class="form-input" placeholder="Nota del coordinador..." value="" ${dis} />
        </div>` : ''}
      </div>`;
  }

  async function saveCreate() {
    const body = readForm();
    if (!body) return;
    const btn = document.getElementById('req-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      const res = await API.createRequest(body);
      App.closeModal();
      App.showToast(`Solicitud creada. Radicado: ${res.radicado || ''}`, 'success');
      await load();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Crear Solicitud'; }
    }
  }

  async function saveEdit(id) {
    const body = readForm(true);
    if (!body) return;
    const btn = document.getElementById('req-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
    try {
      await API.updateRequest(id, body);
      App.closeModal();
      App.showToast('Solicitud actualizada.', 'success');
      await load();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Actualizar'; }
    }
  }

  function readForm(withNota = false) {
    const nombre = document.getElementById('rf-nombre')?.value.trim();
    const doc    = document.getElementById('rf-doc')?.value.trim();
    const dep    = document.getElementById('rf-dep')?.value.trim();
    const fecha  = document.getElementById('rf-fecha')?.value.trim();
    if (!nombre) { App.showToast('El nombre es requerido.', 'warning'); return null; }
    const body = {
      persona: nombre, documento: doc, dependencia: dep,
      cargo: document.getElementById('rf-cargo')?.value.trim(),
      fechaInicio: fecha, diasTotales: parseInt(document.getElementById('rf-dias')?.value) || 1,
      periodos: document.getElementById('rf-periodos')?.value.trim(),
      tipo: document.getElementById('rf-tipo')?.value,
      estado: document.getElementById('rf-estado')?.value || 'Pendiente',
      estadoInicial: document.getElementById('rf-estado')?.value || 'Pendiente',
      observaciones: document.getElementById('rf-obs')?.value.trim(),
    };
    if (withNota) body.notaGestion = document.getElementById('rf-nota')?.value.trim() || '';
    return body;
  }

  function confirmDelete(id, nombre) {
    App.openModal('Confirmar Eliminación', `<p style="color:var(--text-secondary)">¿Eliminar la solicitud de <strong style="color:var(--text-primary)">${nombre}</strong>?<br><br>Esta acción no se puede deshacer.</p>`, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Eliminar', cls: 'btn-danger', action: async () => {
        try {
          await API.deleteRequest(id);
          App.closeModal();
          App.showToast('Solicitud eliminada.', 'success');
          await load();
        } catch (err) { App.showToast(err.message, 'error'); }
      }},
    ]);
  }

  function applyFilters() {
    state.page = 1;
    state.filters = {
      q: document.getElementById('req-q')?.value.trim() || '',
      estado: document.getElementById('req-estado')?.value || '',
    };
    load();
  }
  function clearFilters() {
    ['req-q','req-estado'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    state.filters = {}; state.page = 1;
    load();
  }
  function goPage(p) { if (p < 1 || p > state.totalPages) return; state.page = p; load(); }

  // ─── Dropdown de Opciones Secundarias (Ley de Hick & WCAG 2.1 AA) ──────────
  function toggleActionsDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('req-dropdown-menu');
    const toggleBtn = document.getElementById('req-dropdown-toggle');
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
    const menu = document.getElementById('req-dropdown-menu');
    const toggleBtn = document.getElementById('req-dropdown-toggle');
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
      const menu = document.getElementById('req-dropdown-menu');
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
      const menu = document.getElementById('req-dropdown-menu');
      if (menu && !menu.hasAttribute('hidden') && wrap && !wrap.contains(e.target)) {
        menu.setAttribute('hidden', '');
        const toggleBtn = document.getElementById('req-dropdown-toggle');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const menu = document.getElementById('req-dropdown-menu');
        if (menu && !menu.hasAttribute('hidden')) {
          closeActionsDropdown();
        }
      }
    });
  }

  async function render(container) {
    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <h1 class="page-heading">Solicitudes de Vacaciones</h1>
            <p class="page-desc">Gestión de solicitudes de vacaciones del personal de la Gobernación de Boyacá</p>
          </div>
          <div class="page-actions" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <!-- Dropdown de Opciones Secundarias (Hick's Law) -->
            <div class="actions-dropdown-wrap">
              <button
                type="button"
                class="btn btn-secondary actions-dropdown-btn"
                id="req-dropdown-toggle"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="req-dropdown-menu"
                onclick="RequestsModule.toggleActionsDropdown(event)"
                onkeydown="RequestsModule.handleDropdownKeydown(event)"
                title="Opciones secundarias (Excel y plantillas)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                <span>Acciones</span>
                <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div
                class="actions-dropdown-menu"
                id="req-dropdown-menu"
                role="menu"
                aria-labelledby="req-dropdown-toggle"
                hidden
              >
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="RequestsModule.closeActionsDropdown(); RequestsModule.exportExcel();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <div>
                    <strong>Exportar a Excel</strong>
                    <small>Descarga el listado filtrado actual en formato .xlsx</small>
                  </div>
                </button>
                ${Auth.canEdit() ? `
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="RequestsModule.closeActionsDropdown(); RequestsModule.openImportModal();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <div>
                    <strong>Carga Masiva Excel</strong>
                    <small>Importar registros desde plantilla institucional</small>
                  </div>
                </button>` : ''}
              </div>
            </div>

            <!-- Acción Primaria (CTA - Visual Salience) -->
            ${Auth.canEdit() ? `
            <button class="btn btn-primary btn-primary-cta" onclick="RequestsModule.openCreate()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Nueva Solicitud</span>
            </button>` : ''}
          </div>
        </div>

        <div class="filters-card">
          <div class="filters-row">
            <div class="filter-group" style="flex:2">
              <label class="filter-label">Buscar</label>
              <input id="req-q" class="filter-input" placeholder="Nombre, cédula, radicado..." />
            </div>
            <div class="filter-group">
              <label class="filter-label">Estado</label>
              <select id="req-estado" class="filter-select">
                ${ESTADOS.map(s => `<option>${s}</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-primary" onclick="RequestsModule.applyFilters()">Filtrar</button>
            <button class="btn btn-secondary" onclick="RequestsModule.clearFilters()">Limpiar</button>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <span class="table-title">Solicitudes de Vacaciones</span>
            <span class="table-count" id="req-count">Cargando...</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Radicado</th><th>Servidor Público</th><th>Dependencia</th>
                <th>Tipo</th><th>Fecha Inicio</th><th>Días</th><th>Estado</th><th>Acciones</th>
              </tr></thead>
              <tbody id="req-tbody"><tr><td colspan="8"><div class="empty-state loading-pulse">Cargando...</div></td></tr></tbody>
            </table>
          </div>
          <div class="pagination" id="req-pagination"></div>
        </div>
      </div>`;

    document.getElementById('req-q')?.addEventListener('keypress', e => { if (e.key === 'Enter') applyFilters(); });
    bindDropdownOutsideClick();
    state.page = 1; state.filters = {};
    await load();
  }

  const STATUS_CONFIG = [
    {
      id: 'aprobada',
      name: 'Aprobada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
      desc: 'Aprobar período de vacaciones',
      cls: 'status-card-opt--aprobada',
    },
    {
      id: 'rechazada',
      name: 'Rechazada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      desc: 'Denegar o rechazar solicitud de vacaciones',
      cls: 'status-card-opt--rechazada',
    },
    {
      id: 'revision',
      name: 'En revisión',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      desc: 'En verificación de tiempos y antigüedad de planta',
      cls: 'status-card-opt--revision',
    },
    {
      id: 'pendiente',
      name: 'Pendiente',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      desc: 'En espera de visto bueno de talento humano',
      cls: 'status-card-opt--pendiente',
    },
    {
      id: 'finalizada',
      name: 'Finalizada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      desc: 'Período disfrutado y legalizado en hoja de vida',
      cls: 'status-card-opt--finalizada',
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
        <button type="button" class="status-card-opt ${opt.cls} ${isCurrent ? 'is-current' : ''}" onclick="RequestsModule.selectQuickStatus(${r.id}, '${opt.name}')" title="Marcar como ${opt.name}">
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
            <span class="status-picker-tag">🏢 ${escHtml(r.dependencia || 'Dependencia')}</span>
            <span class="status-picker-tag">📅 ${escHtml(r.fechaInicio || '—')} (${r.diasTotales || 1} días)</span>
            <span class="status-picker-tag">Estado actual: <strong class="badge ${badgeClass(r.estado)}" style="margin-left:4px">${r.estado}</strong></span>
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
          <label class="form-label">Nota de Gestión / Resolución (Opcional)</label>
          <input id="quick-status-note" class="form-input form-input--no-icon" placeholder="Ej: Aprobado mediante resolución de vacaciones..." value="${escHtml(r.observaciones || '')}" />
        </div>
      </div>`;

    App.openModal('Gestión Rápida de Estado', bodyHtml, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
    ]);
  }

  async function selectQuickStatus(id, newStatus) {
    const note = document.getElementById('quick-status-note')?.value.trim();
    try {
      await API.updateRequestStatus(id, newStatus, note);
      App.closeModal();
      App.showToast(`Estado de solicitud actualizado a "${newStatus}".`, 'success');
      await load();
    } catch (err) {
      App.showToast(err.message || 'Error al cambiar estado.', 'error');
    }
  }

  const EXCEL_COLUMNS = [
    { header: 'Radicado', key: 'radicado', width: 20, sample: 'VAC-2026-00101' },
    { header: 'Cédula', key: 'documento', width: 15, sample: '1049601234' },
    { header: 'Servidor Público', key: 'persona', width: 32, sample: 'PEREZ RODRIGUEZ JUAN CARLOS' },
    { header: 'Dependencia', key: 'dependencia', width: 30, sample: 'SECRETARÍA DE HACIENDA' },
    { header: 'Cargo', key: 'cargo', width: 26, sample: 'PROFESIONAL UNIVERSITARIO' },
    { header: 'Fecha Inicio', key: 'fechaInicio', width: 16, sample: '10/05/2026' },
    { header: 'Días', key: 'dias', width: 10, sample: '15' },
    { header: 'Tipo', key: 'tipo', width: 18, sample: 'Vacaciones' },
    { header: 'Estado', key: 'estado', width: 16, sample: 'Pendiente' },
    { header: 'Observaciones', key: 'notas', width: 32, sample: 'Periodo 2025-2026' },
  ];

  async function exportExcel() {
    try {
      App.showToast('Generando archivo Excel...', 'info');
      const res = await API.getRequests({ ...state.filters, page: 1, limit: 10000 });
      const records = res.data || state.data;
      ExcelService.exportToExcel({
        filename: 'Talento360_Solicitudes_Vacaciones',
        sheetName: 'Vacaciones',
        columns: EXCEL_COLUMNS,
        data: records
      });
      App.showToast(`Se exportaron ${records.length} solicitudes de vacaciones exitosamente.`, 'success');
    } catch (err) {
      App.showToast('Error al exportar: ' + err.message, 'error');
    }
  }

  function openImportModal() {
    ExcelService.openImportModal({
      title: 'Carga Masiva de Solicitudes de Vacaciones',
      subtitle: 'Importe solicitudes de vacaciones de funcionarios a la plataforma mediante un archivo Excel (.xlsx / .xls)',
      moduleName: 'vacaciones',
      columns: EXCEL_COLUMNS.filter(c => c.key !== 'radicado'),
      sampleRows: [
        {
          'Cédula': '1049612345',
          'Servidor Público': 'GOMEZ PEREZ ANDREA PAOLA',
          'Dependencia': 'SECRETARÍA DE EDUCACIÓN',
          'Cargo': 'AUXILIAR ADMINISTRATIVO',
          'Fecha Inicio': '01/06/2026',
          'Días': '15',
          'Tipo': 'Vacaciones',
          'Estado': 'Pendiente',
          'Observaciones': 'Disfrute de primer periodo 2025'
        },
        {
          'Cédula': '79850123',
          'Servidor Público': 'RODRIGUEZ MARTINEZ LUIS FERNANDO',
          'Dependencia': 'SECRETARÍA GENERAL',
          'Cargo': 'PROFESIONAL ESPECIALIZADO',
          'Fecha Inicio': '15/07/2026',
          'Días': '10',
          'Tipo': 'Vacaciones',
          'Estado': 'Aprobada',
          'Observaciones': 'Resolución 104 de 2026'
        }
      ],
      validateRow: (row) => {
        const documento = (row['Cédula'] || row.documento || row.cedula || row['Documento'] || '').toString().trim();
        const persona = (row['Servidor Público'] || row.persona || row.nombreCompleto || row['Nombre Completo'] || '').toString().trim();
        const dependencia = (row['Dependencia'] || row.dependencia || '').toString().trim();
        if (!documento || !persona || !dependencia) {
          return { valid: false, error: 'Cédula, Servidor y Dependencia son requeridos.' };
        }
        return {
          valid: true,
          cleanRow: {
            documento,
            persona,
            dependencia,
            cargo: (row['Cargo'] || row.cargo || '').toString().trim(),
            fechaInicio: (row['Fecha Inicio'] || row.fechaInicio || '').toString().trim(),
            diasTotales: parseInt(row['Días'] || row.diasTotales || row.dias || 1) || 1,
            tipo: (row['Tipo'] || row.tipo || 'Vacaciones').toString().trim(),
            estado: (row['Estado'] || row.estado || 'Pendiente').toString().trim(),
            observaciones: (row['Observaciones'] || row.observaciones || row.notas || '').toString().trim()
          }
        };
      },
      onImport: async (rows) => {
        const res = await API.bulkCreateRequests(rows);
        App.showToast(res.message || `${res.inserted} solicitudes importadas.`, 'success');
        await load();
      }
    });
  }

  return { render, openCreate, openView, openEdit, openStatusPicker, selectQuickStatus, confirmDelete, applyFilters, clearFilters, goPage, exportExcel, openImportModal, toggleActionsDropdown, closeActionsDropdown, handleDropdownKeydown };
})();
