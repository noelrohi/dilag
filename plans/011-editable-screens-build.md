# Plan 011: Editable screens — build (write/rename/duplicate from design doc 007)

> **Executor instructions**: Follow this plan step by step. Every design
> decision is already made — do not redesign, do not add options. Run every
> verification command and confirm the expected result before the next step.
> If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The reviewer maintains the plan index; do not create or edit
> `plans/README.md`.

## Status

- **Priority**: P2
- **Effort**: M-L
- **Risk**: MED — first manual-write surface into agent-owned `.designs/`
- **Depends on**: plan 008 (merged — its `writeDesignHtml`/`sanitizeDesignBasename`/`isInsideDirectory`/`fileExists` helpers in `apps/desktop/electron/ipc/designs.ts` are reused here)
- **Source design**: `plans/007-editable-screens-DESIGN.md` (tracked in repo — read it if a rationale is unclear, but THIS plan wins on any difference)
- **Planned at**: main @ `773681c`, 2026-07-08

## Deviations from the design doc (deliberate, reviewer-approved)

1. Bridge methods return **result unions with a final `filename`**, not a full `DesignFile` — the renderer refreshes via query invalidation anyway, and Electron IPC serializes thrown errors lossily, so validation failures come back as `{ ok: false, violations }` instead of typed throws.
2. The "manual edit summary → next-prompt hidden context" feature is **deferred** to a follow-up plan. This build: bridge + main process + editor + rename/duplicate + busy-gating only.

## Commands

| Purpose   | Command                                 | Expected |
| --------- | --------------------------------------- | -------- |
| Install   | `bun install`                           | exit 0   |
| Typecheck | `bun run typecheck`                     | exit 0   |
| Tests     | `bun run --cwd apps/desktop test --run` | all pass |
| Lint      | `bun run lint`                          | exit 0   |
| Format    | `bun run fmt` (before each commit)      | exit 0   |
| Build     | `bun run build:desktop`                 | exit 0   |

Never run plain `bun run test` inside apps/desktop — it is vitest watch mode.

## Scope

**In scope**:

- `packages/desktop-bridge/src/index.ts`, `packages/desktop-bridge/src/types.ts`
- `apps/desktop/electron/shared/channels.ts`, `electron/ipc/host.ts`, `electron/ipc/designs.ts`, `electron/preload.ts`
- `apps/desktop/src/test/setup.ts`
- `apps/desktop/src/components/blocks/dialogs/dialog-code-viewer.tsx`
- NEW `apps/desktop/src/components/blocks/dialogs/dialog-screen-name.tsx`
- `apps/desktop/src/components/canvas/screen-node.tsx`, `design-canvas.tsx`
- `apps/desktop/src/routes/studio.$sessionId.tsx`
- NEW `apps/desktop/src/test/design-mutations.test.ts`; extend `dialog-code-viewer` coverage if a test file exists, else create `apps/desktop/src/components/blocks/dialogs/dialog-code-viewer.test.tsx`

**Out of scope**: prompt-context for manual edits; CodeMirror or any editor dependency; changing `generated-screen-policy.ts`; the flows feature; `plans/README.md`.

## Git workflow

- Branch: `advisor/011-editable-screens` (already checked out in your worktree)
- One conventional commit per step group, e.g. `feat(desktop): design write/rename/duplicate bridge`, `feat(desktop): editable code viewer`.
- Do NOT push or open a PR.

---

## Step 1: Bridge types + interface

In `packages/desktop-bridge/src/types.ts`, below `ImportDesignsResult`, add:

```ts
export type DesignMutationResult =
  | { ok: true; filename: string }
  | { ok: false; reason: string; violations?: Violation[] }
```

(`Violation` is already defined in this file.)

In `packages/desktop-bridge/src/index.ts`:

- add `DesignMutationResult` to the type-import list from `./types.js` and to the `export type {}` block (both lists are alphabetized — keep them so),
- extend the `designs` namespace (after `import(...)`):

```ts
    write(args: { sessionCwd: string; filename: string; html: string }): Promise<DesignMutationResult>
    rename(args: { sessionCwd: string; from: string; to: string }): Promise<DesignMutationResult>
    duplicate(args: { sessionCwd: string; filename: string }): Promise<DesignMutationResult>
```

