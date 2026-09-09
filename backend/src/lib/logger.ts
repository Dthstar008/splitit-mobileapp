// src/lib/logger.ts
// Structured logging (Phase 0 item 7). Replaces the bare `console.log` in
// the old webhook.routes.ts and morgan's plain-text access log with JSON
// lines that a log pipeline (Sentry, Datadog, CloudWatch, ...) can index.

import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (env.isProduction ? 'info' : 'debug'),
  transport:
    env.isProduction || env.isTest
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});
