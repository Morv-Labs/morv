/**
 * Credits-only wallet for Morv CLI users.
 * Deducts Morv credits via api.morv.run — platform settles onchain server-side.
 */

import { WalletAdapter } from '../types';
import { CreditClient } from '../core/credits';

export class CreditsOnlyWallet implements WalletAdapter {
  constructor(
    private credits: CreditClient,
    private agentId: string
  ) {}

  async pay(params: {
    to: string;
    amount: number;
    currency: string;
  }): Promise<string | undefined> {
    await this.credits.deduct({
      amountUsd: params.amount,
      agentId: this.agentId,
      memo: `payment ${params.to.slice(0, 12)}…`,
      category: 'payment',
    });
    return undefined;
  }

  async getBalance(_currency?: string): Promise<number> {
    const bal = await this.credits.getBalance();
    return bal.balanceUsd;
  }

  getAddress(): string {
    return 'morv-credits';
  }
}
