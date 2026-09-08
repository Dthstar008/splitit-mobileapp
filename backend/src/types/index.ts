// src/types/index.ts

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  splitId: string;
  payoutWallet?: { bankName: string; accountNumber: string; accountName: string };
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
  shareAmount: number;
  feeAmount: number;
  totalDue: number;
  status: PayerStatus;
  virtualAccountNumber?: string;
}

export type BasketStatus = 'draft' | 'active' | 'fully_settled' | 'pending_payments';

export interface Basket {
  id: string;
  textCode: string;
  title: string;
  totalMarketCost: number;
  items: BasketItem[];
  payers: Payer[];
  status: BasketStatus;
  createdAt: string;
  adminId: string;
  qrPayload: string;
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
