// ═══════════════════════════════════════════════════════════════════════════════
// server.js — Servidor Backend Unificado / API Gateway para Talento 360
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./scripts/init-db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS amplia para permitir peticiones desde Netlify y localhost
app.use(cors({
  origin: '*',
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

// ─── Montaje de Rutas API ─────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/admin-requests', adminRequestsRoutes);
app.use('/api/viaticos', viaticosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/horarios', horariosRoutes);

// Endpoint administrativo para ejecutar o forzar la inicialización de la base de datos sin necesitar Shell
app.all('/api/admin/init-db', async (req, res) => {
  const secret = req.query.secret || req.body?.secret;
  const expectedSecret = process.env.DB_INIT_SECRET || 'talento360_init_secret';

  if (secret !== expectedSecret) {
    return res.status(403).json({ error: 'Acceso no autorizado. Secret inválido.' });
  }

  const force = req.query.force === 'true' || req.body?.force === true;

  try {
    await initDatabase({ force });
    res.json({
      success: true,
      message: `Base de datos de Talento 360 inicializada correctamente (force=${force}).`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

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
