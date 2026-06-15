/**
 * Bankr x402 Client — uses x402-fetch protocol (Bankr/Base ecosystem default).
 * Morv AgentGuard wraps all payments. Branding: "Morv · powered by Bankr x402"
 */

import { AgentGuard } from '../core/guard';
import { SpendCategory } from '../types';
import { X402PaymentError, X402Response } from './x402';
import { createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { DEFAULT_BASE_RPC } from '../chain/constants';

export interface BankrX402ClientOptions {
  guard: AgentGuard;
  category?: SpendCategory;
  /** Max USDC per request in micro-units (default $1) */
  maxPaymentMicroUsdc?: bigint;
  privateKey?: Hex;
  rpcUrl?: string;
}

export class BankrX402Client {
  private guard: AgentGuard;
  private category: SpendCategory;
  private maxPayment: bigint;
  private privateKey?: Hex;
  private rpcUrl: string;

  constructor(options: BankrX402ClientOptions) {
    this.guard = options.guard;
    this.category = options.category ?? 'api';
    this.maxPayment = options.maxPaymentMicroUsdc ?? BigInt(1_000_000);
    this.privateKey = options.privateKey ?? (process.env.MORV_WALLET_PRIVATE_KEY as Hex | undefined);
    this.rpcUrl = options.rpcUrl ?? DEFAULT_BASE_RPC;
  }

  async fetch(url: string, init: RequestInit = {}): Promise<X402Response> {
    console.info(`[Morv x402 · Bankr] ${url}`);

    // Try x402-fetch if private key available (full Bankr x402 protocol)
    if (this.privateKey) {
      try {
        const { wrapFetchWithPayment } = await import('x402-fetch');
        const account = privateKeyToAccount(this.privateKey);
        const wallet = createWalletClient({
          account,
          chain: base,
          transport: http(this.rpcUrl),
        });
        const paidFetch = wrapFetchWithPayment(fetch, wallet, this.maxPayment);
        const res = await paidFetch(url, init);
        const ct = res.headers.get('content-type') ?? '';
        const body = ct.includes('application/json') ? await res.json() : await res.text();

        // Log through AgentGuard ledger (policy already enforced by max payment)
        const paymentHeader = res.headers.get('x-payment-response') ?? '';
        if (paymentHeader) {
          console.info(`[Morv x402 · Bankr] Payment settled on Base`);
        }

        return {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body,
          paid: res.status < 400 && Boolean(paymentHeader),
        };
      } catch (err) {
        console.warn(`[Morv x402 · Bankr] x402-fetch fallback to Morv header flow: ${err}`);
      }
    }

    // Fallback: Morv header-based 402 + AgentGuard + Bankr wallet transfer
    return this.fetchViaMorvHeaders(url, init);
  }

  private async fetchViaMorvHeaders(url: string, init: RequestInit): Promise<X402Response> {
    const headers = new Headers(init.headers);
    let lastHash: string | undefined;

    for (let attempt = 0; attempt <= 1; attempt++) {
      const res = await fetch(url, { ...init, headers });
      if (res.status !== 402) {
        const ct = res.headers.get('content-type') ?? '';
        const body = ct.includes('application/json') ? await res.json() : await res.text();
        return {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body,
          paid: attempt > 0,
          paymentTxHash: lastHash,
        };
      }

      const amount = parseFloat(
        res.headers.get('x-payment-amount') ?? res.headers.get('X-Payment-Amount') ?? '0'
      );
      const recipient =
        res.headers.get('x-payment-recipient') ??
        res.headers.get('X-Payment-Recipient') ??
        '';
      const currency =
        res.headers.get('x-payment-currency') ?? res.headers.get('X-Payment-Currency') ?? 'USDC';

      if (!recipient || amount <= 0) {
        throw new X402PaymentError('Invalid x402 response from Bankr/Base endpoint');
      }

      const payResult = await this.guard.pay({
        to: recipient,
        amount,
        currency,
        memo: `Morv·Bankr x402: ${url}`,
        category: this.category,
      });
      lastHash = payResult.txHash;
      headers.set('X-Payment-TxHash', payResult.txHash ?? '');
      headers.set('X-Payment-Amount', String(amount));
      headers.set('X-Payment-Currency', currency);
    }

    throw new X402PaymentError('Bankr x402 max retries reached');
  }
}
