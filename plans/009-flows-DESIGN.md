# Plan 009: Flows Design Spike

## Recommendation

Ship flows in three stages:

1. **v1: user-drawn, persisted screen-to-screen edges.** Add a renderer-side `screenFlows` store beside `screenPositions`, pass it through `studio.$sessionId.tsx` into `DesignCanvas`, render React Flow edges, and support user creation/deletion from the canvas. Keep endpoints keyed by the same filename IDs that positions and nodes already use.
2. **v1.5: inject a compact graph into prompt context.** Extend prompt assembly to include a small adjacency list from the renderer store when the graph is non-empty.
3. **v2: agent-writable flows.** Add an explicit app/runtime API for the agent to propose or write flow edges after the graph has user-facing persistence, validation, undo/delete semantics, and prompt visibility.

No STOP condition triggered. Position persistence is durable through Zustand `persist` to `localStorage`, and the installed `@xyflow/react` version exposes the stable edge APIs needed for v1.

## Current State at HEAD

The canvas already uses React Flow nodes but no edge state. `DesignCanvas` imports `ReactFlow`, `useNodesState`, `applyNodeChanges`, and node types, but not `edges`, `useEdgesState`, `addEdge`, `applyEdgeChanges`, or `onConnect` (`apps/desktop/src/components/canvas/design-canvas.tsx:1`, `apps/desktop/src/components/canvas/design-canvas.tsx:13`, `apps/desktop/src/components/canvas/design-canvas.tsx:114`, `apps/desktop/src/components/canvas/design-canvas.tsx:214`).

Screen node IDs are filenames. `ScreenPosition.id` is a string (`apps/desktop/src/lib/screen-layout.ts:3`), default positions are created from `designs[index].filename` (`apps/desktop/src/lib/screen-layout.ts:88`), persisted positions are matched back to `design.filename` (`apps/desktop/src/lib/screen-layout.ts:104`), and React Flow node IDs are `screenPosition.id` (`apps/desktop/src/components/canvas/design-canvas.tsx:83`). `DesignFile` currently exposes `filename`, `file_path`, `title`, `screen_type`, `html`, `modified_at`, and `violations`, but no stable screen UUID (`packages/desktop-bridge/src/types.ts:60`).

Generated screens are loaded from `.designs` plus legacy fallback directories. The loader pushes `filename: entry.name` and `file_path: filePath` (`apps/desktop/electron/ipc/designs.ts:82`), and the canonical generated path helper resolves `.designs/<screenPath>` (`packages/desktop-bridge/src/generated-screen-policy.ts:20`, `packages/desktop-bridge/src/generated-screen-policy.ts:24`). This means v1 can match the existing canvas by filename, but it cannot survive an agent rename without additional identity work.

Positions already persist end to end. The route reads `useScreenPositions(sessionId)` and `setScreenPositions` (`apps/desktop/src/routes/studio.$sessionId.tsx:130`), adds missing positions when new designs appear (`apps/desktop/src/routes/studio.$sessionId.tsx:158`), passes positions and `onPositionsChange` to the canvas (`apps/desktop/src/routes/studio.$sessionId.tsx:507`), and deletes positions for removed screens in the delete flow (`apps/desktop/src/routes/studio.$sessionId.tsx:204`). The store keeps `screenPositions` in client state (`apps/desktop/src/context/session-store.tsx:139`), writes them via `setScreenPositions` (`apps/desktop/src/context/session-store.tsx:388`), persists them under `dilag-session-store` using `localStorage` (`apps/desktop/src/context/session-store.tsx:984`), and partializes `screenPositions` into the persisted payload (`apps/desktop/src/context/session-store.tsx:986`).

The existing screen handles are not usable yet. `ScreenNode` renders target and source handles, but both are opacity-zero and zero-size (`apps/desktop/src/components/canvas/screen-node.tsx:386`). The preview surfaces are iframe-heavy: mobile renders an iframe inside the phone frame (`apps/desktop/src/components/canvas/screen-node.tsx:299`) and web renders an iframe in the browser frame (`apps/desktop/src/components/canvas/screen-node.tsx:358`).

