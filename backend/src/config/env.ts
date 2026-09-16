// src/config/env.ts
// Central place to read process.env. No module outside this file should
// touch `process.env` directly — that's how the old code ended up with a
// silent `JWT_SECRET ?? 'dev_secret_change_me'` fallback in
// auth.middleware.ts and a `PAYSTACK_SECRET_KEY.startsWith('sk_test_xxx')`
// mock check with no real validation.
//
// Phase 0 item 3: fail startup loudly if a required secret is missing in
// production — never fall back to a hardcoded default.

import dotenv from 'dotenv';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProduction = NODE_ENV === 'production';

class MissingEnvError extends Error {
  constructor(name: string) {
    super(
      `Missing required environment variable: ${name}. ` +
        'Set it via your secrets manager (or .env for local dev) before starting the server.'
    );
    this.name = 'MissingEnvError';
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Always throw, even outside production — a missing JWT_SECRET should
    // never silently downgrade to an insecure default in ANY environment.
    throw new MissingEnvError(name);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

// PAYSTACK_SECRET_KEY / PAYSTACK_WEBHOOK_SECRET are optional in
// development/test so the app can run in payment.service.ts's mock mode
// without a merchant account. In production they're mandatory, and must
// look like real Paystack live/test keys, not the placeholder from
// .env.example.
function paystackKey(name: 'PAYSTACK_SECRET_KEY' | 'PAYSTACK_WEBHOOK_SECRET'): string | undefined {
  const value = process.env[name];
  if (isProduction) {
    if (!value) throw new MissingEnvError(name);
    if (value.startsWith('sk_test_xxx') || value.length < 20) {
      throw new Error(`${name} is set to a placeholder value — set the real Paystack key in production.`);
    }
  }
  return value || undefined;
}

export const env = {
  NODE_ENV,
  isProduction,
  isTest: NODE_ENV === 'test',
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: required('DATABASE_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  PAYSTACK_SECRET_KEY: paystackKey('PAYSTACK_SECRET_KEY'),
  PAYSTACK_WEBHOOK_SECRET: paystackKey('PAYSTACK_WEBHOOK_SECRET'),
  // 5.75%, not 1.5% — see .env.example for why (short version: 1.5% alone
  // can't cover Paystack's own processing fee on a charge without leaving
  // the basket organizer's payout short).
  CONVENIENCE_FEE_RATE: Number(optional('CONVENIENCE_FEE_RATE', '0.0575')),
  SENTRY_DSN: process.env.SENTRY_DSN || undefined,
};
