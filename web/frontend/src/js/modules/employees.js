/* ═══════════════════════════════════════════════════════════════════════════
   employees.js — Módulo Integral de Gestión de Recursos Humanos (Talento 360)
   Implementa detalladamente las 22 reglas de negocio
   ═══════════════════════════════════════════════════════════════════════════ */

const EmployeesModule = (() => {
  let state = {
    data: [],
    total: 0,
    page: 1,
    totalPages: 1,
    q: '',
    catalogs: {
      dependencias: [],
      cargos: [],
      cargosPorDependencia: {},
      divipola: { departamentos: [], municipiosPorDepto: {} },
      grados: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', 'N/a', 'NE'],
      clasificaciones: [
        'Carrera Administrativa',
        'Encargo en Vacante Definitiva',
        'Encargo en Vacante Temporal',
        'Encargo con Licencia No Remunerada',
        'Judicatura',
        'Licencia No Remunerada',
        'Empleo de Período Fijo',
        'Provisional en Vacante Definitiva',
        'Provisional en Vacante Temporal',
        'Aprendiz o Contrato SENA',
        'Vacante Definitiva',
        'Vacante Definitiva provista por Provisional',
        'Vacante Temporal',
        'Vacante Temporal provista por Provisional',
        'Libre Nombramiento y Remoción',
        'Trabajador Oficial',
        'Sin clasificar'
      ],
      estadosServidor: ['Activo', 'Inactivo', 'Pensionado'],
      sexos: ['Femenino', 'Masculino', 'Prefiero no decirlo'],
      discapacidades: ['visual', 'auditiva', 'motora', 'cognitiva', 'sordomuda', 'sordociega'],
      diplomados: [
        'Gestión Pública y Buen Gobierno',
        'Contratación Estatal y Secop II',
        'MIPG - Modelo Integrado de Planeación y Gestión',
        'Derecho Disciplinario y Control Interno',
        'Auditoría y Gestión Financiera Pública',
        'Sistemas Integrados de Gestión (HSEQ)',
        'Capacitación Técnica SENA',
        'Otro Diplomado / Especialización'
      ]
    }
  };

  /**
   * Regla 8: Formateador visual que muestra el número espaciado por puntos (ej. 1.000.000).
   */
  function formatCedulaDots(val) {
    if (!val) return '';
    const str = String(val).trim();
    if (/^PROV-\d+$/i.test(str)) return str;
    if (/^\d+$/.test(str)) {
      return str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    return str;
  }

  /**
   * Reglas 13 y 14: Cálculo dinámico de fechas: "X años, Y meses, Z días"
   */
  function calcDateDiffExact(dateStr) {
    if (!dateStr) return 'No disponible';
    let d;
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) d = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
    } else {
      d = new Date(dateStr);
    }
    if (!d || isNaN(d.getTime())) return 'No disponible';

    const now = new Date();
    let anios = now.getUTCFullYear() - d.getUTCFullYear();
    let meses = now.getUTCMonth() - d.getUTCMonth();
    let dias = now.getUTCDate() - d.getUTCDate();

    if (dias < 0) {
      meses -= 1;
      const prevMonthDays = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate();
      dias += prevMonthDays;
    }
    if (meses < 0) {
      anios -= 1;
      meses += 12;
    }
    return `${Math.max(0, anios)} años, ${Math.max(0, meses)} meses, ${Math.max(0, dias)} días`;
  }

  /**
   * Cálculo de diferencia exacta entre dos fechas dadas (para periodos de experiencia)
   */
  function calcExactDiffBetween(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) return null;
    const inicio = new Date(fechaInicio + (fechaInicio.includes('T') ? '' : 'T00:00:00Z'));
    const fin = new Date(fechaFin + (fechaFin.includes('T') ? '' : 'T00:00:00Z'));
    if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || fin < inicio) return null;

    let anios = fin.getUTCFullYear() - inicio.getUTCFullYear();
    let meses = fin.getUTCMonth() - inicio.getUTCMonth();
    let dias = fin.getUTCDate() - inicio.getUTCDate();

    if (dias < 0) {
      meses -= 1;
      const prevMonthDays = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), 0)).getUTCDate();
      dias += prevMonthDays;
    }
    if (meses < 0) {
      anios -= 1;
      meses += 12;
    }
    return {
      anios: Math.max(0, anios),
      meses: Math.max(0, meses),
      dias: Math.max(0, dias),
      texto: `${Math.max(0, anios)} años, ${Math.max(0, meses)} meses, ${Math.max(0, dias)} días`
    };
  }

  /**
   * Suma dos duraciones en formato { anios, meses, dias } o textos "X años, Y meses, Z días"
   */
  function sumExactDurations(dur1, dur2) {
    function parseD(d) {
      if (!d) return { anios: 0, meses: 0, dias: 0, tieneValor: false };
      if (typeof d === 'object' && ('anios' in d || 'meses' in d || 'dias' in d)) {
        const a = parseInt(d.anios) || 0, m = parseInt(d.meses) || 0, ds = parseInt(d.dias) || 0;
        return { anios: a, meses: m, dias: ds, tieneValor: (a > 0 || m > 0 || ds > 0) };
      }
      const str = String(d).toLowerCase();
      const aM = str.match(/(\d+)\s*(?:año|ano|a\b)/i);
      const mM = str.match(/(\d+)\s*(?:mes|m\b)/i);
      const dM = str.match(/(\d+)\s*(?:día|dia|d\b)/i);
      const a = aM ? parseInt(aM[1], 10) : 0;
      const m = mM ? parseInt(mM[1], 10) : 0;
      const ds = dM ? parseInt(dM[1], 10) : 0;
      return { anios: a, meses: m, dias: ds, tieneValor: (a > 0 || m > 0 || ds > 0) };
    }

    const d1 = parseD(dur1);
    const d2 = parseD(dur2);
    if (!d1.tieneValor && !d2.tieneValor) return null;

    let a = d1.anios + d2.anios;
    let m = d1.meses + d2.meses;
    let ds = d1.dias + d2.dias;

    if (ds >= 30) {
      m += Math.floor(ds / 30);
      ds = ds % 30;
    }
    if (m >= 12) {
      a += Math.floor(m / 12);
      m = m % 12;
    }
    return {
      anios: a,
      meses: m,
      dias: ds,
      texto: `${a} años, ${m} meses, ${ds} días`
    };
  }

  function badgeSex(s) {
    if (!s) return '—';
    const v = s.toUpperCase();
    if (v.includes('FEMEN') || v === 'F') return '<span class="badge badge--licencia">Femenino</span>';
    if (v.includes('MASCU') || v === 'M') return '<span class="badge badge--revision">Masculino</span>';
    return `<span class="badge badge--pendiente">${escHtml(s)}</span>`;
  }

  function badgeEstadoServidor(est) {
    const val = (est || 'Activo').toLowerCase();
    if (val === 'activo') return '<span class="badge badge--activo">Activo</span>';
    if (val === 'pensionado') return '<span class="badge badge--pensionado">Pensionado</span>';
    return '<span class="badge badge--inactivo">Inactivo</span>';
  }

  const CLASIFICACION_MAP = {
    'C.A': 'Carrera Administrativa',
    'CA': 'Carrera Administrativa',
    'C.A.': 'Carrera Administrativa',
    'CARRERA ADMINISTRATIVA': 'Carrera Administrativa',
    'ENCAR T': 'Encargo en Vacante Temporal',
    'ENCART': 'Encargo en Vacante Temporal',
    'ENCARGO VT': 'Encargo en Vacante Temporal',
    'ENCARGO EN VACANTE TEMPORAL': 'Encargo en Vacante Temporal',
    'ENCARGO VD': 'Encargo en Vacante Definitiva',
    'ENCARGO EN VACANTE DEFINITIVA': 'Encargo en Vacante Definitiva',
    'JUDIC': 'Judicatura',
    'JUDICATURA': 'Judicatura',
    'L.N': 'Licencia No Remunerada',
    'LN': 'Licencia No Remunerada',
    'L.N.': 'Licencia No Remunerada',
    'LICENCIA NO REMUNERADA': 'Licencia No Remunerada',
    'L.N ENCARGO': 'Encargo con Licencia No Remunerada',
    'LN ENCARGO': 'Encargo con Licencia No Remunerada',
    'L.N. ENCARGO': 'Encargo con Licencia No Remunerada',
    'ENCARGO CON LICENCIA NO REMUNERADA': 'Encargo con Licencia No Remunerada',
    'PERIODO': 'Empleo de Período Fijo',
    'PERÍODO': 'Empleo de Período Fijo',
    'PERIODO FIJO': 'Empleo de Período Fijo',
    'EMPLEO DE PERIODO FIJO': 'Empleo de Período Fijo',
    'EMPLEO DE PERÍODO FIJO': 'Empleo de Período Fijo',
    'PROV VD': 'Provisional en Vacante Definitiva',
    'PROVISIONAL VD': 'Provisional en Vacante Definitiva',
    'PROVISIONAL EN VACANTE DEFINITIVA': 'Provisional en Vacante Definitiva',
    'PROV VT': 'Provisional en Vacante Temporal',
    'PROVISIONAL VT': 'Provisional en Vacante Temporal',
    'PROVISIONAL EN VACANTE TEMPORAL': 'Provisional en Vacante Temporal',
    'SENA': 'Aprendiz o Contrato SENA',
    'APRENDIZ SENA': 'Aprendiz o Contrato SENA',
    'CONTRATO SENA': 'Aprendiz o Contrato SENA',
    'APRENDIZ O CONTRATO SENA': 'Aprendiz o Contrato SENA',
    'VD': 'Vacante Definitiva',
    'VACANTE DEFINITIVA': 'Vacante Definitiva',
    'VD PROV': 'Vacante Definitiva provista por Provisional',
    'VACANTE DEFINITIVA PROVISTA POR PROVISIONAL': 'Vacante Definitiva provista por Provisional',
    'VT': 'Vacante Temporal',
    'VACANTE TEMPORAL': 'Vacante Temporal',
    'VT PROV': 'Vacante Temporal provista por Provisional',
    'VACANTE TEMPORAL PROVISTA POR PROVISIONAL': 'Vacante Temporal provista por Provisional',
    'LIBRE NOMBRAMIENTO Y REMOCIÓN': 'Libre Nombramiento y Remoción',
    'LIBRE NOMBRAMIENTO Y REMOCION': 'Libre Nombramiento y Remoción',
    'TRABAJADOR OFICIAL': 'Trabajador Oficial',
    'VACANTE': 'Vacante Definitiva',
    'PROVISIONAL': 'Provisional en Vacante Definitiva',
    'TEMPORAL': 'Encargo en Vacante Temporal',
    'SIN CLASIFICAR': 'Sin clasificar'
  };

  function normalizarClasificacion(val) {
    if (!val || val === '—' || val === '-' || String(val).trim() === '') return 'Sin clasificar';
    const s = String(val).trim().replace(/\s+/g, ' ');
    const upper = s.toUpperCase();
    if (CLASIFICACION_MAP[upper]) return CLASIFICACION_MAP[upper];
    const noDots = upper.replace(/\./g, '').trim();
    if (CLASIFICACION_MAP[noDots]) return CLASIFICACION_MAP[noDots];
    const noAcc = upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (CLASIFICACION_MAP[noAcc]) return CLASIFICACION_MAP[noAcc];
    if (upper === '(VACÍAS)' || upper === '(VACIAS)') return 'Sin clasificar';
    return s;
  }

  function renderSingleBadgeClasif(clasifText) {
    const norm = normalizarClasificacion(clasifText);
    if (!norm || norm === 'Sin clasificar') {
      return '<span class="badge-clasif badge-clasif--default"><span>📝</span> Sin clasificar</span>';
    }
    const c = norm.toUpperCase();
    let cls = 'badge-clasif--default';
    let icon = '📝';

    if (c.includes('ENCARGO') || c.includes('ENCAR')) {
      cls = 'badge-clasif--encargo';
      icon = '🔄';
    } else if (c.includes('CARRERA')) {
      cls = 'badge-clasif--carrera';
    } else if (c.includes('LIBRE')) {
      cls = 'badge-clasif--libre';
    } else if (c.includes('LICENCIA')) {
      cls = 'badge-clasif--licencia';
    } else if (c.includes('PROVISIONAL') || c.includes('PROV')) {
      cls = 'badge-clasif--provisional';
    } else if (c.includes('JUDIC')) {
      cls = 'badge-clasif--judicatura';
    } else if (c.includes('PERIODO') || c.includes('TEMPORAL')) {
      cls = 'badge-clasif--temporal';
    } else if (c.includes('SENA')) {
      cls = 'badge-clasif--sena';
    } else if (c.includes('TRABAJADOR')) {
      cls = 'badge-clasif--trabajador';
    } else if (c.includes('VACANTE')) {
      cls = 'badge-clasif--vacante';
    }

    return `<span class="badge-clasif ${cls}"><span>${icon}</span> ${escHtml(norm)}</span>`;
  }

  function badgeClasificacion(clasifOrEmp, maybeEmp = null) {
    let emp = null;
    let rawClasif = '';
    if (clasifOrEmp && typeof clasifOrEmp === 'object') {
      emp = clasifOrEmp;
      rawClasif = emp.clasificacionEmpleo || '';
    } else {
      rawClasif = clasifOrEmp || '';
      emp = maybeEmp;
    }

    const norm = normalizarClasificacion(rawClasif);
    const normUpper = (norm || '').toUpperCase();
    const situacionUpper = String(emp?.situacion || '').toUpperCase();
    const fechaEncargoRaw = String(emp?.fechaEncargo || '').trim();
    const hasFechaEncargo = Boolean(
      fechaEncargoRaw &&
      fechaEncargoRaw !== 'NO REGISTRADO' &&
      fechaEncargoRaw !== 'N/A' &&
      fechaEncargoRaw !== '—' &&
      fechaEncargoRaw !== 'NULL'
    );

    // Un servidor tiene encargo si su clasificación lo indica, su situación es encargo, o tiene fecha de encargo
    const isEncargo = normUpper.includes('ENCARGO') ||
                      normUpper.includes('ENCAR') ||
                      situacionUpper.includes('ENCARGO') ||
                      situacionUpper.includes('ENCAR') ||
                      hasFechaEncargo;

    // Si NO tiene encargo: mantener única y exclusivamente su tipo de vinculación original con emoji 📝
    if (!isEncargo) {
      return renderSingleBadgeClasif(norm);
    }

    // Si y solo si tiene encargo:
    // 1. Debe tener la etiqueta de Carrera Administrativa (con emoji 📝)
    // 2. Y adicionalmente aparecer que es un encargo con su emoji distintivo 🔄
    const badgeCarrera = renderSingleBadgeClasif('Carrera Administrativa');

    let encargoLabel = norm;
    if (!normUpper.includes('ENCARGO') && !normUpper.includes('ENCAR')) {
      encargoLabel = 'Encargo';
    }
    const badgeEncargo = `<span class="badge-clasif badge-clasif--encargo"><span>🔄</span> ${escHtml(encargoLabel)}</span>`;

    // Si además tenía otra clasificación previa diferente de Carrera y de Encargo, se conserva
    let extraBadge = '';
    if (!normUpper.includes('CARRERA') && !normUpper.includes('ENCAR') && norm !== 'Sin clasificar') {
      extraBadge = renderSingleBadgeClasif(norm);
    }

    return `<div style="display:inline-flex; flex-wrap:wrap; gap:6px; align-items:center;">
      ${badgeCarrera}
      ${badgeEncargo}
      ${extraBadge ? extraBadge : ''}
    </div>`;
  }


  function getInitials(name) {
    if (!name) return 'SP';
    const clean = String(name).trim();
    if (clean.startsWith('PLAZA VACANTE') || clean === '??') return '??';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function renderSkeletonTable() {
    const tbody = document.getElementById('emp-tbody');
    if (!tbody) return;

    // Estándares de Accesibilidad WCAG 2.1 AA
    tbody.setAttribute('aria-busy', 'true');
    tbody.setAttribute('role', 'progressbar');
    tbody.setAttribute('aria-label', 'Cargando listado de servidores públicos...');
    tbody.setAttribute('aria-valuemin', '0');
    tbody.setAttribute('aria-valuemax', '100');
    tbody.setAttribute('aria-valuetext', 'Cargando datos del servidor...');

    const countEl = document.getElementById('emp-count');
    if (countEl) {
      countEl.innerHTML = `<span class="skeleton" style="width:110px;height:14px;border-radius:4px;" aria-hidden="true"></span>`;
    }

    // Mockup de baja fidelidad estilo feed con avatares circulares y bloques horizontales de texto
    const skeletonRows = Array.from({ length: 7 }).map((_, idx) => `
      <tr class="skeleton-row" aria-hidden="true">
        <td class="td-servidor">
          <div class="user-table-cell user-table-cell--avatar" style="display:flex; flex-direction:row; align-items:center; gap:12px;">
            <div class="skeleton skeleton-avatar" aria-hidden="true"></div>
            <div class="user-table-info" style="flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; text-align:left;">
              <div class="skeleton skeleton-line skeleton-line--title" style="width:${idx % 2 === 0 ? '75%' : '65%'};" aria-hidden="true"></div>
              <div class="skeleton skeleton-line" style="width:45%; height:11px;" aria-hidden="true"></div>
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <div class="skeleton skeleton-line" style="width:${idx % 3 === 0 ? '85%' : '70%'}; height:13px;" aria-hidden="true"></div>
            <div class="skeleton skeleton-line" style="width:40%; height:10px;" aria-hidden="true"></div>
          </div>
        </td>
        <td><div class="skeleton skeleton-line" style="width:60%; height:12px;" aria-hidden="true"></div></td>
        <td><div class="skeleton skeleton-line" style="width:65%; height:12px;" aria-hidden="true"></div></td>
        <td><div class="skeleton skeleton-line" style="width:70%; height:13px;" aria-hidden="true"></div></td>
        <td><div class="skeleton skeleton-badge" style="width:75px; height:22px; border-radius:9999px;" aria-hidden="true"></div></td>
        <td class="td-actions">
          <div class="td-actions-wrap" style="display:flex; gap:6px;">
            <div class="skeleton" style="width:28px; height:28px; border-radius:8px;" aria-hidden="true"></div>
            <div class="skeleton" style="width:28px; height:28px; border-radius:8px;" aria-hidden="true"></div>
            <div class="skeleton" style="width:28px; height:28px; border-radius:8px;" aria-hidden="true"></div>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = skeletonRows;
  }

  async function load() {
    renderSkeletonTable();
    try {
      const res = await API.getEmployees({ q: state.q, page: state.page, limit: 25 });
      let records = res.data || [];
      // Ordenar: 1) Activos con cédula (primeras), 2) Sin cédula (penúltimas), 3) Inactivos (últimas)
      const getPriority = (emp) => {
        const isActivo = (emp.estadoServidor || 'Activo').toLowerCase() === 'activo';
        if (!isActivo) return 2; // Inactivos de últimas
        const hasCedula = Boolean(
          emp.cedula &&
          String(emp.cedula).trim() !== '' &&
          String(emp.cedula).trim() !== '0' &&
          !String(emp.cedula).startsWith('PROV-') &&
          !emp.documento_pendiente &&
          !emp.es_vacante &&
          emp.situacion !== 'VACANTE' &&
          !(emp.nombreCompleto && emp.nombreCompleto.startsWith('PLAZA VACANTE'))
        );
        if (!hasCedula) return 1; // Sin cédula de penúltimas
        return 0; // Activos con cédula
      };

      records.sort((a, b) => {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        return (a.nombreCompleto || '').localeCompare(b.nombreCompleto || '');
      });
      state.data = records;
      state.total = res.total || 0;
      state.totalPages = res.totalPages || 1;
      renderTable();
      renderPagination();
    } catch (err) {
      const tbody = document.getElementById('emp-tbody');
      if (tbody) {
        tbody.setAttribute('aria-busy', 'false');
        tbody.removeAttribute('role');
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="color:var(--color-danger); border-color:var(--color-danger);">
          <span class="empty-state-title" style="color:var(--color-danger);">Error al cargar servidores</span>
          <span class="empty-state-desc">${escHtml(err.message)}</span>
          <button class="btn btn-secondary btn-sm" onclick="EmployeesModule.load()" style="margin-top:12px;">Reintentar</button>
        </div></td></tr>`;
      }
      App.showToast('Error al cargar servidores: ' + err.message, 'error');
    }
  }

  function renderTable() {
    const tbody = document.getElementById('emp-tbody');
    if (!tbody) return;

    // Resetear atributos de accesibilidad tras completar la carga
    tbody.setAttribute('aria-busy', 'false');
    tbody.removeAttribute('role');
    tbody.removeAttribute('aria-valuemin');
    tbody.removeAttribute('aria-valuemax');
    tbody.removeAttribute('aria-valuetext');

    if (!state.data.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span class="empty-state-title">No se encontraron servidores</span>
        <span class="empty-state-desc">${state.q ? `No hay resultados para "${state.q}"` : 'Aún no hay servidores registrados.'}</span>
        </div></td></tr>`;
      return;
    }

    tbody.innerHTML = state.data.map(e => {
      const itemKey = e.cedula || e.id;
      const formattedCc = formatCedulaDots(e.cedula);
      const isVac = Boolean(e.es_vacante || e.situacion === 'VACANTE' || (e.nombreCompleto && e.nombreCompleto.startsWith('PLAZA VACANTE')));
      const initials = getInitials(e.nombreCompleto);

      return `
      <tr>
        <td class="td-servidor">
          <div class="user-table-cell user-table-cell--avatar" style="display:flex; flex-direction:row; align-items:center; gap:12px;">
            <div class="user-row-avatar ${isVac ? 'user-row-avatar--vacante' : ''}" aria-hidden="true" title="${escHtml(e.nombreCompleto || 'Servidor')}">
              ${isVac ? '??' : escHtml(initials)}
            </div>
            <div class="user-table-info" style="display:flex; flex-direction:column; gap:2px; min-width:0; text-align:left;">
              <span class="td-primary" title="${escHtml(e.nombreCompleto)}">${escHtml(e.nombreCompleto) || '—'}</span>
              ${isVac
                ? `<span class="badge badge--vacante" title="Plaza vacante de la planta">${escHtml(e.codigoVacante || 'PLAZA VACANTE')}</span>`
                : ((e.documento_pendiente || (e.cedula && e.cedula.startsWith('PROV-')))
                  ? `<span class="badge badge--provisional font-mono" title="ID Temporal Secuencial">${escHtml(e.cedula)} (Provisional)</span>`
                  : (e.cedula
                    ? `<span class="user-table-cc font-mono" title="Cédula de Ciudadanía">C.C. ${escHtml(formattedCc)}</span>`
                    : `<span class="badge badge--pendiente">Sin Cédula</span>`
                  )
                )
              }
            </div>
          </div>
        </td>
        <td title="${escHtml(e.cargoActual)}">
          <div style="font-weight:600; color:var(--text-primary); line-height:1.25;">${truncate(e.cargoActual, 28) || '—'}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
            ${(e.codigoActual && e.codigoActual !== 'N/A') ? `Cód. <strong>${escHtml(e.codigoActual)}</strong>` : 'Sin código'}
            ${(e.gradoActual && e.gradoActual !== 'N/A') ? ` • Grado <strong>${escHtml(e.gradoActual)}</strong>` : ''}
          </div>
        </td>
        <td style="font-size:12px;" title="Otro Tiempo Calculado: ${escHtml(e.otroTiempoCalculado || '0 años, 0 meses, 0 días')}${e.otroTiempoGobernacion ? ` • Original: ${escHtml(e.otroTiempoGobernacion)}` : ''}">
          ${(e.otroTiempoCalculado && e.otroTiempoCalculado !== '0 años, 0 meses, 0 días')
          ? `<span style="font-weight:600; color:var(--text-primary);">${escHtml(e.otroTiempoCalculado)}</span>`
          : (e.otroTiempoCalculado ? `<span style="color:var(--text-muted);">${escHtml(e.otroTiempoCalculado)}</span>` : '—')}
        </td>
        <td style="font-size:12px;" title="${escHtml(e.tiempoServicioCalculado)}">${escHtml(e.tiempoServicioCalculado || '—')}</td>
        <td style="font-size:12px; font-weight:700; color:var(--color-primary);" title="Tiempo Total Calculado: ${escHtml(e.tiempoTotalGobernacion || e.tiempoServicioCalculado || '—')} (${escHtml(e.tiempoServicioCalculado || '0')} + ${escHtml(e.otroTiempoCalculado || '0')})">${escHtml(e.tiempoTotalGobernacion || e.tiempoServicioCalculado || '—')}</td>
        <td>${badgeEstadoServidor(e.estadoServidor)}</td>
        <td class="td-actions">
          <div class="td-actions-wrap">
            <button class="btn-action-view" onclick="EmployeesModule.openView('${itemKey}')" title="Ver Detalles" aria-label="Ver detalles de ${escHtml(e.nombreCompleto)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-action-edit" onclick="EmployeesModule.openEdit('${itemKey}')" title="Editar" aria-label="Editar información de ${escHtml(e.nombreCompleto)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${Auth.canEdit() ? `<button class="btn-action-delete" onclick="EmployeesModule.confirmDelete('${itemKey}','${escHtml(e.nombreCompleto)}')" title="Eliminar" aria-label="Eliminar servidor ${escHtml(e.nombreCompleto)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function renderPagination() {
    const el = document.getElementById('emp-pagination');
    if (!el) return;
    el.innerHTML = `
      <span class="pagination-info">Mostrando ${state.data.length} de ${state.total.toLocaleString('es-CO')} servidores</span>
      <div class="pagination-btns">
        <button class="page-btn" onclick="EmployeesModule.goPage(${state.page - 1})" ${state.page <= 1 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="page-btn active">${state.page}</span>
        <span style="color:var(--text-muted);font-size:var(--text-sm)">/ ${state.totalPages}</span>
        <button class="page-btn" onclick="EmployeesModule.goPage(${state.page + 1})" ${state.page >= state.totalPages ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`;
  }

  function sanitizeText(str) {
    if (!str) return '';
    return String(str)
      .replace(/BOYAC\?\?/gi, 'BOYACÁ')
      .replace(/RINC\?\?N/gi, 'RINCÓN')
      .replace(/P\?\?REZ/gi, 'PÉREZ')
      .replace(/CA\?AS/gi, 'CAÑAS')
      .replace(/ACU\?A/gi, 'ACUÑA')
      .replace(/PE\?A/gi, 'PEÑA')
      .replace(/MU\?OZ/gi, 'MUÑOZ')
      .replace(/NU\?EZ/gi, 'NUÑEZ')
      .replace(/D\?AZ/gi, 'DÍAZ')
      .replace(/G\?MEZ/gi, 'GÓMEZ')
      .replace(/\?\?/g, '')
      .replace(/\?/g, '')
      .trim();
  }

  function getInitials(name) {
    if (!name) return 'SP';
    const clean = sanitizeText(name);
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'SP';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function formatSexo(val) {
    if (!val) return 'No registrado';
    const s = String(val).trim().toUpperCase();
    if (s === 'M' || s === 'MASCULINO') return 'Masculino (M)';
    if (s === 'F' || s === 'FEMENINO') return 'Femenino (F)';
    return sanitizeText(val);
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

  async function openView(idOrCedula) {
    const norm = val => String(val || '').trim().replace(/[.,\s]/g, '');
    let emp = state.data.find(e => e.cedula === idOrCedula || e.id === idOrCedula || (e.cedula && idOrCedula && norm(e.cedula) === norm(idOrCedula)));

    // Si aún no tenemos los datos completos, renderizamos el Skeleton de la Ficha (mockup baja fidelidad feed)
    if (!emp) {
      App.openModal('Ficha del Servidor Público', `
        <div class="skeleton-ficha-view" role="progressbar" aria-busy="true" aria-label="Cargando ficha del servidor..." style="padding: 12px;">
          <div class="skeleton" style="height: 110px; border-radius: 14px; margin-bottom: 20px; width: 100%;"></div>
          <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 24px;">
            <div class="skeleton skeleton-avatar--lg"></div>
            <div style="flex: 1;">
              <div class="skeleton skeleton-line skeleton-line--title" style="width: 55%; height: 20px; margin-bottom: 8px;"></div>
              <div class="skeleton skeleton-line" style="width: 35%; height: 14px;"></div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
            <div class="skeleton" style="height: 72px; border-radius: 10px;"></div>
            <div class="skeleton" style="height: 72px; border-radius: 10px;"></div>
            <div class="skeleton" style="height: 72px; border-radius: 10px;"></div>
            <div class="skeleton" style="height: 72px; border-radius: 10px;"></div>
          </div>
        </div>
      `, [
        { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }
      ], 'modal-xl modal-ficha-emp');
    }

    try {
      const full = await API.getEmployeeByCedula(idOrCedula);
      if (full) emp = full;
    } catch (_) { }

    if (!emp) {
      App.showToast('No se encontró el servidor público solicitado', 'error');
      App.closeModal();
      return;
    }

    const isVacante = Boolean(emp.es_vacante || emp.situacion === 'VACANTE' || (emp.nombreCompleto && emp.nombreCompleto.startsWith('PLAZA VACANTE')));
    const formattedCc = formatCedulaDots(emp.cedula);

    let content = '';

    if (isVacante) {
      const codVacante = sanitizeText(emp.codigoVacante || 'PLAZA VACANTE');
      const depName = sanitizeText(emp.dependencia || 'Sin dependencia asignada');
      const cargoName = sanitizeText(emp.cargoActual || emp.cargoBase || 'Cargo por Definir');
      const salario = emp.asignacion || '$0';

      content = `
        <div class="ficha-wrapper">
          <!-- Hero Banner Vacante con Tokens Semánticos -->
          <div class="ficha-hero" style="background: linear-gradient(135deg, var(--color-forest) 0%, var(--color-taupe) 50%, var(--color-rust) 100%);">
            <div class="ficha-hero-inner">
              <div class="ficha-avatar-box">
                <div class="ficha-avatar avatar--vacante">🏛</div>
                <div class="ficha-avatar-badge vacante" title="Plaza Vacante"></div>
              </div>
              <div class="ficha-hero-info">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom: 6px;">
                  <span class="badge" style="font-size:12px; font-weight:800; padding:3px 10px; background:rgba(209, 173, 42, 0.15); color:var(--color-rust); border:1px solid var(--color-mustard);">
                    ${escHtml(codVacante)}
                  </span>
                  <span style="font-size:12px; font-weight:700; color:var(--color-mustard);">Plaza de la Planta de Personal</span>
                </div>
                <h3 class="ficha-hero-name" style="color:var(--text-inverse);">${escHtml(cargoName)}</h3>
                <div class="ficha-hero-sub">
                  <span>🏢 Dependencia: <strong>${escHtml(depName)}</strong></span>
                </div>
                <div class="ficha-hero-pills">
                  <span class="ficha-hero-pill pill--gold">🟡 Estado: Vacante sin titular</span>
                  ${emp.codigoActual ? `<span class="ficha-hero-pill">🏷 Cód. ${escHtml(emp.codigoActual)}</span>` : ''}
                  ${emp.gradoActual ? `<span class="ficha-hero-pill">📊 Grado ${escHtml(emp.gradoActual)}</span>` : ''}
                </div>
              </div>
              <div class="ficha-hero-logo-wrap" title="Gobernación de Boyacá">
                <img src="imgs/logoCondor.png" alt="Cóndor — Boyacá" class="ficha-hero-condor logo-light-theme" />
                <img src="imgs/logoCondorBlanco.png" alt="Cóndor — Boyacá" class="ficha-hero-condor logo-dark-theme" />
              </div>
            </div>
          </div>

          <!-- Cards Grid Vacante -->
          <div class="ficha-grid">
            <div class="ficha-card ficha-grid--full ficha-card--gold">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">🏢</div>
                <span class="ficha-card-label">Dependencia Organizacional</span>
              </div>
              <div class="ficha-card-val" style="font-size: 1.1rem;">${escHtml(depName)}</div>
              <div class="ficha-card-sub">Ubicación jerárquica en la estructura de la Gobernación de Boyacá</div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">💼</div>
                <span class="ficha-card-label">Denominación del Empleo</span>
              </div>
              <div class="ficha-card-val" style="color:var(--color-gold); font-size:1.05rem;">${escHtml(cargoName)}</div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">🏷</div>
                <span class="ficha-card-label">Código y Grado</span>
              </div>
              <div class="ficha-card-val font-mono">
                Código: <strong>${escHtml(emp.codigoActual || 'N/A')}</strong> • Grado: <strong>${escHtml(emp.gradoActual || 'N/A')}</strong>
              </div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">📝</div>
                <span class="ficha-card-label">Tipo de Vinculación</span>
              </div>
              <div class="ficha-card-val">${badgeClasificacion(emp.clasificacionEmpleo, emp)}</div>
            </div>

            <div class="ficha-card">
              <div class="ficha-card-top">
                <div class="ficha-card-icon">📖</div>
                <span class="ficha-card-label">Funciones</span>
              </div>
              <div class="ficha-card-val">
                ${emp.funciones ? `<span class="badge badge--primary" style="font-size:0.95rem; font-weight:700; padding:4px 10px;">${/^\d+$/.test(String(emp.funciones).trim()) ? `Pág. ${escHtml(emp.funciones)}` : escHtml(emp.funciones)}</span>` : '<span style="color:var(--text-muted);">No registra funciones</span>'}
              </div>
              <div class="ficha-card-sub">Manual Específico de Funciones</div>
            </div>
          </div>
        </div>
      `;
    } else {
      const initials = getInitials(emp.nombreCompleto);
      const isActivo = (emp.estadoServidor || 'Activo').toLowerCase() === 'activo';
      const cleanNombre = sanitizeText(emp.nombreCompleto || 'Servidor Público');
      const cleanApellidos = sanitizeText(emp.apellidos || emp.primerApellido || '—');
      const cleanNombres = sanitizeText(emp.nombres || '—');
      const cleanDep = sanitizeText(emp.dependencia || 'Sin dependencia asignada');
      const cleanCargo = sanitizeText(emp.cargoActual || emp.cargoBase || 'Cargo no asignado');
      const cleanMuni = sanitizeText(emp.municipioExpedicion || emp.ciudadExpedicion || emp.expedida || 'Tunja');
      const cleanDepto = sanitizeText(emp.departamentoExpedicion || 'Boyacá');
      const isProv = Boolean(emp.documento_pendiente || (emp.cedula && emp.cedula.startsWith('PROV-')));
      const cedulaText = isProv ? `${emp.cedula} (ID Temporal)` : (emp.cedula ? formattedCc : 'Sin Cédula');
      const cedulaRaw = emp.cedula || '';

      content = `
        <div class="ficha-wrapper">
          <!-- ─── Hero Profile Header ─── -->
          <div class="ficha-hero">
            <div class="ficha-hero-inner">
              <div class="ficha-avatar-box">
                <div class="ficha-avatar">${escHtml(initials)}</div>
                <div class="ficha-avatar-badge ${isActivo ? '' : 'inactivo'}" title="${isActivo ? 'Servidor Activo' : 'Servidor Inactivo'}"></div>
              </div>
              <div class="ficha-hero-info">
                <h3 class="ficha-hero-name">${escHtml(cleanNombre)}</h3>
                <div class="ficha-hero-sub">
                  <span>Apellidos: <strong>${escHtml(cleanApellidos)}</strong></span>
                  <span>•</span>
                  <span>Nombres: <strong>${escHtml(cleanNombres)}</strong></span>
                </div>
                <div class="ficha-hero-pills">
                  <div class="ficha-hero-pill ${isProv ? 'pill--gold' : ''}">
                    <span>🪪 ${isProv ? 'ID Temp:' : 'C.C.'} <strong>${escHtml(cedulaText)}</strong></span>
                    ${cedulaRaw ? `
                      <button class="ficha-copy-btn" id="btn-copy-cc" onclick="EmployeesModule.copyFichaText('${escHtml(cedulaRaw)}', 'btn-copy-cc')" title="Copiar número">
                        <svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copiar
                      </button>
                    ` : ''}
                  </div>
                  <span class="ficha-hero-pill ${isActivo ? 'pill--emerald' : ''}">
                    ${isActivo ? '🟢 Activo' : '🔴 Inactivo'}
                  </span>
                  <span class="ficha-hero-pill">
                    💼 ${escHtml(cleanCargo)}
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
            <button class="ficha-tab-btn active" data-tab="ficha-personal" onclick="EmployeesModule.switchFichaTab('ficha-personal')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Datos Personales
            </button>
            <button class="ficha-tab-btn" data-tab="ficha-cargo" onclick="EmployeesModule.switchFichaTab('ficha-cargo')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
              Cargo & Ubicación
            </button>
            <button class="ficha-tab-btn" data-tab="ficha-tiempos" onclick="EmployeesModule.switchFichaTab('ficha-tiempos')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Tiempos de Servicio
            </button>
            <button class="ficha-tab-btn" data-tab="ficha-contacto" onclick="EmployeesModule.switchFichaTab('ficha-contacto')">
              <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
              Formación & Contacto
            </button>
          </div>

          <!-- ─── Tab 1: Datos Personales ─── -->
          <div class="ficha-tab-pane active" id="ficha-personal">
            <div class="ficha-grid">
              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🪪</div>
                  <span class="ficha-card-label">Cédula de Ciudadanía</span>
                </div>
                <div class="ficha-card-val font-mono" style="font-size:1.1rem; color:var(--color-primary);">
                  ${isProv
          ? `<span class="badge badge--pendiente font-mono" style="font-size:12px; font-weight:700;">${escHtml(emp.cedula)} (Provisional)</span>`
          : (emp.cedula ? `C.C. ${escHtml(formattedCc)}` : 'Sin Cédula Registrada')
        }
                </div>
                <div class="ficha-card-sub">
                  Expedida en: <strong>${escHtml(cleanMuni)}, ${escHtml(cleanDepto)}</strong>
                </div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🩸</div>
                  <span class="ficha-card-label">Grupo Sanguíneo y RH</span>
                </div>
                <div class="ficha-card-val">
                  <span class="badge-blood">🩸 ${escHtml(emp.tipoSangre || 'No registrado')}</span>
                </div>
                <div class="ficha-card-sub">Factor RH para atención en salud</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🚻</div>
                  <span class="ficha-card-label">Sexo Biológico</span>
                </div>
                <div class="ficha-card-val">${escHtml(formatSexo(emp.sexo))}</div>
                <div class="ficha-card-sub">Registro civil institucional</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🎂</div>
                  <span class="ficha-card-label">Fecha de Nacimiento</span>
                </div>
                <div class="ficha-card-val font-mono">${escHtml(emp.fechaNacimiento || 'No registrada')}</div>
                <div class="ficha-card-sub">Día / Mes / Año</div>
              </div>

              <!-- Stat Destacado: Edad Exacta -->
              <div class="ficha-card ficha-card--featured ficha-grid--full">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">⏳</div>
                  <span class="ficha-card-label" style="color:var(--color-navy);">Edad Exacta (Cálculo Dinámico)</span>
                </div>
                <div class="ficha-card-val" style="font-size: 1.25rem; font-weight: 800; color: var(--color-success);">
                  ${escHtml(emp.edadCalculada || 'No disponible')}
                </div>
                <div class="ficha-card-sub" style="color:var(--color-info);">
                  Actualizado en tiempo real a la fecha de hoy con base en la fecha de nacimiento
                </div>
              </div>

              <div class="ficha-card ficha-grid--full">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">♿</div>
                  <span class="ficha-card-label">Condición Especial / Discapacidad</span>
                </div>
                <div class="ficha-card-val">
                  ${emp.tipoDiscapacidad
          ? `<span class="badge badge--revision" style="text-transform: capitalize; font-size:12px; font-weight:700;">♿ ${escHtml(emp.tipoDiscapacidad)}</span>`
          : '<span style="color:var(--text-muted); font-size:0.9rem; font-weight:500;">No registra condición de discapacidad</span>'
        }
                </div>
              </div>
            </div>
          </div>

          <!-- ─── Tab 2: Cargo & Ubicación ─── -->
          <div class="ficha-tab-pane" id="ficha-cargo">
            <div class="ficha-grid">
              <div class="ficha-card ficha-grid--full ficha-card--gold">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🏢</div>
                  <span class="ficha-card-label">Dependencia Institucional</span>
                </div>
                <div class="ficha-card-val" style="font-size: 1.12rem; color: var(--text-primary);">
                  ${escHtml(cleanDep)}
                </div>
                <div class="ficha-card-sub">Área orgánica asignada en la Gobernación de Boyacá</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">💼</div>
                  <span class="ficha-card-label">Denominación del Cargo Actual</span>
                </div>
                <div class="ficha-card-val" style="color: var(--color-gold); font-size:1.02rem;">
                  ${escHtml(cleanCargo)}
                </div>
                ${emp.cargoBase && emp.cargoBase !== emp.cargoActual ? `
                  <div class="ficha-card-sub">Cargo Base / Titular: <strong>${escHtml(emp.cargoBase)}</strong></div>
                ` : ''}
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🏷️</div>
                  <span class="ficha-card-label">Código y Grado</span>
                </div>
                <div class="ficha-card-val font-mono">
                  Cód. <strong>${escHtml(emp.codigoActual || 'N/A')}</strong> • Grado <strong>${escHtml(emp.gradoActual || 'N/A')}</strong>
                </div>
                ${(emp.codigoBase && (emp.codigoBase !== emp.codigoActual || emp.gradoBase !== emp.gradoActual)) ? `
                  <div class="ficha-card-sub">Base: Cód. ${escHtml(emp.codigoBase)} • Grado ${escHtml(emp.gradoBase)}</div>
                ` : ''}
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📝</div>
                  <span class="ficha-card-label">Tipo de Vinculación</span>
                </div>
                <div class="ficha-card-val">
                  ${badgeClasificacion(emp.clasificacionEmpleo || 'Carrera Administrativa', emp)}
                </div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📌</div>
                  <span class="ficha-card-label">Situación Administrativa</span>
                </div>
                <div class="ficha-card-val">
                  <span style="font-weight:800; color:var(--color-primary);">${escHtml(emp.situacion || 'ACTIVO')}</span>
                </div>
                <div class="ficha-card-sub">Condición operativa del funcionario</div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🔢</div>
                  <span class="ficha-card-label">Concurso / Código OPEC</span>
                </div>
                <div class="ficha-card-val font-mono">
                  ${emp.opec ? `OPEC # <strong>${escHtml(emp.opec)}</strong>` : '<span style="color:var(--text-muted);">No registra OPEC</span>'}
                </div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📖</div>
                  <span class="ficha-card-label">Funciones</span>
                </div>
                <div class="ficha-card-val">
                  ${emp.funciones ? `<span class="badge badge--primary" style="font-size:0.95rem; font-weight:700; padding:4px 10px;">${/^\d+$/.test(String(emp.funciones).trim()) ? `Pág. ${escHtml(emp.funciones)}` : escHtml(emp.funciones)}</span>` : '<span style="color:var(--text-muted);">No registra funciones</span>'}
                </div>
                <div class="ficha-card-sub">Manual Específico de Funciones</div>
              </div>
            </div>
          </div>

          <!-- ─── Tab 3: Tiempos de Servicio ─── -->
          <div class="ficha-tab-pane" id="ficha-tiempos">
            <div class="ficha-grid">
              <!-- Grand Highlight: Tiempo Total Acumulado -->
              <div class="ficha-card ficha-card--featured ficha-grid--full" style="background: linear-gradient(135deg, rgba(0,123,199,0.08) 0%, rgba(40,135,27,0.08) 100%); border: 1.5px solid rgba(0,123,199,0.35); padding: 18px 20px;">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon" style="background: rgba(0,123,199,0.15); color: var(--color-info); font-size:16px;">🏆</div>
                  <span class="ficha-card-label" style="color: var(--color-navy); font-size: 0.78rem;">Tiempo Total en la Gobernación de Boyacá</span>
                </div>
                <div class="ficha-card-val" style="font-size: 1.38rem; font-weight: 800; color: var(--color-navy); margin: 6px 0;">
                  ${escHtml(emp.tiempoTotalGobernacion || emp.tiempoServicioCalculado || '0 años, 0 meses, 0 días')}
                </div>
                <div style="font-size:0.8rem; color:var(--color-info); background:rgba(0,123,199,0.08); padding: 6px 12px; border-radius: 8px; display: inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <span>Servicio Actual: <strong>${escHtml(emp.tiempoServicioCalculado || '0')}</strong></span>
                  <span>+</span>
                  <span>Otro Tiempo: <strong>${escHtml(emp.otroTiempoCalculado || emp.otroTiempoGobernacion || '0')}</strong></span>
                </div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📅</div>
                  <span class="ficha-card-label">Fecha de Ingreso a la Gobernación</span>
                </div>
                <div class="ficha-card-val font-mono" style="font-size:1.05rem;">
                  ${escHtml(emp.fechaIngreso || 'No registrada')}
                </div>
                <div class="ficha-card-sub">Inicio de vinculación administrativa</div>
              </div>

              <div class="ficha-card ficha-card--emerald">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">⏱️</div>
                  <span class="ficha-card-label">Tiempo de Servicio Actual</span>
                </div>
                <div class="ficha-card-val" style="color: var(--color-success); font-weight:800;">
                  ${escHtml(emp.tiempoServicioCalculado || '—')}
                </div>
                <div class="ficha-card-sub">Cálculo dinámico a partir de la fecha de ingreso</div>
              </div>

              <div class="ficha-card ficha-grid--full">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🔄</div>
                  <span class="ficha-card-label">Fecha de Encargo</span>
                </div>
                <div class="ficha-card-val font-mono">
                  ${emp.fechaEncargo ? escHtml(emp.fechaEncargo) : '<span style="color:var(--text-muted); font-size:0.9rem;">No registra encargo activo</span>'}
                </div>
              </div>

              <!-- Experiencia Múltiple / Otro Tiempo -->
              <div class="ficha-card ficha-grid--full">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📜</div>
                  <span class="ficha-card-label">Otro Tiempo con la Gobernación (Experiencia Histórica / Múltiple)</span>
                </div>
                ${(Array.isArray(emp.otroTiempoPeriodos) && emp.otroTiempoPeriodos.length) ? `
                  <div style="margin-top: 8px; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                      <thead>
                        <tr style="background: var(--color-bg-secondary, rgba(0,0,0,0.03)); border-bottom: 1px solid var(--color-border); text-align: left;">
                          <th style="padding: 7px 12px; color: var(--text-muted);">#</th>
                          <th style="padding: 7px 12px;">Fecha Desde</th>
                          <th style="padding: 7px 12px;">Fecha Hasta</th>
                          <th style="padding: 7px 12px;">Duración Acreditada</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${emp.otroTiempoPeriodos.map((p, idx) => `
                          <tr style="border-bottom: 1px solid var(--color-border);">
                            <td style="padding: 7px 12px; color: var(--text-muted);">${idx + 1}</td>
                            <td style="padding: 7px 12px; font-weight: 600;">${escHtml(p.desde)}</td>
                            <td style="padding: 7px 12px; font-weight: 600;">${escHtml(p.hasta)}</td>
                            <td style="padding: 7px 12px; color: var(--color-success); font-weight: 700;">${escHtml(p.duracionTexto || '—')}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                      <tfoot>
                        <tr style="background: rgba(40, 135, 27, 0.08); font-weight: 700;">
                          <td colspan="3" style="padding: 8px 12px; text-align: right; color: var(--text-primary);">Total Acumulado Otros Tiempos:</td>
                          <td style="padding: 8px 12px; color: var(--color-success); font-weight: 800;">${escHtml(emp.otroTiempoGobernacion || '—')}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ` : `
                  <div class="ficha-card-val" style="color: var(--color-success); font-size:1.05rem; margin-top:4px;">
                    ${escHtml(emp.otroTiempoCalculado && emp.otroTiempoCalculado !== '0 años, 0 meses, 0 días' ? emp.otroTiempoCalculado : (emp.otroTiempoGobernacion || 'No registra experiencia previa o externa'))}
                  </div>
                  ${(emp.otroTiempoCalculado && emp.otroTiempoGobernacion && emp.otroTiempoGobernacion !== emp.otroTiempoCalculado && emp.otroTiempoGobernacion !== 'NO REGISTRADO') ? `
                    <div class="ficha-card-sub">Registro histórico original: <strong>${escHtml(emp.otroTiempoGobernacion)}</strong></div>
                  ` : ''}
                `}
              </div>
            </div>
          </div>

          <!-- ─── Tab 4: Formación & Contacto ─── -->
          <div class="ficha-tab-pane" id="ficha-contacto">
            <div class="ficha-grid">
              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🎓</div>
                  <span class="ficha-card-label">Estudios / Título Académico</span>
                </div>
                <div class="ficha-card-val" style="font-size:1.02rem;">
                  ${escHtml(sanitizeText(emp.estudios || 'No registrado'))}
                </div>
                <div class="ficha-card-sub">
                  Institución: <strong>${escHtml(sanitizeText(emp.institucionEstudios || 'No registrada'))}</strong>
                </div>
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📜</div>
                  <span class="ficha-card-label">Matrícula Profesional</span>
                </div>
                <div class="ficha-card-val font-mono">
                  ${emp.matriculaProfesional ? escHtml(emp.matriculaProfesional) : '<span style="color:var(--text-muted);">No registra</span>'}
                </div>
                <div class="ficha-card-sub">Tarjeta o número de registro profesional</div>
              </div>

              <div class="ficha-card ficha-grid--full">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📘</div>
                  <span class="ficha-card-label">Diplomados y Capacitación Técnica SENA</span>
                </div>
                <div class="ficha-card-val">
                  ${emp.tieneDiplomado
          ? `<span class="badge badge--success" style="font-size:12px; font-weight:700; padding:3px 8px;">Certificado SENA</span> <span style="font-weight:700; margin-left:6px;">${escHtml(emp.diplomadoCapSena || 'Certificación vigente')}</span>`
          : '<span style="color:var(--text-muted); font-size:0.9rem; font-weight:500;">No registra diplomados o cursos SENA certificados</span>'
        }
                </div>
              </div>

              <!-- Canales de Contacto Directo -->
              <div class="ficha-card ficha-grid--full ficha-card--featured" style="padding: 16px 18px;">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📞</div>
                  <span class="ficha-card-label" style="color:var(--color-navy);">Canales de Contacto Directo</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:6px;">
                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="font-size:12px; font-weight:700; color:var(--text-muted); min-width:90px;">Institucional:</span>
                    ${emp.correo ? `
                      <a href="mailto:${escHtml(emp.correo)}" class="ficha-contact-link" title="Escribir correo institucional">
                        ✉️ ${escHtml(emp.correo)}
                      </a>
                      <button class="ficha-copy-btn" id="btn-copy-mail-inst" onclick="EmployeesModule.copyFichaText('${escHtml(emp.correo)}', 'btn-copy-mail-inst')" title="Copiar correo">
                        Copiar
                      </button>
                    ` : '<span style="color:var(--text-muted); font-size:12px;">No registrado</span>'}
                  </div>

                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="font-size:12px; font-weight:700; color:var(--text-muted); min-width:90px;">Personal:</span>
                    ${emp.correoPersonal ? `
                      <a href="mailto:${escHtml(emp.correoPersonal)}" class="ficha-contact-link" title="Escribir correo personal">
                        📧 ${escHtml(emp.correoPersonal)}
                      </a>
                    ` : '<span style="color:var(--text-muted); font-size:12px;">No registrado</span>'}
                  </div>

                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="font-size:12px; font-weight:700; color:var(--text-muted); min-width:90px;">Teléfonos:</span>
                    ${(() => {
                      const telFijoClean = (emp.telefonoFijo || '').trim();
                      const hasTelFijo = telFijoClean && !['NO REGISTRADO', 'NO REPORTADO', 'N/A', 'NONE', 'NULL', '0', '-', '.'].includes(telFijoClean.toUpperCase());
                      const celulares = (Array.isArray(emp.celulares) && emp.celulares.length)
                        ? emp.celulares.filter(c => c && !['NO REGISTRADO', 'NO REPORTADO', 'N/A'].includes(c.toUpperCase()))
                        : (emp.celular && !['NO REGISTRADO', 'NO REPORTADO', 'N/A'].includes(emp.celular.toUpperCase()) ? [emp.celular] : []);

                      const pills = [];
                      celulares.forEach(c => {
                        pills.push(`<a href="tel:${escHtml(c)}" class="ficha-contact-link" title="Llamar: ${escHtml(c)}">📱 ${escHtml(c)}</a>`);
                      });
                      if (hasTelFijo) {
                        pills.push(`<a href="tel:${escHtml(telFijoClean)}" class="ficha-contact-link ficha-contact-link--fijo" title="Llamar: ${escHtml(telFijoClean)}">☎️ ${escHtml(telFijoClean)}</a>`);
                      }

                      return pills.length > 0
                        ? pills.join('')
                        : '<span style="color:var(--text-muted); font-size:12px;">No registrado</span>';
                    })()}
                  </div>

                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:2px;">
                    <span style="font-size:12px; font-weight:700; color:var(--text-muted); min-width:90px;">Residencia:</span>
                    <span style="font-size:13px; color:var(--text-primary);">
                      📍 ${escHtml(sanitizeText(emp.direccion || 'No registrada'))}, ${escHtml(sanitizeText(emp.ciudad || 'Tunja, Boyacá'))}
                    </span>
                  </div>
                </div>
              </div>

              <div class="ficha-card ficha-grid--full">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">📝</div>
                  <span class="ficha-card-label">Novedades y Observaciones de Personal</span>
                </div>
                <div class="ficha-card-val" style="font-weight:500; font-size:0.92rem; color:var(--text-secondary);">
                  ${escHtml(sanitizeText(emp.novedades || 'Sin novedades registradas a la fecha'))}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const actions = [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
    ];
    if (Auth.canEdit()) {
      actions.push({
        text: isVacante ? 'Editar Plaza' : 'Editar Servidor',
        cls: 'btn-gold',
        action: () => {
          App.closeModal();
          openEdit(idOrCedula);
        }
      });
    }
    App.openModal(isVacante ? 'Ficha de Plaza Vacante' : 'Ficha Integral del Servidor Público', content, actions, 'modal-ficha modal-lg');
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

  function switchFormTab(tabId) {
    const tabs = document.querySelectorAll('.form-tabs .form-tab-btn');
    const panes = document.querySelectorAll('.form-tab-pane');

    tabs.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    panes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    const modalBody = document.getElementById('modal-body');
    if (modalBody) {
      modalBody.scrollTop = 0;
    }
  }

  function markInvalidField(fieldOrId, message) {
    const el = typeof fieldOrId === 'string' ? document.getElementById(fieldOrId) : fieldOrId;
    if (!el) {
      if (message) App.showToast(message, 'error');
      return;
    }

    // Limpiar estados de error previos
    document.querySelectorAll('.input-invalid').forEach(inp => inp.classList.remove('input-invalid'));

    // Si el campo pertenece a una pestaña específica, cambiar a esa pestaña
    const pane = el.closest('.form-tab-pane');
    if (pane && pane.id) {
      switchFormTab(pane.id);
    }

    // Marcar campo en rojo visual con animación
    el.classList.add('input-invalid');

    // Desplazar la vista suavemente hasta el campo y hacer foco
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { el.focus(); } catch (_) { }
    }, 100);

    if (message) {
      App.showToast(message, 'error');
    }

    // Quitar automáticamente el resaltado rojo cuando el usuario interactúe
    const clearHandler = () => {
      el.classList.remove('input-invalid');
      el.removeEventListener('input', clearHandler);
      el.removeEventListener('change', clearHandler);
    };
    el.addEventListener('input', clearHandler);
    el.addEventListener('change', clearHandler);
  }

  async function openCreate() {
    await loadCatalogs();
    App.openModal('Nuevo Servidor Público', buildForm(), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Guardar Servidor', cls: 'btn-primary', id: 'emp-save-btn', action: saveCreate },
    ], 'modal-form-emp modal-lg');
    const box = document.querySelector('.modal-box');
    if (box) {
      box.classList.add('modal-form-emp', 'modal-lg');
      box.style.maxWidth = '860px';
      box.style.width = '92vw';
    }
    attachFormListeners();
  }

  async function openEdit(idOrCedula) {
    const norm = val => String(val || '').trim().replace(/[.,\s]/g, '');
    let emp = state.data.find(e => e.cedula === idOrCedula || e.id === idOrCedula || (e.cedula && idOrCedula && norm(e.cedula) === norm(idOrCedula)));
    try {
      const full = await API.getEmployeeByCedula(idOrCedula);
      if (full) emp = full;
    } catch (_) { }

    if (!emp) return;
    await loadCatalogs();
    App.openModal('Editar Servidor Público', buildForm(emp), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Actualizar Servidor', cls: 'btn-gold', id: 'emp-save-btn', action: () => saveEdit(idOrCedula) },
    ], 'modal-form-emp modal-lg');
    const box = document.querySelector('.modal-box');
    if (box) {
      box.classList.add('modal-form-emp', 'modal-lg');
      box.style.maxWidth = '860px';
      box.style.width = '92vw';
    }
    attachFormListeners(emp);
  }

  function buildForm(emp = {}) {
    const isVacante = Boolean(emp.es_vacante || emp.situacion === 'VACANTE' || (emp.nombreCompleto && emp.nombreCompleto.startsWith('PLAZA VACANTE')));
    const cats = state.catalogs;

    if (isVacante) {
      return `
        <div style="background: rgba(209, 173, 42, 0.12); border: 1px solid var(--color-mustard); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
          <div style="font-weight: 700; color: var(--color-rust); font-size: 13px; margin-bottom: 4px;">🏛 Plaza Vacante — Planta de Personal</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Para las plazas vacantes, solo se definen la dependencia y el cargo correspondiente.</div>
        </div>
        <div class="form-grid">
          <div class="form-group span-2">
            <label class="form-label" for="ef-nombre">Denominación de la Plaza *</label>
            <input id="ef-nombre" class="form-input" value="${escHtml(emp.nombreCompleto || 'PLAZA VACANTE')}" required />
          </div>
          <input type="hidden" id="ef-cedula" value="" />
          <div class="form-group span-2">
            <label class="form-label" for="ef-dep">Dependencia *</label>
            <select id="ef-dep" class="filter-select">
              <option value="">Seleccionar Dependencia...</option>
              ${cats.dependencias.map(d => `<option value="${escHtml(d)}" ${d === emp.dependencia ? 'selected' : ''}>${escHtml(d)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group span-2">
            <label class="form-label" for="ef-cargo">Cargo *</label>
            <select id="ef-cargo" class="filter-select">
              <option value="${escHtml(emp.cargoActual || '')}">${escHtml(emp.cargoActual || 'Seleccionar Cargo...')}</option>
            </select>
          </div>
        </div>`;
    }

    // Celulares existentes
    const celularesList = (Array.isArray(emp.celulares) && emp.celulares.length)
      ? emp.celulares
      : (emp.celular ? [emp.celular] : ['']);

    // Periodos de experiencia previa en la Gobernación
    const periodosList = (Array.isArray(emp.otroTiempoPeriodos) && emp.otroTiempoPeriodos.length)
      ? emp.otroTiempoPeriodos
      : [];

    return `
      <div class="emp-form-wrapper">
        <!-- BARRA ÚNICA DE NAVEGACIÓN HORIZONTAL (SIN NÚMEROS, SOLO EMOJI Y NOMBRE) -->
        <div class="form-tabs">
          <button type="button" class="form-tab-btn active" data-tab="tab-form-personales" onclick="EmployeesModule.switchFormTab('tab-form-personales')">
            <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Datos Personales
          </button>
          <button type="button" class="form-tab-btn" data-tab="tab-form-cargo" onclick="EmployeesModule.switchFormTab('tab-form-cargo')">
            <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            Cargo & Ubicación
          </button>
          <button type="button" class="form-tab-btn" data-tab="tab-form-tiempos" onclick="EmployeesModule.switchFormTab('tab-form-tiempos')">
            <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Tiempos de Servicio
          </button>
          <button type="button" class="form-tab-btn" data-tab="tab-form-formacion" onclick="EmployeesModule.switchFormTab('tab-form-formacion')">
            <svg style="width:15px;height:15px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
            Formación & Contacto
          </button>
        </div>

        <!-- ─── PESTAÑA: DATOS PERSONALES ─── -->
        <div id="tab-form-personales" class="form-tab-pane active" style="padding-top: 6px;">
          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label" for="ef-nombre">Nombres y Apellidos * <span style="font-size:11px; color:var(--text-muted);">(Solo admite letras y espacios)</span></label>
              <input id="ef-nombre" class="form-input" placeholder="Ej: PEREZ RODRIGUEZ JUAN CARLOS" value="${escHtml(emp.nombreCompleto || '')}" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-cedula">Cédula de Ciudadanía * <span style="font-size:11px; color:var(--text-muted);">(Solo números)</span></label>
              <input id="ef-cedula" class="form-input font-mono" placeholder="Ej: 1049603050" value="${escHtml(emp.cedula || '')}" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-sexo">Sexo <span style="font-size:11px; color:var(--text-muted);">(Opcional)</span></label>
              <select id="ef-sexo" class="filter-select">
                <option value="">(Sin especificar / Vacío)</option>
                ${cats.sexos.map(s => `<option value="${escHtml(s)}" ${emp.sexo && emp.sexo.toUpperCase().includes(s.substring(0, 3).toUpperCase()) ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-depto-exp">Depto. de Expedición Cédula</label>
              <select id="ef-depto-exp" class="filter-select">
                <option value="">Seleccionar Departamento...</option>
                ${cats.divipola.departamentos.map(dep => `<option value="${escHtml(dep)}" ${(emp.departamentoExpedicion || 'BOYACÁ') === dep ? 'selected' : ''}>${escHtml(dep)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-municipio-exp">Municipio de Expedición Cédula</label>
              <select id="ef-municipio-exp" class="filter-select">
                <option value="${escHtml(emp.municipioExpedicion || emp.ciudadExpedicion || '')}">${escHtml(emp.municipioExpedicion || emp.ciudadExpedicion || '(Sin seleccionar / Vacío)')}</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-tipo-sangre">Tipo de Sangre <span style="font-size:11px; color:var(--text-muted);">(Opcional)</span></label>
              <select id="ef-tipo-sangre" class="filter-select">
                <option value="">(Sin especificar / Vacío)</option>
                ${['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(ts => `<option value="${ts}" ${(emp.tipoSangre || '').toUpperCase() === ts ? 'selected' : ''}>${ts}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-fecha-nac">Fecha de Nacimiento</label>
              <input id="ef-fecha-nac" type="date" class="form-input" value="${escHtml(emp.fechaNacimiento || '')}" />
              <div id="ef-edad-calc-display" style="font-size:12px; color:var(--color-green-bright); font-weight:600; margin-top:4px;">
                ${emp.edadCalculada ? `Edad: ${escHtml(emp.edadCalculada)}` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- ─── PESTAÑA: CARGO Y UBICACIÓN ─── -->
        <div id="tab-form-cargo" class="form-tab-pane" style="padding-top: 6px;">
          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label" for="ef-dep">Dependencia <span style="font-size:11px; color:var(--text-muted);">(Opcional)</span></label>
              <select id="ef-dep" class="filter-select">
                <option value="">(Sin seleccionar / Vacío)</option>
                ${cats.dependencias.map(d => `<option value="${escHtml(d)}" ${d === emp.dependencia ? 'selected' : ''}>${escHtml(d)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group span-2">
              <label class="form-label" for="ef-cargo">Denominación del Cargo <span style="font-size:11px; color:var(--text-muted);">(Opcional, carga dinámica según dependencia)</span></label>
              <select id="ef-cargo" class="filter-select">
                <option value="${escHtml(emp.cargoActual || '')}">${escHtml(emp.cargoActual || '(Sin seleccionar / Vacío)')}</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-codigo-cargo">Código de Cargo <span style="font-size:11px; color:var(--text-muted);">(Opcional, letras o números)</span></label>
              <input id="ef-codigo-cargo" class="form-input font-mono" placeholder="Ej: 219, C-01, 100" value="${escHtml(emp.codigoActual || '')}" />
              <small id="ef-codigo-hint" style="font-size:11px; color:var(--text-muted);">Código alfanumérico asignado al cargo.</small>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-grado">Grado <span style="font-size:11px; color:var(--text-muted);">(Opcional)</span></label>
              <select id="ef-grado" class="filter-select">
                <option value="">(Sin Grado / Vacío)</option>
                ${cats.grados.map(g => `<option value="${escHtml(g)}" ${String(emp.gradoActual || '').toLowerCase() === String(g).toLowerCase() ? 'selected' : ''}>${escHtml(g)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-clasificacion">Tipo de Vinculación</label>
              <select id="ef-clasificacion" class="filter-select">
                ${cats.clasificaciones.map(c => `<option value="${escHtml(c)}" ${normalizarClasificacion(c) === normalizarClasificacion(emp.clasificacionEmpleo) ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-estado-servidor">Estado del Servidor</label>
              <select id="ef-estado-servidor" class="filter-select">
                ${cats.estadosServidor.map(es => `<option value="${escHtml(es)}" ${es.toLowerCase() === (emp.estadoServidor || 'Activo').toLowerCase() ? 'selected' : ''}>${escHtml(es)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-opec">OPEC <span style="font-size:11px; color:var(--text-muted);">(Texto o número)</span></label>
              <input id="ef-opec" class="form-input font-mono" placeholder="Número u OPEC" value="${escHtml(emp.opec || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-situacion">Situación Administrativa</label>
              <select id="ef-situacion" class="filter-select">
                <option value="ACTIVO" ${emp.situacion === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option>
                <option value="ENCARGO" ${emp.situacion === 'ENCARGO' ? 'selected' : ''}>ENCARGO</option>
                <option value="COMISIÓN" ${emp.situacion === 'COMISIÓN' ? 'selected' : ''}>COMISIÓN</option>
                <option value="LICENCIA" ${emp.situacion === 'LICENCIA' ? 'selected' : ''}>LICENCIA</option>
                <option value="VACACIONES" ${emp.situacion === 'VACACIONES' ? 'selected' : ''}>VACACIONES</option>
                <option value="DISCAPACIDAD" ${emp.situacion === 'DISCAPACIDAD' ? 'selected' : ''}>DISCAPACIDAD</option>
                <option value="RETIRADO" ${emp.situacion === 'RETIRADO' ? 'selected' : ''}>RETIRADO</option>
              </select>
            </div>

            <!-- Campo condicional de Discapacidad -->
            <div class="form-group span-2" id="ef-discapacidad-group" style="${emp.situacion === 'DISCAPACIDAD' ? '' : 'display:none;'}">
              <label class="form-label" for="ef-tipo-discapacidad" style="color:var(--color-gold); font-weight:700;">Tipo de Discapacidad <span style="font-size:11px; color:var(--text-muted);">(Opcional)</span></label>
              <select id="ef-tipo-discapacidad" class="filter-select">
                <option value="">(Sin especificar / Vacío)</option>
                ${cats.discapacidades.map(d => `<option value="${escHtml(d)}" ${emp.tipoDiscapacidad === d ? 'selected' : ''}>${escHtml(d)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- ─── PESTAÑA: TIEMPOS DE SERVICIO ─── -->
        <div id="tab-form-tiempos" class="form-tab-pane" style="padding-top: 6px;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="ef-fecha-ingreso">Fecha de Ingreso</label>
              <input id="ef-fecha-ingreso" type="date" class="form-input" value="${escHtml(emp.fechaIngreso || '')}" />
              <div id="ef-tiempo-calc-display" style="font-size:12px; color:var(--color-green-bright); font-weight:600; margin-top:4px;">
                ${emp.tiempoServicioCalculado ? `Tiempo: ${escHtml(emp.tiempoServicioCalculado)}` : ''}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-fecha-encargo">Fecha de Encargo</label>
              <input id="ef-fecha-encargo" type="date" class="form-input" value="${escHtml(emp.fechaEncargo || '')}" />
            </div>

            <div class="form-group span-2">
              <label class="form-label">Otro Tiempo con la Gobernación (Experiencia Múltiple) <span style="font-size:11px; color:var(--text-muted);">(Opcional, agregue periodos con fecha desde y hasta)</span></label>
              <div id="ef-periodos-container" style="display:flex; flex-direction:column; gap:8px;">
                ${periodosList.map((p, idx) => `
                  <div class="periodo-row" style="display:grid; grid-template-columns: 1fr 1fr 1.2fr auto; gap:8px; align-items:center; background:var(--color-bg-secondary); padding:8px 12px; border-radius:6px; border:1px solid var(--color-border);">
                    <div>
                      <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Desde *</label>
                      <input type="date" class="form-input ef-periodo-desde" value="${escHtml(p.desde || '')}" required />
                    </div>
                    <div>
                      <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Hasta *</label>
                      <input type="date" class="form-input ef-periodo-hasta" value="${escHtml(p.hasta || '')}" required />
                    </div>
                    <div style="font-size:12px; color:var(--color-green-bright); font-weight:600; padding-top:14px;" class="ef-periodo-duracion">
                      ${escHtml(p.duracionTexto || '')}
                    </div>
                    <div style="padding-top:14px;">
                      <button type="button" class="btn btn-secondary btn-sm btn-del-periodo" style="padding:4px 8px; color:var(--color-danger);" title="Eliminar periodo">🗑️</button>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-add-periodo" style="font-size:11px;">+ Agregar Periodo Histórico</button>
                <div id="ef-periodos-total-display" style="font-size:12px; font-weight:700; color:var(--color-green-bright);"></div>
              </div>
              <div id="ef-tiempo-total-display" style="display:none; font-size:12px; font-weight:700; color:var(--color-navy); margin-top:6px; padding:6px 10px; background:rgba(0,123,199,0.08); border:1px solid rgba(0,123,199,0.25); border-radius:6px;"></div>
              ${(emp.otroTiempoGobernacion && (!periodosList || periodosList.length === 0)) ? `
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                  Nota histórica anterior: <em>${escHtml(emp.otroTiempoGobernacion)}</em>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- ─── PESTAÑA: FORMACIÓN Y CONTACTO ─── -->
        <div id="tab-form-formacion" class="form-tab-pane" style="padding-top: 6px;">
          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label" for="ef-funciones">Funciones <span style="font-size:11px; color:var(--text-muted);">(00 a 999 o texto explicativo / decreto)</span></label>
              <input id="ef-funciones" class="form-input" placeholder="Ej: 01 o DECRETO 145 DE 2024" value="${escHtml(emp.funciones || '')}" />
            </div>

            <div class="form-group span-2">
              <label class="form-label" for="ef-novedades">Novedades <span style="font-size:11px; color:var(--text-muted);">(Texto libre)</span></label>
              <input id="ef-novedades" class="form-input" placeholder="Novedades del servidor" value="${escHtml(emp.novedades || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-estudios">Estudios (Pregrado)</label>
              <input id="ef-estudios" class="form-input" placeholder="Carrera o Título" value="${escHtml(emp.estudios || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-inst-estudios">Institución de Estudios</label>
              <input id="ef-inst-estudios" class="form-input" placeholder="Universidad / Institución" value="${escHtml(emp.institucionEstudios || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-matricula">Matrícula Profesional <span style="font-size:11px; color:var(--text-muted);">(Opcional: letras, números, guiones, etc.)</span></label>
              <input id="ef-matricula" class="form-input font-mono" placeholder="Ej: 15-28490-T, MP-1049" value="${escHtml(emp.matriculaProfesional || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-diplomado-toggle">Diplomado / Cap. SENA</label>
              <select id="ef-diplomado-toggle" class="filter-select">
                <option value="NO" ${emp.tieneDiplomado ? '' : 'selected'}>No tiene</option>
                <option value="SI" ${emp.tieneDiplomado ? 'selected' : ''}>Sí tiene</option>
              </select>
            </div>

            <!-- Desplegable de diplomados condicional -->
            <div class="form-group span-2" id="ef-diplomado-group" style="${emp.tieneDiplomado ? '' : 'display:none;'}">
              <label class="form-label" for="ef-diplomado-opt">Opciones de Diplomado / Capacitación</label>
              <select id="ef-diplomado-opt" class="filter-select">
                <option value="">Seleccionar Diplomado...</option>
                ${cats.diplomados.map(dip => `<option value="${escHtml(dip)}" ${emp.diplomadoCapSena === dip ? 'selected' : ''}>${escHtml(dip)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-telefono-fijo">Teléfono Fijo <span style="font-size:11px; color:var(--text-muted);">(6 a 12 dígitos)</span></label>
              <input id="ef-telefono-fijo" class="form-input font-mono" placeholder="Ej: 7401234" value="${escHtml(emp.telefonoFijo || '')}" />
            </div>

            <div class="form-group span-2">
              <label class="form-label">Teléfonos Celulares <span style="font-size:11px; color:var(--text-muted);">(Hasta 3 números, 9-10 dígitos c/u)</span></label>
              <div id="ef-celulares-container" style="display:flex; flex-direction:column; gap:8px;">
                ${celularesList.map((cel, idx) => `
                  <div class="celular-row" style="display:flex; align-items:center; gap:8px;">
                    <input class="form-input ef-celular-input font-mono" placeholder="Celular ${idx + 1} (9 o 10 dígitos)" value="${escHtml(cel)}" maxlength="10" />
                    ${idx > 0 ? `<button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()" style="padding:4px 8px;">✕</button>` : ''}
                  </div>
                `).join('')}
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-celular" style="margin-top:6px; font-size:11px;">+ Agregar otro celular</button>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-correo-inst">Correo Institucional <span style="font-size:11px; color:var(--text-muted);">(Opcional, exige @ si se ingresa)</span></label>
              <input id="ef-correo-inst" type="email" class="form-input font-mono" placeholder="usuario@boyaca.gov.co" value="${escHtml(emp.correo || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-correo-pers">Correo Personal <span style="font-size:11px; color:var(--text-muted);">(Exige @)</span></label>
              <input id="ef-correo-pers" type="email" class="form-input font-mono" placeholder="usuario@gmail.com" value="${escHtml(emp.correoPersonal || '')}" />
            </div>

            <div class="form-group span-2">
              <label class="form-label" for="ef-direccion">Dirección de Residencia</label>
              <input id="ef-direccion" class="form-input" placeholder="Dirección completa" value="${escHtml(emp.direccion || '')}" />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Conecta los listeners y comportamientos dinámicos e interactivos en el formulario
   */
  function attachFormListeners(emp = {}) {
    const cats = state.catalogs;

    // 1. Regla 7: Restricción en Nombres y Apellidos (Solo letras y espacios)
    const nombreInput = document.getElementById('ef-nombre');
    if (nombreInput) {
      nombreInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
      });
    }

    // 2. Regla 8: Restricción en Cédula (Solo números)
    const cedulaInput = document.getElementById('ef-cedula');
    if (cedulaInput) {
      cedulaInput.addEventListener('input', (e) => {
        // Permitir prefijo PROV si ya lo tenía
        if (e.target.value.startsWith('PROV-')) return;
        e.target.value = e.target.value.replace(/[^\d]/g, '');
      });
    }

    // 3. Regla 1: Dependencia y Cargo (Carga dinámica de cargos por dependencia)
    const depSelect = document.getElementById('ef-dep');
    const cargoSelect = document.getElementById('ef-cargo');
    const codigoInput = document.getElementById('ef-codigo-cargo');
    const gradoSelect = document.getElementById('ef-grado');

    const updateCargosForDep = (selectedDep, currentCargo = '') => {
      if (!cargoSelect) return;
      const cleanDep = (selectedDep || '').trim().toUpperCase();
      const availableCargos = cats.cargosPorDependencia[cleanDep] || cats.cargos || [];

      cargoSelect.innerHTML = '<option value="">Seleccionar Cargo...</option>' +
        availableCargos.map(c => `<option value="${escHtml(c.cargo)}" data-codigo="${escHtml(c.codigo || '')}" data-grado="${escHtml(c.grado || '')}" ${c.cargo === currentCargo ? 'selected' : ''}>${escHtml(c.cargo)}</option>`).join('');

      // Si el cargo actual no estaba en la lista de esa dependencia, agregarlo como opción
      if (currentCargo && !availableCargos.some(c => c.cargo === currentCargo)) {
        const opt = document.createElement('option');
        opt.value = currentCargo;
        opt.textContent = currentCargo;
        opt.selected = true;
        cargoSelect.appendChild(opt);
      }
    };

    if (depSelect) {
      depSelect.addEventListener('change', (e) => {
        updateCargosForDep(e.target.value);
      });
      if (emp.dependencia) {
        updateCargosForDep(emp.dependencia, emp.cargoActual || '');
      }
    }

    // 4. Al seleccionar el cargo, se autorrellena código (letras o números) y grado
    if (cargoSelect) {
      cargoSelect.addEventListener('change', () => {
        const selOpt = cargoSelect.selectedOptions[0];
        if (selOpt && codigoInput) {
          const defaultCode = selOpt.getAttribute('data-codigo');
          if (defaultCode) {
            codigoInput.value = defaultCode;
          }
          const defaultGrado = selOpt.getAttribute('data-grado');
          if (defaultGrado && gradoSelect) {
            const match = cats.grados.find(g => g.toLowerCase() === defaultGrado.toLowerCase());
            if (match) gradoSelect.value = match;
          }
        }
      });
    }

    // 5. Regla 10: Expedición de Cédula (Departamento -> Municipio dinámico vía DIVIPOLA)
    const deptoExpSelect = document.getElementById('ef-depto-exp');
    const mpioExpSelect = document.getElementById('ef-municipio-exp') || document.getElementById('ef-ciudad-exp');

    const updateMunicipiosForDepto = (selectedDepto, currentMpio = '') => {
      if (!mpioExpSelect) return;
      const cleanDepto = (selectedDepto || '').trim().toUpperCase();
      const mpios = cats.divipola.municipiosPorDepto[cleanDepto] || [];
      mpioExpSelect.innerHTML = '<option value="">Seleccionar Municipio...</option>' +
        mpios.map(c => `<option value="${escHtml(c)}" ${c === currentMpio ? 'selected' : ''}>${escHtml(c)}</option>`).join('');

      if (currentMpio && !mpios.includes(currentMpio)) {
        const opt = document.createElement('option');
        opt.value = currentMpio;
        opt.textContent = currentMpio;
        opt.selected = true;
        mpioExpSelect.appendChild(opt);
      }
    };

    if (deptoExpSelect) {
      deptoExpSelect.addEventListener('change', (e) => {
        updateMunicipiosForDepto(e.target.value);
      });
      const initDepto = emp.departamentoExpedicion || 'BOYACÁ';
      updateMunicipiosForDepto(initDepto, emp.municipioExpedicion || emp.ciudadExpedicion || 'TUNJA');
    }

    // 6. Regla 12: Situación y Discapacidad
    const situacionSelect = document.getElementById('ef-situacion');
    const discGroup = document.getElementById('ef-discapacidad-group');
    if (situacionSelect && discGroup) {
      situacionSelect.addEventListener('change', (e) => {
        if (e.target.value === 'DISCAPACIDAD') {
          discGroup.style.display = 'block';
        } else {
          discGroup.style.display = 'none';
        }
      });
    }

    // 7. Regla 19: Diplomado / Capacitación SENA
    const diplomadoToggle = document.getElementById('ef-diplomado-toggle');
    const diplomadoGroup = document.getElementById('ef-diplomado-group');
    if (diplomadoToggle && diplomadoGroup) {
      diplomadoToggle.addEventListener('change', (e) => {
        diplomadoGroup.style.display = e.target.value === 'SI' ? 'block' : 'none';
      });
    }

    // 8. Reglas 13 y 14: Cálculo en tiempo real de Edad y Tiempo de Servicio
    const fechaNacInput = document.getElementById('ef-fecha-nac');
    const edadDisplay = document.getElementById('ef-edad-calc-display');
    if (fechaNacInput && edadDisplay) {
      fechaNacInput.addEventListener('change', (e) => {
        edadDisplay.textContent = e.target.value ? `Edad: ${calcDateDiffExact(e.target.value)}` : '';
      });
    }

    const fechaIngInput = document.getElementById('ef-fecha-ingreso');
    const tiempoDisplay = document.getElementById('ef-tiempo-calc-display');
    if (fechaIngInput && tiempoDisplay) {
      fechaIngInput.addEventListener('change', (e) => {
        tiempoDisplay.textContent = e.target.value ? `Tiempo de Servicio: ${calcDateDiffExact(e.target.value)}` : '';
      });
    }

    // Manejo dinámico de Otro Tiempo con la Gobernación (Experiencia Múltiple)
    const periodosContainer = document.getElementById('ef-periodos-container');
    const btnAddPeriodo = document.getElementById('btn-add-periodo');
    const periodosTotalDisplay = document.getElementById('ef-periodos-total-display');

    const updatePeriodosTotal = () => {
      if (!periodosContainer || !periodosTotalDisplay) return;
      const rows = periodosContainer.querySelectorAll('.periodo-row');
      let totalAnios = 0, totalMeses = 0, totalDias = 0;
      let validCount = 0;

      rows.forEach(row => {
        const desde = row.querySelector('.ef-periodo-desde')?.value;
        const hasta = row.querySelector('.ef-periodo-hasta')?.value;
        const durDisplay = row.querySelector('.ef-periodo-duracion');

        if (desde && hasta) {
          const diff = calcExactDiffBetween(desde, hasta);
          if (diff) {
            if (durDisplay) {
              durDisplay.style.color = 'var(--color-green-bright)';
              durDisplay.textContent = diff.texto;
            }
            totalAnios += diff.anios;
            totalMeses += diff.meses;
            totalDias += diff.dias;
            validCount++;
          } else {
            if (durDisplay) {
              durDisplay.style.color = 'var(--color-danger)';
              durDisplay.textContent = 'Hasta debe ser ≥ Desde';
            }
          }
        } else {
          if (durDisplay) durDisplay.textContent = '';
        }
      });

      if (totalDias >= 30) {
        totalMeses += Math.floor(totalDias / 30);
        totalDias = totalDias % 30;
      }
      if (totalMeses >= 12) {
        totalAnios += Math.floor(totalMeses / 12);
        totalMeses = totalMeses % 12;
      }

      if (validCount > 0) {
        periodosTotalDisplay.textContent = `Otro Tiempo acumulado: ${totalAnios} años, ${totalMeses} meses, ${totalDias} días`;
      } else {
        periodosTotalDisplay.textContent = '';
      }

      // Cálculo dinámico de Tiempo Total en la Gobernación
      const tiempoTotalDisplay = document.getElementById('ef-tiempo-total-display');
      const fechaIngresoVal = document.getElementById('ef-fecha-ingreso')?.value;
      if (tiempoTotalDisplay) {
        let diffIngreso = null;
        if (fechaIngresoVal) {
          const diffStr = calcDateDiffExact(fechaIngresoVal);
          if (diffStr && diffStr !== 'No disponible') diffIngreso = diffStr;
        }
        const acumuladoOtro = validCount > 0 ? { anios: totalAnios, meses: totalMeses, dias: totalDias } : null;
        const totalCombined = sumExactDurations(diffIngreso, acumuladoOtro);

        if (totalCombined) {
          tiempoTotalDisplay.style.display = 'block';
          tiempoTotalDisplay.innerHTML = `🏆 <strong>Tiempo Total en la Gobernación Estimado:</strong> ${totalCombined.texto} <span style="font-size:11px; font-weight:normal; opacity:0.85;">(Servicio + Otro Tiempo)</span>`;
        } else {
          tiempoTotalDisplay.style.display = 'none';
        }
      }
    };

    const fechaIngresoInput = document.getElementById('ef-fecha-ingreso');
    if (fechaIngresoInput) {
      fechaIngresoInput.addEventListener('change', updatePeriodosTotal);
    }

    const bindPeriodoRow = (row) => {
      const desdeInp = row.querySelector('.ef-periodo-desde');
      const hastaInp = row.querySelector('.ef-periodo-hasta');
      const delBtn = row.querySelector('.btn-del-periodo');

      if (desdeInp) desdeInp.addEventListener('change', updatePeriodosTotal);
      if (hastaInp) hastaInp.addEventListener('change', updatePeriodosTotal);
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          row.remove();
          updatePeriodosTotal();
        });
      }
    };

    if (periodosContainer) {
      periodosContainer.querySelectorAll('.periodo-row').forEach(bindPeriodoRow);
      updatePeriodosTotal();
    }

    if (btnAddPeriodo && periodosContainer) {
      btnAddPeriodo.addEventListener('click', () => {
        const div = document.createElement('div');
        div.className = 'periodo-row';
        div.style = 'display:grid; grid-template-columns: 1fr 1fr 1.2fr auto; gap:8px; align-items:center; background:var(--color-bg-secondary); padding:8px 12px; border-radius:6px; border:1px solid var(--color-border);';
        div.innerHTML = `
          <div>
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Desde *</label>
            <input type="date" class="form-input ef-periodo-desde" required />
          </div>
          <div>
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Hasta *</label>
            <input type="date" class="form-input ef-periodo-hasta" required />
          </div>
          <div style="font-size:12px; color:var(--color-green-bright); font-weight:600; padding-top:14px;" class="ef-periodo-duracion"></div>
          <div style="padding-top:14px;">
            <button type="button" class="btn btn-secondary btn-sm btn-del-periodo" style="padding:4px 8px; color:var(--color-danger);" title="Eliminar periodo">🗑️</button>
          </div>
        `;
        periodosContainer.appendChild(div);
        bindPeriodoRow(div);
      });
    }

    // 9. Teléfono fijo (solo dígitos)
    const telFijoInput = document.getElementById('ef-telefono-fijo');
    if (telFijoInput) {
      telFijoInput.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d]/g, ''); });
    }

    // 10. Celular dinámico (hasta 3 números independientes de 9-10 dígitos)
    const btnAddCel = document.getElementById('btn-add-celular');
    const celContainer = document.getElementById('ef-celulares-container');

    const bindCelInput = (inp) => {
      inp.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^\d]/g, '');
      });
    };

    if (celContainer) {
      celContainer.querySelectorAll('.ef-celular-input').forEach(bindCelInput);
    }

    if (btnAddCel && celContainer) {
      btnAddCel.addEventListener('click', () => {
        const rows = celContainer.querySelectorAll('.celular-row');
        if (rows.length >= 3) {
          App.showToast('Solo se permite registrar hasta 3 números celulares independientes.', 'warning');
          return;
        }
        const div = document.createElement('div');
        div.className = 'celular-row';
        div.style = 'display:flex; align-items:center; gap:8px;';
        div.innerHTML = `
          <input class="form-input ef-celular-input font-mono" placeholder="Celular ${rows.length + 1} (9 o 10 dígitos)" maxlength="10" />
          <button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()" style="padding:4px 8px;">✕</button>
        `;
        celContainer.appendChild(div);
        bindCelInput(div.querySelector('.ef-celular-input'));
      });
    }
  }

  async function loadCatalogs() {
    try {
      const cats = await API.getEmployeeCatalogs();
      if (cats) {
        state.catalogs.dependencias = cats.dependencias || [];
        state.catalogs.cargos = cats.cargos || [];
        state.catalogs.cargosPorDependencia = cats.cargosPorDependencia || {};
        state.catalogs.divipola = cats.divipola || state.catalogs.divipola;
        state.catalogs.grados = cats.grados || state.catalogs.grados;
        state.catalogs.clasificaciones = cats.clasificaciones || state.catalogs.clasificaciones;
        state.catalogs.estadosServidor = cats.estadosServidor || state.catalogs.estadosServidor;
        state.catalogs.sexos = cats.sexos || state.catalogs.sexos;
        state.catalogs.discapacidades = cats.discapacidades || state.catalogs.discapacidades;
        state.catalogs.diplomados = cats.diplomados || state.catalogs.diplomados;
      }
    } catch (err) {
      console.warn('Error al cargar catálogos completos:', err);
    }
  }

  function readForm(isEdit = false) {
    const nombre = document.getElementById('ef-nombre')?.value.trim();
    const cedula = document.getElementById('ef-cedula')?.value.trim();

    // 1. Validar Nombres y Apellidos (OBLIGATORIO: solo letras y espacios)
    if (!nombre) {
      markInvalidField('ef-nombre', 'Nombres y Apellidos son obligatorios.');
      return null;
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(nombre)) {
      markInvalidField('ef-nombre', 'Nombres y Apellidos solo admiten letras y espacios.');
      return null;
    }

    // 2. Validar Cédula de Ciudadanía (OBLIGATORIA: solo números, salvo en vacantes)
    const isVacanteForm = document.getElementById('ef-cedula')?.type === 'hidden' || (nombre && nombre.startsWith('PLAZA VACANTE'));
    if (!isVacanteForm) {
      if (!cedula) {
        markInvalidField('ef-cedula', 'La Cédula de Ciudadanía es obligatoria.');
        return null;
      }
      if (!/^\d+$/.test(cedula) && !/^PROV-\d+$/i.test(cedula)) {
        markInvalidField('ef-cedula', 'La Cédula debe contener únicamente números.');
        return null;
      }
    }

    // 3. Tipo de Sangre (Opcional; si tiene valor valida entre las 8 opciones permitidas)
    const tipoSangreRaw = document.getElementById('ef-tipo-sangre')?.value.trim().toUpperCase();
    let tipoSangre = null;
    if (tipoSangreRaw) {
      if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(tipoSangreRaw)) {
        markInvalidField('ef-tipo-sangre', 'Tipo de Sangre inválido. Seleccione una opción válida (A+, A-, B+, B-, AB+, AB-, O+, O-).');
        return null;
      }
      tipoSangre = tipoSangreRaw;
    }

    // 4. Código de cargo (Opcional; puede contener letras, números, etc.)
    const codigoCargo = document.getElementById('ef-codigo-cargo')?.value.trim() || null;

    // 5. Grado (Opcional)
    const grado = document.getElementById('ef-grado')?.value || null;

    // 6. Sexo (Opcional)
    const sexo = document.getElementById('ef-sexo')?.value || null;

    // 7. Situación y Discapacidad (Opcionales)
    const situacion = document.getElementById('ef-situacion')?.value || 'ACTIVO';
    let tipoDiscapacidad = null;
    if (situacion === 'DISCAPACIDAD') {
      tipoDiscapacidad = document.getElementById('ef-tipo-discapacidad')?.value || null;
    }

    // 8. Periodos de Otro Tiempo con la Gobernación (Experiencia Múltiple, Opcional)
    const periodoRows = document.querySelectorAll('.periodo-row');
    const otroTiempoPeriodos = [];
    for (let i = 0; i < periodoRows.length; i++) {
      const row = periodoRows[i];
      const desdeInp = row.querySelector('.ef-periodo-desde');
      const hastaInp = row.querySelector('.ef-periodo-hasta');
      const desde = desdeInp?.value.trim();
      const hasta = hastaInp?.value.trim();

      if (!desde && !hasta) continue; // Fila vacía se ignora

      if (!desde) {
        markInvalidField(desdeInp, `En el periodo #${i + 1}, la fecha inicial (desde) es obligatoria.`);
        return null;
      }
      if (!hasta) {
        markInvalidField(hastaInp, `En el periodo #${i + 1}, la fecha final (hasta) es obligatoria.`);
        return null;
      }
      if (hasta < desde) {
        markInvalidField(hastaInp, `En el periodo #${i + 1}, la fecha final (${hasta}) debe ser mayor o igual a la inicial (${desde}).`);
        return null;
      }

      otroTiempoPeriodos.push({ desde, hasta });
    }

    // 9. Celulares (Opcionales, hasta 3 números independientes de 9-10 dígitos)
    const celularInputs = document.querySelectorAll('.ef-celular-input');
    const celulares = [];
    for (const inp of celularInputs) {
      const val = inp.value.trim().replace(/[^\d]/g, '');
      if (val) {
        if (val.length < 9 || val.length > 10) {
          markInvalidField(inp, `El celular "${val}" debe tener entre 9 y 10 dígitos.`);
          return null;
        }
        celulares.push(val);
      }
    }

    // 10. Teléfono fijo (Opcional, 6 a 12 dígitos)
    const telFijoInp = document.getElementById('ef-telefono-fijo');
    const telefonoFijo = telFijoInp?.value.trim().replace(/[^\d]/g, '');
    if (telefonoFijo && (telefonoFijo.length < 6 || telefonoFijo.length > 12)) {
      markInvalidField(telFijoInp, 'El teléfono fijo debe contener entre 6 y 12 dígitos numéricos.');
      return null;
    }

    // 11. Correo institucional (Opcional, solo valida @ si se ingresa)
    const correoInp = document.getElementById('ef-correo-inst');
    const correo = correoInp?.value.trim();
    if (correo && !correo.includes('@')) {
      markInvalidField(correoInp, 'El Correo Institucional debe contener "@".');
      return null;
    }

    // 12. Correo personal (Opcional, solo valida @ si se ingresa)
    const correoPersInp = document.getElementById('ef-correo-pers');
    const correoPersonal = correoPersInp?.value.trim();
    if (correoPersonal && !correoPersonal.includes('@')) {
      markInvalidField(correoPersInp, 'El Correo Personal debe contener "@".');
      return null;
    }

    const tieneDiplomado = document.getElementById('ef-diplomado-toggle')?.value === 'SI';
    const diplomadoCapSena = tieneDiplomado ? (document.getElementById('ef-diplomado-opt')?.value || 'Diplomado Registrado') : null;

    const mpioVal = document.getElementById('ef-municipio-exp')?.value || document.getElementById('ef-ciudad-exp')?.value || null;

    // Matrícula profesional (admite letras, números, guiones, etc.)
    const matricula = document.getElementById('ef-matricula')?.value.trim() || null;

    return {
      nombreCompleto: nombre,
      cedula: cedula || '',
      nuevaCedula: cedula || '',
      departamentoExpedicion: document.getElementById('ef-depto-exp')?.value || null,
      municipioExpedicion: mpioVal,
      ciudadExpedicion: mpioVal,
      sexo,
      tipoSangre,
      fechaNacimiento: document.getElementById('ef-fecha-nac')?.value || null,
      dependencia: document.getElementById('ef-dep')?.value || null,
      cargoActual: document.getElementById('ef-cargo')?.value || null,
      codigoCargo: codigoCargo || null,
      grado: grado || null,
      clasificacionEmpleo: normalizarClasificacion(document.getElementById('ef-clasificacion')?.value || 'Carrera Administrativa'),
      estadoServidor: document.getElementById('ef-estado-servidor')?.value || 'Activo',
      opec: document.getElementById('ef-opec')?.value.trim() || null,
      situacion,
      tipoDiscapacidad,
      fechaIngreso: document.getElementById('ef-fecha-ingreso')?.value || null,
      fechaEncargo: document.getElementById('ef-fecha-encargo')?.value || null,
      otroTiempoPeriodos,
      otroTiempoGobernacion: document.getElementById('ef-periodos-total-display')?.textContent.replace('Otro Tiempo acumulado: ', '') || null,
      funciones: document.getElementById('ef-funciones')?.value.trim() || null,
      novedades: document.getElementById('ef-novedades')?.value.trim() || null,
      estudios: document.getElementById('ef-estudios')?.value.trim() || null,
      institucionEstudios: document.getElementById('ef-inst-estudios')?.value.trim() || null,
      matriculaProfesional: matricula,
      tieneDiplomado,
      diplomadoCapSena,
      telefonoFijo: telefonoFijo || null,
      celular: celulares[0] || null,
      celulares,
      correo: correo || null,
      correoPersonal: correoPersonal || null,
      direccion: document.getElementById('ef-direccion')?.value.trim() || null
    };
  }

  async function saveCreate() {
    const body = readForm(false);
    if (!body) return;
    const btn = document.getElementById('emp-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      const res = await API.createEmployee(body);
      App.closeModal();
      const msgCc = res.documento_pendiente ? ` (Se asignó ID Temporal ${res.cedula})` : '';
      App.showToast(`Servidor registrado exitosamente.${msgCc}`, 'success');
      await load();
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('cédula')) {
        markInvalidField('ef-cedula', err.message);
      } else {
        App.showToast(err.message, 'error');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar Servidor'; }
    }
  }

  async function saveEdit(idOrCedula) {
    const body = readForm(true);
    if (!body) return;
    const btn = document.getElementById('emp-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
    try {
      await API.updateEmployee(idOrCedula, body);
      App.closeModal();
      App.showToast('Servidor actualizado exitosamente.', 'success');
      await load();
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('cédula')) {
        markInvalidField('ef-cedula', err.message);
      } else {
        App.showToast(err.message, 'error');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Actualizar Servidor'; }
    }
  }

  function confirmDelete(idOrCedula, nombre) {
    App.openModal('Confirmar Eliminación', `
      <div style="padding: 6px 4px;">
        <p style="color:var(--text-secondary); margin: 0 0 14px; font-size: 14px; line-height: 1.6;">
          ¿Está seguro de que desea eliminar al servidor público <strong style="color:var(--text-primary); font-weight: 700;">${escHtml(nombre)}</strong>?
        </p>
        <div style="background: rgba(227, 36, 49, 0.08); border: 1px solid rgba(227, 36, 49, 0.25); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px; line-height: 1;">⚠️</span>
          <span style="color: var(--color-danger); font-size: 12.5px; font-weight: 600; line-height: 1.4;">
            Esta acción eliminará el registro de manera definitiva y no se puede deshacer.
          </span>
        </div>
      </div>
    `, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      {
        text: 'Eliminar Servidor',
        cls: 'btn-danger',
        id: 'btn-confirm-delete-emp',
        action: async () => {
          const deleteBtn = document.getElementById('btn-confirm-delete-emp');
          const footerEl = document.getElementById('modal-footer');
          const titleEl = document.getElementById('modal-title');
          const bodyEl = document.getElementById('modal-body');

          if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = `
              <span class="btn-progress-pulse" aria-hidden="true"></span>
              Eliminando...
            `;
          }

          try {
            await API.deleteEmployee(idOrCedula);
            await load();

            if (titleEl) {
              titleEl.textContent = 'Servidor Eliminado';
            }

            if (bodyEl) {
              bodyEl.innerHTML = `
                <div style="text-align: center; padding: 18px 10px 12px;">
                  <div style="width: 54px; height: 54px; margin: 0 auto 16px; border-radius: 50%; background: rgba(40, 135, 27, 0.12); border: 2px solid rgba(40, 135, 27, 0.4); display: flex; align-items: center; justify-content: center; color: var(--color-success);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 26px; height: 26px;">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <h3 style="font-size: 16px; font-weight: 800; color: var(--text-primary); margin: 0 0 8px;">
                    Servidor Eliminado Exitosamente
                  </h3>
                  <p style="color: var(--text-secondary); font-size: 13.5px; line-height: 1.5; margin: 0;">
                    El servidor público <strong style="color: var(--text-primary); font-weight: 700;">${escHtml(nombre)}</strong> ha sido eliminado del sistema.
                  </p>
                </div>
              `;
            }

            if (footerEl) {
              footerEl.innerHTML = `
                <button type="button" class="btn btn-primary" id="btn-accept-emp-deleted" style="min-width: 140px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Aceptar
                </button>
              `;

              const acceptBtn = footerEl.querySelector('#btn-accept-emp-deleted');
              if (acceptBtn) {
                acceptBtn.onclick = () => {
                  App.closeModal();
                  App.showToast('Servidor eliminado exitosamente.', 'success');
                };
                acceptBtn.focus();
              }
            }
          } catch (err) {
            App.showToast(err.message || 'Error al eliminar el servidor.', 'error');
            if (deleteBtn) {
              deleteBtn.disabled = false;
              deleteBtn.textContent = 'Eliminar Servidor';
            }
          }
        }
      },
    ]);
  }

  function goPage(p) {
    if (p < 1 || p > state.totalPages) return;
    state.page = p;
    load();
  }

  /**
   * Regla 7: Para la función de descarga a Excel, el sistema debe exportarlo en dos columnas:
   * una casilla para los "Apellidos" (ambos) y otra casilla para los "Nombres" (ambos).
   * Se exportan la totalidad de los datos y dimensiones gestionados en la plataforma.
   */
  const EXCEL_COLUMNS = [
    // ── 1. Identificación Personal ──
    { header: 'Apellidos', key: 'apellidos', width: 24, sample: 'PEREZ RODRIGUEZ' },
    { header: 'Primer Apellido', key: 'primerApellido', width: 20, sample: 'PEREZ' },
    { header: 'Segundo Apellido', key: 'segundoApellido', width: 20, sample: 'RODRIGUEZ' },
    { header: 'Nombres', key: 'nombres', width: 24, sample: 'JUAN CARLOS' },
    { header: 'Nombre Completo', key: 'nombreCompleto', width: 32, sample: 'JUAN CARLOS PEREZ RODRIGUEZ' },
    { header: 'Cédula / Documento', key: 'cedula', width: 18, sample: '1049601234' },
    { header: 'Cédula Formato Visual', key: 'cedulaVisual', width: 20, sample: '1.049.601.234' },
    { header: '¿Doc. Pendiente?', key: 'documento_pendiente', width: 16, sample: 'NO' },
    { header: '¿Es Plaza Vacante?', key: 'es_vacante', width: 18, sample: 'NO' },
    { header: 'Código Plaza Vacante', key: 'codigoVacante', width: 22, sample: 'PLAZA VACANTE 0001' },
    { header: 'Sexo', key: 'sexo', width: 14, sample: 'MASCULINO' },
    { header: 'Tipo de Sangre (RH)', key: 'tipoSangre', width: 16, sample: 'O+' },
    { header: 'Tipo de Discapacidad', key: 'tipoDiscapacidad', width: 22, sample: 'VISUAL / NINGUNA' },
    { header: 'Fecha de Nacimiento', key: 'fechaNacimiento', width: 18, sample: '1985-05-15' },
    { header: 'Edad Calculada', key: 'edadCalculada', width: 26, sample: '38 años, 9 meses, 20 días' },
    { header: 'Depto. Expedición', key: 'departamentoExpedicion', width: 20, sample: 'BOYACÁ' },
    { header: 'Municipio Expedición', key: 'municipioExpedicion', width: 22, sample: 'TUNJA' },

    // ── 2. Información Laboral e Institucional ──
    { header: 'Estado Servidor', key: 'estadoServidor', width: 16, sample: 'Activo' },
    { header: 'Situación Administrativa', key: 'situacion', width: 22, sample: 'ACTIVO' },
    { header: 'Dependencia / Secretaría', key: 'dependencia', width: 34, sample: 'SECRETARÍA DE HACIENDA' },
    { header: 'Denominación Cargo Actual', key: 'cargoActual', width: 32, sample: 'PROFESIONAL UNIVERSITARIO' },
    { header: 'Código Cargo Actual', key: 'codigoActual', width: 18, sample: '219' },
    { header: 'Grado Cargo Actual', key: 'gradoActual', width: 16, sample: '03' },
    { header: 'Cargo Base / Titular', key: 'cargoBase', width: 30, sample: 'TÉCNICO OPERATIVO' },
    { header: 'Código Cargo Base', key: 'codigoBase', width: 16, sample: '314' },
    { header: 'Grado Cargo Base', key: 'gradoBase', width: 14, sample: '01' },
    { header: 'Tipo de Vinculación', key: 'clasificacionEmpleo', width: 28, sample: 'CARRERA ADMINISTRATIVA' },
    { header: 'Fecha de Ingreso', key: 'fechaIngreso', width: 18, sample: '2018-02-01' },
    { header: 'Tiempo Servicio Cargo Actual', key: 'tiempoServicioCalculado', width: 28, sample: '6 años, 2 meses, 4 días' },
    { header: 'Fecha de Encargo', key: 'fechaEncargo', width: 18, sample: '2021-06-15' },
    { header: 'Otro Tiempo Gobernación', key: 'otroTiempoGobernacion', width: 26, sample: '2 años, 1 meses, 15 días' },
    { header: 'Otro Tiempo Calculado', key: 'otroTiempoCalculado', width: 26, sample: '2 años, 1 meses, 15 días' },
    { header: 'Detalle Periodos Previos', key: 'periodosPrevios', width: 36, sample: '2015-01-01 a 2017-06-30' },
    { header: 'Tiempo Total en la Gobernación', key: 'tiempoTotalGobernacion', width: 32, sample: '8 años, 3 meses, 19 días' },
    { header: 'Funciones del Cargo', key: 'funciones', width: 22, sample: '01' },
    { header: 'Código OPEC', key: 'opec', width: 16, sample: '12345' },

    // ── 3. Formación Académica y Certificaciones ──
    { header: 'Nivel / Título Profesional', key: 'estudios', width: 30, sample: 'ADMINISTRACIÓN DE EMPRESAS' },
    { header: 'Institución de Estudios', key: 'institucionEstudios', width: 28, sample: 'UPTC' },
    { header: 'Matrícula Profesional', key: 'matriculaProfesional', width: 22, sample: 'TP-123456' },
    { header: 'Postgrado / Especialización', key: 'postgrado', width: 30, sample: 'GERENCIA PÚBLICA' },
    { header: 'Institución de Postgrado', key: 'institucionPostgrado', width: 28, sample: 'ESAP' },
    { header: '¿Tiene Diplomado / Cap. SENA?', key: 'tieneDiplomado', width: 24, sample: 'SÍ' },
    { header: 'Diplomado / Cap. SENA Realizada', key: 'diplomadoCapSena', width: 32, sample: 'MIPG Y CONTRATACIÓN ESTATAL' },

    // ── 4. Contacto y Localización ──
    { header: 'Teléfonos Celulares', key: 'celularesStr', width: 30, sample: '3101234567 / 3209876543' },
    { header: 'Teléfono Fijo', key: 'telefonoFijo', width: 18, sample: '7401234' },
    { header: 'Correo Institucional', key: 'correo', width: 30, sample: 'juan.perez@boyaca.gov.co' },
    { header: 'Correo Personal', key: 'correoPersonal', width: 30, sample: 'juanperez@gmail.com' },
    { header: 'Dirección de Residencia', key: 'direccion', width: 30, sample: 'CALLE 20 # 10-40' },
    { header: 'Ciudad de Residencia', key: 'ciudad', width: 22, sample: 'TUNJA' },
    { header: 'Novedades / Observaciones', key: 'novedades', width: 35, sample: 'SIN NOVEDAD' }
  ];

  async function exportExcel() {
    try {
      App.showToast('Generando archivo Excel con todos los datos de la plataforma...', 'info');
      const res = await API.getEmployees({ q: state.q, page: 1, limit: 10000 });
      const recordsRaw = res.data || state.data;

      // Mapeo exhaustivo de todos los campos de la plataforma
      const records = recordsRaw.map(e => {
        let apellidos = e.apellidos;
        let nombres = e.nombres;
        if (!apellidos && e.nombreCompleto) {
          const parts = e.nombreCompleto.split(' ');
          apellidos = parts.slice(0, 2).join(' ');
          nombres = parts.slice(2).join(' ') || parts[0];
        }
        const celularesStr = (Array.isArray(e.celulares) && e.celulares.length)
          ? e.celulares.join(' / ')
          : (e.celular || '—');

        // Formatear tipo de discapacidad
        let disc = e.tipoDiscapacidad ? String(e.tipoDiscapacidad).trim() : '';
        if (!disc || disc.toLowerCase() === 'ninguna' || disc.toLowerCase() === 'ninguno') {
          disc = 'NINGUNA';
        } else {
          disc = disc.toUpperCase();
        }

        // Formatear periodos de experiencia previa si existen
        let periodosPrevios = '—';
        if (Array.isArray(e.otroTiempoPeriodos) && e.otroTiempoPeriodos.length) {
          periodosPrevios = e.otroTiempoPeriodos.map(p => {
            const fIni = p.fechaInicio || p.inicio || '';
            const fFin = p.fechaFin || p.fin || '';
            const dif = p.tiempoCalculado || p.duracion || '';
            return `${fIni} a ${fFin}${dif ? ' (' + dif + ')' : ''}`;
          }).join('; ');
        } else if (e.otroTiempoGobernacion && e.otroTiempoGobernacion !== '0 años, 0 meses, 0 días') {
          periodosPrevios = e.otroTiempoGobernacion;
        }

        return {
          ...e,
          apellidos: apellidos || (e.es_vacante ? 'VACANTE' : '—'),
          primerApellido: e.primerApellido || (e.es_vacante ? 'VACANTE' : '—'),
          segundoApellido: e.segundoApellido || (e.es_vacante ? '' : '—'),
          nombres: nombres || (e.es_vacante ? 'PLAZA VACANTE' : '—'),
          nombreCompleto: e.nombreCompleto || '—',
          cedula: e.cedula || (e.es_vacante ? 'PLAZA VACANTE' : 'SIN CÉDULA'),
          cedulaVisual: e.cedulaVisual || (e.es_vacante ? 'PLAZA VACANTE' : (e.cedula || '—')),
          documento_pendiente: e.documento_pendiente ? 'SÍ' : 'NO',
          es_vacante: e.es_vacante ? 'SÍ' : 'NO',
          codigoVacante: e.codigoVacante || (e.es_vacante ? 'PLAZA VACANTE' : '—'),
          tipoDiscapacidad: disc,
          sexo: e.sexo || '—',
          tipoSangre: e.tipoSangre || '—',
          fechaNacimiento: e.fechaNacimiento || '—',
          edadCalculada: e.edadCalculada || 'No disponible',
          departamentoExpedicion: e.departamentoExpedicion || '—',
          municipioExpedicion: e.municipioExpedicion || e.ciudadExpedicion || '—',
          estadoServidor: e.estadoServidor || 'Activo',
          situacion: e.situacion || 'ACTIVO',
          dependencia: e.dependencia || '—',
          cargoActual: e.cargoActual || '—',
          codigoActual: e.codigoActual || '—',
          gradoActual: e.gradoActual || '—',
          cargoBase: e.cargoBase || '—',
          codigoBase: e.codigoBase || '—',
          gradoBase: e.gradoBase || '—',
          clasificacionEmpleo: e.clasificacionEmpleo || '—',
          fechaIngreso: e.fechaIngreso || '—',
          tiempoServicioCalculado: e.tiempoServicioCalculado || 'No disponible',
          fechaEncargo: e.fechaEncargo || '—',
          otroTiempoGobernacion: e.otroTiempoGobernacion || '—',
          otroTiempoCalculado: e.otroTiempoCalculado || '0 años, 0 meses, 0 días',
          periodosPrevios: periodosPrevios,
          tiempoTotalGobernacion: e.tiempoTotalGobernacion || e.tiempoServicioCalculado || 'No disponible',
          funciones: e.funciones || '—',
          opec: e.opec || '—',
          estudios: e.estudios || '—',
          institucionEstudios: e.institucionEstudios || '—',
          matriculaProfesional: e.matriculaProfesional || '—',
          postgrado: e.postgrado || '—',
          institucionPostgrado: e.institucionPostgrado || '—',
          tieneDiplomado: (e.tieneDiplomado || (e.diplomadoCapSena && e.diplomadoCapSena !== 'NINGUNO')) ? 'SÍ' : 'NO',
          diplomadoCapSena: e.diplomadoCapSena || '—',
          celularesStr,
          telefonoFijo: e.telefonoFijo || '—',
          correo: e.correo || '—',
          correoPersonal: e.correoPersonal || '—',
          direccion: e.direccion || '—',
          ciudad: e.ciudad || '—',
          novedades: e.novedades || '—'
        };
      });

      ExcelService.exportToExcel({
        filename: 'Talento360_Servidores_Publicos',
        sheetName: 'Servidores Públicos',
        columns: EXCEL_COLUMNS,
        data: records
      });
      App.showToast(`Se exportaron exitosamente ${records.length} servidores públicos con todos los campos de la plataforma.`, 'success');
    } catch (err) {
      App.showToast('Error al exportar a Excel: ' + err.message, 'error');
    }
  }

  function openImportModal() {
    const existing = document.getElementById('excel-emp-modal-overlay');
    if (existing) existing.remove();

    let selectedFile = null;

    const overlay = document.createElement('div');
    overlay.id = 'excel-emp-modal-overlay';
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
              Carga Masiva de Servidores Públicos
            </h2>
            <p class="modal-desc">Cargue un archivo Excel (.xlsx o .xls) para importar o actualizar servidores públicos en el sistema.</p>
          </div>
          <button class="modal-close" id="btn-close-emp-import">&times;</button>
        </div>

        <div class="modal-body" style="padding: 20px 24px; max-height: 75vh; overflow-y: auto;">
          <!-- Sección de Selección y Confirmación de Archivo -->
          <div id="emp-upload-section">
            <div class="excel-dropzone" id="emp-excel-dropzone">
              <input type="file" id="emp-excel-file-input" accept=".xlsx, .xls" style="display:none;" />
              <div class="excel-dropzone-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-green-bright)" stroke-width="2" style="width:48px;height:48px;">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <p class="excel-dropzone-title" id="dropzone-main-text">
                Haz clic para seleccionar o arrastra aquí tu archivo Excel
              </p>
              <p class="excel-dropzone-sub">
                Formatos soportados: archivos Excel (.xlsx, .xls)
              </p>
            </div>

            <!-- Previsualización del archivo seleccionado con opción de cancelar/cambiar -->
            <div id="emp-file-preview" style="display:none; margin-top: 16px;">
              <div class="excel-file-preview-card">
                <div class="excel-file-preview-left">
                  <div class="excel-file-preview-icon">
                    📊
                  </div>
                  <div class="excel-file-preview-info">
                    <div id="emp-file-name" class="excel-file-preview-name"></div>
                    <div id="emp-file-size" class="excel-file-preview-size"></div>
                  </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-change-file" style="font-size: 12px; padding: 6px 14px; font-weight: 600;">
                  Cambiar archivo
                </button>
              </div>

              <!-- Cuadro Informativo de Confirmación Previa -->
              <div class="excel-notice-card">
                <div class="excel-notice-icon">📋</div>
                <div class="excel-notice-content">
                  <strong>Confirmación de Carga Masiva</strong>
                  <p>Al confirmar la importación, se procesarán los registros del archivo para crear o actualizar los servidores públicos en la base de datos institucional.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Mensaje de Aceptación y Resultados (Aparece tras procesar con éxito) -->
          <div id="emp-import-result" style="display:none;"></div>
        </div>

        <div class="modal-footer" id="emp-import-footer" style="padding: 16px 24px; display:flex; justify-content:flex-end; gap:12px; border-top: 1px solid var(--color-border);">
          <button type="button" class="btn btn-secondary" id="btn-cancel-emp-import">Cancelar</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-emp-import" disabled style="display:inline-flex; align-items:center; gap:8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span id="btn-confirm-emp-text">Confirmar Importación</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#btn-close-emp-import');
    const cancelBtn = overlay.querySelector('#btn-cancel-emp-import');
    const dropzone = overlay.querySelector('#emp-excel-dropzone');
    const fileInput = overlay.querySelector('#emp-excel-file-input');
    const filePreview = overlay.querySelector('#emp-file-preview');
    const fileNameEl = overlay.querySelector('#emp-file-name');
    const fileSizeEl = overlay.querySelector('#emp-file-size');
    const changeFileBtn = overlay.querySelector('#btn-change-file');
    const confirmBtn = overlay.querySelector('#btn-confirm-emp-import');
    const confirmText = overlay.querySelector('#btn-confirm-emp-text');
    const uploadSection = overlay.querySelector('#emp-upload-section');
    const resultDiv = overlay.querySelector('#emp-import-result');
    const modalFooter = overlay.querySelector('#emp-import-footer');

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

      // Mostrar previsualización y cuadro de confirmación
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

    // Acción al confirmar la importación
    confirmBtn.addEventListener('click', async () => {
      if (!selectedFile) return;

      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      confirmText.innerHTML = `
        <span class="btn-progress-pulse" aria-hidden="true"></span>
        Procesando Carga Masiva...
      `;
      App.showToast('Procesando archivo masivo... Por favor espere.', 'info');

      try {
        const res = await API.uploadEmployeesExcel(selectedFile);
        if (typeof Fx !== 'undefined' && Fx.play) Fx.play('success');

        const { resumen = {}, errores = [], hojasProcesadas = [] } = res;

        // Ocultar sección de carga y mostrar mensaje de aceptación + resumen
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
                ${hojasProcesadas.length} Hoja(s) Procesada(s)
              </span>
            </div>

            <div class="excel-kpi-grid">
              <div class="excel-kpi-tile excel-kpi-tile--total">
                <span class="excel-kpi-label">Total Filas</span>
                <span class="excel-kpi-value">${resumen.totalFilas || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--inserted">
                <span class="excel-kpi-label">Nuevos Registros</span>
                <span class="excel-kpi-value">${resumen.insertados || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--updated">
                <span class="excel-kpi-label">Actualizados</span>
                <span class="excel-kpi-value">${resumen.actualizados || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--provisional">
                <span class="excel-kpi-label">IDs Temporales</span>
                <span class="excel-kpi-value">${resumen.provisionales || 0}</span>
              </div>
              <div class="excel-kpi-tile excel-kpi-tile--vacant">
                <span class="excel-kpi-label">Plazas Vacantes</span>
                <span class="excel-kpi-value">${resumen.vacantes || 0}</span>
              </div>
            </div>

            ${errores.length > 0 ? `
              <div class="excel-error-log-card">
                <strong class="excel-error-log-title">Observaciones / Inconsistencias (${errores.length}):</strong>
                <ul class="excel-error-log-list">
                  ${errores.slice(0, 30).map(e => `<li>Fila ${e.fila} (CC: ${escHtml(e.cedula)}): ${escHtml(e.error)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;

        // Botón único "Aceptar" para cerrar la ventana y refrescar la vista
        modalFooter.innerHTML = `
          <button type="button" class="btn btn-primary" id="btn-accept-emp-import" style="min-width: 140px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:17px;height:17px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Aceptar
          </button>
        `;

        const acceptBtn = modalFooter.querySelector('#btn-accept-emp-import');
        acceptBtn.addEventListener('click', async () => {
          overlay.remove();
          App.showToast(`Carga masiva finalizada: ${resumen.insertados} creados, ${resumen.actualizados} actualizados.`, 'success');
          await load();
        });

      } catch (err) {
        App.showToast('Error al importar: ' + err.message, 'error');
        confirmBtn.disabled = false;
        confirmText.textContent = 'Reintentar Importación';
        cancelBtn.disabled = false;
      }
    });
  }

  /* ─── Manejo Accesible del Dropdown de Acciones (Ley de Hick & WCAG 2.1 AA) ─ */
  function toggleActionsDropdown(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const menu = document.getElementById('emp-dropdown-menu');
    const toggleBtn = document.getElementById('emp-dropdown-toggle');
    if (!menu || !toggleBtn) return;

    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      closeActionsDropdown();
    } else {
      menu.removeAttribute('hidden');
      toggleBtn.setAttribute('aria-expanded', 'true');
      const firstItem = menu.querySelector('.emp-dropdown-item');
      if (firstItem) {
        firstItem.setAttribute('tabindex', '0');
        firstItem.focus();
      }
      setTimeout(() => {
        document.addEventListener('click', onDocClickCloseDropdown, { once: true });
      }, 10);
    }
  }

  function closeActionsDropdown() {
    const menu = document.getElementById('emp-dropdown-menu');
    const toggleBtn = document.getElementById('emp-dropdown-toggle');
    if (menu) menu.setAttribute('hidden', '');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.focus();
    }
    document.removeEventListener('click', onDocClickCloseDropdown);
  }

  function onDocClickCloseDropdown(e) {
    const wrap = document.getElementById('emp-actions-dropdown-wrap');
    if (wrap && !wrap.contains(e.target)) {
      closeActionsDropdown();
    }
  }

  function handleDropdownKeydown(e) {
    const menu = document.getElementById('emp-dropdown-menu');
    if (!menu) return;

    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleActionsDropdown(e);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeActionsDropdown();
    }
  }

  function handleMenuKeydown(e) {
    const menu = document.getElementById('emp-dropdown-menu');
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll('.emp-dropdown-item'));
    const currentIndex = items.indexOf(document.activeElement);

    if (e.key === 'Escape') {
      e.preventDefault();
      closeActionsDropdown();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      items[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + items.length) % items.length;
      items[prevIndex]?.focus();
    } else if (e.key === 'Tab') {
      closeActionsDropdown();
    }
  }

  async function render(container) {
    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <h1 class="page-heading">Servidores Públicos</h1>
            <p class="page-desc">Módulo de gestión integral del talento humano — Gobernación de Boyacá</p>
          </div>
          <div class="page-actions" style="display:flex; align-items:center; gap:12px;">
            <!-- Opciones secundarias agrupadas en Dropdown (Ley de Hick) -->
            <div class="emp-actions-dropdown-wrap" id="emp-actions-dropdown-wrap">
              <button
                type="button"
                class="btn btn-secondary emp-dropdown-btn"
                id="emp-dropdown-toggle"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="emp-dropdown-menu"
                aria-label="Opciones y acciones secundarias"
                onclick="EmployeesModule.toggleActionsDropdown(event)"
                onkeydown="EmployeesModule.handleDropdownKeydown(event)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;" aria-hidden="true">
                  <circle cx="12" cy="12" r="1.5"></circle>
                  <circle cx="19" cy="12" r="1.5"></circle>
                  <circle cx="5" cy="12" r="1.5"></circle>
                </svg>
                <span>Acciones</span>
                <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:14px;height:14px;" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <div
                class="emp-dropdown-menu"
                id="emp-dropdown-menu"
                role="menu"
                aria-labelledby="emp-dropdown-toggle"
                onkeydown="EmployeesModule.handleMenuKeydown(event)"
                hidden
              >
                <button
                  type="button"
                  class="emp-dropdown-item"
                  role="menuitem"
                  tabindex="-1"
                  onclick="EmployeesModule.exportExcel(); EmployeesModule.closeActionsDropdown();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <div>
                    <strong>Exportar a Excel</strong>
                    <small>Descargar listado filtrado (.xlsx)</small>
                  </div>
                </button>
                ${Auth.canEdit() ? `
                <button
                  type="button"
                  class="emp-dropdown-item"
                  role="menuitem"
                  tabindex="-1"
                  onclick="EmployeesModule.openImportModal(); EmployeesModule.closeActionsDropdown();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <div>
                    <strong>Carga Masiva Excel</strong>
                    <small>Importar o actualizar planta de personal</small>
                  </div>
                </button>` : ''}
              </div>
            </div>

            <!-- Acción Principal (CTA) - Alto Contraste y Salience Visual -->
            ${Auth.canEdit() ? `
            <button class="btn btn-primary-cta" onclick="EmployeesModule.openCreate()" id="btn-nuevo-servidor" aria-label="Crear nuevo servidor público">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:19px;height:19px" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Nuevo Servidor</span>
            </button>` : ''}
          </div>
        </div>

        <div class="filters-card">
          <div class="filters-row">
            <div class="filter-group" style="flex:2;min-width:240px">
              <label class="filter-label" for="emp-search">Buscar Servidor</label>
              <input id="emp-search" class="filter-input" placeholder="Buscar por nombre, cédula, dependencia, cargo..." aria-label="Buscar servidor por nombre, cédula o cargo" />
            </div>
            <button class="btn btn-primary" onclick="EmployeesModule.search()" aria-label="Ejecutar búsqueda">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Buscar
            </button>
            <button class="btn btn-secondary" onclick="EmployeesModule.clearSearch()" aria-label="Limpiar filtro de búsqueda">Limpiar</button>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <span class="table-title">Lista de Servidores Públicos</span>
            <span class="table-count" id="emp-count">
              <span class="skeleton" style="width:100px;height:14px;border-radius:4px;" aria-hidden="true"></span>
            </span>
          </div>
          <div class="table-wrap">
            <table aria-label="Listado de Servidores Públicos">
              <thead>
                <tr>
                  <th scope="col" class="th-servidor">Servidor / Documento</th>
                  <th scope="col">Nivel, Cargo & Código</th>
                  <th scope="col">Otro Tiempo Gobernación</th>
                  <th scope="col">Tiempo de Servicio</th>
                  <th scope="col" class="th-tiempo-total">Tiempo Total</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody id="emp-tbody" aria-busy="true" role="progressbar" aria-label="Cargando servidores públicos..." aria-valuemin="0" aria-valuemax="100" aria-valuetext="Cargando datos...">
              </tbody>
            </table>
          </div>
          <div class="pagination" id="emp-pagination"></div>
        </div>
      </div>`;

    const searchInput = document.getElementById('emp-search');
    let searchDebounce = null;
    if (searchInput) {
      searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          clearTimeout(searchDebounce);
          search();
        }
      });
      searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          search();
        }, 350);
      });
    }

    state.page = 1; state.q = '';
    await load();
    const countEl = document.getElementById('emp-count');
    if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} registros`;
  }

  function search() {
    const q = document.getElementById('emp-search')?.value.trim() || '';
    state.q = q; state.page = 1;
    load();
  }
  function clearSearch() {
    const inp = document.getElementById('emp-search');
    if (inp) inp.value = '';
    state.q = ''; state.page = 1;
    load();
  }

  return {
    render,
    openCreate,
    openView,
    openEdit,
    confirmDelete,
    goPage,
    search,
    clearSearch,
    exportExcel,
    openImportModal,
    formatCedulaDots,
    switchFichaTab,
    switchFormTab,
    copyFichaText,
    toggleActionsDropdown,
    closeActionsDropdown,
    handleDropdownKeydown,
    handleMenuKeydown,
    renderSkeletonTable
  };
})();
