/**
 * SpendTracker — SQLite-backed transaction ledger per agent.
 */

import Database from 'better-sqlite3';
import { Transaction, AgentStatus } from '../types';

export class SpendTracker {
  private db: Database.Database;

  constructor(dbPath = 'morv.db') {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id         TEXT NOT NULL,
        to_address       TEXT NOT NULL,
        amount_usd       REAL NOT NULL,
        currency         TEXT NOT NULL,
        category         TEXT DEFAULT 'general',
        memo             TEXT,
        tx_hash          TEXT,
        timestamp        REAL NOT NULL,
        status           TEXT NOT NULL,
        rejection_reason TEXT
      );
      CREATE TABLE IF NOT EXISTS agent_state (
        agent_id       TEXT PRIMARY KEY,
        is_paused      INTEGER DEFAULT 0,
        paused_at      REAL,
        pause_reason   TEXT,
        total_approved INTEGER DEFAULT 0,
        total_rejected INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_agent_time ON transactions(agent_id, timestamp);
    `);
  }

  record(tx: Omit<Transaction, 'id'>): void {
    this.db
      .prepare(
        `INSERT INTO transactions
          (agent_id, to_address, amount_usd, currency, category, memo, tx_hash, timestamp, status, rejection_reason)
         VALUES
          (@agentId, @toAddress, @amountUsd, @currency, @category, @memo, @txHash, @timestamp, @status, @rejectionReason)`
      )
      .run({
        agentId: tx.agentId,
        toAddress: tx.toAddress,
        amountUsd: tx.amountUsd,
        currency: tx.currency,
        category: tx.category,
        memo: tx.memo,
        txHash: tx.txHash ?? null,
        timestamp: tx.timestamp,
        status: tx.status,
        rejectionReason: tx.rejectionReason ?? null,
      });

    this.db
      .prepare(
        `INSERT INTO agent_state (agent_id, total_approved, total_rejected)
         VALUES (@agentId, @approved, @rejected)
         ON CONFLICT(agent_id) DO UPDATE SET
           total_approved = total_approved + @approved,
           total_rejected = total_rejected + @rejected`
      )
      .run({
        agentId: tx.agentId,
        approved: tx.status === 'approved' ? 1 : 0,
        rejected: tx.status === 'rejected' ? 1 : 0,
      });
  }

  setPaused(agentId: string, paused: boolean, reason = ''): void {
    this.db
      .prepare(
        `INSERT INTO agent_state (agent_id, is_paused, paused_at, pause_reason)
         VALUES (@agentId, @isPaused, @pausedAt, @reason)
         ON CONFLICT(agent_id) DO UPDATE SET
           is_paused = @isPaused, paused_at = @pausedAt, pause_reason = @reason`
      )
      .run({
        agentId,
        isPaused: paused ? 1 : 0,
        pausedAt: paused ? Date.now() / 1000 : null,
        reason,
      });
  }

  isPaused(agentId: string): { paused: boolean; reason: string | null } {
    const row = this.db
      .prepare('SELECT is_paused, pause_reason FROM agent_state WHERE agent_id = ?')
      .get(agentId) as { is_paused: number; pause_reason: string | null } | undefined;
    return { paused: Boolean(row?.is_paused), reason: row?.pause_reason ?? null };
  }

  spentTodayUsd(agentId: string): number {
    return this.sumApproved(agentId, this.todayMidnightUtc());
  }

  spentThisWeekUsd(agentId: string): number {
    return this.sumApproved(agentId, this.weekStartUtc());
  }

  spentThisMonthUsd(agentId: string): number {
    return this.sumApproved(agentId, this.monthStartUtc());
  }

  spentByCategoryToday(agentId: string): Record<string, number> {
    const midnight = this.todayMidnightUtc();
    const rows = this.db
      .prepare(
        `SELECT category, SUM(amount_usd) as total FROM transactions
         WHERE agent_id = ? AND status = 'approved' AND timestamp >= ?
         GROUP BY category`
      )
      .all(agentId, midnight) as { category: string; total: number }[];
    return Object.fromEntries(rows.map((r) => [r.category, r.total]));
  }

  recentTxCount(agentId: string, seconds: number): number {
    const since = Date.now() / 1000 - seconds;
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM transactions
         WHERE agent_id = ? AND status = 'approved' AND timestamp >= ?`
      )
      .get(agentId, since) as { cnt: number };
    return row.cnt;
  }

  averageTxAmount(agentId: string, lastN = 20): number {
    const row = this.db
      .prepare(
        `SELECT AVG(amount_usd) as avg FROM (
           SELECT amount_usd FROM transactions
           WHERE agent_id = ? AND status = 'approved'
           ORDER BY timestamp DESC LIMIT ?
         )`
      )
      .get(agentId, lastN) as { avg: number | null };
    return row.avg ?? 0;
  }

  getHistory(agentId: string, limit = 50): Transaction[] {
    return this.db
      .prepare(
        `SELECT to_address as toAddress, amount_usd as amountUsd, currency,
                category, memo, tx_hash as txHash, timestamp, status,
                rejection_reason as rejectionReason, agent_id as agentId
         FROM transactions WHERE agent_id = ?
         ORDER BY timestamp DESC LIMIT ?`
      )
      .all(agentId, limit) as Transaction[];
  }

  summary(agentId: string): Omit<AgentStatus, 'policy'> {
    const { paused, reason } = this.isPaused(agentId);
    return {
      agentId,
      isPaused: paused,
      pauseReason: reason ?? undefined,
      spentTodayUsd: Number(this.spentTodayUsd(agentId).toFixed(4)),
      spentThisWeekUsd: Number(this.spentThisWeekUsd(agentId).toFixed(4)),
      spentThisMonthUsd: Number(this.spentThisMonthUsd(agentId).toFixed(4)),
      byCategoryToday: this.spentByCategoryToday(agentId),
      txLast60s: this.recentTxCount(agentId, 60),
      txLastHour: this.recentTxCount(agentId, 3600),
    };
  }

  close(): void {
    this.db.close();
  }

  private sumApproved(agentId: string, since: number): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount_usd), 0) as total FROM transactions
         WHERE agent_id = ? AND status = 'approved' AND timestamp >= ?`
      )
      .get(agentId, since) as { total: number };
    return row.total;
  }

  private todayMidnightUtc(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000;
  }

  private weekStartUtc(): number {
    const now = new Date();
    const day = now.getUTCDay();
    const monday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((day + 6) % 7))
    );
    return monday.getTime() / 1000;
  }

  private monthStartUtc(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
  }
}
