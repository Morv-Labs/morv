/**
 * MCP Gateway Client — routes tool execution through Morv control plane.
 *
 * Flow: SDK → Gateway → (x402 payment via AgentGuard) → Tool execution → Usage logged
 */

import { AgentGuard } from './guard';
import { BillingClient } from './billing';
import { McpToolCall, McpToolResult, McpToolManifest } from '../types';

export interface GatewayPaymentRequired {
  status: 'payment_required';
  requestId: string;
  toolId: string;
  amountUsd: number;
  platformFeeUsd: number;
  providerAmountUsd: number;
  currency: string;
  recipient: string;
  memo: string;
}

export interface GatewayExecuteSuccess {
  status: 'success';
  requestId: string;
  toolId: string;
  output: unknown;
  costUsd: number;
  platformFeeUsd: number;
  durationMs: number;
}

export type GatewayExecuteResponse = GatewayPaymentRequired | GatewayExecuteSuccess;

export interface McpGatewayOptions {
  apiBaseUrl: string;
  apiKey?: string;
  guard?: AgentGuard;
  billing?: BillingClient;
}

export class McpGateway {
  private guard?: AgentGuard;
  private apiKey?: string;
  private apiBaseUrl: string;
  private billing?: BillingClient;

  constructor(options: McpGatewayOptions) {
    this.apiBaseUrl = options.apiBaseUrl;
    this.apiKey = options.apiKey;
    this.guard = options.guard;
    this.billing = options.billing;
  }

  async execute(
    toolId: string,
    input: Record<string, unknown>,
    agentId: string,
    paymentTxHash?: string
  ): Promise<McpToolResult> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    const res = await this.apiFetch(`${this.apiBaseUrl}/gateway/execute`, {
      method: 'POST',
      body: JSON.stringify({ toolId, input, agentId, requestId, paymentTxHash }),
    });

    const data = (await res.json()) as GatewayExecuteResponse & { error?: string };

    if (!res.ok && data.error) {
      throw new Error(`Gateway error: ${data.error}`);
    }

    if (data.status === 'payment_required') {
      if (!this.guard) {
        throw new Error(`Tool '${toolId}' requires payment but no wallet/AgentGuard configured.`);
      }

      const payResult = await this.guard.pay({
        to: data.recipient,
        amount: data.amountUsd,
        currency: data.currency,
        memo: data.memo,
        category: 'mcp',
      });

      return this.execute(toolId, input, agentId, payResult.txHash);
    }

    if (data.status === 'success') {
      void this.billing?.recordUsage({
        agentId,
        toolId,
        amountUsd: data.costUsd,
        category: 'mcp',
      });

      return {
        requestId: data.requestId,
        toolId: data.toolId,
        output: data.output,
        durationMs: data.durationMs ?? Date.now() - startTime,
        costUsd: data.costUsd,
      };
    }

    throw new Error(`Unexpected gateway response for tool '${toolId}'`);
  }

  async install(toolId: string): Promise<McpToolManifest> {
    const res = await this.apiFetch(`${this.apiBaseUrl}/marketplace/tools/${toolId}`);
    if (!res.ok) throw new Error(`Tool '${toolId}' not found in marketplace`);
    return res.json() as Promise<McpToolManifest>;
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
