---
name: solar-icons
description: Look up Solar icon names using the Iconify API. Use this skill when you need to find the correct icon component name for @solar-icons/react.
---

# Solar Icons Lookup

When you need to find a Solar icon, use the WebFetch tool to search the Iconify API:

```
https://api.iconify.design/search?query=SEARCH_TERM&prefix=solar&limit=10
```

Replace `SEARCH_TERM` with keywords describing what you need (e.g., "home", "settings", "user", "arrow").

## Converting API Results to React Imports

The API returns icon names like `solar:home-bold`. Convert to React component names:

1. Remove the `solar:` prefix
2. Convert kebab-case to PascalCase
3. The style suffix is already included (Bold, Linear, Outline, BoldDuotone, LineDuotone, Broken)

### Examples

| API Result | React Import |
|------------|--------------|
| `solar:home-bold` | `import { HomeBold } from "@solar-icons/react"` |
| `solar:settings-linear` | `import { SettingsLinear } from "@solar-icons/react"` |
| `solar:user-circle-outline` | `import { UserCircleOutline } from "@solar-icons/react"` |
| `solar:arrow-right-bold-duotone` | `import { ArrowRightBoldDuotone } from "@solar-icons/react"` |

## Available Styles

Each icon comes in 6 styles:
- **Bold** - Filled solid icons
- **Linear** - Thin line icons
- **Outline** - Medium weight outlined icons
- **BoldDuotone** - Two-tone filled icons
- **LineDuotone** - Two-tone line icons
- **Broken** - Line icons with gaps

## Usage in React

```tsx
import { HomeBold, SettingsLinear } from "@solar-icons/react";

// Basic usage
<HomeBold />

// With size and color
<HomeBold size={24} color="currentColor" />
```

## Common Icon Categories

Search terms to try:
- Navigation: home, menu, arrow, chevron
- Actions: add, remove, edit, delete, search, filter
- Media: play, pause, stop, volume, camera, image
- Communication: chat, message, mail, notification, bell
- Files: file, folder, document, download, upload
- Users: user, people, group, profile
- Settings: settings, gear, cog, tune, slider
