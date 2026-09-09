// src/routes/basket.routes.ts
import { Router } from 'express';
import {
  findBasketByTextCode,
  findBasketById,
  findBasketsByAdmin,
  findPayerById,
  saveNewBasket,
  setPayerVirtualAccount,
  toBasketDTO,
} from '../services/store';
import { computeBasket } from '../services/split.service';
import { requireAuth, AuthedRequest } from '../middleware/auth.middleware';
import { createVirtualAccount } from '../services/payment.service';

const router = Router();

// POST /baskets — STEP A+B+C: create basket, compute split, generate QR payload.
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { title, items, totalMarketCost, payerHandles } = req.body ?? {};

  if (!title || !totalMarketCost || !Array.isArray(payerHandles) || payerHandles.length === 0) {
    return res.status(400).json({ error: 'title, totalMarketCost and at least one payer are required' });
  }

  const computed = computeBasket({
    title,
    items: items ?? [],
    totalMarketCost: Number(totalMarketCost),
    payerHandles,
    adminId: req.userId!,
  });

  const basket = await saveNewBasket(computed);
  res.status(201).json(toBasketDTO(basket));
});

// GET /baskets — all baskets created by the authenticated admin (Home/History tabs).
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const mine = await findBasketsByAdmin(req.userId!);
  res.json(mine.map(toBasketDTO));
});

// GET /baskets/code/:textCode — STEP D lookup: type SP-9281 to pull up the bill.
router.get('/code/:textCode', async (req, res) => {
  const basket = await findBasketByTextCode(req.params.textCode);
  if (!basket) return res.status(404).json({ error: 'No basket found for that code' });
  res.json(toBasketDTO(basket));
});

// POST /baskets/:basketId/payers/:payerId/virtual-account
// Generates a temporary DVA for a specific payer to pay their share + fee into.
router.post('/:basketId/payers/:payerId/virtual-account', async (req, res) => {
  const basket = await findBasketById(req.params.basketId);
  if (!basket) return res.status(404).json({ error: 'Basket not found' });

  const payer = await findPayerById(req.params.basketId, req.params.payerId);
  if (!payer) return res.status(404).json({ error: 'Payer not found on this basket' });

  const account = await createVirtualAccount({
    basketId: basket.id,
    payerId: payer.id,
    amountKobo: Math.round(Number(payer.totalDue) * 100),
  });

  await setPayerVirtualAccount(payer.id, account);
  res.json({
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    expiresAt: account.expiresAt.toISOString(),
  });
});

export default router;
