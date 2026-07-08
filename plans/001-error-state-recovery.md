# Plan 001: Make every error state recoverable — stop full-screen hijacks, surface startup failures, always show session errors

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 963c011..HEAD -- apps/desktop/src/components/blocks/chat/chat-view.tsx apps/desktop/src/context/session-store.tsx apps/desktop/src/context/global-events.tsx apps/desktop/src/hooks/use-sessions.ts apps/desktop/src/components/blocks/layout/session-sidebar.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `963c011`, 2026-07-07

## Why this matters

Dilag's failure handling currently has three dead-ends that make routine errors feel catastrophic:

1. A single global `error` field in the Zustand store causes the **entire chat view** (messages, composer, everything) to be replaced by a full-screen error card whenever _any_ session operation fails — a failed rename, delete, fork, or send. Switching sessions does not clear it.
2. If the embedded Pi agent runtime fails to start, the app shows a permanent "Starting server / Initializing Pi..." spinner. The error message is captured into `serverError` in React context but **never rendered anywhere**, and there is no retry.
3. `session.error` events whose payload lacks a `.data` field flip the session out of its loading state with **no visible error at all**, and the full-screen `ErrorState` card has no action buttons — no Retry, no way to open settings.

After this plan: operation failures show as toasts, session-level errors always render inline in the chat, runtime-startup failure shows an actionable error with a Retry button, and the unreachable "reconnecting" UI is removed.

## Current state

Relevant files:

- `apps/desktop/src/components/blocks/chat/chat-view.tsx` — the Studio chat UI. Contains the full-screen gate, the `ErrorState` component, and the inline error card.
- `apps/desktop/src/context/session-store.tsx` — Zustand store (immer middleware). Holds the global `error` field and the `session.error` event handler.
- `apps/desktop/src/context/global-events.tsx` — `GlobalEventsProvider`, starts the agent runtime and subscribes to events. Holds the never-rendered `serverError`.
- `apps/desktop/src/hooks/use-sessions.ts` — session CRUD hook; its catch blocks write the global `error`.
- `apps/desktop/src/components/blocks/layout/session-sidebar.tsx` — renders a connection-status indicator including an unreachable "reconnecting" state.

The full-screen gate (`chat-view.tsx:1511-1517`):

```tsx
if (!isServerReady) {
  return <LoadingState />
}

if (error) {
  return <ErrorState error={error} />
}
```

`error` and `isServerReady` come from `useSessions()` (`chat-view.tsx:1453-1465`).

`ErrorState` is text-only, no actions (`chat-view.tsx:888-908`):

```tsx
function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      ...
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-destructive">{error}</h3>
            <p className="text-xs text-muted-foreground">
              Make sure Pi has an authenticated model provider configured.
            </p>
          </div>
      ...
```

The store's global error field (`session-store.tsx:163`, setter at `:739-742`, hook at `:1036`):

```ts
export const useError = () => useSessionStore((state) => state.error)
```

The catch blocks in `use-sessions.ts` that write it — `createSession` (~`:339`), `renameSession` (~`:467`), `deleteSession` (~`:501`), `forkSession` (~`:561`), `forkSessionDesignsOnly`, and `sendMessage` (~`:692`). Example (`renameSession`):

```ts
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename session")
        console.error("Failed to rename session:", err)
      }
```

`sendMessage`'s catch additionally sets session status but **not** the per-session error, so the inline card never shows for it:

```ts
      } catch (err) {
        if (!isMountedRef.current) return
        setError(err instanceof Error ? err.message : "Failed to send message")
        setSessionStatus(currentSessionId, "error")
        console.error("Failed to send message:", err)
        throw err
      }
```

The `session.error` event handler drops payloads without `.data` (`session-store.tsx:903-918`):

```ts
if (isEventSessionError(event)) {
  const { sessionID, error } = event.properties
  if (sessionID) {
    setSessionStatus(sessionID, "error")
    // Extract error message from typed error
    if (error && "data" in error && error.data) {
      const data = error.data as Record<string, unknown>
      const message = data.message || "Unknown error"
      setSessionError(sessionID, {
        name: error.name,
        message: typeof message === "string" ? message : "Unknown error",
      })
    }
  }
  return
}
```

The inline error card renders only when `sessionError` is non-null (`chat-view.tsx:822`):

```tsx
{
  isLast && !isStreaming && sessionError && <InlineErrorCard error={sessionError} />
}
```

The startup path (`global-events.tsx:98-146`): `init()` calls `bridge.agent.start()`; on throw it does:

```ts
      } catch (err) {
        console.error("[GlobalEvents] Agent runtime start error:", err)
        if (mountedRef.current) {
          setIsServerReady(false)
          setServerError(err instanceof Error ? err.message : String(err))
          setConnectionStatus("disconnected")
        }
      }
```

