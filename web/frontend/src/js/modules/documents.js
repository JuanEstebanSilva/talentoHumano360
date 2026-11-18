/* ═══════════════════════════════════════════════════════════════════════════
   documents.js — Gestión documental: repositorio, bandeja y expediente
   ═══════════════════════════════════════════════════════════════════════════ */

const DocumentsModule = (() => {
  const ICONS = {
    view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  };

  const ACCEPTED_FILES = '.pdf,.jpg,.jpeg,.png,.docx,.xlsx';
  const MAX_SIZE = 25 * 1024 * 1024;

  const state = {
    tab: 'repositorio',
    page: 1,
    totalPages: 1,
    total: 0,
    filters: {},
    data: [],
    tipos: [],
    expediente: null,
    previewUrl: null,
  };

  // ─── Utilidades ────────────────────────────────────────────────────────────
  // Todo usuario registrado usa Gestión Documental (decisión de la entidad).
  const canWrite = () => Auth.isLoggedIn();

  function canManageTypes() {
    const user = Auth.getUser();
    const role = (user.role || '').toLowerCase();
    const mods = Auth.getUserModules(user);
    return role.includes('administrador') || role.includes('coordinador')
      || mods.includes('*') || mods.includes('all') || mods.includes('documents_sensitive');
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDateTime(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  function formatDate(value) {
    if (!value) return '—';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }

  function showError(prefix, err) {
    App.showToast(escHtml(`${prefix}: ${err.message}`), 'error');
  }

  function emptyRow(colspan, title, desc) {
    return `<tr><td colspan="${colspan}"><div class="empty-state">${ICONS.empty}
      <span class="empty-state-title">${escHtml(title)}</span>
      <span class="empty-state-desc">${escHtml(desc)}</span></div></td></tr>`;
  }

  function loadingRow(colspan) {
    return `<tr aria-busy="true"><td colspan="${colspan}"><div class="skeleton skeleton-line" style="width:100%;height:18px;"></div></td></tr>`;
  }

  function actionButton(cls, icon, title, handler) {
    return `<button type="button" class="${cls}" onclick="DocumentsModule.${handler}" title="${escHtml(title)}" aria-label="${escHtml(title)}">${icon}</button>`;
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function tipoOptions(selectedId, placeholder) {
    const groups = new Map();
    state.tipos.filter(t => t.activo || t.id === selectedId).forEach(t => {
      if (!groups.has(t.categoria)) groups.set(t.categoria, []);
      groups.get(t.categoria).push(t);
    });
    const options = [...groups.entries()].map(([categoria, tipos]) => `
      <optgroup label="${escHtml(categoria)}">
        ${tipos.map(t => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${escHtml(t.nombre)}${t.esSensible ? ' (sensible)' : ''}</option>`).join('')}
      </optgroup>`).join('');
    return `<option value="">${escHtml(placeholder)}</option>${options}`;
  }

  // Campo de búsqueda de servidor reutilizado en carga, clasificación y expediente.
  function serverSearchHtml(prefix, label, selected) {
    return `
      <label class="form-label" for="${prefix}-search">${escHtml(label)}</label>
      <div class="doc-search">
        <input id="${prefix}-search" class="form-input form-input--no-icon" placeholder="Nombre o cédula del servidor..." autocomplete="off" />
        <div id="${prefix}-results" class="doc-search-results" hidden></div>
      </div>
      <div id="${prefix}-selected" class="doc-search-selected">${selected ? `Seleccionado: ${escHtml(selected.nombre)} · C.C. ${escHtml(selected.cedula)}` : ''}</div>
      <input type="hidden" id="${prefix}-cedula" value="${escHtml(selected?.cedula || '')}" />`;
  }

  function bindServerSearch(prefix, onSelect) {
    const input = document.getElementById(`${prefix}-search`);
    const results = document.getElementById(`${prefix}-results`);
    if (!input || !results) return;
    let timer = null;
    let lastQuery = 0;

    const hide = () => { results.hidden = true; };

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { hide(); return; }
      timer = setTimeout(async () => {
        const queryId = ++lastQuery;
        try {
          const res = await API.buscarServidor(q, 8);
          if (queryId !== lastQuery) return;
          const rows = res.data || [];
          results.innerHTML = rows.length
            ? rows.map((r, i) => `
                <button type="button" class="doc-search-option" data-index="${i}">
                  ${escHtml(r.nombre_completo || r.nombreCompleto)}
                  <small>C.C. ${escHtml(r.cedula)} · ${escHtml(r.dependencia || '')}</small>
                </button>`).join('')
            : '<div class="doc-search-option">Sin resultados</div>';
          results.hidden = false;
          results.querySelectorAll('button[data-index]').forEach(btn => {
            btn.addEventListener('click', () => {
              const row = rows[Number(btn.dataset.index)];
              const selected = { cedula: row.cedula, nombre: row.nombre_completo || row.nombreCompleto };
              const hiddenField = document.getElementById(`${prefix}-cedula`);
              const label = document.getElementById(`${prefix}-selected`);
              if (hiddenField) hiddenField.value = selected.cedula;
              if (label) label.textContent = `Seleccionado: ${selected.nombre} · C.C. ${selected.cedula}`;
              input.value = '';
              hide();
              if (onSelect) onSelect(selected);
            });
          });
        } catch (err) {
          showError('No se pudo buscar el servidor', err);
        }
      }, 250);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    input.addEventListener('blur', () => setTimeout(hide, 200));
  }

  // ─── Render principal ──────────────────────────────────────────────────────
  async function render(container) {
    state.tab = 'repositorio';
    state.page = 1;
    state.filters = {};
    state.expediente = null;

    const tabs = [
      { id: 'repositorio', label: 'Repositorio' },
      ...(canWrite() ? [{ id: 'bandeja', label: 'Bandeja de clasificación' }] : []),
      { id: 'expediente', label: 'Expediente por servidor' },
    ];

    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <h1 class="page-heading">Gestión Documental</h1>
            <p class="page-desc">Repositorio de documentos de Talento Humano con versiones y registro de accesos</p>
          </div>
          <div class="page-actions" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            ${canManageTypes() ? '<button type="button" class="btn btn-secondary" onclick="DocumentsModule.openTypes()">Tipos de documento</button>' : ''}
            ${canWrite() ? `<button type="button" class="btn btn-primary btn-primary-cta" onclick="DocumentsModule.openUpload()">${ICONS.upload}<span>Cargar documentos</span></button>` : ''}
          </div>
        </div>
        <div class="module-tabs" role="tablist" aria-label="Vistas de documentos">
          ${tabs.map(t => `
            <button type="button" class="tab-btn ${t.id === state.tab ? 'active' : ''}" role="tab" id="doc-tab-${t.id}"
              aria-selected="${t.id === state.tab}" onclick="DocumentsModule.switchTab('${t.id}')">
              ${t.label}${t.id === 'bandeja' ? '<span class="doc-tab-count" id="doc-pending-count" hidden></span>' : ''}
            </button>`).join('')}
        </div>
        <div id="doc-view"></div>
      </div>`;

    try {
      const res = await API.getDocumentTypes();
      state.tipos = res.data || [];
    } catch (err) {
      showError('No se pudieron cargar los tipos de documento', err);
    }
    renderView();
    refreshSummary();
  }

  async function refreshSummary() {
    try {
      const summary = await API.getDocumentsSummary();
      const badge = document.getElementById('doc-pending-count');
      if (badge) {
        badge.textContent = summary.pendientes;
        badge.hidden = summary.pendientes === 0;
      }
    } catch (_) { /* El contador es informativo: su fallo no bloquea la pantalla. */ }
  }

  function switchTab(tab) {
    state.tab = tab;
    state.page = 1;
    state.filters = {};
    document.querySelectorAll('.module-tabs .tab-btn').forEach(btn => {
      const isActive = btn.id === `doc-tab-${tab}`;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
    renderView();
  }

  function renderView() {
    if (state.tab === 'bandeja') renderInbox();
    else if (state.tab === 'expediente') renderExpediente();
    else renderRepository();
  }

  function refresh() {
    refreshSummary();
    if (state.tab === 'expediente') return loadExpediente();
    return loadTable();
  }

  // ─── Repositorio ───────────────────────────────────────────────────────────
  function renderRepository() {
    const view = document.getElementById('doc-view');
    if (!view) return;
    view.innerHTML = `
      <div class="filters-card">
        <div class="filters-row">
          <div class="filter-group" style="flex:2">
            <label class="filter-label" for="doc-q">Buscar</label>
            <input id="doc-q" class="filter-input" placeholder="Título, servidor, cédula o archivo..." />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="doc-tipo">Tipo</label>
            <select id="doc-tipo" class="filter-select">${tipoOptions(null, 'Todos')}</select>
          </div>
          <button type="button" class="btn btn-primary" onclick="DocumentsModule.applyFilters()">Filtrar</button>
          <button type="button" class="btn btn-secondary" onclick="DocumentsModule.clearFilters()">Limpiar</button>
        </div>
      </div>
      <div class="table-card">
        <div class="table-header">
          <span class="table-title">Documentos clasificados</span>
          <span class="table-count" id="doc-count"></span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Documento</th><th>Servidor público</th><th>Tipo</th><th>Fecha</th><th>Versión</th><th>Cargado</th><th>Acciones</th>
            </tr></thead>
            <tbody id="doc-tbody">${loadingRow(7)}</tbody>
          </table>
        </div>
        <div class="pagination" id="doc-pagination"></div>
      </div>`;
    document.getElementById('doc-q')?.addEventListener('keypress', e => { if (e.key === 'Enter') applyFilters(); });
    loadTable();
  }

  function applyFilters() {
    state.filters = {};
    const q = document.getElementById('doc-q')?.value.trim();
    const idTipo = document.getElementById('doc-tipo')?.value;
    if (q) state.filters.q = q;
    if (idTipo) state.filters.idTipo = idTipo;
    state.page = 1;
    loadTable();
  }

  function clearFilters() {
    const q = document.getElementById('doc-q');
    const tipo = document.getElementById('doc-tipo');
    if (q) q.value = '';
    if (tipo) tipo.value = '';
    state.filters = {};
    state.page = 1;
    loadTable();
  }

  function goPage(page) {
    if (page < 1 || page > state.totalPages) return;
    state.page = page;
    loadTable();
  }

  async function loadTable() {
    const tbody = document.getElementById('doc-tbody') || document.getElementById('doc-inbox-tbody');
    if (!tbody) return;
    const inbox = state.tab === 'bandeja';
    try {
      const res = await API.getDocuments({
        ...state.filters,
        estado: inbox ? 'Pendiente' : 'Clasificado',
        page: state.page,
        limit: inbox ? 100 : 20,
      });
      state.data = res.data || [];
      state.total = res.total || 0;
      state.totalPages = res.totalPages || 1;
      if (inbox) drawInboxRows();
      else drawRepositoryRows();
    } catch (err) {
      tbody.innerHTML = emptyRow(inbox ? 4 : 7, 'No se pudieron cargar los documentos', err.message);
    }
  }

  function documentActions(d) {
    return `<div class="td-actions-wrap">
      ${actionButton('btn-action-view', ICONS.view, 'Ver detalle', `openDetail(${d.id})`)}
      ${actionButton('btn-action-soporte', ICONS.download, 'Descargar', `download(${d.id})`)}
      ${canWrite() ? actionButton('btn-action-edit', ICONS.edit, 'Editar', `openEdit(${d.id})`) : ''}
      ${canWrite() ? actionButton('btn-action-delete', ICONS.remove, 'Eliminar', `confirmDelete(${d.id})`) : ''}
    </div>`;
  }

  function drawRepositoryRows() {
    const tbody = document.getElementById('doc-tbody');
    if (!tbody) return;
    tbody.innerHTML = state.data.length
      ? state.data.map(d => `
        <tr>
          <td>
            <span class="td-primary">${escHtml(d.titulo)}</span>
            <span class="doc-file-name">${escHtml(d.nombreArchivo)} · ${formatBytes(d.tamanoBytes)}</span>
          </td>
          <td>
            <div class="user-table-cell">
              <span class="td-primary">${escHtml(d.nombreServidor || '—')}</span>
              <span class="user-table-cc font-mono">C.C. ${escHtml(d.cedula || '—')}</span>
            </div>
          </td>
          <td><span class="badge badge--revision">${escHtml(d.tipoNombre || '—')}</span>${d.esSensible ? ' <span class="badge badge--rechazada">Sensible</span>' : ''}</td>
          <td>${formatDate(d.fechaDocumento)}</td>
          <td>v${d.versionActual}</td>
          <td>${formatDateTime(d.subidoEn)}</td>
          <td class="td-actions">${documentActions(d)}</td>
        </tr>`).join('')
      : emptyRow(7, 'No hay documentos', 'No se encontraron documentos con los filtros aplicados.');

    const count = document.getElementById('doc-count');
    if (count) count.textContent = `${state.total.toLocaleString('es-CO')} documentos`;

    const pagination = document.getElementById('doc-pagination');
    if (pagination) {
      pagination.innerHTML = `
        <span class="pagination-info">Mostrando ${state.data.length} de ${state.total.toLocaleString('es-CO')}</span>
        <div class="pagination-btns">
          <button type="button" class="page-btn" aria-label="Página anterior" onclick="DocumentsModule.goPage(${state.page - 1})" ${state.page <= 1 ? 'disabled' : ''}>‹</button>
          <span class="page-btn active">${state.page}</span>
          <span style="color:var(--text-muted);font-size:var(--text-sm)">/ ${state.totalPages}</span>
          <button type="button" class="page-btn" aria-label="Página siguiente" onclick="DocumentsModule.goPage(${state.page + 1})" ${state.page >= state.totalPages ? 'disabled' : ''}>›</button>
        </div>`;
    }
  }

  // ─── Bandeja de clasificación ──────────────────────────────────────────────
  function renderInbox() {
    const view = document.getElementById('doc-view');
    if (!view) return;
    view.innerHTML = `
      <div class="table-card">
        <div class="table-header">
          <span class="table-title">Documentos por clasificar</span>
          <button type="button" class="btn btn-secondary" id="doc-confirm-all" onclick="DocumentsModule.confirmAllSuggestions()" hidden>Confirmar sugerencias completas</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Archivo</th><th>Servidor público</th><th>Tipo</th><th>Acciones</th></tr></thead>
            <tbody id="doc-inbox-tbody">${loadingRow(4)}</tbody>
          </table>
        </div>
      </div>`;
    loadTable();
  }

  // Combina lo ya elegido en el documento con lo que sugiere el sistema.
  function proposal(d) {
    return {
      cedula: d.cedula || d.sugerencia?.cedula || null,
      nombre: d.nombreServidor || d.sugerencia?.nombreServidor || null,
      idTipo: d.idTipo || d.sugerencia?.idTipo || null,
      tipoNombre: d.tipoNombre || d.sugerencia?.tipoNombre || null,
    };
  }

  function drawInboxRows() {
    const tbody = document.getElementById('doc-inbox-tbody');
    if (!tbody) return;
    if (!state.data.length) {
      tbody.innerHTML = emptyRow(4, 'Bandeja al día', 'No hay documentos pendientes de clasificar.');
    } else {
      tbody.innerHTML = state.data.map(d => {
        const p = proposal(d);
        const complete = p.cedula && p.idTipo;
        return `
          <tr>
            <td>
              <span class="td-primary">${escHtml(d.nombreArchivo)}</span>
              <span class="doc-file-name">${formatBytes(d.tamanoBytes)} · ${formatDateTime(d.subidoEn)} · ${escHtml(d.subidoPor)}</span>
            </td>
            <td>${p.cedula
              ? `<span class="${d.cedula ? '' : 'doc-suggested'}">${escHtml(p.nombre)}<br><small>C.C. ${escHtml(p.cedula)}${d.cedula ? '' : ' · sugerido'}</small></span>`
              : '<span class="doc-missing">Sin identificar</span>'}</td>
            <td>${p.idTipo
              ? `<span class="${d.idTipo ? '' : 'doc-suggested'}">${escHtml(p.tipoNombre)}${d.idTipo ? '' : ' · sugerido'}</span>`
              : '<span class="doc-missing">Sin identificar</span>'}</td>
            <td class="td-actions"><div class="td-actions-wrap">
              ${complete ? `<button type="button" class="btn btn-primary btn-sm" onclick="DocumentsModule.confirmSuggestion(${d.id})">Confirmar</button>` : ''}
              <button type="button" class="btn btn-secondary btn-sm" onclick="DocumentsModule.openEdit(${d.id})">Clasificar</button>
              ${actionButton('btn-action-view', ICONS.view, 'Vista previa', `preview(${d.id})`)}
              ${actionButton('btn-action-delete', ICONS.remove, 'Eliminar', `confirmDelete(${d.id})`)}
            </div></td>
          </tr>`;
      }).join('');
    }
    const confirmAll = document.getElementById('doc-confirm-all');
    if (confirmAll) confirmAll.hidden = !state.data.some(d => { const p = proposal(d); return p.cedula && p.idTipo; });
  }

  async function confirmSuggestion(id) {
    const d = state.data.find(x => x.id === id);
    if (!d) return;
    const p = proposal(d);
    try {
      await API.updateDocument(id, { cedula: p.cedula, idTipo: p.idTipo });
      App.showToast('Documento clasificado.', 'success');
      await refresh();
    } catch (err) {
      showError('No se pudo clasificar', err);
    }
  }

  async function confirmAllSuggestions() {
    const items = state.data.filter(d => { const p = proposal(d); return p.cedula && p.idTipo; });
    let done = 0;
    let failed = 0;
    for (const d of items) {
      const p = proposal(d);
      try {
        await API.updateDocument(d.id, { cedula: p.cedula, idTipo: p.idTipo });
        done++;
      } catch (_) {
        failed++;
      }
    }
    App.showToast(`${done} documentos clasificados${failed ? `, ${failed} con error` : ''}.`, failed ? 'warning' : 'success');
    await refresh();
  }

  // ─── Expediente por servidor ───────────────────────────────────────────────
  function renderExpediente() {
    const view = document.getElementById('doc-view');
    if (!view) return;
    view.innerHTML = `
      <div class="filters-card">
        <div class="form-group">${serverSearchHtml('doc-exp', 'Servidor público', state.expediente)}</div>
      </div>
      <div id="doc-exp-content"></div>`;
    bindServerSearch('doc-exp', (selected) => {
      state.expediente = selected;
      loadExpediente();
    });
    if (state.expediente) loadExpediente();
  }

  async function loadExpediente() {
    const content = document.getElementById('doc-exp-content');
    if (!content || !state.expediente) return;
    content.innerHTML = '<div class="table-card"><div class="skeleton skeleton-line" style="width:100%;height:18px;"></div></div>';
    try {
      const res = await API.getDocuments({ cedula: state.expediente.cedula, estado: 'Clasificado', limit: 200 });
      state.data = res.data || [];
      if (!state.data.length) {
        content.innerHTML = `<div class="table-card"><div class="empty-state">${ICONS.empty}
          <span class="empty-state-title">Expediente vacío</span>
          <span class="empty-state-desc">Este servidor aún no tiene documentos clasificados.</span></div></div>`;
        return;
      }
      const groups = new Map();
      state.data.forEach(d => {
        const key = d.tipoCategoria || 'General';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(d);
      });
      content.innerHTML = [...groups.entries()].map(([categoria, docs]) => `
        <section class="doc-expediente-group">
          <h2 class="doc-expediente-title">${escHtml(categoria)} (${docs.length})</h2>
          <div class="table-card"><div class="table-wrap"><table>
            <thead><tr><th>Documento</th><th>Tipo</th><th>Fecha</th><th>Versión</th><th>Acciones</th></tr></thead>
            <tbody>${docs.map(d => `
              <tr>
                <td><span class="td-primary">${escHtml(d.titulo)}</span><span class="doc-file-name">${escHtml(d.nombreArchivo)}</span></td>
                <td>${escHtml(d.tipoNombre || '—')}${d.esSensible ? ' <span class="badge badge--rechazada">Sensible</span>' : ''}</td>
                <td>${formatDate(d.fechaDocumento)}</td>
                <td>v${d.versionActual}</td>
                <td class="td-actions">${documentActions(d)}</td>
              </tr>`).join('')}</tbody>
          </table></div></div>
        </section>`).join('');
    } catch (err) {
      content.innerHTML = '';
      showError('No se pudo cargar el expediente', err);
    }
  }

  // ─── Carga de archivos ─────────────────────────────────────────────────────
  function openUpload() {
    const body = `
      <p class="page-desc" style="margin-top:0">
        Si indicas servidor y tipo, los archivos quedan clasificados. Si no, pasan a la bandeja con una
        sugerencia basada en su nombre (por ejemplo <code>HOJA_DE_VIDA_1057123456.pdf</code>).
      </p>
      <div class="form-grid">
        <div class="form-group span-2">${serverSearchHtml('doc-up', 'Servidor público (opcional)')}</div>
        <div class="form-group span-2">
          <label class="form-label" for="doc-up-tipo">Tipo de documento (opcional)</label>
          <select id="doc-up-tipo" class="filter-select">${tipoOptions(null, 'Sin definir')}</select>
        </div>
      </div>
      <button type="button" class="doc-dropzone" id="doc-dropzone" style="margin-top:var(--space-4)">
        Arrastra aquí los archivos o haz clic para seleccionarlos
        <small>PDF, JPG, PNG, DOCX o XLSX · máximo 25 MB por archivo</small>
      </button>
      <input type="file" id="doc-up-files" accept="${ACCEPTED_FILES}" multiple hidden />
      <ul class="doc-upload-list" id="doc-up-list"></ul>`;

    App.openModal('Cargar documentos', body, [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => { App.closeModal(); refresh(); } },
      { text: 'Cargar', cls: 'btn-primary', id: 'doc-up-submit', action: submitUpload },
    ]);

    state.pendingFiles = [];
    const dropzone = document.getElementById('doc-dropzone');
    const input = document.getElementById('doc-up-files');
    bindServerSearch('doc-up');
    dropzone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, e => {
      e.preventDefault();
      dropzone.classList.add('is-over');
    }));
    ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, e => {
      e.preventDefault();
      dropzone.classList.remove('is-over');
    }));
    dropzone.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  }

  function addFiles(fileList) {
    [...fileList].forEach(file => {
      const tooBig = file.size > MAX_SIZE;
      state.pendingFiles.push({ file, status: tooBig ? 'error' : 'ready', message: tooBig ? 'Supera 25 MB' : 'Listo para cargar' });
    });
    drawUploadList();
  }

  function drawUploadList() {
    const list = document.getElementById('doc-up-list');
    if (!list) return;
    list.innerHTML = state.pendingFiles.map(item => `
      <li class="doc-upload-item">
        <span>${escHtml(item.file.name)}</span>
        <span class="doc-upload-status ${item.status === 'done' ? 'is-ok' : ''} ${item.status === 'error' ? 'is-error' : ''}" role="status">${escHtml(item.message)}</span>
      </li>`).join('');
  }

  // Un archivo a la vez: evita el límite por petición y muestra el resultado de cada uno.
  async function submitUpload() {
    const items = state.pendingFiles.filter(i => i.status === 'ready');
    if (!items.length) {
      App.showToast('Selecciona al menos un archivo.', 'warning');
      return;
    }
    const button = document.getElementById('doc-up-submit');
    if (button) button.disabled = true;
    const fields = {
      cedula: document.getElementById('doc-up-cedula')?.value || '',
      idTipo: document.getElementById('doc-up-tipo')?.value || '',
    };
    for (const item of items) {
      item.message = 'Cargando...';
      drawUploadList();
      try {
        const doc = await API.uploadDocument(item.file, fields);
        item.status = 'done';
        if (doc.protegido) item.message = 'En bandeja protegida: lo clasifica quien tenga permiso sobre documentos sensibles';
        else item.message = doc.estado === 'Clasificado' ? 'Clasificado' : 'En bandeja de clasificación';
      } catch (err) {
        item.status = 'error';
        item.message = err.message;
      }
      drawUploadList();
    }
    if (button) button.disabled = false;
    refreshSummary();
  }

  // ─── Detalle, vista previa y descarga ──────────────────────────────────────
  async function openDetail(id) {
    try {
      const d = await API.getDocument(id);
      const canPreview = /^(application\/pdf|image\/)/.test(d.mimeType);
      const body = `
        <div class="detail-modal-card">
          <div class="detail-grid">
            <div class="detail-item detail-grid--full"><span class="detail-label">Título</span><span class="detail-value">${escHtml(d.titulo)}</span></div>
            <div class="detail-item"><span class="detail-label">Servidor público</span><span class="detail-value">${escHtml(d.nombreServidor || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Cédula</span><span class="detail-value">${escHtml(d.cedula || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Tipo</span><span class="detail-value">${escHtml(d.tipoNombre || '—')}${d.esSensible ? ' (sensible)' : ''}</span></div>
            <div class="detail-item"><span class="detail-label">Fecha del documento</span><span class="detail-value">${formatDate(d.fechaDocumento)}</span></div>
            ${d.descripcion ? `<div class="detail-item detail-grid--full"><span class="detail-label">Descripción</span><span class="detail-value">${escHtml(d.descripcion)}</span></div>` : ''}
          </div>
        </div>
        <h3 class="doc-section-title">Versiones</h3>
        <ul class="doc-history">
          ${d.versiones.map(v => `
            <li>
              <span>
                v${v.numero} · ${escHtml(v.nombreArchivo)}
                <small>${formatBytes(v.tamanoBytes)} · ${formatDateTime(v.subidoEn)} · ${escHtml(v.subidoPor)}${v.nota ? ` · ${escHtml(v.nota)}` : ''}</small>
              </span>
              <button type="button" class="btn btn-secondary btn-sm" onclick="DocumentsModule.download(${d.id}, ${v.numero})">Descargar</button>
            </li>`).join('')}
        </ul>
        ${canWrite() ? `
          <h3 class="doc-section-title">Nueva versión</h3>
          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label" for="doc-ver-file">Archivo</label>
              <input type="file" id="doc-ver-file" class="form-input form-input--no-icon" accept="${ACCEPTED_FILES}" />
            </div>
            <div class="form-group span-2">
              <label class="form-label" for="doc-ver-note">Nota del cambio (opcional)</label>
              <input id="doc-ver-note" class="form-input form-input--no-icon" maxlength="500" />
            </div>
          </div>
          <button type="button" class="btn btn-secondary" id="doc-ver-submit" onclick="DocumentsModule.uploadVersion(${d.id})">Subir versión</button>` : ''}
        ${d.eventos.length ? `
          <h3 class="doc-section-title">Registro de accesos y cambios</h3>
          <ul class="doc-history">
            ${d.eventos.map(e => `
              <li><span>${escHtml(e.accion)}${e.detalle ? ` · ${escHtml(e.detalle)}` : ''}<small>${escHtml(e.usuario)} · ${formatDateTime(e.fecha)}</small></span></li>`).join('')}
          </ul>` : ''}`;
      const buttons = [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }];
      if (canPreview) buttons.push({ text: 'Vista previa', cls: 'btn-primary', action: () => preview(d.id) });
      App.openModal(`Documento · ${d.titulo}`, body, buttons);
    } catch (err) {
      showError('No se pudo abrir el documento', err);
    }
  }

  async function preview(id) {
    try {
      const blob = await API.getDocumentFile(id, { inline: true });
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = URL.createObjectURL(blob);
      let content;
      if (blob.type.startsWith('image/')) {
        content = `<img class="doc-preview-image" src="${state.previewUrl}" alt="Vista previa del documento" />`;
      } else if (blob.type === 'application/pdf') {
        content = `<iframe class="doc-preview-frame" src="${state.previewUrl}" title="Vista previa del documento"></iframe>`;
      } else {
        content = '<p>Este formato no tiene vista previa. Descárgalo para abrirlo.</p>';
      }
      App.openModal('Vista previa', content, [
        { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
        { text: 'Descargar', cls: 'btn-primary', action: () => download(id) },
      ]);
    } catch (err) {
      showError('No se pudo mostrar el documento', err);
    }
  }

  async function download(id, version) {
    try {
      const d = await API.getDocument(id);
      const selected = version ? d.versiones.find(v => v.numero === version) : d.versiones[0];
      const blob = await API.getDocumentFile(id, { version: selected?.numero });
      saveBlob(blob, selected?.nombreArchivo || d.nombreArchivo);
    } catch (err) {
      showError('No se pudo descargar el documento', err);
    }
  }

  async function uploadVersion(id) {
    const file = document.getElementById('doc-ver-file')?.files[0];
    if (!file) {
      App.showToast('Selecciona el archivo de la nueva versión.', 'warning');
      return;
    }
    if (file.size > MAX_SIZE) {
      App.showToast('El archivo supera el tamaño máximo de 25 MB.', 'error');
      return;
    }
    const button = document.getElementById('doc-ver-submit');
    if (button) button.disabled = true;
    try {
      const nota = document.getElementById('doc-ver-note')?.value.trim() || '';
      const res = await API.uploadDocumentVersion(id, file, nota);
      App.showToast(`Versión ${res.versionActual} cargada.`, 'success');
      await refresh();
      await openDetail(id);
    } catch (err) {
      showError('No se pudo cargar la versión', err);
      if (button) button.disabled = false;
    }
  }

  // ─── Clasificación y edición ───────────────────────────────────────────────
  async function openEdit(id) {
    try {
      const d = await API.getDocument(id);
      const p = proposal(d);
      const body = `
        <div class="form-grid">
          <div class="form-group span-2">
            <label class="form-label" for="doc-ed-titulo">Título *</label>
            <input id="doc-ed-titulo" class="form-input form-input--no-icon" maxlength="280" value="${escHtml(d.titulo)}" />
          </div>
          <div class="form-group span-2">${serverSearchHtml('doc-ed', 'Servidor público *', p.cedula ? { cedula: p.cedula, nombre: p.nombre } : null)}</div>
          <div class="form-group">
            <label class="form-label" for="doc-ed-tipo">Tipo de documento *</label>
            <select id="doc-ed-tipo" class="filter-select">${tipoOptions(p.idTipo, 'Selecciona un tipo')}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="doc-ed-fecha">Fecha del documento</label>
            <input id="doc-ed-fecha" class="form-input" type="date" value="${escHtml(d.fechaDocumento || '')}" />
          </div>
          <div class="form-group span-2">
            <label class="form-label" for="doc-ed-desc">Descripción</label>
            <input id="doc-ed-desc" class="form-input form-input--no-icon" maxlength="2000" value="${escHtml(d.descripcion || '')}" />
          </div>
        </div>`;
      App.openModal(d.estado === 'Pendiente' ? 'Clasificar documento' : 'Editar documento', body, [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        { text: 'Vista previa', cls: 'btn-secondary', action: () => preview(id) },
        { text: 'Guardar', cls: 'btn-primary', id: 'doc-ed-save', action: () => saveEdit(id, d) },
      ]);
      bindServerSearch('doc-ed');
    } catch (err) {
      showError('No se pudo abrir el documento', err);
    }
  }

  async function saveEdit(id, current) {
    const titulo = document.getElementById('doc-ed-titulo')?.value.trim();
    const cedula = document.getElementById('doc-ed-cedula')?.value;
    const idTipo = Number(document.getElementById('doc-ed-tipo')?.value) || null;
    if (!titulo) { App.showToast('El título es obligatorio.', 'warning'); return; }
    if (!cedula || !idTipo) { App.showToast('Indica el servidor y el tipo de documento.', 'warning'); return; }

    const payload = {
      titulo,
      descripcion: document.getElementById('doc-ed-desc')?.value || '',
      fechaDocumento: document.getElementById('doc-ed-fecha')?.value || '',
    };
    if (cedula !== current.cedula) payload.cedula = cedula;
    if (idTipo !== current.idTipo) payload.idTipo = idTipo;

    const button = document.getElementById('doc-ed-save');
    if (button) button.disabled = true;
    try {
      await API.updateDocument(id, payload);
      App.closeModal();
      App.showToast('Documento actualizado.', 'success');
      await refresh();
    } catch (err) {
      showError('No se pudo guardar', err);
      if (button) button.disabled = false;
    }
  }

  function confirmDelete(id) {
    const body = `
      <p>El documento dejará de aparecer en el sistema. El archivo y su historial se conservan para trazabilidad.</p>
      <div class="form-group">
        <label class="form-label" for="doc-del-reason">Motivo (opcional)</label>
        <input id="doc-del-reason" class="form-input form-input--no-icon" maxlength="500" />
      </div>`;
    App.openModal('Eliminar documento', body, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      {
        text: 'Eliminar',
        cls: 'btn-danger',
        action: async () => {
          try {
            await API.deleteDocument(id, document.getElementById('doc-del-reason')?.value.trim() || '');
            App.closeModal();
            App.showToast('Documento eliminado.', 'success');
            await refresh();
          } catch (err) {
            showError('No se pudo eliminar', err);
          }
        },
      },
    ]);
  }

  // ─── Tipos de documento ────────────────────────────────────────────────────
  async function reloadTypes() {
    const res = await API.getDocumentTypes();
    state.tipos = res.data || [];
  }

  function openTypes() {
    const rows = state.tipos.map(t => `
      <li>
        <span>
          ${escHtml(t.nombre)}${t.esSensible ? ' <span class="badge badge--rechazada">Sensible</span>' : ''}${t.activo ? '' : ' <span class="badge badge--pendiente">Inactivo</span>'}
          <small>${escHtml(t.categoria)}${t.palabrasClave ? ` · Palabras clave: ${escHtml(t.palabrasClave)}` : ''}</small>
        </span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="DocumentsModule.toggleType(${t.id}, ${!t.activo})">${t.activo ? 'Desactivar' : 'Activar'}</button>
      </li>`).join('');
    const body = `
      <ul class="doc-history">${rows}</ul>
      <h3 class="doc-section-title">Nuevo tipo</h3>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="doc-ty-name">Nombre *</label>
          <input id="doc-ty-name" class="form-input form-input--no-icon" maxlength="160" />
        </div>
        <div class="form-group">
          <label class="form-label" for="doc-ty-cat">Categoría</label>
          <input id="doc-ty-cat" class="form-input form-input--no-icon" maxlength="80" placeholder="General" />
        </div>
        <div class="form-group span-2">
          <label class="form-label" for="doc-ty-keys">Palabras clave para sugerir el tipo (separadas por comas)</label>
          <input id="doc-ty-keys" class="form-input form-input--no-icon" maxlength="1000" />
        </div>
        <div class="form-group span-2">
          <label><input type="checkbox" id="doc-ty-sensitive" /> Contiene datos sensibles (solo lo ven usuarios autorizados)</label>
        </div>
      </div>`;
    App.openModal('Tipos de documento', body, [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Crear tipo', cls: 'btn-primary', action: createType },
    ]);
  }

  async function createType() {
    const nombre = document.getElementById('doc-ty-name')?.value.trim();
    if (!nombre) { App.showToast('El nombre del tipo es obligatorio.', 'warning'); return; }
    try {
      await API.createDocumentType({
        nombre,
        categoria: document.getElementById('doc-ty-cat')?.value.trim() || 'General',
        palabrasClave: document.getElementById('doc-ty-keys')?.value.trim() || '',
        esSensible: Boolean(document.getElementById('doc-ty-sensitive')?.checked),
      });
      await reloadTypes();
      App.showToast('Tipo de documento creado.', 'success');
      openTypes();
    } catch (err) {
      showError('No se pudo crear el tipo', err);
    }
  }

  async function toggleType(id, activo) {
    try {
      await API.updateDocumentType(id, { activo });
      await reloadTypes();
      openTypes();
    } catch (err) {
      showError('No se pudo actualizar el tipo', err);
    }
  }

  return {
    render, switchTab, applyFilters, clearFilters, goPage,
    openUpload, openDetail, openEdit, openTypes, preview, download,
    uploadVersion, confirmDelete, confirmSuggestion, confirmAllSuggestions,
    toggleType,
  };
})();

window.DocumentsModule = DocumentsModule;
