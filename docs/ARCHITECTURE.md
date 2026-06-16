# Architecture

## Overview

Morv is a TypeScript SDK and CLI for autonomous agents on Base. Five modules compose a single stack:

| Layer | Module | Role |
|-------|--------|------|
| Security | `AgentGuard` | Enforces spending policy before any payment |
| Execution | `McpRegistry` / `McpGateway` | Installs and runs MCP tools |
| Payment | `X402Client` | Handles HTTP 402 pay-per-request flows |
| AI | `createModelRunner` | BYOM — bring your own model provider |
| Chain | `BaseWallet` / Bankr adapter | USDC settlement on Base mainnet |

## Agent execution flow

```
1. User prompt → model runner (BYOM)
2. Model selects MCP tool or x402 endpoint
3. AgentGuard validates policy (limits, lists, anomalies)
4. Wallet settles USDC on Base (or x402 payment header)
5. Tool/API response → model → final answer
```

## AgentGuard

AgentGuard is embedded in every payment path — not a separate product:

```
MCP call  → quote price → AgentGuard.pay() → execute tool
x402 API  → 402 response → AgentGuard.pay() → retry with payment proof
transfer  → AgentGuard.pay() → onchain USDC
```

Policy dimensions:

- Per-transaction and rolling budgets (daily / weekly / monthly)
- Category caps (e.g. `mcp`, `x402`, `payment`)
- Whitelist / blacklist addresses
- Velocity and amount anomaly detection
- Auto-pause on violation

## MCP integration

Tools are referenced by ID (e.g. `base-x402-discovery`, `base-web-scraper`).

- **Local registry** — static catalog in SDK for offline development
- **Gateway mode** — set `MORV_API_BASE_URL` to route through [morv.run](https://morv.run) for live marketplace and routing

## x402

Set `X402_PROVIDER=bankr` (default) or `morv`:

| Provider | Behavior |
|----------|----------|
| `bankr` | Bankr x402 ecosystem on Base via `x402-fetch` |
| `morv` | Native HTTP 402 header flow with AgentGuard |

Both paths enforce AgentGuard before settlement.

## Wallet adapters

| Adapter | Env |
|---------|-----|
| `BaseWallet` | `MORV_WALLET_PRIVATE_KEY` |
| Bankr | `BANKR_API_KEY`, `BANKR_AGENT_ADDRESS` |

Use `createPlatformWalletFromEnv()` to pick the configured adapter automatically.

## Typical workflow

```
morv init
morv agent create dca-bot --tools base-x402-discovery --daily 200 --per-tx 50
morv run "Scan Base pools and DCA if dip detected"
morv guard status dca-bot
```

Optional gateway connection:

```
morv register                    → API key
export MORV_API_BASE_URL=https://api.morv.run
morv tools list                → live marketplace
```

## Package map

```
packages/sdk/src/
├── core/          client, guard, gateway, mcp, policy, billing, credits
├── integrations/  x402, wallets, models, base-mcp-catalog
├── chain/         Base constants
└── checks/        pre-flight validators

packages/cli/src/
└── index.ts       morv command surface
```
