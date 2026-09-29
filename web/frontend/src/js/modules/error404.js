/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Talento 360 — Módulo de Error 404 / Página No Encontrada (Versión Oficial Boyacá)
 * Gobernación de Boyacá · Secretaría General · Subdirección de Talento Humano
 * ═══════════════════════════════════════════════════════════════════════════
 */

const Error404Module = (() => {

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeFxClick() {
    try {
      if (typeof FX !== 'undefined' && FX.Sound) {
        if (typeof FX.Sound.click === 'function') {
          FX.Sound.click();
        } else if (typeof FX.Sound.navClick === 'function') {
          FX.Sound.navClick();
        }
      }
    } catch (_) { }
  }

  function goDashboard() {
    safeFxClick();
    hide();

    const isLogged = typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn();

    if (!isLogged) {
      if (typeof App !== 'undefined' && App.showLogin) {
        App.showLogin();
      } else {
        const loginEl = document.getElementById('login-screen');
        if (loginEl) loginEl.style.display = 'flex';
        const appEl = document.getElementById('app');
        if (appEl) appEl.style.display = 'none';
      }
      try {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } else {
          window.location.hash = '';
        }
      } catch (_) { }
      return;
    }

    // Usuario autenticado: asegurar que la vista de la app esté visible
    if (typeof App !== 'undefined' && App.showApp) {
      App.showApp();
    } else {
      const appEl = document.getElementById('app');
      if (appEl) appEl.style.display = 'grid';
      const loginEl = document.getElementById('login-screen');
      if (loginEl) loginEl.style.display = 'none';
    }

    // Actualizar hash en la URL
    try {
      if (window.location.hash !== '#dashboard' && window.location.hash !== '#/dashboard') {
        window.location.hash = 'dashboard';
      }
    } catch (_) { }

    // Ejecutar la navegación hacia el dashboard
    if (typeof App !== 'undefined' && App.navigate) {
      App.navigate('dashboard');
    }
  }

  function goBack() {
    safeFxClick();
    hide();
    if (window.history.length > 1) {
      window.history.back();
      setTimeout(() => {
        const currentHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
        const [mod] = currentHash.split('?');
        const validRoutes = [
          'dashboard', 'employees', 'requests', 'admin-requests',
          'viaticos', 'horarios', 'sst', 'settings',
          'privacidad', 'terminos', 'accesibilidad'
        ];
        if (!mod || !validRoutes.includes(mod)) {
          goDashboard();
        }
      }, 300);
    } else {
      goDashboard();
    }
  }

  function buildHtml(requestedModule = '404', errorMessage = '') {
    let currentUser = null;
    try {
      const uStr = localStorage.getItem('h360_user');
      if (uStr) currentUser = JSON.parse(uStr);
    } catch (_) { }

    const userName = currentUser ? (currentUser.nombre || currentUser.name || currentUser.username || 'Usuario') : 'Angela Ussa';
    const cleanRoute = String(requestedModule || '404').replace(/^#\/?/, '');

    return `
      <div class="error-404-container">
        
        <!-- Contenido Central Dividido en Dos Secciones -->
        <div class="error-404-layout">

          <!-- Columna Izquierda: Escudo Oficial de Boyacá, Logos y Marca de Agua 404 -->
          <div class="error-404-left-section">
            <!-- Marca de agua 404 gigante -->
            <div class="error-404-huge-watermark" aria-hidden="true">404</div>

            <!-- Escudo Oficial de Boyacá (Asset Oficial Limpio) -->
            <div class="error-404-escudo-wrapper" title="Escudo Oficial del Departamento de Boyacá">
              <img src="imgs/logoCondor.png" alt="Escudo de Boyacá" class="error-404-escudo-img logo-light-theme" />
              <img src="imgs/logoCondorBlanco.png" alt="Escudo de Boyacá" class="error-404-escudo-img logo-dark-theme" />
            </div>

            <!-- Identidad Secretaría General y Talento 360 -->
            <div class="error-404-identity-box">
              <img src="imgs/secretariaGral.png" alt="Gobernación de Boyacá | General" class="error-404-secgen-brand" />
              <div class="error-404-talento-title">
                <span class="talento-word">Talento</span> <span class="num-word">360</span>
              </div>
            </div>
          </div>

          <!-- Columna Derecha: Tarjeta Flotante Limpia con Mensaje y Botones -->
          <div class="error-404-right-section">
            <div class="error-404-floating-card">

              <!-- Cabecera de la Tarjeta con Badges -->
              <div class="error-404-card-header">
                <div class="error-404-pill-status">
                  <span class="error-404-dot"></span>
                  <span>ERROR 404 · PÁGINA O MÓDULO NO ENCONTRADO</span>
                </div>

                <div class="error-404-pill-user">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>Sesión activa: <strong>${escapeHtml(userName)}</strong></span>
                </div>
              </div>

              <!-- Título en Dos Líneas -->
              <h1 class="error-404-title">No encontramos<br/>lo que buscas</h1>

              <!-- Explicación de la Ruta -->
              <p class="error-404-text">
                La sección, enlace o módulo <code>#/${escapeHtml(cleanRoute)}</code> no existe en la plataforma, fue trasladado o no se encuentra habilitado para tu cuenta.
              </p>

              ${errorMessage ? `
                <div class="error-404-tech-detail">
                  <small>Detalle: ${escapeHtml(errorMessage)}</small>
                </div>
              ` : ''}

              <!-- Botones de Acción Funcionales -->
              <div class="error-404-actions">
                <button id="error-404-btn-dashboard" class="error-404-btn-primary" type="button" onclick="Error404Module.goDashboard()" title="Volver al Dashboard principal">
                  Volver al Dashboard
                </button>
                <button id="error-404-btn-history-back" class="error-404-btn-secondary" type="button" onclick="Error404Module.goBack()" title="Regresar a la página previa">
                  Página Anterior
                </button>
              </div>

            </div>
          </div>

        </div>

        <!-- Pie de Página Institucional -->
        <footer class="error-404-footer">
          <span>Gobernación de Boyacá · Secretaría General — Subdirección de Talento Humano · Talento 360 © 2026</span>
        </footer>

      </div>
    `;
  }

  function bindEvents(rootEl) {
    if (!rootEl) return;
    const btnDash = rootEl.querySelector('#error-404-btn-dashboard');
    if (btnDash) {
      btnDash.onclick = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        goDashboard();
      };
    }

    const btnBack = rootEl.querySelector('#error-404-btn-history-back');
    if (btnBack) {
      btnBack.onclick = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        goBack();
      };
    }
  }

  function show(requestedModule = '404', errorMessage = '') {
    const overlay = document.getElementById('error-screen-404');
    if (!overlay) return;

    // 1. Ocultar completamente el layout de la app y la pantalla de login para evitar cualquier superposición
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.style.display = 'none';
      appEl.setAttribute('aria-hidden', 'true');
    }
    const loginEl = document.getElementById('login-screen');
    if (loginEl) {
      loginEl.style.display = 'none';
      loginEl.setAttribute('aria-hidden', 'true');
    }

    // 2. Activar clases en html y body para neutralizar zoom y bloquear scroll
    document.documentElement.classList.add('error-404-active');
    document.body.classList.add('error-404-active');

    // 3. Renderizar HTML
    overlay.innerHTML = buildHtml(requestedModule, errorMessage);
    overlay.style.display = 'flex';

    // 4. Vincular eventos de los botones
    bindEvents(overlay);
    document.title = '404 · Página o Módulo No Encontrado — Talento 360';
  }

  function hide() {
    const overlay = document.getElementById('error-screen-404');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
    }

    document.documentElement.classList.remove('error-404-active');
    document.body.classList.remove('error-404-active');

    const appEl = document.getElementById('app');
    const loginEl = document.getElementById('login-screen');
    if (appEl) appEl.removeAttribute('aria-hidden');
    if (loginEl) loginEl.removeAttribute('aria-hidden');

    const isLogged = typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn();
    if (isLogged) {
      if (appEl && appEl.style.display === 'none') {
        appEl.style.display = 'grid';
      }
      if (loginEl) {
        loginEl.style.display = 'none';
      }
    } else {
      if (loginEl && loginEl.style.display === 'none') {
        loginEl.style.display = 'flex';
      }
      if (appEl) {
        appEl.style.display = 'none';
      }
    }
  }

  // Backwards compatibility for render()
  async function render(container, requestedModule = '404', errorMessage = '') {
    show(requestedModule, errorMessage);
  }

  return {
    show,
    hide,
    render,
    goDashboard,
    goBack,
    hideFullScreen: hide
  };
})();

if (typeof window !== 'undefined') {
  window.Error404Module = Error404Module;
}
