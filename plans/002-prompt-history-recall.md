# Plan 002: ArrowUp in an empty composer recalls prompt history

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 963c011..HEAD -- apps/desktop/src/components/blocks/chat/chat-view.tsx apps/desktop/src/components/ai-elements/prompt-input.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-error-state-recovery.md (both edit `chat-view.tsx`; run 001 first to avoid conflicts)
- **Category**: direction (QOL)
- **Planned at**: commit `963c011`, 2026-07-07

## Why this matters

To refine a mistyped or slightly-off prompt, a Dilag user currently has to retype it from scratch — there is no way to recall what they previously sent. Pressing ArrowUp in an empty composer to bring back the last prompt (and cycle to older ones) is one of the most-used conveniences in every chat UI. It is cheap here because the composer's text state is already exposed via a controller context.

Deliberately **not** in this plan: an "edit and resend from this point" action on prior user messages. That interacts with the session tree / fork semantics and needs its own design. This plan is only composer-side recall.

## Current state

Relevant files:

- `apps/desktop/src/components/blocks/chat/chat-view.tsx` — contains `ChatInputArea` (composer, ~line 910 onward) with a `handleKeyDown` that currently uses ArrowUp/ArrowDown **only** while the `@`-mention popover is open (~`:1090-1106`):

```tsx
if (mentionOpen && e.key === "ArrowUp") {
  e.preventDefault()
  e.stopPropagation()
  if (mentionSearchResults.length === 0) return
  setHighlightedMentionIndex(
    (prev) => (prev - 1 + mentionSearchResults.length) % mentionSearchResults.length,
  )
  return
}
```

When the mention popover is closed, ArrowUp falls through to default textarea behavior. An empty composer has no history recall.

- `apps/desktop/src/components/ai-elements/prompt-input.tsx` — the composer state provider. The controller exposes text state (`prompt-input.tsx:103-104`, `:120-124`, `:295-296`):

```ts
  value: string
  setInput: (v: string) => void
  ...
export const usePromptInputController = () => {
```

- `sendMessage` is invoked from `ChatInputArea` (prop `sendMessage(message, files?, options?)`, see `chat-view.tsx:910-925`). The submitted text is available at the call site where the composer submits.

Repo conventions:

- Persistent lightweight UI state uses `localStorage` directly — exemplar: `apps/desktop/src/routes/index.tsx:33` (`localStorage.getItem("dilag-last-project-id")`).
- Tests: vitest + happy-dom; composer behavior tests exist in `apps/desktop/src/components/ai-elements/prompt-input.test.tsx` and `chat-view.test.tsx`.

## Commands you will need

| Purpose   | Command                                 | Expected on success |
| --------- | --------------------------------------- | ------------------- |
| Typecheck | `bun run --cwd apps/desktop typecheck`  | exit 0              |
| Tests     | `bun run --cwd apps/desktop test --run` | all pass            |
| Format    | `bun run fmt`                           | exit 0              |

## Scope

**In scope**:

- `apps/desktop/src/components/blocks/chat/chat-view.tsx`
- A new small module `apps/desktop/src/lib/prompt-history.ts` (+ its test)
- `apps/desktop/src/components/blocks/chat/chat-view.test.tsx`

**Out of scope**:

- `prompt-input.tsx` — read its controller, don't modify it (the keydown lives in `ChatInputArea`, not the provider).
- Any "edit message / resend from here" UI on prior messages — session-tree semantics, deferred.
- Cross-session or global history (history is per session).

## Git workflow

- Branch: `advisor/002-prompt-history-recall`
- Conventional commits, e.g. `feat(desktop): add composer prompt history recall`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the history helper

New file `apps/desktop/src/lib/prompt-history.ts`, pure functions + localStorage persistence:

```ts
const KEY = (sessionId: string) => `dilag-prompt-history:${sessionId}`
const LIMIT = 50

export function loadPromptHistory(sessionId: string): string[]
export function pushPromptHistory(sessionId: string, prompt: string): void // dedup consecutive, cap at LIMIT
```

Guard all storage access with try/catch (quota/unavailable → no-op), matching how the codebase treats localStorage as best-effort.

**Verify**: `bun run --cwd apps/desktop test --run src/lib/prompt-history.test.ts` → pass (write the test in the same step; see Test plan).

### Step 2: Record submitted prompts

In `ChatInputArea` (chat-view.tsx), at the point where a prompt is successfully handed to `sendMessage`, call `pushPromptHistory(sessionId, text)`. `sessionId` is already a prop of `ChatInputArea`.

**Verify**: `bun run --cwd apps/desktop typecheck` → exit 0.

### Step 3: Recall on ArrowUp / ArrowDown in an empty-or-recalling composer

In `handleKeyDown` in `ChatInputArea`, **after** the existing `mentionOpen` branches (so mention navigation keeps priority), add:

- Track a `historyIndexRef` (`useRef<number | null>(null)`) and reset it to `null` whenever the user edits the text by typing (i.e., in the existing text-change handler) or the session changes.
- On `ArrowUp` when `mentionOpen` is false AND (composer value is empty OR `historyIndexRef.current !== null`) AND the caret is on the first line: load history, step backwards, `setInput(history[newIndex])`, `e.preventDefault()`.
- On `ArrowDown` while `historyIndexRef.current !== null`: step forward; stepping past the newest entry restores the empty string and resets the ref to `null`.

Use `usePromptInputController()` for `value`/`setInput` (already available in this component tree — `ChatView` wraps everything in `PromptInputProvider`, `chat-view.tsx:1520+`). The "caret on first line" check: `textarea.selectionStart` ≤ first `\n` index (or value has no newline); access the textarea via the event target (`e.target as HTMLTextAreaElement`).

**Verify**: `bun run --cwd apps/desktop typecheck` → exit 0; `bun run --cwd apps/desktop test --run` → all pass.

## Test plan

- New `apps/desktop/src/lib/prompt-history.test.ts` (model after `apps/desktop/src/lib/version.test.ts` — plain vitest unit style):
  - push then load round-trips; consecutive duplicates collapse; LIMIT enforced (oldest dropped); storage exceptions swallowed (mock `localStorage.setItem` to throw).
- `chat-view.test.tsx` (follow the existing keyboard-interaction tests around the mention popover if present, otherwise the file's render harness):
  - Empty composer + ArrowUp → composer value becomes the last submitted prompt.
  - Second ArrowUp → previous prompt; ArrowDown steps back; stepping past newest clears the composer.
  - ArrowUp while the mention popover is open does NOT trigger history (mention branch already returns early — assert composer value unchanged).

## Done criteria

- [ ] `bun run --cwd apps/desktop typecheck` exits 0
- [ ] `bun run --cwd apps/desktop test --run` exits 0; new prompt-history unit tests + chat-view recall tests pass
- [ ] `bun run fmt:check` exits 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The keydown handler or composer state shape in `chat-view.tsx` doesn't match the excerpts (drift — especially if plan 001 restructured more than expected).
- `usePromptInputController` is not reachable from `ChatInputArea` (provider boundary differs from the plan's claim).
- Implementing recall requires modifying `prompt-input.tsx` — report what's missing instead of editing it.

## Maintenance notes

- If "edit & resend" on prior messages ships later, it should reuse `setInput` from the same controller and may want to share `prompt-history.ts`.
- History is intentionally per-session and capped; a reviewer should check the localStorage key can't collide with other keys (`dilag-` prefix convention).
