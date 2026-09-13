// src/services/store.ts
// Phase 0 item 1: real database. This used to be a JavaScript array that a
// server restart wiped clean; it's now a thin data-access layer over
// Postgres via Prisma (prisma/schema.prisma). The lookup functions keep
// their original names/shapes (findUserByEmailOrPhone, findBasketByTextCode,
// findBasketById) so routes barely change — they just gain `await`.

import { Basket as PrismaBasket, BasketItem, Payer as PrismaPayer, Prisma, User as PrismaUser } from '@prisma/client';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma';
import { BasketDTO, PayerDTO, SafeUser } from '../types';
import { ComputedBasket } from './split.service';

// ---- Users -----------------------------------------------------------

export function toSafeUser(user: PrismaUser): SafeUser {
  const safe: SafeUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    splitId: user.splitId,
  };
  if (user.payoutBankName && user.payoutAccountNumber && user.payoutAccountName) {
    safe.payoutWallet = {
      bankName: user.payoutBankName,
      accountNumber: user.payoutAccountNumber,
      accountName: user.payoutAccountName,
    };
  }
  return safe;
}

export function findUserByEmailOrPhone(identifier: string): Promise<PrismaUser | null> {
  return prisma.user.findFirst({ where: { OR: [{ email: identifier }, { phone: identifier }] } });
}

export function findUserById(id: string): Promise<PrismaUser | null> {
  return prisma.user.findUnique({ where: { id } });
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  hashAlgorithm: 'SHA256_LEGACY' | 'BCRYPT';
  splitId: string;
}

export function createUser(input: CreateUserInput): Promise<PrismaUser> {
  return prisma.user.create({ data: { id: `usr_${nanoid(8)}`, ...input } });
}

export function updateUserPassword(userId: string, passwordHash: string): Promise<PrismaUser> {
  return prisma.user.update({ where: { id: userId }, data: { passwordHash, hashAlgorithm: 'BCRYPT' } });
}

// ---- Baskets -----------------------------------------------------------

type BasketWithRelations = PrismaBasket & { items: BasketItem[]; payers: PrismaPayer[] };

const basketInclude = { items: true, payers: true } as const;

export function toBasketDTO(basket: BasketWithRelations): BasketDTO {
  return {
    id: basket.id,
    textCode: basket.textCode,
    title: basket.title,
    totalMarketCost: Number(basket.totalMarketCost),
    items: basket.items.map((i) => ({ id: i.id, name: i.name, cost: Number(i.cost) })),
    payers: basket.payers.map(toPayerDTO),
    status: basket.status,
    createdAt: basket.createdAt.toISOString(),
    adminId: basket.adminId,
    qrPayload: basket.qrPayload,
  };
}

export function toPayerDTO(payer: PrismaPayer): PayerDTO {
  const totalDue = Number(payer.totalDue);
  const amountPaid = Number(payer.amountPaid);
  return {
    id: payer.id,
    name: payer.name,
    splitId: payer.splitId ?? undefined,
    shareAmount: Number(payer.shareAmount),
    feeAmount: Number(payer.feeAmount),
    totalDue,
    amountPaid,
    // Never negative — an overpayment still shows "0 outstanding", not a
    // negative "amount owed" that would read as SplitIt owing the payer.
    amountOutstanding: Math.max(0, totalDue - amountPaid),
    status: payer.status,
    virtualAccountNumber: payer.virtualAccountNumber ?? undefined,
  };
}

export function findBasketByTextCode(code: string): Promise<BasketWithRelations | null> {
  const normalized = code.trim().toUpperCase();
  return prisma.basket.findFirst({ where: { textCode: normalized }, include: basketInclude });
}

export function findBasketById(id: string): Promise<BasketWithRelations | null> {
  return prisma.basket.findUnique({ where: { id }, include: basketInclude });
}

export function findBasketsByAdmin(adminId: string): Promise<BasketWithRelations[]> {
  return prisma.basket.findMany({
    where: { adminId },
    include: basketInclude,
    orderBy: { createdAt: 'desc' },
  });
}

