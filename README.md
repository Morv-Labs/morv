# Morv

Open-source SDK and CLI for building AI agents on [Base](https://base.org) with MCP tools, x402 payments, and spending policies.

**Morv Labs** provides the hosted control plane (gateway, credits, marketplace) separately. This repository contains the client-side SDK and CLI only.

## Features

| Module | Description |
|--------|-------------|
| **AgentGuard** | Spending limits, whitelist/blacklist, anomaly checks, auto-pause |
| **MCP** | Install and execute tools from a registry or hosted marketplace |
| **x402** | Pay-per-request HTTP (Bankr rail by default, Morv native fallback) |
| **BYOM** | OpenAI, Anthropic, Gemini, Ollama |
| **Credits** | Optional integration with Morv hosted API — users spend credits, platform wallet settles onchain |

## Install

```bash
npm install @morv-labs/morv
```

From source:

```bash
git clone https://github.com/Morv-Labs/morv.git
cd morv && npm install && npm run build
```

## Quick start

### With Morv hosted API (recommended)

Users spend **Morv credits**. Configure your platform wallet (`BANKR_API_KEY` or `MORV_WALLET_PRIVATE_KEY`) on the machine running the agent.

```typescript
import { MorvClient } from '@morv-labs/morv';

const morv = new MorvClient({
  apiBaseUrl: process.env.MORV_API_BASE_URL ?? 'http://localhost:3001',
  apiKey: process.env.MORV_API_KEY,
});

await morv.register('you@example.com'); // once — returns API key + starter credits

const agent = await morv.createAgent({
  id: 'my-agent',
  model: { provider: 'openai', model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY! },
  policy: { dailyLimitUsd: 50, perTxLimitUsd: 10, autoPause: true },
  tools: ['base-eth-price', 'base-x402-discovery'],
});

const answer = await agent.run('What is the ETH price on Base?');
```

### Standalone (no hosted API)

Use a local wallet adapter directly:

```typescript
import { MorvClient, createPlatformWalletFromEnv } from 'morv';

const wallet = createPlatformWalletFromEnv();
const morv = new MorvClient();

const agent = await morv.createAgent({
  id: 'my-agent',
  model: { provider: 'openai', model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY! },
  policy: { dailyLimitUsd: 50, perTxLimitUsd: 10, autoPause: true },
  tools: ['eth-price'],
}, wallet);

await agent.pay({ to: '0x...', amount: 1, currency: 'USDC', category: 'payment' });
```

## CLI

```bash
npx morv init
npx morv register              # API key + credits (requires hosted backend)
npx morv agent create demo --tools base-eth-price --daily 50 --per-tx 10
npx morv run "Get ETH price"
npx morv guard status demo
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For OpenAI models | BYOM provider key |
| `MORV_API_BASE_URL` | Optional | Hosted Morv backend URL |
| `MORV_API_KEY` | Optional | Account API key from `morv register` |
| `BANKR_API_KEY` | Platform wallet | Bankr Wallet API (recommended) |
| `BANKR_AGENT_ADDRESS` | Platform wallet | Bankr agent address on Base |
| `MORV_WALLET_PRIVATE_KEY` | Alternative wallet | Direct Base USDC via viem |
| `X402_PROVIDER` | Optional | `bankr` (default) or `morv` |
| `BASE_RPC_URL` | Optional | Default: `https://mainnet.base.org` |

USDC on Base mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## AgentGuard

AgentGuard enforces policy on every payment path — MCP tool calls, x402 requests, and manual transfers.

```typescript
import { AgentGuard, BaseWallet, PolicyViolationError } from 'morv';

const guard = new AgentGuard({
  agentId: 'trading-bot',
  wallet: new BaseWallet({ privateKey: process.env.MORV_WALLET_PRIVATE_KEY! }),
  policy: { dailyLimitUsd: 100, perTxLimitUsd: 25, autoPause: true },
});

try {
  await guard.pay({ to: '0xService...', amount: 5, currency: 'USDC' });
} catch (e) {
  if (e instanceof PolicyViolationError) console.error('Blocked:', e.reason);
}
```

Policy checks include per-transaction limits, daily/weekly/monthly budgets, category caps, whitelist/blacklist, and velocity/amount anomaly detection.

## Repository layout

```
morv/
├── packages/sdk/    npm package "morv"
├── packages/cli/    CLI binary "morv"
├── examples/
└── docs/
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Deploy](./docs/DEPLOY.md)

## What is not included

This repository does not contain the Morv hosted backend (gateway, billing engine, admin dashboard). See [Morv-Labs/morv-server](https://github.com/Morv-Labs/morv-server) for the private server implementation.

## License

MIT — [Morv Labs](https://github.com/Morv-Labs)
