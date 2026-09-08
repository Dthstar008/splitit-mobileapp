// src/services/store.ts
// In-memory data store — swap for Postgres/Prisma or MongoDB in production.
// Kept isolated behind this module so routes never touch storage directly.

import { Basket, User } from '../types';

export const users: User[] = [];
export const baskets: Basket[] = [];

export function findUserByEmailOrPhone(identifier: string): User | undefined {
  return users.find((u) => u.email === identifier || u.phone === identifier);
}

export function findBasketByTextCode(code: string): Basket | undefined {
  const normalized = code.trim().toUpperCase();
  return baskets.find((b) => b.textCode.toUpperCase() === normalized);
}

export function findBasketById(id: string): Basket | undefined {
  return baskets.find((b) => b.id === id);
}
