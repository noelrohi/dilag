# Plan 010: One-click migration for legacy sessions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 963c011..HEAD -- apps/desktop/src/routes/index.tsx apps/desktop/electron/ipc/projects.ts apps/desktop/electron/ipc/sessions.ts apps/desktop/electron/ipc/paths.ts apps/desktop/src/hooks/use-projects.ts`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED — touches users' on-disk data; must be idempotent and non-destructive
- **Depends on**: none
- **Category**: direction / migration
- **Planned at**: commit `963c011`, 2026-07-07

## Why this matters

Users upgrading from pre-Pi builds see an "Old sessions found" notice whose only options are "Use an existing folder" (a generic folder picker — they must remember and re-add each session folder by hand) and "Dismiss". The app _detects_ prior work but doesn't _migrate_ it. A one-click importer registers every legacy session's folder as a project automatically, and is the prerequisite for eventually deleting the legacy read paths (`~/.dilag/sessions.json`, `~/.dilag/sessions/{id}`) that `docs/architecture.md:71` explicitly calls "legacy-only migration surfaces".

## Current state (verified at 963c011)

- The notice UI (`apps/desktop/src/routes/index.tsx:149-172`):

```tsx
              {legacyNotice?.hasLegacySessions && !legacyNotice.dismissed && (
                ...
                        <h2 className="text-sm font-medium">Old sessions found</h2>
                        <p ...>
                          Your previous Dilag sessions are still on this device. Add any session
                          folder as a Project to keep working with it.
                        </p>
                      ...
                        <Button size="sm" variant="secondary" onClick={handleUseExistingFolder}>
                          Use an existing folder
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => dismissLegacyNotice()}>
                          Dismiss
                        </Button>
```

Note: this notice lives on the `/` route, which only renders when the user has **zero projects** (the route auto-redirects to a project otherwise — `index.tsx:31-49`). The migration action must therefore also be reachable for users who already created a project; check whether `useLegacySessionsNotice` is consumed anywhere else (`grep -rn "useLegacySessionsNotice" apps/desktop/src`) and, if not, note in the final report that post-onboarding users can't see it (follow-up, not this plan's scope to fix).

- Detection is existence-only (`apps/desktop/electron/ipc/projects.ts:251-256`):

```ts
export function getLegacySessionsNotice(): { hasLegacySessions: boolean; dismissed: boolean } {
  return {
    hasLegacySessions: fs.existsSync(getSessionsFile()),
    dismissed: getAppState("legacySessionsNoticeDismissed", false),
  }
}
```

- Legacy store location (`apps/desktop/electron/ipc/paths.ts:23-25`): `~/.dilag/sessions.json`. The legacy reader exists (`apps/desktop/electron/ipc/sessions.ts:11`): `JSON.parse(fs.readFileSync(getSessionsFile(), "utf8"))` — **investigate its store shape first** (read `electron/ipc/sessions.ts` fully; it both reads and writes this store today, so determine what fields a legacy session record carries — id, name, cwd, timestamps — and whether `~/.dilag/sessions/{id}` subdirs hold anything the migration needs).
- Project registration: SQLite-backed, `electron/ipc/projects.ts` (create/list/remove/touch — the same file has `INSERT INTO app_state` upsert helpers at `:243-249`; find the project-create function via `grep -n "export function" electron/ipc/projects.ts`). The renderer calls it via `useProjectMutations().addExistingProject` (see `routes/index.tsx:27` and `use-projects.ts`).
- Bridge wiring exemplar for a new method: `projects.getLegacyNotice` / `dismissLegacyNotice` already flow through `packages/desktop-bridge/src/index.ts:113-114`, `electron/shared/channels.ts`, `host.ts`, `preload.ts` — mirror them.

Conventions: conventional commits; toasts via `sonner`; main-process functions in `ipc/*.ts` are plain Node and unit-testable with temp dirs.

## Commands you will need

| Purpose   | Command                                 | Expected on success |
| --------- | --------------------------------------- | ------------------- |
| Typecheck | `bun run typecheck`                     | exit 0              |
| Tests     | `bun run --cwd apps/desktop test --run` | all pass            |
| Build     | `bun run build:desktop`                 | exit 0              |

## Scope

**In scope**:

