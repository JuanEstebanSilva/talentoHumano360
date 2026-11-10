const express = require('express');
const cors    = require('cors');
const routes  = require('./routes/documents');

const app  = express();
const PORT = process.env.PORT || 3009;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

app.use('/api/documents', routes);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'documents-service', port: PORT }));

app.listen(PORT, () => {
  console.log(`[documents-service] Listening on port ${PORT}`);
});
