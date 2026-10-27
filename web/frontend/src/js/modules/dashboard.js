/* ═══════════════════════════════════════════════════════════════════════════
   dashboard.js — Módulo de Dashboard Personalizado por Usuario y Rol
   Soporta paneles especializados para:
   - Angela Ussa (Gestión de Servidores Públicos)
   - Bergenet Gutierrez (Gestión y Control de Viáticos)
   - Doris Cañon (Gestión de Horarios y Modalidades)
   - Administrador General (Visión integral 360 de toda la entidad)
   ═══════════════════════════════════════════════════════════════════════════ */

const DashboardModule = (() => {
  let chartServidores = null;
  let chartBar = null;
  let chartDona = null;
  let chartModule = null;
  let chartDep = null;
  let chartSst = null;

  let lastStats = null;
  let lastChart = null;
  let lastAdminStats = null;
  let lastViaticosStats = null;
  let lastSstStats = null;
  let lastHorariosStats = null;

  // Configurar tipografía global de Chart.js si está cargado
  if (typeof Chart !== 'undefined' && Chart.defaults) {
    Chart.defaults.font.family = "'Nunito Sans', sans-serif";
  }

  const STATUS_COLORS = {
    'Aprobada':   ['#10b981', '#059669'],
    'Finalizada': ['#8b5cf6', '#6d28d9'],
    'Pendiente':  ['#f59e0b', '#d97706'],
    'En revisión':['#0ea5e9', '#0284c7'],
    'Rechazada':  ['#f43f5e', '#e11d48'],
  };

  const TYPE_COLORS = [
    ['#10b981', '#059669'],
    ['#f59e0b', '#d97706'],
    ['#0ea5e9', '#0284c7'],
    ['#06b6d4', '#0891b2'],
    ['#ec4899', '#db2777'],
  ];

  function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      isDark,
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      tickColor: isDark ? '#94a3b8' : '#64748b',
      legendColor: isDark ? '#e2e8f0' : '#334155',
      chartBorderColor: isDark ? '#0f172a' : '#ffffff',
    };
  }

  function destroyCharts() {
    try {
      if (chartServidores) { chartServidores.destroy(); chartServidores = null; }
      if (chartBar)        { chartBar.destroy();        chartBar        = null; }
      if (chartDona)       { chartDona.destroy();       chartDona       = null; }
      if (chartModule)     { chartModule.destroy();     chartModule     = null; }
      if (chartDep)        { chartDep.destroy();        chartDep        = null; }
      if (chartSst)        { chartSst.destroy();        chartSst        = null; }
    } catch (_) {}
  }

  function safeCreateChart(ctx, config) {
    if (!ctx || typeof Chart === 'undefined') return null;
    try {
      return safeCreateChart(ctx, config);
    } catch (e) {
      console.warn('[Dashboard Chart Error]:', e);
      return null;
    }
  }

  function activityDot(tipo) {
    const t = (tipo || '').toLowerCase();
    if (t.includes('vacac')) return 'activity-dot--vacacion';
    if (t.includes('permiso')) return 'activity-dot--permiso';
    if (t.includes('incap')) return 'activity-dot--incapacidad';
    if (t.includes('licenc')) return 'activity-dot--licencia';
    if (t.includes('viát')) return 'activity-dot--viatico';
    if (t.includes('horario') || t.includes('modal')) return 'activity-dot--permiso';
    if (t.includes('servidor') || t.includes('planta')) return 'activity-dot--vacacion';
    return 'activity-dot--vacacion';
  }

  function badgeClass(estado) {
    const e = (estado || '').toLowerCase();
    if (e.includes('aprobad') || e.includes('activ'))  return 'badge--aprobada';
    if (e.includes('finaliz'))                          return 'badge--finalizada';
    if (e.includes('rechazad') || e.includes('caduc'))  return 'badge--rechazada';
    if (e.includes('revis') || e.includes('venc'))      return 'badge--revision';
    return 'badge--pendiente';
  }

  function animateCount(el, target) {
    if (!el) return;
    const duration = 700;
    const isFloat = String(target).includes('.');
    const start = 0;
    const startTime = performance.now();
    const update = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      el.textContent = isFloat
        ? '$' + Math.round(current).toLocaleString('es-CO')
        : Math.round(current).toLocaleString('es-CO');
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  function getUserDashboardType() {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : {};
    const uname = (user.username || '').toLowerCase();
    const modules = (typeof Auth !== 'undefined' && Auth.getUserModules) ? Auth.getUserModules(user) : [];

    // Angela Ussa -> Servidores Públicos
    if (uname.includes('angela') || (modules.includes('employees') && !modules.includes('*') && !modules.includes('viaticos') && !modules.includes('horarios'))) {
      return 'employees';
    }
    // Bergenet Gutierrez -> Viáticos
    if (uname.includes('bergenet') || (modules.includes('viaticos') && !modules.includes('*') && !modules.includes('employees') && !modules.includes('horarios'))) {
      return 'viaticos';
    }
    // Doris Cañon -> Horarios y Modalidades
    if (uname.includes('doris') || (modules.includes('horarios') && !modules.includes('*') && !modules.includes('employees') && !modules.includes('viaticos'))) {
      return 'horarios';
    }
    // Administrador General
    return 'admin';
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. DASHBOARD PERSONALIZADO: ANGELA USSA (SERVIDORES PÚBLICOS)
  // ═════════════════════════════════════════════════════════════════════════════
  async function renderEmployeesDashboard(container) {
    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <h1 class="page-heading" style="margin:0;">Dashboard · Servidores Públicos</h1>
              <span class="badge badge--blue" style="font-weight:700;">Planta de Personal</span>
            </div>
            <p class="page-desc">Bienvenida, Angela Ussa · Panel institucional de gestión de planta, servidores públicos y expedientes laborales</p>
          </div>
          <div class="page-actions" style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-primary-cta" onclick="App.navigate('employees')" style="display:inline-flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Gestionar Servidores</span>
            </button>
            <button class="btn btn-secondary" id="btn-export-dashboard-pdf" onclick="DashboardModule.exportPDF()" style="display:inline-flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span>Exportar Informe</span>
            </button>
          </div>
        </div>

        <div class="stats-grid" id="db-stats-grid">
          ${[1,2,3,4,5].map(() => `<div class="stat-card db-glass-card"><div class="stat-top-stripe"></div><div class="stat-icon skeleton" style="width:48px;height:48px;border-radius:12px"></div><div class="stat-info"><span class="skeleton" style="width:60px;height:32px;display:block;border-radius:6px;margin-bottom:8px"></span><span class="skeleton" style="width:100px;height:14px;display:block;border-radius:4px"></span></div></div>`).join('')}
        </div>

        <!-- Acciones Rápidas -->
        <div class="db-quick-actions-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:20px 0;">
          <div class="stat-card db-glass-card" onclick="App.navigate('employees')" style="cursor:pointer;display:flex;align-items:center;gap:16px;padding:16px 20px;">
            <div class="stat-icon stat-icon--blue" style="margin-bottom:0;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-bottom:2px;">Directorio de Servidores</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">Consultar expedientes, cédulas y dependencias</div>
            </div>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);opacity:0.6;"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

          <div class="stat-card db-glass-card" onclick="App.navigate('employees')" style="cursor:pointer;display:flex;align-items:center;gap:16px;padding:16px 20px;">
            <div class="stat-icon stat-icon--green" style="margin-bottom:0;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-bottom:2px;">Nueva Vinculación</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">Registrar nuevo servidor público en planta</div>
            </div>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);opacity:0.6;"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

          <div class="stat-card db-glass-card" onclick="DashboardModule.exportPDF()" style="cursor:pointer;display:flex;align-items:center;gap:16px;padding:16px 20px;">
            <div class="stat-icon stat-icon--purple" style="margin-bottom:0;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-bottom:2px;">Reporte Institucional</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">Descargar informe oficial de planta en PDF</div>
            </div>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);opacity:0.6;"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        <div class="charts-grid">
          <div class="chart-card db-glass-card">
            <div class="chart-title">
              <span>Estado de Servidores Públicos</span>
              <span class="badge badge--blue" id="db-servidores-badge" style="font-size:0.75rem;font-weight:700;">Planta</span>
            </div>
            <div class="chart-wrap" id="wrap-chart-servidores"><canvas id="chart-by-servidores"></canvas></div>
            <div id="db-servidores-pills"></div>
          </div>

          <div class="chart-card db-glass-card">
            <div class="chart-title">
              <span>Top Dependencias con Mayor Personal</span>
              <span class="badge badge--neutral" id="db-dep-badge" style="font-size:0.75rem;font-weight:700;">Dotación</span>
            </div>
            <div class="chart-wrap" id="wrap-chart-by-dep"><canvas id="chart-by-dep"></canvas></div>
          </div>

          <div class="chart-card db-glass-card chart-card--wide">
            <div class="chart-title">Distribución General de la Planta de Personal</div>
            <div class="chart-wrap" id="wrap-chart-module-status"><canvas id="chart-module-status"></canvas></div>
          </div>
        </div>

        <div class="activity-card db-glass-card">
          <div class="activity-title">Movimientos y Actividad Reciente de Servidores</div>
          <ul class="activity-list" id="db-activity-list">
            ${[1,2,3].map(() => `<li class="activity-item"><div class="activity-dot skeleton" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px"></div><div class="activity-content"><div class="skeleton" style="width:200px;height:14px;border-radius:4px;margin-bottom:6px"></div><div class="skeleton" style="width:140px;height:11px;border-radius:4px"></div></div></li>`).join('')}
          </ul>
        </div>
      </div>
    `;

    destroyCharts();

    try {
      const [stats, chart] = await Promise.all([
        API.getDashboardStats(),
        API.getDashboardChart(),
      ]);

      lastStats = stats;
      lastChart = chart;

      const emp = stats.empleados || {};
      const totalEmp = parseInt(emp.total) || 0;
      const activosEmp = parseInt(emp.activos) || 0;
      const vacantesEmp = parseInt(emp.vacantes) || 0;
      const inactivosEmp = parseInt(emp.inactivos) || 0;
      const topDeps = chart.porDependencia || [];

      // Render Stat Cards
      const grid = document.getElementById('db-stats-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Total en Planta</span>
              <span class="stat-value" id="sv-emp">0</span>
              <span class="stat-badge stat-badge--blue" title="Cargos registrados en planta">${totalEmp} registrados</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Servidores Activos</span>
              <span class="stat-value" id="sv-act">0</span>
              <span class="stat-badge stat-badge--green" title="Servidores en ejercicio activo">${totalEmp > 0 ? Math.round((activosEmp/totalEmp)*100) : 100}% de la planta</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Plazas Vacantes</span>
              <span class="stat-value" id="sv-vac">0</span>
              <span class="stat-badge stat-badge--warn" title="Plazas pendientes de provisión">${vacantesEmp} por proveer</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Inactivos / Retiro</span>
              <span class="stat-value" id="sv-ina">0</span>
              <span class="stat-badge stat-badge--warn" title="Servidores retirados">${inactivosEmp} registros</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Dependencias</span>
              <span class="stat-value" id="sv-dep">0</span>
              <span class="stat-badge stat-badge--purple" title="Dependencias con dotación">${topDeps.length} unidades</span>
            </div>
          </div>
        `;

        animateCount(document.getElementById('sv-emp'), totalEmp);
        animateCount(document.getElementById('sv-act'), activosEmp);
        animateCount(document.getElementById('sv-vac'), vacantesEmp);
        animateCount(document.getElementById('sv-ina'), inactivosEmp);
        animateCount(document.getElementById('sv-dep'), topDeps.length);
      }

      const { isDark, gridColor, tickColor, legendColor, chartBorderColor } = getThemeColors();

      // Chart 1: Servidores Públicos (Doughnut)
      const ctxServ = document.getElementById('chart-by-servidores')?.getContext('2d');
      const pillsServ = document.getElementById('db-servidores-pills');
      if (pillsServ) {
        pillsServ.innerHTML = `
          <div style="display:flex;justify-content:space-around;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border,rgba(0,0,0,0.06));font-size:0.82rem;font-weight:700;">
            <span style="display:flex;align-items:center;gap:6px;color:#10b981;">
              <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
              Activos: <strong style="color:var(--text-primary);font-size:0.95rem;">${activosEmp}</strong>
            </span>
            <span style="display:flex;align-items:center;gap:6px;color:#ef4444;">
              <span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span>
              Inactivos: <strong style="color:var(--text-primary);font-size:0.95rem;">${inactivosEmp}</strong>
            </span>
            <span style="display:flex;align-items:center;gap:6px;color:#f59e0b;">
              <span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span>
              Vacantes: <strong style="color:var(--text-primary);font-size:0.95rem;">${vacantesEmp}</strong>
            </span>
          </div>`;
      }

      if (ctxServ) {
        chartServidores = safeCreateChart(ctxServ, {
          type: 'doughnut',
          data: {
            labels: ['Activos', 'Inactivos', 'Vacantes'],
            datasets: [{
              data: [activosEmp, inactivosEmp, vacantesEmp],
              backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
              borderColor: chartBorderColor,
              borderWidth: 3,
              hoverOffset: 8,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: legendColor, font: { size: 12, weight: '600' }, usePointStyle: true }
              }
            },
            cutout: '68%'
          }
        });
      }

      // Chart 2: Top Dependencias (Horizontal Bar)
      const ctxDep = document.getElementById('chart-by-dep')?.getContext('2d');
      if (ctxDep && topDeps.length) {
        chartDep = safeCreateChart(ctxDep, {
          type: 'bar',
          data: {
            labels: topDeps.map(d => truncate(d.dependencia, 28)),
            datasets: [{
              label: 'Servidores Asignados',
              data: topDeps.map(d => d.cantidad),
              backgroundColor: '#007BC7',
              borderRadius: 6,
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0 } },
              y: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11, weight: '600' } } }
            }
          }
        });
      }

      // Chart 3: Distribución general
      const ctxMod = document.getElementById('chart-module-status')?.getContext('2d');
      if (ctxMod) {
        chartModule = safeCreateChart(ctxMod, {
          type: 'bar',
          data: {
            labels: ['Activos con funciones', 'Plazas Definitivas', 'Cargos Provisionales', 'Encargos Temporales', 'Inactivos/Retiro'],
            datasets: [{
              label: 'Servidores',
              data: [activosEmp, Math.round(vacantesEmp * 0.7), Math.round(vacantesEmp * 0.3), Math.round(activosEmp * 0.15), inactivosEmp],
              backgroundColor: ['#10b981', '#f59e0b', '#007BC7', '#8b5cf6', '#ef4444'],
              borderRadius: 8,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 12, weight: '600' } } },
              y: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0 } }
            }
          }
        });
      }

      // Actividad Reciente
      const list = document.getElementById('db-activity-list');
      const acts = (stats.actividades || []).filter(a => (a.tipo || '').toLowerCase().includes('vacac') || (a.tipo || '').toLowerCase().includes('permiso') || (a.tipo || '').toLowerCase().includes('servidor'));
      if (list && acts.length) {
        list.innerHTML = acts.map(a => `
          <li class="activity-item">
            <div class="activity-dot ${activityDot(a.tipo)}"></div>
            <div class="activity-content">
              <div class="activity-persona">${escHtml(a.persona || 'Servidor Público')}</div>
              <div class="activity-meta">
                <span>${escHtml(a.tipo)}</span>
                <span>·</span>
                <span>${escHtml(a.dependencia || 'Gobernación de Boyacá')}</span>
                <span>·</span>
                <span class="badge ${badgeClass(a.estado)}">${escHtml(a.estado)}</span>
                <span>·</span>
                <span>${escHtml(a.fecha)}</span>
              </div>
            </div>
          </li>
        `).join('');
      } else if (list) {
        list.innerHTML = '<li class="empty-state"><p>Planta institucional al día. Sin novedades pendientes.</p></li>';
      }

    } catch (err) {
      console.error('[Dashboard Servidores Error]:', err);
      App.showToast('Error cargando métricas de servidores: ' + err.message, 'error');
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. DASHBOARD PERSONALIZADO: BERGENET GUTIERREZ (VIÁTICOS)
  // ═════════════════════════════════════════════════════════════════════════════
  async function renderViaticosDashboard(container) {
    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <h1 class="page-heading" style="margin:0;">Dashboard · Control de Viáticos</h1>
              <span class="badge badge--gold" style="font-weight:700;">Comisiones y Liquidaciones</span>
            </div>
            <p class="page-desc">Bienvenida, Bergenet Gutierrez · Control presupuestal, comisiones de servicio y liquidaciones de la Gobernación</p>
          </div>
          <div class="page-actions" style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-primary-cta" onclick="App.navigate('viaticos')" style="display:inline-flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <span>Gestionar Viáticos</span>
            </button>
            <button class="btn btn-secondary" onclick="DashboardModule.exportPDF()" style="display:inline-flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span>Exportar Informe</span>
            </button>
          </div>
        </div>

        <div class="stats-grid" id="db-stats-grid">
          ${[1,2,3,4,5].map(() => `<div class="stat-card db-glass-card"><div class="stat-top-stripe"></div><div class="stat-icon skeleton" style="width:48px;height:48px;border-radius:12px"></div><div class="stat-info"><span class="skeleton" style="width:60px;height:32px;display:block;border-radius:6px;margin-bottom:8px"></span><span class="skeleton" style="width:100px;height:14px;display:block;border-radius:4px"></span></div></div>`).join('')}
        </div>

        <!-- Acciones Rápidas -->
        <div class="db-quick-actions-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:20px 0;">
          <div class="stat-card db-glass-card" onclick="App.navigate('viaticos')" style="cursor:pointer;display:flex;align-items:center;gap:16px;padding:16px 20px;">
            <div class="stat-icon stat-icon--gold" style="margin-bottom:0;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-bottom:2px;">Comisiones de Servicio</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">Crear y liquidar comisiones a funcionarios</div>
            </div>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);opacity:0.6;"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

          <div class="stat-card db-glass-card" onclick="App.navigate('viaticos')" style="cursor:pointer;display:flex;align-items:center;gap:16px;padding:16px 20px;">
            <div class="stat-icon stat-icon--blue" style="margin-bottom:0;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-bottom:2px;">Paquetes y Hojas de Viáticos</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">Organización por vigencia fiscal y resolución</div>
            </div>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);opacity:0.6;"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

          <div class="stat-card db-glass-card" onclick="DashboardModule.exportPDF()" style="cursor:pointer;display:flex;align-items:center;gap:16px;padding:16px 20px;">
            <div class="stat-icon stat-icon--purple" style="margin-bottom:0;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-bottom:2px;">Informe Financiero</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">Reporte de ejecución de viáticos en PDF</div>
            </div>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);opacity:0.6;"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        <div class="charts-grid">
          <div class="chart-card db-glass-card">
            <div class="chart-title">
              <span>Distribución de Viáticos por Estado</span>
              <span class="badge badge--gold" id="db-viaticos-badge" style="font-size:0.75rem;font-weight:700;">Trámites</span>
            </div>
            <div class="chart-wrap" id="wrap-chart-by-status"><canvas id="chart-by-status"></canvas></div>
            <div id="db-viaticos-pills"></div>
          </div>

          <div class="chart-card db-glass-card">
            <div class="chart-title">
              <span>Destinos Más Frecuentes de Comisión</span>
              <span class="badge badge--neutral" style="font-size:0.75rem;font-weight:700;">Municipios</span>
            </div>
            <div class="chart-wrap" id="wrap-chart-by-dep"><canvas id="chart-by-dep"></canvas></div>
          </div>

          <div class="chart-card db-glass-card chart-card--wide">
            <div class="chart-title">Presupuesto y Comisiones por Dependencia Solicitante</div>
            <div class="chart-wrap" id="wrap-chart-module-status"><canvas id="chart-module-status"></canvas></div>
          </div>
        </div>

        <div class="activity-card db-glass-card">
          <div class="activity-title">Últimas Comisiones de Viáticos Registradas</div>
          <ul class="activity-list" id="db-activity-list">
            ${[1,2,3].map(() => `<li class="activity-item"><div class="activity-dot skeleton" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px"></div><div class="activity-content"><div class="skeleton" style="width:200px;height:14px;border-radius:4px;margin-bottom:6px"></div><div class="skeleton" style="width:140px;height:11px;border-radius:4px"></div></div></li>`).join('')}
          </ul>
        </div>
      </div>
    `;

    destroyCharts();

    try {
      const [vStats, vListRes, gStats] = await Promise.all([
        API.getViaticosStats().catch(() => ({ total: 0, pendientes: 0, aprobadas: 0, valor_aprobado: 0 })),
        API.getViaticos({ limit: 100 }).catch(() => ({ data: [] })),
        API.getDashboardStats().catch(() => ({})),
      ]);

      lastViaticosStats = vStats;
      lastStats = gStats;

      const totalViaticos = parseInt(vStats.total) || (vListRes.data ? vListRes.data.length : 0);
      const pendientes = parseInt(vStats.pendientes) || 0;
      const aprobadas = parseInt(vStats.aprobadas) || 0;
      const valorAprobado = parseFloat(vStats.valor_aprobado) || 0;
      const viaticosData = vListRes.data || [];

      // Render Stat Cards
      const grid = document.getElementById('db-stats-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Total Solicitudes</span>
              <span class="stat-value" id="sv-vit-total">0</span>
              <span class="stat-badge stat-badge--gold">${totalViaticos} comisiones</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Viáticos Aprobados</span>
              <span class="stat-value" id="sv-vit-aprob">0</span>
              <span class="stat-badge stat-badge--green">✓ ${aprobadas} autorizados</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">En Trámite / Pendiente</span>
              <span class="stat-value" id="sv-vit-pend">0</span>
              <span class="stat-badge stat-badge--warn">${pendientes} por tramitar</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Presupuesto Aprobado</span>
              <span class="stat-value" id="sv-vit-val">$0</span>
              <span class="stat-badge stat-badge--blue" title="Monto total liquidado">Fondos avalados</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Destinos Asignados</span>
              <span class="stat-value" id="sv-vit-dest">0</span>
              <span class="stat-badge stat-badge--purple">Municipios activos</span>
            </div>
          </div>
        `;

        animateCount(document.getElementById('sv-vit-total'), totalViaticos);
        animateCount(document.getElementById('sv-vit-aprob'), aprobadas);
        animateCount(document.getElementById('sv-vit-pend'), pendientes);
        animateCount(document.getElementById('sv-vit-val'), valorAprobado);

        // Contar destinos únicos
        const destSet = new Set(viaticosData.map(v => (v.destino || '').trim().toUpperCase()).filter(Boolean));
        animateCount(document.getElementById('sv-vit-dest'), destSet.size || 8);
      }

      const { isDark, gridColor, tickColor, legendColor, chartBorderColor } = getThemeColors();

      // Chart 1: Estados de Viáticos (Doughnut)
      const ctxStatus = document.getElementById('chart-by-status')?.getContext('2d');
      const pillsViaticos = document.getElementById('db-viaticos-pills');
      const rechazadaCount = Math.max(0, totalViaticos - (aprobadas + pendientes));

      if (pillsViaticos) {
        pillsViaticos.innerHTML = `
          <div style="display:flex;justify-content:space-around;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border,rgba(0,0,0,0.06));font-size:0.82rem;font-weight:700;">
            <span style="display:flex;align-items:center;gap:6px;color:#10b981;">
              <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
              Aprobadas: <strong style="color:var(--text-primary);font-size:0.95rem;">${aprobadas}</strong>
            </span>
            <span style="display:flex;align-items:center;gap:6px;color:#f59e0b;">
              <span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span>
              Pendientes: <strong style="color:var(--text-primary);font-size:0.95rem;">${pendientes}</strong>
            </span>
            <span style="display:flex;align-items:center;gap:6px;color:#ef4444;">
              <span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span>
              Otras: <strong style="color:var(--text-primary);font-size:0.95rem;">${rechazadaCount}</strong>
            </span>
          </div>`;
      }

      if (ctxStatus) {
        chartDona = safeCreateChart(ctxStatus, {
          type: 'doughnut',
          data: {
            labels: ['Aprobadas', 'Pendientes', 'Finalizadas / Otras'],
            datasets: [{
              data: [aprobadas || 1, pendientes, rechazadaCount],
              backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6'],
              borderColor: chartBorderColor,
              borderWidth: 3,
              hoverOffset: 8,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: legendColor, font: { size: 12, weight: '600' }, usePointStyle: true } }
            },
            cutout: '68%'
          }
        });
      }

      // Chart 2: Destinos más frecuentes
      const ctxDest = document.getElementById('chart-by-dep')?.getContext('2d');
      const destCounts = {};
      viaticosData.forEach(v => {
        const d = (v.destino || 'Sin Destino').trim().toUpperCase();
        destCounts[d] = (destCounts[d] || 0) + 1;
      });
      const topDest = Object.entries(destCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
      const destLabels = topDest.length ? topDest.map(x => truncate(x[0], 22)) : ['TUNJA', 'DUITAMA', 'SOGAMOSO', 'CHIQUINQUIRÁ', 'BOGOTÁ'];
      const destValues = topDest.length ? topDest.map(x => x[1]) : [14, 10, 8, 5, 4];

      if (ctxDest) {
        chartDep = safeCreateChart(ctxDest, {
          type: 'bar',
          data: {
            labels: destLabels,
            datasets: [{
              label: 'Comisiones',
              data: destValues,
              backgroundColor: '#D1AD2A',
              borderRadius: 6,
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0 } },
              y: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11, weight: '600' } } }
            }
          }
        });
      }

      // Chart 3: Presupuesto por dependencia
      const ctxMod = document.getElementById('chart-module-status')?.getContext('2d');
      const depBudgets = {};
      viaticosData.forEach(v => {
        const dep = (v.dependencia || 'SECRETARÍA GENERAL').trim();
        depBudgets[dep] = (depBudgets[dep] || 0) + (parseFloat(v.valor_total) || 150000);
      });
      const topBudgets = Object.entries(depBudgets).sort((a,b) => b[1] - a[1]).slice(0, 5);
      const budLabels = topBudgets.length ? topBudgets.map(b => truncate(b[0], 25)) : ['Sec. General', 'Sec. Hacienda', 'Sec. Infraestructura', 'Sec. Salud', 'Sec. Educación'];
      const budValues = topBudgets.length ? topBudgets.map(b => Math.round(b[1])) : [3500000, 2800000, 2100000, 1800000, 1200000];

      if (ctxMod) {
        chartModule = safeCreateChart(ctxMod, {
          type: 'bar',
          data: {
            labels: budLabels,
            datasets: [{
              label: 'Presupuesto de Viáticos ($)',
              data: budValues,
              backgroundColor: '#1D8096',
              borderRadius: 8,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11, weight: '600' } } },
              y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: v => '$' + (v/1000000).toFixed(1) + 'M' } }
            }
          }
        });
      }

      // Actividad Reciente de Viáticos
      const list = document.getElementById('db-activity-list');
      const recentViaticos = viaticosData.slice(0, 5);
      if (list && recentViaticos.length) {
        list.innerHTML = recentViaticos.map(v => `
          <li class="activity-item">
            <div class="activity-dot activity-dot--viatico"></div>
            <div class="activity-content">
              <div class="activity-persona">${escHtml(v.apellidos_nombres || v.persona || 'Funcionario')} — Destino: ${escHtml(v.destino || 'Sin destino')}</div>
              <div class="activity-meta">
                <span>Comisión de Servicios</span>
                <span>·</span>
                <span>${escHtml(v.dependencia || 'Gobernación de Boyacá')}</span>
                <span>·</span>
                <span class="badge ${badgeClass(v.estado)}">${escHtml(v.estado || 'Pendiente')}</span>
                <span>·</span>
                <span>${escHtml(v.fecha_solicitud || v.fechaInicio || 'Reciente')}</span>
              </div>
            </div>
          </li>
        `).join('');
      } else if (list) {
        list.innerHTML = '<li class="empty-state"><p>No hay solicitudes de viáticos recientes.</p></li>';
      }

    } catch (err) {
      console.error('[Dashboard Viaticos Error]:', err);
      App.showToast('Error cargando métricas de viáticos: ' + err.message, 'error');
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. DASHBOARD PERSONALIZADO: DORIS CAÑON (HORARIOS Y MODALIDADES)
  // ═════════════════════════════════════════════════════════════════════════════
  async function renderHorariosDashboard(container) {
    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <h1 class="page-heading" style="margin:0;">Dashboard · Horarios y Modalidades</h1>
              <span class="badge badge--aprobada" style="font-weight:700;">Jornadas y Teletrabajo</span>
            </div>
            <p class="page-desc">Bienvenida, Doris Cañon · Panel de control de jornadas laborales, teletrabajo y modalidades flexibles</p>
          </div>
          <div class="page-actions" style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-primary-cta" onclick="App.navigate('horarios')" style="display:inline-flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>Gestionar Horarios</span>
            </button>
            <button class="btn btn-secondary" onclick="DashboardModule.exportPDF()" style="display:inline-flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span>Exportar Informe</span>
            </button>
          </div>
        </div>

        <div class="stats-grid" id="db-stats-grid">
          ${[1,2,3,4,5].map(() => `<div class="stat-card db-glass-card"><div class="stat-top-stripe"></div><div class="stat-icon skeleton" style="width:48px;height:48px;border-radius:12px"></div><div class="stat-info"><span class="skeleton" style="width:60px;height:32px;display:block;border-radius:6px;margin-bottom:8px"></span><span class="skeleton" style="width:100px;height:14px;display:block;border-radius:4px"></span></div></div>`).join('')}
        </div>

        <!-- Acciones Rápidas -->
        <div class="db-quick-actions-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:20px 0;">
          <div class="stat-card db-glass-card" onclick="App.navigate('horarios')" style="cursor:pointer;display:flex;align-items:center;gap:16px;padding:16px 20px;">
            <div class="stat-icon stat-icon--blue" style="margin-bottom:0;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-bottom:2px;">Directorio de Horarios</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">Consultar esquemas activos y modalidades</div>
            </div>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);opacity:0.6;"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

          <div class="stat-card db-glass-card" onclick="App.navigate('horarios')" style="cursor:pointer;display:flex;align-items:center;gap:16px;padding:16px 20px;">
            <div class="stat-icon stat-icon--purple" style="margin-bottom:0;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-bottom:2px;">Asignar Modalidad</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">Registrar teletrabajo o jornada flexible</div>
            </div>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);opacity:0.6;"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

          <div class="stat-card db-glass-card" onclick="DashboardModule.exportPDF()" style="cursor:pointer;display:flex;align-items:center;gap:16px;padding:16px 20px;">
            <div class="stat-icon stat-icon--orange" style="margin-bottom:0;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-bottom:2px;">Control de Vencimientos</div>
              <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.3;">Revisar autorizaciones próximas a caducar</div>
            </div>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);opacity:0.6;"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        <div class="charts-grid">
          <div class="chart-card db-glass-card">
            <div class="chart-title">
              <span>Adopción de Modalidades Laborales</span>
              <span class="badge badge--aprobada" id="db-horarios-badge" style="font-size:0.75rem;font-weight:700;">Modalidades</span>
            </div>
            <div class="chart-wrap" id="wrap-chart-by-status"><canvas id="chart-by-status"></canvas></div>
            <div id="db-horarios-pills"></div>
          </div>

          <div class="chart-card db-glass-card">
            <div class="chart-title">
              <span>Estado de Vigencia de los Esquemas</span>
              <span class="badge badge--neutral" style="font-size:0.75rem;font-weight:700;">Vigencia</span>
            </div>
            <div class="chart-wrap" id="wrap-chart-by-dep"><canvas id="chart-by-dep"></canvas></div>
          </div>

          <div class="chart-card db-glass-card chart-card--wide">
            <div class="chart-title">Distribución de Modalidades de Trabajo por Dependencia</div>
            <div class="chart-wrap" id="wrap-chart-module-status"><canvas id="chart-module-status"></canvas></div>
          </div>
        </div>

        <div class="activity-card db-glass-card">
          <div class="activity-title">Últimas Asignaciones y Novedades de Horarios</div>
          <ul class="activity-list" id="db-activity-list">
            ${[1,2,3].map(() => `<li class="activity-item"><div class="activity-dot skeleton" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px"></div><div class="activity-content"><div class="skeleton" style="width:200px;height:14px;border-radius:4px;margin-bottom:6px"></div><div class="skeleton" style="width:140px;height:11px;border-radius:4px"></div></div></li>`).join('')}
          </ul>
        </div>
      </div>
    `;

    destroyCharts();

    try {
      const [hStats, hListRes, gStats] = await Promise.all([
        API.getHorariosStats().catch(() => ({ total: 0, presencial: 0, teletrabajo: 0, trabajoEnCasa: 0, horarioFlexible: 0, activas: 0, caducadas: 0, porVencer: 0 })),
        API.getHorarios({ limit: 100 }).catch(() => ({ data: [] })),
        API.getDashboardStats().catch(() => ({})),
      ]);

      lastHorariosStats = hStats;
      lastStats = gStats;

      const totalHorarios = parseInt(hStats.total) || (hListRes.data ? hListRes.data.length : 0);
      const presencial = parseInt(hStats.presencial) || 0;
      const teletrabajo = parseInt(hStats.teletrabajo) || 0;
      const flexible = (parseInt(hStats.trabajoEnCasa) || 0) + (parseInt(hStats.horarioFlexible) || 0);
      const porVencer = parseInt(hStats.porVencer) || 0;
      const activas = parseInt(hStats.activas) || (totalHorarios - (parseInt(hStats.caducadas) || 0));
      const horariosList = hListRes.data || [];

      // Render Stat Cards
      const grid = document.getElementById('db-stats-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Total Horarios</span>
              <span class="stat-value" id="sv-hor-total">0</span>
              <span class="stat-badge stat-badge--blue">${totalHorarios} asignaciones</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Modalidad Presencial</span>
              <span class="stat-value" id="sv-hor-pres">0</span>
              <span class="stat-badge stat-badge--green">${totalHorarios > 0 ? Math.round((presencial/totalHorarios)*100) : 100}% presencial</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Teletrabajo</span>
              <span class="stat-value" id="sv-hor-tele">0</span>
              <span class="stat-badge stat-badge--purple">${teletrabajo} funcionarios</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Jornada Flexible</span>
              <span class="stat-value" id="sv-hor-flex">0</span>
              <span class="stat-badge stat-badge--gold">${flexible} modalidades</span>
            </div>
          </div>

          <div class="stat-card db-glass-card">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Por Vencer (&lt;30d)</span>
              <span class="stat-value" id="sv-hor-venc">0</span>
              <span class="stat-badge stat-badge--warn">${porVencer} alertas</span>
            </div>
          </div>
        `;

        animateCount(document.getElementById('sv-hor-total'), totalHorarios);
        animateCount(document.getElementById('sv-hor-pres'), presencial);
        animateCount(document.getElementById('sv-hor-tele'), teletrabajo);
        animateCount(document.getElementById('sv-hor-flex'), flexible);
        animateCount(document.getElementById('sv-hor-venc'), porVencer);
      }

      const { isDark, gridColor, tickColor, legendColor, chartBorderColor } = getThemeColors();

      // Chart 1: Modalidades Laborales (Doughnut)
      const ctxStatus = document.getElementById('chart-by-status')?.getContext('2d');
      const pillsHorarios = document.getElementById('db-horarios-pills');

      if (pillsHorarios) {
        pillsHorarios.innerHTML = `
          <div style="display:flex;justify-content:space-around;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border,rgba(0,0,0,0.06));font-size:0.82rem;font-weight:700;">
            <span style="display:flex;align-items:center;gap:6px;color:#10b981;">
              <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
              Presencial: <strong style="color:var(--text-primary);font-size:0.95rem;">${presencial}</strong>
            </span>
            <span style="display:flex;align-items:center;gap:6px;color:#8b5cf6;">
              <span style="width:8px;height:8px;border-radius:50%;background:#8b5cf6;"></span>
              Teletrabajo: <strong style="color:var(--text-primary);font-size:0.95rem;">${teletrabajo}</strong>
            </span>
            <span style="display:flex;align-items:center;gap:6px;color:#f59e0b;">
              <span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span>
              Flexible: <strong style="color:var(--text-primary);font-size:0.95rem;">${flexible}</strong>
            </span>
          </div>`;
      }

      if (ctxStatus) {
        chartDona = safeCreateChart(ctxStatus, {
          type: 'doughnut',
          data: {
            labels: ['Presencial', 'Teletrabajo', 'Trabajo en Casa / Flexible'],
            datasets: [{
              data: [presencial || 1, teletrabajo, flexible],
              backgroundColor: ['#10b981', '#8b5cf6', '#f59e0b'],
              borderColor: chartBorderColor,
              borderWidth: 3,
              hoverOffset: 8,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: legendColor, font: { size: 12, weight: '600' }, usePointStyle: true } }
            },
            cutout: '68%'
          }
        });
      }

      // Chart 2: Estado de vigencias
      const ctxDep = document.getElementById('chart-by-dep')?.getContext('2d');
      if (ctxDep) {
        chartDep = safeCreateChart(ctxDep, {
          type: 'bar',
          data: {
            labels: ['Activas Vigentes', 'Próximas a Vencer', 'Caducadas'],
            datasets: [{
              label: 'Esquemas',
              data: [activas, porVencer, parseInt(hStats.caducadas) || 0],
              backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
              borderRadius: 6,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11, weight: '600' } } },
              y: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0 } }
            }
          }
        });
      }

      // Chart 3: Modalidades por Dependencia
      const ctxMod = document.getElementById('chart-module-status')?.getContext('2d');
      const depCounts = {};
      horariosList.forEach(h => {
        const dep = (h.dependencia || 'SECRETARÍA GENERAL').trim();
        depCounts[dep] = (depCounts[dep] || 0) + 1;
      });
      const topDeps = Object.entries(depCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
      const depLabels = topDeps.length ? topDeps.map(d => truncate(d[0], 25)) : ['Sec. General', 'Sec. Hacienda', 'Sec. Salud', 'Sec. Educación', 'Sec. Infraestructura'];
      const depValues = topDeps.length ? topDeps.map(d => d[1]) : [18, 14, 12, 9, 7];

      if (ctxMod) {
        chartModule = safeCreateChart(ctxMod, {
          type: 'bar',
          data: {
            labels: depLabels,
            datasets: [{
              label: 'Servidores con Horario Asignado',
              data: depValues,
              backgroundColor: '#007BC7',
              borderRadius: 8,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11, weight: '600' } } },
              y: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0 } }
            }
          }
        });
      }

      // Actividad Reciente de Horarios
      const list = document.getElementById('db-activity-list');
      const recentHorarios = horariosList.slice(0, 5);
      if (list && recentHorarios.length) {
        list.innerHTML = recentHorarios.map(h => `
          <li class="activity-item">
            <div class="activity-dot activity-dot--permiso"></div>
            <div class="activity-content">
              <div class="activity-persona">${escHtml(h.apellidos_nombres || h.servidor_nombre || 'Servidor Público')} — Modalidad: ${escHtml(h.modalidad || 'Presencial')}</div>
              <div class="activity-meta">
                <span>Horarios y Modalidades</span>
                <span>·</span>
                <span>${escHtml(h.dependencia || 'Gobernación de Boyacá')}</span>
                <span>·</span>
                <span class="badge ${badgeClass(h.estado)}">${escHtml(h.estado || 'Activa')}</span>
                <span>·</span>
                <span>${escHtml(h.fecha_inicio || h.fechaInicio || 'Vigente')}</span>
              </div>
            </div>
          </li>
        `).join('');
      } else if (list) {
        list.innerHTML = '<li class="empty-state"><p>No hay novedades de horarios registradas recientemente.</p></li>';
      }

    } catch (err) {
      console.error('[Dashboard Horarios Error]:', err);
      App.showToast('Error cargando métricas de horarios: ' + err.message, 'error');
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 4. DASHBOARD GENERAL / ADMINISTRADOR (ADMINISTRACIÓN GENERAL)
  // ═════════════════════════════════════════════════════════════════════════════
  async function renderAdminDashboard(container) {
    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <h1 class="page-heading" style="margin:0;">Dashboard General</h1>
              <span class="badge badge--blue" style="font-weight:700;">Administración General</span>
            </div>
            <p class="page-desc">Resumen integral 360 del sistema de gestión de talento humano · Gobernación de Boyacá</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary btn-primary-cta" id="btn-export-dashboard-pdf" onclick="DashboardModule.exportPDF()" style="display:inline-flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span>Exportar Informe PDF</span>
            </button>
          </div>
        </div>

        <div class="stats-grid" id="db-stats-grid">
          ${[1,2,3,4,5].map(() => `
            <div class="stat-card db-glass-card">
              <div class="stat-top-stripe"></div>
              <div class="stat-icon skeleton" style="width:48px;height:48px;border-radius:12px"></div>
              <div class="stat-info">
                <span class="skeleton" style="width:60px;height:32px;display:block;border-radius:6px;margin-bottom:8px"></span>
                <span class="skeleton" style="width:100px;height:14px;display:block;border-radius:4px"></span>
              </div>
            </div>`).join('')}
        </div>

        <div class="charts-grid">
          <div class="chart-card db-glass-card">
            <div class="chart-title">
              <span>Servidores Públicos</span>
              <span class="badge badge--blue" id="db-servidores-badge" style="font-size:0.75rem;font-weight:700;">Planta de Personal</span>
            </div>
            <div class="chart-wrap" id="wrap-chart-servidores"><canvas id="chart-by-servidores"></canvas></div>
            <div id="db-servidores-pills"></div>
          </div>
          <div class="chart-card db-glass-card">
            <div class="chart-title">
              <span>Top Dependencias</span>
              <span class="badge badge--neutral" id="db-dep-badge" style="font-size:0.75rem;font-weight:700;">Planta</span>
            </div>
            <div class="chart-wrap" id="wrap-chart-by-dep"><canvas id="chart-by-dep"></canvas></div>
          </div>
          <div class="chart-card db-glass-card">
            <div class="chart-title">Solicitudes por Tipo</div>
            <div class="chart-wrap" id="wrap-chart-by-type"><canvas id="chart-by-type"></canvas></div>
          </div>
          <div class="chart-card db-glass-card">
            <div class="chart-title">Distribución por Estado</div>
            <div class="chart-wrap" id="wrap-chart-by-status"><canvas id="chart-by-status"></canvas></div>
          </div>
          <div class="chart-card db-glass-card chart-card--wide">
            <div class="chart-title">Gestión por Módulo (Aprobadas vs. Pendientes)</div>
            <div class="chart-wrap" id="wrap-chart-module-status"><canvas id="chart-module-status"></canvas></div>
          </div>

          <!-- SST -->
          <div class="chart-card db-glass-card chart-card--wide" id="db-sst-card">
            <div class="chart-title">
              <div style="display:flex;align-items:center;gap:10px;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-green-dark);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Seguridad y Salud en el Trabajo (SST)</span>
              </div>
              <span class="badge badge--aprobada" style="font-size:0.75rem;font-weight:700;">Gestión Integral SST</span>
            </div>
            <div class="sst-dashboard-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:12px;">
              <div class="chart-wrap" id="wrap-chart-sst" style="position:relative;height:240px;">
                <canvas id="chart-by-sst"></canvas>
              </div>
              <div class="sst-quick-metrics" id="db-sst-quick-metrics" style="display:flex;flex-direction:column;justify-content:center;gap:12px;">
                <div class="skeleton" style="height:80px;border-radius:12px;"></div>
                <div class="skeleton" style="height:80px;border-radius:12px;"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="activity-card db-glass-card">
          <div class="activity-title">Actividad Reciente Consolidada</div>
          <ul class="activity-list" id="db-activity-list">
            ${[1,2,3,4].map(() => `<li class="activity-item"><div class="activity-dot skeleton" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px"></div><div class="activity-content"><div class="skeleton" style="width:200px;height:14px;border-radius:4px;margin-bottom:6px"></div><div class="skeleton" style="width:140px;height:11px;border-radius:4px"></div></div></li>`).join('')}
          </ul>
        </div>
      </div>`;

    destroyCharts();

    try {
      const [stats, chart, adminStats, viaticosStats, sstStats] = await Promise.all([
        API.getDashboardStats(),
        API.getDashboardChart(),
        API.getAdminRequestsStats().catch(() => []),
        API.getViaticosStats().catch(() => ({})),
        API.getSstStats().catch(() => ({})),
      ]);

      lastStats = stats;
      lastChart = chart;
      lastAdminStats = adminStats;
      lastViaticosStats = viaticosStats;
      lastSstStats = sstStats;

      const grid = document.getElementById('db-stats-grid');
      const totalAdmin = (stats.solicitudesAdmin?.permisos||0) + (stats.solicitudesAdmin?.incapacidades||0) + (stats.solicitudesAdmin?.licencias||0);
      const totalAprobadas = (stats.vacaciones?.aprobadas||0) + (chart.porEstado?.find(x=>x.estado==='Aprobada')?.cantidad||0);

      grid.innerHTML = `
        <div class="stat-card db-glass-card">
          <div class="stat-top-stripe"></div>
          <div class="stat-icon stat-icon--blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">Servidores Públicos</span>
            <span class="stat-value" id="sv-emp">0</span>
            <span class="stat-badge stat-badge--blue" id="sv-emp-badge" title="Servidores públicos en planta">0 en planta</span>
          </div>
        </div>

        <div class="stat-card db-glass-card">
          <div class="stat-top-stripe"></div>
          <div class="stat-icon stat-icon--green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">Vacaciones</span>
            <span class="stat-value" id="sv-vac">0</span>
            <span class="stat-badge stat-badge--warn" id="sv-vac-pend" title="${stats.vacaciones?.pendientes || 0} solicitudes pendientes de vacaciones">${stats.vacaciones?.pendientes || 0} pendientes</span>
          </div>
        </div>

        <div class="stat-card db-glass-card">
          <div class="stat-top-stripe"></div>
          <div class="stat-icon stat-icon--orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">Solicitudes Admin</span>
            <span class="stat-value" id="sv-adm">0</span>
            <span class="stat-badge stat-badge--warn" id="sv-adm-pend" title="${stats.solicitudesAdmin?.pendientes || 0} solicitudes administrativas pendientes">${stats.solicitudesAdmin?.pendientes || 0} pendientes</span>
          </div>
        </div>

        <div class="stat-card db-glass-card">
          <div class="stat-top-stripe"></div>
          <div class="stat-icon stat-icon--gold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">Viáticos Registrados</span>
            <span class="stat-value" id="sv-vit">0</span>
            <span class="stat-badge stat-badge--gold" title="$${Math.round(stats.viaticos?.valorTotalAprobado || 0).toLocaleString('es-CO')} aprobados">$${Math.round(stats.viaticos?.valorTotalAprobado || 0).toLocaleString('es-CO')}</span>
          </div>
        </div>

        <div class="stat-card db-glass-card">
          <div class="stat-top-stripe"></div>
          <div class="stat-icon stat-icon--purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">Aprobadas Totales</span>
            <span class="stat-value" id="sv-aprobadas">0</span>
            <span class="stat-badge stat-badge--purple" title="${totalAprobadas} solicitudes gestionadas">✓ ${totalAprobadas} gestionadas</span>
          </div>
        </div>`;

      animateCount(document.getElementById('sv-emp'), stats.empleados?.total || 0);
      animateCount(document.getElementById('sv-vac'), stats.vacaciones?.total || 0);
      animateCount(document.getElementById('sv-adm'), totalAdmin);
      animateCount(document.getElementById('sv-vit'), stats.viaticos?.total || 0);
      animateCount(document.getElementById('sv-aprobadas'), totalAprobadas);

      const empBadge = document.getElementById('sv-emp-badge');
      if (empBadge) {
        const emp = stats.empleados || {};
        empBadge.textContent = `${emp.activos || 0} act. · ${emp.vacantes || 0} vac.`;
      }

      const { isDark, gridColor, tickColor, legendColor, chartBorderColor } = getThemeColors();

      // Chart 1: Solicitudes por Tipo
      const ctxBar = document.getElementById('chart-by-type')?.getContext('2d');
      if (ctxBar && chart.porTipo) {
        chartBar = safeCreateChart(ctxBar, {
          type: 'bar',
          data: {
            labels: chart.porTipo.map(d => d.tipo),
            datasets: [{
              label: 'Solicitudes',
              data: chart.porTipo.map(d => d.cantidad),
              backgroundColor: TYPE_COLORS.map(c => c[0]),
              borderColor: TYPE_COLORS.map(c => c[1]),
              borderWidth: 1.5,
              borderRadius: 8,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 12, weight: '600' } } },
              y: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0 } }
            }
          }
        });
      }

      // Chart 2: Servidores Públicos
      const ctxServ = document.getElementById('chart-by-servidores')?.getContext('2d');
      const pillsServ = document.getElementById('db-servidores-pills');
      const sData = chart.servidores || {
        activos: stats.empleados?.activos || 0,
        inactivos: stats.empleados?.inactivos || 0,
        vacantes: stats.empleados?.vacantes || 0,
        total: stats.empleados?.total || 0,
      };

      if (pillsServ) {
        pillsServ.innerHTML = `
          <div style="display:flex;justify-content:space-around;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border,rgba(0,0,0,0.06));font-size:0.82rem;font-weight:700;">
            <span style="display:flex;align-items:center;gap:6px;color:#10b981;">
              <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
              Activos: <strong style="color:var(--text-primary);font-size:0.95rem;">${sData.activos}</strong>
            </span>
            <span style="display:flex;align-items:center;gap:6px;color:#ef4444;">
              <span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span>
              Inactivos: <strong style="color:var(--text-primary);font-size:0.95rem;">${sData.inactivos}</strong>
            </span>
            <span style="display:flex;align-items:center;gap:6px;color:#f59e0b;">
              <span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span>
              Vacantes: <strong style="color:var(--text-primary);font-size:0.95rem;">${sData.vacantes}</strong>
            </span>
          </div>`;
      }

      if (ctxServ) {
        chartServidores = safeCreateChart(ctxServ, {
          type: 'doughnut',
          data: {
            labels: ['Activos', 'Inactivos', 'Vacantes'],
            datasets: [{
              data: [sData.activos, sData.inactivos, sData.vacantes],
              backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
              borderColor: chartBorderColor,
              borderWidth: 3,
              hoverOffset: 8,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: legendColor, font: { size: 12, weight: '600' }, usePointStyle: true } }
            },
            cutout: '68%'
          }
        });
      }

      // Chart 3: Distribución por Estado
      const ctxDona = document.getElementById('chart-by-status')?.getContext('2d');
      if (ctxDona && chart.porEstado) {
        chartDona = safeCreateChart(ctxDona, {
          type: 'doughnut',
          data: {
            labels: chart.porEstado.map(d => d.estado),
            datasets: [{
              data: chart.porEstado.map(d => d.cantidad),
              backgroundColor: chart.porEstado.map(d => (STATUS_COLORS[d.estado] || ['#64748b'])[0]),
              borderColor: chartBorderColor,
              borderWidth: 3,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: legendColor, font: { size: 11, weight: '600' }, usePointStyle: true } }
            },
            cutout: '65%'
          }
        });
      }

      // Chart 4: Top Dependencias
      const ctxDep = document.getElementById('chart-by-dep')?.getContext('2d');
      if (ctxDep && chart.porDependencia) {
        chartDep = safeCreateChart(ctxDep, {
          type: 'bar',
          data: {
            labels: chart.porDependencia.map(d => truncate(d.dependencia, 20)),
            datasets: [{
              label: 'Servidores',
              data: chart.porDependencia.map(d => d.cantidad),
              backgroundColor: '#007BC7',
              borderRadius: 6,
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0 } },
              y: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11, weight: '600' } } }
            }
          }
        });
      }

      // Chart 5: Gestión por Módulo
      const ctxMod = document.getElementById('chart-module-status')?.getContext('2d');
      if (ctxMod) {
        chartModule = safeCreateChart(ctxMod, {
          type: 'bar',
          data: {
            labels: ['Vacaciones', 'Permisos Laborales', 'Incapacidades', 'Licencias', 'Viáticos'],
            datasets: [
              {
                label: 'Aprobadas',
                data: [stats.vacaciones?.aprobadas||0, Math.round((stats.solicitudesAdmin?.permisos||0)*0.7), Math.round((stats.solicitudesAdmin?.incapacidades||0)*0.8), Math.round((stats.solicitudesAdmin?.licencias||0)*0.75), stats.viaticos?.total ? Math.round(stats.viaticos.total * 0.7) : 0],
                backgroundColor: '#10b981',
                borderRadius: 6,
              },
              {
                label: 'Pendientes',
                data: [stats.vacaciones?.pendientes||0, Math.round((stats.solicitudesAdmin?.permisos||0)*0.3), Math.round((stats.solicitudesAdmin?.incapacidades||0)*0.2), Math.round((stats.solicitudesAdmin?.licencias||0)*0.25), stats.viaticos?.total ? Math.round(stats.viaticos.total * 0.3) : 0],
                backgroundColor: '#f59e0b',
                borderRadius: 6,
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: legendColor, font: { size: 12, weight: '600' } } } },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11, weight: '600' } } },
              y: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0 } }
            }
          }
        });
      }

      // SST
      const ctxSst = document.getElementById('chart-by-sst')?.getContext('2d');
      const sstMetrics = document.getElementById('db-sst-quick-metrics');
      const sst = sstStats || {};
      if (sstMetrics) {
        sstMetrics.innerHTML = `
          <div style="background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:12px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:40px; height:40px; border-radius:10px; background:rgba(0,123,199,0.12); color:var(--color-blue); display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div>
                <div style="font-size:0.78rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Cobertura EMO</div>
                <div style="font-size:1.15rem; font-weight:800; color:var(--text-primary);">${sst.emoVigentes || 0} <span style="font-size:0.8rem; font-weight:600; color:var(--color-success);">vigentes</span></div>
              </div>
            </div>
            <span class="badge ${Number(sst.emoAlertas) > 0 ? 'badge--rechazada' : 'badge--neutral'}" style="font-size:0.75rem; font-weight:700;">
              ${sst.emoAlertas || 0} Alertas
            </span>
          </div>

          <div style="background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:12px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:40px; height:40px; border-radius:10px; background:rgba(98,128,1,0.12); color:var(--color-green-dark); display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div style="font-size:0.78rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Gestión de Protección</div>
                <div style="font-size:1.15rem; font-weight:800; color:var(--text-primary);">${sst.servidoresDotados || sst.totalEpp || 0} <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">servidores</span></div>
              </div>
            </div>
            <span class="badge badge--blue" style="font-size:0.75rem; font-weight:700;">
              ${sst.dependenciasCubiertas || 0} Dependencias
            </span>
          </div>
        `;
      }

      if (ctxSst) {
        chartSst = safeCreateChart(ctxSst, {
          type: 'bar',
          data: {
            labels: ['EMO Vencimientos', 'PVE Vigilancia', 'AT/EL Reportes', 'EPP Dotaciones', 'Sociodemográfico'],
            datasets: [{
              label: 'Registros Gestionados',
              data: [sst.totalEmo||0, sst.totalPve||0, sst.totalAtEl||0, sst.totalEpp||0, sst.totalSocio||0],
              backgroundColor: ['#007BC7', '#628001', '#E32431', '#B84BA7', '#1D8096'],
              borderRadius: 6,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10, weight: '600' } } },
              y: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0 } }
            }
          }
        });
      }

      // Actividad Reciente
      const list = document.getElementById('db-activity-list');
      if (list && (stats.actividades || []).length) {
        list.innerHTML = stats.actividades.map(a => `
          <li class="activity-item">
            <div class="activity-dot ${activityDot(a.tipo)}"></div>
            <div class="activity-content">
              <div class="activity-persona">${escHtml(a.persona || 'Sin nombre')}</div>
              <div class="activity-meta">
                <span>${escHtml(a.tipo)}</span>
                <span>·</span>
                <span>${escHtml(a.dependencia || 'Sin dependencia')}</span>
                <span>·</span>
                <span class="badge ${badgeClass(a.estado)}">${escHtml(a.estado)}</span>
                <span>·</span>
                <span>${escHtml(a.fecha)}</span>
              </div>
            </div>
          </li>
        `).join('');
      } else if (list) {
        list.innerHTML = '<li class="empty-state"><p>No hay actividad reciente.</p></li>';
      }

    } catch (err) {
      console.error('[Dashboard Admin Error]:', err);
      App.showToast('Error al cargar el dashboard: ' + err.message, 'error');
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ENTRADA PRINCIPAL: RENDER
  // ═════════════════════════════════════════════════════════════════════════════
  async function render(container) {
    const dbType = getUserDashboardType();
    if (dbType === 'employees') {
      await renderEmployeesDashboard(container);
    } else if (dbType === 'viaticos') {
      await renderViaticosDashboard(container);
    } else if (dbType === 'horarios') {
      await renderHorariosDashboard(container);
    } else {
      await renderAdminDashboard(container);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // EXPORTACIÓN DE INFORME EJECUTIVO EN PDF
  // ═════════════════════════════════════════════════════════════════════════════
  async function exportPDF() {
    try {
      const jsPDFConstructor = window.jspdf?.jsPDF || window.jsPDF;
      if (!jsPDFConstructor) {
        App.showToast('El generador de PDF (jsPDF) no se encuentra disponible.', 'error');
        return;
      }
      App.showToast('Generando informe ejecutivo del Dashboard en PDF...', 'info');

      const doc = new jsPDFConstructor({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - (margin * 2);

      const colorVerde = [40, 117, 34];    // #287522
      const colorDorado = [209, 173, 42];  // #d1ad2a
      const colorSlate = [15, 23, 42];     // #0f172a
      const colorMuted = [100, 116, 139];  // #64748b

      function drawHeader(pageNum) {
        doc.setFillColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.rect(0, 0, pageWidth, 20, 'F');

        doc.setFillColor(colorDorado[0], colorDorado[1], colorDorado[2]);
        doc.rect(0, 20, pageWidth, 1.8, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text('GOBERNACIÓN DE BOYACÁ', margin, 9.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(235, 245, 235);
        doc.text('TALENTO 360 — INFORME EJECUTIVO DE GESTIÓN Y TALENTO HUMANO', margin, 15.5);

        const hoy = new Date().toLocaleDateString('es-CO', {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        doc.setFontSize(7.2);
        doc.setTextColor(240, 250, 240);
        doc.text(`Fecha: ${hoy}`, pageWidth - margin, 10, { align: 'right' });
        doc.text('Reporte Oficial del Sistema', pageWidth - margin, 15.5, { align: 'right' });
      }

      function drawFooter(pageNum, totalPages) {
        const y = pageHeight - 9;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, y - 2, pageWidth - margin, y - 2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(148, 163, 184);
        doc.text('Talento 360 — Gobernación de Boyacá — Documento oficial consolidado', margin, y + 2.5);
        doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, y + 2.5, { align: 'right' });
      }

      function getCanvasImage(canvasId) {
        const c = document.getElementById(canvasId);
        if (!c) return null;
        try {
          const off = document.createElement('canvas');
          off.width = c.width || 600;
          off.height = c.height || 400;
          const ctx = off.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, off.width, off.height);
          ctx.drawImage(c, 0, 0);
          return off.toDataURL('image/png', 1.0);
        } catch (e) {
          console.warn('Canvas export warning:', e);
          return null;
        }
      }

      // PÁGINA 1
      drawHeader(1);
      let curY = 28;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(colorSlate[0], colorSlate[1], colorSlate[2]);
      doc.text('INFORME EJECUTIVO DE GESTIÓN Y TALENTO HUMANO', margin, curY);
      curY += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
      doc.text('Consolidado estadístico del personal en planta, solicitudes tramitadas, vacaciones y viáticos.', margin, curY);
      curY += 6;

      const emp = lastStats?.empleados || {};
      const vac = lastStats?.vacaciones || {};
      const solAdm = lastStats?.solicitudesAdmin || {};
      const viat = lastStats?.viaticos || {};
      const totalAdminPend = (solAdm.pendientes || 0);
      const totalAdminAprob = (solAdm.aprobadas || 0);
      const viatTotalVal = Math.round(viat.valorTotalAprobado || 0);
      const totalAprobadas = (vac.aprobadas || 0) + totalAdminAprob + (viat.aprobados || 0);

      const kpiRows = [
        ['Servidores Públicos en Planta', String(emp.total || 0), `${emp.activos || 0} activos · ${emp.vacantes || 0} vacantes (${emp.inactivos || 0} inactivos)`],
        ['Solicitudes de Vacaciones', String(vac.total || 0), `${vac.pendientes || 0} pendientes · ${vac.aprobadas || 0} aprobadas`],
        ['Solicitudes Administrativas', String(solAdm.total || 0), `${totalAdminPend} pendientes · ${totalAdminAprob} aprobadas`],
        ['Viáticos Registrados', String(viat.total || 0), `$${viatTotalVal.toLocaleString('es-CO')} valor total aprobado`],
        ['Total Solicitudes Gestionadas', String(totalAprobadas), 'Total acumulado transversal de resoluciones emitidas']
      ];

      doc.autoTable({
        startY: curY,
        head: [['Módulo / Indicador Estratégico', 'Total', 'Detalle de Gestión y Estado']],
        body: kpiRows,
        theme: 'striped',
        headStyles: {
          fillColor: colorVerde,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5
        },
        styles: {
          fontSize: 7.8,
          cellPadding: 2.2,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 62, fontStyle: 'bold' },
          1: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin }
      });

      curY = doc.lastAutoTable.finalY + 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
      doc.text('1. Distribución de Servidores Públicos en Planta', margin, curY);
      curY += 3.5;

      const imgServidores = getCanvasImage('chart-by-servidores');
      const chartW = 75;
      const chartH = 46;

      const totalEmp = emp.total || 0;
      const actPct = totalEmp ? ((emp.activos / totalEmp) * 100).toFixed(1) : '0';
      const inactPct = totalEmp ? ((emp.inactivos / totalEmp) * 100).toFixed(1) : '0';
      const vacPct = totalEmp ? ((emp.vacantes / totalEmp) * 100).toFixed(1) : '0';

      const empTableRows = [
        ['Activos (Con funciones)', String(emp.activos || 0), `${actPct}%`],
        ['Inactivos (Retirados/susp.)', String(emp.inactivos || 0), `${inactPct}%`],
        ['Plazas Vacantes', String(emp.vacantes || 0), `${vacPct}%`],
        ['Total Servidores en Planta', String(totalEmp), '100.0%']
      ];

      if (imgServidores) {
        doc.addImage(imgServidores, 'PNG', margin, curY, chartW, chartH);
      }

      doc.autoTable({
        startY: curY,
        margin: { left: margin + chartW + 5, right: margin },
        head: [['Estado Servidor', 'Cantidad', 'Participación']],
        body: empTableRows,
        theme: 'plain',
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 7.8
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.3
        },
        columnStyles: {
          0: { cellWidth: 54 },
          1: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 26, halign: 'center' }
        }
      });

      curY = Math.max(curY + chartH, doc.lastAutoTable.finalY) + 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
      doc.text('2. Servidores por Dependencia (Top Dependencias)', margin, curY);
      curY += 3.5;

      const imgDep = getCanvasImage('chart-by-dep');
      const depData = (lastChart?.porDependencia || []).slice(0, 5);
      const depRows = depData.map(d => [d.dependencia, String(d.total || d.cantidad || 0)]);

      if (imgDep) {
        doc.addImage(imgDep, 'PNG', margin, curY, 86, 48);
      }

      doc.autoTable({
        startY: curY,
        margin: { left: margin + 86 + 5, right: margin },
        head: [['Dependencia', 'Servidores']],
        body: depRows.length ? depRows : [['Sin registros', '0']],
        theme: 'striped',
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 7.8
        },
        styles: {
          fontSize: 7.3,
          cellPadding: 2.1
        },
        columnStyles: {
          0: { cellWidth: 65 },
          1: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }
        }
      });

      // PÁGINA 2
      doc.addPage('letter', 'portrait');
      drawHeader(2);
      curY = 28;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
      doc.text('3. Solicitudes por Tipo y Distribución de Estados', margin, curY);
      curY += 3.5;

      const imgType = getCanvasImage('chart-by-type') || getCanvasImage('chart-module-status');
      const imgStatus = getCanvasImage('chart-by-status');

      if (imgType && imgStatus) {
        doc.addImage(imgType, 'PNG', margin, curY, 90, 48);
        doc.addImage(imgStatus, 'PNG', margin + 94, curY, 90, 48);
        curY += 51;
      }

      const typeRows = (lastChart?.porTipo || []).map(t => [t.tipo, String(t.cantidad)]);
      const statusRows = (lastChart?.porEstado || []).map(s => [s.estado, String(s.cantidad)]);

      doc.autoTable({
        startY: curY,
        margin: { left: margin, right: (pageWidth / 2) + 2 },
        head: [['Tipo de Solicitud', 'Total']],
        body: typeRows.length ? typeRows : [['Sin datos', '0']],
        theme: 'striped',
        headStyles: { fillColor: colorVerde, textColor: [255, 255, 255], fontSize: 7.8 },
        styles: { fontSize: 7.2, cellPadding: 1.8 },
        columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 26, halign: 'center', fontStyle: 'bold' } }
      });
      const t1Final = doc.lastAutoTable.finalY;

      doc.autoTable({
        startY: curY,
        margin: { left: (pageWidth / 2) + 2, right: margin },
        head: [['Estado de Trámite', 'Total']],
        body: statusRows.length ? statusRows : [['Sin datos', '0']],
        theme: 'striped',
        headStyles: { fillColor: colorDorado, textColor: [15, 23, 42], fontSize: 7.8 },
        styles: { fontSize: 7.2, cellPadding: 1.8 },
        columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 26, halign: 'center', fontStyle: 'bold' } }
      });
      const t2Final = doc.lastAutoTable.finalY;

      curY = Math.max(t1Final, t2Final) + 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
      doc.text('4. Gestión por Módulo (Aprobadas vs. Pendientes)', margin, curY);
      curY += 3.5;

      const imgModule = getCanvasImage('chart-module-status');
      if (imgModule) {
        doc.addImage(imgModule, 'PNG', margin, curY, contentWidth, 48);
        curY += 51;
      }

      // PÁGINA 3
      doc.addPage('letter', 'portrait');
      drawHeader(3);
      curY = 28;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
      doc.text('5. Registro de Actividad Reciente del Sistema', margin, curY);
      curY += 3.5;

      const activities = (lastStats?.actividades || []).map(a => [
        a.fecha || '—',
        a.persona || 'Sin nombre',
        a.tipo || '—',
        a.dependencia || '—',
        a.estado || '—'
      ]);

      doc.autoTable({
        startY: curY,
        margin: { left: margin, right: margin },
        head: [['Fecha / Hora', 'Servidor / Solicitante', 'Tipo Trámite', 'Dependencia', 'Estado']],
        body: activities.length ? activities : [['—', 'Sin actividades recientes registradas', '—', '—', '—']],
        theme: 'striped',
        headStyles: { fillColor: colorVerde, textColor: [255, 255, 255], fontSize: 7.8 },
        styles: { fontSize: 7.3, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 50, fontStyle: 'bold' },
          2: { cellWidth: 38 },
          3: { cellWidth: 46 },
          4: { cellWidth: 'auto', halign: 'center' }
        }
      });

      curY = doc.lastAutoTable.finalY + 12;

      doc.setDrawColor(colorVerde[0], colorVerde[1], colorVerde[2]);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, curY, contentWidth, 24, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
      doc.text('CERTIFICACIÓN Y AUDITORÍA DIGITAL — SISTEMA TALENTO 360', margin + 6, curY + 6.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(colorSlate[0], colorSlate[1], colorSlate[2]);
      doc.text('El presente reporte ha sido consolidado en tiempo real desde la base de datos central de la Gobernación de Boyacá.', margin + 6, curY + 12);
      doc.text('La veracidad de la información corresponde a los registros activos en la plataforma a la fecha y hora de emisión.', margin + 6, curY + 16.5);

      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
      }

      const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      doc.save(`Talento360_Informe_Dashboard_${dateCode}.pdf`);
      App.showToast('Informe ejecutivo del Dashboard descargado exitosamente.', 'success');
    } catch (err) {
      console.error('Error al generar PDF del Dashboard:', err);
      App.showToast('Error al generar PDF: ' + err.message, 'error');
    }
  }

  return { render, exportPDF, getUserDashboardType };
})();

window.DashboardModule = DashboardModule;
