# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What this repo is

**Cos72** is a fork of **YetAnotherAA (YAA)** that acts as a "skin layer" over
on-chain contracts (wrapped by `@aastar/sdk`). It is not multi-tenant — everyone
is equal, and after login the menus shown depend on the account's **on-chain
role** (SP-v5 role / community). Communities, tasks, points, redemption, and
voting are all **on-chain objects** that Cos72 merely renders. It builds on top
of AirAccount (KMS) + DVT infra.

- `upstream` remote = `AAStarCommunity/YetAnotherAA` (the base). Sync with
  `git fetch upstream && git merge upstream/master`.
- The base portal (register community / register SuperPaymaster / stake /
  governance) stays maintained in YAA; Cos72 inherits it via rebase and only
  adds entry-point aggregation + role menus.
- Long-term goal: `cos72 = YAA + three core modules` (MyTask / MyShop / MyVote,
  sourced from `~/Dev/mycelium/{MyTask,MyShop,MyVote}`).

**`docs/HANDOFF.md` is the living session-handoff doc — read it first for
current branch/PR state, locked decisions, and in-progress work.** `COS72.md`
has the one-page model.

## Monorepo layout

npm workspaces monorepo. Two active workspaces plus scaffolding for future work:

- `aastar/` — NestJS backend API (port **3000**, global prefix `api/v1`, Swagger
  at `/api-docs`)
- `aastar-frontend/` — Next.js 16 + React 19 frontend (port **5173**)
- `config/brand.ts` — the single "re-skin" entry point (brand name +
  KMS/RP/RPC/bundler endpoints)
- `modules/{mytask,myshop,myvote}` — three core modules (README stubs; real
  source in `~/Dev/mycelium`)
- `apps/{extension,mobile,embed,create-app}` — distribution-target skins (README
  stubs)
- `sdk/src/{core,server}` — local SDK scaffolding
- Smart contracts + BLS signing service live in **separate repos**
  (`YetAnotherAA-Validator`, remote BLS at
  `yetanotheraa-validator.onrender.com`) — not here.

## Dependency install — use npm, NOT pnpm

**This repo requires `npm install`** (it overrides the usual pnpm preference).
`@aastar/sdk` declares `peerOptional react ^18` against the app's React 19, so a
clean install fails ERESOLVE. This is worked around by root `.npmrc`
(`legacy-peer-deps=true`) and hoisting `react`/`react-dom` into root
`devDependencies` (otherwise `next build` reports `Cannot find module 'react'`).
A fresh clone runs `npm install` directly. Never use pnpm here; `npm ci` is fine
(CI uses it — the committed `.npmrc` makes it honor legacy-peer-deps) but for
local installs that change deps you need `npm install` to update the lockfile.

## Common commands

Run from repo root unless noted. `-w <workspace>` targets one workspace; `-ws`
runs across all.

```bash
# Dev servers
npm run start:dev -w aastar          # backend, port 3000 (nest --watch)
npm run dev -w aastar-frontend       # frontend, port 5173
./dev.sh start|stop|restart          # both together (via backend.sh / frontend.sh, PID-tracked)

# Build / typecheck
npm run build                        # build all workspaces
npm run build -w aastar              # backend tsc only
npm run type-check -w aastar         # tsc --noEmit
npm run type-check -w aastar-frontend

# Lint / format
npm run lint                         # lint all workspaces (aastar runs eslint --fix; frontend is check-only, --max-warnings 0)
npm run lint:check -w aastar-frontend
npm run format                       # prettier --write . (root)
npm run format:check

# Local aggregate gate (subset of GitHub CI)
npm run ci                           # format:check && lint && build && test:ci
# NOTE: actual .github/workflows/ci.yml runs more on top: lint:check + type-check
# per workspace, npm audit, Trivy, CodeQL, Dependency Review — green `npm run ci`
# does NOT guarantee green GitHub CI.

# i18n parity (frontend has i18next EN/ZH — keep keys in sync)
npm run i18n:check -w aastar-frontend
```

### Testing

- **Backend** uses Jest. Note `test`/`test:ci` pass `--passWithNoTests`; real
  specs are the `*.service.spec.ts` files
  (registry/community/operator/admin/sale, etc.).
  ```bash
  npm run test -w aastar                                    # all specs
  npm run test -w aastar -- registry.service.spec.ts       # single file
  npm run test -w aastar -- -t "role counts"               # single test by name
  npm run test:e2e -w aastar                                # jest -c test/jest-e2e.json
  ```
- **Frontend** has no unit tests (`test`/`test:ci` are no-op echoes). E2E is
  Playwright:
  ```bash
  npm run test:e2e:ui -w aastar-frontend    # playwright test (real browser passkey + backend)
  ```

## Backend architecture (aastar/src)

NestJS feature-module app. Each domain is `*.module.ts` + `*.controller.ts` +
`*.service.ts`.

