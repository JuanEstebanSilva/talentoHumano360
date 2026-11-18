#!/usr/bin/env node
// Genera web/frontend/src/js/env.js con configuración pública de entorno (sin secretos)
const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../web/frontend/src/js/env.js');
const rawApiUrl = (process.env.API_BASE_URL || process.env.TALENTO360_API_URL || '').trim().replace(/\/+$/, '');

// Validación estricta: solo URL pública http(s); nunca escribir cadenas de conexión ni secretos
const safeApiUrl = /^https?:\/\/[^/\s]+/i.test(rawApiUrl) ? rawApiUrl : '';

const lines = [
  '// Archivo generado automáticamente en tiempo de build (Vercel / CI).',
  '// Contiene únicamente parámetros públicos no sensibles para el navegador.',
  safeApiUrl
    ? `window.__TALENTO360_ENV__ = Object.freeze({ API_BASE_URL: ${JSON.stringify(safeApiUrl)} });`
    : 'window.__TALENTO360_ENV__ = window.__TALENTO360_ENV__ || {};',
  '',
];

fs.writeFileSync(targetPath, lines.join('\n'), 'utf8');
console.log(
  safeApiUrl
    ? `[build-frontend-env] API_BASE_URL inyectada en env.js: ${safeApiUrl}`
    : '[build-frontend-env] API_BASE_URL no definida; usando resolución automática de config.js.'
);
