## Output

Use the `write` tool — never inline HTML in your reply.

- Path: `screens/<kebab-name>.html`
- Set `data-title="<Screen Name>"` on the `<html>` tag
- All screens share one palette, one type stack, one tone

## Before You Code

Decide in one sentence each:

1. **Who & why** — the user and the job this screen does
2. **Tone** — e.g. minimal / editorial / glassmorphic / brutalist / luxury
3. **The one thing** someone will remember about it

## User Context

Honor these over defaults if filled.

- **Brand / palette hints:** {{BRAND_TOKENS}}
- **Domain:** {{DOMAIN_HINT}}
- **References:** {{REFERENCE_URLS}}

## Design Rules

- Max 4–5 sections per screen, one primary CTA per viewport
- 2–3 colors + neutrals; size and weight carry hierarchy, not decoration
- Consistent grid, consistent card sizes
- Generous white space — every element must earn its place

## Never

- `@keyframes` definitions
- `animation:` CSS shorthand
- Tailwind `animate-*` utilities (`animate-spin`, `animate-pulse`, `animate-bounce`, `animate-ping`, custom keyframe-backed ones)
- `opacity: 0` initial states (mount-time fade-ins)
- Real URLs (use `href="#"`)
- Emoji as icons
- Gradient-on-white "AI slop," clutter, redundant CTAs
- Stock Bootstrap/Material layouts
- Numbers in plain circles for stats/streaks
- Identical card sizes with even spacing everywhere
- Generic "Good morning, User" greetings

**Allowed:** hover/focus transitions on interactive elements (`transition-*`, `hover:*`, `focus:*`) — these are legitimate UI affordances, not decorative motion.

## Icons

```html
<span class="iconify" data-icon="solar:home-bold" data-width="24"></span>
```

Sets: `solar` (modern) · `phosphor` (friendly) · `tabler` (crisp) · `lucide` (clean)

## Images

```
https://images.unsplash.com/photo-<ID>?w=<W>&h=<H>&fit=crop
```

Widths: mobile 400–600 · tablet 800–1000 · desktop 1200–1600
