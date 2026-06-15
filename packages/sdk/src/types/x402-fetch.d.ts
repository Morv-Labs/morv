declare module 'x402-fetch' {
  import type { WalletClient } from 'viem';

  export function wrapFetchWithPayment(
    fetchFn: typeof fetch,
    walletClient: WalletClient,
    maxValue?: bigint
  ): typeof fetch;
}
