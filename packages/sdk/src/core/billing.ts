/**
 * Morv Billing Client — reports usage to control plane (private money layer).
 */

export interface BillingClientOptions {
  apiBaseUrl: string;
  apiKey?: string;
}

export interface RecordUsageParams {
  agentId: string;
  toolId?: string;
  amountUsd: number;
  category?: string;
}

export class BillingClient {
  constructor(private options: BillingClientOptions) {}

  async register(email?: string): Promise<{ accountId: string; apiKey: string; creditsUsd?: number }> {
    const res = await fetch(`${this.options.apiBaseUrl}/billing/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(`Registration failed: ${await res.text()}`);
    return res.json() as Promise<{ accountId: string; apiKey: string }>;
  }

  async recordUsage(params: RecordUsageParams): Promise<void> {
    if (!this.options.apiKey) return;
    try {
      await fetch(`${this.options.apiBaseUrl}/billing/usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify(params),
      });
    } catch {
      // Non-blocking — local agent should still work offline
    }
  }

  async getUsage(): Promise<unknown> {
    if (!this.options.apiKey) throw new Error('API key required');
    const res = await fetch(`${this.options.apiBaseUrl}/billing/usage`, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch usage: ${await res.text()}`);
    return res.json();
  }

  async getStatement(): Promise<unknown> {
    if (!this.options.apiKey) throw new Error('API key required');
    const res = await fetch(`${this.options.apiBaseUrl}/billing/statement`, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch statement: ${await res.text()}`);
    return res.json();
  }
}
