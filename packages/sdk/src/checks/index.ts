/**
 * AgentGuard policy checks — each returns { pass, reason, warn? }
 */

import { Policy } from '../core/policy';
import { SpendTracker } from '../core/tracker';

export interface CheckResult {
  pass: boolean;
  reason: string;
  warn?: string;
}

export function checkPerTx(amountUsd: number, policy: Policy): CheckResult {
  const { perTxLimitUsd } = policy.config;
  if (amountUsd > perTxLimitUsd) {
    return {
      pass: false,
      reason: `Per-transaction limit exceeded. Requested: $${amountUsd.toFixed(2)}, Max: $${perTxLimitUsd.toFixed(2)}`,
    };
  }
  const warnThreshold = perTxLimitUsd * 0.9;
  if (amountUsd >= warnThreshold) {
    return {
      pass: true,
      reason: '',
      warn: `Transaction $${amountUsd.toFixed(2)} is near per-tx limit $${perTxLimitUsd.toFixed(2)}`,
    };
  }
  return { pass: true, reason: '' };
}

export function checkDaily(
  agentId: string,
  amountUsd: number,
  policy: Policy,
  tracker: SpendTracker
): CheckResult {
  const { dailyLimitUsd, warnAtDailyPercent } = policy.config;
  const spent = tracker.spentTodayUsd(agentId);
  const projected = spent + amountUsd;

  if (projected > dailyLimitUsd) {
    const remaining = Math.max(0, dailyLimitUsd - spent);
    return {
      pass: false,
      reason: `Daily limit reached. Spent: $${spent.toFixed(2)} / $${dailyLimitUsd.toFixed(2)}. Remaining: $${remaining.toFixed(2)}. Resets midnight UTC.`,
    };
  }
  const warnThreshold = dailyLimitUsd * warnAtDailyPercent;
  if (projected >= warnThreshold) {
    return {
      pass: true,
      reason: '',
      warn: `Daily budget at ${((projected / dailyLimitUsd) * 100).toFixed(0)}%. $${projected.toFixed(2)} of $${dailyLimitUsd.toFixed(2)} used.`,
    };
  }
  return { pass: true, reason: '' };
}

export function checkWeekly(
  agentId: string,
  amountUsd: number,
  policy: Policy,
  tracker: SpendTracker
): CheckResult {
  const { weeklyLimitUsd } = policy.config;
  if (!weeklyLimitUsd) return { pass: true, reason: '' };
  const spent = tracker.spentThisWeekUsd(agentId);
  if (spent + amountUsd > weeklyLimitUsd) {
    return {
      pass: false,
      reason: `Weekly limit reached. Spent: $${spent.toFixed(2)} / $${weeklyLimitUsd.toFixed(2)}. Resets Monday UTC.`,
    };
  }
  return { pass: true, reason: '' };
}

export function checkMonthly(
  agentId: string,
  amountUsd: number,
  policy: Policy,
  tracker: SpendTracker
): CheckResult {
  const { monthlyLimitUsd } = policy.config;
  if (!monthlyLimitUsd) return { pass: true, reason: '' };
  const spent = tracker.spentThisMonthUsd(agentId);
  if (spent + amountUsd > monthlyLimitUsd) {
    return {
      pass: false,
      reason: `Monthly limit reached. Spent: $${spent.toFixed(2)} / $${monthlyLimitUsd.toFixed(2)}.`,
    };
  }
  return { pass: true, reason: '' };
}

export function checkCategory(
  agentId: string,
  amountUsd: number,
  category: string,
  policy: Policy,
  tracker: SpendTracker
): CheckResult {
  const limit = policy.config.categoryLimits?.[category];
  if (!limit) return { pass: true, reason: '' };
  const catSpent = tracker.spentByCategoryToday(agentId)[category] ?? 0;
  if (catSpent + amountUsd > limit) {
    return {
      pass: false,
      reason: `Category '${category}' budget exceeded. Spent: $${catSpent.toFixed(2)} / $${limit.toFixed(2)}.`,
    };
  }
  return { pass: true, reason: '' };
}

export function checkAddress(toAddress: string, policy: Policy): CheckResult {
  const addr = toAddress.toLowerCase().trim();
  const blacklist = policy.config.blacklist.map((a) => a.toLowerCase());
  const whitelist = policy.config.whitelist.map((a) => a.toLowerCase());

  if (blacklist.includes(addr)) {
    return { pass: false, reason: `Destination blacklisted: ${toAddress}` };
  }
  if (whitelist.length > 0 && !whitelist.includes(addr)) {
    return { pass: false, reason: `Destination not in whitelist: ${toAddress}` };
  }
  return { pass: true, reason: '' };
}

export function checkAnomalyFrequency(
  agentId: string,
  policy: Policy,
  tracker: SpendTracker
): CheckResult {
  const { maxTxPerMinute } = policy.config;
  const count = tracker.recentTxCount(agentId, 60);
  if (count >= maxTxPerMinute) {
    return {
      pass: false,
      reason: `Frequency anomaly: ${count} txns in 60s (limit: ${maxTxPerMinute}/min). Possible loop.`,
    };
  }
  return { pass: true, reason: '' };
}

export function checkAnomalyVelocity(
  agentId: string,
  policy: Policy,
  tracker: SpendTracker
): CheckResult {
  const { maxTxPerHour } = policy.config;
  const count = tracker.recentTxCount(agentId, 3600);
  if (count >= maxTxPerHour) {
    return {
      pass: false,
      reason: `Velocity anomaly: ${count} txns/hr (limit: ${maxTxPerHour}/hr).`,
    };
  }
  return { pass: true, reason: '' };
}

export function checkAnomalyAmount(
  agentId: string,
  amountUsd: number,
  policy: Policy,
  tracker: SpendTracker
): CheckResult {
  const { anomalyMultiplier } = policy.config;
  const avg = tracker.averageTxAmount(agentId, 20);
  if (avg === 0) return { pass: true, reason: '' };
  const threshold = avg * anomalyMultiplier;
  if (amountUsd > threshold) {
    return {
      pass: false,
      reason: `Amount anomaly: $${amountUsd.toFixed(2)} is ${(amountUsd / avg).toFixed(1)}x agent avg ($${avg.toFixed(2)}). Threshold: ${anomalyMultiplier}x.`,
    };
  }
  return { pass: true, reason: '' };
}

export function runAllChecks(params: {
  agentId: string;
  amountUsd: number;
  toAddress: string;
  category: string;
  policy: Policy;
  tracker: SpendTracker;
}): CheckResult {
  const { agentId, amountUsd, toAddress, category, policy, tracker } = params;

  const checks = [
    () => checkPerTx(amountUsd, policy),
    () => checkDaily(agentId, amountUsd, policy, tracker),
    () => checkWeekly(agentId, amountUsd, policy, tracker),
    () => checkMonthly(agentId, amountUsd, policy, tracker),
    () => checkCategory(agentId, amountUsd, category, policy, tracker),
    () => checkAddress(toAddress, policy),
    () => checkAnomalyFrequency(agentId, policy, tracker),
    () => checkAnomalyVelocity(agentId, policy, tracker),
    () => checkAnomalyAmount(agentId, amountUsd, policy, tracker),
  ];

  let lastWarn: string | undefined;

  for (const check of checks) {
    const result = check();
    if (!result.pass) return result;
    if (result.warn) lastWarn = result.warn;
  }

  return { pass: true, reason: '', warn: lastWarn };
}
