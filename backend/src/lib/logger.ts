// src/lib/logger.ts
// Structured logging (Phase 0 item 7). Replaces the bare `console.log` in
// the old webhook.routes.ts and morgan's plain-text access log with JSON
// lines that a log pipeline (Sentry, Datadog, CloudWatch, ...) can index.

import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  // Test runs stay silent by default — __tests__/*.routes.test.ts assert on
  // logger calls via jest.spyOn, which still tracks them regardless of
  // pino's own level filtering, so this only quiets stdout noise.
  level: process.env.LOG_LEVEL ?? (env.isTest ? 'silent' : env.isProduction ? 'info' : 'debug'),
  transport:
    env.isProduction || env.isTest
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});
