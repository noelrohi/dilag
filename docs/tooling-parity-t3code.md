# Tooling Parity Notes: T3 Code

Generated: 2026-05-15

Reference: https://github.com/pingdotgg/t3code

This document compares Dilag's current developer tooling with the public T3 Code repository and lists practical DX improvements we can borrow without copying product-specific architecture.

## Executive Summary

T3 Code is useful as a reference because it has a similar shape: an agent-oriented desktop/web product, Bun workspaces, Turbo, Vite, Electron, shared packages, release automation, and app/server boundaries.

The main DX gaps in Dilag are not UI framework choices. They are workflow consistency:

- no root `typecheck` script
- no root format script
- no pinned local toolchain file
- no root lint/format standard across all packages
- thin CI coverage before release
- desktop dev orchestration is custom but not yet robust against noisy child-process output or port conflicts
- package boundaries are less explicit than T3 Code's `contracts` and `shared` split

The best near-term borrow is not T3 Code's Effect stack. It is the tooling discipline around scripts, CI, port/env orchestration, package contracts, and editor defaults.

## Current Status

| Item                          | Status | Notes                                                                                                        |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| Bun workspaces                | Done   | Root `package.json` uses Bun workspaces for `apps/*` and `packages/*`.                                       |
| Turbo monorepo tasks          | Done   | `build`, `dev`, `test`, `lint`, `typecheck`, and `clean` are wired in root scripts and `turbo.json`.         |
| Desktop dev launcher          | Done   | Electron/Vite/tsdown orchestration handles dynamic Vite ports, `--dry-run`, and carriage-return log output.  |
| Web dev workflow              | Done   | `apps/web` has Next.js dev/build/start scripts.                                                              |
| Desktop renderer tests        | Done   | Desktop has Vitest scripts and root `bun run test` routes through Turbo.                                     |
| Root typecheck command        | Done   | Root `bun run typecheck` and package-level `typecheck` scripts are present.                                  |
| Root format command           | Done   | Root `fmt` and `fmt:check` scripts use Prettier with repo ignore rules.                                      |
| Root lint standard            | Done   | Root `bun run lint` routes through Turbo; web uses ESLint and TS-only packages use type-safe lint fallbacks. |
| Toolchain pinning             | Done   | `.mise.toml` pins Node and Bun versions alongside `packageManager`.                                          |
| Explicit Turbo env list       | Done   | `turbo.json` documents build/dev env vars via `globalEnv`.                                                   |
| CI quality workflow           | Done   | `.github/workflows/ci.yml` runs install, format, lint, typecheck, test, and web build on PR/push.            |
| VS Code formatter settings    | Done   | `.vscode/settings.json` and `.vscode/extensions.json` configure Prettier, ESLint, and workspace TypeScript.  |
| PR template / issue templates | Done   | PR, bug report, and feature request templates are present.                                                   |
| Devcontainer                  | Done   | `.devcontainer/devcontainer.json` pins Bun, Node, Rust, Git, and frozen install setup.                       |

Status labels:

- `Done`: present and usable today.
- `Partial`: present, but incomplete or inconsistent.
- `Missing`: should be added if we want parity.
- `Optional`: useful only if the project need appears.

## Repository Shape

### T3 Code

Observed top-level structure:

```text
.devcontainer/
.github/
.mise.toml
.oxfmtrc.json
.oxlintrc.json
.vscode/
apps/
  desktop/
  marketing/
  server/
  web/
assets/
docs/
oxlint-plugin-t3code/
packages/
  client-runtime/
  contracts/
  effect-acp/
  effect-codex-app-server/
  shared/
  ssh/
  tailscale/
patches/
scripts/
tsconfig.base.json
turbo.json
vitest.config.ts
```

### Dilag Today

Current top-level shape:

```text
.devcontainer/
.github/
.mise.toml
.prettierignore
.prettierrc
.vscode/
apps/
  desktop/
  web/
docs/
packages/
  db/
  desktop-bridge/
  shared/
  ui/
package.json
tsconfig.json
turbo.json
```

Dilag is already a monorepo, and the root-level quality gates are now close to T3 Code's baseline. The remaining architectural difference is that T3 Code has a dedicated app server and contract package split, while Dilag is still centered on desktop, web, UI, shared, and bridge packages.

## Parity Matrix

