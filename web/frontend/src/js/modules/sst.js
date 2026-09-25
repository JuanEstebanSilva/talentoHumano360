/* ═══════════════════════════════════════════════════════════════════════════
   sst.js — Módulo de Seguridad y Salud en el Trabajo (SST — Talento 360)
   Formatos Oficiales Gobernación de Boyacá:
   1. Perfil Epidemiológico y EMO (Código E-DO-ST-F-024 V3)
   2. Entrega de Elementos de Protección Personal - EPP (Código E-DO-ST-F-028 V4)
   3. Perfil Sociodemográfico (Código E-DO-ST-F-011 V5)
   ═══════════════════════════════════════════════════════════════════════════ */

const SstModule = (() => {
  const TABS = {
    epidemiologico: {
      key: 'epidemiologico',
      title: 'Perfil Epidemiológico y EMO',
      code: 'E-DO-ST-F-024 V3',
      desc: 'Control de Exámenes Médicos Ocupacionales (EMO), restricciones, PVE y seguimiento de accidentes/enfermedades laborales',
      btnCreate: 'Nuevo Registro EMO'
    },
    epp: {
      key: 'epp',
      title: 'Entrega de Elementos de Protección Personal (EPP)',
      code: 'E-DO-ST-F-028 V4',
      desc: 'Suministro y reposición de Elementos de Protección Personal conforme al Instructivo E-DO-ST-I-007',
      btnCreate: 'Registrar Entrega EPP'
    },
    sociodemografico: {
      key: 'sociodemografico',
      title: 'Perfil Sociodemográfico',
      code: 'E-DO-ST-F-011 V5',
      desc: 'Caracterización sociodemográfica, familiar, educativa y laboral de los servidores públicos y contratistas',
      btnCreate: 'Nuevo Perfil Sociodemográfico'
    }
  };

  let state = {
    tab: 'epidemiologico',
    data: [],
    total: 0,
    page: 1,
    totalPages: 1,
    filters: { q: '', subFilter1: 'Todos', subFilter2: 'Todos' },
    stats: {},
    catalogs: null
  };

  let currentUploadedFile = null;
  let employeeSearchTimeout = null;

  // ─── Catálogos Fallback Locales ────────────────────────────────────────────
  const DEFAULT_CATALOGS = {
    eppCatalogo: [
      { codigo: 'A',  nombre: 'A. Casco de seguridad' },
      { codigo: 'B',  nombre: 'B. Gorro o Cofias' },
      { codigo: 'C',  nombre: 'C. Gorro Zafari' },
      { codigo: 'D',  nombre: 'D. Tapones externos' },
      { codigo: 'E',  nombre: 'E. Tapones de copa (orejeras)' },
      { codigo: 'F',  nombre: 'F. Careta (guadañar)' },
      { codigo: 'G',  nombre: 'G. Monogafas' },
      { codigo: 'H',  nombre: 'H. Gafas de seguridad' },
      { codigo: 'I',  nombre: 'I. Gafas de seguridad / UV' },
      { codigo: 'J',  nombre: 'J. Respirador con filtros' },
      { codigo: 'K',  nombre: 'K. Filtros para respiradores' },
      { codigo: 'L',  nombre: 'L. Respirador ffp2 o n95' },
      { codigo: 'M',  nombre: 'M. Mascarilla desechable' },
      { codigo: 'N',  nombre: 'N. Guantes de poliuretano' },
      { codigo: 'O',  nombre: 'O. Guantes de vaqueta' },
      { codigo: 'P',  nombre: 'P. Guantes de Nitrilo' },
      { codigo: 'Q',  nombre: 'Q. Guantes de látex' },
      { codigo: 'R',  nombre: 'R. Guantes de caucho' },
      { codigo: 'S',  nombre: 'S. Guantes sustancias químicas' },
      { codigo: 'T',  nombre: 'T. Chaleco Trabajo en campo' },
      { codigo: 'U',  nombre: 'U. Overol de dos piezas cinta reflectiva' },
      { codigo: 'V',  nombre: 'V. Overol antifluidos' },
      { codigo: 'W',  nombre: 'W. Bata manga larga antifluido' },
      { codigo: 'X',  nombre: 'X. Delantal Carnaza' },
      { codigo: 'Y',  nombre: 'Y. Zapato cerrado' },
      { codigo: 'Z',  nombre: 'Z. Botas de Seguridad' },
      { codigo: 'AA', nombre: 'AA. Botas pantaneras con puntera' },
      { codigo: 'AB', nombre: 'AB. Otros' }
    ],
    sedes: [
      'CASA DE LA TORRE',
      'EDIFICIO INTELIGENTE - BICENTENARIO',
      'ARCHIVO GENERAL DEL DEPARTAMENTO - Centro.',
      'ARCHIVO GENERAL DEL DEPARTAMENTO - Topo.',
      'AUDITORIO JOSE MOSSER Y OFICINAS.',
      'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 203 B INTERIOR.',
      'EDIFICIO LOTERÍA DE BOYACÁ',
      'CASA DE BOYACÁ EN BOGOTÁ.',
      'SECRETARIA DE EDUCACION DE BOYACÁ.',
      'SECRETARÍA DE SALUD DEL DEPARTAMENTO DE BOYACÁ.'
    ],
    dependencias: [
      'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo',
      'SGEN - Dirección General de Talento Humano',
      'SGEN - SECRETARIA GENERAL (Despacho)',
      'DES - Despacho del gobernador',
      'SHAC - SECRETARIA DE HACIENDA (Despacho)',
      'SSAL - SECRETARIA DE SALUD (Despacho)',
      'SEDU - SECRETARIA DE EDUCACIÓN (Despacho)',
      'SINF - SECRETARIA DE INFRAESTRUCTURA PÚBLICA (Despacho)',
      'STIC - SECRETARIA DE TIC Y GOBIERNO ABIERTO (Despacho)'
    ],
    tiposEmo: ['Ingreso', 'Periódico', 'Egreso', 'Post Incapacidad', 'Trabajo en alturas'],
    estadosCaso: ['Vigente', 'En Seguimiento', 'En Rehabilitación', 'Próximo a Vencer', 'Vencido', 'Cerrado'],
    programasPve: [
      'No aplica',
      'PVE Biomecánico / Osteomuscular',
      'PVE Psicosocial',
      'PVE Visual',
      'PVE Auditivo',
      'PVE Cardiovascular y Metabólico',
      'PVE Respiratorio',
      'PVE Voz'
    ],
    tiposIdentificacion: ['Cédula de Ciudadanía', 'Cédula de Extranjería', 'Pasaporte', 'Tarjeta de Identidad'],
    razas: ['Blanco/Mestizo', 'Afrodescendiente', 'Indígena', 'Raizal', 'Palenquero', 'Gitano', 'OTRA'],
    estadosCiviles: ['Soltero (a)', 'Casado(a)', 'Unión Libre', 'Divorciado(a)', 'Viudo(a)'],
    composicionesFamiliares: [
      'Padre',
      'Madre',
      'Conyuge Permanente, Hijos',
      'Hijos',
      'OTROS (Hermanos, Sobrinos, Ahijados, Hijastros, Entre otros )'
    ],
    tiposVivienda: ['Propia', 'Arriendo', 'Familiar'],
    estratos: ['1', '2', '3', '4', '5', '6'],
    escolaridades: [
      'Ninguna', 'Primaria', 'Bachillerato', 'Técnico', 'Tecnólogo',
      'Profesional', 'Especialización', 'Maestría', 'Doctorado', 'Posdoctorado'
    ],
    rangosIngresos: ['Entre 1 y 3 SMMLV', 'Entre 3 y 6 SMMLV', 'Mas de 6 SMMLV'],
    tiposCargo: ['Asistencial', 'Técnico', 'Profesional', 'Asesor', 'Directivo', 'Libre Nombramiento', 'N/A'],
    tiposVinculacion: [
      'Carrera Administrativa', 'Provisional', 'Libre Nombramiento',
      'Planta Temporal', 'CPS', 'Estudiante/Aprendiz', 'Judicante', 'Tercerizado'
    ],
    rangosAntiguedad: [
      'Menos de 1 año.', 'Entre 1 y 4 años', 'Entre 4 y 10 años',
      'Entre 10 y 20 años', 'Entre 20 y 30 años', 'Mas de 30 años', 'N/A - CPS.'
    ]
  };

  function getCats() {
    return state.catalogs || DEFAULT_CATALOGS;
  }

  function badgeClass(estado) {
    const e = (estado || '').toLowerCase();
    if (e.includes('vigente') || e.includes('entregado') || e.includes('cerrado')) return 'badge--aprobada';
    if (e.includes('seguimiento') || e.includes('rehabilit') || e.includes('próximo') || e.includes('reposic')) return 'badge--revision';
    if (e.includes('vencid') || e.includes('devuelt')) return 'badge--rechazada';
    return 'badge--pendiente';
  }

  function formatDate(dStr) {
    if (!dStr) return '—';
    const clean = String(dStr).split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return clean;
  }

  // ─── Autocompletado de Servidores Públicos ─────────────────────────────────
  function onEmployeeInput(query) {
    clearTimeout(employeeSearchTimeout);
    const dropdown = document.getElementById('sst-autocomplete-list');
    if (!dropdown) return;

    const q = (query || '').trim();
    if (q.length < 2) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    employeeSearchTimeout = setTimeout(async () => {
      try {
        const res = await API.getEmployees({ q, limit: 8 });
        const list = (res.data || []).filter(emp => !emp.esVacante);
        if (!list.length) {
          dropdown.style.display = 'none';
          return;
        }
        dropdown.innerHTML = list.map(emp => `
          <div class="autocomplete-item" onclick='SstModule.selectEmployee(${JSON.stringify({
            cedula: emp.cedula || '',
            nombreCompleto: emp.nombreCompleto || '',
            apellidos: `${emp.primerApellido || ''} ${emp.segundoApellido || ''}`.trim(),
            nombres: emp.nombres || '',
            dependencia: emp.dependencia || '',
            cargo: emp.cargoActual || emp.cargoBase || '',
            edad: emp.edad || '',
            sexo: emp.sexo || '',
            telefono: emp.celular || emp.telefonoFijo || '',
            fechaIngreso: emp.fechaIngreso || '',
            ciudad: emp.ciudad || 'Tunja',
            estudios: emp.estudios || '',
            clasificacion: emp.clasificacionEmpleo || 'Carrera Administrativa'
          }).replace(/'/g, '&#39;')})'>
            <div class="autocomplete-item-main">
              <strong>${escHtml(emp.nombreCompleto)}</strong>
              <span class="badge badge--pendiente" style="font-size:10px">C.C. ${escHtml(emp.cedula)}</span>
            </div>
            <div class="autocomplete-item-sub">${escHtml(emp.cargoActual || emp.cargoBase || '')} · ${escHtml(emp.dependencia || '')}</div>
          </div>
        `).join('');
        dropdown.style.display = 'block';
      } catch {
        dropdown.style.display = 'none';
      }
    }, 260);
  }

  function selectEmployee(emp) {
    const dropdown = document.getElementById('sst-autocomplete-list');
    if (dropdown) dropdown.style.display = 'none';

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && val !== '') el.value = val;
    };

    setVal('sst-nombre', emp.nombreCompleto);
    setVal('sst-doc', emp.cedula);
    setVal('sst-apellidos', emp.apellidos);
    setVal('sst-nombres', emp.nombres);
    setVal('sst-dep', emp.dependencia);
    setVal('sst-cargo', emp.cargo);
    setVal('sst-tel', emp.telefono);
    setVal('sst-edad', emp.edad);
    setVal('sst-ingreso', emp.fechaIngreso);
    setVal('sst-profesion', emp.estudios);
    setVal('sst-mpio-res', emp.ciudad);
    if (emp.sexo) {
      const s = emp.sexo.toUpperCase().startsWith('F') ? 'Femenino' : 'Masculino';
      setVal('sst-sexo', s);
    }
  }

  // ─── Dropdown de Opciones Secundarias (Ley de Hick & WCAG 2.1 AA) ──────────
  function toggleActionsDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('sst-dropdown-menu');
    const toggleBtn = document.getElementById('sst-dropdown-toggle');
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
    const menu = document.getElementById('sst-dropdown-menu');
    const toggleBtn = document.getElementById('sst-dropdown-toggle');
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
      const menu = document.getElementById('sst-dropdown-menu');
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
      const menu = document.getElementById('sst-dropdown-menu');
      if (menu && !menu.hasAttribute('hidden') && wrap && !wrap.contains(e.target)) {
        menu.setAttribute('hidden', '');
        const toggleBtn = document.getElementById('sst-dropdown-toggle');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const menu = document.getElementById('sst-dropdown-menu');
        if (menu && !menu.hasAttribute('hidden')) {
          closeActionsDropdown();
        }
      }
    });
  }

  // ─── Render Principal del Módulo SST ──────────────────────────────────────
  async function render(container, initialTab = 'epidemiologico') {
    if (TABS[initialTab]) state.tab = initialTab;
    state.page = 1;
    state.filters = { q: '', subFilter1: 'Todos', subFilter2: 'Todos' };

    const tabCfg = TABS[state.tab];
    const canManage = Auth.canEdit();

    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <h1 class="page-heading" id="sst-heading">${escHtml(tabCfg.title)}</h1>
              <span class="badge badge--revision" id="sst-format-code" style="font-family:monospace;font-size:11px;">Formato ${escHtml(tabCfg.code)}</span>
            </div>
            <p class="page-desc" id="sst-desc">${escHtml(tabCfg.desc)}</p>
          </div>
          <div class="page-actions" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <!-- Dropdown de Opciones Secundarias (Hick's Law) -->
            <div class="actions-dropdown-wrap">
              <button
                type="button"
                class="btn btn-secondary actions-dropdown-btn"
                id="sst-dropdown-toggle"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="sst-dropdown-menu"
                onclick="SstModule.toggleActionsDropdown(event)"
                onkeydown="SstModule.handleDropdownKeydown(event)"
                title="Opciones secundarias (Excel y plantillas)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                <span>Acciones</span>
                <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div
                class="actions-dropdown-menu"
                id="sst-dropdown-menu"
                role="menu"
                aria-labelledby="sst-dropdown-toggle"
                hidden
              >
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="SstModule.closeActionsDropdown(); SstModule.exportExcel();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <div>
                    <strong>Exportar SST a Excel</strong>
                    <small>Descarga los registros actuales del submódulo en formato .xlsx</small>
                  </div>
                </button>
                ${canManage ? `
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="SstModule.closeActionsDropdown(); SstModule.openImportModal();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <div>
                    <strong>Carga Masiva Excel</strong>
                    <small>Importar registros desde plantilla oficial SST</small>
                  </div>
                </button>` : ''}
              </div>
            </div>

            <!-- Acción Primaria (CTA - Visual Salience) -->
            ${canManage ? `
            <button class="btn btn-primary btn-primary-cta" id="sst-create-btn" onclick="SstModule.openCreate()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span id="sst-create-btn-text">${escHtml(tabCfg.btnCreate)}</span>
            </button>` : ''}
          </div>
        </div>

        <!-- KPIs SST -->
        <div class="stats-grid" id="sst-stats-grid" style="margin-bottom:var(--space-5);">
          <div class="stat-card skeleton" style="height:80px" aria-busy="true" role="progressbar"></div>
          <div class="stat-card skeleton" style="height:80px" aria-busy="true" role="progressbar"></div>
          <div class="stat-card skeleton" style="height:80px" aria-busy="true" role="progressbar"></div>
          <div class="stat-card skeleton" style="height:80px" aria-busy="true" role="progressbar"></div>
          <div class="stat-card skeleton" style="height:80px" aria-busy="true" role="progressbar"></div>
        </div>

        <!-- Pestañas de Submódulos SST -->
        <div class="module-tabs">
          <button class="tab-btn ${state.tab === 'epidemiologico' ? 'active' : ''}" onclick="SstModule.setTab('epidemiologico', this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Perfil Epidemiológico y EMO
          </button>
          <button class="tab-btn ${state.tab === 'epp' ? 'active' : ''}" onclick="SstModule.setTab('epp', this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Entrega de EPP
          </button>
          <button class="tab-btn ${state.tab === 'sociodemografico' ? 'active' : ''}" onclick="SstModule.setTab('sociodemografico', this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Perfil Sociodemográfico
          </button>
        </div>

        <!-- Filtros Dinámicos -->
        <div class="filters-card" id="sst-filters-container">
          ${renderFiltersHtml()}
        </div>

        <!-- Tabla Principal -->
        <div class="table-card">
          <div class="table-header table-header--horarios">
            <span class="table-title" id="sst-table-title">${escHtml(tabCfg.title)}</span>
            <button type="button" id="sst-btn-vencimientos" class="btn-check-vencimientos" style="${state.tab === 'epidemiologico' ? '' : 'display:none'}" onclick="SstModule.checkEmoVencimientos()" title="Verificar Exámenes Médicos Ocupacionales próximos a vencer o vencidos">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              <span>Verificar Vencimientos EMO</span>
            </button>
            <span class="table-count" id="sst-count">Cargando...</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead id="sst-thead">${renderTheadHtml()}</thead>
              <tbody id="sst-tbody">
                <tr><td colspan="8"><div class="empty-state loading-pulse">Cargando registros de SST...</div></td></tr>
              </tbody>
            </table>
          </div>
          <div class="pagination" id="sst-pagination"></div>
        </div>
      </div>
    `;

    bindDropdownOutsideClick();
    // Cargar catálogos y estadísticas en paralelo
    API.getSstCatalogs().then(c => { state.catalogs = c; }).catch(() => {});
    loadStats();
    await load();
  }

  function renderFiltersHtml() {
    const cats = getCats();
    if (state.tab === 'epidemiologico') {
      return `
        <div class="filters-row">
          <div class="filter-group" style="flex:2">
            <label class="filter-label">Buscar Servidor / PVE / Restricción</label>
            <input id="sst-q" class="filter-input" placeholder="Nombre, cédula, dependencia, PVE..." value="${escHtml(state.filters.q || '')}" onkeypress="if(event.key==='Enter')SstModule.applyFilters()" />
          </div>
          <div class="filter-group">
            <label class="filter-label">Tipo de EMO</label>
            <select id="sst-filter-1" class="filter-select">
              <option value="Todos">Todos los tipos</option>
              ${cats.tiposEmo.map(t => `<option value="${escHtml(t)}" ${state.filters.subFilter1 === t ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Estado del Caso</label>
            <select id="sst-filter-2" class="filter-select">
              <option value="Todos">Todos los estados</option>
              ${cats.estadosCaso.map(e => `<option value="${escHtml(e)}" ${state.filters.subFilter2 === e ? 'selected' : ''}>${escHtml(e)}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" onclick="SstModule.applyFilters()">Filtrar</button>
          <button class="btn btn-secondary" onclick="SstModule.clearFilters()">Limpiar</button>
        </div>`;
    }
    if (state.tab === 'epp') {
      return `
        <div class="filters-row">
          <div class="filter-group" style="flex:2">
            <label class="filter-label">Buscar Servidor / Elemento EPP</label>
            <input id="sst-q" class="filter-input" placeholder="Nombre, cédula, dependencia o elemento..." value="${escHtml(state.filters.q || '')}" onkeypress="if(event.key==='Enter')SstModule.applyFilters()" />
          </div>
          <div class="filter-group">
            <label class="filter-label">Elemento EPP (Catálogo A-AB)</label>
            <select id="sst-filter-1" class="filter-select">
              <option value="Todos">Todos los elementos</option>
              ${cats.eppCatalogo.map(e => `<option value="${escHtml(e.codigo)}" ${state.filters.subFilter1 === e.codigo ? 'selected' : ''}>${escHtml(e.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Estado de Entrega</label>
            <select id="sst-filter-2" class="filter-select">
              <option value="Todos">Todos</option>
              ${['Entregado', 'Reposición Programada', 'Pendiente Firma', 'Devuelto'].map(s => `<option value="${s}" ${state.filters.subFilter2 === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" onclick="SstModule.applyFilters()">Filtrar</button>
          <button class="btn btn-secondary" onclick="SstModule.clearFilters()">Limpiar</button>
        </div>`;
    }
    return `
      <div class="filters-row">
        <div class="filter-group" style="flex:2">
          <label class="filter-label">Buscar Servidor / Profesión / Dependencia</label>
          <input id="sst-q" class="filter-input" placeholder="Nombre, cédula, profesión, dependencia..." value="${escHtml(state.filters.q || '')}" onkeypress="if(event.key==='Enter')SstModule.applyFilters()" />
        </div>
        <div class="filter-group">
          <label class="filter-label">Escolaridad</label>
          <select id="sst-filter-1" class="filter-select">
            <option value="Todas">Todas</option>
            ${cats.escolaridades.map(e => `<option value="${escHtml(e)}" ${state.filters.subFilter1 === e ? 'selected' : ''}>${escHtml(e)}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">Tipo de Vinculación</label>
          <select id="sst-filter-2" class="filter-select">
            <option value="Todos">Todos</option>
            ${cats.tiposVinculacion.map(v => `<option value="${escHtml(v)}" ${state.filters.subFilter2 === v ? 'selected' : ''}>${escHtml(v)}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" onclick="SstModule.applyFilters()">Filtrar</button>
        <button class="btn btn-secondary" onclick="SstModule.clearFilters()">Limpiar</button>
      </div>`;
  }

  function renderTheadHtml() {
    if (state.tab === 'epidemiologico') {
      return `<tr>
        <th>Código</th>
        <th>Servidor Público</th>
        <th>Dependencia & Sede</th>
        <th>Tipo & Fecha EMO</th>
        <th>PVE / Restricciones</th>
        <th>Próximo EMO</th>
        <th>Estado Caso</th>
        <th style="text-align:right">Acciones</th>
      </tr>`;
    }
    if (state.tab === 'epp') {
      return `<tr>
        <th>Radicado</th>
        <th>Servidor Público</th>
        <th>Dependencia & Cargo</th>
        <th>Elemento EPP Entregado</th>
        <th>Talla & Cantidad</th>
        <th>Fecha Entrega</th>
        <th>Estado</th>
        <th style="text-align:right">Acciones</th>
      </tr>`;
    }
    return `<tr>
      <th>Código</th>
      <th>Servidor Público</th>
      <th>Sexo & Edad</th>
      <th>Escolaridad & Profesión</th>
      <th>Dependencia & Sede</th>
      <th>Vinculación & Ingresos</th>
      <th>Estado Civil / Estrato</th>
      <th style="text-align:right">Acciones</th>
    </tr>`;
  }

  async function setTab(tabKey, activeBtn) {
    if (!TABS[tabKey]) return;
    state.tab = tabKey;
    state.page = 1;
    state.filters = { q: '', subFilter1: 'Todos', subFilter2: 'Todos' };

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');

    // Sincronizar submenú lateral SST
    const sideMap = {
      epidemiologico: 'nav-sst-epidemiologico',
      epp: 'nav-sst-epp',
      sociodemografico: 'nav-sst-sociodemografico'
    };
    document.querySelectorAll('#sst-submenu .nav-subitem').forEach(b => b.classList.remove('active'));
    const sideBtn = document.getElementById(sideMap[tabKey]);
    if (sideBtn) sideBtn.classList.add('active');

    const tabCfg = TABS[tabKey];
    const heading = document.getElementById('sst-heading');
    if (heading) heading.textContent = tabCfg.title;
    const codeBadge = document.getElementById('sst-format-code');
    if (codeBadge) codeBadge.textContent = `Formato ${tabCfg.code}`;
    const desc = document.getElementById('sst-desc');
    if (desc) desc.textContent = tabCfg.desc;
    const tableTitle = document.getElementById('sst-table-title');
    if (tableTitle) tableTitle.textContent = tabCfg.title;
    const createBtnTxt = document.getElementById('sst-create-btn-text');
    if (createBtnTxt) createBtnTxt.textContent = tabCfg.btnCreate;
    const btnVenc = document.getElementById('sst-btn-vencimientos');
    if (btnVenc) btnVenc.style.display = tabKey === 'epidemiologico' ? '' : 'none';

    const filtersContainer = document.getElementById('sst-filters-container');
    if (filtersContainer) filtersContainer.innerHTML = renderFiltersHtml();
    const thead = document.getElementById('sst-thead');
    if (thead) thead.innerHTML = renderTheadHtml();

    await load();
  }

  function loadStats() {
    API.getSstStats().then(s => {
      state.stats = s;
      const grid = document.getElementById('sst-stats-grid');
      if (!grid) return;
      grid.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon stat-icon--blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${s.totalEmo || 0}</span>
            <span class="stat-label">Perfiles Epidemiológicos (EMO)</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon--green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${s.direccionadosPve || 0}</span>
            <span class="stat-label">Activos en Programas PVE</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon--gold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${s.casosSeguimiento || 0}</span>
            <span class="stat-label">Casos AT / EL en Seguimiento</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon--purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${s.totalEpp || 0}</span>
            <span class="stat-label">Dotaciones EPP Entregadas</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon--blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${s.totalSociodemografico || 0}</span>
            <span class="stat-label">Perfiles Sociodemográficos</span>
          </div>
        </div>
      `;
    }).catch(() => {});
  }

  function renderSkeletonTable() {
    const tbody = document.getElementById('sst-tbody');
    if (!tbody) return;
    const skeletonRows = Array.from({ length: 6 }).map((_, i) => `
      <tr class="skeleton-row" style="animation-delay: ${i * 0.08}s">
        <td><div class="skeleton-bar" style="width: 85px; height: 16px;"></div></td>
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
        <td><div class="skeleton-bar" style="width: 100px; height: 13px;"></div></td>
        <td><div class="skeleton-bar" style="width: 110px; height: 13px;"></div></td>
        <td><div class="skeleton-bar" style="width: 75px; height: 13px;"></div></td>
        <td><div class="skeleton-bar" style="width: 85px; height: 22px; border-radius: 12px;"></div></td>
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
      let res;
      if (state.tab === 'epidemiologico') {
        res = await API.getSstEpidemiologico({
          page: state.page,
          limit: 20,
          q: state.filters.q || '',
          tipoEmo: state.filters.subFilter1 || 'Todos',
          estadoCaso: state.filters.subFilter2 || 'Todos'
        });
      } else if (state.tab === 'epp') {
        res = await API.getSstEpp({
          page: state.page,
          limit: 20,
          q: state.filters.q || '',
          elemento: state.filters.subFilter1 || 'Todos',
          estado: state.filters.subFilter2 || 'Todos'
        });
      } else {
        res = await API.getSstSociodemografico({
          page: state.page,
          limit: 20,
          q: state.filters.q || '',
          escolaridad: state.filters.subFilter1 || 'Todas',
          tipoVinculacion: state.filters.subFilter2 || 'Todos'
        });
      }

      state.data = res.data || [];
      state.total = res.total || 0;
      state.totalPages = res.totalPages || 1;
      renderTable();
      renderPagination();

      const countEl = document.getElementById('sst-count');
      if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} registros`;
    } catch (err) {
      App.showToast('Error al cargar registros SST: ' + err.message, 'error');
    }
  }

  function renderTable() {
    const tbody = document.getElementById('sst-tbody');
    if (!tbody) return;
    tbody.removeAttribute('role');
    tbody.setAttribute('aria-busy', 'false');

    if (!state.data.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span class="empty-state-title">No hay registros en ${escHtml(TABS[state.tab].title)}</span>
        <span class="empty-state-desc">Crea un nuevo registro o realiza una carga masiva desde Excel.</span>
      </div></td></tr>`;
      return;
    }

    if (state.tab === 'epidemiologico') {
      tbody.innerHTML = state.data.map(r => `
        <tr>
          <td class="td-radicado">${escHtml(r.radicado)}</td>
          <td>
            <div class="user-table-cell">
              <span class="td-primary" title="${escHtml(r.nombreCompleto)}">${escHtml(truncate(r.nombreCompleto, 26))}</span>
              <span class="user-table-cc font-mono">C.C. ${escHtml(r.documento)} ${r.edad ? `· ${r.edad} años` : ''}</span>
            </div>
          </td>
          <td>
            <div class="user-table-cell">
              <span title="${escHtml(r.dependencia)}">${escHtml(truncate(r.dependencia, 26))}</span>
              <span class="user-table-cc">${escHtml(truncate(r.sedeTrabajo || 'CASA DE LA TORRE', 24))}</span>
            </div>
          </td>
          <td>
            <div class="user-table-cell">
              <span class="badge badge--permiso">${escHtml(r.tipoEmo)}</span>
              <span class="user-table-cc">${formatDate(r.fechaEmo)}</span>
            </div>
          </td>
          <td>
            <div class="user-table-cell">
              <span class="td-primary" title="${escHtml(r.direccionadoPve)}">${escHtml(truncate(r.direccionadoPve || 'No aplica', 24))}</span>
              <span class="user-table-cc" title="${escHtml(r.restricciones)}">${escHtml(truncate(r.restricciones || 'Sin restricciones', 26))}</span>
            </div>
          </td>
          <td>${formatDate(r.fechaProximoEmo)}</td>
          <td>
            <span class="badge ${badgeClass(r.estadoFinalCaso)}">${escHtml(r.estadoFinalCaso)}</span>
            ${(r.accidenteTrabajo === 'SI' || r.enfermedadLaboral === 'SI') ? '<span class="badge badge--incapacidad" style="margin-left:4px;font-size:10px;" title="Caso con Accidente de Trabajo o Enfermedad Laboral">AT/EL</span>' : ''}
          </td>
          <td class="td-actions">
            <div class="td-actions-wrap">
              <button class="btn-action-view" onclick="SstModule.openView(${r.id})" title="Ver Ficha Epidemiológica">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn-action-soporte" onclick="SstModule.exportSinglePdf(${r.id})" title="Descargar Ficha PDF Oficial E-DO-ST-F-024">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </button>
              ${Auth.canEdit() ? `
              <button class="btn-action-edit" onclick="SstModule.openEdit(${r.id})" title="Editar Registro">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-action-delete" onclick="SstModule.confirmDelete(${r.id}, '${escHtml(r.nombreCompleto)}')" title="Eliminar Registro">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>`).join('');
      return;
    }

    if (state.tab === 'epp') {
      tbody.innerHTML = state.data.map(r => `
        <tr>
          <td class="td-radicado">${escHtml(r.radicado)}</td>
          <td>
            <div class="user-table-cell">
              <span class="td-primary" title="${escHtml(r.nombreCompleto)}">${escHtml(truncate(r.nombreCompleto, 26))}</span>
              <span class="user-table-cc font-mono">C.C. ${escHtml(r.documento)}</span>
            </div>
          </td>
          <td>
            <div class="user-table-cell">
              <span title="${escHtml(r.dependencia)}">${escHtml(truncate(r.dependencia, 26))}</span>
              <span class="user-table-cc">${escHtml(truncate(r.cargo || '', 24))}</span>
            </div>
          </td>
          <td><span class="badge badge--licencia">${escHtml(r.elementoEpp)}</span></td>
          <td>
            <div class="user-table-cell">
              <span class="td-primary">${escHtml(r.cantidad)}</span>
              <span class="user-table-cc">Talla: ${escHtml(r.talla || 'N/A')}</span>
            </div>
          </td>
          <td>${formatDate(r.fechaEntrega)}</td>
          <td><span class="badge ${badgeClass(r.estadoEntrega)}">${escHtml(r.estadoEntrega)}</span></td>
          <td class="td-actions">
            <div class="td-actions-wrap">
              <button class="btn-action-view" onclick="SstModule.openView(${r.id})" title="Ver Detalle de Entrega EPP">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn-action-soporte" onclick="SstModule.exportSinglePdf(${r.id})" title="Descargar Acta de Entrega PDF (Formato E-DO-ST-F-028)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </button>
              ${Auth.canEdit() ? `
              <button class="btn-action-edit" onclick="SstModule.openEdit(${r.id})" title="Editar Entrega">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-action-delete" onclick="SstModule.confirmDelete(${r.id}, '${escHtml(r.nombreCompleto)}')" title="Eliminar Entrega">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>`).join('');
      return;
    }

    // Sociodemográfico
    tbody.innerHTML = state.data.map(r => `
      <tr>
        <td class="td-radicado">${escHtml(r.radicado)}</td>
        <td>
          <div class="user-table-cell">
            <span class="td-primary" title="${escHtml(r.nombreCompleto)}">${escHtml(truncate(r.nombreCompleto, 26))}</span>
            <span class="user-table-cc font-mono">C.C. ${escHtml(r.documento)}</span>
          </div>
        </td>
        <td>
          <div class="user-table-cell">
            <span>${escHtml(r.sexo || '—')}</span>
            <span class="user-table-cc">${r.edad ? `${r.edad} años (${r.anioNacimiento || ''})` : '—'}</span>
          </div>
        </td>
        <td>
          <div class="user-table-cell">
            <span class="badge badge--permiso">${escHtml(r.escolaridad || 'Profesional')}</span>
            <span class="user-table-cc">${escHtml(truncate(r.ocupacionProfesion || r.denominacionCargo || '', 22))}</span>
          </div>
        </td>
        <td>
          <div class="user-table-cell">
            <span title="${escHtml(r.dependencia)}">${escHtml(truncate(r.dependencia, 24))}</span>
            <span class="user-table-cc">${escHtml(truncate(r.sedeTrabajo || '', 22))}</span>
          </div>
        </td>
        <td>
          <div class="user-table-cell">
            <span class="td-primary">${escHtml(r.tipoVinculacion || '—')}</span>
            <span class="user-table-cc">${escHtml(r.rangoIngresos || '—')}</span>
          </div>
        </td>
        <td>
          <div class="user-table-cell">
            <span>${escHtml(r.estadoCivil || '—')}</span>
            <span class="user-table-cc">Estrato ${escHtml(r.estrato || '—')} · ${escHtml(r.tipoVivienda || '')}</span>
          </div>
        </td>
        <td class="td-actions">
          <div class="td-actions-wrap">
            <button class="btn-action-view" onclick="SstModule.openView(${r.id})" title="Ver Ficha Sociodemográfica">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            ${Auth.canEdit() ? `
            <button class="btn-action-edit" onclick="SstModule.openEdit(${r.id})" title="Editar Perfil">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-action-delete" onclick="SstModule.confirmDelete(${r.id}, '${escHtml(r.nombreCompleto)}')" title="Eliminar Perfil">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  }

  function renderPagination() {
    const el = document.getElementById('sst-pagination');
    if (!el) return;
    el.innerHTML = `
      <span class="pagination-info">Mostrando ${state.data.length} de ${state.total.toLocaleString('es-CO')}</span>
      <div class="pagination-btns">
        <button class="page-btn" onclick="SstModule.goPage(${state.page - 1})" ${state.page <= 1 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="page-btn active">${state.page}</span>
        <span style="color:var(--text-muted);font-size:var(--text-sm)">/ ${state.totalPages}</span>
        <button class="page-btn" onclick="SstModule.goPage(${state.page + 1})" ${state.page >= state.totalPages ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`;
  }

  // ─── Formularios por Submódulo ─────────────────────────────────────────────
  function buildForm(r = {}) {
    const cats = getCats();
    currentUploadedFile = r.soporte || null;

    if (state.tab === 'epidemiologico') {
      return `
        <div class="form-grid">
          <div class="form-group span-2 autocomplete-wrapper">
            <label class="form-label">Servidor Público * <span style="font-size:11px;color:var(--color-primary-400);font-weight:400;">(Escribe nombre o cédula para autocompletar desde planta)</span></label>
            <input id="sst-nombre" class="form-input" placeholder="Buscar funcionario por nombre o documento..." value="${escHtml(r.nombreCompleto || '')}" oninput="SstModule.onEmployeeInput(this.value)" autocomplete="off" required />
            <div id="sst-autocomplete-list" class="autocomplete-dropdown" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de Identificación</label>
            <select id="sst-tipo-id" class="filter-select">
              ${cats.tiposIdentificacion.map(t => `<option ${r.tipoIdentificacion === t ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Número de Documento *</label>
            <input id="sst-doc" class="form-input" placeholder="Cédula" value="${escHtml(r.documento || '')}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono / Celular</label>
            <input id="sst-tel" class="form-input" placeholder="Ej: 3213938142" value="${escHtml(r.telefono || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Edad (años)</label>
            <input id="sst-edad" type="number" class="form-input" value="${escHtml(r.edad || '')}" />
          </div>
          <div class="form-group span-2">
            <label class="form-label">Dependencia donde trabaja *</label>
            <input id="sst-dep" list="sst-deps-list" class="form-input" placeholder="Seleccione o escriba dependencia..." value="${escHtml(r.dependencia || 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo')}" />
            <datalist id="sst-deps-list">
              ${cats.dependencias.map(d => `<option value="${escHtml(d)}"></option>`).join('')}
            </datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Sede de Trabajo</label>
            <select id="sst-sede" class="filter-select">
              ${cats.sedes.map(s => `<option ${r.sedeTrabajo === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Cargo</label>
            <input id="sst-cargo" class="form-input" value="${escHtml(r.cargo || 'PROFESIONAL UNIVERSITARIO')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de EMO *</label>
            <select id="sst-tipo-emo" class="filter-select">
              ${cats.tiposEmo.map(t => `<option ${r.tipoEmo === t ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha Realización EMO *</label>
            <input id="sst-fecha-emo" type="date" class="form-input" value="${escHtml(r.fechaEmo || new Date().toISOString().split('T')[0])}" />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha Próximo EMO</label>
            <input id="sst-prox-emo" type="date" class="form-input" value="${escHtml(r.fechaProximoEmo || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Estado Final del Caso</label>
            <select id="sst-estado-caso" class="filter-select">
              ${cats.estadosCaso.map(e => `<option ${r.estadoFinalCaso === e ? 'selected' : ''}>${escHtml(e)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Direccionado a PVE</label>
            <select id="sst-pve" class="filter-select">
              ${cats.programasPve.map(p => `<option ${r.direccionadoPve === p ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Direccionado a EPS / ARL</label>
            <input id="sst-eps" class="form-input" placeholder="Ej: Control por Ortopedia EPS / No aplica" value="${escHtml(r.direccionadoEps || 'No aplica')}" />
          </div>
          <div class="form-group span-2">
            <label class="form-label">Restricciones Médicas Laborales</label>
            <input id="sst-restricciones" class="form-input" placeholder="NINGUNA o detalle de restricción médica..." value="${escHtml(r.restricciones || 'NINGUNA')}" />
          </div>
          <div class="form-group span-2">
            <label class="form-label">Recomendaciones Médicas Ocupacionales</label>
            <input id="sst-recomendaciones" class="form-input" placeholder="Pausas activas, higiene postural, adecuación ergonómica..." value="${escHtml(r.recomendaciones || 'Pausas activas e higiene postural')}" />
          </div>
          <div class="form-group">
            <label class="form-label">¿Accidente de Trabajo (AT)?</label>
            <select id="sst-at" class="filter-select">
              <option value="NO" ${r.accidenteTrabajo !== 'SI' ? 'selected' : ''}>NO</option>
              <option value="SI" ${r.accidenteTrabajo === 'SI' ? 'selected' : ''}>SI</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">¿Enfermedad Laboral (EL)?</label>
            <select id="sst-el" class="filter-select">
              <option value="NO" ${r.enfermedadLaboral !== 'SI' ? 'selected' : ''}>NO</option>
              <option value="SI" ${r.enfermedadLaboral === 'SI' ? 'selected' : ''}>SI</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">¿Cumplió Rehabilitación?</label>
            <select id="sst-rehab" class="filter-select">
              <option value="N/A" ${(!r.cumplioRehabilitacion || r.cumplioRehabilitacion === 'N/A') ? 'selected' : ''}>N/A</option>
              <option value="SI" ${r.cumplioRehabilitacion === 'SI' ? 'selected' : ''}>SI</option>
              <option value="NO" ${r.cumplioRehabilitacion === 'NO' ? 'selected' : ''}>NO</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Actividades Pendientes SST</label>
            <input id="sst-pendientes" class="form-input" placeholder="Seguimiento, inspección de puesto..." value="${escHtml(r.actividadesPendientes || '')}" />
          </div>
        </div>`;
    }

    if (state.tab === 'epp') {
      return `
        <div class="form-grid">
          <div class="form-group span-2 autocomplete-wrapper">
            <label class="form-label">Servidor Público * <span style="font-size:11px;color:var(--color-primary-400);font-weight:400;">(Escribe para autocompletar desde planta)</span></label>
            <input id="sst-nombre" class="form-input" placeholder="Buscar funcionario..." value="${escHtml(r.nombreCompleto || '')}" oninput="SstModule.onEmployeeInput(this.value)" autocomplete="off" required />
            <div id="sst-autocomplete-list" class="autocomplete-dropdown" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Documento de Identidad (C.C.) *</label>
            <input id="sst-doc" class="form-input" placeholder="Número de documento" value="${escHtml(r.documento || '')}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono</label>
            <input id="sst-tel" class="form-input" placeholder="Celular de contacto" value="${escHtml(r.telefono || '')}" />
          </div>
          <div class="form-group span-2">
            <label class="form-label">Dependencia / Subdirección *</label>
            <input id="sst-dep" list="sst-deps-list" class="form-input" value="${escHtml(r.dependencia || 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo')}" />
            <datalist id="sst-deps-list">
              ${cats.dependencias.map(d => `<option value="${escHtml(d)}"></option>`).join('')}
            </datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Cargo</label>
            <input id="sst-cargo" class="form-input" value="${escHtml(r.cargo || 'PROFESIONAL UNIVERSITARIO')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de Vinculación</label>
            <select id="sst-vinculacion" class="filter-select">
              ${cats.tiposVinculacion.map(v => `<option ${(r.tipoVinculacion || '').toUpperCase() === v.toUpperCase() ? 'selected' : ''}>${escHtml(v)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group span-2">
            <label class="form-label">Elemento de Protección Personal (Catálogo E-DO-ST-F-028) *</label>
            <select id="sst-elemento-epp" class="filter-select">
              ${cats.eppCatalogo.map(e => `<option value="${escHtml(e.nombre)}" ${(r.elementoEpp === e.nombre || r.codigoElemento === e.codigo) ? 'selected' : ''}>${escHtml(e.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Talla</label>
            <input id="sst-talla" class="form-input" placeholder="N/A, S, M, L, XL, 38, 40..." value="${escHtml(r.talla || 'N/A')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Cantidad Entregada *</label>
            <input id="sst-cantidad" class="form-input" placeholder="1 UNIDAD, 1 PAR, 1 CAJA..." value="${escHtml(r.cantidad || '1 UNIDAD')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de Entrega *</label>
            <input id="sst-fecha-entrega" type="date" class="form-input" value="${escHtml(r.fechaEntrega || new Date().toISOString().split('T')[0])}" />
          </div>
          <div class="form-group">
            <label class="form-label">Estado de Entrega</label>
            <select id="sst-estado-entrega" class="filter-select">
              ${['Entregado', 'Reposición Programada', 'Pendiente Firma', 'Devuelto'].map(s => `<option ${r.estadoEntrega === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group span-2">
            <label class="form-label">Restricciones y/o Recomendaciones Asociadas</label>
            <input id="sst-restricciones" class="form-input" value="${escHtml(r.restriccionesRecomendaciones || 'NINGUNA')}" />
          </div>
          <div class="form-group span-2">
            <label class="form-label">Observaciones de Dotación (Instructivo E-DO-ST-I-007)</label>
            <input id="sst-obs" class="form-input" placeholder="Observaciones adicionales..." value="${escHtml(r.observaciones || '')}" />
          </div>
        </div>`;
    }

    // Sociodemográfico (E-DO-ST-F-011 V5)
    return `
      <div class="form-grid">
        <div class="form-group span-2 autocomplete-wrapper">
          <label class="form-label">Servidor Público * <span style="font-size:11px;color:var(--color-primary-400);font-weight:400;">(Escribe para autocompletar desde planta)</span></label>
          <input id="sst-nombre" class="form-input" placeholder="Buscar funcionario..." value="${escHtml(r.nombreCompleto || '')}" oninput="SstModule.onEmployeeInput(this.value)" autocomplete="off" required />
          <div id="sst-autocomplete-list" class="autocomplete-dropdown" style="display:none;"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Documento</label>
          <select id="sst-tipo-id" class="filter-select">
            ${cats.tiposIdentificacion.map(t => `<option ${r.tipoIdentificacion === t ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Número de Identificación *</label>
          <input id="sst-doc" class="form-input" value="${escHtml(r.documento || '')}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Sexo</label>
          <select id="sst-sexo" class="filter-select">
            <option ${r.sexo === 'Masculino' ? 'selected' : ''}>Masculino</option>
            <option ${r.sexo === 'Femenino' ? 'selected' : ''}>Femenino</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Año Nacimiento / Edad</label>
          <div style="display:flex;gap:8px;">
            <input id="sst-anio-nac" type="number" class="form-input" placeholder="Año (Ej: 1990)" value="${escHtml(r.anioNacimiento || '')}" />
            <input id="sst-edad" type="number" class="form-input" placeholder="Edad" value="${escHtml(r.edad || '')}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Raza / Etnia</label>
          <select id="sst-raza" class="filter-select">
            ${cats.razas.map(rz => `<option ${r.razaEtnia === rz ? 'selected' : ''}>${escHtml(rz)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado Civil</label>
          <select id="sst-estado-civil" class="filter-select">
            ${cats.estadosCiviles.map(ec => `<option ${r.estadoCivil === ec ? 'selected' : ''}>${escHtml(ec)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Composición Familiar (Personas con las que comparte vivienda)</label>
          <select id="sst-familia" class="filter-select">
            ${cats.composicionesFamiliares.map(cf => `<option ${r.composicionFamiliar === cf ? 'selected' : ''}>${escHtml(cf)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Vivienda</label>
          <select id="sst-vivienda" class="filter-select">
            ${cats.tiposVivienda.map(tv => `<option ${r.tipoVivienda === tv ? 'selected' : ''}>${escHtml(tv)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estrato Servicios Públicos</label>
          <select id="sst-estrato" class="filter-select">
            ${cats.estratos.map(es => `<option ${String(r.estrato || '3') === es ? 'selected' : ''}>${es}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Municipio de Residencia</label>
          <input id="sst-mpio-res" class="form-input" value="${escHtml(r.municipioResidencia || 'Tunja')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Municipio donde Trabaja</label>
          <input id="sst-mpio-trab" class="form-input" value="${escHtml(r.municipioTrabajo || 'Tunja')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Escolaridad (Último nivel)</label>
          <select id="sst-escolaridad" class="filter-select">
            ${cats.escolaridades.map(sc => `<option ${r.escolaridad === sc ? 'selected' : ''}>${escHtml(sc)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ocupación o Profesión</label>
          <input id="sst-profesion" class="form-input" placeholder="Ej: Ingeniero Industrial, Abogado..." value="${escHtml(r.ocupacionProfesion || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Rango de Ingresos</label>
          <select id="sst-ingresos" class="filter-select">
            ${cats.rangosIngresos.map(ri => `<option ${r.rangoIngresos === ri ? 'selected' : ''}>${escHtml(ri)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Denominación del Cargo</label>
          <input id="sst-cargo" class="form-input" value="${escHtml(r.denominacionCargo || 'Profesional Universitario')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Cargo</label>
          <select id="sst-tipo-cargo" class="filter-select">
            ${cats.tiposCargo.map(tc => `<option ${r.tipoCargo === tc ? 'selected' : ''}>${escHtml(tc)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Vinculación</label>
          <select id="sst-vinculacion" class="filter-select">
            ${cats.tiposVinculacion.map(tv => `<option ${r.tipoVinculacion === tv ? 'selected' : ''}>${escHtml(tv)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Antigüedad en el Cargo Actual</label>
          <select id="sst-ant-cargo" class="filter-select">
            ${cats.rangosAntiguedad.map(ra => `<option ${r.antiguedadCargo === ra ? 'selected' : ''}>${escHtml(ra)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Antigüedad en la Entidad</label>
          <select id="sst-ant-entidad" class="filter-select">
            ${cats.rangosAntiguedad.map(ra => `<option ${r.antiguedadEntidad === ra ? 'selected' : ''}>${escHtml(ra)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Dependencia donde Trabaja *</label>
          <input id="sst-dep" list="sst-deps-list" class="form-input" value="${escHtml(r.dependencia || 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo')}" />
          <datalist id="sst-deps-list">
            ${cats.dependencias.map(d => `<option value="${escHtml(d)}"></option>`).join('')}
          </datalist>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Sede de Trabajo</label>
          <select id="sst-sede" class="filter-select">
            ${cats.sedes.map(s => `<option ${r.sedeTrabajo === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
          </select>
        </div>
      </div>`;
  }

  function readForm() {
    const nombreCompleto = document.getElementById('sst-nombre')?.value.trim();
    const documento = document.getElementById('sst-doc')?.value.trim();
    if (!nombreCompleto || !documento) {
      App.showToast('El nombre del servidor y su documento son requeridos.', 'warning');
      return null;
    }

    if (state.tab === 'epidemiologico') {
      return {
        nombreCompleto,
        documento,
        tipoIdentificacion: document.getElementById('sst-tipo-id')?.value,
        telefono: document.getElementById('sst-tel')?.value.trim(),
        edad: document.getElementById('sst-edad')?.value,
        dependencia: document.getElementById('sst-dep')?.value.trim(),
        sedeTrabajo: document.getElementById('sst-sede')?.value,
        cargo: document.getElementById('sst-cargo')?.value.trim(),
        tipoEmo: document.getElementById('sst-tipo-emo')?.value,
        fechaEmo: document.getElementById('sst-fecha-emo')?.value,
        fechaProximoEmo: document.getElementById('sst-prox-emo')?.value,
        estadoFinalCaso: document.getElementById('sst-estado-caso')?.value,
        direccionadoPve: document.getElementById('sst-pve')?.value,
        direccionadoEps: document.getElementById('sst-eps')?.value.trim(),
        restricciones: document.getElementById('sst-restricciones')?.value.trim(),
        recomendaciones: document.getElementById('sst-recomendaciones')?.value.trim(),
        accidenteTrabajo: document.getElementById('sst-at')?.value,
        enfermedadLaboral: document.getElementById('sst-el')?.value,
        cumplioRehabilitacion: document.getElementById('sst-rehab')?.value,
        actividadesPendientes: document.getElementById('sst-pendientes')?.value.trim()
      };
    }

    if (state.tab === 'epp') {
      return {
        nombreCompleto,
        documento,
        telefono: document.getElementById('sst-tel')?.value.trim(),
        dependencia: document.getElementById('sst-dep')?.value.trim(),
        cargo: document.getElementById('sst-cargo')?.value.trim(),
        tipoVinculacion: document.getElementById('sst-vinculacion')?.value,
        elementoEpp: document.getElementById('sst-elemento-epp')?.value,
        talla: document.getElementById('sst-talla')?.value.trim(),
        cantidad: document.getElementById('sst-cantidad')?.value.trim(),
        fechaEntrega: document.getElementById('sst-fecha-entrega')?.value,
        estadoEntrega: document.getElementById('sst-estado-entrega')?.value,
        restriccionesRecomendaciones: document.getElementById('sst-restricciones')?.value.trim(),
        observaciones: document.getElementById('sst-obs')?.value.trim()
      };
    }

    return {
      nombreCompleto,
      documento,
      tipoIdentificacion: document.getElementById('sst-tipo-id')?.value,
      sexo: document.getElementById('sst-sexo')?.value,
      anioNacimiento: document.getElementById('sst-anio-nac')?.value,
      edad: document.getElementById('sst-edad')?.value,
      razaEtnia: document.getElementById('sst-raza')?.value,
      estadoCivil: document.getElementById('sst-estado-civil')?.value,
      composicionFamiliar: document.getElementById('sst-familia')?.value,
      tipoVivienda: document.getElementById('sst-vivienda')?.value,
      estrato: document.getElementById('sst-estrato')?.value,
      municipioResidencia: document.getElementById('sst-mpio-res')?.value.trim(),
      municipioTrabajo: document.getElementById('sst-mpio-trab')?.value.trim(),
      escolaridad: document.getElementById('sst-escolaridad')?.value,
      ocupacionProfesion: document.getElementById('sst-profesion')?.value.trim(),
      rangoIngresos: document.getElementById('sst-ingresos')?.value,
      denominacionCargo: document.getElementById('sst-cargo')?.value.trim(),
      tipoCargo: document.getElementById('sst-tipo-cargo')?.value,
      tipoVinculacion: document.getElementById('sst-vinculacion')?.value,
      antiguedadCargo: document.getElementById('sst-ant-cargo')?.value,
      antiguedadEntidad: document.getElementById('sst-ant-entidad')?.value,
      dependencia: document.getElementById('sst-dep')?.value.trim(),
      sedeTrabajo: document.getElementById('sst-sede')?.value
    };
  }

  function openCreate() {
    const tabCfg = TABS[state.tab];
    App.openModal(`${tabCfg.btnCreate} (${tabCfg.code})`, buildForm(), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Guardar Registro', cls: 'btn-primary', id: 'sst-save-btn', action: saveCreate }
    ]);
  }

  function openEdit(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;
    const tabCfg = TABS[state.tab];
    App.openModal(`Editar — ${tabCfg.title} (${r.radicado})`, buildForm(r), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Actualizar Cambios', cls: 'btn-gold', id: 'sst-save-btn', action: () => saveEdit(id) }
    ]);
  }

  async function saveCreate() {
    const body = readForm();
    if (!body) return;
    const btn = document.getElementById('sst-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      let res;
      if (state.tab === 'epidemiologico') res = await API.createSstEpidemiologico(body);
      else if (state.tab === 'epp') res = await API.createSstEpp(body);
      else res = await API.createSstSociodemografico(body);

      App.closeModal();
      App.showToast(`${res.message || 'Registro creado.'} (${res.radicado || ''})`, 'success');
      loadStats();
      await load();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar Registro'; }
    }
  }

  async function saveEdit(id) {
    const body = readForm();
    if (!body) return;
    const btn = document.getElementById('sst-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
    try {
      if (state.tab === 'epidemiologico') await API.updateSstEpidemiologico(id, body);
      else if (state.tab === 'epp') await API.updateSstEpp(id, body);
      else await API.updateSstSociodemografico(id, body);

      App.closeModal();
      App.showToast('Registro actualizado exitosamente.', 'success');
      loadStats();
      await load();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Actualizar Cambios'; }
    }
  }

  function openView(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;

    let html = '';
    if (state.tab === 'epidemiologico') {
      html = `
        <div class="detail-modal-card">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Código Formato E-DO-ST-F-024</span><span class="detail-value">${escHtml(r.radicado)}</span></div>
            <div class="detail-item"><span class="detail-label">Estado del Caso</span><div class="detail-badge-wrap"><span class="badge ${badgeClass(r.estadoFinalCaso)}">${escHtml(r.estadoFinalCaso)}</span></div></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Servidor Público</span><span class="detail-value">${escHtml(r.nombreCompleto)} (${escHtml(r.tipoIdentificacion)}: ${escHtml(r.documento)})</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Dependencia & Sede</span><span class="detail-value">${escHtml(r.dependencia)} · ${escHtml(r.sedeTrabajo || 'CASA DE LA TORRE')}</span></div>
            <div class="detail-item"><span class="detail-label">Tipo de EMO</span><span class="detail-value">${escHtml(r.tipoEmo)}</span></div>
            <div class="detail-item"><span class="detail-label">Fecha Realización EMO</span><span class="detail-value">${formatDate(r.fechaEmo)}</span></div>
            <div class="detail-item"><span class="detail-label">Próximo EMO Programado</span><span class="detail-value">${formatDate(r.fechaProximoEmo)}</span></div>
            <div class="detail-item"><span class="detail-label">Programa Vigilancia (PVE)</span><span class="detail-value">${escHtml(r.direccionadoPve || 'No aplica')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Restricciones Laborales</span><span class="detail-value">${escHtml(r.restricciones || 'NINGUNA')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Recomendaciones Médicas</span><span class="detail-value">${escHtml(r.recomendaciones || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Accidente de Trabajo</span><span class="detail-value">${escHtml(r.accidenteTrabajo)} ${r.estadoActualAccidente ? `— ${escHtml(r.estadoActualAccidente)}` : ''}</span></div>
            <div class="detail-item"><span class="detail-label">Enfermedad Laboral / Rehab.</span><span class="detail-value">EL: ${escHtml(r.enfermedadLaboral)} · Rehab: ${escHtml(r.cumplioRehabilitacion)}</span></div>
            ${r.actividadesPendientes ? `<div class="detail-item detail-grid--full"><span class="detail-label">Actividades Pendientes SST</span><span class="detail-value">${escHtml(r.actividadesPendientes)}</span></div>` : ''}
          </div>
        </div>`;
    } else if (state.tab === 'epp') {
      html = `
        <div class="detail-modal-card">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Radicado E-DO-ST-F-028</span><span class="detail-value">${escHtml(r.radicado)}</span></div>
            <div class="detail-item"><span class="detail-label">Estado Entrega</span><div class="detail-badge-wrap"><span class="badge ${badgeClass(r.estadoEntrega)}">${escHtml(r.estadoEntrega)}</span></div></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Servidor Público</span><span class="detail-value">${escHtml(r.nombreCompleto)} (C.C. ${escHtml(r.documento)})</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Dependencia & Cargo</span><span class="detail-value">${escHtml(r.dependencia)} · ${escHtml(r.cargo || '')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Elemento de Protección Personal Entregado</span><span class="detail-value">${escHtml(r.elementoEpp)}</span></div>
            <div class="detail-item"><span class="detail-label">Talla</span><span class="detail-value">${escHtml(r.talla || 'N/A')}</span></div>
            <div class="detail-item"><span class="detail-label">Cantidad</span><span class="detail-value">${escHtml(r.cantidad)}</span></div>
            <div class="detail-item"><span class="detail-label">Fecha de Entrega</span><span class="detail-value">${formatDate(r.fechaEntrega)}</span></div>
            <div class="detail-item"><span class="detail-label">Tipo de Vinculación</span><span class="detail-value">${escHtml(r.tipoVinculacion || '—')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Restricciones y/o Recomendaciones</span><span class="detail-value">${escHtml(r.restriccionesRecomendaciones || 'NINGUNA')}</span></div>
            ${r.observaciones ? `<div class="detail-item detail-grid--full"><span class="detail-label">Observaciones</span><span class="detail-value">${escHtml(r.observaciones)}</span></div>` : ''}
          </div>
        </div>`;
    } else {
      html = `
        <div class="detail-modal-card">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Código E-DO-ST-F-011</span><span class="detail-value">${escHtml(r.radicado)}</span></div>
            <div class="detail-item"><span class="detail-label">Sexo & Edad</span><span class="detail-value">${escHtml(r.sexo)} · ${r.edad ? `${r.edad} años` : '—'}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Servidor Público</span><span class="detail-value">${escHtml(r.nombreCompleto)} (C.C. ${escHtml(r.documento)})</span></div>
            <div class="detail-item"><span class="detail-label">Estado Civil & Etnia</span><span class="detail-value">${escHtml(r.estadoCivil)} · ${escHtml(r.razaEtnia)}</span></div>
            <div class="detail-item"><span class="detail-label">Vivienda & Estrato</span><span class="detail-value">${escHtml(r.tipoVivienda)} (Estrato ${escHtml(r.estrato)})</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Composición Familiar</span><span class="detail-value">${escHtml(r.composicionFamiliar || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Escolaridad</span><span class="detail-value">${escHtml(r.escolaridad)}</span></div>
            <div class="detail-item"><span class="detail-label">Profesión / Ocupación</span><span class="detail-value">${escHtml(r.ocupacionProfesion || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Vinculación & Cargo</span><span class="detail-value">${escHtml(r.tipoVinculacion)} (${escHtml(r.tipoCargo)})</span></div>
            <div class="detail-item"><span class="detail-label">Rango Salarial</span><span class="detail-value">${escHtml(r.rangoIngresos)}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Dependencia & Sede</span><span class="detail-value">${escHtml(r.dependencia)} · ${escHtml(r.sedeTrabajo)}</span></div>
          </div>
        </div>`;
    }

    const actions = [{ text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }];
    if (Auth.canEdit()) {
      actions.push({
        text: 'Editar Registro',
        cls: 'btn-gold',
        action: () => { App.closeModal(); openEdit(id); }
      });
    }
    App.openModal(`Detalle SST · ${r.radicado}`, html, actions);
  }

  function confirmDelete(id, nombre) {
    App.openModal('Confirmar Eliminación SST', `<p style="color:var(--text-secondary)">¿Deseas eliminar el registro de <strong style="color:var(--text-primary)">${escHtml(nombre)}</strong>?</p>`, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      {
        text: 'Eliminar',
        cls: 'btn-danger',
        action: async () => {
          try {
            if (state.tab === 'epidemiologico') await API.deleteSstEpidemiologico(id);
            else if (state.tab === 'epp') await API.deleteSstEpp(id);
            else await API.deleteSstSociodemografico(id);
            App.closeModal();
            App.showToast('Registro SST eliminado.', 'success');
            loadStats();
            await load();
          } catch (err) {
            App.showToast(err.message, 'error');
          }
        }
      }
    ]);
  }

  async function checkEmoVencimientos() {
    try {
      const res = await API.checkSstEmoVencimientos();
      App.showToast(res.message || 'Vencimientos de EMO verificados.', 'info');
      loadStats();
      await load();
    } catch (err) {
      App.showToast('Error al verificar vencimientos: ' + err.message, 'error');
    }
  }

  function applyFilters() {
    state.page = 1;
    state.filters = {
      q: document.getElementById('sst-q')?.value.trim() || '',
      subFilter1: document.getElementById('sst-filter-1')?.value || 'Todos',
      subFilter2: document.getElementById('sst-filter-2')?.value || 'Todos'
    };
    load();
  }

  function clearFilters() {
    const qEl = document.getElementById('sst-q');
    if (qEl) qEl.value = '';
    state.filters = { q: '', subFilter1: state.tab === 'sociodemografico' ? 'Todas' : 'Todos', subFilter2: 'Todos' };
    const f1 = document.getElementById('sst-filter-1');
    const f2 = document.getElementById('sst-filter-2');
    if (f1) f1.selectedIndex = 0;
    if (f2) f2.selectedIndex = 0;
    state.page = 1;
    load();
  }

  function goPage(p) {
    if (p < 1 || p > state.totalPages) return;
    state.page = p;
    load();
  }

  // ─── Generación de Formato Oficial PDF (jsPDF) ──────────────────────────────
  function exportSinglePdf(id) {
    const r = state.data.find(x => x.id === id);
    if (!r || !window.jspdf) {
      App.showToast('Motor PDF no disponible.', 'warning');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const tabCfg = TABS[state.tab];

    doc.setFillColor(40, 117, 34);
    doc.rect(0, 0, 210, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.text('GOBERNACIÓN DE BOYACÁ — SECRETARÍA GENERAL', 14, 11);
    doc.setFontSize(10);
    doc.text(`SUBDIRECCIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO · FORMATO ${tabCfg.code}`, 14, 19);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.text(`${tabCfg.title.toUpperCase()} (${r.radicado})`, 14, 36);

    const rows = state.tab === 'epp'
      ? [
          ['Servidor Público', r.nombreCompleto],
          ['Documento de Identidad', r.documento],
          ['Dependencia', r.dependencia],
          ['Cargo / Vinculación', `${r.cargo || ''} — ${r.tipoVinculacion || ''}`],
          ['Elemento EPP Entregado', r.elementoEpp],
          ['Talla y Cantidad', `Talla: ${r.talla || 'N/A'} | Cantidad: ${r.cantidad}`],
          ['Fecha de Entrega', formatDate(r.fechaEntrega)],
          ['Restricciones / Recomendaciones', r.restriccionesRecomendaciones || 'NINGUNA'],
          ['Estado / Firma', `${r.estadoEntrega} (Firmado por funcionario)`],
          ['Observaciones', r.observaciones || 'Cumplimiento Instructivo E-DO-ST-I-007']
        ]
      : [
          ['Servidor Público', r.nombreCompleto],
          ['Identificación', `${r.tipoIdentificacion}: ${r.documento}`],
          ['Dependencia y Sede', `${r.dependencia} (${r.sedeTrabajo || ''})`],
          ['Tipo y Fecha de EMO', `${r.tipoEmo} — ${formatDate(r.fechaEmo)}`],
          ['Próximo EMO Programado', formatDate(r.fechaProximoEmo)],
          ['Restricciones Médicas', r.restricciones || 'NINGUNA'],
          ['Recomendaciones Ocupacionales', r.recomendaciones || '—'],
          ['Programa de Vigilancia (PVE)', r.direccionadoPve || 'No aplica'],
          ['Accidente / Enfermedad Laboral', `AT: ${r.accidenteTrabajo} | EL: ${r.enfermedadLaboral}`],
          ['Estado Final del Caso', r.estadoFinalCaso]
        ];

    if (doc.autoTable) {
      doc.autoTable({
        startY: 42,
        head: [['Campo Oficial SST', 'Información Registrada']],
        body: rows,
        headStyles: { fillColor: [40, 117, 34] },
        styles: { fontSize: 9.5, cellPadding: 3.5 }
      });
    }

    doc.save(`${r.radicado}_${r.documento}.pdf`);
    App.showToast(`Formato oficial ${tabCfg.code} descargado en PDF.`, 'success');
  }

  // ─── Exportación e Importación Masiva Excel por Submódulo ───────────────────
  function getExcelColumns() {
    if (state.tab === 'epidemiologico') {
      return [
        { header: 'Código', key: 'radicado', width: 16 },
        { header: 'Tipo Identificación', key: 'tipoIdentificacion', width: 22 },
        { header: 'Documento', key: 'documento', width: 16 },
        { header: 'Servidor Público', key: 'nombreCompleto', width: 32 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Edad', key: 'edad', width: 10 },
        { header: 'Dependencia', key: 'dependencia', width: 36 },
        { header: 'Sede de Trabajo', key: 'sedeTrabajo', width: 28 },
        { header: 'Fecha EMO', key: 'fechaEmo', width: 15 },
        { header: 'Tipo de EMO', key: 'tipoEmo', width: 18 },
        { header: 'Restricciones', key: 'restricciones', width: 30 },
        { header: 'Recomendaciones', key: 'recomendaciones', width: 30 },
        { header: 'Direccionado PVE', key: 'direccionadoPve', width: 26 },
        { header: 'Próximo EMO', key: 'fechaProximoEmo', width: 15 },
        { header: 'Accidente Trabajo', key: 'accidenteTrabajo', width: 16 },
        { header: 'Enfermedad Laboral', key: 'enfermedadLaboral', width: 16 },
        { header: 'Estado Final Caso', key: 'estadoFinalCaso', width: 18 }
      ];
    }
    if (state.tab === 'epp') {
      return [
        { header: 'Radicado', key: 'radicado', width: 16 },
        { header: 'Documento', key: 'documento', width: 16 },
        { header: 'Servidor Público', key: 'nombreCompleto', width: 32 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Dependencia', key: 'dependencia', width: 35 },
        { header: 'Cargo', key: 'cargo', width: 25 },
        { header: 'Tipo Vinculación', key: 'tipoVinculacion', width: 22 },
        { header: 'Elemento EPP', key: 'elementoEpp', width: 30 },
        { header: 'Talla', key: 'talla', width: 10 },
        { header: 'Cantidad', key: 'cantidad', width: 14 },
        { header: 'Fecha Entrega', key: 'fechaEntrega', width: 16 },
        { header: 'Estado Entrega', key: 'estadoEntrega', width: 18 },
        { header: 'Observaciones', key: 'observaciones', width: 30 }
      ];
    }
    return [
      { header: 'Código', key: 'radicado', width: 16 },
      { header: 'Tipo Identificación', key: 'tipoIdentificacion', width: 20 },
      { header: 'Documento', key: 'documento', width: 16 },
      { header: 'Servidor Público', key: 'nombreCompleto', width: 32 },
      { header: 'Sexo', key: 'sexo', width: 12 },
      { header: 'Año Nacimiento', key: 'anioNacimiento', width: 15 },
      { header: 'Edad', key: 'edad', width: 10 },
      { header: 'Raza / Etnia', key: 'razaEtnia', width: 18 },
      { header: 'Estado Civil', key: 'estadoCivil', width: 16 },
      { header: 'Tipo Vivienda', key: 'tipoVivienda', width: 15 },
      { header: 'Estrato', key: 'estrato', width: 10 },
      { header: 'Escolaridad', key: 'escolaridad', width: 18 },
      { header: 'Ocupación / Profesión', key: 'ocupacionProfesion', width: 25 },
      { header: 'Rango Ingresos', key: 'rangoIngresos', width: 20 },
      { header: 'Tipo Vinculación', key: 'tipoVinculacion', width: 22 },
      { header: 'Dependencia', key: 'dependencia', width: 35 },
      { header: 'Sede de Trabajo', key: 'sedeTrabajo', width: 28 }
    ];
  }

  async function exportExcel() {
    try {
      const tabCfg = TABS[state.tab];
      ExcelService.exportToExcel({
        filename: `Talento360_SST_${state.tab}_${tabCfg.code.replace(/\s+/g, '_')}`,
        sheetName: tabCfg.title.substring(0, 30),
        columns: getExcelColumns(),
        data: state.data
      });
      App.showToast(`Exportados ${state.data.length} registros de ${tabCfg.title}.`, 'success');
    } catch (err) {
      App.showToast('Error al exportar Excel: ' + err.message, 'error');
    }
  }

  function openImportModal() {
    const tabCfg = TABS[state.tab];
    const cols = getExcelColumns().filter(c => c.key !== 'radicado');

    ExcelService.openImportModal({
      title: `Carga Masiva SST — ${tabCfg.title} (${tabCfg.code})`,
      subtitle: `Importe registros desde formato oficial Excel (${tabCfg.code}) o respuestas de Microsoft Forms`,
      moduleName: tabCfg.title.toLowerCase(),
      columns: cols,
      sampleRows: [
        {
          'Documento': '1003481573',
          'Servidor Público': 'ROMERO MARIN IVAN DARIO',
          'Dependencia': 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo'
        }
      ],
      validateRow: (row) => {
        const documento = String(row['Documento'] || row['NÚMERO DOCUMENTO DE IDENTIFICACIÓN'] || row['Cédula'] || row.documento || '').trim();
        const nombreCompleto = String(
          row['Servidor Público'] ||
          row['Nombres y apellidos'] ||
          row.nombreCompleto ||
          `${row['APELLIDOS'] || ''} ${row['NOMBRES'] || ''}`.trim()
        ).trim();

        if (!documento || !nombreCompleto) {
          return { valid: false, error: 'Documento y nombre del servidor son obligatorios.' };
        }
        return {
          valid: true,
          cleanRow: {
            ...row,
            documento,
            nombreCompleto,
            dependencia: String(row['Dependencia'] || row['DEPENDENCIA DE LA ENTIDAD DONDE TRABAJA'] || 'SGEN - SECRETARIA GENERAL (Despacho)').trim(),
            sedeTrabajo: String(row['Sede de Trabajo'] || row['SEDE DE TRABAJO'] || 'CASA DE LA TORRE').trim(),
            tipoEmo: String(row['Tipo de EMO'] || row['TIPO DE EMO'] || 'Periódico').trim(),
            elementoEpp: String(row['Elemento EPP'] || row['Elemento '] || 'A. Casco de seguridad').trim(),
            escolaridad: String(row['Escolaridad'] || row['ESCOLARIDAD'] || 'Profesional').trim()
          }
        };
      },
      onImport: async (rows) => {
        let res;
        if (state.tab === 'epidemiologico') res = await API.bulkCreateSstEpidemiologico(rows);
        else if (state.tab === 'epp') res = await API.bulkCreateSstEpp(rows);
        else res = await API.bulkCreateSstSociodemografico(rows);

        App.showToast(res.message || 'Carga masiva SST completada.', 'success');
        loadStats();
        await load();
      }
    });
  }

  return {
    render,
    setTab,
    openCreate,
    openEdit,
    openView,
    confirmDelete,
    checkEmoVencimientos,
    applyFilters,
    clearFilters,
    goPage,
    onEmployeeInput,
    selectEmployee,
    exportSinglePdf,
    exportExcel,
    openImportModal,
    toggleActionsDropdown,
    closeActionsDropdown,
    handleDropdownKeydown
  };
})();