**Verify**: `bun run --cwd packages/desktop-bridge typecheck` → exit 0 (if that package has no typecheck script, `bun run typecheck` at root after Step 3).

## Step 2: Main-process implementation in `electron/ipc/designs.ts`

This file already contains (from plan 008): `sanitizeDesignBasename(filename)` (throws on absolute/`..`/non-html, normalizes `.htm`→`.html`), `isInsideDirectory(parent, child)`, `fileExists(path)`, `writeDesignHtml({ sessionCwd, filename, html, reservedFilenames? })` (collision-suffixing writer used by import), `validateHtml(html): Violation[]`, `loadDesignsForSession(sessionCwd)`. Reuse them; do not duplicate their logic.

Add a small internal resolver (the loader logic in `loadDesignsFromDir` shows the directory set — use `getGeneratedScreenDirectories` from `@dilag/desktop-bridge`, already imported):

```ts
// Resolve an existing screen by sanitized basename: canonical .designs first,
// then legacy fallback directories, matching how the loader de-duplicates.
async function resolveExistingDesignPath(
  sessionCwd: string,
  filename: string,
): Promise<{ filePath: string; legacy: boolean } | null> {
  const canonical = getCanonicalGeneratedScreenPath(sessionCwd, filename)
  if (await fileExists(canonical)) return { filePath: canonical, legacy: false }
  for (const directory of getGeneratedScreenDirectories(sessionCwd)) {
    if (directory.kind === "canonical") continue
    const candidate = path.join(directory.path, filename)
    if (await fileExists(candidate)) return { filePath: candidate, legacy: true }
  }
  return null
}
```

NOTE: check the actual shape returned by `getGeneratedScreenDirectories` before using it (`grep -n "getGeneratedScreenDirectories\|GeneratedScreenDirectory" packages/desktop-bridge/src/generated-screen-policy.ts`) — adjust the `kind`/`path` property names to whatever the type actually uses. Legacy screens may live in nested subdirectories; if the loader recurses, match a legacy file by comparing basenames from `loadDesignsForSession` output instead of probing one path — in that case implement the fallback branch as: load all designs, find the one whose `filename` matches, use its `file_path`.

Then add the three exported functions:

```ts
export async function writeDesign(args: {
  sessionCwd: string
  filename: string
  html: string
}): Promise<DesignMutationResult> {
  let basename: string
  try {
    basename = sanitizeDesignBasename(args.filename)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Invalid file name" }
  }

  const violations = validateHtml(args.html)
  if (violations.length > 0) {
    return { ok: false, reason: "Validation failed", violations }
  }

  const designDir = path.resolve(getCanonicalGeneratedScreenDirectory(args.sessionCwd))
  const targetPath = path.resolve(getCanonicalGeneratedScreenPath(args.sessionCwd, basename))
  if (!isInsideDirectory(designDir, targetPath)) {
    return { ok: false, reason: "Resolved path escapes the designs directory" }
  }

  await fsp.mkdir(designDir, { recursive: true })
  await fsp.writeFile(targetPath, args.html, "utf8") // overwrite in place — this is Save
  return { ok: true, filename: basename }
}
```

`renameDesign({ sessionCwd, from, to })`:

1. `sanitizeDesignBasename` both `from` and `to` (failure → `{ ok: false, reason }`).
2. `resolveExistingDesignPath(sessionCwd, from)` → null → `{ ok: false, reason: "Screen not found" }`.
3. Target = canonical path for `to`; same containment check as `writeDesign`. If target already exists (`fileExists`) → `{ ok: false, reason: "A screen with that name already exists" }`.
4. `mkdir` canonical dir; if source is canonical: `fsp.rename(source, target)`. If source is legacy: `fsp.copyFile(source, target)` then `fsp.unlink(source)` (one-way migration per the design doc).
5. Return `{ ok: true, filename: to-basename }`.

`duplicateDesign({ sessionCwd, filename })`:

1. Sanitize `filename`; resolve source (canonical-then-legacy); not found → `{ ok: false, reason: "Screen not found" }`.
2. Generate target name from the stem: `"<stem> copy.html"`, then `"<stem> copy 2.html"`, `"<stem> copy 3.html"`, ... first one that does not exist in the canonical dir.
3. Containment check, `mkdir`, `fsp.copyFile(source, target)`. Legacy source stays in place (duplicate ≠ migrate).
4. Return `{ ok: true, filename: targetBasename }`.