`serverError` is exposed in the context value (`global-events.tsx:167`) but `grep -rn "serverError" apps/desktop/src` shows its only occurrences are inside `global-events.tsx` itself — nothing consumes it. The effect never retries. `reconnectAttempt` is dead state (`global-events.tsx:49`):

```ts
const [reconnectAttempt] = useState(0)
```

(the setter is discarded, so the value is forever 0), and `session-sidebar.tsx:~95-110` renders a `reconnecting` status branch that can never occur because `connectionStatus` is only ever set to `connecting`/`connected`/`disconnected`.

Repo conventions to match:

- Toasts use `sonner` — exemplar: `apps/desktop/src/lib/design-export.ts:1` (`import { toast } from "sonner"`) and its `toast.error(...)` calls.
- Store uses Zustand + immer; follow the existing action style in `session-store.tsx` (e.g. `setError` at `:739`).
- Component tests use vitest + happy-dom; exemplar: `apps/desktop/src/components/blocks/chat/chat-view.test.tsx`.

## Commands you will need

| Purpose   | Command                                                                               | Expected on success |
| --------- | ------------------------------------------------------------------------------------- | ------------------- |
| Install   | `bun install`                                                                         | exit 0              |
| Typecheck | `bun run --cwd apps/desktop typecheck`                                                | exit 0, no errors   |
| All tests | `bun run --cwd apps/desktop test --run`                                               | all pass            |
| One file  | `bun run --cwd apps/desktop test --run src/components/blocks/chat/chat-view.test.tsx` | all pass            |
| Format    | `bun run fmt`                                                                         | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `apps/desktop/src/components/blocks/chat/chat-view.tsx`
- `apps/desktop/src/context/session-store.tsx`
- `apps/desktop/src/context/global-events.tsx`
- `apps/desktop/src/hooks/use-sessions.ts`
- `apps/desktop/src/components/blocks/layout/session-sidebar.tsx`
- Their test files: `chat-view.test.tsx`, `session-store.test.ts`, `use-sessions.test.ts`, `session-sidebar.test.tsx` (if present)

**Out of scope** (do NOT touch, even though they look related):

- `apps/desktop/electron/**` — the event _emitter_ side (`ipc/pi.ts`) is covered by plan 006; do not change what main sends.
- `packages/desktop-bridge/**` — no contract changes needed.
- The `InlineErrorCard` component's visual design.

## Git workflow

