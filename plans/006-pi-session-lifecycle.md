# Plan 006: Stop leaking Pi runtime sessions and fix question-to-session routing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 963c011..HEAD -- apps/desktop/electron/ipc/pi.ts apps/desktop/electron/main.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — touches the live agent-runtime host; wrong eviction could kill an in-flight stream
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `963c011`, 2026-07-07

## Why this matters

Two defects in the Electron-main Pi adapter (`apps/desktop/electron/ipc/pi.ts`, 1430 lines):

1. **Session leak**: every session the user views is instantiated as a live Pi `AgentSession`, subscribed, and inserted into a module-level `sessions` Map — and never removed except on explicit delete. The cleanup function `releaseAgentSessionsForDirectory` exists but has **zero call sites** (verified by grep at `963c011`). There is also no `before-quit` hook, so in-flight work isn't stopped on quit. Memory and event fan-out grow monotonically with every session browsed.
2. **Question misrouting**: the interactive `question` tool locates its owning session by reverse-searching all sessions for the tool-call id, then falls back to "the first streaming session", then to an arbitrary first Map entry. With two sessions streaming concurrently, a clarification question can appear in the wrong chat while the asking session blocks forever on an answer surfaced elsewhere.

## Current state

All in `apps/desktop/electron/ipc/pi.ts` unless noted.

Session retention (`:579-600`):

```ts
async function ensureRuntimeSession(
  sessionID: string,
  cwd: string,
  ...
): Promise<RuntimeSession> {
  const existing = sessions.get(sessionID)
  if (existing) { ... return existing }
  const sessionFile = await findSessionFile(cwd, sessionID)
  ...
  const runtime = bindRuntimeSession(session, cwd)
  sessions.set(runtime.id, runtime)
  return runtime
}
```

Subscription binding (`:679-685`):

```ts
runtime.unsubscribe = session.subscribe((event) => handlePiSessionEvent(runtime, event))
```

The never-called release (`:695-702`):

```ts
export function releaseAgentSessionsForDirectory(cwd: string): void {
  const normalizedCwd = path.resolve(cwd)
  for (const [sessionID, runtime] of sessions) {
    if (path.resolve(runtime.cwd) !== normalizedCwd) continue
    runtime.unsubscribe()
    sessions.delete(sessionID)
  }
}
```

`apps/desktop/electron/main.ts` — has `app.whenReady`/`window-all-closed` wiring but **no** `before-quit`/`will-quit` handler and no call to any runtime stop function (verified: `grep -n "before-quit\|will-quit\|stopAgentRuntime" electron/main.ts` → empty).

Question routing (`:881-893`):

```ts
function findSessionIdForToolCall(toolCallId: string): string | undefined {
  for (const runtime of sessions.values()) {
    if (
      runtime.session.messages.some((message) =>
        messageHasToolCall(message as PiMessage, toolCallId),
      )
    ) {
      return runtime.id
    }
    if (runtime.session.isStreaming) return runtime.id
  }
  return sessions.values().next().value?.id
}
```

Called from the question tool's `execute` (`:746`); the tool is created once at runtime start (`:639` `const questionTool = await createQuestionTool()`, definition at `:718`). `waitForQuestionAnswer` (`:854+`) emits `question.asked` and parks a resolver in the module-level `pendingQuestions` Map.

Key structural facts:

- `sessions` and `pendingQuestions` are module-level Maps.
- `RuntimeSession` carries `{ id, cwd, session, unsubscribe, toolMessageIds, toolStates, changedFiles }` (see `bindRuntimeSession` `:660-690`).
- Prompting goes through `promptAgentSession` (find via `grep -n "export async function promptAgentSession" pi.ts`) which calls `ensureRuntimeSession` — the prompt path knows the owning `sessionID`.
- The renderer knows nothing of this Map; eviction must be invisible to it (a later `ensureRuntimeSession` reopens from the session file).

Conventions: this file uses plain module functions + module state; no classes. Tests for main-process code are sparse — the vitest suite covers the renderer. Verification below is grep + typecheck + the existing suite + smoke script (`apps/desktop/scripts/smoke-electron.mjs`, run via `bun run --cwd apps/desktop smoke:electron` — requires a built app; only run if the environment can build Electron).

## Commands you will need

| Purpose   | Command                                     | Expected on success               |
| --------- | ------------------------------------------- | --------------------------------- |
| Typecheck | `bun run --cwd apps/desktop typecheck`      | exit 0                            |
| Tests     | `bun run --cwd apps/desktop test --run`     | all pass                          |
| Build     | `bun run --cwd apps/desktop build`          | exit 0                            |
| Smoke     | `bun run --cwd apps/desktop smoke:electron` | exits 0 (optional, needs display) |

## Scope

**In scope**:

- `apps/desktop/electron/ipc/pi.ts`
- `apps/desktop/electron/main.ts` (quit hook only)

**Out of scope**:

- Splitting `pi.ts` into modules (separate, larger refactor — noted in the index).
- The renderer (`apps/desktop/src/**`) — eviction must not require renderer changes.
- `packages/desktop-bridge` — no contract change.
- Changing question UI behavior in the renderer.

## Git workflow

- Branch: `advisor/006-pi-session-lifecycle`
- Conventional commits, e.g. `fix(desktop): evict idle pi runtime sessions`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Thread the owning session id into the question tool

