// src/services/split.service.ts
// Core split-engine math — kept identical in shape to the frontend mock
// (services/api.ts) so client-side previews match server-side truth.

import { Basket, BasketItem, Payer } from '../types';
import { nanoid } from 'nanoid';

const FEE_RATE = Number(process.env.CONVENIENCE_FEE_RATE ?? 0.015);

export function computeConvenienceFee(baseAmount: number) {
  const feeAmount = Math.round(baseAmount * FEE_RATE * 100) / 100;
  return { baseAmount, feeRate: FEE_RATE, feeAmount, totalAmount: Math.round((baseAmount + feeAmount) * 100) / 100 };
}

export function computeSplitDistribution(
  totalCost: number,
  payerHandles: { name: string; splitId?: string }[]
): Payer[] {
  if (payerHandles.length === 0) return [];
  const rawShare = Math.round((totalCost / payerHandles.length) * 100) / 100;

  return payerHandles.map((p) => {
    const fee = computeConvenienceFee(rawShare);
    return {
      id: `payer_${nanoid(6)}`,
      name: p.name,
      splitId: p.splitId,
      shareAmount: rawShare,
      feeAmount: fee.feeAmount,
      totalDue: fee.totalAmount,
      status: 'pending',
    };
  });
}

export function buildBasket(input: {
  title: string;
  items: BasketItem[];
  totalMarketCost: number;
  payerHandles: { name: string; splitId?: string }[];
  adminId: string;
}): Basket {
  const id = `bskt_${nanoid(6)}`;
  const textCode = `SP-${id.split('_')[1].toUpperCase()}`;
  const payers = computeSplitDistribution(input.totalMarketCost, input.payerHandles);

  return {
    id,
    textCode,
    title: input.title,
    totalMarketCost: input.totalMarketCost,
    items: input.items,
    payers,
    status: 'pending_payments',
    createdAt: new Date().toISOString(),
    adminId: input.adminId,
    qrPayload: JSON.stringify({ basketId: id, textCode, title: input.title }),
  };
}

// Recomputes basket status after a payer settles — flips to fully_settled
// once every payer has status 'paid'.
export function refreshBasketStatus(basket: Basket): Basket {
  const allPaid = basket.payers.every((p) => p.status === 'paid');
  return { ...basket, status: allPaid ? 'fully_settled' : 'pending_payments' };
}