- **Auth** (`auth/`): WebAuthn/Passkey + JWT (passport). Guards enforce JWT;
  **the account is derived from the JWT, never trusted from the request body
  address.**
- **Account / transfer / userop**: ERC-4337 orchestration. `userop/` is the
  generic gasless UserOp path (all tiers passthrough to the SDK's
  `client.transfers.*`); `transfer/` is the original transfer service + address
  book.
- **ethereum / bls / paymaster / kms**: chain access, BLS aggregate-signature
  service (talks to remote DVT signer), Paymaster sponsorship, KMS key
  management (prod signing).
- **Management-portal domains**:
  `registry / community / operator / admin / sale / token / user-token / user-nft / guardian`
  — read live Sepolia data via the SDK and expose it under `/api/v1/*`. The real
  unit specs live in five of them:
  `registry / community / operator / admin / sale` (`*.service.spec.ts`); the
  rest have none.
- **database** (`database/`): dual persistence behind `persistence.interface.ts`
  with `json.adapter.ts` and `postgres.adapter.ts`, selected by `DB_TYPE`
  (`json` | `postgres`). `data-tools/` provides export/import + `db:clear`
  scripts.
- **config** (`config/`): env-driven; contract addresses per EntryPoint version
  (v0.6/v0.7/v0.8) come from env with Sepolia defaults (see
  `ecosystem.config.js`).
- **sdk** (`sdk/`): wires `@aastar/sdk` into DI with a backend storage adapter.

## Frontend architecture (aastar-frontend)

Next.js App Router (`app/`), Tailwind v4, i18next (EN/ZH).

- **Auth model (locked decision): user layer = AirAccount-only.** User-facing
  modules (transfer/tasks/shop/vote) go through the AirAccount session — **no
  `window.ethereum` fallback**. The infra/operator layer (`WalletContext`,
  `lib/sdk/operator.ts`) uses EOA (operator deploy / DVT-register / infra init)
  and is kept separate.
- **Session**: `contexts/Cos72SessionContext.tsx` → `useCos72Session()` exposes
  `address` (AirAccount) / `isConnected` / `send` (= `cosSend`). Other contexts:
  `WalletContext` (EOA operator track), `DashboardContext`, `TaskContext`.
- **Write path**: `lib/sdk/cosTx.ts` `cosSend` handles all tiers (resolve tier →
  prepare → T1 KMS credential / T2-T3 device WebAuthn → T3 guardian → submit →
  DVT-pending resubmit → poll `/userop/status` for txHash). WebAuthn helpers in
  `lib/webauthn-assert.ts`. Trust-boundary note: `cosSend` blind-signs the
  backend-returned `userOpHash` (the browser can't independently recompute it) —
  inherent to KMS-server-only.
- **Addresses**: `lib/addresses.ts` `infraAddresses()` reads SDK canonical
  addresses; module addresses are in transition via env
  (`aastar-frontend/config/modules.ts` + `.env.local`, gitignored — not to be
  confused with the repo-root `config/brand.ts`).
- **Navigation = GitHub-style three tiers**: L1 user menu (cross-community,
  top-right, from YAA) / L2 community menu (`components/nav/CommunityNav.tsx`,
  module tabs gated by role via `lib/roles.ts`) / L3 module sub-nav. **Role
  flags only drive UI visibility; enforcement is on-chain.**
- Build new features inside YAA's existing `Layout` + design system — do not
  create bare pages.

## Workflow conventions (set by the repo owner)

- **Always branch → local test (type-check + build) → open PR → review/approve →
  rebase-merge.** Never commit directly to `master`.
- Creating PRs: `gh pr create`'s GraphQL path sends an empty sha and errors here
  — use the REST API instead:
  `gh api repos/AAStarCommunity/Cos72/pulls -f title=.. -f head=.. -f base=master -F body=@file`.
  Merge with `gh api -X PUT .../pulls/N/merge -f merge_method=rebase`.
- Chain = **Sepolia**. Stack is unified on **viem** (ethers is being removed).

## Gotchas

- **Verifying build success in a pipeline**: `cmd | tail`'s exit code is
  `tail`'s, not `cmd`'s. Use `cmd > log 2>&1; echo $?` to read the real code
  (has caused false "build green").
- **dev server serves the working tree**: switching git branches changes the
  rendered frontend. Don't switch away from a branch whose styles you're
  viewing.
- **macOS case-insensitive FS**: `Cos72` == `cos72` resolve to the same path —
  avoid paths that differ only in case.
- To run a dev frontend without clobbering the standard port, use a different
  port (e.g. `npm run dev -w aastar-frontend -- -p 5174`).

## Deployment

Docker + PM2 (`ecosystem.config.js`): `aastar-backend` (port 3000) +
`aastar-frontend` (port 80).
`docker build -t yaaa:latest . && docker-compose up -d`. External deps
configured by env: `BLS_SEED_NODES` (remote DVT signer), `KMS_ENDPOINT`,
`BUNDLER_RPC_URL`, `DATABASE_*`.
