// ═══════════════════════════════════════════════════════════════════════════════
// server.js — Servidor Backend Unificado / API Gateway para Talento 360
// Gobernación de Boyacá · Despliegue en Render y Soporte Integral Multiplataforma
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { pool, initDatabase, runMigrations } = require('./scripts/init-db');

const app = express();
const PORT = process.env.PORT || 3000;

// Confianza en proxies inversos (Render, Cloudflare, Nginx) para rate limiting y headers
app.set('trust proxy', 1);

// Configuración de CORS segura con lista de orígenes permitidos
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost', 'http://localhost:80', 'http://127.0.0.1', 'http://127.0.0.1:80'];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin header Origin (CLI, curl, microservicios internos) o en dev
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // Permitir despliegues en Netlify, Render, Vercel y Cloudflare Pages
    if (origin.endsWith('.netlify.app') || origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app') || origin.endsWith('.pages.dev')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS bloqueado para el origen no autorizado: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Límite amplio para permitir importaciones masivas de Excel y adjuntos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Health Checks y Diagnóstico ──────────────────────────────────────────────
app.get(['/health', '/api/health'], async (_, res) => {
  const dbConfigured = !!process.env.DATABASE_URL;
  try {
    const client = await pool.connect();
    try {
      const q = await client.query('SELECT NOW() as db_time, current_database() as db_name');
      return res.json({
        status: 'ok',
        system: 'Talento 360 — API Gateway',
        database: {
          connected: true,
          dbName: q.rows[0].db_name,
          dbTime: q.rows[0].db_time,
          configured: dbConfigured
        },
        timestamp: new Date().toISOString()
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      system: 'Talento 360 — API Gateway',
      database: {
        connected: false,
        configured: dbConfigured,
        error: err.message,
        code: err.code
      },
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/db-status', async (_, res) => {
  const dbConfigured = !!process.env.DATABASE_URL;
  try {
    const client = await pool.connect();
    try {
      const dbInfo = await client.query('SELECT current_database() as db, NOW() as server_time');
      const tableCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const usersCheck = await client.query(`
        SELECT id_usuario, username, rol, estado, 
               EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='modulos') as has_modulos
        FROM usuarios LIMIT 10
      `).catch(e => ({ error: e.message }));

      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'rel_principal' AND column_name IN ('encargo_denominacion', 'fecha_retiro')
      `).catch(() => ({ rows: [] }));

      const countPersonas = await client.query('SELECT count(*) FROM personas').catch(() => ({ rows: [{ count: -1 }] }));
      const countViaticos = await client.query('SELECT count(*) FROM viaticos').catch(() => ({ rows: [{ count: -1 }] }));
      const countHorarios = await client.query('SELECT count(*) FROM horarios').catch(() => ({ rows: [{ count: -1 }] }));
      const countRel = await client.query('SELECT count(*) FROM rel_principal').catch(() => ({ rows: [{ count: -1 }] }));

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
          viaticos: parseInt(countViaticos.rows[0].count),
          horarios: parseInt(countHorarios.rows[0].count),
        },
        users: Array.isArray(usersCheck.rows) ? usersCheck.rows.map(u => ({ username: u.username, rol: u.rol, hasModulos: u.has_modulos })) : usersCheck,
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

// ─── Importación de Microservicios ───────────────────────────────────────────
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

// ─── Montaje de Rutas API ─────────────────────────────────────────────────────
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

// Manejador 404 para rutas API no encontradas
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('[Talento 360 API Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor en Talento 360'
  });
});

// ─── Arranque del Servidor ────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 Talento 360 Backend Unificado escuchando en puerto ${PORT}`);
  console.log(`   Base de datos: ${process.env.DATABASE_URL ? 'DATABASE_URL detectada' : (process.env.DB_HOST || 'localhost')}`);
  console.log(`=============================================================\n`);

  // Auto-inicializar base de datos y correr migraciones en cada arranque
  if (process.env.AUTO_INIT_DB !== 'false') {
    try {
      const forceInit = process.env.FORCE_DB_INIT === 'true';
      await initDatabase({ force: forceInit });
    } catch (dbErr) {
      console.warn('[Talento 360 DB Auto-Init] Aviso al verificar base de datos:', dbErr.message);
    }
  }
});
