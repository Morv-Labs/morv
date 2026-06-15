/**
 * AgentGuard Policy Engine
 * Enforces spending rules before every transaction.
 */

import { PolicyConfig } from '../types';

export const DEFAULT_POLICY: Required<PolicyConfig> = {
  dailyLimitUsd: 50,
  weeklyLimitUsd: 300,
  monthlyLimitUsd: 1000,
  perTxLimitUsd: 10,
  whitelist: [],
  blacklist: [],
  categoryLimits: {},
  maxTxPerMinute: 10,
  maxTxPerHour: 100,
  anomalyMultiplier: 3.0,
  autoPause: true,
  pauseStrategy: 'pause',
  cooldownMinutes: 60,
  autoResume: false,
  alertWebhook: '',
  telegramBotToken: '',
  telegramChatId: '',
  warnAtDailyPercent: 0.8,
};

export class Policy {
  readonly config: Required<PolicyConfig>;

  constructor(config: PolicyConfig) {
    this.config = { ...DEFAULT_POLICY, ...config };
    this.validate();
  }

  private validate(): void {
    const c = this.config;
    if (c.dailyLimitUsd <= 0) throw new Error('dailyLimitUsd must be positive');
    if (c.perTxLimitUsd <= 0) throw new Error('perTxLimitUsd must be positive');
    if (c.perTxLimitUsd > c.dailyLimitUsd) {
      throw new Error('perTxLimitUsd cannot exceed dailyLimitUsd');
    }
    if (c.warnAtDailyPercent <= 0 || c.warnAtDailyPercent >= 1) {
      throw new Error('warnAtDailyPercent must be between 0 and 1');
    }
  }
}
