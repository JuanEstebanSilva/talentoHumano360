/* ═══════════════════════════════════════════════════════════════════════════
   legal.js — Módulo de Cumplimiento Legal, Habeas Data y Consentimiento
   Gobernación de Boyacá · Talento 360
   ═══════════════════════════════════════════════════════════════════════════ */

const LegalModule = (() => {
  const STORAGE_KEY = 'talento360_legal_consent';
  const LEGAL_VERSION = '2026.1'; // Incrementable ante actualizaciones de políticas

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
      username: user.username || 'invitado',
      ipPlataforma: window.location.hostname
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consentPayload));
  }

  /**
   * Despliega el modal bloqueante de consentimiento obligatorio.
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
          <svg class="consent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          <div>
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.08em; opacity:0.85;">Gobernación de Boyacá</span>
            <h2 id="consent-modal-title" class="consent-modal-title">Términos de Uso y Tratamiento de Datos Personales</h2>
          </div>
        </div>

        <div class="consent-modal-body">
          <p>
            Bienvenido al Sistema de Gestión de Talento Humano <strong>Talento 360</strong>. Para continuar y acceder a las herramientas institucionales, usted debe conocer y autorizar el tratamiento de su información:
          </p>

          <div class="consent-legal-highlight">
            <strong>Tratamiento de Datos Sensibles (Ley 1581 de 2012):</strong>
            Esta plataforma almacena y gestiona información médica ocupacional (EMO), valoraciones epidemiológicas de Seguridad y Salud en el Trabajo (SST), perfiles sociodemográficos, asignaciones salariales y novedades administrativas exclusivamente para la función pública de la entidad.
          </div>

          <p>
            Al ingresar, usted se compromete a mantener estricta confidencialidad sobre sus credenciales de acceso y asume la responsabilidad disciplinaria (Ley 1952 de 2019) y penal (Ley 1273 de 2009) por cualquier consulta o transacción indebida.
          </p>

          <p style="margin-top:0.75rem; margin-bottom:0.4rem; font-weight:600;">
            Documentos institucionales de consulta obligatoria:
          </p>
          <ul style="margin: 0.25rem 0 1rem 0; padding-left: 1.25rem; font-size: 0.9rem;">
            <li style="margin-bottom: 0.35rem;">
              <a href="views/privacidad.html" target="_blank" class="consent-link">Política de Tratamiento de Datos Personales (Habeas Data)</a>
            </li>
            <li style="margin-bottom: 0.35rem;">
              <a href="views/terminos.html" target="_blank" class="consent-link">Términos y Condiciones de Uso del Servidor Público</a>
            </li>
            <li style="margin-bottom: 0.35rem;">
              <a href="views/accesibilidad.html" target="_blank" class="consent-link">Declaración de Accesibilidad Web (WCAG 2.1 AA)</a>
            </li>
          </ul>

          <div class="consent-checkbox-wrap">
            <label class="consent-label" for="chk-legal-accept">
              <input type="checkbox" id="chk-legal-accept" />
              <span>He leído, comprendo y acepto en su totalidad la Política de Tratamiento de Datos Personales y los Términos de Uso de Talento 360.</span>
            </label>
          </div>
        </div>

        <div class="consent-modal-footer">
          <button type="button" class="btn btn-secondary" id="btn-consent-decline">Cerrar Sesión</button>
          <button type="button" class="btn btn-primary" id="btn-consent-accept" disabled>Aceptar y Continuar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const chk = document.getElementById('chk-legal-accept');
    const btnAccept = document.getElementById('btn-consent-accept');
    const btnDecline = document.getElementById('btn-consent-decline');

    chk.addEventListener('change', () => {
      btnAccept.disabled = !chk.checked;
    });

    btnAccept.addEventListener('click', () => {
      recordConsent();
      overlay.remove();
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Consentimiento normativo registrado con éxito.', 'success');
      }
      if (typeof onSuccessCallback === 'function') {
        onSuccessCallback();
      }
    });

    btnDecline.addEventListener('click', () => {
      overlay.remove();
      if (typeof Auth !== 'undefined') Auth.clear();
      if (typeof App !== 'undefined' && App.showLogin) {
        App.showLogin();
        App.showToast('Debe aceptar las políticas institucionales para operar en la plataforma.', 'warning');
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
          <span>Cargando documento normativo oficial...</span>
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
        <div class="module-enter legal-embedded-container" style="max-width: 1000px; margin: 0 auto; padding: 1.5rem 0;">
          ${mainContent}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="card" style="padding: 2rem; border-left: 4px solid var(--color-danger, #e32431);">
          <h3>Error al cargar el documento legal</h3>
          <p>${err.message}</p>
          <a href="${targetUrl}" target="_blank" class="btn btn-outline" style="margin-top:1rem;">Abrir vista estática directa</a>
        </div>
      `;
    }
  }

  return {
    hasAcceptedLegal,
    requireConsentModal,
    recordConsent,
    render
  };
})();

// Exposición en el contexto global
window.LegalModule = LegalModule;
