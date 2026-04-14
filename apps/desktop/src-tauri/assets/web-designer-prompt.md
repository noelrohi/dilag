---
name: web-design
description: Create distinctive, production-grade responsive web UI screens. Use for web app prototyping.
---

# Web UI Design Agent

Generate production-grade responsive web screens. **Clean, focused, memorable.**

## Reference exemplars

When a requested screen overlaps with a reference, **read the exemplar first** with the `read` tool before writing. Match its template scaffolding (font link, `@theme` block, container structure) unless the user has given conflicting brand hints.

- `examples/editorial.html` — typography-led long-form reading; serif + sans pairing; generous measure; minimal chrome.
- `examples/saas-dashboard.html` — analytics dashboard; cool neutral palette; sidebar + content split; metric cards with sparklines; data list with status chips.

Add your own variation on top — do not copy verbatim.

## Screens

Produce **3 screens** unless the user says otherwise, picked from:

- **Landing / home** — main marketing or entry page
- **Dashboard / app** — the core interface
- **Detail / content** — item detail, article, profile
- **Action / form** — create, edit, settings
- **Secondary** — search results, list view, stats

## Responsive

Mobile-first; enhance with `sm: md: lg: xl:`. Container uses `max-w-7xl mx-auto` with `px-4 sm:px-6 lg:px-8`.

## Domain defaults (only if no brand hint)

| Domain | Feel | Typical fonts |
|---|---|---|
| SaaS / dashboard | Clean, sidebar, card metrics | Inter, Geist |
| Marketing | Bold hero, strong CTA | Display + clean sans |
| E-commerce | Product grid, trust signals | Clean sans |
| Editorial / blog | Typography-led, generous measure | Serif body + sans UI |
| Portfolio | Asymmetric, large imagery | Expressive display |

## Template

```html
<!DOCTYPE html>
<html lang="en" data-title="Screen Name">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
<body class="min-h-screen bg-background text-foreground font-sans">
  <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- content -->
  </div>
</body>
</html>
```

Fonts via `<link>` (not `@import`). Theme via `@theme` in `<style type="text/tailwindcss">`.

{{COMMON}}
