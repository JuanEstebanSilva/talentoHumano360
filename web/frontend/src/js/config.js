// ═══════════════════════════════════════════════════════════════════════════════
// config.js — Configuración de entorno de Talento 360
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  // Si ya se definió globalmente, no sobreescribir
  if (window.TALENTO360_API_URL !== undefined) return;

  // 1. Si hay una URL guardada en localStorage (para pruebas dinámicas o pruebas manuales)
  const storedApiUrl = localStorage.getItem('TALENTO360_API_URL');
  if (storedApiUrl) {
    window.TALENTO360_API_URL = storedApiUrl.replace(/\/+$/, '');
    return;
  }

  // 2. Si se está ejecutando en localhost / Docker Compose local, usar rutas relativas '/api/...'
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.TALENTO360_API_URL = '';
    return;
  }

  // 3. URL de producción en la nube (Render)
  window.TALENTO360_API_URL = 'https://talento360-backend.onrender.com';
})();
