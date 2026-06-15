/**
 * Morv SDK
 * Morv Labs — Universal AI Agent Infrastructure
 *
 * npm install morv
 *
 * Quick start:
 *   import { MorvClient, MockWallet } from 'morv';
 *
 *   const morv = new MorvClient();
 *   const wallet = new MockWallet({ balanceUsd: 100 });
 *   const agent = morv.createAgent({
 *     id: 'my-agent',
 *     model: { provider: 'openai', model: 'gpt-4o', apiKey: process.env.OPENAI_KEY! },
 *     policy: { dailyLimitUsd: 10, perTxLimitUsd: 2 },
 *   }, wallet);
 *
 *   await agent.pay({ to: '0xABC', amount: 1, currency: 'USDC' });
 */

// Core
export { MorvClient, Agent, AgentXClient } from './core/client';
export {
  AgentGuard,
  PolicyViolationError,
  AgentPausedError,
  AnomalyDetectedError,
} from './core/guard';
export type { AgentGuardOptions, PayParams } from './core/guard';
export { Policy, DEFAULT_POLICY } from './core/policy';
export { SpendTracker } from './core/tracker';
export { McpRegistry } from './core/mcp';
export type { McpRegistryOptions } from './core/mcp';
export { McpGateway } from './core/gateway';
export type { GatewayExecuteResponse, McpGatewayOptions } from './core/gateway';
export { BillingClient } from './core/billing';
export type { BillingClientOptions, RecordUsageParams } from './core/billing';

// Integrations
export { X402Client, X402PaymentError } from './integrations/x402';
export type { X402Response, X402ClientOptions } from './integrations/x402';
export { BankrX402Client } from './integrations/x402-bankr';
export type { BankrX402ClientOptions } from './integrations/x402-bankr';
export { createX402Client, resolveX402Provider } from './integrations/x402-factory';
export type { X402Provider, X402ClientLike } from './integrations/x402-factory';
export { CreditClient, InsufficientCreditsError } from './core/credits';
export type { CreditClientOptions, CreditBalance, DeductCreditsParams } from './core/credits';
export { CreditWallet } from './integrations/credit-wallet';
export { listBaseMcpTools, getBaseMcpTool, BASE_MCP_SERVERS, BASE_MCP_REGISTRY_URL } from './integrations/base-mcp-catalog';
export { BankrWallet, PrivyWallet, MockWallet, GenericWallet } from './integrations/wallets';
export type { MockPayment } from './integrations/wallets';
export { BaseWallet } from './integrations/base-wallet';
export type { BaseWalletOptions } from './integrations/base-wallet';
export { createWalletFromEnv, createPlatformWalletFromEnv, createUserWalletFromEnv, detectWalletMode } from './integrations/wallet-factory';
export type { WalletMode } from './integrations/wallet-factory';
export { USDC_BASE_MAINNET, BASE_CHAIN_ID, DEFAULT_BASE_RPC } from './chain/constants';
export { createModelRunner, resolveApiKeyFromEnv, DEFAULT_MODELS, PROVIDER_ENV_KEYS } from './integrations/models';
export type { Message, RunOptions, ModelResponse, ToolDefinition, ModelRunner } from './integrations/models';

// Types
export type {
  AgentConfig,
  ModelConfig,
  ModelProvider,
  PolicyConfig,
  PauseStrategy,
  Transaction,
  PaymentResult,
  McpToolManifest,
  McpToolCall,
  McpToolResult,
  McpToolCategory,
  McpToolPricing,
  McpToolSchema,
  WalletAdapter,
  AgentStatus,
  MorvConfig,
  MarketplaceSearchParams,
  MarketplaceSearchResult,
  UsageRecord,
  BillingStatement,
  SpendCategory,
  X402PaymentDetails,
} from './types';

/** @deprecated Use MorvConfig */
export type { MorvConfig as AgentXConfig } from './types';
