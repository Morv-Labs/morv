/**
 * x402 provider factory — env X402_PROVIDER=bankr|morv (default: bankr)
 */

import { AgentGuard } from '../core/guard';
import { SpendCategory } from '../types';
import { X402Client, X402Response } from './x402';
import { BankrX402Client } from './x402-bankr';
import type { Hex } from 'viem';

export type X402Provider = 'bankr' | 'morv';

export interface X402ClientLike {
  fetch(url: string, init?: RequestInit): Promise<X402Response>;
}

export function resolveX402Provider(explicit?: X402Provider): X402Provider {
  const env = (process.env.X402_PROVIDER ?? 'bankr').toLowerCase();
  if (explicit) return explicit;
  if (env === 'morv') return 'morv';
  return 'bankr';
}

export function createX402Client(options: {
  guard: AgentGuard;
  provider?: X402Provider;
  category?: SpendCategory;
  privateKey?: Hex;
}): X402ClientLike {
  const provider = resolveX402Provider(options.provider);

  if (provider === 'bankr') {
    console.info('[Morv] x402 provider: Bankr (Base mainnet) · Morv AgentGuard active');
    return new BankrX402Client({
      guard: options.guard,
      category: options.category ?? 'api',
      privateKey: options.privateKey,
    });
  }

  console.info('[Morv] x402 provider: Morv native client · AgentGuard active');
  return new X402Client({
    guard: options.guard,
    category: options.category ?? 'api',
  });
}
