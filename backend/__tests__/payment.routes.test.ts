// __tests__/payment.routes.test.ts
// Coverage for the "Pay with Bank" flow: GET /payments/banks and the two
// charge-bank endpoints on basket.routes.ts. Mocks payment.service so no
// live Paystack key or network call is involved — these test the route
// wiring and validation, not Paystack itself (payment.service.ts's mock
// branches are exercised implicitly by not being mocked here).

import request from 'supertest';

jest.mock('../src/services/store', () => {
  const actual = jest.requireActual('../src/services/store');
  return {
    ...actual,
    findBasketById: jest.fn(),
    findPayerById: jest.fn(),
  };
});

jest.mock('../src/services/payment.service', () => {
  const actual = jest.requireActual('../src/services/payment.service');
  return {
    ...actual, // keep estimatePaystackChargeFeeKobo real — pure and harmless
    listBanks: jest.fn(),
    chargeBankAccount: jest.fn(),
    submitChargeOtp: jest.fn(),
    submitChargeBirthday: jest.fn(),
    createVirtualAccount: jest.fn(),
  };
});

import app from '../src/server';
import * as store from '../src/services/store';
import * as paymentService from '../src/services/payment.service';

const mockedStore = store as jest.Mocked<typeof store>;
const mockedPayment = paymentService as jest.Mocked<typeof paymentService>;

const fakeBasket = { id: 'bskt_1', payers: [], admin: { paystackSubaccountCode: null } };
const pendingPayer = { id: 'payer_1', basketId: 'bskt_1', totalDue: 10.15, feeAmount: 0.15, amountPaid: 0, status: 'pending' };
const paidPayer = { id: 'payer_2', basketId: 'bskt_1', totalDue: 10.15, feeAmount: 0.15, amountPaid: 10.15, status: 'paid' };

describe('GET /payments/banks', () => {
  it('200s with the bank list', async () => {
    mockedPayment.listBanks.mockResolvedValueOnce([{ name: 'Wema Bank', code: '035', slug: 'wema-bank' }]);
    const res = await request(app).get('/payments/banks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: 'Wema Bank', code: '035', slug: 'wema-bank' }]);
  });

  it('returns 500 instead of crashing when the bank list fetch fails', async () => {
    mockedPayment.listBanks.mockRejectedValueOnce(new Error('Paystack unreachable'));
    const res = await request(app).get('/payments/banks');
    expect(res.status).toBe(500);
  });
});

describe('POST /baskets/:basketId/payers/:payerId/charge-bank', () => {
  it('400s when bankCode or accountNumber is missing', async () => {
    const res = await request(app).post('/baskets/bskt_1/payers/payer_1/charge-bank').send({ bankCode: '035' });
    expect(res.status).toBe(400);
  });

  it('404s when the basket does not exist', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/baskets/bskt_nope/payers/payer_1/charge-bank')
      .send({ bankCode: '035', accountNumber: '0123456789' });
    expect(res.status).toBe(404);
  });

  it('404s when the payer does not exist on that basket', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce(fakeBasket as never);
    mockedStore.findPayerById.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/baskets/bskt_1/payers/payer_nope/charge-bank')
      .send({ bankCode: '035', accountNumber: '0123456789' });
    expect(res.status).toBe(404);
  });

  it('409s when the payer has already paid', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce(fakeBasket as never);
    mockedStore.findPayerById.mockResolvedValueOnce(paidPayer as never);
    const res = await request(app)
      .post('/baskets/bskt_1/payers/payer_2/charge-bank')
      .send({ bankCode: '035', accountNumber: '0123456789' });
    expect(res.status).toBe(409);
  });

  it('200s and forwards the amount due (converted to kobo) to the charge', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce(fakeBasket as never);
    mockedStore.findPayerById.mockResolvedValueOnce(pendingPayer as never);
    mockedPayment.chargeBankAccount.mockResolvedValueOnce({ status: 'send_otp', reference: 'chg_1' });

    const res = await request(app)
      .post('/baskets/bskt_1/payers/payer_1/charge-bank')
      .send({ bankCode: '035', accountNumber: '0123456789' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'send_otp', reference: 'chg_1' });
    expect(mockedPayment.chargeBankAccount).toHaveBeenCalledWith(
      expect.objectContaining({ basketId: 'bskt_1', payerId: 'payer_1', bankCode: '035', accountNumber: '0123456789', amountKobo: 1015 })
    );
  });

  it('returns 500 instead of crashing when the charge call throws', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce(fakeBasket as never);
    mockedStore.findPayerById.mockResolvedValueOnce(pendingPayer as never);
    mockedPayment.chargeBankAccount.mockRejectedValueOnce(new Error('Paystack unreachable'));

    const res = await request(app)
      .post('/baskets/bskt_1/payers/payer_1/charge-bank')
      .send({ bankCode: '035', accountNumber: '0123456789' });
    expect(res.status).toBe(500);
  });
});

