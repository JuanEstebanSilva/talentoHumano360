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

  function goDashboard() {
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.click();
    window.location.hash = 'dashboard';
    if (typeof App !== 'undefined' && App.navigate) {
      App.navigate('dashboard');
    }
  }

  function goBack() {
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.click();
    if (window.history.length > 1) {
      window.history.back();
      setTimeout(() => {
        const currentHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
        if (currentHash === '404' || currentHash.startsWith('sst')) {
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
      <div class="module-enter error-404-container">
        
        <!-- Contenido Central Dividido en Dos Secciones -->
        <div class="error-404-layout">

          <!-- Columna Izquierda: Medallón Escudo de Boyacá, Logos y Marca de Agua 404 -->
          <div class="error-404-left-section">
            <!-- Marca de agua 404 gigante -->
            <div class="error-404-huge-watermark" aria-hidden="true">404</div>

            <!-- Medallón Dorado Institucional -->
            <div class="error-404-gold-medal" title="Escudo Oficial de Boyacá">
              <div class="error-404-medal-inner">
                <img src="imgs/logoCondor.png" alt="Escudo de Boyacá" class="error-404-medal-seal logo-light-theme" />
                <img src="imgs/logoCondorBlanco.png" alt="Escudo de Boyacá" class="error-404-medal-seal logo-dark-theme" />
              </div>
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
                <button id="error-404-btn-dashboard" class="error-404-btn-primary" onclick="Error404Module.goDashboard()" title="Volver al Dashboard principal">
                  Volver al Dashboard
                </button>
                <button id="error-404-btn-history-back" class="error-404-btn-secondary" onclick="Error404Module.goBack()" title="Regresar a la página previa">
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
    const btnDash = rootEl.querySelector('#error-404-btn-dashboard');
    if (btnDash) {
      btnDash.addEventListener('click', (e) => {
        e.preventDefault();
        goDashboard();
      });
    }

    const btnBack = rootEl.querySelector('#error-404-btn-history-back');
    if (btnBack) {
      btnBack.addEventListener('click', (e) => {
        e.preventDefault();
        goBack();
      });
    }
  }

  async function render(container, requestedModule = '404', errorMessage = '') {
    const oldOverlay = document.getElementById('error-screen-404');
    if (oldOverlay) {
      oldOverlay.style.display = 'none';
      oldOverlay.innerHTML = '';
    }

    const appEl = document.getElementById('app');
    if (appEl && appEl.style.display === 'none') {
      appEl.style.display = 'grid';
    }
    document.body.classList.remove('error-404-active');

    const targetContainer = container || document.getElementById('module-container');
    if (!targetContainer) return;

    targetContainer.innerHTML = buildHtml(requestedModule, errorMessage);
    bindEvents(targetContainer);
  }

  return {
    render,
    goDashboard,
    goBack,
    hideFullScreen: () => {
      const oldOverlay = document.getElementById('error-screen-404');
      if (oldOverlay) oldOverlay.style.display = 'none';
      const appEl = document.getElementById('app');
      if (appEl && appEl.style.display === 'none') appEl.style.display = 'grid';
      document.body.classList.remove('error-404-active');
    }
  };
})();

if (typeof window !== 'undefined') {
  window.Error404Module = Error404Module;
}
