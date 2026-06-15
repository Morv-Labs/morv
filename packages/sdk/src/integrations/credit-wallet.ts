/**
 * CreditWallet — user credits + platform wallet (Bankr/Base).
 *
 * User pays with Morv credits. Your Bankr wallet pays onchain to services.
 * Morv branding stays on top; Bankr is the payment rail.
 */

import { WalletAdapter } from '../types';
import { CreditClient, InsufficientCreditsError } from '../core/credits';

export class CreditWallet implements WalletAdapter {
  constructor(
    private platformWallet: WalletAdapter,
    private credits: CreditClient,
    private agentId: string
  ) {}

  async pay(params: {
    to: string;
    amount: number;
    currency: string;
  }): Promise<string | undefined> {
    // 1. Deduct user credits (Morv)
    await this.credits.deduct({
      amountUsd: params.amount,
      agentId: this.agentId,
      memo: `pay ${params.to.slice(0, 10)}...`,
      category: 'payment',
    });

    // 2. Platform wallet pays onchain (Bankr / Base)
    return this.platformWallet.pay(params);
  }

  async getBalance(_currency?: string): Promise<number> {
    const bal = await this.credits.getBalance();
    return bal.balanceUsd;
  }

  getAddress(): string {
    return this.platformWallet.getAddress?.() ?? '';
  }
}

export { InsufficientCreditsError };
