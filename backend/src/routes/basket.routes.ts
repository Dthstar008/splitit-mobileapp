// src/routes/basket.routes.ts
import { Router } from 'express';
import {
  findBasketByTextCode,
  findBasketById,
  findBasketsByAdmin,
  findPayerById,
  findUserById,
  refundPayerPayment,
  saveNewBasket,
  setPayerVirtualAccount,
  toBasketDTO,
} from '../services/store';
import { computeBasket } from '../services/split.service';
import { requireAuth, AuthedRequest } from '../middleware/auth.middleware';
import {
  createVirtualAccount,
  chargeBankAccount,
  estimatePaystackChargeFeeKobo,
  refundPayment,
  submitChargeBirthday,
  submitChargeOtp,
} from '../services/payment.service';
import { asyncHandler } from '../lib/asyncHandler';

// A payer's totalDue minus what they've already paid — what a NEW charge
// (virtual account or "pay with bank") should actually bill for. Without
// this, a payer who underpaid and comes back to top up the difference
// would be charged the full totalDue again instead of just what's left.
function outstandingKobo(payer: { totalDue: unknown; amountPaid: unknown }): number {
  const outstanding = Math.max(0, Number(payer.totalDue) - Number(payer.amountPaid));
  return Math.round(outstanding * 100);
}

// The platform's slice of THIS specific charge, for split settlement.
//
// Two things happen here, not one:
//   1. Proportional to what's actually being collected right now, not
//      always the payer's full feeAmount — a top-up after underpayment
//      only charges part of totalDue, so it should only carry a matching
//      part of the fee; otherwise a payer topping up a small remainder
//      would have their whole top-up eaten by a fee sized for the
//      original full amount.
//   2. That nominal slice is then reduced by Paystack's own processing
//      fee for this charge (estimatePaystackChargeFeeKobo) — confirmed via
//      a real live-mode test that Paystack deducts its own fee from the
//      SUBACCOUNT's side of a split charge regardless of the `bearer`
//      param, so without this the basket organizer's payout would be
//      short by Paystack's cut. CONVENIENCE_FEE_RATE (5.75%, see
//      .env.example) is deliberately set high enough that this subtraction
//      practically never needs the floor-at-0 clamp in real use — it's a
//      safety net for edge cases, not the normal path.
// Exported for __tests__/basket.routes.test.ts to verify the actual
// fee-free-payout guarantee directly, not just that it's wired into the
// route somewhere.
export function platformFeeKobo(payer: { totalDue: unknown; feeAmount: unknown }, chargeKobo: number): number {
  const totalDueKobo = Math.round(Number(payer.totalDue) * 100);
  const feeKobo = Math.round(Number(payer.feeAmount) * 100);
  if (totalDueKobo <= 0) return 0;
  const nominalShare = Math.round((feeKobo * chargeKobo) / totalDueKobo);
  return Math.max(0, nominalShare - estimatePaystackChargeFeeKobo(chargeKobo));
}

const router = Router();

// POST /baskets — STEP A+B+C: create basket, compute split, generate QR payload.
router.post('/', requireAuth, asyncHandler<AuthedRequest>(async (req, res) => {
  const { title, items, totalMarketCost, payerHandles } = req.body ?? {};

  if (!title || !totalMarketCost || !Array.isArray(payerHandles) || payerHandles.length === 0) {
    return res.status(400).json({ error: 'title, totalMarketCost and at least one payer are required' });
  }

  const admin = await findUserById(req.userId!);
  if (!admin) return res.status(404).json({ error: 'Admin user not found' });

  // The organizer is always one of the payers, splitting the cost evenly
  // alongside everyone else they listed — added here server-side, not
  // something the client sends, so there's exactly one place this happens
  // and no way for a client to spoof someone else's isCreator flag. See
  // split.service.ts's computeSplitDistribution for why their entry comes
  // back already marked paid.
  const computed = computeBasket({
    title,
    items: items ?? [],
    totalMarketCost: Number(totalMarketCost),
    payerHandles: [...payerHandles, { name: admin.fullName, splitId: admin.splitId, isCreator: true }],
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
    // undefined when this basket's admin has no payout wallet set up yet —
    // createVirtualAccount already handles that (no subaccount param sent,
    // full amount settles to SplitIt's own balance, same as before this
    // feature existed) rather than failing the charge outright.
    subaccountCode: basket.admin.paystackSubaccountCode ?? undefined,
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

  const chargeKobo = outstandingKobo(payer);
  const subaccountCode = basket.admin.paystackSubaccountCode ?? undefined;
  const result = await chargeBankAccount({
    basketId: basket.id,
    payerId: payer.id,
    bankCode,
    accountNumber,
    amountKobo: chargeKobo,
    subaccountCode,
    platformFeeKobo: subaccountCode ? platformFeeKobo(payer, chargeKobo) : undefined,
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

// POST /baskets/:basketId/payers/:payerId/charge-bank/submit-birthday
// Same shape as submit-otp above, for the subset of banks (Zenith is
// Paystack's own documented test case) that ask for date-of-birth instead
// of — or in addition to — an OTP.
router.post('/:basketId/payers/:payerId/charge-bank/submit-birthday', asyncHandler(async (req, res) => {
  const { reference, birthday } = req.body ?? {};
  if (!reference || !birthday) {
    return res.status(400).json({ error: 'reference and birthday are required' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    return res.status(400).json({ error: 'birthday must be in YYYY-MM-DD format' });
  }
  const result = await submitChargeBirthday({ reference, birthday });
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
