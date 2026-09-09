// src/server.ts
// Loading src/config/env first means a missing JWT_SECRET/DATABASE_URL
// throws and crashes startup before Express, Sentry, or anything else spins
// up — "fail startup loudly", per Phase 0 item 3.
import { env } from './config/env';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';

import authRoutes from './routes/auth.routes';
import basketRoutes from './routes/basket.routes';
import webhookRoutes from './routes/webhook.routes';
import { logger } from './lib/logger';

const app = express();

// Phase 0 item 7: error tracking. No-ops entirely if SENTRY_DSN isn't set,
// so local dev and CI never need a Sentry account.
if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0.1 });
  app.use(Sentry.Handlers.requestHandler());
}

app.use(helmet());
app.use(cors());
app.use(pinoHttp({ logger }));

// IMPORTANT: webhook routes are mounted BEFORE express.json() and use
// express.raw() so Paystack's HMAC signature can be verified against the
// exact raw bytes of the request body. Mounting order matters here.
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'splitit-backend' }));

app.use('/auth', authRoutes);
app.use('/baskets', basketRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

if (env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Last-resort error handler — anything a route didn't catch lands here as a
// structured log line (and, if configured, a Sentry event) instead of an
// unhandled exception taking the process down.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

if (!env.isTest) {
  app.listen(env.PORT, () => {
    logger.info(`SplitIt!! backend listening on http://localhost:${env.PORT}`);
  });
}

export default app;
