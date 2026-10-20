/* ═══════════════════════════════════════════════════════════════════════════
   incapacidades.js — Módulo Independiente de Incapacidades y Ausentismo Laboral
   Formato Oficial Gobernación de Boyacá: 9. INCAPACIDADES SST (E-DO-ST-F-002 V2)
   ═══════════════════════════════════════════════════════════════════════════ */

const IncapacidadesModule = (() => {
  const ESTADOS = ['Todos', 'Pendiente', 'En revisión', 'Aprobada', 'Finalizada', 'Rechazada'];

  let state = {
    data: [],
    total: 0,
    page: 1,
    totalPages: 1,
    filters: { q: '', estado: 'Todos', causaMotivo: 'Todas', eps: 'Todas' },
    stats: null,
  };

  let catalogsCache = null;
  let currentSoportes = [];
  let existingSoportes = [];
  let searchDebounceTimer = null;
  let discountManuallyEdited = false;

  // Catálogos oficiales exactos de la Hoja 2 de «9. INCAPACIDADES SST - SEPTIEMBRE 2026.xlsx»
  const FALLBACK_CATALOGS = {
    dependencias: [
      'DES - Despacho del gobernador',
      'DES - Oficina Asesora de Control Interno de Gestión',
      'DES - Oficina Asesora de Control Interno Disciplinario',
      'DES - Unidad Administrativa de Comunicaciones y Protocolo',
      'DES - UCOM - Subdirección de Radio y Televisión',
      'DES - Unidad Administrativa de Relaciones Nacionales Internacionales',
      'DES - Unidad Administrativa Especial de Asesoría y Defensa Jurídica del Departamento',
      'DES - Unidad Administrativa para la Gestión del Riesgo y del Desastre',
      'SAGR - SECRETARIA DE AGRICULTURA (Despacho)',
      'SAGR - Dirección de Desarrollo Rural Integral',
      'SAGR - Dirección de Productividad Agropecuaria',
      'SAGR - Dirección de Bienestar Campesino',
      'SAMB - SECRETARIA DE AMBIENTE Y DESARROLLO SOSTENIBLE (Despacho)',
      'SAMB - Dirección de Gestión del Recurso Hídrico y Saneamiento Básico',
      'SCON - SECRETARIA DE CONTRATACION (Despacho)',
      'SCON - Dirección Administrativa Contractual',
      'SCON - Dirección de Procesos de Selección',
      'SCUP - SECRETARIA DE CULTURA Y PATRIMONIO (Despacho)',
      'SDEM - SECRETARIA DE DESARROLLO EMPRESARIAL (Despacho)',
      'SDEM - Dirección de Desarrollo Empresarial',
      'SDEM - Dirección de Inversión y Comercio',
      'SEDU - SECRETARIA DE EDUCACIÓN (Despacho)',
      '*SEDU - INSTITUCIÓN EDUCATIVA DEL DEPARTAMENTO',
      'SEDU - Oficina Asesora para la Gestión Estratégica del Sector Educación',
      'SEDU - Oficina Asesora y Defensa Jurídica del Sector Educación',
      'SEDU - Dirección Técnico Pedagógica',
      'SEDU - DTP - Programa de Adultos y Jóvenes en Extra Edad',
      'SEDU - DTP - Programa del Plan Alimentario Escolar',
      'SEDU - DTP - Subdirección de Calidad Educativa',
      'SEDU - DTP - Subdirección de Cobertura y Ruralidad',
      'SEDU - DTP - Subdirección de Inspección de Vigilancia',
      'SEDU - DTP - Subdirección de Núcleos Educativos',
      'SEDU - Dirección Administrativa Financiera',
      'SEDU - DAF - Subdirección de Talento Humano',
      'SGEN - SECRETARIA GENERAL (Despacho)',
      'SGEN - Dirección General de Talento Humano',
      'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo',
      'SGEN - Dirección de Servicios Administrativos y Logísticos',
      'SGEN - DSA - Subdirección de Atención al Ciudadano',
      'SGEN - DSA - Subdirección de Gestión Documental',
      'SGOB - SECRETARIA DE GOBIERNO Y ACCIÓN COMUNAL (Despacho)',
      'SGOB - Dirección de Dialogo Social y Convivencia',
      'SGOB - Dirección de Participación y Acción Comunal',
      'SGOB -Dirección de Juventud',
      'SHAC - SECRETARIA DE HACIENDA (Despacho)',
      'SHAC - Dirección Financiera Y Fiscal',
      'SHAC - DFF - Subdirección de Cobro Coactivo',
      'SHAC - DFF - Subdirección Central de Cuentas',
      'SHAC - DFF - Subdirección de Contabilidad',
      'SHAC - DFF - Subdirección de Presupuesto',
      'SHAC - Dirección Departamental de Pasivos Pensionales',
      'SHAC - DPP - Subdirección Administrativa de Pasivos Pensionales',
      'SHAC - DPP - Subdirección Jurídica de Pasivos Pensionales',
      'SHAC - Dirección de Recaudo y Fiscalización',
      'SHAC - Tesorería General',
      'SINF - SECRETARIA DE INFRAESTRUCTURA PUBLICA (Despacho)',
      'SINF - Dirección de Desarrollo de la Infraestructura Vial',
      'SINF - Dirección de Vivienda Edificaciones y Obra Publica',
      'SINF - Dirección Técnica de Estudios y Diseños',
      'SINS - SECRETARIA DE INTEGRACIÓN SOCIAL (Despacho)',
      'SINS - Dirección de Familia, Infancia, Adolescencia y Adulto Mayor',
      'SINS - Dirección de la Mujer e Inclusión Social',
      'SMIN - SECRETARIA DE MINAS Y ENERGIA (Despacho)',
      'SPLA - SECRETARIA DE PLANEACIÓN (Despacho)',
      'SPLA - Dirección de Inversión Publica del Departamento',
      'SPLA - Dirección de Seguimiento y Planeación Territorial',
      'SPLA - Dirección Geográfica y de Gestión Territorial',
      'SPLA - Oficina Asesora de Planeación y Métodos de Gestión',
      'SSAL - SECRETARIA DE SALUD (Despacho)',
      'SSAL - Dirección de Aseguramiento en Salud',
      'SSAL - Dirección de Prestación de Servicios de Salud',
      'SSAL - Dirección de Promoción y Prevención en Salud',
      'SSAL - DPP - Subdirección de Promoción Social en Salud',
      'SSAL - Oficina Asesora de Defensa Jurídica del Sector Salud',
      'SSAL - Oficina Asesora para la Gestión Estratégica del Sector Salud',
      'STIC - SECRETARIA DE TIC Y GOBIERNO ABIERTO (Despacho)',
      'STIC - Dirección de Apropiación de TIC',
      'STIC - Dirección de Sistemas de Información',
      'STUR - SECRETARIA DE TURISMO (Despacho)',
    ],
    sedes: [
      'ARCHIVO GENERAL DEL DEPARTAMENTO - Centro.',
      'ARCHIVO GENERAL DEL DEPARTAMENTO - Topo.',
      'AUDITORIO JOSE MOSSER Y OFICINAS.',
      'BIBLIOTECA DEPARTAMENTAL "EDUARDO TORRES QUINTERO"ARCHIVO COBRO COACTIVO.',
      'BIBLIOTECA PEDRO PASCACIO MARTÍNEZ. (CASA JUAN DE CASTELLANOS)',
      'BODEGA TALLERES DE OBRAS PÚBLICAS DEL DEPARTAMENTO DE BOYACÁ.',
      'BODEGA VECTORES',
      'CASA DE BOYACÁ EN BOGOTÁ.',
      'CASA DE LA TORRE',
      'CASA PRIVADA DEL SEÑOR GOBERNADOR.',
      'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 203 B INTERIOR.',
      'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 209 B INTERIOR',
      'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 206 B INTERIOR.',
      'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 207 B INTERIOR.',
      'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 208 B INTERIOR',
      'EDIFICIO CENTRO EXPERIMENTAL PILOTO - CEP.',
      'EDIFICIO LOTERÍA DE BOYACÁ',
      'EDIFICIO LOTERÍA DE BOYACÁ PISO 4',
      'EDIFICIO LOTERÍA DE BOYACÁ - PISO 8° OFICINA 805',
      'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1002',
      'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1003',
      'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1004',
      'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1006',
      'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1007',
      'EDIFICIO LOTERÍA DE BOYACÁ - PISO 11°',
      'ESCUELA DE ARTES.',
      'FONDO TERRITORIAL DE PENSIONES DE BOYACÁ.',
      'JARDÍN BOTÁNICO.',
      'LABORATORIO DEPARTAMENTAL DE SALUD PÚBLICA.',
      'MONUMENTO HISTÓRICO DEL PUENTE DE BOYACÁ.',
      'OFICINAS DEL CDGRD.',
      'PALACIO DE SERVICIOS CULTURALES',
      'PARQUEADERO DEL DEPARTAMENTO.',
      'SECRETARIA DE EDUCACION DE BOYACÁ.',
      'SECRETARÍA DE SALUD DE BOYACÁ - CRISDI',
      'SECRETARÍA DE SALUD DEL DEPARTAMENTO DE BOYACÁ.',
      'VIVE DIGITAL Y VIVE LAB.',
      'EDIFICIO INTELIGENTE - BICENTENARIO',
    ],
    causasMotivos: [
      'Enfermedad general',
      'Enfermedad laboral',
      'Accidente de trabajo',
      'Licencia de maternidad',
      'Licencia de maternidad parto múltiple',
      'Licencia de maternidad nacimiento prematuro',
      'Licencia de maternidad hijos con discapacidad',
      'Licencia de paternidad',
      'Licencia de calamidad',
      'Licencia de luto',
      'Permiso de estudio',
      'Suspensiónes',
      'Permiso por horas día',
      'Ausencias no remuneradas',
      'Otros permisos remunerados',
    ],
    epsList: [
      'SANITAS',
      'NUEVA EPS',
      'SURA',
      'SALUD TOTAL',
      'FAMISANAR',
      'COMPENSAR',
      'COOSALUD',
      'CAJACOPI',
      'POSITIVA',
      'ADRES',
      'ALIANSALUD',
      'CAPITAL SALUD',
      'ASMET SALUD',
      'MEDIMÁS',
      'OTRA',
    ],
    prorrogaOpts: ['NO', 'SI'],
    soportes: { maxArchivos: 5, maxBytesPorArchivo: 5 * 1024 * 1024 },
  };

  function normalizeCatalogs(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
      dependencias: Array.isArray(r.dependencias) && r.dependencias.length ? r.dependencias : FALLBACK_CATALOGS.dependencias,
      sedes: Array.isArray(r.sedes) && r.sedes.length ? r.sedes : FALLBACK_CATALOGS.sedes,
      causasMotivos: Array.isArray(r.causasMotivos) && r.causasMotivos.length
        ? r.causasMotivos
        : (Array.isArray(r.causas) && r.causas.length ? r.causas : FALLBACK_CATALOGS.causasMotivos),
      epsList: Array.isArray(r.epsList) && r.epsList.length ? r.epsList : FALLBACK_CATALOGS.epsList,
      prorrogaOpts: Array.isArray(r.prorrogaOpts) && r.prorrogaOpts.length
        ? r.prorrogaOpts
        : (Array.isArray(r.prorrogas) && r.prorrogas.length ? r.prorrogas : FALLBACK_CATALOGS.prorrogaOpts),
      soportes: r.soportes || FALLBACK_CATALOGS.soportes,
    };
  }

  async function ensureCatalogs() {
    if (catalogsCache) return catalogsCache;
    try {
      const res = typeof API.getIncapacidadesCatalogs === 'function'
        ? await API.getIncapacidadesCatalogs()
        : FALLBACK_CATALOGS;
      catalogsCache = normalizeCatalogs(res);
    } catch {
      catalogsCache = normalizeCatalogs(FALLBACK_CATALOGS);
    }
    return catalogsCache;
  }

  function badgeClass(estado) {
    const e = (estado || '').toLowerCase();
    if (e.includes('aprobad'))  return 'badge--aprobada';
    if (e.includes('finaliz'))  return 'badge--finalizada';
    if (e.includes('rechazad')) return 'badge--rechazada';
    if (e.includes('revis'))    return 'badge--revision';
    return 'badge--pendiente';
  }

  function formatCOP(n) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n) || 0);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function cleanName(str) {
    return String(str || '').replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
  }

  function dmyToISO(str) {
    if (!str) return '';
    const s = String(str).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return '';
  }

  function isoToDMY(iso) {
    if (!iso) return '';
    const s = String(iso).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return s;
  }

  function calcDaysInclusive(isoStart, isoEnd) {
    if (!isoStart || !isoEnd) return 1;
    const [y1, m1, d1] = isoStart.split('-').map(Number);
    const [y2, m2, d2] = isoEnd.split('-').map(Number);
    const dt1 = Date.UTC(y1, m1 - 1, d1);
    const dt2 = Date.UTC(y2, m2 - 1, d2);
    if (isNaN(dt1) || isNaN(dt2) || dt2 < dt1) return 1;
    return Math.round((dt2 - dt1) / 86400000) + 1;
  }

  // Fórmula oficial del Excel 9. INCAPACIDADES SST
  function calcularDescuentoSST({ salario, dias, prorroga, causaMotivo }) {
    const sal = parseFloat(salario) || 0;
    const d = parseInt(dias, 10) || 0;
    if (sal <= 0 || d <= 0) return 0;

    const causa = String(causaMotivo || '').toLowerCase();
    const esProrroga = String(prorroga || 'NO').toUpperCase() === 'SI';
    const valorDia = sal / 30;

    if (
      causa.includes('maternidad') ||
      causa.includes('paternidad') ||
      causa.includes('accidente') ||
      causa.includes('laboral')
    ) {
      return Math.round(valorDia * d);
    }

    if (causa.includes('no remunerada') || causa.includes('suspensi')) {
      return Math.round(valorDia * d);
    }

    if (causa.includes('luto') || causa.includes('calamidad') || causa.includes('estudio') || causa.includes('permiso')) {
      return 0;
    }

    // Enfermedad general
    if (esProrroga) {
      return Math.round((valorDia * d) / 3);
    }
    if (d <= 2) return 0;
    return Math.round((valorDia * (d - 2)) / 3);
  }

  function normalizeRow(r) {
    const nombre = r.apellidosNombres || r.persona || r.apellidos_nombres || '';
    return {
      ...r,
      apellidosNombres: nombre,
      persona: nombre,
      fechaRadicacion: r.fechaRadicacion || r.fecha_radicacion || r.fechaSolicitud || r.fecha_solicitud || '',
      sede: r.sede || 'EDIFICIO LOTERÍA DE BOYACÁ',
      eps: r.eps || 'SANITAS',
      prorroga: r.prorroga || 'NO',
      causaMotivo: r.causaMotivo || r.causa_motivo || 'Enfermedad general',
      codigoCie10: r.codigoCie10 || r.codigo_cie10 || '',
      diasSolicitados: r.diasSolicitados || r.dias || r.dias_solicitados || 1,
      salario: Number(r.salario) || 0,
      descuento: Number(r.descuento) || 0,
      actoAdministrativo: r.actoAdministrativo || r.acto_administrativo || '',
    };
  }

  function renderSkeletonRows(count = 6) {
    return Array.from({ length: count }).map((_, i) => `
      <tr class="skeleton-row" aria-hidden="true" style="animation-delay: ${i * 0.08}s">
        <td><div class="skeleton skeleton-line" style="width: 90px; height: 16px; border-radius: 4px;"></div></td>
        <td>
          <div class="skeleton-user-cell">
            <div class="skeleton skeleton-avatar" aria-hidden="true"></div>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-line skeleton-line--title" style="width: ${i % 2 === 0 ? '80%' : '65%'}; height: 14px;"></div>
              <div class="skeleton skeleton-line" style="width: 45%; height: 11px;"></div>
            </div>
          </div>
        </td>
        <td><div class="skeleton skeleton-line" style="width: 80%; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-badge" style="width: 80px; height: 22px;"></div></td>
        <td><div class="skeleton skeleton-line" style="width: 85%; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-line" style="width: 80px; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-badge" style="width: 45px; height: 22px;"></div></td>
        <td><div class="skeleton skeleton-line" style="width: 35px; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-line" style="width: 90px; height: 13px;"></div></td>
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

  // ─── Render Principal del Módulo ────────────────────────────────────────────
  async function render(container) {
    const cat = await ensureCatalogs();

    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <h1 class="page-heading">Incapacidades y Ausentismo Laboral</h1>
            <p class="page-desc">Gestione el registro, seguimiento y liquidación de incapacidades médicas y ausentismo laboral · Gobernación de Boyacá</p>
          </div>
          <div class="page-actions" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <!-- Dropdown Acciones Secundarias -->
            <div class="actions-dropdown-wrap">
              <button
                type="button"
                class="btn btn-secondary actions-dropdown-btn"
                id="inc-dropdown-toggle"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="inc-dropdown-menu"
                onclick="IncapacidadesModule.toggleActionsDropdown(event)"
                onkeydown="IncapacidadesModule.handleDropdownKeydown(event)"
                title="Opciones de exportación e importación Excel"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                <span>Acciones</span>
                <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div
                class="actions-dropdown-menu"
                id="inc-dropdown-menu"
                role="menu"
                aria-labelledby="inc-dropdown-toggle"
                hidden
              >
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="IncapacidadesModule.closeActionsDropdown(); IncapacidadesModule.exportExcel();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <div>
                    <strong>Exportar Incapacidades a Excel</strong>
                    <small>Descarga el listado de incapacidades en formato .xlsx</small>
                  </div>
                </button>
                ${Auth.canEdit() ? `
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="IncapacidadesModule.closeActionsDropdown(); IncapacidadesModule.openImportModal();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <div>
                    <strong>Carga Masiva Excel</strong>
                    <small>Importar registros desde la matriz de ausentismo laboral</small>
                  </div>
                </button>` : ''}
              </div>
            </div>

            <button class="btn btn-primary btn-primary-cta" onclick="IncapacidadesModule.openCreate()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Nueva Incapacidad</span>
            </button>
          </div>
        </div>

        <!-- Tarjetas de Resumen / KPIs -->
        <div class="stats-row" id="inc-stats-row" style="margin-bottom:18px;"></div>

        <!-- Filtros -->
        <div class="filters-card">
          <div class="filters-row">
            <div class="filter-group" style="flex:2">
              <label class="filter-label">Buscar</label>
              <input id="inc-q" class="filter-input" placeholder="Nombre, cédula, CIE-10, dependencia, sede, radicado..." value="${escHtml(state.filters.q || '')}" />
            </div>
            <div class="filter-group">
              <label class="filter-label">Causa o Motivo</label>
              <select id="inc-causa" class="filter-select">
                <option value="Todas">Todas las causas</option>
                ${(cat.causasMotivos || []).map(c => `<option value="${escHtml(c)}" ${state.filters.causaMotivo === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">EPS / ARL</label>
              <select id="inc-eps" class="filter-select">
                <option value="Todas">Todas las EPS</option>
                ${(cat.epsList || []).map(e => `<option value="${escHtml(e)}" ${state.filters.eps === e ? 'selected' : ''}>${escHtml(e)}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">Estado</label>
              <select id="inc-estado" class="filter-select">
                ${ESTADOS.map(s => `<option value="${s}" ${state.filters.estado === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-primary" onclick="IncapacidadesModule.applyFilters()">Filtrar</button>
            <button class="btn btn-secondary" onclick="IncapacidadesModule.clearFilters()">Limpiar</button>
          </div>
        </div>

        <!-- Tabla Formato 9. INCAPACIDADES SST -->
        <div class="table-card">
          <div class="table-header">
            <span class="table-title">Matriz de Ausentismo Laboral · Incapacidades SST</span>
            <span class="table-count" id="inc-count"><span class="skeleton" style="width:110px;height:14px;border-radius:4px;display:inline-block;" aria-hidden="true"></span></span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Radicado / Fecha</th>
                  <th>Servidor Público</th>
                  <th>Dependencia / Sede</th>
                  <th>EPS</th>
                  <th>Causa o Motivo / CIE-10</th>
                  <th>Periodo</th>
                  <th>Prórroga</th>
                  <th>Días</th>
                  <th>Salario / Descuento</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="inc-tbody" role="progressbar" aria-busy="true" aria-label="Cargando incapacidades...">
                ${renderSkeletonRows(6)}
              </tbody>
            </table>
          </div>
          <div class="pagination" id="inc-pagination"></div>
        </div>
      </div>
    `;

    document.getElementById('inc-q')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') applyFilters();
    });
    bindDropdownOutsideClick();

    state.page = 1;
    await Promise.all([loadStats(), load()]);
  }

  function renderStatsCards(s = {}) {
    const row = document.getElementById('inc-stats-row');
    if (!row) return;
    row.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(40,117,34,0.12);color:#287522;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${(s.total || 0).toLocaleString('es-CO')}</span>
          <span class="stat-label">Total Incapacidades (${s.prorrogas || 0} prórrogas)</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(59,130,246,0.12);color:#2563eb;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${(s.totalDias || 0).toLocaleString('es-CO')}</span>
          <span class="stat-label">Días Totales de Ausentismo</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(217,119,6,0.12);color:#d97706;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${(s.pendientes || 0).toLocaleString('es-CO')}</span>
          <span class="stat-label">Por Gestionar / En Revisión</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(16,185,129,0.12);color:#059669;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value" style="font-size:1.15rem;">${formatCOP(s.totalDescuento || 0)}</span>
          <span class="stat-label">Total Descuento Calculado SST</span>
        </div>
      </div>
    `;
  }

  async function loadStats() {
    try {
      const s = typeof API.getIncapacidadesStats === 'function' ? await API.getIncapacidadesStats() : null;
      if (s && typeof s.total === 'number') {
        state.stats = s;
        renderStatsCards(s);
      }
    } catch {
      /* si falla stats se calcula desde state.data en load() */
    }
  }

  async function load() {
    const tbody = document.getElementById('inc-tbody');
    if (tbody) {
      tbody.setAttribute('aria-busy', 'true');
      tbody.innerHTML = renderSkeletonRows(6);
    }
    try {
      const params = {
        page: state.page,
        limit: 20,
        q: state.filters.q || '',
        estado: state.filters.estado || 'Todos',
        causaMotivo: state.filters.causaMotivo || 'Todas',
        eps: state.filters.eps || 'Todas',
      };
      let res = typeof API.getIncapacidades === 'function' ? await API.getIncapacidades(params) : null;
      // Fallback transparente a /admin-requests?tipo=Incapacidad si el contenedor antiguo aún no recargó /api/incapacidades
      if (!res || !Array.isArray(res.data)) {
        res = await API.getAdminRequests({
          tipo: 'Incapacidad',
          page: state.page,
          limit: 20,
          q: state.filters.q || '',
          estado: state.filters.estado || 'Todos',
        });
      }
      state.data = (res.data || []).map(normalizeRow);
      state.total = res.total || state.data.length;
      state.totalPages = res.totalPages || 1;
      renderTable();
      renderPagination();
      const countEl = document.getElementById('inc-count');
      if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} registros`;

      if (!state.stats || typeof state.stats.total !== 'number') {
        renderStatsCards({
          total: state.total,
          totalDias: state.data.reduce((a, b) => a + (Number(b.diasSolicitados) || 0), 0),
          pendientes: state.data.filter(x => x.estado === 'Pendiente' || x.estado === 'En revisión').length,
          totalDescuento: state.data.reduce((a, b) => a + (Number(b.descuento) || 0), 0),
          prorrogas: state.data.filter(x => x.prorroga === 'SI').length,
        });
      }
    } catch (err) {
      App.showToast('Error al cargar incapacidades: ' + err.message, 'error');
    }
  }

  function renderTable() {
    const tbody = document.getElementById('inc-tbody');
    if (!tbody) return;
    tbody.removeAttribute('role');
    tbody.setAttribute('aria-busy', 'false');

    if (!state.data.length) {
      tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <span class="empty-state-title">No hay registros de incapacidades</span>
        <span class="empty-state-desc">No se encontraron incapacidades con los filtros actuales.</span>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = state.data.map(r => `
      <tr>
        <td>
          <div class="td-radicado">${escHtml(r.radicado)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">Rad: ${escHtml(r.fechaRadicacion || r.fechaSolicitud || '—')}</div>
        </td>
        <td>
          <div class="user-table-cell">
            <span class="td-primary" title="${escHtml(r.apellidosNombres)}">${escHtml(truncate(r.apellidosNombres, 28) || '—')}</span>
            <span class="user-table-cc font-mono">${r.documento ? `C.C. ${escHtml(r.documento)}` : '—'} · ${escHtml(truncate(r.cargo || '', 22))}</span>
          </div>
        </td>
        <td>
          <div style="font-weight:600;font-size:0.82rem;" title="${escHtml(cleanName(r.dependencia))}">${escHtml(truncate(cleanName(r.dependencia), 26) || '—')}</div>
          <div style="font-size:0.73rem;color:var(--text-muted);" title="${escHtml(r.sede || '')}">📍 ${escHtml(truncate(r.sede || '—', 24))}</div>
        </td>
        <td><span class="badge badge--neutral" style="font-weight:600;">${escHtml(r.eps || '—')}</span></td>
        <td>
          <div style="font-weight:600;font-size:0.82rem;">${escHtml(r.causaMotivo || 'Enfermedad general')}</div>
          <div style="font-size:0.73rem;color:var(--text-muted);">
            ${r.codigoCie10 ? `<span class="font-mono" style="font-weight:700;color:var(--color-green-dark,#287522);">CIE-10: ${escHtml(r.codigoCie10)}</span>` : 'Sin CIE-10'}
            ${r.actoAdministrativo ? ` · Acto: ${escHtml(truncate(r.actoAdministrativo, 16))}` : ''}
          </div>
        </td>
        <td style="font-size:0.8rem;white-space:nowrap;">
          <div>${escHtml(r.fechaInicio || '—')}</div>
          <div style="color:var(--text-muted);">→ ${escHtml(r.fechaFin || '—')}</div>
        </td>
        <td style="text-align:center;">
          <span class="badge ${r.prorroga === 'SI' ? 'badge--revision' : 'badge--neutral'}" style="font-weight:700;">${escHtml(r.prorroga || 'NO')}</span>
        </td>
        <td style="text-align:center;">
          <span class="badge badge--incapacidad" style="font-weight:700;">${r.diasSolicitados || 1} d</span>
        </td>
        <td style="font-size:0.78rem;white-space:nowrap;">
          <div style="color:var(--text-muted);">Sal: ${formatCOP(r.salario)}</div>
          <div style="font-weight:700;color:${Number(r.descuento) > 0 ? '#d97706' : 'var(--text-secondary)'};">Desc: ${formatCOP(r.descuento)}</div>
        </td>
        <td>
          <button type="button" class="badge badge--interactive ${badgeClass(r.estado)}" onclick="IncapacidadesModule.openStatusPicker(${r.id})" title="Clic para cambiar estado">
            <span>${escHtml(r.estado)}</span>
            <svg class="badge-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </td>
        <td class="td-actions">
          <div class="td-actions-wrap">
            <button class="btn-action-view" onclick="IncapacidadesModule.openView(${r.id})" title="Ver Detalles Formato SST">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-action-edit" onclick="IncapacidadesModule.openEdit(${r.id})" title="Editar Incapacidad">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${Auth.canEdit() ? `
            <button class="btn-action-delete" onclick="IncapacidadesModule.confirmDelete(${r.id}, '${escHtml(r.apellidosNombres)}')" title="Eliminar Incapacidad">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderPagination() {
    const el = document.getElementById('inc-pagination');
    if (!el) return;
    el.innerHTML = `
      <span class="pagination-info">Mostrando ${state.data.length} de ${state.total.toLocaleString('es-CO')}</span>
      <div class="pagination-btns">
        <button class="page-btn" onclick="IncapacidadesModule.goPage(${state.page - 1})" ${state.page <= 1 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="page-btn active">${state.page}</span>
        <span style="color:var(--text-muted);font-size:var(--text-sm)">/ ${state.totalPages}</span>
        <button class="page-btn" onclick="IncapacidadesModule.goPage(${state.page + 1})" ${state.page >= state.totalPages ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  FORMULARIO OFICIAL: 9. INCAPACIDADES SST (Formato E-DO-ST-F-002 Versión 2)
  //  Con desplegables de la Hoja 2 + Motivo y Observaciones
  // ═══════════════════════════════════════════════════════════════════════════
  function buildIncapacidadFormHtml(r = {}, isEdit = false) {
    const cat = normalizeCatalogs(catalogsCache);
    const todayISO = new Date().toISOString().slice(0, 10);

    const radIso = dmyToISO(r.fechaRadicacion || r.fechaSolicitud) || todayISO;
    const fiIso = dmyToISO(r.fechaInicio) || todayISO;
    const ffIso = dmyToISO(r.fechaFin) || fiIso;
    const curDep = cleanName(r.dependencia || '');
    const curSede = r.sede || 'EDIFICIO LOTERÍA DE BOYACÁ';
    const curEps = r.eps || 'SANITAS';
    const curProrroga = r.prorroga || 'NO';
    const curCausa = r.causaMotivo || 'Enfermedad general';
    const curDias = r.diasSolicitados || 1;
    const curSalario = Number(r.salario) || 0;
    const curDescuento = Number(r.descuento) || 0;
    const curEstado = r.estado || 'Pendiente';

    const depList = [...cat.dependencias];
    if (curDep && !depList.includes(curDep)) depList.unshift(curDep);

    const sedeList = [...cat.sedes];
    if (curSede && !sedeList.includes(curSede)) sedeList.unshift(curSede);

    const epsList = [...cat.epsList];
    if (curEps && !epsList.includes(curEps)) epsList.unshift(curEps);

    const causaList = [...cat.causasMotivos];
    if (curCausa && !causaList.includes(curCausa)) causaList.unshift(curCausa);

    return `
      <div class="permiso-form-wrap">
        <div class="permiso-alert-banner permiso-alert-banner--info" style="margin-bottom:14px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;flex-shrink:0"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <div>
            <strong>Formulario de Registro de Incapacidades · Gobernación de Boyacá</strong>
            <div style="font-size:0.8rem;opacity:0.9;">Complete los campos requeridos del servidor público, periodo de incapacidad, diagnóstico y liquidación salarial.</div>
          </div>
        </div>

        <!-- INFORMACIÓN DEL SERVIDOR PÚBLICO Y RADICACIÓN -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Información del Servidor Público y Radicación</span>
          </div>

          <div class="form-grid">
            <div class="form-group span-2" style="position:relative;">
              <label class="form-label">Buscar Servidor en Planta (Cédula o Nombre)</label>
              <div class="autocomplete-wrapper" style="position:relative;">
                <input id="inc-f-search" class="form-input" placeholder="Escriba el nombre o número de cédula para autocompletar datos del servidor..." autocomplete="off" />
                <div id="inc-f-autocomplete" class="autocomplete-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:999;"></div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Fecha de Radicación *</label>
              <input id="inc-f-radicacion" type="date" class="form-input" value="${escHtml(radIso)}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Cédula *</label>
              <input id="inc-f-doc" class="form-input font-mono" placeholder="Ej: 1049625596" value="${escHtml(r.documento || '')}" required />
            </div>

            <div class="form-group span-2">
              <label class="form-label">Nombres y Apellidos *</label>
              <input id="inc-f-nombres" class="form-input" placeholder="NOMBRES Y APELLIDOS COMPLETOS DEL SERVIDOR" value="${escHtml(r.apellidosNombres || r.persona || '')}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Cargo *</label>
              <input id="inc-f-cargo" class="form-input" placeholder="Ej: PROFESIONAL UNIVERSITARIO" value="${escHtml(r.cargo || '')}" required />
            </div>

            <div class="form-group">
              <label class="form-label">EPS *</label>
              <select id="inc-f-eps" class="filter-select" required>
                <option value="">-- Seleccione EPS / ARL --</option>
                ${epsList.map(e => `<option value="${escHtml(e)}" ${curEps === e ? 'selected' : ''}>${escHtml(e)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- UBICACIÓN LABORAL (HOJA 2) -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Ubicación Laboral</span>
          </div>

          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label">Dependencia en la que Trabaja *</label>
              <select id="inc-f-dep" class="filter-select" required>
                <option value="">-- Seleccione la Dependencia --</option>
                ${depList.map(d => `<option value="${escHtml(d)}" ${curDep === d ? 'selected' : ''}>${escHtml(d)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group span-2">
              <label class="form-label">Sede en la que Trabaja *</label>
              <select id="inc-f-sede" class="filter-select" required>
                <option value="">-- Seleccione la Sede --</option>
                ${sedeList.map(s => `<option value="${escHtml(s)}" ${curSede === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- PERIODO, PRÓRROGA Y DIAGNÓSTICO DE LA INCAPACIDAD -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Periodo y Diagnóstico de la Incapacidad</span>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Fecha Inicial de la Incapacidad *</label>
              <input id="inc-f-fi" type="date" class="form-input" value="${escHtml(fiIso)}" onchange="IncapacidadesModule.onDatesOrCalcChange()" required />
            </div>

            <div class="form-group">
              <label class="form-label">Fecha Final de la Incapacidad *</label>
              <input id="inc-f-ff" type="date" class="form-input" value="${escHtml(ffIso)}" onchange="IncapacidadesModule.onDatesOrCalcChange()" required />
            </div>

            <div class="form-group">
              <label class="form-label">Prórroga *</label>
              <select id="inc-f-prorroga" class="filter-select" onchange="IncapacidadesModule.onProrrogaOrCausaChange()">
                ${(cat.prorrogaOpts || ['NO', 'SI']).map(p => `<option value="${escHtml(p)}" ${curProrroga === p ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Días *</label>
              <input id="inc-f-dias" type="number" min="1" max="365" class="form-input font-mono" value="${curDias}" oninput="IncapacidadesModule.onDiasOrSalarioChange()" required />
            </div>

            <div class="form-group">
              <label class="form-label">Causa o Motivo *</label>
              <select id="inc-f-causa" class="filter-select" onchange="IncapacidadesModule.onProrrogaOrCausaChange()" required>
                <option value="">-- Seleccione Causa o Motivo --</option>
                ${causaList.map(c => `<option value="${escHtml(c)}" ${curCausa === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Código CIE 10 (Código del diagnóstico)</label>
              <input id="inc-f-cie10" class="form-input font-mono" placeholder="Ej: M797, O800, I209, S829..." value="${escHtml(r.codigoCie10 || '')}" style="text-transform:uppercase;" />
            </div>
          </div>
        </div>

        <!-- LIQUIDACIÓN SALARIAL Y ACTO ADMINISTRATIVO -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Liquidación Salarial y Acto Administrativo</span>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Salario (COP)</label>
              <input id="inc-f-salario" type="number" min="0" step="1" class="form-input font-mono" placeholder="Ej: 7258783" value="${curSalario}" oninput="IncapacidadesModule.onDiasOrSalarioChange()" />
            </div>

            <div class="form-group">
              <label class="form-label" style="display:flex;justify-content:space-between;align-items:center;">
                <span>Descuento (COP)</span>
                <button type="button" onclick="IncapacidadesModule.recalcDescuentoManual()" style="background:none;border:none;color:var(--color-green-dark,#287522);font-size:0.74rem;font-weight:700;cursor:pointer;text-decoration:underline;padding:0;">Recalcular automático</button>
              </label>
              <input id="inc-f-descuento" type="number" min="0" step="1" class="form-input font-mono" placeholder="0" value="${curDescuento}" oninput="IncapacidadesModule.onDescuentoManualInput()" />
            </div>

            <div class="form-group span-2">
              <label class="form-label">Acto Administrativo si Aplica</label>
              <input id="inc-f-acto" class="form-input" placeholder="Ej: 1107 / RESOLUCIÓN 0458 DE 2026 (si aplica)" value="${escHtml(r.actoAdministrativo || '')}" />
            </div>

            <div class="form-group span-2">
              <div id="inc-f-resumen-liquidacion" class="permiso-alert-banner permiso-alert-banner--info" style="display:flex;align-items:center;justify-content:space-between;">
                <span>Liquidación SST: <strong id="inc-f-resumen-val">${curDias} día(s) · Salario: ${formatCOP(curSalario)} · Descuento: ${formatCOP(curDescuento)}</strong></span>
                <span class="badge badge--aprobada">Fórmula SST</span>
              </div>
            </div>
          </div>
        </div>

        <!-- MOTIVO Y OBSERVACIONES (CAMPOS CONSERVADOS DEL FORMULARIO) -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Motivo y Observaciones</span>
          </div>

          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label">Motivo *</label>
              <textarea id="inc-f-motivo" class="form-input" rows="2" placeholder="Detalle el motivo o diagnóstico de la incapacidad..." required>${escHtml(r.motivo || '')}</textarea>
            </div>

            <div class="form-group ${Auth.canEdit() ? '' : 'span-2'}">
              <label class="form-label">Observaciones</label>
              <textarea id="inc-f-obs" class="form-input" rows="2" placeholder="Observaciones adicionales, entidad médica, seguimiento SST...">${escHtml(r.observaciones || '')}</textarea>
            </div>

            ${Auth.canEdit() ? `
            <div class="form-group">
              <label class="form-label">Estado de la Solicitud</label>
              <select id="inc-f-estado" class="filter-select">
                ${['Pendiente', 'En revisión', 'Aprobada', 'Finalizada', 'Rechazada'].map(s =>
                  `<option value="${s}" ${curEstado === s ? 'selected' : ''}>${s}</option>`
                ).join('')}
              </select>
            </div>` : ''}
          </div>
        </div>

        <!-- SOPORTES Y ANEXOS -->
        <div class="permiso-section">
          <div class="permiso-section-header">
            <span class="permiso-section-title">Certificado de Incapacidad / Soportes (PDF, JPG, PNG)</span>
          </div>

          <div id="inc-dropzone" class="permiso-soportes-dropzone" onclick="document.getElementById('inc-file-input').click()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:36px;height:36px;margin:0 auto 8px;color:var(--color-green-dark,#287522);display:block;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">Haga clic aquí o arrastre el certificado médico de incapacidad</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Formatos permitidos: PDF, JPG, PNG (máx. 5 MB por archivo, hasta 5 archivos)</div>
            <input type="file" id="inc-file-input" multiple accept=".pdf,.png,.jpg,.jpeg" style="display:none;" onchange="IncapacidadesModule.handleFileSelect(event)" />
          </div>

          <div id="inc-soportes-list" class="soporte-file-list" style="margin-top:12px;"></div>
        </div>
      </div>
    `;
  }

  async function initIncapacidadForm(r = {}, isEdit = false) {
    currentSoportes = [];
    existingSoportes = [];
    discountManuallyEdited = isEdit && Number(r.descuento) > 0;

    if (isEdit && r.id) {
      try {
        const sops = await API.getIncapacidadSoportes(r.id);
        existingSoportes = Array.isArray(sops) ? sops : [];
      } catch {
        /* ignore */
      }
    }

    renderSoportesList();
    bindAutocomplete();
    bindDropzoneEvents();
  }

  function updateSummaryText(autoCalc = true) {
    const dias = Math.max(1, parseInt(document.getElementById('inc-f-dias')?.value, 10) || 1);
    const salario = parseFloat(document.getElementById('inc-f-salario')?.value) || 0;
    const prorroga = document.getElementById('inc-f-prorroga')?.value || 'NO';
    const causaMotivo = document.getElementById('inc-f-causa')?.value || 'Enfermedad general';
    const descEl = document.getElementById('inc-f-descuento');

    if (autoCalc && !discountManuallyEdited && descEl) {
      descEl.value = calcularDescuentoSST({ salario, dias, prorroga, causaMotivo });
    }

    const descuento = parseFloat(descEl?.value) || 0;
    const resumenEl = document.getElementById('inc-f-resumen-val');
    if (resumenEl) {
      resumenEl.textContent = `${dias} día(s) · Salario: ${formatCOP(salario)} · Descuento: ${formatCOP(descuento)}`;
    }
  }

  function onDatesOrCalcChange() {
    const fiEl = document.getElementById('inc-f-fi');
    const ffEl = document.getElementById('inc-f-ff');
    const diasEl = document.getElementById('inc-f-dias');
    if (fiEl && ffEl && fiEl.value && ffEl.value) {
      if (ffEl.value < fiEl.value) ffEl.value = fiEl.value;
      if (diasEl) diasEl.value = calcDaysInclusive(fiEl.value, ffEl.value);
    }
    discountManuallyEdited = false;
    updateSummaryText(true);
  }

  function onProrrogaOrCausaChange() {
    discountManuallyEdited = false;
    const causaEl = document.getElementById('inc-f-causa');
    const motivoEl = document.getElementById('inc-f-motivo');
    if (causaEl && motivoEl && !motivoEl.value.trim() && causaEl.value) {
      motivoEl.value = causaEl.value.toUpperCase();
    }
    updateSummaryText(true);
  }

  function onDiasOrSalarioChange() {
    discountManuallyEdited = false;
    updateSummaryText(true);
  }

  function onDescuentoManualInput() {
    discountManuallyEdited = true;
    updateSummaryText(false);
  }

  function recalcDescuentoManual() {
    discountManuallyEdited = false;
    updateSummaryText(true);
    App.showToast('Descuento recalculado según fórmula SST.', 'info');
  }

  // ─── Autocompletado de Servidores Públicos ──────────────────────────────────
  function bindAutocomplete() {
    const searchInput = document.getElementById('inc-f-search');
    const dropdown = document.getElementById('inc-f-autocomplete');
    if (!searchInput || !dropdown) return;

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchDebounceTimer);
      if (q.length < 2) {
        dropdown.style.display = 'none';
        return;
      }
      searchDebounceTimer = setTimeout(async () => {
        try {
          const res = await API.getEmployees({ q, limit: 7 });
          const emps = res.data || [];
          if (!emps.length) {
            dropdown.innerHTML = '<div style="padding:10px 14px;color:var(--text-muted);font-size:0.85rem;">No se encontraron servidores coincidentes en planta.</div>';
            dropdown.style.display = 'block';
            return;
          }
          dropdown.innerHTML = emps.map(emp => {
            const nom = emp.apellidos_nombres || emp.apellidosNombres || emp.persona || emp.nombreCompleto || `${emp.primer_apellido || ''} ${emp.primer_nombre || ''}`.trim();
            const doc = emp.documento || emp.cedula || '';
            const dep = cleanName(emp.dependencia || '');
            const car = emp.cargo || '';
            const sal = Number(emp.salario || emp.sueldoBasico || emp.asignacionBasica || 0) || 0;
            const eps = emp.eps || '';
            const empJson = escHtml(JSON.stringify({ nom, doc, dep, car, sal, eps }));
            return `
              <div class="autocomplete-item" onclick="IncapacidadesModule.selectEmployee(${empJson})" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--color-border,#e2e8f0);">
                <div class="autocomplete-item-name" style="font-weight:700;font-size:0.88rem;color:var(--text-primary);">${escHtml(nom)}</div>
                <div class="autocomplete-item-meta" style="font-size:0.75rem;color:var(--text-muted);">
                  C.C. ${escHtml(doc)} · ${escHtml(dep || 'Sin dep.')} · ${escHtml(car || 'Sin cargo')} ${sal ? `· Salario: ${formatCOP(sal)}` : ''}
                </div>
              </div>
            `;
          }).join('');
          dropdown.style.display = 'block';
        } catch (err) {
          console.warn('[Incapacidades] Error en autocomplete:', err);
        }
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  function selectEmployee(emp) {
    const searchInput = document.getElementById('inc-f-search');
    const docInput = document.getElementById('inc-f-doc');
    const nomInput = document.getElementById('inc-f-nombres');
    const cargoInput = document.getElementById('inc-f-cargo');
    const salInput = document.getElementById('inc-f-salario');
    const depSelect = document.getElementById('inc-f-dep');
    const epsSelect = document.getElementById('inc-f-eps');
    const dropdown = document.getElementById('inc-f-autocomplete');

    if (dropdown) dropdown.style.display = 'none';
    if (searchInput) searchInput.value = emp.nom || '';
    if (docInput) docInput.value = String(emp.doc || '').replace(/\D/g, '');
    if (nomInput) nomInput.value = emp.nom || '';
    if (cargoInput && emp.car) cargoInput.value = emp.car;
    if (salInput && emp.sal > 0) salInput.value = Math.round(emp.sal);

    if (depSelect && emp.dep) {
      const targetDep = cleanName(emp.dep).toUpperCase();
      const match = Array.from(depSelect.options).find(opt => {
        const val = opt.value.toUpperCase();
        return val && (val === targetDep || val.includes(targetDep) || targetDep.includes(val));
      });
      if (match) depSelect.value = match.value;
    }

    if (epsSelect && emp.eps) {
      const targetEps = String(emp.eps).trim().toUpperCase();
      const matchEps = Array.from(epsSelect.options).find(opt => opt.value.toUpperCase() === targetEps);
      if (matchEps) epsSelect.value = matchEps.value;
    }

    discountManuallyEdited = false;
    updateSummaryText(true);
    App.showToast(`Servidor ${emp.nom} seleccionado.`, 'info');
  }

  // ─── Gestión de Soportes (Drag & Drop) ──────────────────────────────────────
  function bindDropzoneEvents() {
    const dropzone = document.getElementById('inc-dropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault(); e.stopPropagation();
        dropzone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault(); e.stopPropagation();
        dropzone.classList.remove('is-dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length) processFiles(files);
    });
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files && files.length) processFiles(files);
  }

  function processFiles(files) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    const maxBytes = 5 * 1024 * 1024;
    const totalFiles = existingSoportes.length + currentSoportes.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (totalFiles + currentSoportes.length >= 5) {
        App.showToast('No puede adjuntar más de 5 archivos de soporte.', 'warning');
        break;
      }
      if (!allowed.includes(file.type.toLowerCase())) {
        App.showToast(`Archivo "${file.name}" rechazado: solo se permiten PDF, JPG o PNG.`, 'warning');
        continue;
      }
      if (file.size > maxBytes) {
        App.showToast(`Archivo "${file.name}" supera el límite de 5 MB.`, 'warning');
        continue;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const comma = dataUrl.indexOf(',');
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        currentSoportes.push({
          nombre: file.name,
          mime: file.type || 'application/pdf',
          tamano: file.size,
          base64: base64,
          contenidoBase64: base64,
        });
        renderSoportesList();
      };
      reader.readAsDataURL(file);
    }
  }

  function renderSoportesList() {
    const listEl = document.getElementById('inc-soportes-list');
    if (!listEl) return;

    let html = '';
    existingSoportes.forEach(s => {
      html += `
        <div class="soporte-file-item">
          <div class="soporte-file-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--color-green-dark,#287522);flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span style="font-weight:600;">${escHtml(s.nombre_archivo)}</span>
            <span style="color:var(--text-muted);font-size:0.75rem;">(${formatBytes(s.tamano_bytes)})</span>
            <span class="badge badge--aprobada" style="font-size:0.7rem;">Guardado</span>
          </div>
        </div>
      `;
    });

    currentSoportes.forEach((s, idx) => {
      html += `
        <div class="soporte-file-item">
          <div class="soporte-file-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:#3b82f6;flex-shrink:0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span style="font-weight:600;">${escHtml(s.nombre)}</span>
            <span style="color:var(--text-muted);font-size:0.75rem;">(${formatBytes(s.tamano)})</span>
            <span class="badge badge--revision" style="font-size:0.7rem;">Nuevo</span>
          </div>
          <button type="button" class="btn btn-secondary" style="padding:3px 8px;font-size:0.75rem;color:#ef4444;" onclick="IncapacidadesModule.removeNewSoporte(${idx})">Quitar</button>
        </div>
      `;
    });

    if (!existingSoportes.length && !currentSoportes.length) {
      html = '<div style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:6px;">No hay soportes adjuntos actualmente.</div>';
    }
    listEl.innerHTML = html;
  }

  function removeNewSoporte(idx) {
    currentSoportes.splice(idx, 1);
    renderSoportesList();
  }

  // ─── Lectura y Validación del Formulario ────────────────────────────────────
  function readIncapacidadForm() {
    const fechaRadIso = document.getElementById('inc-f-radicacion')?.value.trim();
    const documento = document.getElementById('inc-f-doc')?.value.trim();
    const apellidosNombres = document.getElementById('inc-f-nombres')?.value.trim();
    const cargo = document.getElementById('inc-f-cargo')?.value.trim();
    const eps = document.getElementById('inc-f-eps')?.value.trim();
    const dependencia = cleanName(document.getElementById('inc-f-dep')?.value.trim());
    const sede = document.getElementById('inc-f-sede')?.value.trim();
    const fiIso = document.getElementById('inc-f-fi')?.value.trim();
    const ffIso = document.getElementById('inc-f-ff')?.value.trim();
    const prorroga = document.getElementById('inc-f-prorroga')?.value.trim() || 'NO';
    const diasSolicitados = parseInt(document.getElementById('inc-f-dias')?.value, 10) || 1;
    const causaMotivo = document.getElementById('inc-f-causa')?.value.trim();
    const codigoCie10 = (document.getElementById('inc-f-cie10')?.value || '').trim().toUpperCase();
    const salario = parseFloat(document.getElementById('inc-f-salario')?.value) || 0;
    const descuento = parseFloat(document.getElementById('inc-f-descuento')?.value) || 0;
    const actoAdministrativo = document.getElementById('inc-f-acto')?.value.trim() || '';
    const motivo = document.getElementById('inc-f-motivo')?.value.trim() || '';
    const observaciones = document.getElementById('inc-f-obs')?.value.trim() || '';
    const estado = document.getElementById('inc-f-estado')?.value || 'Pendiente';

    if (!documento) { App.showToast('El campo Cédula es obligatorio.', 'warning'); return null; }
    if (!apellidosNombres) { App.showToast('El campo Nombres y Apellidos es obligatorio.', 'warning'); return null; }
    if (!cargo) { App.showToast('El campo Cargo es obligatorio.', 'warning'); return null; }
    if (!eps) { App.showToast('Seleccione la EPS / ARL.', 'warning'); return null; }
    if (!dependencia) { App.showToast('Seleccione la Dependencia en la que trabaja.', 'warning'); return null; }
    if (!sede) { App.showToast('Seleccione la Sede en la que trabaja.', 'warning'); return null; }
    if (!fiIso || !ffIso) { App.showToast('Seleccione la Fecha Inicial y Fecha Final de la incapacidad.', 'warning'); return null; }
    if (!causaMotivo) { App.showToast('Seleccione la Causa o Motivo de la incapacidad.', 'warning'); return null; }
    if (!motivo) { App.showToast('El campo Motivo es obligatorio.', 'warning'); return null; }

    return {
      tipo: 'Incapacidad',
      fechaRadicacion: isoToDMY(fechaRadIso),
      apellidosNombres,
      persona: apellidosNombres,
      documento,
      dependencia,
      sede,
      cargo,
      eps,
      fechaInicio: isoToDMY(fiIso),
      fechaFin: isoToDMY(ffIso),
      prorroga,
      causaMotivo,
      codigoCie10,
      diasSolicitados,
      dias: diasSolicitados,
      salario,
      descuento,
      actoAdministrativo,
      motivo,
      observaciones,
      estado,
      soportes: currentSoportes,
    };
  }

  // ─── Abrir Creación / Edición ───────────────────────────────────────────────
  async function openCreate() {
    await ensureCatalogs();
    App.openModal(
      'Radicar Incapacidad · Gobernación de Boyacá',
      buildIncapacidadFormHtml({}, false),
      [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        { text: 'Radicar Incapacidad', cls: 'btn-primary', id: 'inc-save-btn', action: saveCreate },
      ],
      'modal-ficha'
    );
    initIncapacidadForm({}, false);
  }

  async function saveCreate() {
    const body = readIncapacidadForm();
    if (!body) return;
    const btn = document.getElementById('inc-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Radicando...'; }
    try {
      let res = typeof API.createIncapacidad === 'function' ? await API.createIncapacidad(body) : null;
      if (!res || !res.id) {
        res = await API.createAdminRequest(body);
      }
      App.closeModal();
      App.showToast(`Incapacidad radicada exitosamente (${res.radicado || 'OK'}).`, 'success');
      await Promise.all([loadStats(), load()]);
    } catch (err) {
      App.showToast(err.message || 'Error al registrar la incapacidad.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Radicar Incapacidad'; }
    }
  }

  async function openEdit(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;
    await ensureCatalogs();
    App.openModal(
      `Editar Incapacidad (${r.radicado || ''})`,
      buildIncapacidadFormHtml(r, true),
      [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        { text: 'Actualizar Incapacidad', cls: 'btn-gold', id: 'inc-save-btn', action: () => saveEdit(id) },
      ],
      'modal-ficha'
    );
    initIncapacidadForm(r, true);
  }

  async function saveEdit(id) {
    const body = readIncapacidadForm();
    if (!body) return;
    const btn = document.getElementById('inc-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
    try {
      const res = typeof API.updateIncapacidad === 'function' ? await API.updateIncapacidad(id, body) : null;
      if (!res || !res.message) {
        await API.updateAdminRequest(id, body);
      }
      App.closeModal();
      App.showToast('Incapacidad actualizada correctamente.', 'success');
      await Promise.all([loadStats(), load()]);
    } catch (err) {
      App.showToast(err.message || 'Error al actualizar la incapacidad.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Actualizar Incapacidad'; }
    }
  }

  // ─── Modal de Vista Detallada ───────────────────────────────────────────────
  async function openView(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;

    let soportes = [];
    try {
      const res = typeof API.getIncapacidadSoportes === 'function' ? await API.getIncapacidadSoportes(r.id) : [];
      soportes = Array.isArray(res) ? res : [];
    } catch {
      /* ignore */
    }

    const soportesHtml = (soportes && soportes.length) ? soportes.map(s => `
      <div class="soporte-file-item" style="margin-bottom:6px;">
        <div class="soporte-file-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--color-green-dark,#287522);flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span style="font-weight:600;">${escHtml(s.nombre_archivo)}</span>
          <span style="color:var(--text-muted);font-size:0.75rem;">(${formatBytes(s.tamano_bytes)})</span>
        </div>
        <a href="${typeof API.getIncapacidadSoporteUrl === 'function' ? API.getIncapacidadSoporteUrl(r.id, s.id_soporte) : API.getAdminRequestSoporteUrl(r.id, s.id_soporte)}" target="_blank" download="${escHtml(s.nombre_archivo)}" class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Descargar
        </a>
      </div>
    `).join('') : '<div style="color:var(--text-muted);font-size:0.82rem;padding:6px 0;">No se adjuntaron soportes a este registro.</div>';

    const content = `
      <div class="detail-modal-card" style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--color-border,#e2e8f0);padding-bottom:10px;">
          <div>
            <div style="font-size:1.15rem;font-weight:800;color:var(--text-primary);">${escHtml(r.radicado)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);">Registro de Incapacidad y Ausentismo Laboral</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge ${r.prorroga === 'SI' ? 'badge--revision' : 'badge--neutral'}" style="font-weight:700;">Prórroga: ${escHtml(r.prorroga || 'NO')}</span>
            <span class="badge badge--incapacidad" style="font-weight:700;">${r.diasSolicitados || 1} día(s)</span>
            <span class="badge ${badgeClass(r.estado)}">${escHtml(r.estado)}</span>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Fecha de Radicación</span>
            <span class="detail-value">${escHtml(r.fechaRadicacion || r.fechaSolicitud || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Cédula</span>
            <span class="detail-value font-mono">${escHtml(r.documento || '—')}</span>
          </div>

          <div class="detail-item detail-grid--full">
            <span class="detail-label">Nombres y Apellidos</span>
            <span class="detail-value" style="font-weight:700;">${escHtml(r.apellidosNombres || r.persona || '—')}</span>
          </div>

          <div class="detail-item detail-grid--full">
            <span class="detail-label">Dependencia en la que Trabaja</span>
            <span class="detail-value">${escHtml(cleanName(r.dependencia) || '—')}</span>
          </div>

          <div class="detail-item detail-grid--full">
            <span class="detail-label">Sede en la que Trabaja</span>
            <span class="detail-value">📍 ${escHtml(r.sede || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Cargo</span>
            <span class="detail-value">${escHtml(r.cargo || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">EPS</span>
            <span class="detail-value" style="font-weight:700;">${escHtml(r.eps || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Fecha Inicial de la Incapacidad</span>
            <span class="detail-value">${escHtml(r.fechaInicio || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Fecha Final de la Incapacidad</span>
            <span class="detail-value">${escHtml(r.fechaFin || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Causa o Motivo</span>
            <span class="detail-value" style="font-weight:700;">${escHtml(r.causaMotivo || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Código CIE 10</span>
            <span class="detail-value font-mono" style="font-weight:700;color:var(--color-green-dark,#287522);">${escHtml(r.codigoCie10 || '—')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Salario</span>
            <span class="detail-value font-mono">${formatCOP(r.salario)}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Descuento</span>
            <span class="detail-value font-mono" style="font-weight:700;color:#d97706;">${formatCOP(r.descuento)}</span>
          </div>

          <div class="detail-item detail-grid--full">
            <span class="detail-label">Acto Administrativo si Aplica</span>
            <span class="detail-value">${escHtml(r.actoAdministrativo || '—')}</span>
          </div>

          <div class="detail-item detail-grid--full">
            <span class="detail-label">Motivo</span>
            <span class="detail-value" style="font-weight:600;">${escHtml(r.motivo || '—')}</span>
          </div>

          <div class="detail-item detail-grid--full">
            <span class="detail-label">Observaciones</span>
            <span class="detail-value">${escHtml(r.observaciones || '—')}</span>
          </div>

          <div class="detail-item detail-grid--full">
            <span class="detail-label">Certificado / Soportes Adjuntos (${(soportes && soportes.length) || 0})</span>
            <div style="margin-top:6px;">${soportesHtml}</div>
          </div>
        </div>
      </div>
    `;

    const actions = [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
    ];
    if (Auth.canEdit()) {
      actions.push({
        text: 'Editar Incapacidad',
        cls: 'btn-gold',
        action: () => {
          App.closeModal();
          openEdit(r.id);
        },
      });
    }

    App.openModal(`Detalles · Incapacidad SST (${r.radicado || ''})`, content, actions, 'modal-ficha');
  }

  // ─── Selector Rápido de Estados ─────────────────────────────────────────────
  const STATUS_CONFIG = [
    {
      id: 'aprobada', name: 'Aprobada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
      desc: 'Incapacidad verificada y aprobada por SST / Talento Humano', cls: 'status-card-opt--aprobada',
    },
    {
      id: 'rechazada', name: 'Rechazada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      desc: 'Soporte inválido o inconsistencia en el certificado', cls: 'status-card-opt--rechazada',
    },
    {
      id: 'revision', name: 'En revisión',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      desc: 'En validación médica de CIE-10 o transcripción EPS', cls: 'status-card-opt--revision',
    },
    {
      id: 'pendiente', name: 'Pendiente',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      desc: 'En espera de revisión o soporte original', cls: 'status-card-opt--pendiente',
    },
    {
      id: 'finalizada', name: 'Finalizada',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      desc: 'Incapacidad liquidada en nómina y archivada', cls: 'status-card-opt--finalizada',
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
        <button type="button" class="status-card-opt ${opt.cls} ${isCurrent ? 'is-current' : ''}" onclick="IncapacidadesModule.selectQuickStatus(${r.id}, '${opt.name}')" title="Marcar como ${opt.name}">
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
          <div class="status-picker-person">${escHtml(r.apellidosNombres || r.persona)}</div>
          <div class="status-picker-tags">
            <span class="status-picker-tag">🩺 ${escHtml(r.causaMotivo || 'Incapacidad')}</span>
            <span class="status-picker-tag">📅 ${escHtml(r.fechaInicio || '—')} (${r.diasSolicitados || 1} d)</span>
            <span class="status-picker-tag">Estado actual: <strong class="badge ${badgeClass(r.estado)}" style="margin-left:4px">${escHtml(r.estado)}</strong></span>
          </div>
        </div>

        <div class="status-picker-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <span>Selecciona el nuevo estado para esta incapacidad:</span>
        </div>

        <div class="status-cards-grid">
          ${cardsHtml}
        </div>

        <div class="form-group" style="margin-top:var(--space-2);">
          <label class="form-label">Observaciones / Nota de Gestión (Opcional)</label>
          <input id="inc-quick-status-note" class="form-input form-input--no-icon" placeholder="Ej: Certificado validado con EPS..." value="${escHtml(r.observaciones || '')}" />
        </div>
      </div>`;

    App.openModal('Gestión Rápida de Estado · Incapacidad', bodyHtml, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
    ]);
  }

  async function selectQuickStatus(id, newStatus) {
    const note = document.getElementById('inc-quick-status-note')?.value.trim();
    try {
      const res = typeof API.updateIncapacidadStatus === 'function'
        ? await API.updateIncapacidadStatus(id, newStatus, note)
        : null;
      if (!res || !res.message) {
        await API.updateAdminRequestStatus(id, newStatus, note);
      }
      App.closeModal();
      App.showToast(`Estado actualizado a "${newStatus}".`, 'success');
      await Promise.all([loadStats(), load()]);
    } catch (err) {
      App.showToast(err.message || 'Error al cambiar estado.', 'error');
    }
  }

  function confirmDelete(id, nombre) {
    App.openModal(
      'Confirmar Eliminación',
      `<p style="color:var(--text-secondary)">¿Eliminar el registro de incapacidad de <strong style="color:var(--text-primary)">${escHtml(nombre)}</strong>?</p>`,
      [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          text: 'Eliminar',
          cls: 'btn-danger',
          action: async () => {
            try {
              const res = typeof API.deleteIncapacidad === 'function' ? await API.deleteIncapacidad(id) : null;
              if (!res || !res.message) {
                await API.deleteAdminRequest(id);
              }
              App.closeModal();
              App.showToast('Incapacidad eliminada.', 'success');
              await Promise.all([loadStats(), load()]);
            } catch (err) {
              App.showToast(err.message, 'error');
            }
          },
        },
      ]
    );
  }

  function applyFilters() {
    state.page = 1;
    state.filters = {
      q: document.getElementById('inc-q')?.value.trim() || '',
      causaMotivo: document.getElementById('inc-causa')?.value || 'Todas',
      eps: document.getElementById('inc-eps')?.value || 'Todas',
      estado: document.getElementById('inc-estado')?.value || 'Todos',
    };
    load();
  }

  function clearFilters() {
    const qEl = document.getElementById('inc-q');
    const cEl = document.getElementById('inc-causa');
    const eEl = document.getElementById('inc-eps');
    const sEl = document.getElementById('inc-estado');
    if (qEl) qEl.value = '';
    if (cEl) cEl.value = 'Todas';
    if (eEl) eEl.value = 'Todas';
    if (sEl) sEl.value = 'Todos';
    state.filters = { q: '', causaMotivo: 'Todas', eps: 'Todas', estado: 'Todos' };
    state.page = 1;
    load();
  }

  function goPage(p) {
    if (p < 1 || p > state.totalPages) return;
    state.page = p;
    load();
  }

  // ─── Dropdown de Acciones Secundarias ───────────────────────────────────────
  function toggleActionsDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('inc-dropdown-menu');
    const toggleBtn = document.getElementById('inc-dropdown-toggle');
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
    const menu = document.getElementById('inc-dropdown-menu');
    const toggleBtn = document.getElementById('inc-dropdown-toggle');
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
      const menu = document.getElementById('inc-dropdown-menu');
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
      const menu = document.getElementById('inc-dropdown-menu');
      if (menu && !menu.hasAttribute('hidden') && wrap && !wrap.contains(e.target)) {
        menu.setAttribute('hidden', '');
        const toggleBtn = document.getElementById('inc-dropdown-toggle');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ─── Exportación e Importación Formato 9. INCAPACIDADES SST ─────────────────
  const EXCEL_COLUMNS = [
    { header: 'RADICADO', key: 'radicado', width: 18, sample: 'INC-2026-00001' },
    { header: 'FECHA DE RADICACIÓN', key: 'fechaRadicacion', width: 20, sample: '01/09/2026' },
    { header: 'NOMBRES Y APELLIDOS', key: 'apellidosNombres', width: 34, sample: 'YANIRA GUARNIZO MANRIQUE' },
    { header: 'CÉDULA', key: 'documento', width: 16, sample: '65776381' },
    { header: 'DEPENDENCIA EN LA QUE TRABAJA', key: 'dependencia', width: 38, sample: 'SPLA - Dirección de Seguimiento y Planeación Territorial' },
    { header: 'SEDE EN LA QUE TRABAJA', key: 'sede', width: 30, sample: 'EDIFICIO INTELIGENTE - BICENTENARIO' },
    { header: 'CARGO', key: 'cargo', width: 28, sample: 'PROFESIONAL UNIVERSITARIO (E)' },
    { header: 'EPS', key: 'eps', width: 18, sample: 'SANITAS' },
    { header: 'FECHA INICIAL DE LA INCAPACIDAD', key: 'fechaInicio', width: 24, sample: '18/08/2026' },
    { header: 'FECHA FINAL DE LA INCAPACIDAD', key: 'fechaFin', width: 24, sample: '31/08/2026' },
    { header: 'PRORROGA', key: 'prorroga', width: 12, sample: 'NO' },
    { header: 'CAUSA O MOTIVO', key: 'causaMotivo', width: 26, sample: 'Enfermedad general' },
    { header: 'CÓDIGO CIE 10 (Código del diagnóstico)', key: 'codigoCie10', width: 22, sample: 'M797' },
    { header: 'DÍAS', key: 'diasSolicitados', width: 10, sample: 14 },
    { header: 'SALARIO', key: 'salario', width: 16, sample: 7258783 },
    { header: 'DESCUENTO', key: 'descuento', width: 16, sample: 967838 },
    { header: 'ACTO ADMINISTRATIVO SI APLICA', key: 'actoAdministrativo', width: 26, sample: '1107' },
    { header: 'MOTIVO', key: 'motivo', width: 32, sample: 'Incapacidad médica por Enfermedad general' },
    { header: 'OBSERVACIONES', key: 'observaciones', width: 32, sample: 'Certificado médico EPS SANITAS' },
    { header: 'ESTADO', key: 'estado', width: 16, sample: 'Aprobada' },
  ];

  async function exportExcel() {
    try {
      App.showToast('Generando archivo Excel de incapacidades...', 'info');
      const res = typeof API.getIncapacidades === 'function'
        ? await API.getIncapacidades({ ...state.filters, page: 1, limit: 10000 })
        : null;
      const records = ((res && res.data) || state.data).map(normalizeRow);
      ExcelService.exportToExcel({
        filename: '9_INCAPACIDADES_SST_Talento360',
        sheetName: 'Incapacidades SST',
        columns: EXCEL_COLUMNS,
        data: records,
      });
      App.showToast(`Se exportaron ${records.length} registros de incapacidades exitosamente.`, 'success');
    } catch (err) {
      App.showToast('Error al exportar: ' + err.message, 'error');
    }
  }

  function openImportModal() {
    ExcelService.openImportModal({
      title: 'Carga Masiva de Incapacidades',
      subtitle: 'Importe registros masivos de incapacidades desde un archivo Excel (.xlsx / .xls)',
      moduleName: 'incapacidades SST',
      columns: EXCEL_COLUMNS.filter(c => c.key !== 'radicado'),
      sampleRows: [
        {
          'FECHA DE RADICACIÓN': '01/09/2026',
          'NOMBRES Y APELLIDOS': 'YANIRA GUARNIZO MANRIQUE',
          'CÉDULA': '65776381',
          'DEPENDENCIA EN LA QUE TRABAJA': 'SPLA - Dirección de Seguimiento y Planeación Territorial',
          'SEDE EN LA QUE TRABAJA': 'EDIFICIO INTELIGENTE - BICENTENARIO',
          'CARGO': 'PROFESIONAL UNIVERSITARIO (E)',
          'EPS': 'SANITAS',
          'FECHA INICIAL DE LA INCAPACIDAD': '18/08/2026',
          'FECHA FINAL DE LA INCAPACIDAD': '31/08/2026',
          'PRORROGA': 'NO',
          'CAUSA O MOTIVO': 'Enfermedad general',
          'CÓDIGO CIE 10 (Código del diagnóstico)': 'M797',
          'DÍAS': '14',
          'SALARIO': '7258783',
          'DESCUENTO': '967838',
          'ACTO ADMINISTRATIVO SI APLICA': '1107',
          'MOTIVO': 'INCAPACIDAD MÉDICA POR ENFERMEDAD GENERAL (CIE-10: M797)',
          'OBSERVACIONES': 'CERTIFICADO RADICADO EN SST',
          'ESTADO': 'Aprobada',
        },
      ],
      validateRow: (row) => {
        const documento = String(row['CÉDULA'] || row['CEDULA'] || row.documento || row.cedula || '').trim();
        const apellidosNombres = String(row['NOMBRES Y APELLIDOS'] || row['APELLIDOS Y NOMBRES'] || row.apellidosNombres || row.persona || '').trim();
        const dependencia = cleanName(String(row['DEPENDENCIA EN LA QUE TRABAJA'] || row['DEPENDENCIA'] || row.dependencia || '').trim());
        if (!documento || !apellidosNombres) {
          return { valid: false, error: 'Cédula y Nombres y Apellidos son requeridos.' };
        }
        return {
          valid: true,
          cleanRow: {
            tipo: 'Incapacidad',
            fechaRadicacion: String(row['FECHA DE RADICACIÓN'] || row['FECHA DE RADICACION'] || row.fechaRadicacion || '').trim(),
            apellidosNombres,
            persona: apellidosNombres,
            documento,
            dependencia: dependencia || 'SGEN - Dirección General de Talento Humano',
            sede: String(row['SEDE EN LA QUE TRABAJA'] || row['SEDE'] || row.sede || 'EDIFICIO LOTERÍA DE BOYACÁ').trim(),
            cargo: String(row['CARGO'] || row.cargo || '').trim(),
            eps: String(row['EPS'] || row.eps || 'SANITAS').trim(),
            fechaInicio: String(row['FECHA INICIAL DE LA INCAPACIDAD'] || row['FECHA INICIO'] || row.fechaInicio || '').trim(),
            fechaFin: String(row['FECHA FINAL DE LA INCAPACIDAD'] || row['FECHA FIN'] || row.fechaFin || '').trim(),
            prorroga: String(row['PRORROGA'] || row['PRÓRROGA'] || row.prorroga || 'NO').trim().toUpperCase(),
            causaMotivo: String(row['CAUSA O MOTIVO'] || row.causaMotivo || 'Enfermedad general').trim(),
            codigoCie10: String(row['CÓDIGO CIE 10 (Código del diagnóstico)'] || row['CODIGO CIE 10'] || row.codigoCie10 || '').trim(),
            diasSolicitados: parseInt(row['DÍAS'] || row['DIAS'] || row.diasSolicitados || 1, 10) || 1,
            salario: parseFloat(String(row['SALARIO'] || row.salario || 0).replace(/[^0-9.-]/g, '')) || 0,
            descuento: parseFloat(String(row['DESCUENTO'] || row.descuento || 0).replace(/[^0-9.-]/g, '')) || 0,
            actoAdministrativo: String(row['ACTO ADMINISTRATIVO SI APLICA'] || row.actoAdministrativo || '').trim(),
            motivo: String(row['MOTIVO'] || row['CAUSA O MOTIVO'] || row.motivo || 'INCAPACIDAD MÉDICA').trim(),
            observaciones: String(row['OBSERVACIONES'] || row.observaciones || '').trim(),
            estado: String(row['ESTADO'] || row.estado || 'Aprobada').trim(),
          },
        };
      },
      onImport: async (rows) => {
        const res = typeof API.bulkCreateIncapacidades === 'function'
          ? await API.bulkCreateIncapacidades(rows)
          : await API.bulkCreateAdminRequests(rows);
        App.showToast(`Se importaron ${res.inserted} incapacidades correctamente.`, 'success');
        await Promise.all([loadStats(), load()]);
      },
    });
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
    toggleActionsDropdown,
    closeActionsDropdown,
    handleDropdownKeydown,
    exportExcel,
    openImportModal,
    onDatesOrCalcChange,
    onProrrogaOrCausaChange,
    onDiasOrSalarioChange,
    onDescuentoManualInput,
    recalcDescuentoManual,
    selectEmployee,
    handleFileSelect,
    removeNewSoporte,
  };
})();
