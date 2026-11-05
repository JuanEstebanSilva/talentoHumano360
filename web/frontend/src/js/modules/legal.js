/* ═══════════════════════════════════════════════════════════════════════════
   legal.js — Módulo de Cumplimiento Legal, Habeas Data y Consentimiento
   Gobernación de Boyacá — Talento 360
   ═══════════════════════════════════════════════════════════════════════════ */

const LegalModule = (() => {
  const STORAGE_KEY = 'talento360_legal_consent';
  const LEGAL_VERSION = '2026.4'; // Versión actualizada para verificación obligatoria en login

  /**
   * Limpia el consentimiento guardado (útil para auditoría, pruebas y cierre de sesión).
   */
  function clearConsent() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  /**
   * Verifica si el usuario actual ha aceptado la versión vigente de las políticas.
   */
  function hasAcceptedLegal() {
    try {
      const consentStr = localStorage.getItem(STORAGE_KEY);
      if (!consentStr) return false;
      const consent = JSON.parse(consentStr);
      return Boolean(consent && consent.accepted === true && consent.version === LEGAL_VERSION);
    } catch (_) {
      return false;
    }
  }

  /**
   * Guarda el consentimiento formal en el almacenamiento local.
   */
  function recordConsent() {
    const user = (typeof Auth !== 'undefined' && Auth.getUser()) || {};
    const consentPayload = {
      accepted: true,
      version: LEGAL_VERSION,
      timestamp: new Date().toISOString(),
      username: user.username || 'servidor_publico',
      ipPlataforma: window.location.hostname
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consentPayload));
    } catch (e) {
      console.warn('[Talento 360 Legal] Error persistiendo consentimiento:', e);
    }
  }

  /**
   * Despliega el modal bloqueante de consentimiento obligatorio.
   * Proporciona retroalimentación interactiva asertiva cuando el usuario intenta continuar sin marcar la casilla.
   */
  function requireConsentModal(onSuccessCallback) {
    if (hasAcceptedLegal()) {
      if (typeof onSuccessCallback === 'function') onSuccessCallback();
      return;
    }

    // Remover cualquier instancia previa
    document.getElementById('talento360-consent-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'talento360-consent-modal';
    overlay.className = 'consent-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'consent-modal-title');

    overlay.innerHTML = `
      <div class="consent-modal-box">
        <div class="consent-modal-header">
          <div class="consent-modal-header-left">
            <img src="imgs/logoCondor.png" alt="Escudo de Boyacá" class="consent-modal-header-icon" />
            <div class="consent-modal-header-titles">
              <span class="consent-modal-institution">GOBERNACIÓN DE BOYACÁ</span>
              <h2 id="consent-modal-title" class="consent-modal-title">Compromiso de Confidencialidad y Uso Institucional</h2>
            </div>
          </div>
          <div class="consent-modal-header-right">
            <span class="brand-talento360 brand-talento360--header">
              <span class="brand-talento">Talento</span>
              <span class="brand-360">360</span>
            </span>
          </div>
        </div>

        <div class="consent-modal-body">
          <p class="consent-intro-text">
            Bienvenido(a) a <strong class="brand-talento360"><span class="brand-talento">Talento</span> <span class="brand-360">360</span></strong>. Para salvaguardar la reserva de la información del personal departamental, verifique las siguientes condiciones normativas antes de continuar:
          </p>

          <div class="consent-summary-grid">
            <div class="consent-summary-card">
              <div class="consent-summary-card-title">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>Habeas Data</span>
              </div>
              <span>Protección estricta de datos personales y sensibles (Ley 1581 de 2012).</span>
            </div>

            <div class="consent-summary-card">
              <div class="consent-summary-card-title">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Credenciales</span>
              </div>
              <span>Acceso de uso personal, confidencial e intransferible para el servidor público.</span>
            </div>

            <div class="consent-summary-card">
              <div class="consent-summary-card-title">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
                <span>Responsabilidad</span>
              </div>
              <span>Sujeto al régimen disciplinario (Ley 1952/2019) y penal (Ley 1273/2009).</span>
            </div>
          </div>

          <p style="margin: 0.75rem 0 0.35rem 0; font-size: 0.86rem; font-weight: 700; color: var(--text-main, #0f172a);">
            Documentación institucional de consulta obligatoria:
          </p>
          <div class="consent-doc-links-bar">
            <a href="views/terminos.html" target="_blank" class="consent-pill-link" title="Abrir Términos y Condiciones en nueva pestaña">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>Términos y Condiciones</span>
            </a>
            <a href="views/privacidad.html" target="_blank" class="consent-pill-link" title="Abrir Política de Privacidad en nueva pestaña">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>Política de Privacidad y Habeas Data</span>
            </a>
            <a href="views/accesibilidad.html" target="_blank" class="consent-pill-link" title="Abrir Declaración de Accesibilidad en nueva pestaña">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="10" r="3"/>
                <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
              </svg>
              <span>Accesibilidad Digital</span>
            </a>
          </div>

          <div class="consent-checkbox-card" id="consent-checkbox-card">
            <label class="consent-checkbox-label" for="chk-legal-accept">
              <input type="checkbox" id="chk-legal-accept" class="consent-checkbox-input" />
              <div>
                <span class="consent-checkbox-title">He leído, comprendo y acepto en su totalidad los Términos de Uso y la Política de Tratamiento de Datos Personales.</span>
                <span class="consent-checkbox-sub">Requisito obligatorio para operar en la plataforma y acceder a los módulos de gestión.</span>
              </div>
            </label>
            <div id="consent-validation-msg" class="consent-validation-msg" role="alert">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span>Debe marcar la casilla de verificación para confirmar que acepta las condiciones antes de continuar.</span>
            </div>
          </div>
        </div>

        <div class="consent-modal-footer">
          <button type="button" class="btn btn-secondary" id="btn-consent-decline">Cerrar Sesión</button>
          <button type="button" class="btn btn-consent-accept" id="btn-consent-accept">Aceptar y Continuar →</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const chk = document.getElementById('chk-legal-accept');
    const card = document.getElementById('consent-checkbox-card');
    const valMsg = document.getElementById('consent-validation-msg');
    const btnAccept = document.getElementById('btn-consent-accept');
    const btnDecline = document.getElementById('btn-consent-decline');

    // Manejador de cambio en la casilla
    chk.addEventListener('change', () => {
      if (chk.checked) {
        card.classList.remove('consent-card-error');
        card.classList.add('consent-card-success');
        valMsg.style.display = 'none';
        btnAccept.classList.add('btn-pulse-ready');
      } else {
        card.classList.remove('consent-card-success');
        btnAccept.classList.remove('btn-pulse-ready');
      }
    });

    // Manejador de clic en Continuar
    btnAccept.addEventListener('click', () => {
      if (!chk.checked) {
        // Enfoque y animación asertiva para que el usuario comprenda de inmediato qué falta
        card.classList.add('consent-card-error');
        card.classList.remove('consent-card-success');
        valMsg.style.display = 'flex';
        chk.focus();

        // Asegurar que el mensaje y casilla queden visibles
        try {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (_) {}

        // Efecto visual de vibración
        card.classList.remove('animate-shake');
        void card.offsetWidth; // Forzar reflow para reiniciar animación
        card.classList.add('animate-shake');

        if (typeof FX !== 'undefined' && FX.Sound && FX.Sound.error) {
          try { FX.Sound.error(); } catch (_) {}
        }
        return;
      }

      // Consentimiento otorgado con éxito
      recordConsent();
      overlay.remove();

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Compromiso normativo aceptado. Bienvenido(a) a Talento 360.', 'success');
      }
      if (typeof onSuccessCallback === 'function') {
        onSuccessCallback();
      }
    });

    // Manejador de declinar / salir
    btnDecline.addEventListener('click', () => {
      overlay.remove();
      if (typeof Auth !== 'undefined') Auth.clear();
      if (typeof App !== 'undefined' && App.showLogin) {
        App.showLogin();
        if (App.showToast) {
          App.showToast('Debe aceptar las políticas institucionales para operar en la plataforma.', 'warning');
        }
      }
    });
  }

  /**
   * Renderizador SPA dinámico dentro del contenedor principal de la aplicación.
   * Permite navegar a #/privacidad, #/terminos o #/accesibilidad sin recargar la página.
   */
  async function render(container, viewName) {
    if (!container) return;

    const fileMap = {
      privacidad: 'views/privacidad.html',
      terminos: 'views/terminos.html',
      accesibilidad: 'views/accesibilidad.html'
    };

    const targetUrl = fileMap[viewName] || fileMap.privacidad;

    container.innerHTML = `
      <div style="padding: 3rem; text-align: center;">
        <div class="btn-loader" style="display:inline-flex; align-items:center; gap:0.5rem; color:var(--color-primary);">
          <svg class="spin" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span>Cargando documento normativo institucional...</span>
        </div>
      </div>
    `;

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error(`No se pudo cargar el documento: ${response.statusText}`);
      const fullHtml = await response.text();

      // Extraer únicamente el contenido del <main> para integrarlo armónicamente en la SPA
      const parser = new DOMParser();
      const doc = parser.parseFromString(fullHtml, 'text/html');
      const mainContent = doc.querySelector('main')?.innerHTML || fullHtml;

      container.innerHTML = `
        <div class="module-enter legal-embedded-container" style="max-width: 1040px; margin: 0 auto; padding: 1rem 0 2rem 0;">
          ${mainContent}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="card" style="padding: 2rem; border-left: 4px solid var(--color-danger, #e32431); max-width: 800px; margin: 2rem auto;">
          <h3>Error al cargar el documento legal</h3>
          <p>${err.message}</p>
          <a href="${targetUrl}" target="_blank" class="btn btn-outline" style="margin-top:1rem;">Abrir vista directa</a>
        </div>
      `;
    }
  }

  return {
    hasAcceptedLegal,
    requireConsentModal,
    recordConsent,
    clearConsent,
    render
  };
})();

// Exposición en el contexto global
window.LegalModule = LegalModule;
