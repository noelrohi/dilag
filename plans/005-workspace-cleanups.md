# Plan 005: Workspace cleanups — dedupe session creation, shared types, React catalog pin, turbo outputs, dead surfaces

> **Executor instructions**: Follow this plan step by step. Each numbered step
> is independent — verify each before the next. If anything in the "STOP
> conditions" section occurs, stop and report — do not improvise. When done,
> update the status row for this plan in `plans/README.md` — unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 963c011..HEAD -- apps/desktop/src/hooks/use-sessions.ts apps/desktop/src/hooks/use-designs.ts turbo.json package.json apps/desktop/package.json packages/ui/package.json apps/web/package.json apps/desktop/electron/ipc/host.ts apps/desktop/electron/shared/channels.ts apps/desktop/electron/preload.ts packages/desktop-bridge/src/index.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (bundle of S items)
- **Risk**: LOW
- **Depends on**: none. Coordinate with plan 004 (both touch `turbo.json` and package.json devDeps — land 004 first or rebase).
- **Category**: tech-debt / dx
- **Planned at**: commit `963c011`, 2026-07-07

## Why this matters

Six independently-verified paper cuts. Each is small; together they remove real drift risk: a copy-pasted session-creation contract that has already diverged, renderer-side duplicates of bridge-owned types, three different React version specifiers across the workspace (duplicate-React hook crashes are miserable to debug), a Turbo build cache that silently omits the Electron main bundle, an IPC channel that can only throw, and two phantom workspace directories.

## Current state

1. **Session-creation duplication** — `apps/desktop/src/hooks/use-sessions.ts` has four near-identical blocks: `createSession` (`:298`), `createSessionInProject` (`:347`), `forkSession` (`:528`), `forkSessionDesignsOnly` (`:577`). Each builds a `SessionMeta`, calls `bridge.sessions.saveMeta`, optimistically inserts into the React Query cache, invalidates `sessionKeys.list()`, then `setCurrentSessionId(...)` + `setMessages(id, [])`. Excerpt from `createSession` (`:311-322`):

```ts
        const response = await bridge.agent.createSession({ directory: cwd })
        const sessionId = response.id
        const now = new Date().toISOString()
        const sessionMeta: SessionMeta = {
          id: sessionId,
          name: name ?? `Session ${sessions.length + 1}`,
          created_at: now,
          updated_at: now,
```

The copies have drifted: only some set `favorite`/`parentID`/`platform`.

2. **Duplicated bridge types** — `apps/desktop/src/hooks/use-designs.ts:7-28` re-declares `ViolationRule`, `Violation`, `DesignFile` identically to `packages/desktop-bridge/src/types.ts:47-68` (verified identical). Renderer files import `DesignFile` from `@/hooks/use-designs` (e.g. `src/lib/design-export.ts:4`, `src/components/canvas/design-canvas.tsx:18`).

3. **React version drift** — `apps/desktop/package.json:96-97` has `react`/`react-dom` `^19.1.0`; `apps/web/package.json:18-19` pins `19.2.1`; `packages/ui/package.json:66-67` peers/deps `^19.0.0`; `@types/react` varies (`^19.1.8` vs `^19`). The root catalog (`package.json:9-21`) already pins `typescript` and shared UI deps but not React.

4. **Turbo build outputs incomplete** — `turbo.json:14-17`:

```json
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
```

but `apps/desktop`'s build (`tsc && vite build && tsdown`) also emits `dist-electron/` (package `main` is `dist-electron/main.cjs`). A build restored from Turbo cache is missing the Electron main/preload bundle. Also `"test": { "dependsOn": ["^build"] }` (`:27-29`) forces upstream builds vitest doesn't need (internal packages export raw `src`).

5. **Dead `captureHtmlToImage` channel + no-op bootstrap port** — `apps/desktop/electron/ipc/host.ts:229-231`:

```ts
ipcMain.handle(CHANNELS.designs.captureHtmlToImage, () => {
  throw new Error("Native capture not supported. Use html2canvas fallback.")
})
```

