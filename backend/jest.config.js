/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  clearMocks: true,
  // Phase 0 sets required secrets at startup (src/config/env.ts) — tests run
  // against fixed dummy values so `npm test` never depends on a real .env.
  setupFiles: ['<rootDir>/__tests__/setup-env.ts'],
};
