const express = require('express');
const cors    = require('cors');
const routes  = require('./routes/viaticos');
const app     = express();
const PORT    = process.env.PORT || 3005;
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Rutas de catálogo unificado DIVIPOLA / Municipios / Destinos
app.get(['/api/destinos', '/api/municipios', '/api/divipola', '/destinos', '/municipios', '/divipola'], (req, res, next) => {
  req.url = '/destinos' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  routes(req, res, next);
});

app.use('/api/viaticos', routes);
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'viaticos-service' }));
app.listen(PORT, () => console.log(`[viaticos-service] Listening on port ${PORT}`));
