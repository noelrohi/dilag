# Plan 007 Design Spike: Editable Screens

Date: 2026-07-08
Branch: `advisor/007-editable-screens-spike`
Deliverable: design only

## Summary

Recommendation: add a design-shaped bridge API for write, rename, and duplicate, keep all writes canonical under `{sessionCwd}/.designs/`, block manual edits while the Pi session is actively streaming, and refresh the canvas by explicitly invalidating design data after bridge writes instead of relying on the current `file.watcher.updated` path.

This keeps manual edits simple and predictable without changing `generated-screen-policy.ts` semantics. It also avoids expanding the renderer's generic `fs.writeFile` escape hatch into product data ownership.

## Current State at HEAD

- The renderer bridge exposes `designs.loadForSession`, `copyBetweenSessions`, `delete`, and `validateHtml`, but no design write, rename, or duplicate API (`packages/desktop-bridge/src/index.ts:118`).
- The `project` namespace remains read-only with `listFiles` and `readFile` (`packages/desktop-bridge/src/index.ts:125`).
- A generic `fs.writeFile(path, data)` bridge exists (`packages/desktop-bridge/src/index.ts:155`) and is wired directly to `fsp.writeFile(filePath, data)` with no design validation or path policy (`apps/desktop/electron/ipc/host.ts:269`).
- `validateHtml` returns `Violation[]` synchronously in main process code, and `loadDesignsForSession` attaches those violations to each `DesignFile` (`apps/desktop/electron/ipc/designs.ts:24`, `apps/desktop/electron/ipc/designs.ts:89`, `apps/desktop/electron/ipc/designs.ts:94`).
- `DesignFile` carries `filename`, absolute `file_path`, `title`, `screen_type`, `html`, `modified_at`, and `violations` (`packages/desktop-bridge/src/types.ts:60`).
- Generated-screen policy declares `.designs` canonical and `screens` legacy fallback (`packages/desktop-bridge/src/generated-screen-policy.ts:1`), and its prompt rules already say old `screens/` files should be rewritten under `.designs/` (`packages/desktop-bridge/src/generated-screen-policy.ts:88`, `packages/desktop-bridge/src/generated-screen-policy.ts:90`).
- The code viewer is static: it renders `@pierre/diffs/react` `File` and only supports copy/download/close (`apps/desktop/src/components/blocks/dialogs/dialog-code-viewer.tsx:1`, `apps/desktop/src/components/blocks/dialogs/dialog-code-viewer.tsx:70`).
- The screen context menu has Add to chat, Copy, Copy path, View Code, Download HTML, Export as PNG, and Delete only (`apps/desktop/src/components/canvas/screen-node.tsx:392`, `apps/desktop/src/components/canvas/screen-node.tsx:414`, `apps/desktop/src/components/canvas/screen-node.tsx:421`, `apps/desktop/src/components/canvas/screen-node.tsx:432`).
- Canvas nodes are keyed by `design.filename`, and deletion currently removes positions by filename (`apps/desktop/src/components/canvas/design-canvas.tsx:75`, `apps/desktop/src/routes/studio.$sessionId.tsx:205`).

## 1. Ownership Model

Recommendation: use last-writer-wins for files, block manual write/rename/duplicate while the session is streaming, and inject manual-edit context into the next prompt.

Reasoning:

- Timeline navigation itself does not rewrite `.designs/`. Dilag's wrapper delegates to `runtime.session.navigateTree(...)` and then emits only `session.updated` (`apps/desktop/electron/ipc/pi.ts:507`, `apps/desktop/electron/ipc/pi.ts:517`, `apps/desktop/electron/ipc/pi.ts:523`). The Pi SDK implementation moves the session leaf, rebuilds `agent.state.messages`, and emits `session_tree`; it does not replay tool calls or restore file snapshots (`node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:2124`, `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:2239`, `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:2263`).
- The session tree is append-only metadata. `SessionManager.branch()` only moves the leaf pointer (`node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js:869`, `node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js:875`), and docs describe tree navigation as reloading messages from the session, not restoring project files (`docs/architecture.md:107`, `docs/platform.md:108`).
- Clobbering can still happen on the next agent turn, because Pi write/edit tools target the same `.designs/<name>.html` paths. Dilag already synthesizes mutation events from successful Pi `write` and `edit` tool completions (`apps/desktop/electron/ipc/pi.ts:985`, `apps/desktop/electron/ipc/pi.ts:996`, `apps/desktop/electron/ipc/pi.ts:1378`).