React Flow edge support is available. The app depends on `@xyflow/react` `^12.10.0` (`apps/desktop/package.json:82`), the lockfile resolves `@xyflow/react@12.10.0` (`bun.lock:1148`), and the installed d.ts exports `useEdgesState`, `applyEdgeChanges`, `OnConnect`, `MarkerType`, and `addEdge` (`node_modules/@xyflow/react/dist/esm/index.d.ts:20`, `node_modules/@xyflow/react/dist/esm/index.d.ts:33`, `node_modules/@xyflow/react/dist/esm/index.d.ts:37`, `node_modules/@xyflow/react/dist/esm/index.d.ts:40`).

Prompt assembly currently has no canvas-layout or flow input. `sendMessage` calls `deliverDilagPrompt` with session metadata, content, files, first-message status, runtime status, model, and thinking level (`apps/desktop/src/hooks/use-sessions.ts:629`). `buildDilagPromptPayload` derives text from user content, optional file attachments, platform, and first-message state (`apps/desktop/src/lib/prompt-delivery.ts:78`). Follow-up prompts append a small `<dilag_context>` block with platform and referenced-screen summaries only (`apps/desktop/src/lib/prompt-delivery.ts:130`).

## 1. Edge Data Model

Use this v1 shape in a new `apps/desktop/src/lib/screen-flows.ts`:

```ts
export interface ScreenFlowEdge {
  id: string
  sourceFilename: string
  targetFilename: string
  label?: string
}
```

Use filename endpoints in v1 because that is the current canvas identity. Positions, node IDs, selection IDs, and deletion targets all use filenames today (`apps/desktop/src/lib/screen-layout.ts:88`, `apps/desktop/src/components/canvas/design-canvas.tsx:84`, `apps/desktop/src/routes/studio.$sessionId.tsx:204`). Introducing a stable screen ID would be a broader bridge and file-format decision because `DesignFile` does not expose one (`packages/desktop-bridge/src/types.ts:60`).

Recommended `id`: deterministic for one edge per ordered pair, for example `flow:${sourceFilename}->${targetFilename}`. If v1 later needs multiple labeled edges between the same pair, change only `id` generation to append a short generated suffix while keeping the endpoint fields stable.

Lifecycle rules:

- **Regenerated screen, same filename:** keep the edge. The graph represents screen-to-screen intent, and the existing canvas already treats same filename plus changed `modified_at` as the same node with new content (`apps/desktop/src/components/canvas/design-canvas.tsx:122`).
- **Deleted screen:** cascade delete any edge whose source or target filename is missing. Do this both in explicit delete flow, beside the current position filtering (`apps/desktop/src/routes/studio.$sessionId.tsx:204`), and in a reconciliation helper so file watcher updates and agent-side deletes cannot leave orphan edges.
- **Agent rename:** v1 drops the old edge because filename identity changed. That is acceptable if documented in UI behavior. Preserve-across-rename needs a future stable ID, likely either a generated metadata field in the HTML contract or a bridge-level screen record that survives file moves.
- **Session deletion:** add cleanup for `screenFlows[sessionId]`. Existing `clearSessionData` does not delete `screenPositions` (`apps/desktop/src/context/session-store.tsx:570`), even though `deleteSession` calls it (`apps/desktop/src/hooks/use-sessions.ts:481`). Do not copy that leak for flows; either extend deletion with a canvas-state cleanup action or intentionally update `clearSessionData` to remove persisted canvas state when called from destructive session deletion.

Persist flows by reusing the position persistence pattern:

- Add `screenFlows: Record<string, ScreenFlowEdge[]>` to `SessionState`, beside `screenPositions`.
- Add `setScreenFlows(sessionId, flows)`.
- Add `useScreenFlows(sessionId)`.
- Add `screenFlows` to the Zustand `partialize` block, beside `screenPositions` (`apps/desktop/src/context/session-store.tsx:986`).
- Route `screenFlows` through `studio.$sessionId.tsx` the same way `screenPositions` is routed (`apps/desktop/src/routes/studio.$sessionId.tsx:130`, `apps/desktop/src/routes/studio.$sessionId.tsx:507`).

