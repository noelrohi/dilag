# Plan 004: Give the desktop app and shared packages a real linter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 963c011..HEAD -- apps/desktop/package.json packages/ui/package.json packages/desktop-bridge/package.json turbo.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `963c011`, 2026-07-07

## Why this matters

Three of the four workspace packages define `"lint": "tsc --noEmit"` — an exact duplicate of their `typecheck` script. Only the marketing site (`apps/web`) has a real ESLint setup. The largest and most async-heavy surface — the Electron + React 19 desktop renderer — has **zero lint coverage**: no `react-hooks/exhaustive-deps` (this codebase is full of long `useCallback`/`useEffect` dependency arrays), no unused-variable detection, no floating-promise checks on IPC calls. CI's "Lint" step (`.github/workflows/ci.yml:28`) silently re-runs typecheck. Real bugs in this repo's other plans (stale closures, unawaited promises) are of exactly the classes a linter catches at write time.

## Current state

- `apps/desktop/package.json:16` — `"lint": "tsc --noEmit"` (and `"typecheck": "tsc --noEmit"` at `:15`).
- `packages/ui/package.json:49` — `"lint": "tsc --noEmit"`.
- `packages/desktop-bridge/package.json:12` — `"lint": "tsc --noEmit"`.
- `apps/web/package.json:10` — `"lint": "eslint"`, with devDeps `eslint ^9` and `eslint-config-next 16.0.10`; config at `apps/web/eslint.config.mjs` (flat config, `defineConfig` + `globalIgnores`):

```js
import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
])
export default eslintConfig
```

- `turbo.json:30-32` — `"lint": { "dependsOn": ["^build"] }`: lint of one package first _builds_ all its dependencies, which nothing about linting requires (both `tsc --noEmit` today and `eslint` after this plan read source; internal packages export raw source, e.g. `packages/ui` exports `./src/...`).
- CI (`.github/workflows/ci.yml:25-34`) runs `fmt:check`, `lint`, `typecheck`, `test` at the root.
- Package manager: Bun 1.2 workspaces + catalog (root `package.json`).

## Commands you will need

| Purpose   | Command                                 | Expected on success |
| --------- | --------------------------------------- | ------------------- |
| Install   | `bun install`                           | exit 0              |
| Lint all  | `bun run lint` (root, via turbo)        | exit 0              |
| Lint one  | `bun run --cwd apps/desktop lint`       | exit 0              |
| Typecheck | `bun run typecheck`                     | exit 0              |
| Tests     | `bun run --cwd apps/desktop test --run` | all pass            |

## Scope

**In scope**:

