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
    findPayerById: jest.fn(),
    setPayerVirtualAccount: jest.fn(),
  };
});

jest.mock('../src/services/payment.service', () => ({
  createVirtualAccount: jest.fn(),
}));

import app from '../src/server';
import * as store from '../src/services/store';
import * as paymentService from '../src/services/payment.service';
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
};

describe('POST /baskets', () => {
  it('401s without an Authorization header', async () => {
    const res = await request(app).post('/baskets').send({ title: 'x', totalMarketCost: 100, payerHandles: [{ name: 'A' }] });
    expect(res.status).toBe(401);
  });

  it('400s when required fields are missing', async () => {
    const res = await request(app).post('/baskets').set('Authorization', authHeader).send({ title: 'x' });
    expect(res.status).toBe(400);
  });

  it('201s and persists a computed basket on success', async () => {
    mockedStore.saveNewBasket.mockResolvedValueOnce(fakeBasket as never);
    const res = await request(app)
      .post('/baskets')
      .set('Authorization', authHeader)
      .send({ title: 'Market Run', totalMarketCost: 3000, payerHandles: [{ name: 'Ada' }, { name: 'Bola' }] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('bskt_abc123');
    expect(mockedStore.saveNewBasket).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Market Run', adminId: 'usr_admin1' })
    );
  });

  it('returns 500 instead of crashing when the DB write fails', async () => {
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
  const fakePayer = { id: 'payer_1', basketId: 'bskt_abc123', totalDue: 1000 as unknown as never };

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
