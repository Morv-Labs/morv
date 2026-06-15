/**
 * CreditClient — user credits layer (Morv backend).
 *
 * User sees credits. Platform Bankr wallet pays onchain.
 * Flow: deduct credits → platform wallet executes payment.
 */

export interface CreditClientOptions {
  apiBaseUrl: string;
  apiKey: string;
}

export interface CreditBalance {
  accountId: string;
  balanceUsd: number;
  currency: 'USD' | 'USDC';
}

export interface DeductCreditsParams {
  amountUsd: number;
  agentId: string;
  memo?: string;
  category?: string;
}

export class InsufficientCreditsError extends Error {
  constructor(public balance: number, public required: number) {
    super(`Insufficient Morv credits. Balance: $${balance.toFixed(2)}, required: $${required.toFixed(2)}`);
    this.name = 'InsufficientCreditsError';
  }
}

export class CreditClient {
  constructor(private options: CreditClientOptions) {}

  async getBalance(): Promise<CreditBalance> {
    const res = await fetch(`${this.options.apiBaseUrl}/credits/balance`, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch credits: ${await res.text()}`);
    return res.json() as Promise<CreditBalance>;
  }

  async deduct(params: DeductCreditsParams): Promise<CreditBalance> {
    const res = await fetch(`${this.options.apiBaseUrl}/credits/deduct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(params),
    });
    if (res.status === 402) {
      const data = (await res.json()) as { balance: number; required: number };
      throw new InsufficientCreditsError(data.balance, data.required);
    }
    if (!res.ok) throw new Error(`Credit deduct failed: ${await res.text()}`);
    return res.json() as Promise<CreditBalance>;
  }

  async topUp(amountUsd: number): Promise<CreditBalance> {
    const res = await fetch(`${this.options.apiBaseUrl}/credits/topup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({ amountUsd }),
    });
    if (!res.ok) throw new Error(`Top-up failed: ${await res.text()}`);
    return res.json() as Promise<CreditBalance>;
  }
}
