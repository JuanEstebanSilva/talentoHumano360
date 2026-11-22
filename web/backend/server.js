// ═══════════════════════════════════════════════════════════════════════════════
// server.js — Servidor Backend Unificado / API Gateway para Talento 360
// Gobernación de Boyacá · Despliegue en Render y Soporte Integral Multiplataforma
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno locales de web/.env si no estamos en Render (sin DATABASE_URL)
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key] && key !== 'NODE_ENV') {
            process.env[key] = val;
          }
        }
      }
    } catch (_) {}
  }
  // Resolver DB_PORT automáticamente para desarrollo local (Docker usa 5434 por defecto)
  if (!process.env.DB_PORT) {
    if (process.env.POSTGRES_PORT) {
      const p = parseInt(process.env.POSTGRES_PORT.split(':')[0], 10);
      if (!isNaN(p)) process.env.DB_PORT = String(p);
    } else {
      process.env.DB_PORT = '5434';
    }
  }
}

const jwt = require('jsonwebtoken');
const { pool, initDatabase, runMigrations } = require('./scripts/init-db');

const app = express();
const PORT = process.env.PORT || 3000;

// Confianza en proxies inversos (Render, Cloudflare, Nginx) para rate limiting y headers
app.set('trust proxy', 1);

// ─── Cabeceras de Seguridad Institucional OWASP ASVS (HSTS, X-Frame-Options, etc.) ───
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.removeHeader('X-Powered-By');
  next();
});

// ─── Bloqueo Estricto de Archivos Sensibles y Traversal de Directorios ────────
app.use((req, res, next) => {
  const rawPath = req.path || '';
  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(rawPath).toLowerCase();
  } catch {
    decodedPath = rawPath.toLowerCase();
  }

  const isSensitive = 
    decodedPath.startsWith('/.') ||
    decodedPath.includes('/..') ||
    /\.(env|git|sql|bak|log|config|key|pem|crt|db|sqlite|yml|yaml|ini|sh|bat|cmd|ps1)$/i.test(decodedPath) ||
    /package(-lock)?\.json$/i.test(decodedPath) ||
    /\/docker/i.test(decodedPath);

  if (isSensitive) {
    return res.status(404).send('Not Found');
  }
  next();
});

// Configuración de CORS segura con lista de orígenes permitidos
function normalizeOrigin(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  try {
    return new URL(urlStr.trim()).origin;
  } catch {
    return urlStr.trim().replace(/\/+$/, '');
  }
}

const explicitEnvOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(normalizeOrigin).filter(Boolean)
  : [];

const configuredFrontendOrigins = [process.env.APP_PUBLIC_URL, process.env.APP_URL]
  .map(normalizeOrigin)
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost',
  'http://localhost:80',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:8080',
  'http://127.0.0.1',
  'http://127.0.0.1:80',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:8080'
];
const allowedOrigins = Array.from(new Set([
  ...defaultDevOrigins,
  ...explicitEnvOrigins,
  ...configuredFrontendOrigins,
]));
const hasStrictCors = explicitEnvOrigins.length > 0;