- `apps/desktop/electron/ipc/projects.ts` (new `importLegacySessions()`)
- Bridge wiring: `packages/desktop-bridge/src/index.ts`, `electron/shared/channels.ts`, `electron/ipc/host.ts`, `electron/preload.ts`, `apps/desktop/src/test/setup.ts`
- `apps/desktop/src/routes/index.tsx`, `apps/desktop/src/hooks/use-projects.ts` (the one-click action)
- New test file for the importer

**Out of scope**:

- Deleting or modifying `~/.dilag/sessions.json` or `~/.dilag/sessions/**` — the migration is READ-ONLY on legacy data (mark migrated via app_state, not by mutating the legacy store).
- Normalizing `screens/` → `.designs/` inside project folders (separate migration; the fallback loader already handles display).
- Retiring the legacy fallback code paths (only possible a release or two after this ships).
- Surfacing the notice outside the zero-project home (noted as follow-up).

## Git workflow

- Branch: `advisor/010-legacy-session-migration`
- Conventional commits, e.g. `feat(desktop): one-click legacy session import`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Understand the legacy store shape

Read `electron/ipc/sessions.ts` fully. Write down (in your report and as a comment on the importer): the record fields, where the session's working directory lives in the record, and what `~/.dilag/sessions/{id}` contains. If legacy records do NOT carry a usable project folder path, STOP — the importer design assumed they do.

**Verify**: you can state, with a code citation, how to get `(name, cwd)` for each legacy session.

### Step 2: Implement `importLegacySessions()` in `projects.ts`

```ts
export function importLegacySessions(): {
  imported: number
  skipped: Array<{ name: string; reason: string }>
}
```

For each legacy record: skip if its cwd no longer exists on disk (`reason: "folder missing"`); skip if a project with the same path is already registered (`reason: "already registered"` — makes the operation idempotent); otherwise register it as a project via the existing project-create code path (same function `addExistingProject` ultimately hits — reuse it, do not duplicate INSERT logic). On success, set `app_state.legacySessionsNoticeDismissed = true`. Never write to the legacy files.

**Verify**: new unit test (Step 4) passes.

### Step 3: Wire the bridge + UI

Mirror the `getLegacyNotice` wiring for `projects.importLegacy()`. In `routes/index.tsx`, add a primary button to the notice: "Import all" → calls it → `toast.success(\`Imported N projects\`)`(+ per-skip reasons in a`toast.message`if any) → invalidate the projects query (see`useProjectMutations` for the invalidation pattern). Keep "Use an existing folder" and "Dismiss" as secondary options.

**Verify**: `bun run typecheck` → exit 0; `bun run --cwd apps/desktop test --run` → all pass; `bun run build:desktop` → exit 0.

### Step 4: Tests

New `apps/desktop/src/test/import-legacy-sessions.test.ts` (main-process function with temp `~/.dilag` — check how existing tests isolate paths: `grep -rn "DILAG_DIR\|getDilagDir" apps/desktop/electron/ipc/paths.ts apps/desktop/src/test` to find the env override; if `paths.ts` has no injectable base dir, add an env-var override there as part of this step — smallest possible: read `process.env.DILAG_HOME ?? os.homedir()`):

- imports two legacy sessions with existing folders → 2 projects registered, notice dismissed
- second run → `imported: 0`, both skipped "already registered" (idempotency)
- record with missing folder → skipped with "folder missing"
- malformed `sessions.json` → returns gracefully (0 imported, error surfaced, legacy file untouched)
- legacy files byte-identical before/after every case

**Verify**: `bun run --cwd apps/desktop test --run` → all pass including the 5 new cases.

## Done criteria

- [ ] `bun run typecheck`, `bun run --cwd apps/desktop test --run`, `bun run build:desktop` all exit 0
- [ ] Idempotency + read-only-on-legacy-data proven by tests (including the byte-identical check)
- [ ] The notice offers "Import all" as its primary action
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 1 reveals legacy records don't contain a usable folder path.
- `paths.ts` hard-codes the home dir in a way that can't take a minimal env override without touching many call sites — report the blast radius instead of refactoring.
- The project-create path has side effects beyond SQLite registration (e.g. writes into the folder) that would be wrong for bulk import.

## Maintenance notes

- After this ships and bakes for a release, a follow-up can retire the legacy read paths (`sessions.ts` legacy reader, the `screens/` display fallback stays separate).
- Reviewer: verify no code path writes to `getSessionsFile()` during import, and the app_state dismissal doesn't hide the notice while legacy sessions remain un-imported (dismiss only on success).
