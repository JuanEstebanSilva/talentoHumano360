const express = require('express');
const cors    = require('cors');
const routes  = require('./routes/horarios');

const app  = express();
const PORT = process.env.PORT || 3007;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/horarios', routes);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'horarios-service', port: PORT }));

app.listen(PORT, () => {
  console.log(`[horarios-service] Listening on port ${PORT}`);
});
