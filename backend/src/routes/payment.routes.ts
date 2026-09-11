// src/routes/payment.routes.ts
// Payment-related routes that aren't scoped to one basket. Currently just
// the bank list for the "Pay with Bank" flow — see basket.routes.ts for the
// per-payer charge-bank endpoints and payment.service.ts for the Paystack
// integration itself.

import { Router } from 'express';
import { listBanks } from '../services/payment.service';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

// GET /payments/banks
router.get('/banks', asyncHandler(async (_req, res) => {
  const banks = await listBanks();
  res.json(banks);
}));

export default router;
