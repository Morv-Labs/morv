/**
 * Morv Core Types — shared across SDK, CLI, and backend
 */

export interface AgentConfig {
  id: string;
  name?: string;
  model: ModelConfig;
  policy: PolicyConfig;
  tools?: string[];
  walletAddress?: string;
}

export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'ollama'
  | 'groq'
  | 'grok'
  | 'bai'
  | 'custom';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export type PauseStrategy = 'pause' | 'kill' | 'alert_only';

export interface PolicyConfig {
  dailyLimitUsd: number;
  weeklyLimitUsd?: number;
  monthlyLimitUsd?: number;
  perTxLimitUsd: number;
  whitelist?: string[];
  blacklist?: string[];
  categoryLimits?: Record<string, number>;
  maxTxPerMinute?: number;
  maxTxPerHour?: number;
  anomalyMultiplier?: number;
  autoPause?: boolean;
  pauseStrategy?: PauseStrategy;
  cooldownMinutes?: number;
  autoResume?: boolean;
  alertWebhook?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  warnAtDailyPercent?: number;
}

export type TxStatus = 'approved' | 'rejected' | 'pending';
export type SpendCategory = 'compute' | 'api' | 'trading' | 'fees' | 'mcp' | 'general';

export interface Transaction {
  id?: number;
  agentId: string;
  toAddress: string;
  amountUsd: number;
  currency: string;
  category: SpendCategory;
  memo: string;
  txHash?: string;
  timestamp: number;
  status: TxStatus;
  rejectionReason?: string;
}

export interface PaymentResult {
  txHash?: string;
  amountUsd: number;
  to: string;
  memo: string;
  timestamp: number;
}

export interface McpToolManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: McpToolCategory;
  pricing: McpToolPricing;
  endpoint: string;
  schema: McpToolSchema;
  tags: string[];
  verified: boolean;
  rating?: number;
  installs?: number;
}

export type McpToolCategory =
  | 'web'
  | 'data'
  | 'crypto'
  | 'ai'
  | 'productivity'
  | 'communication'
  | 'developer'
  | 'finance';

export interface McpToolPricing {
  type: 'free' | 'per_request' | 'subscription';
  pricePerRequestUsd?: number;
  subscriptionMonthlyUsd?: number;
}

export interface McpToolSchema {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface McpToolCall {
  toolId: string;
  input: Record<string, unknown>;
  agentId: string;
  requestId: string;
  timestamp: number;
}

export interface McpToolResult {
  requestId: string;
  toolId: string;
  output: unknown;
  durationMs: number;
  costUsd: number;
  error?: string;
}

export interface X402PaymentDetails {
  amount: number;
  currency: string;
  recipient: string;
  memo: string;
  network: string;
  expiresAt?: number;
}

export interface WalletAdapter {
  pay(params: { to: string; amount: number; currency: string }): Promise<string | undefined>;
  getBalance?(currency?: string): Promise<number>;
  getAddress?(): string;
}

export interface AgentStatus {
  agentId: string;
  isPaused: boolean;
  pauseReason?: string;
  spentTodayUsd: number;
  spentThisWeekUsd: number;
  spentThisMonthUsd: number;
  byCategoryToday: Record<string, number>;
  txLast60s: number;
  txLastHour: number;
  policy: {
    dailyLimitUsd: number;
    perTxLimitUsd: number;
    dailyRemainingUsd: number;
    autoPause: boolean;
  };
}

export interface MarketplaceSearchParams {
  query?: string;
  category?: McpToolCategory;
  pricing?: 'free' | 'paid' | 'all';
  verified?: boolean;
  sortBy?: 'popular' | 'rating' | 'newest' | 'price_asc';
  limit?: number;
  offset?: number;
}

export interface MarketplaceSearchResult {
  tools: McpToolManifest[];
  total: number;
  offset: number;
}

export interface UsageRecord {
  agentId: string;
  toolId: string;
  callCount: number;
  totalCostUsd: number;
  periodStart: number;
  periodEnd: number;
}

export interface BillingStatement {
  accountId: string;
  periodStart: number;
  periodEnd: number;
  totalCostUsd: number;
  platformFeeUsd: number;
  breakdown: UsageRecord[];
  invoiceId: string;
}

export interface MorvConfig {
  apiKey?: string;
  apiBaseUrl?: string;
  marketplaceUrl?: string;
  dbPath?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}
