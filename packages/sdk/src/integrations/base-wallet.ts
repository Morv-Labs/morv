/**
 * BaseWallet — production USDC transfers on Base Mainnet via viem.
 *
 * Requires MORV_WALLET_PRIVATE_KEY (never commit this).
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  erc20Abi,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { WalletAdapter } from '../types';
import { USDC_BASE_MAINNET, USDC_DECIMALS, DEFAULT_BASE_RPC } from '../chain/constants';

export interface BaseWalletOptions {
  privateKey: Hex;
  rpcUrl?: string;
  /** Wait for onchain confirmation (recommended for production) */
  waitForReceipt?: boolean;
  confirmationBlocks?: number;
}

export class BaseWallet implements WalletAdapter {
  private account;
  private walletClient;
  private publicClient;
  private waitForReceipt: boolean;

  constructor(options: BaseWalletOptions) {
    if (!options.privateKey.startsWith('0x')) {
      throw new Error('BaseWallet: privateKey must be a 0x-prefixed hex string');
    }
    this.account = privateKeyToAccount(options.privateKey);
    const rpc = options.rpcUrl ?? DEFAULT_BASE_RPC;
    const transport = http(rpc);
    this.walletClient = createWalletClient({ account: this.account, chain: base, transport });
    this.publicClient = createPublicClient({ chain: base, transport });
    this.waitForReceipt = options.waitForReceipt ?? true;
  }

  async pay(params: {
    to: string;
    amount: number;
    currency: string;
  }): Promise<string | undefined> {
    const currency = params.currency.toUpperCase();
    if (currency !== 'USDC') {
      throw new Error(`BaseWallet mainnet only supports USDC, got: ${currency}`);
    }

    const to = params.to as Hex;
    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
      throw new Error(`Invalid recipient address: ${params.to}`);
    }

    const amount = parseUnits(params.amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

    const balance = await this.publicClient.readContract({
      address: USDC_BASE_MAINNET,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [this.account.address],
    });

    if (balance < amount) {
      throw new Error(
        `Insufficient USDC on Base. Need ${params.amount}, have ${formatUnits(balance, USDC_DECIMALS)}`
      );
    }

    const hash = await this.walletClient.writeContract({
      address: USDC_BASE_MAINNET,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to, amount],
      chain: base,
    });

    if (this.waitForReceipt) {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt.status !== 'success') {
        throw new Error(`USDC transfer reverted onchain: ${hash}`);
      }
    }

    return hash;
  }

  async getBalance(_currency = 'USDC'): Promise<number> {
    const balance = await this.publicClient.readContract({
      address: USDC_BASE_MAINNET,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [this.account.address],
    });
    return parseFloat(formatUnits(balance, USDC_DECIMALS));
  }

  getAddress(): string {
    return this.account.address;
  }

  getChainId(): number {
    return base.id;
  }
}
