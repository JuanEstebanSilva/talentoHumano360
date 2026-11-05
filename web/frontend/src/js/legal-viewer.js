/**
 * ═══════════════════════════════════════════════════════════════════════════
 * legal-viewer.js — Controlador de Accesibilidad, Tipografía y Navegación
 * Funciona de manera 100% autónoma para vistas normativas públicas
 * (Términos, Privacidad y Accesibilidad), sin requerir autenticación previa.
 * Gobernación de Boyacá — Talento 360
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  const THEME_KEY = 'talento360_theme';
  const FONT_SCALE_KEY = 'talento360_legal_font_scale';
  const SCALES = [1.0, 1.15, 1.30, 1.45];
  let currentScaleIndex = 0; // 1.0 = 100% por defecto

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
      currentScaleIndex = 0;
      saveAndApplyFontScale();
    });

    document.getElementById('btn-font-inc')?.addEventListener('click', () => {
      currentScaleIndex = (currentScaleIndex + 1) % SCALES.length;
      saveAndApplyFontScale();
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
    document.body.style.setProperty('--legal-font-scale', String(scale));

    // Escalar directamente la tarjeta legal y sus párrafos para asegurar cambio visual inmediato
    const card = document.querySelector('.legal-card');
    if (card) {
      card.style.setProperty('--legal-font-scale', String(scale));
      card.style.fontSize = `${scale * 100}%`;
    }

    const pct = Math.round(scale * 100);
    const indicator = document.getElementById('font-scale-indicator');
    if (indicator) {
      indicator.textContent = `${pct}%`;
    }

    const btnInc = document.getElementById('btn-font-inc');
    if (btnInc) {
      btnInc.disabled = false;
      const nextIdx = (currentScaleIndex + 1) % SCALES.length;
      const nextPct = Math.round(SCALES[nextIdx] * 100);
      const titleText = (currentScaleIndex === SCALES.length - 1)
        ? `Tamaño al máximo (${pct}%). Clic para reiniciar a 100%`
        : `Aumentar tamaño de letra a ${nextPct}% (actual: ${pct}%)`;
      btnInc.setAttribute('title', titleText);
      btnInc.setAttribute('aria-label', titleText);
    }
  }

  /**
   * 3. Navegación Inteligente y Botón de Retorno al Login
   */
  function initNavigation() {
    const handleReturnToLogin = (e) => {
      e.preventDefault();

      // Si la ventana fue abierta como pestaña secundaria desde el login, enfocar ventana principal y cerrar
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.focus();
          window.close();
          // Fallback por si la política de seguridad del navegador restringe window.close()
          setTimeout(() => {
            window.location.href = '../index.html';
          }, 150);
          return;
        } catch (_) {}
      }

      // En la misma pestaña: regresar inmediatamente al Login
      window.location.href = '../index.html';
    };

    document.querySelectorAll('.legal-back-btn, #btn-legal-back').forEach(btn => {
      btn.addEventListener('click', handleReturnToLogin);
    });

    // Botón para regresar a la parte superior de la página
    const scrollTopBtn = document.getElementById('btn-scroll-top') || document.querySelector('.legal-scroll-top-btn');
    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
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

