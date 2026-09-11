// services/api.ts
// Frontend API client for the Express backend in /backend.

import {
  BankOption,
  Basket,
  BasketItem,
  ChargeResult,
  ConvenienceFeeBreakdown,
  Payer,
  User,
  VirtualAccount,
} from '../types';

const FEE_RATE = 0.015; // 1.5% convenience fee

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function randomId(prefix: string, length = 4): string {
  const chars = '0123456789';
  let value = '';
  for (let index = 0; index < length; index += 1) value += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}_${value}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    });
  } catch {
    throw new Error(`Cannot reach SplitIt backend at ${API_BASE_URL}`);
  }

  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    throw new Error((body && typeof body === 'object' && 'error' in body && body.error) || `Request failed (${response.status})`);
  }
  return body as T;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

// ---------- AUTH ----------

export async function signup(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ user: User; token: string }> {
  return request('/auth/signup', { method: 'POST', body: JSON.stringify(input) });
}

export async function login(input: {
  identifier: string; // phone or email
  password: string;
}): Promise<{ user: User; token: string }> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

// ---------- SPLIT ENGINE ----------

export function computeConvenienceFee(baseAmount: number): ConvenienceFeeBreakdown {
  const feeAmount = Math.round(baseAmount * FEE_RATE * 100) / 100;
  return {
    baseAmount,
    feeRate: FEE_RATE,
    feeAmount,
    totalAmount: Math.round((baseAmount + feeAmount) * 100) / 100,
  };
}

// Splits totalCost evenly across payer names/splitIds, applying the 1.5%
// convenience fee on top of each individual share (not the whole basket),
// so SplitIt!! earns the fee per-transaction as each payer settles.
export function computeSplitDistribution(
  totalCost: number,
  payerHandles: { name: string; splitId?: string }[]
): Payer[] {
  if (payerHandles.length === 0) return [];
  const rawShare = Math.round((totalCost / payerHandles.length) * 100) / 100;

  return payerHandles.map((p) => {
    const fee = computeConvenienceFee(rawShare);
    return {
      id: randomId('payer', 5),
      name: p.name,
      splitId: p.splitId,
      shareAmount: rawShare,
      feeAmount: fee.feeAmount,
      totalDue: fee.totalAmount,
      status: 'pending',
    };
  });
}

export async function createBasket(input: {
  title: string;
  items: BasketItem[];
  totalMarketCost: number;
  payerHandles: { name: string; splitId?: string }[];
  adminId: string;
  token: string;
}): Promise<Basket> {
  const { token, adminId: _adminId, ...body } = input;
  return request('/baskets', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(body) });
}

export async function listBaskets(token: string): Promise<Basket[]> {
  return request('/baskets', { headers: authHeaders(token) });
}

// ---------- TEXT CODE LOOKUP ----------

export async function lookupBasketByTextCode(
  code: string,
  _knownBaskets: Basket[] = []
): Promise<Basket | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  try {
    return await request(`/baskets/code/${encodeURIComponent(normalized)}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'No basket found for that code') return null;
    throw error;
  }
}

// ---------- PAYMENTS / VIRTUAL ACCOUNT (Paystack/Monnify mock) ----------

export async function generateVirtualAccount(basketId: string, payerId: string): Promise<VirtualAccount> {
  return request(`/baskets/${encodeURIComponent(basketId)}/payers/${encodeURIComponent(payerId)}/virtual-account`, {
    method: 'POST',
  });
}

// ---------- PAY WITH BANK (Paystack Charge API) ----------

export async function listBanks(): Promise<BankOption[]> {
  return request('/payments/banks');
}

export async function chargeBankAccount(
  basketId: string,
  payerId: string,
  input: { bankCode: string; accountNumber: string }
): Promise<ChargeResult> {
  return request(`/baskets/${encodeURIComponent(basketId)}/payers/${encodeURIComponent(payerId)}/charge-bank`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function submitChargeOtp(
  basketId: string,
  payerId: string,
  input: { reference: string; otp: string }
): Promise<ChargeResult> {
  return request(
    `/baskets/${encodeURIComponent(basketId)}/payers/${encodeURIComponent(payerId)}/charge-bank/submit-otp`,
    { method: 'POST', body: JSON.stringify(input) }
  );
}

// ---------- MULTI-CHANNEL DISPATCH ----------

export function buildWhatsAppShareText(basket: Basket): string {
  const lines = [
    `*${basket.title}* — SplitIt!! 🧾`,
    `Total: ₦${basket.totalMarketCost.toLocaleString()}`,
    `Code: ${basket.textCode}`,
    '',
    ...basket.payers.map((p) => `${p.name}: ₦${p.totalDue.toLocaleString()} (incl. fee)`),
    '',
    `Pay by opening SplitIt!! and entering code ${basket.textCode}.`,
  ];
  return lines.join('\n');
}

export async function dispatchViaWhatsApp(basket: Basket): Promise<{ url: string }> {
  const text = encodeURIComponent(buildWhatsAppShareText(basket));
  return { url: `https://wa.me/?text=${text}` };
}

export async function dispatchViaEmail(basket: Basket, toEmails: string[]): Promise<{ sent: boolean }> {
  // There is no email route in the backend yet; preserve the client share flow.
  console.log('[mock email dispatch]', { toEmails, subject: basket.title, body: buildWhatsAppShareText(basket) });
  return { sent: true };
}

export function generateTextCode(basket: Basket): string {
  return basket.textCode;
}