Behavior:

- If the session is streaming or has queued steering/follow-up work, disable Edit, Rename, and Duplicate actions with a tooltip such as "Manual edits are unavailable while Pi is writing."
- When a manual edit succeeds, record a lightweight renderer-side "manual edit summary" for the current session. On the next prompt, append hidden context such as:

```text
Manual screen edits since the last Pi turn:
- Updated .designs/home.html from the Dilag editor.
- Renamed .designs/settings.html to .designs/account-settings.html.
```

- Do not attempt file-level locking with Pi. The active-session block covers the risky concurrent case, and last-writer-wins keeps ownership understandable when the user later asks Pi to change the same screen.

Open risk: the current app has session status state (`apps/desktop/src/context/session-store.tsx:147`) and prompt queues (`apps/desktop/src/context/session-store.tsx:150`), but the build plan must choose the exact selector for "busy enough to block." Use status plus non-empty prompt queues.

## 2. Bridge Surface

Recommendation: add a narrow `designs` write API and keep renderer callers away from generic `fs.writeFile` for design files.

The bridge should accept session cwd plus screen-relative filenames, never renderer-provided absolute write targets. Main process should normalize the filename, enforce containment under `getCanonicalGeneratedScreenDirectory(sessionCwd)`, validate HTML, write atomically enough for app usage, and return the loaded `DesignFile` shape.

Proposed types:

```ts
export interface DesignWriteResult {
  design: DesignFile
  violations: Violation[]
}

export interface DesignRenameResult {
  design: DesignFile
  fromPath: string
  toPath: string
}

export interface DesignDuplicateResult {
  design: DesignFile
  sourcePath: string
}

designs: {
  loadForSession(args: { sessionCwd: string }): Promise<DesignFile[]>
  copyBetweenSessions(args: { sourceCwd: string; destCwd: string }): Promise<void>
  delete(args: { filePath: string }): Promise<void>
  validateHtml(args: { html: string }): Promise<Violation[]>
  write(args: { sessionCwd: string; filename: string; html: string }): Promise<DesignWriteResult>
  rename(args: { sessionCwd: string; from: string; to: string }): Promise<DesignRenameResult>
  duplicate(args: { sessionCwd: string; filename: string; targetFilename?: string }): Promise<DesignDuplicateResult>
}
```

Path-containment rule for every method:

- `write`: `filename` is a generated screen path, not an absolute path. Normalize path separators, strip leading `./`, reject empty paths, reject absolute paths, reject `..` segments, require `.html`, then resolve with `getCanonicalGeneratedScreenPath(sessionCwd, filename)`. Verify the resolved path stays within `getCanonicalGeneratedScreenDirectory(sessionCwd)` before writing.
- `rename`: `from` may identify a canonical or legacy-loaded screen by filename/screen path, but `to` follows the same canonical containment rule as `write`. Resolve `from` by first checking canonical `.designs/<from>`, then the legacy fallback match that `loadDesignsForSession` would expose. Move into canonical `.designs/<to>` even when `from` came from `screens/`.
- `duplicate`: `filename` resolves like `rename.from`; generated target resolves like `write.filename`. If `targetFilename` is omitted, generate `<base> copy.html`, `<base> copy 2.html`, etc. under `.designs/`, preserving containment and extension checks.

Validation:

- `write` should call the same `validateHtml` used by the loader (`apps/desktop/electron/ipc/designs.ts:24`). For minimum lovable UX, make validation blocking by default: if violations are non-empty, reject with a typed error containing `violations` and do not write. The editor can still offer "Copy HTML" so users do not lose work.
- `rename` and `duplicate` should not revalidate unless they read and return `DesignFile`; if they return the design, run the same loader helper so existing violations remain visible.

Deprecation:

- Deprecate `bridge.fs.writeFile` for renderer product-data writes. Keep it for exports where users choose arbitrary save paths, such as PNG generation and zip export (`apps/desktop/src/lib/design-export.ts:151`, `apps/desktop/src/lib/design-export.ts:272`). Do not use it for `.designs/` writes.

Implementation detail:

