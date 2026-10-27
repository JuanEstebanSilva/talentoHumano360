// ═══════════════════════════════════════════════════════════════════════════════
// server.js — Servidor Backend Unificado / API Gateway para Talento 360
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initDatabase } = require('./scripts/init-db');

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
    // Permitir despliegues en Netlify y Render
    if (origin.endsWith('.netlify.app') || origin.endsWith('.onrender.com')) {
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

      return res.json({
        status: 'connected',
        database: dbInfo.rows[0].db,
        serverTime: dbInfo.rows[0].server_time,
        totalTables: tableCheck.rows.length,
        hasUsuariosTable: tableCheck.rows.some(t => t.table_name === 'usuarios'),
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

// ─── Importación de Microservicios ───────────────────────────────────────────
const authRoutes          = require('../services/auth-service/src/routes/auth');
const employeesRoutes     = require('../services/employees-service/src/routes/employees');
const requestsRoutes      = require('../services/requests-service/src/routes/requests');
const adminRequestsRoutes = require('../services/admin-requests-service/src/routes/admin-requests');
const viaticosRoutes      = require('../services/viaticos-service/src/routes/viaticos');
const dashboardRoutes     = require('../services/dashboard-service/src/routes/dashboard');
const horariosRoutes      = require('../services/horarios-service/src/routes/horarios');
const sstRoutes           = require('../services/sst-service/src/routes/sst');

// ─── Montaje de Rutas API ─────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/admin-requests', adminRequestsRoutes);
app.use('/api/viaticos', viaticosRoutes);
app.use('/api/dashboard', dashboardRoutes);
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

  // Auto-inicializar base de datos si está vacía o si FORCE_DB_INIT=true
  if (process.env.AUTO_INIT_DB !== 'false') {
    try {
      const forceInit = process.env.FORCE_DB_INIT === 'true';
      await initDatabase({ force: forceInit });
    } catch (dbErr) {
      console.warn('[Talento 360 DB Auto-Init] Aviso al verificar base de datos:', dbErr.message);
    }
  }
});
