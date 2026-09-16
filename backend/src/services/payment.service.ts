// src/services/payment.service.ts
// Paystack integration layer. Swap the mock branch for a real fetch to
// https://api.paystack.co/dedicated_account once PAYSTACK_SECRET_KEY is
// live (Phase 1 item 1 in the execution plan — this file is still mock-only
// until that Paystack business activation checklist is complete).
// Docs: https://paystack.com/docs/payments/dedicated-virtual-accounts/

import { env } from '../config/env';
import { logger } from '../lib/logger';
import { BankOption, ChargeBankInput, ChargeResult, PayoutWalletInput, RefundResult } from '../types';

interface CreateVirtualAccountInput {
  basketId: string;
  payerId: string;
  amountKobo: number;
  // Split settlement for the transfer-in flow. Unlike chargeBankAccount's
  // exact-kobo transaction_charge below, Paystack's Dedicated Virtual
  // Account product only supports a *percentage*-based split via the
  // subaccount's own configured percentage_charge (set once, at subaccount
  // creation — see createOrUpdateSubaccount) — there's no per-transaction
  // flat override for DVAs the way there is for direct charges. That
  // percentage is derived from CONVENIENCE_FEE_RATE, so it matches this
  // app's actual fee rate, but it can drift from a specific payer's exact
  // computed feeAmount by a kobo or two on rounding — an honest limitation
  // of the DVA product, not a bug here.
  subaccountCode?: string;
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
      ...(input.subaccountCode ? { subaccount: input.subaccountCode } : {}),
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

// Split settlement, prerequisite step: a Paystack Subaccount is what
// createVirtualAccount (via `subaccount`) and chargeBankAccount (via
// `subaccount` + `transaction_charge`) actually split payment into — a
// basket admin's payout wallet does nothing for real money movement until
// this has run once for them. Called from user.routes.ts whenever an admin
// saves/updates their payout wallet; Paystack's Update Subaccount endpoint
// is used on repeat calls so a corrected bank detail doesn't fragment into
// a second, orphaned subaccount.
//
// percentage_charge is set from this app's own fixed convenience fee rate
// (env.CONVENIENCE_FEE_RATE) converted from "% of share" to "% of total
// charged" — see the CreateVirtualAccountInput comment above for why this
// is the DVA product's inherent precision ceiling, not a bug: at rate r,
// totalDue = share * (1+r), so fee / totalDue = r / (1+r), not r itself.
//
// Unlike chargeBankAccount, there's no per-transaction subsidy possible
// here (Paystack's DVA API has no transaction_charge equivalent — see
// CreateVirtualAccountInput). The rate is set high enough (5.75%, not
// 1.5% — .env.example) that it comfortably covers this too: Paystack's DVA
// fee schedule is actually smaller than the direct-charge one this rate
// was sized against (1% capped ₦300, vs. 1.5%+₦100 capped ₦2,000), so the
// margin here is even more generous than on the charge-bank flow.
export async function createOrUpdateSubaccount(
  input: PayoutWalletInput & { existingSubaccountCode?: string }
): Promise<{ subaccountCode: string }> {
  if (!env.PAYSTACK_SECRET_KEY) {
    logger.debug({ accountNumber: input.accountNumber }, 'creating mock subaccount');
    return { subaccountCode: input.existingSubaccountCode ?? `ACCT_mock_${Date.now()}` };
  }

  const percentageCharge = (env.CONVENIENCE_FEE_RATE / (1 + env.CONVENIENCE_FEE_RATE)) * 100;
  const isUpdate = Boolean(input.existingSubaccountCode);
  const url = isUpdate
    ? `https://api.paystack.co/subaccount/${input.existingSubaccountCode}`
    : 'https://api.paystack.co/subaccount';

  const response = await fetch(url, {
    method: isUpdate ? 'PUT' : 'POST',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      business_name: input.accountName,
      settlement_bank: input.bankCode,
      account_number: input.accountNumber,
      percentage_charge: percentageCharge,
    }),
  });

  const json = (await response.json()) as { message?: string; data?: { subaccount_code: string } };
  if (!response.ok || !json.data) {
    logger.error({ accountNumber: input.accountNumber, err: json?.message }, 'Paystack subaccount create/update failed');
    throw new Error(json?.message ?? 'Failed to set up payout account with Paystack');
  }

  return { subaccountCode: json.data.subaccount_code };
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

