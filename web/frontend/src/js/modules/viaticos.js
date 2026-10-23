/* ═══════════════════════════════════════════════════════════════════════════
   viaticos.js — Módulo de Viáticos (Talento 360)
   ═══════════════════════════════════════════════════════════════════════════ */

const ViaticosModule = (() => {
  const ESTADOS = ['Todos', 'Pendiente', 'En revisión', 'Aprobada', 'Finalizada', 'Rechazada'];
  const DEPENDENCIAS_LIST = [
    'Todas',
    'DESPACHO DEL GOBERNADOR',
    'SECRETARÍA DE HACIENDA',
    'SECRETARÍA DE PLANEACIÓN',
    'SECRETARÍA GENERAL',
    'SECRETARÍA DE INFRAESTRUCTURA',
    'SECRETARÍA DE EDUCACIÓN',
    'SECRETARÍA DE AGRICULTURA',
    'SECRETARÍA DE INTEGRACIÓN SOCIAL',
    'SECRETARÍA DE CULTURA Y PATRIMONIO',
    'SECRETARÍA DE MINAS Y ENERGÍA',
    'SECRETARÍA DE GOBIERNO Y ACCIÓN COMUNAL',
    'SECRETARÍA DE DESARROLLO EMPRESARIAL',
    'SECRETARÍA DE CONTRATACIÓN',
    'SECRETARÍA DE AMBIENTE Y DESARROLLO SOSTENIBLE',
    'SECRETARÍA DE TURISMO',
    'SECRETARÍA TIC Y GOBIERNO ABIERTO',
    'SECRETARÍA DE SALUD'
  ];

  let state = { data: [], total: 0, page: 1, totalPages: 1, filters: {} };
  let currentUploadedFile = null;
  let employeeSearchTimeout = null;

  function getInitials(name) {
    if (!name) return 'VT';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function formatCedulaDots(val) {
    if (!val) return '—';
    const clean = String(val).replace(/\D/g, '');
    if (!clean) return String(val);
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function sanitizeText(str) {
    if (!str) return '';
    return String(str).trim();
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

  // ─── Diccionario Geográfico de Colombia ──────────────────────────────────────
  const COLOMBIA_GEO = {
    'Boyacá': [
      'Tunja', 'Duitama', 'Sogamoso', 'Paipa', 'Chiquinquirá', 'Villa de Leyva',
      'Moniquirá', 'Puerto Boyacá', 'Garagoa', 'Guateque', 'Soatá', 'Samacá',
      'Nobsa', 'Tibasosa', 'Santa Rosa de Viterbo', 'Ventaquemada', 'Aquitania',
      'Belén', 'Chita', 'Cómbita', 'Miraflores', 'Muzo', 'Ramiriquí', 'Saboyá',
      'San Luis de Gaceno', 'Socha', 'Tenza', 'Toca', 'Turmequé', 'Umbita', 'Zetaquira', 'Otro municipio'
    ],
    'Bogotá D.C.': ['Bogotá D.C.'],
    'Cundinamarca': [
      'Bogotá D.C.', 'Soacha', 'Girardot', 'Zipaquirá', 'Facatativá', 'Chía',
      'Fusagasugá', 'Mosquera', 'Madrid', 'Funza', 'Cajicá', 'Ubaté', 'Tocancipá',
      'Sopó', 'Tabio', 'Tenjo', 'Cota', 'Villeta', 'La Mesa', 'Gachancipá', 'Otro municipio'
    ],
    'Antioquia': [
      'Medellín', 'Bello', 'Itagüí', 'Envigado', 'Rionegro', 'Apartadó', 'Turbo',
      'Caucasia', 'Sabaneta', 'La Estrella', 'Caldas', 'Guarne', 'Marinilla', 'Santa Fe de Antioquia', 'Otro municipio'
    ],
    'Santander': [
      'Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja',
      'San Gil', 'Socorro', 'Barbosa', 'Vélez', 'Málaga', 'Zapatoca', 'Barichara', 'Otro municipio'
    ],
    'Norte de Santander': [
      'Cúcuta', 'Ocaña', 'Pamplona', 'Villa del Rosario', 'Los Patios', 'Tibú', 'Chinácota', 'Otro municipio'
    ],
    'Valle del Cauca': [
      'Cali', 'Buenaventura', 'Palmira', 'Tuluá', 'Cartago', 'Buga', 'Jamundí', 'Yumbo', 'Sevilla', 'Otro municipio'
    ],
    'Atlántico': ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Baranoa', 'Puerto Colombia', 'Otro municipio'],
    'Bolívar': ['Cartagena', 'Magangué', 'El Carmen de Bolívar', 'Turbaco', 'Arjona', 'Mompox', 'Otro municipio'],
    'Caldas': ['Manizales', 'La Dorada', 'Chinchiná', 'Villamaría', 'Riosucio', 'Anserma', 'Salamina', 'Otro municipio'],
    'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia', 'Belén de Umbría', 'Otro municipio'],
    'Quindío': ['Armenia', 'Calarcá', 'La Tebaida', 'Montenegro', 'Quimbaya', 'Salento', 'Circasia', 'Filandia', 'Otro municipio'],
    'Tolima': ['Ibagué', 'Espinal', 'Melgar', 'Chaparral', 'Líbano', 'Mariquita', 'Honda', 'Flandes', 'Otro municipio'],
    'Huila': ['Neiva', 'Pitalito', 'Garzón', 'La Plata', 'Campoalegre', 'San Agustín', 'Otro municipio'],
    'Meta': ['Villavicencio', 'Acacías', 'Granada', 'Puerto López', 'San Martín', 'Puerto Gaitán', 'Otro municipio'],
    'Casanare': ['Yopal', 'Aguazul', 'Villanueva', 'Tauramena', 'Paz de Ariporo', 'Maní', 'Monterrey', 'Otro municipio'],
    'Arauca': ['Arauca', 'Tame', 'Saravena', 'Arauquita', 'Fortul', 'Otro municipio'],
    'Nariño': ['Pasto', 'Tumaco', 'Ipiales', 'Túquerres', 'La Unión', 'Sandoná', 'Otro municipio'],
    'Cauca': ['Popayán', 'Santander de Quilichao', 'Puerto Tejada', 'Patía', 'Piendamó', 'Guapi', 'Otro municipio'],
    'Cesar': ['Valledupar', 'Aguachica', 'Agustín Codazzi', 'Bosconia', 'Curumaní', 'Otro municipio'],
    'Córdoba': ['Montería', 'Lorica', 'Cereté', 'Sahagún', 'Montelíbano', 'Tierralta', 'Otro municipio'],
    'Magdalena': ['Santa Marta', 'Ciénaga', 'Fundación', 'Plato', 'El Banco', 'Aracataca', 'Otro municipio'],
    'La Guajira': ['Riohacha', 'Maicao', 'Uribia', 'Manaure', 'San Juan del Cesar', 'Fonseca', 'Otro municipio'],
    'Sucre': ['Sincelejo', 'Corozal', 'San Marcos', 'Tolú', 'Sampués', 'Coveñas', 'Otro municipio'],
    'Chocó': ['Quibdó', 'Istmina', 'Tadó', 'Condoto', 'Bahía Solano', 'Acandí', 'Otro municipio'],
    'Caquetá': ['Florencia', 'San Vicente del Caguán', 'Cartagena del Chairá', 'Puerto Rico', 'Belén de los Andaquíes', 'Otro municipio'],
    'Putumayo': ['Mocoa', 'Puerto Asís', 'Orito', 'Valle del Guamuez', 'Villagarzón', 'Sibundoy', 'Otro municipio'],
    'Amazonas': ['Leticia', 'Puerto Nariño', 'Otro municipio'],
    'Guainía': ['Inírida', 'Otro municipio'],
    'Guaviare': ['San José del Guaviare', 'Calamar', 'El Retorno', 'Miraflores', 'Otro municipio'],
    'Vaupés': ['Mitú', 'Carurú', 'Taraira', 'Otro municipio'],
    'Vichada': ['Puerto Carreño', 'La Primavera', 'Santa Rosalía', 'Cumaribo', 'Otro municipio'],
    'San Andrés y Providencia': ['San Andrés', 'Providencia']
  };

  const PAISES_INTERNACIONAL = [
    'Estados Unidos', 'España', 'México', 'Panamá', 'Brasil', 'Argentina',
    'Chile', 'Perú', 'Ecuador', 'Francia', 'Alemania', 'Reino Unido',
    'Canadá', 'Italia', 'Suiza', 'Costa Rica', 'Uruguay', 'Otro País'
  ];

  function badgeClass(estado) {
    const e = (estado || '').toLowerCase();
    if (e.includes('aprobad'))  return 'badge--aprobada';
    if (e.includes('finaliz'))  return 'badge--finalizada';
    if (e.includes('rechazad')) return 'badge--rechazada';
    if (e.includes('revis'))    return 'badge--revision';
    return 'badge--pendiente';
  }

  function formatCOP(n) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
  }

  function toIsoDate(dStr) {
    if (!dStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
    const parts = dStr.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return dStr;
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
        <td><div class="skeleton skeleton-line" style="width: 90px; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-line" style="width: 75px; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-line" style="width: 35px; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-line" style="width: 80px; height: 14px; font-weight:700;"></div></td>
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

  function renderStatsSkeletons() {
    return Array.from({ length: 3 }).map(() => `
      <div class="stat-card" role="progressbar" aria-busy="true" aria-label="Cargando estadísticas...">
        <div class="stat-icon skeleton" style="width: 48px; height: 48px; border-radius: 12px;" aria-hidden="true"></div>
        <div class="stat-info" style="display: flex; flex-direction: column; gap: 6px;">
          <span class="skeleton" style="width: 70px; height: 24px; border-radius: 4px; display: block;" aria-hidden="true"></span>
          <span class="skeleton" style="width: 95px; height: 12px; border-radius: 4px; display: block;" aria-hidden="true"></span>
        </div>
      </div>
    `).join('');
  }

  function renderSkeletonTable() {
    const tbody = document.getElementById('vit-tbody');
    if (!tbody) return;
    tbody.setAttribute('aria-busy', 'true');
    tbody.setAttribute('role', 'progressbar');
    tbody.setAttribute('aria-label', 'Cargando listado de viáticos...');
    tbody.setAttribute('aria-valuemin', '0');
    tbody.setAttribute('aria-valuemax', '100');
    tbody.setAttribute('aria-valuetext', 'Cargando datos del servidor...');
    const countEl = document.getElementById('vit-count');
    if (countEl) {
      countEl.innerHTML = `<span class="skeleton" style="width:110px;height:14px;border-radius:4px;display:inline-block;" aria-hidden="true"></span>`;
    }
    tbody.innerHTML = renderSkeletonRows(6);
  }

  function renderDetailModalSkeleton() {
    return `
      <div class="skeleton-detail-wrapper" role="progressbar" aria-busy="true" aria-label="Cargando detalles de viático...">
        <div class="skeleton-detail-header">
          <div class="skeleton skeleton-avatar--lg" aria-hidden="true"></div>
          <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
            <div class="skeleton skeleton-line skeleton-line--title" style="width:55%; height:18px;"></div>
            <div class="skeleton skeleton-line" style="width:35%; height:12px;"></div>
          </div>
          <div class="skeleton skeleton-badge" style="width:90px; height:26px;"></div>
        </div>
        <div class="skeleton-detail-section">
          <div class="skeleton skeleton-line skeleton-line--title" style="width:30%; height:15px; margin-bottom:10px;"></div>
          <div class="skeleton-detail-grid">
            <div class="skeleton-detail-item"><div class="skeleton skeleton-line" style="width:40%;height:10px;"></div><div class="skeleton skeleton-line" style="width:80%;height:14px;"></div></div>
            <div class="skeleton-detail-item"><div class="skeleton skeleton-line" style="width:45%;height:10px;"></div><div class="skeleton skeleton-line" style="width:75%;height:14px;"></div></div>
            <div class="skeleton-detail-item"><div class="skeleton skeleton-line" style="width:35%;height:10px;"></div><div class="skeleton skeleton-line" style="width:65%;height:14px;"></div></div>
            <div class="skeleton-detail-item"><div class="skeleton skeleton-line" style="width:50%;height:10px;"></div><div class="skeleton skeleton-line" style="width:70%;height:14px;"></div></div>
          </div>
        </div>
      </div>`;
  }

  async function load() {
    renderSkeletonTable();
    try {
      const res = await API.getViaticos({ page: state.page, limit: 20, ...state.filters });
      state.data = res.data || [];
      state.total = res.total || 0;
      state.totalPages = res.totalPages || 1;
      renderTable();
      renderPagination();
      const countEl = document.getElementById('vit-count');
      if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} registros`;
    } catch (err) { App.showToast('Error al cargar viáticos: ' + err.message, 'error'); }
  }

  function renderTable() {
    const tbody = document.getElementById('vit-tbody');
    if (!tbody) return;
    tbody.removeAttribute('role');
    tbody.setAttribute('aria-busy', 'false');
    if (!state.data.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        <span class="empty-state-title">No hay viáticos registrados</span>
        <span class="empty-state-desc">No se encontraron viáticos con los filtros aplicados.</span>
        </div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.data.map(r => `
      <tr>
        <td class="td-radicado">
          <span style="font-weight:700;">${r.radicado}</span>
          ${r.numeroResolucion ? `<span class="user-table-cc font-mono" style="font-size:11px;color:var(--text-muted);display:block;margin-top:2px;">Res. ${escHtml(r.numeroResolucion)}</span>` : ''}
        </td>
        <td>
          <div class="user-table-cell">
            <span class="td-primary" title="${r.persona}">${truncate(r.persona, 26) || '—'}</span>
            <span class="user-table-cc font-mono">${r.documento ? `C.C. ${r.documento}` : '—'}</span>
          </div>
        </td>
        <td title="${r.dependencia}">${truncate(r.dependencia, 24) || '—'}</td>
        <td title="${r.destino}">${truncate(r.destino, 20) || '—'}</td>
        <td>${r.fechaInicio || '—'}</td>
        <td>${r.dias ?? '—'} días</td>
        <td class="td-currency">${formatCOP(r.valorTotal)}</td>
        <td>
          <button type="button" class="badge badge--interactive ${badgeClass(r.estado)}" onclick="ViaticosModule.openStatusPicker(${r.id})" title="Clic para cambiar estado de este viático" aria-label="Cambiar estado: ${r.estado}">
            <span>${r.estado}</span>
            <svg class="badge-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </td>
        <td class="td-actions">
          <div class="td-actions-wrap">
            <button class="btn-action-view" onclick="ViaticosModule.openView(${r.id})" title="Ver Detalles del Viático">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            ${r.soporte ? `
            <button class="btn-action-soporte" onclick="ViaticosModule.viewSoporte(${r.id})" title="Ver Factura / Soporte Adjunto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>` : ''}
            <button class="btn-action-edit" onclick="ViaticosModule.openEdit(${r.id})" title="Editar Viático">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${Auth.canEdit() ? `<button class="btn-action-delete" onclick="ViaticosModule.confirmDelete(${r.id},'${escHtml(r.persona)}')" title="Eliminar Viático">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  }

  function renderPagination() {
    const el = document.getElementById('vit-pagination');
    if (!el) return;
    el.innerHTML = `
      <span class="pagination-info">Mostrando ${state.data.length} de ${state.total.toLocaleString('es-CO')}</span>
      <div class="pagination-btns">
        <button class="page-btn" onclick="ViaticosModule.goPage(${state.page-1})" ${state.page<=1?'disabled':''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
        <span class="page-btn active">${state.page}</span>
        <span style="color:var(--text-muted);font-size:var(--text-sm)">/ ${state.totalPages}</span>
        <button class="page-btn" onclick="ViaticosModule.goPage(${state.page+1})" ${state.page>=state.totalPages?'disabled':''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>`;
  }

  // ─── Construcción de Formulario Inteligente ──────────────────────────────────
  function buildForm(r = {}) {
    const dis = Auth.canEdit() ? '' : 'disabled';
    currentUploadedFile = r.soporte || null;

    const isIntl = r.tipoDestino === 'Internacional' || (r.destino && PAISES_INTERNACIONAL.some(p => r.destino.includes(p)));
    const defaultDepto = 'Boyacá';

    return `
      <div class="form-grid">
        <!-- Servidor con Autocompletado -->
        <div class="form-group span-2 autocomplete-wrapper">
          <label class="form-label">Nombre Completo del Servidor * <span style="font-size:11px;color:var(--color-primary-400);font-weight:400;">(Escribe para autocompletar cédula, cargo y dependencia)</span></label>
          <input id="vf-nombre" class="form-input" placeholder="Escribe el nombre o cédula del funcionario..." value="${escHtml(r.persona||'')}" oninput="ViaticosModule.onNombreInput(this.value)" autocomplete="off" ${dis} required />
          <div id="vf-autocomplete-list" class="autocomplete-dropdown" style="display:none;"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Documento de Identidad (C.C.)</label>
          <input id="vf-doc" class="form-input" placeholder="Número de cédula" value="${escHtml(r.documento||'')}" ${dis} />
        </div>

        <div class="form-group">
          <label class="form-label">Cargo Actual</label>
          <input id="vf-cargo" class="form-input" placeholder="Cargo del servidor..." value="${escHtml(r.cargo||'')}" ${dis} />
        </div>

        <div class="form-group span-2">
          <label class="form-label">Dependencia / Secretaría</label>
          <input id="vf-dep" class="form-input" placeholder="Secretaría o Dependencia institucional..." value="${escHtml(r.dependencia||'')}" ${dis} />
        </div>

        <!-- Selector de Destino: Nacional vs Internacional -->
        <div class="form-group span-2">
          <label class="form-label">Tipo de Desplazamiento *</label>
          <div class="dest-toggle-group">
            <label class="dest-toggle-opt">
              <input type="radio" name="vf-tipo-dest" value="Nacional" ${!isIntl ? 'checked' : ''} onchange="ViaticosModule.onTipoDestinoChange('Nacional')" ${dis}>
              <span class="dest-toggle-pill">🇨🇴 Destino Nacional (Colombia)</span>
            </label>
            <label class="dest-toggle-opt">
              <input type="radio" name="vf-tipo-dest" value="Internacional" ${isIntl ? 'checked' : ''} onchange="ViaticosModule.onTipoDestinoChange('Internacional')" ${dis}>
              <span class="dest-toggle-pill">🌐 Destino Internacional</span>
            </label>
          </div>
        </div>

        <!-- Destino Nacional -->
        <div id="vf-dest-nacional" class="form-subgrid span-2" style="display:${!isIntl ? 'grid' : 'none'}; grid-template-columns:1fr 1fr; gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Departamento *</label>
            <select id="vf-depto" class="filter-select" onchange="ViaticosModule.onDeptoChange()" ${dis}>
              ${Object.keys(COLOMBIA_GEO).map(d => `<option value="${d}" ${d === defaultDepto ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Municipio / Ciudad *</label>
            <select id="vf-muni" class="filter-select" onchange="ViaticosModule.updateDestinoFinal()" ${dis}>
              <!-- Poblado dinámicamente -->
            </select>
          </div>
        </div>

        <!-- Destino Internacional -->
        <div id="vf-dest-internacional" class="form-subgrid span-2" style="display:${isIntl ? 'grid' : 'none'}; grid-template-columns:1fr 1fr; gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label">País de Destino *</label>
            <select id="vf-pais" class="filter-select" onchange="ViaticosModule.updateDestinoFinal()" ${dis}>
              ${PAISES_INTERNACIONAL.map(p => `<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Ciudad Internacional *</label>
            <input id="vf-ciudad-int" class="form-input" placeholder="Ej: Washington D.C., Madrid..." oninput="ViaticosModule.updateDestinoFinal()" ${dis} />
          </div>
        </div>

        <input type="hidden" id="vf-destino" value="${escHtml(r.destino || 'Tunja, Boyacá')}" />

        <div class="form-group span-2">
          <div class="dest-preview-box">
            <span class="dest-preview-icon">📍</span>
            <span class="dest-preview-label">Destino Consolidado:</span>
            <strong id="vf-dest-preview-text" class="dest-preview-val">${escHtml(r.destino || 'Tunja, Boyacá')}</strong>
          </div>
        </div>

        <div class="form-group span-2">
          <label class="form-label">Motivo o Justificación del Desplazamiento</label>
          <input id="vf-motivo" class="form-input" placeholder="Ej: Comisión oficial para inspección técnica en territorio..." value="${escHtml(r.motivo||'')}" ${dis} />
        </div>

        <!-- Fechas y Cálculo de Días -->
        <div class="form-group">
          <label class="form-label">Fecha de Inicio *</label>
          <input id="vf-fi" type="date" class="form-input" value="${toIsoDate(r.fechaInicio)}" onchange="ViaticosModule.onDatesChange()" ${dis} required />
        </div>

        <div class="form-group">
          <label class="form-label">Fecha de Finalización *</label>
          <input id="vf-ff" type="date" class="form-input" value="${toIsoDate(r.fechaFin)}" onchange="ViaticosModule.onDatesChange()" ${dis} required />
        </div>

        <div class="form-group">
          <label class="form-label">Número de Días (calculado automáticamente)</label>
          <input id="vf-dias" class="form-input" type="number" min="1" value="${escHtml(r.dias||'1')}" oninput="ViaticosModule.calcTotal()" ${dis} />
        </div>

        <div class="form-group">
          <label class="form-label">Valor Diario ($ COP)</label>
          <input id="vf-vdiario" class="form-input" type="number" min="0" step="1000" placeholder="Ej: 150000" value="${escHtml(r.valorDiario||'0')}" oninput="ViaticosModule.calcTotal()" ${dis} />
        </div>

        <div class="form-group span-2">
          <label class="form-label">Valor Total del Viático</label>
          <input id="vf-vtotal" class="form-input" placeholder="Calculado automáticamente" readonly style="background:rgba(40,135,27,0.08);border-color:rgba(40,135,27,0.3);color:var(--color-green-dark);font-weight:700;font-size:1.05rem;" value="${formatCOP(r.valorTotal||0)}" />
        </div>

        <div class="form-group">
          <label class="form-label">Estado de la Solicitud</label>
          <select id="vf-estado" class="filter-select" onchange="ViaticosModule.onEstadoChange()" ${dis}>
            ${ESTADOS.filter(s => s !== 'Todos').map(s => `<option ${r.estado === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Aprobado Por</label>
          <input id="vf-aprobado" class="form-input" placeholder="Nombre del aprobador..." value="${escHtml(r.aprobadoPor||'')}" ${dis} />
        </div>

        <div class="form-group">
          <label class="form-label">N° Resolución / Acto</label>
          <input id="vf-resolucion" class="form-input font-mono" placeholder="Ej: 0053/18/01/2024" value="${escHtml(r.numeroResolucion||'')}" ${dis} />
        </div>

        <div class="form-group">
          <label class="form-label">Saldo Presupuestal ($ COP)</label>
          <input id="vf-saldo" class="form-input" type="number" step="1000" placeholder="Ej: 50000000" value="${escHtml(r.saldo||'')}" ${dis} />
        </div>

        <!-- Carga de Soportes / Facturas -->
        <div class="form-group span-2">
          <label class="form-label">Soporte, Factura o Documento de Comisión (Opcional)</label>
          <div class="file-upload-zone" onclick="document.getElementById('vf-file-input')?.click()">
            <svg class="file-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div class="file-upload-title">Haz clic o arrastra aquí la factura / soporte</div>
            <div class="file-upload-desc">Formatos permitidos: PDF, PNG, JPG (Máx. 5MB)</div>
            <input id="vf-file-input" type="file" accept=".pdf,image/png,image/jpeg" onchange="ViaticosModule.onFileSelected(event)" ${dis} />
          </div>
          <div id="vf-file-preview-area">
            ${r.soporte ? `
              <div class="file-chip">
                <span>📄 Soporte adjunto cargado</span>
                <button type="button" class="file-chip-remove" onclick="ViaticosModule.removeUploadedFile()" title="Remover soporte">✕</button>
              </div>` : ''}
          </div>
        </div>

        <div class="form-group span-2">
          <label class="form-label">Observaciones Adicionales</label>
          <input id="vf-obs" class="form-input" placeholder="Anotaciones de gestión o trámite..." value="${escHtml(r.observaciones||'')}" ${dis} />
        </div>
      </div>`;
  }

  // ─── Inicialización de Campos de Destino y Autocompletado ──────────────────
  function initFormHelpers(r = {}) {
    const deptoSelect = document.getElementById('vf-depto');
    if (deptoSelect) {
      if (r.destino && r.destino.includes(',')) {
        const parts = r.destino.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const deptoFound = Object.keys(COLOMBIA_GEO).find(d => d.toLowerCase() === parts[1].toLowerCase());
          if (deptoFound) {
            deptoSelect.value = deptoFound;
            onDeptoChange(parts[0]);
            calcTotal();
            onEstadoChange();
            return;
          }
        }
      }
      onDeptoChange();
    }
    calcTotal();
    onEstadoChange();
  }

  // ─── Autocompletado de Servidores ──────────────────────────────────────────
  function onNombreInput(val) {
    clearTimeout(employeeSearchTimeout);
    const drop = document.getElementById('vf-autocomplete-list');
    if (!drop) return;
    const query = val.trim();
    if (query.length < 2) {
      drop.style.display = 'none';
      drop.innerHTML = '';
      return;
    }
    employeeSearchTimeout = setTimeout(async () => {
      try {
        const res = await API.getEmployees({ q: query, limit: 6 });
        const list = res.data || [];
        if (!list.length) {
          drop.innerHTML = `<div class="autocomplete-item"><span class="autocomplete-item-meta">No se encontraron funcionarios</span></div>`;
          drop.style.display = 'block';
          return;
        }
        drop.innerHTML = list.map(emp => `
          <div class="autocomplete-item" onclick="ViaticosModule.selectEmployee(${JSON.stringify(emp).replace(/"/g, '&quot;')})">
            <span class="autocomplete-item-name">${escHtml(emp.nombre_completo)}</span>
            <span class="autocomplete-item-meta">C.C. ${escHtml(emp.cedula || '—')} • ${escHtml(emp.cargo_actual || emp.cargo_base || 'Cargo no asignado')} • ${escHtml(emp.dependencia || 'Sin dependencia')}</span>
          </div>
        `).join('');
        drop.style.display = 'block';
      } catch {
        drop.style.display = 'none';
      }
    }, 200);
  }

  function selectEmployee(emp) {
    if (!emp) return;
    const nombreInput = document.getElementById('vf-nombre');
    const docInput = document.getElementById('vf-doc');
    const cargoInput = document.getElementById('vf-cargo');
    const depInput = document.getElementById('vf-dep');
    const drop = document.getElementById('vf-autocomplete-list');

    if (nombreInput) nombreInput.value = emp.nombre_completo || '';
    if (docInput) docInput.value = emp.cedula || '';
    if (cargoInput) cargoInput.value = emp.cargo_actual || emp.cargo_base || '';
    if (depInput) depInput.value = emp.dependencia || '';
    if (drop) { drop.style.display = 'none'; drop.innerHTML = ''; }

    App.showToast(`Datos autocompletados para ${emp.nombre_completo}.`, 'info');
  }

  // ─── Gestión de Destinos ──────────────────────────────────────────────────
  function onTipoDestinoChange(tipo) {
    const nac = document.getElementById('vf-dest-nacional');
    const intl = document.getElementById('vf-dest-internacional');
    if (tipo === 'Nacional') {
      if (nac) nac.style.display = 'grid';
      if (intl) intl.style.display = 'none';
      onDeptoChange();
    } else {
      if (nac) nac.style.display = 'none';
      if (intl) intl.style.display = 'grid';
      updateDestinoFinal();
    }
  }

  function onDeptoChange(selectedMuni = '') {
    const depto = document.getElementById('vf-depto')?.value || 'Boyacá';
    const muniSelect = document.getElementById('vf-muni');
    if (!muniSelect) return;
    const munis = COLOMBIA_GEO[depto] || ['Capital / Ciudad Principal', 'Otro municipio'];
    muniSelect.innerHTML = munis.map(m => `<option value="${m}" ${m === selectedMuni ? 'selected' : ''}>${m}</option>`).join('');
    updateDestinoFinal();
  }

  function updateDestinoFinal() {
    const tipo = document.querySelector('input[name="vf-tipo-dest"]:checked')?.value || 'Nacional';
    let destText = '';
    if (tipo === 'Nacional') {
      const depto = document.getElementById('vf-depto')?.value || 'Boyacá';
      const muni = document.getElementById('vf-muni')?.value || 'Tunja';
      destText = `${muni}, ${depto}`;
    } else {
      const pais = document.getElementById('vf-pais')?.value || 'Estados Unidos';
      const ciudad = document.getElementById('vf-ciudad-int')?.value.trim() || 'Ciudad Principal';
      destText = `${ciudad}, ${pais}`;
    }
    const hiddenDest = document.getElementById('vf-destino');
    const previewText = document.getElementById('vf-dest-preview-text');
    if (hiddenDest) hiddenDest.value = destText;
    if (previewText) previewText.textContent = destText;
  }

  // ─── Cálculo de Días y Valores ────────────────────────────────────────────
  function onDatesChange() {
    const fiVal = document.getElementById('vf-fi')?.value;
    const ffVal = document.getElementById('vf-ff')?.value;
    if (fiVal && ffVal) {
      const d1 = new Date(fiVal + 'T00:00:00');
      const d2 = new Date(ffVal + 'T00:00:00');
      const diffTime = d2 - d1;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const diasInput = document.getElementById('vf-dias');
      if (diasInput) {
        if (diffDays >= 1) {
          diasInput.value = diffDays;
        } else {
          diasInput.value = 1;
          App.showToast('La fecha final debe ser igual o posterior a la fecha de inicio.', 'warning');
        }
      }
    }
    calcTotal();
  }

  function calcTotal() {
    const dias = parseFloat(document.getElementById('vf-dias')?.value) || 0;
    const daily = parseFloat(document.getElementById('vf-vdiario')?.value) || 0;
    const total = dias * daily;
    const el = document.getElementById('vf-vtotal');
    if (el) el.value = formatCOP(total);
  }

  function onEstadoChange() {
    const est = document.getElementById('vf-estado')?.value;
    const aprInput = document.getElementById('vf-aprobado');
    if (!aprInput) return;
    if (est === 'Aprobada') {
      const user = Auth.getUser();
      const adminName = user?.fullName || (user?.username === 'admin' ? 'Ángela Usán (Administrador)' : (user?.username || 'Administrador'));
      if (!aprInput.value || aprInput.value === '—' || aprInput.value.toLowerCase().includes('pendiente')) {
        aprInput.value = adminName;
      }
    }
  }

  // ─── Manejo de Archivos y Soportes ────────────────────────────────────────
  function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      App.showToast('El archivo supera el tamaño máximo permitido (5MB).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      currentUploadedFile = e.target.result;
      const previewArea = document.getElementById('vf-file-preview-area');
      if (previewArea) {
        previewArea.innerHTML = `
          <div class="file-chip">
            <span>📄 ${escHtml(file.name)} (${(file.size / 1024).toFixed(1)} KB)</span>
            <button type="button" class="file-chip-remove" onclick="ViaticosModule.removeUploadedFile()" title="Remover archivo">✕</button>
          </div>`;
      }
      App.showToast(`Archivo "${file.name}" cargado como soporte.`, 'success');
    };
    reader.readAsDataURL(file);
  }

  function removeUploadedFile() {
    currentUploadedFile = null;
    const previewArea = document.getElementById('vf-file-preview-area');
    if (previewArea) previewArea.innerHTML = '';
    const fileInput = document.getElementById('vf-file-input');
    if (fileInput) fileInput.value = '';
    App.showToast('Soporte removido.', 'info');
  }

  function viewSoporte(id) {
    const r = state.data.find(x => x.id === id);
    if (!r || !r.soporte) {
      App.showToast('Este registro no tiene soporte adjunto.', 'info');
      return;
    }
    if (r.soporte.startsWith('data:image/')) {
      App.openModal(`Soporte de Viático - ${r.radicado}`, `
        <div style="text-align:center;padding:var(--space-2);">
          <img src="${r.soporte}" alt="Soporte" style="max-width:100%;max-height:70vh;border-radius:var(--radius-md);box-shadow:0 8px 24px rgba(0,0,0,0.5);" />
          <div style="margin-top:var(--space-4);">
            <a href="${r.soporte}" download="soporte_${r.radicado}.png" class="btn btn-primary btn-sm">Descargar Imagen</a>
          </div>
        </div>
      `, [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }]);
    } else if (r.soporte.startsWith('data:application/pdf')) {
      App.openModal(`Soporte de Viático - ${r.radicado}`, `
        <div style="width:100%;height:70vh;">
          <iframe src="${r.soporte}" style="width:100%;height:100%;border:none;border-radius:var(--radius-md);"></iframe>
        </div>
      `, [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }]);
    } else {
      App.openModal(`Soporte de Viático - ${r.radicado}`, `
        <div style="padding:var(--space-4);text-align:center;">
          <p style="color:var(--text-secondary);margin-bottom:var(--space-3);">Documento adjunto registrado:</p>
          <a href="${r.soporte}" download="soporte_${r.radicado}" class="btn btn-primary">Descargar Documento</a>
        </div>
      `, [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }]);
    }
  }

  function openView(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;

    const initials = getInitials(r.persona);
    const estadoNorm = (r.estado || 'Pendiente').toLowerCase();
    const isAprobada = estadoNorm.includes('aprobad') || estadoNorm.includes('finaliz');
    const isRechazada = estadoNorm.includes('rechazad');
    const badgeStateClass = isAprobada ? 'pill--emerald' : (isRechazada ? 'pill--danger' : 'pill--gold');
    const statusIcon = isAprobada ? '🟢' : (isRechazada ? '🔴' : '🟡');

    const cleanPersona = sanitizeText(r.persona || 'Servidor Público');
    const cleanCargo = sanitizeText(r.cargo || 'Funcionario');
    const cleanDep = sanitizeText(r.dependencia || 'Gobernación de Boyacá');
    const cleanDestino = sanitizeText(r.destino || 'No especificado');
    const formattedCc = formatCedulaDots(r.documento);
    const radicadoRaw = r.radicado || 'SIN-RADICADO';

    const content = `
      <div class="ficha-wrapper">
        <!-- ─── Hero Viático Header ─── -->
        <div class="ficha-hero">
          <div class="ficha-hero-inner">
            <div class="ficha-avatar-box">
              <div class="ficha-avatar">${escHtml(initials)}</div>
              <div class="ficha-avatar-badge ${isAprobada ? '' : (isRechazada ? 'inactivo' : '')}" title="Estado: ${escHtml(r.estado || 'Pendiente')}"></div>
            </div>
            <div class="ficha-hero-info">
              <h3 class="ficha-hero-name">${escHtml(cleanPersona)}</h3>
              <div class="ficha-hero-sub">
                <span>Cargo: <strong>${escHtml(cleanCargo)}</strong></span>
                <span>•</span>
                <span>C.C.: <strong>${escHtml(formattedCc)}</strong></span>
                ${r.documento ? `
                  <button class="ficha-copy-btn" id="btn-copy-vit-cc" onclick="ViaticosModule.copyFichaText('${escHtml(r.documento)}', 'btn-copy-vit-cc')" title="Copiar Cédula">
                    Copiar
                  </button>
                ` : ''}
              </div>
              <div class="ficha-hero-pills">
                <div class="ficha-hero-pill pill--gold">
                  <span>🏷️ Radicado: <strong>${escHtml(radicadoRaw)}</strong></span>
                  <button class="ficha-copy-btn" id="btn-copy-vit-rad" onclick="ViaticosModule.copyFichaText('${escHtml(radicadoRaw)}', 'btn-copy-vit-rad')" title="Copiar Radicado">
                    <svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copiar
                  </button>
                </div>
                <span class="ficha-hero-pill ${badgeStateClass}">
                  ${statusIcon} ${escHtml(r.estado || 'Pendiente')}
                </span>
                <span class="ficha-hero-pill">
                  📍 ${escHtml(cleanDestino)}
                </span>
                <span class="ficha-hero-pill">
                  🏢 ${escHtml(cleanDep)}
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
          <button class="ficha-tab-btn active" data-tab="ficha-comision" onclick="ViaticosModule.switchFichaTab('ficha-comision')">
            <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            Comisión & Destino
          </button>
          <button class="ficha-tab-btn" data-tab="ficha-liquidacion" onclick="ViaticosModule.switchFichaTab('ficha-liquidacion')">
            <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            Liquidación & Presupuesto
          </button>
          <button class="ficha-tab-btn" data-tab="ficha-soporte" onclick="ViaticosModule.switchFichaTab('ficha-soporte')">
            <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Fechas & Soportes
          </button>
        </div>

        <!-- ─── Tab 1: Comisión & Destino ─── -->
        <div class="ficha-tab-pane active" id="ficha-comision">
          <div class="ficha-grid">
            <div class="ficha-card ficha-grid--full">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">🎯</div>
                <span class="ficha-card-label">Objeto o Justificación de la Comisión</span>
              </div>
              <div class="ficha-card-val" style="font-weight:600; font-size:1.05rem; line-height:1.5; color:var(--text-primary);">
                ${escHtml(r.motivo || 'No se registró objeto detallado para este desplazamiento.')}
              </div>
              <div class="ficha-card-sub">Finalidad oficial autorizada por la administración departamental</div>
            </div>

            <div class="ficha-card ficha-card--gold">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">📍</div>
                <span class="ficha-card-label">Lugar de Destino</span>
              </div>
              <div class="ficha-card-val" style="font-size:1.15rem; color:var(--color-gold); font-weight:700;">
                ${escHtml(cleanDestino)}
              </div>
              <div class="ficha-card-sub">Modalidad: <strong>${escHtml(r.tipoDestino || 'Nacional')}</strong></div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">📋</div>
                <span class="ficha-card-label">Acto Administrativo / N° Resolución</span>
              </div>
              <div class="ficha-card-val font-mono" style="font-size:1.05rem; font-weight:700;">
                ${r.numeroResolucion ? escHtml(r.numeroResolucion) : '<span style="color:var(--text-muted); font-size:0.95rem;">Pendiente de expedición</span>'}
              </div>
              <div class="ficha-card-sub">Resolución oficial de comisión</div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">🏢</div>
                <span class="ficha-card-label">Dependencia Institucional</span>
              </div>
              <div class="ficha-card-val" style="font-size:0.95rem; font-weight:600;">
                ${escHtml(cleanDep)}
              </div>
              <div class="ficha-card-sub">Área solicitante del trámite</div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">👤</div>
                <span class="ficha-card-label">Servidor Público Solicitante</span>
              </div>
              <div class="ficha-card-val" style="font-size:0.95rem; font-weight:600;">
                ${escHtml(cleanPersona)}
              </div>
              <div class="ficha-card-sub">${escHtml(cleanCargo)} • C.C. ${escHtml(formattedCc)}</div>
            </div>

            ${r.observaciones ? `
            <div class="ficha-card ficha-grid--full">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">📝</div>
                <span class="ficha-card-label">Observaciones y Anotaciones de Trámite</span>
              </div>
              <div class="ficha-card-val" style="font-weight:500; font-size:0.92rem; color:var(--text-secondary);">
                ${escHtml(r.observaciones)}
              </div>
            </div>` : ''}
          </div>
        </div>

        <!-- ─── Tab 2: Liquidación & Presupuesto ─── -->
        <div class="ficha-tab-pane" id="ficha-liquidacion">
          <div class="ficha-grid">
            <div class="ficha-card ficha-card--featured ficha-grid--full" style="padding:18px 20px;">
              <div class="ficha-card-top">
                <div class="ficha-card-icon" style="background:rgba(0,123,199,0.15); color:var(--color-info); font-size:18px;">💰</div>
                <span class="ficha-card-label" style="font-size:0.8rem;">Valor Total Liquidado</span>
              </div>
              <div class="ficha-card-val" style="font-size:1.6rem; font-weight:800; margin:6px 0; color:var(--color-primary-400);">
                ${formatCOP(r.valorTotal)}
              </div>
              <div class="ficha-card-sub" style="font-size:0.85rem;">
                Devengo económico total liquidado para la comisión oficial
              </div>
            </div>

            <div class="ficha-card ficha-card--emerald">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">💵</div>
                <span class="ficha-card-label">Tarifa Diaria Asignada</span>
              </div>
              <div class="ficha-card-val font-mono" style="font-size:1.2rem; font-weight:700;">
                ${formatCOP(r.valorDiario)}
              </div>
              <div class="ficha-card-sub">Tarifa fija por día de comisión</div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">⏱️</div>
                <span class="ficha-card-label">Días Reconocidos</span>
              </div>
              <div class="ficha-card-val font-mono" style="font-size:1.25rem; font-weight:800;">
                ${escHtml(r.dias ?? '1')} ${r.dias === 1 ? 'día' : 'días'}
              </div>
              <div class="ficha-card-sub">Tiempo efectivo liquidado</div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">🏦</div>
                <span class="ficha-card-label">Saldo Presupuestal Secretaría</span>
              </div>
              <div class="ficha-card-val font-mono" style="font-size:1.15rem; font-weight:700;">
                ${r.saldo != null ? formatCOP(r.saldo) : '<span style="color:var(--text-muted); font-size:0.95rem;">No reportado</span>'}
              </div>
              <div class="ficha-card-sub">Disponibilidad presupuestal del rubro</div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">✍️</div>
                <span class="ficha-card-label">Autorizado / Aprobado Por</span>
              </div>
              <div class="ficha-card-val" style="font-size:0.95rem; font-weight:600;">
                ${r.aprobadoPor ? escHtml(r.aprobadoPor) : '<span style="color:var(--text-muted);">En trámite de aprobación</span>'}
              </div>
              <div class="ficha-card-sub">Ordenador del gasto o supervisor</div>
            </div>
          </div>
        </div>

        <!-- ─── Tab 3: Fechas & Soportes ─── -->
        <div class="ficha-tab-pane" id="ficha-soporte">
          <div class="ficha-grid">
            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">🛫</div>
                <span class="ficha-card-label">Fecha de Salida</span>
              </div>
              <div class="ficha-card-val font-mono" style="font-size:1.15rem; font-weight:700;">
                ${escHtml(r.fechaInicio || 'No especificada')}
              </div>
              <div class="ficha-card-sub">Inicio de itinerario oficial</div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">🛬</div>
                <span class="ficha-card-label">Fecha de Retorno</span>
              </div>
              <div class="ficha-card-val font-mono" style="font-size:1.15rem; font-weight:700;">
                ${escHtml(r.fechaFin || 'No especificada')}
              </div>
              <div class="ficha-card-sub">Finalización de actividades en comisión</div>
            </div>

            <div class="ficha-card ficha-grid--full">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">📎</div>
                <span class="ficha-card-label">Soporte Adjunto / Comprobante de Desplazamiento</span>
              </div>
              <div style="margin-top:8px;">
                ${r.soporte ? `
                  <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; background:var(--color-bg-secondary, rgba(0,0,0,0.04)); border:1px solid var(--color-border); border-radius:10px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <div style="width:36px; height:36px; border-radius:8px; background:rgba(2,132,199,0.15); color:var(--color-info); display:flex; align-items:center; justify-content:center; font-size:18px;">
                        📄
                      </div>
                      <div>
                        <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">Documento de Soporte Registrado</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">Comprobante institucional adjunto al radicado ${escHtml(radicadoRaw)}</div>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <button class="btn btn-primary btn-sm" onclick="ViaticosModule.viewSoporte(${r.id})" style="display:inline-flex; align-items:center; gap:6px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Ver Documento
                      </button>
                    </div>
                  </div>
                ` : `
                  <div style="padding:16px; border:1px dashed var(--color-border); border-radius:10px; text-align:center; color:var(--text-muted); font-size:0.9rem;">
                    📂 No se ha adjuntado documento o factura de soporte para este viático.
                  </div>
                `}
              </div>
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
        text: 'Editar Viático',
        cls: 'btn-gold',
        action: () => openEdit(id)
      });
    }

    App.openModal(`Ficha Integral del Viático · ${escHtml(radicadoRaw)}`, content, actions, 'modal-ficha modal-lg');
    const box = document.querySelector('.modal-box');
    if (box) {
      box.classList.add('modal-ficha', 'modal-lg');
      box.style.maxWidth = '900px';
      box.style.width = '92vw';
    }
    const modalBody = document.getElementById('modal-body');
    if (modalBody) {
      modalBody.scrollTop = 0;
    }
  }

  // ─── Acciones de Creación y Edición ───────────────────────────────────────
  function openCreate() {
    App.openModal('Nuevo Viático Institucional', buildForm(), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Crear Viático', cls: 'btn-primary', id: 'vit-save-btn', action: saveCreate },
    ], 'modal-form-emp modal-lg');
    const box = document.querySelector('.modal-box');
    if (box) {
      box.classList.add('modal-form-emp', 'modal-lg');
      box.style.maxWidth = '900px';
      box.style.width = '92vw';
    }
    App.initDatePickers(document.getElementById('modal-body') || document);
    setTimeout(() => initFormHelpers(), 50);
  }

  function openEdit(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;
    App.openModal(`Editar Viático ${r.radicado}`, buildForm(r), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Actualizar Viático', cls: 'btn-gold', id: 'vit-save-btn', action: () => saveEdit(id) },
    ], 'modal-form-emp modal-lg');
    const box = document.querySelector('.modal-box');
    if (box) {
      box.classList.add('modal-form-emp', 'modal-lg');
      box.style.maxWidth = '900px';
      box.style.width = '92vw';
    }
    App.initDatePickers(document.getElementById('modal-body') || document);
    setTimeout(() => initFormHelpers(r), 50);
  }

  async function saveCreate() {
    const body = readForm();
    if (!body) return;
    const btn = document.getElementById('vit-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      const res = await API.createViatico(body);
      App.closeModal();
      App.showToast(`Viático creado exitosamente. Radicado: ${res.radicado || ''}`, 'success');
      await load();
      loadStats();
    } catch (err) { App.showToast(err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Crear Viático'; } }
  }

  async function saveEdit(id) {
    const body = readForm();
    if (!body) return;
    const btn = document.getElementById('vit-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
    try {
      await API.updateViatico(id, body);
      App.closeModal();
      App.showToast('Viático actualizado exitosamente.', 'success');
      await load();
      loadStats();
    } catch (err) { App.showToast(err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Actualizar Viático'; } }
  }

  function readForm() {
    const nombre = document.getElementById('vf-nombre')?.value.trim();
    const destino = document.getElementById('vf-destino')?.value.trim();
    const fi = document.getElementById('vf-fi')?.value;
    const ff = document.getElementById('vf-ff')?.value;

    if (!nombre) { App.showToast('El nombre del funcionario es requerido.', 'warning'); return null; }
    if (!destino) { App.showToast('El destino del viático es requerido.', 'warning'); return null; }

    const tipoDestino = document.querySelector('input[name="vf-tipo-dest"]:checked')?.value || 'Nacional';

    return {
      persona: nombre,
      documento: document.getElementById('vf-doc')?.value.trim() || '',
      dependencia: document.getElementById('vf-dep')?.value.trim() || '',
      cargo: document.getElementById('vf-cargo')?.value.trim() || '',
      tipoDestino,
      destino,
      motivo: document.getElementById('vf-motivo')?.value.trim() || '',
      fechaInicio: fi || '',
      fechaFin: ff || '',
      dias: parseInt(document.getElementById('vf-dias')?.value) || 1,
      valorDiario: parseFloat(document.getElementById('vf-vdiario')?.value) || 0,
      estado: document.getElementById('vf-estado')?.value || 'Pendiente',
      observaciones: document.getElementById('vf-obs')?.value.trim() || '',
      aprobadoPor: document.getElementById('vf-aprobado')?.value.trim() || '',
      numeroResolucion: document.getElementById('vf-resolucion')?.value.trim() || null,
      saldo: parseFloat(document.getElementById('vf-saldo')?.value) || null,
      soporte: currentUploadedFile || null,
    };
  }

  // ─── Modal de Cambio Rápido de Estado (1 Clic) ──────────────────────────────
  const STATUS_CONFIG = [
    {
      id: 'aprobada',
      name: 'Aprobada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
      desc: 'Aprobar viático para trámite y desembolso',
      cls: 'status-card-opt--aprobada',
    },
    {
      id: 'rechazada',
      name: 'Rechazada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      desc: 'Denegar o no autorizar la comisión de servicios',
      cls: 'status-card-opt--rechazada',
    },
    {
      id: 'revision',
      name: 'En revisión',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      desc: 'En verificación de soportes y disponibilidad presupuestal',
      cls: 'status-card-opt--revision',
    },
    {
      id: 'pendiente',
      name: 'Pendiente',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      desc: 'Registrado en espera de gestión o turno',
      cls: 'status-card-opt--pendiente',
    },
    {
      id: 'finalizada',
      name: 'Finalizada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      desc: 'Comisión cumplida y legalizada formalmente',
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
        <button type="button" class="status-card-opt ${opt.cls} ${isCurrent ? 'is-current' : ''}" onclick="ViaticosModule.selectQuickStatus(${r.id}, '${opt.name}')" title="Marcar como ${opt.name}">
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
            <span class="status-picker-tag">📍 ${escHtml(r.destino || 'Destino no especificado')}</span>
            <span class="status-picker-tag">📅 ${escHtml(r.fechaInicio || '—')} (${r.dias || 1} días)</span>
            <span class="status-picker-tag">💰 ${formatCOP(r.valorTotal)}</span>
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
          <label class="form-label">Observación / Justificación (Opcional)</label>
          <input id="quick-status-obs" class="form-input form-input--no-icon" placeholder="Ej: Aprobado según soporte / resolución presentada..." value="${escHtml(r.observaciones || '')}" />
        </div>
      </div>`;

    App.openModal('Gestión Rápida de Estado', bodyHtml, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
    ]);
  }

  async function selectQuickStatus(id, newStatus) {
    const obs = document.getElementById('quick-status-obs')?.value.trim();
    try {
      await API.updateViaticoStatus(id, newStatus, obs);
      App.closeModal();
      App.showToast(`Estado de viático actualizado a "${newStatus}".`, 'success');
      await load();
      loadStats();
    } catch (err) {
      App.showToast(err.message || 'Error al cambiar estado.', 'error');
    }
  }

  function loadStats() {
    API.getViaticosStats().then(s => {
      const strip = document.getElementById('vit-stats-strip');
      if (!strip) return;
      strip.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon stat-icon--gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <div class="stat-info"><span class="stat-value">${parseInt(s.total)||0}</span><span class="stat-label">Viáticos Totales</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon--orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div class="stat-info"><span class="stat-value">${parseInt(s.pendientes)||0}</span><span class="stat-label">Pendientes</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon--green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="stat-info"><span class="stat-value" style="font-size:var(--text-xl)">${formatCOP(s.valor_aprobado)}</span><span class="stat-label">Total Aprobado</span></div>
        </div>`;
    }).catch(() => {});
  }

  function confirmDelete(id, nombre) {
    App.openModal('Confirmar Eliminación', `<p style="color:var(--text-secondary)">¿Eliminar el viático de <strong style="color:var(--text-primary)">${nombre}</strong>?</p>`, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Eliminar', cls: 'btn-danger', action: async () => {
        try { await API.deleteViatico(id); App.closeModal(); App.showToast('Viático eliminado.', 'success'); await load(); loadStats(); }
        catch (err) { App.showToast(err.message, 'error'); }
      }},
    ]);
  }

  function applyFilters() {
    state.page = 1;
    const dep = document.getElementById('vit-dependencia')?.value || '';
    state.filters = {
      q: document.getElementById('vit-q')?.value.trim() || '',
      estado: document.getElementById('vit-estado')?.value || '',
      dependencia: (dep && dep !== 'Todas' && dep !== 'Todos') ? dep : '',
    };
    load();
  }
  function clearFilters() {
    ['vit-q', 'vit-estado'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const depEl = document.getElementById('vit-dependencia');
    if (depEl) depEl.value = 'Todas';
    state.filters = {}; state.page = 1; load();
  }
  function goPage(p) { if (p < 1 || p > state.totalPages) return; state.page = p; load(); }

  // ─── Dropdown de Opciones Secundarias (Ley de Hick & WCAG 2.1 AA) ──────────
  function toggleActionsDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('vit-dropdown-menu');
    const toggleBtn = document.getElementById('vit-dropdown-toggle');
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
    const menu = document.getElementById('vit-dropdown-menu');
    const toggleBtn = document.getElementById('vit-dropdown-toggle');
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
      const menu = document.getElementById('vit-dropdown-menu');
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
      const menu = document.getElementById('vit-dropdown-menu');
      if (menu && !menu.hasAttribute('hidden') && wrap && !wrap.contains(e.target)) {
        menu.setAttribute('hidden', '');
        const toggleBtn = document.getElementById('vit-dropdown-toggle');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const menu = document.getElementById('vit-dropdown-menu');
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
            <h1 class="page-heading">Viáticos</h1>
            <p class="page-desc">Gestión de solicitudes, comisiones y aprobaciones de viáticos del personal institucional</p>
          </div>
          <div class="page-actions" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <!-- Dropdown de Opciones Secundarias (Hick's Law) -->
            <div class="actions-dropdown-wrap">
              <button
                type="button"
                class="btn btn-secondary actions-dropdown-btn"
                id="vit-dropdown-toggle"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="vit-dropdown-menu"
                onclick="ViaticosModule.toggleActionsDropdown(event)"
                onkeydown="ViaticosModule.handleDropdownKeydown(event)"
                title="Opciones secundarias (Excel y plantillas)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                <span>Acciones</span>
                <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div
                class="actions-dropdown-menu"
                id="vit-dropdown-menu"
                role="menu"
                aria-labelledby="vit-dropdown-toggle"
                hidden
              >
                <button
                  type="button"
                  class="actions-dropdown-item"
                  role="menuitem"
                  tabindex="-1"
                  onclick="ViaticosModule.closeActionsDropdown(); ViaticosModule.exportExcel();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <div>
                    <strong>Exportar a Excel</strong>
                    <small>Descargar listado filtrado (.xlsx)</small>
                  </div>
                </button>
                <button
                  type="button"
                  class="actions-dropdown-item"
                  role="menuitem"
                  tabindex="-1"
                  onclick="ViaticosModule.closeActionsDropdown(); ViaticosModule.downloadOfficialTemplate();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                  <div>
                    <strong>Descargar Plantilla Oficial</strong>
                    <small>Formato oficial institucional (.xlsx)</small>
                  </div>
                </button>
                ${Auth.canEdit() ? `
                <button
                  type="button"
                  class="actions-dropdown-item"
                  role="menuitem"
                  tabindex="-1"
                  onclick="ViaticosModule.closeActionsDropdown(); ViaticosModule.openImportModal();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <div>
                    <strong>Carga Masiva Excel</strong>
                    <small>Importar registros desde plantilla institucional</small>
                  </div>
                </button>` : ''}
              </div>
            </div>

            <!-- Acción Primaria (CTA - Visual Salience) -->
            ${Auth.canEdit() ? `
            <button class="btn btn-primary-cta" onclick="ViaticosModule.openCreate()" id="btn-nuevo-viatico" aria-label="Crear nuevo viático">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:19px;height:19px" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Nuevo Viático</span>
            </button>` : ''}
          </div>
        </div>

        <div id="vit-stats-strip" class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--space-5)">
          ${renderStatsSkeletons()}
        </div>

        <div class="filters-card">
          <div class="filters-row">
            <div class="filter-group" style="flex:2">
              <label class="filter-label">Buscar</label>
              <input id="vit-q" class="filter-input" placeholder="Nombre, cédula, destino..." />
            </div>
            <div class="filter-group" style="flex:1.5">
              <label class="filter-label">Dependencia</label>
              <select id="vit-dependencia" class="filter-select" onchange="ViaticosModule.applyFilters()">
                ${DEPENDENCIAS_LIST.map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">Estado</label>
              <select id="vit-estado" class="filter-select" onchange="ViaticosModule.applyFilters()">
                ${ESTADOS.map(s => `<option>${s}</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-primary" onclick="ViaticosModule.applyFilters()">Filtrar</button>
            <button class="btn btn-secondary" onclick="ViaticosModule.clearFilters()">Limpiar</button>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <span class="table-title">Registro de Viáticos</span>
            <span class="table-count" id="vit-count"><span class="skeleton" style="width:110px;height:14px;border-radius:4px;display:inline-block;" aria-hidden="true"></span></span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Radicado</th><th>Servidor Público</th><th>Dependencia</th><th>Destino</th>
                <th>Fecha Inicio</th><th>Días</th><th>Valor Total</th><th>Estado</th><th>Acciones</th>
              </tr></thead>
              <tbody id="vit-tbody" role="progressbar" aria-busy="true" aria-label="Cargando viáticos...">
                ${renderSkeletonRows(6)}
              </tbody>
            </table>
          </div>
          <div class="pagination" id="vit-pagination"></div>
        </div>
      </div>`;

    document.getElementById('vit-q')?.addEventListener('keypress', e => { if (e.key === 'Enter') applyFilters(); });
    bindDropdownOutsideClick();

    loadStats();
    state.page = 1; state.filters = {};
    await load();
  }

  const EXCEL_COLUMNS = [
    { header: 'Código Solicitud', key: 'radicado', width: 18, sample: 'VIT-2026-00012' },
    { header: 'No. Resolución', key: 'numeroResolucion', width: 20, sample: '1240/15/06/2024' },
    { header: 'Cédula', key: 'documento', width: 15, sample: '1049601234' },
    { header: 'Servidor Público', key: 'persona', width: 32, sample: 'GARCIA MARTINEZ LUIS FERNANDO' },
    { header: 'Dependencia', key: 'dependencia', width: 30, sample: 'SECRETARÍA DE HACIENDA' },
    { header: 'Cargo', key: 'cargo', width: 26, sample: 'PROFESIONAL UNIVERSITARIO' },
    { header: 'Destino', key: 'destino', width: 28, sample: 'BOGOTÁ D.C.' },
    { header: 'Fecha Salida', key: 'fechaInicio', width: 16, sample: '20/05/2026' },
    { header: 'Fecha Retorno', key: 'fechaFin', width: 16, sample: '22/05/2026' },
    { header: 'Días', key: 'dias', width: 10, sample: '3' },
    { header: 'Valor Diario', key: 'valorDiario', width: 16, sample: '120000', format: (v) => formatCOP(v) },
    { header: 'Total Viáticos', key: 'valorTotal', width: 18, sample: '360000', format: (v) => formatCOP(v) },
    { header: 'Saldo COP', key: 'saldo', width: 18, sample: '45000000', format: (v) => v != null ? formatCOP(v) : '' },
    { header: 'Objeto Comisión', key: 'motivo', width: 35, sample: 'Capacitación en gestión tributaria - DIAN' },
    { header: 'Estado', key: 'estado', width: 16, sample: 'Aprobada' },
  ];

  async function exportExcel() {
    try {
      App.showToast('Generando archivo Excel...', 'info');
      const res = await API.getViaticos({ ...state.filters, page: 1, limit: 10000 });
      const records = res.data || state.data;
      ExcelService.exportToExcel({
        filename: 'Talento360_Viaticos_Institucionales',
        sheetName: 'Viáticos',
        columns: EXCEL_COLUMNS,
        data: records
      });
      App.showToast(`Se exportaron ${records.length} registros de viáticos exitosamente.`, 'success');
    } catch (err) {
      App.showToast('Error al exportar: ' + err.message, 'error');
    }
  }

  function openImportModal() {
    if (typeof XLSX === 'undefined') {
      App.showToast('La biblioteca de Excel (SheetJS) aún no se ha cargado. Recarga la página.', 'error');
      return;
    }

    const existing = document.getElementById('excel-vit-modal-overlay');
    if (existing) existing.remove();

    let selectedFile = null;

    const overlay = document.createElement('div');
    overlay.id = 'excel-vit-modal-overlay';
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
              Carga Masiva de Viáticos Institucionales
            </h2>
            <p class="modal-desc">Cargue un archivo Excel (.xlsx o .xls) institucional para importar o actualizar comisiones y viáticos con soporte para múltiples secretarías/hojas.</p>
          </div>
          <button class="modal-close" id="btn-close-vit-import">&times;</button>
        </div>

        <div class="modal-body" style="padding: 20px 24px; max-height: 75vh; overflow-y: auto;">
          <!-- Sección de Selección y Confirmación de Archivo -->
          <div id="vit-upload-section">
            <div class="excel-dropzone" id="vit-excel-dropzone">
              <input type="file" id="vit-excel-file-input" accept=".xlsx, .xls" style="display:none;" />
              <div class="excel-dropzone-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-green-bright)" stroke-width="2" style="width:48px;height:48px;">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <p class="excel-dropzone-title" id="dropzone-vit-main-text">
                Haz clic para seleccionar o arrastra aquí tu archivo Excel
              </p>
              <p class="excel-dropzone-sub">
                Formatos soportados: archivos Excel (.xlsx, .xls)
              </p>
            </div>

            <!-- Previsualización del archivo seleccionado con opción de cancelar/cambiar -->
            <div id="vit-file-preview" style="display:none; margin-top: 16px;">
              <div class="excel-file-preview-card">
                <div class="excel-file-preview-left">
                  <div class="excel-file-preview-icon">
                    📊
                  </div>
                  <div class="excel-file-preview-info">
                    <div id="vit-file-name" class="excel-file-preview-name"></div>
                    <div id="vit-file-size" class="excel-file-preview-size"></div>
                  </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-change-file-vit" style="font-size: 12px; padding: 6px 14px; font-weight: 600;">
                  Cambiar archivo
                </button>
              </div>

              <!-- Cuadro Informativo de Confirmación Previa -->
              <div class="excel-notice-card">
                <div class="excel-notice-icon">📋</div>
                <div class="excel-notice-content">
                  <strong>Confirmación de Carga Masiva</strong>
                  <p>Al confirmar la importación, se procesarán todas las hojas de cálculo del archivo institucional correspondientes a cada secretaría para registrar o actualizar los viáticos en la base de datos institucional.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Mensaje de Aceptación y Resultados (Aparece tras procesar con éxito) -->
          <div id="vit-import-result" style="display:none;"></div>
        </div>

        <div class="modal-footer" id="vit-import-footer" style="padding: 16px 24px; display:flex; justify-content:flex-end; gap:12px; border-top: 1px solid var(--color-border);">
          <button type="button" class="btn btn-secondary" id="btn-cancel-vit-import">Cancelar</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-vit-import" disabled style="display:inline-flex; align-items:center; gap:8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span id="btn-confirm-vit-text">Confirmar Importación</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#btn-close-vit-import');
    const cancelBtn = overlay.querySelector('#btn-cancel-vit-import');
    const dropzone = overlay.querySelector('#vit-excel-dropzone');
    const fileInput = overlay.querySelector('#vit-excel-file-input');
    const filePreview = overlay.querySelector('#vit-file-preview');
    const fileNameEl = overlay.querySelector('#vit-file-name');
    const fileSizeEl = overlay.querySelector('#vit-file-size');
    const changeFileBtn = overlay.querySelector('#btn-change-file-vit');
    const confirmBtn = overlay.querySelector('#btn-confirm-vit-import');
    const confirmText = overlay.querySelector('#btn-confirm-vit-text');
    const uploadSection = overlay.querySelector('#vit-upload-section');
    const resultDiv = overlay.querySelector('#vit-import-result');
    const modalFooter = overlay.querySelector('#vit-import-footer');

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

    // ─── Diccionario de equivalencias de Secretarías ──────────────────────────
    const SECRETARIA_MAP = {
      'DESPACHOGOBER': 'DESPACHO DEL GOBERNADOR',
      'DESPACHO GOBERNADOR': 'DESPACHO DEL GOBERNADOR',
      'HACIENDA': 'SECRETARÍA DE HACIENDA',
      'PLANEACION': 'SECRETARÍA DE PLANEACIÓN',
      'GENERAL': 'SECRETARÍA GENERAL',
      'INFRAESTRUCTURA': 'SECRETARÍA DE INFRAESTRUCTURA',
      'EDUCACION': 'SECRETARÍA DE EDUCACIÓN',
      'AGRICULTURA': 'SECRETARÍA DE AGRICULTURA',
      'INTEGRACION SOCIAL': 'SECRETARÍA DE INTEGRACIÓN SOCIAL',
      'CULTURA': 'SECRETARÍA DE CULTURA Y PATRIMONIO',
      'MINAS': 'SECRETARÍA DE MINAS Y ENERGÍA',
      'GOBIERNO': 'SECRETARÍA DE GOBIERNO Y ACCIÓN COMUNAL',
      'DESARROLLOEMP': 'SECRETARÍA DE DESARROLLO EMPRESARIAL',
      'CONTRATACION': 'SECRETARÍA DE CONTRATACIÓN',
      'AMBIENTE': 'SECRETARÍA DE AMBIENTE Y DESARROLLO SOSTENIBLE',
      'TURISMO': 'SECRETARÍA DE TURISMO',
      'TIC': 'SECRETARÍA TIC Y GOBIERNO ABIERTO',
      'SALUD': 'SECRETARÍA DE SALUD',
      'SECRETARIA DE SALUD': 'SECRETARÍA DE SALUD',
      '704': 'SECRETARÍA DE SALUD',
      '703': 'SECRETARÍA DE SALUD'
    };

    // ─── Conversor de número de serie de fecha de Excel ─────────────────────
    function excelSerialToDate(serial) {
      if (typeof serial !== 'number' || isNaN(serial) || serial <= 0) return null;
      const utcDays = Math.floor(serial - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      const d = String(date.getUTCDate()).padStart(2, '0');
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const y = date.getUTCFullYear();
      return `${d}/${m}/${y}`;
    }

    // ─── Parser Ultra-Robusto de Fechas y Rangos Institucionales ─────────────
    function parseDateRobust(rawVal, resolucionStr) {
      if (rawVal == null || rawVal === '') {
        if (resolucionStr) {
          const m = String(resolucionStr).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
          if (m) {
            const d = m[1].padStart(2, '0');
            const mo = m[2].padStart(2, '0');
            let yr = m[3];
            if (yr.length === 2) yr = '20' + yr;
            const dStr = `${d}/${mo}/${yr}`;
            return { start: dStr, end: dStr, dias: 1, raw: rawVal };
          }
        }
        return { start: '01/01/2023', end: '01/01/2023', dias: 1, raw: rawVal };
      }

      if (typeof rawVal === 'number' && rawVal > 30000 && rawVal < 60000) {
        const sDate = excelSerialToDate(rawVal);
        if (sDate) return { start: sDate, end: sDate, dias: 1, raw: rawVal };
      }

      if (rawVal instanceof Date) {
        const d = String(rawVal.getUTCDate()).padStart(2, '0');
        const m = String(rawVal.getUTCMonth() + 1).padStart(2, '0');
        const y = rawVal.getUTCFullYear();
        const dStr = `${d}/${m}/${y}`;
        return { start: dStr, end: dStr, dias: 1, raw: rawVal };
      }

      let s = String(rawVal).trim().replace(/\s+/g, '');
      const mResol = s.match(/^\d{3,4}\/(\d{1,2}\/\d{1,2}\/\d{2,4})$/);
      if (mResol) s = mResol[1];

      // Corrección de erratas detectadas en archivos de la Gobernación de Boyacá
      s = s.replace(/\/203$/, '/2023');
      s = s.replace(/\/024$/, '/2024');
      s = s.replace(/\/204$/, '/2024');
      s = s.replace(/(\d{1,2}\/\d{1,2})\/(\d{4})$/, '$1/$2');
      s = s.replace(/,(\/\d{2}\/\d{4})$/, '$1');
      s = s.replace(/\/(\d{2})\/(\d{4})$/, '/$1/$2');
      s = s.replace(/\/096\/(\d{4})$/, '/06/$1');

      // Fechas sin barra entre día y mes o mes y año (ej: 07,08,0908/2023 -> 07,08,09/08/2023)
      s = s.replace(/^(\d{1,2}(?:,\d{1,2})*)(\d{2})\/(\d{4})$/, '$1/$2/$3');
      s = s.replace(/^(\d{1,2}(?:,\d{1,2})*)\/(\d{2})(\d{4})$/, '$1/$2/$3');
      s = s.replace(/^(\d{1,2})\/(\d{2})(\d{4})$/, '$1/$2/$3');
      s = s.replace(/^(\d{1,2})(\d{2})\/(\d{4})$/, '$1/$2/$3');

      const parts = s.split('/').filter(p => p.length > 0);

      if (parts.length === 3) {
        let dayPart = parts[0];
        let month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        if (month.length === 3 && month.startsWith('0')) month = month.substring(1);

        const days = dayPart.split(',').map(d => {
          let cl = d.trim().replace(/^0+/, '') || '0';
          if (cl.length === 3 && cl.startsWith('22')) cl = '22';
          return cl;
        }).filter(d => d.length > 0 && !isNaN(parseInt(d, 10)));

        if (days.length > 1) {
          const start = `${days[0].padStart(2, '0')}/${month}/${year}`;
          const end = `${days[days.length - 1].padStart(2, '0')}/${month}/${year}`;
          return { start, end, dias: days.length, raw: rawVal };
        }
        const single = `${(days[0] || '01').padStart(2, '0')}/${month}/${year}`;
        return { start: single, end: single, dias: 1, raw: rawVal };
      } else if (parts.length === 4) {
        let day1Part = parts[0];
        let m1Part = parts[1];
        let day2Part = parts[2];
        let m2Part = parts[3];

        let year = '2023';
        let month2 = '01';

        if (m2Part.length === 4) {
          year = m2Part;
          month2 = day2Part.padStart(2, '0');
          const d1Tokens = day1Part.split(',').filter(Boolean);
          const d2Tokens = [m1Part];
          const startMonth = month2;
          const start = `${d1Tokens[0].padStart(2, '0')}/${startMonth}/${year}`;
          const end = `${d2Tokens[d2Tokens.length - 1].padStart(2, '0')}/${month2}/${year}`;
          return { start, end, dias: d1Tokens.length + d2Tokens.length, raw: rawVal };
        }
      } else if (parts.length >= 5) {
        let year = parts[parts.length - 1];
        if (year.length === 2) year = '20' + year;
        let endMonth = parts[parts.length - 2].padStart(2, '0');
        let endDays = parts[parts.length - 3].split(',').filter(Boolean);
        let startMonth = parts[1].padStart(2, '0');
        let startDays = parts[0].split(',').filter(Boolean);

        const start = `${(startDays[0] || '01').padStart(2, '0')}/${startMonth}/${year}`;
        const end = `${(endDays[endDays.length - 1] || '01').padStart(2, '0')}/${endMonth}/${year}`;
        const dias = (startDays.length || 1) + (endDays.length || 1);
        return { start, end, dias, raw: rawVal };
      }

      const mMatch = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (mMatch) {
        let yr = mMatch[3];
        if (yr.length === 2) yr = '20' + yr;
        const dStr = `${mMatch[1].padStart(2, '0')}/${mMatch[2].padStart(2, '0')}/${yr}`;
        return { start: dStr, end: dStr, dias: 1, raw: rawVal };
      }

      return { start: s, end: s, dias: 1, raw: rawVal };
    }

    // ─── Confirmación y procesamiento masivo con SheetJS ────────────────────
    confirmBtn.addEventListener('click', async () => {
      if (!selectedFile) return;

      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      confirmText.innerHTML = `
        <span class="btn-progress-pulse" aria-hidden="true"></span>
        Procesando Carga Masiva...
      `;
      App.showToast('Leyendo archivo y hojas de cálculo... Por favor espere.', 'info');

      try {
        const fileBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array', cellDates: true });

        if (!workbook.SheetNames || !workbook.SheetNames.length) {
          throw new Error('El archivo no contiene hojas de cálculo disponibles.');
        }

        const allRows = [];
        const hojasProcesadas = [];

        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          if (!ws) continue;
          hojasProcesadas.push(sheetName);

          const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
          if (!sheetData || !sheetData.length) continue;

          // Detectar nombre oficial de la secretaría desde celdas de encabezado B2/B3
          let secName = SECRETARIA_MAP[sheetName.trim().toUpperCase()] || sheetName.trim();
          for (let rIdx = 0; rIdx < Math.min(4, sheetData.length); rIdx++) {
            const rRow = sheetData[rIdx] || [];
            for (let cIdx = 0; cIdx < Math.min(5, rRow.length); cIdx++) {
              const cVal = String(rRow[cIdx] || '').trim().toUpperCase();
              if (cVal.includes('SECRETARIA') || cVal.includes('DESPACHO')) {
                secName = String(rRow[cIdx]).trim().toUpperCase();
                break;
              }
            }
          }

          // Buscar fila de encabezado
          let headerIdx = -1;
          for (let rIdx = 0; rIdx < Math.min(8, sheetData.length); rIdx++) {
            const rRow = sheetData[rIdx] || [];
            if (rRow.some(cell => {
              const sCell = String(cell || '').trim().toUpperCase();
              return sCell.includes('NOMBRE') || sCell.includes('FUNCIONARIO') || sCell.includes('SERVIDOR');
            })) {
              headerIdx = rIdx;
              break;
            }
          }

          if (headerIdx === -1) {
            // Intento de formato plano estándar (con Cédula / Documento)
            const jsonRows = XLSX.utils.sheet_to_json(ws);
            if (jsonRows && jsonRows.length) {
              jsonRows.forEach(jr => {
                const persona = (jr['Servidor Público'] || jr['Nombre Completo'] || jr.persona || jr.nombre || '').toString().trim();
                if (persona) {
                  allRows.push({
                    persona,
                    documento: (jr['Cédula'] || jr.documento || jr.cedula || '').toString().trim(),
                    dependencia: (jr['Dependencia'] || jr.dependencia || secName).toString().trim(),
                    cargo: (jr['Cargo'] || jr.cargo || '').toString().trim(),
                    destino: (jr['Destino'] || jr.destino || 'SIN ESPECIFICAR').toString().trim(),
                    fechaInicio: (jr['Fecha Salida'] || jr['Fecha Inicio'] || jr.fechaInicio || '').toString().trim(),
                    fechaFin: (jr['Fecha Retorno'] || jr['Fecha Fin'] || jr.fechaFin || '').toString().trim(),
                    dias: parseInt(jr['Días'] || jr.dias || 1) || 1,
                    valorDiario: parseFloat(jr['Valor Diario'] || jr.valorDiario || 0) || 0,
                    valorTotal: parseFloat(jr['Valor Total'] || jr.valorTotal || 0) || 0,
                    estado: (jr['Estado'] || jr.estado || 'Aprobada').toString().trim(),
                    observaciones: (jr['Observaciones'] || jr.observaciones || 'Carga masiva Excel').toString().trim(),
                    numeroResolucion: (jr['No. Resolución'] || jr.numeroResolucion || '').toString().trim(),
                    saldo: jr['Saldo COP'] != null ? parseFloat(jr['Saldo COP']) : null,
                    hoja: sheetName
                  });
                }
              });
            }
            continue;
          }

          // Mapear columnas según el encabezado de la hoja
          const headerRow = sheetData[headerIdx] || [];
          let colNombre = -1;
          let colFecha = -1;
          let colDestino = -1;
          let colResolucion = -1;
          let colValor = -1;
          let colSaldo = -1;
          let colObs = -1;

          headerRow.forEach((cell, idx) => {
            const hStr = String(cell || '').trim().toUpperCase();
            if (hStr.includes('NOMBRE') || hStr.includes('FUNCIONARIO') || hStr.includes('SERVIDOR')) colNombre = idx;
            else if (hStr.includes('FECHA')) colFecha = idx;
            else if (hStr.includes('LUGAR') || hStr.includes('DESTINO') || hStr.includes('COMISION')) colDestino = idx;
            else if (hStr.includes('RESOLUCION') || hStr.includes('RESOL') || hStr.includes('ACTO')) colResolucion = idx;
            else if (hStr.includes('VALOR') || hStr.includes('TOTAL') || hStr.includes('COSTO')) colValor = idx;
            else if (hStr.includes('SALDO')) colSaldo = idx;
            else if (hStr.includes('OBSERVACION') || hStr.includes('OBS')) colObs = idx;
          });

          if (colNombre === -1) colNombre = 0;
          if (colFecha === -1) colFecha = colNombre + 1;
          if (colDestino === -1) colDestino = colFecha + 1;
          if (colResolucion === -1) colResolucion = colDestino + 1;
          if (colValor === -1) colValor = colResolucion + 1;
          if (colSaldo === -1 || colSaldo <= colValor) colSaldo = colValor + 1;
          if (colObs === -1 || colObs <= colValor) colObs = colValor + 2;

          // Iterar filas de datos
          for (let rIdx = headerIdx + 1; rIdx < sheetData.length; rIdx++) {
            const row = sheetData[rIdx] || [];
            const nomVal = row[colNombre];
            if (!nomVal) continue;

            const nomStr = String(nomVal).trim();
            const nomUpper = nomStr.toUpperCase();
            if (['TOTAL', 'SUBTOTAL', 'SALDO', 'FIRMA', 'RESUMEN'].includes(nomUpper)) continue;

            const rawFecha = row[colFecha];
            const resolVal = row[colResolucion] ? String(row[colResolucion]).trim() : '';
            const destinoVal = row[colDestino] ? String(row[colDestino]).trim().toUpperCase() : 'SIN ESPECIFICAR';
            const valNum = row[colValor] != null ? Number(row[colValor]) : 0;
            const valor = isNaN(valNum) ? 0 : valNum;
            const saldoVal = row[colSaldo] != null && !isNaN(Number(row[colSaldo])) ? Number(row[colSaldo]) : null;
            const obsVal = row[colObs] ? String(row[colObs]).trim() : '';

            const dInfo = parseDateRobust(rawFecha, resolVal);
            const dias = dInfo.dias || 1;
            const valorDiario = dias > 0 && valor > 0 ? parseFloat((valor / dias).toFixed(2)) : 0;
            const estado = (valor === 0 || obsVal.toUpperCase().includes('SIN VIATICOS')) ? 'Finalizada' : 'Aprobada';

            allRows.push({
              persona: nomStr,
              dependencia: secName,
              destino: destinoVal,
              motivo: 'Comisión institucional de servicios',
              fechaInicio: dInfo.start,
              fechaFin: dInfo.end,
              dias,
              valorDiario,
              valorTotal: valor,
              estado,
              observaciones: obsVal || (valor === 0 ? 'SIN VIÁTICOS' : 'Carga masiva Excel'),
              numeroResolucion: resolVal,
              saldo: saldoVal,
              hoja: sheetName
            });
          }
        }

        if (!allRows.length) {
          throw new Error('No se detectaron registros válidos de viáticos en el archivo.');
        }

        App.showToast(`Importando ${allRows.length.toLocaleString('es-CO')} viáticos en ${hojasProcesadas.length} secretarías...`, 'info');

        const res = await API.bulkCreateViaticos({ rows: allRows, hojasProcesadas });
        if (typeof Fx !== 'undefined' && Fx.play) Fx.play('success');

        const { resumen = {}, errores = [] } = res;

        // Ocultar sección de carga y mostrar resultados exactos
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
              El archivo <strong>${escHtml(selectedFile.name)}</strong> fue procesado e integrado en el sistema correctamente.
            </p>
          </div>

          <!-- Resumen de Operaciones Realizadas -->
          <div class="excel-summary-box">
            <div class="excel-summary-topbar">
              <span class="excel-summary-heading">
                <span>📊</span> Resumen de Operaciones Realizadas
              </span>
              <span class="badge badge--info excel-sheets-badge">
                ${hojasProcesadas.length} Hoja(s) Procesada(s)
              </span>
            </div>

            <div class="excel-kpi-grid">
              <div class="excel-kpi-tile excel-kpi-tile--total">
                <span class="excel-kpi-label">Total Filas</span>
                <span class="excel-kpi-value">${(resumen.totalFilas || allRows.length).toLocaleString('es-CO')}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--inserted">
                <span class="excel-kpi-label">Nuevos Registros</span>
                <span class="excel-kpi-value">${(resumen.insertados || 0).toLocaleString('es-CO')}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--updated">
                <span class="excel-kpi-label">Actualizados</span>
                <span class="excel-kpi-value">${(resumen.actualizados || 0).toLocaleString('es-CO')}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--vacant">
                <span class="excel-kpi-label">Valor Total COP</span>
                <span class="excel-kpi-value" style="font-size: 13px;">${formatCOP(resumen.totalValor || 0)}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--provisional">
                <span class="excel-kpi-label">Secretarías</span>
                <span class="excel-kpi-value">${hojasProcesadas.length}</span>
              </div>
            </div>

            ${errores.length > 0 ? `
              <div class="excel-error-log-card">
                <strong class="excel-error-log-title">Inconsistencias (${errores.length}):</strong>
                <ul class="excel-error-log-list">
                  ${errores.slice(0, 20).map(e => `<li>${escHtml(typeof e === 'string' ? e : e.error || JSON.stringify(e))}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;

        modalFooter.innerHTML = `
          <button type="button" class="btn btn-primary" id="btn-accept-vit-import" style="min-width: 140px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:17px;height:17px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Aceptar
          </button>
        `;

        const acceptBtn = modalFooter.querySelector('#btn-accept-vit-import');
        acceptBtn.addEventListener('click', async () => {
          overlay.remove();
          App.showToast(`Carga masiva finalizada: ${resumen.insertados || 0} creados, ${resumen.actualizados || 0} actualizados.`, 'success');
          await load();
          loadStats();
        });

      } catch (err) {
        App.showToast('Error al importar: ' + err.message, 'error');
        confirmBtn.disabled = false;
        confirmText.textContent = 'Reintentar Importación';
        cancelBtn.disabled = false;
      }
    });
  }

  function downloadOfficialTemplate() {
    if (typeof XLSX === 'undefined') {
      App.showToast('La biblioteca de Excel (SheetJS) aún no se ha cargado.', 'error');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // 17 Secretarías y Despachos Institucionales de la Gobernación de Boyacá
      const SECRETARIAS_PLANTILLA = [
        { code: 'DESPACHOGOBER', name: 'DESPACHO DEL GOBERNADOR', saldo: 50000000, sampleNom: 'ANA MARIA ROJAS VILLAMIL', sampleFecha: '18,19/01/2026', sampleLugar: 'TUNJA / BOGOTA', sampleRes: '0056/17/01/2026', sampleVal: 138000 },
        { code: 'HACIENDA', name: 'SECRETARÍA DE HACIENDA', saldo: 50000000, sampleNom: 'PEDRO PASCASIO MARTINEZ', sampleFecha: '29,30/01/2026', sampleLugar: 'SATIVANORTE', sampleRes: '0200/29/01/2026', sampleVal: 128000 },
        { code: 'PLANEACION', name: 'SECRETARÍA DE PLANEACIÓN', saldo: 40000000, sampleNom: 'HENRY ALIRIO MORALES JAIME', sampleFecha: '18,19/04/2026', sampleLugar: 'CHISCAS, GUICAN, EL COCUY', sampleRes: '1337/15/04/2026', sampleVal: 383000 },
        { code: 'GENERAL', name: 'SECRETARÍA GENERAL', saldo: 45000000, sampleNom: 'GARCIA MARTINEZ LUIS FERNANDO', sampleFecha: '15,16/05/2026', sampleLugar: 'BOGOTA D.C.', sampleRes: '0412/12/05/2026', sampleVal: 240000 },
        { code: 'INFRAESTRUCTURA', name: 'SECRETARÍA DE INFRAESTRUCTURA', saldo: 60000000, sampleNom: 'RAMIREZ LOPEZ CARLOS ARTURO', sampleFecha: '20,21/02/2026', sampleLugar: 'PUERTO BOYACA', sampleRes: '0520/20/02/2026', sampleVal: 350000 },
        { code: 'EDUCACION', name: 'SECRETARÍA DE EDUCACIÓN', saldo: 70000000, sampleNom: 'MONTAÑEZ SILVA CLARA INES', sampleFecha: '05,06/03/2026', sampleLugar: 'SOATA', sampleRes: '0615/05/03/2026', sampleVal: 180000 },
        { code: 'AGRICULTURA', name: 'SECRETARÍA DE AGRICULTURA', saldo: 40000000, sampleNom: 'CASTRO VARGAS DANIEL FELIPE', sampleFecha: '18,19/02/2026', sampleLugar: 'MIRAFLORES', sampleRes: '0710/18/02/2026', sampleVal: 210000 },
        { code: 'INTEGRACION SOCIAL', name: 'SECRETARÍA DE INTEGRACIÓN SOCIAL', saldo: 35000000, sampleNom: 'PINZON DUARTE LILIANA ANDREA', sampleFecha: '22,23/03/2026', sampleLugar: 'GARAGOA', sampleRes: '0812/22/03/2026', sampleVal: 165000 },
        { code: 'CULTURA', name: 'SECRETARÍA DE CULTURA Y PATRIMONIO', saldo: 30000000, sampleNom: 'TORRES BARRERA MAURICIO', sampleFecha: '10,11/04/2026', sampleLugar: 'VILLA DE LEYVA', sampleRes: '0915/10/04/2026', sampleVal: 195000 },
        { code: 'MINAS', name: 'SECRETARÍA DE MINAS Y ENERGÍA', saldo: 35000000, sampleNom: 'HERNANDEZ ROA GABRIEL', sampleFecha: '14,15/03/2026', sampleLugar: 'PAZ DE RIO', sampleRes: '1012/14/03/2026', sampleVal: 220000 },
        { code: 'GOBIERNO', name: 'SECRETARÍA DE GOBIERNO Y ACCIÓN COMUNAL', saldo: 45000000, sampleNom: 'ORTIZ SUAREZ BLANCA HELENA', sampleFecha: '02,03/02/2026', sampleLugar: 'CHIQUINQUIRA', sampleRes: '1105/02/02/2026', sampleVal: 175000 },
        { code: 'DESARROLLOEMP', name: 'SECRETARÍA DE DESARROLLO EMPRESARIAL', saldo: 40000000, sampleNom: 'GOMEZ BERNAL RICARDO', sampleFecha: '25,26/03/2026', sampleLugar: 'DUITAMA', sampleRes: '1210/25/03/2026', sampleVal: 150000 },
        { code: 'CONTRATACION', name: 'SECRETARÍA DE CONTRATACIÓN', saldo: 30000000, sampleNom: 'SUAREZ RIVERA ANDRES', sampleFecha: '11,12/02/2026', sampleLugar: 'BOGOTA D.C.', sampleRes: '1302/11/02/2026', sampleVal: 240000 },
        { code: 'AMBIENTE', name: 'SECRETARÍA DE AMBIENTE Y DESARROLLO SOSTENIBLE', saldo: 35000000, sampleNom: 'RODRIGUEZ PAEZ CAMILA', sampleFecha: '19,20/03/2026', sampleLugar: 'AQUITANIA', sampleRes: '1410/19/03/2026', sampleVal: 185000 },
        { code: 'TURISMO', name: 'SECRETARÍA DE TURISMO', saldo: 30000000, sampleNom: 'ALVAREZ DUARTE JULIAN', sampleFecha: '08,09/04/2026', sampleLugar: 'PAIPA', sampleRes: '1515/08/04/2026', sampleVal: 145000 },
        { code: 'TIC', name: 'SECRETARÍA TIC Y GOBIERNO ABIERTO', saldo: 35000000, sampleNom: 'MEDINA REYES OSCAR DAVID', sampleFecha: '16,17/03/2026', sampleLugar: 'SOGAMOSO', sampleRes: '1612/16/03/2026', sampleVal: 160000 },
        { code: 'SALUD', name: 'SECRETARÍA DE SALUD', saldo: 80000000, sampleNom: 'FRANCISCO JOSE ALVAREZ OCHOA', sampleFecha: '02,03/02/2026', sampleLugar: 'PAIPA, COMBITA', sampleRes: '0256/02/02/2026', sampleVal: 190000 }
      ];

      SECRETARIAS_PLANTILLA.forEach(sec => {
        const rows = [
          ['GOBERNACIÓN DE BOYACÁ - EJECUCIÓN PRESUPUESTAL VIÁTICOS'],
          [sec.name],
          [null, null, null, null, null, 'SALDO'],
          ['ITEM', 'NOMBRE', 'FECHA COMISION', 'LUGAR COMISION', 'No.RESOLUCION', 'VALOR', sec.saldo, 'OBSERVACIONES'],
        ];
        // 20 filas en blanco para ingreso directo del usuario
        for (let i = 1; i <= 20; i++) {
          rows.push([i, null, null, null, null, null, null, null]);
        }
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
          { wch: 8 },   // ITEM
          { wch: 38 },  // NOMBRE
          { wch: 22 },  // FECHA COMISION
          { wch: 30 },  // LUGAR COMISION
          { wch: 24 },  // No.RESOLUCION
          { wch: 18 },  // VALOR
          { wch: 20 },  // SALDO
          { wch: 35 }   // OBSERVACIONES
        ];
        // Habilitar autofiltros expandibles en Excel
        ws['!autofilter'] = { ref: 'A4:H24' };
        XLSX.utils.book_append_sheet(wb, ws, sec.code);
      });

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Plantilla_Oficial_Viaticos_Gobernacion_Boyaca_${dateStr}.xlsx`);
      App.showToast('Plantilla oficial institucional de viáticos (17 secretarías) descargada exitosamente.', 'success');
      if (typeof Fx !== 'undefined' && Fx.play) Fx.play('success');
    } catch (err) {
      console.error('[ViaticosModule] Error al descargar plantilla oficial:', err);
      App.showToast('Error al generar la plantilla oficial de viáticos: ' + err.message, 'error');
    }
  }

  return {
    render,
    openCreate,
    openView,
    openEdit,
    openStatusPicker,
    selectQuickStatus,
    confirmDelete,
    applyFilters,
    clearFilters,
    goPage,
    calcTotal,
    onNombreInput,
    selectEmployee,
    onTipoDestinoChange,
    onDeptoChange,
    updateDestinoFinal,
    onDatesChange,
    onEstadoChange,
    onFileSelected,
    removeUploadedFile,
    viewSoporte,
    exportExcel,
    openImportModal,
    downloadOfficialTemplate,
    toggleActionsDropdown,
    closeActionsDropdown,
    handleDropdownKeydown,
    switchFichaTab,
    copyFichaText,
  };
})();