| Area              | T3 Code                                                                                                | Dilag Today                                                                                    | Recommendation                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Package manager   | Bun workspaces with `packageManager` and catalog versions                                              | Bun workspaces with `packageManager`; no Bun catalog yet                                       | Done for workspace baseline; catalog can wait for a Bun upgrade    |
| Tool versions     | `.mise.toml` pins Node and Bun                                                                         | `.mise.toml` pins Node and Bun alongside `packageManager`                                      | Done                                                               |
| Root scripts      | `dev`, `dev:web`, `dev:desktop`, `build`, `typecheck`, `lint`, `test`, `fmt`, `fmt:check`              | Root scripts now include `dev`, filtered dev, `build`, `typecheck`, `lint`, `test`, and format | Done                                                               |
| Dev orchestration | `scripts/dev-runner.ts` computes ports/env, supports dry run, forwards Turbo stdio directly            | Desktop launcher has dynamic Vite port selection, `--dry-run`, and carriage-return log cleanup | Done for current Electron launcher                                 |
| Turbo graph       | `dev` depends on contracts build, `typecheck` task exists, env allowlist is explicit                   | `turbo.json` has `build`, `dev`, `typecheck`, `test`, `lint`, `clean`, and `globalEnv`         | Done                                                               |
| TypeScript config | root `tsconfig.base.json`, strict options, package configs inherit                                     | root `tsconfig.json` with references                                                           | Consider split into `tsconfig.base.json` plus root solution config |
| Lint              | Oxlint root config plus custom rule plugin                                                             | Root `lint` runs through Turbo; web uses ESLint, TS-only workspaces use `tsc --noEmit`         | Done for baseline; Oxlint/custom rules remain optional             |
| Format            | Oxfmt root config, package JSON sorting, editor integration                                            | Root `fmt` and `fmt:check` use Prettier with committed ignore/config files                     | Done                                                               |
| Tests             | root Vitest config, package `test` scripts, browser test command for web                               | Root `test` runs through Turbo; desktop Vitest suite is wired and passing                      | Done for current test surface; browser tests remain optional       |
| CI                | format, lint, typecheck, test, browser test, desktop build, preload bundle verification, release smoke | CI workflow runs install, format, lint, typecheck, test, and web build on PR/push              | Done for baseline CI                                               |
| Editor defaults   | `.vscode/settings.json` and extension recommendations                                                  | VS Code settings and recommendations configure Prettier, ESLint, and workspace TypeScript      | Done                                                               |
| Devcontainer      | Bun, Node, Python, Git, frozen install                                                                 | Devcontainer pins Bun, Node, Rust, Git, and frozen install setup                               | Done                                                               |
| PR hygiene        | PR template, issue templates, size labels, vouch labels                                                | PR template plus bug and feature issue templates are present                                   | Done for baseline; size/vouch automation remains optional          |
| Release scripts   | release smoke tests, artifact builder scripts, manifest helpers                                        | Release workflow, desktop scripts, and Electron smoke script are present                       | Done for baseline; manifest automation remains optional            |

## High-Value Borrow List

### 1. Root Quality Scripts

T3 Code has a clear completion contract:

```bash
bun fmt
bun lint
bun typecheck
bun run test
```

Dilag now exposes the same categories even though the underlying formatter/linter choices differ:

```json
{
  "scripts": {
    "typecheck": "turbo typecheck",
    "lint": "turbo lint",
    "test": "turbo test",
    "fmt": "prettier --write .",
    "fmt:check": "prettier --check ."
  }
}
```

If we choose Oxlint/Oxfmt, use:

```json
{
  "scripts": {
    "lint": "oxlint --report-unused-disable-directives",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check"
  }
}
```

Current state: Dilag uses Prettier. Oxfmt can be evaluated later only after a deliberate formatting diff review.

### 2. Typecheck as a First-Class Turbo Task

T3 Code treats `typecheck` separately from `build`. That improves feedback speed and makes CI failures easier to classify.

Current Turbo task:

```json
{
  "tasks": {
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": [],
      "cache": false
    }
  }
}
```

Package `typecheck` scripts are now present for:

- `apps/desktop`: `tsc --noEmit`
- `apps/web`: `tsc --noEmit`
- `packages/ui`: `tsc --noEmit`
- `packages/desktop-bridge`: already has `typecheck`
- other packages: add as applicable

### 3. Deterministic Dev Runner

T3 Code's `scripts/dev-runner.ts` solves three DX problems:

- predictable port selection
- per-mode environment wiring
- one root command for web, desktop, and combined dev

Dilag does not need to copy the Effect implementation. The current Electron launcher covers the important pieces:

- chooses a Vite port with conflict detection
- supports `--dry-run`
- sets `VITE_DEV_SERVER_URL` and `VITE_PORT` in one place
- splits child output on carriage returns and newlines to avoid repeated progress prefixes
- keeps `bun run dev:desktop` usable when the default Vite port is busy

This also directly addresses the repeated `[vite]` output seen in the desktop dev terminal.

### 4. Explicit Turbo Env

T3 Code lists all dev/build-sensitive env vars in `turbo.json` via `globalEnv`.

Dilag now has an explicit env allowlist for variables that affect output or dev runtime:

```json
{
  "globalEnv": [
    "VITE_DEV_SERVER_URL",
    "TAURI_DEV_HOST",
    "DILAG_API_URL",
    "OPENCODE_TARGET",
    "APPLE_SIGNING_IDENTITY"
  ]
}
```