if (process.env.NODE_ENV === 'production' && !hasStrictCors && configuredFrontendOrigins.length === 0) {
  console.warn('[CORS] Aviso: ALLOWED_ORIGINS no está definida. Se permiten temporalmente subdominios HTTPS de Vercel/Render; defina ALLOWED_ORIGINS en Render con su dominio exacto de Vercel.');
}

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin header Origin (CLI, curl, health checks internos) o entorno dev
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const cleanOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }
    // En producción con ALLOWED_ORIGINS definida: solo permitir previews de Vercel si se habilitan explícitamente
    if (hasStrictCors) {
      if (process.env.ALLOW_VERCEL_PREVIEWS === 'true' && cleanOrigin.startsWith('https://') && cleanOrigin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS bloqueado para el origen no autorizado: ${origin}`));
    }
    // Antes de configurar ALLOWED_ORIGINS en el panel de Render, aceptar dominios HTTPS de Vercel y Render
    if (cleanOrigin.startsWith('https://') && (cleanOrigin.endsWith('.vercel.app') || cleanOrigin.endsWith('.onrender.com'))) {
      return callback(null, true);
    }
    return callback(new Error(`CORS bloqueado para el origen no autorizado: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// ─── Protección CSRF para Peticiones Mutantes (POST, PUT, PATCH, DELETE) ──────
app.use((req, res, next) => {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutatingMethods.includes(req.method)) {
    return next();
  }

  const originHeader = req.headers['origin'];
  const refererHeader = req.headers['referer'];
  const requestOrigin = originHeader ? normalizeOrigin(originHeader) : (refererHeader ? normalizeOrigin(refererHeader) : null);

  if (requestOrigin) {
    const host = req.headers.host;
    const isSameHost = host && (requestOrigin.includes(host) || requestOrigin === `http://${host}` || requestOrigin === `https://${host}`);
    const isAllowed = allowedOrigins.includes(requestOrigin) || isSameHost;

    if (!isAllowed) {
      return res.status(403).json({ error: 'Solicitud rechazada por política de seguridad CSRF (Origen no autorizado).' });
    }
  }

  next();
});

// Límite controlado para prevenir DoS por memoria permitiendo importaciones institucionales
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ─── Sanitización de Entradas y Bloqueo de Inyección de Prompts ───────────────
function sanitizeStringValue(str) {
  if (typeof str !== 'string') return str;
  // 1. Eliminar bytes nulos (\0)
  let clean = str.replace(/\0/g, '');
  // 2. Neutralizar etiquetas script y vectores XSS directos
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/javascript\s*:/gi, 'blocked-script:');
  clean = clean.replace(/on(error|load|click|mouseover)\s*=/gi, 'data-blocked=');
  // 3. Neutralizar marcadores de prompt injection
  clean = clean.replace(/(\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>|<\|im_start\|>|<\|im_end\|>)/gi, '');
  clean = clean.replace(/---\s*BEGIN\s+INSTRUCTION\s*---/gi, '');
  clean = clean.replace(/\bignore\s+(all\s+)?(previous|prior)\s+instructions\b/gi, '[instruccion_omitida]');
  return clean;
}

function sanitizeObjectRecursively(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'string') {
        obj[i] = sanitizeStringValue(obj[i]);
      } else if (typeof obj[i] === 'object' && obj[i] !== null) {
        sanitizeObjectRecursively(obj[i]);
      }
    }
    return obj;
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeStringValue(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObjectRecursively(obj[key]);
    }
  }
  return obj;
}

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    sanitizeObjectRecursively(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObjectRecursively(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeObjectRecursively(req.params);
  }
  next();
});

// ─── Servir Archivos Estáticos y Logos Institucionales (Públicos) ─────────────
const serveInstitutionalAsset = (req, res) => {
  const file = req.params.file || 'logoCondor.png';
  const safeFilename = path.basename(file);
  const searchDirs = [
    path.join(__dirname, '../services/auth-service/src/assets'),
    path.join(__dirname, '../frontend/src/imgs'),
    path.join(__dirname, 'public/imgs')
  ];
  for (const dir of searchDirs) {
    const fullPath = path.join(dir, safeFilename);
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(safeFilename).toLowerCase();
      const contentTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon'
      };
      res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(fullPath);
    }
  }
  return res.status(404).json({ error: `Asset institucional no encontrado: ${safeFilename}` });
};

app.get(['/imgs/:file', '/assets/:file', '/api/assets/:file', '/api/auth/assets/:file'], serveInstitutionalAsset);
app.get(['/imgs', '/assets'], (_, res) => res.redirect('/imgs/logoCondor.png'));

