const express = require('express');
const cors    = require('cors');
const reportsRoutes    = require('./routes/reports');
const automationRoutes = require('./routes/automation');

const app  = express();
const PORT = process.env.PORT || 3010;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

app.use('/api/reports', reportsRoutes);
app.use('/api/automation', automationRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'reports-service', port: PORT }));

app.listen(PORT, () => {
  console.log(`[reports-service] Listening on port ${PORT}`);
});

// Crea las tablas nuevas también en bases que ya tenían datos. Si la base aún no acepta
// conexiones (p. ej. se está reiniciando), se reintenta; un fallo no detiene el servicio.
const MIGRATION_ATTEMPTS = 10;
async function applyMigrations(attempt = 1) {
  try {
    const files = await require('./migrate').runMigrations(require('./db'));
    if (files.length) console.log(`[reports-service] Migraciones aplicadas: ${files.join(', ')}`);
  } catch (err) {
    if (attempt < MIGRATION_ATTEMPTS) {
      setTimeout(() => applyMigrations(attempt + 1), 3000);
    } else {
      console.error('[reports-service] Error al aplicar migraciones:', err.message);
    }
  }
}
applyMigrations();
