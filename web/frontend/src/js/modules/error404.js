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
            
            <!-- Escenario Visual 404 + Cóndor (Caja visual autocontenida que nunca se solapa) -->
            <div class="error-404-visual-stage">
              <!-- Marca de agua 404 gigante -->
              <div class="error-404-huge-watermark" aria-hidden="true">404</div>

              <!-- Escudo Oficial de Boyacá (Asset Oficial Limpio centrado en el 0) -->
              <div class="error-404-escudo-wrapper" title="Escudo Oficial del Departamento de Boyacá">
                <img src="imgs/logoCondor.png" alt="Escudo de Boyacá" class="error-404-escudo-img logo-light-theme" />
                <img src="imgs/logoCondorBlanco.png" alt="Escudo de Boyacá" class="error-404-escudo-img logo-dark-theme" />
              </div>
            </div>

            <!-- Identidad Secretaría General y Talento 360 (Ubicada limpiamente DEBAJO del 404 sin tocarlo) -->
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
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:8px; display:inline-block; vertical-align:middle;">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  <span>Volver al Dashboard</span>
                </button>
                <button id="error-404-btn-history-back" class="error-404-btn-secondary" type="button" onclick="Error404Module.goBack()" title="Regresar a la página previa">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:8px; display:inline-block; vertical-align:middle;">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                  <span>Página Anterior</span>
                </button>
                <button id="error-404-btn-report" class="error-404-btn-report" type="button" onclick="Error404Module.report()" title="Reportar este incidente al administrador del sistema">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:8px; display:inline-block; vertical-align:middle;">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                    <line x1="4" y1="22" x2="4" y2="15"></line>
                  </svg>
                  <span id="error-404-report-text">Reportar</span>
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

  async function report() {
    safeFxClick();
    const btn = document.getElementById('error-404-btn-report');
    const textEl = document.getElementById('error-404-report-text');
    if (btn) btn.disabled = true;
    if (textEl) textEl.textContent = 'Reportando...';

    try {
      let currentUsername = 'Anónimo';
      try {
        const uStr = localStorage.getItem('h360_user');
        if (uStr) {
          const u = JSON.parse(uStr);
          currentUsername = u.username || u.name || 'Usuario';
        }
      } catch (_) {}

      const currentRoute = (window.location.hash || '').replace(/^#\/?/, '').trim() || '404';

      if (typeof API !== 'undefined' && API.reportError) {
        await API.reportError({
          tipo: 'PAGE_404',
          mensaje: `Reporte voluntario de usuario: Ruta o recurso no encontrado en #${currentRoute}`,
          url: window.location.href,
          usuario: currentUsername,
          reportadoPorUsuario: true
        });
      }

      if (textEl) textEl.textContent = '¡Reportado!';
      if (btn) {
        btn.classList.add('reported-success');
        btn.style.setProperty('background-color', '#355833', 'important');
        btn.style.setProperty('color', '#ffffff', 'important');
        btn.style.setProperty('border-color', '#355833', 'important');
      }

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Incidencia reportada con éxito a la administración.', 'success');
      }
    } catch (e) {
      if (textEl) textEl.textContent = 'Reportar';
      if (btn) btn.disabled = false;
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('No se pudo enviar el reporte.', 'error');
      }
    }
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

    const btnReport = rootEl.querySelector('#error-404-btn-report');
    if (btnReport) {
      btnReport.onclick = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        report();
      };
    }
  }

  function show(requestedModule = '404', errorMessage = '') {
    const overlay = document.getElementById('error-screen-404');
    if (!overlay) return;

    // Reporte automático al administrador en segundo plano
    try {
      let currentUsername = 'Anónimo';
      try {
        const uStr = localStorage.getItem('h360_user');
        if (uStr) {
          const u = JSON.parse(uStr);
          currentUsername = u.username || u.name || 'Usuario';
        }
      } catch (_) {}

      if (typeof API !== 'undefined' && API.reportError) {
        API.reportError({
          tipo: 'PAGE_404',
          mensaje: `Acceso a ruta inexistente o no disponible: #${requestedModule || '404'}${errorMessage ? ` - ${errorMessage}` : ''}`,
          url: window.location.href,
          usuario: currentUsername,
          reportadoPorUsuario: false
        });
      }
    } catch (_) {}

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
    report,
    hideFullScreen: hide
  };
})();

if (typeof window !== 'undefined') {
  window.Error404Module = Error404Module;
}
