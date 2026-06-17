/** Minimal viem stubs for monorepo tsc when hoisted types are incomplete */
declare module 'viem' {
  export type Hex = `0x${string}`;

  export interface PublicClient {
    readContract(args: unknown): Promise<bigint>;
    waitForTransactionReceipt(args: unknown): Promise<{ status: string }>;
    getTransactionReceipt(args: { hash: Hex }): Promise<{ status: string; logs: unknown[] }>;
  }

  export interface WalletClient {
    writeContract(args: unknown): Promise<Hex>;
  }

  export function createPublicClient(config: unknown): PublicClient;
  export function createWalletClient(config: unknown): WalletClient;
  export function http(url?: string): unknown;
  export function decodeEventLog(args: unknown): { eventName: string; args: Record<string, unknown> };
  export function parseUnits(value: string, decimals: number): bigint;
  export function formatUnits(value: bigint, decimals: number): string;
  export function encodeFunctionData(args: unknown): Hex;
  export const erc20Abi: readonly unknown[];
}

declare module 'viem/accounts' {
  import type { Hex } from 'viem';
  export function privateKeyToAccount(key: Hex): { address: Hex };
}

declare module 'viem/chains' {
  export const base: { id: number; name: string };
}