Import `DesignMutationResult` from `@dilag/desktop-bridge` in this file.

**Verify**: `bun run --cwd apps/desktop typecheck` → exit 0.

## Step 3: IPC wiring (channel, handler, preload, test mock)

Mirror the existing `designs.import` lines exactly, in all four places:

- `electron/shared/channels.ts` → inside `designs`: `write: "designs:write"`, `rename: "designs:rename"`, `duplicate: "designs:duplicate"`.
- `electron/ipc/host.ts` → three `ipcMain.handle(CHANNELS.designs.write, (_event, args: {...}) => writeDesign(args))` handlers next to the `designs.import` handler; add `writeDesign, renameDesign, duplicateDesign` to the `./designs.js` import.
- `electron/preload.ts` → three forwarders next to `import:`.
- `apps/desktop/src/test/setup.ts` → add `write: vi.fn()`, `rename: vi.fn()`, `duplicate: vi.fn()` to the `designs` mock.

**Verify**: `bun run typecheck` → exit 0.

## Step 4: Main-process tests

New `apps/desktop/src/test/design-mutations.test.ts`, modeled EXACTLY on `apps/desktop/src/test/import-designs.test.ts` (same temp-dir setup/teardown idiom — read it first). Cases:

1. `writeDesign` overwrites an existing canonical file in place (write once, write again with new html, assert single file, new contents).
2. `writeDesign` with a violation-triggering html (see how `import-designs.test.ts` constructs violation HTML, or grep `validateHtml` rules in `designs.ts` — e.g. include `@keyframes`) → `{ ok: false, violations }` non-empty AND file NOT written.
3. `writeDesign` with `../evil.html` → `{ ok: false }`, nothing written outside `.designs`.
4. `renameDesign` canonical → canonical: old gone, new exists, contents preserved; second rename of the same name → `{ ok: false, reason: "Screen not found" }`.
5. `renameDesign` onto an existing target → `{ ok: false }`, both files untouched.
6. `renameDesign` from a legacy `screens/` file → file appears under `.designs/`, legacy source deleted.
7. `duplicateDesign` → `foo copy.html`; duplicating again → `foo copy 2.html`; contents match source; legacy source (if used) still present.

**Verify**: `bun run --cwd apps/desktop test --run src/test/design-mutations.test.ts` → all pass.

## Step 5: Editable code viewer dialog

Rewrite `apps/desktop/src/components/blocks/dialogs/dialog-code-viewer.tsx`. Current shape: `CodeViewerDialog({ code, title, children })`, uncontrolled `Dialog`, `@pierre/diffs` `File` view, Copy/Download/Close buttons. Keep all of that as the VIEW mode. Add:

New props (all optional — when absent, dialog behaves exactly as today, view-only):

```ts
interface CodeViewerDialogProps {
  code: string
  title: string
  children: ReactNode
  sessionCwd?: string
  filename?: string
  readOnly?: boolean // true while the session is busy
  onSaved?: () => void
}
```

Behavior (editable iff `sessionCwd && filename && !readOnly`):

- Make the `Dialog` controlled (`open` + `onOpenChange` state) so dirty-close can be intercepted.
- Add an "Edit" button (pencil icon, `IconPencil as Pencil` from `@tabler/icons-react`) in the header button row, view mode only.
- Edit mode replaces the `File` view with `Textarea` from `@dilag/ui/textarea` (exemplar import: `apps/desktop/src/components/ai-elements/permission-prompt.tsx`), value = draft state initialized from `code`, `className` with `font-mono text-xs min-h-[50vh]` and full-height flex so it fills the dialog body.
- Header in edit mode: "Save" button (primary, disabled while `!isDirty || isSaving`) and "Cancel" (returns to view mode; if dirty, `window.confirm("Discard unsaved changes?")` first).
- Save: `const result = await bridge.designs.write({ sessionCwd, filename, html: draft })`.
  - `result.ok` → exit edit mode, show the saved draft as the new view content (keep a local `savedCode` state initialized from the `code` prop so the dialog reflects the save immediately), call `onSaved?.()`.
  - `!result.ok && result.violations` → stay in edit mode, render the violations inline under the header: a compact list of `violation.rule` + `violation.snippet` in `text-xs text-destructive`.
  - `!result.ok` otherwise → `toast.error(result.reason)` (import `toast` from `sonner`).
