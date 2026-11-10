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

// Crea las tablas nuevas también en bases que ya tenían datos. Un fallo se registra
// y no detiene el servicio; se reintenta en el siguiente arranque.
require('./migrate').runMigrations(require('./db'))
  .then(files => files.length && console.log(`[reports-service] Migraciones aplicadas: ${files.join(', ')}`))
  .catch(err => console.error('[reports-service] Error al aplicar migraciones:', err.message));