## 2. Interaction

Recommend an explicit **Connect mode** toggle in `CanvasControls`, not always-visible handles. The current controls already house canvas-level commands (`apps/desktop/src/components/canvas/canvas-controls.tsx:46`), and an explicit mode avoids surprise connections while users drag/select large iframe-bearing screen nodes. When Connect mode is on:

- Set `nodesConnectable={true}` on `ReactFlow`; otherwise set it to false.
- Render source and target handles as visible 14-16 px targets with a high z-index.
- Show handles for all nodes in Connect mode; outside Connect mode, show subtle handles only on hover/selection as an affordance if desired, but keep `nodesConnectable={false}`.
- Use `onConnect` to append a validated `ScreenFlowEdge`. Ignore self-connections and duplicate ordered pairs.

Keep the existing `SelectionMode.Partial` behavior for normal selection (`apps/desktop/src/components/canvas/design-canvas.tsx:223`). In Connect mode, consider disabling marquee selection with `selectionOnDrag={false}` so left-drag from a handle has one clear meaning. Keep node dragging on the existing frame/title areas; screen nodes already mark frame/title containers as `drag-handle` (`apps/desktop/src/components/canvas/screen-node.tsx:263`, `apps/desktop/src/components/canvas/screen-node.tsx:273`).

Deletion should be explicit:

- Select an edge and press Delete/Backspace to remove selected edges only.
- Add an edge context-menu item, "Delete connection", for discoverability and accessibility.
- Keep `deleteKeyCode={null}` on React Flow (`apps/desktop/src/components/canvas/design-canvas.tsx:233`) so screen deletion stays in the existing app-owned confirmation flow instead of React Flow deleting nodes directly.

## 3. Rendering

Use a custom edge type named `screenFlow`.

Implementation outline:

- Add `edgeTypes = { screenFlow: ScreenFlowEdgeComponent }`.
- Use `BaseEdge` plus `getSmoothStepPath` or built-in `SmoothStepEdge` as the base. The path should be a clean horizontal-to-horizontal curve from the source right handle to the target left handle.
- Use `markerEnd: { type: MarkerType.ArrowClosed }`.
- Use subdued canvas styling: 2 px stroke, `var(--primary)` at about 65-75% opacity, selected state at full primary, and `interactionWidth` around 20 so edges are easy to select.
- Keep labels optional. If `label` exists, render it with `EdgeLabelRenderer` in a compact pill; do not make labels part of v1 creation UI unless there is a concrete product need.

This fits the existing canvas: the background is muted with a dotted pattern (`apps/desktop/src/components/canvas/design-canvas.tsx:201`), nodes already have selection rings and substantial frames (`apps/desktop/src/components/canvas/screen-node.tsx:275`, `apps/desktop/src/components/canvas/screen-node.tsx:325`), and React Flow marker support is present in the installed package (`node_modules/@xyflow/react/dist/esm/index.d.ts:37`).

## 4. Agent Integration

Do not make flows agent-writable in v1. The current prompt path is a renderer-originated call into `bridge.agent.prompt` (`apps/desktop/src/lib/prompt-delivery.ts:145`), and the payload has no app tool or bridge channel for mutating renderer-local canvas state (`apps/desktop/src/lib/prompt-delivery.ts:26`). Letting the agent write edges would require a new authority boundary: validation, conflict behavior, user visibility, persistence, and likely an IPC/event route into the same store used by the canvas.

For v1.5, inject the graph into prompt context because this is the differentiator. Add an optional `flowEdges?: ScreenFlowEdge[]` argument to `buildDilagPromptPayload` and `deliverDilagPrompt`, read it in `sendMessage` from `useSessionStore.getState().screenFlows[currentSessionId]`, and append a compact block when non-empty:

```xml
<flow_graph>
home.html -> product.html
product.html -> cart.html
cart.html -> checkout.html
</flow_graph>
```

