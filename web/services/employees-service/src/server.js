const express = require('express');
const cors    = require('cors');
const routes  = require('./routes/employees');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/employees', routes);
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'employees-service' }));

app.listen(PORT, () => console.log(`[employees-service] Listening on port ${PORT}`));
