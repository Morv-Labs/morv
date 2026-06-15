/**
 * Base MCP Catalog — official & community MCP servers on Base chain.
 * Source: docs.base.org/ai-agents, Coinbase AgentKit, x402.bankr.bot ecosystem
 */

import { McpToolManifest } from '../types';

export const BASE_MCP_REGISTRY_URL =
  process.env.BASE_MCP_REGISTRY_URL ?? 'https://docs.base.org/ai-agents';

/** Curated Base ecosystem MCP servers — expand as Base publishes new tools */
export const BASE_MCP_SERVERS: Omit<McpToolManifest, 'schema'>[] & {
  schema?: McpToolManifest['schema'];
}[] = [
  {
    id: 'base-onchain-tools',
    name: 'Base Onchain Tools (AgentKit)',
    description: 'Official Base onchain actions via Coinbase AgentKit — transfers, swaps, deploy',
    version: '1.0.0',
    author: 'Base / Coinbase',
    category: 'crypto',
    pricing: { type: 'per_request', pricePerRequestUsd: 0.01 },
    endpoint: 'https://api.morv.dev/tools/base-onchain/execute',
    tags: ['base', 'onchain', 'agentkit', 'official'],
    verified: true,
    rating: 4.9,
    installs: 5000,
  },
  {
    id: 'base-x402-discovery',
    name: 'Base x402 Service Discovery',
    description: 'Discover paid x402 APIs on Base via Bankr registry (x402.bankr.bot)',
    version: '1.0.0',
    author: 'Bankr',
    category: 'developer',
    pricing: { type: 'free' },
    endpoint: 'https://x402.bankr.bot',
    tags: ['base', 'x402', 'bankr', 'discovery'],
    verified: true,
    rating: 4.8,
    installs: 3200,
  },
  {
    id: 'baselings-defi',
    name: 'Baselings DeFi MCP',
    description: '42 DeFi tools for Base — swaps, launches, yield (community)',
    version: '1.2.0',
    author: 'Baselings',
    category: 'finance',
    pricing: { type: 'per_request', pricePerRequestUsd: 0.005 },
    endpoint: 'npx://baselings-mcp',
    tags: ['base', 'defi', 'uniswap', 'community'],
    verified: false,
    rating: 4.5,
    installs: 890,
  },
  {
    id: 'base-eth-price',
    name: 'Base ETH Price Oracle',
    description: 'ETH/USD price feed optimized for Base mainnet agents',
    version: '1.0.0',
    author: 'Morv Labs',
    category: 'crypto',
    pricing: { type: 'per_request', pricePerRequestUsd: 0.005 },
    endpoint: 'http://localhost:3001/tools/eth-price/execute',
    tags: ['base', 'price', 'oracle'],
    verified: true,
    rating: 4.9,
    installs: 3400,
  },
  {
    id: 'base-web-scraper',
    name: 'Base Web Scraper',
    description: 'Fetch web data for Base agent workflows',
    version: '1.0.0',
    author: 'Morv Labs',
    category: 'web',
    pricing: { type: 'per_request', pricePerRequestUsd: 0.01 },
    endpoint: 'http://localhost:3001/tools/web-scraper/execute',
    tags: ['base', 'web', 'scrape'],
    verified: true,
    rating: 4.7,
    installs: 1200,
  },
];

export function toFullManifest(
  entry: (typeof BASE_MCP_SERVERS)[0]
): McpToolManifest {
  return {
    ...entry,
    schema: entry.schema ?? {
      input: { type: 'object', properties: {} },
      output: { type: 'object' },
    },
  } as McpToolManifest;
}

export function listBaseMcpTools(): McpToolManifest[] {
  return BASE_MCP_SERVERS.map(toFullManifest);
}

export function getBaseMcpTool(id: string): McpToolManifest | undefined {
  const found = BASE_MCP_SERVERS.find((t) => t.id === id);
  return found ? toFullManifest(found) : undefined;
}
