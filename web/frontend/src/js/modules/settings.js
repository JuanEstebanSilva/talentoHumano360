/* ═══════════════════════════════════════════════════════════════════════════
   settings.js — Talento 360 Configuration & Preferences System
   Persistent settings manager + SettingsModule UI
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Settings Service (Singleton) ───────────────────────────────────────────
const Settings = (() => {
  const STORAGE_KEY = 'talento360_user_settings';

  const DEFAULTS = {
    fontSize: 'medium',            // 'small' | 'medium' | 'large'
    theme: 'light',                // 'light' | 'dark'
    soundEnabled: true,            // boolean
    notificationsEnabled: true,    // boolean (master)
    notifySuccess: true,           // boolean
    notifyWarning: true,           // boolean
    notifyError: true,             // boolean
    notifyInfo: true,              // boolean
    highContrast: false,           // boolean
    reduceMotion: false,           // boolean
    density: 'normal',             // 'compact' | 'normal' | 'comfortable'
    tablePageSize: 10,             // number: 5..100 (predeterminado: 10)
    language: 'es',                // 'es'
  };

  let _state = { ...DEFAULTS };
  let _activeUsername = null;

  function _resolveUsername(overrideUsername) {
    if (overrideUsername && typeof overrideUsername === 'string' && overrideUsername.trim()) {
      return overrideUsername.trim().toLowerCase();
    }
    if (_activeUsername) {
      return _activeUsername;
    }
    try {
      const userStr = localStorage.getItem('h360_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u && u.username && typeof u.username === 'string') {
          return u.username.trim().toLowerCase();
        }
      }
    } catch (e) {}
    return null;
  }

  function _getStorageKey(username) {
    const u = _resolveUsername(username);
    if (u) {
      return `talento360_settings_${u}`;
    }
    return STORAGE_KEY;
  }

  // Load state from localStorage with fallback to defaults
  function _load(username) {
    const user = _resolveUsername(username);
    if (user) _activeUsername = user;
    const key = _getStorageKey(user);
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.theme === 'system') parsed.theme = 'light';
        _state = { ...DEFAULTS, ...parsed };
      } else {
        _state = { ...DEFAULTS };
      }
    } catch (e) {
      console.warn('[Settings] Failed to parse saved settings, using defaults.', e);
      _state = { ...DEFAULTS };
    }
  }

  // Persist current state to localStorage under the active user's key
  function _save() {
    const key = _getStorageKey();
    try {
      localStorage.setItem(key, JSON.stringify(_state));
    } catch (e) {
      console.warn('[Settings] Failed to save settings to localStorage.', e);
    }
  }

  // Apply Font Size to DOM (scalable via root font-size)
  function applyFontSize(size) {
    const valid = ['small', 'medium', 'large'].includes(size) ? size : 'medium';
    _state.fontSize = valid;
    document.documentElement.setAttribute('data-font-size', valid);
  }

  // Apply Theme to DOM (strictly light or dark)
  function applyTheme(theme) {
    const valid = theme === 'dark' ? 'dark' : 'light';
    _state.theme = valid;
    document.documentElement.setAttribute('data-theme', valid);
    document.documentElement.setAttribute('data-theme-setting', valid);

    // Update meta theme-color for mobile header (using corporate tones)
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', valid === 'dark' ? '#14171d' : '#287522');
    }

    // Update Favicon based on theme
    const favicon = document.getElementById('app-favicon') || document.querySelector('link[rel="icon"]');
    if (favicon) {
      favicon.setAttribute('href', valid === 'dark' ? 'imgs/logoCondorBlanco.png' : 'imgs/logoCondor.png');
    }

    // Sync Topbar Quick Controls (theme toggle button)
    if (typeof App !== 'undefined' && App.updateTopbarQuickControls) {
      App.updateTopbarQuickControls();
    }
  }

  // Apply High Contrast
  function applyHighContrast(enabled) {
    _state.highContrast = !!enabled;
    if (_state.highContrast) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
    } else {
      document.documentElement.removeAttribute('data-high-contrast');
    }
  }

  // Apply Reduce Motion
  function applyReduceMotion(enabled) {
    _state.reduceMotion = !!enabled;
    if (_state.reduceMotion) {
      document.documentElement.setAttribute('data-reduce-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduce-motion');
    }
  }

  // Apply Density
  function applyDensity(density) {
    const valid = ['compact', 'normal', 'comfortable'].includes(density) ? density : 'normal';
    _state.density = valid;
    document.documentElement.setAttribute('data-density', valid);
  }

  // Apply all current settings to document
  function applyAll() {
    applyFontSize(_state.fontSize);
    applyTheme(_state.theme);
    applyHighContrast(_state.highContrast);
    applyReduceMotion(_state.reduceMotion);
    applyDensity(_state.density);
  }

  function init() {
    _load();
    applyAll();
  }

  function get(key) {
    return _state[key];
  }

  function getAll() {
    return { ..._state };
  }

  const VALID_PAGE_SIZES = [10, 15, 20, 25, 30, 50];

  // Get Table Page Size with validation and fallback
  function getTablePageSize(fallback = 10) {
    const val = parseInt(_state.tablePageSize, 10);
    if (!isNaN(val) && VALID_PAGE_SIZES.includes(val)) {
      return val;
    }
    return fallback;
  }

  // Set Table Page Size with validation (strictly 10, 15, 20, 25, 30, 50)
  function setTablePageSize(size) {
    const parsed = parseInt(size, 10);
    const valid = VALID_PAGE_SIZES.includes(parsed) ? parsed : 10;
    _state.tablePageSize = valid;
    _save();
    return valid;
  }

  function set(key, value) {
    if (key === 'tablePageSize') {
      const parsed = parseInt(value, 10);
      _state.tablePageSize = VALID_PAGE_SIZES.includes(parsed) ? parsed : 10;
    } else {
      _state[key] = value;
    }
    switch (key) {
      case 'fontSize':
        applyFontSize(value);
        break;
      case 'theme':
        applyTheme(value);
        break;
      case 'highContrast':
        applyHighContrast(value);
        break;
      case 'reduceMotion':
        applyReduceMotion(value);
        break;
      case 'density':
        applyDensity(value);
        break;
    }
    _save();
  }

  function isNotificationTypeEnabled(type) {
    if (!_state.notificationsEnabled) return false;
    switch (type) {
      case 'success': return !!_state.notifySuccess;
      case 'warning': return !!_state.notifyWarning;
      case 'error':   return !!_state.notifyError;
      case 'info':    return !!_state.notifyInfo;
      default:        return true;
    }
  }

  function resetDefaults() {
    _state = { ...DEFAULTS };
    _save();
    applyAll();
  }

  function loadForUser(username) {
    if (!username) return;
    _activeUsername = String(username).trim().toLowerCase();
    _load(_activeUsername);
    applyAll();
  }

  function resetToDefaults() {
    _activeUsername = null;
    _state = { ...DEFAULTS };
    applyAll();
  }

  return {
    init,
    get,
    getAll,
    getTablePageSize,
    setTablePageSize,
    set,
    applyAll,
    applyFontSize,
    applyTheme,
    applyHighContrast,
    applyReduceMotion,
    applyDensity,
    isNotificationTypeEnabled,
    resetDefaults,
    loadForUser,
    resetToDefaults,
    DEFAULTS
  };
})();

// Immediate init on script load to avoid FOUC
Settings.init();

// ─── Settings Module View (SPA Renderer) ────────────────────────────────────
const SettingsModule = (() => {

  function render(container) {
    const s = Settings.getAll();
    const pageSizeVal = Settings.getTablePageSize(10);

    container.innerHTML = `
      <div class="module-enter settings-page">
        <!-- Header -->
        <div class="page-header">
          <div>
            <h1 class="page-title">Configuración del Sistema</h1>
            <p class="page-subtitle">Personaliza la apariencia, comportamiento y accesibilidad de Talento 360 según tus preferencias.</p>
          </div>
          <div class="page-header-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-settings" title="Volver a los valores por defecto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              <span>Restaurar configuración</span>
            </button>
          </div>
        </div>

        <div class="settings-layout">

          <!-- 1. APARIENCIA -->
          <section class="settings-card" id="settings-section-appearance">
            <div class="settings-card-header">
              <div class="settings-card-icon settings-card-icon--emerald">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              </div>
              <div>
                <h2 class="settings-card-title">Apariencia</h2>
                <p class="settings-card-desc">Controla la paleta cromática y las dimensiones tipográficas en toda la interfaz.</p>
              </div>
            </div>

            <!-- Tema -->
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-title">Tema de la aplicación</div>
                <div class="settings-item-desc">Elige entre el tema claro tradicional o el tema oscuro de alto confort visual.</div>
              </div>
              <div class="theme-picker-group">
                <button type="button" class="theme-option ${s.theme === 'light' ? 'is-active' : ''}" data-theme-val="light" id="theme-btn-light">
                  <div class="theme-preview-box theme-preview--light">
                    <span class="preview-bar"></span>
                    <div class="preview-body">
                      <span class="preview-sidebar"></span>
                      <span class="preview-content"></span>
                    </div>
                  </div>
                  <div class="theme-option-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    <span>Claro</span>
                  </div>
                </button>

                <button type="button" class="theme-option ${s.theme === 'dark' ? 'is-active' : ''}" data-theme-val="dark" id="theme-btn-dark">
                  <div class="theme-preview-box theme-preview--dark">
                    <span class="preview-bar"></span>
                    <div class="preview-body">
                      <span class="preview-sidebar"></span>
                      <span class="preview-content"></span>
                    </div>
                  </div>
                  <div class="theme-option-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    <span>Oscuro</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Tamaño de letra -->
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-title">Tamaño de letra</div>
                <div class="settings-item-desc">Ajusta proporcionalmente el tamaño de todos los textos, menús, tablas y botones de la plataforma.</div>
              </div>
              <div class="segmented-control" role="radiogroup" aria-label="Tamaño de letra">
                <button type="button" class="segmented-btn ${s.fontSize === 'small' ? 'is-active' : ''}" data-font-val="small" id="font-btn-small">
                  <span style="font-size:0.8rem;font-weight:700;">A</span>
                  <span>Pequeño</span>
                </button>
                <button type="button" class="segmented-btn ${s.fontSize === 'medium' ? 'is-active' : ''}" data-font-val="medium" id="font-btn-medium">
                  <span style="font-size:0.95rem;font-weight:700;">A</span>
                  <span>Mediano</span>
                </button>
                <button type="button" class="segmented-btn ${s.fontSize === 'large' ? 'is-active' : ''}" data-font-val="large" id="font-btn-large">
                  <span style="font-size:1.15rem;font-weight:700;">A</span>
                  <span>Grande</span>
                </button>
              </div>
            </div>
          </section>

          <!-- 2. SONIDO Y NOTIFICACIONES -->
          <section class="settings-card" id="settings-section-audio-notifications">
            <div class="settings-card-header">
              <div class="settings-card-icon settings-card-icon--gold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              </div>
              <div>
                <h2 class="settings-card-title">Sonido y Notificaciones</h2>
                <p class="settings-card-desc">Personaliza la retroalimentación auditiva y visual de las alertas del sistema.</p>
              </div>
            </div>

            <!-- Sonidos -->
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-title">Efectos de sonido de interfaz</div>
                <div class="settings-item-desc">Reproduce tonos sintetizados al navegar, confirmar acciones, abrir modales o al recibir notificaciones.</div>
              </div>
              <label class="switch-toggle" for="toggle-sound">
                <input type="checkbox" id="toggle-sound" ${s.soundEnabled ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <!-- Notificaciones maestras -->
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-title">Notificaciones visuales (Toasts)</div>
                <div class="settings-item-desc">Muestra avisos emergentes interactivos en la esquina superior derecha de la pantalla.</div>
              </div>
              <label class="switch-toggle" for="toggle-notifications">
                <input type="checkbox" id="toggle-notifications" ${s.notificationsEnabled ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <!-- Subtipos de notificación -->
            <div class="settings-subgroup ${!s.notificationsEnabled ? 'is-disabled' : ''}" id="notify-types-subgroup">
              <div class="settings-subgroup-title">Filtrar por tipo de notificación:</div>
              <div class="settings-subgrid">
                <label class="subtoggle-item" for="toggle-notify-success">
                  <div class="subtoggle-badge subtoggle-badge--success">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div class="subtoggle-text">
                    <span class="subtoggle-name">Éxito</span>
                    <span class="subtoggle-desc">Guardados, creaciones y operaciones aprobadas</span>
                  </div>
                  <input type="checkbox" id="toggle-notify-success" class="custom-checkbox" ${s.notifySuccess ? 'checked' : ''} ${!s.notificationsEnabled ? 'disabled' : ''} />
                </label>

                <label class="subtoggle-item" for="toggle-notify-warning">
                  <div class="subtoggle-badge subtoggle-badge--warning">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <div class="subtoggle-text">
                    <span class="subtoggle-name">Advertencias</span>
                    <span class="subtoggle-desc">Campos requeridos y validaciones de formulario</span>
                  </div>
                  <input type="checkbox" id="toggle-notify-warning" class="custom-checkbox" ${s.notifyWarning ? 'checked' : ''} ${!s.notificationsEnabled ? 'disabled' : ''} />
                </label>

                <label class="subtoggle-item" for="toggle-notify-error">
                  <div class="subtoggle-badge subtoggle-badge--error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  </div>
                  <div class="subtoggle-text">
                    <span class="subtoggle-name">Errores</span>
                    <span class="subtoggle-desc">Fallas del servidor o rechazos de autenticación</span>
                  </div>
                  <input type="checkbox" id="toggle-notify-error" class="custom-checkbox" ${s.notifyError ? 'checked' : ''} ${!s.notificationsEnabled ? 'disabled' : ''} />
                </label>

                <label class="subtoggle-item" for="toggle-notify-info">
                  <div class="subtoggle-badge subtoggle-badge--info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  </div>
                  <div class="subtoggle-text">
                    <span class="subtoggle-name">Informativas</span>
                    <span class="subtoggle-desc">Estados de sesión y datos contextuales</span>
                  </div>
                  <input type="checkbox" id="toggle-notify-info" class="custom-checkbox" ${s.notifyInfo ? 'checked' : ''} ${!s.notificationsEnabled ? 'disabled' : ''} />
                </label>
              </div>

              <div style="margin-top:14px;display:flex;gap:10px;align-items:center;">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-test-notification">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  <span>Probar notificación de muestra</span>
                </button>
                <span style="font-size:var(--text-xs);color:var(--text-muted);">Comprueba cómo se perciben las alertas con tu configuración actual.</span>
              </div>
            </div>
          </section>

          <!-- 3. ACCESIBILIDAD -->
          <section class="settings-card" id="settings-section-accessibility">
            <div class="settings-card-header">
              <div class="settings-card-icon settings-card-icon--blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="7" r="1"/>
                  <polyline points="12 10 12 17 9 17"/>
                  <polyline points="12 13 15 13"/>
                </svg>
              </div>
              <div>
                <h2 class="settings-card-title">Accesibilidad</h2>
                <p class="settings-card-desc">Mejoras de legibilidad visual y reducción de estímulos de movimiento.</p>
              </div>
            </div>

            <!-- Alto contraste -->
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-title">Modo de alto contraste</div>
                <div class="settings-item-desc">Aumenta la definición de bordes, intensifica la saturación de textos y resalta con nitidez los elementos seleccionados.</div>
              </div>
              <label class="switch-toggle" for="toggle-high-contrast">
                <input type="checkbox" id="toggle-high-contrast" ${s.highContrast ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <!-- Reducir animaciones -->
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-title">Reducir animaciones</div>
                <div class="settings-item-desc">Minimiza o desactiva las transiciones visuales, movimientos continuos y rebotes para mayor confort y agilidad.</div>
              </div>
              <label class="switch-toggle" for="toggle-reduce-motion">
                <input type="checkbox" id="toggle-reduce-motion" ${s.reduceMotion ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>
          </section>

          <!-- 4. INTERFAZ (DENSIDAD) -->
          <section class="settings-card" id="settings-section-density">
            <div class="settings-card-header">
              <div class="settings-card-icon settings-card-icon--purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="21" y1="6" x2="3" y2="6"/>
                  <line x1="21" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="18" x2="3" y2="18"/>
                </svg>
              </div>
              <div>
                <h2 class="settings-card-title">Densidad de la Interfaz</h2>
                <p class="settings-card-desc">Optimiza la cantidad de información visible por pantalla ajustando el espaciado de componentes y la cantidad de registros por tabla.</p>
              </div>
            </div>

            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-title">Espaciado de componentes</div>
                <div class="settings-item-desc">
                  <strong>Compacta:</strong> Máxima cantidad de filas y datos en tablas.
                  <br><strong>Normal:</strong> Balance ideal entre confort y espacio (predeterminado).
                  <br><strong>Cómoda:</strong> Espaciado amplio para lectura relajada.
                </div>
              </div>
              <div class="segmented-control" role="radiogroup" aria-label="Densidad de la interfaz">
                <button type="button" class="segmented-btn ${s.density === 'compact' ? 'is-active' : ''}" data-density-val="compact" id="density-btn-compact">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                  <span>Compacta</span>
                </button>
                <button type="button" class="segmented-btn ${s.density === 'normal' ? 'is-active' : ''}" data-density-val="normal" id="density-btn-normal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                  <span>Normal</span>
                </button>
                <button type="button" class="segmented-btn ${s.density === 'comfortable' ? 'is-active' : ''}" data-density-val="comfortable" id="density-btn-comfortable">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="19" x2="21" y2="19"/></svg>
                  <span>Cómoda</span>
                </button>
              </div>
            </div>

            <!-- Cantidad de registros por tabla (Paginación) -->
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-title">Registros por tabla</div>
                <div class="settings-item-desc">
                  Define cuántos registros se cargan por página en las tablas del sistema (Servidores Públicos, Viáticos, Horarios, Solicitudes, etc.).
                  <br><span style="font-size:var(--text-xs); color:var(--text-muted);">Valores disponibles: 10, 15, 20, 25, 30 y 50 registros por página (predeterminado: 10).</span>
                </div>
              </div>
              <div class="segmented-control" role="radiogroup" aria-label="Cantidad de registros por tabla">
                ${[10, 15, 20, 25, 30, 50].map(val => `
                  <button type="button" class="segmented-btn ${pageSizeVal === val ? 'is-active' : ''}" data-pagesize-val="${val}" id="pagesize-btn-${val}">
                    <span>${val}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          </section>

          <!-- 5. RESTABLECER CONFIGURACIÓN -->
          <section class="settings-card settings-card--danger">
            <div class="settings-card-header">
              <div class="settings-card-icon settings-card-icon--danger">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div>
                <h2 class="settings-card-title">Restaurar Valores Predeterminados</h2>
                <p class="settings-card-desc">Devuelve todas las preferencias del sistema a su configuración original de fábrica.</p>
              </div>
            </div>
            <div class="settings-item settings-item--actions">
              <div class="settings-item-info">
                <div class="settings-item-title">Restablecer todos los ajustes</div>
                <div class="settings-item-desc">Se restaurarán: Tamaño de letra (Mediano), Tema (Claro), Sonidos (Activados), Notificaciones (Todas activadas), Alto contraste (Desactivado), Reducir animaciones (Desactivado) y Densidad (Normal).</div>
              </div>
              <button type="button" class="btn btn-danger" id="btn-restore-defaults">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                <span>Restaurar configuración</span>
              </button>
            </div>
          </section>

        </div>
      </div>
    `;

    _bindEvents(container);
  }

  function _bindEvents(container) {
    // ─── Theme Picker ───────────────────────────────────────────────────────
    container.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const themeVal = btn.dataset.themeVal;
        Settings.set('theme', themeVal);

        container.querySelectorAll('.theme-option').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        if (typeof App !== 'undefined') {
          App.showToast(`Tema ${themeVal === 'dark' ? 'Oscuro' : 'Claro'} aplicado.`, 'info');
        }
      });
    });

    // ─── Font Size ──────────────────────────────────────────────────────────
    container.querySelectorAll('.segmented-btn[data-font-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.fontVal;
        Settings.set('fontSize', val);

        container.querySelectorAll('.segmented-btn[data-font-val]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        const labelMap = { small: 'Pequeño', medium: 'Mediano', large: 'Grande' };
        if (typeof App !== 'undefined') {
          App.showToast(`Tamaño de letra: ${labelMap[val]}.`, 'info');
        }
      });
    });

    // ─── Sound Toggle ───────────────────────────────────────────────────────
    const soundToggle = container.querySelector('#toggle-sound');
    if (soundToggle) {
      soundToggle.addEventListener('change', () => {
        const enabled = soundToggle.checked;
        Settings.set('soundEnabled', enabled);
        if (typeof App !== 'undefined') {
          App.showToast(enabled ? 'Sonidos de interfaz activados.' : 'Sonidos desactivados.', 'info');
        }
        if (enabled && typeof FX !== 'undefined') {
          FX.Sound.confirm();
        }
      });
    }

    // ─── Notifications Master Toggle ────────────────────────────────────────
    const notifToggle = container.querySelector('#toggle-notifications');
    const subgroup = container.querySelector('#notify-types-subgroup');
    if (notifToggle) {
      notifToggle.addEventListener('change', () => {
        const enabled = notifToggle.checked;
        Settings.set('notificationsEnabled', enabled);

        if (subgroup) {
          subgroup.classList.toggle('is-disabled', !enabled);
          subgroup.querySelectorAll('input[type="checkbox"]').forEach(inp => {
            inp.disabled = !enabled;
          });
        }

        if (typeof App !== 'undefined') {
          App.showToast(enabled ? 'Notificaciones visuales activadas.' : 'Notificaciones desactivadas.', 'info');
        }
      });
    }

    // ─── Sub-notifications ──────────────────────────────────────────────────
    const subMap = [
      { id: 'toggle-notify-success', key: 'notifySuccess', name: 'Éxito' },
      { id: 'toggle-notify-warning', key: 'notifyWarning', name: 'Advertencias' },
      { id: 'toggle-notify-error',   key: 'notifyError',   name: 'Errores' },
      { id: 'toggle-notify-info',    key: 'notifyInfo',    name: 'Informativas' },
    ];
    subMap.forEach(item => {
      const el = container.querySelector(`#${item.id}`);
      if (el) {
        el.addEventListener('change', () => {
          Settings.set(item.key, el.checked);
        });
      }
    });

    // ─── Test Notification Button ───────────────────────────────────────────
    const btnTest = container.querySelector('#btn-test-notification');
    if (btnTest) {
      btnTest.addEventListener('click', () => {
        const types = ['success', 'info', 'warning'];
        const sampleType = types[Math.floor(Math.random() * types.length)];
        const messages = {
          success: '¡Configuración verificada exitosamente!',
          warning: 'Prueba de alerta de advertencia en el sistema.',
          info: 'Notificación de prueba del módulo de Ajustes.',
        };
        if (typeof App !== 'undefined') {
          App.showToast(messages[sampleType], sampleType);
        }
      });
    }

    // ─── High Contrast Toggle ───────────────────────────────────────────────
    const hcToggle = container.querySelector('#toggle-high-contrast');
    if (hcToggle) {
      hcToggle.addEventListener('change', () => {
        const enabled = hcToggle.checked;
        Settings.set('highContrast', enabled);
        if (typeof App !== 'undefined') {
          App.showToast(enabled ? 'Modo de alto contraste activado.' : 'Modo de alto contraste desactivado.', 'info');
        }
      });
    }

    // ─── Reduce Motion Toggle ───────────────────────────────────────────────
    const rmToggle = container.querySelector('#toggle-reduce-motion');
    if (rmToggle) {
      rmToggle.addEventListener('change', () => {
        const enabled = rmToggle.checked;
        Settings.set('reduceMotion', enabled);
        if (typeof App !== 'undefined') {
          App.showToast(enabled ? 'Reducción de animaciones activada.' : 'Animaciones normales activadas.', 'info');
        }
      });
    }

    // ─── Density ────────────────────────────────────────────────────────────
    container.querySelectorAll('.segmented-btn[data-density-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.densityVal;
        Settings.set('density', val);

        container.querySelectorAll('.segmented-btn[data-density-val]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        const labelMap = { compact: 'Compacta', normal: 'Normal', comfortable: 'Cómoda' };
        if (typeof App !== 'undefined') {
          App.showToast(`Densidad de interfaz: ${labelMap[val]}.`, 'info');
        }
      });
    });

    // ─── Table Page Size (Segmented buttons: 10, 15, 20, 25, 30, 50) ─────────
    container.querySelectorAll('.segmented-btn[data-pagesize-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.pagesizeVal, 10);
        Settings.setTablePageSize(val);

        container.querySelectorAll('.segmented-btn[data-pagesize-val]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        if (typeof App !== 'undefined') {
          App.showToast(`Paginación de tablas configurada en ${val} registros por página.`, 'info');
        }
        if (typeof FX !== 'undefined' && FX.Sound) {
          FX.Sound.confirm();
        }
      });
    });

    // ─── Reset Settings Handlers ────────────────────────────────────────────
    const triggerReset = () => {
      if (typeof App === 'undefined') return;

      const modalHtml = `
        <div style="display:flex;flex-direction:column;gap:14px;padding:4px 0;">
          <div style="display:flex;align-items:flex-start;gap:14px;">
            <div style="width:44px;height:44px;border-radius:12px;background:rgba(227,36,49,0.12);color:var(--color-red);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:24px;height:24px;">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div>
              <h3 style="font-size:var(--text-base);font-weight:700;color:var(--text-primary);margin-bottom:4px;">¿Restablecer configuración predeterminada?</h3>
              <p style="font-size:var(--text-sm);color:var(--text-muted);line-height:1.5;">
                Todas las opciones volverán a sus valores de fábrica:
                <strong>Tamaño Mediano, Tema Claro, Sonidos Activados, Notificaciones Completas, Contraste y Movimiento estándar, Densidad Normal y 10 registros por tabla.</strong>
              </p>
            </div>
          </div>
        </div>
      `;

      App.openModal('Confirmar Restauración', modalHtml, [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          text: 'Sí, restaurar valores',
          cls: 'btn-danger',
          action: () => {
            Settings.resetDefaults();
            App.closeModal();
            render(container); // Re-render Settings view with defaults
            App.showToast('La configuración ha sido restaurada a los valores predeterminados.', 'success');
            if (typeof FX !== 'undefined') FX.Sound.confirm();
          }
        }
      ]);
    };

    container.querySelector('#btn-reset-settings')?.addEventListener('click', triggerReset);
    container.querySelector('#btn-restore-defaults')?.addEventListener('click', triggerReset);
  }

  return { render };
})();
