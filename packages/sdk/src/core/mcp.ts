/**
 * MCP Tool Registry & Executor
 *
 * Supports two modes:
 *  - Gateway mode (recommended): routes through Morv control plane
 *  - Direct mode: local registry + direct HTTP to tool endpoints
 */

import { AgentGuard } from './guard';
import { McpGateway } from './gateway';
import { BillingClient } from './billing';
import {
  McpToolManifest,
  McpToolCall,
  McpToolResult,
  MarketplaceSearchParams,
  MarketplaceSearchResult,
} from '../types';

const DEFAULT_MARKETPLACE_URL =
  process.env.MORV_MARKETPLACE_URL ?? 'http://localhost:3001/marketplace';

export interface McpRegistryOptions {
  guard?: AgentGuard;
  apiKey?: string;
  apiBaseUrl?: string;
  marketplaceUrl?: string;
  useGateway?: boolean;
}

export class McpRegistry {
  private tools = new Map<string, McpToolManifest>();
  private guard?: AgentGuard;
  private apiKey?: string;
  private marketplaceUrl: string;
  private gateway?: McpGateway;
  private useGateway: boolean;

  constructor(options?: McpRegistryOptions) {
    this.guard = options?.guard;
    this.apiKey = options?.apiKey;
    this.marketplaceUrl = options?.marketplaceUrl ?? DEFAULT_MARKETPLACE_URL;
    this.useGateway = options?.useGateway ?? Boolean(options?.apiBaseUrl);

    if (this.useGateway && options?.apiBaseUrl) {
      const billing = new BillingClient({
        apiBaseUrl: options.apiBaseUrl,
        apiKey: options.apiKey,
      });
      this.gateway = new McpGateway({
        apiBaseUrl: options.apiBaseUrl,
        apiKey: options.apiKey,
        guard: options.guard,
        billing,
      });
    }
  }

  async install(toolId: string): Promise<McpToolManifest> {
    const manifest = this.gateway
      ? await this.gateway.install(toolId)
      : await this.fetchManifest(toolId);
    this.tools.set(toolId, manifest);
    console.info(`[MCP] Installed: ${manifest.name} v${manifest.version}`);
    return manifest;
  }

  async installMany(toolIds: string[]): Promise<McpToolManifest[]> {
    return Promise.all(toolIds.map((id) => this.install(id)));
  }

  register(manifest: McpToolManifest): void {
    this.tools.set(manifest.id, manifest);
    console.info(`[MCP] Registered local tool: ${manifest.name}`);
  }

  uninstall(toolId: string): void {
    this.tools.delete(toolId);
  }

  list(): McpToolManifest[] {
    return Array.from(this.tools.values());
  }

  get(toolId: string): McpToolManifest | undefined {
    return this.tools.get(toolId);
  }

  async call(
    toolId: string,
    input: Record<string, unknown>,
    agentId: string
  ): Promise<McpToolResult> {
    // Gateway mode — control plane handles pricing, routing, usage logging
    if (this.gateway) {
      if (!this.tools.has(toolId)) {
        await this.install(toolId);
      }
      return this.gateway.execute(toolId, input, agentId);
    }

    // Direct mode — local execution with AgentGuard payment
    const manifest = this.tools.get(toolId);
    if (!manifest) {
      throw new Error(`Tool '${toolId}' not installed. Run: morv add ${toolId}`);
    }

    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    let costUsd = 0;
    if (manifest.pricing.type === 'per_request' && manifest.pricing.pricePerRequestUsd) {
      costUsd = manifest.pricing.pricePerRequestUsd;
      if (!this.guard) {
        throw new Error(`Tool '${toolId}' requires payment but no AgentGuard is configured.`);
      }
      await this.guard.pay({
        to: manifest.endpoint,
        amount: costUsd,
        currency: 'USDC',
        memo: `MCP tool: ${toolId} | req: ${requestId}`,
        category: 'mcp',
      });
    }

    const call: McpToolCall = {
      toolId,
      input,
      agentId,
      requestId,
      timestamp: startTime,
    };

    const output = await this.executeToolDirect(manifest, call);

    return {
      requestId,
      toolId,
      output,
      durationMs: Date.now() - startTime,
      costUsd,
    };
  }

  async search(params: MarketplaceSearchParams = {}): Promise<MarketplaceSearchResult> {
    const url = new URL(`${this.marketplaceUrl}/search`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });

    const res = await this.apiFetch(url.toString());
    return res.json() as Promise<MarketplaceSearchResult>;
  }

  private async fetchManifest(toolId: string): Promise<McpToolManifest> {
    const res = await this.apiFetch(`${this.marketplaceUrl}/tools/${toolId}`);
    if (!res.ok) throw new Error(`Tool '${toolId}' not found in marketplace`);
    return res.json() as Promise<McpToolManifest>;
  }

  private async executeToolDirect(manifest: McpToolManifest, call: McpToolCall): Promise<unknown> {
    const res = await this.apiFetch(manifest.endpoint, {
      method: 'POST',
      body: JSON.stringify(call),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Tool execution failed (${res.status}): ${err}`);
    }

    return res.json();
  }

  private apiFetch(url: string, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    return fetch(url, {
      ...init,
      headers: { ...headers, ...((init?.headers as Record<string, string>) ?? {}) },
    });
  }
}
