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
  payoutWallet?: { bankName: string; accountNumber: string; accountName: string };
}

export interface BasketItemInput {
  name: string;
  cost: number;
}

export type PayerStatus = 'pending' | 'paid';

export interface PayerDTO {
  id: string;
  name: string;
  splitId?: string;
  shareAmount: number;
  feeAmount: number;
  totalDue: number;
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
}

export type ChargeStatus = 'success' | 'send_otp' | 'send_pin' | 'failed' | 'pending';

export interface ChargeResult {
  status: ChargeStatus;
  reference?: string;
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
