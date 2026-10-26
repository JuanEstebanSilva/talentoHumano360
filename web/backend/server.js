// ═══════════════════════════════════════════════════════════════════════════════
// server.js — Servidor Backend Unificado / API Gateway para Talento 360
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./scripts/init-db');

const app = express();
const PORT = process.env.PORT || 3000;

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

// ─── Health Checks ────────────────────────────────────────────────────────────
const healthResponse = (_, res) => res.json({
  status: 'ok',
  system: 'Talento 360 — API Gateway',
  timestamp: new Date().toISOString()
});
app.get('/health', healthResponse);
app.get('/api/health', healthResponse);

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
