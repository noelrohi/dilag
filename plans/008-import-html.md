# Plan 008: Import HTML — bring existing mockups onto the canvas

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 963c011..HEAD -- packages/desktop-bridge/src/index.ts apps/desktop/electron/ipc/designs.ts apps/desktop/electron/ipc/host.ts apps/desktop/electron/preload.ts apps/desktop/electron/shared/channels.ts apps/desktop/src/components/canvas`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (additive feature; reuses existing validation + loader)
- **Depends on**: plans/007-editable-screens-spike.md **only if** it lands first (share its validated-write path); otherwise standalone. Coordinate with plan 005 (both touch the bridge interface file).
- **Category**: direction
- **Planned at**: commit `963c011`, 2026-07-07

## Why this matters

Dilag exports designs thirteen ways (`apps/desktop/src/lib/design-export.ts`: `downloadHtml`, `downloadAllDesigns`, `downloadAsZip`, `copyMultipleAsHtml`, `exportAsPng`, `exportDesigns`, `exportHtmlDesigns`, `exportImages`, `exportImagesAndHtml`, ...) but has **zero** import paths — verified: no file picker, drag-drop, or import function anywhere in `apps/desktop/src`. A user with an existing HTML mockup (from another tool, an older project, or a teammate) cannot bring it onto the canvas to iterate with Pi. The infrastructure to display arbitrary valid HTML already exists: the canvas is runtime-independent ("if files exist in those display locations and validate, the canvas can render them" — `docs/platform.md:104`).

## Current state (verified at 963c011)

- Bridge `designs` namespace (`packages/desktop-bridge/src/index.ts:117-123`): `loadForSession`, `copyBetweenSessions`, `delete`, `validateHtml` — no import/write.
- Main-process design ops (`apps/desktop/electron/ipc/designs.ts`): `validateHtml(html): Violation[]` (`:24`), `loadDesignsForSession(sessionCwd)` (`:94`), `copyHtmlFiles(sourceDir, destDir)` (`:103`) — the copy machinery for placing HTML files into a session dir exists.
- Canonical target dir helpers: `packages/desktop-bridge/src/generated-screen-policy.ts` — `GENERATED_SCREEN_CANONICAL_DIR = ".designs"`, `getCanonicalGeneratedScreenPath(projectCwd, screenPath)` (`:24`).
- Native file dialog already bridged: `dialog.openDirectory()` exists (`index.ts:160-163` area — `dialog: { save(...), openDirectory() }`); an `openFile` variant does not — you will add one.
- IPC wiring pattern (one line each in four files): channel constant in `apps/desktop/electron/shared/channels.ts`, handler in `electron/ipc/host.ts` (see `CHANNELS.designs.validateHtml` handler at `:225-228` as the exemplar), forwarder in `electron/preload.ts` (exemplar `:87` area), method on the `DesktopBridge` interface. Also add the mock in `apps/desktop/src/test/setup.ts` (exemplar `:66`).
- Canvas: `apps/desktop/src/components/canvas/design-canvas.tsx` renders `DesignFile[]` via React Flow; refresh is driven by the design loader + file-watcher events. `CanvasControls` (`canvas-controls.tsx`) is the natural mount point for an Import button.

Conventions: conventional commits; toasts via `sonner` (`design-export.ts:1`); all renderer→native calls go through the bridge (AGENTS.md).

## Commands you will need

| Purpose   | Command                                 | Expected on success |
| --------- | --------------------------------------- | ------------------- |
| Typecheck | `bun run typecheck`                     | exit 0              |
| Tests     | `bun run --cwd apps/desktop test --run` | all pass            |
| Build     | `bun run build:desktop`                 | exit 0              |

## Scope

**In scope**:

- `packages/desktop-bridge/src/index.ts` (add `designs.import`, `dialog.openFiles`)
- `apps/desktop/electron/shared/channels.ts`, `electron/ipc/host.ts`, `electron/ipc/designs.ts`, `electron/preload.ts`
- `apps/desktop/src/components/canvas/canvas-controls.tsx` (Import button), `design-canvas.tsx` (drag-drop target)
- `apps/desktop/src/test/setup.ts`, new/extended tests

**Out of scope**:

- Importing non-HTML formats (Figma, images) — HTML files only.
- Editing imported HTML (plan 007's territory).
- Any change to how Pi is told about new files (imported screens surface to the agent the same way legacy `screens/` files do: they're on disk; the next prompt can reference them).

## Git workflow

- Branch: `advisor/008-import-html`
- Conventional commits, e.g. `feat(desktop): import html files onto the canvas`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Main-process import + file dialog

In `electron/ipc/designs.ts` add:

```ts
export async function importDesigns(args: {
  sessionCwd: string
  filePaths: string[]
}): Promise<{ imported: number; rejected: Array<{ path: string; reason: string }> }>
```

Behavior: for each path — must end `.html`/`.htm`; read; run `validateHtml`; sanitize the basename (strip directories — imported file lands at `getCanonicalGeneratedScreenPath(sessionCwd, basename)`, never at a caller-supplied relative path); de-collide names (`foo.html` → `foo-2.html`); write. Cap file size (1 MB/file) with a clear rejection reason. Note: decide whether validation failures reject the file or import-with-violations — the loader already carries `violations` per `DesignFile`, so prefer **import-with-violations** (the canvas already knows how to display such files) and only reject unreadable/oversized/non-HTML files.

In the dialog domain add `openFiles(options)` supporting multi-select with an HTML filter (mirror how `openDirectory` is implemented — find it: `grep -rn "openDirectory" apps/desktop/electron`).

**Verify**: `bun run --cwd apps/desktop typecheck` → exit 0.

### Step 2: Wire the IPC (channel, handler, preload, interface, test mock)

Follow the `validateHtml` exemplar through all four files + `test/setup.ts`. Interface additions:

```ts
designs: { ..., import(args: { sessionCwd: string; filePaths: string[] }): Promise<ImportDesignsResult> }
dialog: { ..., openFiles(options: OpenFilesOptions): Promise<string[] | null> }
```

(define the two small result/option types in `packages/desktop-bridge/src/types.ts`).

**Verify**: `bun run typecheck` → exit 0 (both packages).

### Step 3: Renderer UI

- `canvas-controls.tsx`: add an "Import" control (match existing control styling in that file) → `bridge.dialog.openFiles(...)` → `bridge.designs.import(...)` → `toast.success(\`Imported N screens\`)`/`toast.error`listing rejects → trigger the designs refresh (find how deletion refreshes —`use-designs.ts` exposes a refetch/invalidate; reuse it).
- `design-canvas.tsx`: accept OS file drag-drop — on drop of `.html` files, call the same import with the dropped paths. Electron exposes real paths on dropped files via `webUtils.getPathForFile` (preload) — check the `File` object path availability in this Electron version; if unavailable without extra preload work, read dropped files' text in the renderer and add a `designs.importFromContents({ sessionCwd, files: [{ name, html }] })` variant instead. Choose ONE mechanism, note the choice.

**Verify**: `bun run --cwd apps/desktop test --run` → all pass; `bun run build:desktop` → exit 0.

## Test plan

- Extend the designs-adjacent tests (exemplar: `apps/desktop/src/hooks/use-designs.test.ts` for renderer, or add `apps/desktop/src/test/import-designs.test.ts` exercising `importDesigns` directly with a temp dir — main-process functions in `designs.ts` are plain Node and unit-testable):
  - imports a valid HTML file into `.designs/` with its basename
  - name collision produces `-2` suffix
  - non-HTML and oversized files rejected with reasons
  - path traversal attempt (`../evil.html` as name) lands inside `.designs/` (basename-only)
  - invalid-but-parseable HTML imports with `violations` populated

## Done criteria

- [ ] `bun run typecheck`, `bun run --cwd apps/desktop test --run`, `bun run build:desktop` all exit 0
- [ ] New unit tests above pass; traversal case included
- [ ] `grep -rn "designs.import\|openFiles" packages/desktop-bridge/src/index.ts` → both present
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Dropped-file real paths are unobtainable AND the contents-variant would exceed ~30 extra lines of preload/bridge work — ship button-only import, note drag-drop as follow-up, report.
- `use-designs` has no reusable refresh path (loader refresh turns out to be watcher-only and the watcher doesn't fire for these writes) — report before inventing a new refresh channel.
- Plan 005 landed and moved/renamed the wiring files in ways that don't match the exemplars.

## Maintenance notes

- If plan 007 ships `designs.write`, fold `importDesigns`' validated-write into the same helper.
- Reviewer: check the basename sanitization and size cap — this is the only place user-supplied filesystem content enters the project dir.
- Deferred: importing a whole folder; importing into a _new_ session in one step.
