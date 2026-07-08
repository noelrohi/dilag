# Plan 009 (spike): Flows — screen-to-screen connections on the canvas

> **Executor instructions**: This is a DESIGN SPIKE, not a build plan. The
> deliverable is a written design doc plus at most a throwaway prototype
> branch. Do not merge product code from this plan. If anything in the "STOP
> conditions" section occurs, stop and report. When done, update the status
> row in `plans/README.md` and commit the design doc.
>
> **Drift check (run first)**: `git diff --stat 963c011..HEAD -- apps/desktop/src/components/canvas apps/desktop/src/lib/screen-layout.ts apps/web/src/components/hero-section.tsx`

## Status

- **Priority**: P3 (strongest long-term direction signal; genuinely large)
- **Effort**: L for the feature; the spike itself is M
- **Risk**: MED — new persisted state + a real interaction surface on the canvas
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `963c011`, 2026-07-07

## Why this matters

Two pieces of evidence say Dilag wants flows:

1. The screen nodes already ship invisible React Flow connection handles, annotated for exactly this (`apps/desktop/src/components/canvas/screen-node.tsx:386-388`):

```tsx
          {/* Invisible handles for potential future connections */}
          <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />
          <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
```

2. The marketing homepage sells it (`apps/web/src/components/hero-section.tsx:47`): "polished screens, **flows**, and components" — stated-but-undelivered.

Meanwhile the canvas is pure React Flow (`@xyflow/react`) but uses **zero** edge features: `design-canvas.tsx` imports `useNodesState`/`applyNodeChanges` and no `edges`/`addEdge`/`onConnect` (verified). Screen-to-screen flows (tap this button → go to that screen) are the standard next capability for a screen-design tool and would differentiate the product; the node layer is one interface away.

## Current state (verified at 963c011)

- `apps/desktop/src/components/canvas/design-canvas.tsx` — React Flow canvas. Props: `designs`, `platform`, `positions: ScreenPosition[]`, `onPositionsChange(positions)`, selection callbacks (`:35-49`). Node types: `{ screen: ScreenNode }`. No edge state anywhere.
- Position persistence pattern to copy for edges: positions flow in/out through `ScreenPosition[]` + `onPositionsChange`; reconciliation helpers live in `apps/desktop/src/lib/screen-layout.ts` (`getAutoScreenPositions`, `reconcileScreenPositions`). Find where `positions` is persisted by the parent (grep `onPositionsChange` / `ScreenPosition` in `src/routes` and `src/components/blocks/preview`) — the spike must document that exact storage location (Zustand? SQLite via bridge? per-session JSON?).
- `screen-node.tsx` — node component; handles exist but are invisible/zero-size, so users cannot start a connection today.
- Screens are identified by filename (`DesignFile.filename` / `file_path` — `packages/desktop-bridge/src/types.ts:60-68`); screens can be deleted and renamed-by-the-agent between turns, so edge endpoints must survive (or gracefully drop on) file churn.
- The chat agent knows nothing of canvas layout: layout/position state is renderer-side only. If flows should inform generation ("generate the checkout flow"), the flow graph must be readable by the prompt path (`use-chat-interface` / prompt assembly in `src/lib/prompt-delivery.ts`).

## Commands you will need

| Purpose   | Command                                 | Expected |
| --------- | --------------------------------------- | -------- |
| Typecheck | `bun run --cwd apps/desktop typecheck`  | exit 0   |
| Tests     | `bun run --cwd apps/desktop test --run` | pass     |

## Scope

**Spike deliverable**: `plans/009-flows-DESIGN.md` + optional throwaway branch.

**Out of scope**: shipping edges; any change to marketing copy; interactive in-iframe hotspot mapping (click regions inside the HTML) — note it as the far-future version, don't design it now.

## Questions the design doc must answer

1. **Edge data model**: shape (`{ id, sourceFilename, targetFilename, label? }`), keyed by filename or a stabler id? What happens to an edge when its screen is deleted (cascade) or regenerated (keep)? Where is it persisted — answer must reuse the positions-persistence mechanism (document it precisely with `file:line` after investigating).
2. **Interaction**: how does a user create an edge? (Make the existing handles visible on hover/selection vs an explicit "connect" mode toggle in `CanvasControls`.) How are edges deleted? Does `SelectionMode` interact?
3. **Rendering**: React Flow edge type + styling that fits the canvas look (screenshots not needed; name the edge type and marker).
4. **Agent integration (the differentiator)**: should the flow graph be injected into prompts (e.g. a compact adjacency list in the first-prompt skill context or per-prompt), and should the agent be able to _create_ edges (a tool that writes to the flow store)? Recommend a v1 boundary: v1 = user-drawn edges rendered + persisted; v1.5 = graph included in prompt context; v2 = agent-writable. Justify against `src/lib/prompt-delivery.ts`'s current prompt assembly.
5. **Platform semantics**: mobile flows (screen→screen) map cleanly; web flows (page→page) too — any difference worth modeling now? (Likely no; say so explicitly if confirmed.)

## Steps

1. Investigate: positions persistence end-to-end (canvas → parent → storage), `screen-node.tsx` handle rendering, React Flow edge API surface available in the installed `@xyflow/react` version (check `package.json` + node_modules d.ts), prompt assembly in `prompt-delivery.ts`. **Verify**: doc cites `file:line` for each.
2. (Timeboxed, optional) Throwaway branch: make handles visible on node hover, wire `onConnect` into local state, render default edges. Purpose: confirm the handle geometry works with the iframe-bearing nodes (iframes eat mouse events — this is the spike's key technical risk; test that starting a drag from a handle over/near the iframe works). **Verify**: one paragraph of observed behavior in the doc, including the iframe-event answer.
3. Write `plans/009-flows-DESIGN.md`: recommendations per question, v1 scope cut, build-plan outline (bridge/storage first, interaction second, agent context third), open risks. **Verify**: a build plan could be written from the doc alone.

## Done criteria

- [ ] `plans/009-flows-DESIGN.md` committed; all five questions answered with citations
- [ ] The iframe-event risk has an empirical answer (prototype) or an explicit "needs prototype" flag with the exact experiment described
- [ ] v1/v1.5/v2 boundary stated
- [ ] `plans/README.md` status row updated

## STOP conditions

- The installed `@xyflow/react` version lacks stable edge APIs used by the design (check before writing the doc).
- Position persistence turns out to be ephemeral (lost on restart) — then edges need a storage decision bigger than this spike; report and recommend sequencing.

## Maintenance notes

- Marketing already promises flows; once v1 ships, revisit `hero-section.tsx` wording if scope differs.
- Plans 007/008 both touch screen files' lifecycle; edge-endpoint stability rules from this doc should be checked against rename/duplicate/import behaviors.
