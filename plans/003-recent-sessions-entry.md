# Plan 003: Show recent sessions on the project landing page (the doc-promised "recents" surface)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 963c011..HEAD -- apps/desktop/src/routes/project.\$projectId.tsx apps/desktop/src/hooks/use-sessions.ts docs/platform.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (touches different files than 001/002)
- **Category**: direction (QOL) + docs-drift fix
- **Planned at**: commit `963c011`, 2026-07-07

## Why this matters

`docs/platform.md:26` describes the Home screen as "prompt entry, platform choice, **recent sessions**" — but no recents surface exists anywhere. Worse, the `/` route immediately auto-redirects to the last-opened project whenever any project exists (`routes/index.tsx:31-49`), so the _effective_ home screen is the project landing page (`project.$projectId.tsx`), which today renders only a prompt composer and platform choice. A returning user's fastest path back into yesterday's work is drilling through the sidebar. Adding a "Recent chats" strip to the project landing page delivers the documented affordance at the place users actually land.

## Current state

Relevant files:

- `apps/desktop/src/routes/index.tsx` — true Home; auto-redirects when a project exists:

```tsx
const project = cachedProject ?? getDefaultProject(projects)
if (project) {
  localStorage.setItem("dilag-last-project-id", project.id)
  navigate({ to: "/project/$projectId", params: { projectId: project.id }, replace: true })
  return
}
```

So `index.tsx` is only seen with zero projects — do NOT add recents there.

- `apps/desktop/src/routes/project.$projectId.tsx` — the effective home. Renders `<Outlet/>` when a session route is matched, otherwise a composer landing (`:100-110` onward). Already pulls session machinery:

```tsx
const { createSessionInProject, isServerReady } = useSessions()
```

- `apps/desktop/src/hooks/use-sessions.ts` — exposes `sessions` (array of `SessionMeta`) and `selectSession`-style navigation helpers; sessions are project-scoped by `cwd`.
- `packages/desktop-bridge/src/types.ts:14-24` — the session shape:

```ts
export interface SessionMeta {
  id: string
  name: string
  created_at: string
  updated_at?: string
  cwd: string
  parentID?: string
  platform?: Platform
  favorite?: boolean
  projectId?: string
}
```

- Session route path: `/project/$projectId/session/$sessionId` (file `apps/desktop/src/routes/project.$projectId.session.$sessionId.tsx`).
- `docs/platform.md:26`: `- **Home**: prompt entry, platform choice, recent sessions.`

Repo conventions:

- Cards/sections on these pages use Tailwind + `@dilag/ui` primitives — match the visual language already in `project.$projectId.tsx` and `routes/index.tsx` (rounded-2xl bordered cards, `text-sm text-muted-foreground` secondary text).
- Navigation uses TanStack Router `useNavigate`/`Link` with typed params — exemplar in both route files.
- Icons come from `@tabler/icons-react` with aliased names (see `routes/index.tsx:11-14`, e.g. `IconHistory as History`).

## Commands you will need

| Purpose   | Command                                 | Expected on success |
| --------- | --------------------------------------- | ------------------- |
| Typecheck | `bun run --cwd apps/desktop typecheck`  | exit 0              |
| Tests     | `bun run --cwd apps/desktop test --run` | all pass            |
| Format    | `bun run fmt`                           | exit 0              |

## Scope

**In scope**:

- `apps/desktop/src/routes/project.$projectId.tsx`
- A new component file if the strip is more than ~60 lines: `apps/desktop/src/components/blocks/layout/recent-sessions.tsx` (+ test)
- `docs/platform.md` (one line — see Step 3)

**Out of scope**:

- `apps/desktop/src/routes/index.tsx` — the zero-project home has no sessions to show.
- The session sidebar — it already lists sessions; don't restructure it.
- Session search/filtering — recents only.

## Git workflow

- Branch: `advisor/003-recent-sessions-entry`
- Conventional commits, e.g. `feat(desktop): show recent chats on project landing`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Derive the recents list

In the project landing component (`project.$projectId.tsx`), take `sessions` from the existing `useSessions()` call, filter to the current project (`session.cwd === project.path` — confirm by checking how the session sidebar scopes its list; if it filters by `projectId` instead, match that), sort by `updated_at ?? created_at` descending, take the top 5.

**Verify**: `bun run --cwd apps/desktop typecheck` → exit 0.

### Step 2: Render the strip

Below the composer on the landing view (only when `!sessionRouteMatch` and `project` exists and the list is non-empty), render a "Recent chats" section: one row/card per session showing `name`, relative time from `updated_at ?? created_at`, and `favorite` star when set. Clicking navigates:

```tsx
navigate({
  to: "/project/$projectId/session/$sessionId",
  params: { projectId: project.id, sessionId: session.id },
})
```

Empty list → render nothing (no empty-state card). Keep it a simple vertical list; match the card idiom from `routes/index.tsx:149-160`.

**Verify**: `bun run --cwd apps/desktop test --run` → all pass; `bun run --cwd apps/desktop typecheck` → exit 0.

### Step 3: Fix the docs drift

In `docs/platform.md:26`, update the Home bullet to reflect reality, e.g.:
`- **Home**: prompt entry, platform choice, recent chats (shown on the project landing view).`

**Verify**: `grep -n "recent" docs/platform.md` → matches the new wording.

## Test plan

- New test (in `recent-sessions.test.tsx` if extracted, else extend the project-route test if one exists — check `find apps/desktop/src -name "*.test.*" | grep -i project`; if no harness exists for routes, test the extracted component: model after `apps/desktop/src/components/blocks/layout/app-sidebar.test.tsx`):
  - Renders the 5 most recently updated sessions for the given project, newest first.
  - Sessions from another cwd/project are excluded.
  - Empty list renders nothing.
  - Click fires navigation with the right params (mock router as the exemplar test does).

## Done criteria

- [ ] `bun run --cwd apps/desktop typecheck` exits 0
- [ ] `bun run --cwd apps/desktop test --run` exits 0, incl. new tests
- [ ] `bun run fmt:check` exits 0
- [ ] `docs/platform.md` Home bullet matches shipped behavior
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `useSessions()` on the project landing returns sessions that are NOT scoped/filterable to the current project by either `cwd` or `projectId` (the data model differs from `SessionMeta` above).
- The landing view's structure has drifted (no `sessionRouteMatch` / composer layout as excerpted).
- Rendering the strip requires loading messages per session (it must not — metadata only).

## Maintenance notes

- If session search ships later, this strip is the natural mount point.
- Reviewer: check the strip doesn't fetch anything new — it must derive purely from the already-loaded sessions query.
