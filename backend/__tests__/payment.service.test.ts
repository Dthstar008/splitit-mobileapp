// __tests__/payment.service.test.ts
// Direct unit coverage for payment.service.ts's mock-mode branches — the
// ones that actually run in dev and CI, since no PAYSTACK_SECRET_KEY is
// configured there. createOrUpdateSubaccount is the one genuinely new pure
// unit here (the other functions' mock branches were exercised indirectly
// through the route tests already).

import { createOrUpdateSubaccount, estimatePaystackChargeFeeKobo } from '../src/services/payment.service';

const wallet = {
  bankName: 'Wema Bank',
  bankCode: '035',
  accountNumber: '0123456789',
  accountName: 'Olamide Teju',
};

describe('createOrUpdateSubaccount (mock mode)', () => {
  it('returns a fresh mock subaccount code when the user has none yet', async () => {
    const result = await createOrUpdateSubaccount(wallet);
    expect(result.subaccountCode).toMatch(/^ACCT_mock_/);
  });

  it('keeps the existing subaccount code on an update, rather than minting a new one', async () => {
    const result = await createOrUpdateSubaccount({ ...wallet, existingSubaccountCode: 'ACCT_mock_existing' });
    expect(result.subaccountCode).toBe('ACCT_mock_existing');
  });
});

describe('estimatePaystackChargeFeeKobo', () => {
  // Both figures confirmed against real live-mode transactions (not just
  // the published formula) — see payment.service.ts's comment.
  it('matches the real fee observed on a live ₦1,015 test charge (flat ₦100 waived, under ₦2,500)', () => {
    expect(estimatePaystackChargeFeeKobo(101_500)).toBe(1_523);
  });

  it('matches the real fee observed on a live ₦50,750 test charge (flat ₦100 applies)', () => {
    expect(estimatePaystackChargeFeeKobo(5_075_000)).toBe(86_125);
  });

  it('waives the flat ₦100 exactly at the ₦2,500 boundary — still no flat fee', () => {
    // 249,999 kobo: strictly under threshold.
    expect(estimatePaystackChargeFeeKobo(249_999)).toBe(Math.round(249_999 * 0.015));
  });

  it('applies the flat ₦100 once the amount reaches ₦2,500', () => {
    expect(estimatePaystackChargeFeeKobo(250_000)).toBe(Math.round(250_000 * 0.015) + 10_000);
  });

  it('caps at ₦2,000 no matter how large the charge', () => {
    expect(estimatePaystackChargeFeeKobo(50_000_000)).toBe(200_000);
  });
});
