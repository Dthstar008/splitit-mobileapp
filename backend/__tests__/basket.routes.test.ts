// __tests__/basket.routes.test.ts
// Route-level coverage for /baskets — see auth.routes.test.ts for the
// rationale (Phase 0 item 5 gap) and mocking approach.

import request from 'supertest';

jest.mock('../src/services/store', () => {
  const actual = jest.requireActual('../src/services/store');
  return {
    ...actual, // keep toBasketDTO/toPayerDTO real — pure and harmless
    saveNewBasket: jest.fn(),
    findBasketsByAdmin: jest.fn(),
    findBasketByTextCode: jest.fn(),
    findBasketById: jest.fn(),
    findUserById: jest.fn(),
    findPayerById: jest.fn(),
    setPayerVirtualAccount: jest.fn(),
  };
});

jest.mock('../src/services/payment.service', () => {
  const actual = jest.requireActual('../src/services/payment.service');
  return {
    ...actual, // keep estimatePaystackChargeFeeKobo real — pure and harmless
    createVirtualAccount: jest.fn(),
  };
});

import app from '../src/server';
import * as store from '../src/services/store';
import * as paymentService from '../src/services/payment.service';
import { estimatePaystackChargeFeeKobo } from '../src/services/payment.service';
import { computeConvenienceFee } from '../src/services/split.service';
import { platformFeeKobo } from '../src/routes/basket.routes';
import { signToken } from '../src/middleware/auth.middleware';

const mockedStore = store as jest.Mocked<typeof store>;
const mockedPayment = paymentService as jest.Mocked<typeof paymentService>;

const authHeader = `Bearer ${signToken('usr_admin1')}`;

const fakeBasket = {
  id: 'bskt_abc123',
  textCode: 'SP-ABC123',
  title: 'Market Run',
  totalMarketCost: 3000 as unknown as never, // Prisma Decimal at runtime, plain number is fine for Number()
  status: 'pending_payments',
  qrPayload: '{}',
  createdAt: new Date(),
  adminId: 'usr_admin1',
  items: [],
  payers: [],
  admin: { paystackSubaccountCode: null },
};

const fakeAdmin = { id: 'usr_admin1', fullName: 'Temi Admin', splitId: '@temi_split' };