In `createQuestionTool` (`pi.ts:718+`), inspect the tool `execute` signature the Pi SDK provides (look at how `toolCallId` reaches `:746` today). The Pi SDK's tool execute receives a context object — check what fields it exposes (search the installed SDK: `grep -rn "execute" node_modules/@earendil-works/pi-coding-agent/dist/*.d.ts | head` and look for the tool-execution context type). Two acceptable outcomes, in order of preference:

1. If the execution context carries a session identifier (or the session object), use it directly and delete `findSessionIdForToolCall` plus its heuristic fallbacks.
2. If it does not: create the question tool **per session** instead of once globally — i.e., at the point each `AgentSession` is created (`createPiSession` / `bindRuntimeSession`), close over that session's id so `execute` knows its owner. Then delete `findSessionIdForToolCall`.

If neither is possible with the SDK's API, STOP and report the SDK's actual tool-context shape.

**Verify**: `grep -n "findSessionIdForToolCall" apps/desktop/electron/ipc/pi.ts` → no matches. `bun run --cwd apps/desktop typecheck` → exit 0.

### Step 2: Evict idle runtime sessions

Add an eviction policy to the module state in `pi.ts`:

- Track `lastUsedAt` on `RuntimeSession` (update in `ensureRuntimeSession` on every access and when any event for it arrives).
- Add `maybeEvictIdleSessions()`: evict sessions where `session.isStreaming === false`, no pending question in `pendingQuestions` belongs to them, and not the most recently used N (keep N = 3). Eviction = `runtime.unsubscribe()`, `sessions.delete(id)`, plus any SDK-required dispose (check whether `AgentSession` exposes `dispose`/`close` in the SDK d.ts; call it if present).
- Call `maybeEvictIdleSessions()` from `ensureRuntimeSession` after inserting a new session.
- Keep `releaseAgentSessionsForDirectory` and wire it: find where a project is removed (`grep -n "remove\|deleteProject" apps/desktop/electron/ipc/projects.ts` and the host handler that fronts it in `ipc/host.ts`) and call it with the removed project's path.

Safety property (this is the MED risk): an evicted session must be transparently re-openable — `ensureRuntimeSession` already reopens from `findSessionFile(cwd, sessionID)`; do not evict a session that `isStreaming` or has pending questions.

**Verify**: `bun run --cwd apps/desktop typecheck` → exit 0; `bun run --cwd apps/desktop test --run` → all pass. `grep -n "maybeEvictIdleSessions" apps/desktop/electron/ipc/pi.ts` → defined + called from `ensureRuntimeSession`.

### Step 3: Shut down cleanly on quit

`pi.ts` exports a runtime stop function (find it: `grep -n "export.*stop" apps/desktop/electron/ipc/pi.ts` — `stopAgentRuntime` or similar; it exists per `initializeHost`'s counterpart). In `electron/main.ts`, add:

```ts
app.on("before-quit", () => {
  void stopAgentRuntime()
})
```

matching the import style of the file (it imports from `./ipc/host.js` or `./ipc/pi.js` — follow the existing indirection: if `host.ts` fronts pi functions, add a `shutdownHost()` there and call that). Ensure the stop function unsubscribes and aborts all sessions in the Map (extend it if it only stops the runtime singleton).

**Verify**: `bun run --cwd apps/desktop typecheck && bun run --cwd apps/desktop build` → exit 0. `grep -n "before-quit" apps/desktop/electron/main.ts` → present.

## Test plan

Main-process code has no vitest harness today; add the first one only if cheap:

- If `pi.ts`'s eviction helper can be extracted as a pure function (given a Map snapshot + pendingQuestions, return ids to evict), put it in `pi.ts` as an exported pure function and unit-test it in a new `apps/desktop/src/test/pi-eviction.test.ts` (happy path, streaming-session protected, pending-question protected, MRU-N protected). If extraction fights the module structure, skip and rely on typecheck/build/smoke — say so in the report.
- Manual/smoke check (if the environment allows): `bun run --cwd apps/desktop smoke:electron` exits 0 after build.

## Done criteria

- [ ] `grep -n "findSessionIdForToolCall" apps/desktop/electron/ipc/pi.ts` → empty
- [ ] Eviction exists, is called, and provably never evicts streaming/pending-question sessions (test or cited guard code)
- [ ] `releaseAgentSessionsForDirectory` has ≥1 real call site: `grep -rn "releaseAgentSessionsForDirectory" apps/desktop/electron` → definition + caller(s)
- [ ] `grep -n "before-quit" apps/desktop/electron/main.ts` → present
- [ ] `bun run --cwd apps/desktop typecheck`, `test --run`, `build` all exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The Pi SDK's tool-execution context exposes no path to the owning session AND per-session tool registration isn't supported (Step 1) — report the SDK types you found.
- `AgentSession` has resource semantics beyond `unsubscribe` that you can't determine from the SDK d.ts (e.g. child processes owned per session) — report before writing eviction.
- Any existing renderer test fails after eviction lands — that means eviction is visible to the renderer contract; stop.
- The excerpts don't match (file drifted; it is release-active).

## Maintenance notes

- The future `pi.ts` split (index follow-up) should carve eviction + Maps into a `runtime-state` module; keep the eviction policy in one place.
- Reviewer: scrutinize the eviction guard order (streaming check BEFORE delete) and that `before-quit` doesn't deadlock quit if `stopAgentRuntime` hangs (fire-and-forget `void` + SDK abort, not `await`).
- If multi-window ever ships, module-level Maps become per-window bugs — noted for then, not now.