- New: `eslint.config.mjs` in `apps/desktop`, `packages/ui`, `packages/desktop-bridge` (or one shared config file at repo root imported by each — executor's choice; prefer a root `eslint.config.base.mjs` imported by per-package configs to keep per-package ignores local)
- `apps/desktop/package.json`, `packages/ui/package.json`, `packages/desktop-bridge/package.json` (lint scripts + devDeps)
- Root `package.json` (catalog entries for the new dev deps, matching how `typescript` is cataloged)
- `turbo.json` (lint task inputs/deps)
- Mechanical source fixes for rule violations (any file under `apps/desktop/{src,electron}`, `packages/ui/src`, `packages/desktop-bridge/src`) — **fixes only, no refactors**

**Out of scope**:

- `apps/web` — its Next.js ESLint setup already works; leave it.
- Enabling type-aware linting (`projectService`) if it makes lint > ~60s — see Step 4 fallback.
- Pre-commit hooks (separate decision, not this plan).
- Any behavioral code change beyond satisfying a rule (if a fix isn't obviously mechanical, disable-with-comment and note it).

## Git workflow

- Branch: `advisor/004-desktop-eslint`
- Conventional commits, e.g. `chore(desktop): add eslint flat config` then `fix(desktop): resolve lint violations`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add dependencies

Add to the root catalog (root `package.json` `workspaces.catalog`): `eslint` (^9), `typescript-eslint` (^8), `eslint-plugin-react-hooks` (^5 or ^6 — latest), `@eslint/js`. Add them as devDeps (`"catalog:"`) to the three packages. Run `bun install`.

**Verify**: `bun install` → exit 0; `bunx eslint --version` inside `apps/desktop` → prints v9.x.

### Step 2: Write the flat configs

Per-package `eslint.config.mjs`. Baseline for `apps/desktop`:

```js
import js from "@eslint/js"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"

export default tseslint.config(
  { ignores: ["dist/**", "dist-electron/**", "release/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
)
```

`packages/ui` gets the same shape (with react-hooks); `packages/desktop-bridge` omits react-hooks (types-only package). Keep `tseslint.configs.recommended` (NOT `recommendedTypeChecked`) for the first landing — see fallback note in Step 4.

**Verify**: `bunx eslint . --max-warnings=0` in each package runs and reports (violations expected at this point) — it must not error on config loading.

### Step 3: Wire scripts and turbo

- In the three package.jsons: `"lint": "eslint . --max-warnings=0"`. Keep `"typecheck": "tsc --noEmit"` unchanged.
- In `turbo.json`, change the lint task to not build first and to cache on the right inputs:

```json
"lint": { "dependsOn": [], "inputs": ["src/**", "electron/**", "eslint.config.*", "package.json"] }
```

**Verify**: `bun run lint` at root → runs eslint for desktop/ui/bridge and next-lint for web (failures allowed until Step 4); `bun run --cwd apps/desktop lint` no longer triggers builds of `packages/*` (turbo output shows no build tasks).

### Step 4: Triage violations to zero

Run lint per package; fix mechanically:

- Auto-fixables: `bunx eslint . --fix`.
- Unused vars: prefix intentionally-unused args with `_` and set the standard rule option (`argsIgnorePattern: "^_"`).
- `react-hooks/exhaustive-deps` findings: fix only the clearly-safe ones (missing stable setters etc.). For any dep-array finding whose fix could change behavior (e.g. adding a dep that retriggers an effect), add `// eslint-disable-next-line react-hooks/exhaustive-deps -- TODO(lint): verify` and **list every such site in your final report** — these are candidate real bugs, not noise.
- If total violations exceed ~200 or a rule generates mass noise, downgrade that one rule to `"warn"` and remove `--max-warnings=0` for that package, then report the count.

Fallback: this plan lands non-type-aware linting. Do NOT enable `recommendedTypeChecked`/`no-floating-promises` in this pass; note it as follow-up.

**Verify**: `bun run lint` → exit 0. `bun run --cwd apps/desktop test --run` → all pass (proves fixes didn't change behavior). `bun run typecheck` → exit 0.

## Test plan

No new tests — the gate is the linter itself plus the existing suite staying green:

- `bun run lint` → exit 0
- `bun run --cwd apps/desktop test --run` → all pass
- `bun run build` → exit 0 (catches any over-eager "unused" deletion)

## Done criteria

- [ ] `grep '"lint"' apps/desktop/package.json packages/ui/package.json packages/desktop-bridge/package.json` → all three run `eslint`, none run `tsc`
- [ ] `bun run lint` exits 0 at repo root
- [ ] `bun run typecheck`, `bun run --cwd apps/desktop test --run`, `bun run build` all exit 0
- [ ] Final report lists every `eslint-disable` added, especially `exhaustive-deps` sites
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- ESLint v9 flat config is incompatible with a needed plugin version resolvable in this workspace (report the version conflict; don't pin random alphas).
- A lint fix requires a non-mechanical behavior change and disable-with-comment feels wrong (e.g. the rule found a live bug) — report the bug instead of fixing it silently.
- `turbo.json` lint-task change breaks `apps/web`'s lint (its inputs differ) — scope the inputs per-package via `turbo.json` package overrides or revert the inputs field and keep only `dependsOn: []`.

## Maintenance notes

- Follow-up (deliberately deferred): type-aware rules (`no-floating-promises` would be high-value on the IPC layer), lint in pre-commit.
- Every `TODO(lint): verify` disable is a candidate real bug; whoever picks up plan 001/006 should sweep the ones in files they touch.
- New packages must copy the per-package config + catalog dep pattern.
