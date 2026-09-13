// src/jobs/reconciliation.job.ts
// Phase 1 item 3: reconciliation job. Webhooks do occasionally get dropped
// (a deploy mid-delivery, a transient network blip on Paystack's side) —
// this polls Paystack directly for successful charges on a fixed interval
// and runs any we don't already have a PaymentEvent row for through the
// exact same processChargeSuccess() the webhook itself uses, so a missed
// webhook is a delay, not data loss.
//
// No new infrastructure: a plain setInterval in the running process rather
// than a separate worker + queue (BullMQ/Redis, the Phase 1 webhook-queue
// item) — reconciliation runs a handful of times an hour at most, which
// doesn't need dedicated infra the way high-volume webhook processing
// might eventually.

import { prisma } from '../lib/prisma';
import { processChargeSuccess } from '../services/paymentEvent.service';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { PaystackChargeSuccessEvent } from '../types';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LOOKBACK_MS = 24 * 60 * 60 * 1000; // only ever need to catch a recently-dropped webhook

interface PaystackTransaction {
  reference: string;
  amount: number;
  status: string;
  paid_at: string | null;
  customer: { email: string };
  metadata?: { basketId?: string; payerId?: string } | string;
}

async function fetchRecentSuccessfulCharges(): Promise<PaystackTransaction[]> {
  const from = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const response = await fetch(
    `https://api.paystack.co/transaction?status=success&from=${encodeURIComponent(from)}&perPage=100`,
    { headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` } }
  );
  const json = (await response.json()) as { message?: string; data?: PaystackTransaction[] };
  if (!response.ok || !json.data) {
    throw new Error(json?.message ?? `Paystack transaction list fetch failed (${response.status})`);
  }
  return json.data;
}

// Paystack sends metadata back as a JSON string on the transaction-list
// endpoint (unlike the webhook payload, where it's already an object) —
// normalize both shapes so processChargeSuccess never needs to know which
// endpoint an event came from.
function normalizeMetadata(raw: PaystackTransaction['metadata']): { basketId?: string; payerId?: string } {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

async function runReconciliationPass(): Promise<void> {
  const transactions = await fetchRecentSuccessfulCharges();
  if (transactions.length === 0) return;

  const references = transactions.map((t) => t.reference);
  const known = await prisma.paymentEvent.findMany({
    where: { paystackReference: { in: references } },
    select: { paystackReference: true },
  });
  const knownRefs = new Set(known.map((k) => k.paystackReference));

  const missed = transactions.filter((t) => !knownRefs.has(t.reference));
  if (missed.length === 0) return;

  logger.warn({ count: missed.length, references: missed.map((t) => t.reference) }, 'reconciliation: found charges with no matching webhook delivery — processing now');

  for (const tx of missed) {
    const event: PaystackChargeSuccessEvent = {
      event: 'charge.success',
      data: {
        reference: tx.reference,
        amount: tx.amount,
        status: tx.status,
        customer: tx.customer,
        metadata: normalizeMetadata(tx.metadata),
      },
    };
    // One failure shouldn't stop the rest of the batch — same "log and
    // move on" posture as the webhook handler.
    try {
      await processChargeSuccess(event);
    } catch (err) {
      logger.error({ err, reference: tx.reference }, 'reconciliation: failed to process recovered charge');
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startReconciliationJob(): void {
  if (!env.PAYSTACK_SECRET_KEY) {
    logger.info('reconciliation job not started — no live PAYSTACK_SECRET_KEY configured (mock mode has no Paystack account to poll)');
    return;
  }
  if (intervalHandle) return; // already running — startup should only call this once, but guard anyway

  logger.info({ intervalMinutes: POLL_INTERVAL_MS / 60000 }, 'reconciliation job started');
  intervalHandle = setInterval(() => {
    runReconciliationPass().catch((err) => logger.error({ err }, 'reconciliation pass failed'));
  }, POLL_INTERVAL_MS);
  // Node shouldn't stay alive purely because of this timer in a test/CLI
  // context; in the actual running server it's a no-op either way since
  // app.listen() already keeps the process alive.
  intervalHandle.unref?.();
}

export function stopReconciliationJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
