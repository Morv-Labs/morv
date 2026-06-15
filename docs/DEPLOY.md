# Deploy — Open Source

This guide covers publishing the **public** `morv` repository (SDK + CLI). The hosted backend is deployed separately from [morv-server](https://github.com/Morv-Labs/morv-server).

---

## 1. GitHub (public repository)

### Prerequisites

- Build and tests pass in the private monorepo
- No secrets in the `morv/` folder

### Sync from private monorepo

```powershell
cd "D:\coding\Morv Labs"
node scripts/sync-opensource.mjs
cd morv
npm install
npm run build
npm run test
```

### Push to GitHub

Create a **public** repository: `https://github.com/Morv-Labs/morv`

```powershell
cd morv
git init
git branch -M main
git add .
git status    # verify: no .env, no node_modules, no dist/
git commit -m "feat: morv SDK and CLI v0.1.0"
git remote add origin https://github.com/Morv-Labs/morv.git
git push -u origin main
```

### What to include

```
morv/
├── packages/sdk/
├── packages/cli/
├── examples/
├── docs/
├── README.md
├── LICENSE
└── .env.example
```

### What to exclude

- `packages/backend/`, `packages/dashboard/`
- `.env` files with keys
- `node_modules/`, `dist/`

---

## 2. npm (SDK package)

The publishable package is `packages/sdk` (name: `morv`).

```powershell
cd morv/packages/sdk
npm run build
npm test
npm login
npm publish --access public
```

After publish, users install with:

```bash
npm install morv
```

### Version bumps

Update version in:

- `morv/packages/sdk/package.json`
- `morv/package.json` (workspace root)
- `morv/packages/cli/package.json` (`morv` dependency version)

---

## 3. CLI distribution

**Option A — npm (recommended)**

Publish `@morv/cli` as a separate package, or bundle CLI instructions in the main README with `npx morv` once CLI is published.

**Option B — GitHub install**

```bash
git clone https://github.com/Morv-Labs/morv.git
cd morv && npm install && npm run build
npm link -w packages/cli
```

**Option C — npx from GitHub** (after repo is public)

```bash
npx github:Morv-Labs/morv/packages/cli
```

---

## 4. Connect SDK to hosted backend

The open-source SDK works standalone or with the Morv hosted API.

Set in `.env` or shell:

```env
MORV_API_BASE_URL=https://your-backend.up.railway.app
MORV_API_KEY=mv_...
```

Deploy the backend from [morv-server](https://github.com/Morv-Labs/morv-server) (Railway or similar). See `railway.toml` in that repository.

---

## 5. Release checklist

- [ ] `npm run build` passes in `morv/`
- [ ] `npm run test` passes
- [ ] README and docs reflect current features
- [ ] No `.env` or private keys in git
- [ ] Version bumped in `package.json` files
- [ ] GitHub push (public repo)
- [ ] npm publish (when ready for public install)

---

## 6. Update workflow

After changes in the private monorepo:

```powershell
cd "D:\coding\Morv Labs"
npm run build -w packages/morv
npm run test -w packages/morv
node scripts/sync-opensource.mjs
cd morv && npm run build && git add . && git commit -m "sync: sdk update" && git push
```

Keep private server changes in `morv-server`; keep SDK/CLI changes synced to `morv`.
