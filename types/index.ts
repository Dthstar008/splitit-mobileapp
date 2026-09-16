// types/index.ts

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  splitId: string; // e.g. "@olamide_split"
  payoutWallet?: PayoutWallet;
  // True once a Paystack Subaccount exists for this user — baskets they
  // organize actually split settlement instead of the full amount landing
  // in SplitIt's own balance with no way to pay it back out.
  splitActive: boolean;
}

export interface PayoutWallet {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export interface BasketItem {
  id: string;
  name: string;
  cost: number;
}

// Mirrors backend/src/types/index.ts's PayerDTO.
export type PayerStatus = 'pending' | 'underpaid' | 'paid' | 'refunded';

export interface Payer {
  id: string;
  name: string;
  splitId?: string;
  shareAmount: number; // base share before convenience fee
  feeAmount: number; // 5.75% convenience fee on their share — see services/api.ts's FEE_RATE for why
  totalDue: number; // shareAmount + feeAmount
  amountPaid: number; // cumulative amount actually received so far
  amountOutstanding: number; // totalDue - amountPaid, floored at 0 — what a new charge should bill for
  status: PayerStatus;
}

export type BasketStatus = 'draft' | 'active' | 'fully_settled' | 'pending_payments';

export interface VirtualAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
  expiresAt: string;
}

export interface Basket {
  id: string; // BasketID, e.g. "bskt_9281"
  textCode: string; // e.g. "SP-9281"
  title: string;
  totalMarketCost: number;
  items: BasketItem[];
  payers: Payer[];
  status: BasketStatus;
  createdAt: string;
  adminId: string;
  qrPayload: string;
}

// "Pay with Bank" — the payer picks their own bank instead of transferring
// into a generated virtual account. Mirrors backend/src/types/index.ts.
export interface BankOption {
  name: string;
  code: string;
  slug: string;
}

// send_birthday: a handful of banks (Zenith among them — Paystack's own
// documented test account) require date-of-birth as an additional auth
// factor, via a separate submit-birthday step alongside (or instead of) OTP.
export type ChargeStatus = 'success' | 'send_otp' | 'send_pin' | 'send_birthday' | 'failed' | 'pending';

export interface ChargeResult {
  status: ChargeStatus;
  reference?: string;
  message?: string;
}

export interface ConvenienceFeeBreakdown {
  baseAmount: number;
  feeRate: number; // 0.0575
  feeAmount: number;
  totalAmount: number;
}
