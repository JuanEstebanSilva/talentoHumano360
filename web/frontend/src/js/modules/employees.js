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
    dependencia: '',
    cargo: '',
    advancedFilters: {},
    catalogs: {
      dependencias: [],
      cargos: [],
      cargosPorDependencia: {},
      divipola: { departamentos: [], municipiosPorDepto: {} },
      grados: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', 'N/A', 'NE'],
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
      estadosServidor: ['Activo', 'Retirado', 'Inactivo', 'Pensionado'],
      sexos: ['Femenino', 'Masculino', 'Prefiero no decirlo'],
      discapacidades: [
        'FÍSICA / MOTRIZ',
        'VISUAL',
        'AUDITIVA',
        'INTELECTUAL / COGNITIVA',
        'PSICOSOCIAL / MENTAL',
        'SORDOMUDA',
        'SORDOCIEGA',
        'MÚLTIPLE'
      ],
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
    return '<span class="badge badge--retirado">Retirado</span>';
  }

  function renderEstadoBadge(emp, itemKey) {
    const est = (emp.estadoServidor || emp.situacion || 'Activo').toLowerCase();
    const canEdit = Auth.canEdit();

    if (est === 'activo') {
      return `
        <button type="button"
                id="btn-estado-${itemKey}"
                class="badge badge--activo ${canEdit ? 'badge--clickable' : ''}"
                ${canEdit ? `onclick="EmployeesModule.promptRetireEmployee('${itemKey}')"` : 'disabled'}
                title="${canEdit ? 'Click para registrar Retiro del servidor' : 'Servidor Activo'}"
                aria-label="Estado Activo. ${canEdit ? 'Click para retirar' : ''}"
                tabindex="${canEdit ? '0' : '-1'}">
          Activo
        </button>`;
    }

    if (est === 'pensionado') {
      return '<span class="badge badge--pensionado">Pensionado</span>';
    }

    return `
      <button type="button"
              id="btn-estado-${itemKey}"
              class="badge badge--retirado ${canEdit ? 'badge--clickable' : ''}"
              ${canEdit ? `onclick="EmployeesModule.promptReactivateEmployee('${itemKey}')"` : 'disabled'}
              title="${canEdit ? 'Click para reactivar servidor con nueva vinculación' : 'Servidor Retirado'}"
              aria-label="Estado Retirado. ${canEdit ? 'Click para reactivar' : ''}"
              tabindex="${canEdit ? '0' : '-1'}">
        Retirado
      </button>`;
  }

  function promptRetireEmployee(itemKey) {
    if (!Auth.canEdit()) return;
    const emp = state.data.find(x => String(x.cedula || x.id) === String(itemKey));
    if (!emp) return;

    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.danger();

    const today = new Date().toISOString().split('T')[0];
    const initials = getInitials(emp.nombreCompleto);

    const bodyHtml = `
      <div class="retire-modal-container">
        <!-- Tarjeta de Identificación Institucional del Servidor -->
        <div class="retire-profile-card">
          <div class="retire-avatar-wrap">
            <div class="retire-avatar" title="${escHtml(emp.nombreCompleto || 'Servidor')}">${escHtml(initials)}</div>
          </div>
          <div class="retire-profile-info">
            <div class="retire-profile-name">${escHtml(emp.nombreCompleto || 'Servidor Público')}</div>
            <div class="retire-chips-row">
              <span class="retire-chip font-mono">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><line x1="15" y1="8" x2="17" y2="8"/><line x1="15" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>
                C.C. ${formatCedulaDots(emp.cedula)}
              </span>
              <span class="retire-chip">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                ${escHtml(emp.cargoActual || emp.cargo || emp.denominacion || 'Cargo no registrado')}
              </span>
              ${emp.dependencia ? `
              <span class="retire-chip">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>
                ${escHtml(emp.dependencia)}
              </span>` : ''}
            </div>
            <div class="retire-tenure-row">
              <span>Vinculación actual desde: <strong>${escHtml(emp.fechaIngreso || 'No registrada')}</strong></span>
              <span class="retire-tenure-divider">•</span>
              <span>Tiempo acumulado: <strong style="color:#b91c1c;">${escHtml(emp.tiempoServicioCalculado || '—')}</strong></span>
            </div>
          </div>
        </div>

        <!-- Alerta Institucional de Congelamiento de Tiempo de Servicio -->
        <div class="retire-alert-banner">
          <div class="retire-alert-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#dc2626" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="retire-alert-content">
            <h4 class="retire-alert-title">Detención y Congelamiento del Tiempo de Servicio</h4>
            <p class="retire-alert-text">
              Al confirmar el retiro, el cálculo dinámico de tiempo de servicio se detendrá exactamente en la fecha seleccionada. Su acumulado en la Gobernación de Boyacá quedará congelado hasta esa fecha y certificado en su historial laboral. Si el servidor es vinculado nuevamente en el futuro, este periodo pasará automáticamente a su experiencia histórica acreditada.
            </p>
          </div>
        </div>

        <!-- Formulario de Retiro -->
        <div class="retire-form-grid">
          <div class="form-group">
            <label class="form-label required" for="retire-fecha">Fecha Efectiva de Retiro</label>
            <div style="position:relative;">
              <input type="date" id="retire-fecha" class="form-input" data-datepicker="true" value="${today}" max="${today}" required />
            </div>
            <span class="form-hint">Fecha oficial de culminación de funciones según acto administrativo o resolución.</span>
          </div>

          <div class="form-group">
            <label class="form-label required" for="retire-causal">Causal Legal de Retiro</label>
            <select id="retire-causal" class="form-select" required>
              <option value="Renuncia voluntaria debidamente aceptada" selected>Renuncia voluntaria debidamente aceptada</option>
              <option value="Pensión de jubilación / vejez / invalidez">Pensión de jubilación / vejez / invalidez</option>
              <option value="Vencimiento del nombramiento provisional / periodo">Vencimiento del nombramiento provisional / periodo</option>
              <option value="Supresión del cargo / reestructuración de planta">Supresión del cargo / reestructuración de planta</option>
              <option value="Destitución o sanción disciplinaria">Destitución o sanción disciplinaria</option>
              <option value="Invalidez absoluta o permanente debidamente dictaminada">Invalidez absoluta o permanente debidamente dictaminada</option>
              <option value="Declaratoria de insubsistencia">Declaratoria de insubsistencia</option>
              <option value="Revocatoria del nombramiento">Revocatoria del nombramiento</option>
              <option value="Muerte del servidor público">Muerte del servidor público</option>
              <option value="Otro motivo legal">Otro motivo legal</option>
            </select>
            <span class="form-hint">Causal legal según el régimen de la Ley 909 de 2004 y Decreto 1083 de 2015.</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="retire-motivo">Acto Administrativo o Detalle (Opcional)</label>
            <input type="text" id="retire-motivo" class="form-input" placeholder="Ej: Decreto / Resolución Nro. 0482 de 2026 - Aceptación de renuncia" autocomplete="off" />
            <span class="form-hint">Número de resolución o soporte documental que oficializa la desvinculación.</span>
          </div>
        </div>
      </div>
    `;

    App.openModal(
      'Registrar Retiro del Servidor',
      bodyHtml,
      [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          html: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg><span>Confirmar Retiro</span>`,
          cls: 'btn-danger retire-modal-footer-btn-danger',
          id: 'btn-confirm-retire-action',
          action: () => EmployeesModule.confirmRetireEmployee(itemKey)
        }
      ],
      'modal-retire-dialog'
    );
  }

  async function confirmRetireEmployee(itemKey) {
    if (!Auth.canEdit()) return;
    const emp = state.data.find(x => String(x.cedula || x.id) === String(itemKey));
    if (!emp) return;

    const fechaRetiroInput = document.getElementById('retire-fecha');
    const causalSelect = document.getElementById('retire-causal');
    const motivoRetiroInput = document.getElementById('retire-motivo');
    const fechaRetiro = fechaRetiroInput ? fechaRetiroInput.value : '';
    const causal = causalSelect ? causalSelect.value : '';
    const detalle = motivoRetiroInput ? motivoRetiroInput.value.trim() : '';
    const motivoRetiro = detalle ? `${causal}: ${detalle}` : causal;

    if (!fechaRetiro) {
      App.showToast('Por favor ingrese la fecha de retiro.', 'warning');
      return;
    }

    const targetCedula = emp.cedula || emp.id;
    try {
      App.showToast('Registrando retiro del servidor...', 'info');
      await API.updateEmployeeStatus(targetCedula, 'Retirado', { fechaRetiro, motivoRetiro, causalRetiro: causal });
      App.closeModal();
      closeRetireModal();
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
      App.showToast(`Servidor ${emp.nombreCompleto || targetCedula} registrado como Retirado. Contador de tiempo detenido.`, 'success');
      await load();
    } catch (err) {
      console.error('[employees] Error al retirar servidor:', err);
      App.showToast(`Error al retirar servidor: ${err.message}`, 'error');
    }
  }

  function closeRetireModal() {
    App.closeModal();
    const el = document.getElementById('modal-retire-employee');
    if (el) el.remove();
  }

  function promptReactivateEmployee(itemKey) {
    if (!Auth.canEdit()) return;
    const emp = state.data.find(x => String(x.cedula || x.id) === String(itemKey));
    if (!emp) return;

    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.navClick();

    const today = new Date().toISOString().split('T')[0];
    const initials = getInitials(emp.nombreCompleto);

    const bodyHtml = `
      <div class="retire-modal-container">
        <!-- Tarjeta de Identificación Institucional -->
        <div class="retire-profile-card retire-profile-card--reactivate">
          <div class="retire-avatar-wrap">
            <div class="retire-avatar retire-avatar--reactivate" title="${escHtml(emp.nombreCompleto || 'Servidor')}">${escHtml(initials)}</div>
          </div>
          <div class="retire-profile-info">
            <div class="retire-profile-name">${escHtml(emp.nombreCompleto || 'Servidor Público')}</div>
            <div class="retire-chips-row">
              <span class="retire-chip font-mono">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><line x1="15" y1="8" x2="17" y2="8"/><line x1="15" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>
                C.C. ${formatCedulaDots(emp.cedula)}
              </span>
              <span class="retire-chip">
                <span class="badge badge--retirado" style="font-size:10.5px; padding:2px 6px;">Retirado</span>
              </span>
              <span class="retire-chip">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                ${escHtml(emp.cargoActual || emp.cargo || 'Cargo no registrado')}
              </span>
            </div>
            <div class="retire-tenure-row">
              <span>Periodo anterior: <strong>${escHtml(emp.fechaIngreso || '—')}</strong> al <strong>${escHtml(emp.fechaRetiro || '—')}</strong></span>
              <span class="retire-tenure-divider">•</span>
              <span>Acumulado: <strong style="color:#15803d;">${escHtml(emp.tiempoServicioCalculado || '—')}</strong></span>
            </div>
          </div>
        </div>

        <!-- Banner de Traslado Automático a Experiencia Histórica -->
        <div class="retire-alert-banner retire-alert-banner--reactivate">
          <div class="retire-alert-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16a34a" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div class="retire-alert-content">
            <h4 class="retire-alert-title retire-alert-title--reactivate">Traslado Automático a Experiencia Histórica</h4>
            <p class="retire-alert-text">
              El tiempo previo laborado por este funcionario (<strong>${escHtml(emp.tiempoServicioCalculado || '—')}</strong>) se trasladará automáticamente a <strong>"Otro Tiempo con la Gobernación"</strong>. El contador de tiempo de servicio actual se reiniciará a partir de la nueva fecha de posesión.
            </p>
          </div>
        </div>

        <!-- Formulario de Reactivación -->
        <div class="retire-form-grid retire-form-grid--reactivate">
          <div class="form-group">
            <label class="form-label required" for="reactivate-nueva-fecha">Nueva Fecha de Ingreso / Posesión</label>
            <input type="date" id="reactivate-nueva-fecha" class="form-input" data-datepicker="true" value="${today}" required />
            <span class="form-hint">A partir de esta fecha iniciará el nuevo cómputo de tiempo de servicio activo.</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="reactivate-tipo-vinculacion">Modalidad o Tipo de Nombramiento</label>
            <select id="reactivate-tipo-vinculacion" class="form-select">
              <option value="Carrera Administrativa" selected>Carrera Administrativa</option>
              <option value="Provisionalidad">Provisionalidad</option>
              <option value="Libre Nombramiento y Remoción">Libre Nombramiento y Remoción</option>
              <option value="Periodo Fijo">Periodo Fijo</option>
              <option value="Temporal">Temporal</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="reactivate-acto">Acto Administrativo de Posesión (Opcional)</label>
            <input type="text" id="reactivate-acto" class="form-input" placeholder="Ej: Decreto Nro. 0125 de 2026 - Posesión de cargo" autocomplete="off" />
          </div>
        </div>
      </div>
    `;

    App.openModal(
      'Reactivar Servidor (Nueva Vinculación)',
      bodyHtml,
      [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          html: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg><span>Confirmar Reactivación</span>`,
          cls: 'btn-success retire-modal-footer-btn-success',
          id: 'btn-confirm-reactivate-action',
          action: () => EmployeesModule.confirmReactivateEmployee(itemKey)
        }
      ],
      'modal-retire-dialog'
    );
  }

  function closeReactivateModal() {
    App.closeModal();
    const el = document.getElementById('modal-reactivate-employee');
    if (el) el.remove();
  }

  async function confirmReactivateEmployee(itemKey) {
    if (!Auth.canEdit()) return;
    const emp = state.data.find(x => String(x.cedula || x.id) === String(itemKey));
    if (!emp) return;

    const nuevaFechaInput = document.getElementById('reactivate-nueva-fecha');
    const nuevaFechaIngreso = nuevaFechaInput ? nuevaFechaInput.value : '';

    if (!nuevaFechaIngreso) {
      App.showToast('Por favor ingrese la nueva fecha de ingreso.', 'warning');
      return;
    }

    const targetCedula = emp.cedula || emp.id;
    try {
      App.showToast('Reactivando servidor y archivando periodo anterior...', 'info');
      await API.updateEmployeeStatus(targetCedula, 'Activo', { action: 'reactivate', nuevaFechaIngreso });
      App.closeModal();
      closeReactivateModal();
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.confirm();
      App.showToast(`Servidor ${emp.nombreCompleto || targetCedula} reactivado exitosamente con nueva vinculación.`, 'success');
      await load();
    } catch (err) {
      console.error('[employees] Error al reactivar servidor:', err);
      App.showToast(`Error al reactivar servidor: ${err.message}`, 'error');
    }
  }

  function closeReactivateModal() {
    const el = document.getElementById('modal-reactivate-employee');
    if (el) el.remove();
  }

  // Funciones de compatibilidad
  function startInactivation(k) { promptRetireEmployee(k); }
  function cancelInactivation() {}
  async function reactivateEmployee(k) { promptReactivateEmployee(k); }

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

  function formatAsignacionSalarial(val) {
    if (!val) return '';
    const cleanDigits = String(val).replace(/[^\d]/g, '');
    if (!cleanDigits) return '';
    return '$ ' + parseInt(cleanDigits, 10).toLocaleString('es-CO');
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
        <td>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <div class="skeleton skeleton-line" style="width:75%; height:13px;" aria-hidden="true"></div>
            <div class="skeleton skeleton-line" style="width:45%; height:10px;" aria-hidden="true"></div>
          </div>
        </td>
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

  function getActiveFiltersCount() {
    return Object.keys(state.advancedFilters || {}).filter(k => {
      const v = state.advancedFilters[k];
      return v !== null && v !== undefined && String(v).trim() !== '' && v !== 'Todos' && v !== 'Todas' && v !== 'TODOS' && v !== 'TODAS';
    }).length;
  }

  function updateAdvFilterBadge() {
    const badge = document.getElementById('emp-adv-filter-badge');
    const count = getActiveFiltersCount();
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    const btn = document.getElementById('emp-btn-adv-filter');
    if (btn) {
      if (count > 0) btn.classList.add('btn-filter-active');
      else btn.classList.remove('btn-filter-active');
    }
  }

  function openAdvancedFiltersModal() {
    const af = state.advancedFilters || {};
    const gruposSanguineos = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const situaciones = ['ACTIVO', 'ENCARGO', 'COMISIÓN', 'LICENCIA', 'VACACIONES', 'DISCAPACIDAD', 'RETIRADO'];
    const vinculaciones = state.catalogs.clasificaciones || [
      'Carrera Administrativa',
      'Libre Nombramiento y Remoción',
      'Provisionalidad',
      'Temporal',
      'Aprendiz o Contrato SENA',
      'Trabajador Oficial'
    ];

    const modalBodyHtml = `
      <div class="adv-filter-modal-body">
        <!-- Tarjeta 1: Datos Personales y Demográficos -->
        <div class="adv-filter-card">
          <div class="adv-filter-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#1D8096;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Datos Demográficos y Personales</span>
          </div>
          <div class="adv-filter-grid">
            <div class="adv-filter-field">
              <label for="adv-tipo-sangre">Grupo Sanguíneo</label>
              <select id="adv-tipo-sangre">
                <option value="">Todos</option>
                ${gruposSanguineos.map(g => `<option value="${g}" ${af.tipoSangre === g ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
            </div>
            <div class="adv-filter-field">
              <label for="adv-sexo">Sexo Biológico</label>
              <select id="adv-sexo">
                <option value="">Todos</option>
                <option value="MASCULINO" ${af.sexo === 'MASCULINO' ? 'selected' : ''}>Masculino (M)</option>
                <option value="FEMENINO" ${af.sexo === 'FEMENINO' ? 'selected' : ''}>Femenino (F)</option>
              </select>
            </div>
            <div class="adv-filter-field">
              <label for="adv-edad-min">Edad Mínima (Años)</label>
              <input type="number" id="adv-edad-min" placeholder="Ej: 18" min="16" max="99" value="${escHtml(af.edadMin || '')}" />
            </div>
            <div class="adv-filter-field">
              <label for="adv-edad-max">Edad Máxima (Años)</label>
              <input type="number" id="adv-edad-max" placeholder="Ej: 65" min="16" max="99" value="${escHtml(af.edadMax || '')}" />
            </div>
            <div class="adv-filter-field">
              <label for="adv-discapacidad-toggle">¿Tiene Discapacidad?</label>
              <select id="adv-discapacidad-toggle">
                <option value="">Todos</option>
                <option value="si" ${af.tieneDiscapacidad === 'si' ? 'selected' : ''}>Sí (Con Discapacidad)</option>
                <option value="no" ${af.tieneDiscapacidad === 'no' ? 'selected' : ''}>No (Sin Discapacidad)</option>
              </select>
            </div>
            <div class="adv-filter-field">
              <label for="adv-tipo-discapacidad">Tipo de Discapacidad</label>
              <select id="adv-tipo-discapacidad">
                <option value="">Todas las condiciones</option>
                ${(state.catalogs.discapacidades || []).map(d => `<option value="${escHtml(d)}" ${af.tipoDiscapacidad === d ? 'selected' : ''}>${escHtml(d)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Tarjeta 2: Cargo, Vinculación y Concurso -->
        <div class="adv-filter-card">
          <div class="adv-filter-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#d97706;"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            <span>Cargo, Vinculación y Situación Administrativa</span>
          </div>
          <div class="adv-filter-grid">
            <div class="adv-filter-field">
              <label for="adv-situacion">Situación Administrativa</label>
              <select id="adv-situacion">
                <option value="">Todas</option>
                ${situaciones.map(s => `<option value="${s}" ${af.situacion === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="adv-filter-field">
              <label for="adv-clasificacion">Tipo de Vinculación</label>
              <select id="adv-clasificacion">
                <option value="">Todas</option>
                ${vinculaciones.map(v => `<option value="${escHtml(v)}" ${af.clasificacion === v ? 'selected' : ''}>${escHtml(v)}</option>`).join('')}
              </select>
            </div>
            <div class="adv-filter-field">
              <label for="adv-codigo-cargo">Código del Cargo</label>
              <input type="text" id="adv-codigo-cargo" placeholder="Ej: 105, 219..." value="${escHtml(af.codigoCargo || '')}" />
            </div>
            <div class="adv-filter-field">
              <label for="adv-grado">Grado del Cargo</label>
              <select id="adv-grado">
                <option value="">Todos</option>
                ${(state.catalogs.grados || ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15']).map(g => `<option value="${g}" ${af.grado === g ? 'selected' : ''}>Grado ${g}</option>`).join('')}
              </select>
            </div>
            <div class="adv-filter-field">
              <label for="adv-concurso-toggle">¿Registra Concurso / OPEC?</label>
              <select id="adv-concurso-toggle">
                <option value="">Todos</option>
                <option value="si" ${af.concurso === 'si' ? 'selected' : ''}>Sí (Con OPEC / Concurso)</option>
                <option value="no" ${af.concurso === 'no' ? 'selected' : ''}>No (Sin OPEC Registrada)</option>
              </select>
            </div>
            <div class="adv-filter-field">
              <label for="adv-opec">Número o Texto OPEC</label>
              <input type="text" id="adv-opec" placeholder="Ej: OPEC-2023, 243471..." value="${escHtml(af.opec || '')}" />
            </div>
          </div>
        </div>

        <!-- Tarjeta 3: Encargo Administrativo -->
        <div class="adv-filter-card">
          <div class="adv-filter-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#d97706;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <span>Situación de Encargo Administrativo</span>
          </div>
          <div class="adv-filter-grid">
            <div class="adv-filter-field">
              <label for="adv-encargo-toggle">¿Tiene Encargo Administrativo?</label>
              <select id="adv-encargo-toggle">
                <option value="">Todos</option>
                <option value="si" ${af.tieneEncargo === 'si' ? 'selected' : ''}>Sí (Con Encargo)</option>
                <option value="no" ${af.tieneEncargo === 'no' ? 'selected' : ''}>No (Sin Encargo)</option>
              </select>
            </div>
            <div class="adv-filter-field" style="grid-column: span 2;">
              <label for="adv-encargo-denominacion">Denominación del Cargo en Encargo</label>
              <input type="text" id="adv-encargo-denominacion" placeholder="Ej: PROFESIONAL UNIVERSITARIO..." value="${escHtml(af.encargoDenominacion || '')}" />
            </div>
            <div class="adv-filter-field">
              <label for="adv-encargo-codigo">Cód. Encargo</label>
              <input type="text" id="adv-encargo-codigo" placeholder="Ej: 219" value="${escHtml(af.encargoCodigo || '')}" />
            </div>
            <div class="adv-filter-field">
              <label for="adv-encargo-grado">Grado Encargo</label>
              <select id="adv-encargo-grado">
                <option value="">Todos</option>
                ${(state.catalogs.grados || ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15']).map(g => `<option value="${g}" ${af.encargoGrado === g ? 'selected' : ''}>Grado ${g}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Tarjeta 4: Tiempos de Servicio y Ordenamiento -->
        <div class="adv-filter-card">
          <div class="adv-filter-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#10b981;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Tiempos de Servicio y Ordenamiento</span>
          </div>
          <div class="adv-filter-grid">
            <div class="adv-filter-field">
              <label for="adv-fecha-ingreso-desde">Fecha Ingreso Desde</label>
              <input type="text" id="adv-fecha-ingreso-desde" class="input-date" placeholder="AAAA-MM-DD" value="${escHtml(af.fechaIngresoDesde || '')}" />
            </div>
            <div class="adv-filter-field">
              <label for="adv-fecha-ingreso-hasta">Fecha Ingreso Hasta</label>
              <input type="text" id="adv-fecha-ingreso-hasta" class="input-date" placeholder="AAAA-MM-DD" value="${escHtml(af.fechaIngresoHasta || '')}" />
            </div>
            <div class="adv-filter-field" style="grid-column: span 2;">
              <label for="adv-sort-by" style="color:#b45309;">Criterio de Ordenamiento</label>
              <select id="adv-sort-by" style="border-color:rgba(217,119,6,0.4);font-weight:600;">
                <option value="" ${!af.sortBy ? 'selected' : ''}>Predeterminado (Activos con cédula de primeras)</option>
                <option value="fecha_ingreso_asc" ${af.sortBy === 'fecha_ingreso_asc' ? 'selected' : ''}>📅 Fecha de Ingreso: Menor a Mayor (Más antiguos primero)</option>
                <option value="fecha_ingreso_desc" ${af.sortBy === 'fecha_ingreso_desc' ? 'selected' : ''}>📅 Fecha de Ingreso: Mayor a Menor (Más recientes primero)</option>
                <option value="tiempo_servicio_asc" ${af.sortBy === 'tiempo_servicio_asc' ? 'selected' : ''}>⏱️ Tiempo de Servicio: Menor a Mayor</option>
                <option value="tiempo_servicio_desc" ${af.sortBy === 'tiempo_servicio_desc' ? 'selected' : ''}>⏱️ Tiempo de Servicio: Mayor a Menor</option>
                <option value="edad_asc" ${af.sortBy === 'edad_asc' ? 'selected' : ''}>🎂 Edad: Menor a Mayor (Más jóvenes primero)</option>
                <option value="edad_desc" ${af.sortBy === 'edad_desc' ? 'selected' : ''}>🎂 Edad: Mayor a Menor (Más mayores primero)</option>
                <option value="alfabetico_asc" ${af.sortBy === 'alfabetico_asc' ? 'selected' : ''}>🔤 Alfabético por Nombre: A - Z</option>
                <option value="alfabetico_desc" ${af.sortBy === 'alfabetico_desc' ? 'selected' : ''}>🔤 Alfabético por Nombre: Z - A</option>
                <option value="cedula_asc" ${af.sortBy === 'cedula_asc' ? 'selected' : ''}>🔢 Cédula de Ciudadanía: Menor a Mayor</option>
                <option value="cedula_desc" ${af.sortBy === 'cedula_desc' ? 'selected' : ''}>🔢 Cédula de Ciudadanía: Mayor a Menor</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Tarjeta 5: Educación y Formación Académica -->
        <div class="adv-filter-card">
          <div class="adv-filter-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#8b5cf6;"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            <span>Educación y Formación Académica</span>
          </div>
          <div class="adv-filter-grid">
            <div class="adv-filter-field">
              <label for="adv-estudios">Título o Carrera de Estudios</label>
              <input type="text" id="adv-estudios" placeholder="Ej: ABOGADO, INGENIERO..." value="${escHtml(af.estudios || '')}" />
            </div>
            <div class="adv-filter-field">
              <label for="adv-institucion-estudios">Universidad o Institución</label>
              <input type="text" id="adv-institucion-estudios" placeholder="Ej: UPTC, ESAP, UNAL..." value="${escHtml(af.institucionEstudios || '')}" />
            </div>
            <div class="adv-filter-field">
              <label for="adv-diplomado-toggle">Diplomado / Capacitación SENA</label>
              <select id="adv-diplomado-toggle">
                <option value="">Todos</option>
                <option value="si" ${af.tieneDiplomado === 'si' ? 'selected' : ''}>Sí (Tiene Diplomado / SENA)</option>
                <option value="no" ${af.tieneDiplomado === 'no' ? 'selected' : ''}>No (Sin Diplomado)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;

    App.openModal('Filtros Avanzados — Servidores Públicos', modalBodyHtml, [
      {
        text: 'Restablecer Filtros',
        cls: 'btn-secondary',
        action: () => {
          state.advancedFilters = {};
          updateAdvFilterBadge();
          App.closeModal();
          state.page = 1;
          load();
          App.showToast('Filtros avanzados restablecidos.', 'info');
        }
      },
      {
        text: 'Cancelar',
        cls: 'btn-outline',
        action: () => App.closeModal()
      },
      {
        text: 'Aplicar Filtros',
        cls: 'btn-primary',
        id: 'btn-apply-adv-filters',
        action: () => {
          const newFilters = {};
          const getVal = id => document.getElementById(id)?.value?.trim() || '';

          const valTipoSangre = getVal('adv-tipo-sangre');
          if (valTipoSangre) newFilters.tipoSangre = valTipoSangre;

          const valSexo = getVal('adv-sexo');
          if (valSexo) newFilters.sexo = valSexo;

          const valEdadMin = getVal('adv-edad-min');
          if (valEdadMin) newFilters.edadMin = valEdadMin;

          const valEdadMax = getVal('adv-edad-max');
          if (valEdadMax) newFilters.edadMax = valEdadMax;

          const valDiscToggle = getVal('adv-discapacidad-toggle');
          if (valDiscToggle) newFilters.tieneDiscapacidad = valDiscToggle;

          const valTipoDisc = getVal('adv-tipo-discapacidad');
          if (valTipoDisc) newFilters.tipoDiscapacidad = valTipoDisc;

          const valSituacion = getVal('adv-situacion');
          if (valSituacion) newFilters.situacion = valSituacion;

          const valClasif = getVal('adv-clasificacion');
          if (valClasif) newFilters.clasificacion = valClasif;

          const valCodCargo = getVal('adv-codigo-cargo');
          if (valCodCargo) newFilters.codigoCargo = valCodCargo;

          const valGrado = getVal('adv-grado');
          if (valGrado) newFilters.grado = valGrado;

          const valConcurso = getVal('adv-concurso-toggle');
          if (valConcurso) newFilters.concurso = valConcurso;

          const valOpec = getVal('adv-opec');
          if (valOpec) newFilters.opec = valOpec;

          const valTieneEncargo = getVal('adv-encargo-toggle');
          if (valTieneEncargo) newFilters.tieneEncargo = valTieneEncargo;

          const valEncargoDenom = getVal('adv-encargo-denominacion');
          if (valEncargoDenom) newFilters.encargoDenominacion = valEncargoDenom;

          const valEncargoCod = getVal('adv-encargo-codigo');
          if (valEncargoCod) newFilters.encargoCodigo = valEncargoCod;

          const valEncargoGra = getVal('adv-encargo-grado');
          if (valEncargoGra) newFilters.encargoGrado = valEncargoGra;

          const valFechaIngDesde = getVal('adv-fecha-ingreso-desde');
          if (valFechaIngDesde) newFilters.fechaIngresoDesde = valFechaIngDesde;

          const valFechaIngHasta = getVal('adv-fecha-ingreso-hasta');
          if (valFechaIngHasta) newFilters.fechaIngresoHasta = valFechaIngHasta;

          const valSortBy = getVal('adv-sort-by');
          if (valSortBy) newFilters.sortBy = valSortBy;

          const valEstudios = getVal('adv-estudios');
          if (valEstudios) newFilters.estudios = valEstudios;

          const valInstEstudios = getVal('adv-institucion-estudios');
          if (valInstEstudios) newFilters.institucionEstudios = valInstEstudios;

          const valDiplomado = getVal('adv-diplomado-toggle');
          if (valDiplomado) newFilters.tieneDiplomado = valDiplomado;

          state.advancedFilters = newFilters;
          updateAdvFilterBadge();
          App.closeModal();
          state.page = 1;
          load();
          const count = Object.keys(newFilters).length;
          App.showToast(count > 0 ? `Filtros avanzados aplicados (${count} activo${count > 1 ? 's' : ''}).` : 'Filtros aplicados.', 'success');
        }
      }
    ], 'modal-lg');

    // Inicializar calendarios en el modal
    setTimeout(() => {
      if (typeof flatpickr !== 'undefined') {
        flatpickr('#adv-fecha-ingreso-desde', { dateFormat: 'Y-m-d', altInput: true, altFormat: 'd/m/Y', allowInput: true });
        flatpickr('#adv-fecha-ingreso-hasta', { dateFormat: 'Y-m-d', altInput: true, altFormat: 'd/m/Y', allowInput: true });
      }
    }, 150);
  }

  async function load() {
    renderSkeletonTable();
    try {
      const res = await API.getEmployees({
        q: state.q,
        dependencia: state.dependencia,
        cargo: state.cargo,
        ...state.advancedFilters,
        page: state.page,
        limit: 25
      });
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
      const countEl = document.getElementById('emp-count');
      if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} registros`;
    } catch (err) {
      const countEl = document.getElementById('emp-count');
      if (countEl) countEl.textContent = '—';
      const tbody = document.getElementById('emp-tbody');
      if (tbody) {
        tbody.setAttribute('aria-busy', 'false');
        tbody.removeAttribute('role');
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="color:var(--color-danger); border-color:var(--color-danger);">
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
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
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
      const cargoTitularDisplay = e.cargoTitular || e.cargoBase || e.cargoActual;
      const codTitularDisplay = e.codigoTitular || e.codigoBase || e.codigoActual;
      const graTitularDisplay = e.gradoTitular || e.gradoBase || e.gradoActual;

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
        <td title="${escHtml(cargoTitularDisplay)}${e.encargoDenominacion ? ` (Encargo: ${escHtml(e.encargoDenominacion)})` : ''}">
          <div style="font-weight:600; color:var(--text-primary); line-height:1.25;">${escHtml(truncate(cargoTitularDisplay, 28)) || '—'}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
            ${(codTitularDisplay && codTitularDisplay !== 'N/A') ? `Cód. <strong>${escHtml(codTitularDisplay)}</strong>` : 'Sin código'}
            ${(graTitularDisplay && graTitularDisplay !== 'N/A') ? ` • Grado <strong>${escHtml(graTitularDisplay)}</strong>` : ''}
          </div>
          ${e.encargoDenominacion ? `
            <div style="margin-top:3px;">
              <span class="badge" style="background:rgba(234, 88, 12, 0.12); color:#c2410c; border:1px solid rgba(234, 88, 12, 0.25); font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:4px; display:inline-flex; align-items:center; gap:4px;" title="Encargado en: ${escHtml(e.encargoDenominacion)}">
                🔄 Encargo: ${escHtml(truncate(e.encargoDenominacion, 22))}
              </span>
            </div>
          ` : ''}
        </td>
        <td title="Tiempo de Servicio: ${escHtml(e.tiempoServicioCalculado || '—')}${e.otroTiempoCalculado ? ` • Otro Tiempo Gobernación: ${escHtml(e.otroTiempoCalculado)}` : ''}">
          <div style="font-weight:600; color:var(--text-primary); line-height:1.25;">
            ${escHtml(e.tiempoServicioCalculado || '—')}
          </div>
          ${(e.esRetirado || (e.estadoServidor || '').toLowerCase() === 'retirado' || (e.situacion || '').toLowerCase() === 'retirado') ? `
            <div style="font-size:10.5px; color:#dc2626; font-weight:700; margin-top:2px;" title="Periodo finalizado al retiro (${escHtml(e.fechaRetiro || '—')})">
              ⏹️ Retirado (${escHtml(e.fechaRetiro || 'congelado')})
            </div>
          ` : ''}
          <div class="emp-tiempo-otros" title="Otros tiempos en Gobernación: ${escHtml(e.otroTiempoCalculado || '0 años, 0 meses, 0 días')}">
            Otros: <span>${escHtml(e.otroTiempoCalculado || '0 años, 0 meses, 0 días')}</span>
          </div>
        </td>
        <td class="td-tiempo-total" title="Tiempo Total Calculado: ${escHtml(e.tiempoTotalGobernacion || e.tiempoServicioCalculado || '—')} (${escHtml(e.tiempoServicioCalculado || '0')} + ${escHtml(e.otroTiempoCalculado || '0')})">
          <div>${escHtml(e.tiempoTotalGobernacion || e.tiempoServicioCalculado || '—')}</div>
          ${(e.esRetirado || (e.estadoServidor || '').toLowerCase() === 'retirado' || (e.situacion || '').toLowerCase() === 'retirado') ? `
            <div style="margin-top:3px;">
              <span class="badge badge--retirado" style="font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px;" title="Tiempo total acumulado al momento del retiro (${escHtml(e.fechaRetiro || '—')})">
                ⏹️ Retiro: ${escHtml(e.fechaRetiro || 'congelado')}
              </span>
            </div>
          ` : ''}
        </td>
        <td id="td-estado-${itemKey}">${renderEstadoBadge(e, itemKey)}</td>
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

  function formatDiscapacidadBadge(tipoDiscapacidad) {
    if (!tipoDiscapacidad || ['ninguna', 'ninguno', 'no registra', 'sin especificar'].includes(String(tipoDiscapacidad).trim().toLowerCase())) {
      return '<span class="ficha-discapacidad-none">NO REGISTRA CONDICIÓN DE DISCAPACIDAD</span>';
    }
    const clean = String(tipoDiscapacidad).trim();
    const lower = clean.toLowerCase();
    let label = clean.toUpperCase();
    if (lower === 'fisica' || lower === 'motora') label = 'FÍSICA / MOTRIZ';
    else if (lower === 'visual') label = 'VISUAL';
    else if (lower === 'auditiva') label = 'AUDITIVA';
    else if (lower === 'cognitiva' || lower === 'intelectual') label = 'INTELECTUAL / COGNITIVA';
    else if (lower === 'sordomuda') label = 'SORDOMUDA';
    else if (lower === 'sordociega') label = 'SORDOCIEGA';
    else if (lower === 'psicosocial' || lower === 'mental') label = 'PSICOSOCIAL / MENTAL';
    else if (lower === 'multiple' || lower === 'múltiple') label = 'MÚLTIPLE';

    return `
      <div class="ficha-badge-discapacidad" role="status">
        <span class="ficha-badge-discapacidad-icon">♿</span>
        <span class="ficha-badge-discapacidad-text">${escHtml(label)}</span>
      </div>
    `;
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
      const cleanCargo = sanitizeText(emp.cargoTitular || emp.cargoBase || emp.cargoActual || 'Cargo no asignado');
      const cleanCod = sanitizeText(emp.codigoTitular || emp.codigoBase || emp.codigoActual || 'N/A');
      const cleanGra = sanitizeText(emp.gradoTitular || emp.gradoBase || emp.gradoActual || 'N/A');
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
                  ${emp.encargoDenominacion ? `
                    <span class="ficha-hero-pill pill--gold" title="Encargado en: ${escHtml(emp.encargoDenominacion)}">
                      🔄 Encargado en: <strong>${escHtml(emp.encargoDenominacion)}</strong>
                    </span>
                  ` : ''}
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
                <div class="ficha-card-val font-mono ficha-val-cedula" style="font-size:1.1rem;">
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
                  <span class="ficha-card-label ficha-label-edad">Edad Exacta (Cálculo Dinámico)</span>
                </div>
                <div class="ficha-card-val ficha-val-edad" style="font-size: 1.25rem; font-weight: 800;">
                  ${escHtml(emp.edadCalculada || 'No disponible')}
                </div>
                <div class="ficha-card-sub ficha-sub-edad">
                  Actualizado en tiempo real a la fecha de hoy con base en la fecha de nacimiento
                </div>
              </div>

              <div class="ficha-card ficha-grid--full ${emp.tipoDiscapacidad ? 'ficha-card--discapacidad' : ''}">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon" style="${emp.tipoDiscapacidad ? 'background: rgba(14, 165, 233, 0.2); color: #0284c7;' : ''}">♿</div>
                  <span class="ficha-card-label" style="font-weight:700;">Condición Especial / Discapacidad</span>
                </div>
                <div class="ficha-card-val">
                  ${formatDiscapacidadBadge(emp.tipoDiscapacidad)}
                </div>
                <div class="ficha-card-sub ficha-sub-discapacidad">
                  ${emp.tipoDiscapacidad
                    ? 'Servidor público con condición especial o de discapacidad registrada'
                    : 'Sin registro oficial de condición especial o discapacidad'}
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
                  <span class="ficha-card-label">Denominación del Cargo Titular</span>
                </div>
                <div class="ficha-card-val ficha-val-cargo-denominacion">
                  ${escHtml(cleanCargo)}
                </div>
                ${emp.encargoDenominacion ? `
                  <div class="ficha-card-sub">🔄 En encargo como: <strong>${escHtml(emp.encargoDenominacion)}</strong></div>
                ` : ''}
              </div>

              <div class="ficha-card">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">🏷️</div>
                  <span class="ficha-card-label">Código y Grado Titular</span>
                </div>
                <div class="ficha-card-val font-mono">
                  Cód. <strong>${escHtml(cleanCod)}</strong> • Grado <strong>${escHtml(cleanGra)}</strong>
                </div>
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
                  <span class="ficha-val-situacion" style="font-weight:800;">${escHtml(emp.situacion || 'ACTIVO')}</span>
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

              <!-- Situación de Encargo Administrativo -->
              <div class="ficha-card ficha-grid--full ${emp.encargoDenominacion ? 'ficha-card--encargo' : ''}" style="${emp.encargoDenominacion ? 'border-left: 4px solid var(--color-gold, #f59e0b); background: rgba(245, 158, 11, 0.05);' : ''}">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon" style="background: rgba(245, 158, 11, 0.18); color: #d97706; font-size: 16px;">🔄</div>
                  <span class="ficha-card-label" style="font-weight: 700; color: #b45309;">Situación de Encargo Administrativo</span>
                </div>
                ${emp.encargoDenominacion ? `
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-top: 10px;">
                    <div>
                      <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Cargo en Encargo</div>
                      <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">${escHtml(emp.encargoDenominacion)}</div>
                    </div>
                    <div>
                      <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Código y Grado</div>
                      <div class="font-mono" style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
                        Cód. <strong>${escHtml(emp.encargoCodigo || 'N/A')}</strong> • Grado <strong>${escHtml(emp.encargoGrado || 'N/A')}</strong>
                      </div>
                    </div>
                    <div>
                      <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Asignación Salarial Encargo</div>
                      <div class="font-mono" style="font-size: 1.05rem; font-weight: 800; color: var(--color-success, #16a34a); margin-top: 2px;">
                        ${emp.encargoAsignacion ? (String(emp.encargoAsignacion).startsWith('$') ? escHtml(emp.encargoAsignacion) : ('$' + escHtml(emp.encargoAsignacion))) : 'No registrada'}
                      </div>
                    </div>
                    <div>
                      <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Fecha Inicio Encargo</div>
                      <div class="font-mono" style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
                        ${escHtml(emp.fechaEncargo || 'No registrada')}
                      </div>
                    </div>
                  </div>
                ` : `
                  <div class="ficha-card-val" style="font-size: 0.95rem; color: var(--text-muted); font-weight: 500; margin-top: 4px;">
                    El servidor público ejerce sus funciones en su cargo titular de planta (sin encargo temporal vigente).
                  </div>
                `}
                ${emp.novedades ? `
                  <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed rgba(245, 158, 11, 0.35); font-size: 12.5px; color: var(--text-secondary);">
                    <strong>Novedades y Observaciones de Personal:</strong> ${escHtml(emp.novedades)}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- ─── Tab 3: Tiempos de Servicio ─── -->
          <div class="ficha-tab-pane" id="ficha-tiempos">
            <div class="ficha-grid">
              ${(emp.esRetirado || (emp.estadoServidor || '').toLowerCase() === 'retirado' || (emp.situacion || '').toLowerCase() === 'retirado') ? `
                <div class="ficha-grid--full" style="background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; gap: 14px;">
                  <span style="font-size: 26px;">⏹️</span>
                  <div>
                    <strong style="color: #dc2626; font-size: 0.95rem; display: block; margin-bottom: 2px;">Servidor Público en Estado Retirado</strong>
                    <div style="font-size: 0.84rem; color: var(--text-primary); line-height: 1.4;">
                      Fecha de Retiro: <strong>${escHtml(emp.fechaRetiro || 'Registrada')}</strong>.
                      El cómputo de servicio se encuentra detenido. Al momento de su retiro acreditó un tiempo acumulado de <strong>${escHtml(emp.tiempoTotalGobernacion || emp.tiempoServicioCalculado || '0 años, 0 meses, 0 días')}</strong>.
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Grand Highlight: Tiempo Total Acumulado -->
              <div class="ficha-card ficha-card--featured ficha-grid--full ficha-card-tiempo-total" style="padding: 18px 20px;">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon" style="background: rgba(0,123,199,0.15); color: var(--color-info); font-size:16px;">🏆</div>
                  <span class="ficha-card-label ficha-label-tiempo-total" style="font-size: 0.78rem;">Tiempo Total en la Gobernación de Boyacá</span>
                </div>
                <div class="ficha-card-val ficha-val-tiempo-total" style="font-size: 1.38rem; font-weight: 800; margin: 6px 0;">
                  ${escHtml(emp.tiempoTotalGobernacion || emp.tiempoServicioCalculado || '0 años, 0 meses, 0 días')}
                </div>
                <div class="ficha-sub-tiempo-total" style="font-size:0.8rem; padding: 6px 12px; border-radius: 8px; display: inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">
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

              <div class="ficha-card ficha-card--gold">
                <div class="ficha-card-top">
                  <div class="ficha-card-icon">⏱️</div>
                  <span class="ficha-card-label">Tiempo de Servicio Actual</span>
                </div>
                <div class="ficha-card-val ficha-val-tiempo-servicio" style="font-weight:800;">
                  ${escHtml(emp.tiempoServicioCalculado || '—')}
                </div>
                <div class="ficha-card-sub" style="${(emp.esRetirado || (emp.estadoServidor || '').toLowerCase() === 'retirado' || (emp.situacion || '').toLowerCase() === 'retirado') ? 'color:#dc2626; font-weight:600;' : ''}">
                  ${(emp.esRetirado || (emp.estadoServidor || '').toLowerCase() === 'retirado' || (emp.situacion || '').toLowerCase() === 'retirado')
                    ? `⏹️ Periodo finalizado al retiro (${escHtml(emp.fechaRetiro || '—')}) - Contador inactivo`
                    : 'Cálculo dinámico a partir de la fecha de ingreso'}
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
                          <th style="padding: 7px 12px;">Detalle / Cargo</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${emp.otroTiempoPeriodos.map((p, idx) => `
                          <tr style="border-bottom: 1px solid var(--color-border);">
                            <td style="padding: 7px 12px; color: var(--text-muted);">${idx + 1}</td>
                            <td style="padding: 7px 12px; font-weight: 600;">${escHtml(p.desde || '—')}</td>
                            <td style="padding: 7px 12px; font-weight: 600;">${escHtml(p.hasta || '—')}</td>
                            <td style="padding: 7px 12px; font-weight: 700;" class="ficha-val-otro-tiempo">${escHtml(p.duracionTexto || '—')}</td>
                            <td style="padding: 7px 12px; font-size: 11px; color: var(--text-secondary);">${escHtml(p.cargo ? `${p.cargo} (${p.entidad || 'Gobernación'})` : (p.entidad || 'Gobernación de Boyacá'))}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                      <tfoot>
                        <tr class="ficha-tfoot-otro-tiempo" style="background: rgba(40, 135, 27, 0.08); font-weight: 700;">
                          <td colspan="4" style="padding: 8px 12px; text-align: right; color: var(--text-primary);">Total Acumulado Otros Tiempos:</td>
                          <td style="padding: 8px 12px; font-weight: 800;" class="ficha-val-otro-tiempo">${escHtml(emp.otroTiempoGobernacion || emp.otroTiempoCalculado || '—')}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ` : `
                  <div class="ficha-card-val ficha-val-otro-tiempo" style="font-size:1.05rem; margin-top:4px;">
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
        action: () => openEdit(idOrCedula)
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

  let currentFormIsEdit = false;
  let currentFormEmpId = null;
  let currentFormIsVacante = false;
  const EMP_FORM_TABS = [
    'tab-form-personales',
    'tab-form-cargo',
    'tab-form-tiempos',
    'tab-form-formacion'
  ];

  function updateWizardFooter(tabId) {
    const footerEl = document.getElementById('modal-footer');
    if (!footerEl) return;

    const arrowNextSvg = `<svg class="wizard-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
    const arrowPrevSvg = `<svg class="wizard-prev-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;
    const saveCheckSvg = `<svg class="wizard-save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    if (currentFormIsVacante) {
      footerEl.innerHTML = `
        <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
        <button type="button" class="btn btn-primary" id="emp-save-btn" onclick="EmployeesModule.${currentFormIsEdit ? `saveEdit('${currentFormEmpId}')` : 'saveCreate()'}">${saveCheckSvg}<span>${currentFormIsEdit ? 'Actualizar Plaza' : 'Guardar Plaza'}</span></button>
      `;
      return;
    }

    const currentIdx = EMP_FORM_TABS.indexOf(tabId);
    const isFirst = currentIdx <= 0;
    const isLast = currentIdx === EMP_FORM_TABS.length - 1;

    let html = '';
    if (isFirst) {
      html += `<button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>`;
    } else {
      const prevTab = EMP_FORM_TABS[currentIdx - 1];
      html += `<button type="button" class="btn btn-secondary btn-wizard-prev" onclick="EmployeesModule.switchFormTab('${prevTab}')">
        ${arrowPrevSvg}<span>Anterior</span>
      </button>`;
    }

    html += `<div style="display:flex; align-items:center; gap:8px;">`;

    // Si está en edición y no es la última pestaña, permitir guardado directo
    if (currentFormIsEdit && !isLast) {
      html += `<button type="button" class="btn btn-gold" onclick="EmployeesModule.saveEdit('${currentFormEmpId}')" title="Guardar cambios directamente">
        ${saveCheckSvg}<span>Guardar Cambios</span>
      </button>`;
    }

    if (!isLast) {
      const nextTab = EMP_FORM_TABS[currentIdx + 1];
      html += `<button type="button" class="btn btn-primary btn-wizard-next" id="btn-wizard-next" onclick="EmployeesModule.switchFormTab('${nextTab}')">
        <span>Continuar</span>${arrowNextSvg}
      </button>`;
    } else {
      if (currentFormIsEdit) {
        html += `<button type="button" class="btn btn-gold" id="emp-save-btn" onclick="EmployeesModule.saveEdit('${currentFormEmpId}')">${saveCheckSvg}<span>Actualizar Servidor</span></button>`;
      } else {
        html += `<button type="button" class="btn btn-primary" id="emp-save-btn" onclick="EmployeesModule.saveCreate()">${saveCheckSvg}<span>Crear Servidor</span></button>`;
      }
    }

    html += `</div>`;
    footerEl.innerHTML = html;
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

    const activePane = document.getElementById(tabId);
    if (activePane) {
      App.initDatePickers(activePane);
      App.initFormUX(activePane);
      App.refreshFloatingLabels(activePane);
    }

    updateWizardFooter(tabId);

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

    // Marcar campo en rojo visual con animación (soporte para altInput de Flatpickr)
    el.classList.add('input-invalid');
    const targetFocusEl = (el._flatpickr && el._flatpickr.altInput) ? el._flatpickr.altInput : el;
    if (el._flatpickr && el._flatpickr.altInput) {
      el._flatpickr.altInput.classList.add('input-invalid');
    }

    // Desplazar la vista suavemente hasta el campo y hacer foco
    setTimeout(() => {
      targetFocusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { targetFocusEl.focus(); } catch (_) { }
    }, 100);

    if (message) {
      App.showToast(message, 'error');
    }

    // Quitar automáticamente el resaltado rojo cuando el usuario interactúe
    const clearHandler = () => {
      el.classList.remove('input-invalid');
      if (el._flatpickr && el._flatpickr.altInput) {
        el._flatpickr.altInput.classList.remove('input-invalid');
      }
      el.removeEventListener('input', clearHandler);
      el.removeEventListener('change', clearHandler);
      if (el._flatpickr && el._flatpickr.altInput) {
        el._flatpickr.altInput.removeEventListener('input', clearHandler);
        el._flatpickr.altInput.removeEventListener('click', clearHandler);
      }
    };
    el.addEventListener('input', clearHandler);
    el.addEventListener('change', clearHandler);
    if (el._flatpickr && el._flatpickr.altInput) {
      el._flatpickr.altInput.addEventListener('input', clearHandler);
      el._flatpickr.altInput.addEventListener('click', clearHandler);
    }
  }

  async function openCreate() {
    currentFormIsEdit = false;
    currentFormEmpId = null;
    currentFormIsVacante = false;
    await loadCatalogs();
    App.openModal('Nuevo Servidor Público', buildForm(), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Continuar', cls: 'btn-primary btn-wizard-next', id: 'btn-wizard-next', action: () => switchFormTab('tab-form-cargo') },
    ], 'modal-form-emp modal-lg');
    const box = document.querySelector('.modal-box');
    if (box) {
      box.classList.add('modal-form-emp', 'modal-lg');
      box.style.maxWidth = '900px';
      box.style.width = '92vw';
    }
    updateWizardFooter('tab-form-personales');
    attachFormListeners();
    setTimeout(() => {
      const modalBody = document.getElementById('modal-body');
      if (modalBody) {
        App.initFormUX(modalBody);
        App.refreshFloatingLabels(modalBody);
      }
    }, 40);
  }

  async function openEdit(idOrCedula) {
    const norm = val => String(val || '').trim().replace(/[.,\s]/g, '');
    let emp = state.data.find(e => e.cedula === idOrCedula || e.id === idOrCedula || (e.cedula && idOrCedula && norm(e.cedula) === norm(idOrCedula)));
    try {
      const full = await API.getEmployeeByCedula(idOrCedula);
      if (full) emp = full;
    } catch (_) { }

    if (!emp) return;
    currentFormIsEdit = true;
    currentFormEmpId = idOrCedula;
    currentFormIsVacante = Boolean(emp.es_vacante || emp.situacion === 'VACANTE' || (emp.nombreCompleto && emp.nombreCompleto.startsWith('PLAZA VACANTE')));
    await loadCatalogs();
    App.openModal('Editar Servidor Público', buildForm(emp), [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Continuar', cls: 'btn-primary btn-wizard-next', id: 'btn-wizard-next', action: () => switchFormTab('tab-form-cargo') },
    ], 'modal-form-emp modal-lg');
    const box = document.querySelector('.modal-box');
    if (box) {
      box.classList.add('modal-form-emp', 'modal-lg');
      box.style.maxWidth = '900px';
      box.style.width = '92vw';
    }
    updateWizardFooter('tab-form-personales');
    attachFormListeners(emp);
    setTimeout(() => {
      const modalBody = document.getElementById('modal-body');
      if (modalBody) {
        App.initFormUX(modalBody);
        App.refreshFloatingLabels(modalBody);
      }
    }, 40);
  }

  function extractNombresApellidos(emp = {}) {
    let nombres = emp.nombres || '';
    let apellidos = emp.apellidos || [emp.primerApellido, emp.segundoApellido].filter(Boolean).join(' ') || '';
    if (!nombres && !apellidos && emp.nombreCompleto) {
      const clean = sanitizeText(emp.nombreCompleto).trim();
      const parts = clean.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        nombres = parts[0];
      } else if (parts.length === 2) {
        apellidos = parts[0];
        nombres = parts[1];
      } else if (parts.length === 3) {
        apellidos = `${parts[0]} ${parts[1]}`;
        nombres = parts[2];
      } else {
        apellidos = `${parts[0]} ${parts[1]}`;
        nombres = parts.slice(2).join(' ');
      }
    }
    return { nombres: nombres.trim(), apellidos: apellidos.trim() };
  }

  function buildForm(emp = {}) {
    const isVacante = Boolean(emp.es_vacante || emp.situacion === 'VACANTE' || (emp.nombreCompleto && emp.nombreCompleto.startsWith('PLAZA VACANTE')));
    const cats = state.catalogs;
    const { nombres: nombresVal, apellidos: apellidosVal } = extractNombresApellidos(emp);

    if (isVacante) {
      return `
        <div style="background: rgba(209, 173, 42, 0.12); border: 1px solid var(--color-mustard); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
          <div style="font-weight: 700; color: var(--color-rust); font-size: 13px; margin-bottom: 4px;">🏛 Plaza Vacante — Planta de Personal</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Para las plazas vacantes, solo se definen la dependencia y el cargo correspondiente.</div>
        </div>
        <div class="form-grid">
          <div class="form-group span-2">
            <label class="form-label" for="ef-nombre">Denominación de la Plaza</label>
            <input id="ef-nombre" class="form-input" value="${escHtml(emp.nombreCompleto || 'PLAZA VACANTE')}" required />
          </div>
          <input type="hidden" id="ef-cedula" value="" />
          <div class="form-group span-2">
            <label class="form-label" for="ef-dep">Dependencia</label>
            <select id="ef-dep" class="filter-select">
              <option value="">Seleccionar Dependencia...</option>
              ${cats.dependencias.map(d => `<option value="${escHtml(d)}" ${d === emp.dependencia ? 'selected' : ''}>${escHtml(d)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group span-2">
            <label class="form-label" for="ef-cargo">Cargo</label>
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

    const isEdit = Boolean(emp.cedula || emp.id);

    const defaultSituacion = (() => {
      if (emp.situacion) {
        const s = emp.situacion.trim().toUpperCase();
        if (s.includes('DISCAPACIDAD') || s.includes('DISCPACIDAD')) return 'DISCAPACIDAD';
        if (s === 'ENCARGO') return 'ENCARGO';
        if (['ACTIVO', 'COMISIÓN', 'LICENCIA', 'VACACIONES', 'RETIRADO'].includes(s)) {
          if (emp.encargoDenominacion && s === 'ACTIVO') return 'ENCARGO';
          return s;
        }
        return s;
      }
      if (emp.encargoDenominacion) return 'ENCARGO';
      if (emp.tipoDiscapacidad && !['ninguna', 'ninguno', 'no registra', 'sin especificar'].includes(emp.tipoDiscapacidad.trim().toLowerCase())) return 'DISCAPACIDAD';
      return 'ACTIVO';
    })();

    return `
      <div class="emp-form-wrapper">
        <!-- BARRA ÚNICA DE NAVEGACIÓN HORIZONTAL PEGADA AL TOPE (SIN FUGAS AL SCROLLEAR) -->
        <div class="emp-form-tabs-container">
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
        </div>

        <!-- ─── PESTAÑA: DATOS PERSONALES ─── -->
        <div id="tab-form-personales" class="form-tab-pane active" style="padding-top: 6px;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="ef-nombres">Nombres</label>
              <input id="ef-nombres" class="form-input" placeholder="Ej: JUAN CARLOS" value="${escHtml(nombresVal)}" enterkeyhint="next" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-apellidos">Apellidos</label>
              <input id="ef-apellidos" class="form-input" placeholder="Ej: PEREZ RODRIGUEZ" value="${escHtml(apellidosVal)}" enterkeyhint="next" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-cedula">Cédula de Ciudadanía</label>
              <input id="ef-cedula" class="form-input font-mono" placeholder="Ej: 1000000000" value="${escHtml(emp.cedula || '')}" inputmode="numeric" enterkeyhint="next" required />
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
                <option value="">(Sin seleccionar / Vacío)</option>
                ${cats.divipola.departamentos.map(dep => `<option value="${escHtml(dep)}" ${(isEdit && emp.departamentoExpedicion === dep) ? 'selected' : ''}>${escHtml(dep)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-municipio-exp">Municipio de Expedición Cédula</label>
              <select id="ef-municipio-exp" class="filter-select">
                <option value="${isEdit ? escHtml(emp.municipioExpedicion || emp.ciudadExpedicion || '') : ''}">${isEdit ? escHtml(emp.municipioExpedicion || emp.ciudadExpedicion || '(Sin seleccionar / Vacío)') : '(Sin seleccionar / Vacío)'}</option>
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
              <div id="ef-edad-calc-display" class="ef-calc-display-val">
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
                ${cats.dependencias.map(d => `<option value="${escHtml(d)}" ${d.toUpperCase() === (emp.dependencia || '').toUpperCase() ? 'selected' : ''}>${escHtml(d)}</option>`).join('')}
                <option value="__OTRA__">+ Otra Dependencia (Especificar)...</option>
              </select>
              <input id="ef-dep-custom" class="form-input" style="display:none; margin-top:6px;" placeholder="Especifique el nombre de la nueva dependencia..." />
            </div>

            <div class="form-group span-2">
              <label class="form-label" for="ef-cargo">Denominación del Cargo Titular <span style="font-size:11px; color:var(--text-muted);">(Opcional, carga dinámica según dependencia)</span></label>
              <select id="ef-cargo" class="filter-select">
                <option value="${escHtml(emp.cargoActual || '')}">${escHtml(emp.cargoActual || '(Sin seleccionar / Vacío)')}</option>
                <option value="__OTRO__">+ Otro Cargo (Especificar)...</option>
              </select>
              <input id="ef-cargo-custom" class="form-input" style="display:none; margin-top:6px;" placeholder="Especifique la denominación del nuevo cargo..." />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-codigo-cargo">Código de Cargo <span style="font-size:11px; color:var(--text-muted);">(Opcional, letras o números)</span></label>
              <input id="ef-codigo-cargo" class="form-input font-mono" placeholder="Ej: 219, C-01, 100" value="${escHtml(emp.codigoActual || '')}" enterkeyhint="next" />
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
                <option value="Sin clasificar" ${!emp.clasificacionEmpleo || emp.clasificacionEmpleo === 'Sin clasificar' ? 'selected' : ''}>Sin clasificar</option>
                ${cats.clasificaciones.filter(c => c !== 'Sin clasificar').map(c => `<option value="${escHtml(c)}" ${normalizarClasificacion(c) === normalizarClasificacion(emp.clasificacionEmpleo) ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
                <option value="__OTRA__">+ Otra Vinculación (Especificar)...</option>
              </select>
              <input id="ef-clasificacion-custom" class="form-input" style="display:none; margin-top:6px;" placeholder="Especifique el tipo de vinculación..." />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-estado-servidor">Estado del Servidor</label>
              <select id="ef-estado-servidor" class="filter-select">
                ${cats.estadosServidor.map(es => `<option value="${escHtml(es)}" ${es.toLowerCase() === (emp.estadoServidor || 'Activo').toLowerCase() ? 'selected' : ''}>${escHtml(es)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-opec">OPEC <span style="font-size:11px; color:var(--text-muted);">(Texto o número)</span></label>
              <input id="ef-opec" class="form-input font-mono" placeholder="Ej: 184592" value="${escHtml(emp.opec || '')}" enterkeyhint="next" />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-situacion">Situación Administrativa</label>
              <select id="ef-situacion" class="filter-select">
                <option value="ACTIVO" ${defaultSituacion === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option>
                <option value="ENCARGO" ${defaultSituacion === 'ENCARGO' ? 'selected' : ''}>ENCARGO</option>
                <option value="COMISIÓN" ${defaultSituacion === 'COMISIÓN' ? 'selected' : ''}>COMISIÓN</option>
                <option value="LICENCIA" ${defaultSituacion === 'LICENCIA' ? 'selected' : ''}>LICENCIA</option>
                <option value="VACACIONES" ${defaultSituacion === 'VACACIONES' ? 'selected' : ''}>VACACIONES</option>
                <option value="DISCAPACIDAD" ${defaultSituacion === 'DISCAPACIDAD' ? 'selected' : ''}>DISCAPACIDAD</option>
                <option value="RETIRADO" ${defaultSituacion === 'RETIRADO' ? 'selected' : ''}>RETIRADO</option>
                ${(defaultSituacion && !['ACTIVO', 'ENCARGO', 'COMISIÓN', 'LICENCIA', 'VACACIONES', 'DISCAPACIDAD', 'RETIRADO'].includes(defaultSituacion)) ? `<option value="${escHtml(defaultSituacion)}" selected>${escHtml(defaultSituacion)}</option>` : ''}
              </select>
            </div>

            <!-- ─── SUBSECCIÓN: CONDICIÓN DE DISCAPACIDAD (Condicional cuando Situación = DISCAPACIDAD) ─── -->
            <div id="wrap-seccion-discapacidad" class="form-group span-2" style="${defaultSituacion === 'DISCAPACIDAD' ? 'display:block;' : 'display:none;'} margin-top: 10px; padding: 14px; background: rgba(14, 165, 233, 0.05); border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 8px;">
              <div style="font-size: 13px; font-weight: 700; color: #0284c7; display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
                <span>♿ Condición Especial / Discapacidad</span>
              </div>
              <div class="form-group span-2" style="margin-bottom: 0;">
                <label class="form-label" for="ef-tipo-discapacidad" style="font-weight:700;">
                  Tipo o Condición Especial de Discapacidad <span style="font-size:11px; color:var(--text-muted);">(Seleccione la condición acreditada)</span>
                </label>
                <select id="ef-tipo-discapacidad" class="filter-select" style="text-transform: uppercase;">
                  <option value="">NINGUNA / NO REGISTRA CONDICIÓN DE DISCAPACIDAD</option>
                  ${(cats.discapacidades || []).map(d => {
                    const optUpper = String(d || '').trim().toUpperCase();
                    if (!optUpper) return '';
                    const empDisc = (emp.tipoDiscapacidad || '').trim().toUpperCase();
                    const isSelected = empDisc && (
                      empDisc === optUpper ||
                      (optUpper.includes('FÍSICA') && (empDisc.includes('FISI') || empDisc.includes('MOTO'))) ||
                      (optUpper.includes('AUDITIVA') && empDisc.includes('AUDIT') && !empDisc.includes('SORDOMUD')) ||
                      (optUpper.includes('VISUAL') && empDisc.includes('VISU')) ||
                      (optUpper.includes('INTELECTUAL') && (empDisc.includes('INTELECT') || empDisc.includes('COGNIT'))) ||
                      (optUpper.includes('PSICOSOCIAL') && (empDisc.includes('PSICO') || empDisc.includes('MENTAL'))) ||
                      (optUpper.includes('SORDOMUDA') && empDisc.includes('SORDOMUD')) ||
                      (optUpper.includes('SORDOCIEGA') && (empDisc.includes('SORDOCIEG') || empDisc.includes('SORDOCIEGUERA'))) ||
                      (optUpper.includes('MÚLTIPLE') && (empDisc.includes('MULTIPL') || empDisc.includes('MÚLTIPL')))
                    );
                    return `<option value="${escHtml(optUpper)}" ${isSelected ? 'selected' : ''}>${escHtml(optUpper)}</option>`;
                  }).join('')}
                  ${(emp.tipoDiscapacidad && !(cats.discapacidades || []).some(d => {
                    const empDisc = emp.tipoDiscapacidad.trim().toUpperCase();
                    const optUpper = String(d || '').trim().toUpperCase();
                    return empDisc === optUpper ||
                      (optUpper.includes('FÍSICA') && (empDisc.includes('FISI') || empDisc.includes('MOTO'))) ||
                      (optUpper.includes('AUDITIVA') && empDisc.includes('AUDIT') && !empDisc.includes('SORDOMUD')) ||
                      (optUpper.includes('VISUAL') && empDisc.includes('VISU')) ||
                      (optUpper.includes('INTELECTUAL') && (empDisc.includes('INTELECT') || empDisc.includes('COGNIT'))) ||
                      (optUpper.includes('PSICOSOCIAL') && (empDisc.includes('PSICO') || empDisc.includes('MENTAL'))) ||
                      (optUpper.includes('SORDOMUDA') && empDisc.includes('SORDOMUD')) ||
                      (optUpper.includes('SORDOCIEGA') && (empDisc.includes('SORDOCIEG') || empDisc.includes('SORDOCIEGUERA'))) ||
                      (optUpper.includes('MÚLTIPLE') && (empDisc.includes('MULTIPL') || empDisc.includes('MÚLTIPL')));
                  }) && !['NINGUNA', 'NINGUNO', 'NO REGISTRA', 'SIN ESPECIFICAR'].includes(emp.tipoDiscapacidad.trim().toUpperCase()))
                    ? `<option value="${escHtml(emp.tipoDiscapacidad.trim().toUpperCase())}" selected>${escHtml(emp.tipoDiscapacidad.trim().toUpperCase())}</option>`
                    : ''}
                  <option value="__OTRO__">+ OTRA CONDICIÓN (ESPECIFICAR)...</option>
                </select>
                <input id="ef-tipo-discapacidad-custom" class="form-input" style="display:none; margin-top:8px; text-transform:uppercase;" placeholder="Especifique la condición de discapacidad..." />
              </div>
            </div>

            <!-- ─── SUBSECCIÓN: INFORMACIÓN DE ENCARGO (Condicional cuando Situación = ENCARGO) ─── -->
            <div id="wrap-seccion-encargo" class="form-group span-2" style="${defaultSituacion === 'ENCARGO' ? 'display:block;' : 'display:none;'} margin-top: 10px; padding: 14px; background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px;">
              <div style="font-size: 13px; font-weight: 700; color: #b45309; display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
                <span>🔄 Situación de Encargo Administrativo</span>
              </div>
              <div class="form-grid" style="margin-bottom: 0;">
                <div class="form-group span-2">
                  <label class="form-label" for="ef-encargo-denominacion">Denominación del Cargo en Encargo <span style="font-size:11px; color:var(--text-muted);">(Carga dinámica según dependencia o personalizada)</span></label>
                  <select id="ef-encargo-denominacion" class="filter-select">
                    <option value="${escHtml(emp.encargoDenominacion || '')}">${escHtml(emp.encargoDenominacion || '(Sin seleccionar / Vacío)')}</option>
                    <option value="__OTRO__">+ Otro Cargo (Especificar)...</option>
                  </select>
                  <input id="ef-encargo-denominacion-custom" class="form-input" style="display:none; margin-top:6px;" placeholder="Especifique la denominación del cargo en encargo..." />
                  <small style="font-size:11px; color:var(--text-muted);">Cargo temporal en el cual se encuentra encargado el servidor.</small>
                </div>
                <div class="form-group">
                  <label class="form-label" for="ef-encargo-codigo">Código del Encargo <span style="font-size:11px; color:var(--text-muted);">(Opcional, letras o números)</span></label>
                  <input id="ef-encargo-codigo" class="form-input font-mono" placeholder="Ej: 407, 219" value="${escHtml(emp.encargoCodigo || '')}" enterkeyhint="next" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ef-encargo-grado">Grado del Encargo <span style="font-size:11px; color:var(--text-muted);">(Opcional)</span></label>
                  <select id="ef-encargo-grado" class="filter-select">
                    <option value="">(Sin Grado / Vacío)</option>
                    ${cats.grados.map(g => `<option value="${escHtml(g)}" ${String(emp.encargoGrado || '').toLowerCase() === String(g).toLowerCase() ? 'selected' : ''}>${escHtml(g)}</option>`).join('')}
                    ${emp.encargoGrado && !cats.grados.some(g => String(g).toLowerCase() === String(emp.encargoGrado).toLowerCase()) ? `<option value="${escHtml(emp.encargoGrado)}" selected>${escHtml(emp.encargoGrado)}</option>` : ''}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="ef-encargo-asignacion">Asignación Salarial del Encargo</label>
                  <input id="ef-encargo-asignacion" class="form-input font-mono" placeholder="$ 0" value="${escHtml(formatAsignacionSalarial(emp.encargoAsignacion))}" enterkeyhint="next" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ef-fecha-encargo">Fecha de Encargo</label>
                  <input id="ef-fecha-encargo" type="date" class="form-input" value="${escHtml(emp.fechaEncargo || '')}" />
                </div>
                <div class="form-group span-2">
                  <label class="form-label" for="ef-novedades">Novedades y Observaciones del Personal</label>
                  <input id="ef-novedades" class="form-input" placeholder="Ej: VACANTE TEMPORAL DE..." value="${escHtml(emp.novedades || '')}" enterkeyhint="next" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── PESTAÑA: TIEMPOS DE SERVICIO ─── -->
        <div id="tab-form-tiempos" class="form-tab-pane" style="padding-top: 6px;">
          <div class="form-grid">
            <div class="form-group span-2">
              <label class="form-label" for="ef-fecha-ingreso">Fecha de Ingreso</label>
              <input id="ef-fecha-ingreso" type="date" class="form-input" value="${escHtml(emp.fechaIngreso || '')}" />
              <div id="ef-tiempo-calc-display" class="ef-calc-display-val">
                ${emp.tiempoServicioCalculado ? `Tiempo: ${escHtml(emp.tiempoServicioCalculado)}` : ''}
              </div>
            </div>

            <div class="form-group span-2">
              <label class="form-label">Otro Tiempo con la Gobernación (Experiencia Múltiple) <span style="font-size:11px; color:var(--text-muted);">(Opcional, agregue periodos con fecha desde y hasta)</span></label>
              <div id="ef-periodos-container" style="display:flex; flex-direction:column; gap:8px;">
                ${periodosList.map((p, idx) => `
                  <div class="periodo-row" style="display:grid; grid-template-columns: 1fr 1fr 1.4fr auto; gap:10px; align-items:center; background:var(--color-bg-secondary); padding:8px 12px; border-radius:8px; border:1px solid var(--color-border);">
                    <div>
                      <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Desde</label>
                      <input type="date" class="form-input ef-periodo-desde" value="${escHtml(p.desde || '')}" required />
                    </div>
                    <div>
                      <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Hasta</label>
                      <input type="date" class="form-input ef-periodo-hasta" value="${escHtml(p.hasta || '')}" required />
                    </div>
                    <div class="ef-periodo-duracion">
                      ${escHtml(p.duracionTexto || '')}
                    </div>
                    <div style="padding-top:14px; display:flex; justify-content:center;">
                      <button type="button" class="btn-action-delete btn-del-periodo" title="Eliminar periodo" aria-label="Eliminar periodo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-add-periodo" style="font-size:11px;">+ Agregar Periodo Histórico</button>
                <div id="ef-periodos-total-display" class="ef-periodos-total"></div>
              </div>
              <div id="ef-tiempo-total-display" style="display:none; font-size:14.5px; font-weight:700; color:var(--color-navy); margin-top:12px; padding:12px 18px; background:rgba(0,123,199,0.08); border:1.5px solid rgba(0,123,199,0.3); border-radius:10px; box-shadow:0 3px 10px rgba(0,123,199,0.06);"></div>
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
              <input id="ef-funciones" class="form-input" placeholder="Ej: 01 o DECRETO 145 DE 2024" value="${escHtml(emp.funciones || '')}" enterkeyhint="next" />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-estudios">Estudios (Pregrado)</label>
              <select id="ef-estudios" class="filter-select">
                <option value="">(Sin seleccionar / Vacío)</option>
                ${(cats.estudios || []).map(est => `<option value="${escHtml(est)}" ${(emp.estudios || '').toUpperCase() === est ? 'selected' : ''}>${escHtml(est)}</option>`).join('')}
                <option value="__OTRO__">+ Otro Estudio (Especificar)...</option>
              </select>
              <input id="ef-estudios-custom" class="form-input" style="display:none; margin-top:6px;" placeholder="Especifique la carrera o título de estudio..." />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-inst-estudios">Institución de Estudios</label>
              <select id="ef-inst-estudios" class="filter-select">
                <option value="">(Sin seleccionar / Vacío)</option>
                ${(cats.institucionesEstudios || []).map(inst => `<option value="${escHtml(inst)}" ${(emp.institucionEstudios || '').toUpperCase() === inst ? 'selected' : ''}>${escHtml(inst)}</option>`).join('')}
                <option value="__OTRA__">+ Otra Institución (Especificar)...</option>
              </select>
              <input id="ef-inst-estudios-custom" class="form-input" style="display:none; margin-top:6px;" placeholder="Especifique la universidad o institución..." />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-matricula">Matrícula Profesional <span style="font-size:11px; color:var(--text-muted);">(Opcional: letras, números, guiones, etc.)</span></label>
              <input id="ef-matricula" class="form-input font-mono" placeholder="Ej: 15-28490-T, MP-1049" value="${escHtml(emp.matriculaProfesional || '')}" enterkeyhint="next" />
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
              <input id="ef-telefono-fijo" type="tel" inputmode="tel" class="form-input font-mono" placeholder="Ej: 7401234" value="${escHtml(emp.telefonoFijo || '')}" enterkeyhint="next" />
            </div>

            <div class="form-group span-2">
              <label class="form-label">Teléfonos Celulares <span style="font-size:11px; color:var(--text-muted);">(Hasta 3 números, inician con 3, 9-10 dígitos c/u)</span></label>
              <div id="ef-celulares-container" style="display:flex; flex-direction:column; gap:8px;">
                ${celularesList.map((cel, idx) => `
                  <div class="celular-row" style="display:flex; align-items:center; gap:8px;">
                    <input type="tel" inputmode="numeric" class="form-input ef-celular-input font-mono" placeholder="Ej: 3000000000" value="${escHtml(cel)}" maxlength="10" enterkeyhint="next" />
                    ${idx > 0 ? `<button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()" style="padding:4px 8px;">✕</button>` : ''}
                  </div>
                `).join('')}
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-celular" style="margin-top:6px; font-size:11px;">+ Agregar otro celular</button>
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-correo-inst">Correo Institucional</label>
              <input id="ef-correo-inst" type="email" inputmode="email" class="form-input font-mono" placeholder="Ej: usuario@boyaca.gov.co" value="${escHtml(emp.correo || '')}" enterkeyhint="next" />
            </div>

            <div class="form-group">
              <label class="form-label" for="ef-correo-pers">Correo Personal</label>
              <input id="ef-correo-pers" type="email" inputmode="email" class="form-input font-mono" placeholder="Ej: usuario@gmail.com" value="${escHtml(emp.correoPersonal || '')}" enterkeyhint="next" />
            </div>

            <div class="form-group span-2">
              <label class="form-label" for="ef-direccion">Dirección de Residencia</label>
              <input id="ef-direccion" class="form-input" placeholder="Ej: Calle 20 # 10-45, Tunja" value="${escHtml(emp.direccion || '')}" enterkeyhint="done" />
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

    // 0. Asegurar inicialización de Flatpickr en todos los selectores de fecha del modal
    App.initDatePickers(document.getElementById('modal-body') || document);

    // 1. Regla 7: Restricción en Nombres y Apellidos (Solo letras y espacios)
    ['ef-nombres', 'ef-apellidos', 'ef-nombre'].forEach(id => {
      const inp = document.getElementById(id);
      if (inp) {
        inp.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
        });
      }
    });

    // 2. Regla 8: Restricción en Cédula (Solo números)
    const cedulaInput = document.getElementById('ef-cedula');
    if (cedulaInput) {
      cedulaInput.addEventListener('input', (e) => {
        // Permitir prefijo PROV si ya lo tenía
        if (e.target.value.startsWith('PROV-')) return;
        e.target.value = e.target.value.replace(/[^\d]/g, '');
      });
    }

    // 3. Regla 1: Dependencia y Cargo (Carga dinámica y deduplicada según dependencia para Titular y Encargo)
    const depSelect = document.getElementById('ef-dep');
    const depCustom = document.getElementById('ef-dep-custom');
    const cargoSelect = document.getElementById('ef-cargo');
    const cargoCustom = document.getElementById('ef-cargo-custom');
    const codigoInput = document.getElementById('ef-codigo-cargo');
    const gradoSelect = document.getElementById('ef-grado');

    const encargoCargoSelect = document.getElementById('ef-encargo-denominacion');
    const encargoCargoCustom = document.getElementById('ef-encargo-denominacion-custom');
    const encargoCodigoInput = document.getElementById('ef-encargo-codigo');
    const encargoGradoSelect = document.getElementById('ef-encargo-grado');
    const asignacionInput = document.getElementById('ef-encargo-asignacion');

    const updateCargosForDep = (selectedDep, currentCargo = '', currentEncargoCargo = '') => {
      const cleanDep = (selectedDep || '').trim().toUpperCase();
      let rawList = (cleanDep && cats.cargosPorDependencia[cleanDep]) ? cats.cargosPorDependencia[cleanDep] : (cats.cargos || []);

      // Deduplicación estricta por denominación de cargo
      const seenCargos = new Set();
      const availableCargos = [];
      for (const item of rawList) {
        const u = (item.cargo || '').toUpperCase().trim();
        if (u && !seenCargos.has(u)) {
          seenCargos.add(u);
          availableCargos.push(item);
        }
      }

      // 3.1 Cargo Titular
      if (cargoSelect) {
        cargoSelect.innerHTML = '<option value="">(Sin seleccionar / Vacío)</option>' +
          availableCargos.map(c => `<option value="${escHtml(c.cargo)}" data-codigo="${escHtml(c.codigo || '')}" data-grado="${escHtml(c.grado || '')}" ${c.cargo.toUpperCase() === (currentCargo || '').toUpperCase() ? 'selected' : ''}>${escHtml(c.cargo)}</option>`).join('') +
          '<option value="__OTRO__">+ Otro Cargo (Especificar)...</option>';

        if (currentCargo && !seenCargos.has(currentCargo.toUpperCase())) {
          cargoSelect.value = '__OTRO__';
          if (cargoCustom) {
            cargoCustom.value = currentCargo;
            cargoCustom.style.display = 'block';
          }
        } else if (cargoCustom) {
          cargoCustom.style.display = cargoSelect.value === '__OTRO__' ? 'block' : 'none';
        }
      }

      // 3.2 Cargo en Encargo (Desplegable dinámico con los cargos de la dependencia)
      if (encargoCargoSelect) {
        const targetEncargo = currentEncargoCargo || encargoCargoSelect.value || '';
        encargoCargoSelect.innerHTML = '<option value="">(Sin seleccionar / Vacío)</option>' +
          availableCargos.map(c => `<option value="${escHtml(c.cargo)}" data-codigo="${escHtml(c.codigo || '')}" data-grado="${escHtml(c.grado || '')}" data-asignacion="${escHtml(c.asignacion || '')}" ${c.cargo.toUpperCase() === targetEncargo.toUpperCase() ? 'selected' : ''}>${escHtml(c.cargo)}</option>`).join('') +
          '<option value="__OTRO__">+ Otro Cargo (Especificar)...</option>';

        if (targetEncargo && !seenCargos.has(targetEncargo.toUpperCase()) && targetEncargo !== '__OTRO__') {
          encargoCargoSelect.value = '__OTRO__';
          if (encargoCargoCustom) {
            encargoCargoCustom.value = targetEncargo;
            encargoCargoCustom.style.display = 'block';
          }
        } else if (encargoCargoCustom) {
          encargoCargoCustom.style.display = encargoCargoSelect.value === '__OTRO__' ? 'block' : 'none';
        }
      }
    };

    if (depSelect) {
      depSelect.addEventListener('change', (e) => {
        const currentSelectedTitular = cargoSelect?.value === '__OTRO__' ? (cargoCustom?.value || '') : (cargoSelect?.value || '');
        const currentSelectedEncargo = encargoCargoSelect?.value === '__OTRO__' ? (encargoCargoCustom?.value || '') : (encargoCargoSelect?.value || '');
        if (e.target.value === '__OTRA__') {
          if (depCustom) {
            depCustom.style.display = 'block';
            depCustom.focus();
          }
          updateCargosForDep('', currentSelectedTitular, currentSelectedEncargo);
        } else {
          if (depCustom) depCustom.style.display = 'none';
          updateCargosForDep(e.target.value, currentSelectedTitular, currentSelectedEncargo);
        }
      });

      if (emp.dependencia) {
        const matchDep = Array.from(depSelect.options).find(o => o.value.toUpperCase() === emp.dependencia.toUpperCase());
        if (matchDep) {
          depSelect.value = matchDep.value;
          updateCargosForDep(matchDep.value, emp.cargoActual || '', emp.encargoDenominacion || '');
        } else {
          depSelect.value = '__OTRA__';
          if (depCustom) {
            depCustom.value = emp.dependencia;
            depCustom.style.display = 'block';
          }
          updateCargosForDep('', emp.cargoActual || '', emp.encargoDenominacion || '');
        }
      } else {
        updateCargosForDep('', emp.cargoActual || '', emp.encargoDenominacion || '');
      }
    }

    if (cargoSelect) {
      cargoSelect.addEventListener('change', () => {
        if (cargoSelect.value === '__OTRO__') {
          if (cargoCustom) {
            cargoCustom.style.display = 'block';
            cargoCustom.focus();
          }
          return;
        }
        if (cargoCustom) cargoCustom.style.display = 'none';

        const selOpt = cargoSelect.selectedOptions[0];
        if (selOpt && codigoInput) {
          const defaultCode = selOpt.getAttribute('data-codigo');
          if (defaultCode) codigoInput.value = defaultCode;
          const defaultGrado = selOpt.getAttribute('data-grado');
          if (defaultGrado && gradoSelect) {
            const match = cats.grados.find(g => g.toLowerCase() === defaultGrado.toLowerCase());
            if (match) gradoSelect.value = match;
          }
        }
      });
    }

    // Interacción y autocompletado en Denominación del Cargo en Encargo
    if (encargoCargoSelect) {
      encargoCargoSelect.addEventListener('change', () => {
        if (encargoCargoSelect.value === '__OTRO__') {
          if (encargoCargoCustom) {
            encargoCargoCustom.style.display = 'block';
            encargoCargoCustom.focus();
          }
          return;
        }
        if (encargoCargoCustom) encargoCargoCustom.style.display = 'none';

        const selOpt = encargoCargoSelect.selectedOptions[0];
        if (selOpt) {
          const defaultCode = selOpt.getAttribute('data-codigo');
          if (defaultCode && encargoCodigoInput) encargoCodigoInput.value = defaultCode;

          const defaultGrado = selOpt.getAttribute('data-grado');
          if (defaultGrado && encargoGradoSelect) {
            const match = cats.grados.find(g => g.toLowerCase() === defaultGrado.toLowerCase());
            if (match) encargoGradoSelect.value = match;
            else encargoGradoSelect.value = defaultGrado;
          }

          const defaultAsignacion = selOpt.getAttribute('data-asignacion');
          if (defaultAsignacion && asignacionInput && (!asignacionInput.value || asignacionInput.value.trim() === '' || asignacionInput.value === '$ ')) {
            const digits = defaultAsignacion.replace(/[^\d]/g, '');
            if (digits && parseInt(digits, 10) > 0) {
              asignacionInput.value = '$ ' + parseInt(digits, 10).toLocaleString('es-CO');
            }
          }
          if (typeof App !== 'undefined' && App.refreshFloatingLabels) {
            const wrapEnc = document.getElementById('wrap-seccion-encargo');
            if (wrapEnc) App.refreshFloatingLabels(wrapEnc);
          }
        }
      });
    }

    // Formateo interactivo de Asignación Salarial del Encargo con prefijo '$ ' persistente
    if (asignacionInput) {
      asignacionInput.addEventListener('focus', () => {
        if (!asignacionInput.value || !asignacionInput.value.trim()) {
          asignacionInput.value = '$ ';
        }
      });

      asignacionInput.addEventListener('input', (e) => {
        const raw = e.target.value;
        const digits = raw.replace(/[^\d]/g, '');
        if (!digits) {
          e.target.value = '$ ';
        } else {
          const num = parseInt(digits, 10);
          e.target.value = '$ ' + num.toLocaleString('es-CO');
        }
      });

      asignacionInput.addEventListener('blur', () => {
        const digits = asignacionInput.value.replace(/[^\d]/g, '');
        if (!digits) {
          asignacionInput.value = '';
          if (typeof App !== 'undefined' && App.refreshFloatingLabels) {
            App.refreshFloatingLabels(asignacionInput.closest('.form-group') || document);
          }
        }
      });
    }

    // 4. Tipo de Vinculación condicional "Otra..."
    const clasifSelect = document.getElementById('ef-clasificacion');
    const clasifCustom = document.getElementById('ef-clasificacion-custom');
    if (clasifSelect && clasifCustom) {
      clasifSelect.addEventListener('change', () => {
        if (clasifSelect.value === '__OTRA__') {
          clasifCustom.style.display = 'block';
          clasifCustom.focus();
        } else {
          clasifCustom.style.display = 'none';
        }
      });
      if (emp.clasificacionEmpleo) {
        const match = Array.from(clasifSelect.options).find(o => normalizarClasificacion(o.value) === normalizarClasificacion(emp.clasificacionEmpleo));
        if (match) {
          clasifSelect.value = match.value;
        } else {
          clasifSelect.value = '__OTRA__';
          clasifCustom.value = emp.clasificacionEmpleo;
          clasifCustom.style.display = 'block';
        }
      }
    }

    // 5. Regla 10: Expedición de Cédula (Departamento -> Municipio dinámico vía DIVIPOLA)
    const deptoExpSelect = document.getElementById('ef-depto-exp');
    const mpioExpSelect = document.getElementById('ef-municipio-exp') || document.getElementById('ef-ciudad-exp');

    const updateMunicipiosForDepto = (selectedDepto, currentMpio = '') => {
      if (!mpioExpSelect) return;
      const cleanDepto = (selectedDepto || '').trim().toUpperCase();
      const mpios = cats.divipola.municipiosPorDepto[cleanDepto] || [];
      mpioExpSelect.innerHTML = '<option value="">(Sin seleccionar / Vacío)</option>' +
        mpios.map(c => `<option value="${escHtml(c)}" ${c.toUpperCase() === (currentMpio || '').toUpperCase() ? 'selected' : ''}>${escHtml(c)}</option>`).join('');

      if (currentMpio && !mpios.some(m => m.toUpperCase() === currentMpio.toUpperCase())) {
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
      // Solo en modo edición o si ya viene especificado el departamento
      if (emp.departamentoExpedicion) {
        updateMunicipiosForDepto(emp.departamentoExpedicion, emp.municipioExpedicion || emp.ciudadExpedicion || '');
      }
    }

    // 6. Regla 12: Situación Administrativa y Secciones Condicionales (Encargo y Discapacidad)
    const situacionSelect = document.getElementById('ef-situacion');
    const wrapEncargo = document.getElementById('wrap-seccion-encargo');
    const wrapDiscapacidad = document.getElementById('wrap-seccion-discapacidad');
    const discSelect = document.getElementById('ef-tipo-discapacidad');
    const discCustom = document.getElementById('ef-tipo-discapacidad-custom');

    const updateSituacionSections = () => {
      const sit = (situacionSelect?.value || 'ACTIVO').trim().toUpperCase();
      const isEncargo = sit === 'ENCARGO';
      const isDisc = sit.includes('DISCAPACIDAD') || sit.includes('DISCPACIDAD');

      if (wrapEncargo) wrapEncargo.style.display = isEncargo ? 'block' : 'none';
      if (wrapDiscapacidad) wrapDiscapacidad.style.display = isDisc ? 'block' : 'none';

      if (typeof App !== 'undefined' && App.refreshFloatingLabels) {
        if (isEncargo && wrapEncargo) App.refreshFloatingLabels(wrapEncargo);
        if (isDisc && wrapDiscapacidad) App.refreshFloatingLabels(wrapDiscapacidad);
      }
    };

    if (situacionSelect) {
      situacionSelect.addEventListener('change', updateSituacionSections);
      updateSituacionSections();
    }

    if (discSelect && discCustom) {
      discSelect.addEventListener('change', () => {
        if (discSelect.value === '__OTRO__') {
          discCustom.style.display = 'block';
          discCustom.focus();
        } else {
          discCustom.style.display = 'none';
        }
      });
      if (emp.tipoDiscapacidad && !['ninguna', 'ninguno', 'no registra', 'sin especificar'].includes(emp.tipoDiscapacidad.trim().toLowerCase())) {
        const empUpper = emp.tipoDiscapacidad.trim().toUpperCase();
        const match = Array.from(discSelect.options).find(o => o.value.toUpperCase() === empUpper);
        if (match) {
          discSelect.value = match.value;
        } else {
          discSelect.value = '__OTRO__';
          discCustom.value = empUpper;
          discCustom.style.display = 'block';
        }
      }
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
              durDisplay.classList.remove('is-error');
              durDisplay.style.color = '';
              durDisplay.textContent = diff.texto;
            }
            totalAnios += diff.anios;
            totalMeses += diff.meses;
            totalDias += diff.dias;
            validCount++;
          } else {
            if (durDisplay) {
              durDisplay.classList.add('is-error');
              durDisplay.style.color = 'var(--color-danger)';
              durDisplay.textContent = 'Hasta debe ser ≥ Desde';
            }
          }
        } else {
          if (durDisplay) {
            durDisplay.classList.remove('is-error');
            durDisplay.style.color = '';
            durDisplay.textContent = '';
          }
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
          tiempoTotalDisplay.style.display = 'flex';
          tiempoTotalDisplay.style.alignItems = 'center';
          tiempoTotalDisplay.style.gap = '12px';
          tiempoTotalDisplay.innerHTML = `
            <span style="font-size:28px; line-height:1;">🏆</span>
            <div style="flex:1;">
              <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-secondary);">Tiempo Total en la Gobernación Estimado</div>
              <div style="font-size:16px; font-weight:800; color:var(--color-navy); margin-top:2px;">
                ${totalCombined.texto}
                <span style="font-size:12px; font-weight:700; padding:3px 10px; border-radius:12px; background:rgba(145,65,105,0.12); color:#914169; margin-left:8px;">Servicio + Otro Tiempo</span>
              </div>
            </div>`;
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

      if (desdeInp) {
        desdeInp.addEventListener('change', updatePeriodosTotal);
        desdeInp.addEventListener('input', updatePeriodosTotal);
      }
      if (hastaInp) {
        hastaInp.addEventListener('change', updatePeriodosTotal);
        hastaInp.addEventListener('input', updatePeriodosTotal);
      }
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
        div.style = 'display:grid; grid-template-columns: 1fr 1fr 1.4fr auto; gap:10px; align-items:center; background:var(--color-bg-secondary); padding:8px 12px; border-radius:8px; border:1px solid var(--color-border);';
        div.innerHTML = `
          <div>
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Desde</label>
            <input type="date" class="form-input ef-periodo-desde" required />
          </div>
          <div>
            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Hasta</label>
            <input type="date" class="form-input ef-periodo-hasta" required />
          </div>
          <div class="ef-periodo-duracion"></div>
          <div style="padding-top:14px; display:flex; justify-content:center;">
            <button type="button" class="btn-action-delete btn-del-periodo" title="Eliminar periodo" aria-label="Eliminar periodo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        `;
        periodosContainer.appendChild(div);
        App.initDatePickers(div);
        bindPeriodoRow(div);
      });
    }

    // 9. Estudios e Institución condicional "Otro..."
    const estudiosSelect = document.getElementById('ef-estudios');
    const estudiosCustom = document.getElementById('ef-estudios-custom');
    if (estudiosSelect && estudiosCustom) {
      estudiosSelect.addEventListener('change', () => {
        if (estudiosSelect.value === '__OTRO__') {
          estudiosCustom.style.display = 'block';
          estudiosCustom.focus();
        } else {
          estudiosCustom.style.display = 'none';
        }
      });
      if (emp.estudios) {
        const match = Array.from(estudiosSelect.options).find(o => o.value.toUpperCase() === emp.estudios.toUpperCase());
        if (match) {
          estudiosSelect.value = match.value;
        } else {
          estudiosSelect.value = '__OTRO__';
          estudiosCustom.value = emp.estudios;
          estudiosCustom.style.display = 'block';
        }
      }
    }

    const instSelect = document.getElementById('ef-inst-estudios');
    const instCustom = document.getElementById('ef-inst-estudios-custom');
    if (instSelect && instCustom) {
      instSelect.addEventListener('change', () => {
        if (instSelect.value === '__OTRA__') {
          instCustom.style.display = 'block';
          instCustom.focus();
        } else {
          instCustom.style.display = 'none';
        }
      });
      if (emp.institucionEstudios) {
        const match = Array.from(instSelect.options).find(o => o.value.toUpperCase() === emp.institucionEstudios.toUpperCase());
        if (match) {
          instSelect.value = match.value;
        } else {
          instSelect.value = '__OTRA__';
          instCustom.value = emp.institucionEstudios;
          instCustom.style.display = 'block';
        }
      }
    }

    // 10. Teléfono fijo (solo dígitos)
    const telFijoInput = document.getElementById('ef-telefono-fijo');
    if (telFijoInput) {
      telFijoInput.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d]/g, ''); });
    }

    // 11. Celular dinámico (hasta 3 números independientes de 9-10 dígitos iniciando con 3)
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
          <input class="form-input ef-celular-input font-mono" placeholder="Ej: 3000000000" maxlength="10" />
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
        state.catalogs.discapacidades = (cats.discapacidades || state.catalogs.discapacidades || []).map(d => String(d).toUpperCase());
        state.catalogs.diplomados = cats.diplomados || state.catalogs.diplomados;
        state.catalogs.estudios = cats.estudios || [];
        state.catalogs.institucionesEstudios = cats.institucionesEstudios || [];
      }
    } catch (err) {
      console.warn('Error al cargar catálogos completos:', err);
    }
  }

  function readForm(isEdit = false) {
    const isVacanteForm = document.getElementById('ef-cedula')?.type === 'hidden' || Boolean(document.getElementById('ef-nombre'));
    let nombreCompletoFinal = '';
    let nombresVal = '';
    let apellidosVal = '';

    if (isVacanteForm) {
      const nomVac = document.getElementById('ef-nombre')?.value.trim();
      if (!nomVac) {
        markInvalidField('ef-nombre', 'La denominación de la plaza es obligatoria.');
        return null;
      }
      nombreCompletoFinal = nomVac.toUpperCase();
    } else {
      nombresVal = document.getElementById('ef-nombres')?.value.trim();
      apellidosVal = document.getElementById('ef-apellidos')?.value.trim();

      if (!nombresVal) {
        markInvalidField('ef-nombres', 'Los Nombres son obligatorios.');
        return null;
      }
      if (!apellidosVal) {
        markInvalidField('ef-apellidos', 'Los Apellidos son obligatorios.');
        return null;
      }

      if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(nombresVal)) {
        markInvalidField('ef-nombres', 'Los Nombres solo admiten letras y espacios.');
        return null;
      }
      if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(apellidosVal)) {
        markInvalidField('ef-apellidos', 'Los Apellidos solo admiten letras y espacios.');
        return null;
      }

      // Orden estándar institucional: APELLIDOS NOMBRES (ej. SILVA JUAN ESTEBAN)
      nombreCompletoFinal = `${apellidosVal.toUpperCase()} ${nombresVal.toUpperCase()}`.replace(/\s+/g, ' ');
    }

    const cedula = document.getElementById('ef-cedula')?.value.trim();

    // 2. Validar Cédula de Ciudadanía (OBLIGATORIA: solo números, salvo en vacantes)
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
    const sexoRaw = document.getElementById('ef-sexo')?.value;
    const sexo = sexoRaw ? sexoRaw.trim().toUpperCase() : null;

    // 7. Dependencia (con soporte para especificar "Otra...")
    const depRaw = document.getElementById('ef-dep')?.value;
    const depCustomVal = document.getElementById('ef-dep-custom')?.value.trim();
    let finalDep = null;
    if (depRaw === '__OTRA__') {
      if (!depCustomVal) {
        markInvalidField('ef-dep-custom', 'Por favor especifique el nombre de la nueva dependencia.');
        return null;
      }
      finalDep = depCustomVal.toUpperCase();
    } else if (depRaw) {
      finalDep = depRaw.trim().toUpperCase();
    }

    // 8. Cargo (con soporte para especificar "Otro...")
    const cargoRaw = document.getElementById('ef-cargo')?.value;
    const cargoCustomVal = document.getElementById('ef-cargo-custom')?.value.trim();
    let finalCargo = null;
    if (cargoRaw === '__OTRO__') {
      if (!cargoCustomVal) {
        markInvalidField('ef-cargo-custom', 'Por favor especifique la denominación del nuevo cargo.');
        return null;
      }
      finalCargo = cargoCustomVal.toUpperCase();
    } else if (cargoRaw) {
      finalCargo = cargoRaw.trim().toUpperCase();
    }

    // 9. Tipo de Vinculación (con soporte para especificar "Otra...")
    const clasifRaw = document.getElementById('ef-clasificacion')?.value;
    const clasifCustomVal = document.getElementById('ef-clasificacion-custom')?.value.trim();
    let finalClasif = 'Sin clasificar';
    if (clasifRaw === '__OTRA__') {
      if (!clasifCustomVal) {
        markInvalidField('ef-clasificacion-custom', 'Por favor especifique el tipo de vinculación.');
        return null;
      }
      finalClasif = normalizarClasificacion(clasifCustomVal.toUpperCase());
    } else if (clasifRaw) {
      finalClasif = normalizarClasificacion(clasifRaw);
    }

    // 10. Situación Administrativa y Condicionales (Discapacidad y Encargo)
    const situacion = (document.getElementById('ef-situacion')?.value || 'ACTIVO').trim().toUpperCase();
    const isSituacionDiscapacidad = situacion.includes('DISCAPACIDAD') || situacion.includes('DISCPACIDAD');
    const isSituacionEncargo = situacion === 'ENCARGO';

    let tipoDiscapacidad = null;
    if (isSituacionDiscapacidad) {
      const tipoDiscapacidadSelect = document.getElementById('ef-tipo-discapacidad');
      const tipoDiscapacidadCustom = document.getElementById('ef-tipo-discapacidad-custom');
      const tipoDiscapacidadRaw = tipoDiscapacidadSelect?.value?.trim() || '';
      if (tipoDiscapacidadRaw === '__OTRO__') {
        const customVal = tipoDiscapacidadCustom?.value?.trim().toUpperCase();
        if (!customVal) {
          markInvalidField('ef-tipo-discapacidad-custom', 'Por favor especifique la condición especial o de discapacidad.');
          return null;
        }
        tipoDiscapacidad = customVal;
        if (state.catalogs.discapacidades && !state.catalogs.discapacidades.includes(customVal)) {
          state.catalogs.discapacidades.push(customVal);
          state.catalogs.discapacidades.sort((a, b) => a.localeCompare(b, 'es'));
        }
      } else if (tipoDiscapacidadRaw && !['ninguna', 'ninguno', 'no registra', 'sin especificar'].includes(tipoDiscapacidadRaw.toLowerCase())) {
        tipoDiscapacidad = tipoDiscapacidadRaw.toUpperCase();
      }
    }

    // 11. Periodos de Otro Tiempo con la Gobernación (Experiencia Múltiple, Opcional)
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

    // 12. Celulares (Opcionales, hasta 3 números independientes de 9-10 dígitos iniciando con 3)
    const celularInputs = document.querySelectorAll('.ef-celular-input');
    const celulares = [];
    for (const inp of celularInputs) {
      const val = inp.value.trim().replace(/[^\d]/g, '');
      if (val) {
        if (!/^[3]\d{8,9}$/.test(val)) {
          markInvalidField(inp, `El celular "${val}" debe iniciar con el número 3 y contener 9 o 10 dígitos.`);
          return null;
        }
        celulares.push(val);
      }
    }

    // 13. Teléfono fijo (Opcional, 6 a 12 dígitos)
    const telFijoInp = document.getElementById('ef-telefono-fijo');
    const telefonoFijo = telFijoInp?.value.trim().replace(/[^\d]/g, '');
    if (telefonoFijo && (telefonoFijo.length < 6 || telefonoFijo.length > 12)) {
      markInvalidField(telFijoInp, 'El teléfono fijo debe contener entre 6 y 12 dígitos numéricos.');
      return null;
    }

    // 14. Correo institucional (Opcional, solo valida @ si se ingresa)
    const correoInp = document.getElementById('ef-correo-inst');
    const correo = correoInp?.value.trim();
    if (correo && !correo.includes('@')) {
      markInvalidField(correoInp, 'El Correo Institucional debe contener "@".');
      return null;
    }

    // 15. Correo personal (Opcional, solo valida @ si se ingresa)
    const correoPersInp = document.getElementById('ef-correo-pers');
    const correoPersonal = correoPersInp?.value.trim();
    if (correoPersonal && !correoPersonal.includes('@')) {
      markInvalidField(correoPersInp, 'El Correo Personal debe contener "@".');
      return null;
    }

    // 16. Estudios e Institución de Estudios (con soporte para especificar "Otro...")
    const estRaw = document.getElementById('ef-estudios')?.value;
    const estCustomVal = document.getElementById('ef-estudios-custom')?.value.trim();
    let finalEst = null;
    if (estRaw === '__OTRO__') {
      if (!estCustomVal) {
        markInvalidField('ef-estudios-custom', 'Por favor especifique la carrera o título de estudio.');
        return null;
      }
      finalEst = estCustomVal.toUpperCase();
    } else if (estRaw) {
      finalEst = estRaw.trim().toUpperCase();
    }

    const instRaw = document.getElementById('ef-inst-estudios')?.value;
    const instCustomVal = document.getElementById('ef-inst-estudios-custom')?.value.trim();
    let finalInst = null;
    if (instRaw === '__OTRA__') {
      if (!instCustomVal) {
        markInvalidField('ef-inst-estudios-custom', 'Por favor especifique la universidad o institución de estudios.');
        return null;
      }
      finalInst = instCustomVal.toUpperCase();
    } else if (instRaw) {
      finalInst = instRaw.trim().toUpperCase();
    }

    const tieneDiplomado = document.getElementById('ef-diplomado-toggle')?.value === 'SI';
    const diplomadoCapSena = tieneDiplomado ? (document.getElementById('ef-diplomado-opt')?.value || 'Diplomado Registrado') : null;

    const deptoExpVal = document.getElementById('ef-depto-exp')?.value?.trim().toUpperCase() || null;
    const mpioRaw = document.getElementById('ef-municipio-exp')?.value || document.getElementById('ef-ciudad-exp')?.value;
    const mpioVal = mpioRaw ? mpioRaw.trim().toUpperCase() : null;

    // Matrícula profesional (admite letras, números, guiones, etc.)
    const matriculaVal = document.getElementById('ef-matricula')?.value.trim() || null;

    const funcionesVal = document.getElementById('ef-funciones')?.value.trim() || null;
    const direccionVal = document.getElementById('ef-direccion')?.value.trim() || null;

    // Datos del Encargo Administrativo (solo aplican si la situación es ENCARGO)
    let encargoDenominacion = null;
    let encargoCodigo = null;
    let encargoGrado = null;
    let encargoAsignacion = null;
    let fechaEncargo = null;
    let novedades = null;

    if (isSituacionEncargo) {
      const encargoRaw = document.getElementById('ef-encargo-denominacion')?.value;
      const encargoCustomVal = document.getElementById('ef-encargo-denominacion-custom')?.value?.trim();
      if (encargoRaw === '__OTRO__') {
        if (!encargoCustomVal) {
          markInvalidField('ef-encargo-denominacion-custom', 'Por favor especifique la denominación del cargo en encargo.');
          return null;
        }
        encargoDenominacion = encargoCustomVal.toUpperCase();
      } else if (encargoRaw) {
        encargoDenominacion = encargoRaw.trim().toUpperCase();
      }

      encargoCodigo = document.getElementById('ef-encargo-codigo')?.value?.trim().toUpperCase() || null;
      encargoGrado = document.getElementById('ef-encargo-grado')?.value?.trim().toUpperCase() || null;

      const asignacionRaw = document.getElementById('ef-encargo-asignacion')?.value?.trim();
      const asignacionDigits = asignacionRaw ? asignacionRaw.replace(/[^\d]/g, '') : '';
      encargoAsignacion = asignacionDigits ? ('$ ' + parseInt(asignacionDigits, 10).toLocaleString('es-CO')) : null;

      fechaEncargo = document.getElementById('ef-fecha-encargo')?.value || null;
      const novedadesVal = document.getElementById('ef-novedades')?.value?.trim();
      novedades = novedadesVal ? novedadesVal.toUpperCase() : null;
    }

    return {
      encargoDenominacion,
      encargoCodigo,
      encargoGrado,
      encargoAsignacion,
      nombreCompleto: nombreCompletoFinal,
      nombres: nombresVal ? nombresVal.toUpperCase() : null,
      apellidos: apellidosVal ? apellidosVal.toUpperCase() : null,
      primerApellido: apellidosVal ? apellidosVal.split(/\s+/)[0].toUpperCase() : null,
      segundoApellido: apellidosVal ? (apellidosVal.split(/\s+/).slice(1).join(' ').toUpperCase() || null) : null,
      cedula: cedula || '',
      nuevaCedula: cedula || '',
      departamentoExpedicion: deptoExpVal,
      municipioExpedicion: mpioVal,
      ciudadExpedicion: mpioVal,
      sexo,
      tipoSangre,
      fechaNacimiento: document.getElementById('ef-fecha-nac')?.value || null,
      dependencia: finalDep,
      cargoActual: finalCargo,
      codigoCargo: codigoCargo ? codigoCargo.toUpperCase() : null,
      grado: grado || null,
      clasificacionEmpleo: finalClasif,
      estadoServidor: document.getElementById('ef-estado-servidor')?.value || 'Activo',
      opec: document.getElementById('ef-opec')?.value.trim() || null,
      situacion,
      tipoDiscapacidad,
      fechaIngreso: document.getElementById('ef-fecha-ingreso')?.value || null,
      fechaEncargo,
      otroTiempoPeriodos,
      otroTiempoGobernacion: document.getElementById('ef-periodos-total-display')?.textContent.replace('Otro Tiempo acumulado: ', '') || null,
      funciones: funcionesVal ? funcionesVal.toUpperCase() : null,
      novedades,
      estudios: finalEst,
      institucionEstudios: finalInst,
      matriculaProfesional: matriculaVal ? matriculaVal.toUpperCase() : null,
      tieneDiplomado,
      diplomadoCapSena,
      telefonoFijo: telefonoFijo || null,
      celular: celulares[0] || null,
      celulares,
      correo: correo ? correo.toLowerCase() : null,
      correoPersonal: correoPersonal ? correoPersonal.toLowerCase() : null,
      direccion: direccionVal ? direccionVal.toUpperCase() : null
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
      loadCatalogs().catch(() => {});
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
      loadCatalogs().catch(() => {});
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

  function clearPendingInactivations() {
    // No-op de seguridad: la gestión de estado activo/retirado se realiza mediante modal oficial
  }

  function goPage(p) {
    if (p < 1 || p > state.totalPages) return;
    clearPendingInactivations();
    state.page = p;
    load();
  }

  /**
   * Estructura oficial de columnas para la Plantilla de Servidores Públicos:
   * 34 columnas exactas en mayúscula sostenida y orden oficial:
   * 1. DEPENDENCIA, 2. DENOMINACION CARGO, 3. COD, 4. GRA, 5. PRIMER APELLIDO,
   * 6. SEGUNDO APELLIDO, 7. NOMBRES, 8. NUMERO DE CEDULA, 9. EXPEDIDA, 10. TIPO DE SANGRE,
   * 11. FECHA DE NACIMIENTO, 12. EDAD, 13. SEXO, 14. OTRO TIEMPO DE LA GOBERNACION, 15. INGRESO,
   * 16. TIEMPO DE SERVICIO, 17. FECHA DE ENCARGO, 18. CLASIFICACION DE EMPLEO, 19. SITUACION,
   * 20. FUNCIONES PAD., 21. OPEC, 22. NOVEDADES, 23. ESTUDIOS, 24. MATRICULA PROFECIONAL,
   * 25. INSTITUCION, 26. POSTGRADO, 27. INSTITUCION POST, 28. DIPLOMADO O CAP SENA,
   * 29. DIRECCION, 30. CIUDAD, 31. TELEFONO FIJO, 32. CELULAR, 33. CORREO PERSONAL, 34. CORREO INSTITUCIONAL
   */
  const EXCEL_COLUMNS = [
    { header: 'DENOMINACIÓN ENCARGO', key: 'encargoDenominacion', width: 32 },
    { header: 'COD.', key: 'encargoCodigo', width: 10 },
    { header: 'GRA.', key: 'encargoGrado', width: 10 },
    { header: 'ASIGNACION', key: 'encargoAsignacion', width: 16 },
    { header: 'DEPENDENCIA', key: 'dependencia', width: 32 },
    { header: 'DENOMINACIÓN CARGO', key: 'cargoActual', width: 32 },
    { header: 'COD.', key: 'codigoActual', width: 10 },
    { header: 'GRA.', key: 'gradoActual', width: 10 },
    { header: 'PRIMER APELLIDO', key: 'primerApellido', width: 20 },
    { header: 'SEGUNDO APELLIDO', key: 'segundoApellido', width: 20 },
    { header: 'NOMBRES', key: 'nombres', width: 24 },
    { header: 'CEDULA', key: 'cedula', width: 18 },
    { header: 'EXPEDIDA', key: 'expedida', width: 18 },
    { header: 'TIPO DE SANGRE', key: 'tipoSangre', width: 16 },
    { header: 'NACIMIENTO', key: 'fechaNacimiento', width: 16 },
    { header: 'EDAD', key: 'edad', width: 12 },
    { header: 'SEXO', key: 'sexo', width: 12 },
    { header: 'OTRO TIEMPO CON LA GOBER', key: 'otroTiempoGobernacion', width: 26 },
    { header: 'INGRESO', key: 'fechaIngreso', width: 16 },
    { header: 'TIEMPO DE SERVICIO', key: 'tiempoServicioCalculado', width: 22 },
    { header: 'FECHA ENCARGO', key: 'fechaEncargo', width: 16 },
    { header: 'CLASIFICACION EMPLEO', key: 'clasificacionEmpleo', width: 26 },
    { header: 'SITUACION', key: 'situacion', width: 18 },
    { header: 'FUNCIONES PAG.', key: 'funciones', width: 16 },
    { header: 'OPEC', key: 'opec', width: 14 },
    { header: 'NOVEDADES', key: 'novedades', width: 28 },
    { header: 'ESTUDIOS', key: 'estudios', width: 28 },
    { header: 'MATRICULA PROF.', key: 'matriculaProfesional', width: 20 },
    { header: 'INSTITUCION', key: 'institucionEstudios', width: 26 },
    { header: 'POSTGRADO', key: 'postgrado', width: 26 },
    { header: 'INSTITUCIÓN', key: 'institucionPostgrado', width: 26 },
    { header: 'DIPLOMADO O CAP SENA', key: 'diplomadoCapSena', width: 26 },
    { header: 'DIRECCION', key: 'direccion', width: 28 },
    { header: 'CIUDAD', key: 'ciudad', width: 18 },
    { header: 'TELEFONO FIJO', key: 'telefonoFijo', width: 18 },
    { header: 'CELULAR', key: 'celular', width: 20 },
    { header: 'CORREO PERSONAL', key: 'correoPersonal', width: 28 },
    { header: 'CORREO INSTITUCIONAL', key: 'correo', width: 28 },
    { header: 'TIEMPO TOTAL (AL 31/10/2026)', key: 'tiempoTotalGobernacion', width: 26 }
  ];

  async function exportExcel() {
    try {
      App.showToast('Generando archivo Excel oficial de Servidores Públicos...', 'info');
      const res = await API.getEmployees({ q: state.q, dependencia: state.dependencia, cargo: state.cargo, ...state.advancedFilters, page: 1, limit: 10000 });
      const recordsRaw = res.data || state.data;

      // Mapeo a las 34 columnas oficiales solicitadas
      const records = recordsRaw.map(e => {
        let primerApellido = e.primerApellido || '';
        let segundoApellido = e.segundoApellido || '';
        let nombres = e.nombres || '';
        if (!primerApellido && e.nombreCompleto) {
          const parts = e.nombreCompleto.split(' ');
          primerApellido = parts[0] || '';
          segundoApellido = parts[1] || '';
          nombres = parts.slice(2).join(' ') || '';
        }
        const celularesStr = (Array.isArray(e.celulares) && e.celulares.length)
          ? e.celulares.join(' / ')
          : (e.celular || '—');

        return {
          encargoDenominacion: e.encargoDenominacion || '',
          encargoCodigo: e.encargoCodigo || '',
          encargoGrado: e.encargoGrado || '',
          encargoAsignacion: e.encargoAsignacion || '',
          dependencia: e.dependencia || '',
          cargoActual: e.cargoTitular || e.cargoActual || e.cargo || '',
          codigoActual: e.codigoTitular || e.codigoActual || e.codigo || '',
          gradoActual: e.gradoTitular || e.gradoActual || e.grado || '',
          primerApellido: primerApellido || (e.es_vacante ? 'VACANTE' : ''),
          segundoApellido: segundoApellido || '',
          nombres: nombres || (e.es_vacante ? 'PLAZA VACANTE' : ''),
          cedula: e.cedula || (e.es_vacante ? 'PLAZA VACANTE' : ''),
          expedida: e.ciudadExpedicion || e.municipioExpedicion || e.departamentoExpedicion || '',
          tipoSangre: e.tipoSangre || '',
          fechaNacimiento: e.fechaNacimiento || '',
          edad: e.edad || e.edadCalculada || '',
          sexo: e.sexo || '',
          otroTiempoGobernacion: e.otroTiempoGobernacion || '',
          fechaIngreso: e.fechaIngreso || '',
          tiempoServicioCalculado: e.tiempoServicioCalculado || '',
          fechaEncargo: e.fechaEncargo || '',
          clasificacionEmpleo: e.clasificacionEmpleo || '',
          situacion: e.situacion || 'ACTIVO',
          funciones: e.funciones || e.funcionesPag || '',
          opec: e.opec || '',
          novedades: e.novedades || '',
          estudios: e.estudios || '',
          matriculaProfesional: e.matriculaProfesional || '',
          institucionEstudios: e.institucionEstudios || '',
          postgrado: e.postgrado || '',
          institucionPostgrado: e.institucionPostgrado || '',
          diplomadoCapSena: e.diplomadoCapSena || '',
          direccion: e.direccion || '',
          ciudad: e.ciudad || '',
          telefonoFijo: e.telefonoFijo || '',
          celular: celularesStr,
          correoPersonal: e.correoPersonal || '',
          correo: e.correo || e.correoInstitucional || '',
          tiempoTotalGobernacion: e.tiempoTotalGobernacion || e.tiempoServicioCalculado || ''
        };
      });

      ExcelService.exportToExcel({
        filename: 'Talento360_Servidores_Publicos',
        sheetName: 'Servidores Públicos',
        columns: EXCEL_COLUMNS,
        data: records
      });
      App.showToast(`Se exportaron exitosamente ${records.length} servidores públicos con el formato oficial.`, 'success');
    } catch (err) {
      App.showToast('Error al exportar a Excel: ' + err.message, 'error');
    }
  }

  function downloadTemplate() {
    if (typeof ExcelService !== 'undefined') {
      ExcelService.downloadTemplate({
        filename: 'PLANTILLA_OFICIAL_SERVIDORES_PUBLICOS',
        sheetName: 'Servidores Públicos',
        columns: EXCEL_COLUMNS,
        sampleRows: []
      });
      App.showToast('Descargando plantilla oficial de Servidores Públicos en blanco...', 'info');
    } else {
      App.showToast('Servicio Excel no disponible.', 'warning');
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
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; background:var(--color-bg-secondary, rgba(255,255,255,0.04)); padding:8px 14px; border-radius:8px; border:1px solid var(--color-border); flex-wrap:wrap; gap:8px;">
              <span style="font-size:12px; color:var(--text-muted);">¿Necesitas la plantilla oficial para diligenciar?</span>
              <button type="button" class="btn btn-outline btn-sm" onclick="EmployeesModule.downloadTemplate()" style="font-size:12px; padding:4px 10px; display:inline-flex; align-items:center; gap:5px; font-weight:600;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                Descargar Plantilla Oficial Excel
              </button>
            </div>

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
      const wrap = document.getElementById('emp-actions-dropdown-wrap');
      if (wrap) wrap.classList.add('is-open');
      wrap?.closest('.module-header-card')?.classList.add('has-open-dropdown');
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
    const wrap = document.getElementById('emp-actions-dropdown-wrap');
    if (wrap) wrap.classList.remove('is-open');
    wrap?.closest('.module-header-card')?.classList.remove('has-open-dropdown');
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
    if (!state.catalogs.dependencias || !state.catalogs.dependencias.length) {
      await loadCatalogs();
    }
    container.innerHTML = `
      <div class="module-enter">
        <!-- Encabezado Institucional Estandarizado Gobernación de Boyacá -->
        <div class="module-header-card">
          <div class="module-header-info">
            <div class="module-header-brand">
              <img src="imgs/logoCondor.png" alt="Escudo Gobernación de Boyacá" class="module-header-logo logo-light-theme" />
              <img src="imgs/logoCondorBlanco.png" alt="Escudo Gobernación de Boyacá" class="module-header-logo logo-dark-theme" />
              <span class="module-header-brand-text">Gobernación de Boyacá</span>
            </div>
            <h1 class="module-hero-title">Servidores Públicos</h1>
            <p class="module-hero-desc">Gestión, consulta y administración integral de servidores públicos de la Gobernación de Boyacá.</p>
          </div>
          <div class="module-header-actions">
            <!-- Dropdown de Acciones de Excel (Cargas, Descargas y Plantillas) -->
            <div class="emp-actions-dropdown-wrap" id="emp-actions-dropdown-wrap">
              <button
                type="button"
                class="btn-action-icon-menu"
                id="emp-dropdown-toggle"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="emp-dropdown-menu"
                aria-label="Acciones de Excel (Cargas, descargas y plantillas)"
                title="Acciones de Excel (Cargas, descargas y plantillas)"
                onclick="EmployeesModule.toggleActionsDropdown(event)"
                onkeydown="EmployeesModule.handleDropdownKeydown(event)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.5"></circle>
                  <circle cx="12" cy="12" r="1.5"></circle>
                  <circle cx="12" cy="19" r="1.5"></circle>
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
                <button
                  type="button"
                  class="emp-dropdown-item"
                  role="menuitem"
                  tabindex="-1"
                  onclick="EmployeesModule.exportExcel(); EmployeesModule.closeActionsDropdown();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <div>
                    <strong>Descargar Registros</strong>
                    <small>Descargar listado filtrado (.xlsx)</small>
                  </div>
                </button>
                <button
                  type="button"
                  class="emp-dropdown-item"
                  role="menuitem"
                  tabindex="-1"
                  onclick="EmployeesModule.downloadTemplate(); EmployeesModule.closeActionsDropdown();"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                  <div>
                    <strong>Descargar Plantilla Oficial</strong>
                    <small>Formato oficial en blanco (.xlsx)</small>
                  </div>
                </button>
              </div>
            </div>

            <!-- Botón Agregar Servidor (+) -->
            ${Auth.canEdit() ? `
            <button
              type="button"
              class="btn-action-icon-add"
              onclick="EmployeesModule.openCreate()"
              id="btn-nuevo-servidor"
              title="Agregar nuevo servidor público"
              aria-label="Agregar nuevo servidor público"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span class="btn-action-add-label">Nuevo Servidor</span>
            </button>` : ''}
          </div>
        </div>

        <div class="filters-card">
          <div class="filters-row" style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end;">
            <div class="filter-group" style="flex:2; min-width:220px;">
              <label class="filter-label" for="emp-search">Buscar Servidor</label>
              <input id="emp-search" class="filter-input" placeholder="Buscar por nombre o cédula..." aria-label="Buscar servidor por nombre o cédula" value="${escHtml(state.q || '')}" />
            </div>
            <div class="filter-group" style="flex:1.5; min-width:200px;">
              <label class="filter-label" for="emp-filter-dep">Dependencia</label>
              <select id="emp-filter-dep" class="filter-select" onchange="EmployeesModule.search()" aria-label="Filtrar por dependencia institucional">
                <option value="">TODAS</option>
                ${(state.catalogs.dependencias || []).map(d => `<option value="${escHtml(d)}" ${d === state.dependencia ? 'selected' : ''}>${escHtml(d)}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group" style="flex:1.5; min-width:200px;">
              <label class="filter-label" for="emp-filter-cargo">Cargo</label>
              <select id="emp-filter-cargo" class="filter-select" onchange="EmployeesModule.search()" aria-label="Filtrar por cargo">
                <option value="">TODOS</option>
                ${(state.catalogs.cargos || []).map(c => `<option value="${escHtml(c.cargo)}" ${c.cargo === state.cargo ? 'selected' : ''}>${escHtml(c.cargo)}</option>`).join('')}
              </select>
            </div>
            <div class="filters-actions-wrap" style="display:flex; gap:8px; align-items:flex-end;">
              <button type="button" class="btn-filter-adv ${getActiveFiltersCount() > 0 ? 'btn-filter-active' : ''}" id="emp-btn-adv-filter" onclick="EmployeesModule.openAdvancedFiltersModal()" title="Filtros avanzados detallados" aria-label="Abrir filtros avanzados">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" style="width:15px;height:15px;flex-shrink:0;">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
                <span>Filtros</span>
                <span id="emp-adv-filter-badge" class="filter-count-badge" style="${getActiveFiltersCount() > 0 ? '' : 'display:none;'}">${getActiveFiltersCount()}</span>
              </button>
              <button type="button" class="btn-filter-clear" onclick="EmployeesModule.clearSearch()" title="Restablecer todos los filtros" aria-label="Limpiar filtro de búsqueda">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;flex-shrink:0;">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                <span>Limpiar</span>
              </button>
            </div>
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
                  <th scope="col">Tiempo de Servicio / Otros</th>
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

    state.page = 1; state.q = ''; state.dependencia = ''; state.cargo = '';
    await load();
    const countEl = document.getElementById('emp-count');
    if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} registros`;
  }

  function search() {
    clearPendingInactivations();
    state.q = document.getElementById('emp-search')?.value.trim() || '';
    state.dependencia = document.getElementById('emp-filter-dep')?.value || '';
    state.cargo = document.getElementById('emp-filter-cargo')?.value || '';
    state.page = 1;
    load();
  }
  function clearSearch() {
    clearPendingInactivations();
    const inp = document.getElementById('emp-search');
    if (inp) inp.value = '';
    const depSelect = document.getElementById('emp-filter-dep');
    if (depSelect) depSelect.value = '';
    const cargoSelect = document.getElementById('emp-filter-cargo');
    if (cargoSelect) cargoSelect.value = '';
    state.q = '';
    state.dependencia = '';
    state.cargo = '';
    state.advancedFilters = {};
    updateAdvFilterBadge();
    state.page = 1;
    load();
  }

  return {
    render,
    load,
    openCreate,
    openView,
    openEdit,
    saveCreate,
    saveEdit,
    confirmDelete,
    goPage,
    search,
    clearSearch,
    openAdvancedFiltersModal,
    exportExcel,
    downloadTemplate,
    openImportModal,
    formatCedulaDots,
    switchFichaTab,
    switchFormTab,
    copyFichaText,
    toggleActionsDropdown,
    closeActionsDropdown,
    handleDropdownKeydown,
    handleMenuKeydown,
    renderSkeletonTable,
    promptRetireEmployee,
    confirmRetireEmployee,
    closeRetireModal,
    promptReactivateEmployee,
    confirmReactivateEmployee,
    closeReactivateModal,
    startInactivation,
    cancelInactivation,
    reactivateEmployee
  };
})();
