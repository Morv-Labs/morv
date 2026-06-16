# AGENTS.md — Morv Labs

Entry point for AI agents working in this repository.

## What Morv is

Morv is infrastructure for autonomous agents on **Base (8453)**:

- **AgentGuard** — spending policy before any payment
- **MCP** — tool install and execution
- **x402** — pay-per-request HTTP APIs
- **BYOM** — bring your own model (Groq, OpenAI, Anthropic, etc.)
- **Wallets** — USDC on Base via Bankr or direct key

This repo contains the **open-source SDK** (`@morv-labs/morv`) and **CLI** (`morv`). The hosted app lives at [morv.run](https://morv.run).

## Onboarding order

1. Read [QUICKSTART.md](QUICKSTART.md)
2. Read [README.md](README.md) system overview
3. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module boundaries
4. Run `examples/basic-usage.ts` or `examples/full-platform.ts`

## Environment manifest

| Variable | Required | Notes |
|----------|----------|-------|
| `GROQ_API_KEY` | For Groq BYOM | Free tier available |
| `OPENAI_API_KEY` | For OpenAI BYOM | |
| `BANKR_API_KEY` | Wallet path | Recommended on Base |
| `BANKR_AGENT_ADDRESS` | With Bankr | |
| `MORV_WALLET_PRIVATE_KEY` | Alt wallet | Direct USDC via viem |
| `BASE_RPC_URL` | Optional | Default mainnet.base.org |
| `X402_PROVIDER` | Optional | `bankr` (default) or `morv` |
| `MORV_API_BASE_URL` | Optional | Gateway at morv.run |
| `MORV_API_KEY` | Optional | From register / Privy sync |

**Never commit** `.env` files or private keys.

## Onchain constants

| Name | Value |
|------|-------|
| Chain | Base 8453 |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Decimals | 6 |

## MCP tool IDs (catalog)

| ID | Category |
|----|----------|
| `base-x402-discovery` | x402 service discovery |
| `base-web-scraper` | Web data |
| `base-eth-price` | Price oracle |
| `base-onchain-tools` | AgentKit onchain actions |
| `baselings-defi` | DeFi tools |

Install: `npx morv add <tool-id>`

## Typical agent loop

```
prompt → model → (optional) MCP tool or x402 API
       → AgentGuard.check → wallet.pay → result → model → answer
```

## Example prompts (good demos)

```
Scan Base pools and DCA $50 if ETH dips 3%
Aggregate DeFi TVL from all x402 sources
Summarize Base agent ecosystem news this week
Run swarm: researcher finds yield, trader allocates $80
```

Avoid generic "what is ETH price" demos — use agent patterns that show autonomy + payments.

## SDK entry points

```typescript
import {
  MorvClient,
  AgentGuard,
  createPlatformWalletFromEnv,
  PolicyViolationError,
} from '@morv-labs/morv';
```

## CLI entry points

```bash
morv init
morv agent create <id> --tools base-x402-discovery --daily 200 --per-tx 50
morv run "<prompt>"
morv guard status <id>
```

## Documentation map

| File | Use when |
|------|----------|
| README.md | Project-wide context |
| QUICKSTART.md | First run in 5 min |
| docs/ARCHITECTURE.md | Module design |
| docs/DEPLOY.md | npm publish |
| SECURITY.md | Vulnerability report |
| CHANGELOG.md | Version changes |

## Links

- Website: https://morv.run
- npm: https://www.npmjs.com/package/@morv-labs/morv
- X: https://x.com/morvlabs
- GitHub: https://github.com/Morv-Labs/morv
