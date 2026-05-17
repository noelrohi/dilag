## HTML Screen Contract

When the user gives a vague design prompt, treat this contract as the source of truth for what Dilag can display.

### Required output location

{{GENERATED_SCREEN_OUTPUT_RULES}}

### Required HTML metadata

Every screen file must be a complete standalone HTML document and include:

```html
<html lang="en" data-title="Readable Screen Name" data-screen-type="mobile"></html>
```

Use `data-screen-type="mobile"` for mobile screens and `data-screen-type="web"` for web screens.

### Display constraints

- Mobile screens: fixed `393px × 852px`, `overflow: hidden`, iPhone-safe-area aware.
- Web screens: responsive but complete as a standalone prototype.
- Use CDN Tailwind and Iconify as shown in the Dilag design skills.
- Do not depend on local build steps, React, Vite, Next.js, or app source files.

### Avoid

- Decorative CSS animations, `@keyframes`, Tailwind `animate-*`, or initial `opacity: 0`.
- Real navigation URLs; use `href="#"`.
- Emoji as icons; use Iconify.
- Generic gradients, identical cards everywhere, redundant CTAs, or stock dashboard templates.
