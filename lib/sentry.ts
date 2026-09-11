// lib/sentry.ts
// Frontend half of Phase 0 item 7 ("error tracking & logging ... Sentry on
// both frontend and backend"). The backend side (backend/src/server.ts) was
// already wired and no-ops entirely without SENTRY_DSN set — this mirrors
// that exactly on the client: no DSN, no Sentry account, no behavior change,
// nothing to configure for local dev or CI.
//
// Import this once, as early as possible (app/_layout.tsx, before any other
// app code runs) so it can catch errors from anything that follows.

import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Errors only for now, matching the backend's tracesSampleRate: 0.1
    // conservatism — dial this up once there's an actual Sentry project to
    // watch quota on.
    tracesSampleRate: 0.1,
  });
}

export const isSentryEnabled = Boolean(dsn);
