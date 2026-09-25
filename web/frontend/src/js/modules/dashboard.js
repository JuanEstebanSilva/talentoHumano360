/* ═══════════════════════════════════════════════════════════════════════════
   dashboard.js — Dashboard module
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

  function activityDot(tipo) {
    const t = (tipo || '').toLowerCase();
    if (t.includes('vacac')) return 'activity-dot--vacacion';
    if (t.includes('permiso')) return 'activity-dot--permiso';
    if (t.includes('incap')) return 'activity-dot--incapacidad';
    if (t.includes('licenc')) return 'activity-dot--licencia';
    if (t.includes('viát')) return 'activity-dot--viatico';
    return 'activity-dot--vacacion';
  }

  function badgeClass(estado) {
    const e = (estado || '').toLowerCase();
    if (e.includes('aprobad'))  return 'badge--aprobada';
    if (e.includes('finaliz'))  return 'badge--finalizada';
    if (e.includes('rechazad')) return 'badge--rechazada';
    if (e.includes('revis'))    return 'badge--revision';
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

  async function render(container) {
    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <h1 class="page-heading">Dashboard</h1>
            <p class="page-desc">Resumen general del sistema de gestión de talento humano</p>
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

        <div class="stats-grid" id="db-stats-grid" aria-busy="true" role="progressbar">
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

          <!-- Gráfica & Métricas de Seguridad y Salud en el Trabajo (SST) -->
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
                <div class="skeleton" style="height:80px;border-radius:12px;" aria-busy="true" role="progressbar"></div>
                <div class="skeleton" style="height:80px;border-radius:12px;" aria-busy="true" role="progressbar"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="activity-card db-glass-card">
          <div class="activity-title">Actividad Reciente</div>
          <ul class="activity-list" id="db-activity-list" aria-busy="true" role="progressbar">
            ${[1,2,3,4].map(() => `<li class="activity-item"><div class="activity-dot skeleton" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px"></div><div class="activity-content"><div class="skeleton" style="width:200px;height:14px;border-radius:4px;margin-bottom:6px"></div><div class="skeleton" style="width:140px;height:11px;border-radius:4px"></div></div></li>`).join('')}
          </ul>
        </div>
      </div>`;

    // Destroy old charts
    if (chartServidores) { chartServidores.destroy(); chartServidores = null; }
    if (chartBar)        { chartBar.destroy();        chartBar        = null; }
    if (chartDona)       { chartDona.destroy();       chartDona       = null; }
    if (chartModule)     { chartModule.destroy();     chartModule     = null; }
    if (chartDep)        { chartDep.destroy();        chartDep        = null; }
    if (chartSst)        { chartSst.destroy();        chartSst        = null; }

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

      // ─── Stats Grid ─────────────────────────────────────────────────────
      const grid = document.getElementById('db-stats-grid');
      const totalAdmin = (stats.solicitudesAdmin.permisos||0) + (stats.solicitudesAdmin.incapacidades||0) + (stats.solicitudesAdmin.licencias||0);
      const totalAprobadas = (stats.vacaciones.aprobadas||0) + (chart.porEstado?.find(x=>x.estado==='Aprobada')?.cantidad||0);

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
            <span class="stat-badge stat-badge--warn" id="sv-vac-pend" title="${stats.vacaciones.pendientes || 0} solicitudes pendientes de vacaciones">${stats.vacaciones.pendientes || 0} pendientes</span>
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
            <span class="stat-badge stat-badge--warn" id="sv-adm-pend" title="${stats.solicitudesAdmin.pendientes || 0} solicitudes administrativas pendientes">${stats.solicitudesAdmin.pendientes || 0} pendientes</span>
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
            <span class="stat-badge stat-badge--gold" title="$${Math.round(stats.viaticos.valorTotalAprobado || 0).toLocaleString('es-CO')} aprobados">$${Math.round(stats.viaticos.valorTotalAprobado || 0).toLocaleString('es-CO')} aprobados</span>
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
            <span class="stat-badge stat-badge--purple" title="${totalAprobadas} solicitudes gestionadas y aprobadas">✓ ${totalAprobadas} gestionadas</span>
          </div>
        </div>`;

      // Animate counters
      animateCount(document.getElementById('sv-emp'), stats.empleados?.total || 0);
      animateCount(document.getElementById('sv-vac'), stats.vacaciones?.total || 0);
      animateCount(document.getElementById('sv-adm'), totalAdmin);
      animateCount(document.getElementById('sv-vit'), stats.viaticos?.total || 0);
      animateCount(document.getElementById('sv-aprobadas'), totalAprobadas);

      const empBadge = document.getElementById('sv-emp-badge');
      if (empBadge) {
        const emp = stats.empleados || {};
        if (emp.total > 0) {
          if (emp.vacantes > 0) {
            empBadge.textContent = `${emp.activos || 0} act. · ${emp.vacantes || 0} vac.`;
          } else {
            empBadge.textContent = `${emp.activos || 0} activos`;
          }
          empBadge.title = `${emp.activos || 0} servidores activos · ${emp.vacantes || 0} plazas vacantes en planta (${emp.total || 0} en total)`;
        } else {
          empBadge.textContent = '0 en planta';
          empBadge.title = 'Sin servidores registrados';
        }
      }

      // ─── Chart Setup Variables ───────────────────────────────────────────
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
      const tickColor = isDark ? '#94a3b8' : '#64748b';
      const legendColor = isDark ? '#e2e8f0' : '#334155';
      const chartBorderColor = isDark ? '#0f172a' : '#ffffff';

      // ─── Chart 1: Solicitudes por Tipo ──────────────────────────────────
      const ctxBar = document.getElementById('chart-by-type')?.getContext('2d');
      if (ctxBar && chart.porTipo) {
        const labels = chart.porTipo.map(d => d.tipo);
        const valores = chart.porTipo.map(d => d.cantidad);
        chartBar = new Chart(ctxBar, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Solicitudes',
              data: valores,
              backgroundColor: TYPE_COLORS.map(c => c[0]),
              borderColor: TYPE_COLORS.map(c => c[1]),
              borderWidth: 1.5,
              borderRadius: 8,
              borderSkipped: false,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                titleColor: isDark ? '#ffffff' : '#0f172a',
                bodyColor: isDark ? '#94a3b8' : '#475569',
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                padding: 12,
                cornerRadius: 10,
                borderColor: isDark ? '#334155' : '#e2e8f0',
                borderWidth: 1
              }
            },
            scales: {
              x: {
                grid: { color: gridColor },
                ticks: { color: tickColor, font: { size: 12, weight: '600' } }
              },
              y: {
                grid: { color: gridColor },
                ticks: { color: tickColor, precision: 0, font: { size: 12 } }
              }
            }
          }
        });
      }

      // ─── Gráfica 1: Servidores Públicos (Activos, Inactivos, Vacantes) ──
      const ctxServ = document.getElementById('chart-by-servidores')?.getContext('2d');
      const wrapServ = document.getElementById('wrap-chart-servidores');
      const pillsServ = document.getElementById('db-servidores-pills');
      const badgeServ = document.getElementById('db-servidores-badge');

      const sData = chart.servidores || {
        activos: stats.empleados?.activos || 0,
        inactivos: stats.empleados?.inactivos || 0,
        vacantes: stats.empleados?.vacantes || 0,
        total: stats.empleados?.total || 0,
      };

      if (badgeServ) {
        badgeServ.textContent = `${sData.total} en planta`;
      }

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
        if (sData.total === 0) {
          if (wrapServ) {
            wrapServ.innerHTML = `
              <div class="chart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span>No hay servidores públicos registrados en la planta</span>
              </div>`;
          }
        } else {
          chartServidores = new Chart(ctxServ, {
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
                legend: {
                  position: 'bottom',
                  labels: {
                    color: legendColor,
                    padding: 14,
                    font: { size: 12, weight: '600' },
                    usePointStyle: true,
                    pointStyle: 'circle'
                  }
                },
                tooltip: {
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  titleColor: isDark ? '#ffffff' : '#0f172a',
                  bodyColor: isDark ? '#94a3b8' : '#475569',
                  titleFont: { size: 13, weight: 'bold' },
                  bodyFont: { size: 12 },
                  padding: 12,
                  cornerRadius: 10,
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  borderWidth: 1,
                  callbacks: {
                    label: function(ctx) {
                      const val = ctx.raw || 0;
                      const pct = sData.total > 0 ? Math.round((val / sData.total) * 100) : 0;
                      return ` ${ctx.label}: ${val} (${pct}%)`;
                    }
                  }
                }
              },
              cutout: '68%'
            }
          });
        }
      }

      // ─── Chart 3: Distribución por Estado ────────────────────────────────
      const ctxDona = document.getElementById('chart-by-status')?.getContext('2d');
      const wrapStatus = document.getElementById('wrap-chart-by-status');
      if (ctxDona) {
        const hasStatus = chart.porEstado && chart.porEstado.some(d => d.cantidad > 0);
        if (!hasStatus) {
          if (wrapStatus) {
            wrapStatus.innerHTML = `
              <div class="chart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                <span>No hay solicitudes registradas para evaluar estados</span>
              </div>`;
          }
        } else {
          const labels = chart.porEstado.map(d => d.estado);
          const valores = chart.porEstado.map(d => d.cantidad);
          const colors = labels.map(l => (STATUS_COLORS[l] || ['#94a3b8', '#64748b'])[0]);
          chartDona = new Chart(ctxDona, {
            type: 'doughnut',
            data: {
              labels,
              datasets: [{
                data: valores,
                backgroundColor: colors,
                borderColor: chartBorderColor,
                borderWidth: 3,
                hoverOffset: 8
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    color: legendColor,
                    padding: 16,
                    font: { size: 12, weight: '600' },
                    usePointStyle: true,
                    pointStyle: 'circle'
                  }
                },
                tooltip: {
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  titleColor: isDark ? '#ffffff' : '#0f172a',
                  bodyColor: isDark ? '#94a3b8' : '#475569',
                  titleFont: { size: 13, weight: 'bold' },
                  bodyFont: { size: 12 },
                  padding: 12,
                  cornerRadius: 10,
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  borderWidth: 1
                }
              },
              cutout: '70%'
            }
          });
        }
      }

      // ─── Chart 3: Gestión por Módulo (Aprobadas vs Pendientes) ───────────
      const ctxModule = document.getElementById('chart-module-status')?.getContext('2d');
      if (ctxModule) {
        const perm = Array.isArray(adminStats) ? adminStats.find(x => (x.tipo||'').includes('Permiso')) : null;
        const incap = Array.isArray(adminStats) ? adminStats.find(x => (x.tipo||'').includes('Incap')) : null;
        const lic = Array.isArray(adminStats) ? adminStats.find(x => (x.tipo||'').includes('Licen')) : null;

        const moduleLabels = ['Vacaciones', 'Permisos', 'Incapacidades', 'Licencias', 'Viáticos'];
        const aprobadasData = [
          stats.vacaciones.aprobadas || 0,
          parseInt(perm?.aprobadas) || 0,
          parseInt(incap?.aprobadas) || 0,
          parseInt(lic?.aprobadas) || 0,
          parseInt(viaticosStats.aprobadas) || 0,
        ];
        const pendientesData = [
          stats.vacaciones.pendientes || 0,
          parseInt(perm?.pendientes) || (stats.solicitudesAdmin.permisos ? 1 : 0),
          parseInt(incap?.pendientes) || 0,
          parseInt(lic?.pendientes) || 0,
          parseInt(viaticosStats.pendientes) || 0,
        ];

        chartModule = new Chart(ctxModule, {
          type: 'bar',
          data: {
            labels: moduleLabels,
            datasets: [
              {
                label: 'Aprobadas / Finalizadas',
                data: aprobadasData,
                backgroundColor: '#10b981',
                borderColor: '#059669',
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
              },
              {
                label: 'Pendientes / Trámite',
                data: pendientesData,
                backgroundColor: '#f59e0b',
                borderColor: '#d97706',
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: legendColor,
                  padding: 14,
                  font: { size: 11, weight: '600' },
                  usePointStyle: true,
                  pointStyle: 'circle'
                }
              },
              tooltip: {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                titleColor: isDark ? '#ffffff' : '#0f172a',
                bodyColor: isDark ? '#94a3b8' : '#475569',
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                padding: 12,
                cornerRadius: 10,
                borderColor: isDark ? '#334155' : '#e2e8f0',
                borderWidth: 1
              }
            },
            scales: {
              x: {
                grid: { color: gridColor },
                ticks: { color: tickColor, font: { size: 11, weight: '600' } }
              },
              y: {
                grid: { color: gridColor },
                ticks: { color: tickColor, precision: 0, font: { size: 11 } }
              }
            }
          }
        });
      }

      // ─── Gráfica 2: Top Dependencias ───────────────────────────────────
      const ctxDep = document.getElementById('chart-by-dep')?.getContext('2d');
      const wrapDep = document.getElementById('wrap-chart-by-dep');
      if (ctxDep) {
        const depData = (chart.porDependencia && chart.porDependencia.length > 0)
          ? chart.porDependencia
          : [];

        if (depData.length === 0) {
          if (wrapDep) {
            wrapDep.innerHTML = `
              <div class="chart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M3 21h18M5 21V7l8-4v18M13 21V3l6 4v14M9 9h1M9 13h1M9 17h1M15 9h1M15 13h1M15 17h1"/>
                </svg>
                <span>No hay servidores registrados por dependencia</span>
              </div>`;
          }
        } else {
          const depLabels = depData.map(x => x.dependencia);
          const depValues = depData.map(x => x.cantidad);

          chartDep = new Chart(ctxDep, {
            type: 'bar',
            data: {
              labels: depLabels,
              datasets: [{
                label: 'Servidores Asignados',
                data: depValues,
                backgroundColor: [
                  'rgba(14, 165, 233, 0.85)',
                  'rgba(6, 182, 212, 0.85)',
                  'rgba(20, 184, 166, 0.85)',
                  'rgba(16, 185, 129, 0.85)',
                  'rgba(139, 92, 246, 0.85)'
                ],
                borderColor: [
                  '#0284c7',
                  '#0891b2',
                  '#0d9488',
                  '#059669',
                  '#7c3aed'
                ],
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false,
              }]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  titleColor: isDark ? '#ffffff' : '#0f172a',
                  bodyColor: isDark ? '#94a3b8' : '#475569',
                  titleFont: { size: 13, weight: 'bold' },
                  bodyFont: { size: 12 },
                  padding: 12,
                  cornerRadius: 10,
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  borderWidth: 1
                }
              },
              scales: {
                x: {
                  grid: { color: gridColor },
                  ticks: { color: tickColor, precision: 0, font: { size: 11 } }
                },
                y: {
                  grid: { color: gridColor },
                  ticks: {
                    color: tickColor,
                    font: { size: 11, weight: '600' },
                    callback: function(val, index) {
                      const label = this.getLabelForValue(val) || '';
                      return label.length > 25 ? label.slice(0, 23) + '…' : label;
                    }
                  }
                }
              }
            }
          });
        }
      }

      // ─── Gráfica SST: Seguridad y Salud en el Trabajo ────────────────────
      const ctxSst = document.getElementById('chart-by-sst')?.getContext('2d');
      const wrapSst = document.getElementById('wrap-chart-sst');
      const sstMetricsWrap = document.getElementById('db-sst-quick-metrics');
      
      const sst = sstStats || {};
      const sstLabels = [
        'Exámenes Médicos (EMO)',
        'Vigilancia Epidem. (PVE)',
        'Casos AT / EL',
        'Dotaciones EPP',
        'Sociodemográfico'
      ];
      const sstValues = [
        Number(sst.totalEmo) || 0,
        Number(sst.direccionadosPve) || 0,
        Number(sst.casosSeguimiento) || 0,
        Number(sst.totalEpp) || 0,
        Number(sst.totalSociodemografico) || 0
      ];

      if (sstMetricsWrap) {
        sstMetricsWrap.innerHTML = `
          <div style="background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:12px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; box-shadow:var(--shadow-card);">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:40px; height:40px; border-radius:10px; background:rgba(0,123,199,0.12); color:var(--color-primary); display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div>
                <div style="font-size:0.78rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Cobertura EMO</div>
                <div style="font-size:1.15rem; font-weight:800; color:var(--text-primary);">${sst.emoVigentes || 0} <span style="font-size:0.8rem; font-weight:600; color:var(--color-success);">vigentes</span></div>
              </div>
            </div>
            <span class="badge ${Number(sst.emoAlertas) > 0 ? 'badge--rechazada' : 'badge--neutral'}" style="font-size:0.75rem; font-weight:700;">
              ${sst.emoAlertas || 0} Alertas
            </span>
          </div>

          <div style="background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:12px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; box-shadow:var(--shadow-card);">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:40px; height:40px; border-radius:10px; background:rgba(98,128,1,0.12); color:var(--color-green-dark); display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div style="font-size:0.78rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Gestión de Protección</div>
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
        chartSst = new Chart(ctxSst, {
          type: 'bar',
          data: {
            labels: sstLabels,
            datasets: [{
              label: 'Registros Gestionados',
              data: sstValues,
              backgroundColor: [
                'rgba(0, 123, 199, 0.85)',   // Azul corporativo #007BC7 (EMO)
                'rgba(98, 128, 1, 0.85)',    // Verde corporativo #628001 (PVE)
                'rgba(227, 36, 49, 0.85)',   // Rojo corporativo #E32431 (AT/EL)
                'rgba(184, 75, 167, 0.85)',  // Magenta corporativo #B84BA7 (EPP)
                'rgba(29, 128, 150, 0.85)'   // Teal corporativo #1D8096 (Sociodemográfico)
              ],
              borderColor: [
                '#007BC7',
                '#628001',
                '#E32431',
                '#B84BA7',
                '#1D8096'
              ],
              borderWidth: 1,
              borderRadius: 8,
              borderSkipped: false,
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                titleColor: isDark ? '#ffffff' : '#0f172a',
                bodyColor: isDark ? '#94a3b8' : '#475569',
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                padding: 12,
                cornerRadius: 10,
                borderColor: isDark ? '#334155' : '#e2e8f0',
                borderWidth: 1
              }
            },
            scales: {
              x: {
                grid: { color: gridColor },
                ticks: { color: tickColor, precision: 0, font: { size: 11 } }
              },
              y: {
                grid: { color: gridColor },
                ticks: {
                  color: tickColor,
                  font: { size: 11, weight: '600' },
                  callback: function(val, index) {
                    const label = this.getLabelForValue(val) || '';
                    return label.length > 24 ? label.slice(0, 22) + '…' : label;
                  }
                }
              }
            }
          }
        });
      }

      // ─── Activity Feed ───────────────────────────────────────────────────
      const list = document.getElementById('db-activity-list');
      if (list && stats.actividades?.length) {
        list.innerHTML = stats.actividades.map(a => `
          <li class="activity-item">
            <div class="activity-dot ${activityDot(a.tipo)}"></div>
            <div class="activity-content">
              <div class="activity-persona">${a.persona || 'Sin nombre'}</div>
              <div class="activity-meta">
                <span>${a.tipo}</span>
                <span>·</span>
                <span>${a.dependencia || 'Sin dependencia'}</span>
                <span>·</span>
                <span><span class="badge ${badgeClass(a.estado)}">${a.estado}</span></span>
                <span>·</span>
                <span>${a.fecha}</span>
              </div>
            </div>
          </li>`).join('');
      } else if (list) {
        list.innerHTML = '<li class="empty-state"><p>No hay actividad reciente.</p></li>';
      }

    } catch (err) {
      App.showToast('Error al cargar el dashboard: ' + err.message, 'error');
    }
  }

  /**
   * Generación de Informe Ejecutivo en PDF del Dashboard con Gráficas y Valores
   */
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

      const pageWidth = doc.internal.pageSize.getWidth();   // 215.9 mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm
      const margin = 14;
      const contentWidth = pageWidth - (margin * 2);

      // Colores institucionales Gobernación de Boyacá
      const colorVerde = [40, 117, 34];    // #287522
      const colorDorado = [209, 173, 42];  // #d1ad2a
      const colorSlate = [15, 23, 42];     // #0f172a
      const colorMuted = [100, 116, 139];  // #64748b

      function drawHeader(pageNum) {
        // Franja principal Verde Boyacá
        doc.setFillColor(colorVerde[0], colorVerde[1], colorVerde[2]);
        doc.rect(0, 0, pageWidth, 20, 'F');

        // Línea de acento dorado institucional
        doc.setFillColor(colorDorado[0], colorDorado[1], colorDorado[2]);
        doc.rect(0, 20, pageWidth, 1.8, 'F');

        // Título institucional
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text('GOBERNACIÓN DE BOYACÁ', margin, 9.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(235, 245, 235);
        doc.text('TALENTO 360 — INFORME EJECUTIVO DE GESTIÓN Y TALENTO HUMANO', margin, 15.5);

        // Metadatos a la derecha
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

      // ─── PÁGINA 1: KPIs y Servidores Públicos ──────────────────────────────
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

      // Resumen de Indicadores Clave (KPIs)
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

      // Sección 1: Distribución de Servidores Públicos
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

      // Sección 2: Top Dependencias
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
      doc.text('2. Servidores por Dependencia (Top Dependencias)', margin, curY);
      curY += 3.5;

      const imgDep = getCanvasImage('chart-by-dep');
      const depData = (lastChart?.porDependencia || []).slice(0, 5);
      const depRows = depData.map(d => [d.dependencia, String(d.total)]);

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

      // ─── PÁGINA 2: Tipos, Estados y Gestión por Módulo ─────────────────────
      doc.addPage('letter', 'portrait');
      drawHeader(2);
      curY = 28;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
      doc.text('3. Solicitudes por Tipo y Distribución de Estados', margin, curY);
      curY += 3.5;

      const imgType = getCanvasImage('chart-by-type');
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

      // Sección 4: Gestión por Módulo (Aprobadas vs. Pendientes)
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

      const modRows = (lastChart?.porModulo || []).map(m => [
        m.modulo,
        String(m.aprobadas || 0),
        String(m.pendientes || 0),
        String((m.aprobadas || 0) + (m.pendientes || 0))
      ]);

      doc.autoTable({
        startY: curY,
        margin: { left: margin, right: margin },
        head: [['Módulo del Sistema', 'Aprobadas', 'Pendientes', 'Total Gestionadas']],
        body: modRows.length ? modRows : [['Sin datos', '0', '0', '0']],
        theme: 'striped',
        headStyles: { fillColor: colorVerde, textColor: [255, 255, 255], fontSize: 7.8 },
        styles: { fontSize: 7.3, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 35, halign: 'center', textColor: [16, 185, 129], fontStyle: 'bold' },
          2: { cellWidth: 35, halign: 'center', textColor: [245, 158, 11], fontStyle: 'bold' },
          3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
        }
      });

      // ─── PÁGINA 3: Actividad Reciente y Auditoría ──────────────────────────
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

      // Sello institucional de validación
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

      // Numeración de páginas
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

  return { render, exportPDF };
})();
