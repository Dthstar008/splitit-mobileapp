// __tests__/webhook.routes.test.ts
// Route-level coverage for POST /webhooks/paystack — signature verification,
// DB-unique-constraint idempotency (Phase 0 item 4), and the post-ack crash
// containment added this session (see the try/catch note in
// src/routes/webhook.routes.ts: the response is sent before the real work
// happens, so a rejected promise there can't be routed to next(err) — it
// has to be caught locally or it becomes an unhandled rejection).
//
// The handler acks (200) before doing its real work, so a few of these
// tests wait a tick after the response to let that post-ack work settle
// before asserting on it.

import request from 'supertest';
import crypto from 'crypto';

jest.mock('../src/lib/prisma', () => ({
  prisma: { paymentEvent: { create: jest.fn() } },
}));

jest.mock('../src/services/store', () => {
  const actual = jest.requireActual('../src/services/store');
  return {
    ...actual,
    findBasketById: jest.fn(),
    markPayerPaidAndRefreshBasket: jest.fn(),
  };
});

import app from '../src/server';
import { prisma } from '../src/lib/prisma';
import * as store from '../src/services/store';
import { logger } from '../src/lib/logger';

const mockedStore = store as jest.Mocked<typeof store>;
const mockedPaymentEventCreate = prisma.paymentEvent.create as jest.Mock;

const WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET as string;

function sign(rawBody: string): string {
  return crypto.createHmac('sha512', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

function chargeSuccessPayload(overrides: Partial<{ reference: string; amount: number; basketId: string; payerId: string }> = {}) {
  const { reference = 'ref_1', amount = 1015, basketId = 'bskt_1', payerId = 'payer_1' } = overrides;
  return JSON.stringify({
    event: 'charge.success',
    data: {
      reference,
      amount, // kobo
      status: 'success',
      customer: { email: 'ada@example.com' },
      metadata: { basketId, payerId },
    },
  });
}

const tick = () => new Promise((r) => setImmediate(r));

describe('POST /webhooks/paystack — signature verification', () => {
  it('401s with no signature header', async () => {
    const body = chargeSuccessPayload();
    const res = await request(app).post('/webhooks/paystack').set('Content-Type', 'application/json').send(body);
    expect(res.status).toBe(401);
  });

  it('401s with a wrong signature', async () => {
    const body = chargeSuccessPayload();
    const res = await request(app)
      .post('/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'not-the-real-signature')
      .send(body);
    expect(res.status).toBe(401);
  });

  it('400s on a valid signature over malformed JSON', async () => {
    const body = '{not valid json';
    const res = await request(app)
      .post('/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', sign(body))
      .send(body);
    expect(res.status).toBe(400);
  });
});

describe('POST /webhooks/paystack — charge.success processing', () => {
  it('acks 200 immediately and records a PaymentEvent for a full payment', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce({
      id: 'bskt_1',
      payers: [{ id: 'payer_1', totalDue: 10.15 }],
    } as never);
    mockedPaymentEventCreate.mockResolvedValueOnce({});
    mockedStore.markPayerPaidAndRefreshBasket.mockResolvedValueOnce(undefined);

    const body = chargeSuccessPayload({ amount: 1015 }); // 10.15 Naira, matches totalDue exactly
    const res = await request(app)
      .post('/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', sign(body))
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    await tick();
    expect(mockedPaymentEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'applied' }) })
    );
    expect(mockedStore.markPayerPaidAndRefreshBasket).toHaveBeenCalledWith('bskt_1', 'payer_1');
  });

  it('records an underpayment without marking the payer paid', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce({
      id: 'bskt_1',
      payers: [{ id: 'payer_1', totalDue: 50.0 }],
    } as never);
    mockedPaymentEventCreate.mockResolvedValueOnce({});

    const body = chargeSuccessPayload({ amount: 1000 }); // 10 Naira, less than the 50 due
    const res = await request(app)
      .post('/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', sign(body))
      .send(body);

    expect(res.status).toBe(200);
    await tick();
    expect(mockedPaymentEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'underpaid' }) })
    );
    expect(mockedStore.markPayerPaidAndRefreshBasket).not.toHaveBeenCalled();
  });

  it('treats a duplicate delivery (unique constraint violation) as already-handled, not an error', async () => {
    mockedStore.findBasketById.mockResolvedValueOnce({
      id: 'bskt_1',
      payers: [{ id: 'payer_1', totalDue: 10.15 }],
    } as never);
    const { Prisma } = jest.requireActual('@prisma/client');
    mockedPaymentEventCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'x' })
    );
    const infoSpy = jest.spyOn(logger, 'info');

    const body = chargeSuccessPayload({ reference: 'ref_dupe' });
    const res = await request(app)
      .post('/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', sign(body))
      .send(body);

    expect(res.status).toBe(200); // still acked — Paystack shouldn't retry a dupe forever
    await tick();
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'ref_dupe' }),
      'duplicate webhook delivery, already processed'
    );
    expect(mockedStore.markPayerPaidAndRefreshBasket).not.toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it('does not crash the process when post-ack processing throws — logs and stops instead', async () => {
    // This is the regression case: the ack has already gone out by the time
    // this rejects, so there's no res to route an error to. Before this
    // session's fix, an unhandled rejection here would take the whole
    // process down (mirroring the auth.routes.ts crash this fix addresses).
    mockedStore.findBasketById.mockRejectedValueOnce(new Error('P1001: Can\'t reach database server'));
    const errorSpy = jest.spyOn(logger, 'error');

    const body = chargeSuccessPayload({ reference: 'ref_crash_test' });
    const res = await request(app)
      .post('/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', sign(body))
      .send(body);

    expect(res.status).toBe(200); // ack already sent before the failure

    await tick();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'ref_crash_test' }),
      'unhandled error processing charge.success after ack'
    );
    errorSpy.mockRestore();
  });

  it('ignores event types other than charge.success after acking', async () => {
    const body = JSON.stringify({ event: 'transfer.success', data: { reference: 'x' } });
    const res = await request(app)
      .post('/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    await tick();
    expect(mockedPaymentEventCreate).not.toHaveBeenCalled();
  });
});
