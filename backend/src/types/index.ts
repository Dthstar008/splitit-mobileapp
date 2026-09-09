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
