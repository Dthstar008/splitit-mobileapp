// src/types/index.ts
// API-facing shapes (what routes send/receive). These are intentionally
// separate from the Prisma models in prisma/schema.prisma — Prisma's
// Decimal fields, for example, get converted to `number` before they ever
// reach a response body, and passwordHash never leaves src/services/store.ts.

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  splitId: string;
  payoutWallet?: { bankName: string; bankCode: string; accountNumber: string; accountName: string };
  // True once a Paystack Subaccount exists for this user — i.e. baskets
  // they organize will actually split settlement (their share automatic,
  // ours automatic) instead of the full amount landing in SplitIt's own
  // balance with no way to pay it out.
  splitActive: boolean;
}

// POST /users/me/payout-wallet body.
export interface PayoutWalletInput {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export interface BasketItemInput {
  name: string;
  cost: number;
}

export type PayerStatus = 'pending' | 'underpaid' | 'paid' | 'refunded';

export interface PayerDTO {
  id: string;
  name: string;
  splitId?: string;
  shareAmount: number;
  feeAmount: number;
  totalDue: number;
  // Phase 1 item 4: cumulative amount received and what's left, so the
  // client can render "₦X of ₦Y paid — ₦Z left" instead of a plain binary
  // pending/paid, and so a top-up charge knows the real amount to bill.
  amountPaid: number;
  amountOutstanding: number;
  status: PayerStatus;
  virtualAccountNumber?: string;
}

export type BasketStatus = 'draft' | 'active' | 'fully_settled' | 'pending_payments';

export interface BasketDTO {
  id: string;
  textCode: string;
  title: string;
  totalMarketCost: number;
  items: { id: string; name: string; cost: number }[];
  payers: PayerDTO[];
  status: BasketStatus;
  createdAt: string;
  adminId: string;
  qrPayload: string;
}

// "Pay with Bank" flow: the payer picks their own bank instead of
// transferring into the generated virtual account. Paystack's Charge API
// (POST /charge) settles this via OTP (most Nigerian banks) or PIN
// (a smaller set) — reference: https://paystack.com/docs/payments/charge/
export interface BankOption {
  name: string;
  code: string;
  slug: string;
}

export interface ChargeBankInput {
  basketId: string;
  payerId: string;
  bankCode: string;
  accountNumber: string;
  amountKobo: number;
  // Split settlement — both present or both absent. When present, this
  // charge settles shareKobo (amountKobo - platformFeeKobo) straight to the
  // basket admin's Paystack Subaccount, platformFeeKobo to SplitIt, in one
  // step (Paystack's transaction_charge override) rather than collecting
  // the full amount and transferring the admin's share out separately.
  subaccountCode?: string;
  platformFeeKobo?: number;
}

// send_birthday: a handful of banks (Zenith among them — see Paystack's
// documented test account) require date-of-birth as an additional auth
// factor alongside OTP, via a separate /charge/submit_birthday call.
export type ChargeStatus = 'success' | 'send_otp' | 'send_pin' | 'send_birthday' | 'failed' | 'pending';

export interface ChargeResult {
  status: ChargeStatus;
  reference?: string;
  message?: string;
}

// Phase 1 item 5: manual-refund admin action. Paystack's refund API
// (POST /refund) reference: https://paystack.com/docs/payments/refunds/
export interface RefundResult {
  status: 'processed' | 'pending' | 'failed';
  message?: string;
}

export interface PaystackChargeSuccessEvent {
  event: 'charge.success';
  data: {
    reference: string;
    amount: number; // kobo
    status: string;
    customer: { email: string };
    metadata?: { basketId?: string; payerId?: string };
  };
}
