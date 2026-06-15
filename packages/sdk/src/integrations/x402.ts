/**
 * x402 Client — auto-handles HTTP 402 Payment Required.
 */

import { AgentGuard } from '../core/guard';
import { SpendCategory, X402PaymentDetails } from '../types';

export class X402PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'X402PaymentError';
  }
}

export interface X402Response {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  paid: boolean;
  paymentTxHash?: string;
}

export interface X402ClientOptions {
  guard: AgentGuard;
  category?: SpendCategory;
  maxRetries?: number;
}

export class X402Client {
  private guard: AgentGuard;
  private category: SpendCategory;
  private maxRetries: number;

  constructor(options: X402ClientOptions) {
    this.guard = options.guard;
    this.category = options.category ?? 'api';
    this.maxRetries = options.maxRetries ?? 1;
  }

  async fetch(url: string, init: RequestInit = {}): Promise<X402Response> {
    const headers = new Headers(init.headers);
    let lastPaymentHash: string | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const res = await fetch(url, { ...init, headers });

      if (res.status !== 402) {
        const ct = res.headers.get('content-type') ?? '';
        const body = ct.includes('application/json') ? await res.json() : await res.text();

        return {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body,
          paid: attempt > 0,
          paymentTxHash: lastPaymentHash,
        };
      }

      if (attempt >= this.maxRetries) {
        throw new X402PaymentError(
          `Server requires payment but max retries (${this.maxRetries}) reached.`
        );
      }

      const payment = this.parse402Headers(res.headers, url);
      console.info(
        `[x402] Server requests $${payment.amount} ${payment.currency} → ${payment.recipient}`
      );

      let payResult;
      try {
        payResult = await this.guard.pay({
          to: payment.recipient,
          amount: payment.amount,
          currency: payment.currency,
          memo: `x402: ${payment.memo || url}`,
          category: this.category,
        });
      } catch (err) {
        throw new X402PaymentError(`x402 payment blocked by AgentGuard: ${err}`);
      }

      lastPaymentHash = payResult.txHash;

      headers.set('X-Payment-TxHash', payResult.txHash ?? '');
      headers.set('X-Payment-Amount', String(payment.amount));
      headers.set('X-Payment-Currency', payment.currency);
    }

    throw new X402PaymentError('Unexpected x402 flow error');
  }

  private parse402Headers(headers: Headers, url: string): X402PaymentDetails {
    const amount = parseFloat(
      headers.get('x-payment-amount') ?? headers.get('X-Payment-Amount') ?? '0'
    );
    const currency =
      headers.get('x-payment-currency') ?? headers.get('X-Payment-Currency') ?? 'USDC';
    const recipient =
      headers.get('x-payment-recipient') ??
      headers.get('X-Payment-Recipient') ??
      headers.get('x-payment-address') ??
      '';
    const memo = headers.get('x-payment-memo') ?? headers.get('X-Payment-Memo') ?? url;
    const network = headers.get('x-payment-network') ?? headers.get('X-Payment-Network') ?? 'base';

    if (!recipient) {
      throw new X402PaymentError(`x402: No recipient address in 402 response from ${url}`);
    }
    if (isNaN(amount) || amount <= 0) {
      throw new X402PaymentError(`x402: Invalid payment amount from ${url}`);
    }

    return { amount, currency, recipient, memo, network };
  }
}
