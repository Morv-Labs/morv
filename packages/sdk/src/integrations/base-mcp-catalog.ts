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
    endpoint: 'http://localhost:3001/tools/base-onchain/execute',
    tags: ['base', 'onchain', 'agentkit', 'official'],
    verified: true,
    rating: 4.9,
    installs: 5000,
  },
  {
    id: 'base-x402-discovery',
    name: 'Base x402 Service Discovery',
    description: 'Discover paid x402 APIs — Bankr + CDP Bazaar',
    version: '1.0.0',
    author: 'Morv · Bankr + CDP',
    category: 'developer',
    pricing: { type: 'free' },
    endpoint: 'https://x402.bankr.bot',
    tags: ['base', 'x402', 'bankr', 'cdp', 'discovery'],
    verified: true,
    rating: 4.8,
    installs: 3200,
  },
  {
    id: 'coinbase-products-get',
    name: 'Coinbase Product Get',
    description: 'Live Coinbase spot price and stats',
    version: '1.0.0',
    author: 'Coinbase / Morv',
    category: 'crypto',
    pricing: { type: 'free' },
    endpoint: 'http://localhost:3001/tools/coinbase-market/execute',
    tags: ['coinbase', 'price', 'market'],
    verified: true,
    rating: 4.9,
    installs: 2100,
  },
  {
    id: 'mcp-passthrough',
    name: 'MCP Passthrough',
    description: 'Connect any remote MCP server by URL',
    version: '1.0.0',
    author: 'Morv Labs',
    category: 'developer',
    pricing: { type: 'per_request', pricePerRequestUsd: 0.02 },
    endpoint: 'http://localhost:3001/tools/mcp-passthrough/execute',
    tags: ['mcp', 'passthrough', 'remote'],
    verified: true,
    rating: 4.8,
    installs: 1100,
  },
  {
    id: 'cdp-agentic-wallet',
    name: 'CDP Agentic Wallet MCP',
    description: 'Agentic wallet x402 via CDP MCP',
    version: '1.0.0',
    author: 'Coinbase CDP',
    category: 'payments',
    pricing: { type: 'per_request', pricePerRequestUsd: 0.01 },
    endpoint: 'http://localhost:3001/tools/agentic-wallet/execute',
    tags: ['cdp', 'agentic', 'x402'],
    verified: true,
    rating: 4.6,
    installs: 650,
  },
  {
    id: 'coinbase-agents-mcp',
    name: 'Coinbase for Agents Remote MCP',
    description: 'Passthrough to agents.coinbase.com/mcp',
    version: '1.0.0',
    author: 'Coinbase',
    category: 'trading',
    pricing: { type: 'per_request', pricePerRequestUsd: 0.02 },
    endpoint: 'mcp://agents.coinbase.com/mcp',
    tags: ['coinbase', 'mcp', 'trading'],
    verified: true,
    rating: 4.7,
    installs: 920,
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
