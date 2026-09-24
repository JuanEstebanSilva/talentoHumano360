const express = require('express');
const cors    = require('cors');
const routes  = require('./routes/sst');

const app  = express();
const PORT = process.env.PORT || 3008;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/sst', routes);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'sst-service', port: PORT }));

app.listen(PORT, () => {
  console.log(`[sst-service] Listening on port ${PORT}`);
});
