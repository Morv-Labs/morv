# Deploy & Publish

Guide for building, testing, and publishing the Morv SDK and CLI.

---

## Install from source

```bash
git clone https://github.com/Morv-Labs/morv.git
cd morv
npm install
npm run build
npm test
```

---

## npm publish

The publishable package is `@morv-labs/morv` in `packages/sdk`.

```bash
cd packages/sdk
npm run build
npm test
npm login
npm publish --access public
```

Users install with:

```bash
npm install @morv-labs/morv
```

### Version bumps

1. Update `version` in `packages/sdk/package.json`
2. Update `@morv-labs/morv` dependency version in `packages/cli/package.json`
3. `npm run build && npm test`
4. `npm publish --access public` from `packages/sdk`

---

## CLI usage (npx)

After SDK publish, the CLI resolves the SDK dependency:

```bash
npx morv init
```

For local development:

```bash
npm run build
node packages/cli/dist/index.js --help
```

---

## Environment

Copy `.env.example` to `.env` in your project:

```bash
cp .env.example .env
```

Required for agents with models:

- `OPENAI_API_KEY` (or provider of choice)

Required for onchain payments:

- `MORV_WALLET_PRIVATE_KEY` or `BANKR_API_KEY` + `BANKR_AGENT_ADDRESS`

Optional gateway ([morv.run](https://morv.run)):

- `MORV_API_BASE_URL`
- `MORV_API_KEY`

---

## Production checklist

- [ ] AgentGuard policy configured (`dailyLimitUsd`, `perTxLimitUsd`)
- [ ] Wallet funded with USDC on Base
- [ ] Model API keys set (BYOM)
- [ ] `BASE_RPC_URL` points to reliable RPC
- [ ] Never commit `.env` or private keys

---

## Links

- Website: [morv.run](https://morv.run)
- X: [@morvlabs](https://x.com/morvlabs)
- npm: [@morv-labs/morv](https://www.npmjs.com/package/@morv-labs/morv)
