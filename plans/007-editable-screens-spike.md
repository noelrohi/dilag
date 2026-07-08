# Plan 007 (spike): Editable screens — hand-edit, rename, duplicate generated designs

> **Executor instructions**: This is a DESIGN SPIKE, not a build plan. The
> deliverable is a written design doc plus at most a throwaway prototype
> branch. Do not merge product code from this plan. If anything in the "STOP
> conditions" section occurs, stop and report. When done, update the status
> row in `plans/README.md` and commit the design doc.
>
> **Drift check (run first)**: `git diff --stat 963c011..HEAD -- packages/desktop-bridge/src/index.ts apps/desktop/src/components/canvas/screen-node.tsx apps/desktop/src/components/blocks/dialogs/dialog-code-viewer.tsx apps/desktop/electron/ipc/designs.ts`

## Status

- **Priority**: P2 (highest product leverage of the direction items)
- **Effort**: M (spike itself: S–M; the build it specifies: M–L)
- **Risk**: MED — manual edits must coexist with agent-written files
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `963c011`, 2026-07-07

## Why this matters

Dilag is a design studio whose designs are create-by-AI and delete-only afterwards. A user who wants to fix a typo, tweak a color, rename an AI-chosen filename, or fork a screen into a variant must do a full AI round-trip (or leave the app). The surface is CRUD-minus-everything-between. This spike defines how manual editing coexists with agent ownership of `.designs/`, and specifies the bridge + UI changes for a later build plan.

## Current state (verified at 963c011)

- The `designs` bridge namespace is read/delete-only (`packages/desktop-bridge/src/index.ts:117-123`):

```ts
  designs: {
    loadForSession(args: { sessionCwd: string }): Promise<DesignFile[]>
    copyBetweenSessions(args: { sourceCwd: string; destCwd: string }): Promise<void>
    delete(args: { filePath: string }): Promise<void>
    validateHtml(args: { html: string }): Promise<unknown>
    captureHtmlToImage(args: { html: string }): Promise<unknown>   // dead; plan 005 removes it
  }
```

- The `project` namespace is read-only (`index.ts:125-128`): `listFiles`, `readFile` — no write.
- A generic byte-writer exists (`index.ts:155-158`): `fs.writeFile(path: string, data: Uint8Array)` — so main-process plumbing for writes is partially there, but nothing design-shaped (no validation, no path policy).
- The code viewer is view-only: `apps/desktop/src/components/blocks/dialogs/dialog-code-viewer.tsx:71+` renders via `@pierre/diffs`' `File` component (syntax-highlighted static view).
- Screen context menu (`apps/desktop/src/components/canvas/screen-node.tsx:253+`, content at `:392+`): Add-to-composer / copy / download / export / delete — no Rename, no Duplicate, no Edit.
- Canonical file policy lives in `packages/desktop-bridge/src/generated-screen-policy.ts` (`.designs/` canonical, `screens/` legacy fallback; helpers like `getCanonicalGeneratedScreenPath`).
- Design loading: `apps/desktop/electron/ipc/designs.ts:94` `loadDesignsForSession`; `validateHtml` at `:24` returns `Violation[]`.
- File-change freshness: the renderer refreshes designs via `file.watcher.updated` events (see `docs/architecture.md` event list) — a manual write from the app would flow through the same watcher path. Verify during the spike where the watcher is registered (grep `file.watcher` in `apps/desktop/electron`).

## Commands you will need

| Purpose   | Command                                 | Expected |
| --------- | --------------------------------------- | -------- |
| Typecheck | `bun run --cwd apps/desktop typecheck`  | exit 0   |
| Tests     | `bun run --cwd apps/desktop test --run` | pass     |

## Scope

**Spike deliverable** (the only merged artifact): `plans/007-editable-screens-DESIGN.md` answering the questions below, plus an appendix with the proposed bridge signatures.

**Out of scope**: shipping any of it; changing `generated-screen-policy.ts` semantics; visual redesign of the code viewer.

## Questions the design doc must answer

1. **Ownership model**: when a user hand-edits a file Pi later rewrites, what happens? Options to evaluate: (a) last-writer-wins + rely on session timeline for recovery; (b) inform the agent of manual edits via the next prompt's context; (c) refuse concurrent edit while a session streams. Recommend one; justify against the existing tree/timeline navigation (`bridge.agent.navigateTree` reloads messages — does it also rewrite files? Investigate `navigateTree` in `electron/ipc/pi.ts`; if timeline navigation regenerates `.designs/`, manual edits can be silently clobbered and the doc MUST address it).
2. **Bridge surface**: exact signatures, e.g. `designs.write({ sessionCwd, filename, html })` (validates via `validateHtml`, enforces path within the canonical dir using `generated-screen-policy.ts` helpers — no absolute paths from the renderer), `designs.rename({ sessionCwd, from, to })`, `designs.duplicate({ sessionCwd, filename })`. State whether `fs.writeFile` should be deprecated in favor of the design-shaped API (recommended: yes for renderer callers).
3. **Editor UX**: minimum lovable version — make `dialog-code-viewer` editable (swap `File` for a `<textarea>`/CodeMirror? — check bundle-cost appetite; the repo currently ships no code-editor dependency) with Save + validation errors inline; Rename/Duplicate as context-menu items with inline-input dialogs. Where does unsaved-changes state live?
4. **Watcher loop**: confirm a bridge-initiated write triggers the same `file.watcher.updated` → canvas refresh path, and that it doesn't echo into an infinite loop.
5. **Legacy fallback**: writes always target `.designs/` (canonical); a rename of a legacy `screens/` file should move it into `.designs/` (one-way migration per file). Confirm against `generated-screen-policy.ts`.

## Steps

1. Investigate the five questions above in the code (read `electron/ipc/designs.ts`, `pi.ts` navigateTree + file-watcher registration, `dialog-code-viewer.tsx`, `screen-node.tsx` menu, `generated-screen-policy.ts`). **Verify**: each answer in the doc cites `file:line`.
2. (Optional, timeboxed) Throwaway prototype on a branch: `designs.write` handler + editable textarea in the dialog, no rename/duplicate. Purpose: validate the watcher round-trip only. **Verify**: note the observed event flow in the doc; do not merge.
3. Write `plans/007-editable-screens-DESIGN.md`: recommendation per question, proposed bridge signatures, UI inventory (which components change), build-plan step outline, open risks. **Verify**: doc exists; a build plan could be written from it without re-investigating.

## Done criteria

- [ ] `plans/007-editable-screens-DESIGN.md` committed, answering all five questions with `file:line` citations
- [ ] Every proposed bridge method has a full TypeScript signature and a path-containment rule
- [ ] The clobbering question (timeline navigation vs manual edits) has an explicit, evidenced answer
- [ ] `plans/README.md` status row updated

## STOP conditions

- `navigateTree` behavior can't be determined from code reading (would need live experimentation the environment doesn't allow) — report what's known and what experiment is needed.
- Evidence that `.designs/` files are hashed/tracked by Pi such that out-of-band writes corrupt session state.

## Maintenance notes

- The build plan that follows should land bridge + main-process write/rename/duplicate first (testable headless), UI second.
- Interaction with plan 008 (import): both write into `.designs/` through the same policy helpers — share the validated-write path.
