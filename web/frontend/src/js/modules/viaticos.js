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

  let state = {
    activeView: 'years',
    selectedYear: null,
    activePackage: null,
    packages: [],
    data: [],
    total: 0,
    page: 1,
    totalPages: 1,
    filters: {}
  };
  let mainContainer = null;
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

  function getProgressColor(pct) {
    if (pct < 35) return '#dc2626';
    if (pct < 75) return '#A5451B';
    if (pct < 95) return '#628001';
    return '#28871B';
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

  function renderStatsSkeletons(count = 5) {
    return Array.from({ length: count }).map(() => `
      <div class="stat-card db-glass-card" role="progressbar" aria-busy="true" aria-label="Cargando estadísticas...">
        <div class="stat-icon skeleton" style="width: 36px; height: 36px; border-radius: 8px;" aria-hidden="true"></div>
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
      const params = { page: state.page, limit: 20, ...state.filters };
      if (state.activePackage && state.activePackage.id_paquete) {
        params.id_paquete = state.activePackage.id_paquete;
      }
      const res = await API.getViaticos(params);
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
          <span style="font-weight:700;">${escHtml(r.radicado)}</span>
          ${r.numeroResolucion ? `<span class="user-table-cc font-mono" style="font-size:11px;color:var(--text-muted);display:block;margin-top:2px;">Res. ${escHtml(r.numeroResolucion)}</span>` : ''}
        </td>
        <td>
          <div class="user-table-cell">
            <span class="td-primary" title="${escHtml(r.persona)}">${escHtml(truncate(r.persona, 26)) || '—'}</span>
            <span class="user-table-cc font-mono">${r.documento ? `C.C. ${escHtml(r.documento)}` : '—'}</span>
          </div>
        </td>
        <td title="${escHtml(r.dependencia)}">${escHtml(truncate(r.dependencia, 24)) || '—'}</td>
        <td title="${escHtml(r.destino)}">${escHtml(truncate(r.destino, 20)) || '—'}</td>
        <td>${escHtml(r.fechaInicio || '—')}</td>
        <td>${escHtml(String(r.dias ?? '—'))} días</td>
        <td class="td-currency">${formatCOP(r.valorTotal)}</td>
        <td>
          <button type="button" class="badge badge--interactive ${badgeClass(r.estado)}" onclick="ViaticosModule.openStatusPicker(${r.id})" title="Clic para cambiar estado de este viático" aria-label="Cambiar estado: ${escHtml(r.estado)}">
            <span>${escHtml(r.estado)}</span>
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
  let currentFormIsEdit = false;
  let currentFormEditId = null;
  const VIATICOS_TABS = ['tab-vit-servidor', 'tab-vit-comision', 'tab-vit-liquidacion', 'tab-vit-soporte'];

  function updateViaticosWizardFooter(tabId) {
    const footer = document.getElementById('modal-footer');
    if (!footer) return;

    const curIdx = VIATICOS_TABS.indexOf(tabId);
    const prevTab = curIdx > 0 ? VIATICOS_TABS[curIdx - 1] : null;
    const nextTab = curIdx < VIATICOS_TABS.length - 1 ? VIATICOS_TABS[curIdx + 1] : null;

    const arrowNextSvg = `<svg class="wizard-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
    const arrowPrevSvg = `<svg class="wizard-prev-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;
    const saveCheckSvg = `<svg class="wizard-save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    let buttonsHtml = '';

    if (prevTab) {
      buttonsHtml += `<button type="button" class="btn btn-secondary btn-wizard-prev" onclick="ViaticosModule.switchFormTab('${prevTab}')">${arrowPrevSvg}<span>Anterior</span></button>`;
    } else {
      buttonsHtml += `<button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>`;
    }

    if (nextTab) {
      if (currentFormIsEdit) {
        buttonsHtml += `<button type="button" class="btn btn-gold" id="vit-save-btn" onclick="ViaticosModule.saveEdit(${currentFormEditId})">${saveCheckSvg}<span>Guardar Cambios</span></button>`;
      }
      buttonsHtml += `<button type="button" class="btn btn-primary btn-wizard-next" onclick="ViaticosModule.switchFormTab('${nextTab}')"><span>Continuar</span>${arrowNextSvg}</button>`;
    } else {
      // Última pestaña (Soporte & Estado)
      if (currentFormIsEdit) {
        buttonsHtml += `<button type="button" class="btn btn-gold" id="vit-save-btn" onclick="ViaticosModule.saveEdit(${currentFormEditId})">${saveCheckSvg}<span>Actualizar Viático</span></button>`;
      } else {
        buttonsHtml += `<button type="button" class="btn btn-primary" id="vit-save-btn" onclick="ViaticosModule.saveCreate()">${saveCheckSvg}<span>Crear Viático</span></button>`;
      }
    }

    footer.innerHTML = buttonsHtml;
  }

  function switchFormTab(tabId) {
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.click();
    const modalBody = document.getElementById('modal-body');
    if (!modalBody) return;
    modalBody.querySelectorAll('.form-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    modalBody.querySelectorAll('.form-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
    updateViaticosWizardFooter(tabId);
    if (typeof App !== 'undefined' && App.refreshFloatingLabels) {
      App.refreshFloatingLabels(modalBody);
    }
  }

  function buildForm(r = {}) {
    const dis = Auth.canEdit() ? '' : 'disabled';
    currentUploadedFile = r.soporte || null;

    const isIntl = r.tipoDestino === 'Internacional' || (r.destino && PAISES_INTERNACIONAL.some(p => r.destino.includes(p)));
    const defaultDepto = r.departamento || '';

    return `
      <div class="emp-form-wrapper">
        <!-- Barra de Pestañas de Navegación -->
        <div class="emp-form-tabs-container">
          <div class="form-tabs">
            <button type="button" class="form-tab-btn active" data-tab="tab-vit-servidor" onclick="ViaticosModule.switchFormTab('tab-vit-servidor')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Servidor Público
            </button>
            <button type="button" class="form-tab-btn" data-tab="tab-vit-comision" onclick="ViaticosModule.switchFormTab('tab-vit-comision')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Destino & Comisión
            </button>
            <button type="button" class="form-tab-btn" data-tab="tab-vit-liquidacion" onclick="ViaticosModule.switchFormTab('tab-vit-liquidacion')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Liquidación & Valores
            </button>
            <button type="button" class="form-tab-btn" data-tab="tab-vit-soporte" onclick="ViaticosModule.switchFormTab('tab-vit-soporte')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Soporte & Estado
            </button>
          </div>
        </div>

        <!-- ─── PESTAÑA 1: SERVIDOR PÚBLICO ─── -->
        <div id="tab-vit-servidor" class="form-tab-pane active" style="padding-top: 6px;">
          <div class="form-grid">
            <div class="form-group span-2 autocomplete-wrapper">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label class="form-label" style="margin:0;">Nombre Completo del Servidor</label>
                <div id="vf-locked-box" style="display:none; align-items:center; gap:8px;">
                  <span class="badge-servidor-vinculado" title="Información protegida procedente de la base de datos de servidores públicos">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Servidor Vinculado (Protegido)
                  </span>
                  <button type="button" class="btn-unlock-servidor" onclick="ViaticosModule.unlockServidor()" title="Desvincular servidor y permitir edición manual">
                    ✕ Desvincular / Editar manual
                  </button>
                </div>
              </div>
              <input id="vf-nombre" class="form-input" placeholder="Escribe el nombre o cédula del funcionario..." enterkeyhint="next" value="${escHtml(r.persona||'')}" oninput="ViaticosModule.onNombreInput(this.value)" autocomplete="off" ${dis} required />
              <div id="vf-autocomplete-list" class="autocomplete-dropdown" style="display:none;"></div>
            </div>

            <div class="form-group">
              <label class="form-label">Documento de Identidad (C.C.)</label>
              <input id="vf-doc" class="form-input font-mono" placeholder="Número de cédula" inputmode="numeric" enterkeyhint="next" value="${escHtml(r.documento||'')}" ${dis} />
            </div>

            <div class="form-group">
              <label class="form-label">Cargo Actual</label>
              <input id="vf-cargo" class="form-input" placeholder="Cargo del servidor..." enterkeyhint="next" value="${escHtml(r.cargo||'')}" ${dis} />
            </div>

            <div class="form-group span-2">
              <label class="form-label">Dependencia / Secretaría</label>
              <input id="vf-dep" class="form-input" placeholder="Secretaría o Dependencia institucional..." enterkeyhint="next" value="${escHtml(r.dependencia||'')}" ${dis} />
            </div>

            <div class="form-group span-2">
              <label class="form-label">Vigencia Fiscal / Carpeta de Viáticos</label>
              <select id="vf-id-paquete" class="filter-select" ${dis}>
                ${(state.packages || []).map(p => {
                  const isSel = (r.id_paquete && parseInt(r.id_paquete, 10) === parseInt(p.id_paquete, 10)) ||
                                (state.activePackage && parseInt(state.activePackage.id_paquete, 10) === parseInt(p.id_paquete, 10));
                  return `<option value="${p.id_paquete}" ${isSel ? 'selected' : ''}>Vigencia ${p.anio} - ${escHtml(p.nombre)}` + (p.total_viaticos ? ` (${p.total_viaticos} registros)` : '') + `</option>`;
                }).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- ─── PESTAÑA 2: DESTINO & COMISIÓN ─── -->
        <div id="tab-vit-comision" class="form-tab-pane" style="padding-top: 6px;">
          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label">Tipo de Desplazamiento</label>
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
                <label class="form-label">Departamento</label>
                <select id="vf-depto" class="filter-select" onchange="ViaticosModule.onDeptoChange()" ${dis}>
                  <option value="" ${!defaultDepto ? 'selected' : ''}>Seleccione Departamento...</option>${Object.keys(COLOMBIA_GEO).map(d => `<option value="${d}" ${d === defaultDepto ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Municipio / Ciudad</label>
                <select id="vf-muni" class="filter-select" onchange="ViaticosModule.updateDestinoFinal()" ${dis}>
                  <!-- Poblado dinámicamente -->
                </select>
              </div>
            </div>

            <!-- Destino Internacional -->
            <div id="vf-dest-internacional" class="form-subgrid span-2" style="display:${isIntl ? 'grid' : 'none'}; grid-template-columns:1fr 1fr; gap:var(--space-3);">
              <div class="form-group">
                <label class="form-label">País de Destino</label>
                <select id="vf-pais" class="filter-select" onchange="ViaticosModule.updateDestinoFinal()" ${dis}>
                  ${PAISES_INTERNACIONAL.map(p => `<option value="${p}">${p}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Ciudad Internacional</label>
                <input id="vf-ciudad-int" class="form-input" placeholder="Ej: Washington D.C., Madrid..." enterkeyhint="next" oninput="ViaticosModule.updateDestinoFinal()" ${dis} />
              </div>
            </div>

            <input type="hidden" id="vf-destino" value="${escHtml(r.destino || '')}" />

            <div class="form-group span-2">
              <div class="dest-preview-box">
                <span class="dest-preview-icon">📍</span>
                <span class="dest-preview-label">Destino Consolidado:</span>
                <strong id="vf-dest-preview-text" class="dest-preview-val">${escHtml(r.destino || 'Sin definir')}</strong>
              </div>
            </div>

            <div class="form-group span-2">
              <label class="form-label">Motivo o Justificación del Desplazamiento</label>
              <textarea id="vf-motivo" class="form-input" rows="2" style="min-height:56px; resize:none; line-height:1.45; word-break:break-word;" placeholder="Ej: Comisión oficial para inspección técnica en territorio..." enterkeyhint="next" ${dis}>${escHtml(r.motivo||'')}</textarea>
            </div>
          </div>
        </div>

        <!-- ─── PESTAÑA 3: LIQUIDACIÓN & VALORES ─── -->
        <div id="tab-vit-liquidacion" class="form-tab-pane" style="padding-top: 6px;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Fecha de Inicio</label>
              <input id="vf-fi" type="date" class="form-input" value="${toIsoDate(r.fechaInicio)}" onchange="ViaticosModule.onDatesChange()" ${dis} required />
            </div>

            <div class="form-group">
              <label class="form-label">Fecha de Finalización</label>
              <input id="vf-ff" type="date" class="form-input" value="${toIsoDate(r.fechaFin)}" onchange="ViaticosModule.onDatesChange()" ${dis} required />
            </div>

            <div class="form-group">
              <label class="form-label">Número de Días (calculado)</label>
              <input id="vf-dias" class="form-input" type="number" min="1" inputmode="numeric" enterkeyhint="next" placeholder="Ej: 3" value="${escHtml(r.dias != null ? r.dias : '')}" oninput="ViaticosModule.calcTotal()" ${dis} />
            </div>

            <div class="form-group">
              <label class="form-label">Valor Diario ($ COP)</label>
              <input id="vf-vdiario" class="form-input" type="number" min="0" step="1000" placeholder="Ej: 150000" inputmode="numeric" enterkeyhint="next" value="${escHtml(r.valorDiario != null ? r.valorDiario : '')}" oninput="ViaticosModule.calcTotal()" ${dis} />
            </div>

            <div class="form-group span-2">
              <label class="form-label">Valor Total del Viático (Cálculo automático)</label>
              <input id="vf-vtotal" class="form-input" placeholder="Calculado automáticamente" readonly style="background:rgba(40,135,27,0.08);border-color:rgba(40,135,27,0.3);color:var(--color-green-dark);font-weight:700;font-size:1.05rem;" value="${r.valorTotal ? formatCOP(r.valorTotal) : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">N° Resolución / Acto</label>
              <input id="vf-resolucion" class="form-input font-mono" placeholder="Ej: 0053/18/01/2024" enterkeyhint="next" value="${escHtml(r.numeroResolucion||'')}" ${dis} />
            </div>

            <div class="form-group">
              <label class="form-label">Saldo Presupuestal ($ COP)</label>
              <input id="vf-saldo" class="form-input" type="number" step="1000" placeholder="Ej: 50000000" inputmode="numeric" enterkeyhint="next" value="${escHtml(r.saldo||'')}" ${dis} />
            </div>

            <div class="form-group span-2">
              <label class="form-label">Aprobado Por</label>
              <input id="vf-aprobado" class="form-input" placeholder="Nombre de la autoridad o funcionario que aprueba..." enterkeyhint="next" value="${escHtml(r.aprobadoPor||'')}" ${dis} />
            </div>
          </div>
        </div>

        <!-- ─── PESTAÑA 4: SOPORTE & ESTADO ─── -->
        <div id="tab-vit-soporte" class="form-tab-pane" style="padding-top: 6px;">
          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label">Estado de la Solicitud</label>
              <select id="vf-estado" class="filter-select" onchange="ViaticosModule.onEstadoChange()" ${dis}>
                <option value="" ${!r.estado ? 'selected' : ''} disabled>Seleccione Estado...</option>${ESTADOS.filter(s => s !== 'Todos').map(s => `<option ${r.estado === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>

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
              <textarea id="vf-obs" class="form-input" rows="2" style="min-height:56px; resize:none; line-height:1.45; word-break:break-word;" placeholder="Anotaciones de gestión o trámite..." enterkeyhint="done" ${dis}>${escHtml(r.observaciones||'')}</textarea>
            </div>
          </div>
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
      if (deptoSelect.value) {
        onDeptoChange();
      }
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
          drop.innerHTML = `<div class="autocomplete-empty-state"><span>🔍 No se encontraron funcionarios con ese nombre o documento</span></div>`;
          drop.style.display = 'block';
          return;
        }
        drop.innerHTML = list.map(emp => {
          const initial = (emp.nombre_completo || 'S').trim().charAt(0).toUpperCase();
          return `
            <div class="autocomplete-item" onclick="ViaticosModule.selectEmployee(${JSON.stringify(emp).replace(/"/g, '&quot;')})">
              <div class="autocomplete-item-avatar">${initial}</div>
              <div class="autocomplete-item-body">
                <div class="autocomplete-item-header">
                  <span class="autocomplete-item-name">${escHtml(emp.nombre_completo)}</span>
                  <span class="autocomplete-badge-doc">C.C. ${escHtml(emp.cedula || '—')}</span>
                </div>
                <div class="autocomplete-item-meta">
                  ${escHtml(emp.cargo_actual || emp.cargo_base || 'Cargo no asignado')} • ${escHtml(emp.dependencia || 'Sin dependencia')}
                </div>
              </div>
            </div>
          `;
        }).join('');
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
    const lockedBox = document.getElementById('vf-locked-box');

    if (nombreInput) nombreInput.value = emp.nombre_completo || '';
    if (docInput) docInput.value = emp.cedula || '';
    if (cargoInput) cargoInput.value = emp.cargo_actual || emp.cargo_base || '';
    if (depInput) depInput.value = emp.dependencia || '';
    if (drop) { drop.style.display = 'none'; drop.innerHTML = ''; }

    // Bloquear campos y aplicar destello visual
    const fields = [nombreInput, docInput, cargoInput, depInput];
    fields.forEach(el => {
      if (el) {
        el.readOnly = true;
        el.classList.add('field-locked-readonly');
        el.classList.remove('input-flash-sync');
        void el.offsetWidth;
        el.classList.add('input-flash-sync');
        setTimeout(() => {
          el.classList.remove('input-flash-sync');
        }, 2200);
      }
    });

    if (lockedBox) lockedBox.style.display = 'inline-flex';

    if (typeof App !== 'undefined' && App.refreshFloatingLabels) {
      App.refreshFloatingLabels(document.getElementById('modal-body'));
    }

    App.showToast(`Datos vinculados y protegidos para ${emp.nombre_completo}.`, 'info');
  }

  function unlockServidor() {
    const nombreInput = document.getElementById('vf-nombre');
    const docInput = document.getElementById('vf-doc');
    const cargoInput = document.getElementById('vf-cargo');
    const depInput = document.getElementById('vf-dep');
    const lockedBox = document.getElementById('vf-locked-box');

    const fields = [nombreInput, docInput, cargoInput, depInput];
    fields.forEach(el => {
      if (el) {
        el.readOnly = false;
        el.classList.remove('field-locked-readonly');
        el.classList.remove('input-flash-sync');
      }
    });

    if (lockedBox) lockedBox.style.display = 'none';
    App.showToast('Campos de servidor desbloqueados para edición manual.', 'info');
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
    const depto = document.getElementById('vf-depto')?.value;
    const muniSelect = document.getElementById('vf-muni');
    if (!muniSelect) return;
    if (!depto) {
      muniSelect.innerHTML = '<option value="">Seleccione Municipio...</option>';
      updateDestinoFinal();
      return;
    }
    const munis = COLOMBIA_GEO[depto] || ['Capital / Ciudad Principal', 'Otro municipio'];
    muniSelect.innerHTML = '<option value="">Seleccione Municipio...</option>' + munis.map(m => `<option value="${m}" ${m === selectedMuni ? 'selected' : ''}>${m}</option>`).join('');
    updateDestinoFinal();
  }

  function updateDestinoFinal() {
    const tipo = document.querySelector('input[name="vf-tipo-dest"]:checked')?.value || 'Nacional';
    let destText = '';
    if (tipo === 'Nacional') {
      const depto = document.getElementById('vf-depto')?.value || '';
      const muni = document.getElementById('vf-muni')?.value || '';
      if (muni && depto) {
        destText = `${muni}, ${depto}`;
      } else if (depto) {
        destText = depto;
      }
    } else {
      const pais = document.getElementById('vf-pais')?.value || '';
      const ciudad = document.getElementById('vf-ciudad-int')?.value.trim() || '';
      if (ciudad && pais) {
        destText = `${ciudad}, ${pais}`;
      } else if (pais) {
        destText = pais;
      }
    }
    const hiddenDest = document.getElementById('vf-destino');
    const previewText = document.getElementById('vf-dest-preview-text');
    if (hiddenDest) hiddenDest.value = destText;
    if (previewText) previewText.textContent = destText || 'Sin definir';
    if (typeof App !== 'undefined' && App.refreshFloatingLabels) {
      App.refreshFloatingLabels(document.getElementById('modal-body'));
    }
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
    if (el) el.value = (dias > 0 && daily > 0) ? formatCOP(total) : '';
    if (typeof App !== 'undefined' && App.refreshFloatingLabels) {
      App.refreshFloatingLabels(document.getElementById('modal-body'));
    }
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
    if (typeof App !== 'undefined' && App.refreshFloatingLabels) {
      App.refreshFloatingLabels(document.getElementById('modal-body'));
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

    const soporteStr = String(r.soporte).trim();
    const isImage = /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(soporteStr);
    const isPdf = /^data:application\/pdf;base64,/i.test(soporteStr);
    const isHttpsUrl = /^https:\/\/[^\s"'<>]+$/i.test(soporteStr);

    if (!isImage && !isPdf && !isHttpsUrl) {
      App.showToast('El soporte adjunto no tiene un formato o protocolo seguro permitido.', 'warning');
      return;
    }

    const radicadoSeguro = escHtml(r.radicado || 'Soporte');

    if (isImage) {
      App.openModal(`Soporte de Viático - ${radicadoSeguro}`, `
        <div style="text-align:center;padding:var(--space-2);">
          <img src="${soporteStr}" alt="Soporte de viático" style="max-width:100%;max-height:70vh;border-radius:var(--radius-md);box-shadow:0 8px 24px rgba(0,0,0,0.5);" />
          <div style="margin-top:var(--space-4);">
            <a href="${soporteStr}" download="soporte_${radicadoSeguro}.png" class="btn btn-primary btn-sm">Descargar Imagen</a>
          </div>
        </div>
      `, [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }]);
    } else if (isPdf) {
      App.openModal(`Soporte de Viático - ${radicadoSeguro}`, `
        <div style="width:100%;height:70vh;">
          <iframe src="${soporteStr}" sandbox="allow-scripts allow-same-origin" style="width:100%;height:100%;border:none;border-radius:var(--radius-md);"></iframe>
        </div>
      `, [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }]);
    } else if (isHttpsUrl) {
      App.openModal(`Soporte de Viático - ${radicadoSeguro}`, `
        <div style="padding:var(--space-4);text-align:center;">
          <p style="color:var(--text-secondary);margin-bottom:var(--space-3);">Documento institucional disponible en enlace seguro:</p>
          <a href="${soporteStr}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Abrir Documento Seguro</a>
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
    currentFormIsEdit = false;
    currentFormEditId = null;
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.modalOpen();
    App.openModal('Nuevo Viático Institucional', buildForm(), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Continuar →', cls: 'btn-primary btn-wizard-next', action: () => switchFormTab('tab-vit-comision') },
    ], 'modal-form-emp modal-lg');
    const box = document.querySelector('.modal-box');
    if (box) {
      box.classList.add('modal-form-emp', 'modal-lg');
      box.style.maxWidth = '900px';
      box.style.width = '92vw';
    }
    updateViaticosWizardFooter('tab-vit-servidor');
    App.initDatePickers(document.getElementById('modal-body') || document);
    setTimeout(() => {
      initFormHelpers();
      if (typeof App !== 'undefined' && App.refreshFloatingLabels) {
        App.refreshFloatingLabels(document.getElementById('modal-body'));
      }
    }, 50);
  }

  function openEdit(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;
    currentFormIsEdit = true;
    currentFormEditId = id;
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.modalOpen();
    App.openModal(`Editar Viático ${r.radicado}`, buildForm(r), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Guardar Cambios', cls: 'btn-gold', id: 'vit-save-btn', action: () => saveEdit(id) },
      { text: 'Continuar →', cls: 'btn-primary btn-wizard-next', action: () => switchFormTab('tab-vit-comision') },
    ], 'modal-form-emp modal-lg');
    const box = document.querySelector('.modal-box');
    if (box) {
      box.classList.add('modal-form-emp', 'modal-lg');
      box.style.maxWidth = '900px';
      box.style.width = '92vw';
    }
    updateViaticosWizardFooter('tab-vit-servidor');
    App.initDatePickers(document.getElementById('modal-body') || document);
    setTimeout(() => {
      initFormHelpers(r);
      if (typeof App !== 'undefined' && App.refreshFloatingLabels) {
        App.refreshFloatingLabels(document.getElementById('modal-body'));
      }
    }, 50);
  }

  async function saveCreate() {
    const body = readForm();
    if (!body) return;
    const btn = document.getElementById('vit-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      const res = await API.createViatico(body);
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
      App.closeModal();
      App.showToast(`Viático creado exitosamente. Radicado: ${res.radicado || ''}`, 'success');
      if (state.activeView === 'years') {
        await loadPackages();
        loadStatsGlobal();
        const yearsContainer = document.getElementById('vit-years-container');
        if (yearsContainer) await renderYearsView(yearsContainer);
      } else if (state.activeView === 'year_packages') {
        await loadPackages();
        loadStatsYear(state.selectedYear);
        const yearPkgsContainer = document.getElementById('vit-year-packages-container');
        if (yearPkgsContainer) await renderYearPackagesView(yearPkgsContainer);
      } else {
        await load();
        loadStats();
      }
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
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
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
      id_paquete: parseInt(document.getElementById('vf-id-paquete')?.value, 10) || (state.activePackage ? state.activePackage.id_paquete : (state.packages && state.packages[0] ? state.packages[0].id_paquete : 5)),
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
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.modalOpen();

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
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
      App.closeModal();
      App.showToast(`Estado de viático actualizado a "${newStatus}".`, 'success');
      await load();
      loadStats();
    } catch (err) {
      App.showToast(err.message || 'Error al cambiar estado.', 'error');
    }
  }

  function getPackagesByYear() {
    const pkgs = state.packages || [];
    const map = {};
    pkgs.forEach(p => {
      const y = parseInt(p.anio) || 2026;
      if (!map[y]) map[y] = [];
      map[y].push(p);
    });
    const sortedYears = Object.keys(map).map(Number).sort((a, b) => b - a);
    return { map, sortedYears };
  }

  function loadStats() {
    if (state.activeView === 'years') {
      loadStatsGlobal();
    } else if (state.activeView === 'year_packages') {
      loadStatsYear(state.selectedYear);
    } else if (state.activePackage && state.activePackage.id_paquete) {
      loadStatsPackage(state.activePackage.id_paquete);
    }
  }

  function renderStatCards5(data = {}) {
    const total = parseInt(data.total, 10) || 0;
    const aprobadas = parseInt(data.aprobadas, 10) || 0;
    const pendientes = parseInt(data.pendientes, 10) || 0;
    const valorAprobado = Math.round(parseFloat(data.valor_aprobado) || 0);
    const destinos = data.total_destinos !== undefined && data.total_destinos !== null
      ? (typeof data.total_destinos === 'number' ? data.total_destinos.toLocaleString('es-CO') : data.total_destinos)
      : '0';

    return `
      <div class="stat-card db-glass-card stat-card--gold">
        <div class="stat-icon stat-icon--gold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${total.toLocaleString('es-CO')}</span>
          <span class="stat-label">TOTAL SOLICITUDES</span>
        </div>
      </div>

      <div class="stat-card db-glass-card stat-card--green">
        <div class="stat-icon stat-icon--green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${aprobadas.toLocaleString('es-CO')}</span>
          <span class="stat-label">VIÁTICOS APROBADOS</span>
        </div>
      </div>

      <div class="stat-card db-glass-card stat-card--orange">
        <div class="stat-icon stat-icon--orange">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${pendientes.toLocaleString('es-CO')}</span>
          <span class="stat-label">EN TRÁMITE / PENDIENTE</span>
        </div>
      </div>

      <div class="stat-card db-glass-card stat-card--blue">
        <div class="stat-icon stat-icon--blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${valorAprobado.toLocaleString('es-CO')}</span>
          <span class="stat-label">PRESUPUESTO APROBADO</span>
        </div>
      </div>

      <div class="stat-card db-glass-card stat-card--purple">
        <div class="stat-icon stat-icon--purple">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${destinos}</span>
          <span class="stat-label">DESTINOS ASIGNADOS</span>
        </div>
      </div>
    `;
  }

  function loadStatsGlobal() {
    API.getViaticosStats().then(s => {
      const strip = document.getElementById('vit-stats-strip');
      if (!strip) return;
      strip.innerHTML = renderStatCards5(s);
    }).catch(() => {});
  }

  function loadStatsYear(year) {
    const strip = document.getElementById('vit-year-stats-strip');
    if (!strip) return;
    const yearPkgs = (state.packages || []).filter(p => parseInt(p.anio, 10) === parseInt(year, 10));
    const totalViaticos = yearPkgs.reduce((acc, p) => acc + (parseInt(p.total_viaticos, 10) || 0), 0);
    const aprobadas = yearPkgs.reduce((acc, p) => acc + (parseInt(p.aprobadas, 10) || 0), 0);
    const pendientes = yearPkgs.reduce((acc, p) => acc + (parseInt(p.pendientes, 10) || 0), 0);
    const totalAprobado = yearPkgs.reduce((acc, p) => acc + (parseFloat(p.valor_aprobado || p.total_aprobado) || 0), 0);

    const render = (s) => {
      if (!document.getElementById('vit-year-stats-strip')) return;
      document.getElementById('vit-year-stats-strip').innerHTML = renderStatCards5({
        total: s.total ?? totalViaticos,
        aprobadas: s.aprobadas ?? aprobadas,
        pendientes: s.pendientes ?? pendientes,
        valor_aprobado: s.valor_aprobado ?? totalAprobado,
        total_destinos: s.total_destinos ?? (yearPkgs.length ? '-' : 0)
      });
    };

    render({ total: totalViaticos, aprobadas, pendientes, valor_aprobado: totalAprobado });

    API.getViaticosStats({ anio: year }).then(s => {
      render(s);
    }).catch(() => {});
  }

  function loadStatsPackage(id_paquete) {
    const pkgStrip = document.getElementById('vit-pkg-stats-strip');
    if (!pkgStrip) return;
    const pkg = (state.packages || []).find(p => parseInt(p.id_paquete, 10) === parseInt(id_paquete, 10));
    if (pkg) {
      pkgStrip.innerHTML = renderStatCards5({
        total: pkg.total_viaticos || 0,
        aprobadas: pkg.aprobadas || 0,
        pendientes: pkg.pendientes || 0,
        valor_aprobado: pkg.valor_aprobado || 0,
        total_destinos: '-'
      });
    }
    API.getViaticosStats({ id_paquete }).then(ps => {
      if (document.getElementById('vit-pkg-stats-strip')) {
        document.getElementById('vit-pkg-stats-strip').innerHTML = renderStatCards5(ps);
      }
    }).catch(() => {});
  }

  async function loadPackages() {
    try {
      const pkgs = await API.getViaticosPaquetes();
      state.packages = pkgs || [];
      return state.packages;
    } catch (err) {
      console.error('[ViaticosModule] Error al cargar paquetes:', err);
      App.showToast('Error al cargar paquetes de viáticos: ' + err.message, 'error');
      return [];
    }
  }

  function confirmDelete(id, nombre) {
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.danger();
    App.openModal('Confirmar Eliminación', `<p style="color:var(--text-secondary)">¿Eliminar el viático de <strong style="color:var(--text-primary)">${nombre}</strong>?</p>`, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Eliminar', cls: 'btn-danger', action: async () => {
        try {
          await API.deleteViatico(id);
          if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
          App.closeModal();
          App.showToast('Viático eliminado.', 'success');
          await load();
          loadStats();
          loadPackages();
        }
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
    if (state.activePackage && state.activePackage.id_paquete) {
      state.filters.id_paquete = state.activePackage.id_paquete;
    }
    load();
  }
  function clearFilters() {
    ['vit-q', 'vit-estado'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const depEl = document.getElementById('vit-dependencia');
    if (depEl) depEl.value = 'Todas';
    state.filters = {};
    if (state.activePackage && state.activePackage.id_paquete) {
      state.filters.id_paquete = state.activePackage.id_paquete;
    }
    state.page = 1;
    load();
  }
  function goPage(p) { if (p < 1 || p > state.totalPages) return; state.page = p; load(); }

  // ─── Dropdown de Opciones Secundarias ─────────────────────────────────────────
  function toggleActionsDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('vit-dropdown-menu');
    const toggleBtn = document.getElementById('vit-dropdown-toggle');
    if (!menu || !toggleBtn) return;
    const isHidden = menu.hasAttribute('hidden');
    if (isHidden) {
      menu.removeAttribute('hidden');
      toggleBtn.setAttribute('aria-expanded', 'true');
      const wrap = menu.closest('.actions-dropdown-wrap');
      if (wrap) wrap.classList.add('is-open');
      wrap?.closest('.module-header-card')?.classList.add('has-open-dropdown');
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
    const wrap = menu?.closest('.actions-dropdown-wrap');
    if (wrap) wrap.classList.remove('is-open');
    wrap?.closest('.module-header-card')?.classList.remove('has-open-dropdown');
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

  // ─── Control de Vistas Jerárquicas y Sincronización con Historial del Navegador ───
  function updateViaticosHash(replace = false) {
    let target = 'viaticos';
    if (state.activeView === 'detail' && state.activePackage) {
      target += `?year=${state.activePackage.anio}&pkg=${state.activePackage.id_paquete}`;
    } else if (state.activeView === 'year_packages' && state.selectedYear) {
      target += `?year=${state.selectedYear}`;
    }
    const current = (window.location.hash || '').replace(/^#\/?/, '').trim();
    if (current !== target) {
      if (replace && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `#${target}`);
      } else if (window.history && window.history.pushState) {
        window.history.pushState(null, '', `#${target}`);
      } else {
        window.location.hash = target;
      }
    }
  }

  function syncStateFromURL(options = {}) {
    const hash = (window.location.hash || '').replace(/^#\/?/, '').trim();
    const [mod, query] = hash.split('?');
    if (mod !== 'viaticos') return false;
    const params = new URLSearchParams(query || '');
    const yearParam = options.year || params.get('year');
    const pkgParam = options.pkg || params.get('pkg');

    if (pkgParam) {
      const pkgId = parseInt(pkgParam, 10);
      const pkg = (state.packages || []).find(p => p.id_paquete === pkgId);
      if (pkg) {
        state.activeView = 'detail';
        state.activePackage = pkg;
        state.selectedYear = pkg.anio;
        state.filters = { id_paquete: pkg.id_paquete };
        state.page = 1;
        return true;
      }
    }
    if (yearParam) {
      state.activeView = 'year_packages';
      state.selectedYear = parseInt(yearParam, 10);
      state.activePackage = null;
      state.filters = {};
      state.page = 1;
      return true;
    }
    state.activeView = 'years';
    state.selectedYear = null;
    state.activePackage = null;
    state.filters = {};
    state.page = 1;
    return true;
  }

  async function enterYear(year) {
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.navClick();
    state.activeView = 'year_packages';
    state.selectedYear = parseInt(year, 10);
    state.activePackage = null;
    state.filters = {};
    state.page = 1;
    updateViaticosHash(false);
    await renderCurrentView();
  }

  async function backToYears() {
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.navClick();
    state.activeView = 'years';
    state.selectedYear = null;
    state.activePackage = null;
    state.filters = {};
    state.page = 1;
    updateViaticosHash(false);
    await renderCurrentView();
  }

  async function enterPackage(id_paquete) {
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.navClick();
    const pkg = state.packages.find(p => p.id_paquete === id_paquete);
    if (!pkg) {
      App.showToast('No se encontró el paquete seleccionado.', 'error');
      return;
    }
    state.activeView = 'detail';
    state.activePackage = pkg;
    state.selectedYear = pkg.anio;
    state.page = 1;
    state.filters = { id_paquete: pkg.id_paquete };
    updateViaticosHash(false);
    await renderCurrentView();
  }

  async function backToYearPackages() {
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.navClick();
    state.activeView = 'year_packages';
    if (!state.selectedYear && state.activePackage) {
      state.selectedYear = state.activePackage.anio;
    }
    state.activePackage = null;
    state.filters = {};
    state.page = 1;
    updateViaticosHash(false);
    await renderCurrentView();
  }

  async function backToPackages() {
    if (state.selectedYear) {
      await backToYearPackages();
    } else {
      await backToYears();
    }
  }

  // ─── Vista de Años (Histórico Anual) ──────────────────────────────────────────
  async function renderYearsView(container) {
    container.innerHTML = `
      <div class="viaticos-pkg-section">
        <div class="viaticos-pkg-section-header">
          <h2 class="viaticos-pkg-section-title">Histórico Anual de Viáticos</h2>
          <span class="viaticos-pkg-section-badge" id="vit-years-badge-count">Cargando...</span>
        </div>
        <div class="viaticos-pkg-grid" id="vit-years-grid">
          ${Array.from({ length: 4 }).map(() => `
            <div class="viaticos-pkg-card" style="opacity:0.6;">
              <div class="skeleton skeleton-line" style="width:50%;height:18px;margin-bottom:12px;"></div>
              <div class="skeleton skeleton-line" style="width:80%;height:14px;margin-bottom:8px;"></div>
              <div class="skeleton skeleton-line" style="width:60%;height:12px;margin-bottom:20px;"></div>
              <div class="skeleton skeleton-line" style="width:100%;height:44px;border-radius:10px;"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const packages = await loadPackages();
    const grid = document.getElementById('vit-years-grid');
    const badge = document.getElementById('vit-years-badge-count');
    const { map, sortedYears } = getPackagesByYear();

    if (badge) badge.textContent = `${sortedYears.length} ${sortedYears.length === 1 ? 'año registrado' : 'años registrados'}`;
    if (!grid) return;

    const cardsHtml = sortedYears.map(year => {
      const yearPkgs = map[year] || [];
      const totalViaticos = yearPkgs.reduce((acc, p) => acc + (parseInt(p.total_viaticos) || 0), 0);
      const pendientes = yearPkgs.reduce((acc, p) => acc + (parseInt(p.pendientes) || 0), 0);
      const totalAprobado = yearPkgs.reduce((acc, p) => acc + (parseFloat(p.valor_aprobado || p.total_aprobado) || 0), 0);

      const pctTramitado = totalViaticos > 0 
        ? Math.round(((totalViaticos - pendientes) / totalViaticos) * 100) 
        : 100;
      const progressColor = getProgressColor(pctTramitado);

      const humanDesc = yearPkgs.length === 1
        ? '1 ejecución presupuestal activa en esta vigencia fiscal'
        : (yearPkgs.length > 1
            ? `${yearPkgs.length} ejecuciones presupuestales activas en esta vigencia fiscal`
            : 'Sin ejecuciones presupuestales registradas en esta vigencia');

      return `
        <div class="viaticos-pkg-card viaticos-year-card" role="button" tabindex="0" onclick="ViaticosModule.enterYear(${year})" onkeydown="if(event.key==='Enter')ViaticosModule.enterYear(${year})">
          <div class="viaticos-year-card-body">
            <div class="viaticos-pkg-card-top">
              <div class="viaticos-year-clean-icon" title="Vigencia Fiscal ${year}">
                <svg viewBox="0 0 24 24" fill="none" stroke="#914169" stroke-width="2.2" style="width:34px;height:34px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              </div>
              <span class="viaticos-year-hero-num">${year}</span>
            </div>

            <div class="viaticos-year-title-block">
              <span class="viaticos-year-subheading">VIGENCIA FISCAL</span>
              <h3 class="viaticos-pkg-name">Año ${year}</h3>
            </div>

            <div class="viaticos-pkg-desc" title="${humanDesc}">
              ${humanDesc}
            </div>

            <div class="viaticos-pkg-stats">
              <div class="viaticos-pkg-stat-item">
                <span class="viaticos-pkg-stat-val">${totalViaticos.toLocaleString('es-CO')}</span>
                <span class="viaticos-pkg-stat-lbl">Viáticos</span>
              </div>
              <div class="viaticos-pkg-stat-divider" aria-hidden="true"></div>
              <div class="viaticos-pkg-stat-item">
                <span class="viaticos-pkg-stat-val is-pending">${pendientes.toLocaleString('es-CO')}</span>
                <span class="viaticos-pkg-stat-lbl">Pendientes</span>
              </div>
              <div class="viaticos-pkg-stat-divider" aria-hidden="true"></div>
              <div class="viaticos-pkg-stat-item">
                <span class="viaticos-pkg-stat-val is-approved" title="${formatCOP(totalAprobado)}">${formatCOP(totalAprobado)}</span>
                <span class="viaticos-pkg-stat-lbl">Aprobado</span>
              </div>
            </div>

            <div class="viaticos-year-progress-wrap">
              <div class="viaticos-year-progress-header">
                <span>Avance de trámite</span>
                <span class="viaticos-year-pct" style="color: ${progressColor};">${pctTramitado} %</span>
              </div>
              <div class="viaticos-year-progress-track">
                <div class="viaticos-year-progress-bar" style="width: ${pctTramitado}%; background: ${progressColor};"></div>
              </div>
            </div>
          </div>

          <div class="viaticos-pkg-actions" onclick="event.stopPropagation()">
            <div class="viaticos-pkg-exec-count" style="display:inline-flex; align-items:center; gap:6px; color:#1D8096; font-weight:700; font-size:12.5px; white-space:nowrap; flex-shrink:0;" title="${yearPkgs.length} ${yearPkgs.length === 1 ? 'ejecución presupuestal' : 'ejecuciones presupuestales'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:16px;height:16px;flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span style="white-space:nowrap;">${yearPkgs.length} ${yearPkgs.length === 1 ? 'ejecución' : 'ejecuciones'}</span>
            </div>
            <button
              type="button"
              class="viaticos-pkg-btn-enter viaticos-btn-olive"
              onclick="ViaticosModule.enterYear(${year})"
              title="Ver ejecuciones de ${year}"
              aria-label="Ver ejecuciones de ${year}"
              style="white-space:nowrap; flex-shrink:0;"
            >
              <span style="white-space:nowrap;">Ver ejecuciones</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="btn-arrow-icon" style="width:14px;height:14px;flex-shrink:0;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    const addCardHtml = `
      <div class="viaticos-pkg-card-add" role="button" tabindex="0" onclick="ViaticosModule.openCreatePackageModal()" onkeydown="if(event.key==='Enter')ViaticosModule.openCreatePackageModal()" title="Agregar nuevo archivo Excel o vigencia limpia de viáticos">
        <div class="viaticos-pkg-add-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:26px;height:26px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div class="viaticos-pkg-add-title">Agregar uno nuevo</div>
        <div class="viaticos-pkg-add-desc">Sube un nuevo archivo Excel anual o crea una vigencia limpia</div>
      </div>
    `;

    grid.innerHTML = cardsHtml + addCardHtml;
  }

  // ─── Vista de Carpetas de un Año Específico ──────────────────────────────────
  async function renderYearPackagesView(container) {
    const year = state.selectedYear;
    const packages = await loadPackages();
    const yearPkgs = packages.filter(p => p.anio === year);

    container.innerHTML = `
      <div class="viaticos-pkg-section">
        <div class="viaticos-pkg-section-header">
          <h2 class="viaticos-pkg-section-title">Carpetas y Excels — Vigencia ${year}</h2>
          <span class="viaticos-pkg-section-badge" id="vit-year-pkgs-badge">${yearPkgs.length} ${yearPkgs.length === 1 ? 'carpeta registrada' : 'carpetas registradas'}</span>
        </div>
        <div class="viaticos-pkg-grid" id="vit-year-pkgs-grid"></div>
      </div>
    `;

    const grid = document.getElementById('vit-year-pkgs-grid');
    if (!grid) return;

    const cardsHtml = yearPkgs.map(pkg => {
      const totalViaticos = parseInt(pkg.total_viaticos, 10) || 0;
      const pendientes = parseInt(pkg.pendientes, 10) || 0;
      const tramitados = Math.max(0, totalViaticos - pendientes);
      const pctTramitado = totalViaticos > 0 
        ? Math.round((tramitados / totalViaticos) * 100) 
        : 100;
      const progressColor = getProgressColor(pctTramitado);
      const fileName = pkg.archivo_origen || `${pkg.nombre}.xlsx`;
      const descSubtitle = `Vigencia fiscal ${pkg.anio} en curso`;

      return `
      <div class="viaticos-pkg-card viaticos-folder-card" role="button" tabindex="0" onclick="ViaticosModule.enterPackage(${pkg.id_paquete})" onkeydown="if(event.key==='Enter')ViaticosModule.enterPackage(${pkg.id_paquete})">
        <div class="viaticos-folder-card-body">
          <div class="viaticos-folder-header-row">
            <div class="viaticos-folder-hero-icon" title="Archivo Excel / ${escHtml(pkg.nombre)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="9" y1="15" x2="15" y2="15"></line>
                <line x1="9" y1="11" x2="11" y2="11"></line>
                <line x1="9" y1="18" x2="13" y2="18"></line>
              </svg>
            </div>
            <h3 class="viaticos-pkg-name" title="${escHtml(pkg.nombre)}">${escHtml(pkg.nombre)}</h3>
          </div>

          <div class="viaticos-folder-subtitle">
            ${descSubtitle}
          </div>

          <div class="viaticos-pkg-stats">
            <div class="viaticos-pkg-stat-item">
              <span class="viaticos-pkg-stat-val">${totalViaticos.toLocaleString('es-CO')}</span>
              <span class="viaticos-pkg-stat-lbl">Viáticos</span>
            </div>
            <div class="viaticos-pkg-stat-divider" aria-hidden="true"></div>
            <div class="viaticos-pkg-stat-item">
              <span class="viaticos-pkg-stat-val ${pendientes > 0 ? 'is-pending' : 'is-zero'}">${pendientes.toLocaleString('es-CO')}</span>
              <span class="viaticos-pkg-stat-lbl">${pendientes === 0 ? 'Al Día' : 'Pendientes'}</span>
            </div>
            <div class="viaticos-pkg-stat-divider" aria-hidden="true"></div>
            <div class="viaticos-pkg-stat-item">
              <span class="viaticos-pkg-stat-val is-approved" title="${pkg.valor_aprobado_formatted || '$ 0'}">${pkg.valor_aprobado_formatted || '$ 0'}</span>
              <span class="viaticos-pkg-stat-lbl">Aprobado</span>
            </div>
          </div>

          <div class="viaticos-folder-file-center" title="Archivo Excel fuente: ${escHtml(fileName)}">
            <span class="viaticos-folder-file-ext">XLSX</span>
            <span class="viaticos-folder-file-name">${escHtml(fileName)}</span>
          </div>

          <div class="viaticos-year-progress-wrap viaticos-folder-progress-wrap">
            <div class="viaticos-year-progress-header">
              <span>Avance de trámite</span>
              <span class="viaticos-year-pct" style="color: ${progressColor};">${pctTramitado}%</span>
            </div>
            <div class="viaticos-year-progress-track">
              <div class="viaticos-year-progress-bar" style="width: ${pctTramitado}%; background: ${progressColor};"></div>
            </div>
          </div>
        </div>

        <!-- Acciones en la base (Botones circulares según diseño del sistema) -->
        <div class="viaticos-pkg-actions" onclick="event.stopPropagation()">
          <div class="viaticos-pkg-action-group-left">
            ${Auth.canEdit() ? `
            <button
              type="button"
              class="btn-action-delete"
              onclick="ViaticosModule.confirmDeletePackage(${pkg.id_paquete}, '${escHtml(pkg.nombre)}')"
              title="Eliminar esta carpeta y sus viáticos"
              aria-label="Eliminar ${escHtml(pkg.nombre)}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>` : ''}
            ${Auth.canEdit() ? `
            <button
              type="button"
              class="btn-action-edit"
              onclick="ViaticosModule.openEditPackageModal(${pkg.id_paquete})"
              title="Editar nombre, año o archivo fuente"
              aria-label="Editar ${escHtml(pkg.nombre)}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>` : ''}
            <button
              type="button"
              class="btn-action-download"
              onclick="ViaticosModule.exportExcelPackage(${pkg.id_paquete})"
              title="Descargar este archivo Excel (.xlsx)"
              aria-label="Descargar ${escHtml(pkg.nombre)}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          </div>

          <button
            type="button"
            class="viaticos-pkg-btn-enter viaticos-btn-olive"
            onclick="ViaticosModule.enterPackage(${pkg.id_paquete})"
            title="Entrar a ver los viáticos de este Excel"
            aria-label="Entrar a ${escHtml(pkg.nombre)}"
          >
            <span>Entrar</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="btn-arrow-icon" style="width:15px;height:15px;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </div>
      </div>
      `;
    }).join('');

    const addCardHtml = `
      <div class="viaticos-pkg-card-add" role="button" tabindex="0" onclick="ViaticosModule.openCreatePackageModal(${year})" onkeydown="if(event.key==='Enter')ViaticosModule.openCreatePackageModal(${year})" title="Agregar nuevo archivo Excel a la vigencia ${year}">
        <div class="viaticos-pkg-add-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:26px;height:26px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div class="viaticos-pkg-add-title">Agregar a ${year}</div>
        <div class="viaticos-pkg-add-desc">Sube otro archivo Excel para el año ${year} o crea una nueva carpeta</div>
      </div>
    `;

    grid.innerHTML = cardsHtml + addCardHtml;
  }

  // ─── Enrutador Principal de Vistas ───────────────────────────────────────────
  async function renderCurrentView() {
    const root = mainContainer || document.getElementById('main-content') || document.querySelector('.main-content');
    if (!root) return;

    if (state.activeView === 'years') {
      root.innerHTML = `
        <div class="module-enter" id="vit-root-years">
          <!-- Encabezado General del Módulo Viáticos (Gobernación de Boyacá) -->
          <div class="module-header-card viaticos-header-hero">
            <div class="module-header-info">
              <div class="module-header-brand">
                <img src="imgs/logoCondor.png" alt="Escudo Gobernación de Boyacá" class="module-header-logo logo-light-theme" />
                <img src="imgs/logoCondorBlanco.png" alt="Escudo Gobernación de Boyacá" class="module-header-logo logo-dark-theme" />
                <span class="module-header-brand-text">Gobernación de Boyacá</span>
              </div>
              <h1 class="module-hero-title">Viáticos</h1>
              <p class="module-hero-desc">Gestión de solicitudes, comisiones y aprobaciones de viáticos de la Gobernación de Boyacá</p>
            </div>
            <div class="module-header-actions">
              <!-- Dropdown de Acciones de Excel (Cargas, Descargas y Plantillas) -->
              <div class="actions-dropdown-wrap">
                <button
                  type="button"
                  class="btn-action-icon-menu"
                  id="vit-dropdown-toggle"
                  aria-haspopup="true"
                  aria-expanded="false"
                  aria-controls="vit-dropdown-menu"
                  onclick="ViaticosModule.toggleActionsDropdown(event)"
                  onkeydown="ViaticosModule.handleDropdownKeydown(event)"
                  title="Acciones de Excel (Cargas, descargas y plantillas)"
                  aria-label="Acciones de Excel"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.5"></circle>
                    <circle cx="12" cy="12" r="1.5"></circle>
                    <circle cx="12" cy="19" r="1.5"></circle>
                  </svg>
                </button>
                <div
                  class="actions-dropdown-menu"
                  id="vit-dropdown-menu"
                  role="menu"
                  aria-labelledby="vit-dropdown-toggle"
                  hidden
                >
                  ${Auth.canEdit() ? `
                  <button
                    type="button"
                    class="actions-dropdown-item"
                    role="menuitem"
                    tabindex="-1"
                    onclick="ViaticosModule.closeActionsDropdown(); ViaticosModule.openCreatePackageModal();"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <div>
                      <strong>Nueva Vigencia / Carga Excel</strong>
                      <small>Crear nueva vigencia o cargar archivo Excel</small>
                    </div>
                  </button>` : ''}
                  <button
                    type="button"
                    class="actions-dropdown-item"
                    role="menuitem"
                    tabindex="-1"
                    onclick="ViaticosModule.closeActionsDropdown(); ViaticosModule.exportExcel();"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <div>
                      <strong>Exportar Todos los Viáticos</strong>
                      <small>Descargar base de datos completa (.xlsx)</small>
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
                      <small>Formato institucional de 17 secretarías (.xlsx)</small>
                    </div>
                  </button>
                </div>
              </div>

              ${Auth.canEdit() ? `
              <button
                type="button"
                class="btn-action-icon-add"
                onclick="ViaticosModule.openCreate()"
                id="btn-nuevo-viatico-root"
                title="Nuevo Viático"
                aria-label="Registrar nuevo viático institucional"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span class="btn-action-add-label">Nuevo Viático</span>
              </button>` : ''}
            </div>
          </div>

          <!-- Estadísticas Globales (5 Tarjetas Glassmorphism Idénticas al Dashboard) -->
          <div id="vit-stats-strip" class="stats-grid" style="grid-template-columns:repeat(5, minmax(0, 1fr));margin-bottom:var(--space-5);width:100%;">
            ${renderStatsSkeletons(5)}
          </div>

          <!-- Contenedor del Histórico Anual -->
          <div id="vit-years-container"></div>
        </div>
      `;

      bindDropdownOutsideClick();
      await loadPackages();
      loadStatsGlobal();
      const yearsContainer = document.getElementById('vit-years-container');
      if (yearsContainer) {
        await renderYearsView(yearsContainer);
      }
    } else if (state.activeView === 'year_packages') {
      const year = state.selectedYear;
      root.innerHTML = `
        <div class="module-enter" id="vit-root-year-packages">
          <!-- Cabecera de la Vigencia Seleccionada (Submódulo Año) -->
          <div class="module-header-card viaticos-header-hero">
            <div class="module-header-info">
              <button type="button" class="btn-back-pill" onclick="ViaticosModule.backToYears()" title="Volver a Años">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><polyline points="15 18 9 12 15 6"></polyline></svg>
                <span>Volver a Años</span>
              </button>
              <h1 class="module-hero-title">Año ${year}</h1>
              <p class="module-hero-desc">
                Gestión de carpetas, liquidaciones presupuestales y comisiones de servicio para el año fiscal ${year} de la Gobernación de Boyacá.
              </p>
            </div>

            <div class="module-header-actions">
              <button
                type="button"
                class="btn-action-icon-download"
                onclick="ViaticosModule.exportExcelYear(${year})"
                title="Descargar vigencia ${year} en Excel / ZIP"
                aria-label="Descargar vigencia ${year} en Excel"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              ${Auth.canEdit() ? `
              <button
                type="button"
                class="btn-action-icon-add"
                onclick="ViaticosModule.openCreate()"
                title="Nuevo Viático"
                aria-label="Registrar nuevo viático institucional"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span class="btn-action-add-label">Nuevo Viático</span>
              </button>` : ''}
            </div>
          </div>

          <!-- Estadísticas Específicas de este Año Fiscal (5 Tarjetas Glassmorphism) -->
          <div id="vit-year-stats-strip" class="stats-grid" style="grid-template-columns:repeat(5, minmax(0, 1fr));margin-bottom:var(--space-5);width:100%;">
            ${renderStatsSkeletons(5)}
          </div>

          <!-- Contenedor de Carpetas del Año -->
          <div id="vit-year-packages-container"></div>
        </div>
      `;

      loadStatsYear(year);
      const yearPkgsContainer = document.getElementById('vit-year-packages-container');
      if (yearPkgsContainer) {
        await renderYearPackagesView(yearPkgsContainer);
      }
    } else {
      // ─── Vista Detalle del Paquete / Carpeta ───
      const pkg = state.activePackage;
      if (!pkg) {
        await backToYears();
        return;
      }

      root.innerHTML = `
        <div class="module-enter" id="vit-root-detail">
          <!-- Cabecera de la Carpeta / Ejecución Presupuestal Seleccionada -->
          <div class="module-header-card viaticos-header-hero">
            <div class="module-header-info">
              <button type="button" class="btn-back-pill" onclick="ViaticosModule.backToYearPackages()" title="Volver a las carpetas del año ${pkg.anio}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><polyline points="15 18 9 12 15 6"></polyline></svg>
                <span>Volver a Carpetas (${pkg.anio})</span>
              </button>
              <h1 class="module-hero-title" title="${escHtml(pkg.nombre)}">${escHtml(pkg.nombre)}</h1>
              <p class="module-hero-desc">
                Registros de solicitudes y comisiones del archivo <strong>${escHtml(pkg.archivo_origen || pkg.nombre)}</strong> en la Vigencia Fiscal ${pkg.anio}.
              </p>
            </div>

            <div class="module-header-actions">
              <button
                type="button"
                class="btn-action-icon-download"
                onclick="ViaticosModule.exportExcelPackage(${pkg.id_paquete})"
                title="Descargar registros de este archivo Excel"
                aria-label="Descargar registros de este archivo Excel"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              ${Auth.canEdit() ? `
              <button
                type="button"
                class="btn-action-icon-add"
                onclick="ViaticosModule.openCreate()"
                id="btn-nuevo-viatico"
                title="Nuevo Viático"
                aria-label="Crear viático en esta vigencia"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span class="btn-action-add-label">Nuevo Viático</span>
              </button>` : ''}
            </div>
          </div>

          <!-- Estadísticas Específicas ÚNICAMENTE de esta Vigencia / Paquete (5 Tarjetas Glassmorphism) -->
          <div id="vit-pkg-stats-strip" class="stats-grid" style="grid-template-columns:repeat(5, minmax(0, 1fr));margin-bottom:var(--space-5);width:100%;">
            ${renderStatsSkeletons(5)}
          </div>

          <!-- Filtros de Búsqueda para este Paquete -->
          <div class="filters-card">
            <div class="filters-row">
              <div class="filter-group" style="flex:2">
                <label class="filter-label">Buscar en ${escHtml(pkg.nombre)}</label>
                <input id="vit-q" class="filter-input" placeholder="Nombre, cédula, destino..." />
              </div>
              <div class="filter-group" style="flex:1.5">
                <label class="filter-label">Dependencia</label>
                <select id="vit-dependencia" class="filter-select" onchange="ViaticosModule.applyFilters()">
                  ${DEPENDENCIAS_LIST.map(d => `<option value="${d === 'Todas' ? '' : d}">${d === 'Todas' ? 'TODAS' : d}</option>`).join('')}
                </select>
              </div>
              <div class="filter-group">
                <label class="filter-label">Estado</label>
                <select id="vit-estado" class="filter-select" onchange="ViaticosModule.applyFilters()">
                  ${ESTADOS.map(s => `<option value="${s === 'Todos' ? '' : s}">${s === 'Todos' ? 'TODOS' : s}</option>`).join('')}
                </select>
              </div>
              <button class="btn btn-primary" onclick="ViaticosModule.applyFilters()" aria-label="Ejecutar búsqueda">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Buscar
              </button>
              <button class="btn btn-secondary" onclick="ViaticosModule.clearFilters()">Limpiar</button>
            </div>
          </div>

          <!-- Tabla de Registros del Paquete -->
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
        </div>
      `;

      document.getElementById('vit-q')?.addEventListener('keypress', e => { if (e.key === 'Enter') applyFilters(); });
      loadStatsPackage(pkg.id_paquete);
      await load();
    }
  }

  async function render(container, options = {}) {
    if (container) mainContainer = container;
    if (!state.packages || !state.packages.length) {
      await loadPackages();
    }
    syncStateFromURL(options);
    await renderCurrentView();
  }

  // ─── Modal para Agregar Nuevo Paquete / Excel ─────────────────────────────────
  function openCreatePackageModal(preselectedYear = null) {
    if (!Auth.canEdit()) {
      App.showToast('No tienes permisos para crear paquetes de viáticos.', 'warning');
      return;
    }

    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.modalOpen();

    let selectedPackageFile = null;

    const modalBody = `
      <form id="vit-pkg-create-form" onsubmit="event.preventDefault();" style="display:flex; flex-direction:column; gap:18px;">
        <div class="form-group floating-group">
          <label class="form-label required" for="vpkg-nombre">Nombre de la Carpeta o Vigencia</label>
          <input id="vpkg-nombre" class="form-input" placeholder="Ej: Ejecución Presupuestal 2026" required value="" autocomplete="off" />
        </div>

        <div class="form-group floating-group">
          <label class="form-label required" for="vpkg-anio">Año de Vigencia Fiscal</label>
          <input id="vpkg-anio" type="number" min="2000" max="2050" class="form-input font-mono" placeholder="Ej: 2026" required value="${preselectedYear || ''}" />
        </div>

        <div class="form-group floating-group">
          <label class="form-label" for="vpkg-desc">Descripción o Notas (Opcional)</label>
          <textarea id="vpkg-desc" class="form-input" rows="2" placeholder="Ej: Vigencia fiscal en curso para trámites departamentales" autocomplete="off"></textarea>
        </div>

        <div style="margin-top:2px;">
          <div class="excel-dropzone" id="vpkg-dropzone" style="padding:22px 20px; border-radius:14px; border:2px dashed rgba(22, 163, 74, 0.45); text-align:center; cursor:pointer; background:rgba(22, 163, 74, 0.03); transition:all 0.2s ease;">
            <input type="file" id="vpkg-file-input" accept=".xlsx, .xls" style="display:none;" />
            <div style="margin-bottom:8px; color:#16a34a;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:38px;height:38px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            </div>
            <div id="vpkg-file-name" style="font-size:13.5px; font-weight:700; color:var(--text-primary);">Haz clic aquí para seleccionar o arrastra tu archivo Excel</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Formatos admitidos: archivos Excel (.xlsx, .xls) de comisiones y viáticos</div>
          </div>
        </div>
      </form>
    `;

    App.openModal('Agregar Nuevo Paquete de Viáticos', modalBody, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Guardar Paquete', cls: 'btn-primary-cta', id: 'btn-save-vpkg', action: async () => {
        const nombre = document.getElementById('vpkg-nombre')?.value.trim();
        const anioVal = document.getElementById('vpkg-anio')?.value;
        const anio = parseInt(anioVal, 10);
        const descripcion = document.getElementById('vpkg-desc')?.value.trim();

        if (!nombre) {
          App.showToast('El nombre de la carpeta o vigencia es requerido.', 'warning');
          document.getElementById('vpkg-nombre')?.focus();
          return;
        }

        if (!anio || isNaN(anio) || anio < 2000 || anio > 2050) {
          App.showToast('El año de vigencia fiscal es obligatorio (entre 2000 y 2050).', 'warning');
          document.getElementById('vpkg-anio')?.focus();
          return;
        }

        const archivoOrigen = selectedPackageFile ? selectedPackageFile.name : `${nombre}.xlsx`;

        const btn = document.getElementById('btn-save-vpkg');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

        try {
          // 1. Crear el paquete en base de datos
          const newPkg = await API.createViaticosPaquete({
            nombre,
            anio,
            archivoOrigen,
            descripcion
          });

          // 2. Si se adjuntó un archivo Excel, parsearlo e importar sus filas
          if (selectedPackageFile && typeof XLSX !== 'undefined') {
            App.showToast('Procesando archivo Excel adjunto...', 'info');
            await processAndImportPackageExcel(selectedPackageFile, newPkg.id_paquete);
          }

          if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
          App.closeModal();
          App.showToast(`Carpeta "${nombre}" (${anio}) creada exitosamente.`, 'success');
          await loadPackages();
          if (state.activeView === 'year_packages') {
            if (state.selectedYear !== anio) {
              state.selectedYear = anio;
            }
          }
          await renderCurrentView();
          loadStats();
        } catch (err) {
          App.showToast(err.message || 'Error al crear paquete.', 'error');
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = 'Guardar Paquete'; }
        }
      }},
    ], 'modal-package');

    // Inicializar UX de formulario y setup de drag and drop
    setTimeout(() => {
      const modalBodyEl = document.getElementById('modal-body');
      if (modalBodyEl && typeof App !== 'undefined') {
        if (App.initFormUX) App.initFormUX(modalBodyEl);
        if (App.refreshFloatingLabels) App.refreshFloatingLabels(modalBodyEl);
      }

      const dropzone = document.getElementById('vpkg-dropzone');
      const fileInput = document.getElementById('vpkg-file-input');
      const nameEl = document.getElementById('vpkg-file-name');
      const nombreInput = document.getElementById('vpkg-nombre');
      const anioInput = document.getElementById('vpkg-anio');

      if (!dropzone || !fileInput) return;

      dropzone.onclick = () => fileInput.click();

      function handleFile(f) {
        if (!f) return;
        selectedPackageFile = f;
        nameEl.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
            <span style="color:#16a34a;font-size:18px;">✓</span>
            <span style="color:var(--text-primary);font-weight:700;">${escHtml(f.name)}</span>
            <span style="color:var(--text-muted);font-size:12px;">(${(f.size/1024).toFixed(1)} KB)</span>
          </div>
        `;
        // Deducir año del nombre del archivo si tiene 4 dígitos (e.g. 2026) y el año está vacío
        const m = f.name.match(/\b(20\d\d)\b/);
        if (m && m[1] && (!anioInput.value || anioInput.value === '')) {
          anioInput.value = m[1];
        }
        // Deducir nombre sugerido si está vacío
        if (!nombreInput.value || nombreInput.value.trim() === '') {
          nombreInput.value = f.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        }
        if (modalBodyEl && App.refreshFloatingLabels) {
          App.refreshFloatingLabels(modalBodyEl);
        }
      }

      fileInput.onchange = (e) => handleFile(e.target.files[0]);

      dropzone.ondragover = (e) => { e.preventDefault(); dropzone.style.borderColor = '#16a34a'; dropzone.style.background = 'rgba(22,163,74,0.05)'; };
      dropzone.ondragleave = (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--border)'; dropzone.style.background = 'var(--bg-primary)'; };
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border)';
        dropzone.style.background = 'var(--bg-primary)';
        const f = e.dataTransfer.files[0];
        handleFile(f);
      };
    }, 50);
  }

  // ─── Modal para Editar Paquete Existente ──────────────────────────────────────
  function openEditPackageModal(id_paquete) {
    if (!Auth.canEdit()) {
      App.showToast('No tienes permisos para editar paquetes.', 'warning');
      return;
    }
    const pkg = state.packages.find(p => p.id_paquete === id_paquete);
    if (!pkg) {
      App.showToast('Paquete no encontrado.', 'error');
      return;
    }

    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.modalOpen();

    const modalBody = `
      <div class="vpkg-edit-modal-wrapper">
        <!-- Hero Card de la Carpeta -->
        <div class="vpkg-modal-hero">
          <div class="vpkg-modal-hero-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div class="vpkg-modal-hero-info">
            <div class="vpkg-modal-hero-title-row">
              <h3 class="vpkg-modal-hero-title">${escHtml(pkg.nombre)}</h3>
              <span class="viaticos-pkg-year-pill">${pkg.anio}</span>
            </div>
            <div class="vpkg-modal-hero-file">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
              <span>${escHtml(pkg.archivo_origen || `${pkg.nombre}.xlsx`)}</span>
            </div>
            <div class="vpkg-modal-hero-badges">
              <span class="vpkg-badge-metric">📊 <strong>${(pkg.total_viaticos || 0).toLocaleString('es-CO')}</strong> viáticos</span>
              <span class="vpkg-badge-metric is-pending">⏳ <strong>${(pkg.pendientes || 0).toLocaleString('es-CO')}</strong> pendientes</span>
              <span class="vpkg-badge-metric is-approved">💰 <strong>${pkg.valor_aprobado_formatted || '$ 0'}</strong> aprobado</span>
            </div>
          </div>
        </div>

        <!-- Formulario estilizado -->
        <form id="vit-pkg-edit-form" onsubmit="event.preventDefault();" style="display:flex; flex-direction:column; gap:16px;">
          <div class="form-group floating-group">
            <label class="form-label required" for="vedit-nombre">Nombre de la Carpeta o Vigencia</label>
            <input id="vedit-nombre" class="form-input" value="${escHtml(pkg.nombre)}" placeholder="Ej: Ejecución Presupuestal 2026" required />
          </div>

          <div class="form-grid" style="grid-template-columns: 140px 1fr; gap:16px;">
            <div class="form-group floating-group">
              <label class="form-label required" for="vedit-anio">Año de Vigencia Fiscal</label>
              <input id="vedit-anio" type="number" min="2000" max="2050" class="form-input font-mono" value="${pkg.anio || new Date().getFullYear()}" required />
            </div>

            <div class="form-group floating-group">
              <label class="form-label" for="vedit-archivo">Archivo Origen (.xlsx)</label>
              <input id="vedit-archivo" class="form-input font-mono" value="${escHtml(pkg.archivo_origen || '')}" placeholder="Ej: EJECUCION PRESUPUESTAL 2026.xlsx" />
            </div>
          </div>

          <div class="form-group floating-group">
            <label class="form-label" for="vedit-desc">Descripción o Notas de la Vigencia</label>
            <textarea id="vedit-desc" class="form-input" rows="2" placeholder="Ej: Vigencia fiscal en curso para trámites departamentales">${escHtml(pkg.descripcion || '')}</textarea>
          </div>

          <div class="vpkg-modal-notice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>Al modificar el año de vigencia, la carpeta se reubicará automáticamente en el año correspondiente.</span>
          </div>
        </form>
      </div>
    `;

    App.openModal('Editar Carpeta de Viáticos', modalBody, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Guardar Cambios', cls: 'btn-primary-cta', id: 'btn-update-vpkg', action: async () => {
        const nombre = document.getElementById('vedit-nombre')?.value.trim();
        const anio = parseInt(document.getElementById('vedit-anio')?.value, 10) || pkg.anio;
        const archivoOrigen = document.getElementById('vedit-archivo')?.value.trim();
        const descripcion = document.getElementById('vedit-desc')?.value.trim();

        if (!nombre) {
          App.showToast('El nombre es requerido.', 'warning');
          return;
        }

        const btn = document.getElementById('btn-update-vpkg');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

        try {
          await API.updateViaticosPaquete(id_paquete, { nombre, anio, archivoOrigen, descripcion });
          if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
          App.closeModal();
          App.showToast('Carpeta de viáticos actualizada correctamente.', 'success');
          await loadPackages();
          if (state.activePackage && state.activePackage.id_paquete === id_paquete) {
            state.activePackage = state.packages.find(p => p.id_paquete === id_paquete) || state.activePackage;
          }
          // Si el año cambió y estábamos en la vista de carpetas del año previo, sincronizar año
          if (state.activeView === 'year_packages') {
            if (state.selectedYear !== anio) {
              state.selectedYear = anio;
            }
          }
          await renderCurrentView();
          loadStats();
        } catch (err) {
          App.showToast(err.message || 'Error al actualizar carpeta.', 'error');
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = 'Guardar Cambios'; }
        }
      }},
    ], 'modal-package');

    setTimeout(() => {
      const modalBodyEl = document.getElementById('modal-body');
      if (modalBodyEl && typeof App !== 'undefined') {
        if (App.initFormUX) App.initFormUX(modalBodyEl);
        if (App.refreshFloatingLabels) App.refreshFloatingLabels(modalBodyEl);
      }
    }, 50);
  }

  // ─── Confirmación de Eliminación de Paquete ──────────────────────────────────
  function confirmDeletePackage(id_paquete, nombre) {
    if (!Auth.canEdit()) {
      App.showToast('No tienes permisos para eliminar paquetes.', 'warning');
      return;
    }

    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.danger();

    App.openModal('Confirmar Eliminación de Carpeta', `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="color:var(--text-secondary); margin:0;">
          ¿Estás seguro de que deseas eliminar la carpeta <strong style="color:var(--text-primary);">${escHtml(nombre)}</strong>?
        </p>
        <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:10px; padding:12px; color:#ef4444; font-size:12.5px;">
          ⚠️ <strong>Advertencia:</strong> Esta acción eliminará permanentemente la carpeta y todos los viáticos asociados a este archivo Excel. Esta operación no se puede deshacer.
        </div>
      </div>
    `, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Sí, Eliminar Todo', cls: 'btn-danger', action: async () => {
        try {
          await API.deleteViaticosPaquete(id_paquete);
          if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
          App.closeModal();
          App.showToast(`Carpeta "${nombre}" eliminada exitosamente.`, 'success');
          if (state.activePackage && state.activePackage.id_paquete === id_paquete) {
            state.activeView = state.selectedYear ? 'year_packages' : 'years';
            state.activePackage = null;
          }
          await loadPackages();
          await renderCurrentView();
          loadStats();
        } catch (err) {
          App.showToast(err.message || 'Error al eliminar carpeta.', 'error');
        }
      }},
    ]);
  }

  // ─── Exportar Excel exclusivo de un Paquete / Carpeta ─────────────────────────
  async function exportExcelPackage(id_paquete = null) {
    const targetPkg = id_paquete 
      ? (state.packages.find(p => p.id_paquete === id_paquete) || state.activePackage)
      : state.activePackage;
    if (!targetPkg) return exportExcel();
    try {
      App.showToast(`Generando Excel para "${targetPkg.nombre}"...`, 'info');
      const res = await API.getViaticos({ id_paquete: targetPkg.id_paquete, page: 1, limit: 20000 });
      const records = res.data || [];
      const cleanName = (targetPkg.archivo_origen || targetPkg.nombre || 'Viaticos').replace(/\.xlsx$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
      ExcelService.exportToExcel({
        filename: cleanName,
        sheetName: 'Viáticos',
        columns: EXCEL_COLUMNS,
        data: records
      });
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
      App.showToast(`Se exportaron ${records.length.toLocaleString('es-CO')} registros de "${targetPkg.nombre}" exitosamente.`, 'success');
    } catch (err) {
      App.showToast('Error al exportar: ' + err.message, 'error');
    }
  }

  // ─── Exportar Excel de todo un Año Fiscal (Descarga Carpeta ZIP con los Excels) ────
  async function exportExcelYear(year) {
    const yNum = parseInt(year, 10);
    try {
      App.showToast(`Preparando exportación completa para la Vigencia Fiscal ${yNum}...`, 'info');
      
      const yearPkgs = (state.packages || []).filter(p => parseInt(p.anio, 10) === yNum);
      
      if (typeof JSZip !== 'undefined') {
        const zip = new JSZip();
        const folderName = `Vigencia_Fiscal_${yNum}`;
        const zipFolder = zip.folder(folderName);
        
        let allRecordsYear = [];
        
        // 1. Para cada carpeta de la vigencia, generar su archivo Excel individual e incluirlo en el ZIP
        for (const pkg of yearPkgs) {
          const res = await API.getViaticos({ id_paquete: pkg.id_paquete, page: 1, limit: 25000 });
          const pkgRecords = res.data || [];
          allRecordsYear = allRecordsYear.concat(pkgRecords);
          
          let cleanFileName = (pkg.archivo_origen || pkg.nombre || `Carpeta_${pkg.id_paquete}`)
            .replace(/\.xlsx$/i, '')
            .replace(/[/\\?%*:|"<>]/g, '_');
          if (!cleanFileName.toLowerCase().endsWith('.xlsx')) cleanFileName += '.xlsx';

          const buffer = ExcelService.buildWorkbookBuffer({
            sheetName: (pkg.nombre || 'Viáticos').substring(0, 31).replace(/[/\\?*:[\]]/g, '_'),
            columns: EXCEL_COLUMNS,
            data: pkgRecords
          });
          
          if (buffer) {
            zipFolder.file(cleanFileName, buffer);
          }
        }
        
        // 2. Si hay registros acumulados o directamente por año, generar también el Libro Consolidado
        if (allRecordsYear.length === 0) {
          const resYear = await API.getViaticos({ anio: yNum, page: 1, limit: 35000 });
          allRecordsYear = resYear.data || [];
        }
        
        if (allRecordsYear.length > 0) {
          const consolidatedBuffer = ExcelService.buildWorkbookBuffer({
            sheetName: `Consolidado ${yNum}`,
            columns: EXCEL_COLUMNS,
            data: allRecordsYear
          });
          if (consolidatedBuffer) {
            zipFolder.file(`CONSOLIDADO_GENERAL_VIATICOS_${yNum}.xlsx`, consolidatedBuffer);
          }
        }
        
        App.showToast(`Comprimiendo carpeta con ${yearPkgs.length} archivo(s) Excel...`, 'info');
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Vigencia_Fiscal_${yNum}_Archivos_Excel.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
        App.showToast(`¡Carpeta ZIP de la Vigencia ${yNum} descargada exitosamente!`, 'success');
      } else {
        // Respaldo directo en caso de no disponer de JSZip
        const res = await API.getViaticos({ anio: yNum, page: 1, limit: 35000 });
        const records = res.data || [];
        ExcelService.exportToExcel({
          filename: `Viaticos_Vigencia_${yNum}`,
          sheetName: `Viáticos ${yNum}`,
          columns: EXCEL_COLUMNS,
          data: records
        });
        if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
        App.showToast(`Se exportó el reporte consolidado de la vigencia ${yNum}.`, 'success');
      }
    } catch (err) {
      console.error('[ViaticosModule.exportExcelYear] Error:', err);
      App.showToast('Error al exportar año: ' + err.message, 'error');
    }
  }

  // ─── Procesar e Importar Excel vinculado a un Paquete ────────────────────────
  async function processAndImportPackageExcel(file, id_paquete) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const allRows = [];
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (!sheetData || sheetData.length < 2) continue;

            let headerIdx = -1;
            for (let i = 0; i < Math.min(sheetData.length, 12); i++) {
              const r = sheetData[i] || [];
              const str = r.map(c => String(c).toUpperCase()).join(' ');
              if (str.includes('NOMBRE') || str.includes('SERVIDOR') || str.includes('FECHA')) {
                headerIdx = i;
                break;
              }
            }
            if (headerIdx === -1) headerIdx = 0;
            const headerRow = sheetData[headerIdx] || [];
            let colNom = -1, colFecha = -1, colDest = -1, colVal = -1, colRes = -1, colSaldo = -1, colObs = -1;
            headerRow.forEach((c, idx) => {
              const u = String(c).toUpperCase();
              if (u.includes('NOMBRE') || u.includes('SERVIDOR')) colNom = idx;
              else if (u.includes('FECHA')) colFecha = idx;
              else if (u.includes('LUGAR') || u.includes('DESTINO')) colDest = idx;
              else if (u.includes('VALOR') || u.includes('TOTAL')) colVal = idx;
              else if (u.includes('RESOL') || u.includes('ACTO')) colRes = idx;
              else if (u.includes('SALDO')) colSaldo = idx;
              else if (u.includes('OBS')) colObs = idx;
            });
            if (colNom === -1) colNom = 0;
            if (colFecha === -1) colFecha = colNom + 1;
            if (colDest === -1) colDest = colFecha + 1;
            if (colVal === -1) colVal = colDest + 1;

            for (let rIdx = headerIdx + 1; rIdx < sheetData.length; rIdx++) {
              const row = sheetData[rIdx] || [];
              const nom = row[colNom];
              if (!nom) continue;
              const nomStr = String(nom).trim();
              if (['TOTAL', 'SUBTOTAL', 'SALDO', 'FIRMA'].includes(nomStr.toUpperCase())) continue;
              const rawFecha = row[colFecha];
              const resolVal = colRes !== -1 && row[colRes] ? String(row[colRes]).trim() : '';
              const destVal = colDest !== -1 && row[colDest] ? String(row[colDest]).trim() : 'SIN ESPECIFICAR';
              const valNum = colVal !== -1 && row[colVal] != null ? Number(row[colVal]) : 0;
              const valor = isNaN(valNum) ? 0 : valNum;
              const saldoVal = colSaldo !== -1 && row[colSaldo] != null && !isNaN(Number(row[colSaldo])) ? Number(row[colSaldo]) : null;
              const obsVal = colObs !== -1 && row[colObs] ? String(row[colObs]).trim() : '';

              const dInfo = (typeof parseDateRobust === 'function') ? parseDateRobust(rawFecha, resolVal) : { start: '01/01/2026', end: '01/01/2026', dias: 1 };

              allRows.push({
                persona: nomStr,
                dependencia: sheetName,
                destino: destVal,
                motivo: 'Comisión institucional de servicios',
                fechaInicio: dInfo.start,
                fechaFin: dInfo.end,
                dias: dInfo.dias || 1,
                valorDiario: (dInfo.dias > 0 && valor > 0) ? parseFloat((valor / dInfo.dias).toFixed(2)) : 0,
                valorTotal: valor,
                estado: (valor === 0 || obsVal.toUpperCase().includes('SIN VIATICOS')) ? 'Finalizada' : 'Aprobada',
                observaciones: obsVal || (valor === 0 ? 'SIN VIÁTICOS' : 'Carga masiva Excel'),
                numeroResolucion: resolVal,
                saldo: saldoVal,
                id_paquete
              });
            }
          }

          if (allRows.length > 0) {
            await API.bulkCreateViaticos({ rows: allRows, id_paquete });
            App.showToast(`Se importaron ${allRows.length.toLocaleString('es-CO')} viáticos en esta vigencia.`, 'success');
          }
          resolve(allRows.length);
        } catch (parseErr) {
          console.error('[processAndImportPackageExcel] Error:', parseErr);
          reject(parseErr);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
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
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
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

    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.modalOpen();

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
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
      if (typeof Fx !== 'undefined' && Fx.play) Fx.play('success');
      App.showToast('Plantilla oficial institucional de viáticos (17 secretarías) descargada exitosamente.', 'success');
    } catch (err) {
      console.error('[ViaticosModule] Error al descargar plantilla oficial:', err);
      App.showToast('Error al generar la plantilla oficial de viáticos: ' + err.message, 'error');
    }
  }

  return {
    render,
    enterYear,
    backToYears,
    enterPackage,
    backToYearPackages,
    backToPackages,
    openCreatePackageModal,
    openEditPackageModal,
    confirmDeletePackage,
    exportExcelPackage,
    exportExcelYear,
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
    unlockServidor,
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
    switchFormTab,
    copyFichaText,
    saveCreate,
    saveEdit,
  };
})();
