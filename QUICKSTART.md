# Morv — Quickstart (5 minutes)

Get a policy-guarded agent running on Base.

## Prerequisites

- Node.js 18+
- A model API key (Groq free tier works: `GROQ_API_KEY`)
- A wallet on Base **or** Bankr keys for USDC

## 1. Install

```bash
npm install @morv-labs/morv
npx morv init
```

## 2. Configure `.env`

```bash
cp .env.example .env
```

Minimum:

```env
GROQ_API_KEY=gsk_...
BANKR_API_KEY=bk_...
BANKR_AGENT_ADDRESS=0x...
```

Or direct wallet:

```env
MORV_WALLET_PRIVATE_KEY=0x...
BASE_RPC_URL=https://mainnet.base.org
```

## 3. Create agent

```bash
npx morv agent create dca-bot \
  --tools base-x402-discovery \
  --daily 200 \
  --per-tx 50
```

## 4. Run

```bash
npx morv run "Scan Base pools and DCA $50 if ETH dips 3%"
```

## 5. Monitor

```bash
npx morv guard status dca-bot
npx morv tools list
```

## Optional: morv.run gateway

Sign in at [morv.run](https://morv.run) with Privy (wallet or X). Buy credits via embedded wallet.

```env
MORV_API_BASE_URL=https://api.morv.run
MORV_API_KEY=mv_...
```

## Next

- Full context: [AGENTS.md](AGENTS.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Examples: `examples/`
