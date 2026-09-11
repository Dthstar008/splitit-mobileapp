// src/lib/asyncHandler.ts
// Express 4 does not catch rejected promises thrown inside an async route
// handler — an unhandled rejection just propagates to Node's process-level
// handler, and modern Node (--unhandled-rejections=throw, the default since
// v15) crashes the entire process on that. A single transient DB blip during
// a login request took the whole server down this way (Prisma P1001 against
// Supabase, uncaught in auth.routes.ts).
//
// Wrapping every async handler in this forwards the rejection to Express's
// own next(err), which reaches the centralized error handler in server.ts
// instead of killing the process.
import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler<Req extends Request = Request>(fn: AsyncRouteHandler<Req>) {
  return (req: Req, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
