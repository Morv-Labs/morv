/**
 * AgentGuard — Core spending policy enforcer.
 * Drop-in replacement for wallet.pay() with 9 policy checks.
 */

import { Policy } from './policy';
import { SpendTracker } from './tracker';
import { Notifier } from '../alerts/notifier';
import { runAllChecks } from '../checks';
import {
  WalletAdapter,
  PolicyConfig,
  SpendCategory,
  PaymentResult,
  AgentStatus,
  Transaction,
} from '../types';

export class PolicyViolationError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = 'PolicyViolationError';
  }
}

export class AgentPausedError extends Error {
  constructor(public reason: string) {
    super(`Agent is paused: ${reason}. Call guard.resume() to reactivate.`);
    this.name = 'AgentPausedError';
  }
}

export class AnomalyDetectedError extends PolicyViolationError {
  constructor(reason: string) {
    super(reason);
    this.name = 'AnomalyDetectedError';
  }
}

export interface AgentGuardOptions {
  agentId: string;
  wallet: WalletAdapter;
  policy: PolicyConfig;
  dbPath?: string;
  usdPriceFn?: (currency: string) => Promise<number>;
}

export interface PayParams {
  to: string;
  amount: number;
  currency?: string;
  memo?: string;
  category?: SpendCategory;
}

export class AgentGuard {
  readonly agentId: string;
  private wallet: WalletAdapter;
  private policy: Policy;
  private tracker: SpendTracker;
  private notifier: Notifier;
  private usdPriceFn?: (currency: string) => Promise<number>;

  constructor(options: AgentGuardOptions) {
    this.agentId = options.agentId;
    this.wallet = options.wallet;
    this.policy = new Policy(options.policy);
    this.tracker = new SpendTracker(options.dbPath ?? 'morv.db');
    this.notifier = new Notifier(this.policy);
    this.usdPriceFn = options.usdPriceFn;
  }

  async pay(params: PayParams): Promise<PaymentResult> {
    const {
      to,
      amount,
      currency = 'USDC',
      memo = '',
      category = 'general',
    } = params;

    const amountUsd = await this.toUsd(amount, currency);

    const { paused, reason: pauseReason } = this.tracker.isPaused(this.agentId);
    if (paused) throw new AgentPausedError(pauseReason ?? 'Manual pause');

    const result = runAllChecks({
      agentId: this.agentId,
      amountUsd,
      toAddress: to,
      category,
      policy: this.policy,
      tracker: this.tracker,
    });

    if (!result.pass) {
      this.tracker.record({
        agentId: this.agentId,
        toAddress: to,
        amountUsd,
        currency,
        category,
        memo,
        timestamp: Date.now() / 1000,
        status: 'rejected',
        rejectionReason: result.reason,
      });

      await this.notifier.onBlocked(this.agentId, result.reason, amountUsd, to);

      if (this.policy.config.autoPause && this.policy.config.pauseStrategy === 'pause') {
        this.tracker.setPaused(this.agentId, true, result.reason);
        await this.notifier.onPaused(this.agentId, result.reason);
      }

      const isAnomaly = result.reason.includes('anomaly');
      if (isAnomaly) throw new AnomalyDetectedError(result.reason);
      throw new PolicyViolationError(result.reason);
    }

    if (result.warn) await this.notifier.onWarning(this.agentId, result.warn);

    const txHash = await this.wallet.pay({ to, amount, currency });

    this.tracker.record({
      agentId: this.agentId,
      toAddress: to,
      amountUsd,
      currency,
      category,
      memo,
      txHash: txHash ?? undefined,
      timestamp: Date.now() / 1000,
      status: 'approved',
    });

    return { txHash: txHash ?? undefined, amountUsd, to, memo, timestamp: Date.now() };
  }

  pause(reason = 'Manual pause'): void {
    this.tracker.setPaused(this.agentId, true, reason);
    void this.notifier.onPaused(this.agentId, reason);
  }

  resume(): void {
    this.tracker.setPaused(this.agentId, false);
    void this.notifier.onResumed(this.agentId);
  }

  status(): AgentStatus {
    const s = this.tracker.summary(this.agentId);
    return {
      ...s,
      policy: {
        dailyLimitUsd: this.policy.config.dailyLimitUsd,
        perTxLimitUsd: this.policy.config.perTxLimitUsd,
        dailyRemainingUsd: Number(
          (this.policy.config.dailyLimitUsd - s.spentTodayUsd).toFixed(4)
        ),
        autoPause: this.policy.config.autoPause,
      },
    };
  }

  history(limit = 50): Transaction[] {
    return this.tracker.getHistory(this.agentId, limit);
  }

  destroy(): void {
    this.tracker.close();
  }

  private async toUsd(amount: number, currency: string): Promise<number> {
    const stables = ['USDC', 'USDT', 'DAI', 'USD', 'USDS'];
    if (stables.includes(currency.toUpperCase())) return amount;
    if (this.usdPriceFn) {
      const price = await this.usdPriceFn(currency);
      return amount * price;
    }
    console.warn(`[AgentGuard] No USD price fn for ${currency}, treating as 1:1`);
    return amount;
  }
}