// ─── Health Checks y Diagnóstico ──────────────────────────────────────────────
app.get(['/health', '/api/health'], async (_, res) => {
  const dbConfigured = !!process.env.DATABASE_URL;
  let dbStatus = { connected: false, configured: dbConfigured };
  try {
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB connection timeout after 3000ms')), 3000))
    ]);
    try {
      const q = await client.query('SELECT NOW() as db_time, current_database() as db_name');
      dbStatus = {
        connected: true,
        dbName: q.rows[0].db_name,
        dbTime: q.rows[0].db_time,
        configured: dbConfigured
      };
    } finally {
      client.release();
    }
  } catch (err) {
    dbStatus.error = err.message;
  }

  // Render health check requiere HTTP 200 para confirmar liveness y no reiniciar el contenedor
  return res.status(200).json({
    status: 'ok',
    system: 'Talento 360 — API Gateway',
    uptime: Math.round(process.uptime()),
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/db-status', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const JWT_SECRET = process.env.JWT_SECRET || 'talento360_secret_2026';
  let authorized = false;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const role = String(decoded.role || decoded.rol || '').toLowerCase();
      if (role === 'admin' || role === 'administrador') authorized = true;
    } catch (_) {}
  }

  if (!authorized) {
    return res.status(401).json({ error: 'No autorizado. Se requiere token de sesión con rol de Administrador para consultar el estado interno de la base de datos.' });
  }

  const dbConfigured = !!process.env.DATABASE_URL;
  try {
    const client = await pool.connect();
    try {
      const dbInfo = await client.query('SELECT current_database() as db, NOW() as server_time');
      const tableCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const usersCount = await client.query('SELECT COUNT(*) as count FROM usuarios').catch(() => ({ rows: [{ count: -1 }] }));

      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'rel_principal' AND column_name IN ('encargo_denominacion', 'fecha_retiro')
      `).catch(() => ({ rows: [] }));

      const countPersonas = await client.query('SELECT count(*) FROM personas').catch(() => ({ rows: [{ count: -1 }] }));
      const countRel = await client.query('SELECT count(*) FROM rel_principal').catch(() => ({ rows: [{ count: -1 }] }));
      const countContactos = await client.query('SELECT count(*) FROM contactos').catch(() => ({ rows: [{ count: -1 }] }));
      const countEducacion = await client.query('SELECT count(*) FROM educacion').catch(() => ({ rows: [{ count: -1 }] }));
      const countEstados = await client.query('SELECT count(*) FROM estados').catch(() => ({ rows: [{ count: -1 }] }));
      const countViaticos = await client.query('SELECT count(*) FROM viaticos').catch(() => ({ rows: [{ count: -1 }] }));
      const countHorarios = await client.query('SELECT count(*) FROM horarios').catch(() => ({ rows: [{ count: -1 }] }));

      return res.json({
        status: 'connected',
        database: dbInfo.rows[0].db,
        serverTime: dbInfo.rows[0].server_time,
        totalTables: tableCheck.rows.length,
        hasUsuariosTable: tableCheck.rows.some(t => t.table_name === 'usuarios'),
        hasEncargoColumns: colCheck.rows.some(c => c.column_name === 'encargo_denominacion'),
        hasFechaRetiro: colCheck.rows.some(c => c.column_name === 'fecha_retiro'),
        counts: {
          personas: parseInt(countPersonas.rows[0].count),
          rel_principal: parseInt(countRel.rows[0].count),
          contactos: parseInt(countContactos.rows[0].count),
          educacion: parseInt(countEducacion.rows[0].count),
          estados: parseInt(countEstados.rows[0].count),
          viaticos: parseInt(countViaticos.rows[0].count),
          horarios: parseInt(countHorarios.rows[0].count),
          usuarios: parseInt(usersCount.rows[0].count)
        },
        databaseUrlConfigured: dbConfigured
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      databaseUrlConfigured: dbConfigured,
      error: err.message,
      code: err.code,
      hint: !dbConfigured ? 'DATABASE_URL no está definida en las variables de entorno de Render.' : undefined
    });
  }
});

// ─── Endpoint Administrativo para forzar migraciones y sincronización ────────
app.all('/api/admin/run-migrations', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const isProd = process.env.NODE_ENV === 'production';
  const isDefaultOrInsecure = !process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '' || process.env.JWT_SECRET.includes('talento360_secret_2026');
  if (isProd && isDefaultOrInsecure) {
    console.error('[FATAL CIBERSEGURIDAD] En entorno de producción (NODE_ENV=production), la variable JWT_SECRET es obligatoria y no puede usar el secreto predeterminado o predecible (AUD-011).');
    process.exit(1);
  }
  const JWT_SECRET = process.env.JWT_SECRET || 'talento360_secret_2026';
  
  let authorized = false;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const role = String(decoded.role || decoded.rol || '').toLowerCase();
      const isAdminRole = (role === 'admin' || role === 'administrador');
      if (isAdminRole) authorized = true;
    } catch (_) {}
  }

  if (!authorized) {
    return res.status(401).json({ error: 'No autorizado. Se requiere token de sesión con rol de Administrador.' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await runMigrations(client);
      return res.json({ success: true, message: 'Migraciones y saneamiento de datos ejecutados correctamente.', result });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Arranque Ordenado del Servidor ───────────────────────────────────────────
async function startServer() {
  // 1. Importación de Microservicios
  const authRoutes          = require('../services/auth-service/src/routes/auth');
  const employeesRoutes     = require('../services/employees-service/src/routes/employees');
  const requestsRoutes      = require('../services/requests-service/src/routes/requests');
  const adminRequestsRoutes = require('../services/admin-requests-service/src/routes/admin-requests');
  const incapacidadesRoutes = require('../services/admin-requests-service/src/routes/incapacidades');
  const viaticosRoutes      = require('../services/viaticos-service/src/routes/viaticos');
  const dashboardRoutes     = require('../services/dashboard-service/src/routes/dashboard');
  const adminRoutes         = require('../services/dashboard-service/src/routes/admin');
  const horariosRoutes      = require('../services/horarios-service/src/routes/horarios');
  const sstRoutes           = require('../services/sst-service/src/routes/sst');
  // Gestión documental, informes y automatización
  const documentsRoutes     = require('../services/documents-service/src/routes/documents');
  const reportsRoutes       = require('../services/reports-service/src/routes/reports');
  const automationRoutes    = require('../services/reports-service/src/routes/automation');

  // 2. Montaje de Rutas API
  app.use('/api/auth', authRoutes);
  app.use('/api/employees', employeesRoutes);
  app.use('/api/requests', requestsRoutes);
  app.use('/api/admin-requests', adminRequestsRoutes);
  app.use('/api/incapacidades', incapacidadesRoutes);
  app.use('/api/viaticos', viaticosRoutes);
  // Rutas de catálogo unificado DIVIPOLA / Municipios / Destinos
  app.get(['/api/destinos', '/api/municipios', '/api/divipola'], (req, res, next) => {
    req.url = '/destinos' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
    viaticosRoutes(req, res, next);
  });
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/horarios', horariosRoutes);
  app.use('/api/sst', sstRoutes);
  app.use('/api/documents', documentsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/automation', automationRoutes);

  // Manejador 404 para rutas API no encontradas
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
  });

  // ─── Servir Frontend Estático (Permite desarrollo local en puerto 3000) ──────
  const frontendDir = path.resolve(__dirname, '../frontend/src');
  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));
    // SPA Fallback: cualquier ruta que no sea API ni health devuelve index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/health') return next();
      const indexPath = path.join(frontendDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });
  }

  // Manejador global de errores
  app.use((err, req, res, next) => {
    console.error('[Talento 360 API Error]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Error interno del servidor en Talento 360'
    });
  });

  // 3. Inicio inmediato de escucha HTTP (garantiza que Render vincule el puerto rápidamente)
  app.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`🚀 Talento 360 Backend Unificado escuchando en puerto ${PORT}`);
    console.log(`   Base de datos: ${process.env.DATABASE_URL ? 'DATABASE_URL detectada' : (process.env.DB_HOST || 'localhost')}`);
    console.log(`=============================================================\n`);
  });

  // 4. Verificación de BD y migraciones en segundo plano (no bloquea el arranque HTTP)
  (async () => {
    if (process.env.AUTO_INIT_DB === 'true') {
      try {
        await initDatabase({ migrateOnly: false, forceWipeConfirmed: false, cliMode: false });
      } catch (dbErr) {
        console.warn('[Talento 360 DB Auto-Init] Aviso al verificar base de datos:', dbErr.message);
      }
    } else {
      console.log('[Talento 360 DB] Inicio en modo solo-conexión (AUTO_INIT_DB desactivado): el esquema y los datos permanecen intactos.');
    }

    try {
      const client = await pool.connect();
      try {
        await runMigrations(client);
        console.log('[Talento 360 Migraciones] Migraciones seguras verificadas con éxito.');
      } finally {
        client.release();
      }
    } catch (migErr) {
      console.warn('[Talento 360 Migraciones] Aviso al verificar migraciones seguras:', migErr.message);
    }
  })().catch(err => {
    console.error('[Talento 360 DB Init Background Error]', err.message);
  });
}

startServer();