describe('POST /baskets/:basketId/payers/:payerId/charge-bank/submit-otp', () => {
  it('400s when reference or otp is missing', async () => {
    const res = await request(app).post('/baskets/bskt_1/payers/payer_1/charge-bank/submit-otp').send({ otp: '123456' });
    expect(res.status).toBe(400);
  });

  it('200s with the final charge status on a correct OTP', async () => {
    mockedPayment.submitChargeOtp.mockResolvedValueOnce({ status: 'success', reference: 'chg_1' });
    const res = await request(app)
      .post('/baskets/bskt_1/payers/payer_1/charge-bank/submit-otp')
      .send({ reference: 'chg_1', otp: '123456' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', reference: 'chg_1' });
  });

  it('200s with a failed status (not an HTTP error) on a wrong OTP', async () => {
    mockedPayment.submitChargeOtp.mockResolvedValueOnce({ status: 'failed', reference: 'chg_1', message: 'Incorrect OTP' });
    const res = await request(app)
      .post('/baskets/bskt_1/payers/payer_1/charge-bank/submit-otp')
      .send({ reference: 'chg_1', otp: '000000' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('failed');
  });
});

describe('POST /baskets/:basketId/payers/:payerId/charge-bank/submit-birthday', () => {
  it('400s when reference or birthday is missing', async () => {
    const res = await request(app)
      .post('/baskets/bskt_1/payers/payer_1/charge-bank/submit-birthday')
      .send({ birthday: '2008-09-15' });
    expect(res.status).toBe(400);
  });

  it('400s when birthday is not YYYY-MM-DD', async () => {
    const res = await request(app)
      .post('/baskets/bskt_1/payers/payer_1/charge-bank/submit-birthday')
      .send({ reference: 'chg_1', birthday: '15-09-2008' });
    expect(res.status).toBe(400);
    expect(mockedPayment.submitChargeBirthday).not.toHaveBeenCalled();
  });

  it('200s with the final charge status on a correct birthday', async () => {
    mockedPayment.submitChargeBirthday.mockResolvedValueOnce({ status: 'success', reference: 'chg_1' });
    const res = await request(app)
      .post('/baskets/bskt_1/payers/payer_1/charge-bank/submit-birthday')
      .send({ reference: 'chg_1', birthday: '2008-09-15' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', reference: 'chg_1' });
    expect(mockedPayment.submitChargeBirthday).toHaveBeenCalledWith({ reference: 'chg_1', birthday: '2008-09-15' });
  });

  it('200s with a failed status (not an HTTP error) on a wrong birthday', async () => {
    mockedPayment.submitChargeBirthday.mockResolvedValueOnce({ status: 'failed', reference: 'chg_1', message: 'Incorrect birthday' });
    const res = await request(app)
      .post('/baskets/bskt_1/payers/payer_1/charge-bank/submit-birthday')
      .send({ reference: 'chg_1', birthday: '2000-01-01' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('failed');
  });
});
