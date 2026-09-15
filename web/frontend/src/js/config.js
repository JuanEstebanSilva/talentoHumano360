// ═══════════════════════════════════════════════════════════════════════════════
// config.js — Configuración de entorno de Talento 360
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  // Si ya se definió globalmente, no sobreescribir
  if (window.TALENTO360_API_URL !== undefined) return;

  // 1. Verificar si hay una URL guardada en localStorage (útil para pruebas dinámicas)
  const storedApiUrl = localStorage.getItem('TALENTO360_API_URL');
  if (storedApiUrl) {
    window.TALENTO360_API_URL = storedApiUrl.replace(/\/+$/, '');
    return;
  }

  // 2. URL de producción del backend (ej: Render, Railway, etc.)
  // IMPORTANTE: Cuando despliegues tu backend en Render, pega tu URL aquí:
  // Ejemplo: window.TALENTO360_API_URL = 'https://talento360-backend.onrender.com';
  // Si se deja vacío (''), se usarán rutas relativas '/api/...' (modo local / Docker).
  window.TALENTO360_API_URL = '';
})();
