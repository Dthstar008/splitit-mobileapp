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

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { findBasketById, markPayerPaidAndRefreshBasket } from '../services/store';
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

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
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
  // best-effort bookkeeping; the Phase 1 reconciliation job (polling
  // charge.success from Paystack directly) is the real safety net if any
  // of this fails after the ack.
  res.status(200).json({ received: true });

  if (event.event !== 'charge.success') return;

  const { reference, metadata } = event.data;

  // Everything below runs after the response is already sent, so there's no
  // res to error out to — a rejected promise here would otherwise become an
  // unhandled rejection and crash the whole process (this is what happened
  // to auth.routes.ts). Contain it: log and move on, same as the
  // known-unroutable-event branches below.
  try {
    const basketId = metadata?.basketId;
    const payerId = metadata?.payerId;
    if (!basketId || !payerId) {
      logger.warn({ reference }, 'charge.success missing basketId/payerId metadata, ignoring');
      return;
    }

    const basket = await findBasketById(basketId);
    const payer = basket?.payers.find((p) => p.id === payerId);
    if (!basket || !payer) {
      logger.warn({ reference, basketId, payerId }, 'charge.success references unknown basket/payer');
      return;
    }

    const amountPaidNaira = event.data.amount / 100;
    const underpaid = amountPaidNaira < Number(payer.totalDue);

    try {
      // The unique constraint on paystackReference IS the idempotency check —
      // no separate "have we seen this before" read-then-write race.
      await prisma.paymentEvent.create({
        data: {
          id: `pevt_${reference}`,
          paystackReference: reference,
          amountKobo: event.data.amount,
          status: underpaid ? 'underpaid' : 'applied',
          rawPayload: event as unknown as Prisma.InputJsonValue,
          basketId,
          payerId,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        logger.info({ reference }, 'duplicate webhook delivery, already processed');
        return;
      }
      logger.error({ err, reference }, 'failed to record payment event');
      return;
    }

    if (underpaid) {
      // Underpayment — leave the payer pending. Phase 1 item 4 needs a real
      // policy here (partial credit / refund / "top up the difference"); for
      // now this is recorded (status: 'underpaid') for reconciliation instead
      // of silently vanishing into the logs like the old code did.
      logger.warn({ reference, basketId, payerId, amountPaidNaira, totalDue: payer.totalDue }, 'underpayment recorded');
      return;
    }

    await markPayerPaidAndRefreshBasket(basketId, payerId);
    logger.info({ reference, basketId, payerId, amountPaidNaira }, 'payer settled');
  } catch (err) {
    logger.error({ err, reference }, 'unhandled error processing charge.success after ack');
  }
});

export default router;
