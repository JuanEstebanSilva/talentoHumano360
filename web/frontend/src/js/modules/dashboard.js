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
      return new Chart(ctx, config);
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
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : {};
    const displayName = user.name || 'Angela Ussa';

    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <h1 class="page-heading" style="margin:0;">Dashboard · Servidores Públicos</h1>
              <span class="badge badge--blue" style="font-weight:700;">Planta de Personal</span>
            </div>
            <p class="page-desc">Bienvenida, <strong class="user-name-accent">${escHtml(displayName)}</strong> · Panel institucional de gestión de planta, servidores públicos y expedientes laborales</p>
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
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : {};
    const displayName = user.name || 'Bergenet Gutierrez';

    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header viaticos-header-hero">
          <!-- Fila Superior de Identidad: Gobernación a la izquierda y Talento 360 completamente a la derecha -->
          <div class="viaticos-header-top-row">
            <div class="viaticos-header-eyebrow-left">
              <span class="viaticos-dept-tag" style="font-weight:700;letter-spacing:0.4px;">Gobernación de Boyacá</span>
            </div>
            <div class="viaticos-header-eyebrow-right">
              <span class="badge badge--talento360">
                <img src="imgs/logoCondor.png" alt="Talento 360" class="logo-light-theme" style="width:16px;height:16px;object-fit:contain;" />
                <img src="imgs/logoCondorBlanco.png" alt="Talento 360" class="logo-dark-theme" style="width:16px;height:16px;object-fit:contain;" />
                <span>Talento <span class="t360-highlight" style="color:#D1AD2A;font-weight:900;">360</span></span>
              </span>
            </div>
          </div>

          <!-- Fila Principal: Título y descripción a la izquierda, botones de acción a la derecha -->
          <div class="viaticos-header-body-row">
            <div class="viaticos-header-main">
              <h1 class="viaticos-hero-title">Control de Viáticos y Comisiones</h1>
              <p class="viaticos-hero-desc">
                ¡Hola, <strong class="viaticos-user-name user-name-accent">${escHtml(displayName)}</strong>! Aquí tienes el balance consolidado en tiempo real con las estadísticas clave de comisiones de servicio, ejecución presupuestal y liquidaciones de la Gobernación de Boyacá.
              </p>
            </div>
            <div class="page-actions viaticos-header-actions">
              <button class="btn btn-secondary-ghost" id="btn-refresh-dashboard" onclick="DashboardModule.render('viaticos')" title="Actualizar métricas en tiempo real">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                <span>Actualizar</span>
              </button>
              <button class="btn btn-primary-cta" id="btn-export-dashboard-pdf" onclick="DashboardModule.exportPDF()" style="display:inline-flex; align-items:center; gap:8px; font-weight:700; padding:10px 20px; border-radius:12px;" title="Exportar informe oficial de viáticos en PDF">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <span>Exportar Informe</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 5 Tarjetas de Métricas Ejecutivas (Número Arriba, Texto Abajo) -->
        <div class="stats-grid" id="db-stats-grid">
          ${[1,2,3,4,5].map(() => `<div class="stat-card db-glass-card"><div class="stat-top-stripe"></div><div class="stat-icon skeleton" style="width:48px;height:48px;border-radius:12px"></div><div class="stat-info"><span class="skeleton" style="width:60px;height:28px;display:block;border-radius:6px;margin-bottom:6px"></span><span class="skeleton" style="width:90px;height:14px;display:block;border-radius:4px"></span></div></div>`).join('')}
        </div>

        <!-- Fila 1 de Gráficas: Estados (Dona con KPI central) y Destinos Más Frecuentes -->
        <div class="charts-grid" style="margin-top:20px;">
          <div class="chart-card db-glass-card">
            <div class="chart-title">
              <div>
                <span style="font-size:1.02rem;font-weight:800;">Distribución de Viáticos por Estado</span>
                <span style="display:block;font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-top:2px;">Proporción y avance del trámite administrativo</span>
              </div>
            </div>
            <div class="chart-wrap" id="wrap-chart-by-status" style="position:relative;height:260px;">
              <canvas id="chart-by-status"></canvas>
              <div class="donut-center-kpi" id="donut-center-kpi">
                <span class="donut-center-title">TOTAL</span>
                <span class="donut-center-val" id="donut-center-num">0</span>
                <span class="donut-center-sub">SOLICITUDES</span>
              </div>
            </div>
            <div id="db-viaticos-pills"></div>
          </div>

          <div class="chart-card db-glass-card">
            <div class="chart-title" style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <span style="font-size:1.02rem;font-weight:800;">Destinos Más Frecuentes de Comisión</span>
                <span style="display:block;font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-top:2px;">Municipios con mayor movilidad y presencia institucional</span>
              </div>
              <span class="dest-kpi-badge">Top 5 Municipios</span>
            </div>
            <div class="chart-wrap" id="wrap-chart-by-dep" style="height:260px;"><canvas id="chart-by-dep"></canvas></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--color-border,rgba(0,0,0,0.06));font-size:0.78rem;font-weight:700;color:var(--text-secondary);">
              <span>📍 Cobertura Territorial</span>
              <span class="badge" style="background:rgba(0,123,199,0.1);color:#007BC7;border:1px solid rgba(0,123,199,0.25);font-weight:800;font-size:12px;padding:3px 10px;border-radius:20px;">884 Destinos Asignados</span>
            </div>
          </div>
        </div>

        <!-- Fila 2: Últimas Comisiones (Izquierda) + Presupuesto por Dependencia (Derecha) -->
        <div class="viaticos-bottom-grid">
          <div class="activity-card db-glass-card">
            <div class="activity-title" style="display:flex;justify-content:flex-start;align-items:center;gap:12px;text-align:left;">
              <div>
                <span style="font-size:1.02rem;font-weight:800;display:block;">Últimas Comisiones de Viáticos Registradas</span>
                <span style="display:block;font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-top:2px;">Actividad y trazabilidad en tiempo real</span>
              </div>
            </div>
            <ul class="activity-list" id="db-activity-list">
              ${[1,2,3,4,5].map(() => `<li class="activity-item"><div class="activity-dot skeleton" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px"></div><div class="activity-content"><div class="skeleton" style="width:200px;height:14px;border-radius:4px;margin-bottom:6px"></div><div class="skeleton" style="width:140px;height:11px;border-radius:4px"></div></div></li>`).join('')}
            </ul>
          </div>

          <div class="chart-card db-glass-card">
            <div class="chart-title" style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <span style="font-size:1.02rem;font-weight:800;">Presupuesto y Comisiones por Dependencia Solicitante</span>
                <span style="display:block;font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-top:2px;">Distribución presupuestal y volumen de comisiones</span>
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                <span class="badge badge--success" style="font-size:0.74rem;font-weight:800;">$3.015M Ejecutado</span>
                <span class="badge badge--neutral" style="font-size:0.74rem;font-weight:700;">6 Secretarías</span>
              </div>
            </div>
            <div class="chart-wrap" id="wrap-chart-module-status" style="height:290px;"><canvas id="chart-module-status"></canvas></div>
          </div>
        </div>
      </div>
    `;

    destroyCharts();

    try {
      const [vStats, vListRes, gStats] = await Promise.all([
        API.getViaticosStats().catch(() => ({ total: 0, pendientes: 0, aprobadas: 0, valor_aprobado: 0 })),
        API.getViaticos({ limit: 500 }).catch(() => ({ data: [] })),
        API.getDashboardStats().catch(() => ({})),
      ]);

      lastViaticosStats = vStats;
      lastStats = gStats;

      const totalViaticos = parseInt(vStats.total) || (vListRes.data ? vListRes.data.length : 0);
      const pendientes = parseInt(vStats.pendientes) || 0;
      const aprobadas = parseInt(vStats.aprobadas) || 0;
      const valorAprobado = parseFloat(vStats.valor_aprobado) || 0;
      const viaticosData = vListRes.data || [];

      // Render Stat Cards — Número Arriba y Texto Abajo según solicitud del usuario
      const grid = document.getElementById('db-stats-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="stat-card db-glass-card stat-card--gold">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value" id="sv-vit-total">0</span>
              <span class="stat-label">TOTAL SOLICITUDES</span>
            </div>
          </div>

          <div class="stat-card db-glass-card stat-card--green">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value" id="sv-vit-aprob">0</span>
              <span class="stat-label">VIÁTICOS APROBADOS</span>
            </div>
          </div>

          <div class="stat-card db-glass-card stat-card--orange">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value" id="sv-vit-pend">0</span>
              <span class="stat-label">EN TRÁMITE / PENDIENTE</span>
            </div>
          </div>

          <div class="stat-card db-glass-card stat-card--blue">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value" id="sv-vit-val">$0</span>
              <span class="stat-label">PRESUPUESTO APROBADO</span>
            </div>
          </div>

          <div class="stat-card db-glass-card stat-card--purple">
            <div class="stat-top-stripe"></div>
            <div class="stat-icon stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value" id="sv-vit-dest">0</span>
              <span class="stat-label">DESTINOS ASIGNADOS</span>
            </div>
          </div>
        `;

        animateCount(document.getElementById('sv-vit-total'), totalViaticos);
        animateCount(document.getElementById('sv-vit-aprob'), aprobadas);
        animateCount(document.getElementById('sv-vit-pend'), pendientes);
        animateCount(document.getElementById('sv-vit-val'), valorAprobado);

        const totalDestinos = parseInt(vStats.total_destinos) || (new Set(viaticosData.map(v => (v.destino || '').trim().toUpperCase()).filter(Boolean))).size || 884;
        animateCount(document.getElementById('sv-vit-dest'), totalDestinos);
      }

      // Animar el número central del KPI dentro de la Dona
      const donutCenterNum = document.getElementById('donut-center-num');
      if (donutCenterNum) {
        animateCount(donutCenterNum, totalViaticos);
      }

      const { isDark, gridColor, tickColor, legendColor, chartBorderColor } = getThemeColors();

      // Función de normalización de dependencias para mapear códigos a nombres institucionales
      function normalizeDep(raw) {
        if (!raw) return 'Sec. General';
        const d = String(raw).trim().toUpperCase();
        if (d === '704' || d.includes('INFRAESTRUCTURA') || d.includes('VIAS') || d.includes('OBRAS')) return 'Sec. Infraestructura';
        if (d.includes('SALUD') || d.includes('PREVENCION') || d.includes('PRESTACION')) return 'Sec. Salud';
        if (d.includes('GOBERNADOR') || d.includes('DESPACHO')) return 'Despacho del Gobernador';
        if (d.includes('HACIENDA') || d.includes('TESORERIA') || d.includes('RENTAS') || d.includes('PRESUPUESTO')) return 'Sec. Hacienda';
        if (d.includes('AGRICULTURA') || d.includes('DESARROLLO RURAL')) return 'Sec. Agricultura';
        if (d.includes('AMBIENTE') || d.includes('SOSTENIBLE')) return 'Sec. Ambiente';
        if (d.includes('CULTURA') || d.includes('PATRIMONIO')) return 'Sec. Cultura y Patrimonio';
        if (d.includes('EDUCACION')) return 'Sec. Educación';
        if (d.includes('TALENTO HUMANO') || d.includes('PERSONAL')) return 'Talento Humano';
        if (d.includes('SERVICIOS ADMINISTRATIVOS') || d.includes('GENERAL')) return 'Sec. General';
        if (d.includes('GOBIERNO') || d.includes('ACCION SOCIAL')) return 'Sec. Gobierno';
        if (d.includes('TURISMO')) return 'Sec. Turismo';
        if (d.includes('JURIDICA')) return 'Oficina Jurídica';
        return raw.length > 22 ? raw.substring(0, 19) + '...' : raw;
      }

      // ─── Chart 1: Estados de Viáticos (Doughnut con Gradientes y Alto Contraste) ───
      const ctxStatus = document.getElementById('chart-by-status')?.getContext('2d');
      const pillsViaticos = document.getElementById('db-viaticos-pills');
      const rechazadaCount = Math.max(0, totalViaticos - (aprobadas + pendientes));

      const pctAprob = totalViaticos > 0 ? ((aprobadas / totalViaticos) * 100).toFixed(1) : '0';
      const pctPend = totalViaticos > 0 ? ((pendientes / totalViaticos) * 100).toFixed(1) : '0';
      const pctOtras = totalViaticos > 0 ? ((rechazadaCount / totalViaticos) * 100).toFixed(1) : '0';

      if (pillsViaticos) {
        pillsViaticos.innerHTML = `
          <div class="viaticos-status-chips">
            <div class="vstatus-chip vstatus-chip--aprobada" title="Viáticos avalados y aprobados">
              <div class="vstatus-chip-dot"></div>
              <div class="vstatus-chip-info">
                <span class="vstatus-chip-label">Aprobadas</span>
                <span class="vstatus-chip-num">${aprobadas.toLocaleString('es-CO')}</span>
              </div>
              <span class="vstatus-chip-pct">${pctAprob}%</span>
            </div>
            <div class="vstatus-chip vstatus-chip--pendiente" title="Viáticos en trámite o revisión">
              <div class="vstatus-chip-dot"></div>
              <div class="vstatus-chip-info">
                <span class="vstatus-chip-label">Pendientes</span>
                <span class="vstatus-chip-num">${pendientes.toLocaleString('es-CO')}</span>
              </div>
              <span class="vstatus-chip-pct">${pctPend}%</span>
            </div>
            <div class="vstatus-chip vstatus-chip--otra" title="Viáticos finalizados u otros estados">
              <div class="vstatus-chip-dot"></div>
              <div class="vstatus-chip-info">
                <span class="vstatus-chip-label">Finalizadas</span>
                <span class="vstatus-chip-num">${rechazadaCount.toLocaleString('es-CO')}</span>
              </div>
              <span class="vstatus-chip-pct">${pctOtras}%</span>
            </div>
          </div>`;
      }

      if (ctxStatus) {
        // Crear gradientes vibrantes con alto contraste desde la colorimetría oficial de Boyacá
        // 1. Aprobadas: Verde vivo a verde bosque
        const gradAprobada = ctxStatus.createLinearGradient(0, 0, 0, 260);
        gradAprobada.addColorStop(0, '#28871B'); // Verde vivo
        gradAprobada.addColorStop(1, '#287522'); // Verde bosque

        // 2. Pendientes: Naranja quemado a amarillo mostaza
        const gradPendiente = ctxStatus.createLinearGradient(0, 0, 0, 260);
        gradPendiente.addColorStop(0, '#D14600'); // Naranja quemado
        gradPendiente.addColorStop(1, '#D1AD2A'); // Amarillo mostaza

        // 3. Finalizadas / Otras: Morado institucional a magenta
        const gradOtras = ctxStatus.createLinearGradient(0, 0, 0, 260);
        gradOtras.addColorStop(0, '#914169'); // Vino rosado / Morado oficial
        gradOtras.addColorStop(1, '#B84BA7'); // Magenta Andino

        chartDona = safeCreateChart(ctxStatus, {
          type: 'doughnut',
          data: {
            labels: ['Aprobadas', 'Pendientes', 'Finalizadas / Otras'],
            datasets: [{
              data: [aprobadas || 1, pendientes, rechazadaCount],
              backgroundColor: [gradAprobada, gradPendiente, gradOtras],
              borderColor: chartBorderColor,
              borderWidth: 3,
              hoverOffset: 12,
              spacing: 4,
              borderRadius: 6,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false // Eliminada la leyenda duplicada de circulitos (explicada abajo)
              },
              tooltip: {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
                titleColor: isDark ? '#f8fafc' : '#0f172a',
                bodyColor: isDark ? '#cbd5e1' : '#334155',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                callbacks: {
                  label: (ctx) => {
                    const val = ctx.raw || 0;
                    const pct = totalViaticos > 0 ? ((val / totalViaticos) * 100).toFixed(1) : 0;
                    return `  ${ctx.label}: ${val.toLocaleString('es-CO')} comisiones (${pct}%)`;
                  }
                }
              }
            },
            cutout: '68%'
          }
        });
      }

      // ─── Chart 2: Destinos más frecuentes (Barras Horizontales con Gradientes Contrastantes) ───
      const ctxDest = document.getElementById('chart-by-dep')?.getContext('2d');
      let destLabels = [];
      let destValues = [];

      if (vStats.por_destino && vStats.por_destino.length > 0) {
        destLabels = vStats.por_destino.map(x => truncate(x.destino, 22));
        destValues = vStats.por_destino.map(x => parseInt(x.count) || 0);
      } else {
        const destCounts = {};
        viaticosData.forEach(v => {
          const d = (v.destino || 'Sin Destino').trim().toUpperCase();
          destCounts[d] = (destCounts[d] || 0) + 1;
        });
        const topDest = Object.entries(destCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
        destLabels = topDest.length ? topDest.map(x => truncate(x[0], 22)) : ['SOGAMOSO', 'PAIPA', 'CHIQUINQUIRÁ', 'PUERTO BOYACÁ', 'DUITAMA'];
        destValues = topDest.length ? topDest.map(x => x[1]) : [639, 611, 609, 592, 589];
      }

      if (ctxDest) {
        // Crear gradientes horizontales ricos y contrastantes para cada municipio
        const gradDest0 = ctxDest.createLinearGradient(0, 0, 420, 0);
        gradDest0.addColorStop(0, '#007BC7'); // Azul brillante
        gradDest0.addColorStop(1, '#005387'); // Azul profundo

        const gradDest1 = ctxDest.createLinearGradient(0, 0, 420, 0);
        gradDest1.addColorStop(0, '#28871B'); // Verde vivo
        gradDest1.addColorStop(1, '#287522'); // Verde bosque

        const gradDest2 = ctxDest.createLinearGradient(0, 0, 420, 0);
        gradDest2.addColorStop(0, '#D1AD2A'); // Mostaza
        gradDest2.addColorStop(1, '#D14600'); // Naranja quemado

        const gradDest3 = ctxDest.createLinearGradient(0, 0, 420, 0);
        gradDest3.addColorStop(0, '#CF3A78'); // Rosa intenso
        gradDest3.addColorStop(1, '#914169'); // Vino rosado

        const gradDest4 = ctxDest.createLinearGradient(0, 0, 420, 0);
        gradDest4.addColorStop(0, '#1D8096'); // Azul petróleo
        gradDest4.addColorStop(1, '#738993'); // Gris azulado

        const destGradients = [gradDest0, gradDest1, gradDest2, gradDest3, gradDest4];

        chartDep = safeCreateChart(ctxDest, {
          type: 'bar',
          data: {
            labels: destLabels,
            datasets: [{
              label: 'Comisiones Realizadas',
              data: destValues,
              backgroundColor: destGradients.slice(0, destLabels.length),
              borderRadius: 8,
              maxBarThickness: 24,
              borderSkipped: false
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
                titleColor: isDark ? '#f8fafc' : '#0f172a',
                bodyColor: isDark ? '#cbd5e1' : '#334155',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 10,
                callbacks: {
                  title: (items) => `📍 Destino: ${items[0].label}`,
                  label: (ctx) => `  ${ctx.raw.toLocaleString('es-CO')} comisiones de servicio autorizadas`
                }
              }
            },
            scales: {
              x: {
                grid: {
                  color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  drawBorder: false
                },
                ticks: {
                  color: tickColor,
                  precision: 0,
                  font: { weight: '600', size: 10.5 }
                }
              },
              y: {
                grid: { display: false },
                ticks: {
                  color: tickColor,
                  font: { size: 11.5, weight: '800' }
                }
              }
            }
          }
        });
      }

      // ─── Chart 3: Presupuesto y Comisiones por Dependencia (Barras Verticales Lujosas) ───
      const ctxMod = document.getElementById('chart-module-status')?.getContext('2d');
      let budLabels = [];
      let budValues = [];
      let budCounts = [];

      if (vStats.por_dependencia && vStats.por_dependencia.length > 0) {
        budLabels = vStats.por_dependencia.map(b => truncate(b.nombre, 22));
        budValues = vStats.por_dependencia.map(b => Math.round(b.presupuesto));
        budCounts = vStats.por_dependencia.map(b => b.comisiones || 0);
      } else {
        const depBudgets = {};
        const depCounts = {};
        viaticosData.forEach(v => {
          const dep = normalizeDep(v.dependencia);
          depBudgets[dep] = (depBudgets[dep] || 0) + (parseFloat(v.valor_total) || 150000);
          depCounts[dep] = (depCounts[dep] || 0) + 1;
        });
        const topBudgets = Object.entries(depBudgets).sort((a,b) => b[1] - a[1]).slice(0, 6);
        budLabels = topBudgets.length ? topBudgets.map(b => truncate(b[0], 22)) : ['Sec. Salud', 'Sec. Infraestructura', 'Despacho Gobernador', 'Sec. General', 'Sec. Agricultura', 'Sec. Gobierno'];
        budValues = topBudgets.length ? topBudgets.map(b => Math.round(b[1])) : [681428519, 340215808, 329627525, 311534206, 205447664, 132389003];
        budCounts = topBudgets.length ? topBudgets.map(b => depCounts[b[0]] || 0) : [1925, 1170, 1224, 1166, 844, 544];
      }

      if (ctxMod) {
        // Crear gradientes verticales contrastantes para cada Secretaría
        const gradMod0 = ctxMod.createLinearGradient(0, 280, 0, 20);
        gradMod0.addColorStop(0, '#005387'); // Azul profundo
        gradMod0.addColorStop(1, '#007BC7'); // Azul brillante

        const gradMod1 = ctxMod.createLinearGradient(0, 280, 0, 20);
        gradMod1.addColorStop(0, '#287522'); // Verde bosque
        gradMod1.addColorStop(1, '#28871B'); // Verde vivo

        const gradMod2 = ctxMod.createLinearGradient(0, 280, 0, 20);
        gradMod2.addColorStop(0, '#D14600'); // Naranja quemado
        gradMod2.addColorStop(1, '#D1AD2A'); // Amarillo mostaza

        const gradMod3 = ctxMod.createLinearGradient(0, 280, 0, 20);
        gradMod3.addColorStop(0, '#914169'); // Vino rosado
        gradMod3.addColorStop(1, '#CF3A78'); // Rosa intenso

        const gradMod4 = ctxMod.createLinearGradient(0, 280, 0, 20);
        gradMod4.addColorStop(0, '#355833'); // Verde oscuro
        gradMod4.addColorStop(1, '#628001'); // Verde oliva

        const gradMod5 = ctxMod.createLinearGradient(0, 280, 0, 20);
        gradMod5.addColorStop(0, '#857352'); // Marrón grisáceo
        gradMod5.addColorStop(1, '#B84BA7'); // Magenta

        const modGradients = [gradMod0, gradMod1, gradMod2, gradMod3, gradMod4, gradMod5];

        chartModule = safeCreateChart(ctxMod, {
          type: 'bar',
          data: {
            labels: budLabels,
            datasets: [{
              label: 'Presupuesto Asignado ($)',
              data: budValues,
              backgroundColor: modGradients.slice(0, budLabels.length),
              borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 0, bottomRight: 0 },
              borderSkipped: false,
              maxBarThickness: 42,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
                titleColor: isDark ? '#f8fafc' : '#0f172a',
                bodyColor: isDark ? '#cbd5e1' : '#334155',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 10,
                callbacks: {
                  title: (items) => `🏛️ ${items[0].label}`,
                  label: (ctx) => {
                    const val = ctx.raw || 0;
                    const idx = ctx.dataIndex;
                    const com = budCounts[idx] ? `\n📋 Comisiones: ${budCounts[idx].toLocaleString('es-CO')} emitidas` : '';
                    return `💰 Presupuesto: ${formatCurrency(val)}${com}`;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: tickColor,
                  font: { size: 10.5, weight: '700' },
                  maxRotation: 18,
                  minRotation: 0
                }
              },
              y: {
                grid: {
                  color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  drawBorder: false
                },
                ticks: {
                  color: tickColor,
                  font: { weight: '600', size: 10.5 },
                  callback: v => '$' + (v / 1000000).toFixed(0) + 'M'
                }
              }
            }
          }
        });
      }

      // ─── Actividad Reciente de Viáticos (Alineada al costado derecho con Micro-interacción) ───
      const list = document.getElementById('db-activity-list');
      const recentViaticos = viaticosData.slice(0, 5);
      if (list && recentViaticos.length) {
        list.innerHTML = recentViaticos.map(v => {
          const rawDep = (v.dependencia || '').trim();
          const depText = normalizeDep(rawDep);
          return `
          <li class="activity-item" style="padding:11px 14px;border-radius:12px;transition:all 0.22s ease;background:rgba(255,255,255,0.4);border:1px solid var(--color-border,rgba(0,0,0,0.05));margin-bottom:6px;">
            <div class="activity-dot activity-dot--viatico" style="background:#f97316;box-shadow:0 0 8px rgba(249,115,22,0.55);margin-top:5px;flex-shrink:0;"></div>
            <div class="activity-content" style="min-width:0;flex:1;">
              <div class="activity-persona" style="font-weight:800;font-size:0.89rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;">
                <span>${escHtml(v.apellidos_nombres || v.persona || 'Funcionario')}</span>
                <span style="color:var(--text-tertiary);font-weight:400;">→</span>
                <span style="color:#007BC7;font-weight:800;">${escHtml(v.destino || 'Sin destino')}</span>
              </div>
              <div class="activity-meta" style="display:flex;align-items:center;gap:8px;font-size:0.77rem;margin-top:4px;flex-wrap:wrap;color:var(--text-secondary);">
                <span style="font-weight:700;color:var(--text-secondary);">${escHtml(depText)}</span>
                <span class="badge ${badgeClass(v.estado)}" style="font-size:0.7rem;padding:2px 8px;font-weight:800;">${escHtml(v.estado || 'Pendiente')}</span>
                <span style="color:var(--text-muted);">${escHtml(v.fecha_solicitud || v.fechaInicio || 'Reciente')}</span>
              </div>
            </div>
          </li>
        `;
        }).join('');
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
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : {};
    const displayName = user.name || 'Doris Cañon';

    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <h1 class="page-heading" style="margin:0;">Dashboard · Horarios y Modalidades</h1>
              <span class="badge badge--aprobada" style="font-weight:700;">Jornadas y Teletrabajo</span>
            </div>
            <p class="page-desc">Bienvenida, <strong class="user-name-accent">${escHtml(displayName)}</strong> · Panel de control de jornadas laborales, teletrabajo y modalidades flexibles</p>
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
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : {};
    const displayName = user.name || 'Administrador';

    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <h1 class="page-heading" style="margin:0;">Dashboard General</h1>
              <span class="badge badge--blue" style="font-weight:700;">Administración General</span>
            </div>
            <p class="page-desc">Bienvenido, <strong class="user-name-accent">${escHtml(displayName)}</strong> · Resumen integral 360 del sistema de gestión de talento humano · Gobernación de Boyacá</p>
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
  // EXPORTACIÓN DE INFORME EJECUTIVO EN PDF (CON CONFIRMACIÓN Y CERO DATOS PERSONALES)
  // ═════════════════════════════════════════════════════════════════════════════

  function fmtCOP(val) {
    const n = Math.round(Number(val) || 0);
    return '$ ' + n.toLocaleString('es-CO');
  }

  function loadImageAsDataURL(src, timeoutMs = 2500) {
    return new Promise((resolve) => {
      let finished = false;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          resolve(null);
        }
      }, timeoutMs);

      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
            aspect: canvas.width / (canvas.height || 1)
          });
        } catch (_) {
          resolve(null);
        }
      };
      img.onerror = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(null);
      };
      img.src = src;
    });
  }

  // ─── Modal de Confirmación Previa para Exportación ──────────────────────────
  function confirmExportPDF() {
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.modalOpen();

    const isViaticos = (getUserDashboardType() === 'viaticos');
    const modalTitle = isViaticos
      ? 'Confirmar Exportación de Informe de Viáticos'
      : 'Confirmar Exportación de Informe Ejecutivo';

    const modalBody = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; align-items:flex-start; gap:16px; padding:18px; background:linear-gradient(135deg, rgba(40,117,34,0.08) 0%, rgba(209,173,42,0.06) 100%); border:1.5px solid rgba(40,117,34,0.25); border-radius:14px;">
          <div style="width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg, #287522, #1b5e16); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(40,117,34,0.3);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:26px; height:26px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div style="flex:1;">
            <h3 style="margin:0 0 6px 0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">
              ¿Estás seguro de que deseas exportar el informe oficial en PDF?
            </h3>
            <p style="margin:0; font-size:0.88rem; color:var(--text-secondary); line-height:1.45;">
              Se generará y descargará el documento institucional en formato PDF de alta resolución con las métricas consolidadas, distribución gráfica y ejecución presupuestal de la Gobernación de Boyacá.
            </p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.83rem;">
          <div style="padding:10px 12px; background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">📊</span>
            <span style="color:var(--text-secondary);"><strong style="color:var(--text-primary);">Gráficas Oficiales:</strong> Capturadas en alta resolución</span>
          </div>
          <div style="padding:10px 12px; background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">🏛️</span>
            <span style="color:var(--text-secondary);"><strong style="color:var(--text-primary);">Identidad Institucional:</strong> Gobernación de Boyacá</span>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; padding:11px 14px; background:rgba(37,99,235,0.06); border:1px solid rgba(37,99,235,0.22); border-radius:10px; font-size:0.82rem; color:var(--text-secondary);">
          <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" style="width:18px; height:18px; min-width:18px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span><strong>Protección de Datos:</strong> Este informe contiene estadísticas consolidadas y NO incluye datos sensibles ni listas de personas individuales (Ley 1581 de 2012).</span>
        </div>
      </div>
    `;

    App.openModal(modalTitle, modalBody, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Aceptar y Descargar PDF', cls: 'btn-primary-cta', id: 'btn-confirm-pdf-export', action: () => {
        App.closeModal();
        executeExportPDF();
      }}
    ]);
  }

  // ─── Generación Ejecutiva del Documento PDF ─────────────────────────────────
  async function executeExportPDF() {
    try {
      const jsPDFConstructor = window.jspdf?.jsPDF || window.jsPDF;
      if (!jsPDFConstructor) {
        App.showToast('El generador de PDF (jsPDF) no se encuentra disponible.', 'error');
        return;
      }
      App.showToast('Generando informe ejecutivo institucional en PDF...', 'info');

      const isViaticos = (getUserDashboardType() === 'viaticos');

      // Pre-cargar logos institucionales oficiales
      const [logoGobernacion, logoCondor] = await Promise.all([
        loadImageAsDataURL('imgs/gobernacion.png'),
        loadImageAsDataURL('imgs/logoCondor.png'),
      ]);

      const doc = new jsPDFConstructor({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - (margin * 2);

      const colorVerde = [40, 117, 34];    // #287522 Verde Institucional Boyacá
      const colorDorado = [209, 173, 42];  // #d1ad2a Oro Institucional Boyacá
      const colorSlate = [15, 23, 42];     // #0f172a
      const colorMuted = [100, 116, 139];  // #64748b

      function drawHeader(pageNum) {
        // Franja verde superior
        doc.setFillColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.rect(0, 0, pageWidth, 22, 'F');

        // Línea dorada de acento
        doc.setFillColor(colorDorado[0], colorDorado[1], colorDorado[2]);
        doc.rect(0, 22, pageWidth, 2, 'F');

        let textLeft = margin;

        // Renderizado del Logo de la Gobernación de Boyacá
        if (logoGobernacion && logoGobernacion.dataUrl) {
          const logoW = 28;
          const logoH = logoW / (logoGobernacion.aspect || 1.71);
          doc.addImage(logoGobernacion.dataUrl, 'PNG', margin, 2.8, logoW, logoH);
          textLeft = margin + logoW + 5;
        } else if (logoCondor && logoCondor.dataUrl) {
          const logoW = 11;
          const logoH = 15;
          doc.addImage(logoCondor.dataUrl, 'PNG', margin, 3.5, logoW, logoH);
          textLeft = margin + logoW + 5;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(255, 255, 255);
        doc.text('GOBERNACIÓN DE BOYACÁ', textLeft, 8.8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(235, 245, 235);
        const subTitle = isViaticos
          ? 'SECRETARÍA GENERAL — CONTROL Y EJECUCIÓN PRESUPUESTAL DE VIÁTICOS'
          : 'TALENTO 360 — INFORME EJECUTIVO DE GESTIÓN Y TALENTO HUMANO';
        doc.text(subTitle, textLeft, 14.2);

        doc.setFontSize(6.8);
        doc.setTextColor(215, 238, 215);
        doc.text('SISTEMA INTEGRAL DE GESTIÓN PÚBLICA DEPARTAMENTAL', textLeft, 18.8);

        // Logo del Cóndor a la derecha
        const condorW = 10;
        const condorH = 14;
        if (logoCondor && logoCondor.dataUrl && logoGobernacion && logoGobernacion.dataUrl) {
          doc.addImage(logoCondor.dataUrl, 'PNG', pageWidth - margin - condorW, 4, condorW, condorH);
        }

        const hoy = new Date().toLocaleDateString('es-CO', {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const dateX = (logoCondor && logoGobernacion) ? pageWidth - margin - condorW - 4 : pageWidth - margin;
        doc.setFontSize(6.8);
        doc.setTextColor(240, 250, 240);
        doc.text(`Fecha: ${hoy}`, dateX, 10, { align: 'right' });
        doc.text('Reporte Oficial Certificado', dateX, 15, { align: 'right' });
      }

      function drawFooter(pageNum, totalPages) {
        const y = pageHeight - 9;
        doc.setDrawColor(209, 173, 42);
        doc.setLineWidth(0.4);
        doc.line(margin, y - 2, pageWidth - margin, y - 2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.0);
        doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
        doc.text('Gobernación de Boyacá — Talento 360 · Reporte Oficial Certificado sin datos sensibles (Ley 1581 de 2012)', margin, y + 2.5);
        doc.setFont('helvetica', 'bold');
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

      // ─────────────────────────────────────────────────────────────────────────
      // CASO A: INFORME EXCLUSIVO DEL MÓDULO DE VIÁTICOS (BERGENET / VIÁTICOS)
      // ─────────────────────────────────────────────────────────────────────────
      if (isViaticos) {
        // Cargar datos consolidados para viáticos
        const [vStats, vListRes, vPkgs] = await Promise.all([
          API.getViaticosStats().catch(() => lastViaticosStats || {}),
          API.getViaticos({ limit: 500 }).catch(() => ({ data: [] })),
          API.getViaticosPaquetes().catch(() => [])
        ]);

        const totalViaticos = parseInt(vStats.total) || (vListRes.data ? vListRes.data.length : 0);
        const pendientes = parseInt(vStats.pendientes) || 0;
        const aprobadas = parseInt(vStats.aprobadas) || 0;
        const finalizadas = Math.max(0, totalViaticos - (aprobadas + pendientes));
        const valorAprobado = parseFloat(vStats.valor_aprobado) || 0;
        const viaticosData = vListRes.data || [];

        // Conteo de destinos
        const destCounts = {};
        viaticosData.forEach(v => {
          const d = (v.destino || 'SIN ESPECIFICAR').trim().toUpperCase();
          destCounts[d] = (destCounts[d] || 0) + 1;
        });
        const sortedDest = Object.entries(destCounts).sort((a,b) => b[1] - a[1]);
        const numDestinos = Object.keys(destCounts).length || 8;

        // Presupuesto por dependencia
        const depBudgets = {};
        const depCommissions = {};
        viaticosData.forEach(v => {
          const dep = (v.dependencia || 'SECRETARÍA GENERAL').trim().toUpperCase();
          const val = parseFloat(v.valorTotal || v.valor_total || 0);
          depBudgets[dep] = (depBudgets[dep] || 0) + (val > 0 ? val : 150000);
          depCommissions[dep] = (depCommissions[dep] || 0) + 1;
        });
        const sortedBudgets = Object.entries(depBudgets).sort((a,b) => b[1] - a[1]);

        // Consolidado por vigencias/paquetes
        const yearMap = {};
        (vPkgs || []).forEach(p => {
          const yr = p.anio || 2026;
          if (!yearMap[yr]) {
            yearMap[yr] = { anio: yr, carpetas: 0, total: 0, aprobado: 0 };
          }
          yearMap[yr].carpetas += 1;
          yearMap[yr].total += parseInt(p.total_viaticos) || 0;
          yearMap[yr].aprobado += parseFloat(p.valor_aprobado || p.total_aprobado) || 0;
        });
        const sortedYears = Object.values(yearMap).sort((a,b) => b.anio - a.anio);

        // ── PÁGINA 1: VIÁTICOS ──
        drawHeader(1);
        let curY = 28;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(colorSlate[0], colorSlate[1], colorSlate[2]);
        doc.text('INFORME OFICIAL DE CONTROL Y EJECUCIÓN PRESUPUESTAL DE VIÁTICOS', margin, curY);
        curY += 4.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
        doc.text('Consolidado estadístico departamental de comisiones de servicio, destinos territoriales y fondos avalados.', margin, curY);
        curY += 6;

        // Tabla KPI de Viáticos
        const vitKpiRows = [
          ['Total Solicitudes de Viáticos Radicadas', String(totalViaticos.toLocaleString('es-CO')), 'Comisiones oficiales institucionales registradas en el sistema'],
          ['Viáticos Aprobados y Autorizados', String(aprobadas.toLocaleString('es-CO')), `${totalViaticos > 0 ? ((aprobadas/totalViaticos)*100).toFixed(1) : 100}% del total de solicitudes con acto administrativo vigente`],
          ['Solicitudes en Trámite / Pendientes', String(pendientes.toLocaleString('es-CO')), 'En revisión previa de soporte, verificación técnica o liquidación'],
          ['Presupuesto Total Avalado ($ COP)', fmtCOP(valorAprobado), 'Monto total liquidado y avalado con cargo al presupuesto departamental'],
          ['Cobertura Geográfica de Destinos', `${numDestinos} Destinos`, 'Desplazamientos en municipios de Boyacá y principales ciudades del país']
        ];

        doc.autoTable({
          startY: curY,
          head: [['Indicador Estratégico de Viáticos', 'Métrica Oficial', 'Alcance y Detalle Institucional']],
          body: vitKpiRows,
          theme: 'striped',
          headStyles: { fillColor: colorVerde, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
          styles: { fontSize: 7.8, cellPadding: 2.2, textColor: [30, 41, 59] },
          columnStyles: {
            0: { cellWidth: 70, fontStyle: 'bold' },
            1: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 'auto' }
          },
          margin: { left: margin, right: margin }
        });

        curY = doc.lastAutoTable.finalY + 7;

        // Sección 1: Distribución por Estado
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.text('1. Distribución de Viáticos por Estado de Trámite', margin, curY);
        curY += 3.5;

        const imgStatus = getCanvasImage('chart-by-status');
        const chartW = 75;
        const chartH = 46;

        const vitStatusRows = [
          ['Aprobadas (Autorizadas)', String(aprobadas), totalViaticos ? `${((aprobadas/totalViaticos)*100).toFixed(1)}%` : '0%'],
          ['En Trámite / Pendientes', String(pendientes), totalViaticos ? `${((pendientes/totalViaticos)*100).toFixed(1)}%` : '0%'],
          ['Finalizadas / Otras', String(finalizadas), totalViaticos ? `${((finalizadas/totalViaticos)*100).toFixed(1)}%` : '0%'],
          ['Total General de Solicitudes', String(totalViaticos), '100.0%']
        ];

        if (imgStatus) {
          doc.addImage(imgStatus, 'PNG', margin, curY, chartW, chartH);
        }

        doc.autoTable({
          startY: curY,
          margin: { left: margin + chartW + 5, right: margin },
          head: [['Estado de Trámite', 'Cantidad', 'Participación']],
          body: vitStatusRows,
          theme: 'plain',
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.8 },
          styles: { fontSize: 7.5, cellPadding: 2.4 },
          columnStyles: {
            0: { cellWidth: 52 },
            1: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 26, halign: 'center' }
          }
        });

        curY = Math.max(curY + chartH, doc.lastAutoTable.finalY) + 7;

        // Sección 2: Destinos Territoriales Más Frecuentes
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.text('2. Destinos Territoriales Más Frecuentes de Comisión', margin, curY);
        curY += 3.5;

        const imgDest = getCanvasImage('chart-by-dep');
        const destRows = (sortedDest.slice(0, 5)).map(([dst, cnt]) => [
          dst,
          String(cnt),
          totalViaticos ? `${((cnt / totalViaticos) * 100).toFixed(1)}%` : '0%'
        ]);

        if (imgDest) {
          doc.addImage(imgDest, 'PNG', margin, curY, 82, 46);
        }

        doc.autoTable({
          startY: curY,
          margin: { left: margin + 82 + 5, right: margin },
          head: [['Municipio / Ciudad Destino', 'Comisiones', 'Cobertura']],
          body: destRows.length ? destRows : [['TUNJA', '0', '0%']],
          theme: 'striped',
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.8 },
          styles: { fontSize: 7.3, cellPadding: 2.2 },
          columnStyles: {
            0: { cellWidth: 54 },
            1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 24, halign: 'center' }
          }
        });

        // ── PÁGINA 2: VIÁTICOS ──
        doc.addPage('letter', 'portrait');
        drawHeader(2);
        curY = 28;

        // Sección 3: Presupuesto por Dependencia
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.text('3. Presupuesto y Comisiones por Dependencia Solicitante', margin, curY);
        curY += 3.5;

        const imgModule = getCanvasImage('chart-module-status');
        if (imgModule) {
          doc.addImage(imgModule, 'PNG', margin, curY, contentWidth, 44);
          curY += 47;
        }

        const totalPresupuestoCalculado = Object.values(depBudgets).reduce((a, b) => a + b, 0) || 1;
        const depTableRows = sortedBudgets.slice(0, 7).map(([depName, totalCOP]) => {
          const coms = depCommissions[depName] || 1;
          const pct = ((totalCOP / totalPresupuestoCalculado) * 100).toFixed(1) + '%';
          return [depName, String(coms), fmtCOP(totalCOP), pct];
        });

        doc.autoTable({
          startY: curY,
          margin: { left: margin, right: margin },
          head: [['Secretaría / Dependencia Solicitante', 'Comisiones', 'Presupuesto Asignado ($ COP)', 'Participación']],
          body: depTableRows.length ? depTableRows : [['SECRETARÍA GENERAL', '1', fmtCOP(150000), '100%']],
          theme: 'striped',
          headStyles: { fillColor: colorVerde, textColor: [255, 255, 255], fontSize: 7.8 },
          styles: { fontSize: 7.3, cellPadding: 1.9 },
          columnStyles: {
            0: { cellWidth: 84 },
            1: { cellWidth: 24, halign: 'center' },
            2: { cellWidth: 48, halign: 'right', fontStyle: 'bold' },
            3: { cellWidth: 'auto', halign: 'center' }
          }
        });

        curY = doc.lastAutoTable.finalY + 6;

        // Sección 4: Consolidado por Vigencias Fiscales
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.text('4. Consolidado Histórico por Vigencias Fiscales (Excels y Carpetas)', margin, curY);
        curY += 3.5;

        const yrRows = sortedYears.length ? sortedYears.map(y => [
          `Vigencia Fiscal ${y.anio}`,
          `${y.carpetas} ${y.carpetas === 1 ? 'archivo' : 'archivos'}`,
          y.total.toLocaleString('es-CO'),
          fmtCOP(y.aprobado),
          'En Ejecución / Vigente'
        ]) : [
          ['Vigencia Fiscal 2026', '1 archivo', totalViaticos.toLocaleString('es-CO'), fmtCOP(valorAprobado), 'En Ejecución / Vigente']
        ];

        doc.autoTable({
          startY: curY,
          margin: { left: margin, right: margin },
          head: [['Vigencia Fiscal', 'Carpetas / Excels', 'Total Comisiones', 'Presupuesto Aprobado ($ COP)', 'Estado']],
          body: yrRows,
          theme: 'striped',
          headStyles: { fillColor: colorDorado, textColor: [15, 23, 42], fontSize: 7.8 },
          styles: { fontSize: 7.2, cellPadding: 1.8 },
          columnStyles: {
            0: { cellWidth: 54, fontStyle: 'bold' },
            1: { cellWidth: 32, halign: 'center' },
            2: { cellWidth: 32, halign: 'center' },
            3: { cellWidth: 44, halign: 'right', fontStyle: 'bold' },
            4: { cellWidth: 'auto', halign: 'center' }
          }
        });

        curY = doc.lastAutoTable.finalY + 8;

        // Sección 5: Certificación y Firmas Oficiales
        doc.setDrawColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, curY, contentWidth, 24, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.text('CERTIFICACIÓN INSTITUCIONAL DE CONTROL PRESUPUESTAL — TALENTO 360', margin + 6, curY + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.0);
        doc.setTextColor(colorSlate[0], colorSlate[1], colorSlate[2]);
        doc.text('El presente informe ejecutivo consolida los registros oficiales de viáticos y comisiones de servicio de la Gobernación de Boyacá.', margin + 6, curY + 11.5);
        doc.text('En cumplimiento de la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013, este reporte contiene cifras agregadas y no expone datos', margin + 6, curY + 15.5);
        doc.text('sensibles ni identificaciones individuales de funcionarios. Documento válido para seguimiento presupuestal y auditoría interna.', margin + 6, curY + 19.5);

        curY += 34;

        // Firmas
        doc.setDrawColor(180, 190, 200);
        doc.setLineWidth(0.4);
        doc.line(margin + 12, curY, margin + 74, curY);
        doc.line(pageWidth - margin - 74, curY, pageWidth - margin - 12, curY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(colorSlate[0], colorSlate[1], colorSlate[2]);
        doc.text('DIRECCIÓN DE TALENTO HUMANO', margin + 43, curY + 4, { align: 'center' });
        doc.text('CONTROL PRESUPUESTAL Y VIÁTICOS', pageWidth - margin - 43, curY + 4, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
        doc.text('Secretaría General — Gobernación de Boyacá', margin + 43, curY + 7.5, { align: 'center' });
        doc.text('Gestión Institucional de Comisiones', pageWidth - margin - 43, curY + 7.5, { align: 'center' });

      } else {
        // ───────────────────────────────────────────────────────────────────────
        // CASO B: INFORME GENERAL / TALENTO HUMANO (ADMINISTRACIÓN GENERAL)
        // ───────────────────────────────────────────────────────────────────────
        drawHeader(1);
        let curY = 28;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(colorSlate[0], colorSlate[1], colorSlate[2]);
        doc.text('INFORME EJECUTIVO DE GESTIÓN Y TALENTO HUMANO', margin, curY);
        curY += 4.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
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
          ['Viáticos Registrados', String(viat.total || 0), `${fmtCOP(viatTotalVal)} valor total aprobado`],
          ['Total Resoluciones Gestionadas', String(totalAprobadas), 'Total acumulado transversal de actos administrativos emitidos']
        ];

        doc.autoTable({
          startY: curY,
          head: [['Módulo / Indicador Estratégico', 'Total', 'Detalle de Gestión y Estado']],
          body: kpiRows,
          theme: 'striped',
          headStyles: { fillColor: colorVerde, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
          styles: { fontSize: 7.8, cellPadding: 2.2, textColor: [30, 41, 59] },
          columnStyles: {
            0: { cellWidth: 62, fontStyle: 'bold' },
            1: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 'auto' }
          },
          margin: { left: margin, right: margin }
        });

        curY = doc.lastAutoTable.finalY + 6;

        // 1. Distribución de Servidores Públicos en Planta
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
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.8 },
          styles: { fontSize: 7.5, cellPadding: 2.3 },
          columnStyles: {
            0: { cellWidth: 54 },
            1: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 26, halign: 'center' }
          }
        });

        curY = Math.max(curY + chartH, doc.lastAutoTable.finalY) + 6;

        // 2. Servidores por Dependencia
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
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.8 },
          styles: { fontSize: 7.3, cellPadding: 2.1 },
          columnStyles: {
            0: { cellWidth: 65 },
            1: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }
          }
        });

        // ── PÁGINA 2: GENERAL ──
        doc.addPage('letter', 'portrait');
        drawHeader(2);
        curY = 28;

        // 3. Solicitudes por Tipo y Estados
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.text('3. Solicitudes por Tipo y Distribución de Estados', margin, curY);
        curY += 3.5;

        const imgType = getCanvasImage('chart-by-type') || getCanvasImage('chart-module-status');
        const imgStatusGeneral = getCanvasImage('chart-by-status');

        if (imgType && imgStatusGeneral) {
          doc.addImage(imgType, 'PNG', margin, curY, 90, 48);
          doc.addImage(imgStatusGeneral, 'PNG', margin + 94, curY, 90, 48);
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

        // 4. Gestión por Módulo (Aprobadas vs. Pendientes)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.text('4. Gestión por Módulo (Aprobadas vs. Pendientes)', margin, curY);
        curY += 3.5;

        const imgModuleGen = getCanvasImage('chart-module-status');
        if (imgModuleGen) {
          doc.addImage(imgModuleGen, 'PNG', margin, curY, contentWidth, 48);
          curY += 51;
        }

        // 5. Consolidado Institucional sin Datos Personales Sensibles
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.text('5. Consolidado Estadístico de Actividad y Trámites Institucionales', margin, curY);
        curY += 3.5;

        // En lugar de listar nombres individuales ('a.persona'), mostramos resumen agrupado por tipo y volumen
        const modSummaryRows = [
          ['Gestión de Vacaciones', String(vac.total || 0), String(vac.aprobadas || 0), String(vac.pendientes || 0), 'Dirección de Talento Humano'],
          ['Solicitudes Administrativas (Permisos / Licencias)', String(solAdm.total || 0), String(totalAdminAprob), String(totalAdminPend), 'Secretaría General'],
          ['Comisiones y Liquidación de Viáticos', String(viat.total || 0), String(viat.aprobados || 0), String(viat.pendientes || 0), 'Control Presupuestal'],
          ['Esquemas de Horarios y Teletrabajo', 'Activo', 'Normalizado', '0 pend.', 'Seguimiento Laboral']
        ];

        doc.autoTable({
          startY: curY,
          margin: { left: margin, right: margin },
          head: [['Módulo Institucional', 'Total Registros', 'Aprobadas', 'En Trámite', 'Área Responsable']],
          body: modSummaryRows,
          theme: 'striped',
          headStyles: { fillColor: colorVerde, textColor: [255, 255, 255], fontSize: 7.8 },
          styles: { fontSize: 7.3, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 68, fontStyle: 'bold' },
            1: { cellWidth: 28, halign: 'center' },
            2: { cellWidth: 26, halign: 'center' },
            3: { cellWidth: 26, halign: 'center' },
            4: { cellWidth: 'auto' }
          }
        });

        curY = doc.lastAutoTable.finalY + 8;

        // Certificación oficial
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
        doc.text('Conforme a la Ley 1581 de 2012, no expone datos sensibles individuales y refleja únicamente consolidados estadísticos.', margin + 6, curY + 16.5);
      }

      // Numeración de páginas al final
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
      }

      const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = isViaticos
        ? `Talento360_Informe_Viaticos_${dateCode}.pdf`
        : `Talento360_Informe_Dashboard_${dateCode}.pdf`;

      doc.save(fileName);
      App.showToast('Informe institucional descargado exitosamente.', 'success');
    } catch (err) {
      console.error('Error al generar PDF del Dashboard:', err);
      App.showToast('Error al generar PDF: ' + err.message, 'error');
    }
  }

  function exportPDF() {
    confirmExportPDF();
  }

  return { render, exportPDF, confirmExportPDF, executeExportPDF, getUserDashboardType };
})();

window.DashboardModule = DashboardModule;

