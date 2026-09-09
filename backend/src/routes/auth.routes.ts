// src/routes/auth.routes.ts
// Phase 0 item 2: password hashing. SHA-256 (crypto.createHash) is a fast
// general-purpose hash — cheap to brute-force at scale on GPUs — so it's
// replaced with bcrypt, a slow, salted algorithm built for passwords.
//
// Migration path for any account created under the old scheme: hashAlgorithm
// on the user row is tagged SHA256_LEGACY. On that user's next successful
// login, verifyPassword falls back to the legacy comparison, and if it
// matches we transparently re-hash the password with bcrypt and flip the
// tag to BCRYPT — no forced password reset, no downtime.

import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createUser, findUserByEmailOrPhone, toSafeUser, updateUserPassword } from '../services/store';
import { signToken } from '../middleware/auth.middleware';
import { logger } from '../lib/logger';

const router = Router();

const BCRYPT_ROUNDS = 12;

function legacySha256(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Returns true if `password` matches, regardless of which algorithm the stored hash used. */
async function verifyPassword(
  password: string,
  user: { passwordHash: string; hashAlgorithm: 'SHA256_LEGACY' | 'BCRYPT' }
): Promise<boolean> {
  if (user.hashAlgorithm === 'BCRYPT') {
    return bcrypt.compare(password, user.passwordHash);
  }
  // Legacy path — constant-time compare against the old sha256 digest.
  const candidate = Buffer.from(legacySha256(password));
  const stored = Buffer.from(user.passwordHash);
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

function generateSplitId(fullName: string): string {
  const base = fullName.trim().split(' ')[0]?.toLowerCase() || 'user';
  return `@${base}_split${Math.floor(1000 + Math.random() * 9000)}`;
}

// POST /auth/signup
router.post('/signup', async (req, res) => {
  const { fullName, email, phone, password } = req.body ?? {};

  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ error: 'fullName, email, phone and password are all required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if ((await findUserByEmailOrPhone(email)) || (await findUserByEmailOrPhone(phone))) {
    return res.status(409).json({ error: 'An account with that email or phone already exists' });
  }

  const user = await createUser({
    fullName,
    email,
    phone,
    passwordHash: await hashPassword(password),
    hashAlgorithm: 'BCRYPT',
    splitId: generateSplitId(fullName),
  });

  const token = signToken(user.id);
  res.status(201).json({ user: toSafeUser(user), token });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body ?? {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'identifier and password are required' });
  }

  const user = await findUserByEmailOrPhone(identifier);
  if (!user || !(await verifyPassword(password, user))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.hashAlgorithm === 'SHA256_LEGACY') {
    logger.info({ userId: user.id }, 'migrating legacy sha256 password hash to bcrypt on login');
    await updateUserPassword(user.id, await hashPassword(password));
  }

  const token = signToken(user.id);
  res.json({ user: toSafeUser(user), token });
});

export default router;
