/**
 * Morv Client — unified SDK entry point.
 *
 * Modules:
 *  - AgentGuard  → spending policy (security layer)
 *  - MCP         → tool execution via gateway or direct
 *  - x402        → pay-per-request HTTP
 *  - BYOM        → bring your own model
 *  - Billing     → usage reporting to control plane
 */

import { AgentGuard } from './guard';
import { McpRegistry } from './mcp';
import { BillingClient } from './billing';
import { createModelRunner, Message, ModelRunner } from '../integrations/models';
import { createX402Client, X402ClientLike } from '../integrations/x402-factory';
import { createUserWalletFromEnv } from '../integrations/wallet-factory';
import {
  AgentConfig,
  MorvConfig,
  WalletAdapter,
  AgentStatus,
  Transaction,
  ModelConfig,
} from '../types';

export class Agent {
  readonly id: string;
  readonly guard: AgentGuard;
  readonly mcp: McpRegistry;
  readonly x402: X402ClientLike;
  private model: ModelRunner;
  private conversationHistory: Message[] = [];
  private maxToolDepth = 5;

  constructor(params: {
    config: AgentConfig;
    guard: AgentGuard;
    mcp: McpRegistry;
  }) {
    this.id = params.config.id;
    this.guard = params.guard;
    this.mcp = params.mcp;
    this.x402 = createX402Client({ guard: params.guard, category: 'api' });
    this.model = createModelRunner(params.config.model);
  }

  /** Run agent with BYOM + MCP tools (full platform flow). */
  async run(prompt: string, systemPrompt?: string, depth = 0): Promise<string> {
    if (prompt) {
      this.conversationHistory.push({ role: 'user', content: prompt });
    }

    if (depth > this.maxToolDepth) {
      return 'Max tool call depth reached. Stopping to prevent infinite loop.';
    }

    const tools = this.mcp.list().map((t) => ({
      name: t.id.replace(/[^a-zA-Z0-9_]/g, '_'),
      description: `${t.description} (Cost: $${t.pricing.pricePerRequestUsd ?? 0}/call)`,
      parameters: {
        type: 'object',
        properties: t.schema.input,
      },
    }));

    const response = await this.model.run({
      messages: [...this.conversationHistory],
      systemPrompt: systemPrompt ?? this.defaultSystemPrompt(),
      tools: tools.length ? tools : undefined,
    });

    if (response.toolCalls?.length) {
      for (const call of response.toolCalls) {
        const toolId = call.name.replace(/_/g, '-');
        try {
          const result = await this.mcp.call(toolId, call.arguments, this.id);
          this.conversationHistory.push({
            role: 'assistant',
            content: `Tool ${toolId} returned: ${JSON.stringify(result.output)}`,
          });
        } catch (err) {
          this.conversationHistory.push({
            role: 'assistant',
            content: `Tool ${toolId} failed: ${err}`,
          });
        }
      }
      return this.run('', systemPrompt, depth + 1);
    }

    this.conversationHistory.push({ role: 'assistant', content: response.content });
    return response.content;
  }

  /** Call MCP tool directly (bypasses LLM). */
  useTool(toolId: string, input: Record<string, unknown>) {
    return this.mcp.call(toolId, input, this.id);
  }

  pay(params: Parameters<AgentGuard['pay']>[0]) {
    return this.guard.pay(params);
  }

  fetch(url: string, init?: RequestInit) {
    return this.x402.fetch(url, init);
  }

  status(): AgentStatus {
    return this.guard.status();
  }

  history(limit?: number): Transaction[] {
    return this.guard.history(limit);
  }

  pause(reason?: string): void {
    this.guard.pause(reason);
  }

  resume(): void {
    this.guard.resume();
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  private defaultSystemPrompt(): string {
    const installedTools = this.mcp.list().map((t) => t.name).join(', ');
    return `You are an autonomous AI agent (Morv Labs) with ID "${this.id}".
Installed MCP tools: ${installedTools || 'none'}.
All payments are enforced by AgentGuard spending policies.
Budget: ${JSON.stringify(this.status().policy)}
You spend Morv credits. Platform settles onchain via Base/Bankr.
Use tools efficiently — paid tools deduct credits per call.`;
  }
}

export class MorvClient {
  readonly billing: BillingClient;
  private config: Required<
    Pick<MorvConfig, 'apiBaseUrl' | 'marketplaceUrl' | 'dbPath' | 'logLevel'>
  > & {
    apiKey?: string;
  };
  private agents = new Map<string, Agent>();

  constructor(config: MorvConfig = {}) {
    this.config = {
      apiKey: config.apiKey,
      apiBaseUrl: config.apiBaseUrl ?? 'http://localhost:3001',
      marketplaceUrl: config.marketplaceUrl ?? 'http://localhost:3001/marketplace',
      dbPath: config.dbPath ?? 'morv.db',
      logLevel: config.logLevel ?? 'info',
    };

    this.billing = new BillingClient({
      apiBaseUrl: this.config.apiBaseUrl,
      apiKey: this.config.apiKey,
    });

    if (this.config.logLevel === 'silent') {
      console.info = () => {};
      console.warn = () => {};
    }
  }

  /** Register account on Morv control plane → get API key. */
  async register(email?: string) {
    const result = await this.billing.register(email);
    this.config.apiKey = result.apiKey;
    return result;
  }

  /** Create agent with optional auto-install of MCP tools from config.tools[]. */
  async createAgent(agentConfig: AgentConfig, wallet?: WalletAdapter): Promise<Agent> {
    const resolvedWallet =
      wallet ??
      (this.config.apiKey
        ? createUserWalletFromEnv({
            apiBaseUrl: this.config.apiBaseUrl,
            apiKey: this.config.apiKey,
            agentId: agentConfig.id,
            allowMock: process.env.NODE_ENV !== 'production',
          })
        : undefined);

    if (!resolvedWallet) {
      throw new Error(
        'Wallet required. Pass wallet or set apiKey (Morv credits) via MorvClient.register().'
      );
    }

    const guard = new AgentGuard({
      agentId: agentConfig.id,
      wallet: resolvedWallet,
      policy: agentConfig.policy,
      dbPath: this.config.dbPath,
    });

    const mcp = new McpRegistry({
      guard,
      apiKey: this.config.apiKey,
      apiBaseUrl: this.config.apiBaseUrl,
      marketplaceUrl: this.config.marketplaceUrl,
      useGateway: true,
    });

    if (agentConfig.tools?.length) {
      await mcp.installMany(agentConfig.tools);
    }

    const agent = new Agent({ config: agentConfig, guard, mcp });
    this.agents.set(agentConfig.id, agent);

    console.info(`[Morv] Agent '${agentConfig.id}' ready — tools: ${agentConfig.tools?.join(', ') || 'none'}`);
    return agent;
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  listAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  async searchMarketplace(query: string) {
    const registry = new McpRegistry({
      apiKey: this.config.apiKey,
      marketplaceUrl: this.config.marketplaceUrl,
    });
    return registry.search({ query });
  }

  /** Standalone AgentGuard without full agent runtime. */
  createGuard(agentId: string, wallet: WalletAdapter, policy: AgentConfig['policy']) {
    return new AgentGuard({
      agentId,
      wallet,
      policy,
      dbPath: this.config.dbPath,
    });
  }
}

/** @deprecated Use MorvClient */
export const AgentXClient = MorvClient;

export type { ModelConfig };
