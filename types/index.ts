// types/index.ts

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  splitId: string; // e.g. "@olamide_split"
  payoutWallet?: PayoutWallet;
}

export interface PayoutWallet {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface BasketItem {
  id: string;
  name: string;
  cost: number;
}

export type PayerStatus = 'pending' | 'paid';

export interface Payer {
  id: string;
  name: string;
  splitId?: string;
  shareAmount: number; // base share before convenience fee
  feeAmount: number; // 1.5% convenience fee on their share
  totalDue: number; // shareAmount + feeAmount
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

export type ChargeStatus = 'success' | 'send_otp' | 'send_pin' | 'failed' | 'pending';

export interface ChargeResult {
  status: ChargeStatus;
  reference?: string;
  message?: string;
}

export interface ConvenienceFeeBreakdown {
  baseAmount: number;
  feeRate: number; // 0.015
  feeAmount: number;
  totalAmount: number;
}
