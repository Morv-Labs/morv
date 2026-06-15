/** Base Mainnet (chainId 8453) — production defaults */

export const BASE_CHAIN_ID = 8453;

/** Native USDC on Base Mainnet */
export const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

export const USDC_DECIMALS = 6;

export const DEFAULT_BASE_RPC =
  process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';

export const SUPPORTED_STABLES = ['USDC', 'USDC.E'] as const;
