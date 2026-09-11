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
