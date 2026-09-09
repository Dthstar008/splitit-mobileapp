// src/services/split.service.ts
// Core split-engine math — pure, deterministic, and framework-agnostic on
// purpose (Phase 0 item 5: "start with split.service.ts, it's pure math,
// cheapest to test"). It has zero dependency on Prisma or Express, so it
// can be unit tested with no database and no server running — see
// __tests__/split.service.test.ts.
//
// Kept identical in shape to the frontend mock (services/api.ts) so
// client-side previews match server-side truth.

import { env } from '../config/env';

export interface PayerHandle {
  name: string;
  splitId?: string;
}

export interface ComputedPayer {
  name: string;
  splitId?: string;
  shareAmount: number;
  feeAmount: number;
  totalDue: number;
  status: 'pending';
}

export function computeConvenienceFee(baseAmount: number, feeRate: number = env.CONVENIENCE_FEE_RATE) {
  const feeAmount = Math.round(baseAmount * feeRate * 100) / 100;
  return {
    baseAmount,
    feeRate,
    feeAmount,
    totalAmount: Math.round((baseAmount + feeAmount) * 100) / 100,
  };
}

export function computeSplitDistribution(totalCost: number, payerHandles: PayerHandle[]): ComputedPayer[] {
  if (payerHandles.length === 0) return [];
  const rawShare = Math.round((totalCost / payerHandles.length) * 100) / 100;

  return payerHandles.map((p) => {
    const fee = computeConvenienceFee(rawShare);
    return {
      name: p.name,
      splitId: p.splitId,
      shareAmount: rawShare,
      feeAmount: fee.feeAmount,
      totalDue: fee.totalAmount,
      status: 'pending',
    };
  });
}

export interface NewBasketInput {
  title: string;
  items: { name: string; cost: number }[];
  totalMarketCost: number;
  payerHandles: PayerHandle[];
  adminId: string;
}

export interface ComputedBasket {
  title: string;
  items: { name: string; cost: number }[];
  totalMarketCost: number;
  payers: ComputedPayer[];
  status: 'pending_payments';
  adminId: string;
}

// Computes the basket shape ready for persistence. Deliberately does NOT
// assign ids/textCode/qrPayload/createdAt — those are identity/storage
// concerns owned by store.ts (Phase 0 moved them off in-memory arrays and
// onto Postgres-generated + application-generated ids).
export function computeBasket(input: NewBasketInput): ComputedBasket {
  return {
    title: input.title,
    items: input.items,
    totalMarketCost: input.totalMarketCost,
    payers: computeSplitDistribution(input.totalMarketCost, input.payerHandles),
    status: 'pending_payments',
    adminId: input.adminId,
  };
}

// Given the full set of payer statuses on a basket, decides whether the
// basket should now read as fully_settled.
export function isFullySettled(payerStatuses: ('pending' | 'paid')[]): boolean {
  return payerStatuses.length > 0 && payerStatuses.every((s) => s === 'paid');
}