describe('POST /baskets', () => {
  it('401s without an Authorization header', async () => {
    const res = await request(app).post('/baskets').send({ title: 'x', totalMarketCost: 100, payerHandles: [{ name: 'A' }] });
    expect(res.status).toBe(401);
  });

  it('400s when required fields are missing', async () => {
    const res = await request(app).post('/baskets').set('Authorization', authHeader).send({ title: 'x' });
    expect(res.status).toBe(400);
  });

  it('404s when the admin user no longer exists', async () => {
    mockedStore.findUserById.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/baskets')
      .set('Authorization', authHeader)
      .send({ title: 'Market Run', totalMarketCost: 3000, payerHandles: [{ name: 'Ada' }] });
    expect(res.status).toBe(404);
    expect(mockedStore.saveNewBasket).not.toHaveBeenCalled();
  });

  it('201s and persists a computed basket, with the organizer added as an already-paid payer', async () => {
    mockedStore.findUserById.mockResolvedValueOnce(fakeAdmin as never);
    mockedStore.saveNewBasket.mockResolvedValueOnce(fakeBasket as never);
    const res = await request(app)
      .post('/baskets')
      .set('Authorization', authHeader)
      .send({ title: 'Market Run', totalMarketCost: 3000, payerHandles: [{ name: 'Ada' }, { name: 'Bola' }] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('bskt_abc123');

    const savedArg = mockedStore.saveNewBasket.mock.calls[0][0];
    expect(savedArg.title).toBe('Market Run');
    expect(savedArg.adminId).toBe('usr_admin1');
    // 2 named payers + the organizer = 3, each an equal split of 3000.
    expect(savedArg.payers).toHaveLength(3);
    const organizerPayer = savedArg.payers.find((p) => p.name === 'Temi Admin');
    expect(organizerPayer).toBeDefined();
    expect(organizerPayer!.status).toBe('paid');
    expect(organizerPayer!.amountPaid).toBe(organizerPayer!.totalDue);
    // Everyone else is still genuinely pending — this isn't a basket that
    // silently marks itself fully settled just because the organizer added.
    const otherPayers = savedArg.payers.filter((p) => p.name !== 'Temi Admin');
    expect(otherPayers.every((p) => p.status === 'pending' && p.amountPaid === 0)).toBe(true);
  });

  it('returns 500 instead of crashing when the DB write fails', async () => {
    mockedStore.findUserById.mockResolvedValueOnce(fakeAdmin as never);
    mockedStore.saveNewBasket.mockRejectedValueOnce(new Error('P1001'));
    const res = await request(app)
      .post('/baskets')
      .set('Authorization', authHeader)
      .send({ title: 'Market Run', totalMarketCost: 3000, payerHandles: [{ name: 'Ada' }] });
    expect(res.status).toBe(500);
  });
});

describe('GET /baskets', () => {
  it('401s without an Authorization header', async () => {
    const res = await request(app).get('/baskets');
    expect(res.status).toBe(401);
  });

  it("200s with the admin's baskets", async () => {
    mockedStore.findBasketsByAdmin.mockResolvedValueOnce([fakeBasket] as never);
    const res = await request(app).get('/baskets').set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockedStore.findBasketsByAdmin).toHaveBeenCalledWith('usr_admin1');
  });
});

describe('GET /baskets/code/:textCode', () => {
  it('404s when no basket matches (no auth required — public lookup)', async () => {
    mockedStore.findBasketByTextCode.mockResolvedValueOnce(null);
    const res = await request(app).get('/baskets/code/SP-NOPE');
    expect(res.status).toBe(404);
  });

  it('200s with the basket on a match', async () => {
    mockedStore.findBasketByTextCode.mockResolvedValueOnce(fakeBasket as never);
    const res = await request(app).get('/baskets/code/SP-ABC123');
    expect(res.status).toBe(200);
    expect(res.body.textCode).toBe('SP-ABC123');
  });
});

describe('POST /baskets/:basketId/payers/:payerId/virtual-account', () => {
  const fakePayer = { id: 'payer_1', basketId: 'bskt_abc123', totalDue: 1000 as unknown as never, amountPaid: 0 };

  it('404s when the basket does not exist', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce(null);
    const res = await request(app).post('/baskets/bskt_nope/payers/payer_1/virtual-account');
    expect(res.status).toBe(404);
  });

  it('404s when the payer does not exist on that basket', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce(fakeBasket as never);
    mockedStore.findPayerById.mockResolvedValueOnce(null);
    const res = await request(app).post('/baskets/bskt_abc123/payers/payer_nope/virtual-account');
    expect(res.status).toBe(404);
  });

  it('200s with a generated virtual account on success', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce(fakeBasket as never);
    mockedStore.findPayerById.mockResolvedValueOnce(fakePayer as never);
    mockedPayment.createVirtualAccount.mockResolvedValueOnce({
      bankName: 'Wema Bank',
      accountNumber: '9912345678',
      accountName: 'SplitIt / BSKT_ABC123',
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    });
    mockedStore.setPayerVirtualAccount.mockResolvedValueOnce({} as never);

    const res = await request(app).post('/baskets/bskt_abc123/payers/payer_1/virtual-account');
    expect(res.status).toBe(200);
    expect(res.body.bankName).toBe('Wema Bank');
    expect(mockedStore.setPayerVirtualAccount).toHaveBeenCalled();
  });
});

describe('platformFeeKobo — the fee-free-payout guarantee at the real production rate', () => {
  // Not the pinned test-env rate (__tests__/setup-env.ts keeps that at
  // 0.015 deliberately, for unrelated tests that just exercise the env
  // wiring) — this explicitly uses the actual production
  // CONVENIENCE_FEE_RATE (see backend/.env.example) so this test would
  // fail the moment that rate stopped being high enough, which is exactly
  // what it exists to catch.
  const PRODUCTION_FEE_RATE = 0.0575;

  it('never clamps to 0 across a realistic sweep of basket sizes — SplitIt always has enough margin to fully absorb Paystack\'s fee', () => {
    // ₦100 up to ₦500,000 total basket cost, split across 1-6 payers —
    // covers everything from "one person grabbing a small top-up item" to
    // "a large group's monthly bulk buy."
    const totalCosts = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000];
    const payerCounts = [1, 2, 3, 4, 5, 6];

    for (const totalCost of totalCosts) {
      for (const payerCount of payerCounts) {
        const shareAmount = Math.round((totalCost / payerCount) * 100) / 100;
        const fee = computeConvenienceFee(shareAmount, PRODUCTION_FEE_RATE);
        const payer = { totalDue: fee.totalAmount, feeAmount: fee.feeAmount };
        const chargeKobo = Math.round(fee.totalAmount * 100);

        const nominalShareKobo = Math.round(fee.feeAmount * 100);
        const paystackFee = estimatePaystackChargeFeeKobo(chargeKobo);
        const result = platformFeeKobo(payer, chargeKobo);

        // The real assertion: this basket size didn't hit the floor. If it
        // did, `result` would be silently clamped to 0 (via Math.max) and
        // this equality would fail — that's the guarantee breaking.
        expect(result).toBe(nominalShareKobo - paystackFee);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
