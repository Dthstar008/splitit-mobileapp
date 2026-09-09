// src/lib/prisma.ts
// Single shared PrismaClient instance. Re-instantiating PrismaClient per
// request (or per hot-reload in dev) exhausts Postgres connections fast —
// this is the standard Prisma-with-Express singleton pattern.

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