- Dialog `onOpenChange(false)` while dirty in edit mode → `window.confirm` before closing; closing resets draft/edit state.
- Copy/Download in edit mode use the draft, not the stale `code` (design-doc requirement).

**Verify**: `bun run --cwd apps/desktop typecheck` → exit 0.

## Step 6: Rename/Duplicate menu items + name dialog

New `apps/desktop/src/components/blocks/dialogs/dialog-screen-name.tsx` — one small controlled dialog reused by Rename:

```ts
interface ScreenNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string // "Rename screen"
  confirmLabel: string // "Rename"
  initialValue: string // current filename without extension
  onSubmit: (value: string) => void // receives the raw input; caller appends ".html" if missing
}
```

Use `Dialog`/`DialogContent`/`DialogTitle` + `Input` from `@dilag/ui/input` + `Button`, a small helper text showing the resulting filename (`<value>.html`), submit on Enter and on the confirm button, disabled when the trimmed value is empty. Match the visual idiom of an existing small dialog (see `apps/desktop/src/components/blocks/dialogs/` for exemplars — pick the simplest one and copy its layout classes).

In `apps/desktop/src/components/canvas/screen-node.tsx`:

- `ScreenNodeData` gains `readOnly?: boolean`, `onRename?: (to: string) => void`, `onDuplicate?: () => void` (alongside the existing `onDelete?`).
- Pass `sessionCwd`, `filename: design.filename`, `readOnly` and an `onSaved` (call `data`-provided refresh — see Step 7) into the existing `CodeViewerDialog` usage at the "View Code" item; rename that menu item label to "Edit HTML" only when editing is available (`sessionCwd && onRename !== undefined && !readOnly`), otherwise keep "View Code".
- Add two `ContextMenuItem`s right after it: "Rename" (opens the `ScreenNameDialog` with the current stem; on submit call `onRename(value.endsWith(".html") ? value : value + ".html")`) and "Duplicate" (calls `onDuplicate()` directly). Both items rendered only when their callback exists; both `disabled={readOnly}` with `title="Unavailable while Pi is writing"` when readOnly.
- The dialog open-state for rename lives in the node component (`useState`).
- Mind the existing pattern at `screen-node.tsx:414-419`: menu items that open dialogs use `onSelect={(e) => e.preventDefault()}`.

In `apps/desktop/src/components/canvas/design-canvas.tsx`:

- `DesignCanvasProps` gains `readOnlyDesigns?: boolean`, `onRenameScreen?: (from: string, to: string) => void`, `onDuplicateScreen?: (filename: string) => void`, `onDesignsMutated?: () => void`.
- Thread them into `ScreenNodeData` exactly like the existing `onDeleteScreen` → `onDelete` wiring (`design-canvas.tsx:56`, `:71`, `:106`): `onRename: onRenameScreen ? (to) => onRenameScreen(screenPosition.id, to) : undefined`, etc.

**Verify**: `bun run --cwd apps/desktop typecheck` → exit 0.

## Step 7: Studio route wiring

In `apps/desktop/src/routes/studio.$sessionId.tsx` (the component that already owns `handleRequestDelete` and passes `onDeleteScreen` at `:516` and `:673`):

- Compute busy state:

```ts
const sessionStatus = useSessionStore((s) => s.sessionStatus[sessionId])
const promptQueue = useSessionStore((s) => s.promptQueues[sessionId])
const isSessionBusy =
  sessionStatus === "running" ||
  sessionStatus === "busy" ||
  (promptQueue !== undefined &&
    (promptQueue.steering.length > 0 || promptQueue.followUp.length > 0))
```

(Check the actual `PromptQueueState` field names in `session-store.tsx` — the store sets `{ steering: [], followUp: [] }`; adjust if different.)

- `handleRenameScreen(from, to)`: call `bridge.designs.rename({ sessionCwd, from, to })`.
  - `!result.ok` → `toast.error(result.reason)`; done.
  - `result.ok` → remap positions and selection by filename (mirror the delete flow at `:205-214`):

