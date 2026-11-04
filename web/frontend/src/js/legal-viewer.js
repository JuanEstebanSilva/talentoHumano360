/**
 * ═══════════════════════════════════════════════════════════════════════════
 * legal-viewer.js — Controlador de Accesibilidad, Tipografía y Navegación
 * Funciona de manera 100% autónoma para vistas normativas públicas
 * (Términos, Privacidad y Accesibilidad), sin requerir autenticación previa.
 * Gobernación de Boyacá · Talento 360
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  const THEME_KEY = 'talento360_theme';
  const FONT_SCALE_KEY = 'talento360_legal_font_scale';
  const SCALES = [0.9, 1.0, 1.15, 1.25];
  let currentScaleIndex = 1; // 1.0 = 100% por defecto

  /**
   * 1. Inicialización y Gestión del Tema (Claro / Oscuro)
   */
  function initTheme() {
    let savedTheme = 'light';
    try {
      savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    } catch (_) {}

    applyTheme(savedTheme);

    const themeToggleBtn = document.getElementById('btn-legal-theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch (_) {}
      });
    }
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    updateThemeButton(theme);
  }

  function updateThemeButton(theme) {
    const btn = document.getElementById('btn-legal-theme-toggle');
    if (!btn) return;
    const isDark = theme === 'dark';
    btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    btn.setAttribute('title', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');

    const label = btn.querySelector('.theme-label');
    if (label) label.textContent = isDark ? 'Modo Claro' : 'Modo Oscuro';

    const iconSun = btn.querySelector('.icon-sun');
    const iconMoon = btn.querySelector('.icon-moon');
    if (iconSun && iconMoon) {
      iconSun.style.display = isDark ? 'inline-block' : 'none';
      iconMoon.style.display = isDark ? 'none' : 'inline-block';
    }
  }

  /**
   * 2. Ajuste del Tamaño de Letra / Tipografía Accesible
   */
  function initFontScaling() {
    try {
      const savedScale = parseFloat(localStorage.getItem(FONT_SCALE_KEY));
      if (!isNaN(savedScale)) {
        const idx = SCALES.indexOf(savedScale);
        if (idx !== -1) currentScaleIndex = idx;
      }
    } catch (_) {}

    applyFontScale();

    document.getElementById('btn-font-dec')?.addEventListener('click', () => {
      if (currentScaleIndex > 0) {
        currentScaleIndex--;
        saveAndApplyFontScale();
      }
    });

    document.getElementById('btn-font-reset')?.addEventListener('click', () => {
      currentScaleIndex = 1;
      saveAndApplyFontScale();
    });

    document.getElementById('btn-font-inc')?.addEventListener('click', () => {
      if (currentScaleIndex < SCALES.length - 1) {
        currentScaleIndex++;
        saveAndApplyFontScale();
      }
    });
  }

  function saveAndApplyFontScale() {
    const scale = SCALES[currentScaleIndex];
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(scale));
    } catch (_) {}
    applyFontScale();
  }

  function applyFontScale() {
    const scale = SCALES[currentScaleIndex];
    document.documentElement.style.setProperty('--legal-font-scale', String(scale));

    const indicator = document.getElementById('font-scale-indicator');
    if (indicator) {
      const pct = Math.round(scale * 100);
      indicator.textContent = `${pct}%`;
    }

    const btnDec = document.getElementById('btn-font-dec');
    const btnInc = document.getElementById('btn-font-inc');
    if (btnDec) btnDec.disabled = (currentScaleIndex === 0);
    if (btnInc) btnInc.disabled = (currentScaleIndex === SCALES.length - 1);
  }

  /**
   * 3. Navegación Inteligente y Botón de Retorno
   */
  function initNavigation() {
    const backBtn = document.getElementById('btn-legal-back');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Si hay historial dentro del mismo origen, retroceder normalmente
        if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
          window.history.back();
        } else {
          // Fallback seguro: comprobar si hay sesión guardada
          let isLoggedIn = false;
          try {
            const token = localStorage.getItem('h360_token') || localStorage.getItem('talento360_token');
            isLoggedIn = Boolean(token);
          } catch (_) {}
          window.location.href = isLoggedIn ? '../#/dashboard' : '../';
        }
      });
    }

    const printBtn = document.getElementById('btn-legal-print');
    if (printBtn) {
      printBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.print();
      });
    }
  }

  // Inicialización segura
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      initFontScaling();
      initNavigation();
    });
  } else {
    initTheme();
    initFontScaling();
    initNavigation();
  }
})();

