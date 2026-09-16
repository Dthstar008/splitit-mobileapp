// __tests__/user.routes.test.ts
// Coverage for POST /users/me/payout-wallet — the route that actually
// wires up Paystack Subaccounts split settlement (was previously a dead
// end: the old Profile screen's "Save Payout Wallet" never called a
// backend route at all).

import request from 'supertest';

jest.mock('../src/services/store', () => {
  const actual = jest.requireActual('../src/services/store');
  return {
    ...actual,
    findUserById: jest.fn(),
    updateUserPayoutWallet: jest.fn(),
  };
});

jest.mock('../src/services/payment.service', () => ({
  createOrUpdateSubaccount: jest.fn(),
}));

import app from '../src/server';
import * as store from '../src/services/store';
import * as paymentService from '../src/services/payment.service';
import { signToken } from '../src/middleware/auth.middleware';

const mockedStore = store as jest.Mocked<typeof store>;
const mockedPayment = paymentService as jest.Mocked<typeof paymentService>;

const authHeader = `Bearer ${signToken('usr_admin1')}`;

const walletBody = {
  bankName: 'Wema Bank',
  bankCode: '035',
  accountNumber: '0123456789',
  accountName: 'Olamide Teju',
};

describe('POST /users/me/payout-wallet', () => {
  it('401s without an Authorization header', async () => {
    const res = await request(app).post('/users/me/payout-wallet').send(walletBody);
    expect(res.status).toBe(401);
  });

  it('400s when a required field is missing', async () => {
    const res = await request(app)
      .post('/users/me/payout-wallet')
      .set('Authorization', authHeader)
      .send({ bankName: 'Wema Bank' });
    expect(res.status).toBe(400);
    expect(mockedPayment.createOrUpdateSubaccount).not.toHaveBeenCalled();
  });

  it('404s when the user no longer exists', async () => {
    mockedStore.findUserById.mockResolvedValueOnce(null);
    const res = await request(app).post('/users/me/payout-wallet').set('Authorization', authHeader).send(walletBody);
    expect(res.status).toBe(404);
  });

  it('creates a fresh subaccount when the user has none yet, then persists it', async () => {
    mockedStore.findUserById.mockResolvedValueOnce({ id: 'usr_admin1', paystackSubaccountCode: null } as never);
    mockedPayment.createOrUpdateSubaccount.mockResolvedValueOnce({ subaccountCode: 'ACCT_new123' });
    mockedStore.updateUserPayoutWallet.mockResolvedValueOnce({
      id: 'usr_admin1',
      fullName: 'Olamide Teju',
      email: 'olamide@example.com',
      phone: '08010000000',
      splitId: '@olamide_split',
      payoutBankName: walletBody.bankName,
      payoutBankCode: walletBody.bankCode,
      payoutAccountNumber: walletBody.accountNumber,
      payoutAccountName: walletBody.accountName,
      paystackSubaccountCode: 'ACCT_new123',
    } as never);

    const res = await request(app).post('/users/me/payout-wallet').set('Authorization', authHeader).send(walletBody);

    expect(res.status).toBe(200);
    expect(mockedPayment.createOrUpdateSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({ ...walletBody, existingSubaccountCode: undefined })
    );
    expect(mockedStore.updateUserPayoutWallet).toHaveBeenCalledWith('usr_admin1', walletBody, 'ACCT_new123');
    expect(res.body.splitActive).toBe(true);
    expect(res.body.payoutWallet).toEqual(walletBody);
  });

  it('updates the existing subaccount (not a new one) when the user already has a payout wallet', async () => {
    mockedStore.findUserById.mockResolvedValueOnce({ id: 'usr_admin1', paystackSubaccountCode: 'ACCT_old1' } as never);
    mockedPayment.createOrUpdateSubaccount.mockResolvedValueOnce({ subaccountCode: 'ACCT_old1' });
    mockedStore.updateUserPayoutWallet.mockResolvedValueOnce({ id: 'usr_admin1', paystackSubaccountCode: 'ACCT_old1' } as never);

    await request(app).post('/users/me/payout-wallet').set('Authorization', authHeader).send(walletBody);

    expect(mockedPayment.createOrUpdateSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({ existingSubaccountCode: 'ACCT_old1' })
    );
  });

  it('returns 500 instead of crashing when Paystack subaccount creation fails', async () => {
    mockedStore.findUserById.mockResolvedValueOnce({ id: 'usr_admin1', paystackSubaccountCode: null } as never);
    mockedPayment.createOrUpdateSubaccount.mockRejectedValueOnce(new Error('Paystack unreachable'));

    const res = await request(app).post('/users/me/payout-wallet').set('Authorization', authHeader).send(walletBody);
    expect(res.status).toBe(500);
    expect(mockedStore.updateUserPayoutWallet).not.toHaveBeenCalled();
  });
});
