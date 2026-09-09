# SplitIt!! backend — Phase 0 (Foundations)

This is a clean rewrite of `backend/` from
[Dthstar008/splitit-mobileapp](https://github.com/Dthstar008/splitit-mobileapp),
implementing **Phase 0** of the `SplitIt!! v2 — Execution Plan`. Nothing here
is user-visible — it's the safety net every later phase (real Paystack
money, product depth, scale) needs to not be built on sand.

## ⚠️ Before you do anything else

The source repo has `backend/.env` **committed to git**, containing what
look like real `JWT_SECRET` / Paystack key values. Treat those as
compromised:

1. Rotate `JWT_SECRET` and both Paystack keys right away.
2. Remove `backend/.env` from git (`git rm --cached backend/.env`) — it's
   already covered by [.gitignore](.gitignore) here so it won't happen again.
3. If this repo is public, consider it a full secret leak, not just a
   config mistake — rotate, don't just delete the file.

## What changed vs. the original `backend/`

| Plan item | What this does |
|---|---|
| 1. Real database | [prisma/schema.prisma](prisma/schema.prisma) models `User`, `Basket`, `BasketItem`, `Payer`, `PaymentEvent` in Postgres. [src/services/store.ts](src/services/store.ts) replaces the old in-memory arrays but keeps the same lookup function names (`findUserByEmailOrPhone`, `findBasketByTextCode`, `findBasketById`) — they just gain `await`. |
| 2. Password hashing | [src/routes/auth.routes.ts](src/routes/auth.routes.ts) hashes new passwords with bcrypt. Existing SHA-256 accounts are tagged `hashAlgorithm: SHA256_LEGACY` and transparently re-hashed to bcrypt on next successful login — no forced reset. |
| 3. Secrets & config | [src/config/env.ts](src/config/env.ts) is the only file allowed to read `process.env`. Missing `JWT_SECRET`/`DATABASE_URL` throws at import time — the app refuses to start rather than fall back to a default. Paystack keys are additionally validated as non-placeholder in production. |
| 4. Idempotency that survives restarts | [src/routes/webhook.routes.ts](src/routes/webhook.routes.ts) inserts one `PaymentEvent` row per Paystack reference; the table's `UNIQUE` constraint (not an in-memory `Set`) is the idempotency guard, so it works across restarts and multiple server instances. |
| 5. Test harness | [__tests__/split.service.test.ts](__tests__/split.service.test.ts) — 14 Jest tests against the pure split-math functions in `src/services/split.service.ts`. No database needed to run them. |
| 6. CI pipeline | [.github/workflows/ci.yml](.github/workflows/ci.yml) — typecheck, generate Prisma client, run tests on every PR touching `backend/`. |
| 7. Error tracking & logging | [src/lib/logger.ts](src/lib/logger.ts) (pino, structured JSON in production) replaces `morgan` + bare `console.log`. [src/server.ts](src/server.ts) wires up Sentry when `SENTRY_DSN` is set, no-ops otherwise. |

Not in scope for Phase 0 (left as-is / commented as future work, per the
plan): live Paystack integration, webhook→queue offloading, the
reconciliation job, refund flow, and the compliance/legal pass — those are
Phase 1 in the plan and depend on the Paystack business activation process,
which has the longest external lead time and should be kicked off in
parallel with this engineering work.

## Setup

```bash
cd backend
cp .env.example .env   # then fill in DATABASE_URL and JWT_SECRET
npm install
npm run prisma:migrate   # creates the Postgres schema
npm run dev
```

Run the test suite (no database required):

```bash
npm test
```

## File layout

```
backend/
  prisma/schema.prisma        # Phase 0 item 1
  src/
    config/env.ts             # Phase 0 item 3
    lib/
      prisma.ts                 # shared PrismaClient
      logger.ts                # Phase 0 item 7
    services/
      store.ts                 # Phase 0 item 1 (was in-memory arrays)
      split.service.ts          # pure math — unchanged in spirit, see tests
      payment.service.ts        # still Paystack-mock (Phase 1 makes it live)
    routes/
      auth.routes.ts            # Phase 0 item 2
      basket.routes.ts
      webhook.routes.ts         # Phase 0 item 4
    middleware/auth.middleware.ts
    server.ts
  __tests__/
    setup-env.ts
    split.service.test.ts       # Phase 0 item 5
  .github/workflows/ci.yml      # Phase 0 item 6
```