wired through `electron/shared/channels.ts:66`, `electron/preload.ts:87`, the bridge interface (`packages/desktop-bridge/src/index.ts:122`), and mocked in `src/test/setup.ts:66`; the only renderer references are the test mock (verified: no product caller — PNG export uses html2canvas in `src/lib/design-export.ts`). Separately `host.ts:65-67` `getBootstrapPort()` unconditionally returns `0`, consumed only by `electron/main.ts` (search `getBootstrapPort` / `dilag-bootstrap-port`).

6. **Phantom workspace dirs** — `packages/db/` and `packages/shared/` contain **only** a `node_modules/` directory (no package.json, no src). They are matched by the `packages/*` workspace glob and documented nowhere (README/docs list only `ui` and `desktop-bridge`).

Conventions: conventional commits; bridge is the single source of cross-process types (AGENTS.md: "Renderer code talks to native/runtime capabilities through `@dilag/desktop-bridge`").

## Commands you will need

| Purpose   | Command                                 | Expected on success |
| --------- | --------------------------------------- | ------------------- |
| Install   | `bun install`                           | exit 0              |
| Typecheck | `bun run typecheck`                     | exit 0              |
| Tests     | `bun run --cwd apps/desktop test --run` | all pass            |
| Build     | `bun run build`                         | exit 0              |
| Format    | `bun run fmt`                           | exit 0              |

## Scope

**In scope**:

- `apps/desktop/src/hooks/use-sessions.ts` (+ `use-sessions.test.ts`)
- `apps/desktop/src/hooks/use-designs.ts` (type re-export only)
- Root `package.json`, `apps/desktop/package.json`, `apps/web/package.json`, `packages/ui/package.json` (React catalog)
- `turbo.json`
- `apps/desktop/electron/ipc/host.ts`, `electron/shared/channels.ts`, `electron/preload.ts`, `packages/desktop-bridge/src/index.ts`, `apps/desktop/src/test/setup.ts`, `apps/desktop/electron/main.ts` (dead-surface removal)
- Deletion of `packages/db/` and `packages/shared/`

**Out of scope**:

- Splitting `pi.ts` or converging Zustand stores (recorded as larger follow-ups in `plans/README.md`, not planned).
- The per-method IPC arg-type dedup across bridge/host/preload (~30 methods) — worthwhile but M-sized on its own; do not start it here.
- `validateHtml`'s `Promise<unknown>` return type — tighten ONLY if it doesn't cascade (see Step 5).

## Git workflow

- Branch: `advisor/005-workspace-cleanups`
- One conventional commit per step, e.g. `refactor(desktop): extract persistNewSession helper`, `chore: pin react via workspace catalog`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract `persistNewSession` in `use-sessions.ts`