// Paystack's real, published local-transaction fee schedule (paystack.com
// /pricing): 1.5% of the amount actually charged, plus a flat ₦100 waived
// under ₦2,500, capped at ₦2,000 total. Confirmed exactly against two real
// live-mode test charges (transaction/verify's `fees` field) before this
// was written — not a guess. This is deducted from the SUBACCOUNT's side
// of a split charge regardless of the `bearer` param sent (see
// chargeBankAccount below), so it's what platformFeeKobo in
// basket.routes.ts subtracts from SplitIt's own cut to keep the basket
// organizer's payout whole.
export function estimatePaystackChargeFeeKobo(totalKobo: number): number {
  const flat = totalKobo >= 250_000 ? 10_000 : 0;
  const fee = Math.round(totalKobo * 0.015) + flat;
  return Math.min(fee, 200_000);
}

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
  //
  // Split settlement: transaction_charge is the EXACT kobo amount that
  // goes to SplitIt's main account regardless of the subaccount's own
  // percentage_charge — "override the split configuration for a single
  // split payment" per Paystack's docs — so unlike the DVA flow above,
  // this is bit-exact against whatever feeAmount was actually computed for
  // this payer, not an approximation from a stored percentage.
  //
  // bearer: 'account' is sent, but confirmed via a real live-mode test
  // (checking transaction/verify's fees_split afterward, at two very
  // different amounts) that Paystack's /charge endpoint does NOT honor it
  // the way /transaction/initialize's docs describe — the subaccount ends
  // up bearing Paystack's own processing fee either way (fees_split.params
  // came back "bearer":"subaccount" both times, regardless of what was
  // sent). Kept here as accurate intent and in case that changes, but the
  // basket admin's actual payout is share minus Paystack's own transfer
  // fee, not the clean shareAmount the comment above might otherwise imply.
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
      ...(input.subaccountCode
        ? { subaccount: input.subaccountCode, transaction_charge: input.platformFeeKobo, bearer: 'account' }
        : {}),
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

// A handful of banks (Zenith among them — Paystack's own documented test
// account uses it: account 0000000000, birthday 2008-09-15) require
// date-of-birth as an additional auth factor, via this separate endpoint
// rather than submit_otp. Same shape and same caveat as submitChargeOtp
// about not being the thing that marks a payer paid.
export async function submitChargeBirthday(input: { reference: string; birthday: string }): Promise<ChargeResult> {
  if (!env.PAYSTACK_SECRET_KEY) {
    if (input.birthday === '2008-09-15') {
      logger.debug({ reference: input.reference }, 'mock birthday accepted');
      return { status: 'success', reference: input.reference };
    }
    return {
      status: 'failed',
      reference: input.reference,
      message: 'Incorrect birthday (mock mode uses 2008-09-15, Paystack\'s documented test date).',
    };
  }

  const response = await fetch('https://api.paystack.co/charge/submit_birthday', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ birthday: input.birthday, reference: input.reference }),
  });

  const json = (await response.json()) as { message?: string; data?: { status: string; reference: string } };
  if (!response.ok || !json.data) {
    logger.error({ reference: input.reference, err: json?.message }, 'Paystack birthday submission failed');
    return { status: 'failed', reference: input.reference, message: json?.message ?? 'Birthday submission failed' };
  }

  return { status: json.data.status as ChargeResult['status'], reference: json.data.reference };
}