- Branch: `advisor/001-error-state-recovery`
- Conventional commits, e.g. `fix(desktop): route session-op failures to toasts` (matches repo history like `fix(desktop): polish chat progress states`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Route operation failures to toasts instead of the global error field

In `apps/desktop/src/hooks/use-sessions.ts`, in the catch blocks of `renameSession`, `deleteSession`, `forkSession`, `forkSessionDesignsOnly`, and `createSession`/`createSessionInProject`: replace `setError(...)` with `toast.error(...)` using the same message (import `toast` from `"sonner"` — see `design-export.ts:1`). Keep the `console.error` lines. Update each `useCallback` dependency array (remove `setError` where no longer used).

In `sendMessage`'s catch block: replace `setError(...)` with `setSessionError(currentSessionId, { name: "PromptError", message: err instanceof Error ? err.message : "Failed to send message" })` so the existing inline card shows it; keep `setSessionStatus(currentSessionId, "error")` and the rethrow.

**Verify**: `grep -n "setError(" apps/desktop/src/hooks/use-sessions.ts` → only occurrences left are `setError(null)` resets (or none). `bun run --cwd apps/desktop typecheck` → exit 0.

### Step 2: Always set a session error on `session.error` events

In `session-store.tsx` (~`:903-918`), restructure the handler so `setSessionError` is **always** called when `sessionID` is present, with a fallback:

```ts
const data =
  error && "data" in error && error.data ? (error.data as Record<string, unknown>) : undefined
const message = typeof data?.message === "string" ? data.message : "Unknown error"
setSessionError(sessionID, { name: error?.name ?? "SessionError", message })
```

**Verify**: `bun run --cwd apps/desktop test --run src/context/session-store.test.ts` → pass (add the new test in Step 6 if the file's harness makes it natural to add now).

### Step 3: Surface runtime-startup failure with a Retry

In `global-events.tsx`:

1. Extract the body of `init()` so it can be re-invoked: keep it inside the effect but also expose a `retryStart` function in the context value that re-runs the same start sequence (guarding with a ref so two concurrent starts can't run). The simplest safe shape: move `init` into a `useCallback` (depending on `bootstrap`), have the mount effect call it, and expose it as `retryStart`. Ensure a successful retry clears `serverError`, sets `connectionStatus("connected")` and `isServerReady(true)` — the existing success path already does this.
2. Delete the dead `reconnectAttempt` state and remove it from the context value and its type. Update `session-sidebar.tsx`: delete the `reconnecting` entry from its status map and any reference to `reconnectAttempt` (the type union for `connectionStatus` may also need the `"reconnecting"` member removed — it is declared in `global-events.tsx`).

**Verify**: `grep -rn "reconnectAttempt\|reconnecting" apps/desktop/src` → no matches. `bun run --cwd apps/desktop typecheck` → exit 0.

### Step 4: Render the startup error in ChatView

In `chat-view.tsx`:

1. Read `serverError` and `retryStart` from the global-events context (the file already imports from `@/context/global-events` or add the hook import used elsewhere — check how `use-sessions.ts` accesses `globalServerReady` and match that pattern).
2. Change the gate so a startup failure is distinguishable from loading:

```tsx
if (serverError) {
  return <ErrorState error={serverError} onRetry={retryStart} />
}
if (!isServerReady) {
  return <LoadingState />
}
```

3. Extend `ErrorState` with optional actions: an `onRetry?: () => void` prop rendering a `Button` labeled "Retry", and a "Open Settings" `Link` to the `/settings` route (TanStack Router `Link`, route exists at `apps/desktop/src/routes/settings.tsx`). Keep the existing visual structure; use `Button` from `@dilag/ui/button` as elsewhere in the file.

Note: after Step 1, the store's global `error` is only ever written by legacy paths; if nothing writes it anymore, delete the `if (error) return <ErrorState .../>` branch, the `error` field, `setError` action, and `useError` hook from `session-store.tsx`, and remove `error` from the `useSessions()` return. If some caller still legitimately needs it, keep the field but STOP and report instead of guessing.

**Verify**: `bun run --cwd apps/desktop typecheck` → exit 0. `bun run --cwd apps/desktop test --run` → all pass.

### Step 5: Clear stale per-session errors on session switch

In `use-sessions.ts`, find the session-selection path (`setCurrentSessionId` callers / `selectSession` if present) and ensure switching sessions calls `setSessionError(previousId, null)` is NOT needed (errors are per-session, so they may stay), but the _global_ gate no longer exists so nothing to clear. If Step 4 kept the global `error` field, add `setError(null)` on session switch.

**Verify**: manual reasoning + `bun run --cwd apps/desktop test --run` → all pass.

### Step 6: Tests

See Test plan below.

**Verify**: `bun run --cwd apps/desktop test --run` → all pass, including new tests. `bun run fmt` then `bun run fmt:check` → exit 0.

## Test plan

- `session-store.test.ts` (exists — follow its existing `handleEvent` test style):
  - `session.error` event **without** `data` → `sessionError` for that session is set with message `"Unknown error"` and status is `"error"`.
  - `session.error` event with `data.message` → message propagated (likely already covered; keep).
- `chat-view.test.tsx` (exists — follow its render/mock harness):
  - When the global-events context provides `serverError`, the error card renders with a "Retry" button, and clicking it calls the retry function.
  - When a session op fails (mock `bridge.sessions.saveMeta` rejection through the hook, or simulate at the hook level in `use-sessions.test.ts`), the chat messages remain rendered (no full-screen takeover).
- `use-sessions.test.ts` (exists): rename failure → `toast.error` called (mock `sonner`), store's global error not set.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run --cwd apps/desktop typecheck` exits 0
- [ ] `bun run --cwd apps/desktop test --run` exits 0, with the new tests above present
- [ ] `grep -rn "reconnectAttempt" apps/desktop/src` → no matches
- [ ] `grep -n "setError(" apps/desktop/src/hooks/use-sessions.ts` → no error-message writes remain (only `setError(null)` or nothing)
- [ ] `bun run fmt:check` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts above don't match the live code (drift since `963c011`).
- Removing the global `error` field breaks a consumer outside the in-scope files — report the consumer instead of expanding scope.
- The `init()` restructure in `global-events.tsx` would require changing when `bootstrap()` runs relative to event subscription (ordering there is load-bearing: store handler is attached inside `onEvent` after `bootstrap`).
- `session-sidebar.tsx` uses `connectionStatus` values from somewhere other than `global-events.tsx`.

## Maintenance notes

- Plan 006 (Pi session lifecycle) touches the emitter side of `session.error`; if it changes the error payload shape, the fallback added in Step 2 keeps the UI safe.
- Reviewer should scrutinize: the retry path can't double-subscribe `bridge.agent.onEvent` (the old unsubscribe must run or be guarded).
- Deferred: automatic retry with backoff (manual Retry only, by design — in-process IPC makes spontaneous drops unlikely); edit/resend of failed prompts (plan 002 territory).
