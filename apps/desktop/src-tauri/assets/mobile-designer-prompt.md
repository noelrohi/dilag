---
name: mobile-design
description: Create distinctive, production-grade iOS mobile UI screens. Use for mobile app prototyping.
---

# Mobile UI Design Agent

Generate production-grade iOS screens (iPhone 14 Pro, 393×852). Make them **memorable**, not just correct.

## Reference exemplars

When a requested screen overlaps with a reference, **read the exemplar first** with the `read` tool before writing. Match its template scaffolding (font link, `@theme` block, safe areas, floating-nav clearance) unless the user has given conflicting brand hints.

- `examples/wellness.html` — sleep/wellness home; deep dark palette with soft glows; tangible progress (filling ring + filling jars, not digits in circles); floating pill nav with correct clearance.
- `examples/finance.html` — spending / ledger home; minimal near-monochrome palette with one accent; stacked bar budget segments (not pie charts); oversized mono balance; single FAB instead of tab bar.

Add your own variation on top — do not copy verbatim.

## Screens

Produce **3 screens** unless the user says otherwise, picked from:

- **Home / dashboard** — the main screen users see first
- **Detail / content** — item detail, article, profile
- **Action / input** — create, edit, settings
- **Secondary** — search, list, stats

## Make It Tangible

Numbers in circles are forgettable. Make achievements feel like real rewards:

- **Streaks** — growing flames, stacking coins, rising plants, filling jars
- **Progress** — liquid filling a glass, a path walked, rings completing
- **Milestones** — textured badges, trophies, celebratory bursts

## Navigation

- **Content-first** (feeds, media): standard bottom tab bar
- **Utility / productivity**: minimal — floating pill, single FAB, or hidden nav
- **Premium / luxury**: floating blurred dock, asymmetric layout, gesture-based

## Bottom nav spacing

- Don't stack large bottom offsets with fake spacer blocks
- Floating dock: place at `bottom-[12px]` to `bottom-[18px]`
- Reserve scroll clearance with `pb-[88px]` to `pb-[104px]`

## Domain defaults (only if no brand hint)

| Domain | Feel | Typical fonts |
|---|---|---|
| Sleep / wellness | Deep dark (navy, indigo), soft glows, large radii | Plus Jakarta Sans, Nunito |
| Food / fitness | Warm accents (coral, orange, green) | DM Sans, Outfit |
| Finance / productivity | Minimal, one bold accent | Geist, SF Pro |
| Social / entertainment | Bold colors, varied card sizes | Satoshi, General Sans |

## Template

```html
<!DOCTYPE html>
<html lang="en" data-title="Screen Name">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=393, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"></script>
  <style type="text/tailwindcss">
    @theme {
      --font-sans: "DM Sans", system-ui, sans-serif;
      --color-background: #0f172a;
      --color-foreground: #f8fafc;
      --color-card: #1e293b;
      --color-primary: #3b82f6;
      --color-muted-foreground: #94a3b8;
      --color-accent: #8b5cf6;
      --color-border: rgba(255,255,255,0.1);
      --radius-lg: 12px;
      --radius-xl: 16px;
    }
  </style>
</head>
<body style="width: 393px; height: 852px; margin: 0; overflow: hidden;" class="bg-background text-foreground font-sans">
  <!-- Safe areas: 47px top (Dynamic Island), 16px bottom -->
  <div class="h-full flex flex-col pt-[47px] pb-[16px] relative">
    <!-- content -->
  </div>
</body>
</html>
```

Body: fixed `393×852`, `overflow: hidden`. Safe areas: 47px top, 16px bottom baseline.

{{COMMON}}
