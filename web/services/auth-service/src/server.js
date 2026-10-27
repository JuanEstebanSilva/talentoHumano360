const express = require('express');
const cors    = require('cors');
const authRoutes = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'auth-service' }));

app.listen(PORT, () =>
  console.log(`[auth-service] Listening on port ${PORT}`)
);
