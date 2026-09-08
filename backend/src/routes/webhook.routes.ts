// src/routes/webhook.routes.ts
// High-performance Paystack webhook endpoint. Mounted with express.raw()
// in server.ts (NOT express.json()) because signature verification needs
// the exact raw request body bytes — parsing to JSON first breaks the HMAC.

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { findBasketById } from '../services/store';
import { refreshBasketStatus } from '../services/split.service';
import { PaystackChargeSuccessEvent } from '../types';

const router = Router();

const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET ?? '';

// Idempotency guard — Paystack retries webhooks on timeout, so we track
// processed event references to avoid double-crediting a payer.
const processedReferences = new Set<string>();

function isValidPaystackSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !PAYSTACK_WEBHOOK_SECRET) return false;
  const hash = crypto.createHmac('sha512', PAYSTACK_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return hash === signatureHeader;
}

// POST /webhooks/paystack
router.post('/paystack', (req: Request, res: Response) => {
  const signature = req.headers['x-paystack-signature'] as string | undefined;
  const rawBody = req.body as Buffer; // set by express.raw() in server.ts

  // Always ack within Paystack's timeout window even while we validate —
  // respond fast, do the heavier bookkeeping after signature check passes.
  if (!isValidPaystackSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event: PaystackChargeSuccessEvent;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Malformed payload' });
  }

  // Ack immediately — Paystack expects a fast 200. Processing continues
  // synchronously here since the store is in-memory; move this to a queue
  // (BullMQ/SQS) once basket state lives in a real database under load.
  res.status(200).json({ received: true });

  if (event.event !== 'charge.success') return;

  const reference = event.data.reference;
  if (processedReferences.has(reference)) return; // already handled
  processedReferences.add(reference);

  const basketId = event.data.metadata?.basketId;
  const payerId = event.data.metadata?.payerId;
  if (!basketId || !payerId) return;

  const basket = findBasketById(basketId);
  if (!basket) return;

  const payer = basket.payers.find((p) => p.id === payerId);
  if (!payer) return;

  const amountPaidNaira = event.data.amount / 100;
  if (amountPaidNaira < payer.totalDue) {
    // Underpayment — leave pending, real system would flag for reconciliation.
    return;
  }

  payer.status = 'paid';
  const updated = refreshBasketStatus(basket);
  Object.assign(basket, updated);

  console.log(`[webhook] payer ${payer.name} settled ₦${amountPaidNaira} on basket ${basket.id}`);
});

export default router;
