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

  // 2. En la red local el backend está en el mismo origen (Nginx del Docker Compose): rutas relativas '/api/...'.
  //    Cubre localhost, direcciones IP (p. ej. http://192.168.1.20) y nombres de equipo sin dominio o .local.
  const host = window.location.hostname;
  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const isIPv6 = host.includes(':') || host.startsWith('[');
  const isLocalName = host !== '' && (!host.includes('.') || host.endsWith('.local'));
  if (host === 'localhost' || isIPv4 || isIPv6 || isLocalName) {
    window.TALENTO360_API_URL = '';
    return;
  }

  // 3. URL de producción en la nube (Render)
  window.TALENTO360_API_URL = 'https://talento360-backend.onrender.com';
})();
