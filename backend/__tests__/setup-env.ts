// __tests__/setup-env.ts
// Runs before any test file is imported (see jest.config.js `setupFiles`).
// src/config/env.ts throws on import if these are missing, so tests need
// fixed dummy values regardless of what's in a local .env.

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/splitit_test?schema=public';
process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production';
process.env.CONVENIENCE_FEE_RATE = '0.015';
// So webhook.routes.test.ts can compute a valid Paystack HMAC signature.
process.env.PAYSTACK_WEBHOOK_SECRET = 'test-only-webhook-secret-do-not-use-in-production';
// Explicitly cleared, not just "not set here" — env.ts loads the real
// .env via dotenv on every test file's import (each test file gets its own
// fresh module registry), and if a live PAYSTACK_SECRET_KEY happens to be
// configured there (as it now is, for manual live-mode testing), it would
// otherwise leak into the test run and make payment.service.ts's "mock
// mode" tests silently make real calls to Paystack's live API instead.
// Set to '' rather than deleted: dotenv.config() only fills in keys that
// are still *absent* from process.env, so deleting it here would just let
// the next dotenv.config() (inside env.ts, on import) repopulate it from
// the real .env file — an empty string is present, so it sticks, and
// env.ts's `!env.PAYSTACK_SECRET_KEY` check treats it the same as unset.
process.env.PAYSTACK_SECRET_KEY = '';
