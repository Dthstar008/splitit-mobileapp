// src/routes/webhook.routes.ts
// High-performance Paystack webhook endpoint. Mounted with express.raw()
// in server.ts (NOT express.json()) because signature verification needs
// the exact raw request body bytes — parsing to JSON first breaks the HMAC.
//
// Phase 0 item 4: idempotency that survives restarts. The old code tracked
// processed references in an in-memory `Set`, which reset on every deploy
// and would double-credit payers once more than one server instance ran
// behind a load balancer. That Set is gone — instead, each processed
// reference is inserted as a PaymentEvent row with a UNIQUE constraint
// (prisma/schema.prisma). A duplicate webhook delivery hits Prisma's P2002
// "unique constraint violation" and is treated as already-handled, which
// works identically whether it's the same process retrying or a second
// instance behind a load balancer.
//
// The actual event → payer/basket update logic lives in
// services/paymentEvent.service.ts now (Phase 1 item 3), shared with
// jobs/reconciliation.job.ts so a webhook Paystack never delivers and a
// webhook that arrives here go through identical processing.

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { processChargeSuccess } from '../services/paymentEvent.service';
import { PaystackChargeSuccessEvent } from '../types';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const router = Router();

function isValidPaystackSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !env.PAYSTACK_WEBHOOK_SECRET) return false;
  const hash = crypto.createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET).update(rawBody).digest('hex');
  // Constant-time compare — signatureHeader is attacker-influenced input.
  const a = Buffer.from(hash);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// POST /webhooks/paystack
router.post('/paystack', async (req: Request, res: Response) => {
  const signature = req.headers['x-paystack-signature'] as string | undefined;
  const rawBody = req.body as Buffer; // set by express.raw() in server.ts

  if (!isValidPaystackSignature(rawBody, signature)) {
    logger.warn('rejected webhook with invalid Paystack signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event: PaystackChargeSuccessEvent;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Malformed payload' });
  }

  // Ack immediately — Paystack expects a fast 200. Everything after this is
  // best-effort bookkeeping; the reconciliation job is the real safety net
  // if any of this fails after the ack.
  res.status(200).json({ received: true });

  // Runs after the response is already sent, so there's no res to error out
  // to — a rejected promise here would otherwise become an unhandled
  // rejection and crash the whole process (this is what happened to
  // auth.routes.ts before Phase 0's asyncHandler fix). processChargeSuccess
  // itself never throws, but this still guards against a genuinely
  // unexpected failure (e.g. the DB connection itself is down).
  try {
    await processChargeSuccess(event);
  } catch (err) {
    logger.error({ err, reference: event?.data?.reference }, 'unhandled error processing charge.success after ack');
  }
});

export default router;