// Persists a computed basket (see split.service.ts#computeBasket). Assigns
// the id up front, exactly like the pre-Phase-0 code did, so textCode and
// qrPayload can be derived from it in one step.
export async function saveNewBasket(computed: ComputedBasket): Promise<BasketWithRelations> {
  const id = `bskt_${nanoid(6)}`;
  const textCode = `SP-${id.split('_')[1].toUpperCase()}`;
  const qrPayload = JSON.stringify({ basketId: id, textCode, title: computed.title });

  return prisma.basket.create({
    data: {
      id,
      textCode,
      title: computed.title,
      totalMarketCost: computed.totalMarketCost,
      status: computed.status,
      qrPayload,
      adminId: computed.adminId,
      items: { create: computed.items.map((i) => ({ id: `item_${nanoid(6)}`, name: i.name, cost: i.cost })) },
      payers: {
        create: computed.payers.map((p) => ({
          id: `payer_${nanoid(6)}`,
          name: p.name,
          splitId: p.splitId,
          shareAmount: p.shareAmount,
          feeAmount: p.feeAmount,
          totalDue: p.totalDue,
          status: p.status,
        })),
      },
    },
    include: basketInclude,
  });
}

export function findPayerById(basketId: string, payerId: string): Promise<PrismaPayer | null> {
  return prisma.payer.findFirst({ where: { id: payerId, basketId } });
}

export function setPayerVirtualAccount(
  payerId: string,
  account: { accountNumber: string; bankName: string; expiresAt: Date }
): Promise<PrismaPayer> {
  return prisma.payer.update({
    where: { id: payerId },
    data: {
      virtualAccountNumber: account.accountNumber,
      virtualAccountBank: account.bankName,
      virtualAccountExpiresAt: account.expiresAt,
    },
  });
}

// Flips the basket to fully_settled once every payer is 'paid', otherwise
// back to pending_payments — shared by every call site below so a crash
// mid-update can never leave a payer's status out of sync with the
// basket's. Takes the transaction client so callers can compose it with
// their own payer update in one atomic unit.
async function refreshBasketStatus(tx: Prisma.TransactionClient, basketId: string): Promise<void> {
  const payers = await tx.payer.findMany({ where: { basketId } });
  const allPaid = payers.length > 0 && payers.every((p) => p.status === 'paid');
  await tx.basket.update({
    where: { id: basketId },
    data: { status: allPaid ? 'fully_settled' : 'pending_payments' },
  });
}

export interface RecordPaymentResult {
  amountPaid: number;
  amountOutstanding: number;
  status: 'underpaid' | 'paid';
  isOverpaid: boolean;
}

// Phase 1 item 4: real underpayment/overpayment policy. Adds the newly
// received amount to the payer's running total (so a second, smaller
// "top up the difference" charge accumulates correctly instead of
// overwriting the first), then derives status from the cumulative total —
// never from this one charge in isolation.
export async function recordPayerPayment(
  basketId: string,
  payerId: string,
  amountReceivedNaira: number
): Promise<RecordPaymentResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.payer.findUniqueOrThrow({ where: { id: payerId } });
    const totalDue = Number(current.totalDue);
    const amountPaid = Number(current.amountPaid) + amountReceivedNaira;
    const isOverpaid = amountPaid > totalDue;
    const status: 'underpaid' | 'paid' = amountPaid >= totalDue ? 'paid' : 'underpaid';

    await tx.payer.update({ where: { id: payerId }, data: { amountPaid, status } });
    await refreshBasketStatus(tx, basketId);

    return { amountPaid, amountOutstanding: Math.max(0, totalDue - amountPaid), status, isOverpaid };
  });
}

export interface RefundedPayment {
  amountRefunded: number;
  paystackReference: string | null;
}

// Phase 1 item 5: manual-refund admin action. Resets the payer back to
// owing their full totalDue (not just "pending" — `refunded` keeps a
// visible record that this basket had a reversed payment, distinct from
// one that simply never got paid) and un-settles the basket if it had
// already flipped to fully_settled off the back of this payment.
export async function refundPayerPayment(basketId: string, payerId: string): Promise<RefundedPayment> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.payer.findUniqueOrThrow({ where: { id: payerId } });
    const amountRefunded = Number(current.amountPaid);

    const lastEvent = await tx.paymentEvent.findFirst({
      where: { payerId, status: { in: ['applied', 'overpaid'] } },
      orderBy: { createdAt: 'desc' },
    });

    await tx.payer.update({ where: { id: payerId }, data: { amountPaid: 0, status: 'refunded' } });
    await refreshBasketStatus(tx, basketId);

    return { amountRefunded, paystackReference: lastEvent?.paystackReference ?? null };
  });
}
