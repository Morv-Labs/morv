/**
 * Wallet factory — picks the right adapter from environment.
 *
 * Production (Base mainnet):
 *   MORV_WALLET_PRIVATE_KEY=0x...
 *   BASE_RPC_URL=https://mainnet.base.org  (optional)
 *
 * Bankr:
 *   BANKR_API_KEY=...
 *   BANKR_AGENT_ADDRESS=0x...
 */

import type { Hex } from 'viem';
import { WalletAdapter } from '../types';
import { BaseWallet } from './base-wallet';
import { BankrWallet } from './wallets';
import { MockWallet } from './wallets';
import { CreditClient } from '../core/credits';
import { CreditsOnlyWallet } from './credits-only-wallet';

export type WalletMode = 'base' | 'bankr' | 'credits';

/** Platform wallet — pays onchain (Bankr/Base). Owner env only. */
export function createPlatformWalletFromEnv(options?: {
  allowMock?: boolean;
}): WalletAdapter {
  const pk = process.env.MORV_WALLET_PRIVATE_KEY;
  if (pk) {
    return new BaseWallet({
      privateKey: pk as Hex,
      rpcUrl: process.env.BASE_RPC_URL,
      waitForReceipt: process.env.MORV_SKIP_RECEIPT_WAIT !== 'true',
    });
  }

  const bankrKey = process.env.BANKR_API_KEY;
  const bankrAddr = process.env.BANKR_AGENT_ADDRESS;
  if (bankrKey && bankrAddr) {
    return new BankrWallet({
      apiKey: bankrKey,
      agentAddress: bankrAddr,
      chain: 'base',
    });
  }

  if (process.env.NODE_ENV === 'production' && !options?.allowMock) {
    throw new Error(
      'Production wallet not configured. Set MORV_WALLET_PRIVATE_KEY or BANKR_API_KEY + BANKR_AGENT_ADDRESS'
    );
  }

  if (options?.allowMock !== false) {
    console.warn('[Morv] Using MockWallet — not for production mainnet');
    return new MockWallet({ balanceUsd: 1000 });
  }

  throw new Error('No wallet configured');
}

/** @deprecated Alias for createPlatformWalletFromEnv */
export const createWalletFromEnv = createPlatformWalletFromEnv;

/**
 * User wallet — Morv credits via api.morv.run (sign up at morv.run first).
 */
export function createUserWalletFromEnv(options: {
  apiBaseUrl: string;
  apiKey: string;
  agentId: string;
}): CreditsOnlyWallet {
  const credits = new CreditClient({
    apiBaseUrl: options.apiBaseUrl,
    apiKey: options.apiKey,
  });
  return new CreditsOnlyWallet(credits, options.agentId);
}

export function detectWalletMode(): WalletMode {
  if (process.env.MORV_WALLET_PRIVATE_KEY) return 'base';
  if (process.env.BANKR_API_KEY && process.env.BANKR_AGENT_ADDRESS) return 'bankr';
  return 'credits';
}
