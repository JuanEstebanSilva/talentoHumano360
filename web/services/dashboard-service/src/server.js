const express     = require('express');
const cors        = require('cors');
const routes      = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const app         = express();
const PORT        = process.env.PORT || 3006;

// AUD-014: Configuración estricta de proxies confiables (evita suplantación de IP)
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

app.use(cors()); 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/dashboard', routes);
app.use('/api/admin', adminRoutes);
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'dashboard-service' }));
app.listen(PORT, () => console.log(`[dashboard-service] Listening on port ${PORT}`));
