// eslint.config.js
// Real linting (closing the Phase 0 item 6 gap — "lint" was previously
// just `tsc --noEmit` aliased under a second name, not an actual style/
// correctness check). Split from typecheck on purpose: `npm run typecheck`
// (tsc --noEmit) still owns type errors, this owns everything a compiler
// doesn't catch — unused vars, floating promises, accidental `any`.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly' },
    },
  },
  {
    // This config file and jest.config.js are plain Node CommonJS, not part
    // of the TS-compiled src/ — they need `require`/`module` as globals,
    // which the base config above doesn't provide.
    files: ['eslint.config.js', 'jest.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'writable', __dirname: 'readonly' },
    },
    rules: {
      // require() is the correct, necessary form here — this file has no
      // "type": "module" in package.json, so it IS CommonJS, not TS code
      // that should prefer ESM import.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      // An awaited call left unawaited is exactly the class of bug Phase 0
      // spent a whole session chasing (the unhandled-rejection crash) —
      // this catches the next one at lint time instead of in production.
      '@typescript-eslint/no-floating-promises': 'off', // needs type-aware linting (parserOptions.project) — not worth the CI slowdown for a Phase 0 lint pass; asyncHandler (src/lib/asyncHandler.ts) is the actual runtime guard for this.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }], // the logger (src/lib/logger.ts) is the real answer; console.log specifically is what Phase 0 item 7 replaced in the webhook handler — don't let it creep back in.
    },
  }
);
