/**
 * Notifier — alerts via Telegram, webhook (Slack/Discord), and console.
 */

import { Policy } from '../core/policy';

type AlertLevel = 'info' | 'warning' | 'critical';

const EMOJI: Record<AlertLevel, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🚨',
};

async function postJson(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export class Notifier {
  constructor(private policy: Policy) {}

  async alert(params: {
    agentId: string;
    level: AlertLevel;
    title: string;
    message: string;
    extra?: Record<string, string | number>;
  }): Promise<void> {
    const { agentId, level, title, message, extra } = params;
    const emoji = EMOJI[level];

    const logFn =
      level === 'critical' ? console.error : level === 'warning' ? console.warn : console.info;
    logFn(`[Morv|${agentId}] ${emoji} ${title}: ${message}`);

    if (this.policy.config.alertWebhook) {
      let text = `${emoji} *[Morv | ${agentId}]* ${title}\n${message}`;
      if (extra) {
        text += '\n' + Object.entries(extra).map(([k, v]) => `• ${k}: ${v}`).join('\n');
      }
      await postJson(this.policy.config.alertWebhook, { text });
    }

    if (this.policy.config.telegramBotToken && this.policy.config.telegramChatId) {
      let text = `${emoji} <b>[Morv]</b>\n<b>Agent:</b> ${agentId}\n<b>${title}</b>\n${message}`;
      if (extra) {
        text += '\n' + Object.entries(extra).map(([k, v]) => `• <b>${k}:</b> ${v}`).join('\n');
      }
      await postJson(
        `https://api.telegram.org/bot${this.policy.config.telegramBotToken}/sendMessage`,
        { chat_id: this.policy.config.telegramChatId, text, parse_mode: 'HTML' }
      );
    }
  }

  onBlocked(agentId: string, reason: string, amountUsd: number, to: string): Promise<void> {
    return this.alert({
      agentId,
      level: 'critical',
      title: 'Transaction Blocked',
      message: reason,
      extra: { amount: `$${amountUsd.toFixed(2)}`, to },
    });
  }

  onWarning(agentId: string, message: string): Promise<void> {
    return this.alert({ agentId, level: 'warning', title: 'Budget Warning', message });
  }

  onPaused(agentId: string, reason: string): Promise<void> {
    return this.alert({ agentId, level: 'critical', title: 'Agent Paused', message: reason });
  }

  onResumed(agentId: string): Promise<void> {
    return this.alert({
      agentId,
      level: 'info',
      title: 'Agent Resumed',
      message: 'Agent is active again.',
    });
  }
}
