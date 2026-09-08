// src/services/payment.service.ts
// Paystack integration layer. Swap the mock branch for a real fetch to
// https://api.paystack.co/dedicated_account once PAYSTACK_SECRET_KEY is live.
// Docs: https://paystack.com/docs/payments/dedicated-virtual-accounts/

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

interface CreateVirtualAccountInput {
  basketId: string;
  payerId: string;
  amountKobo: number;
}

interface VirtualAccountResult {
  bankName: string;
  accountNumber: string;
  accountName: string;
  expiresAt: string;
}

export async function createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccountResult> {
  // MOCK MODE — no live Paystack key configured, return a fake DVA so the
  // frontend flow can be built/demoed end to end without a merchant account.
  if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.startsWith('sk_test_xxx')) {
    const banks = ['Wema Bank', 'Providus Bank', 'Titan Trust Bank'];
    return {
      bankName: banks[Math.floor(Math.random() * banks.length)],
      accountNumber: `99${Math.floor(1000000 + Math.random() * 8999999)}`,
      accountName: `SplitIt / ${input.basketId.toUpperCase()}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    };
  }

  // LIVE MODE — real Paystack Dedicated Virtual Account creation.
  // Requires a Paystack customer to already exist for the payer; simplified
  // here to the core call shape.
  const response = await fetch(`${PAYSTACK_BASE_URL}/dedicated_account`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer: input.payerId,
      preferred_bank: 'wema-bank',
      metadata: { basketId: input.basketId, payerId: input.payerId },
    }),
  });

  const json = (await response.json()) as {
    message?: string;
    data: { bank: { name: string }; account_number: string; account_name: string };
  };
  if (!response.ok) {
    throw new Error(json?.message ?? 'Failed to create Paystack virtual account');
  }

  return {
    bankName: json.data.bank.name,
    accountNumber: json.data.account_number,
    accountName: json.data.account_name,
    expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
  };
}
