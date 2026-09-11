// __tests__/auth.routes.test.ts
// Route-level coverage for /auth — the gap flagged against Phase 0 item 5
// ("Jest + Supertest for the backend"): split.service.test.ts covers the
// pure math, but nothing previously exercised the routes themselves.
//
// Imports the real app from src/server.ts (full middleware chain: helmet,
// cors, pino-http, the centralized error handler) so this is a genuine
// integration test of the Express layer, not just the handler function in
// isolation. Only the DB-touching functions in services/store are mocked —
// no live Postgres needed to run this.
//
// The "returns 500 instead of crashing" cases below are a direct regression
// test for the bug this session found and fixed: an unhandled rejection
// inside an async route handler used to take the entire process down
// (Express 4 doesn't catch it, and modern Node terminates on an unhandled
// rejection by default). See src/lib/asyncHandler.ts.

import request from 'supertest';

jest.mock('../src/services/store', () => {
  const actual = jest.requireActual('../src/services/store');
  return {
    ...actual, // keep toSafeUser etc. real — they're pure and harmless
    findUserByEmailOrPhone: jest.fn(),
    createUser: jest.fn(),
    updateUserPassword: jest.fn(),
  };
});

import app from '../src/server';
import * as store from '../src/services/store';

const mockedStore = store as jest.Mocked<typeof store>;

const validSignupBody = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+2348000000000',
  password: 'correct-horse',
};

describe('POST /auth/signup', () => {
  it('400s when a required field is missing', async () => {
    const res = await request(app).post('/auth/signup').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('400s when the password is under 6 characters', async () => {
    const res = await request(app).post('/auth/signup').send({ ...validSignupBody, password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('409s when the email or phone is already taken', async () => {
    mockedStore.findUserByEmailOrPhone.mockResolvedValueOnce({ id: 'usr_existing' } as never);
    const res = await request(app).post('/auth/signup').send(validSignupBody);
    expect(res.status).toBe(409);
  });

  it('201s with a user and token on success', async () => {
    mockedStore.findUserByEmailOrPhone.mockResolvedValue(null);
    mockedStore.createUser.mockResolvedValue({
      id: 'usr_new123',
      fullName: validSignupBody.fullName,
      email: validSignupBody.email,
      phone: validSignupBody.phone,
      splitId: '@ada_split1234',
      passwordHash: 'hashed',
      hashAlgorithm: 'BCRYPT',
      payoutBankName: null,
      payoutAccountNumber: null,
      payoutAccountName: null,
      createdAt: new Date(),
    } as never);

    const res = await request(app).post('/auth/signup').send(validSignupBody);
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(validSignupBody.email);
    expect(res.body.user.passwordHash).toBeUndefined(); // never leaks the hash
  });

  it('returns 500 instead of crashing the process when the DB is unreachable', async () => {
    mockedStore.findUserByEmailOrPhone.mockRejectedValueOnce(new Error('P1001: Can\'t reach database server'));
    const res = await request(app).post('/auth/signup').send(validSignupBody);
    expect(res.status).toBe(500);
  });
});

describe('POST /auth/login', () => {
  it('400s when identifier or password is missing', async () => {
    const res = await request(app).post('/auth/login').send({ identifier: 'ada@example.com' });
    expect(res.status).toBe(400);
  });

  it('401s when no user matches', async () => {
    mockedStore.findUserByEmailOrPhone.mockResolvedValueOnce(null);
    const res = await request(app).post('/auth/login').send({ identifier: 'nobody@example.com', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('401s on a wrong password without leaking which field was wrong', async () => {
    const bcrypt = jest.requireActual('bcrypt');
    mockedStore.findUserByEmailOrPhone.mockResolvedValueOnce({
      id: 'usr_1',
      passwordHash: await bcrypt.hash('correct-horse', 12),
      hashAlgorithm: 'BCRYPT',
    } as never);
    const res = await request(app).post('/auth/login').send({ identifier: 'ada@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('200s with a token on correct credentials', async () => {
    const bcrypt = jest.requireActual('bcrypt');
    mockedStore.findUserByEmailOrPhone.mockResolvedValueOnce({
      id: 'usr_1',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+2348000000000',
      splitId: '@ada_split1234',
      passwordHash: await bcrypt.hash('correct-horse', 12),
      hashAlgorithm: 'BCRYPT',
      payoutBankName: null,
      payoutAccountNumber: null,
      payoutAccountName: null,
      createdAt: new Date(),
    } as never);

    const res = await request(app).post('/auth/login').send({ identifier: 'ada@example.com', password: 'correct-horse' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('transparently migrates a legacy SHA-256 hash to bcrypt on successful login', async () => {
    const crypto = jest.requireActual('crypto');
    const legacyHash = crypto.createHash('sha256').update('correct-horse').digest('hex');
    mockedStore.findUserByEmailOrPhone.mockResolvedValueOnce({
      id: 'usr_legacy',
      fullName: 'Legacy User',
      email: 'legacy@example.com',
      phone: '+2348000000001',
      splitId: '@legacy_split1',
      passwordHash: legacyHash,
      hashAlgorithm: 'SHA256_LEGACY',
      payoutBankName: null,
      payoutAccountNumber: null,
      payoutAccountName: null,
      createdAt: new Date(),
    } as never);
    mockedStore.updateUserPassword.mockResolvedValueOnce({} as never);

    const res = await request(app).post('/auth/login').send({ identifier: 'legacy@example.com', password: 'correct-horse' });
    expect(res.status).toBe(200);
    expect(mockedStore.updateUserPassword).toHaveBeenCalledWith('usr_legacy', expect.any(String));
  });

  it('returns 500 instead of crashing the process when the DB is unreachable', async () => {
    mockedStore.findUserByEmailOrPhone.mockRejectedValueOnce(new Error('P1001: Can\'t reach database server'));
    const res = await request(app).post('/auth/login').send({ identifier: 'ada@example.com', password: 'x' });
    expect(res.status).toBe(500);
  });
});
