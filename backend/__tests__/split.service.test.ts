// __tests__/split.service.test.ts
// Phase 0 item 5 / immediate next step #4: "Write the first 10 Jest tests
// against split.service.ts — it's pure, deterministic math and the
// cheapest place to build testing confidence." split.service.ts has no
// Prisma or Express dependency, so these run with no database.

import { computeBasket, computeConvenienceFee, computeSplitDistribution, isFullySettled } from '../src/services/split.service';

describe('computeConvenienceFee', () => {
  it('applies the given fee rate to the base amount', () => {
    const fee = computeConvenienceFee(1000, 0.015);
    expect(fee.feeAmount).toBe(15);
    expect(fee.totalAmount).toBe(1015);
  });

  it('rounds the fee to 2 decimal places', () => {
    const fee = computeConvenienceFee(333.33, 0.015);
    expect(fee.feeAmount).toBeCloseTo(5, 2);
    expect(Number.isInteger(fee.feeAmount * 100)).toBe(true);
  });

  it('defaults to the CONVENIENCE_FEE_RATE env value when no rate is passed', () => {
    // __tests__/setup-env.ts pins CONVENIENCE_FEE_RATE=0.015
    const fee = computeConvenienceFee(1000);
    expect(fee.feeRate).toBe(0.015);
    expect(fee.feeAmount).toBe(15);
  });

  it('returns zero fee for a zero fee rate', () => {
    const fee = computeConvenienceFee(1000, 0);
    expect(fee.feeAmount).toBe(0);
    expect(fee.totalAmount).toBe(1000);
  });
});

describe('computeSplitDistribution', () => {
  it('returns an empty array when there are no payers', () => {
    expect(computeSplitDistribution(1000, [])).toEqual([]);
  });

  it('splits the cost evenly across all payers', () => {
    const payers = computeSplitDistribution(3000, [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    expect(payers).toHaveLength(3);
    payers.forEach((p) => expect(p.shareAmount).toBe(1000));
  });

  it('adds the convenience fee on top of each payer\'s share', () => {
    const [payer] = computeSplitDistribution(1000, [{ name: 'Solo' }]);
    expect(payer.shareAmount).toBe(1000);
    expect(payer.feeAmount).toBe(15);
    expect(payer.totalDue).toBe(1015);
  });

  it('carries an optional splitId through to each computed payer', () => {
    const payers = computeSplitDistribution(1000, [{ name: 'Temi', splitId: '@temi_split1234' }]);
    expect(payers[0].splitId).toBe('@temi_split1234');
  });

  it('marks every computed payer as pending', () => {
    const payers = computeSplitDistribution(2000, [{ name: 'A' }, { name: 'B' }]);
    expect(payers.every((p) => p.status === 'pending')).toBe(true);
  });

  it('rounds an uneven split to 2 decimal places per payer', () => {
    // 1000 / 3 = 333.333... — each payer's share must still be a clean 2dp value.
    const payers = computeSplitDistribution(1000, [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    payers.forEach((p) => expect(Number.isInteger(p.shareAmount * 100)).toBe(true));
  });
});

describe('computeBasket', () => {
  it('builds a basket with payers computed from totalMarketCost and no id/textCode assigned yet', () => {
    const basket = computeBasket({
      title: 'Moni & Co Market Run',
      items: [{ name: 'Rice', cost: 25000 }],
      totalMarketCost: 30000,
      payerHandles: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      adminId: 'usr_admin1',
    });

    expect(basket.title).toBe('Moni & Co Market Run');
    expect(basket.status).toBe('pending_payments');
    expect(basket.payers).toHaveLength(3);
    expect(basket).not.toHaveProperty('id');
    expect(basket).not.toHaveProperty('textCode');
  });
});

describe('isFullySettled', () => {
  it('is false for an empty payer list', () => {
    expect(isFullySettled([])).toBe(false);
  });

  it('is false when at least one payer is still pending', () => {
    expect(isFullySettled(['paid', 'paid', 'pending'])).toBe(false);
  });

  it('is true only once every payer has paid', () => {
    expect(isFullySettled(['paid', 'paid', 'paid'])).toBe(true);
  });
});
