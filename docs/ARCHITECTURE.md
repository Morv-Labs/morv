# Architecture

## Overview

Morv is a single SDK (`morv`) and CLI (`npx morv`) that combines five layers for autonomous agents on Base:

| Layer | Module | Role |
|-------|--------|------|
| Security | `AgentGuard` | Enforces spending policy before any payment |
| Execution | `McpRegistry` / `McpGateway` | Installs and runs MCP tools |
| Payment | `X402Client` / `BankrX402Client` | Handles HTTP 402 pay-per-request flows |
| AI | `createModelRunner` | BYOM — bring your own model provider |
| Billing | `CreditClient` / `BillingClient` | Optional integration with hosted Morv API |

## Payment flow (hosted mode)

```
User agent (SDK/CLI)
  → CreditWallet deducts Morv credits
  → AgentGuard validates policy
  → Platform wallet (Bankr / Base) settles onchain
  → MCP tool or x402 API responds
```

Users interact with credits only. The platform operator configures the onchain wallet in environment variables.

## AgentGuard integration

AgentGuard is a security module inside Morv, not a standalone product. Every payment route passes through it:

```
MCP call  → quote price → AgentGuard.pay() → execute tool
x402 API  → 402 response → AgentGuard.pay() → retry with payment header
```

## Open source vs hosted

| Open source (this repo) | Hosted (private server) |
|-------------------------|-------------------------|
| SDK (`morv`) | MCP gateway routing |
| CLI (`morv`) | Credits and billing API |
| AgentGuard engine | Marketplace backend |
| x402 clients | Admin dashboard |
| Wallet adapters | Onchain payment verification |

Connect to hosted services via `MORV_API_BASE_URL` and `MORV_API_KEY`.

## Typical workflow

```
1. morv init
2. morv register                 → API key + starter credits
3. morv agent create demo        → agent with AgentGuard policy
4. morv add base-eth-price       → install MCP tool
5. morv run "ETH price?"         → BYOM + MCP + AgentGuard
6. morv guard status             → check budget
7. morv billing usage            → usage summary (hosted API)
```

## x402 providers

Set `X402_PROVIDER=bankr` (default) or `morv`:

- **bankr** — uses `x402-fetch` on Base; compatible with the Bankr x402 ecosystem
- **morv** — native HTTP 402 header flow with AgentGuard

Both paths enforce AgentGuard policy before settlement.
