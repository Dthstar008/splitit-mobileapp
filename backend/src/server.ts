// src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import basketRoutes from './routes/basket.routes';
import webhookRoutes from './routes/webhook.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

// IMPORTANT: webhook routes are mounted BEFORE express.json() and use
// express.raw() so Paystack's HMAC signature can be verified against the
// exact raw bytes of the request body. Mounting order matters here.
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'splitit-backend' }));

app.use('/auth', authRoutes);
app.use('/baskets', basketRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, () => {
  console.log(`SplitIt!! backend listening on http://localhost:${PORT}`);
});
