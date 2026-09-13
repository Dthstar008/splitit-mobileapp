// src/routes/basket.routes.ts
import { Router } from 'express';
import {
  findBasketByTextCode,
  findBasketById,
  findBasketsByAdmin,
  findPayerById,
  refundPayerPayment,
  saveNewBasket,
  setPayerVirtualAccount,
  toBasketDTO,
} from '../services/store';
import { computeBasket } from '../services/split.service';
import { requireAuth, AuthedRequest } from '../middleware/auth.middleware';
import { createVirtualAccount, chargeBankAccount, refundPayment, submitChargeOtp } from '../services/payment.service';
import { asyncHandler } from '../lib/asyncHandler';

// A payer's totalDue minus what they've already paid — what a NEW charge
// (virtual account or "pay with bank") should actually bill for. Without
// this, a payer who underpaid and comes back to top up the difference
// would be charged the full totalDue again instead of just what's left.
function outstandingKobo(payer: { totalDue: unknown; amountPaid: unknown }): number {
  const outstanding = Math.max(0, Number(payer.totalDue) - Number(payer.amountPaid));
  return Math.round(outstanding * 100);
}

const router = Router();

// POST /baskets — STEP A+B+C: create basket, compute split, generate QR payload.
router.post('/', requireAuth, asyncHandler<AuthedRequest>(async (req, res) => {
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
}));

// GET /baskets — all baskets created by the authenticated admin (Home/History tabs).
router.get('/', requireAuth, asyncHandler<AuthedRequest>(async (req, res) => {
  const mine = await findBasketsByAdmin(req.userId!);
  res.json(mine.map(toBasketDTO));
}));

// GET /baskets/code/:textCode — STEP D lookup: type SP-9281 to pull up the bill.
router.get('/code/:textCode', asyncHandler(async (req, res) => {
  const basket = await findBasketByTextCode(req.params.textCode);
  if (!basket) return res.status(404).json({ error: 'No basket found for that code' });
  res.json(toBasketDTO(basket));
}));

// POST /baskets/:basketId/payers/:payerId/virtual-account
// Generates a temporary DVA for a specific payer to pay their share + fee into.
router.post('/:basketId/payers/:payerId/virtual-account', asyncHandler(async (req, res) => {
  const basket = await findBasketById(req.params.basketId);
  if (!basket) return res.status(404).json({ error: 'Basket not found' });

  const payer = await findPayerById(req.params.basketId, req.params.payerId);
  if (!payer) return res.status(404).json({ error: 'Payer not found on this basket' });
  if (payer.status === 'paid') return res.status(409).json({ error: 'This payer has already paid' });

  const account = await createVirtualAccount({
    basketId: basket.id,
    payerId: payer.id,
    amountKobo: outstandingKobo(payer),
  });

  await setPayerVirtualAccount(payer.id, account);
  res.json({
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    expiresAt: account.expiresAt.toISOString(),
  });
}));

// POST /baskets/:basketId/payers/:payerId/charge-bank
// "Pay with Bank" — the payer's alternative to the virtual-account
// transfer-in above: they pick their own bank and account, and Paystack
// charges it directly (usually via an OTP step, sometimes PIN). See
// payment.service.ts for why a 'success' status here still isn't what
// marks the payer paid — that's still the webhook's job.
router.post('/:basketId/payers/:payerId/charge-bank', asyncHandler(async (req, res) => {
  const { bankCode, accountNumber } = req.body ?? {};
  if (!bankCode || !accountNumber) {
    return res.status(400).json({ error: 'bankCode and accountNumber are required' });
  }

  const basket = await findBasketById(req.params.basketId);
  if (!basket) return res.status(404).json({ error: 'Basket not found' });

  const payer = await findPayerById(req.params.basketId, req.params.payerId);
  if (!payer) return res.status(404).json({ error: 'Payer not found on this basket' });
  if (payer.status === 'paid') return res.status(409).json({ error: 'This payer has already paid' });

  const result = await chargeBankAccount({
    basketId: basket.id,
    payerId: payer.id,
    bankCode,
    accountNumber,
    amountKobo: outstandingKobo(payer),
  });
  res.json(result);
}));

// POST /baskets/:basketId/payers/:payerId/charge-bank/submit-otp
// Completes the charge-bank flow above once Paystack has texted the payer
// an OTP. basketId/payerId aren't used for lookup here (the reference alone
// identifies the in-flight Paystack charge) — kept in the URL so this reads
// as part of the same payer-scoped action, and for consistent route logging.
router.post('/:basketId/payers/:payerId/charge-bank/submit-otp', asyncHandler(async (req, res) => {
  const { reference, otp } = req.body ?? {};
  if (!reference || !otp) {
    return res.status(400).json({ error: 'reference and otp are required' });
  }
  const result = await submitChargeOtp({ reference, otp });
  res.json(result);
}));

// POST /baskets/:basketId/payers/:payerId/refund
// Phase 1 item 5: manual-refund admin action. Only the basket's own admin
// can trigger this — a payer or a stranger with the basket's text code (the
// virtual-account and charge-bank endpoints above are deliberately
// unauthenticated so any payer can pay) must not be able to reverse a
// payment.
router.post(
  '/:basketId/payers/:payerId/refund',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const basket = await findBasketById(req.params.basketId);
    if (!basket) return res.status(404).json({ error: 'Basket not found' });
    if (basket.adminId !== req.userId) {
      return res.status(403).json({ error: 'Only this basket\'s organizer can issue a refund' });
    }

    const payer = await findPayerById(req.params.basketId, req.params.payerId);
    if (!payer) return res.status(404).json({ error: 'Payer not found on this basket' });
    if (Number(payer.amountPaid) <= 0) {
      return res.status(409).json({ error: 'This payer has not paid anything to refund' });
    }

    // Reset SplitIt's own records first — refundPayerPayment also hands
    // back the Paystack reference to refund against, found from the
    // payer's own payment history rather than trusting anything in the
    // request body.
    const { amountRefunded, paystackReference } = await refundPayerPayment(req.params.basketId, req.params.payerId);
    const result = await refundPayment({
      paystackReference,
      amountKobo: Math.round(amountRefunded * 100),
    });

    res.json({ amountRefunded, ...result });
  })
);

export default router;