- Move shared "load one design file" logic out of `loadDesignsFromDir` so write/rename/duplicate can return an authoritative `DesignFile` without reloading the full session. The loader already derives title and screen type from HTML attributes and filename (`apps/desktop/electron/ipc/designs.ts:79`, `apps/desktop/electron/ipc/designs.ts:85`).

## 3. Editor UX

Recommendation: make `CodeViewerDialog` editable with a plain textarea first; defer CodeMirror.

Why textarea first:

- The app currently ships no code-editor dependency. `apps/desktop/package.json` includes `@pierre/diffs`, `diff`, React Query, React Router, and UI dependencies, but no CodeMirror, Monaco, or Ace (`apps/desktop/package.json:73`).
- The existing UI already uses a shared textarea component elsewhere (`apps/desktop/src/components/ai-elements/permission-prompt.tsx:6`), so the spike can avoid bundle and theming risk.

Minimum lovable behavior:

- Rename "View Code" to "Edit HTML" when `sessionCwd` and `design.filename` are available.
- Dialog owns draft state: `draftHtml`, `initialHtml`, `isDirty`, `isSaving`, `validationError`, and `lastSavedModifiedAt`.
- The dialog initializes draft state from `design.html` when opened. If the underlying design changes while the dialog is open and the draft is clean, update it. If it changes while dirty, show a non-blocking "Screen changed on disk" warning and let the user choose reload or keep editing.
- Save calls `bridge.designs.write({ sessionCwd, filename: design.filename, html: draftHtml })`. Inline validation errors list the `Violation.rule` and snippet returned by main process.
- Close with dirty changes should confirm discard.
- Keep copy/download buttons. Download uses the draft while dirty, not stale original HTML.

Rename and duplicate:

- Add `Rename` and `Duplicate` context-menu items near `Edit HTML` in `screen-node.tsx`, because all existing screen actions live there (`apps/desktop/src/components/canvas/screen-node.tsx:392`).
- Use small inline-input dialogs, not a full code editor modal. The rename dialog accepts a filename/title-like value and previews the resulting `.html` filename. Duplicate defaults to `<base> copy.html`.
- After successful rename, update persisted screen positions from old filename to new filename because node IDs are filename-based (`apps/desktop/src/components/canvas/design-canvas.tsx:84`, `apps/desktop/src/routes/studio.$sessionId.tsx:206`).

State location:

- Dialog-local state owns unsaved HTML because it is transient and scoped to a single modal.
- Session-level manual edit summaries belong near the studio route or a small session-scoped store so the next prompt can include them.
- Persisted canvas positions remain in the existing session store.

## 4. Watcher Loop and Refresh

Finding: a bridge-initiated manual write will not automatically trigger the current `file.watcher.updated` path unless the new bridge handler explicitly emits an event or the renderer manually invalidates.

Evidence:

- `file.watcher.updated` is listed as part of the normalized runtime event contract (`docs/architecture.md:78`).
- In current main-process code, that event is synthesized from successful Pi `write` and `edit` tool completions (`apps/desktop/electron/ipc/pi.ts:985`, `apps/desktop/electron/ipc/pi.ts:996`, `apps/desktop/electron/ipc/pi.ts:1390`). I found no general chokidar-style watcher registration in `apps/desktop/electron`; the renderer's project file hook subscribes to the normalized event, but does not create an OS watcher itself (`apps/desktop/src/hooks/use-project-files.ts:135`).
- The session store increments `designRefreshTick` on `file.watcher.updated` and `project.updated` (`apps/desktop/src/context/session-store.tsx:922`, `apps/desktop/src/context/session-store.tsx:930`).
- `useSessionDesigns` invalidates the React Query design cache when `recentFileChanges` or `designRefreshTick` changes, and otherwise polls every 10 seconds as fallback (`apps/desktop/src/hooks/use-designs.ts:31`, `apps/desktop/src/hooks/use-designs.ts:46`, `apps/desktop/src/hooks/use-designs.ts:58`).

Recommendation:

- Do not make `designs.write` call back through `file.watcher.updated` unless main process gets a first-class event emitter for non-agent filesystem writes. Instead, after `write`, `rename`, or `duplicate` resolves, the renderer should call `queryClient.invalidateQueries({ queryKey: designKeys.session(sessionCwd) })` and update any local position mapping needed for rename.
- Also add a small `useSessionStore.getState().bumpDesignRefresh()` call in the UI success path if other surfaces besides the design query need to notice. That action already exists (`apps/desktop/src/context/session-store.tsx:196`, `apps/desktop/src/context/session-store.tsx:706`).
- This has no infinite loop: invalidation triggers `loadForSession`, and `loadForSession` only reads files (`apps/desktop/electron/ipc/designs.ts:94`). It does not write or emit events.