```ts
setScreenPositions(
  sessionId,
  screenPositions.map((p) => (p.id === from ? { ...p, id: result.filename } : p)),
)
setSelectedScreenIds((previous) => {
  if (!previous.has(from)) return previous
  const next = new Set(previous)
  next.delete(from)
  next.add(result.filename)
  return next
})
```

    then `queryClient.invalidateQueries({ queryKey: designKeys.session(sessionCwd) })`, `useSessionStore.getState().bumpDesignRefresh()`, `toast.success("Renamed to " + result.filename)`.

- `handleDuplicateScreen(filename)`: call `bridge.designs.duplicate({ sessionCwd, filename })`; `ok` → invalidate + bump + `toast.success("Duplicated as " + result.filename)` (no position work — the reconciler auto-places new screens); `!ok` → `toast.error(result.reason)`.
- `handleDesignsMutated()` (used by the editor's `onSaved`): invalidate + bump only.
- Pass `readOnlyDesigns={isSessionBusy}`, `onRenameScreen={handleRenameScreen}`, `onDuplicateScreen={handleDuplicateScreen}`, `onDesignsMutated={handleDesignsMutated}` at BOTH `DesignCanvas` usage sites (`:516` area and the wrapper component at `:647-673` — thread through its props like `onDeleteScreen` is threaded).
- `designKeys` imports from `@/hooks/use-designs`; `queryClient` via `useQueryClient()` — both already used in this file for the delete flow.

**Verify**: `bun run typecheck` → exit 0; `bun run --cwd apps/desktop test --run` → all pass.

## Step 8: Dialog tests

New/extended `apps/desktop/src/components/blocks/dialogs/dialog-code-viewer.test.tsx` (component-test idiom exemplar: `apps/desktop/src/components/blocks/chat/chat-view.test.tsx` — mocked bridge via `vi.mock("@/lib/bridge", ...)`; note `src/test/setup.ts` already mocks `window.desktopBridge`):

1. View-only (no `sessionCwd`/`filename`): no Edit button rendered.
2. Editable: Edit → type → Save calls `bridge.designs.write` with the draft and exits edit mode on `{ ok: true, filename }`.
3. Save returning `{ ok: false, reason: "Validation failed", violations: [{ rule: "keyframes", snippet: "@keyframes" }] }` → violation text visible, dialog still in edit mode, `onSaved` NOT called.
4. `readOnly` → no Edit button.

**Verify**: `bun run --cwd apps/desktop test --run` → all pass.

## Step 9: Final gates

`bun run fmt` then, in order: `bun run fmt:check`, `bun run lint`, `bun run typecheck`, `bun run --cwd apps/desktop test --run`, `bun run build:desktop` — all exit 0.

## Done criteria

- [ ] All Step verifications pass; final gates all green
- [ ] `grep -n "write(args\|rename(args\|duplicate(args" packages/desktop-bridge/src/index.ts` → 3 matches (the new designs methods)
- [ ] New main-process tests cover: overwrite, validation-block (file untouched), traversal, canonical rename, rename-collision, legacy migration, duplicate naming
- [ ] `git status` clean after commits; no files outside the in-scope list modified
- [ ] Every mutation success path invalidates `designKeys.session(sessionCwd)` AND calls `bumpDesignRefresh()` (there is no OS file watcher — see design doc §4)

## STOP conditions

- `getGeneratedScreenDirectories` has no usable legacy-directory enumeration AND `loadDesignsForSession` output can't resolve a legacy file path — report what the policy module actually exposes.
- The `CodeViewerDialog` call sites (other than screen-node.tsx) exist and would break under the new props — `grep -rn "CodeViewerDialog" apps/desktop/src` first; if more than the screen-node usage appears, keep the new props strictly optional and verify each call site still typechecks; report if any needs semantic changes.
- `studio.$sessionId.tsx` delete-flow exemplars (`screenPositions`, `setSelectedScreenIds`, `designKeys`) are not present as described — the file has drifted; report.

## Maintenance notes

- Plan 008's `importDesigns` currently calls `validateHtml` and discards the result; once this plan lands, a tiny follow-up could funnel `writeDesignHtml` and `writeDesign` through one shared validated-write choke point.
- The deferred manual-edit prompt-context feature should reuse the mutation success paths added in Step 7.
