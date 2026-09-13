// src/services/payment.service.ts
// Paystack integration layer. Swap the mock branch for a real fetch to
// https://api.paystack.co/dedicated_account once PAYSTACK_SECRET_KEY is
// live (Phase 1 item 1 in the execution plan — this file is still mock-only
// until that Paystack business activation checklist is complete).
// Docs: https://paystack.com/docs/payments/dedicated-virtual-accounts/

import { env } from '../config/env';
import { logger } from '../lib/logger';
import { BankOption, ChargeBankInput, ChargeResult, RefundResult } from '../types';

interface CreateVirtualAccountInput {
  basketId: string;
  payerId: string;
  amountKobo: number;
}

interface VirtualAccountResult {
  bankName: string;
  accountNumber: string;
  accountName: string;
  expiresAt: Date;
}

export async function createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccountResult> {
  // MOCK MODE — no live Paystack key configured, return a fake DVA so the
  // frontend flow can be built/demoed end to end without a merchant account.
  if (!env.PAYSTACK_SECRET_KEY) {
    logger.debug({ basketId: input.basketId, payerId: input.payerId }, 'creating mock virtual account');
    const banks = ['Wema Bank', 'Providus Bank', 'Titan Trust Bank'];
    return {
      bankName: banks[Math.floor(Math.random() * banks.length)],
      accountNumber: `99${Math.floor(1000000 + Math.random() * 8999999)}`,
      accountName: `SplitIt / ${input.basketId.toUpperCase()}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    };
  }

  // LIVE MODE — real Paystack Dedicated Virtual Account creation.
  // Requires a Paystack customer to already exist for the payer; simplified
  // here to the core call shape.
  const response = await fetch('https://api.paystack.co/dedicated_account', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer: input.payerId,
      preferred_bank: 'wema-bank',
      metadata: { basketId: input.basketId, payerId: input.payerId },
    }),
  });

  const json = (await response.json()) as {
    message?: string;
    data: { bank: { name: string }; account_number: string; account_name: string };
  };
  if (!response.ok) {
    logger.error({ basketId: input.basketId, payerId: input.payerId, err: json?.message }, 'Paystack DVA creation failed');
    throw new Error(json?.message ?? 'Failed to create Paystack virtual account');
  }

  return {
    bankName: json.data.bank.name,
    accountNumber: json.data.account_number,
    accountName: json.data.account_name,
    expiresAt: new Date(Date.now() + 1000 * 60 * 30),
  };
}

// "Pay with Bank" — the payer picks their own bank/account instead of
// transferring into a generated virtual account. Same mock/live split as
// createVirtualAccount above, gated on PAYSTACK_SECRET_KEY.
//
// Note on the source of truth for "did this actually get paid": neither
// chargeBankAccount nor submitChargeOtp below ever calls
// markPayerPaidAndRefreshBasket directly, even on a 'success' result — that
// deliberately mirrors createVirtualAccount, which also never fabricates a
// completed payment in mock mode. The Paystack webhook (webhook.routes.ts,
// charge.success) stays the single place a payer is marked paid, whether
// they paid via virtual account or via this flow. A client-reported
// "success" is not proof of payment on its own.

// A short, well-known subset of Nigerian banks with their real (public,
// Paystack-documented, not secret) bank codes — used only as the mock-mode
// fallback so the bank picker works without a live Paystack key. Live mode
// below replaces this with Paystack's actual /bank list.
const MOCK_BANKS: BankOption[] = [
  { name: 'Access Bank', code: '044', slug: 'access-bank' },
  { name: 'First Bank of Nigeria', code: '011', slug: 'first-bank' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058', slug: 'gtbank' },
  { name: 'Kuda Microfinance Bank', code: '50211', slug: 'kuda' },
  { name: 'Opay', code: '999992', slug: 'opay' },
  { name: 'Providus Bank', code: '101', slug: 'providus-bank' },
  { name: 'United Bank for Africa (UBA)', code: '033', slug: 'uba' },
  { name: 'Wema Bank', code: '035', slug: 'wema-bank' },
  { name: 'Zenith Bank', code: '057', slug: 'zenith-bank' },
];

export async function listBanks(): Promise<BankOption[]> {
  if (!env.PAYSTACK_SECRET_KEY) {
    logger.debug('listing mock bank set (no live Paystack key configured)');
    return MOCK_BANKS;
  }

  const response = await fetch('https://api.paystack.co/bank?currency=NGN', {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
  });
  const json = (await response.json()) as {
    message?: string;
    data: { name: string; code: string; slug: string; active: boolean }[];
  };
  if (!response.ok) {
    logger.error({ err: json?.message }, 'Paystack bank list fetch failed');
    throw new Error(json?.message ?? 'Failed to fetch bank list');
  }

  return json.data.filter((b) => b.active).map((b) => ({ name: b.name, code: b.code, slug: b.slug }));
}

export async function chargeBankAccount(input: ChargeBankInput): Promise<ChargeResult> {
  if (!env.PAYSTACK_SECRET_KEY) {
    logger.debug(
      { basketId: input.basketId, payerId: input.payerId },
      'initiating mock bank charge — send_otp, use 123456 to complete it in mock mode'
    );
    return {
      status: 'send_otp',
      reference: `mock_chg_${input.payerId}_${Date.now()}`,
      message: 'Enter the OTP sent to your phone.',
    };
  }

  // LIVE MODE — simplified to the core call shape, same caveat as
  // createVirtualAccount's live branch: Paystack's charge API requires a
  // customer email, which the Payer model doesn't carry (payers don't need
  // SplitIt accounts). A real production version needs to collect or
  // synthesize one properly before this goes live.
  const response = await fetch('https://api.paystack.co/charge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: `payer+${input.payerId}@splitit.app`,
      amount: input.amountKobo,
      bank: { code: input.bankCode, account_number: input.accountNumber },
      metadata: { basketId: input.basketId, payerId: input.payerId },
    }),
  });

  const json = (await response.json()) as {
    message?: string;
    data?: { status: string; reference: string; display_text?: string };
  };
  if (!response.ok || !json.data) {
    logger.error({ basketId: input.basketId, payerId: input.payerId, err: json?.message }, 'Paystack bank charge failed');
    return { status: 'failed', message: json?.message ?? 'Charge could not be initiated' };
  }

  return {
    status: json.data.status as ChargeResult['status'],
    reference: json.data.reference,
    message: json.data.display_text,
  };
}

// Phase 1 item 5: manual-refund admin action. `paystackReference` is
// optional because a basket can be marked refunded even when no
// PaymentEvent row exists to reference (e.g. an admin correcting a mistake
// recorded some other way) — in that case this is a no-op against Paystack
// and the caller (basket.routes.ts) is only updating SplitIt's own records.
export async function refundPayment(input: { paystackReference: string | null; amountKobo?: number }): Promise<RefundResult> {
  if (!input.paystackReference) {
    logger.warn('refund requested with no Paystack reference on file — updating SplitIt records only, nothing to refund at Paystack');
    return { status: 'processed', message: 'No payment reference on file; local records updated only.' };
  }

  if (!env.PAYSTACK_SECRET_KEY) {
    logger.debug({ reference: input.paystackReference }, 'mock refund');
    return { status: 'processed' };
  }

  const response = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction: input.paystackReference,
      ...(input.amountKobo ? { amount: input.amountKobo } : {}),
    }),
  });

  const json = (await response.json()) as { message?: string; data?: { status: string } };
  if (!response.ok) {
    logger.error({ reference: input.paystackReference, err: json?.message }, 'Paystack refund failed');
    return { status: 'failed', message: json?.message ?? 'Refund could not be processed' };
  }

  // Paystack refunds are asynchronous — 'processed' here means "accepted",
  // not "money has moved yet". Full status tracking (via the
  // refund.processed webhook event) is a natural extension of this, not
  // built here.
  return { status: json.data?.status === 'processed' ? 'processed' : 'pending' };
}

export async function submitChargeOtp(input: { reference: string; otp: string }): Promise<ChargeResult> {
  if (!env.PAYSTACK_SECRET_KEY) {
    if (input.otp === '123456') {
      logger.debug({ reference: input.reference }, 'mock OTP accepted');
      return { status: 'success', reference: input.reference };
    }
    return { status: 'failed', reference: input.reference, message: 'Incorrect OTP (mock mode uses 123456).' };
  }

  const response = await fetch('https://api.paystack.co/charge/submit_otp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ otp: input.otp, reference: input.reference }),
  });

  const json = (await response.json()) as { message?: string; data?: { status: string; reference: string } };
  if (!response.ok || !json.data) {
    logger.error({ reference: input.reference, err: json?.message }, 'Paystack OTP submission failed');
    return { status: 'failed', reference: input.reference, message: json?.message ?? 'OTP submission failed' };
  }

  return { status: json.data.status as ChargeResult['status'], reference: json.data.reference };
}
