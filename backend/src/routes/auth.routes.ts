// src/routes/auth.routes.ts
import { Router } from 'express';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { users, findUserByEmailOrPhone } from '../services/store';
import { signToken } from '../middleware/auth.middleware';
import { User } from '../types';

const router = Router();

function hashPassword(password: string): string {
  // NOTE: swap for bcrypt/argon2 before production — sha256 here keeps the
  // template dependency-light for the mock/demo phase.
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateSplitId(fullName: string): string {
  const base = fullName.trim().split(' ')[0]?.toLowerCase() || 'user';
  return `@${base}_split${Math.floor(1000 + Math.random() * 9000)}`;
}

// POST /auth/signup
router.post('/signup', (req, res) => {
  const { fullName, email, phone, password } = req.body ?? {};

  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ error: 'fullName, email, phone and password are all required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (findUserByEmailOrPhone(email) || findUserByEmailOrPhone(phone)) {
    return res.status(409).json({ error: 'An account with that email or phone already exists' });
  }

  const user: User = {
    id: `usr_${nanoid(8)}`,
    fullName,
    email,
    phone,
    passwordHash: hashPassword(password),
    splitId: generateSplitId(fullName),
  };
  users.push(user);

  const token = signToken(user.id);
  const { passwordHash, ...safeUser } = user;
  res.status(201).json({ user: safeUser, token });
});

// POST /auth/login
router.post('/login', (req, res) => {
  const { identifier, password } = req.body ?? {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'identifier and password are required' });
  }

  const user = findUserByEmailOrPhone(identifier);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user.id);
  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

export default router;