This keeps Turbo cache behavior more predictable and documents the real runtime knobs.

### 5. Toolchain Pinning

T3 Code pins Node and Bun in `.mise.toml`:

```toml
[tools]
node = "24.13.1"
bun = "1.3.9"
```

Dilag now declares `packageManager` as `bun@1.2.14` and pins local tools with:

```toml
[tools]
node = "24"
bun = "1.2.14"
```

If we want Bun catalogs, upgrade Bun first and pin that version.

### 6. CI Quality Gate

T3 Code's CI runs quality checks before build/release:

- install with frozen lockfile
- format check
- lint
- typecheck
- test
- browser test
- desktop build
- release smoke
- preload bundle verification

Dilag now has `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json
      - run: bun install --frozen-lockfile
      - run: bun run fmt:check
      - run: bun run lint
      - run: bun run typecheck
      - run: bun run test
      - run: bun run build:web
```

Desktop native packaging can be added after this JS quality path stays stable.

### 7. Contract Package Boundary

T3 Code has `packages/contracts` for shared schemas and protocol types, and `packages/shared` for runtime utilities. That separation is valuable for agent products because IPC, websocket, provider events, and session models drift quickly.

Dilag already has `packages/desktop-bridge`, `packages/shared`, and `packages/ui`. The missing convention is explicit ownership:

- `packages/desktop-bridge`: renderer/preload IPC contract only
- `packages/shared`: runtime utilities with no React dependency
- `packages/ui`: presentational primitives
- possible future `packages/contracts`: app/session/provider schemas shared by desktop, web, and backend

Recommendation: do not create `contracts` until there are at least two real consumers for a type/schema. When created, keep it schema/protocol-only.

### 8. Editor Defaults

T3 Code commits VS Code formatter and extension recommendations. Dilag now does the same for Prettier, ESLint, and workspace TypeScript:

```json
{
  "editor.formatOnSave": true,
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

If Oxlint/Oxfmt is adopted later, replace these with OXC extension settings in the same file.

## Things Not To Copy Yet

### Effect Everywhere

T3 Code uses Effect deeply in scripts, server code, config parsing, and tests. That fits their architecture but would be a major architectural choice for Dilag.

Do not adopt Effect as a DX cleanup step. It should only be considered if Dilag chooses Effect for core app runtime patterns.

### Custom Oxlint Plugin

T3 Code has `oxlint-plugin-t3code` for repo-specific rules. Dilag does not need this until repeated code review issues can be encoded into a simple rule.

### PR Size and Vouch Automation

T3 Code's PR-size and vouch workflows are maintainership tools for a high-traffic public repo. Dilag now has the lower-cost baseline: a PR template, issue templates, and CI.

## Proposed Adoption Plan

### Phase 1: Baseline Checks

Status: done.

- root `typecheck`
- root `fmt` and `fmt:check`
- package-level `typecheck` scripts
- Turbo `typecheck` task
- `.mise.toml`
- `.github/workflows/ci.yml`

Expected impact: one command suite for local completion and CI parity.

### Phase 2: Desktop Dev Runner Cleanup

Status: done for the current Electron launcher.

Minimum changes:

- split child output on `\r` and `\n`
- avoid double-prefixing already rewritten progress frames
- check port availability before spawning Vite
- add `--dry-run` or equivalent debug output
- document env vars passed to Electron/Vite

Expected impact: cleaner terminal logs and fewer "port already in use" restarts.

### Phase 3: Package Boundary Tightening

Document package roles in root `AGENTS.md`:

- `apps/desktop`
- `apps/web`
- `packages/desktop-bridge`
- `packages/shared`
- `packages/ui`
- `packages/db`

Then only add `packages/contracts` if IPC/session/provider types are being duplicated.

Expected impact: easier code navigation and fewer cross-package dependency mistakes.

### Phase 4: Optional Tooling Upgrades

Evaluate:

- Bun workspace catalog
- Oxlint/Oxfmt
- root Vitest config
- browser tests for web or desktop renderer
- release smoke test script
- PR size and vouch automation

Expected impact: faster feedback and cleaner external collaboration, but lower priority than the now-completed baseline.

## Completed Baseline

The baseline parity scope is complete:

1. Add `.mise.toml`.
2. Add root `typecheck`, `fmt`, and `fmt:check` scripts.
3. Add package `typecheck` scripts where missing.
4. Add Turbo `typecheck` task.
5. Add `.github/workflows/ci.yml` with install, format, lint, typecheck, test, and web build.
6. Add PR and issue templates.
7. Add a devcontainer.
8. Add/update docs with this completion contract:

```bash
bun run fmt:check
bun run lint
bun run typecheck
bun run test
bun run build
```

The larger optional follow-up is to evaluate Oxlint/Oxfmt, browser tests, and PR-size/vouch automation.