If a later build introduces a real project filesystem watcher, re-evaluate this and prefer one event source. For this plan, explicit query invalidation is lower risk and easier to test.

## 5. Legacy Fallback

Recommendation: all manual writes target `.designs/`; renaming or duplicating a legacy `screens/` file migrates that single file into `.designs/`.

Evidence:

- Policy exposes canonical `.designs` plus legacy fallback `screens` (`packages/desktop-bridge/src/generated-screen-policy.ts:1`).
- The loader searches canonical first, then fallback directories, and de-duplicates by screen path (`apps/desktop/electron/ipc/designs.ts:94`, `apps/desktop/electron/ipc/designs.ts:97`, `apps/desktop/electron/ipc/designs.ts:76`, `apps/desktop/electron/ipc/designs.ts:77`).
- The policy text already tells Pi to write updates for legacy screens under `.designs/` (`packages/desktop-bridge/src/generated-screen-policy.ts:90`, `packages/desktop-bridge/src/generated-screen-policy.ts:91`).

Behavior:

- `write({ filename: "home.html" })` always writes `.designs/home.html`.
- Editing a loaded legacy `screens/home.html` should save the edited copy as `.designs/home.html`, leaving the old legacy file in place. Because the loader prefers canonical and de-duplicates by screen path, the canonical edited file wins on reload.
- `rename({ from: "home.html", to: "home-v2.html" })` should move the legacy source into `.designs/home-v2.html`. If `from` resolves to legacy, remove the legacy source after a successful canonical write/rename so the user sees a true rename rather than a duplicate.
- `duplicate` from legacy should copy into `.designs/` and leave the legacy source alone.

## Build Plan Outline

1. Add bridge contract types and channels for `designs.write`, `designs.rename`, and `designs.duplicate`.
2. Implement main-process helpers in `apps/desktop/electron/ipc/designs.ts`: path normalization, containment checks, canonical path resolution, unique duplicate naming, one-file load result, typed validation errors.
3. Add headless tests for canonical write, validation rejection, traversal rejection, legacy rename migration, duplicate naming, and returned `DesignFile` metadata.
4. Wire preload and renderer bridge mocks.
5. Add UI actions in `screen-node.tsx` and pass mutation callbacks from `studio.$sessionId.tsx` through `DesignCanvas`.
6. Convert `CodeViewerDialog` to an editable HTML dialog with textarea, dirty-state confirmation, save, and inline validation errors.
7. On mutation success, invalidate `designKeys.session(sessionCwd)`, update rename-related screen positions, clear selection for deleted/renamed ids, and toast concise results.
8. Add UI tests around dialog dirty state and route-level mutation behavior. Keep visual redesign out of scope.

## Testing Recommendations

- Unit test main-process path policy with absolute paths, `..`, missing `.html`, nested paths, Windows separators, and collision cases.
- Unit test that `validateHtml` violations block `designs.write` and surface rule/snippet details.
- Renderer tests should verify successful save invalidates `designKeys.session(sessionCwd)` and does not call generic `bridge.fs.writeFile`.
- Rename tests should verify positions move from old filename to new filename because canvas node ids are filename-based.

## Prototype

No throwaway prototype was built. Code inspection was enough to answer the watcher and timeline questions: current manual bridge writes would not enter the synthesized Pi tool event path, and timeline navigation does not restore files.

## STOP Conditions and Open Questions

- STOP condition not hit: I found no evidence that `.designs/` files are hashed or tracked by Pi in a way that out-of-band writes corrupt session state. Pi session files track message/tool history; current Dilag changed-file tracking is an in-memory map updated from tool events (`apps/desktop/electron/ipc/pi.ts:1388`).
- STOP condition not hit: `navigateTree` behavior was determinable from Dilag wrapper code plus installed Pi SDK code.
- Open question: should manual validation be strictly blocking forever, or should a later advanced flow allow saving with known violations? This design recommends blocking for the first build because it gives Save a clear success contract.
- Open question: should manual edit summaries be visible in chat history? This design recommends hidden next-turn context first, because visible synthetic messages would change the session timeline model.
