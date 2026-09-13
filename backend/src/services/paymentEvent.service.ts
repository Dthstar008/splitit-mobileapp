// src/services/paymentEvent.service.ts
// The single place a Paystack charge.success event gets turned into a
// recorded PaymentEvent + an updated payer/basket status — shared by
// webhook.routes.ts (the real-time path) and reconciliation.job.ts (the
// Phase 1 item 3 safety net for webhooks Paystack never delivered). Two
// different entry points calling two different copies of this logic is how
// they'd quietly drift apart; one function, two callers, is not.

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { findBasketById, recordPayerPayment } from './store';
import { PaystackChargeSuccessEvent } from '../types';
import { logger } from '../lib/logger';

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export type ProcessOutcome =
  | 'processed'
  | 'duplicate'
  | 'unroutable'
  | 'unknown_basket_or_payer'
  | 'not_a_charge_success';

// Never throws — every branch is a deliberate "give up on this event and
// move on" outcome, because both callers (an already-ack'd webhook, a
// background poll) have nowhere useful to propagate an exception to.
export async function processChargeSuccess(event: PaystackChargeSuccessEvent): Promise<ProcessOutcome> {
  if (event.event !== 'charge.success') return 'not_a_charge_success';

  const { reference, metadata } = event.data;
  const basketId = metadata?.basketId;
  const payerId = metadata?.payerId;
  if (!basketId || !payerId) {
    logger.warn({ reference }, 'charge.success missing basketId/payerId metadata, ignoring');
    return 'unroutable';
  }

  const basket = await findBasketById(basketId);
  const payer = basket?.payers.find((p) => p.id === payerId);
  if (!basket || !payer) {
    logger.warn({ reference, basketId, payerId }, 'charge.success references unknown basket/payer');
    return 'unknown_basket_or_payer';
  }

  const amountPaidNaira = event.data.amount / 100;

  // Record the payer's new cumulative total FIRST, so the PaymentEvent row
  // below can log the real resulting status (underpaid/paid/overpaid)
  // rather than guessing from this one charge in isolation.
  const result = await recordPayerPayment(basketId, payerId, amountPaidNaira);
  const eventStatus = result.isOverpaid ? 'overpaid' : result.status === 'paid' ? 'applied' : 'underpaid';

  try {
    // The unique constraint on paystackReference IS the idempotency check —
    // no separate "have we seen this before" read-then-write race. This
    // runs AFTER recordPayerPayment on purpose: if this insert turns out to
    // be a duplicate (P2002 below), the amount was already applied by the
    // original delivery, and this whole function short-circuits — but by
    // then recordPayerPayment above has already double-counted it. See the
    // guard immediately below for why that's caught, not ignored.
    await prisma.paymentEvent.create({
      data: {
        id: `pevt_${reference}`,
        paystackReference: reference,
        amountKobo: event.data.amount,
        status: eventStatus,
        rawPayload: event as unknown as Prisma.InputJsonValue,
        basketId,
        payerId,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      // Duplicate delivery — undo the double-count from recordPayerPayment
      // above by crediting back the same amount, restoring the payer to
      // exactly where the first (successful) delivery of this reference
      // left them.
      await recordPayerPayment(basketId, payerId, -amountPaidNaira);
      logger.info({ reference }, 'duplicate charge.success delivery, already processed — reverted double-count');
      return 'duplicate';
    }
    // Any other DB error: the payment IS recorded on the payer (that part
    // succeeded), just not logged as a PaymentEvent row. Surface loudly —
    // this is the one place idempotency for a future duplicate delivery of
    // this same reference is now NOT guaranteed, since no row exists to
    // collide against.
    logger.error({ err, reference, basketId, payerId }, 'payer payment recorded but PaymentEvent row failed to write — idempotency for retries of this reference is not guaranteed until this is fixed');
    return 'processed';
  }

  logger.info(
    { reference, basketId, payerId, amountPaidNaira, resultStatus: result.status, overpaid: result.isOverpaid },
    result.status === 'paid' ? 'payer settled' : 'partial payment recorded (underpaid)'
  );
  return 'processed';
}
