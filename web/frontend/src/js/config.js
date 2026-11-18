// ═══════════════════════════════════════════════════════════════════════════════
// config.js — Configuración de entorno de Talento 360
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  // Si ya se definió globalmente, no sobreescribir
  if (window.TALENTO360_API_URL !== undefined) return;

  function isLocalOrIntranetHost(hostname) {
    if (!hostname) return true;
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
      return true;
    }
    if (host.endsWith('.local') || !host.includes('.')) {
      return true;
    }
    // Redes privadas IPv4 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    const match172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) return true;
    return false;
  }

  // 1. Override manual guardado en localStorage (útil para pruebas o diagnóstico)
  const storedApiUrl = localStorage.getItem('TALENTO360_API_URL');
  if (storedApiUrl) {
    window.TALENTO360_API_URL = storedApiUrl.replace(/\/+$/, '');
    return;
  }

  // 2. Variable pública inyectada en Vercel / CI (API_BASE_URL)
  const buildEnvUrl =
    window.__TALENTO360_ENV__ &&
    typeof window.__TALENTO360_ENV__.API_BASE_URL === 'string'
      ? window.__TALENTO360_ENV__.API_BASE_URL.trim()
      : '';
  if (buildEnvUrl && /^https?:\/\//i.test(buildEnvUrl)) {
    window.TALENTO360_API_URL = buildEnvUrl.replace(/\/+$/, '');
    return;
  }

  // 3. Entorno local / Docker Compose / Red interna (Nginx reverse proxy '/api/...')
  if (isLocalOrIntranetHost(window.location.hostname)) {
    window.TALENTO360_API_URL = '';
    return;
  }

  // 4. Fallback cloud en producción (Render API Gateway)
  window.TALENTO360_API_URL = 'https://talento360-backend.onrender.com';
})();
