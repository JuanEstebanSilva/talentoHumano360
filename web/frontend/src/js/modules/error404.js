/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Talento 360 — Módulo de Error 404 / Página No Encontrada (Versión Premium)
 * Gobernación de Boyacá · Secretaría General · Subdirección de Talento Humano
 * ═══════════════════════════════════════════════════════════════════════════
 */

const Error404Module = (() => {
  /**
   * Genera el HTML de la página completa 404 con ilustración 3D e identidad corporativa
   */
  function buildHtml(requestedModule = '404') {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    let currentUser = null;
    try {
      const uStr = localStorage.getItem('h360_user');
      if (uStr) currentUser = JSON.parse(uStr);
    } catch (_) { }

    const userName = currentUser ? (currentUser.nombre || currentUser.name || currentUser.username || 'Usuario') : 'Servidor Público';
    const cleanRoute = String(requestedModule || '404').replace(/^#\/?/, '');

    return `
    <div class="error-404-page" id="error-404-view">
      <!-- Luces ambientales de fondo -->
      <div class="error-404-bg-glow error-404-bg-glow--green" aria-hidden="true"></div>
      <div class="error-404-bg-glow error-404-bg-glow--gold" aria-hidden="true"></div>

      <!-- Barra Superior Institucional -->
      <header class="error-404-nav">
        <div class="error-404-nav-brand">
          <div class="error-404-nav-logo">
            <img src="imgs/logoCondor.png" alt="Escudo de Boyacá" class="logo-light-theme" />
            <img src="imgs/logoCondorBlanco.png" alt="Escudo de Boyacá" class="logo-dark-theme" />
          </div>
          <div class="error-404-nav-titles">
            <span class="error-404-nav-app">Talento <strong>360</strong></span>
            <span class="error-404-nav-entity">Gobernación de Boyacá</span>
          </div>
        </div>

        <div class="error-404-nav-controls">
          <!-- Alternar Tema Claro / Oscuro -->
          <button id="error-404-theme-toggle" class="error-404-theme-btn" title="Alternar tema claro y oscuro">
            <span class="error-404-theme-icon-sun">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="4"/>
                <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
                <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
                <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                <line x1="6.34" y1="17.66" x2="4.93" y2="19.07"/><line x1="19.07" y1="4.93" x2="17.66" y2="6.34"/>
              </svg>
            </span>
            <span class="error-404-theme-icon-moon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </span>
            <span id="error-404-theme-text" class="error-404-theme-text">${isDark ? 'Tema Oscuro' : 'Tema Claro'}</span>
          </button>

          <!-- Acceso directo al Dashboard -->
          <button id="error-404-nav-dashboard" class="error-404-dashboard-btn" title="Ir al Dashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            <span>Ir al Dashboard</span>
          </button>
        </div>
      </header>

      <!-- Contenedor Principal Centrado -->
      <main class="error-404-main-wrap">
        <div class="error-404-premium-card">

          <!-- Ilustración 3D de alta definición -->
          <div class="error-404-artwork-container">
            <div class="error-404-artwork-frame">
              <img src="imgs/error404.jpg?v=20260925" alt="Error 404 Talento 360" class="error-404-artwork-img" />
              <div class="error-404-artwork-glare"></div>
            </div>
            <div class="error-404-artwork-shadow"></div>
          </div>

          <!-- Contenido Informativo y Acciones -->
          <div class="error-404-content">
            <div class="error-404-status-badge">
              <span class="error-404-dot-indicator"></span>
              <span>ERROR 404 · PÁGINA O MÓDULO NO ENCONTRADO</span>
            </div>

            <h1 class="error-404-heading">No encontramos lo que buscas</h1>

            <p class="error-404-message">
              La sección, enlace o módulo <code>#/${escapeHtml(cleanRoute)}</code> no existe en la plataforma, fue trasladado o no se encuentra habilitado para tu cuenta.
            </p>

            <div class="error-404-user-strip">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Sesión activa: <strong>${escapeHtml(userName)}</strong></span>
            </div>

            <!-- Botones de Acción Primaria -->
            <div class="error-404-buttons-group">
              <button id="error-404-btn-dashboard" class="error-404-btn-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span>Volver al Dashboard</span>
              </button>

              <button id="error-404-btn-history-back" class="error-404-btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                <span>Página Anterior</span>
              </button>
            </div>

            <!-- Atajos rápidos -->
            <div class="error-404-quick-nav">
              <span class="error-404-quick-title">O ingresa directamente a:</span>
              <div class="error-404-quick-links">
                <button class="error-404-quick-pill" data-target="dashboard">Dashboard</button>
                <button class="error-404-quick-pill" data-target="employees">Servidores</button>
                <button class="error-404-quick-pill" data-target="horarios">Horarios</button>
                <button class="error-404-quick-pill" data-target="sst">Seguridad y Salud</button>
                <button class="error-404-quick-pill" data-target="viaticos">Viáticos</button>
              </div>
            </div>

          </div>
        </div>
      </main>

      <!-- Pie Institucional -->
      <footer class="error-404-bottom-bar">
        <span>Gobernación de Boyacá · Secretaría General — Subdirección de Talento Humano</span>
        <span class="error-404-separator">·</span>
        <span>Talento 360 © 2026</span>
      </footer>
    </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Conecta los eventos del 404
   */
  function bindEvents(rootEl) {
    const goDashboard = (e) => {
      e?.preventDefault();
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.click();
      hideFullScreen();
      if (typeof App !== 'undefined' && App.navigate) {
        App.navigate('dashboard');
      }
    };

    const btnMainDash = rootEl.querySelector('#error-404-btn-dashboard');
    const btnTopDash = rootEl.querySelector('#error-404-nav-dashboard');
    if (btnMainDash) btnMainDash.addEventListener('click', goDashboard);
    if (btnTopDash) btnTopDash.addEventListener('click', goDashboard);

    const btnBack = rootEl.querySelector('#error-404-btn-history-back');
    if (btnBack) {
      btnBack.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.click();
        hideFullScreen();
        if (window.history.length > 1) {
          window.history.back();
        } else if (typeof App !== 'undefined' && App.navigate) {
          App.navigate('dashboard');
        }
      });
    }

    // Toggle de Tema Claro / Oscuro
    const themeBtn = rootEl.querySelector('#error-404-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

        if (typeof Settings !== 'undefined') {
          Settings.set('theme', nextTheme);
        } else {
          document.documentElement.setAttribute('data-theme', nextTheme);
          localStorage.setItem('talento360_theme', nextTheme);
        }

        const textEl = rootEl.querySelector('#error-404-theme-text');
        if (textEl) textEl.textContent = nextTheme === 'dark' ? 'Tema Oscuro' : 'Tema Claro';

        if (typeof App !== 'undefined' && App.updateTopbarQuickControls) {
          App.updateTopbarQuickControls();
        }
        if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.click();
      });
    }

    // Pills de navegación rápida
    rootEl.querySelectorAll('.error-404-quick-pill[data-target]').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        const target = pill.getAttribute('data-target');
        if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.click();
        hideFullScreen();
        if (typeof App !== 'undefined' && App.navigate) {
          App.navigate(target);
        }
      });
    });
  }

  /**
   * Muestra la pantalla 404 a pantalla completa y oculta la estructura interna de la app
   */
  function showFullScreen(requestedModule = '404') {
    let overlay = document.getElementById('error-screen-404');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'error-screen-404';
      overlay.className = 'error-404-overlay';
      overlay.setAttribute('role', 'alert');
      document.body.appendChild(overlay);
    }

    // Ocultar el layout principal de la aplicación para evitar contenido duplicado o elementos asomados
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.style.display = 'none';
    }

    overlay.innerHTML = buildHtml(requestedModule);
    overlay.style.display = 'block';
    document.body.classList.add('error-404-active');

    bindEvents(overlay);
  }

  /**
   * Oculta la pantalla completa 404 y restaura la vista de la aplicación
   */
  function hideFullScreen() {
    const overlay = document.getElementById('error-screen-404');
    if (overlay && overlay.style.display !== 'none') {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
    }

    const appEl = document.getElementById('app');
    if (appEl && appEl.style.display === 'none') {
      appEl.style.display = 'grid';
    }

    document.body.classList.remove('error-404-active');
  }

  /**
   * Punto de entrada compatible con el enrutador de Talento 360
   */
  async function render(container, requestedModule = '404') {
    showFullScreen(requestedModule);
  }

  return {
    render,
    showFullScreen,
    hideFullScreen
  };
})();

if (typeof window !== 'undefined') {
  window.Error404Module = Error404Module;
}
