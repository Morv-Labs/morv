/**
 * Wallet Adapters — Bankr, Privy, Mock, Generic (BYOW)
 */

import { WalletAdapter } from '../types';

export class BankrWallet implements WalletAdapter {
  private apiKey: string;
  private agentAddress: string;
  private chain: string;

  constructor(options: { apiKey: string; agentAddress: string; chain?: string }) {
    this.apiKey = options.apiKey;
    this.agentAddress = options.agentAddress;
    this.chain = options.chain ?? 'base';
  }

  async pay(params: { to: string; amount: number; currency: string }): Promise<string | undefined> {
    const res = await fetch('https://api.bankr.bot/v1/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.agentAddress,
        to: params.to,
        amount: String(params.amount),
        currency: params.currency,
        chain: this.chain,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Bankr payment failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { tx_hash?: string; txHash?: string };
    return data.tx_hash ?? data.txHash;
  }

  async getBalance(currency = 'USDC'): Promise<number> {
    const res = await fetch(
      `https://api.bankr.bot/v1/balance?address=${this.agentAddress}&currency=${currency}&chain=${this.chain}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as { balance?: string };
    return parseFloat(data.balance ?? '0');
  }

  getAddress(): string {
    return this.agentAddress;
  }
}

export class PrivyWallet implements WalletAdapter {
  private appId: string;
  private privateKey: string;
  private address: string;

  constructor(options: { appId: string; privateKey: string; address: string }) {
    this.appId = options.appId;
    this.privateKey = options.privateKey;
    this.address = options.address;
  }

  async pay(params: { to: string; amount: number; currency: string }): Promise<string | undefined> {
    const res = await fetch('https://auth.privy.io/api/v1/wallets/send_transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'privy-app-id': this.appId,
        Authorization: `Bearer ${this.privateKey}`,
      },
      body: JSON.stringify({
        from: this.address,
        to: params.to,
        value: params.amount,
        token: params.currency,
        chain_id: 8453,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Privy payment failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { hash?: string; tx_hash?: string };
    return data.hash ?? data.tx_hash;
  }

  getAddress(): string {
    return this.address;
  }
}

export interface MockPayment {
  txHash: string;
  to: string;
  amount: number;
  currency: string;
  timestamp: number;
}

export class MockWallet implements WalletAdapter {
  private _balance: number;
  private _failRate: number;
  private _payments: MockPayment[] = [];

  constructor(options: { balanceUsd?: number; failRate?: number } = {}) {
    this._balance = options.balanceUsd ?? 1000;
    this._failRate = options.failRate ?? 0;
  }

  async pay(params: { to: string; amount: number; currency: string }): Promise<string | undefined> {
    if (this._failRate > 0 && Math.random() < this._failRate) {
      throw new Error(`MockWallet: Simulated failure (failRate=${this._failRate})`);
    }
    if (params.amount > this._balance) {
      throw new Error(
        `MockWallet: Insufficient balance. Need $${params.amount}, have $${this._balance}`
      );
    }
    this._balance -= params.amount;
    const txHash = `0xmock_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this._payments.push({
      txHash,
      to: params.to,
      amount: params.amount,
      currency: params.currency,
      timestamp: Date.now(),
    });
    return txHash;
  }

  async getBalance(): Promise<number> {
    return this._balance;
  }

  getAddress(): string {
    return '0xMockWallet0000000000000000000000000000000';
  }

  get payments(): MockPayment[] {
    return [...this._payments];
  }

  reset(balance = 1000): void {
    this._balance = balance;
    this._payments = [];
  }
}

export class GenericWallet implements WalletAdapter {
  private payFn: (to: string, amount: number, currency: string) => Promise<string | undefined>;
  private address: string;

  constructor(options: {
    address: string;
    payFn: (to: string, amount: number, currency: string) => Promise<string | undefined>;
  }) {
    this.address = options.address;
    this.payFn = options.payFn;
  }

  async pay(params: { to: string; amount: number; currency: string }): Promise<string | undefined> {
    return this.payFn(params.to, params.amount, params.currency);
  }

  getAddress(): string {
    return this.address;
  }
}