Prefer per-prompt injection over first-prompt skill context. The graph is user-editable canvas state, so it can change after the first prompt; `buildDilagPromptPayload` already runs for every send (`apps/desktop/src/lib/prompt-delivery.ts:155`). Keep it compact and filename-based to match the store.

For v2, add agent-writable flows only after v1.5 proves useful. The likely shape is an app-level command such as `create_flow_edge(sourceFilename, targetFilename, label?)` that validates endpoints against the current design list, writes the same `screenFlows` store, and emits a visible UI event. Do not ask the coding agent to edit `localStorage` or hidden renderer state directly.

## 5. Platform Semantics

Use one graph model for mobile and web. Mobile screens and web pages both map cleanly to directed screen-to-screen/page-to-page edges. The existing code already normalizes the active design platform at the screen level (`apps/desktop/src/components/canvas/design-canvas.tsx:81`) and uses platform only for layout sizing (`apps/desktop/src/lib/screen-layout.ts:36`). No platform-specific fields are needed for v1.

Do not design in-iframe hotspot mapping now. "Tap this exact button inside the HTML" is the far-future version and needs DOM-region metadata, iframe coordinate mapping, and generated HTML annotations. v1 edges should mean "this screen can lead to that screen", not "this precise element navigates there".

## Iframe Event Risk

This environment cannot run the Electron app interactively, so the iframe pointer-event risk is **not empirically answered**. A happy-dom or rendered-DOM unit test would not prove real drag behavior over iframe-bearing nodes.

Needs prototype before implementation:

1. Create a throwaway branch or uncommitted patch that makes the existing handles visible and at least 16 px wide/high, adds local `edges` state, wires `onConnect`, and renders default or `screenFlow` edges.
2. Run the Electron app with two generated web screens and two generated mobile screens.
3. At zoom 0.75 and 1.25, drag from the right source handle of one node to the left target handle of another. Test handles positioned just outside the frame edge and handles overlapping the iframe edge.
4. Confirm whether `onConnect` fires reliably, whether the iframe captures pointer movement or pointerup, and whether handle `z-index` plus `pointer-events` is enough.
5. If iframe capture occurs, move handles outside the iframe/frame bounding box and keep Connect mode handles visually attached with an offset.

Do not ship v1 interaction until that experiment has a real Electron answer.

## Build Plan Outline

1. **Bridge/store and data model first.** Add `screen-flows.ts`, store state/actions/selectors, persistence partialization, reconciliation helper, and focused store/helper tests.
2. **Route and canvas wiring second.** Pass `flows` and `onFlowsChange` through `studio.$sessionId.tsx`, convert persisted `ScreenFlowEdge[]` to React Flow `Edge[]`, and prune orphaned edges when designs change.
3. **Interaction third.** Add Connect mode to `CanvasControls`, visible handles to `ScreenNode`, `onConnect` validation, selected-edge deletion, and context-menu deletion.
4. **Prompt context fourth.** Add v1.5 flow graph injection with prompt-delivery tests after v1 rendering/persistence is stable.
5. **Agent-writable flows last.** Only after there is a validated store and visible user workflow.

## Open Questions

- Should session deletion start deleting persisted `screenPositions` too, or should flow cleanup be handled by a new session-delete-only canvas cleanup action?
- Should v1 expose labels at all, or reserve `label` for prompt context and future agent-created semantic edges?
- Should duplicate filename handling be fixed before flows? The generated-screen policy can represent nested screen paths, but `DesignFile.filename` currently collapses to basename in the loader (`apps/desktop/electron/ipc/designs.ts:82`).
- What should happen when a session is forked? `forkSession` creates a new session ID for the same cwd (`apps/desktop/src/hooks/use-sessions.ts:516`), and `forkSessionDesignsOnly` also creates a new session in the same cwd (`apps/desktop/src/hooks/use-sessions.ts:550`). v1 should probably copy `screenFlows[currentSessionId]` to the new session ID in both flows, matching user expectation that the canvas graph follows a fork.