Add a private helper inside the hook file that takes a fully-built `SessionMeta` and performs: `bridge.sessions.saveMeta({ session: meta })` → optimistic `queryClient.setQueryData(sessionKeys.list(), old => [...(old ?? []), meta])` → `queryClient.invalidateQueries({ queryKey: sessionKeys.list() })` → `setCurrentSessionId(meta.id)` + `setMessages(meta.id, [])`. Rewrite the four creators to build their `SessionMeta` (preserving each one's exact current fields — `favorite`, `parentID`, `platform`, name defaults) and delegate. Behavior must be identical; this is a pure extraction.

**Verify**: `bun run --cwd apps/desktop test --run src/hooks/use-sessions.test.ts` → all pass. `bun run --cwd apps/desktop typecheck` → exit 0.

### Step 2: Single-source the design types

In `use-designs.ts`, delete the local `ViolationRule`/`Violation`/`DesignFile` declarations and replace with:

```ts
export type { DesignFile, Violation, ViolationRule } from "@dilag/desktop-bridge"
```

(re-export preserves every existing `@/hooks/use-designs` import site).

**Verify**: `bun run typecheck` → exit 0. `grep -n "interface DesignFile" apps/desktop/src/hooks/use-designs.ts` → no match.

### Step 3: Pin React via the catalog

Add to root `package.json` `workspaces.catalog`: `"react": "19.2.1"`, `"react-dom": "19.2.1"`, `"@types/react": "^19.1.8"`, `"@types/react-dom": "^19.1.8"` (check `@types/react-dom` current specifiers first and keep the strictest compatible). Replace the specifiers in `apps/desktop`, `apps/web`, `packages/ui` with `"catalog:"`. For `packages/ui`, only dependencies/devDependencies move to `catalog:` — leave `peerDependencies` ranges as-is (peers express compatibility, not resolution). Run `bun install`.

**Verify**: `bun install` → exit 0; `grep -rn '"react"' apps/*/package.json packages/ui/package.json` → all non-peer entries say `catalog:`. `bun run build` → exit 0.

### Step 4: Fix turbo task graph

In `turbo.json`: add `"dist-electron/**"` to build outputs; change test to not require building dependencies:

```json
"build": { "dependsOn": ["^build"], "outputs": ["dist/**", "dist-electron/**", ".next/**", "!.next/cache/**"] },
"test": { "dependsOn": [] },
```

(If plan 004 already changed `lint`, leave its shape alone.)

**Verify**: `bun run --cwd apps/desktop test --run` still passes without a prior build: `rm -rf packages/ui/dist packages/desktop-bridge/dist 2>/dev/null; bun run test` → exit 0. Then `bun run build` twice; second run shows `FULL TURBO`/cache hit and `apps/desktop/dist-electron/main.cjs` exists after `rm -rf apps/desktop/dist-electron && bun run build:desktop` restores it (run `bun run build:desktop` once more after deleting to confirm cache replay materializes `dist-electron`).

### Step 5: Remove dead surfaces

1. Delete the `captureHtmlToImage` handler (`host.ts:229-231`), the channel constant (`electron/shared/channels.ts:66`), the preload forwarding line (`preload.ts:87`), the bridge interface method (`packages/desktop-bridge/src/index.ts:122`), and the test-setup mock (`src/test/setup.ts:66`). First re-confirm zero product callers: `grep -rn "captureHtmlToImage" apps/desktop/src packages` → only the files above.
2. Delete `getBootstrapPort()` (`host.ts:65-67`) and its call site in `electron/main.ts` (find via `grep -n "getBootstrapPort\|bootstrap-port" apps/desktop/electron/main.ts`), removing the `--dilag-bootstrap-port` argument entirely.
3. Optional: change `validateHtml`'s bridge return type from `Promise<unknown>` to `Promise<Violation[]>` (`packages/desktop-bridge/src/index.ts:121`; the implementation `electron/ipc/designs.ts:24` already returns `Violation[]`). Skip if any consumer treats it differently.

**Verify**: `grep -rn "captureHtmlToImage\|getBootstrapPort" apps packages` → no matches. `bun run typecheck && bun run build` → exit 0. `bun run --cwd apps/desktop test --run` → all pass.

### Step 6: Delete phantom package dirs

`packages/db` and `packages/shared` contain only `node_modules`. Delete both directories. Run `bun install` and confirm the lockfile change is limited to workspace membership.

**Verify**: `ls packages` → `desktop-bridge ui`. `bun install && bun run build && bun run --cwd apps/desktop test --run` → exit 0.

## Test plan

Mostly covered by existing suites (this is refactor/config work). One addition:

- In `use-sessions.test.ts`, if no existing test covers fork metadata, add one asserting `forkSession` produces a `SessionMeta` with `parentID` set and appears in the list cache — guards the Step 1 extraction. Model after the existing "project chat and sends the first prompt" test in the same file.

## Done criteria

- [ ] All six step verifications pass
- [ ] `bun run typecheck`, root `bun run test`, `bun run build`, `bun run fmt:check` all exit 0
- [ ] `grep -rn "captureHtmlToImage\|getBootstrapPort" apps packages` → empty
- [ ] `ls packages` → exactly `desktop-bridge` and `ui`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any grep-for-callers check in Step 5 finds a caller the plan says shouldn't exist.
- `packages/db`/`packages/shared` contain anything besides `node_modules` when you look (someone started real work there) — skip Step 6 and report.
- Step 1's extraction can't preserve one creator's behavior exactly (e.g. ordering of invalidate vs navigate matters somewhere) — report which creator and why.
- Bun refuses `catalog:` for any of the React entries (catalog feature mismatch) — report the bun version and stop Step 3.

## Maintenance notes

- Follow-ups recorded in the index, deliberately not planned here: split of `electron/ipc/pi.ts` (1430 lines), Zustand store convention convergence, per-method IPC arg-type dedup.
- After Step 3, all new React-touching packages must use `catalog:`.
- Reviewer: Step 1 diff should show pure code motion for the four creators — any logic change is a red flag.
