// src/routes/user.routes.ts
// Payout wallet setup — the missing link between "Paystack Subaccounts
// split" and an actual basket admin. Saving a wallet here does two things
// in one request: creates/updates the Paystack Subaccount (so it's a real,
// spendable settlement target, not just three text fields sitting in our
// own database) and persists the result. The old Profile screen's "Save
// Payout Wallet" never called a backend route at all — this is that route.

import { Router } from 'express';
import { findUserById, toSafeUser, updateUserPayoutWallet } from '../services/store';
import { createOrUpdateSubaccount } from '../services/payment.service';
import { requireAuth, AuthedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../lib/asyncHandler';
import { PayoutWalletInput } from '../types';

const router = Router();

// POST /users/me/payout-wallet
router.post(
  '/me/payout-wallet',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { bankName, bankCode, accountNumber, accountName } = (req.body ?? {}) as Partial<PayoutWalletInput>;
    if (!bankName || !bankCode || !accountNumber || !accountName) {
      return res.status(400).json({ error: 'bankName, bankCode, accountNumber and accountName are all required' });
    }

    const user = await findUserById(req.userId!);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update in place if this admin already has a subaccount (a corrected
    // account number shouldn't fragment into a second, orphaned
    // subaccount with the old one still silently receiving splits).
    const { subaccountCode } = await createOrUpdateSubaccount({
      bankName,
      bankCode,
      accountNumber,
      accountName,
      existingSubaccountCode: user.paystackSubaccountCode ?? undefined,
    });

    const updated = await updateUserPayoutWallet(
      req.userId!,
      { bankName, bankCode, accountNumber, accountName },
      subaccountCode
    );

    res.json(toSafeUser(updated));
  })
);

export default router;
